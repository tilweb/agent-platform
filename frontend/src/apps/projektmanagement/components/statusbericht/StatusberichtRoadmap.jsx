/**
 * StatusberichtRoadmap
 * Tracking for Milestones, Hauptaufgaben, Quality Gates
 * Each item: Soll/Ist-Datum, Status, Fortschritt, Ampel, Bemerkung
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { theme } from '../../../../config/theme';

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

// ============== Soll/Ist Timeline ==============

const TL_CIRCLE_R = 14;
const TL_SOLL_Y = 30;
const TL_IST_Y = 70;
const TL_PADDING_X = 32;

function SollIstTimeline({ milestonesSnapshot, milestonesTracking, gatesSnapshot, gatesTracking }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  const [tooltip, setTooltip] = useState(null);

  // Combine milestones + gates with their tracking data
  const items = useMemo(() => {
    const ms = milestonesSnapshot
      .map((m, i) => ({
        ...m,
        _type: 'milestone',
        tracking: milestonesTracking[i] || {},
        _index: i,
      }))
      .filter((m) => m.name && m.date);

    const qg = gatesSnapshot
      .map((g, i) => ({
        ...g,
        _type: 'gate',
        tracking: gatesTracking[i] || {},
        _index: i,
      }))
      .filter((g) => g.name && g.date);

    return [...ms, ...qg]
      .map((item) => ({
        ...item,
        sollTs: new Date(item.date).getTime(),
        istTs: item.tracking.ist_datum ? new Date(item.tracking.ist_datum).getTime() : null,
      }))
      .sort((a, b) => a.sollTs - b.sollTs);
  }, [milestonesSnapshot, milestonesTracking, gatesSnapshot, gatesTracking]);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setWidth(entry.contentRect.width);
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (items.length < 2 || width === 0) {
    return (
      <div
        ref={containerRef}
        style={{ width: '100%', minHeight: items.length < 2 ? 0 : 1 }}
      />
    );
  }

  const svgW = width - 32;
  // Determine time range including Ist dates
  let allTimestamps = items.map((i) => i.sollTs);
  items.forEach((i) => { if (i.istTs) allTimestamps.push(i.istTs); });
  const minTs = Math.min(...allTimestamps);
  const maxTs = Math.max(...allTimestamps);
  const range = maxTs - minTs || 1;
  const usable = svgW - TL_PADDING_X * 2;
  const getX = (ts) => TL_PADDING_X + ((ts - minTs) / range) * usable;

  const hasAnyIst = items.some((i) => i.istTs);
  const svgHeight = hasAnyIst ? TL_IST_Y + TL_CIRCLE_R + 24 : TL_SOLL_Y + TL_CIRCLE_R + 24;
  const today = Date.now();

  const formatDate = (d) => new Date(d).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });

  // Separate counters
  let msCount = 0;
  let qgCount = 0;
  const layoutItems = items.map((item) => {
    const num = item._type === 'gate' ? ++qgCount : ++msCount;
    return { ...item, num, sollX: getX(item.sollTs), istX: item.istTs ? getX(item.istTs) : null };
  });

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.lg,
        padding: theme.spacing.lg,
        position: 'relative',
      }}
    >
      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: theme.spacing.lg,
        marginBottom: theme.spacing.md,
        fontSize: theme.typography.sizes.xs,
        color: theme.colors.textMuted,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
          <span style={{
            width: '20px', height: '2px',
            backgroundColor: theme.colors.border,
            display: 'inline-block',
          }} />
          Soll
        </span>
        {hasAnyIst && (
          <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
            <span style={{
              width: '20px', height: '2px',
              backgroundColor: theme.colors.textMuted,
              display: 'inline-block',
              borderTop: '2px dashed ' + theme.colors.textMuted,
              height: 0,
            }} />
            Ist
          </span>
        )}
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
          <span style={{
            width: '10px', height: '10px', borderRadius: theme.borderRadius.full,
            backgroundColor: theme.colors.primary, display: 'inline-block',
          }} />
          Meilenstein
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
          <span style={{
            width: '10px', height: '10px', backgroundColor: theme.colors.warning,
            display: 'inline-block', transform: 'rotate(45deg)',
          }} />
          Quality Gate
        </span>
      </div>

      <svg width={svgW} height={svgHeight} style={{ display: 'block' }}>
        {/* Soll line */}
        <line
          x1={TL_PADDING_X} y1={TL_SOLL_Y}
          x2={svgW - TL_PADDING_X} y2={TL_SOLL_Y}
          stroke={theme.colors.border} strokeWidth={2}
        />

        {/* Ist line (dashed) if any Ist dates exist */}
        {hasAnyIst && (
          <line
            x1={TL_PADDING_X} y1={TL_IST_Y}
            x2={svgW - TL_PADDING_X} y2={TL_IST_Y}
            stroke={theme.colors.border} strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {/* Row labels */}
        <text
          x={4} y={TL_SOLL_Y + 4}
          fill={theme.colors.textMuted} fontSize="9"
          fontFamily={theme.typography.fontFamily}
          fontWeight={theme.typography.weights.semibold}
        >
          SOLL
        </text>
        {hasAnyIst && (
          <text
            x={4} y={TL_IST_Y + 4}
            fill={theme.colors.textMuted} fontSize="9"
            fontFamily={theme.typography.fontFamily}
            fontWeight={theme.typography.weights.semibold}
          >
            IST
          </text>
        )}

        {/* Today marker on Soll line */}
        {today >= minTs && today <= maxTs && (
          <line
            x1={getX(today)} y1={TL_SOLL_Y - 12}
            x2={getX(today)} y2={hasAnyIst ? TL_IST_Y + 12 : TL_SOLL_Y + 12}
            stroke={theme.colors.warning} strokeWidth={2}
            strokeLinecap="round" strokeDasharray="3 3"
          />
        )}

        {/* Items */}
        {layoutItems.map((item) => {
          const ampelColor = AMPEL_COLORS[item.tracking.ampel] || theme.colors.primary;
          const isGate = item._type === 'gate';
          const fillColor = ampelColor;

          return (
            <g
              key={`${item._type}-${item._index}`}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => {
                const rect = containerRef.current.getBoundingClientRect();
                setTooltip({
                  name: item.name,
                  type: isGate ? 'Quality Gate' : 'Meilenstein',
                  sollDate: formatDate(item.date),
                  istDate: item.tracking.ist_datum ? formatDate(item.tracking.ist_datum) : null,
                  ampel: item.tracking.ampel,
                  status: item.tracking.status,
                  fortschritt: item.tracking.fortschritt,
                  description: item.description,
                  x: e.clientX - rect.left,
                  y: e.clientY - rect.top,
                });
              }}
              onMouseMove={(e) => {
                if (tooltip) {
                  const rect = containerRef.current.getBoundingClientRect();
                  setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
                }
              }}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* Connector line from Soll to Ist */}
              {item.istX !== null && (
                <line
                  x1={item.sollX} y1={TL_SOLL_Y + TL_CIRCLE_R}
                  x2={item.istX} y2={TL_IST_Y - TL_CIRCLE_R}
                  stroke={fillColor} strokeWidth={1}
                  strokeDasharray="3 3" opacity={0.5}
                />
              )}

              {/* Soll marker */}
              {isGate ? (
                <rect
                  x={item.sollX - TL_CIRCLE_R * 0.7}
                  y={TL_SOLL_Y - TL_CIRCLE_R * 0.7}
                  width={TL_CIRCLE_R * 1.4}
                  height={TL_CIRCLE_R * 1.4}
                  fill={fillColor}
                  transform={`rotate(45, ${item.sollX}, ${TL_SOLL_Y})`}
                />
              ) : (
                <circle cx={item.sollX} cy={TL_SOLL_Y} r={TL_CIRCLE_R} fill={fillColor} />
              )}
              <text
                x={item.sollX} y={TL_SOLL_Y + 4}
                textAnchor="middle" fill="#fff" fontSize="11"
                fontWeight={theme.typography.weights.semibold}
                fontFamily={theme.typography.fontFamily}
              >
                {item.num}
              </text>

              {/* Soll date label */}
              <text
                x={item.sollX} y={TL_SOLL_Y - TL_CIRCLE_R - 6}
                textAnchor="middle" fill={theme.colors.textMuted} fontSize="10"
                fontFamily={theme.typography.fontFamily}
              >
                {formatDate(item.date)}
              </text>

              {/* Ist marker (if exists) */}
              {item.istX !== null && (
                <>
                  {isGate ? (
                    <rect
                      x={item.istX - TL_CIRCLE_R * 0.6}
                      y={TL_IST_Y - TL_CIRCLE_R * 0.6}
                      width={TL_CIRCLE_R * 1.2}
                      height={TL_CIRCLE_R * 1.2}
                      fill={fillColor}
                      transform={`rotate(45, ${item.istX}, ${TL_IST_Y})`}
                      opacity={0.7}
                    />
                  ) : (
                    <circle cx={item.istX} cy={TL_IST_Y} r={TL_CIRCLE_R * 0.85} fill={fillColor} opacity={0.7} />
                  )}
                  <text
                    x={item.istX} y={TL_IST_Y + 3}
                    textAnchor="middle" fill="#fff" fontSize="10"
                    fontWeight={theme.typography.weights.medium}
                    fontFamily={theme.typography.fontFamily}
                  >
                    {item.num}
                  </text>
                  {/* Ist date label */}
                  <text
                    x={item.istX} y={TL_IST_Y + TL_CIRCLE_R + 14}
                    textAnchor="middle" fill={theme.colors.textMuted} fontSize="10"
                    fontFamily={theme.typography.fontFamily}
                  >
                    {formatDate(item.tracking.ist_datum)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          left: tooltip.x,
          top: tooltip.y - 12,
          transform: 'translate(-50%, -100%)',
          backgroundColor: theme.colors.text,
          color: theme.colors.surface,
          padding: `${theme.spacing.sm} ${theme.spacing.md}`,
          borderRadius: theme.borderRadius.md,
          fontSize: theme.typography.sizes.xs,
          maxWidth: '280px',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: theme.shadows.lg,
        }}>
          <div style={{ opacity: 0.6, fontSize: '10px', marginBottom: '2px' }}>{tooltip.type}</div>
          <div style={{ fontWeight: theme.typography.weights.semibold, fontSize: theme.typography.sizes.sm, marginBottom: '4px' }}>
            {tooltip.name}
          </div>
          {tooltip.description && (
            <div style={{ opacity: 0.8, lineHeight: 1.4, marginBottom: '4px' }}>{tooltip.description}</div>
          )}
          <div style={{ display: 'flex', gap: '12px', opacity: 0.9 }}>
            <span>Soll: {tooltip.sollDate}</span>
            {tooltip.istDate && <span>Ist: {tooltip.istDate}</span>}
          </div>
          {tooltip.fortschritt !== undefined && (
            <div style={{ opacity: 0.8, marginTop: '2px' }}>Fortschritt: {tooltip.fortschritt}%</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusberichtRoadmap({ data, onChange, projektauftrag, config }) {
  const milestonesSnapshot = data.milestones_snapshot || [];
  const milestonesTracking = data.milestones_tracking || [];
  const tasksSnapshot = data.tasks_snapshot || [];
  const tasksTracking = data.tasks_tracking || [];
  const gatesSnapshot = data.quality_gates_snapshot || [];
  const gatesTracking = data.quality_gates_tracking || [];

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

  const renderTrackingCard = (key, title, subtitle, sollDatum, track, trackingKey, index, sollProgress) => (
    <div key={key} style={styles.card}>
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

      {/* Soll/Ist Timeline */}
      <SollIstTimeline
        milestonesSnapshot={milestonesSnapshot}
        milestonesTracking={milestonesTracking}
        gatesSnapshot={gatesSnapshot}
        gatesTracking={gatesTracking}
      />

      {/* Meilensteine */}
      <div>
        <div style={styles.sectionLabel}>Meilensteine</div>
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
              null
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
              sollProgress
            );
          })}
          {tasksSnapshot.length === 0 && (
            <div style={styles.emptyState}>Keine Hauptaufgaben im Projektauftrag definiert.</div>
          )}
        </div>
      </div>

      {/* Quality Gates */}
      <div>
        <div style={styles.sectionLabel}>Quality Gates</div>
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
              null
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
