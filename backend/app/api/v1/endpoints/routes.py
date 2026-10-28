"""
app/api/v1/endpoints/routes.py
Endpoints para gestion de rutas y paradas de entrega.
Incluye creacion, consulta, optimizacion y actualizacion de estado.
Todos requieren JWT; cada conductor solo ve/modifica sus propias rutas.
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_driver
from app.db.session import get_db
from app.models.driver import Driver
from app.models.route import Route, RouteStatus
from app.models.stop import Stop
from app.schemas.route import (
    RouteCreate, RouteResponse, RouteDetailResponse, RouteOptimizeResponse,
)
from app.schemas.stop import StopBulkCreate, StopUpdate, StopResponse
from app.utils.normalization import normalize_bogota_address
from app.services.geocoding import geocode_address
from app.services.routing import optimize_route
from app.services.stop_service import (
    apply_stop_update,
    create_stop,
    get_owned_route,
    get_owned_stop,
    next_sequence_order,
    recount_route,
)

router = APIRouter(prefix="/routes", tags=["Rutas"])


# ─── POST /routes ────────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=RouteDetailResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear ruta",
    description=(
        "Crea una nueva ruta para el conductor autenticado. "
        "Se pueden incluir paradas iniciales (con sus clientes) en el payload; "
        "las que no traigan lat/lng se normalizan y geocodifican automaticamente."
    ),
)
async def create_route(
    payload: RouteCreate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Route:
    route = Route(
        driver_id=driver.id,
        route_date=payload.route_date,
        origin_lat=payload.origin_lat,
        origin_lng=payload.origin_lng,
    )
    db.add(route)
    await db.flush()  # Obtener ID de la ruta

    for i, stop_in in enumerate(payload.stops or [], start=1):
        await create_stop(db, route.id, stop_in, sequence_order=i)

    await recount_route(db, route.id)
    await db.commit()

    return await get_owned_route(db, route.id, driver.id, with_stops=True)


# ─── GET /routes/{route_id} ──────────────────────────────────────────────────
@router.get(
    "/{route_id}",
    response_model=RouteDetailResponse,
    summary="Obtener ruta con paradas",
    description="Retorna una ruta con todas sus paradas (y clientes) ordenadas por secuencia.",
)
async def get_route(
    route_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Route:
    return await get_owned_route(db, route_id, driver.id, with_stops=True)


# ─── GET /routes (listar rutas del conductor) ────────────────────────────────
@router.get(
    "",
    response_model=list[RouteResponse],
    summary="Listar rutas del conductor",
    description="Retorna las rutas del conductor autenticado, opcionalmente filtradas por estado.",
)
async def list_routes(
    status_filter: RouteStatus | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> list[Route]:
    query = select(Route).where(Route.driver_id == driver.id)
    if status_filter:
        query = query.where(Route.status == status_filter)
    query = query.order_by(Route.route_date.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


# ─── POST /routes/{route_id}/stops ───────────────────────────────────────────
@router.post(
    "/{route_id}/stops",
    response_model=list[StopResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Agregar paradas a una ruta",
    description=(
        "Agrega una o mas paradas (cada una con sus clientes) a una ruta existente. "
        "Si no traen lat/lng se normalizan (regex Bogota) y se geocodifican con Mapbox."
    ),
)
async def add_stops(
    route_id: uuid.UUID,
    payload: StopBulkCreate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> list[Stop]:
    route = await get_owned_route(db, route_id, driver.id)

    sequence = await next_sequence_order(db, route.id)
    created_ids: list[uuid.UUID] = []
    for stop_in in payload.stops:
        stop = await create_stop(db, route.id, stop_in, sequence)
        created_ids.append(stop.id)
        sequence += 1

    await recount_route(db, route.id)
    await db.commit()

    return [await get_owned_stop(db, sid, driver.id) for sid in created_ids]


# ─── PATCH /routes/{route_id}/stops/{stop_id} ────────────────────────────────
@router.patch(
    "/{route_id}/stops/{stop_id}",
    response_model=StopResponse,
    summary="Actualizar parada de una ruta",
    description=(
        "Actualizacion parcial de una parada (estado, color, direccion, clientes). "
        "Equivalente a PUT /stops/{stop_id} pero validando que pertenezca a esta ruta."
    ),
)
async def update_stop(
    route_id: uuid.UUID,
    stop_id: uuid.UUID,
    payload: StopUpdate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Stop:
    stop = await get_owned_stop(db, stop_id, driver.id, route_id=route_id)

    status_changed = await apply_stop_update(db, stop, payload)
    if status_changed:
        await recount_route(db, route_id)
    await db.commit()

    return await get_owned_stop(db, stop_id, driver.id, route_id=route_id)


# ─── POST /routes/{route_id}/optimize ────────────────────────────────────────
@router.post(
    "/{route_id}/optimize",
    response_model=RouteOptimizeResponse,
    summary="Optimizar ruta con OR-Tools",
    description=(
        "Calcula el orden optimo de visita usando Google OR-Tools (TSP). "
        "El punto de partida (nodo 0 de la matriz) DEBE proporcionarse en cada "
        "llamada via start_lat+start_lon (GPS del conductor) o start_address "
        "(direccion en texto que pasa por el normalizador y geocodificador). "
        "Actualiza el sequence_order de cada parada."
    ),
)
async def optimize_route_endpoint(
    route_id: uuid.UUID,
    start_lat: float | None = Query(
        None,
        ge=-90.0,
        le=90.0,
        description=(
            "Latitud del punto de inicio (bodega o ubicacion actual del conductor). "
            "Si se provee junto con start_lon, tiene prioridad sobre start_address."
        ),
    ),
    start_lon: float | None = Query(
        None,
        ge=-180.0,
        le=180.0,
        description="Longitud del punto de inicio.",
    ),
    start_address: str | None = Query(
        None,
        min_length=5,
        max_length=300,
        description=(
            "Direccion de texto del punto de inicio (alternativa a lat/lon). "
            "Pasa por el normalizador de Bogota y luego por Mapbox Geocoding. "
            "Ejemplo: 'Calle 166 # 9-24 Usaquen'."
        ),
    ),
    return_to_depot: bool = Query(
        False,
        description=(
            "Si True, la ruta es circular (el conductor regresa al inicio al final). "
            "Si False (default), open TSP: termina en la ultima parada."
        ),
    ),
    max_seconds: int = Query(
        30,
        ge=5,
        le=120,
        description="Tiempo maximo para el solver OR-Tools (segundos).",
    ),
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> dict:
    # --- Cargar ruta (del conductor) con todas sus paradas ---
    route = await get_owned_route(db, route_id, driver.id, with_stops=True)

    if not route.stops:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La ruta no tiene paradas para optimizar",
        )

    # --- Resolver el punto de inicio (nodo 0 de la matriz) ---
    # Prioridad: 1) start_lat+start_lon explícitos  2) start_address geocodificado
    #            3) origin guardado en la ruta       4) error claro al cliente
    origin_lat: float | None = None
    origin_lng: float | None = None
    origin_source: str = "unknown"

    # Opcion 1: coordenadas explicitas (GPS del movil - mas preciso y sin costo)
    if start_lat is not None and start_lon is not None:
        origin_lat = start_lat
        origin_lng = start_lon
        origin_source = "gps_explicit"

    # Opcion 2: direccion en texto -> normalizar -> geocodificar con Mapbox
    elif start_address is not None:
        norm = normalize_bogota_address(start_address)
        address_to_geocode = norm.geocodable_address or start_address
        try:
            geo = await geocode_address(address_to_geocode)
            if geo:
                origin_lat = geo["latitude"]
                origin_lng = geo["longitude"]
                origin_source = f"geocoded_address (confianza: {geo.get('confidence', '?')})"
            else:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"No se pudo geocodificar la direccion de inicio: '{start_address}'. "
                        "Verifica la direccion o usa start_lat/start_lon directamente."
                    ),
                )
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail=(
                    f"Error al geocodificar la direccion de inicio con Mapbox: {exc}. "
                    "Usa start_lat/start_lon como alternativa."
                ),
            ) from exc

    # Opcion 3: usar el origen guardado en la ruta (definido al crear la ruta)
    elif route.origin_lat is not None and route.origin_lng is not None:
        origin_lat = route.origin_lat
        origin_lng = route.origin_lng
        origin_source = "route_stored_origin"

    # Sin origen: error descriptivo
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No se puede optimizar sin un punto de inicio. "
                "Provee start_lat y start_lon (ubicacion GPS del conductor o bodega), "
                "o start_address (direccion en texto). "
                "Tambien puedes guardar el origen al crear la ruta (origin_lat/origin_lng)."
            ),
        )

    # --- Llamar al servicio OR-Tools ---
    opt_result = await optimize_route(
        stops=route.stops,
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        max_solve_seconds=max_seconds,
        return_to_depot=return_to_depot,
    )

    # --- Actualizar sequence_order usando UUID map O(1) ---
    stop_map: dict[uuid.UUID, Stop] = {s.id: s for s in route.stops}
    for new_order, stop_id in enumerate(opt_result.optimized_stop_ids, start=1):
        if stop_id in stop_map:
            stop_map[stop_id].sequence_order = new_order

    await db.flush()

    # --- Persistir metadata ---
    route.optimization_metadata = {
        "solver_status": opt_result.solver_status,
        "total_distance_km": opt_result.total_distance_km,
        "total_duration_min": opt_result.total_duration_min,
        "return_to_depot": return_to_depot,
        "origin_lat": origin_lat,
        "origin_lng": origin_lng,
        "origin_source": origin_source,
        "optimized_stop_ids": [str(sid) for sid in opt_result.optimized_stop_ids],
        **opt_result.metadata,
    }
    await db.flush()
    await db.refresh(route, ["stops"])

    # --- Respuesta ---
    sorted_stops = sorted(
        route.stops,
        key=lambda s: (s.sequence_order is None, s.sequence_order or 0),
    )
    geocoded_count = sum(1 for s in route.stops if s.lat is not None and s.lng is not None)
    non_geocoded_count = len(route.stops) - geocoded_count

    message = (
        f"Ruta optimizada con OR-Tools ({opt_result.solver_status}). "
        f"Inicio: {origin_source}. "
        f"{geocoded_count} paradas en orden optimo"
        + (f", {non_geocoded_count} sin geocodificar al final." if non_geocoded_count else ".")
    )

    return {
        "route_id": route.id,
        "message": message,
        "total_stops": len(route.stops),
        "estimated_distance_km": opt_result.total_distance_km,
        "estimated_duration_min": opt_result.total_duration_min,
        "optimized_sequence": opt_result.optimized_sequence,
        "stops": sorted_stops,
    }


# ─── POST /routes/{route_id}/start ───────────────────────────────────────────
@router.post(
    "/{route_id}/start",
    response_model=RouteResponse,
    summary="Iniciar ruta",
    description="El conductor confirma el inicio de la ruta. Cambia el estado a 'in_progress'.",
)
async def start_route(
    route_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Route:
    route = await get_owned_route(db, route_id, driver.id)

    if route.status != RouteStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"La ruta no se puede iniciar desde el estado '{route.status.value}'",
        )

    route.status = RouteStatus.IN_PROGRESS
    await db.flush()
    await db.refresh(route)
    return route
