"""
Endpoints REST v1 (`/api/v1`) del Simulador Arquitectónico de EnRuta.

Conecta los esquemas validados en Pydantic v2 (`app.schemas.simulation`) con el motor
matemático determinista y multicriterio (`app.engine`), exponiendo:
  - `GET  /api/v1/health`
  - `GET  /api/v1/architectures`
  - `GET  /api/v1/scenarios`
  - `POST /api/v1/scenarios/{scenario_id}/run`
  - `POST /api/v1/simulate`
  - `POST /api/v1/simulate/sweep`
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Body, HTTPException, Path, status

from app import __version__
from app.engine import (
    get_all_architectures,
    get_all_scenarios,
    run_driver_sweep,
    run_full_simulation,
    run_instance_sweep,
    run_scenario,
    serialize_architecture,
    serialize_scenario,
)
from app.schemas.simulation import (
    HealthResponseSchema,
    SimulationRequestSchema,
    SweepRequestSchema,
)

router = APIRouter(tags=["Simulador Arquitectónico EnRuta"])


@router.get(
    "/health",
    response_model=HealthResponseSchema,
    summary="Healthcheck del contenedor Backend",
    description=(
        "Verifica la disponibilidad operativa del contenedor FastAPI del Simulador "
        "Arquitectónico de EnRuta para sondas Docker HEALTHCHECK y detección automática "
        "de modo híbrido desde el Frontend."
    ),
)
def health_check() -> dict[str, str]:
    """Retorna el estado operativo del servicio."""
    return {
        "status": "ok",
        "service": "enruta-architecture-simulator",
        "version": __version__,
    }


@router.get(
    "/architectures",
    summary="Catálogo calibrado de las 4 arquitecturas candidatas de EnRuta",
    description=(
        "Retorna las especificaciones paramétricas, mapeo de módulos reales de EnRuta, "
        "referencias científicas, ventajas, limitaciones, supuestos y fragmentos "
        "declarativos Docker/Cloud Run de las 4 alternativas arquitectónicas."
    ),
)
def list_architectures() -> list[dict[str, Any]]:
    """Lista serializada de `get_all_architectures()` en orden canónico."""
    return [serialize_architecture(spec) for spec in get_all_architectures()]


@router.get(
    "/scenarios",
    summary="Catálogo de escenarios logísticos preconfigurados de Bogotá D.C. y Colombia",
    description=(
        "Retorna el escenario oficial de referencia (`REF_MVP_BOGOTA`) junto con los "
        "escenarios de estrés operativo (ráfaga OCR matutina, rutas densas TSP OR-Tools, "
        "escala nacional multi-ciudad, sobre-escalado horizontal y piloto hiperlocal)."
    ),
)
def list_scenarios() -> list[dict[str, Any]]:
    """Lista serializada de `get_all_scenarios()` en orden canónico."""
    return [serialize_scenario(preset) for preset in get_all_scenarios()]


@router.post(
    "/scenarios/{scenario_id}/run",
    summary="Ejecutar un escenario preconfigurado de EnRuta por su identificador",
    description=(
        "Ejecuta la simulación matemática y multicriterio completa para el escenario "
        "solicitado (`REF_MVP_BOGOTA`, `PEAK_MORNING_OCR`, `HEAVY_TSP_ROUTES`, "
        "`NATIONAL_SCALE_SLA`, `OVERSCALING_SIMPLE_SWIPE`, `PILOT_CHAPINERO_LOW_LATENCY`). "
        "Retorna HTTP 404 si el identificador no existe."
    ),
)
def execute_preset_scenario(
    scenario_id: str = Path(
        ...,
        min_length=2,
        max_length=80,
        description="Identificador canónico del escenario preconfigurado de EnRuta.",
        examples=["REF_MVP_BOGOTA"],
    ),
) -> dict[str, Any]:
    """Ejecuta `run_scenario(scenario_id)` manejando escenarios inexistentes con HTTP 404."""
    normalized_id = scenario_id.strip()
    try:
        payload = run_scenario(normalized_id)
    except KeyError as exc:
        detail_msg = exc.args[0] if exc.args else f"Escenario desconocido '{normalized_id}'."
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail_msg,
        ) from exc

    sim_payload = payload["simulation"]
    return {
        "execution_mode": "docker-fastapi",
        "scenario": payload["scenario"],
        "simulation": {
            "execution_mode": "docker-fastapi",
            **sim_payload,
            "results": sim_payload["architectures"],
        },
    }


@router.post(
    "/simulate",
    summary="Simular carga puntual y obtener recomendación arquitectónica explicable",
    description=(
        "Valida rigurosamente las variables logísticas de entrada (`sim_input`) y las "
        "restricciones del proyecto (`project_config`), evalúa las 4 arquitecturas con "
        "el modelo matemático determinista, calcula la Frontera de Pareto 3D, el ranking "
        "multicriterio con penalizaciones de SLA/presupuesto, las curvas de barrido y el "
        "dictamen explicable completo."
    ),
)
def simulate_architectures(
    request: SimulationRequestSchema = Body(default_factory=SimulationRequestSchema),
) -> dict[str, Any]:
    """Convierte esquemas validados a dataclasses del motor y ejecuta `run_full_simulation`."""
    sim_input = request.sim_input.to_engine()
    project_config = request.project_config.to_engine()
    payload = run_full_simulation(sim_input=sim_input, project_config=project_config)

    return {
        "execution_mode": "docker-fastapi",
        **payload,
        "results": payload["architectures"],
    }


@router.post(
    "/simulate/sweep",
    summary="Calcular curvas de barrido por conductores e instancias horizontales",
    description=(
        "Genera las curvas paramétricas de escalabilidad (`driver_sweep`, variando "
        "`concurrent_drivers`) y de sobre-escalado horizontal (`instance_sweep`, variando "
        "`compute_instances` según Blinowski et al., 2022) para graficación interactiva."
    ),
)
def simulate_sweeps(
    request: SweepRequestSchema = Body(default_factory=SweepRequestSchema),
) -> dict[str, Any]:
    """Ejecuta `run_driver_sweep` y `run_instance_sweep` sobre parámetros validados."""
    sim_input = request.sim_input.to_engine()
    project_config = request.project_config.to_engine()

    driver_sweep = run_driver_sweep(
        sim_input=sim_input,
        project_config=project_config,
        driver_points=request.driver_points,
    )
    instance_sweep = run_instance_sweep(
        sim_input=sim_input,
        project_config=project_config,
        instance_points=request.instance_points,
    )

    return {
        "execution_mode": "docker-fastapi",
        "driver_sweep": driver_sweep,
        "instance_sweep": instance_sweep,
    }
