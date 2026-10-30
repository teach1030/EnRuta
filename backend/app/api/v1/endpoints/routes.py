"""
app/api/v1/endpoints/routes.py
Endpoints para gestion de rutas y paradas de entrega.
Incluye creacion, consulta, optimizacion y actualizacion de estado.
Todos requieren JWT; cada conductor solo ve/modifica sus propias rutas.
"""
import uuid
from fastapi import APIRouter, Body, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.api.deps import get_current_driver
from app.db.session import get_db
from app.models.driver import Driver
from app.models.route import Route, RouteStatus
from app.models.stop import Stop
from app.schemas.route import (
    RouteCreate,
    RouteResponse,
    RouteDetailResponse,
    RouteOptimizeRequest,
    RouteOptimizeResponse,
    RouteReorderRequest,
)
from app.schemas.stop import StopBulkCreate, StopUpdate, StopResponse
from app.utils.normalization import normalize_bogota_address
from app.services.geocoding import geocode_address
from app.services.routing import optimize_route
from app.services.route_service import finish_route
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


# ─── GET /routes/history (rutas completadas del conductor) ───────────────────
@router.get(
    "/history",
    response_model=list[RouteResponse],
    summary="Historial de rutas completadas",
    description="Retorna las rutas completadas del conductor autenticado ordenadas por fecha descendente.",
)
async def get_route_history(
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> list[Route]:
    query = (
        select(Route)
        .where(
            Route.driver_id == driver.id,
            (Route.status == RouteStatus.COMPLETED) | (Route.completed_stops > 0),
        )
        .order_by(
            Route.finished_at.desc().nullslast(),
            Route.route_date.desc(),
            Route.created_at.desc(),
        )
    )
    result = await db.execute(query)
    return list(result.scalars().all())


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


# ─── Helpers de Optimizacion ────────────────────────────────────────────────
async def _geocode_text_point(address_text: str, label: str) -> tuple[float, float, str]:
    norm = normalize_bogota_address(address_text)
    address_to_geocode = norm.geocodable_address or address_text
    try:
        geo = await geocode_address(address_to_geocode)
        if geo:
            return (
                geo["latitude"],
                geo["longitude"],
                f"geocoded_{label} (confianza: {geo.get('confidence', '?')})",
            )
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"No se pudo geocodificar la direccion de {label}: '{address_text}'. "
                "Verifica la direccion o envia coordenadas lat/lng directamente."
            ),
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"Error al geocodificar la direccion de {label} con Mapbox: {exc}.",
        ) from exc


async def _execute_route_optimization(
    *,
    route: Route,
    body: RouteOptimizeRequest | None,
    start_lat: float | None,
    start_lon: float | None,
    end_lat: float | None,
    end_lon: float | None,
    start_address: str | None,
    end_address: str | None,
    return_to_depot: bool,
    max_seconds: int,
    db: AsyncSession,
    driver_id: uuid.UUID,
) -> dict:
    if not route.stops:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La ruta no tiene paradas para optimizar",
        )

    # Extraer valores desde el JSON body (si fue enviado)
    body_start_lat: float | None = None
    body_start_lng: float | None = None
    body_end_lat: float | None = None
    body_end_lng: float | None = None

    if body is not None:
        if body.start_location is not None:
            body_start_lat = body.start_location.resolved_lat
            body_start_lng = body.start_location.resolved_lng
        if body_start_lat is None and body.start_lat is not None:
            body_start_lat = body.start_lat
        if body_start_lng is None:
            body_start_lng = body.start_lng if body.start_lng is not None else body.start_lon

        if body.end_location is not None:
            body_end_lat = body.end_location.resolved_lat
            body_end_lng = body.end_location.resolved_lng
        if body_end_lat is None and body.end_lat is not None:
            body_end_lat = body.end_lat
        if body_end_lng is None:
            body_end_lng = body.end_lng if body.end_lng is not None else body.end_lon

        if not start_address and body.start_address:
            start_address = body.start_address
        if not end_address and body.end_address:
            end_address = body.end_address
        if body.return_to_depot is not None:
            return_to_depot = body.return_to_depot
        if body.max_seconds is not None:
            max_seconds = body.max_seconds

    # --- 1. Resolver punto de inicio (nodo 0 de la matriz) ---
    origin_lat: float | None = None
    origin_lng: float | None = None
    origin_source: str = "unknown"

    if body_start_lat is not None and body_start_lng is not None:
        origin_lat = body_start_lat
        origin_lng = body_start_lng
        origin_source = "body_start_location"
    elif start_lat is not None and start_lon is not None:
        origin_lat = start_lat
        origin_lng = start_lon
        origin_source = "gps_explicit"
    elif start_address is not None:
        origin_lat, origin_lng, origin_source = await _geocode_text_point(start_address, "inicio")
    elif route.origin_lat is not None and route.origin_lng is not None:
        origin_lat = route.origin_lat
        origin_lng = route.origin_lng
        origin_source = "route_stored_origin"
    else:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                "No se puede optimizar sin un punto de inicio. "
                "Provee start_location en el body JSON, start_lat/start_lon en query, "
                "o start_address."
            ),
        )

    # --- 2. Resolver punto de destino definitivo (ultimo nodo de la matriz, opcional) ---
    resolved_end_lat: float | None = None
    resolved_end_lng: float | None = None
    end_source: str | None = None

    if body_end_lat is not None and body_end_lng is not None:
        resolved_end_lat = body_end_lat
        resolved_end_lng = body_end_lng
        end_source = "body_end_location"
    elif end_lat is not None and end_lon is not None:
        resolved_end_lat = end_lat
        resolved_end_lng = end_lon
        end_source = "query_end_location"
    elif end_address is not None:
        resolved_end_lat, resolved_end_lng, end_source = await _geocode_text_point(end_address, "destino")

    # --- 3. Ejecutar OR-Tools con nodos obligatorios (is_pinned) y origen/destino ---
    opt_result = await optimize_route(
        stops=route.stops,
        origin_lat=origin_lat,
        origin_lng=origin_lng,
        end_lat=resolved_end_lat,
        end_lng=resolved_end_lng,
        max_solve_seconds=max_seconds,
        return_to_depot=return_to_depot,
    )

    # --- 4. Actualizar sequence_order conservando todas las paradas de la ruta ---
    stop_map: dict[uuid.UUID, Stop] = {s.id: s for s in route.stops}
    assigned_ids: set[uuid.UUID] = set()
    order = 1
    for stop_id in opt_result.optimized_stop_ids:
        if stop_id in stop_map and stop_id not in assigned_ids:
            stop_map[stop_id].sequence_order = order
            assigned_ids.add(stop_id)
            order += 1

    # Resguardo: cualquier parada en la ruta que no haya venido en opt_result se anexa
    for s in route.stops:
        if s.id not in assigned_ids:
            s.sequence_order = order
            assigned_ids.add(s.id)
            order += 1

    await db.flush()

    # --- 5. Persistir metadata ---
    route.optimization_metadata = {
        "solver_status": opt_result.solver_status,
        "total_distance_km": opt_result.total_distance_km,
        "total_duration_min": opt_result.total_duration_min,
        "return_to_depot": return_to_depot,
        "origin_lat": origin_lat,
        "origin_lng": origin_lng,
        "origin_source": origin_source,
        "end_lat": resolved_end_lat,
        "end_lng": resolved_end_lng,
        "end_source": end_source,
        "optimized_stop_ids": [str(sid) for sid in opt_result.optimized_stop_ids],
        **opt_result.metadata,
    }
    await db.commit()
    refreshed_route = await get_owned_route(db, route.id, driver_id, with_stops=True)

    sorted_stops = sorted(
        refreshed_route.stops,
        key=lambda s: (s.sequence_order is None, s.sequence_order or 0),
    )
    geocoded_count = sum(1 for s in route.stops if s.lat is not None and s.lng is not None)
    non_geocoded_count = len(route.stops) - geocoded_count

    message = (
        f"Ruta optimizada con OR-Tools ({opt_result.solver_status}). "
        f"Inicio: {origin_source}. "
        + (f"Destino: {end_source}. " if end_source else "")
        + f"{geocoded_count} paradas en orden optimo"
        + (f", {non_geocoded_count} sin geocodificar al final." if non_geocoded_count else ".")
    )

    return {
        "route_id": route.id,
        "message": message,
        "total_stops": len(sorted_stops),
        "estimated_distance_km": opt_result.total_distance_km,
        "estimated_duration_min": opt_result.total_duration_min,
        "optimized_sequence": opt_result.optimized_sequence,
        "stops": sorted_stops,
    }


# ─── POST /routes/optimize (endpoint directo con JSON body) ──────────────────
@router.post(
    "/optimize",
    response_model=RouteOptimizeResponse,
    summary="Optimizar ruta activa o indicada con OR-Tools (start_location / end_location)",
    description=(
        "Optimiza la ruta indicada en `route_id` (o la ruta activa del conductor si no se envia `route_id`). "
        "Recibe opcionalmente `start_location` (lat/lng) y `end_location` (lat/lng) en el JSON body "
        "para usarlos como origen (nodo 0) y destino definitivo (ultimo nodo) en OR-Tools, "
        "respetando las paradas ancladas (`is_pinned == True`)."
    ),
)
async def optimize_active_route_endpoint(
    body: RouteOptimizeRequest | None = Body(default=None),
    route_id: uuid.UUID | None = Query(None, description="ID de la ruta a optimizar (opcional)"),
    start_lat: float | None = Query(None, ge=-90.0, le=90.0),
    start_lon: float | None = Query(None, ge=-180.0, le=180.0),
    end_lat: float | None = Query(None, ge=-90.0, le=90.0),
    end_lon: float | None = Query(None, ge=-180.0, le=180.0),
    start_address: str | None = Query(None, min_length=5, max_length=300),
    end_address: str | None = Query(None, min_length=5, max_length=300),
    return_to_depot: bool = Query(False),
    max_seconds: int = Query(5, ge=1, le=120),
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> dict:
    target_route_id = route_id or (body.route_id if body else None)
    if target_route_id is not None:
        route = await get_owned_route(db, target_route_id, driver.id, with_stops=True)
    else:
        stmt = (
            select(Route)
            .where(Route.driver_id == driver.id)
            .order_by(Route.route_date.desc(), Route.created_at.desc())
        )
        latest = (await db.execute(stmt)).scalars().first()
        if latest is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No se encontro ninguna ruta activa para optimizar",
            )
        route = await get_owned_route(db, latest.id, driver.id, with_stops=True)

    return await _execute_route_optimization(
        route=route,
        body=body,
        start_lat=start_lat,
        start_lon=start_lon,
        end_lat=end_lat,
        end_lon=end_lon,
        start_address=start_address,
        end_address=end_address,
        return_to_depot=return_to_depot,
        max_seconds=max_seconds,
        db=db,
        driver_id=driver.id,
    )


# ─── POST /routes/{route_id}/optimize ────────────────────────────────────────
@router.post(
    "/{route_id}/optimize",
    response_model=RouteOptimizeResponse,
    summary="Optimizar ruta por ID con OR-Tools",
    description=(
        "Calcula el orden optimo de visita usando Google OR-Tools (TSP). "
        "Acepta `start_location` (lat/lng) y `end_location` (lat/lng) en el JSON body "
        "o por query params (`start_lat`/`start_lon`, `end_lat`/`end_lon`). "
        "Respeta las paradas ancladas (`is_pinned == True`) en su secuencia exacta."
    ),
)
async def optimize_route_endpoint(
    route_id: uuid.UUID,
    body: RouteOptimizeRequest | None = Body(default=None),
    start_lat: float | None = Query(
        None,
        ge=-90.0,
        le=90.0,
        description="Latitud del punto de inicio (alternativa a start_location en el JSON body).",
    ),
    start_lon: float | None = Query(
        None,
        ge=-180.0,
        le=180.0,
        description="Longitud del punto de inicio.",
    ),
    end_lat: float | None = Query(
        None,
        ge=-90.0,
        le=90.0,
        description="Latitud del punto de destino final (opcional).",
    ),
    end_lon: float | None = Query(
        None,
        ge=-180.0,
        le=180.0,
        description="Longitud del punto de destino final (opcional).",
    ),
    start_address: str | None = Query(
        None,
        min_length=5,
        max_length=300,
        description="Direccion de texto del punto de inicio (alternativa a lat/lon).",
    ),
    end_address: str | None = Query(
        None,
        min_length=5,
        max_length=300,
        description="Direccion de texto del punto de destino final (opcional).",
    ),
    return_to_depot: bool = Query(
        False,
        description="Si True (y no hay end_location), el conductor regresa al inicio al final.",
    ),
    max_seconds: int = Query(
        5,
        ge=1,
        le=120,
        description="Tiempo maximo para el solver OR-Tools (segundos).",
    ),
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> dict:
    route = await get_owned_route(db, route_id, driver.id, with_stops=True)
    return await _execute_route_optimization(
        route=route,
        body=body,
        start_lat=start_lat,
        start_lon=start_lon,
        end_lat=end_lat,
        end_lon=end_lon,
        start_address=start_address,
        end_address=end_address,
        return_to_depot=return_to_depot,
        max_seconds=max_seconds,
        db=db,
        driver_id=driver.id,
    )


# ─── PUT /routes/{route_id}/reorder ──────────────────────────────────────────
@router.put(
    "/{route_id}/reorder",
    response_model=list[StopResponse],
    summary="Reordenar paradas manualmente y fijar su secuencia",
    description=(
        "Recibe un arreglo de stop_ids con el nuevo orden manual tras un drag & drop, "
        "actualiza sequence_order (1..N) y marca como is_pinned=True las paradas indicadas "
        "(pinned_stop_ids si se provee, o todas las paradas de stop_ids)."
    ),
)
async def reorder_route_stops(
    route_id: uuid.UUID,
    payload: RouteReorderRequest,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> list[Stop]:
    route = await get_owned_route(db, route_id, driver.id, with_stops=True)
    stop_map: dict[uuid.UUID, Stop] = {s.id: s for s in route.stops}

    pinned_set = (
        set(payload.pinned_stop_ids)
        if payload.pinned_stop_ids is not None
        else set(payload.stop_ids)
    )

    seq = 1
    seen: set[uuid.UUID] = set()
    for sid in payload.stop_ids:
        stop = stop_map.get(sid)
        if stop is not None and sid not in seen:
            stop.sequence_order = seq
            if sid in pinned_set:
                stop.is_pinned = True
            seen.add(sid)
            seq += 1

    # Cualquier parada de la ruta que no haya venido en stop_ids se conserva al final
    remaining = sorted(
        (s for s in route.stops if s.id not in seen),
        key=lambda s: (s.sequence_order is None, s.sequence_order or 0),
    )
    for stop in remaining:
        stop.sequence_order = seq
        seq += 1

    await db.commit()
    refreshed = await get_owned_route(db, route_id, driver.id, with_stops=True)
    return sorted(
        refreshed.stops,
        key=lambda s: (s.sequence_order is None, s.sequence_order or 0),
    )


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
    await db.commit()
    await db.refresh(route)
    return route


# ─── POST /routes/{route_id}/finish ──────────────────────────────────────────
@router.post(
    "/{route_id}/finish",
    response_model=RouteResponse,
    summary="Finalizar ruta",
    description=(
        "Cierra definitivamente la ruta: cambia status a 'completed', "
        "completed_stops al total_stops y registra la hora de fin (finished_at)."
    ),
)
async def finish_route_endpoint(
    route_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Route:
    route = await get_owned_route(db, route_id, driver.id, with_stops=True)
    return await finish_route(db, route)

