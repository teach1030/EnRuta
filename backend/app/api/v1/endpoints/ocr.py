"""
app/api/v1/endpoints/ocr.py
Endpoint para procesamiento OCR inteligente de guias de envio usando DeepSeek Vision.
Extrae datos estructurados (destinatario, direccion, telefono, tracking) directamente de la foto,
normaliza la direccion para Bogota y geocodifica las coordenadas con Mapbox.
"""
import base64
import io
import json
import logging
import re
from typing import Optional

import httpx
from fastapi import APIRouter, UploadFile, File, HTTPException, status
from PIL import Image, ImageOps
from pydantic import BaseModel, Field

from app.core.config import settings
from app.utils.normalization import normalize_bogota_address
from app.services.geocoding import geocode_address

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ocr", tags=["OCR - Guias de Envio"])


class OCRGuideResult(BaseModel):
    """Datos extraidos por OCR de una guia de envio."""
    raw_text: str = Field(default="", description="Texto extraido de la guia")
    tracking_number: Optional[str] = Field(default=None, description="Numero de guia o tracking")
    recipient_name: Optional[str] = Field(default=None, description="Nombre del destinatario")
    recipient_phone: Optional[str] = Field(default=None, description="Telefono de contacto")
    raw_address: Optional[str] = Field(default=None, description="Direccion cruda detectada")
    normalized_address: Optional[str] = Field(default=None, description="Direccion base normalizada para geocodificar")
    complement: Optional[str] = Field(default=None, description="Torre, interior, apartamento")
    locality: Optional[str] = Field(default=None, description="Localidad en Bogota")
    lat: Optional[float] = Field(default=None, description="Latitud geocodificada")
    lng: Optional[float] = Field(default=None, description="Longitud geocodificada")
    package_weight_kg: Optional[float] = Field(default=None, description="Peso del paquete en kg si aparece")
    confidence: float = Field(default=0.0, description="Nivel de confianza de la extraccion (0.0 a 1.0)")


_OCR_PROMPT = """
Eres un asistente experto en logistica y lectura de guias de transporte y paqueteria en Colombia (Servientrega, Coordinadora, Interrapidismo, Envía, J&T Express, iMile, etc.).
Analiza detenidamente la imagen de esta guia o rotulo de envio y extrae la siguiente informacion en formato JSON estricto:

- "tracking_number": Numero de tracking, remesa, guia o codigo de barras (string o null).
- "recipient_name": Nombre completo del destinatario o cliente (string o null).
- "recipient_phone": Numero celular o telefono del destinatario (string o null). En Colombia suele tener 10 digitos y empezar con 3.
- "raw_address": Direccion de entrega completa (string o null), tal como aparece en la etiqueta.
- "package_weight_kg": Peso en kilogramos si esta indicado (numero flotante o null).
- "raw_text": Resumen breve en una sola linea de los datos legibles (maximo 120 caracteres, sin saltos de linea ni comillas dobles).
- "confidence": Confianza de lectura entre 0.0 y 1.0 basada en la claridad de la imagen (numero flotante).

Responde exclusivamente con un objeto JSON valido con esas claves.
"""


def _parse_json_payload(raw_content: str) -> dict:
    """Limpia posibles bloques Markdown ```json``` y parsea el objeto JSON retornado por el modelo."""
    cleaned = raw_content.strip()
    fence_match = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", cleaned, re.DOTALL)
    if fence_match:
        cleaned = fence_match.group(1)
    return json.loads(cleaned or "{}")


def _compress_image_for_ocr(image_bytes: bytes, mime_type: str) -> tuple[bytes, str]:
    """Redimensiona imagenes grandes a max 1280px y comprime a JPEG para acelerar la inferencia."""
    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            img = ImageOps.exif_transpose(img)
            if img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            elif img.mode == "L":
                img = img.convert("RGB")
            img.thumbnail((1280, 1280), Image.Resampling.LANCZOS)
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=82, optimize=True)
            return buf.getvalue(), "image/jpeg"
    except Exception:
        return image_bytes, mime_type


async def _extract_guide_with_deepseek(image_bytes: bytes, mime_type: str) -> dict:
    """Envia la imagen optimizada en base64 a la API multimodal de DeepSeek Vision."""
    opt_bytes, opt_mime = _compress_image_for_ocr(image_bytes, mime_type)
    b64_image = base64.b64encode(opt_bytes).decode("ascii")
    data_url = f"data:{opt_mime};base64,{b64_image}"

    endpoint = f"{settings.DEEPSEEK_BASE_URL.rstrip('/')}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.DEEPSEEK_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.DEEPSEEK_MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": _OCR_PROMPT},
                    {"type": "image_url", "image_url": {"url": data_url}},
                ],
            }
        ],
        "response_format": {"type": "json_object"},
        "reasoning_effort": "low",
        "max_tokens": 1024,
        "temperature": 0.1,
    }

    async with httpx.AsyncClient(timeout=35.0) as client:
        resp = await client.post(endpoint, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()

    content = data["choices"][0]["message"]["content"]
    return _parse_json_payload(content)


@router.post(
    "/process-guide",
    response_model=OCRGuideResult,
    summary="Procesar guia de envio con IA (DeepSeek Vision)",
    description=(
        "Recibe la fotografia de una guia de envio, extrae mediante DeepSeek Vision los campos clave "
        "(guia, destinatario, telefono, direccion), normaliza la direccion y geocodifica sus coordenadas."
    ),
)
async def process_guide_image(
    file: UploadFile = File(..., description="Foto de la guia de envio (JPG, PNG o WEBP)"),
) -> OCRGuideResult:
    # 1. Validar tipo de archivo
    if file.content_type not in ("image/jpeg", "image/png", "image/jpg", "image/webp"):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Solo se aceptan imagenes JPG, PNG o WEBP",
        )

    # 2. Leer bytes de la imagen
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="La imagen no puede superar 10 MB",
        )

    if not settings.DEEPSEEK_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="DEEPSEEK_API_KEY no esta configurada en el servidor",
        )

    # 3. Llamar a la API multimodal de DeepSeek
    try:
        mime_type = "image/jpeg" if file.content_type == "image/jpg" else (file.content_type or "image/jpeg")
        parsed = await _extract_guide_with_deepseek(image_bytes, mime_type)
    except Exception as e:
        logger.error(f"Error procesando imagen con DeepSeek: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Fallo al procesar la guia con DeepSeek: {str(e)}",
        )

    raw_text = parsed.get("raw_text") or ""
    tracking_number = parsed.get("tracking_number")
    recipient_name = parsed.get("recipient_name")
    recipient_phone = parsed.get("recipient_phone")
    raw_address = parsed.get("raw_address")
    weight = parsed.get("package_weight_kg")
    confidence = float(parsed.get("confidence") or 0.8)

    # 4. Normalizar y Geocodificar la direccion si se obtuvo
    normalized_address = None
    complement = None
    locality = None
    lat = None
    lng = None

    if raw_address and raw_address.strip():
        norm = normalize_bogota_address(raw_address.strip())
        normalized_address = norm.geocodable_address
        complement = norm.complement or None
        locality = norm.locality or None

        for query in dict.fromkeys(q for q in (normalized_address, raw_address.strip()) if q):
            try:
                geo = await geocode_address(query)
                if geo:
                    lat = geo.get("latitude")
                    lng = geo.get("longitude")
                    break
            except Exception as e:
                logger.warning(f"Error al geocodificar {query}: {e}")

    return OCRGuideResult(
        raw_text=raw_text,
        tracking_number=tracking_number,
        recipient_name=recipient_name,
        recipient_phone=recipient_phone,
        raw_address=raw_address,
        normalized_address=normalized_address,
        complement=complement,
        locality=locality,
        lat=lat,
        lng=lng,
        package_weight_kg=weight,
        confidence=confidence,
    )
