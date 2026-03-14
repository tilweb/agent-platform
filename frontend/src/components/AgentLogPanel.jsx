import { useState, useEffect, useRef, useMemo } from 'react';
import { theme } from '../config/theme';
import { apiGet } from '../utils/apiFetch';

const EVENT_CONFIG = {
  system_prompt: { icon: 'P', color: theme.colors.info, label: 'Prompt' },
  context_loaded: { icon: 'C', color: theme.colors.thinking, label: 'Kontext' },
  iteration_start: { icon: '#', color: theme.colors.textSecondary, label: 'Iteration' },
  agent_selected: { icon: 'A', color: theme.colors.primary, label: 'Agent' },
  model_info: { icon: 'M', color: theme.colors.textSecondary, label: 'Model' },
  thinking: { icon: 'T', color: theme.colors.thinking, label: 'Thinking' },
  tool_start: { icon: 'W', color: theme.colors.toolUse, label: 'Tool' },
  tool_end: { icon: '\u2713', color: theme.colors.toolUse, label: 'Tool' },
  delegation_start: { icon: 'D', color: theme.colors.delegation, label: 'Delegation' },
  delegation_end: { icon: '\u2713', color: theme.colors.delegation, label: 'Delegation' },
  sub_agent_step: { icon: 'S', color: theme.colors.delegation, label: 'Sub-Agent' },
  skill_activated: { icon: 'K', color: theme.colors.thinking, label: 'Skill' },
  workflow_step: { icon: 'W', color: theme.colors.thinking, label: 'Workflow' },
  task_created: { icon: '+', color: theme.colors.info, label: 'Task' },
  response_start: { icon: 'R', color: theme.colors.success, label: 'Response' },
  done: { icon: '\u2713', color: theme.colors.success, label: 'Fertig' },
  error: { icon: '!', color: theme.colors.error, label: 'Fehler' },
};

const FILTERS = [
  { id: 'all', label: 'Alle', types: null },
  { id: 'prompt', label: 'Prompt', types: ['system_prompt', 'context_loaded'] },
  { id: 'tools', label: 'Tools', types: ['tool_start', 'tool_end'] },
  { id: 'flow', label: 'Flow', types: ['iteration_start', 'thinking', 'agent_selected', 'model_info', 'delegation_start', 'delegation_end', 'done', 'error'] },
  { id: 'skills', label: 'Skills', types: ['skill_activated', 'workflow_step'] },
];

const EXPANDABLE_TYPES = new Set([
  'system_prompt', 'context_loaded', 'tool_start', 'tool_end',
  'delegation_start', 'delegation_end', 'error', 'skill_activated',
  'task_created', 'sub_agent_step',
]);

function formatTime(timestamp) {
  const d = new Date(timestamp);
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatChars(n) {
  if (n >= 1024) return `${Math.round(n / 1024)}k`;
  return `${n}`;
}

function truncate(str, max = 500) {
  if (!str || str.length <= max) return str;
  return str.slice(0, max) + '...';
}

/** Render detail view for system_prompt entries */
function SystemPromptDetail({ data }) {
  if (!data) return null;
  const sections = data.sections || [];
  return (
    <div>
      <div style={{ marginBottom: theme.spacing.xs }}>
        {sections.map((s, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, padding: '1px 0' }}>
            <span>{s.name}</span>
            <span style={{ fontFamily: theme.typography.fontMono, color: theme.colors.textMuted }}>{formatChars(s.charLength)}</span>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, borderTop: `1px solid ${theme.colors.border}`, marginTop: theme.spacing.xs, paddingTop: theme.spacing.xs }}>
          <span>Gesamt</span>
          <span style={{ fontFamily: theme.typography.fontMono }}>{formatChars(data.totalChars || 0)}</span>
        </div>
      </div>
      {data.content && (
        <details style={{ marginTop: theme.spacing.xs }}>
          <summary style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.primary, cursor: 'pointer' }}>Vollständiger Prompt</summary>
          <pre style={styles.promptBlock}>{data.content}</pre>
        </details>
      )}
    </div>
  );
}

/** Render detail view for context_loaded entries */
function ContextDetail({ data }) {
  if (!data) return null;
  return (
    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary }}>
      <span style={{ fontFamily: theme.typography.fontMono }}>{data.contextType}</span>
      {data.length != null && <span> — {formatChars(data.length)} Zeichen</span>}
      {data.preview && (
        <div style={{ fontStyle: 'italic', marginTop: theme.spacing.xs, color: theme.colors.textMuted }}>{truncate(data.preview, 300)}</div>
      )}
    </div>
  );
}

/** Render detail view for tool events */
function ToolDetail({ data, eventType }) {
  if (!data) return null;
  if (eventType === 'tool_start') {
    let args = data.args;
    if (typeof args === 'string') {
      try { args = JSON.parse(args); } catch {}
    }
    return (
      <pre style={styles.detailBlock}>{typeof args === 'object' ? JSON.stringify(args, null, 2) : String(args)}</pre>
    );
  }
  // tool_end
  return (
    <div>
      {data.durationMs != null && (
        <span style={{ fontSize: theme.typography.sizes.xs, fontFamily: theme.typography.fontMono, color: theme.colors.toolUse, fontWeight: theme.typography.weights.medium }}>
          {data.durationMs}ms
        </span>
      )}
      {data.result && (
        <pre style={styles.detailBlock}>{truncate(typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2), 500)}</pre>
      )}
    </div>
  );
}

/** Render detail view for skill_activated */
function SkillDetail({ data }) {
  if (!data) return null;
  return (
    <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary }}>
      {data.tools && data.tools.length > 0 && (
        <div>Tools: {data.tools.join(', ')}</div>
      )}
      {data.instructions && (
        <details style={{ marginTop: theme.spacing.xs }}>
          <summary style={{ color: theme.colors.primary, cursor: 'pointer' }}>Anweisungen</summary>
          <pre style={styles.detailBlock}>{data.instructions}</pre>
        </details>
      )}
    </div>
  );
}

/** Render detail view for delegation */
function DelegationDetail({ data, eventType }) {
  if (!data) return null;
  if (eventType === 'delegation_start') {
    return (
      <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary }}>
        {data.task && <div>{data.task}</div>}
      </div>
    );
  }
  return (
    <div>
      {data.durationMs != null && (
        <span style={{ fontSize: theme.typography.sizes.xs, fontFamily: theme.typography.fontMono, color: theme.colors.delegation, fontWeight: theme.typography.weights.medium }}>
          {data.durationMs}ms
        </span>
      )}
      {data.result && (
        <pre style={styles.detailBlock}>{truncate(typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2), 500)}</pre>
      )}
    </div>
  );
}

/** Fallback detail renderer */
function DefaultDetail({ data }) {
  if (!data || Object.keys(data).length === 0) return null;
  try {
    return <pre style={styles.detailBlock}>{JSON.stringify(data, null, 2)}</pre>;
  } catch {
    return <pre style={styles.detailBlock}>{String(data)}</pre>;
  }
}

function renderDetail(entry) {
  const { eventType, data } = entry;
  switch (eventType) {
    case 'system_prompt': return <SystemPromptDetail data={data} />;
    case 'context_loaded': return <ContextDetail data={data} />;
    case 'tool_start':
    case 'tool_end': return <ToolDetail data={data} eventType={eventType} />;
    case 'skill_activated': return <SkillDetail data={data} />;
    case 'delegation_start':
    case 'delegation_end': return <DelegationDetail data={data} eventType={eventType} />;
    default: return <DefaultDetail data={data} />;
  }
}

const styles = {
  container: {
    width: '400px',
    minWidth: '400px',
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.lg,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  badge: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    minWidth: '20px',
    textAlign: 'center',
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '28px',
    height: '28px',
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    fontSize: theme.typography.sizes.md,
  },
  filterBar: {
    display: 'flex',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
    overflowX: 'auto',
  },
  filterPill: {
    padding: `2px ${theme.spacing.sm}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    borderRadius: theme.borderRadius.full,
    border: 'none',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    whiteSpace: 'nowrap',
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.sm,
  },
  emptyState: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  agentGroupHeader: {
    padding: `${theme.spacing.sm} ${theme.spacing.sm}`,
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderTop: `1px solid ${theme.colors.border}`,
  },
  iterationDivider: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    marginTop: theme.spacing.sm,
    borderTop: `2px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textSecondary,
  },
  entry: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'default',
    transition: `background-color ${theme.transitions.fast}`,
  },
  entryClickable: {
    cursor: 'pointer',
  },
  iconBadge: {
    width: '22px',
    height: '22px',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: theme.typography.weights.bold,
    flexShrink: 0,
    marginTop: '1px',
  },
  entryContent: {
    flex: 1,
    minWidth: 0,
  },
  entryMessage: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  entryTime: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
    flexShrink: 0,
    marginTop: '2px',
  },
  detailBlock: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontMono,
    color: theme.colors.textSecondary,
    maxHeight: '200px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    border: `1px solid ${theme.colors.border}`,
  },
  promptBlock: {
    marginTop: theme.spacing.xs,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontFamily: theme.typography.fontMono,
    color: theme.colors.textSecondary,
    maxHeight: '400px',
    overflowY: 'auto',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
    border: `1px solid ${theme.colors.border}`,
  },
};

export default function AgentLogPanel({ agentLog, isStreaming, onClose, getSessionId }) {
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [activeFilter, setActiveFilter] = useState('all');
  const [backendLog, setBackendLog] = useState([]);
  const [fetchedSessionId, setFetchedSessionId] = useState(null);
  const contentRef = useRef(null);
  const prevLengthRef = useRef(0);

  // Fetch backend log when session changes
  const sessionId = getSessionId?.();
  useEffect(() => {
    if (sessionId && sessionId !== fetchedSessionId) {
      apiGet(`/chat/${sessionId}/agent-log`)
        .then(res => res.json())
        .then(data => {
          setBackendLog(data.entries || []);
          setFetchedSessionId(sessionId);
        })
        .catch(() => {
          setBackendLog([]);
          setFetchedSessionId(sessionId);
        });
    }
  }, [sessionId, fetchedSessionId]);

  // Merge: backend log as base, append live events that aren't in backend yet
  const mergedLog = useMemo(() => {
    if (backendLog.length === 0) return agentLog;
    if (agentLog.length === 0) return backendLog;

    // Backend entries have string IDs (alog_...), live entries have numeric IDs
    // Use backend as base, then append live entries that arrived after last backend entry
    const lastBackendTime = backendLog.length > 0
      ? new Date(backendLog[backendLog.length - 1].timestamp).getTime()
      : 0;

    const liveOnly = agentLog.filter(e => e.timestamp > lastBackendTime);
    return [...backendLog, ...liveOnly];
  }, [backendLog, agentLog]);

  // Apply filter
  const filteredLog = useMemo(() => {
    const filterConfig = FILTERS.find(f => f.id === activeFilter);
    if (!filterConfig || !filterConfig.types) return mergedLog;
    return mergedLog.filter(e => filterConfig.types.includes(e.eventType));
  }, [mergedLog, activeFilter]);

  // Auto-scroll to bottom when streaming and new entries arrive
  useEffect(() => {
    const totalLength = filteredLog.length;
    if (isStreaming && totalLength > prevLengthRef.current && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
    prevLengthRef.current = totalLength;
  }, [filteredLog.length, isStreaming]);

  const toggleExpand = (id) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Re-fetch when streaming ends (to get full backend data)
  useEffect(() => {
    if (!isStreaming && sessionId && fetchedSessionId === sessionId) {
      const timer = setTimeout(() => {
        apiGet(`/chat/${sessionId}/agent-log`)
          .then(res => res.json())
          .then(data => {
            setBackendLog(data.entries || []);
          })
          .catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, sessionId, fetchedSessionId]);

  const renderEntries = () => {
    if (filteredLog.length === 0) {
      return (
        <div style={styles.emptyState}>
          Noch keine Events. Starte einen Chat um den Agent Log zu sehen.
        </div>
      );
    }

    const elements = [];
    let lastAgentId = null;

    filteredLog.forEach((entry) => {
      const entryId = entry.id;

      // Iteration divider
      if (entry.eventType === 'iteration_start') {
        const data = entry.data || {};
        elements.push(
          <div key={`iter-${entryId}`} style={styles.iterationDivider}>
            <span>Iteration {data.iteration || '?'}/{data.maxIterations || '?'}</span>
            <span style={{ fontWeight: theme.typography.weights.normal, fontFamily: theme.typography.fontMono }}>
              {data.messagesCount != null ? `${data.messagesCount} Msgs` : ''}
              {data.toolsCount != null ? ` | ${data.toolsCount} Tools` : ''}
            </span>
          </div>
        );
        return;
      }

      // Insert agent group header when agent changes
      if (entry.agentId && entry.agentId !== lastAgentId) {
        lastAgentId = entry.agentId;
        elements.push(
          <div key={`agent-header-${entryId}`} style={{
            ...styles.agentGroupHeader,
            ...(elements.length === 0 ? { marginTop: 0, borderTop: 'none' } : {}),
          }}>
            {entry.agentId}
          </div>
        );
      }

      const config = EVENT_CONFIG[entry.eventType] || { icon: '?', color: theme.colors.textMuted, label: 'Event' };
      const isExpandable = EXPANDABLE_TYPES.has(entry.eventType) && entry.data && Object.keys(entry.data).length > 0;
      const isExpanded = expandedIds.has(entryId);

      elements.push(
        <div
          key={entryId}
          style={{
            ...styles.entry,
            ...(isExpandable ? styles.entryClickable : {}),
          }}
          onClick={isExpandable ? () => toggleExpand(entryId) : undefined}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <div style={{
            ...styles.iconBadge,
            backgroundColor: `${config.color}18`,
            color: config.color,
          }}>
            {config.icon}
          </div>
          <div style={styles.entryContent}>
            <div style={{
              ...styles.entryMessage,
              ...(entry.eventType === 'error' ? { color: theme.colors.error } : {}),
              ...(entry.eventType === 'done' ? { color: theme.colors.success, fontWeight: theme.typography.weights.medium } : {}),
            }}>
              {entry.message}
              {isExpandable && (
                <span style={{ color: theme.colors.textMuted, marginLeft: theme.spacing.xs, fontSize: theme.typography.sizes.xs }}>
                  {isExpanded ? '\u25BC' : '\u25B6'}
                </span>
              )}
            </div>
            {isExpanded && (
              <div style={{ marginTop: theme.spacing.xs }}>
                {renderDetail(entry)}
              </div>
            )}
          </div>
          <div style={styles.entryTime}>
            {formatTime(entry.timestamp)}
          </div>
        </div>
      );
    });

    return elements;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          Agent Log
          {mergedLog.length > 0 && (
            <span style={styles.badge}>{mergedLog.length}</span>
          )}
        </div>
        <button
          style={styles.closeButton}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textMuted;
          }}
          title="Schliessen"
        >
          {'\u2715'}
        </button>
      </div>
      <div style={styles.filterBar}>
        {FILTERS.map(f => {
          const isActive = activeFilter === f.id;
          return (
            <button
              key={f.id}
              style={{
                ...styles.filterPill,
                backgroundColor: isActive ? theme.colors.primaryLight : 'transparent',
                color: isActive ? theme.colors.primary : theme.colors.textMuted,
              }}
              onClick={() => setActiveFilter(f.id)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>
      <div style={styles.content} ref={contentRef}>
        {renderEntries()}
      </div>
    </div>
  );
}
