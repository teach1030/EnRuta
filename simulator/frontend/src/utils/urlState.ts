import {
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_SIMULATION_INPUT,
  SCENARIOS_CATALOG,
  applyScenarioPreset,
} from '../engine/localFallbackEngine';
import { ProjectConfig, ScenarioPreset, SimulationInput } from '../types/simulator';

export const OFFICIAL_GITHUB_PAGES_URL =
  import.meta.env.VITE_PUBLIC_URL || 'https://teach1030.github.io/EnRuta/';

export interface ParsedUrlScenario {
  hasUrlParams: boolean;
  scenarioId: string | null;
  simInput: SimulationInput;
  projectConfig: ProjectConfig;
}

function parseClampedNumber(
  raw: string | null,
  min: number,
  max: number,
  isInt = false
): number | null {
  if (raw === null || raw.trim() === '') return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return null;
  const clamped = Math.min(max, Math.max(min, parsed));
  return isInt ? Math.round(clamped) : clamped;
}

/**
 * Lee parámetros compartidos desde `window.location.search`, ej:
 * `?u=450&g=35&np=105&i=4&crud=6&b=300&lat=1500&avail=99.5&sc=HEAVY_TSP_ROUTES`
 */
export function parseScenarioFromUrl(
  search: string,
  scenarios: ScenarioPreset[] = SCENARIOS_CATALOG
): ParsedUrlScenario {
  const params = new URLSearchParams(search);
  const relevantKeys = ['u', 'g', 'np', 'i', 'crud', 'b', 'lat', 'avail', 'team', 'sc'];
  const hasUrlParams = relevantKeys.some((k) => params.has(k));

  if (!hasUrlParams) {
    return {
      hasUrlParams: false,
      scenarioId: 'REF_MVP_BOGOTA',
      simInput: { ...DEFAULT_SIMULATION_INPUT },
      projectConfig: {
        ...DEFAULT_PROJECT_CONFIG,
        weights: { ...DEFAULT_PROJECT_CONFIG.weights },
      },
    };
  }

  let simInput: SimulationInput = { ...DEFAULT_SIMULATION_INPUT };
  let projectConfig: ProjectConfig = {
    ...DEFAULT_PROJECT_CONFIG,
    weights: { ...DEFAULT_PROJECT_CONFIG.weights },
  };
  let scenarioId: string | null = null;

  const scParam = params.get('sc');
  if (scParam) {
    const matched = scenarios.find((s) => s.id === scParam.trim());
    if (matched) {
      const applied = applyScenarioPreset(matched, projectConfig);
      simInput = applied.simInput;
      projectConfig = applied.projectConfig;
      scenarioId = matched.id;
    }
  }

  const u = parseClampedNumber(params.get('u'), 1, 5000, true);
  const g = parseClampedNumber(params.get('g'), 0, 150, true);
  const np = parseClampedNumber(params.get('np'), 2, 150, true);
  const i = parseClampedNumber(params.get('i'), 1, 20, true);
  const crud = parseClampedNumber(params.get('crud'), 0.5, 60, false);

  const b = parseClampedNumber(params.get('b'), 0, 10000, false);
  const lat = parseClampedNumber(params.get('lat'), 50, 30000, false);
  const avail = parseClampedNumber(params.get('avail'), 90, 99.99, false);
  const team = parseClampedNumber(params.get('team'), 1, 50, true);

  if (u !== null) simInput.concurrent_drivers = u;
  if (g !== null) simInput.ocr_guides_per_driver = g;
  if (np !== null) simInput.stops_per_route = np;
  if (i !== null) simInput.compute_instances = i;
  if (crud !== null) simInput.crud_ops_per_min = crud;

  if (b !== null) projectConfig.max_budget_usd = b;
  if (lat !== null) projectConfig.max_latency_ms = lat;
  if (avail !== null) projectConfig.min_availability_pct = avail;
  if (team !== null) projectConfig.team_size = team;

  return {
    hasUrlParams: true,
    scenarioId,
    simInput,
    projectConfig,
  };
}

/**
 * Construye una URL compartible (para QR del salón o portapapeles) con el estado activo.
 */
export function buildShareableScenarioUrl(
  baseUrl: string,
  simInput: SimulationInput,
  projectConfig: ProjectConfig,
  activeScenarioId: string | null,
  includeParams: boolean
): string {
  const cleanBase = baseUrl.split('?')[0].split('#')[0];
  if (!includeParams) {
    return cleanBase;
  }

  const params = new URLSearchParams();
  params.set('u', String(simInput.concurrent_drivers));
  params.set('g', String(simInput.ocr_guides_per_driver));
  params.set('np', String(simInput.stops_per_route));
  params.set('i', String(simInput.compute_instances));
  params.set('crud', String(simInput.crud_ops_per_min));
  params.set('b', String(projectConfig.max_budget_usd));
  params.set('lat', String(projectConfig.max_latency_ms));
  params.set('avail', String(projectConfig.min_availability_pct));
  params.set('team', String(projectConfig.team_size));
  if (activeScenarioId) {
    params.set('sc', activeScenarioId);
  }

  return `${cleanBase}?${params.toString()}`;
}
