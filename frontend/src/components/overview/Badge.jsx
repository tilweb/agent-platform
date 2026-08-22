/**
 * Badge — kleiner Status-/Kategorie-Chip für die Übersichtskacheln.
 * Varianten mappen auf Theme-Tokens; keine hardcoded Farben.
 */

import { theme } from '../../config/theme';

const VARIANTS = {
  muted: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  primary: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  success: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  warning: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  error: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  info: { backgroundColor: theme.colors.infoLight, color: theme.colors.info },
};

const base = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: theme.spacing.xs,
  fontSize: theme.typography.sizes.xs,
  fontWeight: theme.typography.weights.medium,
  padding: `2px ${theme.spacing.sm}`,
  borderRadius: theme.borderRadius.full,
  whiteSpace: 'nowrap',
};

export default function Badge({ variant = 'muted', children, style }) {
  return <span style={{ ...base, ...(VARIANTS[variant] || VARIANTS.muted), ...style }}>{children}</span>;
}
