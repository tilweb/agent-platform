/**
 * ProjectChatPage
 *
 * Chat page with project context injection.
 * Based on ChatPage but includes project context.
 */

import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../config/theme';
import { useProject } from '../hooks/useProjects';
import { useAgentContext } from '../context/AgentContext';
import { apiGet } from '../utils/apiFetch';
import { BriefcaseIcon, ArrowLeftIcon, SendIcon } from '../components/Icons';
import ChatWindow from '../components/ChatWindow';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  backButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '36px',
    height: '36px',
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  projectBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: '#9333ea15',
    borderRadius: theme.borderRadius.md,
  },
  projectIcon: {
    width: '24px',
    height: '24px',
    borderRadius: theme.borderRadius.sm,
    backgroundColor: '#9333ea20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  projectName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: '#9333ea',
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.xl,
  },
  message: {
    maxWidth: '80%',
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
  },
  userMessage: {
    marginLeft: 'auto',
    backgroundColor: theme.colors.primary,
    color: 'white',
  },
  assistantMessage: {
    marginRight: 'auto',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
  },
  inputArea: {
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  inputWrapper: {
    display: 'flex',
    gap: theme.spacing.md,
    maxWidth: '900px',
    margin: '0 auto',
  },
  input: {
    flex: 1,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.base,
    resize: 'none',
    outline: 'none',
    minHeight: '50px',
    maxHeight: '200px',
  },
  sendButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '50px',
    height: '50px',
    borderRadius: theme.borderRadius.lg,
    border: 'none',
    backgroundColor: '#9333ea',
    color: 'white',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  contextBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.sm} ${theme.spacing.xl}`,
    backgroundColor: '#9333ea10',
    borderBottom: `1px solid #9333ea30`,
    fontSize: theme.typography.sizes.sm,
    color: '#9333ea',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textMuted,
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: '#ef4444',
    gap: theme.spacing.lg,
  },
  errorButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: `1px solid #ef444430`,
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
  },
};

export default function ProjectChatPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get('session');

  const { project, loading: projectLoading, error: projectError } = useProject(projectId);
  const { selectedAgent } = useAgentContext();

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(sessionId || '');

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load existing session if provided
  useEffect(() => {
    if (sessionId) {
      loadSession(sessionId);
    }
  }, [sessionId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = async (sid) => {
    try {
      const response = await apiGet(`/chats/${sid}`);
      if (response.ok) {
        const data = await response.json();
        setMessages(data.messages || []);
        setCurrentSessionId(sid);
      }
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  };

  const handleSend = async () => {
    const message = inputValue.trim();
    if (!message || isStreaming) return;

    setInputValue('');
    setIsStreaming(true);

    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);

    // Add placeholder for assistant response
    setMessages(prev => [...prev, { role: 'assistant', content: '', isStreaming: true }]);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message,
          sessionId: currentSessionId || undefined,
          agentId: selectedAgent?.id || 'supervisor',
          projectId,
        }),
      });

      if (!response.ok) throw new Error('Chat request failed');

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader available');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let newSessionId = currentSessionId;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n');

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.sessionId) {
              newSessionId = parsed.sessionId;
              setCurrentSessionId(newSessionId);
            }

            if (parsed.type === 'content' && parsed.content) {
              assistantContent += parsed.content;
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.role === 'assistant') {
                  updated[lastIdx] = { ...updated[lastIdx], content: assistantContent };
                }
                return updated;
              });
            }
          } catch {}
        }
      }

      // Mark streaming complete
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = { ...updated[lastIdx], isStreaming: false };
        }
        return updated;
      });

    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => {
        const updated = [...prev];
        const lastIdx = updated.length - 1;
        if (updated[lastIdx]?.role === 'assistant') {
          updated[lastIdx] = {
            role: 'assistant',
            content: 'Fehler bei der Verarbeitung. Bitte versuche es erneut.',
            isStreaming: false,
            isError: true,
          };
        }
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (projectLoading) {
    return <div style={styles.loading}>Lade Space...</div>;
  }

  if (projectError || !project) {
    return (
      <div style={styles.error}>
        <div>Space konnte nicht geladen werden</div>
        <button style={styles.errorButton} onClick={() => navigate('/projects')}>
          Zurueck zur Uebersicht
        </button>
      </div>
    );
  }

  const color = project.color || '#9333ea';

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <button
            style={styles.backButton}
            onClick={() => navigate(`/projects/${projectId}`)}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = theme.colors.surfaceHover}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <ArrowLeftIcon size={20} />
          </button>
          <div style={styles.projectBadge}>
            <div style={{ ...styles.projectIcon, backgroundColor: `${color}20` }}>
              <BriefcaseIcon size={14} color={color} />
            </div>
            <span style={{ ...styles.projectName, color }}>{project.name}</span>
          </div>
        </div>
      </div>

      {/* Context Banner */}
      <div style={styles.contextBanner}>
        <BriefcaseIcon size={16} />
        Chat im Space-Kontext: Memory und Knowledge Base werden automatisch beruecksichtigt
      </div>

      {/* Chat Area */}
      <div style={styles.chatArea}>
        <div style={styles.messagesContainer}>
          {messages.length === 0 ? (
            <div style={{ textAlign: 'center', color: theme.colors.textMuted, padding: theme.spacing['2xl'] }}>
              <BriefcaseIcon size={48} style={{ marginBottom: theme.spacing.lg, opacity: 0.3 }} />
              <div style={{ fontSize: theme.typography.sizes.lg, marginBottom: theme.spacing.sm }}>
                Space-Chat
              </div>
              <div>
                Starte eine Konversation im Kontext von "{project.name}".
                Der Assistent kennt das Space-Memory und die verknuepfte Knowledge Base.
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  ...styles.message,
                  ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
                }}
              >
                {msg.content || (msg.isStreaming ? '...' : '')}
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={styles.inputArea}>
          <div style={styles.inputWrapper}>
            <textarea
              ref={inputRef}
              style={styles.input}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nachricht eingeben..."
              rows={1}
              disabled={isStreaming}
            />
            <button
              style={{
                ...styles.sendButton,
                opacity: isStreaming || !inputValue.trim() ? 0.5 : 1,
              }}
              onClick={handleSend}
              disabled={isStreaming || !inputValue.trim()}
              onMouseOver={(e) => {
                if (!isStreaming && inputValue.trim()) {
                  e.currentTarget.style.backgroundColor = '#7c22ce';
                }
              }}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9333ea'}
            >
              <SendIcon size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
