/**
 * StatusberichtRoadmap
 * Tracking for Milestones, Hauptaufgaben, Quality Gates
 * Each item: Soll/Ist-Datum, Status, Fortschritt, Ampel, Bemerkung
 */

import { useState } from 'react';
import { theme } from '../../../../config/theme';
import {
  MilestoneDiamondIcon,
  QualityGateShieldIcon,
} from '../RoadmapShapes';
import GanttRoadmap from '../GanttRoadmap';
import RoadmapModal from '../RoadmapModal';
import { toGanttItems } from '../roadmap-utils';

const AMPEL_COLORS = {
  gruen: theme.colors.success,
  gelb: theme.colors.warning,
  rot: theme.colors.error,
};

const DEFAULT_TRACKING = { fortschritt: 0, ampel: 'gruen', bemerkung: '', status: 'planned', ist_datum: '' };

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
  sectionLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.md,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  card: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  cardHighlight: {
    boxShadow: `0 0 0 2px ${theme.colors.primary}`,
    transition: `box-shadow ${theme.transitions.fast}`,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    flex: 1,
  },
  cardIndex: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginRight: theme.spacing.sm,
  },
  cardMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  fieldsRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    flexWrap: 'wrap',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  label: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weights.medium,
  },
  dateInput: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    outline: 'none',
    width: '140px',
  },
  select: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    cursor: 'pointer',
    width: '140px',
  },
  progressGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
    minWidth: '180px',
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
    width: '50px',
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
  sollIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.md,
    width: 'fit-content',
  },
  emptyState: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    padding: theme.spacing.xl,
    textAlign: 'center',
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
};

function StatusberichtRoadmap({ data, onChange, projektauftrag, config }) {
  const milestonesSnapshot = data.milestones_snapshot || [];
  const milestonesTracking = data.milestones_tracking || [];
  const tasksSnapshot = data.tasks_snapshot || [];
  const tasksTracking = data.tasks_tracking || [];
  const gatesSnapshot = data.quality_gates_snapshot || [];
  const gatesTracking = data.quality_gates_tracking || [];

  const [ganttOpen, setGanttOpen] = useState(false);
  const [highlightId, setHighlightId] = useState(null);

  // Gantt-Items aus Snapshots + Tracking (index-aligned).
  const ganttItems = toGanttItems({
    milestones: milestonesSnapshot,
    qualityGates: gatesSnapshot,
    tasks: tasksSnapshot,
    tracking: { milestones: milestonesTracking, gates: gatesTracking, tasks: tasksTracking },
  });
  const hasGantt = ganttItems.length > 0;

  const jumpToItem = (it) => {
    const domId = `gantt-${it.type}-${it.refId}`;
    setGanttOpen(false);
    setHighlightId(domId);
    requestAnimationFrame(() => {
      const el = document.getElementById(domId);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    setTimeout(() => setHighlightId((cur) => (cur === domId ? null : cur)), 2200);
  };

  const statusOptions = config?.roadmap_status || [
    { value: 'planned', label: 'Geplant' },
    { value: 'in_progress', label: 'In Bearbeitung' },
    { value: 'completed', label: 'Abgeschlossen' },
    { value: 'delayed', label: 'Verzögert' },
    { value: 'blocked', label: 'Blockiert' },
    { value: 'cancelled', label: 'Abgesagt' },
  ];

  // Drift detection
  const currentMilestones = projektauftrag?.milestones || [];
  const currentTasks = projektauftrag?.tasks || [];
  const currentGates = projektauftrag?.quality_gates || [];

  const hasMilestonesDrift = milestonesSnapshot.length > 0 && currentMilestones.length > 0 &&
    (milestonesSnapshot.length !== currentMilestones.length ||
     milestonesSnapshot.some((m, i) => m.name !== currentMilestones[i]?.name || m.date !== currentMilestones[i]?.date));
  const hasTasksDrift = tasksSnapshot.length > 0 && currentTasks.length > 0 &&
    (tasksSnapshot.length !== currentTasks.length ||
     tasksSnapshot.some((t, i) => t.name !== currentTasks[i]?.name));
  const hasGatesDrift = gatesSnapshot.length > 0 && currentGates.length > 0 &&
    (gatesSnapshot.length !== currentGates.length ||
     gatesSnapshot.some((g, i) => g.name !== currentGates[i]?.name || g.date !== currentGates[i]?.date));

  const handleChange = (trackingKey, index, field, value) => {
    const current = data[trackingKey] || [];
    const newTracking = [...current];
    newTracking[index] = { ...(newTracking[index] || DEFAULT_TRACKING), [field]: value };
    onChange({ [trackingKey]: newTracking });
  };

  const getProgressColor = (f) => {
    if (f >= 80) return theme.colors.success;
    if (f >= 40) return theme.colors.primary;
    return theme.colors.textMuted;
  };

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('de-DE') : '-';

  /**
   * Calculate linear expected progress for a task based on start/end date
   */
  const calculateSollProgress = (startDate, endDate) => {
    if (!startDate || !endDate) return null;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    const now = Date.now();
    if (now <= start) return 0;
    if (now >= end) return 100;
    return Math.round(((now - start) / (end - start)) * 100);
  };

  const renderTrackingCard = (key, title, subtitle, sollDatum, track, trackingKey, index, sollProgress, domId) => (
    <div key={key} id={domId} style={{ ...styles.card, ...(highlightId === domId ? styles.cardHighlight : {}) }}>
      <div style={styles.cardHeader}>
        <div style={{ flex: 1 }}>
          <div style={styles.cardTitle}>{title}</div>
          {subtitle && <div style={styles.cardMeta}>{subtitle}</div>}
        </div>
        {sollDatum && (
          <div style={styles.cardMeta}>Soll: {formatDate(sollDatum)}</div>
        )}
      </div>

      <div style={styles.fieldsRow}>
        {/* Status */}
        <div style={styles.fieldGroup}>
          <span style={styles.label}>Status</span>
          <select
            value={track.status || 'planned'}
            onChange={(e) => handleChange(trackingKey, index, 'status', e.target.value)}
            style={styles.select}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Ist-Datum */}
        <div style={styles.fieldGroup}>
          <span style={styles.label}>Ist-Datum</span>
          <input
            type="date"
            value={track.ist_datum || ''}
            onChange={(e) => handleChange(trackingKey, index, 'ist_datum', e.target.value)}
            style={styles.dateInput}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        </div>

        {/* Fortschritt */}
        <div style={styles.progressGroup}>
          <span style={styles.label}>Fortschritt</span>
          <div
            style={styles.progressBar}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = Math.round(((e.clientX - rect.left) / rect.width) * 100);
              handleChange(trackingKey, index, 'fortschritt', Math.max(0, Math.min(100, pct)));
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
            onChange={(e) => handleChange(trackingKey, index, 'fortschritt', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
            style={styles.progressInput}
          />
          <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>%</span>
        </div>

        {/* Ampel */}
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
                onClick={() => handleChange(trackingKey, index, 'ampel', ampelKey)}
                title={ampelKey.charAt(0).toUpperCase() + ampelKey.slice(1)}
              />
            );
          })}
        </div>
      </div>

      {/* Soll-Fortschritt Indikator fuer Aufgaben */}
      {sollProgress !== null && sollProgress !== undefined && (
        <div style={styles.sollIndicator}>
          <ClockIcon />
          Linearer Soll-Fortschritt: {sollProgress}%
          {track.fortschritt < sollProgress - 5 && (
            <span style={{ color: theme.colors.warning, marginLeft: theme.spacing.sm }}>
              ({track.fortschritt - sollProgress}% Abweichung)
            </span>
          )}
          {track.fortschritt >= sollProgress && (
            <span style={{ color: theme.colors.success, marginLeft: theme.spacing.sm }}>
              (im Plan)
            </span>
          )}
        </div>
      )}

      {/* Bemerkung */}
      <input
        type="text"
        value={track.bemerkung}
        onChange={(e) => handleChange(trackingKey, index, 'bemerkung', e.target.value)}
        placeholder="Bemerkung..."
        style={styles.bemerkungInput}
        onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
        onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
      />
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Roadmap</h2>
        <p style={styles.subtitle}>
          Verfolgen Sie Meilensteine, Hauptaufgaben und Quality Gates.
        </p>
      </div>

      {/* Drift Banners */}
      {hasMilestonesDrift && (
        <div style={styles.driftBanner}>
          <InfoIcon />
          Die Meilensteine im Projektauftrag wurden seit Erstellung dieses Berichts geändert.
        </div>
      )}
      {hasTasksDrift && (
        <div style={styles.driftBanner}>
          <InfoIcon />
          Die Hauptaufgaben im Projektauftrag wurden seit Erstellung dieses Berichts geändert.
        </div>
      )}
      {hasGatesDrift && (
        <div style={styles.driftBanner}>
          <InfoIcon />
          Die Quality Gates im Projektauftrag wurden seit Erstellung dieses Berichts geändert.
        </div>
      )}

      {/* Roadmap-Gantt (Soll/Ist mit Ampel) */}
      {hasGantt && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: theme.spacing.sm }}>
            <button
              type="button"
              onClick={() => setGanttOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
                padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                fontSize: theme.typography.sizes.xs,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                backgroundColor: 'transparent', color: theme.colors.textSecondary, cursor: 'pointer',
              }}
            >
              ⛶ Vollbild
            </button>
          </div>
          <GanttRoadmap
            items={ganttItems}
            rangeStart={projektauftrag?.start_date}
            rangeEnd={projektauftrag?.end_date}
            onItemClick={jumpToItem}
          />
        </div>
      )}
      <RoadmapModal
        open={ganttOpen}
        onClose={() => setGanttOpen(false)}
        title="Roadmap"
        items={ganttItems}
        rangeStart={projektauftrag?.start_date}
        rangeEnd={projektauftrag?.end_date}
        onItemClick={jumpToItem}
      />

      {/* Meilensteine */}
      <div>
        <div style={{ ...styles.sectionLabel, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <MilestoneDiamondIcon size={14} /> Meilensteine
        </div>
        <div style={styles.list}>
          {milestonesSnapshot.map((ms, index) => {
            const track = milestonesTracking[index] || DEFAULT_TRACKING;
            return renderTrackingCard(
              `ms-${index}`,
              <><span style={styles.cardIndex}>#{index + 1}</span>{ms.name}</>,
              ms.description || null,
              ms.date,
              track,
              'milestones_tracking',
              index,
              null,
              `gantt-milestone-${ms.id ?? index}`
            );
          })}
          {milestonesSnapshot.length === 0 && (
            <div style={styles.emptyState}>Keine Meilensteine im Projektauftrag definiert.</div>
          )}
        </div>
      </div>

      {/* Hauptaufgaben */}
      <div>
        <div style={styles.sectionLabel}>Hauptaufgaben</div>
        <div style={styles.list}>
          {tasksSnapshot.map((task, index) => {
            const track = tasksTracking[index] || DEFAULT_TRACKING;
            const sollProgress = calculateSollProgress(task.start_date, task.end_date);
            const dateRange = task.start_date && task.end_date
              ? `${formatDate(task.start_date)} – ${formatDate(task.end_date)}`
              : null;
            return renderTrackingCard(
              `task-${index}`,
              <><span style={styles.cardIndex}>#{index + 1}</span>{task.name}</>,
              [task.responsible, dateRange, task.effort ? `${task.effort}h` : null].filter(Boolean).join(' | '),
              task.end_date,
              track,
              'tasks_tracking',
              index,
              sollProgress,
              `gantt-task-${task.id ?? index}`
            );
          })}
          {tasksSnapshot.length === 0 && (
            <div style={styles.emptyState}>Keine Hauptaufgaben im Projektauftrag definiert.</div>
          )}
        </div>
      </div>

      {/* Quality Gates */}
      <div>
        <div style={{ ...styles.sectionLabel, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <QualityGateShieldIcon size={14} /> Quality Gates
        </div>
        <div style={styles.list}>
          {gatesSnapshot.map((gate, index) => {
            const track = gatesTracking[index] || DEFAULT_TRACKING;
            return renderTrackingCard(
              `gate-${index}`,
              gate.name,
              null,
              gate.date,
              track,
              'quality_gates_tracking',
              index,
              null,
              `gantt-gate-${gate.id ?? index}`
            );
          })}
          {gatesSnapshot.length === 0 && (
            <div style={styles.emptyState}>Keine Quality Gates im Projektauftrag definiert.</div>
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

function ClockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

export default StatusberichtRoadmap;
