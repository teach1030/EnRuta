"""
Punto de entrada principal FastAPI del Simulador Arquitectónico de EnRuta.

Configura:
  - Metadatos OpenAPI (`/docs` y `/redoc`) contextualizados al proyecto EnRuta.
  - Política CORS segura y flexible (`CORS_ORIGINS` o `*` para contenedores locales
    y cliente estático en GitHub Pages `https://teach1030.github.io/EnRuta/`).
  - Manejador personalizado de `RequestValidationError` que transforma errores de
    Pydantic v2 en respuestas `HTTP 422 Unprocessable Entity` legibles en español
    con contexto del dominio logístico de última milla.
  - Enrutador principal bajo el prefijo `/api/v1`.
"""

from __future__ import annotations

import os
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import __version__
from app.api import router as api_v1_router
from app.schemas.simulation import FIELD_DOMAIN_HINTS


def _parse_cors_origins() -> list[str]:
    """Obtiene la lista de orígenes permitidos desde `CORS_ORIGINS` (por defecto `['*']`)."""
    raw_origins = os.getenv("CORS_ORIGINS", "*").strip()
    if not raw_origins or raw_origins == "*":
        return ["*"]
    parsed = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
    return parsed if parsed else ["*"]


def _translate_validation_error(err: dict[str, Any]) -> dict[str, Any]:
    """
    Traduce y enriquece un error individual de Pydantic v2 al español técnico del
    dominio logístico de EnRuta, garantizando serialización JSON limpia.
    """
    raw_loc = list(err.get("loc", ()))
    loc_without_body = [str(part) for part in raw_loc if part != "body"]
    field_path = ".".join(loc_without_body) if loc_without_body else "payload"
    leaf_field = loc_without_body[-1] if loc_without_body else "payload"
    # Si el error ocurre en un ítem de lista (ej. driver_points.0), tomamos el campo padre
    if leaf_field.isdigit() and len(loc_without_body) >= 2:
        leaf_field = loc_without_body[-2]

    err_type = str(err.get("type", "validation_error"))
    raw_msg = str(err.get("msg", "Valor inválido."))
    ctx = err.get("ctx") or {}
    received_input = err.get("input")

    hint = FIELD_DOMAIN_HINTS.get(leaf_field, "")

    if err_type == "greater_than_equal" and "ge" in ctx:
        spanish_core = f"El valor debe ser mayor o igual a {ctx['ge']} (recibido: {received_input!r})."
    elif err_type == "greater_than" and "gt" in ctx:
        spanish_core = f"El valor debe ser estrictamente mayor a {ctx['gt']} (recibido: {received_input!r})."
    elif err_type == "less_than_equal" and "le" in ctx:
        spanish_core = f"El valor debe ser menor o igual a {ctx['le']} (recibido: {received_input!r})."
    elif err_type == "less_than" and "lt" in ctx:
        spanish_core = f"El valor debe ser estrictamente menor a {ctx['lt']} (recibido: {received_input!r})."
    elif err_type in ("int_parsing", "int_from_float", "int_type"):
        spanish_core = f"Se requiere un número entero válido (recibido: {received_input!r})."
    elif err_type in ("float_parsing", "float_type", "finite_number"):
        spanish_core = f"Se requiere un número decimal finito válido (recibido: {received_input!r})."
    elif err_type in ("bool_parsing", "bool_type"):
        spanish_core = f"Se requiere un valor booleano true/false (recibido: {received_input!r})."
    elif err_type == "string_too_short" and "min_length" in ctx:
        spanish_core = f"El texto debe tener al menos {ctx['min_length']} caracteres."
    elif err_type == "string_too_long" and "max_length" in ctx:
        spanish_core = f"El texto no puede superar {ctx['max_length']} caracteres."
    elif err_type == "too_short" and "min_length" in ctx:
        spanish_core = f"La lista debe contener al menos {ctx['min_length']} elemento(s)."
    elif err_type == "too_long" and "max_length" in ctx:
        spanish_core = f"La lista no puede superar {ctx['max_length']} elementos."
    elif err_type == "missing":
        spanish_core = f"El campo '{field_path}' es obligatorio."
    elif err_type == "json_invalid":
        spanish_core = "El cuerpo de la petición no contiene un documento JSON válido."
    elif err_type == "value_error":
        cleaned = raw_msg.removeprefix("Value error, ").strip()
        spanish_core = cleaned
    else:
        spanish_core = raw_msg

    full_message = f"{hint} {spanish_core}".strip() if hint and hint not in spanish_core else spanish_core

    safe_input = jsonable_encoder(
        received_input,
        custom_encoder={Exception: lambda exc_obj: str(exc_obj)},
    )

    return {
        "loc": [str(part) if not isinstance(part, int) else part for part in raw_loc],
        "field": field_path,
        "msg": full_message,
        "message": full_message,
        "type": err_type,
        "input": safe_input,
    }


def create_app() -> FastAPI:
    """Construye y configura la instancia principal FastAPI del simulador."""
    application = FastAPI(
        title="EnRuta — API del Simulador de Arquitecturas de Software",
        description=(
            "Motor analítico determinista, frontera de optimalidad de Pareto 3D y sistema "
            "multicriterio explicable (MCDA / TOPSIS-SAW) para evaluar alternativas "
            "arquitectónicas de despliegue del ecosistema logístico de última milla **EnRuta** "
            "(Bogotá D.C., Colombia): Monolito MVP, Monolito Contenerizado + Workers Redis, "
            "Microservicios Docker y Arquitectura Híbrida Edge (ML Kit) + Serverless."
        ),
        version=__version__,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        contact={
            "name": "Equipo de Arquitectura de Software — Proyecto EnRuta (Universidad Libre)",
            "url": "https://teach1030.github.io/EnRuta/",
        },
    )

    cors_origins = _parse_cors_origins()
    allow_credentials = cors_origins != ["*"]

    application.add_middleware(
        CORSMiddleware,
        allow_origins=cors_origins,
        allow_credentials=allow_credentials,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
    )

    @application.exception_handler(RequestValidationError)
    async def request_validation_exception_handler(
        _request: Request,
        exc: RequestValidationError,
    ) -> JSONResponse:
        """Retorna HTTP 422 estructurado con mensajes claros en español del dominio EnRuta."""
        formatted_details = [_translate_validation_error(err) for err in exc.errors()]
        summary_messages = "; ".join(
            f"[{item['field']}] {item['message']}" for item in formatted_details
        )
        return JSONResponse(
            status_code=getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422),
            content={
                "error": "VALIDATION_ERROR",
                "message": (
                    f"Validación de dominio EnRuta fallida ({len(formatted_details)} error(es)): "
                    f"{summary_messages}"
                ),
                "errors": [
                    {"field": item["field"], "message": item["message"]}
                    for item in formatted_details
                ],
                "detail": formatted_details,
            },
        )

    @application.get(
        "/",
        tags=["Raíz"],
        summary="Descriptor raíz de la API del Simulador EnRuta",
    )
    def root_info() -> dict[str, str]:
        """Punto informativo raíz con enlaces rápidos a documentación y healthcheck."""
        return {
            "service": "enruta-architecture-simulator",
            "version": __version__,
            "status": "ok",
            "docs_url": "/docs",
            "health_url": "/api/v1/health",
        }

    application.include_router(api_v1_router, prefix="/api/v1")
    return application


app = create_app()
