"""
app/services/stop_service.py
Logica de negocio compartida entre `routes.py` y `stops.py` para el modelo
multi-cliente (Stop 1:N StopClient).

Notas sobre SQLAlchemy Async:
  - La sesion usa autoflush=False, por eso se hace `await db.flush()` antes de
    cualquier consulta que dependa de cambios pendientes (p.ej. recount_route).
  - No hay lazy-loading en async: toda lectura de `Stop.clients` / `Route.stops`
    se hace con selectinload + populate_existing para devolver datos frescos.
"""
import uuid

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.route import Route, RouteStatus
from app.models.stop import Stop, StopStatus
from app.models.stop_client import StopClient
from app.schemas.stop import StopClientBase, StopInput, StopUpdate
from app.services.geocoding import geocode_address
from app.utils.normalization import normalize_bogota_address


# ═══════════════════ Consultas con control de propiedad ═══════════════════

async def get_owned_route(
    db: AsyncSession,
    route_id: uuid.UUID,
    driver_id: uuid.UUID,
    *,
    with_stops: bool = False,
) -> Route:
    """Ruta del conductor autenticado o 404 (no se revela si existe para otro conductor)."""
    stmt = (
        select(Route)
        .where(Route.id == route_id, Route.driver_id == driver_id)
        .execution_options(populate_existing=True)
    )
    if with_stops:
        stmt = stmt.options(selectinload(Route.stops))
    route = (await db.execute(stmt)).scalar_one_or_none()
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ruta no encontrada")
    return route


async def get_owned_stop(
    db: AsyncSession,
    stop_id: uuid.UUID,
    driver_id: uuid.UUID,
    *,
    route_id: uuid.UUID | None = None,
) -> Stop:
    """Parada (con clientes cargados) cuya ruta pertenece al conductor, o 404."""
    stmt = (
        select(Stop)
        .join(Route, Route.id == Stop.route_id)
        .where(Stop.id == stop_id, Route.driver_id == driver_id)
        .options(selectinload(Stop.clients))
        .execution_options(populate_existing=True)
    )
    if route_id is not None:
        stmt = stmt.where(Stop.route_id == route_id)
    stop = (await db.execute(stmt)).scalar_one_or_none()
    if stop is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Parada no encontrada")
    return stop


# ═══════════════════ Geocodificacion ═══════════════════

async def resolve_coordinates(address: str) -> tuple[float | None, float | None]:
    """Normaliza (Bogota) y geocodifica. Devuelve (None, None) si no se pudo, sin lanzar."""
    norm = normalize_bogota_address(address)
    query = norm.geocodable_address or address
    try:
        geo = await geocode_address(query)
    except Exception:
        geo = None
    if geo:
        return geo["latitude"], geo["longitude"]
    return None, None


# ═══════════════════ Clientes ═══════════════════

def _new_client(data: StopClientBase) -> StopClient:
    return StopClient(
        name=data.name,
        phone=data.phone,
        packages_count=data.packages_count,
        notes=data.notes,
    )


def sync_clients(stop: Stop, payload: list) -> None:
    """
    Upsert + delete de los clientes de `stop` segun `payload` (lista de StopClientUpsert).
    Requiere `stop.clients` ya cargado (get_owned_stop lo garantiza).
    Los clientes que no aparecen en el payload quedan huerfanos y el cascade
    'delete-orphan' los elimina en el siguiente flush.
    """
    existing = {c.id: c for c in stop.clients}
    used: set[uuid.UUID] = set()
    result: list[StopClient] = []

    for item in payload:
        client = existing.get(item.id) if item.id else None
        if client is not None and client.id not in used:
            client.name = item.name
            client.phone = item.phone
            client.packages_count = item.packages_count
            client.notes = item.notes
            used.add(client.id)
            result.append(client)
        else:
            result.append(_new_client(item))

    stop.clients = result


# ═══════════════════ Paradas ═══════════════════

async def next_sequence_order(db: AsyncSession, route_id: uuid.UUID) -> int:
    current_max = await db.scalar(
        select(func.max(Stop.sequence_order)).where(Stop.route_id == route_id)
    )
    return (current_max or 0) + 1


async def create_stop(
    db: AsyncSession,
    route_id: uuid.UUID,
    data: StopInput,
    sequence_order: int,
) -> Stop:
    """Crea una parada con sus clientes. Geocodifica si no vienen lat/lng."""
    lat, lng = data.lat, data.lng
    if lat is None or lng is None:
        lat, lng = await resolve_coordinates(data.address)

    stop = Stop(
        route_id=route_id,
        address=data.address.strip(),
        lat=lat,
        lng=lng,
        color_code=data.color_code,
        status=StopStatus.pending,
        sequence_order=sequence_order,
        is_pinned=getattr(data, "is_pinned", False) or False,
    )
    stop.clients = [_new_client(c) for c in data.clients]
    db.add(stop)
    await db.flush()
    return stop


async def apply_stop_update(db: AsyncSession, stop: Stop, payload: StopUpdate) -> bool:
    """
    Aplica un StopUpdate parcial sobre `stop` (ya cargado y verificado).
    Soporta explicitamente el cambio de `is_pinned` a False (desbloqueo/unpin).
    Devuelve True si cambio el estado (para recalcular la ruta).
    """
    changes = payload.model_dump(exclude_unset=True, exclude={"clients"})

    # address, status e is_pinned son NOT NULL: un null explicito se ignora.
    for non_nullable in ("address", "status", "is_pinned"):
        if non_nullable in changes and changes.get(non_nullable) is None:
            changes.pop(non_nullable, None)

    if "address" in changes:
        changes["address"] = changes["address"].strip()
        coords_given = changes.get("lat") is not None and changes.get("lng") is not None
        if changes["address"] != stop.address and not coords_given:
            # Direccion nueva sin coordenadas nuevas -> las viejas ya no sirven.
            changes["lat"], changes["lng"] = await resolve_coordinates(changes["address"])

    status_changed = "status" in changes and changes["status"] != stop.status
    for field, value in changes.items():
        setattr(stop, field, value)

    # Asegurar explicitamente el cambio de is_pinned (True o False)
    if payload.is_pinned is not None:
        stop.is_pinned = bool(payload.is_pinned)

    if payload.clients is not None:
        sync_clients(stop, payload.clients)

    await db.flush()
    return status_changed


async def recount_route(db: AsyncSession, route_id: uuid.UUID) -> Route | None:
    """
    Recalcula total_stops / completed_stops desde la BD (fuente de verdad) y ajusta
    el estado de la ruta. Evita descuadres de los contadores incrementales.
    """
    await db.flush()  # autoflush=False: asegurar que los cambios pendientes cuenten

    total = await db.scalar(
        select(func.count()).select_from(Stop).where(Stop.route_id == route_id)
    ) or 0
    done = await db.scalar(
        select(func.count())
        .select_from(Stop)
        .where(Stop.route_id == route_id, Stop.status == StopStatus.delivered)
    ) or 0

    route = await db.get(Route, route_id)
    if route is None:
        return None

    route.total_stops = total
    route.completed_stops = done

    if total > 0 and done >= total and route.status in (RouteStatus.PENDING, RouteStatus.IN_PROGRESS):
        route.status = RouteStatus.COMPLETED
    elif route.status == RouteStatus.COMPLETED and done < total:
        route.status = RouteStatus.IN_PROGRESS  # se agrego/reabrio una parada

    await db.flush()
    return route
