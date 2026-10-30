import uuid
from types import SimpleNamespace
import pytest

from app.schemas.stop import StopStatusUpdate, StopStatus, StopUpdate
from app.schemas.route import RouteOptimizeRequest
from app.services.routing import optimize_route


def test_stop_status_update_accepts_uppercase_pending():
    payload = StopStatusUpdate(status="PENDING")
    assert payload.status == StopStatus.pending


def test_stop_update_explicit_unpin():
    payload = StopUpdate(is_pinned=False)
    dumped = payload.model_dump(exclude_unset=True)
    assert dumped == {"is_pinned": False}


def test_route_optimize_request_with_start_and_end_location():
    req = RouteOptimizeRequest(
        start_location={"lat": 4.75, "lng": -74.05},
        end_location={"lat": 4.60, "lng": -74.08},
    )
    assert req.start_location.resolved_lat == 4.75
    assert req.start_location.resolved_lng == -74.05
    assert req.end_location.resolved_lat == 4.60
    assert req.end_location.resolved_lng == -74.08


@pytest.mark.asyncio
async def test_optimize_route_respects_pinned_stops():
    s1 = SimpleNamespace(
        id=uuid.uuid4(),
        lat=4.743,
        lng=-74.025,
        sequence_order=1,
        is_pinned=False,
    )
    s2_pinned_at_2 = SimpleNamespace(
        id=uuid.uuid4(),
        lat=4.610,
        lng=-74.080,
        sequence_order=2,
        is_pinned=True,
    )
    s3 = SimpleNamespace(
        id=uuid.uuid4(),
        lat=4.721,
        lng=-74.032,
        sequence_order=3,
        is_pinned=False,
    )

    result = await optimize_route(
        stops=[s1, s2_pinned_at_2, s3],
        origin_lat=4.735,
        origin_lng=-74.030,
        max_solve_seconds=5,
    )

    assert len(result.optimized_stop_ids) == 3
    # La parada fijada en sequence_order=2 (indice 1) debe permanecer en el indice 1
    assert result.optimized_stop_ids[1] == s2_pinned_at_2.id


@pytest.mark.asyncio
async def test_optimize_route_interleaves_between_pinned_anchors_and_end_location():
    # Corredor Norte (4.75) -> Sur (4.60) en Bogota
    s_south_free = SimpleNamespace(
        id=uuid.uuid4(), lat=4.62, lng=-74.05, sequence_order=1, is_pinned=False
    )
    s_anchor_pos2 = SimpleNamespace(
        id=uuid.uuid4(), lat=4.70, lng=-74.05, sequence_order=2, is_pinned=True
    )
    s_north_free = SimpleNamespace(
        id=uuid.uuid4(), lat=4.73, lng=-74.05, sequence_order=3, is_pinned=False
    )
    s_anchor_pos4 = SimpleNamespace(
        id=uuid.uuid4(), lat=4.65, lng=-74.05, sequence_order=4, is_pinned=True
    )
    s_mid_free = SimpleNamespace(
        id=uuid.uuid4(), lat=4.68, lng=-74.05, sequence_order=5, is_pinned=False
    )

    result = await optimize_route(
        stops=[s_south_free, s_anchor_pos2, s_north_free, s_anchor_pos4, s_mid_free],
        origin_lat=4.75,
        origin_lng=-74.05,
        end_lat=4.60,
        end_lng=-74.05,
        max_solve_seconds=5,
    )

    assert len(result.optimized_stop_ids) == 5
    # Orden optimo de Norte (4.75) a Sur (4.60) respetando pos 2 (4.70) y pos 4 (4.65):
    # [s_north_free (4.73), s_anchor_pos2 (4.70), s_mid_free (4.68), s_anchor_pos4 (4.65), s_south_free (4.62)]
    assert result.optimized_stop_ids == [
        s_north_free.id,
        s_anchor_pos2.id,
        s_mid_free.id,
        s_anchor_pos4.id,
        s_south_free.id,
    ]
    assert result.metadata["has_end_location"] is True
