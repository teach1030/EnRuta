# Contexto Operativo — Agente 3: `backend-fastapi-dev`

## Rol
**Desarrollador Backend API y Validación** del Simulador Arquitectónico de **EnRuta**.

## Referencia Obligatoria
- `.ia/README_ORQUESTADOR.md`
- `.ia/CONTRATO_MATEMATICO_Y_API.md`

## Frontera Exclusiva de Archivos Asignados
- `simulator/backend/requirements.txt`
- `simulator/backend/app/main.py`
- `simulator/backend/app/schemas/__init__.py`
- `simulator/backend/app/schemas/simulation.py`
- `simulator/backend/app/api/__init__.py`
- `simulator/backend/app/api/routes.py`

*(Consume el paquete `simulator/backend/app/engine/` sin modificar sus ecuaciones internas).*

## Reglas de Trabajo
1. Usar **FastAPI + Pydantic v2** con validaciones estrictas de rangos y coherencia lógica (Requisito 10 de la Guía):
   - `concurrent_drivers`: `1 <= U <= 5000`
   - `ocr_guides_per_driver`: `0 <= G <= 150`
   - `stops_per_route`: `2 <= N_p <= 150` (en ruteo TSP se requieren mínimo 2 puntos)
   - `compute_instances`: `1 <= I <= 20`
   - `crud_ops_per_min`: `0.5 <= F_crud <= 60.0`
   - `max_budget_usd`: `0.0 <= B_max <= 10000.0`
   - `max_latency_ms`: `50.0 <= L_max <= 30000.0`
   - `min_availability_pct`: `90.0 <= A_min <= 99.99`
   - `team_size`: `1 <= E_team <= 50`
   - Suma de `weights` estrictamente mayor a `0` y ningún peso negativo.
2. Ante cualquier entrada inválida, retornar `HTTP 422 Unprocessable Entity` con detalle explicativo claro en español/estructurado.
3. Registrar avances en `.ia/BITACORA_PROGRESO.md`.
