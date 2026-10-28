"""
app/utils/normalization.py
=============================================================================
Normalizacion de direcciones de Bogota D.C.

CONTEXTO:
---------
Las guias de envio (iMile, J&T, etc.) llegan con direcciones escritas de
forma inconsistente por operadores humanos. Ejemplos reales observados:

  Guia iMile:  "Calle 166 #9-24 torre 2 interior 3 apartamento 503"
  Guia J&T:    "calle 166 # 9-24 - torre2 int4 apar 1101,torre2inte 4apar 1101"

Los problemas tipicos son:
  - Mezcla de mayusculas/minusculas
  - Abreviaciones no estandar: "Cl", "Cll", "Cra", "Kra", "Krr", "Tv", "Dg"
  - Separadores inconsistentes: "#", "No.", "Nro.", "-", " - ", ","
  - Complementos pegados sin espacio: "torre2int4apar1101"
  - Repeticion del complemento (error de OCR): "torre2 int4 apar 1101,torre2..."
  - Tildes y caracteres especiales variables
  - Numeros y letras pegados: "9-24A" vs "9 - 24 A"
=============================================================================
"""

import re
import unicodedata
from dataclasses import dataclass


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# TIPOS DE VIA - Mapa de normalizacion
# Cubre todas las variantes encontradas en guias reales de Bogota
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

VIA_TYPES: dict[str, str] = {
    # Calle
    r"calle|cll|cl|ca(?=\s*\d)": "Calle",
    # Carrera
    r"carrera|cra|krr|kra|kr(?=\s*\d)": "Carrera",
    # Diagonal
    r"diagonal|diag|dg(?=\s*\d)": "Diagonal",
    # Transversal
    r"transversal|transv|trvs|tv(?=\s*\d)": "Transversal",
    # Avenida
    r"avenida|avda|ave|av(?=\s*[\dA-Z])": "Avenida",
    # Avenida Carrera (NQS, etc.)
    r"avenida\s+carrera|av\s*cra|av\.cra": "Avenida Carrera",
    # Avenida Calle
    r"avenida\s+calle|av\s*cl|av\.cl": "Avenida Calle",
    # Circular
    r"circular|circunvalar|circ": "Circular",
    # Via
    r"\bvia\b": "Via",
}

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# COMPLEMENTOS - Mapa de normalizacion
# Cubre abreviaciones de guias reales: "int4", "apar 1101", "apto", "blq"
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

COMPLEMENT_PATTERNS: list[tuple[str, str]] = [
    # Torre / bloque (con o sin espacio antes del numero)
    (r"\b(torre|tor|twr|bloque|blq|bl|block)\s*(\d+[a-zA-Z]?)\b", r"Torre \2"),
    # Interior (int4, int 4, interior 4)
    (r"\b(interior|int|ints|int\.)\s*(\d+[a-zA-Z]?)\b", r"Interior \2"),
    # Apartamento (apar, apto, apt, ap, dpto, depto)
    (r"\b(apartamento|apar|apto|apt|ap|dpto|depto|dp|piso)\s*(\d+[a-zA-Z]?)\b", r"Apartamento \2"),
    # Casa
    (r"\b(casa|cs)\s*(\d+[a-zA-Z]?)\b", r"Casa \2"),
    # Local
    (r"\b(local|loc|lc)\s*(\d+[a-zA-Z]?)\b", r"Local \2"),
    # Oficina
    (r"\b(oficina|of|ofc)\s*(\d+[a-zA-Z]?)\b", r"Oficina \2"),
    # Bodega
    (r"\b(bodega|bdg)\s*(\d+[a-zA-Z]?)\b", r"Bodega \2"),
    # Conjunto / Urbanizacion
    (r"\b(conjunto|conj|urbanizacion|urb)\s+([a-zA-Z0-9\s]+?)(?=\s+(?:torre|int|ap|apto|bl|piso)|$)", r"Conjunto \2"),
    # Agrupacion de digitos pegados a texto de complemento (ej: "Torre2" -> "Torre 2")
    (r"\b(torre|int|apar|apto|bloque|bl|ap|piso)(\d)", r"\1 \2"),
]

# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# LOCALIDADES de Bogota para referencia / extraccion
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

BOGOTA_LOCALITIES = {
    "usaquen", "chapinero", "santa fe", "san cristobal", "usme", "tunjuelito",
    "bosa", "kennedy", "fontibon", "engativa", "suba", "barrios unidos",
    "teusaquillo", "martires", "antonio narino", "puente aranda",
    "candelaria", "rafael uribe", "ciudad bolivar", "sumapaz",
}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# DATACLASS - Resultado estructurado de la normalizacion
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

@dataclass
class NormalizedAddress:
    """
    Resultado de normalizar una direccion de Bogota.

    Attributes:
        geocodable_address: Direccion limpia apta para enviar a Mapbox.
            Ej: "Calle 166 # 9-24"
        complement: Complemento separado (torre, interior, apto).
            Ej: "Torre 2 Interior 4 Apartamento 1101"
        locality: Localidad detectada (si existe en el texto).
        full_normalized: Direccion completa normalizada (geo + complement).
        original: Texto original antes de normalizar.
        confidence: Nivel de confianza en la normalizacion (0.0 - 1.0).
            0.8+ = calle/carrera detectadas correctamente
            0.5+ = tipo de via detectado pero numero dudoso
            0.2  = no se pudo normalizar de forma confiable
    """
    geocodable_address: str
    complement: str
    locality: str
    full_normalized: str
    original: str
    confidence: float


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# FUNCIONES AUXILIARES
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _remove_accents(text: str) -> str:
    """Elimina tildes y diacriticos. Ej: 'BogotÃ¡' -> 'Bogota'."""
    nfkd = unicodedata.normalize("NFD", text)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def _clean_noise(text: str) -> str:
    """
    Limpia ruido tipico de OCR y digitacion manual en guias de envio.
    - Elimina 'BOGOTA D.C.', 'COL', 'COLOMBIA' al final
    - Elimina 'LOCALIDAD ...' redundante para dejar la direccion limpia
    - Colapsa multiples espacios
    - Normaliza separadores de numero de via
    """
    # Lowercase para procesamiento
    t = text.strip().lower()

    # Eliminar sufijos geograficos comunes en guias
    t = re.sub(r",?\s*bogot[aÃ¡]\.?\s*d\.?\s*c\.?", "", t, flags=re.IGNORECASE)
    t = re.sub(r",?\s*\bcol\b", "", t, flags=re.IGNORECASE)
    t = re.sub(r",?\s*colombia", "", t, flags=re.IGNORECASE)

    # Eliminar repeticiones del complemento causadas por OCR
    # Ej: "torre2 int4 apar 1101,torre2 int4 apar 1101"
    # Estrategia: si hay coma seguida de texto similar, eliminar la segunda parte
    t = _remove_duplicate_complement(t)

    # Normalizar separador de numero de via: "# 9 - 24" -> "#9-24"
    t = re.sub(r"#\s*(\d+)\s*[-â€“]\s*(\d+)", r"#\1-\2", t)
    t = re.sub(r"no\.?\s*(\d+)\s*[-â€“]\s*(\d+)", r"#\1-\2", t, flags=re.IGNORECASE)
    t = re.sub(r"nro\.?\s*(\d+)\s*[-â€“]\s*(\d+)", r"#\1-\2", t, flags=re.IGNORECASE)

    # Separar numero de complemento cuando estan pegados: "torre2" -> "torre 2 "
    t = re.sub(r"(torre|int|bloque|bl|apar|apto|apt|ap|piso|local|oficina)(\d+)", r"\1 \2 ", t, flags=re.IGNORECASE)

    # Colapsar espacios multiples
    t = re.sub(r"\s+", " ", t).strip()

    return t


def _remove_duplicate_complement(text: str) -> str:
    """
    Elimina complementos duplicados por error de OCR o digitacion.
    Caso real: "calle 166 # 9-24 - torre2 int4 apar 1101,torre2 int4 apar 1101"
    Resultado: "calle 166 # 9-24 - torre2 int4 apar 1101"
    """
    if "," in text:
        parts = text.split(",", 1)
        first, second = parts[0], parts[1]
        comp_keywords = ["torre", "int", "apar", "apto", "bloque", "bl", "casa", "local", "oficina"]
        if any(kw in first.lower() for kw in comp_keywords) and any(kw in second.lower() for kw in comp_keywords):
            return first
    return text


def _extract_locality(text: str) -> str:
    """Extrae la localidad de Bogota si esta presente en el texto."""
    lower = text.lower()
    # Caso: "LOCALIDAD USAQUEN" o "localidad de usaquen"
    m = re.search(r"localidad\s+(?:de\s+)?([a-z\s]+?)(?:\s|,|$)", lower)
    if m:
        candidate = m.group(1).strip()
        for loc in BOGOTA_LOCALITIES:
            if loc in candidate:
                return loc.title()

    # Busqueda directa de localidades conocidas
    for loc in BOGOTA_LOCALITIES:
        if loc in lower:
            return loc.title()

    return ""


def _normalize_via_type(text: str) -> str:
    """Reemplaza abreviaciones de tipo de via por su forma estandar."""
    for pattern, replacement in VIA_TYPES.items():
        text = re.sub(r"\b" + pattern + r"\b", replacement, text, flags=re.IGNORECASE, count=1)
    return text


def _normalize_complements(text: str) -> str:
    """Estandariza complementos de direccion (torre, interior, apto, etc.)."""
    for pattern, replacement in COMPLEMENT_PATTERNS:
        text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
    return text


def _split_geocodable_and_complement(text: str) -> tuple[str, str]:
    """
    Separa la direccion geocodificable del complemento.

    La direccion geocodificable es: <TipoVia> <NumeroVia> # <Numero>-<Numero>
    El complemento es todo lo demas: Torre, Interior, Apartamento, etc.

    Returns:
        (geocodable_address, complement)
    """
    # Patron de direccion base de Bogota: TipoVia Numero # Numero-Numero [letra opcional]
    via_match = re.match(
        r"^((?:Calle|Carrera|Diagonal|Transversal|Avenida|Via|Circular)"
        r"(?:\s+(?:Carrera|Calle))?)"      # Tipo de via (incluye "Avenida Carrera")
        r"\s+(\d+[a-zA-Z]?)"              # Numero de via
        r"\s*#\s*"                         # Separador #
        r"(\d+[a-zA-Z]?-\d+[a-zA-Z]?)"   # Numero de puerta
        r"(.*?)$",                          # Complemento
        text.strip(),
        flags=re.IGNORECASE,
    )

    if via_match:
        via_type = via_match.group(1).strip()
        via_num = via_match.group(2).strip()
        door_num = via_match.group(3).strip()
        remainder = via_match.group(4).strip()

        # Limpiar separadores del complemento (guiones, comas iniciales)
        remainder = re.sub(r"^[\s,\-]+", "", remainder).strip()

        geocodable = f"{via_type} {via_num} # {door_num}"
        return geocodable, remainder

    # Si no coincide el patron completo, devolver todo como geocodable
    return text.strip(), ""


def _calculate_confidence(geocodable: str, complement: str, original: str) -> float:
    """
    Calcula el nivel de confianza en la normalizacion.

    Criterios:
    - Se detecto tipo de via estandar (Calle/Carrera/etc.): +0.4
    - Se detecto patron completo Via # Numero: +0.3
    - Se detecto complemento de direccion: +0.1
    - Longitud razonable del resultado: +0.2
    """
    score = 0.0

    # Tipo de via reconocido
    via_types = ["Calle", "Carrera", "Diagonal", "Transversal", "Avenida", "Via", "Circular"]
    if any(geocodable.startswith(vt) for vt in via_types):
        score += 0.4

    # Patron de numero de via completo
    if re.search(r"#\s*\d+[a-zA-Z]?-\d+", geocodable):
        score += 0.3

    # Complemento detectado
    if complement and any(kw in complement for kw in ["Torre", "Interior", "Apartamento", "Casa", "Local"]):
        score += 0.1

    # Longitud razonable (ni muy corta ni igual al original sin procesar)
    if 10 <= len(geocodable) <= 60 and geocodable.lower() != original.lower():
        score += 0.2

    return min(score, 1.0)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# FUNCION PRINCIPAL PUBLICA
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def normalize_bogota_address(raw_address: str) -> NormalizedAddress:
    """
    Normaliza una direccion de Bogota proveniente de una guia de envio.

    El proceso de normalizacion sigue estos pasos:
    1. Eliminar tildes para procesamiento uniforme
    2. Limpiar ruido (sufijos geograficos, duplicados por OCR)
    3. Normalizar tipo de via (Cll -> Calle, Kra -> Carrera, etc.)
    4. Normalizar complementos (torre2int4 -> Torre 2 Interior 4)
    5. Separar direccion geocodificable del complemento
    6. Extraer localidad
    7. Calcular confianza

    Ejemplos reales de guias:
    >>> normalize_bogota_address("Calle 166 #9-24 torre 2 interior 3 apartamento 503")
    NormalizedAddress(geocodable_address='Calle 166 # 9-24', complement='Torre 2 Interior 3 Apartamento 503', ...)

    >>> normalize_bogota_address("calle 166 # 9-24 - torre2 int4 apar 1101,torre2inte 4apar 1101")
    NormalizedAddress(geocodable_address='Calle 166 # 9-24', complement='Torre 2 Interior 4 Apartamento 1101', ...)

    Args:
        raw_address: Direccion tal como viene de OCR o digitacion manual.

    Returns:
        NormalizedAddress con todos los campos procesados.
    """
    original = raw_address.strip()

    # Paso 1: Eliminar tildes
    text = _remove_accents(original)

    # Paso 2: Limpiar ruido general
    text = _clean_noise(text)

    # Paso 3: Normalizar tipo de via
    text = _normalize_via_type(text)

    # Paso 4: Normalizar complementos
    text = _normalize_complements(text)

    # Paso 5: Separar direccion geocodificable del complemento
    geocodable, complement = _split_geocodable_and_complement(text)

    # Paso 6: Extraer localidad (del texto original para mayor precision)
    locality = _extract_locality(original)

    # Paso 7: Calcular confianza
    confidence = _calculate_confidence(geocodable, complement, original)

    # Direccion completa normalizada
    parts = [geocodable]
    if complement:
        parts.append(complement)
    if locality:
        parts.append(locality)
    full_normalized = ", ".join(parts)

    return NormalizedAddress(
        geocodable_address=geocodable,
        complement=complement,
        locality=locality,
        full_normalized=full_normalized,
        original=original,
        confidence=confidence,
    )


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# FUNCION DE CONVENIENCIA - Para uso desde endpoints
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def normalize_address_for_geocoding(raw_address: str) -> dict:
    """
    Wrapper conveniente que retorna un dict listo para usar en la API.
    Incluye tanto la direccion geocodificable como el complemento separado.
    """
    result = normalize_bogota_address(raw_address)
    return {
        "geocodable_address": result.geocodable_address,
        "complement": result.complement,
        "locality": result.locality,
        "full_normalized": result.full_normalized,
        "confidence": result.confidence,
    }