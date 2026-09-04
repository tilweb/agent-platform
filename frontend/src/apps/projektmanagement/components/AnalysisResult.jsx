/**
 * AnalysisResult Component
 * Displays the result of a step analysis with score, strengths, weaknesses, hints, and consistency findings
 */

import { theme } from '../../../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },

  // Score Section
  scoreSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
  },
  scoreCircle: {
    position: 'relative',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreCircleBg: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: `6px solid ${theme.colors.border}`,
  },
  scoreCircleProgress: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  scoreValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  scoreLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  scoreMeta: {
    flex: 1,
  },
  scoreTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  scoreDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 1.5,
  },

  // Section styles
  section: {
    marginBottom: theme.spacing.md,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  sectionCount: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },

  // Items list
  itemsList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  item: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.5,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xs,
  },
  itemIcon: {
    flexShrink: 0,
    marginTop: '2px',
  },

  // Variants
  successItem: {
    backgroundColor: theme.colors.successLight,
  },
  successTitle: {
    color: theme.colors.success,
  },
  successCount: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },

  warningItem: {
    backgroundColor: theme.colors.warningLight,
  },
  warningTitle: {
    color: theme.colors.warning,
  },
  warningCount: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },

  infoItem: {
    backgroundColor: theme.colors.infoLight,
  },
  infoTitle: {
    color: theme.colors.info,
  },
  infoCount: {
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
  },

  errorItem: {
    backgroundColor: theme.colors.errorLight,
  },
  errorTitle: {
    color: theme.colors.error,
  },
  errorCount: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },

  // Consistency Section
  consistencySection: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  consistencyHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  consistencyBadge: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  consistencyFinding: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  findingBereich: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  findingBeschreibung: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  findingEmpfehlung: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },

  // Empty state
  emptyList: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    padding: theme.spacing.sm,
  },

  // Timestamp
  timestamp: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginTop: theme.spacing.md,
  },

  // Veraltet-Hinweis (Daten seit der Analyse geändert)
  staleBanner: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.warning,
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.md,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    marginBottom: theme.spacing.md,
    lineHeight: 1.4,
  },
  staleBannerLabel: {
    fontWeight: theme.typography.weights.semibold,
  },
};

// Helper to get score color
function getScoreColor(score) {
  if (score >= 80) return theme.colors.success;
  if (score >= 60) return theme.colors.primary;
  if (score >= 40) return theme.colors.warning;
  return theme.colors.error;
}

// Helper to get score description
function getScoreDescription(score) {
  if (score >= 80) return 'Sehr gut - Nur kleine Optimierungen möglich';
  if (score >= 60) return 'Gut - Einige Verbesserungen empfohlen';
  if (score >= 40) return 'Ausbaufähig - Mehrere Verbesserungen nötig';
  return 'Grundlegende Überarbeitung empfohlen';
}

// Helper to get consistency badge style
function getConsistencyStyle(status) {
  switch (status) {
    case 'konsistent':
      return {
        backgroundColor: theme.colors.successLight,
        color: theme.colors.success,
      };
    case 'warnung':
      return {
        backgroundColor: theme.colors.warningLight,
        color: theme.colors.warning,
      };
    case 'inkonsistent':
      return {
        backgroundColor: theme.colors.errorLight,
        color: theme.colors.error,
      };
    default:
      return {};
  }
}

// SVG Circle Progress component
function CircleProgress({ score }) {
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const color = getScoreColor(score);

  return (
    <svg width="80" height="80" style={styles.scoreCircleProgress}>
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke={theme.colors.border}
        strokeWidth="6"
      />
      <circle
        cx="40"
        cy="40"
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 40 40)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

// Section component for strengths, weaknesses, hints
function Section({ title, items, variant }) {
  const variantStyles = {
    success: {
      title: styles.successTitle,
      count: styles.successCount,
      item: styles.successItem,
      icon: <CheckIcon />,
    },
    warning: {
      title: styles.warningTitle,
      count: styles.warningCount,
      item: styles.warningItem,
      icon: <WarningIcon />,
    },
    info: {
      title: styles.infoTitle,
      count: styles.infoCount,
      item: styles.infoItem,
      icon: <LightbulbIcon />,
    },
    error: {
      title: styles.errorTitle,
      count: styles.errorCount,
      item: styles.errorItem,
      icon: <AlertIcon />,
    },
  };

  const vs = variantStyles[variant] || variantStyles.info;

  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader}>
        <span style={{ ...styles.sectionTitle, ...vs.title }}>{title}</span>
        <span style={{ ...styles.sectionCount, ...vs.count }}>{items.length}</span>
      </div>
      {items.length > 0 ? (
        <ul style={styles.itemsList}>
          {items.map((item, index) => (
            <li key={index} style={{ ...styles.item, ...vs.item }}>
              <span style={styles.itemIcon}>{vs.icon}</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div style={styles.emptyList}>Keine Einträge</div>
      )}
    </div>
  );
}

// Helper to ensure a value is an array
function ensureArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (value === null || value === undefined) {
    return [];
  }
  // Handle case where empty array might be parsed as empty object
  if (typeof value === 'object' && Object.keys(value).length === 0) {
    return [];
  }
  return [];
}

function AnalysisResult({ analysis }) {
  if (!analysis) {
    return null;
  }

  const { masterclassAnalysis, konsistenzAnalysis, timestamp, stale } = analysis;
  const score = masterclassAnalysis?.score || 0;

  return (
    <div style={styles.container}>
      {/* Veraltet-Hinweis: Daten haben sich seit der Analyse geändert */}
      {stale && (
        <div style={styles.staleBanner}>
          <span style={styles.staleBannerLabel}>Veraltet:</span>{' '}
          Die Daten haben sich seit dieser Analyse geändert — die Empfehlungen passen
          möglicherweise nicht mehr. Für einen aktuellen Stand neu analysieren.
        </div>
      )}

      {/* Score Circle */}
      <div style={styles.scoreSection}>
        <div style={styles.scoreCircle}>
          <CircleProgress score={score} />
          <div style={{ textAlign: 'center', zIndex: 1 }}>
            <div style={{ ...styles.scoreValue, color: getScoreColor(score) }}>
              {score}
            </div>
            <div style={styles.scoreLabel}>/ 100</div>
          </div>
        </div>
        <div style={styles.scoreMeta}>
          <div style={styles.scoreTitle}>Masterclass-Bewertung</div>
          <div style={styles.scoreDescription}>{getScoreDescription(score)}</div>
        </div>
      </div>

      {/* Strengths */}
      <Section
        title="Stärken"
        items={ensureArray(masterclassAnalysis?.staerken)}
        variant="success"
      />

      {/* Weaknesses */}
      <Section
        title="Verbesserungspotential"
        items={ensureArray(masterclassAnalysis?.schwaechen)}
        variant="warning"
      />

      {/* Hints */}
      <Section
        title="Empfehlungen"
        items={ensureArray(masterclassAnalysis?.hinweise)}
        variant="info"
      />

      {/* Consistency Check */}
      {konsistenzAnalysis && (
        <div style={styles.consistencySection}>
          <div style={styles.consistencyHeader}>
            <ConsistencyIcon />
            <span style={{
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.semibold,
              color: theme.colors.text,
            }}>
              Konsistenz-Prüfung
            </span>
            <span style={{
              ...styles.consistencyBadge,
              ...getConsistencyStyle(konsistenzAnalysis.status),
            }}>
              {konsistenzAnalysis.status === 'konsistent' && 'Konsistent'}
              {konsistenzAnalysis.status === 'warnung' && 'Hinweise'}
              {konsistenzAnalysis.status === 'inkonsistent' && 'Inkonsistent'}
            </span>
          </div>

          {ensureArray(konsistenzAnalysis.findings).length > 0 ? (
            ensureArray(konsistenzAnalysis.findings).map((finding, index) => (
              <div key={index} style={styles.consistencyFinding}>
                <div style={styles.findingBereich}>{finding.bereich}</div>
                <div style={styles.findingBeschreibung}>{finding.beschreibung}</div>
                {finding.empfehlung && (
                  <div style={styles.findingEmpfehlung}>
                    Empfehlung: {finding.empfehlung}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div style={styles.emptyList}>
              Keine Inkonsistenzen mit vorherigen Schritten gefunden.
            </div>
          )}
        </div>
      )}

      {/* Timestamp */}
      {timestamp && (
        <div style={styles.timestamp}>
          Analyse vom {new Date(timestamp).toLocaleString('de-DE')}
        </div>
      )}
    </div>
  );
}

// Icons
function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.warning} strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.info} strokeWidth="2">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={theme.colors.error} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function ConsistencyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
      <path d="M18 20V10" />
      <path d="M12 20V4" />
      <path d="M6 20v-6" />
    </svg>
  );
}

export default AnalysisResult;
