/**
 * VerarbeitungsHinweis — erscheint in Posteingang-Ansichten, wenn Dokumente angenommen werden, die Verarbeitung
 * aber gerade nicht läuft (Betrieb mit eigenem Verarbeitungsprozess, der nicht erreichbar ist). Nichts geht
 * verloren: Die Aufträge warten und werden abgearbeitet, sobald die Verarbeitung wieder läuft.
 */

import { useEffect, useState } from 'react';
import { theme } from '../config/theme';
import { apiGet } from '../utils/apiFetch';

const styles = {
  banner: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  icon: { flexShrink: 0 },
};

const PAUSE_MS = 30_000;

export default function VerarbeitungsHinweis({ style }) {
  const [stand, setStand] = useState(null);

  useEffect(() => {
    let aktiv = true;
    const lade = () => apiGet('/extraction/verarbeitung')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (aktiv) setStand(d); })
      .catch(() => {});
    lade();
    const t = setInterval(lade, PAUSE_MS);
    return () => { aktiv = false; clearInterval(t); };
  }, []);

  if (!stand || stand.modus !== 'extern' || stand.workerAktiv !== false) return null;
  return (
    <div style={{ ...styles.banner, ...style }} role="status">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={styles.icon}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      <span>
        Die Auswertung läuft gerade nicht. Neue Dokumente werden angenommen und ausgewertet, sobald sie wieder läuft
        {stand.offeneJobs > 0 ? ` (${stand.offeneJobs} ${stand.offeneJobs === 1 ? 'Auftrag wartet' : 'Aufträge warten'})` : ''}.
      </span>
    </div>
  );
}
