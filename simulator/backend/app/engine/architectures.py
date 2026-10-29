"""
Catálogo parametrizado de las 4 alternativas arquitectónicas de EnRuta.

Define las especificaciones cuantitativas y cualitativas calibradas a partir de:
  1. La implementación real del MVP de EnRuta (`backend/app/` y `mobile/src/`):
     - `drivers.py`: Autenticación JWT dual (email/celular), Google OAuth2 y modo Guest.
     - `stops.py` + `stop_service.py`: CRUD transaccional multi-cliente (`Stop` 1:N `StopClient`).
     - `normalization.py`: Motor regex de nomenclatura vial y complementos de Bogotá D.C.
     - `ocr.py` + `geocoding.py`: Extracción multimodal con Gemini Vision y Mapbox Geocoding v6.
     - `routing.py` + `routes.py`: Matriz Haversine N×N y solver Open TSP con Google OR-Tools
       (`PATH_CHEAPEST_ARC` + `GUIDED_LOCAL_SEARCH` con nodo dummy depot).
  2. Literatura científica comparativa sobre arquitecturas monolíticas, contenerizadas,
     microservicios Docker y cómputo híbrido Edge + Serverless:
     - Sunardi & Suharjito (2019), Procedia Computer Science.
     - Tapia et al. (2020), Applied Sciences.
     - Blinowski, Ojdowska & Przybyłek (2022), IEEE Access.
     - Al-Debagy & Martinek (2018), IEEE CINTI.
     - Castro et al. (2019), Communications of the ACM (Serverless Computing).
     - Satyanarayanan (2017), IEEE Computer (The Emergence of Edge Computing).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any


@dataclass(frozen=True)
class ArchitectureSpec:
    """Especificación inmutable de una alternativa arquitectónica para EnRuta."""

    id: str
    name: str
    short_name: str
    subtitle: str
    description: str
    enruta_mapping: str
    paper_references: list[str]
    mu_0: float
    eta: float
    beta_coord: float
    theta_cloud_ocr: float
    c_crud: float
    c_ocr: float
    c_tsp: float
    l_base: float
    l_ipc_base: float
    l_ipc_per_inst: float
    tau_crud: float
    tau_ocr: float
    tau_tsp_base: float
    alpha_tsp: float
    has_serverless_cold_start: bool
    a_0: float
    m_max_avail_nodes: int
    delta_spof: float
    infra_unit_cost: float
    gateway_fixed_cost: float
    ocr_api_unit_cost: float
    is_serverless_pay_per_use: bool
    containers_per_instance: int
    base_ram_mb: float
    ram_per_inst_mb: float
    cpu_overhead_pct: float
    isolation_factor: float
    security_base: float
    devops_complexity: float
    advantages: list[str]
    limitations: list[str]
    assumptions: list[str]
    docker_topology_summary: str
    sample_compose_snippet: str


ARCHITECTURE_ORDER: list[str] = [
    "MONO_MVP",
    "MONO_ASYNC_CONTAINER",
    "MICRO_DOCKER",
    "HYBRID_EDGE_SERVERLESS",
]


_MONO_MVP = ArchitectureSpec(
    id="MONO_MVP",
    name="Monolito Modular Ligero sobre VPS/VM (Arquitectura Actual EnRuta)",
    short_name="Monolito MVP",
    subtitle="Proceso único FastAPI + SQLAlchemy Async + OR-Tools In-Process sobre VPS Linux",
    description=(
        "Arquitectura base actual del MVP de EnRuta desplegada directamente sobre una máquina "
        "virtual ligera (VPS) sin orquestación de contenedores. Todos los dominios funcionales "
        "(autenticación JWT/Google, gestión multi-cliente de paradas, normalización vial de "
        "Bogotá, pipeline multimodal Gemini OCR y optimización combinatoria Open TSP con C++ "
        "OR-Tools) coexisten en el mismo espacio de memoria de un único servicio Uvicorn/FastAPI "
        "conectado a una instancia PostgreSQL."
    ),
    enruta_mapping=(
        "Un solo proceso `uvicorn app.main:app` ejecuta en memoria compartida los routers y "
        "servicios reales de EnRuta: `endpoints/drivers.py` (login dual email/celular, bcrypt y "
        "`verify_oauth2_token` vía `asyncio.to_thread`), `endpoints/stops.py` + `stop_service.py` "
        "(transacciones atómicas `Stop` 1:N `StopClient` sobre `asyncpg`), `utils/normalization.py` "
        "(limpieza regex de `Cll/Kra/Dg/Tv` y desduplicación de `Torre/Interior/Apartamento` en "
        "Bogotá D.C.), `endpoints/ocr.py` (`gemini-3.8-flash` para guías de Servientrega, "
        "Coordinadora, Interrapidísimo, Envía, J&T Express e iMile encadenado a `geocoding.py` "
        "Mapbox v6) y `services/routing.py` (matriz Haversine N×N + `pywrapcp` OR-Tools "
        "`PATH_CHEAPEST_ARC` y `GUIDED_LOCAL_SEARCH` corriendo síncronamente en el mismo worker)."
    ),
    paper_references=[
        "Sunardi & Suharjito (2019) — Monolithic MVC vs Microservices: menor latencia base sin saltos IPC (0 ms) bajo concurrencia baja/moderada.",
        "Tapia et al. (2020) — Eficiencia de CPU/RAM superior del monolito en VM única al evitar sobrecarga de red virtual y serialización entre contenedores.",
        "Blinowski, Ojdowska & Przybyłek (2022) — Mayor throughput por dólar en equipos pequeños y cargas acotadas antes del umbral de contención del proceso.",
        "Al-Debagy & Martinek (2018) — Menor tiempo de respuesta p50/p95 en operaciones CRUD transaccionales locales sin API Gateway intermedio.",
    ],
    mu_0=85.0,
    eta=0.62,
    beta_coord=0.012,
    theta_cloud_ocr=1.0,
    c_crud=1.0,
    c_ocr=4.2,
    c_tsp=26.0,
    l_base=38.0,
    l_ipc_base=0.0,
    l_ipc_per_inst=0.0,
    tau_crud=18.0,
    tau_ocr=320.0,
    tau_tsp_base=95.0,
    alpha_tsp=140.0,
    has_serverless_cold_start=False,
    a_0=0.9920,
    m_max_avail_nodes=1,
    delta_spof=0.018,
    infra_unit_cost=12.0,
    gateway_fixed_cost=0.0,
    ocr_api_unit_cost=0.00025,
    is_serverless_pay_per_use=False,
    containers_per_instance=0,
    base_ram_mb=420.0,
    ram_per_inst_mb=310.0,
    cpu_overhead_pct=4.0,
    isolation_factor=0.15,
    security_base=76.0,
    devops_complexity=18.0,
    advantages=[
        "Latencia IPC nula (l_ipc_base = 0 ms): normalización de Bogotá, validación JWT y joins Stop/StopClient ocurren por llamadas directas en memoria.",
        "Mínima complejidad operativa DevOps (18/100): un único repositorio, una migración Alembic lineal y despliegue directo por systemd/SSH.",
        "Bajo costo fijo predecible (~12 USD/mes por nodo VPS básico) sin cargos fijos de API Gateway ni malla de servicios.",
        "Transacciones ACID inmediatas en PostgreSQL al crear o sincronizar en lote múltiples destinatarios (`StopClient`) de un mismo conjunto residencial.",
    ],
    limitations=[
        "Bloqueo Head-of-Line severo (c_tsp = 26.0): el solver C++ OR-Tools (`GUIDED_LOCAL_SEARCH` en `routing.py`) monopoliza la CPU del worker y degrada los swipes de entrega CRUD.",
        "Punto único de fallo estructural (m_max_avail_nodes = 1, delta_spof = 0.018): una caída por OOM al decodificar fotos de guías de 10 MB derriba toda la plataforma.",
        "Aislamiento de fallos mínimo (isolation_factor = 0.15) y escalamiento vertical/horizontal ineficiente (eta = 0.62) al replicar todo el proceso monolítico.",
        "El 100% de los escaneos OCR viajan a la nube (`theta_cloud_ocr = 1.0`), acoplando el hilo HTTP a la latencia externa de Gemini Vision + Mapbox.",
    ],
    assumptions=[
        "Despliegue sobre VPS Linux (2 vCPU, 2–4 GB RAM) ejecutando Uvicorn con systemd y PostgreSQL 16 compartido o gestionado básico.",
        "Las imágenes de guías (JPG/PNG hasta 10 MB) se leen en memoria RAM del proceso FastAPI antes de invocarse `google-genai`.",
        "El solver TSP utiliza matriz Haversine en memoria con búsqueda local acotada para rutas urbanas de 15 a 80 paradas en Bogotá D.C.",
    ],
    docker_topology_summary=(
        "Sin contenerización productiva (containers_per_instance = 0). Topología en host único: "
        "[App Móvil Expo RN] ──HTTPS──▶ [Nginx TLS Host] ──unix/loopback──▶ "
        "[systemd: uvicorn app.main:app (drivers + stops + normalization + ocr + routing)] "
        "──asyncpg──▶ [PostgreSQL 16]. Sobrecarga de virtualización mínima (4.0% CPU), pero "
        "cero aislamiento de cgroups entre el solver OR-Tools y el API REST."
    ),
    sample_compose_snippet="""\
# MONO_MVP: Despliegue directo en VPS (containers_per_instance = 0)
# Equivalente declarativo de referencia sobre host único (sin aislamiento de workers):
# /etc/systemd/system/enruta-mvp.service
[Unit]
Description=EnRuta FastAPI Monolith MVP (Single VPS Node)
After=network.target postgresql.service

[Service]
User=enruta
WorkingDirectory=/opt/enruta/backend
EnvironmentFile=/opt/enruta/backend/.env
# Todos los módulos (drivers, stops, normalization, ocr, routing OR-Tools)
# comparten el mismo proceso y pool de memoria sin cgroups separados:
ExecStart=/opt/enruta/backend/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=3
""",
)


_MONO_ASYNC_CONTAINER = ArchitectureSpec(
    id="MONO_ASYNC_CONTAINER",
    name="Monolito Contenerizado + Workers Asíncronos (Docker + Cola Redis)",
    short_name="Monolito + Workers",
    subtitle="Monolito modular en Docker con desacoplamiento asíncrono Redis + Workers OCR/TSP",
    description=(
        "Evolución pragmática del monolito de EnRuta empaquetada como una imagen Docker "
        "inmutable multi-stage pero desplegada en tres contenedores especializados por "
        "instancia lógica (`enruta-api`, `enruta-worker` y `redis-broker`). Mantiene una "
        "única base de código y modelo SQLAlchemy unificado, pero extrae del hilo HTTP las "
        "cargas pesadas de visión artificial (`ocr.py`) y optimización combinatoria TSP "
        "(`routing.py`) hacia colas de trabajos asíncronos con límites estrictos de CPU y RAM."
    ),
    enruta_mapping=(
        "La misma imagen `enruta-backend` se instancia con dos entrypoints aislados por Docker "
        "cgroups: (1) `enruta-api` ejecuta `uvicorn` atendiendo sin bloqueos `drivers.py`, "
        "`stops.py` y `normalization.py` sincrónica ligera, publicando tareas pesadas en Redis; "
        "(2) `enruta-worker` (Celery/ARQ) consume colas priorizadas `ocr_vision` (`ocr.py` con "
        "`gemini-3.8-flash` + `geocoding.py` Mapbox) y `tsp_solver` (`routing.py` con C++ "
        "OR-Tools `GUIDED_LOCAL_SEARCH`), notificando el resultado vía estado de job/polling "
        "reactivo a `useRouteStore.ts` en la app móvil React Native."
    ),
    paper_references=[
        "Blinowski, Ojdowska & Przybyłek (2022) — El monolito contenerizado con colas asíncronas preserva cohesión de dominio mientras elimina cuellos de botella síncronos.",
        "Tapia et al. (2020) — Aislamiento por contenedores Docker con sobrecarga moderada de CPU (~7.5%) frente a una topología completa de microservicios.",
        "Sunardi & Suharjito (2019) — Mantener transacciones CRUD dentro de un único esquema relacional evita joins distribuidos y sagas complejas.",
        "Al-Debagy & Martinek (2018) — Reducción drástica de latencia de cola (p95/p99) al segregar cargas intensivas de cómputo mediante paso de mensajes.",
    ],
    mu_0=140.0,
    eta=0.78,
    beta_coord=0.009,
    theta_cloud_ocr=1.0,
    c_crud=1.0,
    c_ocr=3.1,
    c_tsp=11.5,
    l_base=44.0,
    l_ipc_base=9.0,
    l_ipc_per_inst=1.2,
    tau_crud=20.0,
    tau_ocr=270.0,
    tau_tsp_base=85.0,
    alpha_tsp=115.0,
    has_serverless_cold_start=False,
    a_0=0.9945,
    m_max_avail_nodes=3,
    delta_spof=0.008,
    infra_unit_cost=18.0,
    gateway_fixed_cost=6.0,
    ocr_api_unit_cost=0.00025,
    is_serverless_pay_per_use=False,
    containers_per_instance=3,
    base_ram_mb=340.0,
    ram_per_inst_mb=260.0,
    cpu_overhead_pct=7.5,
    isolation_factor=0.62,
    security_base=84.0,
    devops_complexity=45.0,
    advantages=[
        "Elimina el bloqueo del event loop FastAPI: un solver OR-Tools de 70 paradas en `enruta-worker` no afecta los cambios de estado `PUT /stops/{id}/estado` en `enruta-api`.",
        "Reutiliza el 100% del código actual de `backend/app/` y las migraciones Alembic en una sola imagen Docker auditable (`devops_complexity = 45`).",
        "Control granular de cgroups: si un worker sufre OOM procesando lotes de imágenes de guías, Docker lo reinicia sin tumbar las sesiones JWT activas (`isolation_factor = 0.62`).",
        "Reintentos automáticos con exponential backoff en Redis ante fallos transitorios HTTP 429/502 de Gemini API o Mapbox Geocoding.",
    ],
    limitations=[
        "Introduce latencia de serialización/encolamiento en Redis (`l_ipc_base = 9.0 ms`) y requiere manejo asíncrono de estados `PENDING/COMPLETED` en la app Expo.",
        "Base de datos PostgreSQL única sigue siendo compartida entre `enruta-api` y `enruta-worker`, limitando el escalamiento horizontal efectivo (`m_max_avail_nodes = 3`).",
        "Escalar instancias replica el código completo del monolito en cada contenedor aunque solo crezca la demanda de OCR matutino.",
        "Mantiene dependencia total del OCR en nube (`theta_cloud_ocr = 1.0`), conservando el costo variable de API por guía escaneada.",
    ],
    assumptions=[
        "Cada instancia lógica despliega 3 contenedores Docker (`enruta-api`, `enruta-worker`, `redis:7-alpine`) detrás de un balanceador ligero (6 USD/mes).",
        "Las colas separan prioridad alta (OCR interactivo en cámara) de prioridad media (re-optimización completa de ruta TSP).",
        "PostgreSQL opera con pool de conexiones asíncrono (`asyncpg`) dimensionado para absorber escrituras concurrentes de API y workers.",
    ],
    docker_topology_summary=(
        "3 contenedores por instancia lógica (`containers_per_instance = 3`) en red bridge "
        "aislada: [LB / Nginx] ──▶ [enruta-api (FastAPI: drivers, stops, normalization)] "
        "──TCP 6379──▶ [redis-broker (Redis 7 Alpine)] ──▶ [enruta-worker (Workers: ocr "
        "Gemini/Mapbox + routing OR-Tools C++)], ambos persistiendo en [postgres-db]. "
        "Aislamiento de memoria y cuotas CPU independientes entre API interactiva y cómputo pesado."
    ),
    sample_compose_snippet="""\
services:
  enruta-api:
    image: ghcr.io/enruta/backend:1.0-slim
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
    environment:
      REDIS_URL: redis://redis-broker:6379/0
      DATABASE_URL: postgresql+asyncpg://enruta:${DB_PASS}@postgres-db:5432/enruta
    depends_on:
      redis-broker:
        condition: service_healthy
    deploy:
      resources:
        limits:
          cpus: "1.0"
          memory: 512M

  enruta-worker:
    image: ghcr.io/enruta/backend:1.0-slim
    command: ["arq", "app.workers.WorkerSettings", "--queues", "ocr_vision,tsp_solver"]
    environment:
      REDIS_URL: redis://redis-broker:6379/0
      DATABASE_URL: postgresql+asyncpg://enruta:${DB_PASS}@postgres-db:5432/enruta
    deploy:
      resources:
        limits:
          cpus: "1.5"
          memory: 768M

  redis-broker:
    image: redis:7.2-alpine
    command: ["redis-server", "--appendonly", "yes", "--maxmemory", "192mb", "--maxmemory-policy", "noeviction"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 3
""",
)


_MICRO_DOCKER = ArchitectureSpec(
    id="MICRO_DOCKER",
    name="Microservicios Distribuidos Orquestados en Contenedores Docker",
    short_name="Microservicios Docker",
    subtitle="Descomposición por Bounded Contexts (Gateway + Auth + Stops + OCR + TSP OR-Tools)",
    description=(
        "Arquitectura distribuida nativa de contenedores que descompone EnRuta en cinco "
        "servicios autónomos por dominio (`api-gateway`, `ms-auth-drivers`, `ms-stops-bogota`, "
        "`ms-ocr-vision` y `ms-tsp-ortools`) respaldados por persistencia geoespacial "
        "(`postgres-postgis`). Permite escalar elásticamente y de forma independiente los "
        "nodos C++ de optimización OR-Tools o los procesadores de visión artificial durante "
        "los picos de cargue de bodegas en Bogotá sin sobreaprovisionar los servicios CRUD."
    ),
    enruta_mapping=(
        "Desacopla los módulos de `backend/app/` en bounded contexts independientes: "
        "(1) `api-gateway` (enrutamiento L7, rate-limiting y verificación JWT perimetral); "
        "(2) `ms-auth-drivers` (`drivers.py` + `security.py`, cuentas, OAuth2 Google y cuotas Guest); "
        "(3) `ms-stops-bogota` (`stops.py`, `stop_service.py` y `normalization.py` para CRUD "
        "multi-cliente `Stop/StopClient` y estandarización vial de Bogotá); "
        "(4) `ms-ocr-vision` (`ocr.py` + `geocoding.py` con circuit-breakers hacia Gemini y Mapbox); "
        "(5) `ms-tsp-ortools` (`routing.py` compilado en imagen minimalista dedicada a C++ "
        "`pywrapcp` Haversine/Open TSP), persistiendo geometrías y rutas en `postgres-postgis`."
    ),
    paper_references=[
        "Al-Debagy & Martinek (2018) — Alta escalabilidad bajo concurrencia masiva a cambio de penalización de latencia IPC por saltos HTTP/gRPC entre servicios.",
        "Tapia et al. (2020) — Mayor consumo agregado de CPU (~12.5% overhead) y RAM base por duplicación de runtimes en contenedores Docker distribuidos.",
        "Blinowski, Ojdowska & Przybyłek (2022) — Ventaja competitiva en sistemas grandes y heterogéneos, pero sobrecosto de infraestructura y DevOps para startups MVP.",
        "Sunardi & Suharjito (2019) — Aislamiento estricto de fallos por servicio frente al incremento de complejidad en trazabilidad y consistencia eventual.",
    ],
    mu_0=210.0,
    eta=0.92,
    beta_coord=0.008,
    theta_cloud_ocr=1.0,
    c_crud=1.25,
    c_ocr=2.4,
    c_tsp=7.2,
    l_base=52.0,
    l_ipc_base=24.0,
    l_ipc_per_inst=2.1,
    tau_crud=24.0,
    tau_ocr=230.0,
    tau_tsp_base=75.0,
    alpha_tsp=82.0,
    has_serverless_cold_start=False,
    a_0=0.9960,
    m_max_avail_nodes=6,
    delta_spof=0.003,
    infra_unit_cost=24.0,
    gateway_fixed_cost=18.0,
    ocr_api_unit_cost=0.00025,
    is_serverless_pay_per_use=False,
    containers_per_instance=5,
    base_ram_mb=290.0,
    ram_per_inst_mb=220.0,
    cpu_overhead_pct=12.5,
    isolation_factor=0.95,
    security_base=91.0,
    devops_complexity=82.0,
    advantages=[
        "Máxima capacidad de procesamiento y eficiencia de escalado horizontal (`mu_0 = 210.0`, `eta = 0.92`, hasta `m_max_avail_nodes = 6` nodos activos).",
        "Aislamiento de fallos casi total (`isolation_factor = 0.95`, `delta_spof = 0.003`): una saturación en `ms-tsp-ortools` o `ms-ocr-vision` jamás interrumpe `ms-stops-bogota`.",
        "Superficie de seguridad reforzada (`security_base = 91.0`): credenciales `GEMINI_API_KEY` aisladas únicamente en `ms-ocr-vision` y redes internas Zero-Trust.",
        "Optimización específica de runtime: `ms-tsp-ortools` asigna hilos nativos C++ dedicados reduciendo el peso relativo del TSP (`c_tsp = 7.2`, `alpha_tsp = 82.0`).",
    ],
    limitations=[
        "Impuesto severo de red e IPC (`l_ipc_base = 24.0 ms` + `2.1 ms` por instancia): un flujo OCR→Normalización→Creación de Parada atraviesa múltiples saltos HTTP/JSON.",
        "Costo fijo mensual elevado (`infra_unit_cost = 24.0` USD/nodo + `gateway_fixed_cost = 18.0` USD/mes) inviable para presupuestos estudiantiles o etapa semilla sin ingresos.",
        "Complejidad DevOps crítica (`devops_complexity = 82.0`): exige CI/CD multi-imagen, observabilidad distribuida (OpenTelemetry), healthchecks en cascada y consistencia eventual.",
        "Sobrecarga base de memoria y CPU (`cpu_overhead_pct = 12.5%`, 5 contenedores de aplicación por instancia lógica).",
    ],
    assumptions=[
        "Cada instancia lógica orquesta 5 contenedores de dominio (`api-gateway`, `ms-auth-drivers`, `ms-stops-bogota`, `ms-ocr-vision`, `ms-tsp-ortools`) sobre red overlay Docker.",
        "Persistencia desacoplada por esquemas lógicos sobre clúster `postgres-postgis` con pooling PgBouncer.",
        "Comunicación interna REST/HTTP2 con timeouts agresivos y circuit breakers para evitar fallos en cascada.",
    ],
    docker_topology_summary=(
        "5 contenedores de dominio por instancia (`containers_per_instance = 5`) + capa de datos "
        "PostGIS en subredes segmentadas (`edge_net` pública y `mesh_internal` privada): "
        "[App Móvil] ──▶ [api-gateway] ──▶ {[ms-auth-drivers], [ms-stops-bogota], "
        "[ms-ocr-vision], [ms-tsp-ortools]} ──▶ [postgres-postgis]. Aislamiento estricto de "
        "secretos, cgroups dedicados para OR-Tools y alta disponibilidad multi-réplica."
    ),
    sample_compose_snippet="""\
services:
  api-gateway:
    image: nginx:1.27-alpine
    ports: ["443:443"]
    networks: [edge_net, mesh_internal]
    depends_on: [ms-auth-drivers, ms-stops-bogota, ms-ocr-vision, ms-tsp-ortools]

  ms-auth-drivers:
    image: ghcr.io/enruta/ms-auth-drivers:1.0
    networks: [mesh_internal]
    environment:
      JWT_SECRET_KEY: ${JWT_SECRET_KEY}
      GOOGLE_CLIENT_ID: ${GOOGLE_CLIENT_ID}

  ms-stops-bogota:
    image: ghcr.io/enruta/ms-stops-bogota:1.0
    networks: [mesh_internal]
    depends_on:
      postgres-postgis:
        condition: service_healthy

  ms-ocr-vision:
    image: ghcr.io/enruta/ms-ocr-vision:1.0
    networks: [mesh_internal]
    environment:
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      MAPBOX_ACCESS_TOKEN: ${MAPBOX_ACCESS_TOKEN}

  ms-tsp-ortools:
    image: ghcr.io/enruta/ms-tsp-ortools:1.0
    networks: [mesh_internal]
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 512M

  postgres-postgis:
    image: postgis/postgis:16-3.4-alpine
    networks: [mesh_internal]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U enruta -d enruta_geo"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  edge_net:
  mesh_internal:
    internal: true
""",
)


_HYBRID_EDGE_SERVERLESS = ArchitectureSpec(
    id="HYBRID_EDGE_SERVERLESS",
    name="Híbrida Edge Computing (ML Kit On-Device OCR) + Serverless (Zero-Budget)",
    short_name="Edge + Serverless",
    subtitle="OCR y normalización en el teléfono Android (ML Kit) + Backend FaaS/Cloud Run Scale-to-Zero",
    description=(
        "Arquitectura híbrida orientada a costo fijo cero ($0 USD/mes en reposo) que traslada "
        "el 85% del cómputo de visión artificial y normalización de direcciones directamente al "
        "dispositivo móvil del mensajero (Edge Computing con Google ML Kit Text Recognition "
        "on-device sobre Expo/React Native), delegando al backend únicamente funciones "
        "Serverless efímeras con autoescalado a cero (Google Cloud Run / AWS Lambda + Supabase "
        "PostgreSQL Free/Pay-per-use) y reservando Gemini Vision Cloud como fallback para el "
        "15% de guías deterioradas o manuscritas (`theta_cloud_ocr = 0.15`)."
    ),
    enruta_mapping=(
        "En `mobile/` (`Scanner` + `expo-camera`), ML Kit extrae texto en local en ~50 ms y un "
        "port TypeScript de `normalization.py` separa en el borde `Calle/Carrera/Diagonal` y "
        "`Torre/Interior/Apartamento`; solo si la confianza local es < 0.75 (15% de guías "
        "borrosas de Interrapidísimo/Servientrega/iMile) se invoca el endpoint `ocr.py` en la "
        "nube dentro de la capa gratuita de Gemini. Los endpoints `drivers.py`, `stops.py` y el "
        "solver `routing.py` (OR-Tools) corren como contenedores efímeros administrados en "
        "Cloud Run (`min-instances = 0`) conectados por pooler HTTP/Supavisor a PostgreSQL BaaS."
    ),
    paper_references=[
        "Satyanarayanan (2017) — Edge Computing reduce drásticamente la latencia extremo a extremo y el consumo de ancho de banda móvil al procesar imágenes en el dispositivo.",
        "Castro et al. (2019) — Serverless Computing ofrece elasticidad automática y facturación estricta por milisegundo de uso (scale-to-zero), ideal para cargas diurnas intermitentes.",
        "Tapia et al. (2020) & Blinowski et al. (2022) — Marco comparativo de sobrecarga de infraestructura administrada frente a clústeres de contenedores permanentes.",
        "Al-Debagy & Martinek (2018) — Penalización de cola (tail latency p95/p99) asociada a inicialización de entornos efímeros (cold starts) bajo ráfagas de tráfico.",
    ],
    mu_0=165.0,
    eta=0.88,
    beta_coord=0.004,
    theta_cloud_ocr=0.15,
    c_crud=1.1,
    c_ocr=1.2,
    c_tsp=15.5,
    l_base=48.0,
    l_ipc_base=14.0,
    l_ipc_per_inst=0.5,
    tau_crud=22.0,
    tau_ocr=65.0,
    tau_tsp_base=105.0,
    alpha_tsp=165.0,
    has_serverless_cold_start=True,
    a_0=0.9955,
    m_max_avail_nodes=5,
    delta_spof=0.006,
    infra_unit_cost=0.0,
    gateway_fixed_cost=0.0,
    ocr_api_unit_cost=0.0,
    is_serverless_pay_per_use=True,
    containers_per_instance=0,
    base_ram_mb=180.0,
    ram_per_inst_mb=128.0,
    cpu_overhead_pct=5.5,
    isolation_factor=0.80,
    security_base=86.0,
    devops_complexity=25.0,
    advantages=[
        "Costo fijo mensual de $0.00 USD en inactividad (`is_serverless_pay_per_use = True`): durante la madrugada (10 PM – 5 AM en Bogotá) el consumo de cómputo es exactamente cero.",
        "Reducción del 85% en llamadas a Gemini Vision (`theta_cloud_ocr = 0.15`) y latencia efectiva de escaneo ultrarrápida (`tau_ocr = 65.0 ms`) incluso con mala señal 4G en sótanos/porterías.",
        "Baja carga de administración de servidores (`devops_complexity = 25.0`, `containers_per_instance = 0` autogestionados): aislamiento por microVMs Firecracker/gVisor provisto por la nube.",
        "Alta elasticidad automática (`eta = 0.88`, `beta_coord = 0.004`) para absorber picos matutinos de despacho sin aprovisionar clústeres Docker permanentes.",
    ],
    limitations=[
        "Penalización severa por Cold Start (`has_serverless_cold_start = True`): importar `ortools` C++ y `sqlalchemy` al despertar una instancia desde cero añade picos de 800–1800 ms en p95/p99.",
        "Menor rendimiento por vCPU efímera para optimización combinatoria pesada (`tau_tsp_base = 105.0 ms`, `alpha_tsp = 165.0`, `c_tsp = 15.5`) frente a nodos dedicados.",
        "Heterogeneidad de hardware en el borde: mensajeros con teléfonos Android de gama de entrada (2–3 GB RAM) experimentan mayor consumo de batería e inferencia ML Kit más lenta.",
        "Riesgo de agotamiento de pools de conexiones PostgreSQL ante ráfagas FaaS si no se interpone un proxy transaccional (PgBouncer / Supavisor) y cierto vendor lock-in BaaS.",
    ],
    assumptions=[
        "El 85% de las guías impresas (Servientrega, Coordinadora, J&T, iMile) se resuelven localmente con ML Kit + parser regex de Bogotá; el 15% restante usa fallback Gemini Free Tier.",
        "Las funciones Serverless operan bajo modelo pay-per-use con cuotas gratuitas mensuales (ej. Cloud Run 2M req/mes + Supabase Free/Pro ligero) y `minScale = 0`.",
        "El binario nativo del APK incrementa ligeramente su tamaño al empaquetar el modelo de reconocimiento de texto latino de ML Kit.",
    ],
    docker_topology_summary=(
        "0 contenedores autogestionados (`containers_per_instance = 0`); ejecución híbrida "
        "Dispositivo + microVMs Serverless administradas: [App Móvil Expo + ML Kit OCR Local + "
        "Normalizador Bogotá TS] ──HTTPS (100% CRUD/TSP, 15% Fallback OCR)──▶ [Cloud Run / FaaS "
        "Scale-to-Zero (gVisor/Firecracker)] ──Supavisor Pooler──▶ [Supabase PostgreSQL BaaS]. "
        "Aislamiento efímero por instancia (0.80) sin costo por capacidad ociosa."
    ),
    sample_compose_snippet="""\
# Manifiesto declarativo Knative / Google Cloud Run (Scale-to-Zero Serverless)
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: enruta-serverless-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"   # $0 USD en horas valle nocturnas
        autoscaling.knative.dev/maxScale: "5"   # Elasticidad en pico de cargue (6-8 AM)
        run.googleapis.com/cpu-throttling: "true"
    spec:
      containerConcurrency: 40
      timeoutSeconds: 60
      containers:
        - image: ghcr.io/enruta/serverless-api:1.0
          resources:
            limits:
              cpu: "1000m"
              memory: 256Mi
          env:
            - name: EDGE_OCR_CONFIDENCE_THRESHOLD
              value: "0.75"
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: supabase-pooler-url
                  key: uri
""",
)


ARCHITECTURES: dict[str, ArchitectureSpec] = {
    _MONO_MVP.id: _MONO_MVP,
    _MONO_ASYNC_CONTAINER.id: _MONO_ASYNC_CONTAINER,
    _MICRO_DOCKER.id: _MICRO_DOCKER,
    _HYBRID_EDGE_SERVERLESS.id: _HYBRID_EDGE_SERVERLESS,
}


def get_all_architectures() -> list[ArchitectureSpec]:
    """Devuelve las 4 arquitecturas en el orden canónico `ARCHITECTURE_ORDER`."""
    return [ARCHITECTURES[arch_id] for arch_id in ARCHITECTURE_ORDER]


def serialize_architecture(spec: ArchitectureSpec) -> dict[str, Any]:
    """Serializa una `ArchitectureSpec` a un diccionario plano listo para JSON."""
    return asdict(spec)


__all__ = [
    "ArchitectureSpec",
    "ARCHITECTURE_ORDER",
    "ARCHITECTURES",
    "get_all_architectures",
    "serialize_architecture",
]
