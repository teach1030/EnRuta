"""
app/models/driver.py
Modelo ORM SQLAlchemy para la tabla 'drivers'.
Representa a los conductores de reparto registrados en el sistema.
"""
import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.session import Base


class Driver(Base):
    __tablename__ = "drivers"

    # --- Clave primaria ---
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        comment="Identificador único del conductor (UUID)",
    )

    # --- Datos del conductor ---
    name: Mapped[str] = mapped_column(
        String(150),
        nullable=False,
        comment="Nombre completo del conductor",
    )
    phone: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        unique=True,
        comment="Número de celular del conductor (único)",
    )
    email: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
        unique=True,
        comment="Correo electrónico (opcional)",
    )
    hashed_password: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        comment="Contraseña hasheada (bcrypt)",
    )
    vehicle: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
        comment="Tipo de vehículo (ej: Moto Suzuki, Carro)",
    )
    vehicle_plate: Mapped[str | None] = mapped_column(
        String(10),
        nullable=True,
        comment="Placa del vehículo asignado",
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False,
        comment="Indica si el conductor está activo en el sistema",
    )

    # --- Auditoría ---
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        comment="Fecha y hora de registro del conductor",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
        comment="Fecha y hora de última actualización",
    )

    # --- Relaciones ---
    routes: Mapped[list["Route"]] = relationship(  # noqa: F821
        "Route",
        back_populates="driver",
        cascade="all, delete-orphan",
    )

    def __repr__(self) -> str:
        return f"<Driver id={self.id} name={self.name!r} phone={self.phone!r}>"
