"""
app/schemas/driver.py
Esquemas Pydantic para validación y serialización de datos de Conductores.
"""
import uuid
from datetime import datetime
from pydantic import BaseModel, EmailStr, Field, ConfigDict, model_validator


# ───────────────────────────── Base ─────────────────────────────
class DriverBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, examples=["Carlos Pérez"])
    phone: str = Field(..., min_length=7, max_length=20, examples=["3001234567"])
    email: EmailStr | None = Field(None, examples=["conductor@ejemplo.com"])
    vehicle_plate: str | None = Field(None, max_length=10, examples=["ABC123"])


# ─────────────────────── Creación (Request) ──────────────────────
class DriverCreate(DriverBase):
    """Payload para registrar un nuevo conductor."""
    password: str = Field(..., min_length=6, examples=["segura123"])


# ─────────────────────── Actualización (Request) ─────────────────
class DriverUpdate(BaseModel):
    """Payload para actualizar datos de un conductor (todos los campos opcionales)."""
    name: str | None = Field(None, min_length=2, max_length=150)
    email: EmailStr | None = None
    vehicle_plate: str | None = Field(None, max_length=10)
    is_active: bool | None = None


# ─────────────────────── Respuesta (Response) ────────────────────
class DriverResponse(DriverBase):
    """Representación del conductor que se devuelve al cliente."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


# ─────────────────────── Login ───────────────────────────────────
class DriverLogin(BaseModel):
    """Login con email O celular, mas la contraseña."""
    email: EmailStr | None = Field(None, examples=["conductor@ejemplo.com"])
    phone: str | None = Field(None, min_length=7, max_length=20, examples=["3001234567"])
    password: str = Field(..., min_length=1)

    @model_validator(mode="after")
    def _require_email_or_phone(self) -> "DriverLogin":
        if not self.email and not self.phone:
            raise ValueError("Debes enviar 'email' o 'phone' para iniciar sesion")
        return self


class GoogleAuthRequest(BaseModel):
    """id_token (JWT) que entrega Google Sign-In en el cliente movil."""
    id_token: str = Field(..., min_length=20)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    driver: DriverResponse
