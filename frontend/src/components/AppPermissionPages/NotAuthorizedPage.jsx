/**
 * NotAuthorizedPage — wird gerendert wenn der User die App im Sidebar-Menue
 * sieht, sie aber konfiguriert ist und er nicht in einer berechtigten Gruppe ist.
 */

import { Link } from 'react-router-dom';
import { theme } from '../../config/theme';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
  },
  card: {
    maxWidth: '520px',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    textAlign: 'center',
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  body: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.xl,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  backButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    textDecoration: 'none',
  },
};

export default function NotAuthorizedPage({ appId }) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <LockIcon />
        </div>
        <h1 style={styles.title}>Keine Berechtigung</h1>
        <p style={styles.body}>
          Sie haben aktuell keinen Zugriff auf diese App. Wenden Sie sich an Ihre/n
          Administrator/in, wenn Sie Zugriff benötigen — Berechtigungen werden ueber
          Benutzergruppen vergeben.
        </p>
        <p style={styles.hint}>App-ID: <code>{appId}</code></p>
        <Link to="/apps" style={styles.backButton}>
          Zurück zur App-Übersicht
        </Link>
      </div>
    </div>
  );
}

function LockIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
