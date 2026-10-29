import React, { useId } from 'react';
import {
  AlertOctagon,
  Award,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Scale,
  ShieldAlert,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { SimulationResult } from '../types/simulator';
import { ARCH_COLORS } from '../utils/archTheme';

interface DecisionAdvisorProps {
  result: SimulationResult;
}

export const DecisionAdvisor: React.FC<DecisionAdvisorProps> = ({ result }) => {
  const headingId = useId();
  const { recommendation, ranking, project_config } = result;
  const winner = ranking[0];

  return (
    <section className="panel-card" aria-labelledby={headingId}>
      <div className="panel-header">
        <div>
          <div className="panel-title-wrap">
            <span className="panel-step-badge">Req. 8, 9 y 12</span>
            <h2 id={headingId} className="panel-title">
              Dictamen Arquitectónico Explicable y Validación Empírica Futura
            </h2>
          </div>
          <p className="panel-subtitle">
            Recomendación multicriterio trazable (SAW + Penalizaciones de Restricción Dura + Frontera de Pareto).
          </p>
        </div>
      </div>

      {/* Aviso Metodológico Obligatorio (Requisito 8 y 12) */}
      <div className="disclaimer-alert" role="note" style={{ marginBottom: '1.15rem' }}>
        <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <AlertOctagon size={17} aria-hidden="true" />
          Resultados correspondientes a estimaciones matemáticas del modelo y no a mediciones reales de rendimiento
        </div>
        <div>{recommendation.model_disclaimer}</div>
      </div>

      {/* Tarjeta Ganadora Principal */}
      <div className="winner-banner" style={{ marginBottom: '1.15rem' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: ARCH_COLORS[winner.id],
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <Award size={24} aria-hidden="true" />
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#065f46', textTransform: 'uppercase' }}>
                Arquitectura Recomendada para EnRuta
              </div>
              <h3 style={{ margin: 0, fontSize: 'clamp(1.05rem, 0.95rem + 0.5vw, 1.3rem)', fontWeight: 800 }}>
                {recommendation.winner_name}
              </h3>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div
              style={{
                padding: '0.45rem 0.85rem',
                borderRadius: 10,
                background: '#065f46',
                color: '#ffffff',
                fontWeight: 800,
                fontSize: '1.05rem',
              }}
            >
              {recommendation.winner_score.toFixed(2)} / 100
            </div>
            {recommendation.all_constraints_met ? (
              <span className="badge-pill badge-pill--ok">
                <CheckCircle2 size={14} aria-hidden="true" /> 100% Restricciones OK
              </span>
            ) : (
              <span className="badge-pill badge-pill--fail">
                <ShieldAlert size={14} aria-hidden="true" /> Mejor Compromiso Bajo Estrés
              </span>
            )}
          </div>
        </div>

        <p style={{ margin: 0, fontSize: '0.88rem', color: '#0f172a', lineHeight: 1.55 }}>
          {recommendation.summary_rationale}
        </p>

        {/* Estado de las 4 restricciones duras en la ganadora */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '0.5rem',
          }}
        >
          {[
            {
              ok: winner.meets_budget,
              label: `Presupuesto ($${winner.monthly_cost_usd.toFixed(2)} ≤ $${project_config.max_budget_usd})`,
            },
            {
              ok: winner.meets_latency,
              label: `Latencia (${winner.latency_ms.toFixed(1)} ≤ ${project_config.max_latency_ms} ms)`,
            },
            {
              ok: winner.meets_availability,
              label: `SLA Disp. (${winner.availability_pct.toFixed(3)}% ≥ ${project_config.min_availability_pct}%)`,
            },
            {
              ok: winner.meets_capacity,
              label: `Utilización (${winner.utilization_pct.toFixed(1)}% ≤ 105%)`,
            },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '0.4rem 0.65rem',
                borderRadius: 8,
                background: '#ffffff',
                border: `1px solid ${item.ok ? '#a7f3d0' : '#fecaca'}`,
                fontSize: '0.76rem',
                fontWeight: 700,
                color: item.ok ? '#065f46' : '#991b1b',
              }}
            >
              {item.ok ? (
                <CheckCircle2 size={14} aria-hidden="true" />
              ) : (
                <XCircle size={14} aria-hidden="true" />
              )}
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ranking 0-100 de las 4 Alternativas */}
      <div style={{ marginBottom: '1.2rem' }}>
        <h3 style={{ margin: '0 0 0.6rem', fontSize: '0.92rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Scale size={16} color="#065f46" aria-hidden="true" />
          Ranking Multicriterio Ponderado (0 – 100 puntos)
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {ranking.map((m) => (
            <div
              key={m.id}
              style={{
                padding: '0.6rem 0.8rem',
                borderRadius: 10,
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  gap: 6,
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                <span>
                  #{m.rank} {m.name}
                </span>
                <span>
                  <strong>{m.final_score.toFixed(2)}/100</strong>{' '}
                  <span style={{ color: '#64748b', fontWeight: 500 }}>
                    (Bruto: {m.raw_score.toFixed(1)} − Penalización: {m.total_penalty.toFixed(1)})
                  </span>
                </span>
              </div>
              <div
                style={{
                  height: 9,
                  borderRadius: 999,
                  background: '#e2e8f0',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${Math.max(2, m.final_score)}%`,
                    height: '100%',
                    background: ARCH_COLORS[m.id],
                    borderRadius: 999,
                    transition: 'width 0.25s ease',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Justificación Cuantitativa Dinámica */}
      <div style={{ marginBottom: '1.2rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.92rem', fontWeight: 800 }}>
          Argumentación Cuantitativa Basada en Indicadores Calculados
        </h3>
        <ul style={{ margin: 0, paddingLeft: '1.2rem', display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.83rem', color: '#334155' }}>
          {recommendation.detailed_reasons.map((reason, idx) => (
            <li key={idx}>{reason}</li>
          ))}
        </ul>
      </div>

      {/* Por qué se descartaron las demás opciones */}
      <div style={{ marginBottom: '1.2rem' }}>
        <h3 style={{ margin: '0 0 0.55rem', fontSize: '0.92rem', fontWeight: 800 }}>
          ¿Por qué se descartaron las otras 3 alternativas en este escenario?
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.6rem' }}>
          {recommendation.rejected_alternatives.map((alt) => (
            <div
              key={alt.id}
              style={{
                padding: '0.7rem 0.85rem',
                borderRadius: 10,
                background: '#fff',
                border: '1px solid #cbd5e1',
                borderLeft: `4px solid ${ARCH_COLORS[alt.id]}`,
                fontSize: '0.81rem',
              }}
            >
              <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
                #{alt.rank} {alt.name} — {alt.final_score.toFixed(2)}/100 pts
              </div>
              <div style={{ color: '#334155' }}>{alt.reason}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Ventajas, Limitaciones y Supuestos */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '0.9rem',
          marginBottom: '1.2rem',
        }}
      >
        <div style={{ padding: '0.85rem', borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
          <h4 style={{ margin: '0 0 0.45rem', fontSize: '0.85rem', color: '#14532d', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ThumbsUp size={15} aria-hidden="true" /> Ventajas Clave ({winner.short_name})
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#166534', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recommendation.advantages.map((adv, idx) => (
              <li key={idx}>{adv}</li>
            ))}
          </ul>
        </div>

        <div style={{ padding: '0.85rem', borderRadius: 12, background: '#fef2f2', border: '1px solid #fecaca' }}>
          <h4 style={{ margin: '0 0 0.45rem', fontSize: '0.85rem', color: '#7f1d1d', display: 'flex', alignItems: 'center', gap: 5 }}>
            <ShieldAlert size={15} aria-hidden="true" /> Limitaciones y Riesgos Técnicos
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#991b1b', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recommendation.limitations.map((lim, idx) => (
              <li key={idx}>{lim}</li>
            ))}
          </ul>
        </div>

        <div style={{ padding: '0.85rem', borderRadius: 12, background: '#f8fafc', border: '1px solid #cbd5e1' }}>
          <h4 style={{ margin: '0 0 0.45rem', fontSize: '0.85rem', color: '#0f172a' }}>
            Supuestos de Calibración del Modelo
          </h4>
          <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.78rem', color: '#334155', display: 'flex', flexDirection: 'column', gap: 5 }}>
            {recommendation.assumptions.map((assump, idx) => (
              <li key={idx}>{assump}</li>
            ))}
          </ul>
        </div>
      </div>

      {/* Panel Desplegable Requisito 12: Protocolo de Validación Real */}
      <details
        open
        style={{
          borderRadius: 12,
          border: '1.5px solid #065f46',
          background: '#f8fafc',
          padding: '0.85rem 1rem',
        }}
      >
        <summary
          style={{
            cursor: 'pointer',
            fontWeight: 800,
            fontSize: '0.88rem',
            color: '#065f46',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            listStyle: 'none',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <FlaskConical size={17} aria-hidden="true" />
            Requisito 12 — ¿Qué información e instrumentación adicional se requiere para validar estas conclusiones en producción real de EnRuta?
          </span>
          <ChevronDown size={17} aria-hidden="true" />
        </summary>
        <div style={{ marginTop: '0.75rem', fontSize: '0.82rem', color: '#334155' }}>
          <p style={{ margin: '0 0 0.6rem' }}>
            Siguiendo la metodología experimental de <em>Sunardi &amp; Suharjito (2019)</em>,{' '}
            <em>Tapia et al. (2020)</em> y <em>Blinowski et al. (2022)</em>, para transitar de este
            simulador matemático a evidencia empírica en producción para <strong>EnRuta</strong> se
            requiere ejecutar el siguiente protocolo:
          </p>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {recommendation.real_world_validation_steps.map((step, idx) => (
              <li key={idx}>{step}</li>
            ))}
          </ol>
        </div>
      </details>
    </section>
  );
};
