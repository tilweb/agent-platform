import { theme } from '../config/theme';
import InboxDropdown from './InboxDropdown';

const headerStyles = {
  header: {
    position: 'fixed',
    top: 0,
    left: theme.layout.sidebarWidth,
    right: 0,
    height: theme.layout.headerHeight,
    backgroundColor: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${theme.spacing.xl}`,
    zIndex: 100,
  },
  logoSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  logoIcon: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.xl,
    background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary}20 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.primary,
  },
  logoText: {
    display: 'flex',
    flexDirection: 'column',
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.tight,
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `6px ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    color: theme.colors.textSecondary,
  },
};

function Header() {
  return (
    <header style={headerStyles.header}>
      <div />

      <div style={headerStyles.actions}>
        <InboxDropdown />
        <span style={headerStyles.badge}>
          <StatusDot color={theme.colors.success} />
          Online
        </span>
      </div>
    </header>
  );
}

function AgentLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function StatusDot({ color }) {
  return (
    <span
      style={{
        width: '8px',
        height: '8px',
        borderRadius: '50%',
        backgroundColor: color,
        display: 'inline-block',
      }}
    />
  );
}

export default Header;
