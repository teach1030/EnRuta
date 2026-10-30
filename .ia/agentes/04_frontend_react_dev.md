# Contexto Operativo — Agente 4: `frontend-react-dev`

## Rol
**Desarrollador Frontend UI/UX Mobile-First y Visualización Científica** del Simulador Arquitectónico de **EnRuta**.

## Referencia Obligatoria
- `.ia/README_ORQUESTADOR.md`
- `.ia/CONTRATO_MATEMATICO_Y_API.md` *(implementar las ecuaciones idénticas al 100% en `src/engine/localFallbackEngine.ts`)*

## Frontera Exclusiva de Archivos Asignados
Todo el árbol de `simulator/frontend/` excepto `Dockerfile` y `nginx.conf` (que pertenecen a `arch-docker-specialist`):
- `simulator/frontend/package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- `simulator/frontend/src/**`

## Identidad Visual y Requerimientos Funcionales
1. **Paleta Eco-Modern de `EnRuta`:** `#065F46` (Verde Bosque Primario), `#10B981` (Esmeralda Acento), `#F1F5F9` (Fondo Suave), alto contraste legible en teléfonos celulares bajo luz solar (consistente con el Documento de Requerimientos de `EnRuta`).
2. **Cobertura de los Requisitos 1 a 12 de la Guía en la Interfaz:**
   - **Paso 1 (`ProjectConfigPanel.tsx`):** Formulario editable del perfil de `EnRuta` (nombre, dominio, usuarios previstos, presupuesto máximo USD/mes, latencia máxima ms, disponibilidad mínima %, tamaño del equipo, cifrado obligatorio y pesos de decisión).
   - **Paso 2 (`SimulationControls.tsx`):** Selector del **Escenario de Referencia** + **4 escenarios de prueba de `EnRuta`** + *sliders*/inputs numéricos con justificación explícita de cada variable (`U` conductores, `G` guías OCR, `N_p` paradas TSP `OR-Tools`, `I` instancias, `F_crud` operaciones/min).
   - **Paso 3 (`MetricsComparison.tsx`):** Tarjetas KPI + Tabla comparativa + **4 Gráficas Interactivas SVG/Canvas sin dependencias rotas** (1. Latencia Estimada por Arquitectura, 2. Curva de Escalabilidad vs Conductores Activos `10..2500`, 3. Frontera de Eficiencia de Pareto Costo Mensual vs Latencia + Curva de Sobre-Escalado por Instancias `1..20` de *Blinowski 2022*, 4. Radar/Barras Multicriterio de Throughput, Escalabilidad, Disponibilidad, Contenedores y Seguridad).
   - **Paso 4 (`DecisionAdvisor.tsx`):** Tarjeta destacada de **Recomendación Explicable** con puntaje `0-100`, estado de cumplimiento de restricciones obligatorias, razones cuantitativas dinámicas, por qué se descartaron las otras alternativas, ventajas, limitaciones, supuestos, aviso explícito de **"Estimaciones del modelo matemático (no mediciones reales)"** y guía de **qué información adicional se requiere para validar en producción real** (JMeter, NewRelic/Prometheus, contenedores cloud).
   - **Paso 5 (`ArchitectureCards.tsx` + `ValidationSuiteView.tsx`):** Fichas técnicas de las 4 alternativas de `EnRuta` con visor del `docker-compose.yml` de muestra, desglose transparente de ecuaciones (`formula_breakdown`) y ejecutor visual en un clic de las **6 pruebas funcionales de `EnRuta` (`CP-01` a `CP-06`)**.
   - **Modal Proyectable para el Salón (`ClassroomQRModal.tsx`):** Botón en el header **"Mostrar QR para el Salón"** que codifica en tiempo real el enlace hacia `https://teach1030.github.io/EnRuta/` (con opción de incluir los parámetros actuales en *query string* `?u=...&g=...&np=...&i=...&b=...` y leerlos al cargar la página!) dibujando un **Código QR vectorial nítido** listo para escanear desde el proyector de clase.

## Estándares Web Modernos Obligatorios (`modern-web-guidance`)
1. **`light-dismiss-a-dialog`:** Usar elemento nativo `<dialog {...({ closedby: 'any' } as any)} aria-labelledby="...">` abierto con `dialogRef.current?.showModal()`, estilizar `dialog::backdrop`, e incluir el fallback obligatorio en `useEffect` para navegadores sin soporte nativo de `closedBy` (`if (!('closedBy' in HTMLDialogElement.prototype))` verificando coordenadas con `getBoundingClientRect()`).
2. **`responsive-table`:** Envolver la tabla comparativa en `<div tabIndex={0} role="region" aria-labelledby="..." className="table-wrapper">` con `container-type: inline-size;`, encabezados `position: sticky`, y regla `@container (width < 640px)` que oculta `thead` (`display: none`) y transforma las filas en tarjetas móviles inyectando etiquetas mediante variables CSS `--label-N` en `td:nth-child(N)::before`.
3. **`responsive-design`:** Usar unidades dinámicas `dvh` en lugar de `vh`, `aspect-ratio: 1 / 1` en el contenedor del Código QR para evitar CLS, y `clamp()` combinando `rem` + `vw` en títulos escalables (nunca `vw` solo).
4. **`validate-input-after-interaction`:** Colocar las pistas de rango válido **encima** de cada `<input>` numérico para que el teclado móvil no las tape, usar atributos nativos `min`, `max`, `step`, `required` y aplicar estilos CSS `:user-invalid` y `:user-valid` junto con validación explícita al ejecutar.
