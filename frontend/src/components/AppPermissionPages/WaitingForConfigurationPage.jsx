/**
 * WaitingForConfigurationPage — App ist enabled aber noch keine Gruppe berechtigt.
 *
 * Admins sehen einen Direkt-Link zu Settings → Apps → diese App.
 * Non-Admins sehen nur den Hinweis "wendet sich an den Admin".
 */

import { Link } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useAuth } from '../../context/AuthContext';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['2xl'],
  },
  card: {
    maxWidth: '560px',
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
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
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
  primaryButton: {
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
  secondaryButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    textDecoration: 'none',
    marginLeft: theme.spacing.md,
  },
};

export default function WaitingForConfigurationPage({ appId }) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>
          <ConfigIcon />
        </div>
        <h1 style={styles.title}>Wartet auf Konfiguration</h1>
        <p style={styles.body}>
          {isAdmin
            ? 'Diese App ist aktiviert, aber es wurden noch keine Gruppen-Berechtigungen vergeben. Bitte konfigurieren Sie die Berechtigungen, damit Nutzer:innen die App verwenden koennen.'
            : 'Diese App ist aktiviert, aber noch nicht freigeschaltet. Der Administrator muss noch die Berechtigungen festlegen.'}
        </p>
        {isAdmin ? (
          <>
            <Link to={`/settings?tab=apps&app=${appId}`} style={styles.primaryButton}>
              Jetzt konfigurieren
            </Link>
            <Link to="/apps" style={styles.secondaryButton}>
              Zurück
            </Link>
          </>
        ) : (
          <Link to="/apps" style={styles.primaryButton}>
            Zurück zur App-Übersicht
          </Link>
        )}
      </div>
    </div>
  );
}

function ConfigIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
