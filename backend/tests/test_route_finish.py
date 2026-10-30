import uuid
from datetime import datetime, timezone
from types import SimpleNamespace
import pytest

from app.models.route import Route, RouteStatus
from app.schemas.route import RouteResponse


def test_route_response_schema_finished_at():
    now = datetime.now(timezone.utc)
    route_data = {
        "id": uuid.uuid4(),
        "driver_id": uuid.uuid4(),
        "route_date": now.date(),
        "status": RouteStatus.COMPLETED,
        "total_stops": 5,
        "completed_stops": 5,
        "optimization_metadata": {"finished_at": now.isoformat()},
        "finished_at": now,
        "created_at": now,
        "updated_at": now,
    }
    resp = RouteResponse(**route_data)
    assert resp.status == RouteStatus.COMPLETED
    assert resp.finished_at == now
    assert resp.completed_stops == 5
