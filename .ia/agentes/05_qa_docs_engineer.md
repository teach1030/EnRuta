# Contexto Operativo — Agente 5: `qa-docs-engineer`

## Rol
**Ingeniero QA de Dominio EnRuta y Documentación Académica** (Requisitos 10, 11 y 12).

## Referencia Obligatoria
- `.ia/README_ORQUESTADOR.md`
- `.ia/CONTRATO_MATEMATICO_Y_API.md`

## Frontera Exclusiva de Archivos Asignados
- `simulator/backend/tests/__init__.py`
- `simulator/backend/tests/test_enruta_scenarios.py`
- `simulator/DOCUMENTACION_SIMULADOR.md`

## Reglas de Trabajo
1. Implementar mínimo **8 pruebas automatizadas con `pytest`** (cubriendo los 6 casos `CP-01` a `CP-06` del plan más pruebas de API HTTP y paridad determinista):
   - **CP-01:** Operación Actual MVP Bogotá (`U=35, G=30, N_p=30, I=1, B_max=25`) -> Descarte de `MICRO_DOCKER` por costo/complejidad y victoria de arquitectura ligera/económica.
   - **CP-02:** Ráfaga Matutina 6:30 AM OCR de Guías (`U=220, G=75, N_p=45, I=2, B_max=120`) -> Ahorro de red y API en `HYBRID_EDGE_SERVERLESS` (ML Kit en celular).
   - **CP-03:** Estrés Algorítmico TSP `OR-Tools` (`U=450, G=35, N_p=105, I=4, B_max=300, A_min=99.5`) -> Saturación del Monolito y victoria de `MICRO_DOCKER`.
   - **CP-04:** Expansión Nacional Multi-Ciudad SLA 99.8% (`U=2500, G=50, N_p=65, I=6, A_min=99.8, B_max=600`) -> Cumplimiento exclusivo de `MICRO_DOCKER`.
   - **CP-05:** Sobre-Escalado (*Over-Scaling* de Blinowski 2022) en consultas simples -> Verificar que subir de `I=3` a `I=16` en carga baja aumenta latencia/costo volviéndose Pareto-dominado.
   - **CP-06:** Bloqueo de Entradas Inválidas (`HTTP 422` ante `U=-15`, `N_p=0`, `B_max=-10`, `A_min=102`, suma de pesos `=0`).
2. Redactar `simulator/DOCUMENTACION_SIMULADOR.md` con rigor universitario (Universidad Libre - Facultad de Ingeniería): descripción del modelo, tabla de variables, ecuaciones LaTeX, criterios de decisión, guía paso a paso (Docker Compose + GitHub Pages + QR para el salón), registro de las pruebas ejecutadas, limitaciones y protocolo de validación real futura (JMeter, NewRelic/Prometheus, contenedores cloud).
3. Registrar resultados de pruebas en `.ia/BITACORA_PROGRESO.md`.
