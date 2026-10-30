"""
app/services/route_service.py
Logica de negocio para la gestion y ciclo de vida de rutas (inicio, finalizacion y metricas).
"""
import logging
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func

from app.models.route import Route, RouteStatus
from app.models.stop import Stop, StopStatus

logger = logging.getLogger(__name__)


async def finish_route(db: AsyncSession, route: Route) -> Route:
    """
    Finaliza formalmente una ruta de entrega:
    - Actualiza status a COMPLETED ('completed')
    - Asigna completed_stops al total_stops de la ruta
    - Marca las paradas pendientes como delivered
    - Registra finished_at con timestamp UTC
    - Ejecuta db.commit() explicito y db.refresh(route) para persistir en PostgreSQL
    """
    now = datetime.now(timezone.utc)

    # Actualizar paradas pendientes a entregadas
    await db.execute(
        update(Stop)
        .where(Stop.route_id == route.id, Stop.status == StopStatus.pending)
        .values(status=StopStatus.delivered)
    )

    # Asegurar que completed_stops refleje el total de paradas reales
    stop_count_result = await db.execute(
        select(func.count(Stop.id)).where(Stop.route_id == route.id)
    )
    actual_stops = stop_count_result.scalar_one() or 0
    total_stops_count = (
        actual_stops
        if actual_stops > 0
        else (len(route.stops) if route.stops else route.total_stops)
    )

    updated_metadata = dict(route.optimization_metadata or {})
    updated_metadata["finished_at"] = now.isoformat()

    # Asignacion en instancia ORM y sentencia UPDATE explicita para garantizar escritura en PostgreSQL
    route.status = RouteStatus.COMPLETED
    route.finished_at = now
    route.total_stops = total_stops_count
    route.completed_stops = total_stops_count
    route.optimization_metadata = updated_metadata

    await db.execute(
        update(Route)
        .where(Route.id == route.id)
        .values(
            status=RouteStatus.COMPLETED,
            finished_at=now,
            total_stops=total_stops_count,
            completed_stops=total_stops_count,
            optimization_metadata=updated_metadata,
        )
    )

    logger.info("Iniciando commit en DB")
    await db.commit()
    logger.info("Ruta guardada en DB")
    await db.refresh(route)
    logger.info(
        "Commit exitoso en DB: ruta %s actualizada (status=%s, completed_stops=%s/%s, finished_at=%s)",
        route.id,
        route.status,
        route.completed_stops,
        route.total_stops,
        route.finished_at,
    )
    return route
