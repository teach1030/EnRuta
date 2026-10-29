import React, { useId, useState } from 'react';
import { Award, BarChart3, CheckCircle2, Layers, TrendingUp, XCircle } from 'lucide-react';
import { ARCHITECTURE_ORDER } from '../engine/localFallbackEngine';
import { ArchitectureId, ArchitectureMetrics, SimulationResult } from '../types/simulator';
import { ARCH_COLORS } from '../utils/archTheme';

interface MetricsComparisonProps {
  result: SimulationResult;
  baselineResult: SimulationResult;
  baselineLabel: string;
}

function formatDelta(
  current: number,
  base: number,
  unit: string,
  lowerIsBetter: boolean,
  decimals = 1
): { text: string; tone: 'good' | 'bad' | 'neutral' } {
  const diff = current - base;
  if (Math.abs(diff) < 0.01) {
    return { text: `= Base`, tone: 'neutral' };
  }
  const sign = diff > 0 ? '+' : '';
  const isGood = lowerIsBetter ? diff < 0 : diff > 0;
  return {
    text: `Δ ${sign}${diff.toFixed(decimals)}${unit}`,
    tone: isGood ? 'good' : 'bad',
  };
}

export const MetricsComparison: React.FC<MetricsComparisonProps> = ({
  result,
  baselineResult,
  baselineLabel,
}) => {
  const captionId = useId();
  const sectionId = useId();

  const [hoveredArch, setHoveredArch] = useState<ArchitectureId | null>(null);
  const [selectedDriverIdx, setSelectedDriverIdx] = useState<number>(2); // U=100 por defecto en tooltip
  const [selectedInstanceIdx, setSelectedInstanceIdx] = useState<number>(3); // I=6 óptimo Blinowski

  const winner = result.ranking[0];
  const baseByArch = new Map<ArchitectureId, ArchitectureMetrics>(
    baselineResult.architectures.map((m) => [m.id, m])
  );

  const fastest = result.architectures.reduce((a, b) => (b.latency_ms < a.latency_ms ? b : a));
  const cheapest = result.architectures.reduce((a, b) =>
    b.monthly_cost_usd < a.monthly_cost_usd ? b : a
  );
  const highestCap = result.architectures.reduce((a, b) =>
    b.max_capacity_req_s > a.max_capacity_req_s ? b : a
  );

  const baseWinnerArch = baseByArch.get(winner.id);
  const baseFastestArch = baseByArch.get(fastest.id);
  const baseCheapestArch = baseByArch.get(cheapest.id);
  const baseHighestCapArch = baseByArch.get(highestCap.id);

  // --- Cálculos para Gráfica 1: Latencia vs Límite SLA ---
  const maxBarLatency = Math.max(
    result.project_config.max_latency_ms * 1.1,
    ...result.architectures.map((m) => m.latency_ms)
  );

  // --- Cálculos para Gráfica 2: Curva Escalabilidad vs Conductores (10..2500) ---
  const sweepPoints = result.driver_sweep;
  const maxSweepLat = Math.min(
    6000,
    Math.max(
      400,
      ...sweepPoints.flatMap((pt) =>
        ARCHITECTURE_ORDER.map((id) => Math.min(6000, pt.architectures[id].latency_ms))
      )
    )
  );
  const activeDriverPoint = sweepPoints[selectedDriverIdx] ?? sweepPoints[0];

  // --- Cálculos para Gráfica 3A: Frontera de Pareto Costo vs Latencia ---
  const maxParetoCost = Math.max(
    result.project_config.max_budget_usd * 1.15,
    ...result.architectures.map((m) => m.monthly_cost_usd),
    20
  );
  const maxParetoLat = Math.max(
    result.project_config.max_latency_ms * 1.15,
    ...result.architectures.map((m) => m.latency_ms),
    150
  );

  // Ordenar puntos Pareto eficientes en plano 2D Costo-Latencia para trazar poligonal orientativa
  const paretoSorted2D = [...result.architectures]
    .filter((m) => m.is_pareto_efficient)
    .sort((a, b) => a.monthly_cost_usd - b.monthly_cost_usd);

  // --- Cálculos para Gráfica 3B: Sobre-escalado por Instancias (I = 1..20, Blinowski 2022) ---
  const instSweep = result.instance_sweep;
  const maxInstLatency = Math.min(
    3000,
    Math.max(
      180,
      ...instSweep.flatMap((pt) =>
        ARCHITECTURE_ORDER.map((id) => Math.min(3000, pt.architectures[id].latency_ms))
      )
    )
  );
  const activeInstancePoint = instSweep[selectedInstanceIdx] ?? instSweep[0];

  // --- Cálculos para Gráfica 4: Radar Hexagonal Multicriterio ---
  const radarAxes: { key: string; label: string; getVal: (m: ArchitectureMetrics) => number }[] = [
    {
      key: 'lat',
      label: 'Velocidad',
      getVal: (m) => Math.max(8, 100 - Math.min(92, (m.latency_ms / maxBarLatency) * 90)),
    },
    {
      key: 'thr',
      label: 'Capacidad',
      getVal: (m) =>
        Math.min(100, (m.max_capacity_req_s / Math.max(1, highestCap.max_capacity_req_s)) * 100),
    },
    { key: 'sca', label: 'Escalabilidad', getVal: (m) => m.scalability_score },
    {
      key: 'ava',
      label: 'SLA Disp.',
      getVal: (m) => Math.max(10, Math.min(100, (m.availability_pct - 95) * 20)),
    },
    {
      key: 'cos',
      label: 'Economía',
      getVal: (m) => Math.max(8, 100 - Math.min(92, (m.monthly_cost_usd / maxParetoCost) * 90)),
    },
    { key: 'sec', label: 'Seguridad', getVal: (m) => m.security_score },
  ];

  const radarCenter = { cx: 145, cy: 118, r: 82 };
  const buildRadarPolygon = (m: ArchitectureMetrics) =>
    radarAxes
      .map((axis, i) => {
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / radarAxes.length;
        const ratio = Math.max(0.08, Math.min(1, axis.getVal(m) / 100));
        const x = radarCenter.cx + radarCenter.r * ratio * Math.cos(angle);
        const y = radarCenter.cy + radarCenter.r * ratio * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');

  return (
    <section className="panel-card" aria-labelledby={`${sectionId}-title`}>
      <div className="panel-header">
        <div>
          <div className="panel-title-wrap">
            <span className="panel-step-badge">Req. 6 y 7</span>
            <h2 id={`${sectionId}-title`} className="panel-title">
              Indicadores Cuantificables, Tabla Comparativa y Visualización Científica
            </h2>
          </div>
          <p className="panel-subtitle">
            Comparación matemática en vivo de las 4 arquitecturas con deltas Δ frente a{' '}
            <strong>{baselineLabel}</strong>.
          </p>
        </div>
      </div>

      {/* 1. Tarjetas Resumen KPI */}
      <div className="kpi-grid" style={{ marginBottom: '1.25rem' }}>
        <div className="kpi-card" style={{ borderInlineStartColor: ARCH_COLORS[winner.id] }}>
          <div className="kpi-label">Arquitectura Óptima (#1 SAW)</div>
          <div className="kpi-value">{winner.short_name}</div>
          <div className="kpi-meta">
            <span>Puntaje: {winner.final_score.toFixed(2)}/100</span>
            {baseWinnerArch && (
              <span
                className={`delta-pill delta-pill--${
                  formatDelta(winner.final_score, baseWinnerArch.final_score, ' pts', false).tone
                }`}
              >
                {formatDelta(winner.final_score, baseWinnerArch.final_score, ' pts', false).text}
              </span>
            )}
          </div>
        </div>

        <div className="kpi-card" style={{ borderInlineStartColor: ARCH_COLORS[fastest.id] }}>
          <div className="kpi-label">Menor Latencia Extremo a Extremo</div>
          <div className="kpi-value">{fastest.latency_ms.toFixed(1)} ms</div>
          <div className="kpi-meta">
            <span>{fastest.short_name}</span>
            {baseFastestArch && (
              <span
                className={`delta-pill delta-pill--${
                  formatDelta(fastest.latency_ms, baseFastestArch.latency_ms, ' ms', true).tone
                }`}
              >
                {formatDelta(fastest.latency_ms, baseFastestArch.latency_ms, ' ms', true).text}
              </span>
            )}
          </div>
        </div>

        <div className="kpi-card" style={{ borderInlineStartColor: ARCH_COLORS[cheapest.id] }}>
          <div className="kpi-label">Menor Costo Operativo Mensual</div>
          <div className="kpi-value">${cheapest.monthly_cost_usd.toFixed(2)}</div>
          <div className="kpi-meta">
            <span>{cheapest.short_name} (USD/mes)</span>
            {baseCheapestArch && (
              <span
                className={`delta-pill delta-pill--${
                  formatDelta(
                    cheapest.monthly_cost_usd,
                    baseCheapestArch.monthly_cost_usd,
                    ' USD',
                    true,
                    2
                  ).tone
                }`}
              >
                {
                  formatDelta(
                    cheapest.monthly_cost_usd,
                    baseCheapestArch.monthly_cost_usd,
                    ' USD',
                    true,
                    2
                  ).text
                }
              </span>
            )}
          </div>
        </div>

        <div className="kpi-card" style={{ borderInlineStartColor: ARCH_COLORS[highestCap.id] }}>
          <div className="kpi-label">Techo Capacidad Máxima</div>
          <div className="kpi-value">{highestCap.max_capacity_req_s.toFixed(1)} req/s</div>
          <div className="kpi-meta">
            <span>{highestCap.short_name}</span>
            {baseHighestCapArch && (
              <span
                className={`delta-pill delta-pill--${
                  formatDelta(
                    highestCap.max_capacity_req_s,
                    baseHighestCapArch.max_capacity_req_s,
                    ' req/s',
                    false
                  ).tone
                }`}
              >
                {
                  formatDelta(
                    highestCap.max_capacity_req_s,
                    baseHighestCapArch.max_capacity_req_s,
                    ' req/s',
                    false
                  ).text
                }
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 2. Tabla Comparativa Adaptable (modern-web-guidance: responsive-table) */}
      <div
        tabIndex={0}
        role="region"
        aria-labelledby={captionId}
        className="table-wrapper"
        style={{ marginBottom: '1.35rem' }}
      >
        <table className="comparison-table">
          <caption id={captionId}>
            Matriz comparativa de métricas estimadas por arquitectura (desliza o visualiza en tarjetas en móvil)
          </caption>
          <thead>
            <tr>
              <th scope="col">Arquitectura</th>
              <th scope="col">Puntaje SAW</th>
              <th scope="col">Latencia Est.</th>
              <th scope="col">Throughput / Cap.</th>
              <th scope="col">Escalabilidad</th>
              <th scope="col">Disponibilidad SLA</th>
              <th scope="col">Costo Mensual</th>
              <th scope="col">Docker / Recursos</th>
              <th scope="col">Seguridad / Equipo</th>
              <th scope="col">Pareto / Restricciones</th>
            </tr>
          </thead>
          <tbody>
            {result.ranking.map((m) => {
              const baseM = baseByArch.get(m.id);
              const latDelta = baseM
                ? formatDelta(m.latency_ms, baseM.latency_ms, ' ms', true)
                : null;
              const costDelta = baseM
                ? formatDelta(m.monthly_cost_usd, baseM.monthly_cost_usd, '$', true, 2)
                : null;
              const isWinner = m.rank === 1;

              return (
                <tr key={m.id} className={isWinner ? 'row-winner' : ''}>
                  <th scope="row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                      <span
                        className="legend-swatch"
                        style={{ backgroundColor: ARCH_COLORS[m.id] }}
                        aria-hidden="true"
                      />
                      <div>
                        <div>
                          #{m.rank} {m.short_name}
                        </div>
                        <div style={{ fontSize: '0.71rem', fontWeight: 500, color: '#475569' }}>
                          Utilización: {m.utilization_pct.toFixed(1)}% · Err: {m.error_rate_pct.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </th>
                  <td>
                    <strong style={{ color: '#0f172a', fontSize: '0.92rem' }}>
                      {m.final_score.toFixed(2)}/100
                    </strong>
                    {m.total_penalty > 0 && (
                      <div style={{ fontSize: '0.7rem', color: '#dc2626' }}>
                        Penalización: -{m.total_penalty.toFixed(1)}
                      </div>
                    )}
                  </td>
                  <td>
                    <strong style={{ color: m.meets_latency ? '#0f172a' : '#dc2626' }}>
                      {m.latency_ms.toFixed(2)} ms
                    </strong>
                    {latDelta && (
                      <div>
                        <span className={`delta-pill delta-pill--${latDelta.tone}`}>
                          {latDelta.text}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div>
                      <strong>{m.throughput_req_s.toFixed(2)}</strong> / {m.max_capacity_req_s.toFixed(1)} req/s
                    </div>
                  </td>
                  <td>
                    <strong>{m.scalability_score.toFixed(1)}</strong>/100
                  </td>
                  <td>
                    <strong style={{ color: m.meets_availability ? '#0f172a' : '#dc2626' }}>
                      {m.availability_pct.toFixed(3)}%
                    </strong>
                  </td>
                  <td>
                    <strong style={{ color: m.meets_budget ? '#065f46' : '#dc2626' }}>
                      ${m.monthly_cost_usd.toFixed(2)} USD
                    </strong>
                    {costDelta && (
                      <div>
                        <span className={`delta-pill delta-pill--${costDelta.tone}`}>
                          {costDelta.text}
                        </span>
                      </div>
                    )}
                  </td>
                  <td>
                    <div>{m.active_containers} cont. Docker</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      CPU {m.cpu_usage_pct.toFixed(0)}% · {m.ram_usage_mb.toFixed(0)} MB
                    </div>
                  </td>
                  <td>
                    <div>Seg: {m.security_score.toFixed(1)}/100</div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      Equipo: {m.team_operability_score.toFixed(0)}/100
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                      {m.is_pareto_efficient && (
                        <span className="badge-pill badge-pill--pareto">
                          <Award size={12} aria-hidden="true" /> Pareto
                        </span>
                      )}
                      {m.meets_all_constraints ? (
                        <span className="badge-pill badge-pill--ok">
                          <CheckCircle2 size={12} aria-hidden="true" /> Cumple SLA
                        </span>
                      ) : (
                        <span className="badge-pill badge-pill--fail">
                          <XCircle size={12} aria-hidden="true" /> Incumple
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 3. Las 4 Gráficas Interactivas SVG */}
      <div className="charts-grid">
        {/* GRÁFICA 1: Latencia Estimada vs Límite Máximo SLA */}
        <article className="chart-card">
          <div>
            <h3 className="chart-title">
              <BarChart3 size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              1. Latencia Estimada vs Límite Máximo SLA ({result.project_config.max_latency_ms} ms)
            </h3>
            <p className="chart-desc">
              Toca o pasa el cursor sobre cada barra para inspeccionar IPC, servicio ponderado y cola M/G/1.
            </p>
          </div>

          <svg viewBox="0 0 460 220" className="svg-chart" role="img" aria-label="Gráfica de barras de latencia estimada frente al límite máximo">
            {/* Línea de umbral máximo permitido */}
            {(() => {
              const limitX =
                130 +
                Math.min(1, result.project_config.max_latency_ms / maxBarLatency) * 285;
              return (
                <g>
                  <line
                    x1={limitX}
                    y1={14}
                    x2={limitX}
                    y2={196}
                    stroke="#dc2626"
                    strokeWidth={2}
                    strokeDasharray="5 4"
                  />
                  <text
                    x={Math.min(405, Math.max(135, limitX - 4))}
                    y={11}
                    fontSize={10}
                    fontWeight={700}
                    fill="#dc2626"
                    textAnchor="end"
                  >
                    SLA Máx: {result.project_config.max_latency_ms} ms
                  </text>
                </g>
              );
            })()}

            {result.architectures.map((m, idx) => {
              const y = 26 + idx * 44;
              const width = Math.max(
                6,
                Math.min(285, (m.latency_ms / maxBarLatency) * 285)
              );
              const isHovered = hoveredArch === m.id;
              return (
                <g
                  key={m.id}
                  onMouseEnter={() => setHoveredArch(m.id)}
                  onMouseLeave={() => setHoveredArch(null)}
                  onClick={() => setHoveredArch(m.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <text x={4} y={y + 18} fontSize={11.5} fontWeight={700} fill="#0f172a">
                    {m.short_name}
                  </text>
                  <rect
                    x={130}
                    y={y}
                    width={285}
                    height={26}
                    rx={6}
                    fill="#f1f5f9"
                  />
                  <rect
                    x={130}
                    y={y}
                    width={width}
                    height={26}
                    rx={6}
                    fill={m.meets_latency ? ARCH_COLORS[m.id] : '#dc2626'}
                    opacity={hoveredArch && !isHovered ? 0.65 : 1}
                  />
                  <text
                    x={Math.min(410, 136 + width)}
                    y={y + 17}
                    fontSize={11}
                    fontWeight={800}
                    fill="#0f172a"
                  >
                    {m.latency_ms.toFixed(1)} ms
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="chart-tooltip-bar">
            {hoveredArch ? (
              (() => {
                const m = result.architectures.find((a) => a.id === hoveredArch)!;
                return (
                  <span>
                    <strong>{m.short_name}:</strong> Servicio={m.formula_breakdown.weighted_service_ms} ms · Cola={m.formula_breakdown.queue_multiplier}x · IPC={m.formula_breakdown.ipc_ms} ms · ColdStart={m.formula_breakdown.cold_start_ms} ms
                  </span>
                );
              })()
            ) : (
              <span>
                Pasa el dedo o cursor sobre una arquitectura para ver el desglose aditivo de latencia.
              </span>
            )}
          </div>
        </article>

        {/* GRÁFICA 2: Curva de Escalabilidad vs Conductores Concurrentes (10..2500) */}
        <article className="chart-card">
          <div>
            <h3 className="chart-title">
              <TrendingUp size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              2. Curva de Escalabilidad: Latencia vs Conductores (10 a 2,500)
            </h3>
            <p className="chart-desc">
              Toca cualquier columna de carga para inspeccionar cómo satura o escala cada arquitectura.
            </p>
          </div>

          <div className="chart-legend">
            {ARCHITECTURE_ORDER.map((id) => {
              const arch = result.architectures.find((a) => a.id === id)!;
              return (
                <span key={id} className="legend-item">
                  <span className="legend-swatch" style={{ background: ARCH_COLORS[id] }} />
                  {arch.short_name}
                </span>
              );
            })}
          </div>

          <svg viewBox="0 0 460 220" className="svg-chart" role="img" aria-label="Curva de escalabilidad de latencia frente a conductores concurrentes">
            {/* Rejilla horizontal */}
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = 185 - t * 155;
              const val = Math.round(t * maxSweepLat);
              return (
                <g key={t}>
                  <line x1={48} y1={y} x2={440} y2={y} stroke="#e2e8f0" strokeWidth={1} />
                  <text x={43} y={y + 4} fontSize={9.5} fill="#64748b" textAnchor="end">
                    {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                  </text>
                </g>
              );
            })}

            {/* Líneas por arquitectura */}
            {ARCHITECTURE_ORDER.map((id) => {
              const pts = sweepPoints
                .map((entry, idx) => {
                  const x = 56 + (idx / Math.max(1, sweepPoints.length - 1)) * 376;
                  const clampedLat = Math.min(maxSweepLat, entry.architectures[id].latency_ms);
                  const y = 185 - (clampedLat / maxSweepLat) * 155;
                  return `${x.toFixed(1)},${y.toFixed(1)}`;
                })
                .join(' ');
              return (
                <polyline
                  key={id}
                  fill="none"
                  stroke={ARCH_COLORS[id]}
                  strokeWidth={2.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={pts}
                />
              );
            })}

            {/* Puntos interactivos por columna */}
            {sweepPoints.map((entry, idx) => {
              const x = 56 + (idx / Math.max(1, sweepPoints.length - 1)) * 376;
              const isSelected = idx === selectedDriverIdx;
              return (
                <g
                  key={entry.concurrent_drivers}
                  onMouseEnter={() => setSelectedDriverIdx(idx)}
                  onClick={() => setSelectedDriverIdx(idx)}
                  style={{ cursor: 'pointer' }}
                >
                  <line
                    x1={x}
                    y1={24}
                    x2={x}
                    y2={185}
                    stroke={isSelected ? '#065f46' : 'transparent'}
                    strokeWidth={1.5}
                    strokeDasharray="3 3"
                  />
                  <rect x={x - 24} y={20} width={48} height={180} fill="transparent" />
                  {ARCHITECTURE_ORDER.map((id) => {
                    const clampedLat = Math.min(maxSweepLat, entry.architectures[id].latency_ms);
                    const y = 185 - (clampedLat / maxSweepLat) * 155;
                    return (
                      <circle
                        key={id}
                        cx={x}
                        cy={y}
                        r={isSelected ? 5 : 3.5}
                        fill={ARCH_COLORS[id]}
                        stroke="#ffffff"
                        strokeWidth={1.5}
                      />
                    );
                  })}
                  <text
                    x={x}
                    y={204}
                    fontSize={10}
                    fontWeight={isSelected ? 800 : 600}
                    fill={isSelected ? '#065f46' : '#475569'}
                    textAnchor="middle"
                  >
                    {entry.concurrent_drivers}
                  </text>
                </g>
              );
            })}
          </svg>

          <div className="chart-tooltip-bar">
            <strong>U = {activeDriverPoint.concurrent_drivers} cond.:</strong>
            {ARCHITECTURE_ORDER.map((id) => (
              <span key={id} style={{ color: ARCH_COLORS[id], fontWeight: 700 }}>
                {activeDriverPoint.architectures[id].short_name}:{' '}
                {activeDriverPoint.architectures[id].latency_ms.toFixed(0)} ms
              </span>
            ))}
          </div>
        </article>

        {/* GRÁFICA 3: Frontera de Eficiencia de Pareto + Curva de Sobre-Escalado Blinowski 2022 */}
        <article className="chart-card">
          <div>
            <h3 className="chart-title">
              <Award size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              3. Frontera de Pareto (Costo vs Latencia) y Sobre-Escalado (I = 1..20)
            </h3>
            <p className="chart-desc">
              Izquierda/Arriba: región factible SLA y óptimos de Pareto (★). Abajo: efecto de sobre-escalado horizontal (<em>Blinowski et al., 2022</em>).
            </p>
          </div>

          {/* 3A: Dispersión de Pareto Costo Mensual vs Latencia */}
          <svg viewBox="0 0 460 185" className="svg-chart" role="img" aria-label="Diagrama de dispersión de frontera de Pareto Costo mensual contra Latencia">
            {/* Cuadrante factible (Presupuesto <= B_max y Latencia <= L_max) */}
            {(() => {
              const bx =
                54 +
                Math.min(1, result.project_config.max_budget_usd / maxParetoCost) * 380;
              const ly =
                152 -
                Math.min(1, result.project_config.max_latency_ms / maxParetoLat) * 130;
              return (
                <g>
                  <rect
                    x={54}
                    y={Math.max(22, ly)}
                    width={Math.max(0, bx - 54)}
                    height={Math.max(0, 152 - Math.max(22, ly))}
                    fill="#ecfdf5"
                    opacity={0.8}
                  />
                  <line
                    x1={bx}
                    y1={22}
                    x2={bx}
                    y2={152}
                    stroke="#059669"
                    strokeDasharray="4 3"
                    strokeWidth={1.3}
                  />
                  <text x={Math.min(430, bx + 3)} y={32} fontSize={9} fill="#065f46" fontWeight={700}>
                    Tope ${result.project_config.max_budget_usd}
                  </text>
                </g>
              );
            })()}

            <line x1={54} y1={152} x2={436} y2={152} stroke="#94a3b8" strokeWidth={1.2} />
            <line x1={54} y1={22} x2={54} y2={152} stroke="#94a3b8" strokeWidth={1.2} />

            {/* Línea guía de Frontera Pareto */}
            {paretoSorted2D.length > 1 && (
              <polyline
                fill="none"
                stroke="#7c3aed"
                strokeWidth={1.8}
                strokeDasharray="5 3"
                points={paretoSorted2D
                  .map((m) => {
                    const x = 54 + Math.min(1, m.monthly_cost_usd / maxParetoCost) * 380;
                    const y = 152 - Math.min(1, m.latency_ms / maxParetoLat) * 130;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ')}
              />
            )}

            {/* Nodos de las 4 arquitecturas */}
            {result.architectures.map((m) => {
              const x = 54 + Math.min(1, m.monthly_cost_usd / maxParetoCost) * 380;
              const y = 152 - Math.min(1, m.latency_ms / maxParetoLat) * 130;
              return (
                <g key={m.id}>
                  {m.is_pareto_efficient && (
                    <circle
                      cx={x}
                      cy={y}
                      r={11}
                      fill="none"
                      stroke="#7c3aed"
                      strokeWidth={2}
                    />
                  )}
                  <circle cx={x} cy={y} r={6.5} fill={ARCH_COLORS[m.id]} stroke="#fff" strokeWidth={1.5} />
                  <text
                    x={x > 340 ? x - 9 : x + 9}
                    y={y + 4}
                    fontSize={9.5}
                    fontWeight={700}
                    fill="#0f172a"
                    textAnchor={x > 340 ? 'end' : 'start'}
                  >
                    {m.short_name} (${m.monthly_cost_usd.toFixed(0)}, {m.latency_ms.toFixed(0)}ms)
                  </text>
                </g>
              );
            })}

            <text x={245} y={174} fontSize={10} fill="#475569" textAnchor="middle" fontWeight={700}>
              Costo Mensual Estimado (USD/mes) → menor es mejor
            </text>
            <text
              x={14}
              y={92}
              fontSize={9.5}
              fill="#475569"
              textAnchor="middle"
              fontWeight={700}
              transform="rotate(-90 14 92)"
            >
              Latencia (ms)
            </text>
          </svg>

          {/* 3B: Curva de Sobre-Escalado por Instancias (1 a 20, Blinowski 2022) */}
          <div style={{ borderTop: '1px dashed #cbd5e1', paddingTop: '0.5rem' }}>
            <div style={{ fontSize: '0.77rem', fontWeight: 800, color: '#334155', marginBottom: 4 }}>
              Curva de Sobre-Escalado Horizontal por Instancias I = 1..20 (umbral óptimo I ≤ 6):
            </div>
            <svg viewBox="0 0 460 135" className="svg-chart" role="img" aria-label="Curva de sobre-escalado por número de instancias de 1 a 20">
              {ARCHITECTURE_ORDER.map((id) => {
                const pts = instSweep
                  .map((entry, idx) => {
                    const x = 48 + (idx / Math.max(1, instSweep.length - 1)) * 388;
                    const lat = Math.min(maxInstLatency, entry.architectures[id].latency_ms);
                    const y = 108 - (lat / maxInstLatency) * 86;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');
                return (
                  <polyline
                    key={id}
                    fill="none"
                    stroke={ARCH_COLORS[id]}
                    strokeWidth={2.2}
                    points={pts}
                  />
                );
              })}

              {instSweep.map((entry, idx) => {
                const x = 48 + (idx / Math.max(1, instSweep.length - 1)) * 388;
                const isSel = idx === selectedInstanceIdx;
                return (
                  <g
                    key={entry.compute_instances}
                    onMouseEnter={() => setSelectedInstanceIdx(idx)}
                    onClick={() => setSelectedInstanceIdx(idx)}
                    style={{ cursor: 'pointer' }}
                  >
                    <rect x={x - 24} y={14} width={48} height={110} fill="transparent" />
                    <line
                      x1={x}
                      y1={16}
                      x2={x}
                      y2={108}
                      stroke={entry.compute_instances === 6 ? '#059669' : isSel ? '#334155' : '#e2e8f0'}
                      strokeDasharray={entry.compute_instances === 6 ? '4 2' : undefined}
                      strokeWidth={isSel ? 1.6 : 1}
                    />
                    {ARCHITECTURE_ORDER.map((id) => {
                      const lat = Math.min(maxInstLatency, entry.architectures[id].latency_ms);
                      const y = 108 - (lat / maxInstLatency) * 86;
                      return (
                        <circle
                          key={id}
                          cx={x}
                          cy={y}
                          r={isSel ? 4.5 : 3}
                          fill={ARCH_COLORS[id]}
                        />
                      );
                    })}
                    <text
                      x={x}
                      y={125}
                      fontSize={9.5}
                      fontWeight={isSel ? 800 : 600}
                      fill={isSel ? '#065f46' : '#475569'}
                      textAnchor="middle"
                    >
                      I={entry.compute_instances}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div className="chart-tooltip-bar">
              <strong>I = {activeInstancePoint.compute_instances} inst.:</strong>
              <span>
                Factor coord. Micro={activeInstancePoint.architectures.MICRO_DOCKER.over_scale_factor?.toFixed(3)} · IPC Micro=+{activeInstancePoint.architectures.MICRO_DOCKER.ipc_ms?.toFixed(1)} ms · Costo Micro=${activeInstancePoint.architectures.MICRO_DOCKER.monthly_cost_usd.toFixed(0)}
              </span>
            </div>
          </div>
        </article>

        {/* GRÁFICA 4: Radar Multicriterio + Barras de Capacidad, SLA, Contenedores y Seguridad */}
        <article className="chart-card">
          <div>
            <h3 className="chart-title">
              <Layers size={15} style={{ verticalAlign: 'middle', marginRight: 6 }} />
              4. Balance Multicriterio: Throughput, SLA, Contenedores Docker y Seguridad
            </h3>
            <p className="chart-desc">
              Huella hexagonal de desempeño normalizado junto con indicadores físicos de operación.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
              gap: '0.75rem',
              alignItems: 'center',
            }}
          >
            {/* Radar Hexagonal SVG */}
            <svg viewBox="0 0 290 235" className="svg-chart" role="img" aria-label="Radar hexagonal multicriterio de las 4 arquitecturas">
              {[0.33, 0.66, 1].map((ring) => {
                const pts = radarAxes
                  .map((_, i) => {
                    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / radarAxes.length;
                    const x = radarCenter.cx + radarCenter.r * ring * Math.cos(angle);
                    const y = radarCenter.cy + radarCenter.r * ring * Math.sin(angle);
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');
                return (
                  <polygon
                    key={ring}
                    points={pts}
                    fill="none"
                    stroke="#cbd5e1"
                    strokeWidth={1}
                  />
                );
              })}

              {radarAxes.map((axis, i) => {
                const angle = -Math.PI / 2 + (i * 2 * Math.PI) / radarAxes.length;
                const x2 = radarCenter.cx + radarCenter.r * Math.cos(angle);
                const y2 = radarCenter.cy + radarCenter.r * Math.sin(angle);
                const lx = radarCenter.cx + (radarCenter.r + 22) * Math.cos(angle);
                const ly = radarCenter.cy + (radarCenter.r + 16) * Math.sin(angle);
                return (
                  <g key={axis.key}>
                    <line
                      x1={radarCenter.cx}
                      y1={radarCenter.cy}
                      x2={x2}
                      y2={y2}
                      stroke="#e2e8f0"
                    />
                    <text
                      x={lx}
                      y={ly + 3}
                      fontSize={9.5}
                      fontWeight={700}
                      fill="#334155"
                      textAnchor="middle"
                    >
                      {axis.label}
                    </text>
                  </g>
                );
              })}

              {result.architectures.map((m) => (
                <polygon
                  key={m.id}
                  points={buildRadarPolygon(m)}
                  fill={ARCH_COLORS[m.id]}
                  fillOpacity={m.id === winner.id ? 0.22 : 0.08}
                  stroke={ARCH_COLORS[m.id]}
                  strokeWidth={m.id === winner.id ? 2.6 : 1.7}
                />
              ))}
            </svg>

            {/* Mini-barras comparativas de Capacidad, SLA, Contenedores y Seguridad */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', fontSize: '0.76rem' }}>
              {result.architectures.map((m) => (
                <div
                  key={m.id}
                  style={{
                    padding: '0.5rem 0.65rem',
                    borderRadius: '8px',
                    background: '#f8fafc',
                    borderLeft: `4px solid ${ARCH_COLORS[m.id]}`,
                  }}
                >
                  <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 3 }}>
                    {m.short_name}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#334155' }}>
                    <span>Cap: <strong>{m.max_capacity_req_s.toFixed(1)} req/s</strong></span>
                    <span>SLA: <strong>{m.availability_pct.toFixed(2)}%</strong></span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: '#475569' }}>
                    <span>Docker: <strong>{m.active_containers} cont.</strong></span>
                    <span>Seg/Cifr: <strong>{m.security_score.toFixed(0)}/100</strong></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>
    </section>
  );
};
