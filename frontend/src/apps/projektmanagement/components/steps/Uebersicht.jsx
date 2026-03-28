/**
 * Uebersicht - Projektübersicht & Zusammenfassung
 * Includes KI-Gesamtbewertung for the complete Projektauftrag
 */

import { useState } from 'react';
import { theme } from '../../../../config/theme';
import { apiPost } from '../../../../utils/apiFetch';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  twoColumnLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.xl,
    alignItems: 'start',
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
    color: theme.colors.textMuted,
  },
  summaryCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  summaryHeader: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    color: '#fff',
  },
  projectName: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.sm,
  },
  projectMeta: {
    display: 'flex',
    gap: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    opacity: 0.9,
  },
  metaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  summaryContent: {
    padding: theme.spacing.xl,
  },
  section: {
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionContent: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  statCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    textAlign: 'center',
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.primary,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
  },
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    fontSize: theme.typography.sizes.sm,
  },
  listItemLast: {
    borderBottom: 'none',
  },
  listIcon: {
    color: theme.colors.primary,
    flexShrink: 0,
    marginTop: '2px',
  },
  twoColumns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.xl,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  badgeSuccess: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  badgeWarning: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  badgeError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  badgeInfo: {
    backgroundColor: theme.colors.infoLight,
    color: theme.colors.info,
  },
  riskItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.sm} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  timeline: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  timelineItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  timelineDot: {
    width: '12px',
    height: '12px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    flexShrink: 0,
  },
  timelineContent: {
    flex: 1,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: theme.typography.sizes.sm,
  },
  timelineDate: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xs,
  },
  // Gesamtbewertung styles
  gesamtbewertungCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  gesamtbewertungHeader: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primaryLight,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  gesamtbewertungTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  analyzeButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.fast}`,
  },
  analyzeButtonDisabled: {
    backgroundColor: theme.colors.border,
    cursor: 'not-allowed',
  },
  gesamtbewertungContent: {
    padding: theme.spacing.xl,
  },
  scoreSection: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
  },
  scoreCircle: {
    position: 'relative',
    width: '100px',
    height: '100px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  scoreValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    zIndex: 1,
  },
  scoreLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    zIndex: 1,
  },
  scoreMeta: {
    flex: 1,
  },
  projektreifeContainer: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  projektreifeLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  projektreifeBegruendung: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
  },
  stepScoresGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  stepScoreCard: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
  },
  stepScoreHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xs,
  },
  stepScoreName: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
  },
  stepScoreValue: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.bold,
  },
  stepScoreFazit: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
  },
  analysisSection: {
    marginBottom: theme.spacing.lg,
  },
  analysisSectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  analysisItem: {
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
  strengthItem: {
    backgroundColor: theme.colors.successLight,
  },
  riskItem2: {
    backgroundColor: theme.colors.errorLight,
  },
  recommendationItem: {
    backgroundColor: theme.colors.infoLight,
  },
  analysisItemIcon: {
    flexShrink: 0,
    marginTop: '2px',
  },
  risikoSection: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    marginTop: theme.spacing.lg,
  },
  risikoHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  risikoLevel: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  risikoLevelNiedrig: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  risikoLevelMittel: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  risikoLevelHoch: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  risikoLevelKritisch: {
    backgroundColor: theme.colors.error,
    color: '#fff',
  },
  emptyState: {
    padding: theme.spacing['2xl'],
    textAlign: 'center',
  },
  emptyStateIcon: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    opacity: 0.5,
  },
  emptyStateText: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyStateHint: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  analysisHintSuccess: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  analysisHintWarning: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  loadingState: {
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    color: theme.colors.textMuted,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  errorState: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
  },
  timestamp: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textAlign: 'right',
    marginTop: theme.spacing.lg,
  },
};

// UI-Step → Backend-Step mapping for analysis transformation
const UI_TO_BACKEND = { 2: [7], 3: [2], 4: [3], 5: [4, 5], 6: [6], 7: [6] };

function Uebersicht({ data, stepAnalyses = null, gesamtbewertung = null, onGesamtbewertungComplete }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };

  const handleAnalyze = async () => {
    try {
      setIsAnalyzing(true);
      setError(null);

      // Transform UI-Step-Keys → Backend-Step-Keys for the API
      let backendAnalyses = null;
      if (stepAnalyses && Object.keys(stepAnalyses).length > 0) {
        backendAnalyses = {};
        for (const [uiStep, analysis] of Object.entries(stepAnalyses)) {
          const backendSteps = UI_TO_BACKEND[uiStep];
          if (backendSteps) {
            for (const bs of backendSteps) {
              if (!backendAnalyses[bs]) backendAnalyses[bs] = analysis;
            }
          }
        }
      }

      const response = await apiPost('/apps/projektmanagement/analyse/gesamt', {
        projektauftrag: data,
        stepAnalyses: backendAnalyses || stepAnalyses,
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Gesamtbewertung fehlgeschlagen');
      }

      const result = await response.json();
      // Notify parent to store the Gesamtbewertung
      if (onGesamtbewertungComplete) {
        onGesamtbewertungComplete(result.gesamtbewertung);
      }
    } catch (err) {
      console.error('Error generating Gesamtbewertung:', err);
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return theme.colors.success;
    if (score >= 60) return theme.colors.primary;
    if (score >= 40) return theme.colors.warning;
    return theme.colors.error;
  };

  const getProjekreifeStyle = (status) => {
    switch (status) {
      case 'bereit':
        return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
      case 'bedingt_bereit':
        return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
      case 'nicht_bereit':
        return { backgroundColor: theme.colors.errorLight, color: theme.colors.error };
      default:
        return {};
    }
  };

  const getProjektreifeLabel = (status) => {
    switch (status) {
      case 'bereit': return 'Bereit';
      case 'bedingt_bereit': return 'Bedingt bereit';
      case 'nicht_bereit': return 'Nicht bereit';
      default: return status;
    }
  };

  const getRisikoLevelStyle = (level) => {
    switch (level) {
      case 'niedrig': return styles.risikoLevelNiedrig;
      case 'mittel': return styles.risikoLevelMittel;
      case 'hoch': return styles.risikoLevelHoch;
      case 'kritisch': return styles.risikoLevelKritisch;
      default: return {};
    }
  };

  const getRisikoLabel = (level) => {
    switch (level) {
      case 'niedrig': return 'Niedrig';
      case 'mittel': return 'Mittel';
      case 'hoch': return 'Hoch';
      case 'kritisch': return 'Kritisch';
      default: return level;
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const totalBudget = (data.budget || []).reduce((sum, item) => sum + (item.amount || 0), 0);
  const totalEffort = (data.tasks || []).reduce((sum, task) => sum + (task.effort || 0), 0);

  const getProjectTypeLabel = (type) => {
    const types = {
      internal: 'Intern',
      external: 'Extern',
      research: 'Forschung',
      infrastructure: 'Infrastruktur',
    };
    return types[type] || type;
  };

  const getRiskBadgeStyle = (level) => {
    switch (level) {
      case 'low':
        return styles.badgeSuccess;
      case 'medium':
        return styles.badgeWarning;
      case 'high':
        return styles.badgeError;
      default:
        return {};
    }
  };

  const getRiskLabel = (level) => {
    switch (level) {
      case 'low':
        return 'Niedrig';
      case 'medium':
        return 'Mittel';
      case 'high':
        return 'Hoch';
      default:
        return level;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>8. Übersicht</h2>
        <p style={styles.subtitle}>
          Zusammenfassung Ihres Projektauftrags mit KI-Gesamtbewertung.
        </p>
      </div>

      {/* Two Column Layout: Zusammenfassung links, KI-Bewertung rechts */}
      <div style={styles.twoColumnLayout}>
        {/* Projektzusammenfassung (links) */}
        <div style={styles.summaryCard}>
          {/* Project Header */}
          <div style={styles.summaryHeader}>
            <div style={styles.projectName}>{data.name || 'Unbenanntes Projekt'}</div>
            <div style={styles.projectMeta}>
              <span style={styles.metaItem}>
                <CalendarIcon />
                {formatDate(data.start_date)} - {formatDate(data.end_date)}
              </span>
              <span style={styles.metaItem}>
                <UserIcon />
                {data.projektleiter || '-'}
              </span>
              <span style={styles.metaItem}>
                <BriefcaseIcon />
                {getProjectTypeLabel(data.project_type)}
              </span>
            </div>
          </div>

          <div style={styles.summaryContent}>
            {/* Stats */}
            <div style={styles.statsGrid}>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{(data.tasks || []).length}</div>
                <div style={styles.statLabel}>Hauptaufgaben</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{(data.milestones || []).length}</div>
                <div style={styles.statLabel}>Meilensteine</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{formatCurrency(totalBudget)}</div>
                <div style={styles.statLabel}>Budget</div>
              </div>
              <div style={styles.statCard}>
                <div style={styles.statValue}>{totalEffort} PT</div>
                <div style={styles.statLabel}>Aufwand</div>
              </div>
            </div>

            {/* Goals */}
            {data.goals && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <TargetIcon />
                  Projektziele
                </div>
                <div style={styles.sectionContent}>
                  {data.goals.split('\n').map((line, i) => (
                    <p key={i} style={{ marginBottom: theme.spacing.sm }}>{line}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Scope */}
            {data.scope && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <BoxIcon />
                  Projektumfang
                </div>
                <div style={styles.sectionContent}>{data.scope}</div>
              </div>
            )}

            {/* Milestones */}
            {(data.milestones || []).length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <FlagIcon />
                  Meilensteine
                </div>
                <div style={styles.timeline}>
                  {(data.milestones || [])
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(0, 5)
                    .map((ms, index) => (
                      <div key={index} style={styles.timelineItem}>
                        <div style={styles.timelineDot} />
                        <div style={styles.timelineContent}>
                          <span>{ms.name}</span>
                          <span style={styles.timelineDate}>{formatDate(ms.date)}</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Risks */}
            {(data.risks || []).length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <AlertIcon />
                  Risiken ({(data.risks || []).length})
                </div>
                <div>
                  {(data.risks || []).slice(0, 4).map((risk, index) => (
                    <div key={index} style={styles.riskItem}>
                      <span style={{ fontSize: theme.typography.sizes.sm }}>
                        {risk.description || risk.type || 'Unbenanntes Risiko'}
                      </span>
                      <span style={{ ...styles.badge, ...getRiskBadgeStyle(risk.impact) }}>
                        {getRiskLabel(risk.impact)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Team */}
            {(data.organization || []).length > 0 && (
              <div style={styles.section}>
                <div style={styles.sectionTitle}>
                  <UsersIcon />
                  Team ({(data.organization || []).length})
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                  {(data.organization || []).slice(0, 6).map((member, index) => (
                    <span key={index} style={{ ...styles.badge, ...styles.badgeInfo }}>
                      {member.name || 'Unbenannt'}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* KI-Gesamtbewertung (rechts) */}
        <div style={styles.gesamtbewertungCard}>
          <div style={styles.gesamtbewertungHeader}>
          <div style={styles.gesamtbewertungTitle}>
            <SparklesIcon />
            KI-Gesamtbewertung
          </div>
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing}
            style={{
              ...styles.analyzeButton,
              ...(isAnalyzing ? styles.analyzeButtonDisabled : {}),
            }}
          >
            {isAnalyzing ? (
              <>
                <LoadingSpinner />
                Analysiere...
              </>
            ) : gesamtbewertung ? (
              <>
                <RefreshIcon />
                Erneut bewerten
              </>
            ) : (
              <>
                <SparklesIcon />
                Gesamtbewertung starten
              </>
            )}
          </button>
        </div>

        <div style={styles.gesamtbewertungContent}>
          {error && (
            <div style={styles.errorState}>{error}</div>
          )}

          {isAnalyzing && (
            <div style={styles.loadingState}>
              <LoadingSpinner size={32} />
              <span>Erstelle Gesamtbewertung...</span>
              <span style={{ fontSize: theme.typography.sizes.xs }}>
                Dies kann einen Moment dauern
              </span>
            </div>
          )}

          {!isAnalyzing && !gesamtbewertung && !error && (
            <div style={styles.emptyState}>
              <div style={styles.emptyStateIcon}>
                <ChartIcon size={48} />
              </div>
              <p style={styles.emptyStateText}>
                Noch keine Gesamtbewertung durchgeführt
              </p>
              <p style={styles.emptyStateHint}>
                Klicken Sie oben auf "Gesamtbewertung starten", um eine umfassende KI-Analyse Ihres Projektauftrags zu erhalten.
              </p>
              {stepAnalyses && Object.keys(stepAnalyses).length > 0 ? (
                <div style={styles.analysisHintSuccess}>
                  <CheckCircleIcon color={theme.colors.success} />
                  <span>{Object.keys(stepAnalyses).length} Einzelschritt-Analyse(n) vorhanden - diese werden einbezogen.</span>
                </div>
              ) : (
                <div style={styles.analysisHintWarning}>
                  <InfoIcon color={theme.colors.warning} />
                  <span>Empfehlung: Führen Sie zuerst die KI-Analysen in den Schritten 2-7 durch für genauere Ergebnisse.</span>
                </div>
              )}
            </div>
          )}

          {gesamtbewertung && !isAnalyzing && (
            <>
              {/* Score Section */}
              <div style={styles.scoreSection}>
                <div style={styles.scoreCircle}>
                  <CircleProgress score={gesamtbewertung.gesamtScore} />
                  <div style={{ textAlign: 'center', zIndex: 1 }}>
                    <div style={{ ...styles.scoreValue, color: getScoreColor(gesamtbewertung.gesamtScore) }}>
                      {gesamtbewertung.gesamtScore}
                    </div>
                    <div style={styles.scoreLabel}>/ 100</div>
                  </div>
                </div>
                <div style={styles.scoreMeta}>
                  <div style={styles.projektreifeContainer}>
                    <span style={styles.projektreifeLabel}>Projektreife:</span>
                    <span style={{
                      ...styles.badge,
                      ...getProjekreifeStyle(gesamtbewertung.projektreife?.status),
                    }}>
                      {getProjektreifeLabel(gesamtbewertung.projektreife?.status)}
                    </span>
                  </div>
                  <p style={styles.projektreifeBegruendung}>
                    {gesamtbewertung.projektreife?.begruendung}
                  </p>
                </div>
              </div>

              {/* Step Scores Grid */}
              {gesamtbewertung.stepScores && gesamtbewertung.stepScores.length > 0 && (
                <div style={styles.stepScoresGrid}>
                  {gesamtbewertung.stepScores.map((step) => (
                    <div key={step.step} style={styles.stepScoreCard}>
                      <div style={styles.stepScoreHeader}>
                        <span style={styles.stepScoreName}>
                          Schritt {step.step}
                        </span>
                        <span style={{
                          ...styles.stepScoreValue,
                          color: getScoreColor(step.score),
                        }}>
                          {step.score}
                        </span>
                      </div>
                      <p style={styles.stepScoreFazit}>{step.kurzfazit}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Main Strengths */}
              {gesamtbewertung.hauptstaerken?.length > 0 && (
                <div style={styles.analysisSection}>
                  <div style={styles.analysisSectionTitle}>
                    <CheckCircleIcon color={theme.colors.success} />
                    Hauptstärken
                  </div>
                  {gesamtbewertung.hauptstaerken.map((item, idx) => (
                    <div key={idx} style={{ ...styles.analysisItem, ...styles.strengthItem }}>
                      <span style={styles.analysisItemIcon}>
                        <CheckIcon color={theme.colors.success} />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Main Risks */}
              {gesamtbewertung.hauptrisiken?.length > 0 && (
                <div style={styles.analysisSection}>
                  <div style={styles.analysisSectionTitle}>
                    <AlertTriangleIcon color={theme.colors.error} />
                    Hauptrisiken
                  </div>
                  {gesamtbewertung.hauptrisiken.map((item, idx) => (
                    <div key={idx} style={{ ...styles.analysisItem, ...styles.riskItem2 }}>
                      <span style={styles.analysisItemIcon}>
                        <AlertIcon2 color={theme.colors.error} />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Recommendations */}
              {gesamtbewertung.handlungsempfehlungen?.length > 0 && (
                <div style={styles.analysisSection}>
                  <div style={styles.analysisSectionTitle}>
                    <LightbulbIcon color={theme.colors.info} />
                    Handlungsempfehlungen
                  </div>
                  {gesamtbewertung.handlungsempfehlungen.map((item, idx) => (
                    <div key={idx} style={{ ...styles.analysisItem, ...styles.recommendationItem }}>
                      <span style={styles.analysisItemIcon}>
                        <ArrowRightIcon color={theme.colors.info} />
                      </span>
                      {item}
                    </div>
                  ))}
                </div>
              )}

              {/* Risk Assessment */}
              {gesamtbewertung.risikoeinschaetzung && (
                <div style={styles.risikoSection}>
                  <div style={styles.risikoHeader}>
                    <span style={{ fontWeight: theme.typography.weights.semibold }}>
                      Gesamtrisiko:
                    </span>
                    <span style={{
                      ...styles.risikoLevel,
                      ...getRisikoLevelStyle(gesamtbewertung.risikoeinschaetzung.level),
                    }}>
                      {getRisikoLabel(gesamtbewertung.risikoeinschaetzung.level)}
                    </span>
                  </div>
                  {gesamtbewertung.risikoeinschaetzung.faktoren?.length > 0 && (
                    <ul style={{ ...styles.list, marginLeft: theme.spacing.lg }}>
                      {gesamtbewertung.risikoeinschaetzung.faktoren.map((faktor, idx) => (
                        <li key={idx} style={{ marginBottom: theme.spacing.xs, fontSize: theme.typography.sizes.sm }}>
                          {faktor}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Timestamp */}
              <div style={styles.timestamp}>
                Bewertung vom {new Date(gesamtbewertung.timestamp).toLocaleString('de-DE')}
              </div>
            </>
          )}
        </div>
      </div>
      {/* End of twoColumnLayout */}
      </div>
    </div>
  );
}

// Icons
function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function BriefcaseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

function TargetIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="2" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  );
}

function FlagIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function CheckCircleIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

function SparklesIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l1.912 5.813a2 2 0 001.275 1.275L21 12l-5.813 1.912a2 2 0 00-1.275 1.275L12 21l-1.912-5.813a2 2 0 00-1.275-1.275L3 12l5.813-1.912a2 2 0 001.275-1.275L12 3z" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  );
}

function ChartIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

function LoadingSpinner({ size = 16 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 11-6.219-8.56" />
    </svg>
  );
}

function AlertTriangleIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function AlertIcon2({ color = 'currentColor' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

function LightbulbIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
    </svg>
  );
}

function ArrowRightIcon({ color = 'currentColor' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function CheckIcon({ color = 'currentColor' }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function InfoIcon({ color = 'currentColor' }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

// SVG Circle Progress component
function CircleProgress({ score }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getColor = (s) => {
    if (s >= 80) return theme.colors.success;
    if (s >= 60) return theme.colors.primary;
    if (s >= 40) return theme.colors.warning;
    return theme.colors.error;
  };

  return (
    <svg width="100" height="100" style={{ position: 'absolute' }}>
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={theme.colors.border}
        strokeWidth="8"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={getColor(score)}
        strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.5s ease' }}
      />
    </svg>
  );
}

export default Uebersicht;
