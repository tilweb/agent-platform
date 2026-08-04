/**
 * BusinessCase — Tab 4.
 * Investitionen (Kosten) und Nutzen (Ertraege) als zwei separate Bloecke.
 * ROI-Anzeige darunter: Summe(Nutzen) - Summe(Investitionen). Wenn >= 0,
 * ist der ROI erreicht. Hinweis aus PDF: User erfasst alle Werte positiv,
 * Vorzeichen wird nur in der Berechnung interpretiert.
 */

import { useState } from 'react';
import { theme } from '../../../../config/theme';

const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xl },
  header: { marginBottom: theme.spacing.lg },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  block: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  blockHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  blockTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  blockSum: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    fontVariantNumeric: 'tabular-nums',
  },
  itemRow: {
    display: 'grid',
    gridTemplateColumns: '3fr 1fr 32px',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
    alignItems: 'center',
  },
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
  },
  numericInput: { textAlign: 'right', fontVariantNumeric: 'tabular-nums' },
  removeButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.error,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.lg,
    padding: 0,
  },
  addButton: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    transition: `all ${theme.transitions.fast}`,
  },
  fazit: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
  },
  fazitRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: theme.typography.sizes.base,
    marginBottom: theme.spacing.sm,
  },
  fazitLabel: { color: theme.colors.textMuted },
  fazitValue: { fontVariantNumeric: 'tabular-nums', fontWeight: theme.typography.weights.medium },
  roiRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: theme.spacing.md,
  },
  roiBadge: {
    fontSize: theme.typography.sizes.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    marginLeft: theme.spacing.md,
  },
  roiPositive: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  roiNegative: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  roiNeutral: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginTop: theme.spacing.sm,
  },
  colHeader: {
    display: 'grid',
    gridTemplateColumns: '3fr 1fr 32px',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.sm,
    padding: `0 ${theme.spacing.sm}`,
  },
};

function formatEuro(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '0 €';
  return value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
}

// Parst einen (auch deutsch formatierten) Betrags-String zu einer Zahl.
function parseEuro(s) {
  if (typeof s === 'number') return Number.isFinite(s) ? s : 0;
  let t = String(s ?? '').replace(/[^\d.,-]/g, '').trim();
  if (t === '') return 0;
  if (t.includes('.') && t.includes(',')) t = t.replace(/\./g, '').replace(',', '.'); // 1.234,56
  else if (t.includes(',')) t = t.replace(',', '.');                                   // 1234,56
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

// Betrags-Eingabe: zeigt bei Nicht-Fokus formatiert „X.XXX,XX €", beim Fokus die
// rohe Zahl zum Editieren. Übernimmt den geparsten Wert bei Blur.
function EuroInput({ value, onChange, style }) {
  const [focused, setFocused] = useState(false);
  const [draft, setDraft] = useState('');
  const display = focused
    ? draft
    : (Number.isFinite(value)
      ? value.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : '');
  return (
    <input
      type="text"
      inputMode="decimal"
      style={style}
      placeholder="0,00 €"
      value={display}
      onFocus={(e) => {
        setFocused(true);
        setDraft(value ? String(value) : '');
        e.target.style.borderColor = theme.colors.primary;
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => {
        setFocused(false);
        onChange(parseEuro(draft));
        e.target.style.borderColor = theme.colors.border;
      }}
    />
  );
}

function generateId(prefix = 'bc') {
  const ts = Date.now().toString(36);
  const r = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${ts}-${r}`;
}

function CategoryBlock({ title, items, onChange, prefix }) {
  const sum = items.reduce((acc, it) => acc + (Number(it.betrag) || 0), 0);

  const update = (id, field, value) => {
    onChange(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };
  const add = () => {
    onChange([...items, { id: generateId(prefix), beschreibung: '', betrag: 0 }]);
  };
  const remove = (id) => {
    onChange(items.filter((it) => it.id !== id));
  };

  return (
    <div style={styles.block}>
      <div style={styles.blockHeader}>
        <div style={styles.blockTitle}>{title}</div>
        <div style={styles.blockSum}>Summe: {formatEuro(sum)}</div>
      </div>

      {items.length > 0 && (
        <div style={styles.colHeader}>
          <div>Beschreibung</div>
          <div style={{ textAlign: 'right' }}>Betrag (€)</div>
          <div></div>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} style={styles.itemRow}>
          <input
            type="text"
            style={styles.input}
            placeholder="z.B. Lizenzkosten Jahr 1"
            value={item.beschreibung || ''}
            onChange={(e) => update(item.id, 'beschreibung', e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
          <EuroInput
            value={item.betrag ?? 0}
            onChange={(v) => update(item.id, 'betrag', v)}
            style={{ ...styles.input, ...styles.numericInput }}
          />
          <button
            style={styles.removeButton}
            onClick={() => remove(item.id)}
            title="Position entfernen"
          >
            ×
          </button>
        </div>
      ))}

      <button style={styles.addButton} onClick={add}>
        + Position hinzufügen
      </button>
    </div>
  );
}

export default function BusinessCase({ projektidee, onChange }) {
  const bc = projektidee.business_case ?? { investitionen: [], nutzen: [] };

  const setInvestitionen = (items) =>
    onChange({ ...projektidee, business_case: { ...bc, investitionen: items } });
  const setNutzen = (items) =>
    onChange({ ...projektidee, business_case: { ...bc, nutzen: items } });

  const sumInvest = bc.investitionen.reduce((a, i) => a + (Number(i.betrag) || 0), 0);
  const sumNutzen = bc.nutzen.reduce((a, i) => a + (Number(i.betrag) || 0), 0);
  // ROI-Berechnung: Investitionen werden negativ verrechnet, Nutzen positiv.
  // Saldo >= 0 bedeutet ROI erreicht (Anmerkung im PDF).
  const saldo = sumNutzen - sumInvest;

  let roiBadge = styles.roiNeutral;
  let roiText = 'ROI noch nicht erreicht';
  if (sumInvest === 0 && sumNutzen === 0) {
    roiText = '— noch keine Werte erfasst —';
  } else if (saldo > 0) {
    roiBadge = styles.roiPositive;
    roiText = 'ROI erreicht (+)';
  } else if (saldo === 0) {
    roiBadge = styles.roiPositive;
    roiText = 'ROI erreicht (Break-even)';
  } else {
    roiBadge = styles.roiNegative;
    roiText = 'ROI nicht erreicht';
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Business Case</h2>
        <p style={styles.hint}>
          Erfassen Sie alle Beträge positiv. Das Vorzeichen wird in der ROI-Berechnung
          automatisch interpretiert (Investitionen negativ, Nutzen positiv).
        </p>
      </div>

      <CategoryBlock
        title="Investitionen (avisiertes Budget)"
        items={bc.investitionen}
        onChange={setInvestitionen}
        prefix="invest"
      />

      <CategoryBlock
        title="Nutzen (erwartete Ertraege)"
        items={bc.nutzen}
        onChange={setNutzen}
        prefix="nutzen"
      />

      <div style={styles.fazit}>
        <div style={styles.fazitRow}>
          <span style={styles.fazitLabel}>Summe Investitionen</span>
          <span style={styles.fazitValue}>− {formatEuro(sumInvest)}</span>
        </div>
        <div style={styles.fazitRow}>
          <span style={styles.fazitLabel}>Summe Nutzen</span>
          <span style={styles.fazitValue}>+ {formatEuro(sumNutzen)}</span>
        </div>
        <div style={styles.roiRow}>
          <span>Saldo (ROI)</span>
          <div>
            <span style={styles.fazitValue}>{formatEuro(saldo)}</span>
            <span style={{ ...styles.roiBadge, ...roiBadge }}>{roiText}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
