"""
Esquemas Pydantic v2 con validación rigurosa de dominio logístico para EnRuta (Requisito 10).

Garantiza que ninguna variable operativa ni restricción no funcional fuera de los rangos
físicos, financieros o algorítmicos válidos de EnRuta ingrese al motor matemático:
  - `concurrent_drivers` (U): 1 <= U <= 5000 conductores concurrentes.
  - `ocr_guides_per_driver` (G): 0 <= G <= 150 guías escaneadas por conductor.
  - `stops_per_route` (N_p): 2 <= N_p <= 150 paradas por ruta (Open TSP requiere >= 2 nodos).
  - `compute_instances` (I): 1 <= I <= 20 instancias horizontales.
  - `crud_ops_per_min` (F_crud): 0.5 <= F_crud <= 60.0 operaciones CRUD/swipe por minuto.
  - `max_budget_usd` (B_max): 0.0 <= B_max <= 10000.0 USD/mes.
  - `max_latency_ms` (L_max): 50.0 <= L_max <= 30000.0 ms.
  - `min_availability_pct` (A_min): 90.0 <= A_min <= 99.99 %.
  - `team_size` (E_team): 1 <= E_team <= 50 desarrolladores.
  - `weights`: cada peso en [0.0, 1.0] y suma estrictamente > 0.0.
"""

from __future__ import annotations

from typing import Annotated, Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.engine import DecisionWeights, ProjectConfig, SimulationInput

# Mensajes orientativos en español por campo para enriquecer respuestas HTTP 422
FIELD_DOMAIN_HINTS: dict[str, str] = {
    "concurrent_drivers": (
        "Conductores concurrentes (U) debe ser un entero entre 1 y 5,000."
    ),
    "ocr_guides_per_driver": (
        "Guías OCR por conductor (G) debe ser un entero entre 0 y 150."
    ),
    "stops_per_route": (
        "Paradas por ruta (N_p) debe ser un entero entre 2 y 150 "
        "(el solver Open TSP de OR-Tools requiere mínimo 2 puntos)."
    ),
    "compute_instances": (
        "Instancias de cómputo (I) debe ser un entero entre 1 y 20."
    ),
    "crud_ops_per_min": (
        "Operaciones CRUD/swipe por minuto (F_crud) debe estar entre 0.5 y 60.0."
    ),
    "project_name": (
        "El nombre del proyecto debe contener entre 2 y 160 caracteres."
    ),
    "project_domain": (
        "El dominio del proyecto debe contener entre 2 y 240 caracteres."
    ),
    "target_users_description": (
        "La descripción de usuarios objetivo debe contener entre 2 y 300 caracteres."
    ),
    "expected_users": (
        "Los usuarios previstos (expected_users) deben ser un entero entre 1 y 50,000."
    ),
    "max_budget_usd": (
        "El presupuesto mensual máximo (B_max) debe estar entre $0.0 y $10,000.0 USD/mes."
    ),
    "max_latency_ms": (
        "La latencia máxima permitida (L_max) debe estar entre 50.0 y 30,000.0 ms."
    ),
    "min_availability_pct": (
        "La disponibilidad mínima SLA (A_min) debe estar entre 90.0% y 99.99%."
    ),
    "team_size": (
        "El tamaño del equipo (team_size) debe ser un entero entre 1 y 50 personas."
    ),
    "require_encryption": (
        "El indicador de cifrado obligatorio (require_encryption) debe ser booleano (true/false)."
    ),
    "weights": (
        "Cada peso multicriterio debe estar en [0.0, 1.0] y la suma total debe ser mayor a cero."
    ),
    "latency": "El peso de latencia debe estar entre 0.0 y 1.0 (no negativo).",
    "throughput": "El peso de throughput debe estar entre 0.0 y 1.0 (no negativo).",
    "scalability": "El peso de escalabilidad debe estar entre 0.0 y 1.0 (no negativo).",
    "availability": "El peso de disponibilidad debe estar entre 0.0 y 1.0 (no negativo).",
    "cost": "El peso de costo mensual debe estar entre 0.0 y 1.0 (no negativo).",
    "security": "El peso de seguridad/operabilidad debe estar entre 0.0 y 1.0 (no negativo).",
    "driver_points": (
        "Cada punto de barrido de conductores (driver_points) debe ser un entero entre 1 y 5,000."
    ),
    "instance_points": (
        "Cada punto de barrido de instancias (instance_points) debe ser un entero entre 1 y 20."
    ),
}


def _reject_bool_as_number(value: Any) -> Any:
    """Evita que valores booleanos (`True`/`False`) sean interpretados como `1`/`0`."""
    if isinstance(value, bool):
        raise ValueError("Se esperaba un valor numérico válido, no un booleano.")
    return value


class HealthResponseSchema(BaseModel):
    """Esquema de respuesta del endpoint de salud del contenedor."""

    status: str = Field(default="ok", examples=["ok"])
    service: str = Field(
        default="enruta-architecture-simulator",
        examples=["enruta-architecture-simulator"],
    )
    version: str = Field(default="1.0.0", examples=["1.0.0"])


class DecisionWeightsSchema(BaseModel):
    """Pesos de decisión multicriterio (MCDA) configurables por el arquitecto."""

    model_config = ConfigDict(str_strip_whitespace=True)

    latency: float = Field(
        default=0.25,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Peso relativo del tiempo de respuesta / latencia (0.0 a 1.0).",
    )
    throughput: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Peso relativo del rendimiento efectivo en peticiones/s (0.0 a 1.0).",
    )
    scalability: float = Field(
        default=0.20,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Peso relativo de la capacidad de escalamiento horizontal (0.0 a 1.0).",
    )
    availability: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Peso relativo de la disponibilidad SLA (0.0 a 1.0).",
    )
    cost: float = Field(
        default=0.15,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Peso relativo de la economía en facturación mensual USD (0.0 a 1.0).",
    )
    security: float = Field(
        default=0.10,
        ge=0.0,
        le=1.0,
        allow_inf_nan=False,
        description="Peso relativo de seguridad, cifrado e idoneidad operativa DevOps (0.0 a 1.0).",
    )

    @field_validator(
        "latency",
        "throughput",
        "scalability",
        "availability",
        "cost",
        "security",
        mode="before",
    )
    @classmethod
    def _validate_numeric_weight(cls, value: Any) -> Any:
        return _reject_bool_as_number(value)

    @model_validator(mode="after")
    def validate_positive_weights_sum(self) -> DecisionWeightsSchema:
        """Verifica que al menos un criterio tenga peso estrictamente positivo."""
        total_weight = (
            self.latency
            + self.throughput
            + self.scalability
            + self.availability
            + self.cost
            + self.security
        )
        if total_weight <= 0.0:
            raise ValueError("La suma de los pesos de decisión debe ser mayor a cero.")
        return self

    def to_engine(self) -> DecisionWeights:
        """Convierte el esquema validado al dataclass `DecisionWeights` del motor."""
        return DecisionWeights(
            latency=self.latency,
            throughput=self.throughput,
            scalability=self.scalability,
            availability=self.availability,
            cost=self.cost,
            security=self.security,
        )


class ProjectConfigSchema(BaseModel):
    """Perfil estratégico, restricciones duras SLA/presupuesto y pesos del proyecto EnRuta."""

    model_config = ConfigDict(str_strip_whitespace=True)

    project_name: str = Field(
        default="EnRuta - Optimización Logística de Última Milla (Bogotá D.C.)",
        min_length=2,
        max_length=160,
        description="Nombre descriptivo del sistema bajo evaluación arquitectónica.",
    )
    project_domain: str = Field(
        default="Logística urbana, OCR multimodal de guías y ruteo TSP (OR-Tools)",
        min_length=2,
        max_length=240,
        description="Dominio funcional y tecnológico del proyecto.",
    )
    target_users_description: str = Field(
        default="Conductores y mensajeros urbanos en Bogotá D.C. (30 a 80 paradas diarias)",
        min_length=2,
        max_length=300,
        description="Perfil operativo de los usuarios finales del sistema.",
    )
    expected_users: int = Field(
        default=50,
        ge=1,
        le=50000,
        description="Volumen proyectado de usuarios activos del proyecto (1 a 50,000).",
    )
    max_budget_usd: float = Field(
        default=25.0,
        ge=0.0,
        le=10000.0,
        allow_inf_nan=False,
        description="Tope máximo mensual de presupuesto cloud en USD/mes (0.0 a 10,000.0).",
    )
    max_latency_ms: float = Field(
        default=1500.0,
        ge=50.0,
        le=30000.0,
        allow_inf_nan=False,
        description="Umbral máximo aceptable de latencia en milisegundos (50.0 a 30,000.0).",
    )
    min_availability_pct: float = Field(
        default=99.0,
        ge=90.0,
        le=99.99,
        allow_inf_nan=False,
        description="Disponibilidad mínima exigida por SLA en porcentaje (90.0 a 99.99).",
    )
    team_size: int = Field(
        default=3,
        ge=1,
        le=50,
        description="Número de ingenieros/desarrolladores responsables de operar el sistema (1 a 50).",
    )
    require_encryption: bool = Field(
        default=True,
        description="Indica si se exige cifrado TLS/en reposo y gestión estricta de secretos.",
    )
    weights: DecisionWeightsSchema = Field(
        default_factory=DecisionWeightsSchema,
        description="Ponderaciones multicriterio para el motor de recomendación.",
    )

    @field_validator(
        "expected_users",
        "max_budget_usd",
        "max_latency_ms",
        "min_availability_pct",
        "team_size",
        mode="before",
    )
    @classmethod
    def _validate_numeric_constraints(cls, value: Any) -> Any:
        return _reject_bool_as_number(value)

    def to_engine(self) -> ProjectConfig:
        """Convierte el esquema validado al dataclass `ProjectConfig` del motor."""
        return ProjectConfig(
            project_name=self.project_name,
            project_domain=self.project_domain,
            target_users_description=self.target_users_description,
            expected_users=self.expected_users,
            max_budget_usd=self.max_budget_usd,
            max_latency_ms=self.max_latency_ms,
            min_availability_pct=self.min_availability_pct,
            team_size=self.team_size,
            require_encryption=self.require_encryption,
            weights=self.weights.to_engine(),
        )


class SimulationInputSchema(BaseModel):
    """Variables operativas de entrada para simular una carga logística puntual en EnRuta."""

    model_config = ConfigDict(str_strip_whitespace=True)

    concurrent_drivers: int = Field(
        default=35,
        ge=1,
        le=5000,
        description="Conductores concurrentes activos en la ventana pico matutina W=1800s (1 a 5,000).",
    )
    ocr_guides_per_driver: int = Field(
        default=30,
        ge=0,
        le=150,
        description="Cantidad de guías físicas escaneadas con OCR por conductor (0 a 150).",
    )
    stops_per_route: int = Field(
        default=30,
        ge=2,
        le=150,
        description="Paradas geocodificadas por ruta para el solver Open TSP de OR-Tools (2 a 150).",
    )
    compute_instances: int = Field(
        default=1,
        ge=1,
        le=20,
        description="Número de instancias lógicas / réplicas horizontales desplegadas (1 a 20).",
    )
    crud_ops_per_min: float = Field(
        default=6.0,
        ge=0.5,
        le=60.0,
        allow_inf_nan=False,
        description="Frecuencia de operaciones CRUD y swipes de estado por minuto por conductor (0.5 a 60.0).",
    )

    @field_validator(
        "concurrent_drivers",
        "ocr_guides_per_driver",
        "stops_per_route",
        "compute_instances",
        "crud_ops_per_min",
        mode="before",
    )
    @classmethod
    def _validate_numeric_inputs(cls, value: Any) -> Any:
        return _reject_bool_as_number(value)

    def to_engine(self) -> SimulationInput:
        """Convierte el esquema validado al dataclass `SimulationInput` del motor."""
        return SimulationInput(
            concurrent_drivers=self.concurrent_drivers,
            ocr_guides_per_driver=self.ocr_guides_per_driver,
            stops_per_route=self.stops_per_route,
            compute_instances=self.compute_instances,
            crud_ops_per_min=self.crud_ops_per_min,
        )


class SimulationRequestSchema(BaseModel):
    """Payload de solicitud para evaluación comparativa completa (`POST /api/v1/simulate`)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    sim_input: SimulationInputSchema = Field(
        default_factory=SimulationInputSchema,
        description="Variables operativas de carga de trabajo de EnRuta.",
    )
    project_config: ProjectConfigSchema = Field(
        default_factory=ProjectConfigSchema,
        description="Configuración de restricciones duras y pesos de decisión del proyecto.",
    )


DriverPointInt = Annotated[int, Field(ge=1, le=5000)]
InstancePointInt = Annotated[int, Field(ge=1, le=20)]


class SweepRequestSchema(BaseModel):
    """Payload de solicitud para curvas de sensibilidad y barrido (`POST /api/v1/simulate/sweep`)."""

    model_config = ConfigDict(str_strip_whitespace=True)

    sim_input: SimulationInputSchema = Field(
        default_factory=SimulationInputSchema,
        description="Carga operativa base sobre la cual se varía conductores o instancias.",
    )
    project_config: ProjectConfigSchema = Field(
        default_factory=ProjectConfigSchema,
        description="Configuración del proyecto para cálculo de seguridad, costos y operabilidad.",
    )
    driver_points: list[DriverPointInt] | None = Field(
        default=None,
        min_length=1,
        max_length=50,
        description="Puntos opcionales de conductores concurrentes (1..5000) para la curva de escalabilidad.",
    )
    instance_points: list[InstancePointInt] | None = Field(
        default=None,
        min_length=1,
        max_length=20,
        description="Puntos opcionales de instancias (1..20) para evaluar sobre-escalado horizontal.",
    )

    @field_validator("driver_points", "instance_points", mode="before")
    @classmethod
    def _reject_bool_items(cls, value: Any) -> Any:
        if isinstance(value, list):
            for item in value:
                _reject_bool_as_number(item)
        return value
