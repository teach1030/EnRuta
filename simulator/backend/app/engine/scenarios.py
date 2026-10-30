"""
Catálogo de escenarios logísticos preconfigurados de EnRuta (Bogotá D.C. y Colombia).

Incluye 1 escenario base de referencia (`REF_MVP_BOGOTA`) y 5 escenarios de ejecución
(`PEAK_MORNING_OCR`, `HEAVY_TSP_ROUTES`, `NATIONAL_SCALE_SLA`, `OVERSCALING_SIMPLE_SWIPE`
y `PILOT_CHAPINERO_LOW_LATENCY`), diseñados para demostrar empírica y pedagógicamente cómo
cambia la arquitectura óptima según el perfil de carga operativa, las restricciones no
funcionales y los fenómenos descritos por Sunardi & Suharjito (2019), Tapia et al. (2020),
Blinowski et al. (2022) y Al-Debagy & Martinek (2018).
"""

from __future__ import annotations

from copy import deepcopy
from dataclasses import asdict, dataclass
from typing import Any

from .decision_maker import run_full_simulation
from .math_model import ProjectConfig, SimulationInput


@dataclass(frozen=True)
class ScenarioPreset:
    """Especificación inmutable de un escenario logístico preconfigurado de EnRuta."""

    id: str
    name: str
    short_name: str
    category: str  # "reference" | "execution"
    is_reference: bool
    description: str
    bogota_context: str
    sim_input: SimulationInput
    project_config_overrides: dict[str, Any]
    expected_insight: str
    expected_winner_id: str
    paper_focus: str

    def to_dict(self) -> dict[str, Any]:
        """Serializa el escenario preconfigurado a diccionario JSON-compatible."""
        payload = asdict(self)
        payload["project_config_overrides"] = deepcopy(self.project_config_overrides)
        return payload


SCENARIO_ORDER: list[str] = [
    "REF_MVP_BOGOTA",
    "PEAK_MORNING_OCR",
    "HEAVY_TSP_ROUTES",
    "NATIONAL_SCALE_SLA",
    "OVERSCALING_SIMPLE_SWIPE",
    "PILOT_CHAPINERO_LOW_LATENCY",
]


_REF_MVP_BOGOTA = ScenarioPreset(
    id="REF_MVP_BOGOTA",
    name="Referencia MVP — Operación Diaria Estándar en Bogotá D.C.",
    short_name="Referencia MVP Bogotá",
    category="reference",
    is_reference=True,
    description=(
        "Línea base oficial del MVP de EnRuta: 35 mensajeros concurrentes despachando rutas "
        "urbanas de 30 paradas con escaneo de 30 guías físicas por jornada, presupuesto "
        "semilla estricto de $25 USD/mes y equipo fundador de 3 desarrolladores."
    ),
    bogota_context=(
        "Salida matutina (7:00 a.m.) desde bodegas logísticas de Puente Aranda y Montevideo "
        "hacia zonas residenciales y empresariales de Chapinero, Teusaquillo, Usaquén y "
        "Kennedy. Los conductores digitalizan etiquetas de Servientrega, Coordinadora e "
        "Interrapidísimo con abreviaturas bogotanas (`Cll`, `Kra`, `Dg`, `Tv`, `Torre/Apto`) "
        "y confirman entregas multi-cliente por portería."
    ),
    sim_input=SimulationInput(
        concurrent_drivers=35,
        ocr_guides_per_driver=30,
        stops_per_route=30,
        compute_instances=1,
        crud_ops_per_min=6.0,
    ),
    project_config_overrides={
        "expected_users": 50,
        "max_budget_usd": 25.0,
        "max_latency_ms": 1500.0,
        "min_availability_pct": 99.0,
        "team_size": 3,
        "require_encryption": True,
        "weights": {
            "latency": 0.25,
            "throughput": 0.15,
            "scalability": 0.20,
            "availability": 0.15,
            "cost": 0.15,
            "security": 0.10,
        },
    },
    expected_insight=(
        "Bajo presupuesto semilla ($25 USD/mes) y equipo compacto (3 ingenieros), las "
        "arquitecturas contenerizadas multi-nodo (`MONO_ASYNC_CONTAINER` con $30.82 USD y "
        "`MICRO_DOCKER` con $48.83 USD) quedan descartadas por violación presupuestal. "
        "`HYBRID_EDGE_SERVERLESS` lidera ($4.59 USD/mes, 99.55% disponibilidad) al delegar el "
        "85% del OCR a ML Kit en el teléfono Android y escalar a cero en horas nocturnas, "
        "seguida de `MONO_MVP` ($18.82 USD/mes), que ofrece la menor latencia pura (100.80 ms) "
        "al carecer de saltos IPC."
    ),
    expected_winner_id="HYBRID_EDGE_SERVERLESS",
    paper_focus="Sunardi & Suharjito (2019); Castro et al. (2019) — Eficiencia en etapa temprana vs sobrecosto de microservicios.",
)


_PEAK_MORNING_OCR = ScenarioPreset(
    id="PEAK_MORNING_OCR",
    name="Pico Matutino 6:30 AM — Ráfaga Masiva de Escaneo OCR en Bodega",
    short_name="Pico Matutino OCR",
    category="execution",
    is_reference=False,
    description=(
        " Ventana intensa de cargue donde 85 conductores escanean simultáneamente un lote "
        "pesado de 70 guías físicas cada uno (~154.700 guías/mes) antes de iniciar recorrido, "
        "con baja actividad CRUD en ruta pero alta exigencia de respuesta en cámara (< 400 ms) "
        "y tope financiero de $45 USD/mes."
    ),
    bogota_context=(
        "Centros de consolidación cercanos al Aeropuerto El Dorado (Fontibón / Calle 26) "
        "durante picos de paquetería asiática y nacional (J&T Express, iMile, Envía). Decenas "
        "de motorizados fotografían etiquetas térmicas arrugadas bajo techos industriales con "
        "cobertura celular 4G saturada antes de distribuirse por la Av. Boyacá y Calle 80."
    ),
    sim_input=SimulationInput(
        concurrent_drivers=85,
        ocr_guides_per_driver=70,
        stops_per_route=30,
        compute_instances=1,
        crud_ops_per_min=2.5,
    ),
    project_config_overrides={
        "expected_users": 85,
        "max_budget_usd": 45.0,
        "max_latency_ms": 400.0,
        "min_availability_pct": 99.4,
        "team_size": 3,
        "require_encryption": True,
        "weights": {
            "latency": 0.30,
            "throughput": 0.15,
            "scalability": 0.15,
            "availability": 0.15,
            "cost": 0.15,
            "security": 0.10,
        },
    },
    expected_insight=(
        "Cuando el volumen de guías se dispara (`U * G = 5.950` guías cada 30 min), enviar el "
        "100% de las fotografías a Gemini Vision (`theta_cloud_ocr = 1.0`) eleva el costo "
        "mensual de las tres arquitecturas cloud por encima de $50–$80 USD/mes y duplica la "
        "latencia ponderada (~196–213 ms). `HYBRID_EDGE_SERVERLESS` domina ampliamente "
        "(116.58 ms, $18.77 USD/mes) al ejecutar ML Kit Text Recognition + normalización "
        "regex de Bogotá directamente en el dispositivo móvil."
    ),
    expected_winner_id="HYBRID_EDGE_SERVERLESS",
    paper_focus="Satyanarayanan (2017); Tapia et al. (2020) — Descarga de cómputo intensivo de visión hacia el Edge.",
)


_HEAVY_TSP_ROUTES = ScenarioPreset(
    id="HEAVY_TSP_ROUTES",
    name="Rutas Densas (115 Paradas) — Estrés Combinatorio TSP OR-Tools",
    short_name="Rutas Pesadas TSP",
    category="execution",
    is_reference=False,
    description=(
        "Operación consolidada de 95 conductores con rutas densas de 115 paradas geocodificadas "
        "y re-optimizaciones frecuentes sobre 2 instancias, presupuesto PyME de $75 USD/mes, "
        "SLA de latencia <= 420 ms y disponibilidad >= 99.5% con un equipo de 3 ingenieros."
    ),
    bogota_context=(
        " Distribución capilar de e-commerce en edificios multifamiliares de Cedritos, Colina "
        "Campestre, Chicó y Ciudad Salitre, donde cada furgoneta atiende más de 100 ubicaciones "
        "y recalcula secuencias Open TSP con OR-Tools ante cierres viales o bloqueos sobre la "
        "Autopista Norte, NQS y Av. Circunvalar."
    ),
    sim_input=SimulationInput(
        concurrent_drivers=95,
        ocr_guides_per_driver=35,
        stops_per_route=115,
        compute_instances=2,
        crud_ops_per_min=7.5,
    ),
    project_config_overrides={
        "expected_users": 95,
        "max_budget_usd": 75.0,
        "max_latency_ms": 420.0,
        "min_availability_pct": 99.5,
        "team_size": 3,
        "require_encryption": True,
        "weights": {
            "latency": 0.30,
            "throughput": 0.15,
            "scalability": 0.15,
            "availability": 0.15,
            "cost": 0.15,
            "security": 0.10,
        },
    },
    expected_insight=(
        "Al subir a `N_p = 115` paradas, la complejidad Haversine + `GUIDED_LOCAL_SEARCH` "
        "escala superlinealmente (`phi_tsp = 12.02x`). `HYBRID_EDGE_SERVERLESS` sufre una "
        "severa penalización de cold-start para contenedores pesados > 80 paradas (610.11 ms > "
        "420 ms) y sobrecosto por tiempo de cómputo ($214.46 USD). `MONO_MVP` incumple la "
        "disponibilidad (99.20% < 99.5%) por su nodo único, y `MICRO_DOCKER` rebasa el "
        "presupuesto PyME ($87.61 > $75 USD). Gana `MONO_ASYNC_CONTAINER` ($63.61 USD, "
        "116.94 ms, 99.99% disponibilidad), aislando OR-Tools en workers Redis sin sobrecosto "
        "de malla de microservicios."
    ),
    expected_winner_id="MONO_ASYNC_CONTAINER",
    paper_focus="Blinowski et al. (2022); Al-Debagy & Martinek (2018) — Desacoplamiento asíncrono pragmático de CPU pesada.",
)


_NATIONAL_SCALE_SLA = ScenarioPreset(
    id="NATIONAL_SCALE_SLA",
    name="Escala Nacional Colombia (850 Conductores) — Alta Disponibilidad 99.9%",
    short_name="Escala Nacional SLA",
    category="execution",
    is_reference=False,
    description=(
        "Despliegue corporativo multi-ciudad con 850 conductores activos simultáneos, rutas "
        "de 65 paradas, alta frecuencia transaccional CRUD (12 ops/min) sobre 6 instancias, "
        "SLA empresarial estricto (>= 99.90%), equipo maduro de 8 ingenieros/SREs y presupuesto "
        "corporativo de $650 USD/mes."
    ),
    bogota_context=(
        "Operación logística integrada conectando Bogotá–Sabana (Cota, Tenjo, Funza, Soacha) "
        "con flotas metropolitanas en Medellín (Valle de Aburrá), Cali y Barranquilla durante "
        "campañas de Día sin IVA, CyberLunes y temporada decembrina, con trazabilidad continua "
        "de entregas corporativas."
    ),
    sim_input=SimulationInput(
        concurrent_drivers=850,
        ocr_guides_per_driver=45,
        stops_per_route=65,
        compute_instances=6,
        crud_ops_per_min=12.0,
    ),
    project_config_overrides={
        "expected_users": 850,
        "max_budget_usd": 650.0,
        "max_latency_ms": 900.0,
        "min_availability_pct": 99.90,
        "team_size": 8,
        "require_encryption": True,
        "weights": {
            "latency": 0.20,
            "throughput": 0.20,
            "scalability": 0.25,
            "availability": 0.20,
            "cost": 0.05,
            "security": 0.10,
        },
    },
    expected_insight=(
        "Bajo concurrencia masiva (850 conductores) y `I = 6` nodos (justo en el óptimo previo "
        "a la penalización por sobre-escalado), `MONO_MVP` colapsa por saturación al 130.25% "
        "de capacidad (4.423 ms de latencia, 29.15% de errores y caída SPOF a 98.296%). "
        "`HYBRID_EDGE_SERVERLESS` pierde competitividad económica por facturación variable en "
        "alto volumen continuo ($1.780,68 USD/mes). `MICRO_DOCKER` gana con solvencia "
        "(99.09/100, utilización 26.09%, disponibilidad 99.99%, aislamiento 0.95) respaldado "
        "por un equipo de 8 ingenieros capaz de absorber su complejidad DevOps."
    ),
    expected_winner_id="MICRO_DOCKER",
    paper_focus="Al-Debagy & Martinek (2018); Tapia et al. (2020) — Dominio de microservicios bajo alta concurrencia y SLA crítico.",
)


_OVERSCALING_SIMPLE_SWIPE = ScenarioPreset(
    id="OVERSCALING_SIMPLE_SWIPE",
    name="Sobre-escalado Horizontal (15 Instancias) en Swipes CRUD — Efecto Blinowski",
    short_name="Sobre-escalado CRUD",
    category="execution",
    is_reference=False,
    description=(
        "Anti-patrón de aprovisionamiento: flota pequeña de 45 conductores en turno vespertino "
        "ejecutando casi exclusivamente confirmaciones rápidas de estado por swipe (14 ops/min, "
        "apenas 5 guías OCR y 20 paradas), pero desplegada erróneamente sobre 15 instancias "
        "con un equipo pequeño de 2 desarrolladores y exigencia de respuesta instantánea (<= 160 ms)."
    ),
    bogota_context=(
        "Franja de la tarde (2:30 p.m. – 5:30 p.m.) en barrios residenciales de Suba, Engativá "
        "y Bosa: las rutas ya están calculadas desde la mañana y los mensajeros solo deslizan "
        "tarjetas (`Swipeable` -> `PUT /api/v1/stops/{id}/estado`) frente a cada portería tras "
        "entregar los paquetes."
    ),
    sim_input=SimulationInput(
        concurrent_drivers=45,
        ocr_guides_per_driver=5,
        stops_per_route=20,
        compute_instances=15,
        crud_ops_per_min=14.0,
    ),
    project_config_overrides={
        "expected_users": 45,
        "max_budget_usd": 210.0,
        "max_latency_ms": 160.0,
        "min_availability_pct": 99.0,
        "team_size": 2,
        "require_encryption": True,
        "weights": {
            "latency": 0.35,
            "throughput": 0.10,
            "scalability": 0.10,
            "availability": 0.10,
            "cost": 0.25,
            "security": 0.10,
        },
    },
    expected_insight=(
        "Ilustra directamente el hallazgo de Blinowski, Ojdowska & Przybyłek (2022): escalar "
        "horizontalmente a `I = 15` réplicas (`I > 6`) activa la penalización cuadrática de "
        "coordinación (`over_scale_factor`), multiplica los contenedores activos en "
        "`MICRO_DOCKER` (75 contenedores, $379.46 USD/mes, +53.4 ms solo en IPC) y "
        "`MONO_ASYNC_CONTAINER` (45 contenedores, $277.46 USD/mes), violando presupuesto y "
        "degradando superficie de seguridad. En operaciones simples sin contención de CPU, "
        "`MONO_MVP` logra 60.09 ms (0 ms IPC) y evidencia que escalar instancias sin cuello de "
        "botella real destruye eficiencia costo-rendimiento."
    ),
    expected_winner_id="MONO_MVP",
    paper_focus="Blinowski, Ojdowska & Przybyłek (2022) — Degradación por coordinación y sobre-escalado horizontal en cargas simples.",
)


_PILOT_CHAPINERO_LOW_LATENCY = ScenarioPreset(
    id="PILOT_CHAPINERO_LOW_LATENCY",
    name="Piloto Hiperlocal Chapinero–Usaquén — Latencia Ultra-Baja In-Process",
    short_name="Piloto Hiperlocal",
    category="execution",
    is_reference=False,
    description=(
        "Operación hiperlocal dedicada de entregas rápidas (dark-stores y farmacias urbanas) "
        "con 20 motorizados, rutas cortas de 18 paradas, 15 guías por turno, presupuesto "
        "acotado de $22 USD/mes, 2 desarrolladores y requisito estricto de latencia <= 115 ms."
    ),
    bogota_context=(
        "Entregas exprés de última hora en el corredor financiero y gastronómico de Calle 72 a "
        "Calle 127 (Chapinero Alto, Rosales, Parque de la 93 y Santa Bárbara), donde cada "
        "despacho agrupa pocas paradas cercanas y prioriza respuesta inmediata sin arranques "
        "en frío."
    ),
    sim_input=SimulationInput(
        concurrent_drivers=20,
        ocr_guides_per_driver=15,
        stops_per_route=18,
        compute_instances=1,
        crud_ops_per_min=8.0,
    ),
    project_config_overrides={
        "expected_users": 20,
        "max_budget_usd": 22.0,
        "max_latency_ms": 115.0,
        "min_availability_pct": 99.0,
        "team_size": 2,
        "require_encryption": True,
        "weights": {
            "latency": 0.40,
            "throughput": 0.10,
            "scalability": 0.10,
            "availability": 0.10,
            "cost": 0.20,
            "security": 0.10,
        },
    },
    expected_insight=(
        "En un piloto hiperlocal pequeño (20 conductores) con umbral estricto de latencia "
        "(<= 115 ms), la sobrecarga de cold-start de `HYBRID_EDGE_SERVERLESS` ante baja "
        "concurrencia (`180 / (1 + 0.08 * 20) = 69.23 ms` extra) la hace exceder el límite de "
        "115 ms, mientras que `MONO_ASYNC_CONTAINER` y `MICRO_DOCKER` superan los $22 USD/mes. "
        "`MONO_MVP` resulta ganadora indiscutible (~78 ms, $13.95 USD/mes), confirmando la "
        "tesis de Sunardi & Suharjito (2019) para sistemas compactos de baja concurrencia."
    ),
    expected_winner_id="MONO_MVP",
    paper_focus="Sunardi & Suharjito (2019) — Superioridad del monolito ligero en baja concurrencia y latencia estricta.",
)


SCENARIOS: dict[str, ScenarioPreset] = {
    _REF_MVP_BOGOTA.id: _REF_MVP_BOGOTA,
    _PEAK_MORNING_OCR.id: _PEAK_MORNING_OCR,
    _HEAVY_TSP_ROUTES.id: _HEAVY_TSP_ROUTES,
    _NATIONAL_SCALE_SLA.id: _NATIONAL_SCALE_SLA,
    _OVERSCALING_SIMPLE_SWIPE.id: _OVERSCALING_SIMPLE_SWIPE,
    _PILOT_CHAPINERO_LOW_LATENCY.id: _PILOT_CHAPINERO_LOW_LATENCY,
}


def get_all_scenarios() -> list[ScenarioPreset]:
    """Retorna todos los escenarios preconfigurados en el orden canónico `SCENARIO_ORDER`."""
    return [SCENARIOS[scenario_id] for scenario_id in SCENARIO_ORDER]


def get_scenario(scenario_id: str) -> ScenarioPreset:
    """Obtiene un escenario por su identificador o lanza `KeyError` descriptivo."""
    if scenario_id not in SCENARIOS:
        valid = ", ".join(SCENARIO_ORDER)
        raise KeyError(
            f"Escenario desconocido '{scenario_id}'. Escenarios válidos: {valid}"
        )
    return SCENARIOS[scenario_id]


def serialize_scenario(scenario: ScenarioPreset) -> dict[str, Any]:
    """Serializa un `ScenarioPreset` a un diccionario listo para respuesta JSON."""
    return scenario.to_dict()


def build_scenario_config(
    scenario_id: str,
    base_config: ProjectConfig | None = None,
) -> tuple[SimulationInput, ProjectConfig]:
    """
    Construye la tupla `(SimulationInput, ProjectConfig)` lista para ejecutar un escenario
    aplicando sus `project_config_overrides` sobre `base_config` (o `ProjectConfig()`).
    """
    preset = get_scenario(scenario_id)
    sim_input = SimulationInput.from_dict(preset.sim_input.to_dict())
    project_config = ProjectConfig.from_dict(
        preset.project_config_overrides,
        base=base_config if base_config is not None else ProjectConfig(),
    )
    return sim_input, project_config


def run_scenario(scenario_id: str) -> dict[str, Any]:
    """Ejecuta `run_full_simulation` directamente para el `scenario_id` solicitado."""
    preset = get_scenario(scenario_id)
    sim_input, project_config = build_scenario_config(scenario_id)
    simulation_result = run_full_simulation(sim_input=sim_input, project_config=project_config)
    return {
        "scenario": preset.to_dict(),
        "simulation": simulation_result,
    }


__all__ = [
    "SCENARIOS",
    "SCENARIO_ORDER",
    "ScenarioPreset",
    "build_scenario_config",
    "get_all_scenarios",
    "get_scenario",
    "run_scenario",
    "serialize_scenario",
]
