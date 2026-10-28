"""
app/api/v1/endpoints/ocr.py
Endpoint para procesamiento OCR inteligente de guias de envio usando Gemini Multimodal.
Extrae datos estructurados (destinatario, direccion, telefono, tracking) directamente de la foto,
normaliza la direccion para Bogota y geocodifica las coordenadas con Mapbox.
"""
import json
import logging
from typing import Optional
from fastapi import APIRouter, UploadFile, File, HTTPException, status
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


_GEMINI_OCR_PROMPT = """
Eres un asistente experto en logistica y lectura de guias de transporte y paqueteria en Colombia (Servientrega, Coordinadora, Interrapidismo, Envía, J&T Express, iMile, etc.).
Analiza detenidamente la imagen de esta guia o rotulo de envio y extrae la siguiente informacion en formato JSON estricto:

- "tracking_number": Numero de tracking, remesa, guia o codigo de barras (string o null).
- "recipient_name": Nombre completo del destinatario o cliente (string o null).
- "recipient_phone": Numero celular o telefono del destinatario (string o null). En Colombia suele tener 10 digitos y empezar con 3.
- "raw_address": Direccion de entrega completa (string o null), tal como aparece en la etiqueta.
- "package_weight_kg": Peso en kilogramos si esta indicado (numero flotante o null).
- "raw_text": Transcripcion o resumen de los datos principales legibles en la etiqueta (string).
- "confidence": Confianza de lectura entre 0.0 y 1.0 basada en la claridad de la imagen (numero flotante).

Responde exclusivamente con un objeto JSON valido con esas claves.
"""


@router.post(
    "/process-guide",
    response_model=OCRGuideResult,
    summary="Procesar guia de envio con IA (Gemini Vision)",
    description=(
        "Recibe la fotografia de una guia de envio, extrae mediante Gemini Vision los campos clave "
        "(guia, destinatario, telefono, direccion), normaliza la direccion y geocodifica sus coordenadas."
    ),
)
async def process_guide_image(
    file: UploadFile = File(..., description="Foto de la guia de envio (JPG o PNG)"),
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

    if not settings.GEMINI_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="GEMINI_API_KEY no esta configurada en el servidor",
        )

    # 3. Llamar a la API de Gemini usando google-genai
    try:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=settings.GEMINI_API_KEY)

        image_part = types.Part.from_bytes(
            data=image_bytes,
            mime_type=file.content_type or "image/jpeg",
        )

        response = await client.aio.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[_GEMINI_OCR_PROMPT, image_part],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )

        response_text = response.text or "{}"
        parsed = json.loads(response_text)
    except Exception as e:
        logger.error(f"Error procesando imagen con Gemini: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Fallo al procesar la guia con Gemini: {str(e)}",
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

        if settings.MAPBOX_ACCESS_TOKEN and normalized_address:
            try:
                geo = await geocode_address(normalized_address)
                if geo:
                    lat = geo.get("latitude")
                    lng = geo.get("longitude")
            except Exception as e:
                logger.warning(f"Error al geocodificar {normalized_address}: {e}")

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
