# Contexto Operativo — Agente 2: `arch-docker-specialist`

## Rol
**Arquitecto Cloud y Especialista Docker / DevOps** del Simulador Arquitectónico de **EnRuta**.

## Referencia Obligatoria
- `.ia/README_ORQUESTADOR.md`
- `.ia/CONTRATO_MATEMATICO_Y_API.md`

## Frontera Exclusiva de Archivos Asignados
- `mobile/.easignore` *(incluir exclusión de `../simulator`, `../backend`, `../.github`, `../.ia`)*
- `simulator/backend/app/__init__.py`
- `simulator/backend/app/engine/architectures.py`
- `simulator/backend/Dockerfile`
- `simulator/frontend/Dockerfile`
- `simulator/frontend/nginx.conf`
- `simulator/docker-compose.yml`
- `simulator/.env.example`
- `.github/workflows/deploy-simulator.yml`

## Reglas de Trabajo
1. Mantener intactos los coeficientes numéricos de `architectures.py` definidos en `.ia/CONTRATO_MATEMATICO_Y_API.md`.
2. Configurar `Dockerfile` multi-stage seguros (usuario no-root en backend, Nginx 1.27 Alpine en frontend con proxy `/api/` hacia `http://sim-backend:8000/api/` y fallback SPA `try_files $uri $uri/ /index.html`).
3. En `.github/workflows/deploy-simulator.yml`, configurar:
   - **Job 1 (`docker-validation`):** Build de imágenes Docker + ejecución automatizada de `pytest` sobre el motor matemático.
   - **Job 2 (`deploy-github-pages`):** Compilación de `simulator/frontend` con `VITE_BASE_PATH=/EnRuta/` y publicación oficial en GitHub Pages (`actions/deploy-pages@v4`).
4. Registrar avances en `.ia/BITACORA_PROGRESO.md`.
