import {
  ARCHITECTURES,
  ARCHITECTURE_ORDER,
  SCENARIOS_CATALOG,
  getAllArchitectures,
  runDriverSweepLocal,
  runFullSimulationLocal,
  runInstanceSweepLocal,
} from '../engine/localFallbackEngine';
import {
  ArchitectureId,
  ArchitectureMetrics,
  ArchitectureSpec,
  DriverSweepEntry,
  EngineSource,
  InstanceSweepEntry,
  ProjectConfig,
  ScenarioPreset,
  SimulationInput,
  SimulationResult,
} from '../types/simulator';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const REQUEST_TIMEOUT_MS = 1500;

function isGitHubPagesHost(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.endsWith('github.io');
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers ?? {}),
      },
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export interface SimulationExecutionResponse {
  result: SimulationResult;
  source: EngineSource;
}

/**
 * Conector inteligente: consulta primero el contenedor FastAPI (`enruta-sim-api`)
 * en `/api/v1/simulate` y `/api/v1/simulate/sweep` con timeout de 1500ms;
 * si se ejecuta desde GitHub Pages o sin backend Docker activo, conmuta
 * transparentemente al motor TypeScript espejo (`localFallbackEngine.ts`).
 */
export async function executeSimulation(
  simInput: SimulationInput,
  projectConfig: ProjectConfig
): Promise<SimulationExecutionResponse> {
  if (isGitHubPagesHost()) {
    return {
      result: runFullSimulationLocal(simInput, projectConfig),
      source: 'local-ts',
    };
  }

  try {
    const body = JSON.stringify({
      sim_input: simInput,
      project_config: projectConfig,
    });

    const [simResp, sweepResp] = await Promise.all([
      fetchWithTimeout(`${API_BASE}/simulate`, { method: 'POST', body }),
      fetchWithTimeout(`${API_BASE}/simulate/sweep`, { method: 'POST', body }).catch(() => null),
    ]);

    if (!simResp.ok) {
      throw new Error(`HTTP ${simResp.status}`);
    }

    const simData = await simResp.json();
    const sweepData = sweepResp && sweepResp.ok ? await sweepResp.json() : null;

    // Garantizar integridad de campos combinando respuesta FastAPI + fallback si algún campo opcional variara
    const localMirror = runFullSimulationLocal(simInput, projectConfig);

    const architectures: ArchitectureMetrics[] = Array.isArray(simData.architectures)
      ? simData.architectures
      : localMirror.architectures;

    const ranking: ArchitectureMetrics[] = Array.isArray(simData.ranking)
      ? simData.ranking
      : localMirror.ranking;

    const driverSweep: DriverSweepEntry[] =
      sweepData?.driver_sweep ??
      simData?.driver_sweep ??
      runDriverSweepLocal(simInput, projectConfig);

    const instanceSweep: InstanceSweepEntry[] =
      sweepData?.instance_sweep ??
      simData?.instance_sweep ??
      runInstanceSweepLocal(simInput, projectConfig);

    const mergedResult: SimulationResult = {
      sim_input: simData.sim_input ?? simInput,
      project_config: simData.project_config ?? projectConfig,
      normalized_weights: simData.normalized_weights ?? localMirror.normalized_weights,
      architectures,
      ranking,
      pareto_frontier: simData.pareto_frontier ?? localMirror.pareto_frontier,
      pareto_efficient_ids:
        simData.pareto_efficient_ids ??
        simData.pareto_frontier?.efficient_ids ??
        localMirror.pareto_efficient_ids,
      recommendation: simData.recommendation ?? localMirror.recommendation,
      driver_sweep: driverSweep,
      instance_sweep: instanceSweep,
    };

    return {
      result: mergedResult,
      source: 'docker-fastapi',
    };
  } catch {
    return {
      result: runFullSimulationLocal(simInput, projectConfig),
      source: 'local-ts',
    };
  }
}

export async function fetchCatalogData(): Promise<{
  architectures: ArchitectureSpec[];
  scenarios: ScenarioPreset[];
  source: EngineSource;
}> {
  if (isGitHubPagesHost()) {
    return {
      architectures: getAllArchitectures(),
      scenarios: SCENARIOS_CATALOG,
      source: 'local-ts',
    };
  }

  try {
    const [archResp, scenResp] = await Promise.all([
      fetchWithTimeout(`${API_BASE}/architectures`),
      fetchWithTimeout(`${API_BASE}/scenarios`),
    ]);

    if (!archResp.ok || !scenResp.ok) {
      throw new Error('Backend catalog unavailable');
    }

    const archJson = await archResp.json();
    const scenJson = await scenResp.json();

    const rawArchList = Array.isArray(archJson)
      ? archJson
      : Array.isArray(archJson?.architectures)
        ? archJson.architectures
        : null;

    const rawScenList = Array.isArray(scenJson)
      ? scenJson
      : Array.isArray(scenJson?.scenarios)
        ? scenJson.scenarios
        : null;

    const architectures: ArchitectureSpec[] = rawArchList
      ? ARCHITECTURE_ORDER.map((id) => {
          const found = rawArchList.find((item: { id: ArchitectureId }) => item.id === id);
          return found ? { ...ARCHITECTURES[id], ...found } : ARCHITECTURES[id];
        })
      : getAllArchitectures();

    const scenarios: ScenarioPreset[] =
      rawScenList && rawScenList.length > 0 ? rawScenList : SCENARIOS_CATALOG;

    return {
      architectures,
      scenarios,
      source: 'docker-fastapi',
    };
  } catch {
    return {
      architectures: getAllArchitectures(),
      scenarios: SCENARIOS_CATALOG,
      source: 'local-ts',
    };
  }
}

/**
 * Utilidad para la prueba CP-06: verifica rechazo HTTP 422 en el contenedor FastAPI si está activo.
 */
export async function probeBackendValidation422(
  invalidPayload: Record<string, unknown>
): Promise<{ testedAgainstBackend: boolean; status: number | null }> {
  if (isGitHubPagesHost()) {
    return { testedAgainstBackend: false, status: null };
  }
  try {
    const resp = await fetchWithTimeout(`${API_BASE}/simulate`, {
      method: 'POST',
      body: JSON.stringify(invalidPayload),
    });
    return { testedAgainstBackend: true, status: resp.status };
  } catch {
    return { testedAgainstBackend: false, status: null };
  }
}
