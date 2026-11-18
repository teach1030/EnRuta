"""
Suite automatizada de pruebas QA de dominio logístico EnRuta, validación HTTP 422,
optimalidad de Pareto 3D y paridad matemática Python ↔ TypeScript.

Cubre exhaustivamente los casos de prueba exigidos para la Actividad 9 (Ingeniería Aplicada,
Universidad Libre):
  - Catálogo REST (`/api/v1/health`, `/api/v1/architectures`, `/api/v1/scenarios`).
  - CP-01 (`REF_MVP_BOGOTA`): Operación actual MVP en Bogotá D.C.
  - CP-02 (`PEAK_MORNING_OCR`): Ráfaga matutina 6:30 AM de escaneo masivo OCR de guías.
  - CP-03 (`HEAVY_TSP_ROUTES`): Rutas densas multi-cliente con solver OR-Tools Haversine.
  - CP-04 (`NATIONAL_SCALE_SLA`): Escala nacional (U=850 y estrés extremo U=2500, SLA>=99.8%).
  - CP-05 (`OVERSCALING_SIMPLE_SWIPE`): Fenómeno de sobre-escalado horizontal (Blinowski 2022).
  - CP-06 (Requisito 10): Bloqueo HTTP 422 de entradas inválidas y pesos nulos.
  - CP-07 (`PILOT_CHAPINERO_LOW_LATENCY`): Piloto hiperlocal con latencia ultra-baja in-process.
  - CP-08: Determinismo estricto, Frontera de Pareto 3D, `formula_breakdown` y aviso Req. 12.
  - CP-09: Paridad matemática entre el motor Python (`app.engine`) y el motor espejo
           TypeScript (`localFallbackEngine.ts`) / contrato analítico canónico.
"""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.engine import (
    ARCHITECTURE_ORDER,
    ARCHITECTURES,
    SCENARIO_ORDER,
    DecisionWeights,
    ProjectConfig,
    SimulationInput,
    evaluate_all_architectures,
    evaluate_architecture,
    is_dominated_by,
    run_full_simulation,
    run_instance_sweep,
    run_scenario,
)
from app.main import app


@pytest.fixture(scope="module")
def api_client() -> TestClient:
    """Cliente de pruebas síncrono sobre la aplicación FastAPI completa."""
    return TestClient(app)


def _index_by_id(items: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Indexa una lista de diccionarios de métricas por su campo `id`."""
    return {item["id"]: item for item in items}


# =============================================================================
# 0. Salud del servicio y contratos de catálogo REST (`/api/v1`)
# =============================================================================


def test_api_health_and_catalogs_contract(api_client: TestClient) -> None:
    """Verifica endpoints base de salud, catálogo de 4 arquitecturas y 6 escenarios."""
    root_resp = api_client.get("/")
    assert root_resp.status_code == 200
    assert root_resp.json()["service"] == "enruta-architecture-simulator"

    health_resp = api_client.get("/api/v1/health")
    assert health_resp.status_code == 200
    health_data = health_resp.json()
    assert health_data["status"] == "ok"
    assert health_data["service"] == "enruta-architecture-simulator"

    arch_resp = api_client.get("/api/v1/architectures")
    assert arch_resp.status_code == 200
    architectures = arch_resp.json()
    assert [a["id"] for a in architectures] == ARCHITECTURE_ORDER
    for arch in architectures:
        assert len(arch["enruta_mapping"]) > 40
        assert len(arch["paper_references"]) >= 4
        assert len(arch["sample_compose_snippet"]) > 30

    scen_resp = api_client.get("/api/v1/scenarios")
    assert scen_resp.status_code == 200
    scenarios = scen_resp.json()
    assert [s["id"] for s in scenarios] == SCENARIO_ORDER
    ref_scenarios = [s for s in scenarios if s["is_reference"] is True]
    assert len(ref_scenarios) == 1
    assert ref_scenarios[0]["id"] == "REF_MVP_BOGOTA"

    not_found_resp = api_client.post("/api/v1/scenarios/ESCENARIO_INEXISTENTE/run")
    assert not_found_resp.status_code == 404


# =============================================================================
# CP-01: Operación Actual MVP Bogotá (`REF_MVP_BOGOTA`)
# =============================================================================


def test_cp01_ref_mvp_bogota_budget_filtering_and_lightweight_victory(
    api_client: TestClient,
) -> None:
    """
    CP-01 (`REF_MVP_BOGOTA`): Operación actual de EnRuta en Bogotá D.C.
    (`U=35, G=30, N_p=30, I=1, B_max=25, equipo=3`).

    Verifica que `MICRO_DOCKER` ($48.83 USD/mes) y `MONO_ASYNC_CONTAINER` ($30.82 USD/mes)
    violan el tope presupuestal de $25 USD/mes, mientras `HYBRID_EDGE_SERVERLESS` ($4.59 USD)
    y `MONO_MVP` ($18.82 USD, latencia mínima de 100.80 ms) cumplen el 100% de las
    restricciones y superan en puntaje a microservicios (Al-Debagy 2018; Blinowski 2022).
    """
    resp = api_client.post("/api/v1/scenarios/REF_MVP_BOGOTA/run")
    assert resp.status_code == 200
    sim = resp.json()["simulation"]

    assert sim["sim_input"] == {
        "concurrent_drivers": 35,
        "ocr_guides_per_driver": 30,
        "stops_per_route": 30,
        "compute_instances": 1,
        "crud_ops_per_min": 6.0,
    }
    assert sim["project_config"]["max_budget_usd"] == 25.0
    assert sim["project_config"]["team_size"] == 3

    by_id = _index_by_id(sim["architectures"])
    micro = by_id["MICRO_DOCKER"]
    mono_async = by_id["MONO_ASYNC_CONTAINER"]
    hybrid = by_id["HYBRID_EDGE_SERVERLESS"]
    mono_mvp = by_id["MONO_MVP"]

    # Microservicios y Monolito+Workers exceden el presupuesto semilla de $25 USD/mes
    assert micro["monthly_cost_usd"] == pytest.approx(48.83, abs=0.02)
    assert micro["monthly_cost_usd"] > 25.0
    assert micro["meets_budget"] is False
    assert micro["meets_all_constraints"] is False
    assert micro["total_penalty"] > 30.0

    assert mono_async["monthly_cost_usd"] == pytest.approx(30.82, abs=0.02)
    assert mono_async["meets_budget"] is False
    assert mono_async["meets_all_constraints"] is False

    # Arquitecturas ligeras cumplen todas las restricciones duras y lideran el ranking
    assert hybrid["meets_all_constraints"] is True
    assert mono_mvp["meets_all_constraints"] is True
    assert hybrid["monthly_cost_usd"] == pytest.approx(4.59, abs=0.02)
    assert mono_mvp["monthly_cost_usd"] == pytest.approx(18.82, abs=0.02)
    assert mono_mvp["latency_ms"] < micro["latency_ms"]

    assert hybrid["final_score"] > micro["final_score"]
    assert mono_mvp["final_score"] > micro["final_score"]
    assert sim["recommendation"]["winner_id"] == "HYBRID_EDGE_SERVERLESS"
    assert [r["id"] for r in sim["ranking"][:2]] == [
        "HYBRID_EDGE_SERVERLESS",
        "MONO_MVP",
    ]


# =============================================================================
# CP-02: Ráfaga Matutina 6:30 AM de Escaneo OCR (`PEAK_MORNING_OCR`)
# =============================================================================


def test_cp02_peak_morning_ocr_edge_mlkit_bandwidth_and_cost_savings(
    api_client: TestClient,
) -> None:
    """
    CP-02 (`PEAK_MORNING_OCR`): Ráfaga matutina 6:30 AM de escaneo masivo de guías físicas
    (Servientrega, Coordinadora, Interrapidísimo, J&T Express, iMile).

    Verifica tanto en el escenario preconfigurado (`U=85, G=70`) como en ráfaga intensa
    (`U=220, G=75, N_p=45, I=2, B_max=120`) que `HYBRID_EDGE_SERVERLESS` procesa el 85%
    del OCR en el teléfono (`theta_cloud_ocr=0.15`, `ocr_api_unit_cost=0.0`), reduciendo
    drásticamente `lambda_ocr_cloud`, latencia y facturación mensual hasta ganar el escenario.
    """
    assert ARCHITECTURES["HYBRID_EDGE_SERVERLESS"].theta_cloud_ocr == 0.15
    assert ARCHITECTURES["HYBRID_EDGE_SERVERLESS"].ocr_api_unit_cost == 0.0

    # 1. Verificación vía API sobre el preset oficial PEAK_MORNING_OCR
    resp = api_client.post("/api/v1/scenarios/PEAK_MORNING_OCR/run")
    assert resp.status_code == 200
    sim_preset = resp.json()["simulation"]
    by_id_preset = _index_by_id(sim_preset["architectures"])

    hybrid_p = by_id_preset["HYBRID_EDGE_SERVERLESS"]
    mono_p = by_id_preset["MONO_MVP"]
    micro_p = by_id_preset["MICRO_DOCKER"]

    # Descarga del 85% del tráfico OCR hacia Google ML Kit en el dispositivo móvil
    assert hybrid_p["formula_breakdown"]["lambda_ocr_cloud"] == pytest.approx(
        hybrid_p["formula_breakdown"]["lambda_ocr_raw"] * 0.15, abs=1e-3
    )
    assert mono_p["formula_breakdown"]["lambda_ocr_cloud"] == pytest.approx(
        mono_p["formula_breakdown"]["lambda_ocr_raw"], abs=1e-3
    )
    assert hybrid_p["formula_breakdown"]["backend_req_s"] < (
        mono_p["formula_breakdown"]["backend_req_s"] * 0.65
    )
    assert hybrid_p["formula_breakdown"]["demand_units"] < (
        mono_p["formula_breakdown"]["demand_units"] * 0.35
    )

    assert hybrid_p["monthly_cost_usd"] == pytest.approx(18.77, abs=0.02)
    assert hybrid_p["monthly_cost_usd"] < mono_p["monthly_cost_usd"]
    assert hybrid_p["monthly_cost_usd"] < micro_p["monthly_cost_usd"]
    assert hybrid_p["latency_ms"] < micro_p["latency_ms"]
    assert hybrid_p["meets_all_constraints"] is True
    assert sim_preset["recommendation"]["winner_id"] == "HYBRID_EDGE_SERVERLESS"

    # 2. Verificación adicional bajo lote masivo U=220, G=75 (429,000 guías/mes)
    sim_burst = run_full_simulation(
        SimulationInput(
            concurrent_drivers=220,
            ocr_guides_per_driver=75,
            stops_per_route=45,
            compute_instances=2,
            crud_ops_per_min=4.0,
        ),
        ProjectConfig(
            expected_users=220,
            max_budget_usd=120.0,
            max_latency_ms=450.0,
            min_availability_pct=99.4,
            team_size=3,
        ),
    )
    burst_by_id = _index_by_id(sim_burst["architectures"])
    assert sim_burst["recommendation"]["winner_id"] == "HYBRID_EDGE_SERVERLESS"
    assert (
        burst_by_id["HYBRID_EDGE_SERVERLESS"]["monthly_cost_usd"]
        < burst_by_id["MICRO_DOCKER"]["monthly_cost_usd"]
    )


# =============================================================================
# CP-03: Estrés Combinatorio TSP OR-Tools (`HEAVY_TSP_ROUTES`)
# =============================================================================


def test_cp03_heavy_tsp_routes_superlinear_demand_and_worker_decoupling(
    api_client: TestClient,
) -> None:
    """
    CP-03 (`HEAVY_TSP_ROUTES`): Rutas urbanas densas multi-cliente con solver `OR-Tools`
    y matriz Haversine `O(N_p^2)` (`phi_tsp = (N_p / 30)^1.85`).

    Verifica el crecimiento superlineal de `phi_tsp`, la amplificación de demanda CPU en
    `MONO_MVP` (`c_tsp = 26.0`) frente a `MONO_ASYNC_CONTAINER` (`c_tsp = 11.5`) y
    `MICRO_DOCKER` (`c_tsp = 7.2`), la victoria de `MONO_ASYNC_CONTAINER` en presupuesto PyME
    (`HEAVY_TSP_ROUTES`) y la saturación del monolito bajo concurrencia alta (`U=450, N_p=105`).
    """
    # 1. Comparación directa N_p = 30 vs N_p = 115 en el motor matemático
    base_30 = evaluate_architecture(
        ARCHITECTURES["MONO_MVP"],
        SimulationInput(concurrent_drivers=95, ocr_guides_per_driver=35, stops_per_route=30, compute_instances=2),
    )
    heavy_115 = evaluate_architecture(
        ARCHITECTURES["MONO_MVP"],
        SimulationInput(concurrent_drivers=95, ocr_guides_per_driver=35, stops_per_route=115, compute_instances=2),
    )
    assert base_30.formula_breakdown["phi_tsp"] == pytest.approx(1.0, abs=1e-3)
    assert heavy_115.formula_breakdown["phi_tsp"] == pytest.approx(
        (115.0 / 30.0) ** 1.85, abs=1e-3
    )
    # N_p se multiplica x3.83, pero phi_tsp crece superlinealmente a ~12.02x
    assert heavy_115.formula_breakdown["phi_tsp"] > 12.0

    # 2. Ejecución vía REST del escenario preconfigurado HEAVY_TSP_ROUTES
    resp = api_client.post("/api/v1/scenarios/HEAVY_TSP_ROUTES/run")
    assert resp.status_code == 200
    sim_preset = resp.json()["simulation"]
    by_id = _index_by_id(sim_preset["architectures"])

    assert (
        by_id["MONO_MVP"]["formula_breakdown"]["demand_units"]
        > by_id["MONO_ASYNC_CONTAINER"]["formula_breakdown"]["demand_units"]
        > by_id["MICRO_DOCKER"]["formula_breakdown"]["demand_units"]
    )
    assert by_id["MONO_MVP"]["utilization_pct"] > by_id["MONO_ASYNC_CONTAINER"]["utilization_pct"]
    assert by_id["MONO_MVP"]["utilization_pct"] > by_id["MICRO_DOCKER"]["utilization_pct"]
    # Serverless sufre penalización de cold-start en rutas > 80 paradas (N_p = 115)
    assert by_id["HYBRID_EDGE_SERVERLESS"]["formula_breakdown"]["cold_start_ms"] > 490.0
    assert sim_preset["recommendation"]["winner_id"] == "MONO_ASYNC_CONTAINER"

    # 3. Escalamiento pesado TSP (U=450, N_p=105, I=4, B_max=300, A_min=99.5): colapso de MONO_MVP
    sim_stress = run_full_simulation(
        SimulationInput(
            concurrent_drivers=450,
            ocr_guides_per_driver=35,
            stops_per_route=105,
            compute_instances=4,
            crud_ops_per_min=6.0,
        ),
        ProjectConfig(
            expected_users=450,
            max_budget_usd=300.0,
            max_latency_ms=800.0,
            min_availability_pct=99.5,
            team_size=5,
        ),
    )
    stress_by_id = _index_by_id(sim_stress["architectures"])
    assert stress_by_id["MONO_MVP"]["utilization"] > 0.88
    assert (
        stress_by_id["MONO_MVP"]["utilization"]
        > stress_by_id["MICRO_DOCKER"]["utilization"] * 6.0
    )
    assert stress_by_id["MONO_MVP"]["latency_ms"] > 700.0
    assert stress_by_id["MONO_MVP"]["meets_availability"] is False
    assert stress_by_id["MONO_MVP"]["meets_all_constraints"] is False
    assert stress_by_id["MONO_MVP"]["final_score"] < 25.0
    assert (
        stress_by_id["MICRO_DOCKER"]["final_score"]
        > stress_by_id["MONO_MVP"]["final_score"] + 70.0
    )
    assert stress_by_id["MICRO_DOCKER"]["meets_all_constraints"] is True
    assert sim_stress["recommendation"]["winner_id"] == "MICRO_DOCKER"


# =============================================================================
# CP-04: Escala Nacional y SLA Crítico (`NATIONAL_SCALE_SLA` y `U=2500`)
# =============================================================================


def test_cp04_national_scale_sla_exclusive_microservices_compliance(
    api_client: TestClient,
) -> None:
    """
    CP-04 (`NATIONAL_SCALE_SLA`): Escala nacional multi-ciudad en Colombia.

    1) Verifica el preset `NATIONAL_SCALE_SLA` (`U=850, SLA=99.9%, I=6`) donde `MICRO_DOCKER`
       gana con 99.09/100 y `MONO_MVP` colapsa al 130.25% de utilización.
    2) Verifica bajo carga nacional extrema (`U=2500`, `SLA >= 99.8%`, `I=6`, `N_p=85`,
       `F_crud=13.5`) que **únicamente `MICRO_DOCKER`** cumple de forma simultánea el SLA
       `>= 99.8%` y la capacidad operativa (`utilization <= 1.05`).
    """
    # Parte A: Escenario preconfigurado oficial vía API
    resp = api_client.post("/api/v1/scenarios/NATIONAL_SCALE_SLA/run")
    assert resp.status_code == 200
    sim_nat = resp.json()["simulation"]
    nat_by_id = _index_by_id(sim_nat["architectures"])

    assert sim_nat["recommendation"]["winner_id"] == "MICRO_DOCKER"
    assert nat_by_id["MICRO_DOCKER"]["meets_all_constraints"] is True
    assert nat_by_id["MONO_MVP"]["utilization_pct"] > 125.0
    assert nat_by_id["MONO_MVP"]["error_rate_pct"] > 25.0

    # Parte B: Carga masiva nacional U=2500, SLA >= 99.8%, I=6 vía POST /api/v1/simulate
    extreme_payload = {
        "sim_input": {
            "concurrent_drivers": 2500,
            "ocr_guides_per_driver": 50,
            "stops_per_route": 85,
            "compute_instances": 6,
            "crud_ops_per_min": 13.5,
        },
        "project_config": {
            "expected_users": 2500,
            "max_budget_usd": 1200.0,
            "max_latency_ms": 1500.0,
            "min_availability_pct": 99.8,
            "team_size": 8,
            "require_encryption": True,
        },
    }
    ext_resp = api_client.post("/api/v1/simulate", json=extreme_payload)
    assert ext_resp.status_code == 200
    ext_sim = ext_resp.json()

    compliant_both = [
        arch["id"]
        for arch in ext_sim["architectures"]
        if arch["meets_availability"] and arch["meets_capacity"]
    ]
    assert compliant_both == ["MICRO_DOCKER"]
    assert ext_sim["recommendation"]["winner_id"] == "MICRO_DOCKER"

    ext_by_id = _index_by_id(ext_sim["architectures"])
    assert ext_by_id["MICRO_DOCKER"]["availability_pct"] >= 99.8
    assert ext_by_id["MICRO_DOCKER"]["utilization"] <= 1.05
    assert ext_by_id["MICRO_DOCKER"]["meets_all_constraints"] is True


# =============================================================================
# CP-05: Sobre-Escalado Horizontal (`OVERSCALING_SIMPLE_SWIPE` - Blinowski 2022)
# =============================================================================


def test_cp05_overscaling_simple_swipe_blinowski_degradation_and_pareto_dominance(
    api_client: TestClient,
) -> None:
    """
    CP-05 (`OVERSCALING_SIMPLE_SWIPE`): Fenómeno de sobre-escalado horizontal reportado por
    Blinowski, Ojdowska & Przybyłek (2022).

    Verifica que en consultas simples de swipe en portería (`U=45, G=5, N_p=20, F_crud=14.0`),
    pasar de `I=3` a `I=16` instancias dispara el costo mensual, degrada `over_scale_factor`
    (`I > 6`), incrementa la latencia por coordinación IPC y vuelve la configuración sobre-escalada
    estrictamente Pareto-dominada.
    """
    # 1. Comparación directa I=3 vs I=16 sobre la misma carga ligera de swipes CRUD
    cfg = ProjectConfig(
        expected_users=45,
        max_budget_usd=210.0,
        max_latency_ms=160.0,
        min_availability_pct=99.0,
        team_size=2,
    )
    input_i3 = SimulationInput(
        concurrent_drivers=45,
        ocr_guides_per_driver=5,
        stops_per_route=20,
        compute_instances=3,
        crud_ops_per_min=14.0,
    )
    input_i16 = SimulationInput(
        concurrent_drivers=45,
        ocr_guides_per_driver=5,
        stops_per_route=20,
        compute_instances=16,
        crud_ops_per_min=14.0,
    )

    sim_i3 = run_full_simulation(input_i3, cfg)
    sim_i16 = run_full_simulation(input_i16, cfg)

    i3_by_id = _index_by_id(sim_i3["architectures"])
    i16_by_id = _index_by_id(sim_i16["architectures"])

    for arch_id in ARCHITECTURE_ORDER:
        m3 = i3_by_id[arch_id]
        m16 = i16_by_id[arch_id]
        # En I=3 no hay penalización de coordinación; en I=16 (I > 6) cae drásticamente
        assert m3["formula_breakdown"]["over_scale_factor"] == 1.0
        assert m16["formula_breakdown"]["over_scale_factor"] <= 0.60
        # El costo mensual se dispara al multiplicar réplicas innecesarias
        assert m16["monthly_cost_usd"] > m3["monthly_cost_usd"] * 3.0

    # En arquitecturas distribuidas, subir de I=3 a I=16 aumenta IPC y latencia total
    assert i16_by_id["MICRO_DOCKER"]["latency_ms"] > i3_by_id["MICRO_DOCKER"]["latency_ms"] + 25.0
    assert (
        i16_by_id["MONO_ASYNC_CONTAINER"]["latency_ms"]
        > i3_by_id["MONO_ASYNC_CONTAINER"]["latency_ms"] + 15.0
    )

    # Dominancia estricta de Pareto inter-instancia: I=3 domina a I=16 en MONO_ASYNC_CONTAINER
    # y dentro del escenario sobre-escalado (I=16), MICRO_DOCKER queda Pareto-dominada
    assert is_dominated_by(i3_by_id["MONO_ASYNC_CONTAINER"], i16_by_id["MONO_ASYNC_CONTAINER"])
    assert i16_by_id["MICRO_DOCKER"]["is_pareto_efficient"] is False
    assert "MICRO_DOCKER" in sim_i16["pareto_frontier"]["dominated_by"]

    # 2. Verificación del preset OVERSCALING_SIMPLE_SWIPE y endpoint /simulate/sweep
    preset_resp = api_client.post("/api/v1/scenarios/OVERSCALING_SIMPLE_SWIPE/run")
    assert preset_resp.status_code == 200
    preset_sim = preset_resp.json()["simulation"]
    assert preset_sim["recommendation"]["winner_id"] == "MONO_MVP"

    sweep_resp = api_client.post(
        "/api/v1/simulate/sweep",
        json={
            "sim_input": input_i3.to_dict(),
            "instance_points": [3, 6, 16],
        },
    )
    assert sweep_resp.status_code == 200
    inst_sweep = sweep_resp.json()["instance_sweep"]
    assert [pt["compute_instances"] for pt in inst_sweep] == [3, 6, 16]
    assert (
        inst_sweep[2]["architectures"]["MICRO_DOCKER"]["over_scale_factor"]
        < inst_sweep[1]["architectures"]["MICRO_DOCKER"]["over_scale_factor"]
    )


# =============================================================================
# CP-06: Validación Rigurosa de Entradas Inválidas — Requisito 10 (`HTTP 422`)
# =============================================================================


@pytest.mark.parametrize(
    ("case_label", "invalid_payload", "expected_field"),
    [
        (
            "U_negativo",
            {"sim_input": {"concurrent_drivers": -15}},
            "sim_input.concurrent_drivers",
        ),
        (
            "Np_cero",
            {"sim_input": {"stops_per_route": 0}},
            "sim_input.stops_per_route",
        ),
        (
            "Np_uno_insuficiente_para_TSP",
            {"sim_input": {"stops_per_route": 1}},
            "sim_input.stops_per_route",
        ),
        (
            "Bmax_negativo",
            {"project_config": {"max_budget_usd": -10.0}},
            "project_config.max_budget_usd",
        ),
        (
            "Amin_mayor_100",
            {"project_config": {"min_availability_pct": 102.0}},
            "project_config.min_availability_pct",
        ),
        (
            "team_size_cero",
            {"project_config": {"team_size": 0}},
            "project_config.team_size",
        ),
        (
            "pesos_todos_en_cero",
            {
                "project_config": {
                    "weights": {
                        "latency": 0.0,
                        "throughput": 0.0,
                        "scalability": 0.0,
                        "availability": 0.0,
                        "cost": 0.0,
                        "security": 0.0,
                    }
                }
            },
            "project_config.weights",
        ),
        (
            "instancias_fuera_de_rango",
            {"sim_input": {"compute_instances": 25}},
            "sim_input.compute_instances",
        ),
        (
            "booleano_en_campo_numerico",
            {"sim_input": {"concurrent_drivers": True}},
            "sim_input.concurrent_drivers",
        ),
    ],
)
def test_cp06_invalid_inputs_rejected_with_spanish_http_422(
    api_client: TestClient,
    case_label: str,
    invalid_payload: dict[str, Any],
    expected_field: str,
) -> None:
    """
    CP-06 (Requisito 10): Verifica mediante `POST /api/v1/simulate` que valores inválidos
    (`U=-15`, `N_p=0`, `N_p=1`, `B_max=-10`, `A_min=102.0`, `team_size=0`, suma de pesos `0.0`,
    `I=25`, booleanos infiltrados) son rechazados con `HTTP 422` y mensajes explicativos.
    """
    resp = api_client.post("/api/v1/simulate", json=invalid_payload)
    assert resp.status_code == 422, f"El caso {case_label} debía retornar HTTP 422"

    body = resp.json()
    assert body["error"] == "VALIDATION_ERROR"
    assert isinstance(body["errors"], list) and len(body["errors"]) >= 1
    assert isinstance(body["detail"], list) and len(body["detail"]) >= 1

    reported_fields = {err["field"] for err in body["errors"]}
    assert expected_field in reported_fields
    for err in body["errors"]:
        assert len(err["message"]) > 15


# =============================================================================
# CP-07: Piloto Hiperlocal Chapinero Baja Latencia (`PILOT_CHAPINERO_LOW_LATENCY`)
# =============================================================================


def test_cp07_pilot_chapinero_low_latency_monolith_in_process_win(
    api_client: TestClient,
) -> None:
    """
    CP-07 (`PILOT_CHAPINERO_LOW_LATENCY`): Baja concurrencia (`U=20, G=15, N_p=18, I=1`)
    con restricción estricta de latencia (`<= 115 ms`) y presupuesto acotado (`<= $22 USD`).

    Verifica la victoria de `MONO_MVP` (`74.50 ms`, `$13.95 USD/mes`, `0 ms` IPC y `0 ms`
    cold-start), mientras `HYBRID_EDGE_SERVERLESS` supera 115 ms por cold-start (`69.23 ms`)
    y las arquitecturas contenerizadas exceden el presupuesto de $22 USD/mes (Sunardi 2019).
    """
    resp = api_client.post("/api/v1/scenarios/PILOT_CHAPINERO_LOW_LATENCY/run")
    assert resp.status_code == 200
    sim = resp.json()["simulation"]
    by_id = _index_by_id(sim["architectures"])

    mono = by_id["MONO_MVP"]
    hybrid = by_id["HYBRID_EDGE_SERVERLESS"]
    mono_async = by_id["MONO_ASYNC_CONTAINER"]
    micro = by_id["MICRO_DOCKER"]

    assert sim["recommendation"]["winner_id"] == "MONO_MVP"
    assert mono["meets_all_constraints"] is True
    assert mono["formula_breakdown"]["ipc_ms"] == 0.0
    assert mono["formula_breakdown"]["cold_start_ms"] == 0.0
    assert mono["latency_ms"] == pytest.approx(74.50, abs=0.05)
    assert mono["monthly_cost_usd"] == pytest.approx(13.95, abs=0.05)

    # Serverless penalizada por arranque en frío ante baja concurrencia (U=20)
    assert hybrid["formula_breakdown"]["cold_start_ms"] == pytest.approx(69.23, abs=0.05)
    assert hybrid["latency_ms"] > 115.0
    assert hybrid["meets_latency"] is False

    # Contenedores permanentes exceden el presupuesto hiperlocal de $22 USD/mes
    assert mono_async["meets_budget"] is False
    assert micro["meets_budget"] is False


# =============================================================================
# CP-08: Determinismo, Frontera de Pareto 3D, `formula_breakdown` y Req. 12
# =============================================================================


def test_cp08_determinism_pareto_3d_traceability_and_req12_disclaimer(
    api_client: TestClient,
) -> None:
    """
    CP-08: Verifica propiedades transversales de calidad del simulador:
      1. Determinismo matemático bit a bit en corridas repetidas.
      2. Existencia de al menos 1 alternativa Pareto-eficiente en todos los escenarios.
      3. Presencia completa de las 17 variables intermedias en `formula_breakdown`.
      4. Inclusión obligatoria de `model_disclaimer` y `real_world_validation_steps`
         (Apache JMeter, Docker, New Relic/Prometheus y mediana estadística — Req. 12).
    """
    expected_breakdown_keys = {
        "demand_units",
        "capacity_units",
        "utilization_pct",
        "phi_tsp",
        "ipc_ms",
        "cold_start_ms",
        "weighted_service_ms",
        "queue_multiplier",
        "over_scale_factor",
        "lambda_crud",
        "lambda_ocr_raw",
        "lambda_ocr_cloud",
        "lambda_tsp",
        "total_client_req_s",
        "backend_req_s",
        "tau_tsp_ms",
        "saturation_penalty_ms",
    }

    for scenario_id in SCENARIO_ORDER:
        run_a = run_scenario(scenario_id)
        run_b = run_scenario(scenario_id)
        assert run_a == run_b, f"Fallo de determinismo en escenario {scenario_id}"

        sim = run_a["simulation"]
        efficient_ids = sim["pareto_efficient_ids"]
        assert len(efficient_ids) >= 1

        dominated_by = sim["pareto_frontier"]["dominated_by"]
        for arch in sim["architectures"]:
            assert set(arch["formula_breakdown"].keys()) == expected_breakdown_keys
            if arch["is_pareto_efficient"]:
                assert arch["id"] in efficient_ids
                assert arch["id"] not in dominated_by
            else:
                assert arch["id"] not in efficient_ids
                assert len(dominated_by[arch["id"]]) >= 1

        rec = sim["recommendation"]
        assert "estimaciones matemáticas deterministas" in rec["model_disclaimer"]
        assert len(rec["real_world_validation_steps"]) >= 4
        joined_steps = " ".join(rec["real_world_validation_steps"])
        assert "JMeter" in joined_steps
        assert "Docker" in joined_steps
        assert "Prometheus" in joined_steps or "New Relic" in joined_steps
        assert "mediana" in joined_steps

    # Verificación idéntica a través del endpoint REST POST /api/v1/simulate
    http_a = api_client.post("/api/v1/simulate", json={}).json()
    http_b = api_client.post("/api/v1/simulate", json={}).json()
    assert http_a == http_b


# =============================================================================
# CP-09: Paridad Matemática Exacta Motor Python ↔ Motor TypeScript (Frontend)
# =============================================================================


def test_cp09_mathematical_contract_and_typescript_engine_parity() -> None:
    """
    CP-09: Verifica que:
      1. Todos los escenarios preconfigurados coinciden con `expected_winner_id` del catálogo.
      2. Si el motor espejo TypeScript (`simulator/frontend/src/engine/localFallbackEngine.ts`)
         y Node.js están disponibles en el entorno de ejecución, evalúa los 6 escenarios en
         TypeScript y comprueba paridad numérica y ordinal frente al motor Python (`app.engine`).
    """
    for scenario_id in SCENARIO_ORDER:
        bundle = run_scenario(scenario_id)
        expected_winner = bundle["scenario"]["expected_winner_id"]
        actual_winner = bundle["simulation"]["recommendation"]["winner_id"]
        assert actual_winner == expected_winner

    ts_engine_path = (
        Path(__file__).resolve().parents[2]
        / "frontend"
        / "src"
        / "engine"
        / "localFallbackEngine.ts"
    )
    node_bin = shutil.which("node")
    node_ts_args: list[str] | None = None
    if node_bin is not None:
        ver_proc = subprocess.run(
            [node_bin, "-p", "process.versions.node"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
        if ver_proc.returncode == 0 and ver_proc.stdout.strip():
            parts = [int(x) for x in ver_proc.stdout.strip().split(".")[:2] if x.isdigit()]
            if len(parts) == 2:
                if parts[0] >= 23:
                    node_ts_args = [node_bin, "-e"]
                elif parts[0] == 22 and parts[1] >= 6:
                    node_ts_args = [node_bin, "--experimental-strip-types", "-e"]

    if ts_engine_path.is_file() and node_ts_args is not None:
        node_script = """
        import('./src/engine/localFallbackEngine.ts').then((ts) => {
          const summary = {};
          for (const preset of ts.SCENARIOS_CATALOG) {
            const { simInput, projectConfig } = ts.applyScenarioPreset(preset);
            const sim = ts.runFullSimulationLocal(simInput, projectConfig);
            summary[preset.id] = {
              winner_id: sim.recommendation.winner_id,
              winner_score: sim.recommendation.winner_score,
              pareto_efficient_ids: sim.pareto_efficient_ids,
              ranking_ids: sim.ranking.map((r) => r.id),
              metrics: Object.fromEntries(
                sim.architectures.map((m) => [
                  m.id,
                  {
                    latency_ms: m.latency_ms,
                    throughput_req_s: m.throughput_req_s,
                    max_capacity_req_s: m.max_capacity_req_s,
                    scalability_score: m.scalability_score,
                    availability_pct: m.availability_pct,
                    monthly_cost_usd: m.monthly_cost_usd,
                    cpu_usage_pct: m.cpu_usage_pct,
                    ram_usage_mb: m.ram_usage_mb,
                    security_score: m.security_score,
                    team_operability_score: m.team_operability_score,
                    final_score: m.final_score,
                  },
                ])
              ),
            };
          }
          console.log(JSON.stringify(summary));
        });
        """
        proc = subprocess.run(
            [*node_ts_args, node_script],
            cwd=str(ts_engine_path.parents[2]),
            capture_output=True,
            text=True,
            timeout=20,
            check=False,
        )
        assert proc.returncode == 0, f"Error ejecutando motor TS en Node: {proc.stderr}"
        assert proc.stdout.strip(), "El motor TS no produjo salida JSON."
        ts_results = json.loads(proc.stdout.strip())
        for scenario_id in SCENARIO_ORDER:
            py_sim = run_scenario(scenario_id)["simulation"]
            ts_sim = ts_results[scenario_id]

            assert ts_sim["winner_id"] == py_sim["recommendation"]["winner_id"]
            assert ts_sim["pareto_efficient_ids"] == py_sim["pareto_efficient_ids"]
            assert ts_sim["ranking_ids"] == [r["id"] for r in py_sim["ranking"]]
            assert ts_sim["winner_score"] == pytest.approx(
                py_sim["recommendation"]["winner_score"], abs=0.02
            )

            for py_arch in py_sim["architectures"]:
                ts_arch = ts_sim["metrics"][py_arch["id"]]
                for metric_key, ts_val in ts_arch.items():
                    assert ts_val == pytest.approx(py_arch[metric_key], abs=0.02), (
                        f"Desviación Python vs TypeScript en {scenario_id} -> "
                        f"{py_arch['id']}.{metric_key}"
                    )


def test_cp10_driver_sweep_monotonic_demand_and_invalid_sweep_rejection(
    api_client: TestClient,
) -> None:
    """
    CP-10: Verifica las curvas de escalabilidad `driver_sweep` (crecimiento monótono de
    utilización y latencia al subir de 10 a 2500 conductores) y el rechazo HTTP 422 ante
    puntos inválidos en `/api/v1/simulate/sweep`.
    """
    ok_resp = api_client.post(
        "/api/v1/simulate/sweep",
        json={"driver_points": [10, 100, 500, 2500]},
    )
    assert ok_resp.status_code == 200
    sweep = ok_resp.json()["driver_sweep"]
    assert [pt["concurrent_drivers"] for pt in sweep] == [10, 100, 500, 2500]

    mono_utils = [pt["architectures"]["MONO_MVP"]["utilization_pct"] for pt in sweep]
    assert mono_utils == sorted(mono_utils) and mono_utils[-1] > mono_utils[0]

    bad_sweep = api_client.post(
        "/api/v1/simulate/sweep",
        json={"driver_points": [10, 0, 500]},
    )
    assert bad_sweep.status_code == 422
    assert bad_sweep.json()["error"] == "VALIDATION_ERROR"
