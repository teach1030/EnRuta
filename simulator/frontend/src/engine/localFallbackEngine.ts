import type {
  ArchitectureId,
  ArchitectureMetrics,
  ArchitectureSpec,
  CriterionKey,
  DecisionWeights,
  DominatorDetail,
  DriverSweepEntry,
  ExplainableRecommendation,
  InstanceSweepEntry,
  ParetoFrontierInfo,
  ProjectConfig,
  RejectedAlternative,
  ScenarioPreset,
  SimulationInput,
  SimulationResult,
  SweepPointSummary,
  ValidationErrorDetail,
} from '../types/simulator.ts';

/**
 * Constantes globales de calibración operativa de EnRuta (paridad 100% con Python math_model.py)
 */
export const W = 1800.0; // Ventana activa de despacho matutino en segundos (30 minutos)
export const R_RECALC = 1.5; // Promedio de ejecuciones/recálculos del solver TSP por conductor

export const DEFAULT_DRIVER_SWEEP_POINTS = [10, 50, 100, 250, 500, 1000, 2500] as const;
export const DEFAULT_INSTANCE_SWEEP_POINTS = [1, 2, 3, 6, 10, 15, 20] as const;

export const ARCHITECTURE_ORDER: ArchitectureId[] = [
  'MONO_MVP',
  'MONO_ASYNC_CONTAINER',
  'MICRO_DOCKER',
  'HYBRID_EDGE_SERVERLESS',
];

export const CRITERIA_KEYS: CriterionKey[] = [
  'latency',
  'throughput',
  'scalability',
  'availability',
  'cost',
  'security',
];

export const DEFAULT_WEIGHTS: DecisionWeights = {
  latency: 0.25,
  throughput: 0.15,
  scalability: 0.2,
  availability: 0.15,
  cost: 0.15,
  security: 0.1,
};

export const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  project_name: 'EnRuta - Optimización Logística de Última Milla (Bogotá D.C.)',
  project_domain: 'Logística urbana, OCR multimodal de guías y ruteo TSP (OR-Tools)',
  target_users_description:
    'Conductores y mensajeros urbanos en Bogotá D.C. (30 a 80 paradas diarias)',
  expected_users: 50,
  max_budget_usd: 25.0,
  max_latency_ms: 1500.0,
  min_availability_pct: 99.0,
  team_size: 3,
  require_encryption: true,
  weights: { ...DEFAULT_WEIGHTS },
};

export const DEFAULT_SIMULATION_INPUT: SimulationInput = {
  concurrent_drivers: 35,
  ocr_guides_per_driver: 30,
  stops_per_route: 30,
  compute_instances: 1,
  crud_ops_per_min: 6.0,
};

/**
 * Redondeo round-half-to-even idéntico a `round(x, ndigits)` de Python 3.
 */
const _floatView = new DataView(new ArrayBuffer(8));

/**
 * Redondeo IEEE-754 exacto (BigInt binary rational half-to-even) 100% idéntico a `round(x, ndigits)` de CPython 3.
 */
export function pyRound(value: number, decimals: number): number {
  if (!Number.isFinite(value) || value === 0) return value;
  const sign = value < 0 ? -1 : 1;
  _floatView.setFloat64(0, Math.abs(value));
  const bits = _floatView.getBigUint64(0);
  const rawExp = Number((bits >> 52n) & 0x7ffn);
  const rawMant = bits & 0xfffffffffffffn;
  const mant = rawExp === 0 ? rawMant : (1n << 52n) | rawMant;
  const exp2 = (rawExp === 0 ? 1 : rawExp) - 1023 - 52;
  const pow10 = 10n ** BigInt(decimals);
  let num = mant * pow10;
  let den = 1n;
  if (exp2 >= 0) {
    num <<= BigInt(exp2);
  } else {
    den <<= BigInt(-exp2);
  }
  const q = num / den;
  const r = num % den;
  const twoR = r * 2n;
  const rounded = twoR > den || (twoR === den && (q & 1n) === 1n) ? q + 1n : q;
  return sign * (Number(rounded) / 10 ** decimals);
}

/**
 * Catálogo exacto de las 4 arquitecturas de EnRuta (espejo de architectures.py).
 */
export const ARCHITECTURES: Record<ArchitectureId, ArchitectureSpec> = {
  MONO_MVP: {
    id: 'MONO_MVP',
    name: 'Monolito Modular Ligero sobre VPS/VM (Arquitectura Actual EnRuta)',
    short_name: 'Monolito MVP',
    subtitle: 'Proceso único FastAPI + SQLAlchemy Async + OR-Tools In-Process sobre VPS Linux',
    description:
      'Arquitectura base actual del MVP de EnRuta desplegada directamente sobre una máquina virtual ligera (VPS) sin orquestación de contenedores. Todos los dominios funcionales (autenticación JWT/Google, gestión multi-cliente de paradas, normalización vial de Bogotá, pipeline multimodal Gemini OCR y optimización combinatoria Open TSP con C++ OR-Tools) coexisten en el mismo espacio de memoria de un único servicio Uvicorn/FastAPI conectado a una instancia PostgreSQL.',
    enruta_mapping:
      'Un solo proceso `uvicorn app.main:app` ejecuta en memoria compartida los routers y servicios reales de EnRuta: `endpoints/drivers.py` (login dual email/celular, bcrypt y `verify_oauth2_token` vía `asyncio.to_thread`), `endpoints/stops.py` + `stop_service.py` (transacciones atómicas `Stop` 1:N `StopClient` sobre `asyncpg`), `utils/normalization.py` (limpieza regex de `Cll/Kra/Dg/Tv` y desduplicación de `Torre/Interior/Apartamento` en Bogotá D.C.), `endpoints/ocr.py` (`gemini-3.8-flash` para guías de Servientrega, Coordinadora, Interrapidísimo, Envía, J&T Express e iMile encadenado a `geocoding.py` Mapbox v6) y `services/routing.py` (matriz Haversine N×N + `pywrapcp` OR-Tools `PATH_CHEAPEST_ARC` y `GUIDED_LOCAL_SEARCH` corriendo síncronamente en el mismo worker).',
    paper_references: [
      'Sunardi & Suharjito (2019) — Monolithic MVC vs Microservices: menor latencia base sin saltos IPC (0 ms) bajo concurrencia baja/moderada.',
      'Tapia et al. (2020) — Eficiencia de CPU/RAM superior del monolito en VM única al evitar sobrecarga de red virtual y serialización entre contenedores.',
      'Blinowski, Ojdowska & Przybyłek (2022) — Mayor throughput por dólar en equipos pequeños y cargas acotadas antes del umbral de contención del proceso.',
      'Al-Debagy & Martinek (2018) — Menor tiempo de respuesta p50/p95 en operaciones CRUD transaccionales locales sin API Gateway intermedio.',
    ],
    mu_0: 85.0,
    eta: 0.62,
    beta_coord: 0.012,
    theta_cloud_ocr: 1.0,
    c_crud: 1.0,
    c_ocr: 4.2,
    c_tsp: 26.0,
    l_base: 38.0,
    l_ipc_base: 0.0,
    l_ipc_per_inst: 0.0,
    tau_crud: 18.0,
    tau_ocr: 320.0,
    tau_tsp_base: 95.0,
    alpha_tsp: 140.0,
    has_serverless_cold_start: false,
    a_0: 0.992,
    m_max_avail_nodes: 1,
    delta_spof: 0.018,
    infra_unit_cost: 12.0,
    gateway_fixed_cost: 0.0,
    ocr_api_unit_cost: 0.00025,
    is_serverless_pay_per_use: false,
    containers_per_instance: 0,
    base_ram_mb: 420.0,
    ram_per_inst_mb: 310.0,
    cpu_overhead_pct: 4.0,
    isolation_factor: 0.15,
    security_base: 76.0,
    devops_complexity: 18.0,
    advantages: [
      'Latencia IPC nula (l_ipc_base = 0 ms): normalización de Bogotá, validación JWT y joins Stop/StopClient ocurren por llamadas directas en memoria.',
      'Mínima complejidad operativa DevOps (18/100): un único repositorio, una migración Alembic lineal y despliegue directo por systemd/SSH.',
      'Bajo costo fijo predecible (~12 USD/mes por nodo VPS básico) sin cargos fijos de API Gateway ni malla de servicios.',
      'Transacciones ACID inmediatas en PostgreSQL al crear o sincronizar en lote múltiples destinatarios (`StopClient`) de un mismo conjunto residencial.',
    ],
    limitations: [
      'Bloqueo Head-of-Line severo (c_tsp = 26.0): el solver C++ OR-Tools (`GUIDED_LOCAL_SEARCH` en `routing.py`) monopoliza la CPU del worker y degrada los swipes de entrega CRUD.',
      'Punto único de fallo estructural (m_max_avail_nodes = 1, delta_spof = 0.018): una caída por OOM al decodificar fotos de guías de 10 MB derriba toda la plataforma.',
      'Aislamiento de fallos mínimo (isolation_factor = 0.15) y escalamiento vertical/horizontal ineficiente (eta = 0.62) al replicar todo el proceso monolítico.',
      'El 100% de los escaneos OCR viajan a la nube (`theta_cloud_ocr = 1.0`), acoplando el hilo HTTP a la latencia externa de Gemini Vision + Mapbox.',
    ],
    assumptions: [
      'Despliegue sobre VPS Linux (2 vCPU, 2–4 GB RAM) ejecutando Uvicorn con systemd y PostgreSQL 16 compartido o gestionado básico.',
      'Las imágenes de guías (JPG/PNG hasta 10 MB) se leen en memoria RAM del proceso FastAPI antes de invocarse `google-genai`.',
      'El solver TSP utiliza matriz Haversine en memoria con búsqueda local acotada para rutas urbanas de 15 a 80 paradas en Bogotá D.C.',
    ],
    docker_topology_summary:
      'Sin contenerización productiva (containers_per_instance = 0). Topología en host único: [App Móvil Expo RN] ──HTTPS──▶ [Nginx TLS Host] ──unix/loopback──▶ [systemd: uvicorn app.main:app (drivers + stops + normalization + ocr + routing)] ──asyncpg──▶ [PostgreSQL 16]. Sobrecarga de virtualización mínima (4.0% CPU), pero cero aislamiento de cgroups entre el solver OR-Tools y el API REST.',
    sample_compose_snippet: `# MONO_MVP: Despliegue directo en VPS (containers_per_instance = 0)
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
RestartSec=3`,
  },

  MONO_ASYNC_CONTAINER: {
    id: 'MONO_ASYNC_CONTAINER',
    name: 'Monolito Contenerizado + Workers Asíncronos (Docker + Cola Redis)',
    short_name: 'Monolito + Workers',
    subtitle: 'Monolito modular en Docker con desacoplamiento asíncrono Redis + Workers OCR/TSP',
    description:
      'Evolución pragmática del monolito de EnRuta empaquetada como una imagen Docker inmutable multi-stage pero desplegada en tres contenedores especializados por instancia lógica (`enruta-api`, `enruta-worker` y `redis-broker`). Mantiene una única base de código y modelo SQLAlchemy unificado, pero extrae del hilo HTTP las cargas pesadas de visión artificial (`ocr.py`) y optimización combinatoria TSP (`routing.py`) hacia colas de trabajos asíncronos con límites estrictos de CPU y RAM.',
    enruta_mapping:
      'La misma imagen `enruta-backend` se instancia con dos entrypoints aislados por Docker cgroups: (1) `enruta-api` ejecuta `uvicorn` atendiendo sin bloqueos `drivers.py`, `stops.py` y `normalization.py` sincrónica ligera, publicando tareas pesadas en Redis; (2) `enruta-worker` (Celery/ARQ) consume colas priorizadas `ocr_vision` (`ocr.py` con `gemini-3.8-flash` + `geocoding.py` Mapbox) y `tsp_solver` (`routing.py` con C++ OR-Tools `GUIDED_LOCAL_SEARCH`), notificando el resultado vía estado de job/polling reactivo a `useRouteStore.ts` en la app móvil React Native.',
    paper_references: [
      'Blinowski, Ojdowska & Przybyłek (2022) — El monolito contenerizado con colas asíncronas preserva cohesión de dominio mientras elimina cuellos de botella síncronos.',
      'Tapia et al. (2020) — Aislamiento por contenedores Docker con sobrecarga moderada de CPU (~7.5%) frente a una topología completa de microservicios.',
      'Sunardi & Suharjito (2019) — Mantener transacciones CRUD dentro de un único esquema relacional evita joins distribuidos y sagas complejas.',
      'Al-Debagy & Martinek (2018) — Reducción drástica de latencia de cola (p95/p99) al segregar cargas intensivas de cómputo mediante paso de mensajes.',
    ],
    mu_0: 140.0,
    eta: 0.78,
    beta_coord: 0.009,
    theta_cloud_ocr: 1.0,
    c_crud: 1.0,
    c_ocr: 3.1,
    c_tsp: 11.5,
    l_base: 44.0,
    l_ipc_base: 9.0,
    l_ipc_per_inst: 1.2,
    tau_crud: 20.0,
    tau_ocr: 270.0,
    tau_tsp_base: 85.0,
    alpha_tsp: 115.0,
    has_serverless_cold_start: false,
    a_0: 0.9945,
    m_max_avail_nodes: 3,
    delta_spof: 0.008,
    infra_unit_cost: 18.0,
    gateway_fixed_cost: 6.0,
    ocr_api_unit_cost: 0.00025,
    is_serverless_pay_per_use: false,
    containers_per_instance: 3,
    base_ram_mb: 340.0,
    ram_per_inst_mb: 260.0,
    cpu_overhead_pct: 7.5,
    isolation_factor: 0.62,
    security_base: 84.0,
    devops_complexity: 45.0,
    advantages: [
      'Elimina el bloqueo del event loop FastAPI: un solver OR-Tools de 70 paradas en `enruta-worker` no afecta los cambios de estado `PUT /stops/{id}/estado` en `enruta-api`.',
      'Reutiliza el 100% del código actual de `backend/app/` y las migraciones Alembic en una sola imagen Docker auditable (`devops_complexity = 45`).',
      'Control granular de cgroups: si un worker sufre OOM procesando lotes de imágenes de guías, Docker lo reinicia sin tumbar las sesiones JWT activas (`isolation_factor = 0.62`).',
      'Reintentos automáticos con exponential backoff en Redis ante fallos transitorios HTTP 429/502 de Gemini API o Mapbox Geocoding.',
    ],
    limitations: [
      'Introduce latencia de serialización/encolamiento en Redis (`l_ipc_base = 9.0 ms`) y requiere manejo asíncrono de estados `PENDING/COMPLETED` en la app Expo.',
      'Base de datos PostgreSQL única sigue siendo compartida entre `enruta-api` y `enruta-worker`, limitando el escalamiento horizontal efectivo (`m_max_avail_nodes = 3`).',
      'Escalar instancias replica el código completo del monolito en cada contenedor aunque solo crezca la demanda de OCR matutino.',
      'Mantiene dependencia total del OCR en nube (`theta_cloud_ocr = 1.0`), conservando el costo variable de API por guía escaneada.',
    ],
    assumptions: [
      'Cada instancia lógica despliega 3 contenedores Docker (`enruta-api`, `enruta-worker`, `redis:7-alpine`) detrás de un balanceador ligero (6 USD/mes).',
      'Las colas separan prioridad alta (OCR interactivo en cámara) de prioridad media (re-optimización completa de ruta TSP).',
      'PostgreSQL opera con pool de conexiones asíncrono (`asyncpg`) dimensionado para absorber escrituras concurrentes de API y workers.',
    ],
    docker_topology_summary:
      '3 contenedores por instancia lógica (`containers_per_instance = 3`) en red bridge aislada: [LB / Nginx] ──▶ [enruta-api (FastAPI: drivers, stops, normalization)] ──TCP 6379──▶ [redis-broker (Redis 7 Alpine)] ──▶ [enruta-worker (Workers: ocr Gemini/Mapbox + routing OR-Tools C++)], ambos persistiendo en [postgres-db]. Aislamiento de memoria y cuotas CPU independientes entre API interactiva y cómputo pesado.',
    sample_compose_snippet: `services:
  enruta-api:
    image: ghcr.io/enruta/backend:1.0-slim
    command: ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
    environment:
      REDIS_URL: redis://redis-broker:6379/0
      DATABASE_URL: postgresql+asyncpg://enruta:\${DB_PASS}@postgres-db:5432/enruta
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
      DATABASE_URL: postgresql+asyncpg://enruta:\${DB_PASS}@postgres-db:5432/enruta
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
      retries: 3`,
  },

  MICRO_DOCKER: {
    id: 'MICRO_DOCKER',
    name: 'Microservicios Distribuidos Orquestados en Contenedores Docker',
    short_name: 'Microservicios Docker',
    subtitle: 'Descomposición por Bounded Contexts (Gateway + Auth + Stops + OCR + TSP OR-Tools)',
    description:
      'Arquitectura distribuida nativa de contenedores que descompone EnRuta en cinco servicios autónomos por dominio (`api-gateway`, `ms-auth-drivers`, `ms-stops-bogota`, `ms-ocr-vision` y `ms-tsp-ortools`) respaldados por persistencia geoespacial (`postgres-postgis`). Permite escalar elásticamente y de forma independiente los nodos C++ de optimización OR-Tools o los procesadores de visión artificial durante los picos de cargue de bodegas en Bogotá sin sobreaprovisionar los servicios CRUD.',
    enruta_mapping:
      'Desacopla los módulos de `backend/app/` en bounded contexts independientes: (1) `api-gateway` (enrutamiento L7, rate-limiting y verificación JWT perimetral); (2) `ms-auth-drivers` (`drivers.py` + `security.py`, cuentas, OAuth2 Google y cuotas Guest); (3) `ms-stops-bogota` (`stops.py`, `stop_service.py` y `normalization.py` para CRUD multi-cliente `Stop/StopClient` y estandarización vial de Bogotá); (4) `ms-ocr-vision` (`ocr.py` + `geocoding.py` con circuit-breakers hacia Gemini y Mapbox); (5) `ms-tsp-ortools` (`routing.py` compilado en imagen minimalista dedicada a C++ `pywrapcp` Haversine/Open TSP), persistiendo geometrías y rutas en `postgres-postgis`.',
    paper_references: [
      'Al-Debagy & Martinek (2018) — Alta escalabilidad bajo concurrencia masiva a cambio de penalización de latencia IPC por saltos HTTP/gRPC entre servicios.',
      'Tapia et al. (2020) — Mayor consumo agregado de CPU (~12.5% overhead) y RAM base por duplicación de runtimes en contenedores Docker distribuidos.',
      'Blinowski, Ojdowska & Przybyłek (2022) — Ventaja competitiva en sistemas grandes y heterogéneos, pero sobrecosto de infraestructura y DevOps para startups MVP.',
      'Sunardi & Suharjito (2019) — Aislamiento estricto de fallos por servicio frente al incremento de complejidad en trazabilidad y consistencia eventual.',
    ],
    mu_0: 210.0,
    eta: 0.92,
    beta_coord: 0.008,
    theta_cloud_ocr: 1.0,
    c_crud: 1.25,
    c_ocr: 2.4,
    c_tsp: 7.2,
    l_base: 52.0,
    l_ipc_base: 24.0,
    l_ipc_per_inst: 2.1,
    tau_crud: 24.0,
    tau_ocr: 230.0,
    tau_tsp_base: 75.0,
    alpha_tsp: 82.0,
    has_serverless_cold_start: false,
    a_0: 0.996,
    m_max_avail_nodes: 6,
    delta_spof: 0.003,
    infra_unit_cost: 24.0,
    gateway_fixed_cost: 18.0,
    ocr_api_unit_cost: 0.00025,
    is_serverless_pay_per_use: false,
    containers_per_instance: 5,
    base_ram_mb: 290.0,
    ram_per_inst_mb: 220.0,
    cpu_overhead_pct: 12.5,
    isolation_factor: 0.95,
    security_base: 91.0,
    devops_complexity: 82.0,
    advantages: [
      'Máxima capacidad de procesamiento y eficiencia de escalado horizontal (`mu_0 = 210.0`, `eta = 0.92`, hasta `m_max_avail_nodes = 6` nodos activos).',
      'Aislamiento de fallos casi total (`isolation_factor = 0.95`, `delta_spof = 0.003`): una saturación en `ms-tsp-ortools` o `ms-ocr-vision` jamás interrumpe `ms-stops-bogota`.',
      'Superficie de seguridad reforzada (`security_base = 91.0`): credenciales `GEMINI_API_KEY` aisladas únicamente en `ms-ocr-vision` y redes internas Zero-Trust.',
      'Optimización específica de runtime: `ms-tsp-ortools` asigna hilos nativos C++ dedicados reduciendo el peso relativo del TSP (`c_tsp = 7.2`, `alpha_tsp = 82.0`).',
    ],
    limitations: [
      'Impuesto severo de red e IPC (`l_ipc_base = 24.0 ms` + `2.1 ms` por instancia): un flujo OCR→Normalización→Creación de Parada atraviesa múltiples saltos HTTP/JSON.',
      'Costo fijo mensual elevado (`infra_unit_cost = 24.0` USD/nodo + `gateway_fixed_cost = 18.0` USD/mes) inviable para presupuestos estudiantiles o etapa semilla sin ingresos.',
      'Complejidad DevOps crítica (`devops_complexity = 82.0`): exige CI/CD multi-imagen, observabilidad distribuida (OpenTelemetry), healthchecks en cascada y consistencia eventual.',
      'Sobrecarga base de memoria y CPU (`cpu_overhead_pct = 12.5%`, 5 contenedores de aplicación por instancia lógica).',
    ],
    assumptions: [
      'Cada instancia lógica orquesta 5 contenedores de dominio (`api-gateway`, `ms-auth-drivers`, `ms-stops-bogota`, `ms-ocr-vision`, `ms-tsp-ortools`) sobre red overlay Docker.',
      'Persistencia desacoplada por esquemas lógicos sobre clúster `postgres-postgis` con pooling PgBouncer.',
      'Comunicación interna REST/HTTP2 con timeouts agresivos y circuit breakers para evitar fallos en cascada.',
    ],
    docker_topology_summary:
      '5 contenedores de dominio por instancia (`containers_per_instance = 5`) + capa de datos PostGIS en subredes segmentadas (`edge_net` pública y `mesh_internal` privada): [App Móvil] ──▶ [api-gateway] ──▶ {[ms-auth-drivers], [ms-stops-bogota], [ms-ocr-vision], [ms-tsp-ortools]} ──▶ [postgres-postgis]. Aislamiento estricto de secretos, cgroups dedicados para OR-Tools y alta disponibilidad multi-réplica.',
    sample_compose_snippet: `services:
  api-gateway:
    image: nginx:1.27-alpine
    ports: ["443:443"]
    networks: [edge_net, mesh_internal]
    depends_on: [ms-auth-drivers, ms-stops-bogota, ms-ocr-vision, ms-tsp-ortools]

  ms-auth-drivers:
    image: ghcr.io/enruta/ms-auth-drivers:1.0
    networks: [mesh_internal]
    environment:
      JWT_SECRET_KEY: \${JWT_SECRET_KEY}
      GOOGLE_CLIENT_ID: \${GOOGLE_CLIENT_ID}

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
      GEMINI_API_KEY: \${GEMINI_API_KEY}
      MAPBOX_ACCESS_TOKEN: \${MAPBOX_ACCESS_TOKEN}

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
    internal: true`,
  },

  HYBRID_EDGE_SERVERLESS: {
    id: 'HYBRID_EDGE_SERVERLESS',
    name: 'Híbrida Edge Computing (ML Kit On-Device OCR) + Serverless (Zero-Budget)',
    short_name: 'Edge + Serverless',
    subtitle: 'OCR y normalización en el teléfono Android (ML Kit) + Backend FaaS/Cloud Run Scale-to-Zero',
    description:
      'Arquitectura híbrida orientada a costo fijo cero ($0 USD/mes en reposo) que traslada el 85% del cómputo de visión artificial y normalización de direcciones directamente al dispositivo móvil del mensajero (Edge Computing con Google ML Kit Text Recognition on-device sobre Expo/React Native), delegando al backend únicamente funciones Serverless efímeras con autoescalado a cero (Google Cloud Run / AWS Lambda + Supabase PostgreSQL Free/Pay-per-use) y reservando Gemini Vision Cloud como fallback para el 15% de guías deterioradas o manuscritas (`theta_cloud_ocr = 0.15`).',
    enruta_mapping:
      'En `mobile/` (`Scanner` + `expo-camera`), ML Kit extrae texto en local en ~50 ms y un port TypeScript de `normalization.py` separa en el borde `Calle/Carrera/Diagonal` y `Torre/Interior/Apartamento`; solo si la confianza local es < 0.75 (15% de guías borrosas de Interrapidísimo/Servientrega/iMile) se invoca el endpoint `ocr.py` en la nube dentro de la capa gratuita de Gemini. Los endpoints `drivers.py`, `stops.py` y el solver `routing.py` (OR-Tools) corren como contenedores efímeros administrados en Cloud Run (`min-instances = 0`) conectados por pooler HTTP/Supavisor a PostgreSQL BaaS.',
    paper_references: [
      'Satyanarayanan (2017) — Edge Computing reduce drásticamente la latencia extremo a extremo y el consumo de ancho de banda móvil al procesar imágenes en el dispositivo.',
      'Castro et al. (2019) — Serverless Computing ofrece elasticidad automática y facturación estricta por milisegundo de uso (scale-to-zero), ideal para cargas diurnas intermitentes.',
      'Tapia et al. (2020) & Blinowski et al. (2022) — Marco comparativo de sobrecarga de infraestructura administrada frente a clústeres de contenedores permanentes.',
      'Al-Debagy & Martinek (2018) — Penalización de cola (tail latency p95/p99) asociada a inicialización de entornos efímeros (cold starts) bajo ráfagas de tráfico.',
    ],
    mu_0: 165.0,
    eta: 0.88,
    beta_coord: 0.004,
    theta_cloud_ocr: 0.15,
    c_crud: 1.1,
    c_ocr: 1.2,
    c_tsp: 15.5,
    l_base: 48.0,
    l_ipc_base: 14.0,
    l_ipc_per_inst: 0.5,
    tau_crud: 22.0,
    tau_ocr: 65.0,
    tau_tsp_base: 105.0,
    alpha_tsp: 165.0,
    has_serverless_cold_start: true,
    a_0: 0.9955,
    m_max_avail_nodes: 5,
    delta_spof: 0.006,
    infra_unit_cost: 0.0,
    gateway_fixed_cost: 0.0,
    ocr_api_unit_cost: 0.0,
    is_serverless_pay_per_use: true,
    containers_per_instance: 0,
    base_ram_mb: 180.0,
    ram_per_inst_mb: 128.0,
    cpu_overhead_pct: 5.5,
    isolation_factor: 0.8,
    security_base: 86.0,
    devops_complexity: 25.0,
    advantages: [
      'Costo fijo mensual de $0.00 USD en inactividad (`is_serverless_pay_per_use = True`): durante la madrugada (10 PM – 5 AM en Bogotá) el consumo de cómputo es exactamente cero.',
      'Reducción del 85% en llamadas a Gemini Vision (`theta_cloud_ocr = 0.15`) y latencia efectiva de escaneo ultrarrápida (`tau_ocr = 65.0 ms`) incluso con mala señal 4G en sótanos/porterías.',
      'Baja carga de administración de servidores (`devops_complexity = 25.0`, `containers_per_instance = 0` autogestionados): aislamiento por microVMs Firecracker/gVisor provisto por la nube.',
      'Alta elasticidad automática (`eta = 0.88`, `beta_coord = 0.004`) para absorber picos matutinos de despacho sin aprovisionar clústeres Docker permanentes.',
    ],
    limitations: [
      'Penalización severa por Cold Start (`has_serverless_cold_start = True`): importar `ortools` C++ y `sqlalchemy` al despertar una instancia desde cero añade picos de 800–1800 ms en p95/p99.',
      'Menor rendimiento por vCPU efímera para optimización combinatoria pesada (`tau_tsp_base = 105.0 ms`, `alpha_tsp = 165.0`, `c_tsp = 15.5`) frente a nodos dedicados.',
      'Heterogeneidad de hardware en el borde: mensajeros con teléfonos Android de gama de entrada (2–3 GB RAM) experimentan mayor consumo de batería e inferencia ML Kit más lenta.',
      'Riesgo de agotamiento de pools de conexiones PostgreSQL ante ráfagas FaaS si no se interpone un proxy transaccional (PgBouncer / Supavisor) y cierto vendor lock-in BaaS.',
    ],
    assumptions: [
      'El 85% de las guías impresas (Servientrega, Coordinadora, J&T, iMile) se resuelven localmente con ML Kit + parser regex de Bogotá; el 15% restante usa fallback Gemini Free Tier.',
      'Las funciones Serverless operan bajo modelo pay-per-use con cuotas gratuitas mensuales (ej. Cloud Run 2M req/mes + Supabase Free/Pro ligero) y `minScale = 0`.',
      'El binario nativo del APK incrementa ligeramente su tamaño al empaquetar el modelo de reconocimiento de texto latino de ML Kit.',
    ],
    docker_topology_summary:
      '0 contenedores autogestionados (`containers_per_instance = 0`); ejecución híbrida Dispositivo + microVMs Serverless administradas: [App Móvil Expo + ML Kit OCR Local + Normalizador Bogotá TS] ──HTTPS (100% CRUD/TSP, 15% Fallback OCR)──▶ [Cloud Run / FaaS Scale-to-Zero (gVisor/Firecracker)] ──Supavisor Pooler──▶ [Supabase PostgreSQL BaaS]. Aislamiento efímero por instancia (0.80) sin costo por capacidad ociosa.',
    sample_compose_snippet: `# Manifiesto declarativo Knative / Google Cloud Run (Scale-to-Zero Serverless)
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
                  key: uri`,
  },
};

export function getAllArchitectures(): ArchitectureSpec[] {
  return ARCHITECTURE_ORDER.map((id) => ARCHITECTURES[id]);
}

/**
 * Catálogo exacto de escenarios de EnRuta (paridad 100% con scenarios.py).
 */
export const SCENARIOS_CATALOG: ScenarioPreset[] = [
  {
    id: 'REF_MVP_BOGOTA',
    name: 'Referencia MVP — Operación Diaria Estándar en Bogotá D.C.',
    short_name: 'Referencia MVP Bogotá',
    category: 'reference',
    is_reference: true,
    description:
      'Línea base oficial del MVP de EnRuta: 35 mensajeros concurrentes despachando rutas urbanas de 30 paradas con escaneo de 30 guías físicas por jornada, presupuesto semilla estricto de $25 USD/mes y equipo fundador de 3 desarrolladores.',
    bogota_context:
      'Salida matutina (7:00 a.m.) desde bodegas logísticas de Puente Aranda y Montevideo hacia zonas residenciales y empresariales de Chapinero, Teusaquillo, Usaquén y Kennedy. Los conductores digitalizan etiquetas de Servientrega, Coordinadora e Interrapidísimo con abreviaturas bogotanas (`Cll`, `Kra`, `Dg`, `Tv`, `Torre/Apto`) y confirman entregas multi-cliente por portería.',
    sim_input: {
      concurrent_drivers: 35,
      ocr_guides_per_driver: 30,
      stops_per_route: 30,
      compute_instances: 1,
      crud_ops_per_min: 6.0,
    },
    project_config_overrides: {
      expected_users: 50,
      max_budget_usd: 25.0,
      max_latency_ms: 1500.0,
      min_availability_pct: 99.0,
      team_size: 3,
      require_encryption: true,
      weights: {
        latency: 0.25,
        throughput: 0.15,
        scalability: 0.2,
        availability: 0.15,
        cost: 0.15,
        security: 0.1,
      },
    },
    expected_insight:
      'Bajo presupuesto semilla ($25 USD/mes) y equipo compacto (3 ingenieros), las arquitecturas contenerizadas multi-nodo (`MONO_ASYNC_CONTAINER` con $30.82 USD y `MICRO_DOCKER` con $48.83 USD) quedan descartadas por violación presupuestal. `HYBRID_EDGE_SERVERLESS` lidera ($4.59 USD/mes, 99.55% disponibilidad) al delegar el 85% del OCR a ML Kit en el teléfono Android y escalar a cero en horas nocturnas, seguida de `MONO_MVP` ($18.82 USD/mes), que ofrece la menor latencia pura (100.80 ms) al carecer de saltos IPC.',
    expected_winner_id: 'HYBRID_EDGE_SERVERLESS',
    paper_focus:
      'Sunardi & Suharjito (2019); Castro et al. (2019) — Eficiencia en etapa temprana vs sobrecosto de microservicios.',
  },
  {
    id: 'PEAK_MORNING_OCR',
    name: 'Pico Matutino 6:30 AM — Ráfaga Masiva de Escaneo OCR en Bodega',
    short_name: 'Pico Matutino OCR',
    category: 'execution',
    is_reference: false,
    description:
      'Ventana intensa de cargue donde 85 conductores escanean simultáneamente un lote pesado de 70 guías físicas cada uno (~154.700 guías/mes) antes de iniciar recorrido, con baja actividad CRUD en ruta pero alta exigencia de respuesta en cámara (< 400 ms) y tope financiero de $45 USD/mes.',
    bogota_context:
      'Centros de consolidación cercanos al Aeropuerto El Dorado (Fontibón / Calle 26) durante picos de paquetería asiática y nacional (J&T Express, iMile, Envía). Decenas de motorizados fotografían etiquetas térmicas arrugadas bajo techos industriales con cobertura celular 4G saturada antes de distribuirse por la Av. Boyacá y Calle 80.',
    sim_input: {
      concurrent_drivers: 85,
      ocr_guides_per_driver: 70,
      stops_per_route: 30,
      compute_instances: 1,
      crud_ops_per_min: 2.5,
    },
    project_config_overrides: {
      expected_users: 85,
      max_budget_usd: 45.0,
      max_latency_ms: 400.0,
      min_availability_pct: 99.4,
      team_size: 3,
      require_encryption: true,
      weights: {
        latency: 0.3,
        throughput: 0.15,
        scalability: 0.15,
        availability: 0.15,
        cost: 0.15,
        security: 0.1,
      },
    },
    expected_insight:
      'Cuando el volumen de guías se dispara (`U * G = 5.950` guías cada 30 min), enviar el 100% de las fotografías a Gemini Vision (`theta_cloud_ocr = 1.0`) eleva el costo mensual de las tres arquitecturas cloud por encima de $50–$80 USD/mes y duplica la latencia ponderada (~196–213 ms). `HYBRID_EDGE_SERVERLESS` domina ampliamente (116.58 ms, $18.77 USD/mes) al ejecutar ML Kit Text Recognition + normalización regex de Bogotá directamente en el dispositivo móvil.',
    expected_winner_id: 'HYBRID_EDGE_SERVERLESS',
    paper_focus:
      'Satyanarayanan (2017); Tapia et al. (2020) — Descarga de cómputo intensivo de visión hacia el Edge.',
  },
  {
    id: 'HEAVY_TSP_ROUTES',
    name: 'Rutas Densas (115 Paradas) — Estrés Combinatorio TSP OR-Tools',
    short_name: 'Rutas Pesadas TSP',
    category: 'execution',
    is_reference: false,
    description:
      'Operación consolidada de 95 conductores con rutas densas de 115 paradas geocodificadas y re-optimizaciones frecuentes sobre 2 instancias, presupuesto PyME de $75 USD/mes, SLA de latencia <= 420 ms y disponibilidad >= 99.5% con un equipo de 3 ingenieros.',
    bogota_context:
      'Distribución capilar de e-commerce en edificios multifamiliares de Cedritos, Colina Campestre, Chicó y Ciudad Salitre, donde cada furgoneta atiende más de 100 ubicaciones y recalcula secuencias Open TSP con OR-Tools ante cierres viales o bloqueos sobre la Autopista Norte, NQS y Av. Circunvalar.',
    sim_input: {
      concurrent_drivers: 95,
      ocr_guides_per_driver: 35,
      stops_per_route: 115,
      compute_instances: 2,
      crud_ops_per_min: 7.5,
    },
    project_config_overrides: {
      expected_users: 95,
      max_budget_usd: 75.0,
      max_latency_ms: 420.0,
      min_availability_pct: 99.5,
      team_size: 3,
      require_encryption: true,
      weights: {
        latency: 0.3,
        throughput: 0.15,
        scalability: 0.15,
        availability: 0.15,
        cost: 0.15,
        security: 0.1,
      },
    },
    expected_insight:
      'Al subir a `N_p = 115` paradas, la complejidad Haversine + `GUIDED_LOCAL_SEARCH` escala superlinealmente (`phi_tsp = 12.02x`). `HYBRID_EDGE_SERVERLESS` sufre una severa penalización de cold-start para contenedores pesados > 80 paradas (610.11 ms > 420 ms) y sobrecosto por tiempo de cómputo ($214.46 USD). `MONO_MVP` incumple la disponibilidad (99.20% < 99.5%) por su nodo único, y `MICRO_DOCKER` rebasa el presupuesto PyME ($87.61 > $75 USD). Gana `MONO_ASYNC_CONTAINER` ($63.61 USD, 116.94 ms, 99.99% disponibilidad), aislando OR-Tools en workers Redis sin sobrecosto de malla de microservicios.',
    expected_winner_id: 'MONO_ASYNC_CONTAINER',
    paper_focus:
      'Blinowski et al. (2022); Al-Debagy & Martinek (2018) — Desacoplamiento asíncrono pragmático de CPU pesada.',
  },
  {
    id: 'NATIONAL_SCALE_SLA',
    name: 'Escala Nacional Colombia (850 Conductores) — Alta Disponibilidad 99.9%',
    short_name: 'Escala Nacional SLA',
    category: 'execution',
    is_reference: false,
    description:
      'Despliegue corporativo multi-ciudad con 850 conductores activos simultáneos, rutas de 65 paradas, alta frecuencia transaccional CRUD (12 ops/min) sobre 6 instancias, SLA empresarial estricto (>= 99.90%), equipo maduro de 8 ingenieros/SREs y presupuesto corporativo de $650 USD/mes.',
    bogota_context:
      'Operación logística integrada conectando Bogotá–Sabana (Cota, Tenjo, Funza, Soacha) con flotas metropolitanas en Medellín (Valle de Aburrá), Cali y Barranquilla durante campañas de Día sin IVA, CyberLunes y temporada decembrina, con trazabilidad continua de entregas corporativas.',
    sim_input: {
      concurrent_drivers: 850,
      ocr_guides_per_driver: 45,
      stops_per_route: 65,
      compute_instances: 6,
      crud_ops_per_min: 12.0,
    },
    project_config_overrides: {
      expected_users: 850,
      max_budget_usd: 650.0,
      max_latency_ms: 900.0,
      min_availability_pct: 99.9,
      team_size: 8,
      require_encryption: true,
      weights: {
        latency: 0.2,
        throughput: 0.2,
        scalability: 0.25,
        availability: 0.2,
        cost: 0.05,
        security: 0.1,
      },
    },
    expected_insight:
      'Bajo concurrencia masiva (850 conductores) y `I = 6` nodos (justo en el óptimo previo a la penalización por sobre-escalado), `MONO_MVP` colapsa por saturación al 130.25% de capacidad (4.423 ms de latencia, 29.15% de errores y caída SPOF a 98.296%). `HYBRID_EDGE_SERVERLESS` pierde competitividad económica por facturación variable en alto volumen continuo ($1.780,68 USD/mes). `MICRO_DOCKER` gana con solvencia (99.09/100, utilización 26.09%, disponibilidad 99.99%, aislamiento 0.95) respaldado por un equipo de 8 ingenieros capaz de absorber su complejidad DevOps.',
    expected_winner_id: 'MICRO_DOCKER',
    paper_focus:
      'Al-Debagy & Martinek (2018); Tapia et al. (2020) — Dominio de microservicios bajo alta concurrencia y SLA crítico.',
  },
  {
    id: 'OVERSCALING_SIMPLE_SWIPE',
    name: 'Sobre-escalado Horizontal (15 Instancias) en Swipes CRUD — Efecto Blinowski',
    short_name: 'Sobre-escalado CRUD',
    category: 'execution',
    is_reference: false,
    description:
      'Anti-patrón de aprovisionamiento: flota pequeña de 45 conductores en turno vespertino ejecutando casi exclusivamente confirmaciones rápidas de estado por swipe (14 ops/min, apenas 5 guías OCR y 20 paradas), pero desplegada erróneamente sobre 15 instancias con un equipo pequeño de 2 desarrolladores y exigencia de respuesta instantánea (<= 160 ms).',
    bogota_context:
      'Franja de la tarde (2:30 p.m. – 5:30 p.m.) en barrios residenciales de Suba, Engativá y Bosa: las rutas ya están calculadas desde la mañana y los mensajeros solo deslizan tarjetas (`Swipeable` -> `PUT /api/v1/stops/{id}/estado`) frente a cada portería tras entregar los paquetes.',
    sim_input: {
      concurrent_drivers: 45,
      ocr_guides_per_driver: 5,
      stops_per_route: 20,
      compute_instances: 15,
      crud_ops_per_min: 14.0,
    },
    project_config_overrides: {
      expected_users: 45,
      max_budget_usd: 210.0,
      max_latency_ms: 160.0,
      min_availability_pct: 99.0,
      team_size: 2,
      require_encryption: true,
      weights: {
        latency: 0.35,
        throughput: 0.1,
        scalability: 0.1,
        availability: 0.1,
        cost: 0.25,
        security: 0.1,
      },
    },
    expected_insight:
      'Ilustra directamente el hallazgo de Blinowski, Ojdowska & Przybyłek (2022): escalar horizontalmente a `I = 15` réplicas (`I > 6`) activa la penalización cuadrática de coordinación (`over_scale_factor`), multiplica los contenedores activos en `MICRO_DOCKER` (75 contenedores, $379.46 USD/mes, +53.4 ms solo en IPC) y `MONO_ASYNC_CONTAINER` (45 contenedores, $277.46 USD/mes), violando presupuesto y degradando superficie de seguridad. En operaciones simples sin contención de CPU, `MONO_MVP` logra 60.09 ms (0 ms IPC) y evidencia que escalar instancias sin cuello de botella real destruye eficiencia costo-rendimiento.',
    expected_winner_id: 'MONO_MVP',
    paper_focus:
      'Blinowski, Ojdowska & Przybyłek (2022) — Degradación por coordinación y sobre-escalado horizontal en cargas simples.',
  },
  {
    id: 'PILOT_CHAPINERO_LOW_LATENCY',
    name: 'Piloto Hiperlocal Chapinero–Usaquén — Latencia Ultra-Baja In-Process',
    short_name: 'Piloto Hiperlocal',
    category: 'execution',
    is_reference: false,
    description:
      'Operación hiperlocal dedicada de entregas rápidas (dark-stores y farmacias urbanas) con 20 motorizados, rutas cortas de 18 paradas, 15 guías por turno, presupuesto acotado de $22 USD/mes, 2 desarrolladores y requisito estricto de latencia <= 115 ms.',
    bogota_context:
      'Entregas exprés de última hora en el corredor financiero y gastronómico de Calle 72 a Calle 127 (Chapinero Alto, Rosales, Parque de la 93 y Santa Bárbara), donde cada despacho agrupa pocas paradas cercanas y prioriza respuesta inmediata sin arranques en frío.',
    sim_input: {
      concurrent_drivers: 20,
      ocr_guides_per_driver: 15,
      stops_per_route: 18,
      compute_instances: 1,
      crud_ops_per_min: 8.0,
    },
    project_config_overrides: {
      expected_users: 20,
      max_budget_usd: 22.0,
      max_latency_ms: 115.0,
      min_availability_pct: 99.0,
      team_size: 2,
      require_encryption: true,
      weights: {
        latency: 0.4,
        throughput: 0.1,
        scalability: 0.1,
        availability: 0.1,
        cost: 0.2,
        security: 0.1,
      },
    },
    expected_insight:
      'En un piloto hiperlocal pequeño (20 conductores) con umbral estricto de latencia (<= 115 ms), la sobrecarga de cold-start de `HYBRID_EDGE_SERVERLESS` ante baja concurrencia (`180 / (1 + 0.08 * 20) = 69.23 ms` extra) la hace exceder el límite de 115 ms, mientras que `MONO_ASYNC_CONTAINER` y `MICRO_DOCKER` superan los $22 USD/mes. `MONO_MVP` resulta ganadora indiscutible (~78 ms, $13.95 USD/mes), confirmando la tesis de Sunardi & Suharjito (2019) para sistemas compactos de baja concurrencia.',
    expected_winner_id: 'MONO_MVP',
    paper_focus:
      'Sunardi & Suharjito (2019) — Superioridad del monolito ligero en baja concurrencia y latencia estricta.',
  },
];

/**
 * Validación estricta de rangos (Requisito 10 — paridad con Pydantic v2 del backend).
 */
export function validateSimulationParameters(
  simInput: SimulationInput,
  projectConfig: ProjectConfig
): ValidationErrorDetail[] {
  const errors: ValidationErrorDetail[] = [];

  if (
    !Number.isFinite(simInput.concurrent_drivers) ||
    simInput.concurrent_drivers < 1 ||
    simInput.concurrent_drivers > 5000
  ) {
    errors.push({
      field: 'concurrent_drivers',
      message: 'Conductores concurrentes (U) debe estar entre 1 y 5,000.',
    });
  }
  if (
    !Number.isFinite(simInput.ocr_guides_per_driver) ||
    simInput.ocr_guides_per_driver < 0 ||
    simInput.ocr_guides_per_driver > 150
  ) {
    errors.push({
      field: 'ocr_guides_per_driver',
      message: 'Guías OCR por conductor (G) debe estar entre 0 y 150.',
    });
  }
  if (
    !Number.isFinite(simInput.stops_per_route) ||
    simInput.stops_per_route < 2 ||
    simInput.stops_per_route > 150
  ) {
    errors.push({
      field: 'stops_per_route',
      message: 'Paradas por ruta TSP (N_p) requiere mínimo 2 y máximo 150 puntos.',
    });
  }
  if (
    !Number.isFinite(simInput.compute_instances) ||
    simInput.compute_instances < 1 ||
    simInput.compute_instances > 20
  ) {
    errors.push({
      field: 'compute_instances',
      message: 'Instancias de cómputo (I) debe estar entre 1 y 20.',
    });
  }
  if (
    !Number.isFinite(simInput.crud_ops_per_min) ||
    simInput.crud_ops_per_min < 0.5 ||
    simInput.crud_ops_per_min > 60.0
  ) {
    errors.push({
      field: 'crud_ops_per_min',
      message: 'Operaciones CRUD/min (F_crud) debe estar entre 0.5 y 60.0.',
    });
  }
  if (
    !Number.isFinite(projectConfig.max_budget_usd) ||
    projectConfig.max_budget_usd < 0 ||
    projectConfig.max_budget_usd > 10000
  ) {
    errors.push({
      field: 'max_budget_usd',
      message: 'Presupuesto mensual máximo (B_max) debe estar entre $0 y $10,000 USD.',
    });
  }
  if (
    !Number.isFinite(projectConfig.max_latency_ms) ||
    projectConfig.max_latency_ms < 50 ||
    projectConfig.max_latency_ms > 30000
  ) {
    errors.push({
      field: 'max_latency_ms',
      message: 'Latencia máxima permitida (L_max) debe estar entre 50 ms y 30,000 ms.',
    });
  }
  if (
    !Number.isFinite(projectConfig.min_availability_pct) ||
    projectConfig.min_availability_pct < 90.0 ||
    projectConfig.min_availability_pct > 99.99
  ) {
    errors.push({
      field: 'min_availability_pct',
      message: 'Disponibilidad mínima SLA (A_min) debe estar entre 90.0% y 99.99%.',
    });
  }
  if (
    !Number.isFinite(projectConfig.team_size) ||
    projectConfig.team_size < 1 ||
    projectConfig.team_size > 50
  ) {
    errors.push({
      field: 'team_size',
      message: 'Tamaño del equipo (E_team) debe estar entre 1 y 50 ingenieros.',
    });
  }

  const weightValues = CRITERIA_KEYS.map((k) => projectConfig.weights[k]);
  if (weightValues.some((w) => !Number.isFinite(w) || w < 0)) {
    errors.push({
      field: 'weights',
      message: 'Ningún peso de decisión multicriterio puede ser negativo.',
    });
  } else {
    const sumWeights = weightValues.reduce((acc, w) => acc + w, 0);
    if (sumWeights <= 0) {
      errors.push({
        field: 'weights',
        message: 'La suma de los pesos de decisión debe ser estrictamente mayor a 0.',
      });
    }
  }

  return errors;
}

/**
 * Evalúa determinísticamente una arquitectura siguiendo exactamente math_model.py.
 */
export function evaluateArchitecture(
  spec: ArchitectureSpec,
  simInput: SimulationInput,
  projectConfig: ProjectConfig = DEFAULT_PROJECT_CONFIG
): ArchitectureMetrics {
  const U = simInput.concurrent_drivers;
  const G = simInput.ocr_guides_per_driver;
  const N_p = simInput.stops_per_route;
  const I = simInput.compute_instances;
  const F_crud = simInput.crud_ops_per_min;

  // 1. Tasas de llegada (peticiones/segundo)
  const lambda_crud = (U * F_crud) / 60.0;
  const lambda_ocr_raw = (U * G) / W;
  const lambda_ocr_cloud = lambda_ocr_raw * spec.theta_cloud_ocr;
  const lambda_tsp = (U * R_RECALC) / W;
  const total_client_req_s = lambda_crud + lambda_ocr_raw + lambda_tsp;
  const backend_req_s = lambda_crud + lambda_ocr_cloud + lambda_tsp;

  // 2. Complejidad TSP (Google OR-Tools con matriz Haversine O(N^2))
  const phi_tsp = (N_p / 30.0) ** 1.85;

  // 3. Demanda y Capacidad (con penalización de Blinowski 2022 para I > 6)
  const demand_units =
    lambda_crud * spec.c_crud +
    lambda_ocr_cloud * spec.c_ocr +
    lambda_tsp * spec.c_tsp * phi_tsp;
  const over_scale_factor = Math.max(0.55, 1.0 - spec.beta_coord * Math.max(0, I - 6) ** 2);
  const capacity_units = spec.mu_0 * I ** spec.eta * over_scale_factor;
  const utilization = demand_units / Math.max(capacity_units, 1e-6);

  // 4. Tiempos de servicio y Latencia Estimada (ms)
  const tau_tsp_ms = spec.tau_tsp_base + spec.alpha_tsp * phi_tsp;
  const weighted_service_ms =
    (lambda_crud * spec.tau_crud +
      lambda_ocr_cloud * spec.tau_ocr +
      lambda_tsp * tau_tsp_ms) /
    Math.max(backend_req_s, 1e-6);
  const cold_start_ms = spec.has_serverless_cold_start
    ? 180.0 / (1.0 + 0.08 * U) + Math.max(0.0, (N_p - 80.0) * 14.0)
    : 0.0;
  const ipc_ms = spec.l_ipc_base + spec.l_ipc_per_inst * Math.max(0, I - 1);
  const rho_eff = Math.min(utilization, 0.985);
  const queue_multiplier = 1.0 + rho_eff ** 2 / (1.0 - rho_eff);
  const saturation_penalty_ms = Math.max(0.0, utilization - 1.0) * 2800.0;
  const latency_ms = pyRound(
    spec.l_base +
      ipc_ms +
      weighted_service_ms * queue_multiplier +
      cold_start_ms +
      saturation_penalty_ms,
    2
  );

  // 5. Capacidad / Throughput y Tasa de Error
  const avg_cost_per_client_req = demand_units / Math.max(total_client_req_s, 1e-6);
  const max_capacity_req_s = pyRound(
    capacity_units / Math.max(avg_cost_per_client_req, 1e-6),
    2
  );
  const drop_prob =
    utilization <= 0.92 ? 0.0 : Math.min(0.85, Math.max(0.0, 1.0 - 0.92 / utilization));
  const error_rate_pct = pyRound(drop_prob * 100.0, 2);
  const throughput_req_s = pyRound(total_client_req_s * (1.0 - drop_prob), 2);

  // 6. Escalabilidad (0..100)
  const headroom_term = Math.max(0.0, 1.0 - Math.min(1.0, utilization / 1.25));
  const raw_scalability =
    100.0 * (0.45 * spec.eta + 0.35 * spec.isolation_factor + 0.2 * headroom_term) -
    Math.max(0, I - 8) * 1.2 * (1.0 - spec.isolation_factor);
  const scalability_score = pyRound(Math.min(100.0, Math.max(0.0, raw_scalability)), 2);

  // 7. Disponibilidad efectiva (%)
  const eff_nodes = Math.min(I, spec.m_max_avail_nodes);
  const parallel_avail = 1.0 - (1.0 - spec.a_0) ** eff_nodes;
  const stress_spof_drop = spec.delta_spof * Math.max(0.0, utilization - 0.8);
  const availability_pct = pyRound(
    100.0 * Math.max(0.9, Math.min(0.9999, parallel_avail - stress_spof_drop)),
    3
  );

  // 8. Costo Mensual Estimado (USD/mes)
  const monthly_ocr_guides = 26.0 * U * G;
  const monthly_total_requests = 26.0 * (total_client_req_s * W);
  let monthly_cost_usd: number;
  if (spec.is_serverless_pay_per_use) {
    const reserved_cost = Math.max(0, I - 1) * 8.0;
    const overage_requests = Math.max(0.0, monthly_total_requests - 150000.0);
    const compute_usage_cost = overage_requests * 0.00008 * (1.0 + 0.35 * phi_tsp);
    monthly_cost_usd = pyRound(
      reserved_cost +
        spec.gateway_fixed_cost +
        compute_usage_cost +
        monthly_ocr_guides * spec.ocr_api_unit_cost,
      2
    );
  } else {
    monthly_cost_usd = pyRound(
      spec.infra_unit_cost * I +
        spec.gateway_fixed_cost +
        monthly_ocr_guides * spec.ocr_api_unit_cost,
      2
    );
  }

  // 9. Contenedores activos, uso de CPU (%) y huella de RAM (MB)
  const active_containers = spec.containers_per_instance * I;
  const cpu_usage_pct = pyRound(
    Math.min(100.0, spec.cpu_overhead_pct + Math.min(utilization, 1.15) * 76.0),
    2
  );
  const ram_usage_mb = pyRound(
    spec.base_ram_mb +
      spec.ram_per_inst_mb * Math.max(0, I - 1) +
      U * 0.45 +
      N_p * 1.2 * spec.theta_cloud_ocr,
    1
  );

  // 10. Seguridad/Cifrado e Idoneidad Operativa para el Equipo
  const encryption_bonus = projectConfig.require_encryption ? 6.0 : 0.0;
  const container_surface_penalty = Math.min(6.0, active_containers * 0.18);
  const security_score = pyRound(
    Math.min(100.0, Math.max(0.0, spec.security_base + encryption_bonus - container_surface_penalty)),
    2
  );
  const team_capacity = Math.min(100.0, projectConfig.team_size * 24.0);
  const devops_gap = Math.max(0.0, spec.devops_complexity - team_capacity);
  const team_operability_score = pyRound(Math.max(0.0, 100.0 - devops_gap * 0.85), 2);

  const utilization_pct = pyRound(utilization * 100.0, 2);

  return {
    id: spec.id,
    name: spec.name,
    short_name: spec.short_name,
    subtitle: spec.subtitle,
    latency_ms,
    throughput_req_s,
    max_capacity_req_s,
    error_rate_pct,
    scalability_score,
    availability_pct,
    monthly_cost_usd,
    active_containers,
    cpu_usage_pct,
    ram_usage_mb,
    security_score,
    team_operability_score,
    utilization,
    utilization_pct,
    formula_breakdown: {
      demand_units: pyRound(demand_units, 3),
      capacity_units: pyRound(capacity_units, 3),
      utilization_pct,
      phi_tsp: pyRound(phi_tsp, 3),
      ipc_ms: pyRound(ipc_ms, 2),
      cold_start_ms: pyRound(cold_start_ms, 2),
      weighted_service_ms: pyRound(weighted_service_ms, 2),
      queue_multiplier: pyRound(queue_multiplier, 3),
      over_scale_factor: pyRound(over_scale_factor, 3),
      lambda_crud: pyRound(lambda_crud, 4),
      lambda_ocr_raw: pyRound(lambda_ocr_raw, 4),
      lambda_ocr_cloud: pyRound(lambda_ocr_cloud, 4),
      lambda_tsp: pyRound(lambda_tsp, 4),
      total_client_req_s: pyRound(total_client_req_s, 3),
      backend_req_s: pyRound(backend_req_s, 3),
      tau_tsp_ms: pyRound(tau_tsp_ms, 2),
      saturation_penalty_ms: pyRound(saturation_penalty_ms, 2),
    },
    is_pareto_efficient: false,
    meets_budget: true,
    meets_latency: true,
    meets_availability: true,
    meets_capacity: true,
    meets_all_constraints: true,
    raw_score: 0,
    total_penalty: 0,
    final_score: 0,
    rank: 0,
    normalized_utilities: {
      latency: 0,
      throughput: 0,
      scalability: 0,
      availability: 0,
      cost: 0,
      security: 0,
    },
    penalties_breakdown: {
      budget: 0,
      latency: 0,
      availability: 0,
      capacity: 0,
    },
    architecture_id: spec.id,
    architecture_name: spec.name,
  };
}

/**
 * Análisis de Optimalidad de Pareto 3D (espejo de pareto.py).
 */
export function isDominatedBy(candJ: ArchitectureMetrics, targetK: ArchitectureMetrics): boolean {
  const noWorseInAll =
    candJ.monthly_cost_usd <= targetK.monthly_cost_usd &&
    candJ.latency_ms <= targetK.latency_ms &&
    candJ.availability_pct >= targetK.availability_pct;
  const strictlyBetterInAtLeastOne =
    candJ.monthly_cost_usd < targetK.monthly_cost_usd ||
    candJ.latency_ms < targetK.latency_ms ||
    candJ.availability_pct > targetK.availability_pct;
  return noWorseInAll && strictlyBetterInAtLeastOne;
}

export function getParetoAnalysis(metricsList: ArchitectureMetrics[]): ParetoFrontierInfo {
  const efficientIds: ArchitectureId[] = [];
  const dominatedDetails: Record<string, DominatorDetail[]> = {};

  for (let k = 0; k < metricsList.length; k += 1) {
    const targetK = metricsList[k];
    const dominators: DominatorDetail[] = [];

    for (let j = 0; j < metricsList.length; j += 1) {
      if (j === k) continue;
      const candJ = metricsList[j];
      if (isDominatedBy(candJ, targetK)) {
        dominators.push({
          dominator_id: candJ.id,
          dominator_name: candJ.short_name,
          cost_delta_usd: pyRound(targetK.monthly_cost_usd - candJ.monthly_cost_usd, 2),
          latency_delta_ms: pyRound(targetK.latency_ms - candJ.latency_ms, 2),
          availability_delta_pct: pyRound(candJ.availability_pct - targetK.availability_pct, 3),
        });
      }
    }

    targetK.is_pareto_efficient = dominators.length === 0;
    if (dominators.length === 0) {
      efficientIds.push(targetK.id);
    } else {
      dominatedDetails[targetK.id] = dominators;
    }
  }

  return {
    objectives: ['min(monthly_cost_usd)', 'min(latency_ms)', 'max(availability_pct)'],
    efficient_ids: efficientIds,
    dominated_by: dominatedDetails,
  };
}

export function normalizeWeights(weights: DecisionWeights): Record<CriterionKey, number> {
  const clamped: Record<CriterionKey, number> = {
    latency: Math.max(0, Number(weights.latency) || 0),
    throughput: Math.max(0, Number(weights.throughput) || 0),
    scalability: Math.max(0, Number(weights.scalability) || 0),
    availability: Math.max(0, Number(weights.availability) || 0),
    cost: Math.max(0, Number(weights.cost) || 0),
    security: Math.max(0, Number(weights.security) || 0),
  };
  const sumW = CRITERIA_KEYS.reduce((acc, k) => acc + clamped[k], 0);
  if (sumW <= 1e-9) {
    const uniform = 1.0 / CRITERIA_KEYS.length;
    return {
      latency: uniform,
      throughput: uniform,
      scalability: uniform,
      availability: uniform,
      cost: uniform,
      security: uniform,
    };
  }
  return {
    latency: clamped.latency / sumW,
    throughput: clamped.throughput / sumW,
    scalability: clamped.scalability / sumW,
    availability: clamped.availability / sumW,
    cost: clamped.cost / sumW,
    security: clamped.security / sumW,
  };
}

function minMaxUtility(values: number[], lowerIsBetter: boolean): number[] {
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const span = maxV - minV;
  if (span < 1e-9) {
    return values.map(() => 1.0);
  }
  if (lowerIsBetter) {
    return values.map((v) => (maxV - v) / span);
  }
  return values.map((v) => (v - minV) / span);
}

function describeViolations(m: ArchitectureMetrics, cfg: ProjectConfig): string[] {
  const violations: string[] = [];
  if (!m.meets_budget) {
    const excess = pyRound(m.monthly_cost_usd - cfg.max_budget_usd, 2);
    violations.push(
      `Presupuesto excedido (+$${excess.toFixed(2)} USD/mes: requiere $${m.monthly_cost_usd.toFixed(2)} frente al tope de $${cfg.max_budget_usd.toFixed(2)} USD/mes)`
    );
  }
  if (!m.meets_latency) {
    const excessMs = pyRound(m.latency_ms - cfg.max_latency_ms, 2);
    violations.push(
      `Latencia SLA superada (+${excessMs.toFixed(2)} ms: estima ${m.latency_ms.toFixed(2)} ms frente al máximo permitido de ${cfg.max_latency_ms.toFixed(2)} ms)`
    );
  }
  if (!m.meets_availability) {
    const gapPct = pyRound(cfg.min_availability_pct - m.availability_pct, 3);
    violations.push(
      `Disponibilidad insuficiente (-${gapPct.toFixed(3)} pp: alcanza ${m.availability_pct.toFixed(3)}% frente al SLA mínimo de ${cfg.min_availability_pct.toFixed(2)}%)`
    );
  }
  if (!m.meets_capacity) {
    violations.push(
      `Sobrecarga operativa severa (utilización del ${m.utilization_pct.toFixed(1)}% > 105.0%, con pérdida estimada del ${m.error_rate_pct.toFixed(2)}% de peticiones)`
    );
  }
  return violations;
}

export function runDriverSweepLocal(
  simInput: SimulationInput,
  projectConfig: ProjectConfig = DEFAULT_PROJECT_CONFIG,
  driverPoints: readonly number[] = DEFAULT_DRIVER_SWEEP_POINTS
): DriverSweepEntry[] {
  const specs = getAllArchitectures();
  return driverPoints.map((drivers) => {
    const pointInput: SimulationInput = {
      ...simInput,
      concurrent_drivers: Math.trunc(drivers),
    };
    const evaluated = specs.map((spec) => evaluateArchitecture(spec, pointInput, projectConfig));
    const archMap = {} as Record<ArchitectureId, SweepPointSummary>;
    for (const m of evaluated) {
      archMap[m.id] = {
        id: m.id,
        name: m.name,
        short_name: m.short_name,
        latency_ms: m.latency_ms,
        throughput_req_s: m.throughput_req_s,
        max_capacity_req_s: m.max_capacity_req_s,
        error_rate_pct: m.error_rate_pct,
        scalability_score: m.scalability_score,
        availability_pct: m.availability_pct,
        monthly_cost_usd: m.monthly_cost_usd,
        utilization_pct: m.utilization_pct,
        cpu_usage_pct: m.cpu_usage_pct,
        ram_usage_mb: m.ram_usage_mb,
        active_containers: m.active_containers,
      };
    }
    return {
      concurrent_drivers: Math.trunc(drivers),
      architectures: archMap,
      metrics: evaluated,
    };
  });
}

export function runInstanceSweepLocal(
  simInput: SimulationInput,
  projectConfig: ProjectConfig = DEFAULT_PROJECT_CONFIG,
  instancePoints: readonly number[] = DEFAULT_INSTANCE_SWEEP_POINTS
): InstanceSweepEntry[] {
  const specs = getAllArchitectures();
  return instancePoints.map((instances) => {
    const pointInput: SimulationInput = {
      ...simInput,
      compute_instances: Math.trunc(instances),
    };
    const evaluated = specs.map((spec) => evaluateArchitecture(spec, pointInput, projectConfig));
    const archMap = {} as Record<ArchitectureId, SweepPointSummary>;
    for (const m of evaluated) {
      archMap[m.id] = {
        id: m.id,
        name: m.name,
        short_name: m.short_name,
        latency_ms: m.latency_ms,
        throughput_req_s: m.throughput_req_s,
        max_capacity_req_s: m.max_capacity_req_s,
        error_rate_pct: m.error_rate_pct,
        scalability_score: m.scalability_score,
        availability_pct: m.availability_pct,
        monthly_cost_usd: m.monthly_cost_usd,
        utilization_pct: m.utilization_pct,
        cpu_usage_pct: m.cpu_usage_pct,
        ram_usage_mb: m.ram_usage_mb,
        active_containers: m.active_containers,
        over_scale_factor: m.formula_breakdown.over_scale_factor,
        ipc_ms: m.formula_breakdown.ipc_ms,
        capacity_units: m.formula_breakdown.capacity_units,
      };
    }
    return {
      compute_instances: Math.trunc(instances),
      architectures: archMap,
      metrics: evaluated,
    };
  });
}

function buildExplainableRecommendation(
  rankedMetrics: ArchitectureMetrics[],
  simInput: SimulationInput,
  projectConfig: ProjectConfig,
  normWeights: Record<CriterionKey, number>,
  paretoInfo: ParetoFrontierInfo
): ExplainableRecommendation {
  const winner = rankedMetrics[0];
  const runnerUp = rankedMetrics[1];
  const others = rankedMetrics.slice(1);
  const winnerSpec = ARCHITECTURES[winner.id];

  const uDrivers = simInput.concurrent_drivers;
  const guides = simInput.ocr_guides_per_driver;
  const stops = simInput.stops_per_route;
  const instances = simInput.compute_instances;
  const phiTsp = winner.formula_breakdown.phi_tsp;
  const overScale = winner.formula_breakdown.over_scale_factor;

  let constraintClause: string;
  if (winner.meets_all_constraints) {
    constraintClause = `cumple simultáneamente el 100% de las restricciones duras del proyecto (costo $${winner.monthly_cost_usd.toFixed(2)} <= $${projectConfig.max_budget_usd.toFixed(2)} USD/mes, latencia ${winner.latency_ms.toFixed(2)} <= ${projectConfig.max_latency_ms.toFixed(0)} ms, disponibilidad ${winner.availability_pct.toFixed(3)}% >= ${projectConfig.min_availability_pct.toFixed(2)}% y utilización ${winner.utilization_pct.toFixed(1)}% <= 105%)`;
  } else {
    const violatedSummary = describeViolations(winner, projectConfig).join('; ');
    constraintClause = `ninguna de las 4 arquitecturas logra satisfacer todas las restricciones duras bajo la carga actual, pero esta opción minimiza la degradación y las penalizaciones (incumplimientos detectados: ${violatedSummary})`;
  }

  const paretoClause = winner.is_pareto_efficient
    ? 'pertenece a la Frontera de Optimalidad de Pareto (no existe alternativa más barata, más rápida y más disponible al mismo tiempo)'
    : 'presenta el mejor compromiso global ponderado aunque es dominada parcialmente en el plano puro costo-latencia-disponibilidad';

  const summaryRationale = `Para una operación de ${uDrivers} conductores concurrentes en Bogotá D.C., escaneando ${guides} guías/conductor y optimizando rutas de ${stops} paradas (complejidad OR-Tools phi_tsp = ${phiTsp.toFixed(2)}x) sobre ${instances} instancia(s) lógica(s), la arquitectura recomendada es «${winner.name}» con un puntaje final de ${winner.final_score.toFixed(2)}/100 (superando por ${(winner.final_score - runnerUp.final_score).toFixed(2)} puntos a «${runnerUp.short_name}»). Esta arquitectura ${constraintClause} y ${paretoClause}.`;

  const cheapest = rankedMetrics.reduce((a, b) =>
    b.monthly_cost_usd < a.monthly_cost_usd ? b : a
  );
  const fastest = rankedMetrics.reduce((a, b) => (b.latency_ms < a.latency_ms ? b : a));
  const mostAvail = rankedMetrics.reduce((a, b) =>
    b.availability_pct > a.availability_pct ? b : a
  );
  const mostScalable = rankedMetrics.reduce((a, b) =>
    b.scalability_score > a.scalability_score ? b : a
  );

  const monthlyGuidesFormatted = Math.trunc(26 * uDrivers * guides).toLocaleString('en-US');

  const detailedReasons: string[] = [
    `Desempeño de Latencia y Encolamiento (peso normalizado ${(normWeights.latency * 100).toFixed(1)}%): registra ${winner.latency_ms.toFixed(2)} ms extremo a extremo (servicio ponderado ${winner.formula_breakdown.weighted_service_ms.toFixed(2)} ms, multiplicador de cola M/G/1 ${winner.formula_breakdown.queue_multiplier.toFixed(3)}x, IPC ${winner.formula_breakdown.ipc_ms.toFixed(2)} ms y cold-start ${winner.formula_breakdown.cold_start_ms.toFixed(2)} ms), frente a ${fastest.latency_ms.toFixed(2)} ms de la alternativa más veloz (${fastest.short_name}) y ${runnerUp.latency_ms.toFixed(2)} ms del segundo lugar (${runnerUp.short_name}).`,
    `Eficiencia Financiera y Presupuesto Mensual (peso ${(normWeights.cost * 100).toFixed(1)}%): estima $${winner.monthly_cost_usd.toFixed(2)} USD/mes para procesar ~${monthlyGuidesFormatted} guías OCR/mes (límite del proyecto: $${projectConfig.max_budget_usd.toFixed(2)} USD/mes; alternativa más económica: ${cheapest.short_name} con $${cheapest.monthly_cost_usd.toFixed(2)} USD/mes).`,
    `Capacidad Efectiva, Throughput y Solver TSP (pesos throughput ${(normWeights.throughput * 100).toFixed(1)}% + escalabilidad ${(normWeights.scalability * 100).toFixed(1)}%): procesa ${winner.throughput_req_s.toFixed(2)} req/s con techo máximo de ${winner.max_capacity_req_s.toFixed(2)} req/s, utilización de capacidad del ${winner.utilization_pct.toFixed(1)}% (${winner.formula_breakdown.demand_units.toFixed(2)} / ${winner.formula_breakdown.capacity_units.toFixed(2)} unidades) y puntaje de escalabilidad de ${winner.scalability_score.toFixed(2)}/100 (líder en escalabilidad: ${mostScalable.short_name} con ${mostScalable.scalability_score.toFixed(2)}/100).`,
    `Disponibilidad Resiliente y Gobernanza de Equipo (pesos disponibilidad ${(normWeights.availability * 100).toFixed(1)}% + seguridad/operabilidad ${(normWeights.security * 100).toFixed(1)}%): ofrece ${winner.availability_pct.toFixed(3)}% de disponibilidad efectiva (máxima del grupo: ${mostAvail.availability_pct.toFixed(3)}% en ${mostAvail.short_name}), seguridad de ${winner.security_score.toFixed(2)}/100 (${winner.active_containers} contenedores activos) e idoneidad operativa de ${winner.team_operability_score.toFixed(2)}/100 para un equipo de ${projectConfig.team_size} desarrollador(es) (complejidad DevOps base ${winnerSpec.devops_complexity.toFixed(0)}/100).`,
  ];

  if (instances > 6) {
    detailedReasons.push(
      `Efecto de Sobre-escalado Horizontal (Blinowski et al., 2022): al operar con I = ${instances} instancias (> 6), se activa el factor de degradación por coordinación inter-nodo (over_scale_factor = ${overScale.toFixed(3)}) y aumenta la latencia IPC proporcional al número de réplicas, penalizando con mayor fuerza a arquitecturas con estado compartido o alta sobrecarga de red.`
    );
  }

  if (stops > 80) {
    detailedReasons.push(
      `Complejidad Algorítmica Superlineal en Ruteo Urbano: con ${stops} paradas por ruta, la matriz Haversine N×N y la búsqueda local guiada de OR-Tools elevan phi_tsp a ${phiTsp.toFixed(2)}x respecto a una ruta estándar de 30 paradas, premiando el desacoplamiento del solver C++ frente al hilo principal de peticiones HTTP.`
    );
  }

  const rejectedAlternatives: RejectedAlternative[] = others.map((alt) => {
    const violations = describeViolations(alt, projectConfig);
    const scoreGap = pyRound(winner.final_score - alt.final_score, 2);
    const dominators = paretoInfo.dominated_by[alt.id] ?? [];

    const reasonParts: string[] = [
      `Obtuvo ${alt.final_score.toFixed(2)}/100 (-${scoreGap.toFixed(2)} pts frente a ${winner.short_name}; puntaje bruto MCDA ${alt.raw_score.toFixed(2)} menos penalización total ${alt.total_penalty.toFixed(2)}).`,
    ];

    if (violations.length > 0) {
      reasonParts.push(`Violó restricciones duras: ${violations.join('; ')}.`);
    } else {
      const diffs: string[] = [];
      if (alt.latency_ms > winner.latency_ms) {
        diffs.push(
          `+${(alt.latency_ms - winner.latency_ms).toFixed(2)} ms más lenta (${alt.latency_ms.toFixed(2)} ms)`
        );
      }
      if (alt.monthly_cost_usd > winner.monthly_cost_usd) {
        diffs.push(
          `+$${(alt.monthly_cost_usd - winner.monthly_cost_usd).toFixed(2)} USD/mes más costosa ($${alt.monthly_cost_usd.toFixed(2)} USD/mes)`
        );
      }
      if (alt.scalability_score < winner.scalability_score) {
        diffs.push(
          `-${(winner.scalability_score - alt.scalability_score).toFixed(2)} pts en escalabilidad (${alt.scalability_score.toFixed(2)}/100)`
        );
      }
      if (alt.availability_pct < winner.availability_pct) {
        diffs.push(
          `-${(winner.availability_pct - alt.availability_pct).toFixed(3)} pp en disponibilidad (${alt.availability_pct.toFixed(3)}%)`
        );
      }
      if (alt.team_operability_score < winner.team_operability_score) {
        diffs.push(
          `menor operabilidad para un equipo de ${projectConfig.team_size} personas (${alt.team_operability_score.toFixed(2)}/100)`
        );
      }
      if (diffs.length > 0) {
        reasonParts.push(
          `Cumplió las restricciones duras, pero resultó inferior en el balance ponderado: ${diffs.join(', ')}.`
        );
      }
    }

    if (dominators.length > 0) {
      const domNames = dominators.map((d) => d.dominator_name).join(', ');
      reasonParts.push(`Además, es dominada en la Frontera de Pareto por: ${domNames}.`);
    }

    return {
      id: alt.id,
      architecture_id: alt.id,
      name: alt.name,
      short_name: alt.short_name,
      rank: alt.rank,
      final_score: alt.final_score,
      raw_score: alt.raw_score,
      total_penalty: alt.total_penalty,
      meets_all_constraints: alt.meets_all_constraints,
      violated_constraints: violations,
      is_pareto_efficient: alt.is_pareto_efficient,
      reason: reasonParts.join(' '),
    };
  });

  const advantages = [
    ...winnerSpec.advantages,
    `Bajo el escenario simulado mantiene ${winner.cpu_usage_pct.toFixed(1)}% de uso estimado de CPU, ${winner.ram_usage_mb.toFixed(1)} MB de huella de RAM y tasa de error de ${winner.error_rate_pct.toFixed(2)}%.`,
  ];

  const limitations = [...winnerSpec.limitations];
  if (winner.utilization > 0.8) {
    limitations.push(
      `Precaución operativa: la utilización actual (${winner.utilization_pct.toFixed(1)}%) ya supera el umbral del 80%, donde el encolamiento no lineal comienza a amplificar la latencia de cola.`
    );
  }

  const assumptions = [
    ...winnerSpec.assumptions,
    `Ventana activa de alistamiento y despacho matutino W = ${Math.trunc(W)} s (30 min) con promedio de 1.5 optimizaciones TSP por ruta sobre 26 días operativos al mes en Colombia.`,
    'Complejidad empírica del solver Google OR-Tools (matriz Haversine + GUIDED_LOCAL_SEARCH) modelada como phi_tsp = (N_p / 30)^1.85 y factor de encolamiento tipo Pollaczek-Khinchine.',
  ];

  const modelDisclaimer =
    'AVISO METODOLÓGICO: Todos los indicadores reportados (latencia en ms, throughput en req/s, disponibilidad %, consumo de CPU/RAM y facturación mensual en USD) corresponden a estimaciones matemáticas deterministas producidas por ecuaciones analíticas de teoría de colas, confiabilidad en paralelo y factores de calibración extraídos de literatura científica (Sunardi & Suharjito 2019; Tapia et al. 2020; Blinowski et al. 2022; Al-Debagy & Martinek 2018). NO constituyen mediciones físicas en tiempo real ni benchmarks empíricos ejecutados sobre infraestructura productiva.';

  const realWorldValidationSteps = [
    'Pruebas de carga y estrés reproducibles con Apache JMeter (o Locust/k6): diseñar planes de prueba que inyecten concurrencia escalonada sobre los endpoints reales de EnRuta (`POST /api/v1/ocr` con fotografías reales de guías de Servientrega/Interrapidísimo, `POST /api/v1/routes/{id}/optimize` con 30–120 coordenadas de Bogotá y `PUT /api/v1/stops/{id}/estado`).',
    'Despliegue de topologías contenerizadas con Docker en entorno cloud controlado: instanciar cada arquitectura candidata en nodos aislados con cuotas idénticas de vCPU, memoria cgroups y red en AWS/GCP/DigitalOcean, evitando interferencia de procesos locales.',
    'Instrumentación APM y telemetría continua (New Relic, Prometheus + Grafana + cAdvisor y OpenTelemetry): capturar métricas reales de latencia percentil (p50, p50/p95, p99), tiempo de bloqueo del event loop de Uvicorn, consumo de CPU/RAM por contenedor y throughput de PostgreSQL.',
    'Rigor estadístico mediante mediana de múltiples corridas independientes: ejecutar fases previas de calentamiento (warm-up) para estabilizar cachés/JIT/contenedores efímeros, repetir al menos 10 a 30 corridas por nivel de carga y reportar mediana, rango intercuartílico (IQR) e intervalos de confianza al 95%.',
  ];

  return {
    winner_id: winner.id,
    winner_name: winner.name,
    winner_short_name: winner.short_name,
    winner_score: winner.final_score,
    all_constraints_met: winner.meets_all_constraints,
    summary_rationale: summaryRationale,
    detailed_reasons: detailedReasons,
    rejected_alternatives: rejectedAlternatives,
    advantages,
    limitations,
    assumptions,
    model_disclaimer: modelDisclaimer,
    real_world_validation_steps: realWorldValidationSteps,
  };
}

/**
 * Ejecuta la simulación matemática completa en cliente (paridad 100% con run_full_simulation de Python).
 */
export function runFullSimulationLocal(
  simInput: SimulationInput = DEFAULT_SIMULATION_INPUT,
  projectConfig: ProjectConfig = DEFAULT_PROJECT_CONFIG
): SimulationResult {
  const specs = getAllArchitectures();
  const metricsList = specs.map((spec) => evaluateArchitecture(spec, simInput, projectConfig));

  // 1. Frontera de Pareto
  const paretoInfo = getParetoAnalysis(metricsList);

  // 2. Verificación de restricciones duras
  for (const m of metricsList) {
    m.meets_budget = m.monthly_cost_usd <= projectConfig.max_budget_usd;
    m.meets_latency = m.latency_ms <= projectConfig.max_latency_ms;
    m.meets_availability = m.availability_pct >= projectConfig.min_availability_pct;
    m.meets_capacity = m.utilization <= 1.05;
    m.meets_all_constraints =
      m.meets_budget && m.meets_latency && m.meets_availability && m.meets_capacity;
  }

  // 3. Normalización Min-Max
  const uLatency = minMaxUtility(
    metricsList.map((m) => m.latency_ms),
    true
  );
  const uCost = minMaxUtility(
    metricsList.map((m) => m.monthly_cost_usd),
    true
  );
  const uThroughput = minMaxUtility(
    metricsList.map((m) => m.throughput_req_s),
    false
  );
  const uScalability = minMaxUtility(
    metricsList.map((m) => m.scalability_score),
    false
  );
  const uAvailability = minMaxUtility(
    metricsList.map((m) => m.availability_pct),
    false
  );
  const compositeSecurity = metricsList.map(
    (m) => 0.7 * m.security_score + 0.3 * m.team_operability_score
  );
  const uSecurity = minMaxUtility(compositeSecurity, false);

  // 4. Pesos normalizados + puntaje bruto + penalizaciones
  const normWeights = normalizeWeights(projectConfig.weights);

  metricsList.forEach((m, idx) => {
    const utilities: Record<CriterionKey, number> = {
      latency: uLatency[idx],
      throughput: uThroughput[idx],
      scalability: uScalability[idx],
      availability: uAvailability[idx],
      cost: uCost[idx],
      security: uSecurity[idx],
    };

    const rawScore =
      100.0 * CRITERIA_KEYS.reduce((acc, k) => acc + normWeights[k] * utilities[k], 0);

    const budgetPenalty = !m.meets_budget
      ? 18.0 +
        Math.min(
          25.0,
          ((m.monthly_cost_usd - projectConfig.max_budget_usd) /
            Math.max(projectConfig.max_budget_usd, 1.0)) *
            20.0
        )
      : 0.0;

    const latencyPenalty = !m.meets_latency
      ? 20.0 +
        Math.min(
          25.0,
          ((m.latency_ms - projectConfig.max_latency_ms) /
            Math.max(projectConfig.max_latency_ms, 1.0)) *
            20.0
        )
      : 0.0;

    const availabilityPenalty = !m.meets_availability
      ? 22.0 + Math.min(20.0, (projectConfig.min_availability_pct - m.availability_pct) * 25.0)
      : 0.0;

    const capacityPenalty = !m.meets_capacity ? 20.0 : 0.0;

    const totalPenalty = budgetPenalty + latencyPenalty + availabilityPenalty + capacityPenalty;
    let finalScore: number;
    if (rawScore > totalPenalty) {
      finalScore = pyRound(rawScore - totalPenalty, 2);
    } else {
      // Amortiguación proporcional defensiva: cuando las penalizaciones superan el
      // puntaje bruto (ej. escenarios de alto estrés donde ninguna alternativa cumple
      // el 100% de las restricciones), se aplica un descuento porcentual acotado
      // para que las arquitecturas sigan siendo diferenciables y no colapsen todas a 0.0
      const penaltyDiscount = Math.min(0.88, totalPenalty / Math.max(100.0, totalPenalty));
      const saturationFactor = Math.max(0.12, 1.0 - m.error_rate_pct / 100.0);
      const scoreCalc = rawScore * (1.0 - penaltyDiscount) * saturationFactor;
      finalScore = pyRound(Math.max(0.5, scoreCalc), 2);
    }

    m.normalized_utilities = {
      latency: pyRound(utilities.latency, 4),
      throughput: pyRound(utilities.throughput, 4),
      scalability: pyRound(utilities.scalability, 4),
      availability: pyRound(utilities.availability, 4),
      cost: pyRound(utilities.cost, 4),
      security: pyRound(utilities.security, 4),
    };
    m.penalties_breakdown = {
      budget: pyRound(budgetPenalty, 2),
      latency: pyRound(latencyPenalty, 2),
      availability: pyRound(availabilityPenalty, 2),
      capacity: pyRound(capacityPenalty, 2),
    };
    m.raw_score = pyRound(rawScore, 2);
    m.total_penalty = pyRound(totalPenalty, 2);
    m.final_score = finalScore;
  });

  // 5. Ranking: (meets_all_constraints, final_score, raw_score) descendente
  const rankedMetrics = [...metricsList].sort((a, b) => {
    if (a.meets_all_constraints !== b.meets_all_constraints) {
      return a.meets_all_constraints ? -1 : 1;
    }
    if (b.final_score !== a.final_score) {
      return b.final_score - a.final_score;
    }
    return b.raw_score - a.raw_score;
  });

  rankedMetrics.forEach((m, index) => {
    m.rank = index + 1;
  });

  // 6. Recomendación explicable
  const recommendation = buildExplainableRecommendation(
    rankedMetrics,
    simInput,
    projectConfig,
    normWeights,
    paretoInfo
  );

  // 7. Curvas de barrido
  const driverSweep = runDriverSweepLocal(simInput, projectConfig);
  const instanceSweep = runInstanceSweepLocal(simInput, projectConfig);

  return {
    sim_input: { ...simInput },
    project_config: {
      ...projectConfig,
      weights: { ...projectConfig.weights },
    },
    normalized_weights: {
      latency: pyRound(normWeights.latency, 4),
      throughput: pyRound(normWeights.throughput, 4),
      scalability: pyRound(normWeights.scalability, 4),
      availability: pyRound(normWeights.availability, 4),
      cost: pyRound(normWeights.cost, 4),
      security: pyRound(normWeights.security, 4),
    },
    architectures: metricsList,
    ranking: rankedMetrics,
    pareto_frontier: paretoInfo,
    pareto_efficient_ids: paretoInfo.efficient_ids,
    recommendation,
    driver_sweep: driverSweep,
    instance_sweep: instanceSweep,
  };
}

export function applyScenarioPreset(
  preset: ScenarioPreset,
  currentConfig: ProjectConfig = DEFAULT_PROJECT_CONFIG
): { simInput: SimulationInput; projectConfig: ProjectConfig } {
  const overrides = preset.project_config_overrides;
  const mergedWeights: DecisionWeights = {
    ...currentConfig.weights,
    ...(overrides.weights ?? {}),
  };
  return {
    simInput: { ...preset.sim_input },
    projectConfig: {
      ...currentConfig,
      ...overrides,
      weights: mergedWeights,
    },
  };
}
