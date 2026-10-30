"""
app/schemas/stop.py
Schemas Pydantic del modelo multi-cliente: una Stop (direccion) con N clientes/paquetes.
Es la fuente unica para paradas; `schemas/route.py` y los endpoints la reutilizan.
"""
import uuid
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Un solo Enum para ORM y API (evita dos StopStatus distintos).
from app.models.stop import StopStatus

__all__ = [
    "StopStatus",
    "StopClientBase",
    "StopClientCreate",
    "StopClientUpsert",
    "StopClientResponse",
    "StopBase",
    "StopInput",
    "StopCreate",
    "StopBulkCreate",
    "StopUpdate",
    "StopStatusUpdate",
    "StopResponse",
]


# ═══════════════════ Clientes de una parada ═══════════════════

class StopClientBase(BaseModel):
    name: str = Field(default="", max_length=200)
    phone: Optional[str] = Field(default=None, max_length=20)
    packages_count: int = Field(default=1, ge=1)
    notes: Optional[str] = None


class StopClientCreate(StopClientBase):
    pass


class StopClientUpsert(StopClientBase):
    """
    Cliente dentro de un PUT /stops/{id}.
      - `id` valido (UUID existente en la parada) -> se edita.
      - `id` ausente, nulo o no-UUID (p.ej. el 'c1730000000' que genera el frontend
        antes de sincronizar) -> se crea como cliente nuevo.
    """
    id: Optional[uuid.UUID] = None

    @field_validator("id", mode="before")
    @classmethod
    def _non_uuid_id_means_new(cls, v):
        if v is None or isinstance(v, uuid.UUID):
            return v
        try:
            return uuid.UUID(str(v))
        except ValueError:
            return None


class StopClientResponse(StopClientBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    stop_id: uuid.UUID


# ═══════════════════ Paradas ═══════════════════

class StopBase(BaseModel):
    address: str = Field(..., min_length=1, examples=["Calle 166 #9-24"])
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    color_code: Optional[str] = Field(default=None, max_length=20, examples=["#3B82F6"])
    is_pinned: bool = Field(default=False)


class StopInput(StopBase):
    """Parada tal como se envia embebida en una ruta (sin route_id)."""
    clients: List[StopClientCreate] = Field(default_factory=list)


class StopCreate(StopInput):
    """Payload de POST /stops."""
    route_id: uuid.UUID


class StopBulkCreate(BaseModel):
    """Creacion masiva de paradas (p.ej. varias guias escaneadas)."""
    stops: List[StopInput] = Field(..., min_length=1, max_length=200)


class StopUpdate(BaseModel):
    """
    Payload de PUT /stops/{id}. Todos los campos son opcionales (actualizacion parcial).

    `is_pinned`:
      - True  -> fija la parada en su posicion actual.
      - False -> desbloquea (quita el candado) de la parada para futuras optimizaciones.

    `clients`:
      - omitido  -> los clientes no se tocan.
      - lista    -> sincronizacion completa: se crean los nuevos, se editan los que
                    traen `id` existente y se ELIMINAN los que no aparecen en la lista.
    """
    address: Optional[str] = Field(default=None, min_length=1)
    lat: Optional[float] = Field(default=None, ge=-90.0, le=90.0)
    lng: Optional[float] = Field(default=None, ge=-180.0, le=180.0)
    color_code: Optional[str] = Field(default=None, max_length=20)
    status: Optional[StopStatus] = None
    is_pinned: Optional[bool] = Field(
        default=None,
        description="True para fijar la parada, False para desbloquearla (unpin).",
    )
    sequence_order: Optional[int] = Field(default=None, ge=1)
    clients: Optional[List[StopClientUpsert]] = None

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_status(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v


class StopStatusUpdate(BaseModel):
    status: StopStatus

    @field_validator("status", mode="before")
    @classmethod
    def _normalize_status(cls, v):
        if isinstance(v, str):
            return v.strip().lower()
        return v


class StopResponse(StopBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    route_id: uuid.UUID
    status: StopStatus
    sequence_order: Optional[int] = None
    clients: List[StopClientResponse] = Field(default_factory=list)
