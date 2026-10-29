"""
Motor matemático determinista y trazable para el Simulador Arquitectónico de EnRuta.

Fundamentación científica y operacional:
  1. Cargas reales de EnRuta (`backend/app/` y `mobile/src/`):
     - Operaciones CRUD multi-cliente (`Stop` 1:N `StopClient`) y cambios rápidos de estado
       por gesto swipe (`PUT /api/v1/stops/{id}/estado`).
     - Pipeline de escaneo OCR de guías logísticas colombianas (Servientrega, Coordinadora,
       Interrapidísimo, Envía, J&T Express, iMile) comparando inferencia multimodal en nube
       (Google Gemini Vision) frente a reconocimiento en el borde (Google ML Kit on-device)
       y normalización vial de Bogotá D.C. (`Cll`, `Kra`, `Dg`, `Tv`, `Torre/Int/Apto`).
     - Optimización combinatoria de rutas de última milla mediante matriz Haversine O(N^2)
       y solver Open TSP de Google OR-Tools (`PATH_CHEAPEST_ARC` + `GUIDED_LOCAL_SEARCH`),
       cuya complejidad empírica escala según phi_tsp = (N_p / 30)^1.85.
  2. Artículos científicos base de calibración:
     - Sunardi & Suharjito (2019), Procedia Computer Science: Monolithic MVC vs Microservices.
     - Tapia et al. (2020), Applied Sciences: Correlación entre uso de CPU/RAM, contenerización
       Docker y eficiencia energética/computacional bajo estrés concurrente.
     - Blinowski, Ojdowska & Przybyłek (2022), IEEE Access: Evaluación de escalabilidad y
       penalización cuadrática por sobre-escalado horizontal de instancias (I > 6).
     - Al-Debagy & Martinek (2018), IEEE CINTI: Impacto de saltos IPC y encolamiento M/G/1
       sobre la latencia p50/p95 y el throughput efectivo.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, replace
from typing import Any

from .architectures import (
    ARCHITECTURE_ORDER,
    ARCHITECTURES,
    ArchitectureSpec,
    get_all_architectures,
)

# Constantes globales de calibración operativa de EnRuta
W: float = 1800.0  # Ventana activa de despacho matutino en segundos (30 minutos)
R_RECALC: float = 1.5  # Promedio de ejecuciones/recálculos del solver TSP por conductor

DEFAULT_DRIVER_SWEEP_POINTS: list[int] = [10, 50, 100, 250, 500, 1000, 2500]
DEFAULT_INSTANCE_SWEEP_POINTS: list[int] = [1, 2, 3, 6, 10, 15, 20]


@dataclass
class DecisionWeights:
    """Pesos multicriterio configurables por el arquitecto de software."""

    latency: float = 0.25
    throughput: float = 0.15
    scalability: float = 0.20
    availability: float = 0.15
    cost: float = 0.15
    security: float = 0.10

    def to_dict(self) -> dict[str, float]:
        """Serializa los pesos a diccionario plano."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any] | None) -> DecisionWeights:
        """Construye `DecisionWeights` ignorando claves desconocidas."""
        if not data:
            return cls()
        valid_keys = {
            "latency",
            "throughput",
            "scalability",
            "availability",
            "cost",
            "security",
        }
        filtered = {k: float(v) for k, v in data.items() if k in valid_keys and v is not None}
        return cls(**filtered)


@dataclass
class ProjectConfig:
    """Restricciones no funcionales, contexto organizacional y pesos del proyecto."""

    project_name: str = "EnRuta - Optimización Logística de Última Milla (Bogotá D.C.)"
    project_domain: str = "Logística urbana, OCR multimodal de guías y ruteo TSP (OR-Tools)"
    target_users_description: str = (
        "Conductores y mensajeros urbanos en Bogotá D.C. (30 a 80 paradas diarias)"
    )
    expected_users: int = 50
    max_budget_usd: float = 25.0
    max_latency_ms: float = 1500.0
    min_availability_pct: float = 99.0
    team_size: int = 3
    require_encryption: bool = True
    weights: DecisionWeights = field(default_factory=DecisionWeights)

    def to_dict(self) -> dict[str, Any]:
        """Serializa la configuración del proyecto a diccionario JSON-compatible."""
        return asdict(self)

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any] | None,
        base: ProjectConfig | None = None,
    ) -> ProjectConfig:
        """Construye un `ProjectConfig` aplicando overrides parciales sobre `base`."""
        seed = replace(base) if base is not None else cls()
        if not data:
            return seed

        merged = seed.to_dict()
        weights_override = data.get("weights")
        for key, value in data.items():
            if key == "weights" or value is None or key not in merged:
                continue
            merged[key] = value

        base_weights_dict = seed.weights.to_dict()
        if isinstance(weights_override, DecisionWeights):
            merged["weights"] = replace(weights_override)
        elif isinstance(weights_override, dict):
            base_weights_dict.update(
                {k: float(v) for k, v in weights_override.items() if k in base_weights_dict}
            )
            merged["weights"] = DecisionWeights.from_dict(base_weights_dict)
        else:
            merged["weights"] = DecisionWeights.from_dict(base_weights_dict)

        merged["expected_users"] = int(merged["expected_users"])
        merged["max_budget_usd"] = float(merged["max_budget_usd"])
        merged["max_latency_ms"] = float(merged["max_latency_ms"])
        merged["min_availability_pct"] = float(merged["min_availability_pct"])
        merged["team_size"] = int(merged["team_size"])
        merged["require_encryption"] = bool(merged["require_encryption"])
        return cls(**merged)


@dataclass
class SimulationInput:
    """Variables dinámicas de carga operativa del simulador EnRuta."""

    concurrent_drivers: int = 35
    ocr_guides_per_driver: int = 30
    stops_per_route: int = 30
    compute_instances: int = 1
    crud_ops_per_min: float = 6.0

    def to_dict(self) -> dict[str, int | float]:
        """Serializa los parámetros de simulación a diccionario plano."""
        return asdict(self)

    @classmethod
    def from_dict(
        cls,
        data: dict[str, Any] | None,
        base: SimulationInput | None = None,
    ) -> SimulationInput:
        """Construye un `SimulationInput` a partir de un diccionario parcial o completo."""
        seed = replace(base) if base is not None else cls()
        if not data:
            return seed
        merged = seed.to_dict()
        for key, value in data.items():
            if key in merged and value is not None:
                merged[key] = value
        return cls(
            concurrent_drivers=int(merged["concurrent_drivers"]),
            ocr_guides_per_driver=int(merged["ocr_guides_per_driver"]),
            stops_per_route=int(merged["stops_per_route"]),
            compute_instances=int(merged["compute_instances"]),
            crud_ops_per_min=float(merged["crud_ops_per_min"]),
        )


@dataclass
class ArchitectureMetrics:
    """Resultado cuantitativo completo de evaluar una arquitectura bajo una carga dada."""

    id: str
    name: str
    short_name: str
    subtitle: str
    latency_ms: float
    throughput_req_s: float
    max_capacity_req_s: float
    error_rate_pct: float
    scalability_score: float
    availability_pct: float
    monthly_cost_usd: float
    active_containers: int
    cpu_usage_pct: float
    ram_usage_mb: float
    security_score: float
    team_operability_score: float
    utilization: float
    utilization_pct: float
    formula_breakdown: dict[str, float] = field(default_factory=dict)
    is_pareto_efficient: bool = False
    # Campos poblados por el motor de decisión multicriterio (`decision_maker.py`)
    meets_budget: bool = True
    meets_latency: bool = True
    meets_availability: bool = True
    meets_capacity: bool = True
    meets_all_constraints: bool = True
    raw_score: float = 0.0
    total_penalty: float = 0.0
    final_score: float = 0.0
    rank: int = 0
    normalized_utilities: dict[str, float] = field(default_factory=dict)
    penalties_breakdown: dict[str, float] = field(default_factory=dict)
    architecture_id: str = ""
    architecture_name: str = ""

    def __post_init__(self) -> None:
        if not self.architecture_id:
            self.architecture_id = self.id
        if not self.architecture_name:
            self.architecture_name = self.name

    def to_dict(self) -> dict[str, Any]:
        """Serializa las métricas evaluadas a diccionario plano JSON-compatible."""
        return asdict(self)


def evaluate_architecture(
    spec: ArchitectureSpec,
    sim_input: SimulationInput,
    project_config: ProjectConfig | None = None,
) -> ArchitectureMetrics:
    """
    Evalúa de forma determinista el comportamiento matemático de `spec` bajo `sim_input`
    y `project_config`, siguiendo exactamente las ecuaciones calibradas del modelo EnRuta.
    """
    cfg = project_config if project_config is not None else ProjectConfig()

    U = sim_input.concurrent_drivers
    G = sim_input.ocr_guides_per_driver
    N_p = sim_input.stops_per_route
    I = sim_input.compute_instances
    F_crud = sim_input.crud_ops_per_min

    # 1. Tasas de llegada (peticiones/segundo)
    lambda_crud = (U * F_crud) / 60.0
    lambda_ocr_raw = (U * G) / W
    lambda_ocr_cloud = lambda_ocr_raw * spec.theta_cloud_ocr
    lambda_tsp = (U * R_RECALC) / W
    total_client_req_s = lambda_crud + lambda_ocr_raw + lambda_tsp
    backend_req_s = lambda_crud + lambda_ocr_cloud + lambda_tsp

    # 2. Complejidad TSP (Google OR-Tools con matriz Haversine O(N^2))
    phi_tsp = (N_p / 30.0) ** 1.85

    # 3. Demanda y Capacidad (con penalización de sobre-escalado de Blinowski 2022 para I > 6)
    demand_units = (
        (lambda_crud * spec.c_crud)
        + (lambda_ocr_cloud * spec.c_ocr)
        + (lambda_tsp * spec.c_tsp * phi_tsp)
    )
    over_scale_factor = max(0.55, 1.0 - spec.beta_coord * (max(0, I - 6) ** 2))
    capacity_units = spec.mu_0 * (I ** spec.eta) * over_scale_factor
    utilization = demand_units / max(capacity_units, 1e-6)

    # 4. Tiempos de servicio y Latencia Estimada (ms)
    tau_tsp_ms = spec.tau_tsp_base + spec.alpha_tsp * phi_tsp
    weighted_service_ms = (
        (lambda_crud * spec.tau_crud)
        + (lambda_ocr_cloud * spec.tau_ocr)
        + (lambda_tsp * tau_tsp_ms)
    ) / max(backend_req_s, 1e-6)
    cold_start_ms = (
        ((180.0 / (1.0 + 0.08 * U)) + max(0.0, (N_p - 80.0) * 14.0))
        if spec.has_serverless_cold_start
        else 0.0
    )
    ipc_ms = spec.l_ipc_base + spec.l_ipc_per_inst * max(0, I - 1)
    rho_eff = min(utilization, 0.985)
    queue_multiplier = 1.0 + ((rho_eff ** 2) / (1.0 - rho_eff))
    saturation_penalty_ms = max(0.0, utilization - 1.0) * 2800.0
    latency_ms = round(
        spec.l_base
        + ipc_ms
        + (weighted_service_ms * queue_multiplier)
        + cold_start_ms
        + saturation_penalty_ms,
        2,
    )

    # 5. Capacidad / Throughput y Tasa de Error
    avg_cost_per_client_req = demand_units / max(total_client_req_s, 1e-6)
    max_capacity_req_s = round(capacity_units / max(avg_cost_per_client_req, 1e-6), 2)
    drop_prob = (
        0.0
        if utilization <= 0.92
        else min(0.85, max(0.0, 1.0 - (0.92 / utilization)))
    )
    error_rate_pct = round(drop_prob * 100.0, 2)
    throughput_req_s = round(total_client_req_s * (1.0 - drop_prob), 2)

    # 6. Escalabilidad (puntaje normalizado 0..100)
    headroom_term = max(0.0, 1.0 - min(1.0, utilization / 1.25))
    raw_scalability = (
        100.0 * (0.45 * spec.eta + 0.35 * spec.isolation_factor + 0.20 * headroom_term)
        - (max(0, I - 8) * 1.2 * (1.0 - spec.isolation_factor))
    )
    scalability_score = round(min(100.0, max(0.0, raw_scalability)), 2)

    # 7. Disponibilidad efectiva (%)
    eff_nodes = min(I, spec.m_max_avail_nodes)
    parallel_avail = 1.0 - ((1.0 - spec.a_0) ** eff_nodes)
    stress_spof_drop = spec.delta_spof * max(0.0, utilization - 0.80)
    availability_pct = round(
        100.0 * max(0.90, min(0.9999, parallel_avail - stress_spof_drop)),
        3,
    )

    # 8. Costo Mensual Estimado (USD/mes asumiendo 26 jornadas operativas/mes)
    monthly_ocr_guides = 26.0 * U * G
    monthly_total_requests = 26.0 * (total_client_req_s * W)
    if spec.is_serverless_pay_per_use:
        reserved_cost = max(0, I - 1) * 8.0
        overage_requests = max(0.0, monthly_total_requests - 150000.0)
        compute_usage_cost = overage_requests * 0.00008 * (1.0 + 0.35 * phi_tsp)
        monthly_cost_usd = round(
            reserved_cost
            + spec.gateway_fixed_cost
            + compute_usage_cost
            + (monthly_ocr_guides * spec.ocr_api_unit_cost),
            2,
        )
    else:
        monthly_cost_usd = round(
            (spec.infra_unit_cost * I)
            + spec.gateway_fixed_cost
            + (monthly_ocr_guides * spec.ocr_api_unit_cost),
            2,
        )

    # 9. Contenedores activos, uso de CPU (%) y huella de RAM (MB)
    active_containers = spec.containers_per_instance * I
    cpu_usage_pct = round(
        min(100.0, spec.cpu_overhead_pct + (min(utilization, 1.15) * 76.0)),
        2,
    )
    ram_usage_mb = round(
        spec.base_ram_mb
        + (spec.ram_per_inst_mb * max(0, I - 1))
        + (U * 0.45)
        + (N_p * 1.2 * spec.theta_cloud_ocr),
        1,
    )

    # 10. Seguridad/Cifrado e Idoneidad Operativa para el Equipo
    encryption_bonus = 6.0 if cfg.require_encryption else 0.0
    container_surface_penalty = min(6.0, active_containers * 0.18)
    security_score = round(
        min(100.0, max(0.0, spec.security_base + encryption_bonus - container_surface_penalty)),
        2,
    )
    team_capacity = min(100.0, cfg.team_size * 24.0)
    devops_gap = max(0.0, spec.devops_complexity - team_capacity)
    team_operability_score = round(max(0.0, 100.0 - devops_gap * 0.85), 2)

    utilization_pct = round(utilization * 100.0, 2)

    # 11. Desglose trazable de variables intermedias de las ecuaciones
    formula_breakdown: dict[str, float] = {
        "demand_units": round(demand_units, 3),
        "capacity_units": round(capacity_units, 3),
        "utilization_pct": utilization_pct,
        "phi_tsp": round(phi_tsp, 3),
        "ipc_ms": round(ipc_ms, 2),
        "cold_start_ms": round(cold_start_ms, 2),
        "weighted_service_ms": round(weighted_service_ms, 2),
        "queue_multiplier": round(queue_multiplier, 3),
        "over_scale_factor": round(over_scale_factor, 3),
        "lambda_crud": round(lambda_crud, 4),
        "lambda_ocr_raw": round(lambda_ocr_raw, 4),
        "lambda_ocr_cloud": round(lambda_ocr_cloud, 4),
        "lambda_tsp": round(lambda_tsp, 4),
        "total_client_req_s": round(total_client_req_s, 3),
        "backend_req_s": round(backend_req_s, 3),
        "tau_tsp_ms": round(tau_tsp_ms, 2),
        "saturation_penalty_ms": round(saturation_penalty_ms, 2),
    }

    return ArchitectureMetrics(
        id=spec.id,
        name=spec.name,
        short_name=spec.short_name,
        subtitle=spec.subtitle,
        latency_ms=latency_ms,
        throughput_req_s=throughput_req_s,
        max_capacity_req_s=max_capacity_req_s,
        error_rate_pct=error_rate_pct,
        scalability_score=scalability_score,
        availability_pct=availability_pct,
        monthly_cost_usd=monthly_cost_usd,
        active_containers=active_containers,
        cpu_usage_pct=cpu_usage_pct,
        ram_usage_mb=ram_usage_mb,
        security_score=security_score,
        team_operability_score=team_operability_score,
        utilization=utilization,
        utilization_pct=utilization_pct,
        formula_breakdown=formula_breakdown,
    )


def evaluate_all_architectures(
    sim_input: SimulationInput,
    project_config: ProjectConfig | None = None,
) -> list[ArchitectureMetrics]:
    """Evalúa las 4 arquitecturas en el orden canónico `ARCHITECTURE_ORDER`."""
    cfg = project_config if project_config is not None else ProjectConfig()
    specs = get_all_architectures()
    return [evaluate_architecture(spec, sim_input, cfg) for spec in specs]


def run_driver_sweep(
    sim_input: SimulationInput,
    project_config: ProjectConfig | None = None,
    driver_points: list[int] | None = None,
) -> list[dict[str, Any]]:
    """
    Evalúa la curva de escalabilidad de las 4 arquitecturas variando `concurrent_drivers`
    sobre `[10, 50, 100, 250, 500, 1000, 2500]` (o los `driver_points` suministrados),
    manteniendo fijos los demás parámetros de `sim_input`.
    """
    cfg = project_config if project_config is not None else ProjectConfig()
    points = list(driver_points) if driver_points is not None else list(DEFAULT_DRIVER_SWEEP_POINTS)
    specs = get_all_architectures()

    sweep_results: list[dict[str, Any]] = []
    for drivers in points:
        point_input = replace(sim_input, concurrent_drivers=int(drivers))
        evaluated = [evaluate_architecture(spec, point_input, cfg) for spec in specs]
        sweep_results.append(
            {
                "concurrent_drivers": int(drivers),
                "architectures": {
                    m.id: {
                        "id": m.id,
                        "name": m.name,
                        "short_name": m.short_name,
                        "latency_ms": m.latency_ms,
                        "throughput_req_s": m.throughput_req_s,
                        "max_capacity_req_s": m.max_capacity_req_s,
                        "error_rate_pct": m.error_rate_pct,
                        "scalability_score": m.scalability_score,
                        "availability_pct": m.availability_pct,
                        "monthly_cost_usd": m.monthly_cost_usd,
                        "utilization_pct": m.utilization_pct,
                        "cpu_usage_pct": m.cpu_usage_pct,
                        "ram_usage_mb": m.ram_usage_mb,
                        "active_containers": m.active_containers,
                    }
                    for m in evaluated
                },
                "metrics": [m.to_dict() for m in evaluated],
            }
        )
    return sweep_results


def run_instance_sweep(
    sim_input: SimulationInput,
    project_config: ProjectConfig | None = None,
    instance_points: list[int] | None = None,
) -> list[dict[str, Any]]:
    """
    Evalúa el efecto del escalado horizontal variando `compute_instances` sobre
    `[1, 2, 3, 6, 10, 15, 20]` (o `instance_points`), permitiendo visualizar la
    degradación por coordinación y sobre-escalado reportada por Blinowski et al. (2022)
    cuando `I > 6`, así como el incremento de latencia IPC y costo mensual.
    """
    cfg = project_config if project_config is not None else ProjectConfig()
    points = (
        list(instance_points)
        if instance_points is not None
        else list(DEFAULT_INSTANCE_SWEEP_POINTS)
    )
    specs = get_all_architectures()

    sweep_results: list[dict[str, Any]] = []
    for instances in points:
        point_input = replace(sim_input, compute_instances=int(instances))
        evaluated = [evaluate_architecture(spec, point_input, cfg) for spec in specs]
        sweep_results.append(
            {
                "compute_instances": int(instances),
                "architectures": {
                    m.id: {
                        "id": m.id,
                        "name": m.name,
                        "short_name": m.short_name,
                        "latency_ms": m.latency_ms,
                        "throughput_req_s": m.throughput_req_s,
                        "max_capacity_req_s": m.max_capacity_req_s,
                        "error_rate_pct": m.error_rate_pct,
                        "scalability_score": m.scalability_score,
                        "availability_pct": m.availability_pct,
                        "monthly_cost_usd": m.monthly_cost_usd,
                        "utilization_pct": m.utilization_pct,
                        "cpu_usage_pct": m.cpu_usage_pct,
                        "ram_usage_mb": m.ram_usage_mb,
                        "active_containers": m.active_containers,
                        "over_scale_factor": m.formula_breakdown["over_scale_factor"],
                        "ipc_ms": m.formula_breakdown["ipc_ms"],
                        "capacity_units": m.formula_breakdown["capacity_units"],
                    }
                    for m in evaluated
                },
                "metrics": [m.to_dict() for m in evaluated],
            }
        )
    return sweep_results


__all__ = [
    "ARCHITECTURES",
    "ARCHITECTURE_ORDER",
    "ArchitectureMetrics",
    "ArchitectureSpec",
    "DEFAULT_DRIVER_SWEEP_POINTS",
    "DEFAULT_INSTANCE_SWEEP_POINTS",
    "DecisionWeights",
    "ProjectConfig",
    "R_RECALC",
    "SimulationInput",
    "W",
    "evaluate_all_architectures",
    "evaluate_architecture",
    "run_driver_sweep",
    "run_instance_sweep",
]
