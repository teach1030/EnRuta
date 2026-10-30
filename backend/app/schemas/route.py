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
    finished_at: datetime | None = None
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


class GeoCoordinate(BaseModel):
    """Coordenada geografica flexible (acepta lat/lng, lat/lon o latitude/longitude)."""
    lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    lng: float | None = Field(default=None, ge=-180.0, le=180.0)
    lon: float | None = Field(default=None, ge=-180.0, le=180.0)
    latitude: float | None = Field(default=None, ge=-90.0, le=90.0)
    longitude: float | None = Field(default=None, ge=-180.0, le=180.0)

    @property
    def resolved_lat(self) -> float | None:
        return self.lat if self.lat is not None else self.latitude

    @property
    def resolved_lng(self) -> float | None:
        if self.lng is not None:
            return self.lng
        if self.lon is not None:
            return self.lon
        return self.longitude


class RouteOptimizeRequest(BaseModel):
    """Payload JSON opcional para POST /routes/{route_id}/optimize y POST /routes/optimize."""
    route_id: uuid.UUID | None = Field(
        default=None,
        description="ID de la ruta a optimizar (opcional si va en la URL o se toma la ruta activa).",
    )
    start_location: GeoCoordinate | None = Field(
        default=None,
        description="Coordenadas de origen (nodo 0 de la matriz de OR-Tools).",
    )
    end_location: GeoCoordinate | None = Field(
        default=None,
        description="Coordenadas de destino definitivo (ultimo nodo de la matriz de OR-Tools).",
    )
    start_lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    start_lng: float | None = Field(default=None, ge=-180.0, le=180.0)
    start_lon: float | None = Field(default=None, ge=-180.0, le=180.0)
    end_lat: float | None = Field(default=None, ge=-90.0, le=90.0)
    end_lng: float | None = Field(default=None, ge=-180.0, le=180.0)
    end_lon: float | None = Field(default=None, ge=-180.0, le=180.0)
    start_address: str | None = Field(default=None)
    end_address: str | None = Field(default=None)
    return_to_depot: bool | None = Field(default=None)
    max_seconds: int | None = Field(default=None, ge=1, le=120)


class RouteReorderRequest(BaseModel):
    """Payload para reordenar paradas manualmente y fijar su posicion."""
    stop_ids: list[uuid.UUID] = Field(..., min_length=1)
    pinned_stop_ids: list[uuid.UUID] | None = Field(
        default=None,
        description="IDs de paradas especificas que deben marcarse con is_pinned=True.",
    )
