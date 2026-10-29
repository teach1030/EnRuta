import React, { useEffect, useId, useRef, useState } from 'react';
import { BookOpen, Calculator, Code2, Container, Copy, Check, Server, X } from 'lucide-react';
import { ArchitectureId, ArchitectureSpec, SimulationResult } from '../types/simulator';
import { ARCH_BG_TINTS, ARCH_COLORS } from '../utils/archTheme';

interface ArchitectureCardsProps {
  architectures: ArchitectureSpec[];
  result: SimulationResult;
}

const SIMULATOR_DOCKER_COMPOSE = `# simulator/docker-compose.yml — Orquestación Multi-Contenedor del Simulador EnRuta
services:
  sim-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: enruta-sim-api
    expose:
      - "8000"
    ports:
      - "\${API_PORT:-8000}:8000"
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/health', timeout=3)"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - enruta-sim-net

  sim-frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      args:
        VITE_PUBLIC_URL: "\${PUBLIC_GITHUB_PAGES_URL:-https://teach1030.github.io/EnRuta/}"
    container_name: enruta-sim-web
    ports:
      - "\${SIM_PORT:-8080}:80"
    depends_on:
      sim-backend:
        condition: service_healthy
    networks:
      - enruta-sim-net

  sim-qa-tests:
    build:
      context: ./backend
      dockerfile: Dockerfile
    container_name: enruta-sim-qa
    profiles: ["qa"]
    command: pytest -v --tb=short
    networks:
      - enruta-sim-net

networks:
  enruta-sim-net:
    driver: bridge`;

export const ArchitectureCards: React.FC<ArchitectureCardsProps> = ({
  architectures,
  result,
}) => {
  const sectionId = useId();
  const composeTitleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const [selectedComposeKey, setSelectedComposeKey] = useState<'SIMULATOR' | ArchitectureId>(
    'MICRO_DOCKER'
  );
  const [copied, setCopied] = useState(false);

  // Fallback obligatorio de `light-dismiss-a-dialog` (modern-web-guidance)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const handleBackdropClick = (event: MouseEvent) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        dialog.close();
      };
      dialog.addEventListener('click', handleBackdropClick);
      return () => dialog.removeEventListener('click', handleBackdropClick);
    }
  }, []);

  const openComposeModal = (key: 'SIMULATOR' | ArchitectureId) => {
    setSelectedComposeKey(key);
    setCopied(false);
    dialogRef.current?.showModal();
  };

  const activeSnippet =
    selectedComposeKey === 'SIMULATOR'
      ? SIMULATOR_DOCKER_COMPOSE
      : architectures.find((a) => a.id === selectedComposeKey)?.sample_compose_snippet ?? '';

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(activeSnippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="panel-card" aria-labelledby={sectionId}>
      <div className="panel-header">
        <div>
          <div className="panel-title-wrap">
            <span className="panel-step-badge">Req. 2, 4 y 9</span>
            <h2 id={sectionId} className="panel-title">
              Catálogo de las 4 Arquitecturas de EnRuta, Topologías Docker y Ecuaciones en Vivo
            </h2>
          </div>
          <p className="panel-subtitle">
            Mapeo real a los módulos Python/React Native de EnRuta, manifiestos declarativos y auditoría matemática transparente.
          </p>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => openComposeModal('SIMULATOR')}
        >
          <Container size={16} aria-hidden="true" />
          Ver docker-compose.yml del Simulador
        </button>
      </div>

      {/* Fichas de las 4 Arquitecturas */}
      <div className="arch-cards-grid" style={{ marginBottom: '1.35rem' }}>
        {architectures.map((spec) => {
          const metrics = result.architectures.find((m) => m.id === spec.id)!;
          const fb = metrics.formula_breakdown;

          return (
            <article
              key={spec.id}
              style={{
                borderRadius: 14,
                border: `1.5px solid ${ARCH_COLORS[spec.id]}`,
                background: '#ffffff',
                padding: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  background: ARCH_BG_TINTS[spec.id],
                  padding: '0.7rem 0.85rem',
                  borderRadius: 10,
                  display: 'flex',
                  flexWrap: 'wrap',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 800, color: ARCH_COLORS[spec.id] }}>
                    {spec.id} · Ranking actual #{metrics.rank}
                  </div>
                  <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 800, color: '#0f172a' }}>
                    {spec.name}
                  </h3>
                </div>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => openComposeModal(spec.id)}
                  style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                >
                  <Code2 size={14} aria-hidden="true" />
                  Ver Manifiesto / Compose
                </button>
              </div>

              <p style={{ margin: 0, fontSize: '0.8rem', color: '#334155', lineHeight: 1.48 }}>
                {spec.description}
              </p>

              <div
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  fontSize: '0.76rem',
                  color: '#334155',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a', marginBottom: 3, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Server size={13} aria-hidden="true" />
                  Mapeo a Módulos Reales de EnRuta (<code>backend/app/</code> y <code>mobile/</code>):
                </div>
                <div>{spec.enruta_mapping}</div>
              </div>

              <div
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 8,
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  fontSize: '0.75rem',
                  color: '#14532d',
                }}
              >
                <strong>Topología de Contenedores ({spec.containers_per_instance} cont./instancia):</strong>{' '}
                {spec.docker_topology_summary}
              </div>

              {/* Auditoría Matemática en Vivo (formula_breakdown) */}
              <details
                style={{
                  borderRadius: 8,
                  border: '1px solid #cbd5e1',
                  padding: '0.55rem 0.75rem',
                  background: '#f8fafc',
                  fontSize: '0.75rem',
                }}
              >
                <summary style={{ cursor: 'pointer', fontWeight: 800, color: '#0f172a' }}>
                  <Calculator size={13} style={{ verticalAlign: 'middle', marginRight: 5 }} />
                  Ver Desglose Matemático en Vivo (<code>formula_breakdown</code>)
                </summary>
                <div
                  style={{
                    marginTop: '0.55rem',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                    gap: '0.35rem 0.65rem',
                    fontFamily: 'monospace',
                    color: '#1e293b',
                  }}
                >
                  <div>λ_crud = {fb.lambda_crud} req/s</div>
                  <div>λ_ocr_cloud = {fb.lambda_ocr_cloud} req/s</div>
                  <div>λ_tsp = {fb.lambda_tsp} req/s</div>
                  <div>φ_tsp (OR-Tools) = {fb.phi_tsp}x</div>
                  <div>Demanda = {fb.demand_units} u/s</div>
                  <div>Capacidad = {fb.capacity_units} u/s</div>
                  <div>Utilización ρ = {fb.utilization_pct}%</div>
                  <div>Cola M/G/1 = {fb.queue_multiplier}x</div>
                  <div>Servicio τ = {fb.weighted_service_ms} ms</div>
                  <div>IPC Red = {fb.ipc_ms} ms</div>
                  <div>Cold Start = {fb.cold_start_ms} ms</div>
                  <div>Over-scale = {fb.over_scale_factor}</div>
                </div>
              </details>

              {/* Referencias Científicas */}
              <div style={{ fontSize: '0.73rem', color: '#475569' }}>
                <div style={{ fontWeight: 800, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <BookOpen size={13} aria-hidden="true" /> Sustento en Literatura Científica:
                </div>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {spec.paper_references.map((ref, idx) => (
                    <li key={idx}>{ref}</li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      {/* Modal Nativo <dialog closedby="any"> para Inspeccionar Docker Compose */}
      <dialog
        ref={dialogRef}
        {...({ closedby: 'any' } as Record<string, string>)}
        aria-labelledby={composeTitleId}
        className="modern-dialog modern-dialog--wide"
      >
        <div className="dialog-body">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              borderBottom: '1px solid #e2e8f0',
              paddingBottom: '0.65rem',
            }}
          >
            <h3 id={composeTitleId} style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>
              Visor de Topología Declarativa Docker / Cloud
            </h3>
            <form method="dialog" style={{ margin: 0 }}>
              <button type="submit" className="btn btn-soft" aria-label="Cerrar visor">
                <X size={16} aria-hidden="true" /> Cerrar
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
            <button
              type="button"
              className={`btn ${selectedComposeKey === 'SIMULATOR' ? 'btn-primary' : 'btn-soft'}`}
              onClick={() => setSelectedComposeKey('SIMULATOR')}
              style={{ fontSize: '0.76rem', padding: '0.38rem 0.65rem' }}
            >
              Simulador (docker-compose.yml)
            </button>
            {architectures.map((a) => (
              <button
                key={a.id}
                type="button"
                className={`btn ${selectedComposeKey === a.id ? 'btn-primary' : 'btn-soft'}`}
                onClick={() => setSelectedComposeKey(a.id)}
                style={{ fontSize: '0.76rem', padding: '0.38rem 0.65rem' }}
              >
                {a.short_name}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleCopySnippet}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                fontSize: '0.73rem',
                padding: '0.3rem 0.6rem',
                background: '#ffffff',
              }}
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
              {copied ? 'Copiado' : 'Copiar YAML'}
            </button>
            <pre className="code-block">{activeSnippet}</pre>
          </div>
        </div>
      </dialog>
    </section>
  );
};
