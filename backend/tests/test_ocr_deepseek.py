"""
Pruebas unitarias del endpoint OCR con DeepSeek Vision.
"""
import io
import sys
from pathlib import Path
from unittest.mock import AsyncMock, patch

from fastapi.testclient import TestClient

# Asegurar que backend/ este en sys.path
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.api.v1.endpoints.ocr import _parse_json_payload  # noqa: E402
from app.main import app  # noqa: E402


def test_parse_json_payload_handles_markdown_fences():
    raw = '```json\n{"tracking_number": "GUIA123", "raw_address": "Cll 45 # 12-30"}\n```'
    parsed = _parse_json_payload(raw)
    assert parsed["tracking_number"] == "GUIA123"
    assert parsed["raw_address"] == "Cll 45 # 12-30"


def test_ocr_process_guide_deepseek_success():
    mocked_deepseek_result = {
        "tracking_number": "ENV998877",
        "recipient_name": "Carlos Perez",
        "recipient_phone": "3001234567",
        "raw_address": "Kra 7 # 32-16 Torre 2 Apto 501",
        "package_weight_kg": 1.5,
        "raw_text": "Servientrega ENV998877 Carlos Perez Kra 7 # 32-16",
        "confidence": 0.96,
    }

    with (
        patch("app.api.v1.endpoints.ocr.settings.DEEPSEEK_API_KEY", "sk-test-key"),
        patch("app.api.v1.endpoints.ocr.settings.MAPBOX_ACCESS_TOKEN", ""),
        patch(
            "app.api.v1.endpoints.ocr._extract_guide_with_deepseek",
            new=AsyncMock(return_value=mocked_deepseek_result),
        ),
    ):
        client = TestClient(app)
        fake_img = io.BytesIO(b"\xff\xd8\xff\xe0fake-jpeg-bytes")
        resp = client.post(
            "/api/v1/ocr/process-guide",
            files={"file": ("guia.jpg", fake_img, "image/jpeg")},
        )

    assert resp.status_code == 200
    body = resp.json()
    assert body["tracking_number"] == "ENV998877"
    assert body["recipient_name"] == "Carlos Perez"
    assert body["confidence"] == 0.96
    assert body["normalized_address"] is not None


def test_ocr_process_guide_rejects_invalid_mime():
    client = TestClient(app)
    fake_txt = io.BytesIO(b"no es imagen")
    resp = client.post(
        "/api/v1/ocr/process-guide",
        files={"file": ("guia.txt", fake_txt, "text/plain")},
    )
    assert resp.status_code == 415
