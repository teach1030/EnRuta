"""
Motor de Decisión Multicriterio (MCDA / TOPSIS-SAW con Penalizaciones de Restricción Dura)
y Generador de Recomendaciones Explicables para el Simulador Arquitectónico de EnRuta.

Combina:
  1. Evaluación determinista de las 4 arquitecturas (`evaluate_architecture`).
  2. Identificación de la Frontera de Pareto 3D (`compute_pareto_frontier`).
  3. Verificación de restricciones duras de negocio/SLA (presupuesto mensual, latencia tope,
     disponibilidad mínima y factor de utilización máxima <= 105%).
  4. Normalización Min-Max relativa sobre 6 dimensiones ponderadas y penalizaciones
     progresivas ante incumplimiento de restricciones.
  5. Síntesis argumentativa cuantitativa, trazable y contextualizada al dominio logístico
     de EnRuta en Bogotá D.C. y a la literatura científica del curso.
"""

from __future__ import annotations

from typing import Any

from .architectures import (
    ARCHITECTURE_ORDER,
    ARCHITECTURES,
    ArchitectureSpec,
    get_all_architectures,
)
from .math_model import (
    ArchitectureMetrics,
    ProjectConfig,
    SimulationInput,
    W,
    evaluate_architecture,
    run_driver_sweep,
    run_instance_sweep,
)
from .pareto import compute_pareto_frontier, get_pareto_analysis

CRITERIA_KEYS: tuple[str, ...] = (
    "latency",
    "throughput",
    "scalability",
    "availability",
    "cost",
    "security",
)


def _normalize_weights(project_config: ProjectConfig) -> dict[str, float]:
    """Normaliza los pesos de `DecisionWeights` para que sumen exactamente 1.0."""
    raw = project_config.weights.to_dict()
    clamped = {k: max(0.0, float(raw.get(k, 0.0))) for k in CRITERIA_KEYS}
    sum_w = sum(clamped.values())
    if sum_w <= 1e-9:
        uniform = 1.0 / len(CRITERIA_KEYS)
        return {k: uniform for k in CRITERIA_KEYS}
    return {k: clamped[k] / sum_w for k in CRITERIA_KEYS}


def _min_max_utility(values: list[float], lower_is_better: bool) -> list[float]:
    """
    Calcula utilidades normalizadas Min-Max en `[0.0, 1.0]` entre las alternativas.
    Si `max_v - min_v < 1e-9`, asigna utilidad `1.0` a todas las alternativas.
    """
    min_v = min(values)
    max_v = max(values)
    span = max_v - min_v
    if span < 1e-9:
        return [1.0 for _ in values]
    if lower_is_better:
        return [(max_v - v) / span for v in values]
    return [(v - min_v) / span for v in values]


def _describe_violations(
    m: ArchitectureMetrics,
    cfg: ProjectConfig,
) -> list[str]:
    """Construye descripciones cuantitativas precisas de cada restricción dura incumplida."""
    violations: list[str] = []
    if not m.meets_budget:
        excess = round(m.monthly_cost_usd - cfg.max_budget_usd, 2)
        violations.append(
            f"Presupuesto excedido (+${excess:.2f} USD/mes: requiere ${m.monthly_cost_usd:.2f} "
            f"frente al tope de ${cfg.max_budget_usd:.2f} USD/mes)"
        )
    if not m.meets_latency:
        excess_ms = round(m.latency_ms - cfg.max_latency_ms, 2)
        violations.append(
            f"Latencia SLA superada (+{excess_ms:.2f} ms: estima {m.latency_ms:.2f} ms "
            f"frente al máximo permitido de {cfg.max_latency_ms:.2f} ms)"
        )
    if not m.meets_availability:
        gap_pct = round(cfg.min_availability_pct - m.availability_pct, 3)
        violations.append(
            f"Disponibilidad insuficiente (-{gap_pct:.3f} pp: alcanza {m.availability_pct:.3f}% "
            f"frente al SLA mínimo de {cfg.min_availability_pct:.2f}%)"
        )
    if not m.meets_capacity:
        violations.append(
            f"Sobrecarga operativa severa (utilización del {m.utilization_pct:.1f}% > 105.0%, "
            f"con pérdida estimada del {m.error_rate_pct:.2f}% de peticiones)"
        )
    return violations


def _build_explainable_recommendation(
    ranked_metrics: list[ArchitectureMetrics],
    sim_input: SimulationInput,
    project_config: ProjectConfig,
    norm_weights: dict[str, float],
    pareto_info: dict[str, Any],
) -> dict[str, Any]:
    """
    Construye el dictamen arquitectónico explicable en español técnico con trazabilidad
    numérica completa frente a las otras tres alternativas evaluadas.
    """
    winner = ranked_metrics[0]
    runner_up = ranked_metrics[1]
    others = ranked_metrics[1:]
    winner_spec: ArchitectureSpec = ARCHITECTURES[winner.id]

    u_drivers = sim_input.concurrent_drivers
    guides = sim_input.ocr_guides_per_driver
    stops = sim_input.stops_per_route
    instances = sim_input.compute_instances
    phi_tsp = winner.formula_breakdown["phi_tsp"]
    over_scale = winner.formula_breakdown["over_scale_factor"]

    # 1. Resumen ejecutivo cuantitativo (`summary_rationale`)
    if winner.meets_all_constraints:
        constraint_clause = (
            f"cumple simultáneamente el 100% de las restricciones duras del proyecto "
            f"(costo ${winner.monthly_cost_usd:.2f} <= ${project_config.max_budget_usd:.2f} USD/mes, "
            f"latencia {winner.latency_ms:.2f} <= {project_config.max_latency_ms:.0f} ms, "
            f"disponibilidad {winner.availability_pct:.3f}% >= {project_config.min_availability_pct:.2f}% "
            f"y utilización {winner.utilization_pct:.1f}% <= 105%)"
        )
    else:
        violated_summary = "; ".join(_describe_violations(winner, project_config))
        constraint_clause = (
            f"ninguna de las 4 arquitecturas logra satisfacer todas las restricciones duras bajo la "
            f"carga actual, pero esta opción minimiza la degradación y las penalizaciones "
            f"(incumplimientos detectados: {violated_summary})"
        )

    pareto_clause = (
        "pertenece a la Frontera de Optimalidad de Pareto (no existe alternativa más barata, "
        "más rápida y más disponible al mismo tiempo)"
        if winner.is_pareto_efficient
        else "presenta el mejor compromiso global ponderado aunque es dominada parcialmente en el plano puro costo-latencia-disponibilidad"
    )

    summary_rationale = (
        f"Para una operación de {u_drivers} conductores concurrentes en Bogotá D.C., escaneando "
        f"{guides} guías/conductor y optimizando rutas de {stops} paradas (complejidad OR-Tools "
        f"phi_tsp = {phi_tsp:.2f}x) sobre {instances} instancia(s) lógica(s), la arquitectura "
        f"recomendada es «{winner.name}» con un puntaje final de {winner.final_score:.2f}/100 "
        f"(superando por {winner.final_score - runner_up.final_score:.2f} puntos a "
        f"«{runner_up.short_name}»). Esta arquitectura {constraint_clause} y {pareto_clause}."
    )

    # 2. Razones detalladas cuantitativas (`detailed_reasons`)
    cheapest = min(ranked_metrics, key=lambda m: m.monthly_cost_usd)
    fastest = min(ranked_metrics, key=lambda m: m.latency_ms)
    most_avail = max(ranked_metrics, key=lambda m: m.availability_pct)
    most_scalable = max(ranked_metrics, key=lambda m: m.scalability_score)

    detailed_reasons: list[str] = [
        (
            f"Desempeño de Latencia y Encolamiento (peso normalizado {norm_weights['latency']*100:.1f}%): "
            f"registra {winner.latency_ms:.2f} ms extremo a extremo "
            f"(servicio ponderado {winner.formula_breakdown['weighted_service_ms']:.2f} ms, "
            f"multiplicador de cola M/G/1 {winner.formula_breakdown['queue_multiplier']:.3f}x, "
            f"IPC {winner.formula_breakdown['ipc_ms']:.2f} ms y cold-start "
            f"{winner.formula_breakdown['cold_start_ms']:.2f} ms), frente a {fastest.latency_ms:.2f} ms "
            f"de la alternativa más veloz ({fastest.short_name}) y {runner_up.latency_ms:.2f} ms del "
            f"segundo lugar ({runner_up.short_name})."
        ),
        (
            f"Eficiencia Financiera y Presupuesto Mensual (peso {norm_weights['cost']*100:.1f}%): "
            f"estima ${winner.monthly_cost_usd:.2f} USD/mes para procesar ~{int(26 * u_drivers * guides):,} "
            f"guías OCR/mes (límite del proyecto: ${project_config.max_budget_usd:.2f} USD/mes; "
            f"alternativa más económica: {cheapest.short_name} con ${cheapest.monthly_cost_usd:.2f} USD/mes)."
        ),
        (
            f"Capacidad Efectiva, Throughput y Solver TSP (pesos throughput {norm_weights['throughput']*100:.1f}% "
            f"+ escalabilidad {norm_weights['scalability']*100:.1f}%): procesa {winner.throughput_req_s:.2f} req/s "
            f"con techo máximo de {winner.max_capacity_req_s:.2f} req/s, utilización de capacidad del "
            f"{winner.utilization_pct:.1f}% ({winner.formula_breakdown['demand_units']:.2f} / "
            f"{winner.formula_breakdown['capacity_units']:.2f} unidades) y puntaje de escalabilidad de "
            f"{winner.scalability_score:.2f}/100 (líder en escalabilidad: {most_scalable.short_name} con "
            f"{most_scalable.scalability_score:.2f}/100)."
        ),
        (
            f"Disponibilidad Resiliente y Gobernanza de Equipo (pesos disponibilidad {norm_weights['availability']*100:.1f}% "
            f"+ seguridad/operabilidad {norm_weights['security']*100:.1f}%): ofrece {winner.availability_pct:.3f}% "
            f"de disponibilidad efectiva (máxima del grupo: {most_avail.availability_pct:.3f}% en {most_avail.short_name}), "
            f"seguridad de {winner.security_score:.2f}/100 ({winner.active_containers} contenedores activos) "
            f"e idoneidad operativa de {winner.team_operability_score:.2f}/100 para un equipo de "
            f"{project_config.team_size} desarrollador(es) (complejidad DevOps base {winner_spec.devops_complexity:.0f}/100)."
        ),
    ]

    if instances > 6:
        detailed_reasons.append(
            f"Efecto de Sobre-escalado Horizontal (Blinowski et al., 2022): al operar con I = {instances} "
            f"instancias (> 6), se activa el factor de degradación por coordinación inter-nodo "
            f"(over_scale_factor = {over_scale:.3f}) y aumenta la latencia IPC proporcional al número de "
            f"réplicas, penalizando con mayor fuerza a arquitecturas con estado compartido o alta sobrecarga de red."
        )

    if stops > 80:
        detailed_reasons.append(
            f"Complejidad Algorítmica Superlineal en Ruteo Urbano: con {stops} paradas por ruta, la matriz "
            f"Haversine N×N y la búsqueda local guiada de OR-Tools elevan phi_tsp a {phi_tsp:.2f}x "
            f"respecto a una ruta estándar de 30 paradas, premiando el desacoplamiento del solver C++ "
            f"frente al hilo principal de peticiones HTTP."
        )

    # 3. Alternativas descartadas (`rejected_alternatives`)
    rejected_alternatives: list[dict[str, Any]] = []
    dominated_map: dict[str, list[dict[str, Any]]] = pareto_info.get("dominated_by", {})

    for alt in others:
        violations = _describe_violations(alt, project_config)
        score_gap = round(winner.final_score - alt.final_score, 2)
        dominators = dominated_map.get(alt.id, [])

        reason_parts: list[str] = [
            f"Obtuvo {alt.final_score:.2f}/100 (-{score_gap:.2f} pts frente a {winner.short_name}; "
            f"puntaje bruto MCDA {alt.raw_score:.2f} menos penalización total {alt.total_penalty:.2f})."
        ]
        if violations:
            reason_parts.append("Violó restricciones duras: " + "; ".join(violations) + ".")
        else:
            # Comparación directa de métricas clave cuando sí cumplió restricciones
            diffs: list[str] = []
            if alt.latency_ms > winner.latency_ms:
                diffs.append(f"+{alt.latency_ms - winner.latency_ms:.2f} ms más lenta ({alt.latency_ms:.2f} ms)")
            if alt.monthly_cost_usd > winner.monthly_cost_usd:
                diffs.append(
                    f"+${alt.monthly_cost_usd - winner.monthly_cost_usd:.2f} USD/mes más costosa "
                    f"(${alt.monthly_cost_usd:.2f} USD/mes)"
                )
            if alt.scalability_score < winner.scalability_score:
                diffs.append(
                    f"-{winner.scalability_score - alt.scalability_score:.2f} pts en escalabilidad "
                    f"({alt.scalability_score:.2f}/100)"
                )
            if alt.availability_pct < winner.availability_pct:
                diffs.append(
                    f"-{winner.availability_pct - alt.availability_pct:.3f} pp en disponibilidad "
                    f"({alt.availability_pct:.3f}%)"
                )
            if alt.team_operability_score < winner.team_operability_score:
                diffs.append(
                    f"menor operabilidad para un equipo de {project_config.team_size} personas "
                    f"({alt.team_operability_score:.2f}/100)"
                )
            if diffs:
                reason_parts.append(
                    "Cumplió las restricciones duras, pero resultó inferior en el balance ponderado: "
                    + ", ".join(diffs)
                    + "."
                )

        if dominators:
            dom_names = ", ".join(d["dominator_name"] for d in dominators)
            reason_parts.append(
                f"Además, es dominada en la Frontera de Pareto por: {dom_names}."
            )

        rejected_alternatives.append(
            {
                "id": alt.id,
                "architecture_id": alt.id,
                "name": alt.name,
                "short_name": alt.short_name,
                "rank": alt.rank,
                "final_score": alt.final_score,
                "raw_score": alt.raw_score,
                "total_penalty": alt.total_penalty,
                "meets_all_constraints": alt.meets_all_constraints,
                "violated_constraints": violations,
                "is_pareto_efficient": alt.is_pareto_efficient,
                "reason": " ".join(reason_parts),
            }
        )

    # 4. Ventajas, limitaciones y supuestos contextualizados
    advantages = list(winner_spec.advantages) + [
        (
            f"Bajo el escenario simulado mantiene {winner.cpu_usage_pct:.1f}% de uso estimado de CPU, "
            f"{winner.ram_usage_mb:.1f} MB de huella de RAM y tasa de error de {winner.error_rate_pct:.2f}%."
        )
    ]

    limitations = list(winner_spec.limitations)
    if winner.utilization > 0.80:
        limitations.append(
            f"Precaución operativa: la utilización actual ({winner.utilization_pct:.1f}%) ya supera el "
            f"umbral del 80%, donde el encolamiento no lineal comienza a amplificar la latencia de cola."
        )

    assumptions = list(winner_spec.assumptions) + [
        (
            f"Ventana activa de alistamiento y despacho matutino W = {int(W)} s (30 min) con promedio "
            f"de {1.5:.1f} optimizaciones TSP por ruta sobre 26 días operativos al mes en Colombia."
        ),
        (
            "Complejidad empírica del solver Google OR-Tools (matriz Haversine + GUIDED_LOCAL_SEARCH) "
            "modelada como phi_tsp = (N_p / 30)^1.85 y factor de encolamiento tipo Pollaczek-Khinchine."
        ),
    ]

    model_disclaimer = (
        "AVISO METODOLÓGICO: Todos los indicadores reportados (latencia en ms, throughput en req/s, "
        "disponibilidad %, consumo de CPU/RAM y facturación mensual en USD) corresponden a "
        "estimaciones matemáticas deterministas producidas por ecuaciones analíticas de teoría de "
        "colas, confiabilidad en paralelo y factores de calibración extraídos de literatura "
        "científica (Sunardi & Suharjito 2019; Tapia et al. 2020; Blinowski et al. 2022; Al-Debagy "
        "& Martinek 2018). NO constituyen mediciones físicas en tiempo real ni benchmarks empíricos "
        "ejecutados sobre infraestructura productiva."
    )

    real_world_validation_steps = [
        (
            "Pruebas de carga y estrés reproducibles con Apache JMeter (o Locust/k6): diseñar planes "
            "de prueba que inyecten concurrencia escalonada sobre los endpoints reales de EnRuta "
            "(`POST /api/v1/ocr` con fotografías reales de guías de Servientrega/Interrapidísimo, "
            "`POST /api/v1/routes/{id}/optimize` con 30–120 coordenadas de Bogotá y `PUT /api/v1/stops/{id}/estado`)."
        ),
        (
            "Despliegue de topologías contenerizadas con Docker en entorno cloud controlado: instanciar "
            "cada arquitectura candidata en nodos aislados con cuotas idénticas de vCPU, memoria cgroups "
            "y red en AWS/GCP/DigitalOcean, evitando interferencia de procesos locales."
        ),
        (
            "Instrumentación APM y telemetría continua (New Relic, Prometheus + Grafana + cAdvisor y "
            "OpenTelemetry): capturar métricas reales de latencia percentil (p50, p95, p99), tiempo de "
            "bloqueo del event loop de Uvicorn, consumo de CPU/RAM por contenedor y throughput de PostgreSQL."
        ),
        (
            "Rigor estadístico mediante mediana de múltiples corridas independientes: ejecutar fases "
            "previas de calentamiento (warm-up) para estabilizar cachés/JIT/contenedores efímeros, "
            "repetir al menos 10 a 30 corridas por nivel de carga y reportar mediana, rango intercuartílico "
            "(IQR) e intervalos de confianza al 95%."
        ),
    ]

    return {
        "winner_id": winner.id,
        "winner_name": winner.name,
        "winner_short_name": winner.short_name,
        "winner_score": winner.final_score,
        "all_constraints_met": winner.meets_all_constraints,
        "summary_rationale": summary_rationale,
        "detailed_reasons": detailed_reasons,
        "rejected_alternatives": rejected_alternatives,
        "advantages": advantages,
        "limitations": limitations,
        "assumptions": assumptions,
        "model_disclaimer": model_disclaimer,
        "real_world_validation_steps": real_world_validation_steps,
    }


def run_full_simulation(
    sim_input: SimulationInput | None = None,
    project_config: ProjectConfig | None = None,
) -> dict[str, Any]:
    """
    Ejecuta el ciclo completo de evaluación matemática, frontera de Pareto, validación de
    restricciones duras, puntuación multicriterio Min-Max con penalizaciones, curvas de
    barrido (conductores e instancias) y generación de recomendación explicable.
    """
    active_input = sim_input if sim_input is not None else SimulationInput()
    active_config = project_config if project_config is not None else ProjectConfig()

    specs = get_all_architectures()
    metrics_list: list[ArchitectureMetrics] = [
        evaluate_architecture(spec, active_input, active_config) for spec in specs
    ]

    # 1. Frontera de Pareto
    compute_pareto_frontier(metrics_list)
    pareto_info = get_pareto_analysis(metrics_list)

    # 2. Verificación de restricciones duras por arquitectura
    for m in metrics_list:
        m.meets_budget = m.monthly_cost_usd <= active_config.max_budget_usd
        m.meets_latency = m.latency_ms <= active_config.max_latency_ms
        m.meets_availability = m.availability_pct >= active_config.min_availability_pct
        m.meets_capacity = m.utilization <= 1.05
        m.meets_all_constraints = (
            m.meets_budget
            and m.meets_latency
            and m.meets_availability
            and m.meets_capacity
        )

    # 3. Normalización Min-Max entre las 4 alternativas evaluadas
    u_latency = _min_max_utility([m.latency_ms for m in metrics_list], lower_is_better=True)
    u_cost = _min_max_utility([m.monthly_cost_usd for m in metrics_list], lower_is_better=True)
    u_throughput = _min_max_utility(
        [m.throughput_req_s for m in metrics_list], lower_is_better=False
    )
    u_scalability = _min_max_utility(
        [m.scalability_score for m in metrics_list], lower_is_better=False
    )
    u_availability = _min_max_utility(
        [m.availability_pct for m in metrics_list], lower_is_better=False
    )
    composite_security = [
        0.7 * m.security_score + 0.3 * m.team_operability_score for m in metrics_list
    ]
    u_security = _min_max_utility(composite_security, lower_is_better=False)

    # 4. Normalización de pesos y cálculo de puntaje bruto + penalizaciones
    norm_weights = _normalize_weights(active_config)

    for idx, m in enumerate(metrics_list):
        utilities = {
            "latency": u_latency[idx],
            "throughput": u_throughput[idx],
            "scalability": u_scalability[idx],
            "availability": u_availability[idx],
            "cost": u_cost[idx],
            "security": u_security[idx],
        }
        raw_score = 100.0 * sum(norm_weights[k] * utilities[k] for k in CRITERIA_KEYS)

        budget_penalty = (
            18.0
            + min(
                25.0,
                (
                    (m.monthly_cost_usd - active_config.max_budget_usd)
                    / max(active_config.max_budget_usd, 1.0)
                )
                * 20.0,
            )
            if not m.meets_budget
            else 0.0
        )
        latency_penalty = (
            20.0
            + min(
                25.0,
                (
                    (m.latency_ms - active_config.max_latency_ms)
                    / max(active_config.max_latency_ms, 1.0)
                )
                * 20.0,
            )
            if not m.meets_latency
            else 0.0
        )
        availability_penalty = (
            22.0
            + min(
                20.0,
                (active_config.min_availability_pct - m.availability_pct) * 25.0,
            )
            if not m.meets_availability
            else 0.0
        )
        capacity_penalty = 20.0 if not m.meets_capacity else 0.0

        total_penalty = (
            budget_penalty + latency_penalty + availability_penalty + capacity_penalty
        )
        if raw_score > total_penalty:
            final_score = round(raw_score - total_penalty, 2)
        else:
            # Amortiguación proporcional defensiva: cuando las penalizaciones superan el
            # puntaje bruto (ej. escenarios de alto estrés donde ninguna alternativa cumple
            # el 100% de las restricciones), se aplica un descuento porcentual acotado
            # para que las arquitecturas sigan siendo diferenciables y no colapsen todas a 0.0
            penalty_discount = min(0.88, total_penalty / max(100.0, total_penalty))
            saturation_factor = max(0.12, 1.0 - (m.error_rate_pct / 100.0))
            score_calc = raw_score * (1.0 - penalty_discount) * saturation_factor
            final_score = round(max(0.5, score_calc), 2)

        m.normalized_utilities = {k: round(v, 4) for k, v in utilities.items()}
        m.penalties_breakdown = {
            "budget": round(budget_penalty, 2),
            "latency": round(latency_penalty, 2),
            "availability": round(availability_penalty, 2),
            "capacity": round(capacity_penalty, 2),
        }
        m.raw_score = round(raw_score, 2)
        m.total_penalty = round(total_penalty, 2)
        m.final_score = final_score

    # 5. Ordenamiento de ranking priorizando `(meets_all_constraints, final_score)` descendente
    ranked_metrics = sorted(
        metrics_list,
        key=lambda item: (item.meets_all_constraints, item.final_score, item.raw_score),
        reverse=True,
    )
    for position, m in enumerate(ranked_metrics, start=1):
        m.rank = position

    # 6. Construcción de recomendación explicable
    recommendation = _build_explainable_recommendation(
        ranked_metrics=ranked_metrics,
        sim_input=active_input,
        project_config=active_config,
        norm_weights=norm_weights,
        pareto_info=pareto_info,
    )

    # 7. Curvas de sensibilidad (escalabilidad por conductores y sobre-escalado por instancias)
    driver_sweep = run_driver_sweep(active_input, active_config)
    instance_sweep = run_instance_sweep(active_input, active_config)

    return {
        "sim_input": active_input.to_dict(),
        "project_config": active_config.to_dict(),
        "normalized_weights": {k: round(v, 4) for k, v in norm_weights.items()},
        "architectures": [m.to_dict() for m in metrics_list],
        "ranking": [m.to_dict() for m in ranked_metrics],
        "pareto_frontier": pareto_info,
        "pareto_efficient_ids": pareto_info["efficient_ids"],
        "recommendation": recommendation,
        "driver_sweep": driver_sweep,
        "instance_sweep": instance_sweep,
    }


__all__ = [
    "ARCHITECTURE_ORDER",
    "CRITERIA_KEYS",
    "run_full_simulation",
]
