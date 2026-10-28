"""
app/core/security.py
Utilidades de seguridad: hashing de contrasenas y emision/validacion de JWT.
Se separa de los endpoints para que tanto `drivers.py` como la dependencia
`get_current_driver` (app/api/deps.py) compartan la misma logica.

Nota: se usa `bcrypt` directamente (no passlib). passlib 1.7.4 es incompatible con
bcrypt >= 5 (lanza ValueError al inicializar). Los hashes `$2b$...` generados antes
con passlib siguen siendo validos con esta implementacion.
"""
from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings

# bcrypt solo considera los primeros 72 bytes; bcrypt>=5 lanza error si se exceden.
_BCRYPT_MAX_BYTES = 72


def _to_bcrypt_bytes(password: str) -> bytes:
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_to_bcrypt_bytes(password), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_to_bcrypt_bytes(plain), hashed.encode("utf-8"))
    except ValueError:
        # Hash malformado en BD: tratar como credencial invalida en vez de 500.
        return False


def create_access_token(driver_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": driver_id, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_access_token(token: str) -> str | None:
    """
    Valida firma y expiracion del JWT.
    Retorna el `sub` (driver_id como str) o None si el token es invalido/expirado.
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None
    sub = payload.get("sub")
    return sub if isinstance(sub, str) else None
