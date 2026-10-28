"""
app/api/deps.py
Dependencias compartidas de FastAPI.

`get_current_driver` extrae al conductor autenticado desde el header
`Authorization: Bearer <token>`. Se usa en todos los endpoints protegidos.
"""
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.driver import Driver

# auto_error=False para devolver nuestro propio 401 (con WWW-Authenticate) en vez del 403 por defecto.
bearer_scheme = HTTPBearer(auto_error=False, description="JWT obtenido en /drivers/login o /drivers/google-auth")

__all__ = ["get_db", "get_current_driver"]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_driver(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> Driver:
    if credentials is None:
        raise _unauthorized("Falta el header Authorization: Bearer <token>")

    driver_id = decode_access_token(credentials.credentials)
    if driver_id is None:
        raise _unauthorized("Token invalido o expirado")

    try:
        driver_uuid = uuid.UUID(driver_id)
    except ValueError:
        raise _unauthorized("Token invalido") from None

    result = await db.execute(select(Driver).where(Driver.id == driver_uuid))
    driver = result.scalar_one_or_none()
    if driver is None:
        raise _unauthorized("El conductor del token ya no existe")
    if not driver.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta de conductor esta desactivada",
        )
    return driver
