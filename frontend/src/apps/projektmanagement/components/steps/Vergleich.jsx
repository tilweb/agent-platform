/**
 * Vergleich - Historischer Vergleich (Placeholder für KI-Integration)
 */

import { theme } from '../../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  placeholder: {
    backgroundColor: theme.colors.surface,
    border: `2px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['3xl'],
    textAlign: 'center',
  },
  placeholderIcon: {
    marginBottom: theme.spacing.lg,
    color: theme.colors.textMuted,
    opacity: 0.5,
  },
  placeholderTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  placeholderText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    maxWidth: '500px',
    margin: '0 auto',
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  featureList: {
    marginTop: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    textAlign: 'left',
    maxWidth: '400px',
    margin: `${theme.spacing.xl} auto 0`,
  },
  featureItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  featureIcon: {
    width: '24px',
    height: '24px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  comingSoonBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    marginTop: theme.spacing.xl,
  },
  infoBox: {
    backgroundColor: theme.colors.infoLight,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.xl,
  },
  infoTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.info,
    marginBottom: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
};

function Vergleich({ data }) {
  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>9. Historischer Vergleich</h2>
        <p style={styles.subtitle}>
          KI-gestützte Analyse und Vergleich mit historischen Projekten.
        </p>
      </div>

      <div style={styles.placeholder}>
        <div style={styles.placeholderIcon}>
          <SparklesIcon size={64} />
        </div>
        <div style={styles.placeholderTitle}>KI-Analyse</div>
        <p style={styles.placeholderText}>
          In dieser Phase wird Ihr Projektauftrag mit historischen Projekten verglichen,
          um wertvolle Erkenntnisse und Empfehlungen zu gewinnen.
        </p>

        <div style={styles.featureList}>
          <div style={styles.featureItem}>
            <div style={styles.featureIcon}>
              <UsersIcon size={14} />
            </div>
            <span>People: Team-Zusammensetzung analysieren</span>
          </div>
          <div style={styles.featureItem}>
            <div style={styles.featureIcon}>
              <AlertIcon size={14} />
            </div>
            <span>Risiken: Ähnliche Risikoprofile vergleichen</span>
          </div>
          <div style={styles.featureItem}>
            <div style={styles.featureIcon}>
              <FlagIcon size={14} />
            </div>
            <span>Meilensteine: Zeitpläne evaluieren</span>
          </div>
          <div style={styles.featureItem}>
            <div style={styles.featureIcon}>
              <ChartIcon size={14} />
            </div>
            <span>Allgemein: Best Practices ableiten</span>
          </div>
        </div>

        <div style={styles.comingSoonBadge}>
          <ClockIcon size={12} />
          Demnächst verfügbar
        </div>
      </div>

      <div style={styles.infoBox}>
        <div style={styles.infoTitle}>
          <InfoIcon />
          Was ist der historische Vergleich?
        </div>
        <p style={styles.infoText}>
          Die KI-gestützte Vergleichsanalyse basiert auf der RUHR PM Masterclass Methodik
          und vergleicht Ihren Projektauftrag mit einer Datenbank historischer Projekte.
          Die Analyse erfolgt in vier Domänen (People, Risks, Milestones, General) und
          liefert konkrete Handlungsempfehlungen basierend auf Erfahrungen aus
          vergangenen Projekten.
        </p>
      </div>
    </div>
  );
}

// Icons
function SparklesIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M12 3v1m0 16v1m-8-9H3m18 0h-1M5.6 5.6l.7.7m12.1-.7-.7.7m0 11.4.7.7m-12.1-.7-.7.7" />
      <path d="M12 8l1.5 3.5L17 13l-3.5 1.5L12 18l-1.5-3.5L7 13l3.5-1.5L12 8z" />
    </svg>
  );
}

function UsersIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function AlertIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function FlagIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function ChartIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function ClockIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function InfoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

export default Vergleich;
