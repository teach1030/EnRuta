# Gobernanza Multi-Agente — Orquestador Central (`EnRuta Simulator`)

## 1. Propósito del Directorio `.ia/`
Este directorio centraliza el **contexto operativo, los contratos matemáticos/API y la bitácora de progreso** de los **5 Agentes Especializados** coordinados por el **Agente Orquestador Central** para desarrollar el Simulador Web de Arquitecturas de Software del proyecto **EnRuta** (*Curso: Ingeniería Aplicada - Guía Actividad 9, Universidad Libre*).

## 2. Reglas Globales Inquebrantables para Todos los Agentes
1. **Aislamiento Estricto del Código Existente:** Ningún agente tiene permiso de modificar `EnRuta/backend/` ni el código funcional de `EnRuta/mobile/` (con la única excepción de `EnRuta/mobile/.easignore` para evitar que `simulator/` y `.ia/` se suban a Expo EAS al compilar el `.apk`).
2. **Fronteras de Archivos Sin Colisión:** Cada agente solo puede crear o editar los archivos asignados explícitamente en su documento de contexto dentro de `.ia/agentes/`.
3. **Cero Valores Predeterminados Falsos ("Hardcoding"):** Todo indicador, tabla, curva gráfica y recomendación final DEBE nacer del cálculo matemático verificable definido en `.ia/CONTRATO_MATEMATICO_Y_API.md`.
4. **Paridad Matemática Exacta (Docker Backend ↔ GitHub Pages Frontend):** El motor en Python (`simulator/backend/app/engine/`) y el motor espejo en TypeScript (`simulator/frontend/src/engine/localFallbackEngine.ts`) deben implementar **idénticas ecuaciones y constantes de calibración**, garantizando que los resultados en contenedores Docker locales coincidan exactamente con los que ven los estudiantes en sus celulares al escanear el Código QR hacia GitHub Pages (`https://teach1030.github.io/EnRuta/`).
5. **Registro Obligatorio en Bitácora:** Al completar cada hito o entrega de subagente, se registra el avance verificable en `.ia/BITACORA_PROGRESO.md`.

## 3. Mapa de los 5 Agentes Primordiales
| ID | Agente | Archivo de Contexto | Fase Principal |
| :-: | :--- | :--- | :--- |
| `A1` | `math-modeler` (Modelador Matemático y Científico) | `.ia/agentes/01_math_modeler.md` | Fase 1 |
| `A2` | `arch-docker-specialist` (Arquitecto Cloud y Especialista Docker) | `.ia/agentes/02_arch_docker_specialist.md` | Fase 1 y Fase 3 |
| `A3` | `backend-fastapi-dev` (Desarrollador Backend API y Validación) | `.ia/agentes/03_backend_fastapi_dev.md` | Fase 2 |
| `A4` | `frontend-react-dev` (Desarrollador Frontend UI/UX Mobile-First) | `.ia/agentes/04_frontend_react_dev.md` | Fase 2 |
| `A5` | `qa-docs-engineer` (Ingeniero QA de Dominio EnRuta y Documentación) | `.ia/agentes/05_qa_docs_engineer.md` | Fase 3 |
