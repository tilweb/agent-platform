import { theme } from '../../../config/theme';
import { CheckIcon, XIcon } from '../../../components/Icons';
import { ACCENT } from '../api';

const styles = {
  wrap: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, marginLeft: theme.spacing.xs, verticalAlign: 'middle' },
  dot: { width: 7, height: 7, borderRadius: theme.borderRadius.full, backgroundColor: ACCENT, flexShrink: 0 },
  // Puls-Punkt am Zeilenanfang (vor dem Label). Nutzt die globale Keyframe wg-pulse.
  dotLead: { display: 'inline-block', width: 7, height: 7, borderRadius: theme.borderRadius.full, backgroundColor: ACCENT, flexShrink: 0, animation: 'wg-pulse 1.6s ease-in-out infinite' },
  freigabe: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, marginLeft: theme.spacing.xs, verticalAlign: 'middle' },
  btn: {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    width: 18, height: 18, padding: 0, borderRadius: theme.borderRadius.sm,
    border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, cursor: 'pointer',
  },
};

/**
 * Pulsierender KI-Vorschlag-Punkt am Zeilenanfang (vor dem Label).
 * Zeigt an: unbestaetigter quelle='llm'-Feldstatus fuer dieses Feld.
 * Rendert nichts, wenn `fs` fehlt.
 */
export function FeldStatusDot({ fs }) {
  if (!fs) return null;
  return (
    <span
      style={styles.dotLead}
      title="KI-Vorschlag aus Dokument — bitte bestaetigen oder verwerfen"
      aria-label="Unbestaetigter KI-Vorschlag"
    />
  );
}

/**
 * Freigabe-Buttons (✓ bestaetigen / ✗ verwerfen) am Wert — immer verfuegbar,
 * unabhaengig vom Bearbeiten-Modus (Bestaetigen ist kein Aendern).
 * Rendert nichts, wenn `fs` fehlt oder ohne Bearbeitungsrecht.
 */
export function FeldStatusFreigabe({ fs, canEdit = false, busy = false, onBestaetigen, onVerwerfen }) {
  if (!fs || !canEdit) return null;
  return (
    <span style={styles.freigabe} title="KI-Vorschlag bestaetigen oder verwerfen">
      <button
        type="button"
        style={styles.btn}
        disabled={busy}
        onClick={() => onBestaetigen?.(fs)}
        title="Bestaetigen"
        aria-label="KI-Vorschlag bestaetigen"
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
    </span>
  );
}

/**
 * Dezente Feld-Markierung fuer einen unbestaetigten KI-Vorschlag (WP3).
 * Kombiniert Punkt + Freigabe an einer Stelle (z. B. am Namen im PersonCard-Kopf).
 * Fuer die Feldzeilen wird der Punkt via FeldStatusDot an den Zeilenanfang gesetzt
 * und nur die Freigabe (FeldStatusFreigabe) am Wert gezeigt.
 */
export default function FeldStatusMark({ fs, canEdit = false, busy = false, onBestaetigen, onVerwerfen }) {
  if (!fs) return null;
  return (
    <span style={styles.wrap} title="KI-Vorschlag aus Dokument — bitte bestaetigen oder verwerfen">
      <span style={styles.dotLead} />
      <FeldStatusFreigabe fs={fs} canEdit={canEdit} busy={busy} onBestaetigen={onBestaetigen} onVerwerfen={onVerwerfen} />
    </span>
  );
}
