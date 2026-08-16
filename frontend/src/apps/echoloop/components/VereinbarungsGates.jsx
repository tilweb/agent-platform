import { theme } from '../../../config/theme';
import { GATE_STATUS_META } from '../api';

/**
 * Zwei-Naturen: die vier Vereinbarungs-Gates (D6-L3/D7-L4/D9-L4/D10-L2) mit
 * Doppel-Nachweis (T-A Statik + T-B/T-C gelebt). Controlled:
 *   props.gates          Bewertung vom Backend (bewerteVereinbarungsGates)
 *   props.nachweise      { 'D6-L3': {statik,gelebt}, … }
 *   props.onChange(nw)   bei Toggle
 *   props.readOnly
 * Skalierung (L4–L5) wird VEREINBART, nicht gebaut — die Gates zeigen den Träger.
 */
const TON = {
  ok: theme.colors.success,
  err: theme.colors.error,
  warn: theme.colors.warning,
  mut: theme.colors.textMuted,
};

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  hint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs, lineHeight: 1.4 },
  row: {
    display: 'flex', alignItems: 'flex-start', gap: theme.spacing.md, padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface,
  },
  gateId: { fontWeight: theme.typography.weights.bold, color: theme.colors.text, fontSize: theme.typography.sizes.sm, minWidth: 56 },
  mid: { flex: 1, minWidth: 0 },
  fordert: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, lineHeight: 1.4 },
  hinweis: { fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: 3, lineHeight: 1.35 },
  badge: {
    fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.semibold, whiteSpace: 'nowrap',
  },
  toggles: { display: 'flex', gap: theme.spacing.md, marginTop: 6 },
  toggle: { display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.7rem', color: theme.colors.textSecondary, cursor: 'pointer' },
};

const PURPLE = '#452C71';

export default function VereinbarungsGates({ gates = [], nachweise = {}, onChange, readOnly = false }) {
  const setNw = (id, patch) => {
    if (readOnly) return;
    onChange?.({ ...nachweise, [id]: { ...(nachweise[id] || {}), ...patch } });
  };

  if (!gates.length) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.hint}>
        Ab der Skalierungs-Stufe (L4–L5) baut die Organisation mit — diese Gates sind Vereinbarungen, keine reinen Bau-Aufgaben.
        Doppel-Nachweis: <strong>Statik</strong> (im Export sichtbar) + <strong>gelebt</strong> (Stand aktuell, Owner benannt, Protokoll wird geschrieben).
      </div>
      {gates.map((g) => {
        const meta = GATE_STATUS_META[g.status] || GATE_STATUS_META.nicht_relevant;
        const ton = TON[meta.ton];
        const nw = nachweise[g.id] || {};
        const relevant = g.status !== 'nicht_relevant';
        return (
          <div key={g.id} style={{ ...styles.row, opacity: relevant ? 1 : 0.55 }}>
            <div style={styles.gateId}>{g.id}</div>
            <div style={styles.mid}>
              <div style={styles.fordert}>{g.fordert}</div>
              {g.hinweis && <div style={styles.hinweis}>{g.hinweis}</div>}
              {relevant && (
                <div style={styles.toggles}>
                  <label style={styles.toggle}>
                    <input type="checkbox" checked={!!nw.statik} disabled={readOnly}
                      onChange={(e) => setNw(g.id, { statik: e.target.checked })} style={{ accentColor: PURPLE }} />
                    Statik (T-A)
                  </label>
                  <label style={styles.toggle}>
                    <input type="checkbox" checked={!!nw.gelebt} disabled={readOnly}
                      onChange={(e) => setNw(g.id, { gelebt: e.target.checked })} style={{ accentColor: PURPLE }} />
                    gelebt (T-B/T-C)
                  </label>
                </div>
              )}
            </div>
            <span style={{ ...styles.badge, backgroundColor: `${ton}22`, color: ton }}>{meta.label}</span>
          </div>
        );
      })}
    </div>
  );
}
