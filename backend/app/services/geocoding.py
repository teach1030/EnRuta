"""
app/services/geocoding.py
Servicio de geocodificacion usando Mapbox Geocoding API v6.
Recibe la direccion normalizada y retorna coordenadas lat/lng.
"""
import httpx
from app.core.config import settings


MAPBOX_GEOCODING_URL = "https://api.mapbox.com/search/geocode/v6/forward"

# Bounding box de Bogota D.C. para restringir resultados
# [min_lng, min_lat, max_lng, max_lat]
BOGOTA_BBOX = "-74.2241,4.4699,-73.9975,4.8372"


async def geocode_address(address: str) -> dict | None:
    """
    Geocodifica una direccion usando Mapbox Geocoding API v6.

    Args:
        address: Direccion normalizada para geocodificar.
                 Debe ser la 'geocodable_address' del normalizador, no el complemento.

    Returns:
        dict con 'latitude', 'longitude', 'confidence' o None si falla.
    """
    if not settings.MAPBOX_ACCESS_TOKEN:
        raise ValueError("MAPBOX_ACCESS_TOKEN no configurado en .env")

    params = {
        "q": f"{address}, Bogota, Colombia",
        "access_token": settings.MAPBOX_ACCESS_TOKEN,
        "country": "CO",
        "language": "es",
        "bbox": BOGOTA_BBOX,
        "limit": 1,
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            response = await client.get(MAPBOX_GEOCODING_URL, params=params)
            response.raise_for_status()
            data = response.json()

            features = data.get("features", [])
            if not features:
                return None

            feature = features[0]
            coords = feature["geometry"]["coordinates"]
            confidence = feature.get("properties", {}).get("match_code", {}).get("confidence", "low")

            # Mapear nivel de confianza a valor numerico
            confidence_map = {"exact": 1.0, "high": 0.8, "medium": 0.6, "low": 0.3}

            return {
                "longitude": coords[0],
                "latitude": coords[1],
                "confidence": confidence_map.get(confidence, 0.3),
                "full_match": feature.get("properties", {}).get("full_address", ""),
            }

        except httpx.HTTPStatusError as e:
            # TODO: agregar logging estructurado
            print(f"[Geocoding] HTTP error {e.response.status_code}: {e.response.text}")
            return None
        except Exception as e:
            print(f"[Geocoding] Unexpected error: {e}")
            return None