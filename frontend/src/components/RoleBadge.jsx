/**
 * RoleBadge — wiederverwendbare Anzeige der eigenen Rolle auf einer Resource.
 *
 * Verwendet in:
 * - PM-Wizards (Header neben dem Titel)
 * - Listen-Karten (Apps, Collections, Spaces, Agents, Projektideen, Projektauftraege)
 *
 * Akzeptiert die unifizierten Resource-Rollen (owner/admin/editor/viewer) plus
 * die PM-Phase-2-Rollen (owner/editor/viewer). `null` rendert nichts —
 * Aufrufer entscheidet ueber Sichtbarkeit.
 */

import { theme } from '../config/theme';

const LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Bearbeiter',
  viewer: 'Betrachter',
};

const COLORS = {
  owner: { bg: theme.colors.primaryLight, color: theme.colors.primary },
  admin: { bg: theme.colors.primaryLight, color: theme.colors.primary },
  editor: { bg: theme.colors.successLight, color: theme.colors.success },
  viewer: { bg: theme.colors.surfaceHover, color: theme.colors.textMuted },
};

const SIZE_STYLES = {
  sm: { fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}` },
  md: { fontSize: theme.typography.sizes.xs, padding: `${theme.spacing.xs} ${theme.spacing.md}` },
};

/**
 * @param {{ role: 'owner'|'admin'|'editor'|'viewer'|null|undefined, size?: 'sm'|'md', style?: object }} props
 */
export default function RoleBadge({ role, size = 'md', style = {} }) {
  if (!role) return null;
  const color = COLORS[role] ?? COLORS.viewer;
  const sizeStyle = SIZE_STYLES[size] ?? SIZE_STYLES.md;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing.xs,
        backgroundColor: color.bg,
        color: color.color,
        borderRadius: theme.borderRadius.full,
        fontWeight: theme.typography.weights.medium,
        whiteSpace: 'nowrap',
        ...sizeStyle,
        ...style,
      }}
      title={`Ihre Rolle: ${LABELS[role] ?? role}`}
    >
      {LABELS[role] ?? role}
    </span>
  );
}
