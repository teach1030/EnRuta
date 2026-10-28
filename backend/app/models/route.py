"""
app/models/route.py
Modelo ORM SQLAlchemy para la tabla 'routes'.
Representa una ruta de reparto asignada a un conductor en un día específico.
"""
import uuid
from datetime import datetime, date
from sqlalchemy import String, Date, DateTime, ForeignKey, Enum as SAEnum, func, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.db.session import Base
import enum


class RouteStatus(str, enum.Enum):
    """Estados posibles de una ruta de reparto."""
    PENDING = "pending"         # Creada, sin iniciar
    IN_PROGRESS = "in_progress" # Conductor en ruta
    COMPLETED = "completed"     # Todas las paradas entregadas
    CANCELLED = "cancelled"     # Ruta cancelada


class Route(Base):
    __tablename__ = "routes"

    # --- Clave primaria ---
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Identificador único de la ruta (UUID)",
    )

    # --- Relación con conductor ---
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
        comment="FK al conductor asignado a esta ruta",
    )

    # --- Datos de la ruta ---
    route_date: Mapped[date] = mapped_column(
        Date,
        nullable=False,
        index=True,
        comment="Fecha de ejecución de la ruta",
    )
    status: Mapped[RouteStatus] = mapped_column(
        SAEnum(RouteStatus, name="route_status_enum"),
        default=RouteStatus.PENDING,
        nullable=False,
        comment="Estado actual de la ruta",
    )
    total_stops: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Número total de paradas/entregas en la ruta",
    )
    completed_stops: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
        comment="Número de paradas completadas",
    )

    # --- Coordenadas del punto de partida (depósito/bodega) ---
    origin_lat: Mapped[float | None] = mapped_column(
        nullable=True,
        comment="Latitud del punto de origen (bodega)",
    )
    origin_lng: Mapped[float | None] = mapped_column(
        nullable=True,
        comment="Longitud del punto de origen (bodega)",
    )

    # --- Metadatos de optimización (OR-Tools) ---
    # Almacena la secuencia optimizada de stop_ids y métricas calculadas
    optimization_metadata: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
        comment="Resultado de OR-Tools: secuencia optimizada, distancia total, tiempo estimado",
    )

    # --- Auditoría ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # --- Relaciones ---
    driver: Mapped["Driver"] = relationship(  # noqa: F821
        "Driver",
        back_populates="routes",
    )
    stops: Mapped[list["Stop"]] = relationship(  # noqa: F821
        "Stop",
        back_populates="route",
        order_by="Stop.sequence_order",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Route id={self.id} date={self.route_date} status={self.status}>"
