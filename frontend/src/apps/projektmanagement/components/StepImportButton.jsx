/**
 * StepImportButton — step-bezogener, additiver Dokument-Import im
 * Projektauftrag-Wizard. Lädt Dokument(e) hoch, extrahiert NUR die Felder des
 * aktuellen Steps (Backend) und übergibt sie an onMerge — dort werden sie
 * additiv in den Live-State gemischt (Listen anhängen, Skalare nur wenn leer).
 */

import { useRef, useState } from 'react';
import { theme } from '../../../config/theme';
import { API_URL } from '../../../utils/apiFetch';

const ACCEPT_STRING = [
  '.pdf', '.docx', '.doc', '.xlsx', '.xls', '.pptx', '.ppt',
  '.png', '.jpg', '.jpeg', '.webp', '.txt', '.md',
].join(',');

const PHASE_LABEL = {
  vision: 'Bild wird analysiert…',
  markitdown: 'Dokument wird konvertiert…',
  extracting: 'Daten werden extrahiert…',
};

async function* sseReader(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      const ev = { event: 'message', data: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) ev.event = line.slice(6).trim();
        else if (line.startsWith('data:')) ev.data += line.slice(5).trim();
      }
      if (ev.data) {
        try { yield { type: ev.event, data: JSON.parse(ev.data) }; } catch { /* ignore */ }
      }
    }
  }
}

const styles = {
  wrap: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap' },
  button: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent', color: theme.colors.textSecondary, cursor: 'pointer',
  },
  status: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  error: { fontSize: theme.typography.sizes.xs, color: theme.colors.error },
  ok: { fontSize: theme.typography.sizes.xs, color: theme.colors.success },
};

function StepImportButton({ step, onMerge, disabled = false }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    if (inputRef.current) inputRef.current.value = '';
    if (files.length === 0) return;

    setBusy(true); setError(null); setResult(null); setStatus('Vorbereitung…');
    try {
      const formData = new FormData();
      for (const f of files) formData.append('files', f);

      const response = await fetch(`${API_URL}/apps/projektmanagement/projektauftraege/import-step/${step}`, {
        method: 'POST', credentials: 'include', body: formData,
      });
      if (!response.ok || !response.body) {
        let msg = 'Import fehlgeschlagen';
        try { const d = await response.json(); msg = d.error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }

      let extracted = null;
      let errMsg = null;
      for await (const ev of sseReader(response)) {
        switch (ev.type) {
          case 'file_started':
            setStatus(ev.data.kind === 'image' ? PHASE_LABEL.vision : PHASE_LABEL.markitdown);
            break;
          case 'extracting_started':
            setStatus(PHASE_LABEL.extracting);
            break;
          case 'extracting_progress':
            setStatus(`${PHASE_LABEL.extracting} (${Math.round((ev.data.elapsedMs || 0) / 1000)}s)`);
            break;
          case 'step_extracted':
            extracted = ev.data.extracted || {};
            break;
          case 'error':
            errMsg = ev.data.message || 'Import fehlgeschlagen';
            break;
          default:
            break;
        }
      }
      if (errMsg) throw new Error(errMsg);
      if (!extracted) throw new Error('Keine Daten extrahiert');

      const summary = onMerge ? onMerge(extracted) : null;
      setResult(summary || 'Import übernommen');
      setStatus(null);
    } catch (err) {
      console.error('Step import failed:', err);
      setError(err.message || 'Import fehlgeschlagen');
      setStatus(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.wrap}>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_STRING}
        style={{ display: 'none' }}
        onChange={handleFiles}
      />
      <button
        type="button"
        style={{ ...styles.button, opacity: busy || disabled ? 0.6 : 1, cursor: busy || disabled ? 'default' : 'pointer' }}
        onClick={() => !busy && !disabled && inputRef.current?.click()}
        disabled={busy || disabled}
        title="Daten aus Dokument(en) extrahieren und additiv ergänzen"
      >
        ⭳ Aus Dokument importieren
      </button>
      {busy && status && <span style={styles.status}>{status}</span>}
      {!busy && result && <span style={styles.ok}>✓ {result}</span>}
      {!busy && error && <span style={styles.error}>⚠ {error}</span>}
    </div>
  );
}

export default StepImportButton;
