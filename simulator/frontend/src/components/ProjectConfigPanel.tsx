import React, { useId } from 'react';
import { RotateCcw, ShieldCheck, Sliders } from 'lucide-react';
import {
  CRITERIA_KEYS,
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_WEIGHTS,
  normalizeWeights,
} from '../engine/localFallbackEngine';
import { CriterionKey, ProjectConfig } from '../types/simulator';

interface ProjectConfigPanelProps {
  projectConfig: ProjectConfig;
  onChange: (next: ProjectConfig) => void;
}

const CRITERION_LABELS: Record<CriterionKey, { label: string; hint: string }> = {
  latency: { label: 'Latencia (ms)', hint: 'Menor tiempo de respuesta extremo a extremo' },
  throughput: { label: 'Throughput (req/s)', hint: 'Capacidad de peticiones efectivas/s' },
  scalability: { label: 'Escalabilidad', hint: 'Elasticidad horizontal y aislamiento' },
  availability: { label: 'Disponibilidad SLA', hint: 'Tolerancia a fallos y redundancia' },
  cost: { label: 'Costo Mensual (USD)', hint: 'Menor gasto cloud y de APIs OCR' },
  security: { label: 'Seguridad y Equipo', hint: 'Aislamiento Zero-Trust + operabilidad DevOps' },
};

export const ProjectConfigPanel: React.FC<ProjectConfigPanelProps> = ({
  projectConfig,
  onChange,
}) => {
  const baseId = useId();
  const normalized = normalizeWeights(projectConfig.weights);

  const handleNumberField = (field: keyof ProjectConfig, raw: string) => {
    const sanitized = raw.trim().replace(',', '.');
    const parsed = sanitized === '' ? Number.NaN : Number(sanitized);
    onChange({
      ...projectConfig,
      [field]: parsed,
    });
  };

  const handleWeightChange = (key: CriterionKey, raw: string) => {
    const sanitized = raw.trim().replace(',', '.');
    const parsed = sanitized === '' ? 0 : Number(sanitized);
    onChange({
      ...projectConfig,
      weights: {
        ...projectConfig.weights,
        [key]: parsed,
      },
    });
  };

  const handleResetDefaults = () => {
    onChange({
      ...DEFAULT_PROJECT_CONFIG,
      weights: { ...DEFAULT_WEIGHTS },
    });
  };

  return (
    <section className="panel-card" aria-labelledby={`${baseId}-heading`}>
      <div className="panel-header">
        <div>
          <div className="panel-title-wrap">
            <span className="panel-step-badge">Req. 1</span>
            <h2 id={`${baseId}-heading`} className="panel-title">
              Perfil y Restricciones del Proyecto EnRuta
            </h2>
          </div>
          <p className="panel-subtitle">
            Define las características no funcionales, SLA, presupuesto y pesos de evaluación MCDA.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-soft"
          onClick={handleResetDefaults}
          title="Restaurar valores semilla del MVP EnRuta"
        >
          <RotateCcw size={15} aria-hidden="true" />
          Restaurar MVP
        </button>
      </div>

      <form className="form-grid" onSubmit={(e) => e.preventDefault()} noValidate>
        <div className="field">
          <label htmlFor={`${baseId}-name`} className="field-label">
            Nombre del Sistema
          </label>
          <span id={`${baseId}-name-hint`} className="field-hint">
            Identificador descriptivo del proyecto evaluado (requerido).
          </span>
          <input
            id={`${baseId}-name`}
            type="text"
            className="field-input"
            required
            minLength={3}
            value={projectConfig.project_name}
            onChange={(e) => onChange({ ...projectConfig, project_name: e.target.value })}
            aria-describedby={`${baseId}-name-hint`}
            aria-errormessage={`${baseId}-name-err`}
          />
          <div id={`${baseId}-name-err`} className="error-msg">
            <span aria-hidden="true">❌</span> Ingresa un nombre de proyecto válido (mín. 3 caracteres).
          </div>
        </div>

        <div className="field">
          <label htmlFor={`${baseId}-domain`} className="field-label">
            Dominio Tecnológico y Operativo
          </label>
          <span id={`${baseId}-domain-hint`} className="field-hint">
            Módulos críticos: CRUD paradas, OCR de guías y ruteo combinatorio TSP.
          </span>
          <input
            id={`${baseId}-domain`}
            type="text"
            className="field-input"
            required
            value={projectConfig.project_domain}
            onChange={(e) => onChange({ ...projectConfig, project_domain: e.target.value })}
            aria-describedby={`${baseId}-domain-hint`}
          />
        </div>

        <div className="form-grid form-grid--2col">
          <div className="field">
            <label htmlFor={`${baseId}-budget`} className="field-label">
              Presupuesto Máximo ($ USD/mes)
            </label>
            <span id={`${baseId}-budget-hint`} className="field-hint">
              Rango válido: 0 a 10,000 USD/mes
            </span>
            <input
              id={`${baseId}-budget`}
              type="number"
              className="field-input"
              min={0}
              max={10000}
              step={1}
              required
              value={Number.isNaN(projectConfig.max_budget_usd) ? '' : projectConfig.max_budget_usd}
              onChange={(e) => handleNumberField('max_budget_usd', e.target.value)}
              aria-describedby={`${baseId}-budget-hint`}
              aria-errormessage={`${baseId}-budget-err`}
            />
            <div id={`${baseId}-budget-err`} className="error-msg">
              <span aria-hidden="true">❌</span> Debe estar entre $0 y $10,000 USD/mes.
            </div>
          </div>

          <div className="field">
            <label htmlFor={`${baseId}-lat`} className="field-label">
              Latencia Máxima SLA (ms)
            </label>
            <span id={`${baseId}-lat-hint`} className="field-hint">
              Rango válido: 50 a 30,000 ms
            </span>
            <input
              id={`${baseId}-lat`}
              type="number"
              className="field-input"
              min={50}
              max={30000}
              step={10}
              required
              value={Number.isNaN(projectConfig.max_latency_ms) ? '' : projectConfig.max_latency_ms}
              onChange={(e) => handleNumberField('max_latency_ms', e.target.value)}
              aria-describedby={`${baseId}-lat-hint`}
              aria-errormessage={`${baseId}-lat-err`}
            />
            <div id={`${baseId}-lat-err`} className="error-msg">
              <span aria-hidden="true">❌</span> Ingresa un límite entre 50 y 30,000 ms.
            </div>
          </div>

          <div className="field">
            <label htmlFor={`${baseId}-avail`} className="field-label">
              Disponibilidad Mínima (%)
            </label>
            <span id={`${baseId}-avail-hint`} className="field-hint">
              Rango válido: 90.0% a 99.99%
            </span>
            <input
              id={`${baseId}-avail`}
              type="number"
              className="field-input"
              min={90}
              max={99.99}
              step={0.05}
              required
              value={
                Number.isNaN(projectConfig.min_availability_pct)
                  ? ''
                  : projectConfig.min_availability_pct
              }
              onChange={(e) => handleNumberField('min_availability_pct', e.target.value)}
              aria-describedby={`${baseId}-avail-hint`}
              aria-errormessage={`${baseId}-avail-err`}
            />
            <div id={`${baseId}-avail-err`} className="error-msg">
              <span aria-hidden="true">❌</span> SLA válido entre 90.0% y 99.99%.
            </div>
          </div>

          <div className="field">
            <label htmlFor={`${baseId}-team`} className="field-label">
              Tamaño del Equipo (Devs)
            </label>
            <span id={`${baseId}-team-hint`} className="field-hint">
              Rango válido: 1 a 50 ingenieros
            </span>
            <input
              id={`${baseId}-team`}
              type="number"
              className="field-input"
              min={1}
              max={50}
              step={1}
              required
              value={Number.isNaN(projectConfig.team_size) ? '' : projectConfig.team_size}
              onChange={(e) => handleNumberField('team_size', e.target.value)}
              aria-describedby={`${baseId}-team-hint`}
              aria-errormessage={`${baseId}-team-err`}
            />
            <div id={`${baseId}-team-err`} className="error-msg">
              <span aria-hidden="true">❌</span> El equipo debe tener entre 1 y 50 personas.
            </div>
          </div>
        </div>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.65rem 0.8rem',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            cursor: 'pointer',
            fontSize: '0.83rem',
            fontWeight: 700,
            color: '#064e3b',
          }}
        >
          <input
            type="checkbox"
            checked={projectConfig.require_encryption}
            onChange={(e) =>
              onChange({ ...projectConfig, require_encryption: e.target.checked })
            }
            style={{ width: 17, height: 17, accentColor: '#065f46' }}
          />
          <ShieldCheck size={17} aria-hidden="true" />
          <span>
            Exigir cifrado TLS 1.3 en tránsito, hash bcrypt y aislamiento de secretos JWT/API Keys
          </span>
        </label>

        {/* Pesos Multicriterio con Normalización Automática */}
        <div
          style={{
            padding: '0.85rem',
            borderRadius: '12px',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.5rem',
              marginBottom: '0.65rem',
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.84rem',
                fontWeight: 800,
                color: '#0f172a',
              }}
            >
              <Sliders size={15} color="#065f46" aria-hidden="true" />
              Pesos de Decisión SAW (Normalización Automática al 100%)
            </span>
          </div>

          <div className="form-grid form-grid--2col">
            {CRITERIA_KEYS.map((key) => {
              const info = CRITERION_LABELS[key];
              const pct = (normalized[key] * 100).toFixed(1);
              return (
                <div key={key} className="field">
                  <label htmlFor={`${baseId}-w-${key}`} className="field-label">
                    <span>{info.label}</span>
                    <span className="scenario-tag">{pct}%</span>
                  </label>
                  <span id={`${baseId}-w-${key}-hint`} className="field-hint">
                    {info.hint} (0.00 a 1.00)
                  </span>
                  <input
                    id={`${baseId}-w-${key}`}
                    type="number"
                    className="field-input"
                    min={0}
                    max={1}
                    step={0.05}
                    required
                    value={projectConfig.weights[key]}
                    onChange={(e) => handleWeightChange(key, e.target.value)}
                    aria-describedby={`${baseId}-w-${key}-hint`}
                    aria-errormessage={`${baseId}-w-${key}-err`}
                  />
                  <div id={`${baseId}-w-${key}-err`} className="error-msg">
                    <span aria-hidden="true">❌</span> Peso entre 0.00 y 1.00.
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </form>
    </section>
  );
};
