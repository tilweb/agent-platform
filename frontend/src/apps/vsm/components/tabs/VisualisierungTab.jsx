import { useMemo } from 'react';
import { theme } from '../../../../config/theme';

const COLORS = {
  process: { bg: '#dbeafe', border: '#3b82f6', text: '#1e40af' },
  lager: { bg: '#fef3c7', border: '#f59e0b', text: '#92400e' },
  puffer: { bg: '#f3e8ff', border: '#a855f7', text: '#6b21a8' },
  supplier: { bg: '#dcfce7', border: '#22c55e', text: '#166534' },
  customer: { bg: '#fce7f3', border: '#ec4899', text: '#9d174d' },
  info: { bg: '#e0f2fe', border: '#0ea5e9', text: '#0369a1' },
  timeline: { va: '#3b82f6', nva: '#ef4444' },
};

const NODE_WIDTH = 160;
const NODE_HEIGHT_PROCESS = 140;
const NODE_HEIGHT_STORAGE = 90;
const ARROW_GAP = 50;
const PADDING = 40;
const TIMELINE_Y = 60;

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    overflow: 'auto',
    height: '100%',
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
  },
  svgContainer: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'auto',
    padding: theme.spacing.lg,
  },
  legend: {
    display: 'flex',
    gap: theme.spacing.xl,
    marginTop: theme.spacing.lg,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  kpiCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    textAlign: 'center',
  },
  kpiValue: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  kpiLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

export default function VisualisierungTab({ vsmData }) {
  const steps = vsmData?.prozessschritte || [];
  const suppliers = vsmData?.lieferanten || [];
  const customer = vsmData?.kunde || {};
  const info = vsmData?.informationsfluss || {};

  const computed = useMemo(() => {
    if (steps.length === 0) return null;

    let totalCycleTime = 0;
    let totalLeadTimeDays = 0;
    let totalWip = 0;
    const processSteps = [];
    const storageSteps = [];

    for (const step of steps) {
      if (step.typ === 'Prozess') {
        totalCycleTime += (step.zykluszeit_min || 0);
        processSteps.push(step);
      } else {
        totalLeadTimeDays += (step.bestand_tage || 0);
        totalWip += (step.bestand_stueck || 0);
        storageSteps.push(step);
      }
    }

    const leadTimeDays = totalLeadTimeDays + (totalCycleTime / 480); // assume 480min/day
    const processEfficiency = leadTimeDays > 0 ? ((totalCycleTime / 480) / leadTimeDays * 100) : 0;
    const bottleneck = processSteps.find(s => s.engpass) || processSteps.sort((a, b) => (b.auslastung_prozent || 0) - (a.auslastung_prozent || 0))[0];

    return {
      totalCycleTime,
      totalLeadTimeDays: leadTimeDays,
      processEfficiency,
      totalWip,
      bottleneck,
      processCount: processSteps.length,
      storageCount: storageSteps.length,
    };
  }, [steps]);

  if (steps.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          Erfasse mindestens einen Prozessschritt im Tab "Eingabe", um die Visualisierung zu sehen.
        </div>
      </div>
    );
  }

  // Calculate SVG dimensions
  const nodeCount = steps.length;
  const extraNodes = 2; // supplier + customer
  const totalNodes = nodeCount + extraNodes;
  const svgWidth = Math.max(800, totalNodes * (NODE_WIDTH + ARROW_GAP) + PADDING * 2);
  const svgHeight = 480;
  const mainY = 120;

  // Build node positions
  const nodes = [];
  let currentX = PADDING;

  // Supplier node(s)
  nodes.push({
    type: 'supplier',
    x: currentX,
    y: mainY,
    label: suppliers.length > 0 ? suppliers.map(s => s.lieferant_name || '?').join(', ') : 'Lieferant',
    sublabel: suppliers.length > 0 ? `${suppliers.length} Lieferant${suppliers.length > 1 ? 'en' : ''}` : '',
  });
  currentX += NODE_WIDTH + ARROW_GAP;

  // Process steps
  for (const step of steps) {
    const isProcess = step.typ === 'Prozess';
    nodes.push({
      type: step.typ.toLowerCase(),
      x: currentX,
      y: mainY,
      step,
      label: step.bezeichnung || `Schritt ${step.schritt_nr}`,
    });
    currentX += NODE_WIDTH + ARROW_GAP;
  }

  // Customer node
  nodes.push({
    type: 'customer',
    x: currentX,
    y: mainY,
    label: customer.kundenname || 'Kunde',
    sublabel: customer.tagesbedarf_stueck ? `${customer.tagesbedarf_stueck} Stk/Tag` : '',
  });

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>Wertstrom-Visualisierung</h2>
      <p style={styles.subtitle}>IST-Zustand des Materialflusses</p>

      {computed && (
        <div style={styles.kpiRow}>
          <div style={styles.kpiCard}>
            <div style={styles.kpiValue}>{computed.totalLeadTimeDays.toFixed(1)} Tage</div>
            <div style={styles.kpiLabel}>Durchlaufzeit</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiValue}>{computed.totalCycleTime.toFixed(0)} min</div>
            <div style={styles.kpiLabel}>Wertschoepfungszeit</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={{ ...styles.kpiValue, color: computed.processEfficiency < 5 ? theme.colors.error : computed.processEfficiency < 20 ? theme.colors.warning : theme.colors.success }}>
              {computed.processEfficiency.toFixed(1)}%
            </div>
            <div style={styles.kpiLabel}>Prozesseffizienz</div>
          </div>
          <div style={styles.kpiCard}>
            <div style={styles.kpiValue}>{computed.totalWip} Stk</div>
            <div style={styles.kpiLabel}>WIP-Bestand</div>
          </div>
        </div>
      )}

      <div style={styles.svgContainer}>
        <svg width={svgWidth} height={svgHeight} viewBox={`0 0 ${svgWidth} ${svgHeight}`}>
          {/* Information flow line at top */}
          {info.produktionsplanung?.system && (
            <>
              <rect x={svgWidth / 2 - 100} y={15} width={200} height={30} rx={6}
                fill={COLORS.info.bg} stroke={COLORS.info.border} strokeWidth={1} />
              <text x={svgWidth / 2} y={35} textAnchor="middle" fontSize={11} fill={COLORS.info.text} fontWeight="600">
                {info.produktionsplanung.system || 'Produktionsplanung'}
              </text>
              {/* Info arrows to first and last process */}
              {nodes.length >= 3 && (
                <>
                  <line x1={svgWidth / 2 - 100} y1={30} x2={nodes[1].x + NODE_WIDTH / 2} y2={mainY}
                    stroke={COLORS.info.border} strokeWidth={1} strokeDasharray="4 3" markerEnd="url(#arrowInfo)" />
                  <line x1={svgWidth / 2 + 100} y1={30} x2={nodes[nodes.length - 2].x + NODE_WIDTH / 2} y2={mainY}
                    stroke={COLORS.info.border} strokeWidth={1} strokeDasharray="4 3" markerEnd="url(#arrowInfo)" />
                </>
              )}
            </>
          )}

          {/* Arrow markers */}
          <defs>
            <marker id="arrowBlack" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={8} markerHeight={8} orient="auto-start-auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
            </marker>
            <marker id="arrowInfo" viewBox="0 0 10 10" refX="9" refY="5" markerWidth={6} markerHeight={6} orient="auto-start-auto">
              <path d="M 0 0 L 10 5 L 0 10 z" fill={COLORS.info.border} />
            </marker>
          </defs>

          {/* Draw arrows between nodes */}
          {nodes.map((node, idx) => {
            if (idx === 0) return null;
            const prev = nodes[idx - 1];
            return (
              <line
                key={`arrow-${idx}`}
                x1={prev.x + NODE_WIDTH}
                y1={mainY + 50}
                x2={node.x}
                y2={mainY + 50}
                stroke="#94a3b8"
                strokeWidth={2}
                markerEnd="url(#arrowBlack)"
              />
            );
          })}

          {/* Draw nodes */}
          {nodes.map((node, idx) => {
            if (node.type === 'supplier') {
              return (
                <g key={idx}>
                  <rect x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT_STORAGE} rx={8}
                    fill={COLORS.supplier.bg} stroke={COLORS.supplier.border} strokeWidth={1.5} />
                  <text x={node.x + NODE_WIDTH / 2} y={node.y + 35} textAnchor="middle" fontSize={12} fontWeight="600" fill={COLORS.supplier.text}>
                    {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
                  </text>
                  {node.sublabel && (
                    <text x={node.x + NODE_WIDTH / 2} y={node.y + 55} textAnchor="middle" fontSize={10} fill={COLORS.supplier.text} opacity={0.7}>
                      {node.sublabel}
                    </text>
                  )}
                </g>
              );
            }

            if (node.type === 'customer') {
              return (
                <g key={idx}>
                  <rect x={node.x} y={node.y} width={NODE_WIDTH} height={NODE_HEIGHT_STORAGE} rx={8}
                    fill={COLORS.customer.bg} stroke={COLORS.customer.border} strokeWidth={1.5} />
                  <text x={node.x + NODE_WIDTH / 2} y={node.y + 35} textAnchor="middle" fontSize={12} fontWeight="600" fill={COLORS.customer.text}>
                    {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
                  </text>
                  {node.sublabel && (
                    <text x={node.x + NODE_WIDTH / 2} y={node.y + 55} textAnchor="middle" fontSize={10} fill={COLORS.customer.text} opacity={0.7}>
                      {node.sublabel}
                    </text>
                  )}
                </g>
              );
            }

            const step = node.step;
            const isProcess = step.typ === 'Prozess';
            const colors = isProcess ? COLORS.process : step.typ === 'Lager' ? COLORS.lager : COLORS.puffer;
            const nodeHeight = isProcess ? NODE_HEIGHT_PROCESS : NODE_HEIGHT_STORAGE;
            const isBottleneck = step.engpass;

            return (
              <g key={idx}>
                {/* Node box */}
                <rect x={node.x} y={node.y} width={NODE_WIDTH} height={nodeHeight} rx={8}
                  fill={colors.bg} stroke={isBottleneck ? '#ef4444' : colors.border} strokeWidth={isBottleneck ? 2.5 : 1.5} />

                {/* Title */}
                <text x={node.x + NODE_WIDTH / 2} y={node.y + 20} textAnchor="middle" fontSize={11} fontWeight="700" fill={colors.text}>
                  {node.label.length > 18 ? node.label.substring(0, 16) + '...' : node.label}
                </text>

                {isProcess ? (
                  <>
                    {/* Divider line */}
                    <line x1={node.x + 8} y1={node.y + 28} x2={node.x + NODE_WIDTH - 8} y2={node.y + 28}
                      stroke={colors.border} strokeWidth={0.5} opacity={0.5} />

                    {/* KPIs */}
                    <text x={node.x + 10} y={node.y + 45} fontSize={9} fill={colors.text}>ZZ: {step.zykluszeit_min || 0} min</text>
                    <text x={node.x + 10} y={node.y + 60} fontSize={9} fill={colors.text}>RZ: {step.ruestzeit_min || 0} min</text>
                    <text x={node.x + 10} y={node.y + 75} fontSize={9} fill={colors.text}>VF: {step.verfuegbarkeit_prozent || 0}%</text>
                    <text x={node.x + 10} y={node.y + 90} fontSize={9} fill={colors.text}>AS: {step.ausschuss_prozent || 0}%</text>
                    <text x={node.x + 10} y={node.y + 105} fontSize={9} fill={colors.text}>MA: {step.mitarbeiter_anzahl || 0}</text>
                    {step.auslastung_prozent > 0 && (
                      <text x={node.x + 10} y={node.y + 120} fontSize={9} fill={colors.text}>AL: {step.auslastung_prozent}%</text>
                    )}

                    {/* Bottleneck marker */}
                    {isBottleneck && (
                      <>
                        <rect x={node.x + NODE_WIDTH - 55} y={node.y + 4} width={48} height={16} rx={8}
                          fill="#fef2f2" stroke="#ef4444" strokeWidth={1} />
                        <text x={node.x + NODE_WIDTH - 31} y={node.y + 15} textAnchor="middle" fontSize={8} fontWeight="700" fill="#dc2626">
                          ENGPASS
                        </text>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {/* Storage KPIs */}
                    <text x={node.x + NODE_WIDTH / 2} y={node.y + 45} textAnchor="middle" fontSize={10} fill={colors.text}>
                      {step.bestand_stueck || 0} Stk
                    </text>
                    <text x={node.x + NODE_WIDTH / 2} y={node.y + 62} textAnchor="middle" fontSize={10} fill={colors.text}>
                      {step.bestand_tage || 0} Tage
                    </text>
                  </>
                )}
              </g>
            );
          })}

          {/* Timeline at bottom */}
          {(() => {
            const timelineY = mainY + NODE_HEIGHT_PROCESS + 40;
            const timelineStartX = nodes[1]?.x || PADDING;
            const timelineEndX = nodes[nodes.length - 2]?.x + NODE_WIDTH || svgWidth - PADDING;

            return (
              <g>
                <line x1={timelineStartX} y1={timelineY} x2={timelineEndX} y2={timelineY} stroke="#cbd5e1" strokeWidth={1} />
                <text x={timelineStartX - 5} y={timelineY - 10} fontSize={10} fill={theme.colors.textMuted} fontWeight="600">
                  Timeline
                </text>

                {steps.map((step, idx) => {
                  const nodeIdx = idx + 1; // offset for supplier node
                  const nodeX = nodes[nodeIdx]?.x || 0;
                  const isProcess = step.typ === 'Prozess';
                  const duration = isProcess ? (step.zykluszeit_min || 0) : (step.bestand_tage || 0);
                  const unit = isProcess ? 'min' : 'Tage';
                  const barWidth = Math.max(20, Math.min(NODE_WIDTH - 10, duration * (isProcess ? 2 : 10)));
                  const barColor = isProcess ? COLORS.timeline.va : COLORS.timeline.nva;

                  return (
                    <g key={`tl-${idx}`}>
                      <rect x={nodeX + 5} y={timelineY + 5} width={NODE_WIDTH - 10} height={18} rx={3}
                        fill={barColor} opacity={0.15} />
                      <rect x={nodeX + 5} y={timelineY + 5} width={Math.min(barWidth, NODE_WIDTH - 10)} height={18} rx={3}
                        fill={barColor} opacity={0.6} />
                      <text x={nodeX + NODE_WIDTH / 2} y={timelineY + 18} textAnchor="middle" fontSize={9} fill={barColor} fontWeight="600">
                        {duration} {unit}
                      </text>
                    </g>
                  );
                })}

                {/* Summary */}
                {computed && (
                  <g>
                    <text x={timelineStartX} y={timelineY + 45} fontSize={11} fill={COLORS.timeline.va} fontWeight="600">
                      Wertschoepfung: {computed.totalCycleTime.toFixed(0)} min
                    </text>
                    <text x={timelineStartX + 250} y={timelineY + 45} fontSize={11} fill={COLORS.timeline.nva} fontWeight="600">
                      Liegezeit: {(computed.totalLeadTimeDays - computed.totalCycleTime / 480).toFixed(1)} Tage
                    </text>
                    <text x={timelineStartX + 500} y={timelineY + 45} fontSize={11} fill={theme.colors.text} fontWeight="700">
                      Effizienz: {computed.processEfficiency.toFixed(1)}%
                    </text>
                  </g>
                )}
              </g>
            );
          })()}
        </svg>
      </div>

      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.process.bg, border: `1px solid ${COLORS.process.border}` }} />
          <span>Prozess</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.lager.bg, border: `1px solid ${COLORS.lager.border}` }} />
          <span>Lager</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.puffer.bg, border: `1px solid ${COLORS.puffer.border}` }} />
          <span>Puffer</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.supplier.bg, border: `1px solid ${COLORS.supplier.border}` }} />
          <span>Lieferant</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.customer.bg, border: `1px solid ${COLORS.customer.border}` }} />
          <span>Kunde</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, border: `2px solid #ef4444` }} />
          <span>Engpass</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.timeline.va, opacity: 0.6 }} />
          <span>Wertschoepfung</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: COLORS.timeline.nva, opacity: 0.6 }} />
          <span>Liegezeit</span>
        </div>
      </div>
    </div>
  );
}
