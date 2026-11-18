import React, { useId } from 'react';
import { AlertTriangle, BookmarkCheck, Compass, MapPin, Play, Sparkles } from 'lucide-react';
import {
  ProjectConfig,
  ScenarioPreset,
  SimulationInput,
  ValidationErrorDetail,
} from '../types/simulator';

interface SimulationControlsProps {
  simInput: SimulationInput;
  scenarios: ScenarioPreset[];
  activeScenarioId: string | null;
  baselineLabel: string;
  validationErrors: ValidationErrorDetail[];
  onSimInputChange: (next: SimulationInput) => void;
  onSelectScenario: (preset: ScenarioPreset) => void;
  onPinCurrentAsBaseline: () => void;
  onResetBaselineToOfficial: () => void;
  projectConfig: ProjectConfig;
}

export const SimulationControls: React.FC<SimulationControlsProps> = ({
  simInput,
  scenarios,
  activeScenarioId,
  baselineLabel,
  validationErrors,
  onSimInputChange,
  onSelectScenario,
  onPinCurrentAsBaseline,
  onResetBaselineToOfficial,
}) => {
  const baseId = useId();
  const activeScenario = scenarios.find((s) => s.id === activeScenarioId) ?? null;

  const updateField = (
    field: keyof SimulationInput,
    raw: string,
    isInteger = true
  ) => {
    const sanitized = raw.trim().replace(',', '.');
    if (sanitized === '') {
      onSimInputChange({ ...simInput, [field]: Number.NaN });
      return;
    }
    const num = Number(sanitized);
    onSimInputChange({
      ...simInput,
      [field]: Number.isFinite(num) && isInteger ? Math.trunc(num) : num,
    });
  };

  return (
    <section className="panel-card" aria-labelledby={`${baseId}-heading`}>
      <div className="panel-header">
        <div>
          <div className="panel-title-wrap">
            <span className="panel-step-badge">Req. 3 y 5</span>
            <h2 id={`${baseId}-heading`} className="panel-title">
              Escenarios Logísticos y Variables de Carga
            </h2>
          </div>
          <p className="panel-subtitle">
            Ejecuta escenarios reales de Bogotá D.C. o ajusta parámetros dinámicos frente a la línea base.
          </p>
        </div>
      </div>

      {/* Control de Escenario de Referencia (Baseline) para comparación con deltas Δ */}
      <div
        style={{
          padding: '0.8rem',
          borderRadius: '12px',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          marginBottom: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.55rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.45rem',
            fontSize: '0.8rem',
            fontWeight: 800,
            color: '#064e3b',
          }}
        >
          <BookmarkCheck size={16} aria-hidden="true" />
          <span>Escenario Base Fijado (Baseline Δ): {baselineLabel}</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onPinCurrentAsBaseline}
            disabled={validationErrors.length > 0}
            style={{ fontSize: '0.78rem', padding: '0.42rem 0.75rem' }}
          >
            📌 Fijar corrida actual como Referencia
          </button>
          <button
            type="button"
            className="btn btn-outline"
            onClick={onResetBaselineToOfficial}
            style={{ fontSize: '0.78rem', padding: '0.42rem 0.75rem' }}
          >
            Restaurar Base MVP Bogotá
          </button>
        </div>
      </div>

      {/* Botones rápidos de escenarios preconfigurados de EnRuta */}
      <div style={{ marginBottom: '0.45rem', fontSize: '0.82rem', fontWeight: 800 }}>
        Escenarios Operativos Preconfigurados de EnRuta:
      </div>
      <div className="scenario-grid" role="group" aria-label="Escenarios preconfigurados de EnRuta">
        {scenarios.map((preset) => {
          const isSelected = activeScenarioId === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSelectScenario(preset)}
              className={`scenario-btn ${isSelected ? 'scenario-btn--active' : ''}`}
            >
              <div className="scenario-btn-top">
                <span className="scenario-btn-name">
                  <Play
                    size={12}
                    aria-hidden="true"
                    style={{ display: 'inline', marginRight: 5, verticalAlign: 'middle' }}
                  />
                  {preset.short_name}
                </span>
                <span className="scenario-tag">
                  {preset.is_reference ? 'Referencia Base' : `U=${preset.sim_input.concurrent_drivers} · I=${preset.sim_input.compute_instances}`}
                </span>
              </div>
              <span className="scenario-btn-desc">{preset.description}</span>
            </button>
          );
        })}
      </div>

      {/* Contexto Bogotano del escenario activo */}
      {activeScenario && (
        <div
          style={{
            padding: '0.75rem 0.85rem',
            borderRadius: '10px',
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            marginBottom: '1rem',
            fontSize: '0.78rem',
            color: '#334155',
          }}
        >
          <div style={{ fontWeight: 800, color: '#065f46', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: 5 }}>
            <MapPin size={14} aria-hidden="true" />
            Contexto Operativo Bogotá / Colombia ({activeScenario.short_name}):
          </div>
          <p style={{ margin: '0 0 0.35rem' }}>{activeScenario.bogota_context}</p>
          <div style={{ fontSize: '0.73rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 5 }}>
            <Sparkles size={13} color="#059669" aria-hidden="true" />
            <strong>Foco científico:</strong> {activeScenario.paper_focus}
          </div>
        </div>
      )}

      {/* Alerta de bloqueo si hay entradas fuera de rango */}
      {validationErrors.length > 0 && (
        <div
          role="alert"
          style={{
            background: '#fef2f2',
            border: '1.5px solid #dc2626',
            borderRadius: '10px',
            padding: '0.75rem 0.9rem',
            marginBottom: '1rem',
            color: '#991b1b',
            fontSize: '0.8rem',
          }}
        >
          <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <AlertTriangle size={16} aria-hidden="true" />
            Ejecución pausada: corrige las variables fuera de rango válido
          </div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem' }}>
            {validationErrors.map((err, idx) => (
              <li key={`${err.field}-${idx}`}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Las 5 Variables Dinámicas de Entrada con Justificación Técnica Explícita */}
      <form className="form-grid" onSubmit={(e) => e.preventDefault()} noValidate>
        {/* 1. Conductores Concurrentes U */}
        <div className="field">
          <label htmlFor={`${baseId}-u`} className="field-label">
            <span>1. Conductores Concurrentes Activos (U)</span>
            <span className="scenario-tag">{Number.isFinite(simInput.concurrent_drivers) ? simInput.concurrent_drivers : '—'} cond.</span>
          </label>
          <span id={`${baseId}-u-hint`} className="field-hint">
            Rango válido: 1 a 5,000 conductores simultáneos
          </span>
          <input
            id={`${baseId}-u`}
            type="number"
            className="field-input"
            min={1}
            max={5000}
            step={1}
            required
            value={Number.isNaN(simInput.concurrent_drivers) ? '' : simInput.concurrent_drivers}
            onChange={(e) => updateField('concurrent_drivers', e.target.value, true)}
            aria-describedby={`${baseId}-u-hint`}
            aria-errormessage={`${baseId}-u-err`}
          />
          <div id={`${baseId}-u-err`} className="error-msg">
            <span aria-hidden="true">❌</span> Debe estar entre 1 y 5,000 conductores.
          </div>
          <div className="slider-row">
            <input
              type="range"
              className="range-slider"
              min={1}
              max={2500}
              step={5}
              aria-label="Deslizador de conductores concurrentes"
              value={Math.min(2500, Math.max(1, simInput.concurrent_drivers || 1))}
              onChange={(e) => updateField('concurrent_drivers', e.target.value, true)}
            />
          </div>
          <div className="var-justification">
            <strong>Impacto en EnRuta:</strong> Escala linealmente la tasa de llegadas agregada λ sobre sesiones JWT/OAuth2 (<code>drivers.py</code>) y presiona el pool asíncrono <code>asyncpg</code> de PostgreSQL.
          </div>
        </div>

        {/* 2. Guías OCR por Conductor G */}
        <div className="field">
          <label htmlFor={`${baseId}-g`} className="field-label">
            <span>2. Guías Físicas Escaneadas por Conductor (G)</span>
            <span className="scenario-tag">{Number.isFinite(simInput.ocr_guides_per_driver) ? simInput.ocr_guides_per_driver : '—'} guías</span>
          </label>
          <span id={`${baseId}-g-hint`} className="field-hint">
            Rango válido: 0 a 150 guías/jornada (ventana matutina W = 30 min)
          </span>
          <input
            id={`${baseId}-g`}
            type="number"
            className="field-input"
            min={0}
            max={150}
            step={1}
            required
            value={Number.isNaN(simInput.ocr_guides_per_driver) ? '' : simInput.ocr_guides_per_driver}
            onChange={(e) => updateField('ocr_guides_per_driver', e.target.value, true)}
            aria-describedby={`${baseId}-g-hint`}
            aria-errormessage={`${baseId}-g-err`}
          />
          <div id={`${baseId}-g-err`} className="error-msg">
            <span aria-hidden="true">❌</span> Ingresa entre 0 y 150 guías por conductor.
          </div>
          <div className="slider-row">
            <input
              type="range"
              className="range-slider"
              min={0}
              max={150}
              step={5}
              aria-label="Deslizador de guías OCR por conductor"
              value={Math.min(150, Math.max(0, simInput.ocr_guides_per_driver || 0))}
              onChange={(e) => updateField('ocr_guides_per_driver', e.target.value, true)}
            />
          </div>
          <div className="var-justification">
            <strong>Impacto en EnRuta:</strong> Dispara llamadas a <code>Gemini Vision</code> + normalización vial Bogotá (<code>Cll/Kra/Dg/Tv</code>) + <code>Mapbox Geocoding v6</code>, frente a <code>ML Kit</code> on-device que resuelve el 85% en el celular sin costo cloud.
          </div>
        </div>

        {/* 3. Paradas por Ruta N_p */}
        <div className="field">
          <label htmlFor={`${baseId}-np`} className="field-label">
            <span>3. Paradas por Ruta Optimizada TSP (N_p)</span>
            <span className="scenario-tag">{Number.isFinite(simInput.stops_per_route) ? simInput.stops_per_route : '—'} paradas</span>
          </label>
          <span id={`${baseId}-np-hint`} className="field-hint">
            Rango válido: 2 a 150 paradas por ruta urbana
          </span>
          <input
            id={`${baseId}-np`}
            type="number"
            className="field-input"
            min={2}
            max={150}
            step={1}
            required
            value={Number.isNaN(simInput.stops_per_route) ? '' : simInput.stops_per_route}
            onChange={(e) => updateField('stops_per_route', e.target.value, true)}
            aria-describedby={`${baseId}-np-hint`}
            aria-errormessage={`${baseId}-np-err`}
          />
          <div id={`${baseId}-np-err`} className="error-msg">
            <span aria-hidden="true">❌</span> El ruteo TSP requiere entre 2 y 150 paradas.
          </div>
          <div className="slider-row">
            <input
              type="range"
              className="range-slider"
              min={2}
              max={150}
              step={1}
              aria-label="Deslizador de paradas por ruta TSP"
              value={Math.min(150, Math.max(2, simInput.stops_per_route || 2))}
              onChange={(e) => updateField('stops_per_route', e.target.value, true)}
            />
          </div>
          <div className="var-justification">
            <strong>Impacto en EnRuta:</strong> Eleva superlinealmente <code>φ_tsp = (N_p / 30)^1.85</code> en la matriz Haversine N×N y el solver C++ <code>Google OR-Tools</code> (<code>GUIDED_LOCAL_SEARCH</code> en <code>routing.py</code>), bloqueando hilos síncronos en el Monolito.
          </div>
        </div>

        {/* 4. Instancias de Cómputo I */}
        <div className="field">
          <label htmlFor={`${baseId}-i`} className="field-label">
            <span>4. Instancias / Réplicas Horizontales (I)</span>
            <span className="scenario-tag">{Number.isFinite(simInput.compute_instances) ? simInput.compute_instances : '—'} inst.</span>
          </label>
          <span id={`${baseId}-i-hint`} className="field-hint">
            Rango válido: 1 a 20 instancias lógicas (penalización sobre-escalado para I &gt; 6)
          </span>
          <input
            id={`${baseId}-i`}
            type="number"
            className="field-input"
            min={1}
            max={20}
            step={1}
            required
            value={Number.isNaN(simInput.compute_instances) ? '' : simInput.compute_instances}
            onChange={(e) => updateField('compute_instances', e.target.value, true)}
            aria-describedby={`${baseId}-i-hint`}
            aria-errormessage={`${baseId}-i-err`}
          />
          <div id={`${baseId}-i-err`} className="error-msg">
            <span aria-hidden="true">❌</span> Debe estar entre 1 y 20 instancias.
          </div>
          <div className="slider-row">
            <input
              type="range"
              className="range-slider"
              min={1}
              max={20}
              step={1}
              aria-label="Deslizador de instancias de cómputo"
              value={Math.min(20, Math.max(1, simInput.compute_instances || 1))}
              onChange={(e) => updateField('compute_instances', e.target.value, true)}
            />
          </div>
          <div className="var-justification">
            <strong>Impacto en EnRuta:</strong> Escala capacidad (<code>I^η</code>) y redundancia SLA, pero multiplica contenedores Docker (<code>3×I</code> o <code>5×I</code>), costo mensual y penalización de coordinación para <code>I &gt; 6</code> (<em>Blinowski et al., 2022</em>).
          </div>
        </div>

        {/* 5. Operaciones CRUD / min */}
        <div className="field">
          <label htmlFor={`${baseId}-crud`} className="field-label">
            <span>5. Frecuencia Operaciones CRUD / Swipe por Minuto (F_crud)</span>
            <span className="scenario-tag">{Number.isFinite(simInput.crud_ops_per_min) ? simInput.crud_ops_per_min : '—'} ops/min</span>
          </label>
          <span id={`${baseId}-crud-hint`} className="field-hint">
            Rango válido: 0.5 a 60.0 operaciones/minuto por conductor
          </span>
          <input
            id={`${baseId}-crud`}
            type="number"
            className="field-input"
            min={0.5}
            max={60}
            step={0.5}
            required
            value={Number.isNaN(simInput.crud_ops_per_min) ? '' : simInput.crud_ops_per_min}
            onChange={(e) => updateField('crud_ops_per_min', e.target.value, false)}
            aria-describedby={`${baseId}-crud-hint`}
            aria-errormessage={`${baseId}-crud-err`}
          />
          <div id={`${baseId}-crud-err`} className="error-msg">
            <span aria-hidden="true">❌</span> Ingresa una frecuencia entre 0.5 y 60.0 ops/min.
          </div>
          <div className="slider-row">
            <input
              type="range"
              className="range-slider"
              min={0.5}
              max={40}
              step={0.5}
              aria-label="Deslizador de operaciones CRUD por minuto"
              value={Math.min(40, Math.max(0.5, simInput.crud_ops_per_min || 0.5))}
              onChange={(e) => updateField('crud_ops_per_min', e.target.value, false)}
            />
          </div>
          <div className="var-justification">
            <Compass size={12} aria-hidden="true" style={{ display: 'inline', marginRight: 4 }} />
            <strong>Impacto en EnRuta:</strong> Representa gestos <code>Swipeable</code> de confirmación (<code>PUT /api/v1/stops/&#123;id&#125;/estado</code>) y entregas multi-cliente (<code>Stop</code> 1:N <code>StopClient</code>), sensibles a saltos IPC de API Gateway.
          </div>
        </div>
      </form>
    </section>
  );
};
