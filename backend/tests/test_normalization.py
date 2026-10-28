"""
tests/test_normalization.py
Tests unitarios para el modulo de normalizacion de direcciones de Bogota.
Basados en casos reales de guias de envio iMile y J&T Express.
"""
import pytest
from app.utils.normalization import normalize_bogota_address, NormalizedAddress


class TestNormalizacionDireccionesBogota:
    """
    Suite de pruebas con casos reales tomados de las guias de envio.
    """

    # â”€â”€ Caso 1: Guia iMile (formato limpio) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_imile_direccion_completa(self):
        raw = "Calle 166 #9-24 torre 2 interior 3 apartamento 503 LOCALIDAD USAQUEN BOGOTA D.C."
        result = normalize_bogota_address(raw)

        assert result.geocodable_address == "Calle 166 # 9-24"
        assert "Torre 2" in result.complement
        assert "Interior 3" in result.complement
        assert "Apartamento 503" in result.complement
        assert result.locality == "Usaquen"
        assert result.confidence >= 0.8

    # â”€â”€ Caso 2: Guia J&T (complemento duplicado por OCR) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_jt_complemento_duplicado_ocr(self):
        raw = "calle 166 # 9-24 - torre2 int4 apar 1101,torre2inte 4apar 1101"
        result = normalize_bogota_address(raw)

        assert result.geocodable_address == "Calle 166 # 9-24"
        assert "Torre 2" in result.complement
        assert "Interior 4" in result.complement
        assert "Apartamento 1101" in result.complement
        assert result.confidence >= 0.7

    # â”€â”€ Caso 3: Abreviacion de via (Cll, Cra, Kra) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_abreviaciones_tipo_via(self):
        casos = [
            ("Cll 45 # 12-30 apto 201", "Calle"),
            ("Cra 7 # 32-15 of 302", "Carrera"),
            ("Kra 15 # 80-20 casa 3", "Carrera"),
            ("Dg 40 # 25-10 bodega 5", "Diagonal"),
            ("Tv 39 # 87-50", "Transversal"),
        ]
        for raw, expected_via in casos:
            result = normalize_bogota_address(raw)
            assert result.geocodable_address.startswith(expected_via), (
                f"Fallo para '{raw}': esperado '{expected_via}', "
                f"obtenido '{result.geocodable_address}'"
            )

    # â”€â”€ Caso 4: Complementos pegados sin espacio â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_complementos_sin_espacio(self):
        raw = "Carrera 11 #93-20 torre3int2apar405"
        result = normalize_bogota_address(raw)

        assert "Torre 3" in result.complement
        assert "Interior 2" in result.complement
        assert "Apartamento 405" in result.complement

    # â”€â”€ Caso 5: Numero de via con letras â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_numero_via_con_letra(self):
        raw = "Calle 72B # 14A-23 apto 502"
        result = normalize_bogota_address(raw)

        assert "Calle 72B" in result.geocodable_address or "Calle 72" in result.geocodable_address
        assert "Apartamento 502" in result.complement

    # â”€â”€ Caso 6: Separadores variados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_separadores_variados(self):
        variantes = [
            "Calle 100 No. 15-25 apto 101",
            "Calle 100 Nro. 15-25 apto 101",
            "Calle 100 # 15 - 25 apto 101",
        ]
        for raw in variantes:
            result = normalize_bogota_address(raw)
            assert "Calle 100" in result.geocodable_address, f"Fallo para: {raw}"
            assert "15-25" in result.geocodable_address, f"Fallo para: {raw}"

    # â”€â”€ Caso 7: Localidades de Bogota â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_extraccion_localidades(self):
        casos = [
            ("Calle 13 # 50-20 KENNEDY", "Kennedy"),
            ("Carrera 30 # 4-20 SUR BOSA", "Bosa"),
            ("Av. 68 # 37-25 Barrios Unidos", "Barrios Unidos"),
        ]
        for raw, expected_loc in casos:
            result = normalize_bogota_address(raw)
            assert result.locality == expected_loc, f"Fallo para '{raw}'"

    # â”€â”€ Caso 8: Confianza baja si no se reconoce el formato â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_confianza_baja_formato_invalido(self):
        raw = "Conjunto Torres de Aranquez apto 1101"
        result = normalize_bogota_address(raw)
        assert result.confidence < 0.5  # No se pudo extraer la via principal

    # â”€â”€ Caso 9: Resultado con full_normalized â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    def test_full_normalized_incluye_partes(self):
        raw = "Calle 166 #9-24 torre 2 apar 503 USAQUEN"
        result = normalize_bogota_address(raw)

        assert "Calle 166" in result.full_normalized
        assert "Torre 2" in result.full_normalized
        assert "Apartamento 503" in result.full_normalized