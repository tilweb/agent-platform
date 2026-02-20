/**
 * TasksPage
 *
 * Page for managing and monitoring background tasks.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { theme } from '../config/theme';
import { useTasks, useTaskStream } from '../hooks/useTasks';
import { useToast } from '../components/Toast';
import { requestNotificationPermission, showBrowserNotification } from '../components/Toast';
import { apiGet } from '../utils/apiFetch';
import Select from '../components/Select';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper for relative time
function getRelativeTime(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  if (diffHour < 24) return `vor ${diffHour} Std.`;
  if (diffDay < 7) return `vor ${diffDay} Tag${diffDay > 1 ? 'en' : ''}`;
  return date.toLocaleDateString('de-DE');
}

// Helper for duration
function getDuration(startDate, endDate) {
  if (!startDate) return null;
  const start = new Date(startDate);
  const end = endDate ? new Date(endDate) : new Date();
  const diffMs = end - start;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);

  if (diffSec < 60) return `${diffSec}s`;
  if (diffMin < 60) return `${diffMin}m ${diffSec % 60}s`;
  return `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
}

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    width: '100%',
  },
  header: {
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  statsRow: {
    display: 'flex',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
    flexWrap: 'wrap',
  },
  statCard: {
    flex: '1 1 120px',
    minWidth: '120px',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  toolbarLeft: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  toolbarRight: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  button: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    whiteSpace: 'nowrap',
    transition: `all ${theme.transitions.fast}`,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  },
  dangerButton: {
    backgroundColor: theme.colors.error,
    color: 'white',
  },
  queueStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  taskList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  taskCard: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  taskCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  taskTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  taskDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  taskMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    textTransform: 'uppercase',
  },
  progressBar: {
    height: '4px',
    backgroundColor: theme.colors.border,
    borderRadius: '2px',
    marginTop: theme.spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    transition: 'width 0.3s ease',
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textSecondary,
  },
  // Modal system
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.xl,
    width: '90%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.xl,
  },
  modalFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  // Form fields
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    minHeight: '100px',
    resize: 'vertical',
    outline: 'none',
    fontFamily: 'inherit',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  // Detail modal sections
  detailSection: {
    marginBottom: theme.spacing.xl,
  },
  detailTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.md,
  },
  detailItem: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
  },
  detailLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  detailValue: {
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  streamContent: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    fontFamily: 'monospace',
    fontSize: theme.typography.sizes.sm,
    whiteSpace: 'pre-wrap',
    maxHeight: '300px',
    overflow: 'auto',
    border: `1px solid ${theme.colors.border}`,
  },
  markdownContent: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    maxHeight: '400px',
    overflow: 'auto',
    lineHeight: '1.6',
    border: `1px solid ${theme.colors.border}`,
  },
  eventsList: {
    maxHeight: '200px',
    overflow: 'auto',
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  eventItem: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontSize: theme.typography.sizes.xs,
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
  eventTime: {
    color: theme.colors.textMuted,
    minWidth: '60px',
    fontFamily: 'monospace',
  },
  eventType: {
    fontWeight: theme.typography.weights.medium,
    minWidth: '100px',
  },
  pagination: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.xl,
    paddingTop: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  pageButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    minWidth: '40px',
    textAlign: 'center',
  },
  pageButtonActive: {
    backgroundColor: theme.colors.primary,
    color: 'white',
    borderColor: theme.colors.primary,
  },
  pageButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  pageInfo: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    padding: `0 ${theme.spacing.md}`,
  },
};

const statusColors = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  queued: { bg: '#dbeafe', text: '#1e40af' },
  running: { bg: '#dcfce7', text: '#166534' },
  in_progress: { bg: '#dcfce7', text: '#166534' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  failed: { bg: '#fee2e2', text: '#991b1b' },
  cancelled: { bg: '#f3f4f6', text: '#4b5563' },
  paused: { bg: '#fef3c7', text: '#92400e' },
};

const priorityLabels = {
  low: 'Niedrig',
  normal: 'Normal',
  high: 'Hoch',
  urgent: 'Dringend',
};

function TasksPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission().then(setNotificationsEnabled);
  }, []);

  // Notification callbacks
  const handleTaskCompleted = useCallback((task) => {
    toast.success('Task abgeschlossen', task.title);
    if (notificationsEnabled && document.hidden) {
      showBrowserNotification('Task abgeschlossen', {
        body: task.title,
        tag: task.id,
      });
    }
  }, [toast, notificationsEnabled]);

  const handleTaskFailed = useCallback((task) => {
    toast.error('Task fehlgeschlagen', task.title);
    if (notificationsEnabled && document.hidden) {
      showBrowserNotification('Task fehlgeschlagen', {
        body: task.title,
        tag: task.id,
      });
    }
  }, [toast, notificationsEnabled]);

  const handleTaskStarted = useCallback((task) => {
    toast.task('Task gestartet', task.title);
  }, [toast]);

  const {
    tasks,
    queueStatus,
    loading,
    stats,
    filter,
    changeFilter,
    pagination,
    createTask,
    cancelTask,
    retryTask,
    repeatTask,
    deleteTask,
    pauseQueue,
    resumeQueue,
    refresh,
    goToPage,
    nextPage,
    prevPage,
  } = useTasks({
    onTaskCompleted: handleTaskCompleted,
    onTaskFailed: handleTaskFailed,
    onTaskStarted: handleTaskStarted,
    pageSize: 10,
  });

  const handleRepeatTask = async (task) => {
    try {
      await repeatTask(task);
      toast.success('Task erstellt', `"${task.title}" wurde erneut eingereiht`);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);

  // Handle URL parameter for opening a specific task
  useEffect(() => {
    const openTaskId = searchParams.get('open');
    if (openTaskId && tasks.length > 0) {
      const taskToOpen = tasks.find(t => t.id === openTaskId);
      if (taskToOpen) {
        setSelectedTask(taskToOpen);
        // Clear the URL parameter after opening
        searchParams.delete('open');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [tasks, searchParams, setSearchParams]);

  // Tasks are already filtered by the backend, just sort them
  const sortedTasks = [...tasks].sort((a, b) => {
    // Running first, then by date
    if (a.status === 'running' && b.status !== 'running') return -1;
    if (b.status === 'running' && a.status !== 'running') return 1;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <h1 style={styles.title}>Background Tasks</h1>
        <p style={styles.subtitle}>
          Verwalte und beobachte lang laufende Aufgaben
        </p>
      </div>

      {/* Stats */}
      <div style={styles.statsRow}>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: theme.colors.primary }}>{stats.total}</div>
          <div style={styles.statLabel}>Gesamt</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#f59e0b' }}>{stats.pending}</div>
          <div style={styles.statLabel}>Wartend</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#10b981' }}>{stats.running}</div>
          <div style={styles.statLabel}>Aktiv</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#6366f1' }}>{stats.completed}</div>
          <div style={styles.statLabel}>Fertig</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#ef4444' }}>{stats.failed}</div>
          <div style={styles.statLabel}>Fehler</div>
        </div>
      </div>

      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <button
            style={{ ...styles.button, ...styles.primaryButton }}
            onClick={() => setShowCreateModal(true)}
          >
            + Neuer Task
          </button>

          <Select
            value={filter}
            onChange={(e) => changeFilter(e.target.value)}
            options={[
              { value: 'all', label: 'Alle Tasks' },
              { value: 'active', label: 'Aktive' },
              { value: 'completed', label: 'Abgeschlossen' },
              { value: 'failed', label: 'Fehlgeschlagen' },
            ]}
            style={{ width: 'auto' }}
          />
        </div>

        <div style={styles.toolbarRight}>
          {queueStatus && (
            <div style={styles.queueStatus}>
              <div
                style={{
                  ...styles.statusDot,
                  backgroundColor: queueStatus.executor_running
                    ? (queueStatus.paused ? '#f59e0b' : '#10b981')
                    : '#ef4444',
                }}
              />
              <span>
                {queueStatus.executor_running
                  ? (queueStatus.paused ? 'Pausiert' : 'Aktiv')
                  : 'Gestoppt'}
              </span>
              {stats.running > 0 && (
                <span style={{ color: theme.colors.textMuted }}>
                  ({stats.running} laufend)
                </span>
              )}
            </div>
          )}

          {queueStatus?.paused ? (
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={resumeQueue}
            >
              Fortsetzen
            </button>
          ) : (
            <button
              style={{ ...styles.button, ...styles.secondaryButton }}
              onClick={pauseQueue}
            >
              Pausieren
            </button>
          )}

          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={refresh}
          >
            Aktualisieren
          </button>
        </div>
      </div>

      {/* Task List */}
      <div style={styles.taskList}>
        {loading && tasks.length === 0 ? (
          <div style={styles.emptyState}>Lade Tasks...</div>
        ) : sortedTasks.length === 0 ? (
          <div style={styles.emptyState}>
            <p>Keine Tasks vorhanden</p>
            <p style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.sm }}>
              Erstelle einen neuen Task um zu beginnen
            </p>
          </div>
        ) : (
          sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => setSelectedTask(task)}
              onCancel={() => cancelTask(task.id)}
              onRetry={() => retryTask(task.id)}
              onRepeat={() => handleRepeatTask(task)}
              onDelete={() => deleteTask(task.id)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <Pagination
          currentPage={pagination.currentPage}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={goToPage}
          onNext={nextPage}
          onPrev={prevPage}
        />
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateTaskModal
          onClose={() => setShowCreateModal(false)}
          onCreate={async (data) => {
            await createTask(data);
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onCancel={() => {
            cancelTask(selectedTask.id);
            setSelectedTask(null);
          }}
        />
      )}
    </div>
  );
}

function Pagination({ currentPage, totalPages, total, onPageChange, onNext, onPrev }) {
  // Generate page numbers to show
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate range around current page
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust range if at edges
      if (currentPage <= 2) {
        end = Math.min(4, totalPages - 1);
      } else if (currentPage >= totalPages - 1) {
        start = Math.max(2, totalPages - 3);
      }

      // Add ellipsis if needed
      if (start > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (end < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div style={styles.pagination}>
      <button
        style={{
          ...styles.pageButton,
          ...(currentPage === 1 ? styles.pageButtonDisabled : {}),
        }}
        onClick={onPrev}
        disabled={currentPage === 1}
      >
        &larr;
      </button>

      {getPageNumbers().map((page, idx) => (
        page === '...' ? (
          <span key={`ellipsis-${idx}`} style={styles.pageInfo}>...</span>
        ) : (
          <button
            key={page}
            style={{
              ...styles.pageButton,
              ...(page === currentPage ? styles.pageButtonActive : {}),
            }}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        )
      ))}

      <button
        style={{
          ...styles.pageButton,
          ...(currentPage === totalPages ? styles.pageButtonDisabled : {}),
        }}
        onClick={onNext}
        disabled={currentPage === totalPages}
      >
        &rarr;
      </button>

      <span style={styles.pageInfo}>
        {total} Task{total !== 1 ? 's' : ''} gesamt
      </span>
    </div>
  );
}

function TaskCard({ task, onClick, onCancel, onRetry, onRepeat, onDelete }) {
  const statusColor = statusColors[task.status] || statusColors.pending;
  const isRunning = task.status === 'running' || task.status === 'in_progress';
  const canCancel = ['pending', 'queued', 'running', 'in_progress'].includes(task.status);
  const canRetry = ['failed', 'cancelled'].includes(task.status);
  const canRepeat = task.status === 'completed';
  const canDelete = ['completed', 'failed', 'cancelled'].includes(task.status);

  return (
    <div
      style={styles.taskCard}
      onClick={onClick}
    >
      <div style={styles.taskCardHeader}>
        <div>
          <div style={styles.taskTitle}>{task.title}</div>
          {task.description && (
            <div style={styles.taskDescription}>
              {task.description.substring(0, 100)}
              {task.description.length > 100 ? '...' : ''}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
          <span
            style={{
              ...styles.statusBadge,
              backgroundColor: statusColor.bg,
              color: statusColor.text,
            }}
          >
            {task.status}
          </span>
          {canCancel && (
            <button
              style={{ ...styles.button, ...styles.dangerButton, padding: theme.spacing.sm }}
              onClick={(e) => { e.stopPropagation(); onCancel(); }}
            >
              Abbrechen
            </button>
          )}
          {canRetry && (
            <button
              style={{ ...styles.button, ...styles.primaryButton, padding: theme.spacing.sm }}
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
            >
              Wiederholen
            </button>
          )}
          {canRepeat && (
            <button
              style={{ ...styles.button, ...styles.primaryButton, padding: theme.spacing.sm }}
              onClick={(e) => { e.stopPropagation(); onRepeat(); }}
            >
              Wiederholen
            </button>
          )}
          {canDelete && (
            <button
              style={{ ...styles.button, ...styles.secondaryButton, padding: theme.spacing.sm }}
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              Löschen
            </button>
          )}
        </div>
      </div>

      <div style={styles.taskMeta}>
        <span title={task.priority}>{priorityLabels[task.priority] || task.priority}</span>
        {task.assigned_agent && (
          <span title="Agent">{task.assigned_agent}</span>
        )}
        <span title={new Date(task.created_at).toLocaleString('de-DE')}>
          {getRelativeTime(task.created_at)}
        </span>
        {task.started_at && (
          <span title="Dauer">
            {getDuration(task.started_at, task.completed_at)}
          </span>
        )}
        {task.result_summary && (
          <span style={{ flex: 1, textAlign: 'right', color: theme.colors.textSecondary }}>
            {task.result_summary.substring(0, 40)}...
          </span>
        )}
      </div>

      {isRunning && (
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${task.progress || 0}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function CreateTaskModal({ onClose, onCreate }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    priority: 'normal',
    type: 'simple',
    trigger: 'manual',
    assigned_agent: 'researcher',
  });
  const [submitting, setSubmitting] = useState(false);
  const [agents, setAgents] = useState([]);

  useEffect(() => {
    apiGet('/agents').then(res => res.json()).then(data => {
      const taskAgents = (data.agents || []).filter(a =>
        a.delegatable !== false && a.id !== '_router'
      );
      setAgents(taskAgents);
    }).catch(() => {});
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setSubmitting(true);
    try {
      await onCreate(formData);
    } catch (err) {
      console.error('Error creating task:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const isValid = formData.title.trim().length > 0;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div style={{ ...styles.modal, maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.modalHeader}>
          <h2 style={styles.modalTitle}>Neuen Task erstellen</h2>
          <button style={styles.modalCloseButton} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={styles.modalBody}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Titel *</label>
              <input
                style={styles.input}
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="z.B. Recherche zu AI Governance"
                autoFocus
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Beschreibung</label>
              <textarea
                style={styles.textarea}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Detaillierte Beschreibung der Aufgabe..."
              />
              <div style={styles.hint}>Je genauer die Beschreibung, desto besser das Ergebnis</div>
            </div>

            <div style={{ display: 'flex', gap: theme.spacing.lg }}>
              {agents.length > 0 && (
                <div style={{ ...styles.formGroup, flex: 1 }}>
                  <label style={styles.label}>Agent</label>
                  <Select
                    value={formData.assigned_agent}
                    onChange={(e) => setFormData({ ...formData, assigned_agent: e.target.value })}
                    options={agents.map(agent => ({ value: agent.id, label: agent.name }))}
                  />
                </div>
              )}

              <div style={{ ...styles.formGroup, flex: 1 }}>
                <label style={styles.label}>Priorität</label>
                <Select
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  options={[
                    { value: 'low', label: 'Niedrig' },
                    { value: 'normal', label: 'Normal' },
                    { value: 'high', label: 'Hoch' },
                    { value: 'urgent', label: 'Dringend' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={styles.modalFooter}>
            <button
              type="button"
              style={{
                padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                backgroundColor: 'transparent',
                color: theme.colors.text,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.lg,
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                cursor: 'pointer',
              }}
              onClick={onClose}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              style={{
                padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                backgroundColor: theme.colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: theme.borderRadius.lg,
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                cursor: isValid && !submitting ? 'pointer' : 'not-allowed',
                opacity: isValid && !submitting ? 1 : 0.5,
              }}
              disabled={submitting || !isValid}
            >
              {submitting ? 'Erstelle...' : 'Task erstellen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const statusLabels = {
  pending: 'Wartend',
  queued: 'In Warteschlange',
  running: 'Läuft',
  in_progress: 'Läuft',
  completed: 'Abgeschlossen',
  failed: 'Fehlgeschlagen',
  cancelled: 'Abgebrochen',
  paused: 'Pausiert',
};

function TaskDetailModal({ task, onClose, onCancel }) {
  const { task: liveTask, streamingContent, events, isConnected } = useTaskStream(
    task.status === 'running' || task.status === 'in_progress' ? task.id : null
  );

  const [fullResult, setFullResult] = useState(null);
  const [loadingResult, setLoadingResult] = useState(false);

  const displayTask = liveTask || task;
  const statusColor = statusColors[displayTask.status] || statusColors.pending;
  const isRunning = displayTask.status === 'running' || displayTask.status === 'in_progress';

  const loadFullResult = async () => {
    setLoadingResult(true);
    try {
      const res = await fetch(`${API_URL}/tasks/${displayTask.id}/result`);
      if (res.ok) {
        const data = await res.json();
        setFullResult(data.response);
      }
    } catch (err) {
      console.error('Failed to load full result:', err);
    } finally {
      setLoadingResult(false);
    }
  };

  const resultContent = fullResult || streamingContent || displayTask.result_summary;

  return (
    <div style={styles.modalOverlay} onClick={onClose}>
      <div
        style={{ ...styles.modal, maxWidth: '800px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.modalHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md, flex: 1, minWidth: 0 }}>
            <h2 style={{ ...styles.modalTitle, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {displayTask.title}
            </h2>
            <span
              style={{
                ...styles.statusBadge,
                backgroundColor: statusColor.bg,
                color: statusColor.text,
                flexShrink: 0,
              }}
            >
              {statusLabels[displayTask.status] || displayTask.status}
            </span>
            {isConnected && (
              <span style={{
                fontSize: theme.typography.sizes.xs,
                color: theme.colors.success,
                fontWeight: theme.typography.weights.medium,
                display: 'flex',
                alignItems: 'center',
                gap: theme.spacing.xs,
                flexShrink: 0,
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: theme.colors.success, display: 'inline-block' }} />
                Live
              </span>
            )}
          </div>
          <button style={styles.modalCloseButton} onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Body */}
        <div style={styles.modalBody}>
          {/* Description */}
          {displayTask.description && (
            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>Beschreibung</div>
              <p style={{ color: theme.colors.textSecondary, fontSize: theme.typography.sizes.sm, lineHeight: '1.6', margin: 0 }}>
                {displayTask.description}
              </p>
            </div>
          )}

          {/* Details Grid */}
          <div style={styles.detailSection}>
            <div style={styles.detailTitle}>Details</div>
            <div style={styles.detailGrid}>
              <div style={{ ...styles.detailItem, gridColumn: '1 / -1' }}>
                <div style={styles.detailLabel}>Task-ID</div>
                <code style={{
                  fontSize: theme.typography.sizes.xs,
                  color: theme.colors.textMuted,
                  fontFamily: 'monospace',
                  backgroundColor: theme.colors.surface,
                  padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                  borderRadius: theme.borderRadius.sm,
                  border: `1px solid ${theme.colors.border}`,
                  userSelect: 'all',
                }}>
                  {displayTask.id}
                </code>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>Agent</div>
                <div style={styles.detailValue}>{displayTask.assigned_agent || 'researcher'}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>Priorität</div>
                <div style={styles.detailValue}>{priorityLabels[displayTask.priority] || displayTask.priority}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>Erstellt</div>
                <div style={styles.detailValue}>{new Date(displayTask.created_at).toLocaleString('de-DE')}</div>
              </div>
              <div style={styles.detailItem}>
                <div style={styles.detailLabel}>Dauer</div>
                <div style={styles.detailValue}>
                  {displayTask.started_at
                    ? getDuration(displayTask.started_at, displayTask.completed_at)
                    : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Progress */}
          {isRunning && (
            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>Fortschritt</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                <div style={{ ...styles.progressBar, height: '8px', flex: 1 }}>
                  <div
                    style={{
                      ...styles.progressFill,
                      width: `${displayTask.progress || 0}%`,
                    }}
                  />
                </div>
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, minWidth: '36px', textAlign: 'right' }}>
                  {displayTask.progress || 0}%
                </span>
              </div>
            </div>
          )}

          {/* Result / Live Output */}
          {resultContent && (
            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>
                {isRunning ? 'Live Output' : 'Ergebnis'}
              </div>
              <div style={styles.markdownContent}>
                <ReactMarkdown>{resultContent}</ReactMarkdown>
              </div>
              {displayTask.status === 'completed' && !fullResult && displayTask.result_file && (
                <button
                  style={{
                    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                    backgroundColor: 'transparent',
                    color: theme.colors.primary,
                    border: `1px solid ${theme.colors.primary}30`,
                    borderRadius: theme.borderRadius.lg,
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.medium,
                    cursor: loadingResult ? 'not-allowed' : 'pointer',
                    marginTop: theme.spacing.md,
                  }}
                  onClick={loadFullResult}
                  disabled={loadingResult}
                >
                  {loadingResult ? 'Lädt...' : 'Vollständiges Ergebnis laden'}
                </button>
              )}
            </div>
          )}

          {/* Events */}
          {events.length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>Events ({events.length})</div>
              <div style={styles.eventsList}>
                {events.map((event, idx) => (
                  <div key={idx} style={styles.eventItem}>
                    <span style={styles.eventTime}>
                      {event.time.toLocaleTimeString('de-DE')}
                    </span>
                    <span style={styles.eventType}>{event.type}</span>
                    {event.tool && <span style={{ color: theme.colors.textSecondary }}>Tool: {event.tool}</span>}
                    {event.agent && <span style={{ color: theme.colors.textSecondary }}>Agent: {event.agent}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error */}
          {displayTask.error_message && (
            <div style={styles.detailSection}>
              <div style={styles.detailTitle}>Fehler</div>
              <div style={{
                padding: theme.spacing.lg,
                backgroundColor: `${theme.colors.error}08`,
                borderRadius: theme.borderRadius.lg,
                border: `1px solid ${theme.colors.error}20`,
                color: theme.colors.error,
                fontSize: theme.typography.sizes.sm,
                fontFamily: 'monospace',
                whiteSpace: 'pre-wrap',
              }}>
                {displayTask.error_message}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isRunning && (
          <div style={styles.modalFooter}>
            <button
              style={{
                padding: `${theme.spacing.md} ${theme.spacing.xl}`,
                backgroundColor: 'transparent',
                color: theme.colors.error,
                border: `1px solid ${theme.colors.error}30`,
                borderRadius: theme.borderRadius.lg,
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                cursor: 'pointer',
              }}
              onClick={onCancel}
            >
              Task abbrechen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default TasksPage;
