import { useState, useCallback, useRef, useEffect } from 'react';
import { validateFiles } from '../utils/fileValidation';

const API_URL = import.meta.env.VITE_API_URL || '/api';

export function useStreaming() {
  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [agentStatus, setAgentStatus] = useState(null);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const [error, setError] = useState(null);
  const [activeTasks, setActiveTasks] = useState([]);  // Tasks created in this session
  const [fileProcessingState, setFileProcessingState] = useState({});  // fileId -> 'processing' | 'ready'

  const eventSourceRef = useRef(null);
  const sessionIdRef = useRef(null);
  const accumulatedContentRef = useRef('');
  const accumulatedReasoningRef = useRef('');
  const onDoneRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const addMessage = useCallback((role, content, metadata = {}) => {
    setMessages(prev => [...prev, { role, content, timestamp: Date.now(), thinkingSteps: role === 'assistant' ? [] : undefined, ...metadata }]);
  }, []);

  const updateLastMessage = useCallback((content) => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content,
        };
      }
      return updated;
    });
  }, []);

  const updateLastMessageReasoning = useCallback((reasoning) => {
    setMessages(prev => {
      const updated = [...prev];
      if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          reasoning,
        };
      }
      return updated;
    });
  }, []);

  const addThinkingStep = useCallback((step) => {
    setMessages(prev => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === 'assistant') {
        updated[updated.length - 1] = {
          ...last,
          thinkingSteps: [...(last.thinkingSteps || []), { ...step, timestamp: Date.now() }],
        };
      }
      return updated;
    });
  }, []);

  const sendMessage = useCallback(async (userMessage, options = {}) => {
    const { agentId, autoRoute = true, files, skillId, readers, preparedSessionId, spaceId } = options;

    // If a preparedSessionId is provided, use it (from prepare-readers call)
    if (preparedSessionId && !sessionIdRef.current) {
      sessionIdRef.current = preparedSessionId;
      console.log(`[useStreaming] Using prepared session ID: ${preparedSessionId}`);
    }

    // Allow sending with files even if message is empty
    const hasContent = userMessage?.trim() || (files && files.length > 0);
    if (!hasContent || isStreaming) return;

    setError(null);
    setIsStreaming(true);

    // Add user message to list
    // Don't add [Anhang: ...] text - attachments are now rendered as separate UI elements
    addMessage('user', userMessage || '');

    // Add placeholder for assistant response
    addMessage('assistant', '', { agentId: null, reasoning: '' });
    accumulatedContentRef.current = '';
    accumulatedReasoningRef.current = '';

    try {
      // Prepare request body - use FormData if files are present
      let requestBody;
      let requestHeaders = {};

      if (files && files.length > 0) {
        // Validate files before upload
        const validation = validateFiles(files);
        if (!validation.valid) {
          setError(validation.errors.join('\n'));
          setIsStreaming(false);
          return;
        }

        // Use FormData for file uploads
        const formData = new FormData();
        formData.append('message', userMessage || 'Analysiere diese Dateien.');
        if (sessionIdRef.current) {
          formData.append('sessionId', sessionIdRef.current);
        }
        if (agentId) {
          formData.append('agentId', agentId);
        }
        if (skillId) {
          formData.append('skillId', skillId);
        }
        formData.append('autoRoute', autoRoute.toString());
        if (readers && readers.length > 0) {
          formData.append('readers', JSON.stringify(readers));
        }
        if (spaceId) {
          formData.append('spaceId', spaceId);
        }

        // Append all files
        files.forEach(file => {
          formData.append('files', file);
        });

        requestBody = formData;
        // Don't set Content-Type header - browser will set it with boundary
      } else {
        // Use JSON for regular messages
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = JSON.stringify({
          message: userMessage,
          sessionId: sessionIdRef.current,
          agentId,
          autoRoute,
          skillId,
          readers,
          spaceId,
        });
      }

      // Start chat request
      const response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: requestHeaders,
        body: requestBody,
        credentials: 'include',  // Include cookies for authentication
      });

      if (!response.ok) {
        throw new Error('Failed to start chat');
      }

      const data = await response.json();
      const { sessionId, agentId: selectedAgentId, routedBy, attachments: responseAttachments } = data;
      sessionIdRef.current = sessionId;
      console.log('[useStreaming] Response data:', data);
      console.log('[useStreaming] responseAttachments:', responseAttachments);

      // Set the active agent
      if (selectedAgentId) {
        setActiveAgentId(selectedAgentId);
      }

      // Update messages in a single call to avoid React batching issues
      // - Add attachments to user message (if any)
      // - Add agent info to assistant message (if any)
      setMessages(prev => {
        const updated = [...prev];

        // Add attachments to the last user message
        if (responseAttachments && responseAttachments.length > 0) {
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'user') {
              updated[i] = {
                ...updated[i],
                attachments: responseAttachments,
              };
              break;
            }
          }
        }

        // Add agent info to the last assistant message
        if (selectedAgentId && updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            agentId: selectedAgentId,
            routedBy,
          };
        }

        return updated;
      });

      // Connect to SSE stream
      const eventSource = new EventSource(`${API_URL}/chat/${sessionId}/stream`);
      eventSourceRef.current = eventSource;

      eventSource.addEventListener('model_info', (e) => {
        const data = JSON.parse(e.data);
        addThinkingStep({
          type: 'model_info',
          message: `${data.providerName} / ${data.modelName}`,
          providerName: data.providerName,
          modelName: data.modelName,
        });
      });

      eventSource.addEventListener('agent_selected', (e) => {
        const data = JSON.parse(e.data);
        setActiveAgentId(data.agentId);
        addThinkingStep({ type: 'agent_selected', message: `Agent ausgewählt: ${data.agentId}`, agentId: data.agentId });
      });

      eventSource.addEventListener('skill_activated', (e) => {
        const data = JSON.parse(e.data);
        setAgentStatus({
          type: 'skill',
          message: `Skill: ${data.skillName}`,
          skillId: data.skillId,
          skillName: data.skillName,
          tools: data.tools,
          error: data.error,
          totalSteps: data.totalSteps,
        });
        addThinkingStep({ type: 'skill', message: `Skill: ${data.skillName}`, skillName: data.skillName });
        // Update message with skill info
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              skillId: data.skillId,
              skillName: data.skillName,
              totalSteps: data.totalSteps,
            };
          }
          return updated;
        });
      });

      eventSource.addEventListener('workflow_step', (e) => {
        const data = JSON.parse(e.data);
        setAgentStatus({
          type: 'workflow',
          message: `Schritt ${data.stepIndex + 1}/${data.totalSteps}: ${data.stepDescription || data.stepAction}`,
          skillId: data.skillId,
          stepIndex: data.stepIndex,
          stepAction: data.stepAction,
          stepDescription: data.stepDescription,
          totalSteps: data.totalSteps,
          progress: data.progress,
        });
        addThinkingStep({
          type: 'workflow',
          message: `Schritt ${data.stepIndex + 1}/${data.totalSteps}: ${data.stepDescription || data.stepAction}`,
          stepIndex: data.stepIndex,
          totalSteps: data.totalSteps,
        });
      });

      eventSource.addEventListener('thinking', () => {
        setAgentStatus({ type: 'thinking', message: 'Thinking...' });
        addThinkingStep({ type: 'thinking', message: 'Denkt nach...' });
      });

      eventSource.addEventListener('tool_start', (e) => {
        const data = JSON.parse(e.data);
        setAgentStatus({
          type: 'tool',
          message: `Using tool: ${data.tool}`,
          tool: data.tool,
          args: data.args,
        });
        let parsedArgs = data.args;
        try { parsedArgs = typeof data.args === 'string' ? JSON.parse(data.args) : data.args; } catch { /* ignore parse errors */ }
        addThinkingStep({ type: 'tool', message: data.tool, tool: data.tool, args: parsedArgs });
      });

      eventSource.addEventListener('tool_end', (e) => {
        const data = JSON.parse(e.data);
        setAgentStatus({
          type: 'tool_complete',
          message: `Tool completed: ${data.tool}`,
          tool: data.tool,
          result: data.result,
        });
        addThinkingStep({ type: 'tool_complete', message: data.tool, tool: data.tool, result: data.result });
      });

      eventSource.addEventListener('delegation_start', (e) => {
        const data = JSON.parse(e.data);
        setAgentStatus({
          type: 'delegation',
          message: `Delegating to ${data.agentId}: ${data.task}`,
          agentId: data.agentId,
          task: data.task,
        });
        addThinkingStep({ type: 'delegation', message: `Delegiert an: ${data.agentId}`, detail: data.task, agentId: data.agentId, task: data.task });
      });

      eventSource.addEventListener('delegation_end', (e) => {
        const data = JSON.parse(e.data);
        setAgentStatus({
          type: 'delegation_complete',
          message: `Delegation to ${data.agentId} completed`,
          agentId: data.agentId,
          result: data.result,
        });
        addThinkingStep({ type: 'delegation_complete', message: `Delegation an ${data.agentId} abgeschlossen`, detail: data.result, agentId: data.agentId, result: data.result });
        // Clear delegation status after a brief moment
        setTimeout(() => setAgentStatus(null), 500);
      });

      eventSource.addEventListener('sub_agent_step', (e) => {
        const data = JSON.parse(e.data);
        setAgentStatus({
          type: 'sub_agent',
          message: `${data.agentId}: ${data.message}`,
          agentId: data.agentId,
          stepType: data.stepType,
        });
        addThinkingStep({
          type: 'sub_agent_step',
          message: data.message,
          agentId: data.agentId,
          stepType: data.stepType,
        });
      });

      eventSource.addEventListener('task_created', (e) => {
        const data = JSON.parse(e.data);
        addThinkingStep({
          type: 'task_created',
          message: `Task erstellt: ${data.taskTitle}`,
          taskId: data.taskId,
          taskTitle: data.taskTitle,
        });
        // Add to active tasks for TaskStatusBlock
        setActiveTasks(prev => [...prev, { taskId: data.taskId, taskTitle: data.taskTitle }]);
      });

      // Handle file processing status updates
      eventSource.addEventListener('file_processing', (e) => {
        const data = JSON.parse(e.data);
        setFileProcessingState(prev => ({
          ...prev,
          [data.fileId]: data.status,
        }));
        // Also track by filename as fallback
        if (data.filename) {
          setFileProcessingState(prev => ({
            ...prev,
            [data.filename]: data.status,
          }));
        }
      });

      eventSource.addEventListener('response_chunk', (e) => {
        const data = JSON.parse(e.data);
        if (data.content) {
          accumulatedContentRef.current += data.content;
          updateLastMessage(accumulatedContentRef.current);
        }
        // Clear agent status when streaming content
        setAgentStatus(null);
      });

      eventSource.addEventListener('reasoning_chunk', (e) => {
        const data = JSON.parse(e.data);
        if (data.reasoning) {
          accumulatedReasoningRef.current += data.reasoning;
          updateLastMessageReasoning(accumulatedReasoningRef.current);
          // Update agent status to show reasoning is happening
          setAgentStatus({ type: 'reasoning', message: 'Denkt nach...' });
        }
      });

      eventSource.addEventListener('done', () => {
        setIsStreaming(false);
        setAgentStatus(null);
        eventSource.close();
        eventSourceRef.current = null;
        if (onDoneRef.current) onDoneRef.current();
      });

      eventSource.addEventListener('error', (e) => {
        try {
          const data = JSON.parse(e.data);
          setError(data.error || 'Stream error');
        } catch {
          setError('Connection error');
        }
        setIsStreaming(false);
        setAgentStatus(null);
        eventSource.close();
        eventSourceRef.current = null;
      });

      eventSource.onerror = () => {
        // Always close and clean up — don't let EventSource silently auto-reconnect
        // during an active stream, which leaves the UI stuck in "streaming" state
        eventSource.close();
        eventSourceRef.current = null;
        setIsStreaming(false);
        setAgentStatus(null);
      };

    } catch (err) {
      setError(err.message);
      setIsStreaming(false);
      setAgentStatus(null);
      // Remove the empty assistant message
      setMessages(prev => prev.slice(0, -1));
    }
  }, [isStreaming, addMessage, updateLastMessage, updateLastMessageReasoning, addThinkingStep]);

  const loadExistingChat = useCallback((chatMessages, sessionId) => {
    // Load messages from a saved chat (without thinkingSteps)
    const loaded = chatMessages.map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: Date.now(),
      agentId: msg.agentId || null,
      routedBy: msg.routedBy || null,
      attachments: msg.attachments || null,  // Preserve attachments from saved chat
      ...(msg.role === 'assistant' ? { thinkingSteps: [] } : {}),
    }));
    setMessages(loaded);
    sessionIdRef.current = sessionId;
    setActiveAgentId(null);
    setError(null);
    setActiveTasks([]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    sessionIdRef.current = null;
    setActiveAgentId(null);
    setActiveTasks([]);
    setFileProcessingState({});  // Reset file processing state
  }, []);

  // Callback when a task completes - adds result as new message and removes from active tasks
  const onTaskCompleted = useCallback((taskId, taskTitle, result) => {
    // Add result as a new assistant message
    const resultMessage = `**Task abgeschlossen: ${taskTitle}**\n\n${result}\n\n[Vollständiges Ergebnis anzeigen](/tasks?open=${taskId})`;
    addMessage('assistant', resultMessage, { isTaskResult: true, taskId });

    // Remove from active tasks
    setActiveTasks(prev => prev.filter(t => t.taskId !== taskId));
  }, [addMessage]);

  return {
    messages,
    isStreaming,
    agentStatus,
    activeAgentId,
    error,
    sendMessage,
    clearMessages,
    loadExistingChat,
    sessionId: sessionIdRef.current,
    getSessionId: () => sessionIdRef.current,
    sessionIdRef,
    activeTasks,
    onTaskCompleted,
    fileProcessingState,  // Map of fileId/filename -> 'processing' | 'ready'
  };
}
