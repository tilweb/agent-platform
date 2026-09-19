import { theme } from '../../../config/theme';
import { CheckIcon, XIcon } from '../../../components/Icons';
import { ACCENT } from '../api';

const styles = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, marginLeft: theme.spacing.xs, verticalAlign: 'middle' },
  dot: { width: 7, height: 7, borderRadius: theme.borderRadius.full, backgroundColor: ACCENT, flexShrink: 0 },
  btn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 18, height: 18, padding: 0, borderRadius: theme.borderRadius.sm,
    border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, cursor: 'pointer',
  },
};

/**
 * Dezente Feld-Markierung für einen unbestätigten KI-Vorschlag (WP3).
 * Rendert einen Punkt + ✓ (bestätigen) / ✗ (verwerfen). Nichts, wenn `fs` fehlt
 * (kein unbestätigter quelle='llm'-Eintrag) — der Aufrufer liefert `fs` aus einer Map.
 */
export default function FeldStatusMark({ fs, canEdit = false, busy = false, onBestaetigen, onVerwerfen }) {
  if (!fs) return null;
  return (
    <span style={styles.wrap} title="KI-Vorschlag aus Dokument — bitte bestätigen oder verwerfen">
      <span style={styles.dot} />
      {canEdit && (
        <>
          <button
            type="button"
            style={styles.btn}
            disabled={busy}
            onClick={() => onBestaetigen?.(fs)}
            title="Bestätigen"
            aria-label="KI-Vorschlag bestätigen"
          >
            <CheckIcon size={12} color={theme.colors.success} />
          </button>
          <button
            type="button"
            style={styles.btn}
            disabled={busy}
            onClick={() => onVerwerfen?.(fs)}
            title="Verwerfen (Feld leeren)"
            aria-label="KI-Vorschlag verwerfen"
          >
            <XIcon size={12} color={theme.colors.error} />
          </button>
        </>
      )}
    </span>
  );
}
