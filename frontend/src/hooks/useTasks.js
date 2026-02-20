/**
 * useTasks Hook
 *
 * Custom hook for managing background tasks with SSE streaming support.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiDelete, API_URL } from '../utils/apiFetch';

/**
 * @param {Object} options
 * @param {Function} options.onTaskCompleted - Callback when a task completes
 * @param {Function} options.onTaskFailed - Callback when a task fails
 * @param {Function} options.onTaskStarted - Callback when a task starts
 */
const DEFAULT_PAGE_SIZE = 10;

export function useTasks(options = {}) {
  const { onTaskCompleted, onTaskFailed, onTaskStarted, pageSize = DEFAULT_PAGE_SIZE } = options;
  const [tasks, setTasks] = useState([]);
  const [queueStatus, setQueueStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
  });
  const [pagination, setPagination] = useState({
    total: 0,
    offset: 0,
    hasMore: false,
    currentPage: 1,
  });
  const eventSourceRef = useRef(null);
  const callbacksRef = useRef({ onTaskCompleted, onTaskFailed, onTaskStarted });
  const paginationRef = useRef(pagination);

  // Current filter state
  const [filter, setFilter] = useState('all');
  const filterRef = useRef(filter);

  // Update refs when they change
  useEffect(() => {
    callbacksRef.current = { onTaskCompleted, onTaskFailed, onTaskStarted };
  }, [onTaskCompleted, onTaskFailed, onTaskStarted]);
  useEffect(() => { paginationRef.current = pagination; }, [pagination]);
  useEffect(() => { filterRef.current = filter; }, [filter]);

  // Load tasks with pagination and filter
  const loadTasks = useCallback(async (page = 1, statusFilter = filter) => {
    try {
      setLoading(true);
      setError(null);
      const offset = (page - 1) * pageSize;

      // Build query params
      const params = new URLSearchParams({
        limit: pageSize.toString(),
        offset: offset.toString(),
      });

      // Add status filter
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'active') {
          params.set('status', 'pending,queued,running,in_progress');
        } else {
          params.set('status', statusFilter);
        }
      }

      const response = await apiGet(`/tasks?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to load tasks');
      }
      const data = await response.json();
      setTasks(data.tasks || []);
      setPagination({
        total: data.total || 0,
        offset: data.offset || 0,
        hasMore: data.hasMore || false,
        currentPage: page,
      });
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      setError(err.message);
      console.error('Error loading tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [pageSize, filter]);

  // Go to specific page
  const goToPage = useCallback((page) => {
    if (page < 1) return;
    const maxPage = Math.ceil(pagination.total / pageSize);
    if (page > maxPage && maxPage > 0) return;
    loadTasks(page, filter);
  }, [loadTasks, pagination.total, pageSize, filter]);

  // Change filter and reset to page 1
  const changeFilter = useCallback((newFilter) => {
    setFilter(newFilter);
    loadTasks(1, newFilter);
  }, [loadTasks]);

  // Load queue status
  const loadQueueStatus = useCallback(async () => {
    try {
      const response = await apiGet('/tasks/queue');
      if (!response.ok) {
        throw new Error('Failed to load queue status');
      }
      const data = await response.json();
      setQueueStatus(data);
    } catch (err) {
      console.error('Error loading queue status:', err);
    }
  }, []);

  // Connect to global SSE stream (SSE doesn't support credentials in the same way)
  const connectStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Note: EventSource doesn't support credentials option, but it will send cookies
    // for same-origin requests automatically
    const eventSource = new EventSource(`${API_URL}/tasks/stream/all`, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      setQueueStatus(data);
    });

    eventSource.addEventListener('started', (e) => {
      const { taskId, task } = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      loadQueueStatus();
      loadTasks(paginationRef.current.currentPage, filterRef.current);
      if (callbacksRef.current.onTaskStarted) {
        callbacksRef.current.onTaskStarted(task);
      }
    });

    eventSource.addEventListener('progress', (e) => {
      const { taskId, task } = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
    });

    eventSource.addEventListener('completed', (e) => {
      const { taskId, task } = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      loadQueueStatus();
      loadTasks(paginationRef.current.currentPage, filterRef.current);
      if (callbacksRef.current.onTaskCompleted) {
        callbacksRef.current.onTaskCompleted(task);
      }
    });

    eventSource.addEventListener('failed', (e) => {
      const { taskId, task } = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      loadQueueStatus();
      loadTasks(paginationRef.current.currentPage, filterRef.current);
      if (callbacksRef.current.onTaskFailed) {
        callbacksRef.current.onTaskFailed(task);
      }
    });

    eventSource.addEventListener('cancelled', (e) => {
      const { taskId, task } = JSON.parse(e.data);
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      loadQueueStatus();
      loadTasks(paginationRef.current.currentPage, filterRef.current);
    });

    eventSource.onerror = () => {
      console.warn('SSE connection lost, reconnecting...');
      eventSource.close();
      setTimeout(connectStream, 3000);
    };

    return eventSource;
  }, [loadQueueStatus, loadTasks]);

  // Load on mount and connect stream
  useEffect(() => {
    loadTasks();
    loadQueueStatus();
    const es = connectStream();

    return () => {
      if (es) es.close();
    };
  }, [loadTasks, loadQueueStatus, connectStream]);

  // Polling fallback: refresh every 5s when there are active tasks
  const hasActiveTasks = stats.pending > 0 || stats.running > 0;
  useEffect(() => {
    if (!hasActiveTasks) return;
    const interval = setInterval(() => {
      loadTasks(pagination.currentPage, filter);
      loadQueueStatus();
    }, 5000);
    return () => clearInterval(interval);
  }, [hasActiveTasks, loadTasks, loadQueueStatus, pagination.currentPage, filter]);

  // Create a new task
  const createTask = useCallback(async (taskData) => {
    try {
      const response = await apiPost('/tasks', taskData);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create task');
      }

      const task = await response.json();
      setTasks(prev => [task, ...prev]);
      loadQueueStatus();
      return task;
    } catch (err) {
      console.error('Error creating task:', err);
      throw err;
    }
  }, [loadQueueStatus]);

  // Cancel a task
  const cancelTask = useCallback(async (taskId) => {
    try {
      const response = await apiPost(`/tasks/${taskId}/cancel`, {});

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to cancel task');
      }

      const task = await response.json();
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      loadQueueStatus();
      return task;
    } catch (err) {
      console.error('Error cancelling task:', err);
      throw err;
    }
  }, [loadQueueStatus]);

  // Retry a task
  const retryTask = useCallback(async (taskId) => {
    try {
      const response = await apiPost(`/tasks/${taskId}/retry`, {});

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to retry task');
      }

      const task = await response.json();
      setTasks(prev => prev.map(t => t.id === taskId ? task : t));
      loadQueueStatus();
      return task;
    } catch (err) {
      console.error('Error retrying task:', err);
      throw err;
    }
  }, [loadQueueStatus]);

  // Repeat a completed task (create new task with same data)
  const repeatTask = useCallback(async (task) => {
    return createTask({
      title: task.title,
      description: task.description || '',
      priority: task.priority || 'normal',
      type: task.type || 'simple',
      trigger: 'manual',
      assigned_agent: task.assigned_agent || 'researcher',
    });
  }, [createTask]);

  // Delete a task
  const deleteTask = useCallback(async (taskId) => {
    try {
      const response = await apiDelete(`/tasks/${taskId}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete task');
      }

      setTasks(prev => prev.filter(t => t.id !== taskId));
      loadQueueStatus();
      return true;
    } catch (err) {
      console.error('Error deleting task:', err);
      throw err;
    }
  }, [loadQueueStatus]);

  // Pause/Resume queue
  const pauseQueue = useCallback(async () => {
    try {
      const response = await apiPost('/tasks/queue/pause', {});
      if (!response.ok) throw new Error('Failed to pause queue');
      loadQueueStatus();
    } catch (err) {
      console.error('Error pausing queue:', err);
      throw err;
    }
  }, [loadQueueStatus]);

  const resumeQueue = useCallback(async () => {
    try {
      const response = await apiPost('/tasks/queue/resume', {});
      if (!response.ok) throw new Error('Failed to resume queue');
      loadQueueStatus();
    } catch (err) {
      console.error('Error resuming queue:', err);
      throw err;
    }
  }, [loadQueueStatus]);

  // Calculate total pages
  const totalPages = Math.ceil(pagination.total / pageSize);

  return {
    tasks,
    queueStatus,
    loading,
    error,
    stats,
    filter,
    changeFilter,
    pagination: {
      ...pagination,
      totalPages,
      pageSize,
    },
    refresh: () => loadTasks(pagination.currentPage, filter),
    goToPage,
    nextPage: () => goToPage(pagination.currentPage + 1),
    prevPage: () => goToPage(pagination.currentPage - 1),
    createTask,
    cancelTask,
    retryTask,
    repeatTask,
    deleteTask,
    pauseQueue,
    resumeQueue,
  };
}

/**
 * Hook for streaming a single task's updates
 */
export function useTaskStream(taskId) {
  const [task, setTask] = useState(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [events, setEvents] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (!taskId) return;

    const eventSource = new EventSource(`${API_URL}/tasks/${taskId}/stream`, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener('init', (e) => {
      const data = JSON.parse(e.data);
      setTask(data);
      setIsConnected(true);
    });

    eventSource.addEventListener('started', (e) => {
      const { task } = JSON.parse(e.data);
      setTask(task);
      setEvents(prev => [...prev, { type: 'started', time: new Date() }]);
    });

    eventSource.addEventListener('thinking', () => {
      setEvents(prev => [...prev, { type: 'thinking', time: new Date() }]);
    });

    eventSource.addEventListener('response', (e) => {
      const { content } = JSON.parse(e.data);
      if (content) {
        setStreamingContent(prev => prev + content);
      }
    });

    eventSource.addEventListener('tool_start', (e) => {
      const { tool, args } = JSON.parse(e.data);
      setEvents(prev => [...prev, { type: 'tool_start', tool, args, time: new Date() }]);
    });

    eventSource.addEventListener('tool_end', (e) => {
      const { tool, result } = JSON.parse(e.data);
      setEvents(prev => [...prev, { type: 'tool_end', tool, result, time: new Date() }]);
    });

    eventSource.addEventListener('delegation_start', (e) => {
      const { agent, task: delegatedTask } = JSON.parse(e.data);
      setEvents(prev => [...prev, { type: 'delegation_start', agent, task: delegatedTask, time: new Date() }]);
    });

    eventSource.addEventListener('delegation_end', (e) => {
      const { agent } = JSON.parse(e.data);
      setEvents(prev => [...prev, { type: 'delegation_end', agent, time: new Date() }]);
    });

    eventSource.addEventListener('progress', (e) => {
      const { task, progress } = JSON.parse(e.data);
      setTask(task);
      setEvents(prev => [...prev, { type: 'progress', progress, time: new Date() }]);
    });

    eventSource.addEventListener('completed', (e) => {
      const { task } = JSON.parse(e.data);
      setTask(task);
      setEvents(prev => [...prev, { type: 'completed', time: new Date() }]);
      eventSource.close();
    });

    eventSource.addEventListener('failed', (e) => {
      const { task, error } = JSON.parse(e.data);
      setTask(task);
      setEvents(prev => [...prev, { type: 'failed', error, time: new Date() }]);
      eventSource.close();
    });

    eventSource.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      eventSource.close();
    };
  }, [taskId]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      setIsConnected(false);
    }
  }, []);

  return {
    task,
    streamingContent,
    events,
    isConnected,
    disconnect,
  };
}
