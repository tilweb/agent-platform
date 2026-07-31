import { theme } from '../../../config/theme';
import { DIMENSIONEN, LEVEL_COLORS, LEVEL_TEXT } from '../api';

/**
 * Interaktives Soll-Profil-/Review-Instrument (D-062). Controlled:
 *   props.dimensionen  { d1..d10,d6b: {ist,soll,relevanz,beleg,konfidenz,maskeGrund} }
 *   props.begruendung  LLM-Vor-Benotungs-Begründungen je Dim (Entwurf, read-only Hinweis)
 *   props.onChange(dims)  bei jeder Änderung
 *   props.readOnly     true bei freigegebenem Baustand
 * Level 0-5 als Lila-Rampe (Design-System §57). Maskierte Dimensionen ausgegraut.
 */
const PURPLE = '#452C71';

const styles = {
  table: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm },
  th: {
    textAlign: 'left', padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    color: theme.colors.textMuted, fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.xs, borderBottom: `1px solid ${theme.colors.border}`,
    textTransform: 'uppercase', letterSpacing: '0.03em',
  },
  td: { padding: `${theme.spacing.sm} ${theme.spacing.md}`, borderBottom: `1px solid ${theme.colors.borderLight}`, verticalAlign: 'middle' },
  dimName: { fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  dimHint: { fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: 2, maxWidth: 260, lineHeight: 1.35 },
  levelRow: { display: 'flex', gap: 3 },
  chip: {
    width: 22, height: 22, borderRadius: theme.borderRadius.sm, border: 'none', cursor: 'pointer',
    fontSize: '0.7rem', fontWeight: theme.typography.weights.semibold, display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  belegInput: {
    width: '100%', minWidth: 120, padding: `4px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.xs,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none',
  },
  select: {
    padding: `4px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.xs,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer',
  },
  relToggle: { display: 'flex', alignItems: 'center', gap: 4, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, cursor: 'pointer' },
};

function LevelPicker({ value, onChange, disabled, dimmed }) {
  return (
    <div style={styles.levelRow}>
      {[0, 1, 2, 3, 4, 5].map((lvl) => {
        const active = value === lvl;
        return (
          <button
            key={lvl}
            type="button"
            disabled={disabled}
            onClick={() => !disabled && onChange(lvl)}
            title={`Level ${lvl}`}
            style={{
              ...styles.chip,
              cursor: disabled ? 'default' : 'pointer',
              opacity: dimmed ? 0.4 : 1,
              backgroundColor: active ? LEVEL_COLORS[lvl] : theme.colors.surfaceHover,
              color: active ? LEVEL_TEXT[lvl] : theme.colors.textMuted,
              outline: active ? `2px solid ${PURPLE}` : 'none',
            }}
          >
            {lvl}
          </button>
        );
      })}
    </div>
  );
}

export default function ReifegradPanel({ dimensionen = {}, begruendung = {}, onChange, readOnly = false }) {
  const setDim = (key, patch) => {
    if (readOnly) return;
    const next = { ...dimensionen, [key]: { ...(dimensionen[key] || { ist: 0, soll: 0, relevanz: 1 }), ...patch } };
    onChange?.(next);
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Dimension</th>
            <th style={styles.th}>Ist</th>
            <th style={styles.th}>Soll</th>
            <th style={styles.th}>Relevant</th>
            <th style={styles.th}>Beleg</th>
            <th style={styles.th}>Konfidenz</th>
          </tr>
        </thead>
        <tbody>
          {DIMENSIONEN.map(({ key, label }) => {
            const d = dimensionen[key] || { ist: 0, soll: 0, relevanz: 1 };
            const maskiert = d.relevanz === 0;
            const rowBg = maskiert ? theme.colors.surfaceHover : 'transparent';
            return (
              <tr key={key} style={{ backgroundColor: rowBg }}>
                <td style={styles.td}>
                  <div style={styles.dimName}>
                    {key.toUpperCase()} · {label}
                    {maskiert && <span style={{ color: theme.colors.textMuted, fontWeight: 400 }}> (nicht relevant)</span>}
                  </div>
                  {begruendung[key] && <div style={styles.dimHint}>💬 {begruendung[key]}</div>}
                </td>
                <td style={styles.td}>
                  <LevelPicker value={d.ist} disabled={readOnly} dimmed={maskiert} onChange={(v) => setDim(key, { ist: v })} />
                </td>
                <td style={styles.td}>
                  <LevelPicker value={d.soll} disabled={readOnly} dimmed={maskiert} onChange={(v) => setDim(key, { soll: v })} />
                </td>
                <td style={styles.td}>
                  <label style={styles.relToggle}>
                    <input
                      type="checkbox"
                      checked={d.relevanz !== 0}
                      disabled={readOnly}
                      onChange={(e) => setDim(key, { relevanz: e.target.checked ? 1 : 0 })}
                      style={{ accentColor: PURPLE }}
                    />
                    {maskiert ? 'maskiert' : 'zählt'}
                  </label>
                </td>
                <td style={styles.td}>
                  <input
                    style={styles.belegInput}
                    value={d.beleg || ''}
                    placeholder={maskiert ? 'Owner-Begründung…' : 'Beleg / Provenienz…'}
                    disabled={readOnly}
                    onChange={(e) => setDim(key, maskiert ? { maskeGrund: e.target.value, beleg: e.target.value } : { beleg: e.target.value })}
                  />
                </td>
                <td style={styles.td}>
                  <select style={styles.select} value={d.konfidenz || 'offen'} disabled={readOnly} onChange={(e) => setDim(key, { konfidenz: e.target.value })}>
                    <option value="hart">hart</option>
                    <option value="weich">weich</option>
                    <option value="offen">offen ❓</option>
                  </select>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
