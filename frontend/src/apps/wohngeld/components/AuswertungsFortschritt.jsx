import { useEffect, useState } from 'react';
import { theme } from '../../../config/theme';
import { CheckIcon, RefreshIcon, AlertTriangleIcon } from '../../../components/Icons';
import { ACCENT, ACCENT_LIGHT } from '../api';
import { FORTSCHRITT_PHASEN, anteil, fortschrittVon, istHaengend, laufzeit } from '../fortschritt';

/** Sekundentakt für die Laufzeit-Anzeige. */
function useJetzt(aktiv) {
  const [jetzt, setJetzt] = useState(() => Date.now());
  useEffect(() => {
    if (!aktiv) return undefined;
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, [aktiv]);
  return jetzt;
}

function Balken({ wert }) {
  return (
    <div style={styles.balken} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={wert == null ? undefined : Math.round(wert * 100)}>
      <div style={{ ...styles.balkenFuellung, ...(wert == null ? styles.balkenUnbestimmt : { width: `${Math.round(wert * 100)}%` }) }} />
    </div>
  );
}

/** Kurzanzeige für Tabellenzeilen: aktueller Schritt + Balken. */
export function FortschrittKurz({ eingang }) {
  const f = fortschrittVon(eingang);
  const haengt = istHaengend(eingang);
  if (haengt) return <div style={{ ...styles.kurzText, color: theme.colors.warning }}>Keine Rückmeldung — erneut starten</div>;
  if (!f) return null;
  return (
    <div style={styles.kurz}>
      <div style={styles.kurzText}>{f.text}</div>
      <Balken wert={anteil(f)} />
    </div>
  );
}

/** Schrittliste für die Detailseite. */
export default function AuswertungsFortschritt({ eingang }) {
  const f = fortschrittVon(eingang);
  const haengt = istHaengend(eingang);
  const jetzt = useJetzt(!haengt);
  const aktuellIdx = Math.max(0, FORTSCHRITT_PHASEN.findIndex((p) => p.phase === (f?.phase || 'wartet')));

  if (haengt) {
    return (
      <div style={styles.hinweis}>
        <AlertTriangleIcon size={16} color={theme.colors.warning} />
        <span>Die Auswertung meldet sich seit über 10 Minuten nicht mehr (z. B. nach einem Neustart). Bitte erneut starten.</span>
      </div>
    );
  }

  return (
    <div style={styles.box} aria-live="polite">
      <div style={styles.kopf}>
        <span style={styles.titel}>Auswertung läuft</span>
        <span style={styles.zeit}>{laufzeit(f, jetzt)}{f?.dateienGesamt > 1 ? ` · Datei ${f.dateiNr} von ${f.dateienGesamt}` : ''}</span>
      </div>
      <ol style={styles.liste}>
        {FORTSCHRITT_PHASEN.filter((p) => p.phase !== 'wartet' || aktuellIdx === 0).map((p) => {
          const idx = FORTSCHRITT_PHASEN.findIndex((x) => x.phase === p.phase);
          const status = idx < aktuellIdx ? 'fertig' : idx === aktuellIdx ? 'aktiv' : 'offen';
          return (
            <li key={p.phase} style={styles.schritt}>
              <span style={{ ...styles.punkt, ...(status === 'fertig' ? styles.punktFertig : status === 'aktiv' ? styles.punktAktiv : {}) }}>
                {status === 'fertig' ? <CheckIcon size={11} color="#fff" /> : status === 'aktiv' ? <RefreshIcon size={11} color={ACCENT} /> : null}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ ...styles.schrittLabel, ...(status === 'offen' ? { color: theme.colors.textMuted } : {}) }}>{p.label}</div>
                {status === 'aktiv' && f && (
                  <>
                    <div style={styles.schrittText}>{f.text}</div>
                    <Balken wert={anteil(f)} />
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div style={styles.fuss}>Sie können die Seite verlassen — die Auswertung läuft weiter.</div>
    </div>
  );
}

const styles = {
  box: { display: 'grid', gap: theme.spacing.md },
  kopf: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.spacing.sm, flexWrap: 'wrap' },
  titel: { fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  zeit: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontVariantNumeric: 'tabular-nums' },
  liste: { listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: theme.spacing.sm },
  schritt: { display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start' },
  punkt: { width: 18, height: 18, borderRadius: theme.borderRadius.full, border: `1px solid ${theme.colors.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, backgroundColor: theme.colors.surface },
  punktFertig: { backgroundColor: theme.colors.success, borderColor: theme.colors.success },
  punktAktiv: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT },
  schrittLabel: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  schrittText: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, margin: '2px 0 6px' },
  balken: { height: 6, borderRadius: theme.borderRadius.full, backgroundColor: theme.colors.surfaceHover, overflow: 'hidden', maxWidth: 360, position: 'relative' },
  balkenFuellung: { height: '100%', backgroundColor: ACCENT, borderRadius: theme.borderRadius.full, transition: `width ${theme.transitions.fast}` },
  balkenUnbestimmt: { width: '35%', animation: 'wg-fortschritt 1.4s ease-in-out infinite' },
  fuss: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  kurz: { display: 'grid', gap: 4, marginTop: 4, minWidth: 160 },
  kurzText: { fontSize: '0.72rem', color: theme.colors.textMuted },
  hinweis: { display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start', fontSize: theme.typography.sizes.sm, color: theme.colors.text },
};
