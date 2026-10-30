"""
app/api/v1/endpoints/stops.py
CRUD de paradas con soporte multi-cliente (una direccion, N clientes/paquetes).
Todos los endpoints requieren JWT y solo operan sobre paradas de rutas del conductor.
"""
import uuid

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_driver
from app.db.session import get_db
from app.models.driver import Driver
from app.models.stop import Stop
from app.schemas.stop import StopCreate, StopResponse, StopStatusUpdate, StopUpdate
from app.services.stop_service import (
    apply_stop_update,
    create_stop,
    get_owned_route,
    get_owned_stop,
    next_sequence_order,
    recount_route,
)

router = APIRouter(prefix="/stops", tags=["Paradas"])


# ─── POST /stops ─────────────────────────────────────────────────────────────
@router.post(
    "",
    response_model=StopResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Crear parada con sus clientes",
    description=(
        "Crea una parada y, en la misma transaccion, todos sus clientes/paquetes. "
        "Si no se envian lat/lng, la direccion se normaliza y se geocodifica."
    ),
)
async def create_stop_with_clients(
    stop_in: StopCreate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Stop:
    route = await get_owned_route(db, stop_in.route_id, driver.id)

    sequence = await next_sequence_order(db, route.id)
    stop = await create_stop(db, route.id, stop_in, sequence)
    await recount_route(db, route.id)
    await db.commit()

    return await get_owned_stop(db, stop.id, driver.id)


# ─── GET /stops/{stop_id} ────────────────────────────────────────────────────
@router.get(
    "/{stop_id}",
    response_model=StopResponse,
    summary="Obtener parada con sus clientes",
)
async def get_stop(
    stop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Stop:
    return await get_owned_stop(db, stop_id, driver.id)


# ─── PUT / PATCH /stops/{stop_id} ────────────────────────────────────────────
@router.put(
    "/{stop_id}",
    response_model=StopResponse,
    summary="Actualizar parada y sincronizar sus clientes",
    description=(
        "Actualiza campos de la parada (address, lat, lng, color_code, status, is_pinned, sequence_order). "
        "Permite fijar o desbloquear la parada enviando `is_pinned: false`. "
        "Si se envia `clients`, se sincroniza el arreglo completo: crea los clientes "
        "nuevos (sin id o con id no-UUID), edita los que traen un id existente y "
        "elimina los que ya no aparecen. Si `clients` se omite, no se tocan."
    ),
)
@router.patch(
    "/{stop_id}",
    response_model=StopResponse,
    summary="Actualizar parada parcialmente (incluye is_pinned)",
)
async def update_stop(
    stop_id: uuid.UUID,
    payload: StopUpdate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Stop:
    stop = await get_owned_stop(db, stop_id, driver.id)

    status_changed = await apply_stop_update(db, stop, payload)
    if payload.is_pinned is not None:
        stop.is_pinned = bool(payload.is_pinned)
    if status_changed:
        await recount_route(db, stop.route_id)
    await db.commit()

    return await get_owned_stop(db, stop_id, driver.id)


# ─── PUT /stops/{stop_id}/estado ─────────────────────────────────────────────
@router.put(
    "/{stop_id}/estado",
    response_model=StopResponse,
    summary="Cambiar solo el estado (swipe del conductor)",
    description="Endpoint ligero para el swipe: pending | delivered | failed. Recalcula los contadores de la ruta.",
)
async def update_stop_status(
    stop_id: uuid.UUID,
    status_in: StopStatusUpdate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Stop:
    stop = await get_owned_stop(db, stop_id, driver.id)

    if stop.status != status_in.status:
        stop.status = status_in.status
        await recount_route(db, stop.route_id)
    await db.commit()

    return await get_owned_stop(db, stop_id, driver.id)


# ─── DELETE /stops/{stop_id} ─────────────────────────────────────────────────
@router.delete(
    "/{stop_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Eliminar parada",
    description=(
        "Elimina la parada y, en cascada, todos sus stop_clients. "
        "Actualiza total_stops / completed_stops de la ruta."
    ),
)
async def delete_stop(
    stop_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Response:
    stop = await get_owned_stop(db, stop_id, driver.id)
    route_id = stop.route_id

    await db.delete(stop)  # cascade="all, delete-orphan" borra los StopClient cargados
    await db.flush()
    await recount_route(db, route_id)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
