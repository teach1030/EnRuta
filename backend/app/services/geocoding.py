"""
app/services/geocoding.py
Servicio de geocodificacion para Bogota D.C. usando Mapbox Geocoding API v6 (si hay token valido)
y respaldo gratuito de alta precision con ArcGIS World Geocoder + OpenStreetMap Nominatim + Photon.
"""
import logging
import re
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

MAPBOX_GEOCODING_URL = "https://api.mapbox.com/search/geocode/v6/forward"
ARCGIS_GEOCODING_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
PHOTON_URL = "https://photon.komoot.io/api/"

# Bounding box de Bogota D.C.: [min_lng, min_lat, max_lng, max_lat]
BOGOTA_BBOX = "-74.2241,4.4699,-73.9975,4.8372"
BOGOTA_MIN_LAT, BOGOTA_MAX_LAT = 4.45, 4.85
BOGOTA_MIN_LNG, BOGOTA_MAX_LNG = -74.25, -73.98


def _is_valid_mapbox_token(token: str) -> bool:
    """Descarta tokens vacios o de ejemplo (placeholder)."""
    if not token:
        return False
    lower = token.lower()
    if "your_username" in lower or "your_token" in lower or "your_signature" in lower:
        return False
    if "wu9vu" in lower:
        return False
    return token.startswith("pk.") and len(token) > 25


def _in_bogota(lat: float, lng: float) -> bool:
    return BOGOTA_MIN_LAT <= lat <= BOGOTA_MAX_LAT and BOGOTA_MIN_LNG <= lng <= BOGOTA_MAX_LNG


def _clean_for_osm(address: str) -> str:
    """Convierte 'Calle 45 # 12-30' en 'Calle 45 12-30' para mejorar coincidencia en OSM."""
    cleaned = address.replace("#", " ").replace("No.", " ").replace("N°", " ")
    return re.sub(r"\s+", " ", cleaned).strip()


async def _geocode_mapbox(client: httpx.AsyncClient, address: str) -> dict | None:
    params = {
        "q": f"{address}, Bogota, Colombia",
        "access_token": settings.MAPBOX_ACCESS_TOKEN,
        "country": "CO",
        "language": "es",
        "bbox": BOGOTA_BBOX,
        "limit": 1,
    }
    try:
        response = await client.get(MAPBOX_GEOCODING_URL, params=params)
        response.raise_for_status()
        features = response.json().get("features", [])
        if not features:
            return None
        feature = features[0]
        coords = feature["geometry"]["coordinates"]
        confidence = feature.get("properties", {}).get("match_code", {}).get("confidence", "low")
        confidence_map = {"exact": 1.0, "high": 0.8, "medium": 0.6, "low": 0.3}
        return {
            "longitude": coords[0],
            "latitude": coords[1],
            "confidence": confidence_map.get(confidence, 0.3),
            "full_match": feature.get("properties", {}).get("full_address", ""),
        }
    except Exception as e:
        logger.warning("[Geocoding] Mapbox fallo (%s), usando respaldo.", e)
        return None


async def _geocode_arcgis(client: httpx.AsyncClient, address: str) -> dict | None:
    """Geocodifica nomenclatura colombiana exacta usando ArcGIS World Geocoder."""
    try:
        params = {
            "f": "json",
            "SingleLine": f"{address}, Bogota, Colombia",
            "countryCode": "COL",
            "searchExtent": BOGOTA_BBOX,
            "maxLocations": 1,
        }
        resp = await client.get(ARCGIS_GEOCODING_URL, params=params)
        resp.raise_for_status()
        candidates = resp.json().get("candidates", [])
        if not candidates:
            return None
        cand = candidates[0]
        score = float(cand.get("score", 0))
        loc = cand.get("location", {})
        lat = float(loc.get("y", 0))
        lng = float(loc.get("x", 0))
        if score >= 70.0 and _in_bogota(lat, lng):
            return {
                "longitude": lng,
                "latitude": lat,
                "confidence": round(min(1.0, score / 100.0), 2),
                "full_match": cand.get("address", ""),
            }
    except Exception as e:
        logger.warning("[Geocoding] ArcGIS fallo para '%s': %s", address, e)
    return None


async def _geocode_nominatim(client: httpx.AsyncClient, address: str) -> dict | None:
    osm_addr = _clean_for_osm(address)
    candidates = [f"{osm_addr}, Bogota, Colombia"]
    interseccion = re.sub(r"-\d+\b", "", osm_addr).strip()
    if interseccion and interseccion != osm_addr:
        candidates.append(f"{interseccion}, Bogota, Colombia")

    headers = {"User-Agent": "EnRutaBogota/1.0 (logistica-ultima-milla)"}
    for query in candidates:
        try:
            params = {
                "q": query,
                "format": "jsonv2",
                "countrycodes": "co",
                "viewbox": "-74.2241,4.8372,-73.9975,4.4699",
                "bounded": 1,
                "limit": 1,
            }
            resp = await client.get(NOMINATIM_URL, params=params, headers=headers)
            resp.raise_for_status()
            items = resp.json()
            if items:
                lat = float(items[0]["lat"])
                lng = float(items[0]["lon"])
                if _in_bogota(lat, lng):
                    return {
                        "longitude": lng,
                        "latitude": lat,
                        "confidence": 0.75 if query == candidates[0] else 0.55,
                        "full_match": items[0].get("display_name", ""),
                    }
        except Exception as e:
            logger.warning("[Geocoding] Nominatim fallo para '%s': %s", query, e)
    return None


async def _geocode_photon(client: httpx.AsyncClient, address: str) -> dict | None:
    osm_addr = _clean_for_osm(address)
    try:
        params = {
            "q": f"{osm_addr}, Bogota",
            "lat": 4.6486,
            "lon": -74.0880,
            "limit": 3,
        }
        resp = await client.get(PHOTON_URL, params=params)
        resp.raise_for_status()
        for feat in resp.json().get("features", []):
            lng, lat = feat["geometry"]["coordinates"]
            if _in_bogota(lat, lng):
                return {
                    "longitude": lng,
                    "latitude": lat,
                    "confidence": 0.6,
                    "full_match": feat.get("properties", {}).get("name", ""),
                }
    except Exception as e:
        logger.warning("[Geocoding] Photon fallo para '%s': %s", osm_addr, e)
    return None


async def geocode_address(address: str) -> dict | None:
    """
    Geocodifica una direccion en Bogota D.C. usando Mapbox (si tiene token valido)
    y respaldo automatico gratuito con ArcGIS World Geocoder, Nominatim y Photon.
    """
    async with httpx.AsyncClient(timeout=8.0) as client:
        if _is_valid_mapbox_token(settings.MAPBOX_ACCESS_TOKEN):
            res = await _geocode_mapbox(client, address)
            if res:
                return res

        res = await _geocode_arcgis(client, address)
        if res:
            return res

        res = await _geocode_nominatim(client, address)
        if res:
            return res

        return await _geocode_photon(client, address)
