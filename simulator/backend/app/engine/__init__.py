"""
Paquete `app.engine` — Motor Matemático, Científico y Multicriterio del Simulador EnRuta.

Exporta públicamente:
  - Catálogo de arquitecturas (`architectures.py`)
  - Modelos matemáticos deterministas y barridos de escalabilidad (`math_model.py`)
  - Frontera de Optimalidad de Pareto 3D (`pareto.py`)
  - Motor de decisión multicriterio y recomendación explicable (`decision_maker.py`)
  - Escenarios logísticos preconfigurados de Bogotá D.C. y Colombia (`scenarios.py`)
"""

from .architectures import (
    ARCHITECTURE_ORDER,
    ARCHITECTURES,
    ArchitectureSpec,
    get_all_architectures,
    serialize_architecture,
)
from .decision_maker import (
    CRITERIA_KEYS,
    run_full_simulation,
)
from .math_model import (
    DEFAULT_DRIVER_SWEEP_POINTS,
    DEFAULT_INSTANCE_SWEEP_POINTS,
    R_RECALC,
    W,
    ArchitectureMetrics,
    DecisionWeights,
    ProjectConfig,
    SimulationInput,
    evaluate_all_architectures,
    evaluate_architecture,
    run_driver_sweep,
    run_instance_sweep,
)
from .pareto import (
    compute_pareto_frontier,
    get_pareto_analysis,
    is_dominated_by,
)
from .scenarios import (
    SCENARIO_ORDER,
    SCENARIOS,
    ScenarioPreset,
    build_scenario_config,
    get_all_scenarios,
    get_scenario,
    run_scenario,
    serialize_scenario,
)

__all__ = [
    # architectures.py
    "ARCHITECTURE_ORDER",
    "ARCHITECTURES",
    "ArchitectureSpec",
    "get_all_architectures",
    "serialize_architecture",
    # math_model.py
    "W",
    "R_RECALC",
    "DEFAULT_DRIVER_SWEEP_POINTS",
    "DEFAULT_INSTANCE_SWEEP_POINTS",
    "DecisionWeights",
    "ProjectConfig",
    "SimulationInput",
    "ArchitectureMetrics",
    "evaluate_architecture",
    "evaluate_all_architectures",
    "run_driver_sweep",
    "run_instance_sweep",
    # pareto.py
    "is_dominated_by",
    "compute_pareto_frontier",
    "get_pareto_analysis",
    # decision_maker.py
    "CRITERIA_KEYS",
    "run_full_simulation",
    # scenarios.py
    "SCENARIO_ORDER",
    "SCENARIOS",
    "ScenarioPreset",
    "get_all_scenarios",
    "get_scenario",
    "serialize_scenario",
    "build_scenario_config",
    "run_scenario",
]
