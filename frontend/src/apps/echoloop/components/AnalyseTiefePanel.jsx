import { theme } from '../../../config/theme';
import { ANALYSE_TIEFEN, INPUT_INVENTAR } from '../api';

/**
 * Analyse-Tiefe-Deklaration (Seite-1-Prinzip): welche Tiefe (T-A/B/C) trägt der
 * Bericht, aus welchem Input-Inventar (I1–I6)? Controlled:
 *   props.tiefe        'T-A' | 'T-B' | 'T-C'
 *   props.inventar     { I1:true, I2:false, … }
 *   props.onChange({ tiefe, inventar })
 *   props.readOnly
 * Regel: der Bericht verspricht nie mehr, als seine Tiefe trägt. T-B ist Pflicht,
 * wo Betriebsdaten (I2) existieren.
 */
const PURPLE = '#452C71';

// getragene Tiefe aus dem Inventar (spiegelt maxTiefe im Backend).
function maxTiefe(inv) {
  if (!inv.I1) return null;
  if (inv.I2 && inv.I5 && inv.I6) return 'T-C';
  if (inv.I2) return 'T-B';
  return 'T-A';
}
const RANK = { 'T-A': 1, 'T-B': 2, 'T-C': 3 };

const styles = {
  wrap: {
    display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface,
  },
  head: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' },
  tiefen: { display: 'flex', gap: theme.spacing.xs },
  tBtn: {
    padding: `4px ${theme.spacing.md}`, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`,
    background: theme.colors.surfaceHover, color: theme.colors.textMuted, cursor: 'pointer',
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold,
  },
  verspricht: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, fontStyle: 'italic' },
  inv: { display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' },
  chk: { display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', color: theme.colors.textSecondary, cursor: 'pointer' },
  warn: { fontSize: '0.72rem', color: theme.colors.warning, lineHeight: 1.4 },
};

export default function AnalyseTiefePanel({ tiefe = 'T-A', inventar = {}, onChange, readOnly = false }) {
  const getragen = maxTiefe(inventar);
  const uebertrieben = getragen && RANK[tiefe] > RANK[getragen];
  const tbPflicht = inventar.I2 && tiefe === 'T-A';
  const versprichtText = ANALYSE_TIEFEN.find((t) => t.key === tiefe)?.verspricht;

  const setTiefe = (t) => !readOnly && onChange?.({ tiefe: t, inventar });
  const toggleInv = (k, v) => !readOnly && onChange?.({ tiefe, inventar: { ...inventar, [k]: v } });

  return (
    <div style={styles.wrap}>
      <div style={styles.head}>
        <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.semibold, textTransform: 'uppercase', letterSpacing: '0.03em' }}>Analyse-Tiefe</span>
        <div style={styles.tiefen}>
          {ANALYSE_TIEFEN.map((t) => {
            const active = t.key === tiefe;
            return (
              <button key={t.key} type="button" disabled={readOnly} onClick={() => setTiefe(t.key)}
                style={{ ...styles.tBtn, ...(active ? { background: PURPLE, color: '#fff', borderColor: PURPLE } : {}) }}>
                {t.label}
              </button>
            );
          })}
        </div>
        {versprichtText && <span style={styles.verspricht}>{versprichtText}</span>}
      </div>

      <div style={styles.inv}>
        {INPUT_INVENTAR.map((i) => (
          <label key={i.key} style={styles.chk}>
            <input type="checkbox" checked={!!inventar[i.key]} disabled={readOnly}
              onChange={(e) => toggleInv(i.key, e.target.checked)} style={{ accentColor: PURPLE }} />
            {i.key} {i.label}
          </label>
        ))}
      </div>

      {uebertrieben && (
        <div style={styles.warn}>⚠ Deklariert {tiefe}, getragen nur {getragen} — der Bericht darf nicht mehr versprechen, als die Tiefe trägt.</div>
      )}
      {tbPflicht && (
        <div style={styles.warn}>⚠ Betriebsdaten (I2) vorhanden → T-B ist Pflicht (Verdacht → Beweis + Quantifizierung).</div>
      )}
    </div>
  );
}
