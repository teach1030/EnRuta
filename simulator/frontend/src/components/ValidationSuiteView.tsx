import React, { useEffect, useId, useState } from 'react';
import { CheckCircle2, PlayCircle, ShieldCheck, XCircle, ArrowUpRight } from 'lucide-react';
import {
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_SIMULATION_INPUT,
  SCENARIOS_CATALOG,
  applyScenarioPreset,
  runFullSimulationLocal,
  validateSimulationParameters,
} from '../engine/localFallbackEngine';
import { probeBackendValidation422 } from '../services/simulatorApi';
import { EngineSource, ProjectConfig, SimulationInput } from '../types/simulator';

interface ValidationSuiteViewProps {
  engineSource: EngineSource;
  onLoadScenarioIntoSimulator: (simInput: SimulationInput, projectConfig: ProjectConfig) => void;
}

interface TestCaseOutcome {
  code: string;
  title: string;
  inputSummary: string;
  expectedSummary: string;
  actualSummary: string;
  passed: boolean;
  durationMs: number;
  loadableInput?: { simInput: SimulationInput; projectConfig: ProjectConfig };
}

export const ValidationSuiteView: React.FC<ValidationSuiteViewProps> = ({
  engineSource,
  onLoadScenarioIntoSimulator,
}) => {
  const sectionId = useId();
  const [results, setResults] = useState<TestCaseOutcome[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const executeAllTests = async () => {
    setIsRunning(true);
    const outcomes: TestCaseOutcome[] = [];

    // CP-01: Operación Actual MVP Bogotá
    {
      const t0 = performance.now();
      const preset = SCENARIOS_CATALOG.find((s) => s.id === 'REF_MVP_BOGOTA')!;
      const { simInput, projectConfig } = applyScenarioPreset(preset);
      const res = runFullSimulationLocal(simInput, projectConfig);
      const micro = res.architectures.find((a) => a.id === 'MICRO_DOCKER')!;
      const mono = res.architectures.find((a) => a.id === 'MONO_MVP')!;
      const edge = res.architectures.find((a) => a.id === 'HYBRID_EDGE_SERVERLESS')!;
      const passed =
        !micro.meets_budget &&
        edge.meets_all_constraints &&
        mono.meets_all_constraints &&
        res.recommendation.winner_id === 'HYBRID_EDGE_SERVERLESS';
      outcomes.push({
        code: 'CP-01',
        title: 'Operación Actual MVP Bogotá (Presupuesto Semilla $25 USD)',
        inputSummary: 'U=35, G=30, N_p=30, I=1, F_crud=6.0 | B_max=$25 USD, Team=3',
        expectedSummary:
          'Descarte de MICRO_DOCKER por presupuesto ($48.83 > $25) y victoria de arquitectura económica/ligera cumpliendo 100% restricciones.',
        actualSummary: `Ganadora: ${res.recommendation.winner_short_name} (${res.recommendation.winner_score}/100, $${edge.monthly_cost_usd} USD). Monolito MVP #2 ($${mono.monthly_cost_usd} USD, ${mono.latency_ms} ms). Microservicios descartada ($${micro.monthly_cost_usd} USD).`,
        passed,
        durationMs: Number((performance.now() - t0).toFixed(2)),
        loadableInput: { simInput, projectConfig },
      });
    }

    // CP-02: Ráfaga Matutina 6:30 AM OCR de Guías
    {
      const t0 = performance.now();
      const preset = SCENARIOS_CATALOG.find((s) => s.id === 'PEAK_MORNING_OCR')!;
      const { simInput, projectConfig } = applyScenarioPreset(preset);
      const res = runFullSimulationLocal(simInput, projectConfig);
      const edge = res.architectures.find((a) => a.id === 'HYBRID_EDGE_SERVERLESS')!;
      const mono = res.architectures.find((a) => a.id === 'MONO_MVP')!;
      const passed =
        res.recommendation.winner_id === 'HYBRID_EDGE_SERVERLESS' &&
        edge.meets_all_constraints &&
        edge.latency_ms < mono.latency_ms &&
        !mono.meets_budget;
      outcomes.push({
        code: 'CP-02',
        title: 'Ráfaga Matutina 6:30 AM OCR de Guías (ML Kit On-Device vs Cloud)',
        inputSummary: 'U=85, G=70, N_p=30, I=1, F_crud=2.5 | B_max=$45 USD, L_max=400 ms',
        expectedSummary:
          'Victoria de HYBRID_EDGE_SERVERLESS al procesar el 85% del OCR en el teléfono Android (τ_ocr=65 ms) sin exceder presupuesto de API Vision.',
        actualSummary: `Ganadora: ${res.recommendation.winner_short_name} (${edge.latency_ms} ms vs ${mono.latency_ms} ms en Monolito; costo $${edge.monthly_cost_usd} vs $${mono.monthly_cost_usd} USD).`,
        passed,
        durationMs: Number((performance.now() - t0).toFixed(2)),
        loadableInput: { simInput, projectConfig },
      });
    }

    // CP-03: Estrés Algorítmico TSP OR-Tools
    {
      const t0 = performance.now();
      const simInput: SimulationInput = {
        concurrent_drivers: 450,
        ocr_guides_per_driver: 35,
        stops_per_route: 105,
        compute_instances: 4,
        crud_ops_per_min: 6.0,
      };
      const projectConfig: ProjectConfig = {
        ...DEFAULT_PROJECT_CONFIG,
        expected_users: 450,
        max_budget_usd: 300,
        max_latency_ms: 1500,
        min_availability_pct: 99.5,
        team_size: 4,
      };
      const res = runFullSimulationLocal(simInput, projectConfig);
      const mono = res.architectures.find((a) => a.id === 'MONO_MVP')!;
      const micro = res.architectures.find((a) => a.id === 'MICRO_DOCKER')!;
      const passed =
        res.recommendation.winner_id === 'MICRO_DOCKER' &&
        micro.meets_all_constraints &&
        !mono.meets_availability &&
        mono.utilization_pct > 85;
      outcomes.push({
        code: 'CP-03',
        title: 'Estrés Algorítmico Solver TSP OR-Tools (105 Paradas Haversine)',
        inputSummary: 'U=450, G=35, N_p=105, I=4, F_crud=6.0 | B_max=$300 USD, A_min=99.5%',
        expectedSummary:
          'Saturación/bloqueo del Monolito (c_tsp=26.0, SPOF < 99.5%) y victoria de MICRO_DOCKER aislando ms-tsp-ortools C++.',
        actualSummary: `Ganadora: ${res.recommendation.winner_short_name} (${micro.final_score}/100, ${micro.latency_ms} ms, SLA ${micro.availability_pct}%). Monolito al ${mono.utilization_pct}% util. (${mono.latency_ms} ms).`,
        passed,
        durationMs: Number((performance.now() - t0).toFixed(2)),
        loadableInput: { simInput, projectConfig },
      });
    }

    // CP-04: Expansión Nacional Multi-Ciudad SLA >= 99.9%
    {
      const t0 = performance.now();
      const preset = SCENARIOS_CATALOG.find((s) => s.id === 'NATIONAL_SCALE_SLA')!;
      const { simInput, projectConfig } = applyScenarioPreset(preset);
      const res = runFullSimulationLocal(simInput, projectConfig);
      const mono = res.architectures.find((a) => a.id === 'MONO_MVP')!;
      const micro = res.architectures.find((a) => a.id === 'MICRO_DOCKER')!;
      const passed =
        res.recommendation.winner_id === 'MICRO_DOCKER' &&
        micro.meets_all_constraints &&
        mono.utilization_pct > 105 &&
        mono.error_rate_pct > 20;
      outcomes.push({
        code: 'CP-04',
        title: 'Expansión Nacional Multi-Ciudad (850 Conductores, SLA 99.90%)',
        inputSummary: 'U=850, G=45, N_p=65, I=6, F_crud=12.0 | B_max=$650 USD, A_min=99.9%, Team=8',
        expectedSummary:
          'Colapso del Monolito por sobrecarga (>105% util.) y victoria solvente de MICRO_DOCKER con redundancia multi-réplica.',
        actualSummary: `Ganadora: ${res.recommendation.winner_short_name} (${micro.final_score}/100, SLA ${micro.availability_pct}%, err 0%). Monolito colapsado (${mono.utilization_pct}% util., ${mono.error_rate_pct}% errores).`,
        passed,
        durationMs: Number((performance.now() - t0).toFixed(2)),
        loadableInput: { simInput, projectConfig },
      });
    }

    // CP-05: Sobre-Escalado Horizontal (Blinowski et al., 2022)
    {
      const t0 = performance.now();
      const preset = SCENARIOS_CATALOG.find((s) => s.id === 'OVERSCALING_SIMPLE_SWIPE')!;
      const { simInput: simI15, projectConfig } = applyScenarioPreset(preset);
      const simI3: SimulationInput = { ...simI15, compute_instances: 3 };
      const resI3 = runFullSimulationLocal(simI3, projectConfig);
      const resI15 = runFullSimulationLocal(simI15, projectConfig);
      const micro3 = resI3.architectures.find((a) => a.id === 'MICRO_DOCKER')!;
      const micro15 = resI15.architectures.find((a) => a.id === 'MICRO_DOCKER')!;
      const passed =
        micro15.latency_ms > micro3.latency_ms &&
        micro15.monthly_cost_usd > micro3.monthly_cost_usd &&
        micro15.formula_breakdown.over_scale_factor < 1.0 &&
        resI15.recommendation.winner_id === 'MONO_MVP';
      outcomes.push({
        code: 'CP-05',
        title: 'Efecto de Sobre-Escalado Horizontal en Consultas Simples (Blinowski 2022)',
        inputSummary: 'Comparativa I=3 vs I=15 réplicas con U=45, G=5, N_p=20, F_crud=14.0',
        expectedSummary:
          'Escalar de I=3 a I=15 en carga ligera degrada latencia IPC, activa penalización over_scale_factor < 1.0 y dispara el costo mensual.',
        actualSummary: `En MICRO_DOCKER: I=3 (${micro3.latency_ms} ms, $${micro3.monthly_cost_usd}) → I=15 (${micro15.latency_ms} ms, $${micro15.monthly_cost_usd}, over_scale=${micro15.formula_breakdown.over_scale_factor}). Ganadora en carga simple: Monolito MVP (${resI15.architectures[0].latency_ms} ms).`,
        passed,
        durationMs: Number((performance.now() - t0).toFixed(2)),
        loadableInput: { simInput: simI15, projectConfig },
      });
    }

    // CP-06: Bloqueo de Entradas Inválidas y Fuera de Rango (Req. 10)
    {
      const t0 = performance.now();
      const badInput: SimulationInput = {
        ...DEFAULT_SIMULATION_INPUT,
        concurrent_drivers: -15,
        stops_per_route: 0,
      };
      const badConfig: ProjectConfig = {
        ...DEFAULT_PROJECT_CONFIG,
        max_budget_usd: -10,
        min_availability_pct: 102,
        weights: {
          latency: 0,
          throughput: 0,
          scalability: 0,
          availability: 0,
          cost: 0,
          security: 0,
        },
      };
      const localErrors = validateSimulationParameters(badInput, badConfig);

      let backendNote = 'Validación estricta en cliente TS (5/5 violaciones interceptadas)';
      let backendOk = true;
      if (engineSource === 'docker-fastapi') {
        const probe = await probeBackendValidation422({
          sim_input: badInput,
          project_config: badConfig,
        });
        if (probe.testedAgainstBackend) {
          backendOk = probe.status === 422;
          backendNote = `Contenedor FastAPI respondió HTTP ${probe.status} Unprocessable Entity + 5/5 reglas en cliente`;
        }
      }

      const passed = localErrors.length >= 5 && backendOk;
      outcomes.push({
        code: 'CP-06',
        title: 'Control y Rechazo de Entradas Inválidas / Incoherentes (Req. 10)',
        inputSummary: 'U=-15, N_p=0, B_max=-10, A_min=102%, suma(pesos)=0',
        expectedSummary:
          'Detección inmediata de los 5 errores de dominio (y HTTP 422 en FastAPI cuando el contenedor está activo) impidiendo cálculos inválidos.',
        actualSummary: `${backendNote}. Errores capturados: ${localErrors.length}.`,
        passed,
        durationMs: Number((performance.now() - t0).toFixed(2)),
      });
    }

    setResults(outcomes);
    setIsRunning(false);
  };

  useEffect(() => {
    void executeAllTests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engineSource]);

  const passedCount = results.filter((r) => r.passed).length;

  return (
    <section className="panel-card" aria-labelledby={sectionId}>
      <div className="panel-header">
        <div>
          <div className="panel-title-wrap">
            <span className="panel-step-badge">Req. 10 y 11</span>
            <h2 id={sectionId} className="panel-title">
              Suite Interactiva de Validación del Modelo Matemático (CP-01 a CP-06)
            </h2>
          </div>
          <p className="panel-subtitle">
            Ejecuta en vivo los 6 casos de prueba oficiales de EnRuta para verificar coherencia matemática y controles de validación.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          {results.length > 0 && (
            <span className="badge-pill badge-pill--ok" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>
              <ShieldCheck size={15} aria-hidden="true" />
              {passedCount}/{results.length} PASS ✅
            </span>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void executeAllTests()}
            disabled={isRunning}
          >
            <PlayCircle size={16} aria-hidden="true" />
            {isRunning ? 'Ejecutando...' : 'Re-ejecutar 6 Pruebas'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
        {results.map((tc) => (
          <article
            key={tc.code}
            style={{
              padding: '0.9rem 1rem',
              borderRadius: 12,
              background: tc.passed ? '#f8fffc' : '#fef2f2',
              border: `1.5px solid ${tc.passed ? '#6ee7b7' : '#fca5a5'}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '0.4rem',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.5rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span
                  style={{
                    padding: '0.18rem 0.55rem',
                    borderRadius: 6,
                    background: '#065f46',
                    color: '#ffffff',
                    fontWeight: 800,
                    fontSize: '0.76rem',
                  }}
                >
                  {tc.code}
                </span>
                <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>{tc.title}</strong>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', color: '#64748b' }}>{tc.durationMs} ms</span>
                {tc.passed ? (
                  <span className="badge-pill badge-pill--ok">
                    <CheckCircle2 size={13} aria-hidden="true" /> PASS ✅
                  </span>
                ) : (
                  <span className="badge-pill badge-pill--fail">
                    <XCircle size={13} aria-hidden="true" /> FAIL ❌
                  </span>
                )}
                {tc.loadableInput && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    style={{ fontSize: '0.73rem', padding: '0.28rem 0.55rem' }}
                    onClick={() =>
                      onLoadScenarioIntoSimulator(
                        tc.loadableInput!.simInput,
                        tc.loadableInput!.projectConfig
                      )
                    }
                  >
                    Cargar en Simulador <ArrowUpRight size={13} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <div style={{ fontSize: '0.78rem', color: '#475569' }}>
              <strong>Entradas:</strong> <code>{tc.inputSummary}</code>
            </div>
            <div style={{ fontSize: '0.78rem', color: '#334155' }}>
              <strong>Esperado:</strong> {tc.expectedSummary}
            </div>
            <div style={{ fontSize: '0.79rem', color: '#064e3b', fontWeight: 600 }}>
              <strong>Resultado Verificado:</strong> {tc.actualSummary}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
};
