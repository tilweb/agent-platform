import { theme } from '../../../../config/theme';

const RISK_COLORS = {
  very_high: { bg: theme.colors.errorLight, color: theme.colors.error, label: 'Sehr hoch' },
  high: { bg: theme.colors.warningLight, color: theme.colors.warning, label: 'Hoch' },
  medium: { bg: theme.colors.infoLight, color: theme.colors.info, label: 'Mittel' },
  low: { bg: theme.colors.successLight, color: theme.colors.success, label: 'Niedrig' },
};

export default function RiskBadge({ level, size = 'normal' }) {
  const config = RISK_COLORS[level] || RISK_COLORS.low;

  const style = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: size === 'small'
      ? `2px ${theme.spacing.sm}`
      : `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: size === 'small' ? theme.typography.sizes.xs : theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    backgroundColor: config.bg,
    color: config.color,
    whiteSpace: 'nowrap',
  };

  return (
    <span style={style}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        backgroundColor: config.color,
      }} />
      {config.label}
    </span>
  );
}
