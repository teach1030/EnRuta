"""
app/api/v1/endpoints/drivers.py
Endpoints para autenticacion y gestion de conductores.

Publicos:   register, login (email o celular), google-auth
Protegidos: me (GET/PATCH), {driver_id} (GET/PATCH, solo el propio conductor)
"""
import asyncio
import logging
import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_driver
from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.driver import Driver
from app.schemas.driver import (
    DriverCreate,
    DriverLogin,
    DriverResponse,
    DriverUpdate,
    GoogleAuthRequest,
    Token,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/drivers", tags=["Conductores"])

_GOOGLE_ISSUERS = {"accounts.google.com", "https://accounts.google.com"}


# ─── Helpers ─────────────────────────────────────────────────────────────────
async def _find_by_email(db: AsyncSession, email: str) -> Driver | None:
    result = await db.execute(select(Driver).where(func.lower(Driver.email) == email.strip().lower()))
    return result.scalar_one_or_none()


def _token_response(driver: Driver) -> dict:
    return {"access_token": create_access_token(str(driver.id)), "token_type": "bearer", "driver": driver}


async def _verify_google_token(raw_token: str) -> dict:
    """
    Valida el id_token de Google (firma, expiracion, issuer y audience) con google-auth.
    verify_oauth2_token es bloqueante (descarga/cachea certificados), asi que corre en un hilo.
    """
    audiences = [c.strip() for c in settings.GOOGLE_CLIENT_ID.split(",") if c.strip()]
    if not audiences:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Sign-In no esta configurado en el servidor (GOOGLE_CLIENT_ID).",
        )

    def _verify() -> dict:
        return google_id_token.verify_oauth2_token(raw_token, google_requests.Request(), audiences)

    try:
        info = await asyncio.to_thread(_verify)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token de Google invalido o expirado",
        ) from exc
    except Exception as exc:  # fallo de red al obtener certificados de Google
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="No se pudo validar el token con Google. Intenta de nuevo.",
        ) from exc

    if info.get("iss") not in _GOOGLE_ISSUERS or not info.get("email_verified") or not info.get("email"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La cuenta de Google no tiene un email verificado",
        )
    return info


# ─── POST /drivers/register ──────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=Token,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar conductor",
    description="Crea un nuevo conductor en el sistema y retorna el token JWT junto con su perfil.",
)
async def register_driver(
    payload: DriverCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        phone = payload.phone.strip() if payload.phone else f"p_{uuid.uuid4().hex[:12]}"

        result = await db.execute(select(Driver).where(Driver.phone == phone))
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un conductor registrado con el celular {phone}",
            )

        email = payload.email.strip().lower() if payload.email else None
        if email and await _find_by_email(db, email):
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un conductor registrado con el email {email}",
            )

        hashed_pwd = await asyncio.to_thread(hash_password, payload.password)
        driver = Driver(
            name=payload.name.strip(),
            phone=phone,
            email=email,
            vehicle=payload.vehicle.strip() if payload.vehicle else None,
            vehicle_plate=payload.vehicle_plate.strip().upper() if payload.vehicle_plate else None,
            hashed_password=hashed_pwd,
        )
        db.add(driver)
        await db.commit()
        await db.refresh(driver)
        return _token_response(driver)
    except HTTPException:
        raise
    except IntegrityError as exc:
        await db.rollback()
        logger.warning("Conflicto de unicidad al registrar conductor: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo electronico o celular ya se encuentra registrado.",
        ) from exc
    except (SQLAlchemyError, asyncio.TimeoutError, OSError) as exc:
        await db.rollback()
        logger.error("Error de base de datos al registrar conductor: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error de conexion con la base de datos al registrar el conductor. Intenta de nuevo.",
        ) from exc
    except Exception as exc:
        await db.rollback()
        logger.error("Error inesperado al registrar conductor: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo completar el registro: {exc}",
        ) from exc


# ─── POST /drivers/login ─────────────────────────────────────────────────────
@router.post(
    "/login",
    response_model=Token,
    summary="Login conductor (email o celular)",
    description="Autentica con `email` + `password` o `phone` + `password` y retorna un JWT.",
)
async def login_driver(
    payload: DriverLogin,
    db: AsyncSession = Depends(get_db),
) -> dict:
    try:
        if payload.email:
            driver = await _find_by_email(db, payload.email)
        else:
            result = await db.execute(select(Driver).where(Driver.phone == payload.phone.strip()))
            driver = result.scalar_one_or_none()
    except (SQLAlchemyError, asyncio.TimeoutError, OSError) as exc:
        logger.error("Error de base de datos en login: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error de conexion con la base de datos. Intenta de nuevo.",
        ) from exc

    # Mismo mensaje para "no existe" y "contraseña incorrecta" (no revelar cuentas).
    password_ok = (
        await asyncio.to_thread(verify_password, payload.password, driver.hashed_password)
        if driver is not None
        else False
    )
    if not driver or not password_ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not driver.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta de conductor esta desactivada",
        )

    return _token_response(driver)


# ─── POST /drivers/google-auth ───────────────────────────────────────────────
@router.post(
    "/google-auth",
    response_model=Token,
    summary="Login / registro con Google",
    description=(
        "Valida el `id_token` de Google Sign-In. Si ya existe un conductor con ese email "
        "inicia sesion; si no, lo registra automaticamente. Retorna un JWT propio de EnRuta."
    ),
)
async def google_auth(
    payload: GoogleAuthRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    info = await _verify_google_token(payload.id_token)
    email = info["email"].strip().lower()

    driver = await _find_by_email(db, email)
    if driver is None:
        name = (info.get("name") or email.split("@")[0]).strip()
        driver = Driver(
            name=name if len(name) >= 2 else "Conductor",
            # `phone` es NOT NULL + UNIQUE: marcador unico hasta que el conductor registre el suyo.
            phone=f"g_{uuid.uuid4().hex[:16]}",
            email=email,
            # Contraseña aleatoria inutilizable: esta cuenta entra solo con Google.
            hashed_password=hash_password(secrets.token_urlsafe(32)),
        )
        try:
            async with db.begin_nested():
                db.add(driver)
                await db.flush()
        except IntegrityError:
            # Carrera: otra peticion creo el mismo conductor entre el SELECT y el INSERT.
            existing = await _find_by_email(db, email)
            if existing is None:
                raise
            driver = existing

    if not driver.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta cuenta de conductor esta desactivada",
        )

    await db.commit()
    await db.refresh(driver)
    return _token_response(driver)


# ─── GET /drivers/me ─────────────────────────────────────────────────────────
@router.get(
    "/me",
    response_model=DriverResponse,
    summary="Conductor autenticado",
    description="Retorna el perfil del conductor dueño del token.",
)
async def get_me(driver: Driver = Depends(get_current_driver)) -> Driver:
    return driver


# ─── PUT / PATCH /drivers/me ────────────────────────────────────────────────
@router.put(
    "/me",
    response_model=DriverResponse,
    summary="Actualizar mi perfil (PUT)",
    description="Actualiza nombre, email, vehiculo o placa del conductor autenticado.",
)
@router.patch(
    "/me",
    response_model=DriverResponse,
    summary="Actualizar mi perfil (PATCH)",
    description="Actualiza nombre, email, vehiculo o placa del conductor autenticado.",
)
async def update_me(
    payload: DriverUpdate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Driver:
    update_data = payload.model_dump(exclude_unset=True)

    if "email" in update_data and update_data["email"]:
        new_email = update_data["email"].strip().lower()
        other = await _find_by_email(db, new_email)
        if other is not None and other.id != driver.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un conductor registrado con el email {new_email}",
            )
        update_data["email"] = new_email

    if "phone" in update_data and update_data["phone"]:
        new_phone = update_data["phone"].strip()
        result = await db.execute(select(Driver).where(Driver.phone == new_phone))
        other = result.scalar_one_or_none()
        if other is not None and other.id != driver.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe un conductor registrado con el celular {new_phone}",
            )
        update_data["phone"] = new_phone

    if "vehicle" in update_data and update_data["vehicle"]:
        update_data["vehicle"] = update_data["vehicle"].strip()

    if "vehicle_plate" in update_data and update_data["vehicle_plate"]:
        update_data["vehicle_plate"] = update_data["vehicle_plate"].strip().upper()

    for field, value in update_data.items():
        setattr(driver, field, value)

    try:
        await db.commit()
        await db.refresh(driver)
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo o celular indicado ya pertenece a otro conductor.",
        ) from exc
    except (SQLAlchemyError, asyncio.TimeoutError, OSError) as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Error de base de datos al actualizar el perfil.",
        ) from exc
    return driver


# ─── GET /drivers/{driver_id} ────────────────────────────────────────────────
@router.get(
    "/{driver_id}",
    response_model=DriverResponse,
    summary="Obtener conductor",
    description="Retorna la informacion de un conductor. Solo se permite consultar el propio perfil.",
)
async def get_driver(
    driver_id: uuid.UUID,
    driver: Driver = Depends(get_current_driver),
) -> Driver:
    if driver_id != driver.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes consultar a otro conductor")
    return driver


# ─── PATCH /drivers/{driver_id} ──────────────────────────────────────────────
@router.patch(
    "/{driver_id}",
    response_model=DriverResponse,
    summary="Actualizar conductor",
    description="Actualiza datos del conductor (nombre, email, placa, estado). Solo el propio perfil.",
)
async def update_driver(
    driver_id: uuid.UUID,
    payload: DriverUpdate,
    db: AsyncSession = Depends(get_db),
    driver: Driver = Depends(get_current_driver),
) -> Driver:
    if driver_id != driver.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No puedes modificar a otro conductor")
    return await update_me(payload, db, driver)
