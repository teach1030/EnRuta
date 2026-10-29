# Contrato Matemático y de API — Fuente Única de Verdad (`Single Source of Truth`)

Todos los agentes (`math-modeler`, `arch-docker-specialist`, `backend-fastapi-dev`, `frontend-react-dev` y `qa-docs-engineer`) deben ceñirse estrictamente a estas ecuaciones, constantes y contratos de datos.

---

## 1. Identificadores y Parámetros Calibrados de las 4 Arquitecturas de `EnRuta`

Orden canónico: `["MONO_MVP", "MONO_ASYNC_CONTAINER", "MICRO_DOCKER", "HYBRID_EDGE_SERVERLESS"]`

| Parámetro | `MONO_MVP` | `MONO_ASYNC_CONTAINER` | `MICRO_DOCKER` | `HYBRID_EDGE_SERVERLESS` | Sustento Científico / Dominio `EnRuta` |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `mu_0` (unid/s base) | `85.0` | `140.0` | `210.0` | `165.0` | Capacidad unitaria por nodo/instancia |
| `eta` (exp. escalado) | `0.62` | `0.78` | `0.92` | `0.88` | Escalado horizontal casi lineal en TSP aislado (*Blinowski 2022*) |
| `beta_coord` | `0.012` | `0.009` | `0.008` | `0.004` | Penalización de *over-scaling* para `I > 6` (*Blinowski 2022*) |
| `theta_cloud_ocr` | `1.0` | `1.0` | `1.0` | `0.15` | En Edge ML Kit el OCR ocurre en el celular; solo sube JSON ligero |
| `c_crud` | `1.0` | `1.0` | `1.25` | `1.1` | Sobrecarga de serialización/Gateway en peticiones simples |
| `c_ocr` | `4.2` | `3.1` | `2.4` | `1.2` | Costo CPU/I/O por guía escaneada y geocodificada |
| `c_tsp` | `26.0` | `11.5` | `7.2` | `15.5` | Bloqueo síncrono `OR-Tools` en Monolito vs contenedor dedicado |
| `l_base` (ms) | `38.0` | `44.0` | `52.0` | `48.0` | Latencia mínima base estilo micro-framework (*Sunardi 2019*) |
| `l_ipc_base` (ms) | `0.0` | `9.0` | `24.0` | `14.0` | Latencia Gateway + Service Discovery (*Al-Debagy 2018*) |
| `l_ipc_per_inst` (ms) | `0.0` | `1.2` | `2.1` | `0.5` | Costo extra de ruteo por instancia adicional |
| `tau_crud` (ms) | `18.0` | `20.0` | `24.0` | `22.0` | Servicio promedio CRUD paradas multi-cliente |
| `tau_ocr` (ms) | `320.0` | `270.0` | `230.0` | `65.0` | Servicio OCR backend + normalización Bogotá + Mapbox |
| `tau_tsp_base` (ms) | `95.0` | `85.0` | `75.0` | `105.0` | Base solver `OR-Tools` |
| `alpha_tsp` (ms) | `140.0` | `115.0` | `82.0` | `165.0` | Factor de crecimiento por matriz Haversine $O(N_p^2)$ |
| `has_serverless_cold_start` | `False` | `False` | `False` | `True` | Arranque en frío y degradación FaaS en rutas gigantes |
| `a_0` | `0.9920` | `0.9945` | `0.9960` | `0.9955` | Disponibilidad base por instancia |
| `m_max_avail_nodes` | `1` | `3` | `6` | `5` | Límite de redundancia efectiva (SPOF BD única en Monolito) |
| `delta_spof` | `0.018` | `0.008` | `0.003` | `0.006` | Caída de disponibilidad bajo estrés $\rho > 0.80$ |
| `infra_unit_cost` (USD) | `12.0` | `18.0` | `24.0` | `0.0` | Costo mensual por instancia cloud (*Blinowski 2022*) |
| `gateway_fixed_cost` (USD) | `0.0` | `6.0` | `18.0` | `0.0` | Costo fijo mensual Gateway / Broker Redis |
| `ocr_api_unit_cost` (USD) | `0.00025` | `0.00025` | `0.00025` | `0.0` | Gemini Vision API vs ML Kit gratuito en dispositivo |
| `is_serverless_pay_per_use` | `False` | `False` | `False` | `True` | Modelo de cobro por invocaciones sobre capa gratuita |
| `containers_per_instance` | `0` | `3` | `5` | `0` | Contenedores Docker activos por réplica (*Tapia 2020*) |
| `base_ram_mb` | `420.0` | `340.0` | `290.0` | `180.0` | Menor huella base en contenedores vs VM completa (*Tapia 2020*) |
| `ram_per_inst_mb` | `310.0` | `260.0` | `220.0` | `128.0` | Escalamiento de memoria por réplica |
| `cpu_overhead_pct` | `4.0` | `7.5` | `12.5` | `5.5` | Mayor actividad CPU/red en Docker (*Tapia 2020*: +5.46 unid.) |
| `isolation_factor` | `0.15` | `0.62` | `0.95` | `0.80` | Aislamiento ante fallos y desacoplamiento modular |
| `security_base` | `76.0` | `84.0` | `91.0` | `86.0` | Nivel base de aislamiento y control de secretos |
| `devops_complexity` | `18.0` | `45.0` | `82.0` | `25.0` | Carga cognitiva operativa para el equipo de `EnRuta` (3 devs) |

---

## 2. Ecuaciones Exactas Paso a Paso

Constantes globales: `W = 1800.0` (ventana pico matutina de 30 min en segundos), `R_RECALC = 1.5`.

1. **Tasas de llegada (peticiones/s):**
   - `lambda_crud = (U * F_crud) / 60.0`
   - `lambda_ocr_raw = (U * G) / W`
   - `lambda_ocr_cloud = lambda_ocr_raw * spec.theta_cloud_ocr`
   - `lambda_tsp = (U * R_RECALC) / W`
   - `total_client_req_s = lambda_crud + lambda_ocr_raw + lambda_tsp`
   - `backend_req_s = lambda_crud + lambda_ocr_cloud + lambda_tsp`
2. **Factor de complejidad TSP (`OR-Tools`):**
   - `phi_tsp = (N_p / 30.0) ** 1.85`
3. **Demanda, Capacidad y Utilización:**
   - `demand_units = (lambda_crud * spec.c_crud) + (lambda_ocr_cloud * spec.c_ocr) + (lambda_tsp * spec.c_tsp * phi_tsp)`
   - `over_scale_factor = max(0.55, 1.0 - spec.beta_coord * (max(0, I - 6) ** 2))`
   - `capacity_units = spec.mu_0 * (I ** spec.eta) * over_scale_factor`
   - `utilization = demand_units / max(capacity_units, 1e-6)`
4. **Latencia Estimada (`latency_ms`):**
   - `tau_tsp_ms = spec.tau_tsp_base + spec.alpha_tsp * phi_tsp`
   - `weighted_service_ms = ((lambda_crud * spec.tau_crud) + (lambda_ocr_cloud * spec.tau_ocr) + (lambda_tsp * tau_tsp_ms)) / max(backend_req_s, 1e-6)`
   - `cold_start_ms = ((180.0 / (1.0 + 0.08 * U)) + max(0.0, (N_p - 80.0) * 14.0))` si `has_serverless_cold_start` sino `0.0`
   - `ipc_ms = spec.l_ipc_base + spec.l_ipc_per_inst * max(0, I - 1)`
   - `rho_eff = min(utilization, 0.985)`
   - `queue_multiplier = 1.0 + ((rho_eff ** 2) / (1.0 - rho_eff))`
   - `saturation_penalty_ms = max(0.0, utilization - 1.0) * 2800.0`
   - `latency_ms = round(spec.l_base + ipc_ms + (weighted_service_ms * queue_multiplier) + cold_start_ms + saturation_penalty_ms, 2)`
5. **Throughput, Capacidad y Tasa de Error:**
   - `avg_cost_per_client_req = demand_units / max(total_client_req_s, 1e-6)`
   - `max_capacity_req_s = round(capacity_units / max(avg_cost_per_client_req, 1e-6), 2)`
   - `drop_prob = 0.0` si `utilization <= 0.92` sino `min(0.85, max(0.0, 1.0 - (0.92 / utilization)))`
   - `error_rate_pct = round(drop_prob * 100.0, 2)`
   - `throughput_req_s = round(total_client_req_s * (1.0 - drop_prob), 2)`
6. **Escalabilidad (`scalability_score`):**
   - `headroom_term = max(0.0, 1.0 - min(1.0, utilization / 1.25))`
   - `raw_scalability = 100.0 * (0.45 * spec.eta + 0.35 * spec.isolation_factor + 0.20 * headroom_term) - (max(0, I - 8) * 1.2 * (1.0 - spec.isolation_factor))`
   - `scalability_score = round(min(100.0, max(0.0, raw_scalability)), 2)`
7. **Disponibilidad (`availability_pct`):**
   - `eff_nodes = min(I, spec.m_max_avail_nodes)`
   - `parallel_avail = 1.0 - ((1.0 - spec.a_0) ** eff_nodes)`
   - `stress_spof_drop = spec.delta_spof * max(0.0, utilization - 0.80)`
   - `availability_pct = round(100.0 * max(0.90, min(0.9999, parallel_avail - stress_spof_drop)), 3)`
8. **Costo Mensual (`monthly_cost_usd`):**
   - `monthly_ocr_guides = 26.0 * U * G`
   - `monthly_total_requests = 26.0 * (total_client_req_s * W)`
   - Si `is_serverless_pay_per_use`:
     - `reserved_cost = max(0, I - 1) * 8.0`
     - `overage_requests = max(0.0, monthly_total_requests - 150000.0)`
     - `compute_usage_cost = overage_requests * 0.00008 * (1.0 + 0.35 * phi_tsp)`
     - `monthly_cost_usd = round(reserved_cost + spec.gateway_fixed_cost + compute_usage_cost + (monthly_ocr_guides * spec.ocr_api_unit_cost), 2)`
   - Si no:
     - `monthly_cost_usd = round((spec.infra_unit_cost * I) + spec.gateway_fixed_cost + (monthly_ocr_guides * spec.ocr_api_unit_cost), 2)`
9. **Contenedores, CPU, RAM, Seguridad e Idoneidad Operativa:**
   - `active_containers = spec.containers_per_instance * I`
   - `cpu_usage_pct = round(min(100.0, spec.cpu_overhead_pct + (min(utilization, 1.15) * 76.0)), 2)`
   - `ram_usage_mb = round(spec.base_ram_mb + (spec.ram_per_inst_mb * max(0, I - 1)) + (U * 0.45) + (N_p * 1.2 * spec.theta_cloud_ocr), 1)`
   - `encryption_bonus = 6.0` si `require_encryption` sino `0.0`
   - `container_surface_penalty = min(6.0, active_containers * 0.18)`
   - `security_score = round(min(100.0, max(0.0, spec.security_base + encryption_bonus - container_surface_penalty)), 2)`
   - `team_capacity = min(100.0, team_size * 24.0)`
   - `devops_gap = max(0.0, spec.devops_complexity - team_capacity)`
   - `team_operability_score = round(max(0.0, 100.0 - devops_gap * 0.85), 2)`

---

## 3. Contrato de Endpoints REST (`/api/v1`)
- `GET /api/v1/health`: Estado del contenedor backend (`{"status": "ok", "service": "enruta-architecture-simulator"}`).
- `GET /api/v1/architectures`: Catálogo completo de las 4 alternativas arquitectónicas de `EnRuta`.
- `GET /api/v1/scenarios`: Escenario de referencia + escenarios preconfigurados de `EnRuta`.
- `POST /api/v1/simulate`: Recibe `{ "sim_input": {...}, "project_config": {...} }` y retorna métricas de las 4 arquitecturas, banderas de Pareto, evaluación de restricciones, ranking multicriterio y recomendación explicable completa.
- `POST /api/v1/simulate/sweep`: Recibe `{ "sim_input": {...}, "project_config": {...} }` y retorna las curvas de barrido por número de conductores (`driver_sweep`) y por número de instancias (`instance_sweep`) para graficar la escalabilidad y el efecto de sobre-escalado.
