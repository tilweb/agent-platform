/**
 * StatusberichtZiele
 * Read-only Projektziele + Kriterien-Tracking (Fortschritt, Ampel, Bemerkung)
 */

import { theme } from '../../../../config/theme';

const AMPEL_COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
};

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
  goalsSection: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
  },
  goalsLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.sm,
  },
  goalsText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: theme.typography.lineHeight.relaxed,
    whiteSpace: 'pre-wrap',
  },
  driftBanner: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.warning,
  },
  criteriaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  criterionCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  criterionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  criterionText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    flex: 1,
  },
  criterionIndex: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginRight: theme.spacing.sm,
  },
  trackingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  progressGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  progressBar: {
    flex: 1,
    height: '8px',
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    cursor: 'pointer',
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.borderRadius.full,
    transition: 'width 0.2s ease',
  },
  progressInput: {
    width: '60px',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    outline: 'none',
  },
  ampelGroup: {
    display: 'flex',
    gap: theme.spacing.xs,
  },
  ampelDot: {
    width: '24px',
    height: '24px',
    borderRadius: theme.borderRadius.full,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    border: '2px solid transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bemerkungInput: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    marginTop: theme.spacing.md,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
};

function StatusberichtZiele({ data, onChange, projektauftrag }) {
  const goalsTrack = data.goals_tracking || { fortschritt: 0, ampel: 'gruen', bemerkung: '' };
  const goalsSnapshot = data.goals_snapshot || projektauftrag?.goals || '';
  const tracking = data.criteria_tracking || [];
  const snapshot = data.criteria_snapshot || [];
  const currentGoals = projektauftrag?.goals || '';
  const currentCriteria = projektauftrag?.criteria || [];

  // Drift detection
  const hasGoalsDrift = goalsSnapshot && currentGoals && goalsSnapshot !== currentGoals;
  const hasCriteriaDrift = snapshot.length > 0 && currentCriteria.length > 0 &&
    (snapshot.length !== currentCriteria.length ||
     snapshot.some((s, i) => s !== currentCriteria[i]));

  const handleGoalsTrackingChange = (field, value) => {
    onChange({ goals_tracking: { ...goalsTrack, [field]: value } });
  };

  const handleTrackingChange = (index, field, value) => {
    const newTracking = [...tracking];
    newTracking[index] = { ...newTracking[index], [field]: value };
    onChange({ criteria_tracking: newTracking });
  };

  const getProgressColor = (fortschritt) => {
    if (fortschritt >= 80) return theme.colors.success;
    if (fortschritt >= 40) return theme.colors.primary;
    return theme.colors.textMuted;
  };

  // Reusable tracking card renderer
  const renderTrackingCard = (key, label, track, onFieldChange) => (
    <div key={key} style={styles.criterionCard}>
      <div style={styles.criterionHeader}>
        <span style={styles.criterionText}>{label}</span>
      </div>
      <div style={styles.trackingRow}>
        <div style={styles.progressGroup}>
          <span style={styles.label}>Fortschritt</span>
          <div
            style={styles.progressBar}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
              onFieldChange('fortschritt', Math.max(0, Math.min(100, pct)));
            }}
          >
            <div style={{
              ...styles.progressFill,
              width: `${track.fortschritt}%`,
              backgroundColor: getProgressColor(track.fortschritt),
            }} />
          </div>
          <input
            type="number"
            min="0"
            max="100"
            value={track.fortschritt}
            onChange={(e) => onFieldChange('fortschritt', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
            style={styles.progressInput}
          />
          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>%</span>
        </div>
        <div style={styles.ampelGroup}>
          {Object.entries(AMPEL_COLORS).map(([ampelKey, color]) => {
            const isSelected = track.ampel === ampelKey;
            return (
              <div
                key={ampelKey}
                style={{
                  ...styles.ampelDot,
                  backgroundColor: isSelected ? color : `${color}30`,
                  borderColor: isSelected ? color : 'transparent',
                }}
                onClick={() => onFieldChange('ampel', ampelKey)}
                title={ampelKey.charAt(0).toUpperCase() + ampelKey.slice(1)}
              />
            );
          })}
        </div>
      </div>
      <input
        type="text"
        value={track.bemerkung}
        onChange={(e) => onFieldChange('bemerkung', e.target.value)}
        placeholder="Bemerkung zum Fortschritt..."
        style={styles.bemerkungInput}
        onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
        onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
      />
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Ziele</h2>
        <p style={styles.subtitle}>
          Verfolgen Sie den Fortschritt der Projektziele und Erfolgskriterien.
        </p>
      </div>

      {/* Drift Banners */}
      {hasGoalsDrift && (
        <div style={styles.driftBanner}>
          <InfoIcon />
          Die Projektziele im Projektauftrag wurden seit Erstellung dieses Berichts geändert.
        </div>
      )}
      {hasCriteriaDrift && (
        <div style={styles.driftBanner}>
          <InfoIcon />
          Die Erfolgskriterien im Projektauftrag wurden seit Erstellung dieses Berichts geändert.
        </div>
      )}
      {/* Projektziele Tracking */}
      {goalsSnapshot && (
        <div>
          <div style={{
            ...styles.label,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: theme.spacing.md,
          }}>
            Projektziele
          </div>
          <div style={styles.criterionCard}>
            <div style={styles.goalsSection}>
              <div style={styles.goalsText}>{goalsSnapshot}</div>
            </div>
            <div style={{ ...styles.trackingRow, marginTop: theme.spacing.md }}>
              <div style={styles.progressGroup}>
                <span style={styles.label}>Fortschritt</span>
                <div
                  style={styles.progressBar}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
                    handleGoalsTrackingChange('fortschritt', Math.max(0, Math.min(100, pct)));
                  }}
                >
                  <div style={{
                    ...styles.progressFill,
                    width: `${goalsTrack.fortschritt}%`,
                    backgroundColor: getProgressColor(goalsTrack.fortschritt),
                  }} />
                </div>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={goalsTrack.fortschritt}
                  onChange={(e) => handleGoalsTrackingChange('fortschritt', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                  style={styles.progressInput}
                />
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>%</span>
              </div>
              <div style={styles.ampelGroup}>
                {Object.entries(AMPEL_COLORS).map(([ampelKey, color]) => {
                  const isSelected = goalsTrack.ampel === ampelKey;
                  return (
                    <div
                      key={ampelKey}
                      style={{
                        ...styles.ampelDot,
                        backgroundColor: isSelected ? color : `${color}30`,
                        borderColor: isSelected ? color : 'transparent',
                      }}
                      onClick={() => handleGoalsTrackingChange('ampel', ampelKey)}
                      title={ampelKey.charAt(0).toUpperCase() + ampelKey.slice(1)}
                    />
                  );
                })}
              </div>
            </div>
            <input
              type="text"
              value={goalsTrack.bemerkung}
              onChange={(e) => handleGoalsTrackingChange('bemerkung', e.target.value)}
              placeholder="Bemerkung zum Zielfortschritt..."
              style={styles.bemerkungInput}
              onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
              onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
            />
          </div>
        </div>
      )}

      {/* Erfolgskriterien Tracking */}
      <div>
        <div style={{
          ...styles.label,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: theme.spacing.md,
        }}>
          Erfolgskriterien
        </div>
        <div style={styles.criteriaList}>
          {snapshot.map((criterion, index) => {
            const track = tracking[index] || { fortschritt: 0, ampel: 'gruen', bemerkung: '' };
            return renderTrackingCard(
              index,
              <><span style={styles.criterionIndex}>#{index + 1}</span>{criterion}</>,
              track,
              (field, value) => handleTrackingChange(index, field, value)
            );
          })}
          {snapshot.length === 0 && (
            <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, padding: theme.spacing.xl, textAlign: 'center' }}>
              Keine Erfolgskriterien im Projektauftrag definiert.
            </div>
          )}
        </div>
      </div>

    </div>
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

export default StatusberichtZiele;
