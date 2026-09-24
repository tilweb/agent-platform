/**
 * ModelBadges — kompakte Visualisierung neben dem Modellnamen im Chat.
 *
 * Zwei Pills, bewusst weiß mit Rahmen + Schatten (ihr Inhalt bringt schon viele
 * Farben mit):
 * (a) Billing-Pill: ∞ „Inklusive" (Adacor-Standard, keine Token-Kosten) vs.
 *     Münzen „Premium" (extern, Abrechnung pro Token).
 * (b) Residency-Pill: runde Flagge des Verarbeitungsorts (nur DE/EU/CH/US/Welt,
 *     s. CountryFlag). Klickbar → Detail-Ausklapp (Hersteller, Betreiber/
 *     Firmensitz, Rechenzentrum als Land, Kontextfenster, sachliche
 *     Datenschutz-Einordnung). Bewusst OHNE „DSGVO ja/nein"-Urteil — diese
 *     rechtliche Bewertung steht uns nicht zu; die Pill zeigt Fakten.
 *
 * Erwartet `meta` aus ChatPage (siehe dort): billing, residency, modelName,
 * manufacturer, providerName, region, contextLabel, dpSummary.
 */

import { useState, useRef, useEffect } from 'react';
import { theme } from '../config/theme';
import { InfinityIcon, CoinsIcon } from './Icons';
import CountryFlag from './CountryFlag';

const pillBase = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '5px',
  height: '22px',
  boxSizing: 'border-box',
  backgroundColor: theme.colors.surface,
  border: `1px solid ${theme.colors.border}`,
  borderRadius: theme.borderRadius.full,
  boxShadow: theme.shadows.sm,
  lineHeight: 1,
  whiteSpace: 'nowrap',
};

const styles = {
  wrap: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    verticalAlign: 'middle',
  },
  billingPill: {
    ...pillBase,
    padding: '0 9px 0 7px',
  },
  residencyAnchor: {
    position: 'relative',
    display: 'inline-flex',
  },
  residencyPill: {
    ...pillBase,
    padding: '0 7px 0 3px',
    cursor: 'pointer',
    font: 'inherit',
    color: 'inherit',
  },
  label: {
    fontSize: '10px',
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: '0.02em',
  },
  caret: {
    transition: 'transform 0.15s ease',
    flexShrink: 0,
  },

  // Detail-Ausklapp (Popover)
  popover: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: '6px',
    zIndex: 100,
    minWidth: '250px',
    maxWidth: '320px',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    boxShadow: theme.shadows.lg,
    padding: theme.spacing.md,
    textAlign: 'left',
    whiteSpace: 'normal',
    cursor: 'default',
  },
  popTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  popRow: {
    marginBottom: theme.spacing.sm,
  },
  popLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '2px',
  },
  popValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.4,
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  popSummary: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
    marginTop: theme.spacing.sm,
    paddingTop: theme.spacing.sm,
    borderTop: `1px solid ${theme.colors.border}`,
  },
};

function Row({ label, value }) {
  return (
    <div style={styles.popRow}>
      <div style={styles.popLabel}>{label}</div>
      <div style={styles.popValue}>{value}</div>
    </div>
  );
}

export default function ModelBadges({ meta }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (anchorRef.current && !anchorRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!meta) return null;
  const {
    billing, residency,
    modelName, manufacturer, providerName, region, contextLabel, dpSummary,
  } = meta;
  const premium = billing === 'premium';
  const billingColor = premium ? theme.colors.warning : theme.colors.primary;
  const showResidency = Boolean(residency);

  return (
    <span style={styles.wrap}>
      {/* (a) Billing-Pill */}
      <span
        style={styles.billingPill}
        title={premium
          ? 'Premium-Modell — Abrechnung pro Token (externer Anbieter)'
          : 'Adacor-Standardmodell — keine Kosten pro Token'}
      >
        {premium
          ? <CoinsIcon size={13} color={billingColor} />
          : <InfinityIcon size={13} color={billingColor} />}
        <span style={{ ...styles.label, color: billingColor }}>
          {premium ? 'Premium' : 'Inklusive'}
        </span>
      </span>

      {/* (b) Residency-Pill mit Detail-Ausklapp */}
      {showResidency && (
        <span ref={anchorRef} style={styles.residencyAnchor}>
          <button
            type="button"
            style={styles.residencyPill}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            title={`Datenverarbeitung: ${residency.name} — Details anzeigen`}
          >
            <CountryFlag code={residency.code} size={18} title={residency.name} />
            <svg
              width="9" height="9" viewBox="0 0 24 24" fill="none"
              stroke={theme.colors.textMuted} strokeWidth="3"
              strokeLinecap="round" strokeLinejoin="round"
              style={{ ...styles.caret, transform: open ? 'rotate(180deg)' : 'none' }}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {open && (
            <div style={styles.popover}>
              {modelName && <div style={styles.popTitle}>{modelName}</div>}
              {manufacturer && <Row label="Hersteller" value={manufacturer} />}
              <div style={styles.popRow}>
                <div style={styles.popLabel}>Betreiber</div>
                <div style={styles.popValue}>
                  <span>{providerName || '—'}</span>
                  {region && (
                    <>
                      <span style={{ color: theme.colors.textMuted }}>· Firmensitz:</span>
                      <CountryFlag region={region.value} size={14} title={region.label} />
                      <span>{region.label}</span>
                    </>
                  )}
                </div>
              </div>
              {residency && (
                <div style={styles.popRow}>
                  <div style={styles.popLabel}>Rechenzentrum</div>
                  <div style={styles.popValue}>
                    <CountryFlag code={residency.code} size={16} title={residency.name} />
                    {residency.name}
                  </div>
                </div>
              )}
              {contextLabel && <Row label="Kontextfenster" value={`${contextLabel} Tokens`} />}
              {dpSummary && <div style={styles.popSummary}>{dpSummary}</div>}
            </div>
          )}
        </span>
      )}
    </span>
  );
}
