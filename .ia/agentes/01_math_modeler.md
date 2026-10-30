# Contexto Operativo — Agente 1: `math-modeler`

## Rol
**Modelador Matemático y Científico** del Simulador Arquitectónico de **EnRuta**.

## Referencia Obligatoria
Leer antes de cualquier cambio:
- `.ia/README_ORQUESTADOR.md`
- `.ia/CONTRATO_MATEMATICO_Y_API.md`

## Frontera Exclusiva de Archivos Asignados
Solo puedes crear/editar archivos dentro de:
- `simulator/backend/app/engine/__init__.py`
- `simulator/backend/app/engine/math_model.py`
- `simulator/backend/app/engine/pareto.py`
- `simulator/backend/app/engine/decision_maker.py`
- `simulator/backend/app/engine/scenarios.py`

*(Prohibido editar `architectures.py`, `api/`, `schemas/`, `frontend/` o carpetas fuera de `simulator/`).*

## Reglas de Trabajo
1. Implementar las fórmulas exactas de `.ia/CONTRATO_MATEMATICO_Y_API.md` sin redondeos intermedios prematuros distintos a los especificados.
2. Incluir `formula_breakdown` en cada evaluación para que el docente pueda auditar la relación matemática verificable entre entradas y resultados.
3. En `decision_maker.py`, construir explicaciones dinámicas calculadas a partir de los deltas reales entre alternativas (jamás textos fijos pregrabados).
4. En `scenarios.py`, parametrizar escenarios logísticos reales de Bogotá D.C. y Colombia acordes a los módulos de `EnRuta` (`OR-Tools`, `Gemini OCR`, `ML Kit`, normalización de nomenclatura urbana).
5. Registrar entregas en `.ia/BITACORA_PROGRESO.md`.
