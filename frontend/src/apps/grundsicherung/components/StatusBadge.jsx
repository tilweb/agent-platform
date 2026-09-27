import { theme } from '../../../config/theme';
import { STATUS_LABEL } from '../api';

const badge = {
  display: 'inline-block',
  fontSize: theme.typography.sizes.xs,
  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
  borderRadius: theme.borderRadius.full,
  fontWeight: theme.typography.weights.medium,
  whiteSpace: 'nowrap',
};

/** Ton je Status (neutrale Füllung, keine Farb-Rahmen). */
function toneFor(status) {
  switch (status) {
    case 'abgeschlossen':
      return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
    case 'entscheidung':
      return { backgroundColor: theme.colors.infoLight, color: theme.colors.info };
    case 'warte_auf_rueckmeldung':
      return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
    case 'sachbearbeitung':
      return { backgroundColor: theme.colors.primaryLight, color: theme.colors.primaryDark };
    case 'posteingang':
    default:
      return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
  }
}

export default function StatusBadge({ status }) {
  return <span style={{ ...badge, ...toneFor(status) }}>{STATUS_LABEL[status] || status}</span>;
}
