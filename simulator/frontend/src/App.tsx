import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  Award,
  BarChart3,
  CheckSquare,
  Cpu,
  Layers,
  QrCode,
  Route,
  Share2,
  Sliders,
} from 'lucide-react';
import { ArchitectureCards } from './components/ArchitectureCards';
import { ClassroomQRModal, ClassroomQRModalHandle } from './components/ClassroomQRModal';
import { DecisionAdvisor } from './components/DecisionAdvisor';
import { MetricsComparison } from './components/MetricsComparison';
import { ProjectConfigPanel } from './components/ProjectConfigPanel';
import { SimulationControls } from './components/SimulationControls';
import { ValidationSuiteView } from './components/ValidationSuiteView';
import {
  DEFAULT_PROJECT_CONFIG,
  DEFAULT_SIMULATION_INPUT,
  SCENARIOS_CATALOG,
  applyScenarioPreset,
  getAllArchitectures,
  runFullSimulationLocal,
  validateSimulationParameters,
} from './engine/localFallbackEngine';
import { executeSimulation, fetchCatalogData } from './services/simulatorApi';
import {
  ArchitectureSpec,
  EngineSource,
  ProjectConfig,
  ScenarioPreset,
  SimulationInput,
  SimulationResult,
} from './types/simulator';
import { initUserInvalidValidationSync } from './utils/formValidationFallback';
import { parseScenarioFromUrl } from './utils/urlState';

type ViewTab = 'all' | 'config' | 'metrics' | 'advisor' | 'architectures' | 'qa';

export const App: React.FC = () => {
  const initialParsed = useMemo(() => {
    if (typeof window === 'undefined') {
      return parseScenarioFromUrl('');
    }
    return parseScenarioFromUrl(window.location.search);
  }, []);

  const [architectures, setArchitectures] = useState<ArchitectureSpec[]>(() =>
    getAllArchitectures()
  );
  const [scenarios, setScenarios] = useState<ScenarioPreset[]>(() => SCENARIOS_CATALOG);

  const [simInput, setSimInput] = useState<SimulationInput>(initialParsed.simInput);
  const [projectConfig, setProjectConfig] = useState<ProjectConfig>(initialParsed.projectConfig);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(
    initialParsed.scenarioId
  );
  const [loadedFromSharedUrl, setLoadedFromSharedUrl] = useState<boolean>(
    initialParsed.hasUrlParams
  );

  // Baseline oficial de referencia (Req. 3 y 5)
  const [baselineResult, setBaselineResult] = useState<SimulationResult>(() =>
    runFullSimulationLocal(DEFAULT_SIMULATION_INPUT, DEFAULT_PROJECT_CONFIG)
  );
  const [baselineLabel, setBaselineLabel] = useState<string>(
    'Referencia MVP Bogotá (U=35, G=30, N_p=30, I=1, $25 USD)'
  );

  const [simulationResult, setSimulationResult] = useState<SimulationResult>(() =>
    runFullSimulationLocal(initialParsed.simInput, initialParsed.projectConfig)
  );
  const [engineSource, setEngineSource] = useState<EngineSource>('local-ts');
  const [activeTab, setActiveTab] = useState<ViewTab>('all');

  const qrModalRef = useRef<ClassroomQRModalHandle>(null);

  // Inicializar sincronización ARIA y fallback :user-invalid (modern-web-guidance)
  useEffect(() => {
    return initUserInvalidValidationSync(document);
  }, []);

  // Cargar catálogo inicial desde contenedor FastAPI si está activo
  useEffect(() => {
    let active = true;
    fetchCatalogData().then((catalog) => {
      if (!active) return;
      setArchitectures(catalog.architectures);
      setScenarios(catalog.scenarios);
      setEngineSource(catalog.source);
    });
    return () => {
      active = false;
    };
  }, []);

  const validationErrors = useMemo(
    () => validateSimulationParameters(simInput, projectConfig),
    [simInput, projectConfig]
  );

  // Ejecutar simulación reactivamente solo cuando todas las entradas sean válidas (Req. 10)
  useEffect(() => {
    if (validationErrors.length > 0) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      executeSimulation(simInput, projectConfig).then(({ result, source }) => {
        if (cancelled) return;
        setSimulationResult(result);
        setEngineSource(source);
      });
    }, 90);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [simInput, projectConfig, validationErrors]);

  const handleSelectScenario = (preset: ScenarioPreset) => {
    const applied = applyScenarioPreset(preset, projectConfig);
    setSimInput(applied.simInput);
    setProjectConfig(applied.projectConfig);
    setActiveScenarioId(preset.id);
  };

  const handleManualSimInputChange = (next: SimulationInput) => {
    setSimInput(next);
    setActiveScenarioId(null);
  };

  const handlePinCurrentAsBaseline = () => {
    if (validationErrors.length > 0) return;
    setBaselineResult(simulationResult);
    setBaselineLabel(
      `Fijado (U=${simInput.concurrent_drivers}, G=${simInput.ocr_guides_per_driver}, N_p=${simInput.stops_per_route}, I=${simInput.compute_instances})`
    );
  };

  const handleResetBaselineToOfficial = () => {
    setBaselineResult(runFullSimulationLocal(DEFAULT_SIMULATION_INPUT, DEFAULT_PROJECT_CONFIG));
    setBaselineLabel('Referencia MVP Bogotá (U=35, G=30, N_p=30, I=1, $25 USD)');
  };

  const handleLoadFromValidationSuite = (
    nextInput: SimulationInput,
    nextConfig: ProjectConfig
  ) => {
    setSimInput(nextInput);
    setProjectConfig(nextConfig);
    setActiveScenarioId(null);
    setActiveTab('all');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearSharedUrlBanner = () => {
    setLoadedFromSharedUrl(false);
    if (typeof window !== 'undefined' && window.location.search) {
      window.history.replaceState({}, '', window.location.pathname);
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-inner">
          <div className="header-top">
            <div className="brand-group">
              <div className="brand-logo" aria-hidden="true">
                <Route size={24} />
              </div>
              <div>
                <h1 className="brand-title">EnRuta — Simulador de Arquitecturas de Software</h1>
                <p className="brand-subtitle">
                  Ingeniería Aplicada · Guía Actividad 9 · Universidad Libre (Bogotá D.C.)
                </p>
              </div>
            </div>

            <div className="header-actions">
              <div
                className={`engine-badge ${
                  engineSource === 'docker-fastapi'
                    ? 'engine-badge--docker'
                    : 'engine-badge--local'
                }`}
                title="Origen activo de evaluación matemática"
              >
                <span className="pulse-dot" aria-hidden="true" />
                <Cpu size={14} aria-hidden="true" />
                <span>
                  {engineSource === 'docker-fastapi'
                    ? 'Motor Activo: Contenedor Docker FastAPI'
                    : 'Motor Activo: WebAssembly/TS Client Engine (GitHub Pages)'}
                </span>
              </div>

              <button
                type="button"
                className="btn-qr-classroom"
                onClick={() => qrModalRef.current?.open()}
              >
                <QrCode size={17} aria-hidden="true" />
                📱 Mostrar QR para el Salón
              </button>
            </div>
          </div>

          {/* Navegación rápida Mobile-First */}
          <nav className="nav-tabs" aria-label="Secciones del simulador">
            {[
              { id: 'all' as ViewTab, label: 'Vista Completa', icon: Activity },
              { id: 'config' as ViewTab, label: '1. Proyecto y Carga', icon: Sliders },
              { id: 'metrics' as ViewTab, label: '2. Tabla y 4 Gráficas', icon: BarChart3 },
              { id: 'advisor' as ViewTab, label: '3. Recomendación SAW', icon: Award },
              { id: 'architectures' as ViewTab, label: '4. Arquitecturas y Docker', icon: Layers },
              { id: 'qa' as ViewTab, label: '5. Pruebas QA (CP-01..06)', icon: CheckSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`nav-tab ${activeTab === tab.id ? 'nav-tab--active' : ''}`}
                >
                  <Icon size={14} aria-hidden="true" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="app-main">
        {loadedFromSharedUrl && (
          <div className="url-shared-banner" role="status">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Share2 size={17} aria-hidden="true" />
              Escenario cargado automáticamente desde enlace compartido / Código QR (U=
              {simInput.concurrent_drivers}, G={simInput.ocr_guides_per_driver}, N_p=
              {simInput.stops_per_route}, I={simInput.compute_instances}).
            </span>
            <button type="button" className="btn btn-outline" onClick={clearSharedUrlBanner}>
              Entendido
            </button>
          </div>
        )}

        {activeTab === 'all' ? (
          <>
            <div className="workspace-grid">
              <div className="sidebar-stack">
                <SimulationControls
                  simInput={simInput}
                  scenarios={scenarios}
                  activeScenarioId={activeScenarioId}
                  baselineLabel={baselineLabel}
                  validationErrors={validationErrors}
                  onSimInputChange={handleManualSimInputChange}
                  onSelectScenario={handleSelectScenario}
                  onPinCurrentAsBaseline={handlePinCurrentAsBaseline}
                  onResetBaselineToOfficial={handleResetBaselineToOfficial}
                  projectConfig={projectConfig}
                />
                <ProjectConfigPanel
                  projectConfig={projectConfig}
                  onChange={setProjectConfig}
                />
              </div>

              <div className="content-stack">
                <MetricsComparison
                  result={simulationResult}
                  baselineResult={baselineResult}
                  baselineLabel={baselineLabel}
                />
                <DecisionAdvisor result={simulationResult} />
              </div>
            </div>

            <ArchitectureCards architectures={architectures} result={simulationResult} />
            <ValidationSuiteView
              engineSource={engineSource}
              onLoadScenarioIntoSimulator={handleLoadFromValidationSuite}
            />
          </>
        ) : (
          <div className="content-stack">
            {activeTab === 'config' && (
              <div className="workspace-grid">
                <SimulationControls
                  simInput={simInput}
                  scenarios={scenarios}
                  activeScenarioId={activeScenarioId}
                  baselineLabel={baselineLabel}
                  validationErrors={validationErrors}
                  onSimInputChange={handleManualSimInputChange}
                  onSelectScenario={handleSelectScenario}
                  onPinCurrentAsBaseline={handlePinCurrentAsBaseline}
                  onResetBaselineToOfficial={handleResetBaselineToOfficial}
                  projectConfig={projectConfig}
                />
                <ProjectConfigPanel
                  projectConfig={projectConfig}
                  onChange={setProjectConfig}
                />
              </div>
            )}
            {activeTab === 'metrics' && (
              <MetricsComparison
                result={simulationResult}
                baselineResult={baselineResult}
                baselineLabel={baselineLabel}
              />
            )}
            {activeTab === 'advisor' && <DecisionAdvisor result={simulationResult} />}
            {activeTab === 'architectures' && (
              <ArchitectureCards architectures={architectures} result={simulationResult} />
            )}
            {activeTab === 'qa' && (
              <ValidationSuiteView
                engineSource={engineSource}
                onLoadScenarioIntoSimulator={handleLoadFromValidationSuite}
              />
            )}
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div>
          <strong>EnRuta — Simulador de Decisiones de Arquitectura de Software</strong> · Ingeniería Aplicada (Actividad 9) · Universidad Libre
        </div>
        <div style={{ marginTop: 4, color: '#94a3b8' }}>
          Calibrado sobre literatura científica: Sunardi &amp; Suharjito (2019), Tapia et al. (2020), Blinowski et al. (2022) y Al-Debagy &amp; Martinek (2018).
        </div>
      </footer>

      <ClassroomQRModal
        ref={qrModalRef}
        simInput={simInput}
        projectConfig={projectConfig}
        activeScenarioId={activeScenarioId}
      />
    </>
  );
};

export default App;
