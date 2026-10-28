"""
app/schemas/route.py
Esquemas Pydantic para validacion y serializacion de Rutas.
Las paradas (modelo multi-cliente) viven en app/schemas/stop.py.
"""
import uuid
from datetime import datetime, date

from pydantic import BaseModel, Field, ConfigDict

from app.models.route import RouteStatus
from app.schemas.stop import StopInput, StopResponse


# ═══════════════════ ROUTE SCHEMAS ═══════════════════

class RouteBase(BaseModel):
    route_date: date = Field(..., examples=["2026-09-16"])
    origin_lat: float | None = Field(None, examples=[4.6097])
    origin_lng: float | None = Field(None, examples=[-74.0817])


class RouteCreate(RouteBase):
    """Payload para crear una ruta. Las paradas pueden agregarse despues."""
    stops: list[StopInput] | None = Field(
        default=None,
        description="Paradas iniciales de la ruta (opcional)",
    )


class RouteResponse(RouteBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    driver_id: uuid.UUID
    status: RouteStatus
    total_stops: int
    completed_stops: int
    optimization_metadata: dict | None
    created_at: datetime
    updated_at: datetime


class RouteDetailResponse(RouteResponse):
    """Ruta con todas sus paradas (y sus clientes) incluidas."""
    stops: list[StopResponse] = Field(default_factory=list)


class RouteOptimizeResponse(BaseModel):
    """Respuesta del endpoint de optimizacion de ruta."""
    route_id: uuid.UUID
    message: str
    total_stops: int
    estimated_distance_km: float | None
    estimated_duration_min: int | None
    optimized_sequence: list[int]  # Indices de paradas en orden optimo
    stops: list[StopResponse]
