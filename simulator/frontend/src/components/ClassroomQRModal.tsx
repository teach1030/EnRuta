import React, { useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy, ExternalLink, Globe, QrCode, Smartphone, X } from 'lucide-react';
import { ProjectConfig, SimulationInput } from '../types/simulator';
import { OFFICIAL_GITHUB_PAGES_URL, buildShareableScenarioUrl } from '../utils/urlState';

export interface ClassroomQRModalHandle {
  open: () => void;
  close: () => void;
}

interface ClassroomQRModalProps {
  simInput: SimulationInput;
  projectConfig: ProjectConfig;
  activeScenarioId: string | null;
}

export const ClassroomQRModal = React.forwardRef<
  ClassroomQRModalHandle,
  ClassroomQRModalProps
>(({ simInput, projectConfig, activeScenarioId }, ref) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  const [targetHost, setTargetHost] = useState<'github-pages' | 'current-origin'>('github-pages');
  const [includeScenarioParams, setIncludeScenarioParams] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useImperativeHandle(ref, () => ({
    open: () => {
      setCopied(false);
      dialogRef.current?.showModal();
    },
    close: () => {
      dialogRef.current?.close();
    },
  }));

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

  const currentOriginUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}${window.location.pathname}`
      : OFFICIAL_GITHUB_PAGES_URL;

  const selectedBaseUrl =
    targetHost === 'github-pages' ? OFFICIAL_GITHUB_PAGES_URL : currentOriginUrl;

  const qrEncodedUrl = buildShareableScenarioUrl(
    selectedBaseUrl,
    simInput,
    projectConfig,
    activeScenarioId,
    includeScenarioParams
  );

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(qrEncodedUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby={titleId}
      className="modern-dialog"
    >
      <div className="dialog-body">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '0.75rem',
            borderBottom: '1px solid #e2e8f0',
            paddingBottom: '0.7rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
            <QrCode size={22} color="#065f46" aria-hidden="true" />
            <div>
              <h2 id={titleId} style={{ margin: 0, fontSize: '1.08rem', fontWeight: 800 }}>
                Acceso Móvil en Vivo — Salón de Clase
              </h2>
              <div style={{ fontSize: '0.76rem', color: '#475569' }}>
                Escanea con la cámara del celular para abrir el Simulador de EnRuta
              </div>
            </div>
          </div>

          <form method="dialog" style={{ margin: 0 }}>
            <button type="submit" className="btn btn-soft" aria-label="Cerrar modal de código QR">
              <X size={16} aria-hidden="true" />
            </button>
          </form>
        </div>

        {/* Selector de Destino: GitHub Pages Público vs URL Actual */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <button
            type="button"
            className={`btn ${targetHost === 'github-pages' ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setTargetHost('github-pages')}
            style={{ fontSize: '0.78rem' }}
          >
            <Globe size={15} aria-hidden="true" />
            GitHub Pages Público
          </button>
          <button
            type="button"
            className={`btn ${targetHost === 'current-origin' ? 'btn-primary' : 'btn-soft'}`}
            onClick={() => setTargetHost('current-origin')}
            style={{ fontSize: '0.78rem' }}
          >
            <Smartphone size={15} aria-hidden="true" />
            URL Actual del Navegador
          </button>
        </div>

        {/* Switch para incluir parámetros de la corrida actual */}
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            padding: '0.6rem 0.8rem',
            borderRadius: 10,
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            cursor: 'pointer',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: '#064e3b',
          }}
        >
          <input
            type="checkbox"
            checked={includeScenarioParams}
            onChange={(e) => setIncludeScenarioParams(e.target.checked)}
            style={{ width: 17, height: 17, accentColor: '#065f46' }}
          />
          <span>
            Incluir parámetros del escenario actual en el QR (U={simInput.concurrent_drivers}, G=
            {simInput.ocr_guides_per_driver}, N_p={simInput.stops_per_route}, I=
            {simInput.compute_instances})
          </span>
        </label>

        {/* Contenedor 1:1 para evitar CLS (modern-web-guidance: responsive-design) */}
        <div className="qr-stage">
          <QRCodeSVG
            value={qrEncodedUrl}
            size={256}
            level="M"
            bgColor="#FFFFFF"
            fgColor="#064E3B"
            style={{ width: '100%', height: '100%' }}
            title="Código QR hacia el Simulador Arquitectónico de EnRuta"
          />
        </div>

        <div
          style={{
            padding: '0.6rem 0.75rem',
            borderRadius: 8,
            background: '#f8fafc',
            border: '1px solid #cbd5e1',
            fontSize: '0.74rem',
            wordBreak: 'break-all',
            color: '#334155',
            fontFamily: 'monospace',
          }}
        >
          {qrEncodedUrl}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.55rem', justifyContent: 'space-between' }}>
          <button type="button" className="btn btn-primary" onClick={handleCopyUrl} style={{ flex: 1 }}>
            {copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}
            {copied ? '¡Enlace copiado!' : 'Copiar enlace compartible'}
          </button>
          <a
            href={qrEncodedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-outline"
            style={{ textDecoration: 'none' }}
          >
            Abrir <ExternalLink size={15} aria-hidden="true" />
          </a>
        </div>
      </div>
    </dialog>
  );
});

ClassroomQRModal.displayName = 'ClassroomQRModal';
