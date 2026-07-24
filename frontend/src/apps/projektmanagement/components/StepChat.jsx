/**
 * StepChat
 * Chat mit dem Wissenspool des aktuellen Wizard-Schritts. Die Antwort wird
 * gegen das Masterclass-Wissen des Steps + die aktuellen Eingaben des Nutzers
 * geerdet und token-weise gestreamt (SSE). Verlauf ist ephemeral (in WizardPage
 * pro Step gehalten), wird nicht persistiert.
 */

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { theme } from '../../../config/theme';
import { API_URL } from '../../../utils/apiFetch';

// Kompaktes Markdown-Rendering für die schmale Chat-Blase (kleine Headings,
// enge Abstände). Nutzt react-markdown (CommonMark; in beiden Worktrees vorhanden;
// remark-gfm bewusst nicht, um keine Dependency-Divergenz einzuführen).
const hStyle = { margin: '0.5em 0 0.25em 0', fontWeight: 600, fontSize: '1em', lineHeight: 1.3 };
const mdComponents = {
  p: ({ children }) => <p style={{ margin: '0 0 0.5em 0' }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: '0.3em 0', paddingLeft: '1.2em' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0.3em 0', paddingLeft: '1.2em' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '0.15em 0' }}>{children}</li>,
  h1: ({ children }) => <div style={hStyle}>{children}</div>,
  h2: ({ children }) => <div style={hStyle}>{children}</div>,
  h3: ({ children }) => <div style={hStyle}>{children}</div>,
  h4: ({ children }) => <div style={hStyle}>{children}</div>,
  strong: ({ children }) => <strong style={{ fontWeight: 600 }}>{children}</strong>,
  code: ({ children }) => (
    <code style={{ background: theme.colors.surfaceHover, padding: '0.1em 0.3em', borderRadius: 4, fontSize: '0.9em' }}>
      {children}
    </code>
  ),
  a: ({ children, href }) => (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.primary }}>
      {children}
    </a>
  ),
};

/** Liest einen SSE-Stream aus einer fetch-Response; yieldet { type, data }. */
async function* sseReader(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      if (!block.trim()) continue;
      const ev = { event: 'message', data: '' };
      for (const line of block.split('\n')) {
        if (line.startsWith('event:')) ev.event = line.slice(6).trim();
        else if (line.startsWith('data:')) ev.data += line.slice(5).trim();
      }
      if (ev.data) {
        try {
          yield { type: ev.event, data: JSON.parse(ev.data) };
        } catch {
          // ignore malformed event
        }
      }
    }
  }
}

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  },
  messages: {
    flex: 1,
    minHeight: 0, // erlaubt internen Scroll statt Aufblähen (Flexbox-Gotcha)
    overflow: 'auto',
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  empty: {
    margin: 'auto',
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.6,
    padding: theme.spacing.lg,
  },
  emptyIcon: {
    color: theme.colors.primary,
    marginBottom: theme.spacing.sm,
  },
  row: {
    display: 'flex',
    width: '100%',
  },
  rowUser: { justifyContent: 'flex-end' },
  rowAssistant: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '85%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  bubbleUser: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.text,
    whiteSpace: 'pre-wrap', // User-Text: Zeilenumbrüche erhalten (kein Markdown)
  },
  bubbleAssistant: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  },
  cursor: {
    display: 'inline-block',
    width: '7px',
    color: theme.colors.textMuted,
  },
  error: {
    color: theme.colors.error,
    fontSize: theme.typography.sizes.sm,
    padding: `0 ${theme.spacing.lg}`,
    marginBottom: theme.spacing.sm,
  },
  inputBar: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
  },
  textarea: {
    flex: 1,
    resize: 'none',
    maxHeight: '120px',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: 'inherit',
    lineHeight: 1.4,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  sendBtn: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
};

export default function StepChat({ backendStep, projektauftrag, messages = [], onMessagesChange, disabled = false }) {
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const canSend = !!input.trim() && !streaming && !disabled && !!backendStep;

  const handleSend = async () => {
    const text = input.trim();
    if (!text || streaming || disabled || !backendStep) return;

    const base = [...messages, { role: 'user', content: text }];
    onMessagesChange(base);
    setInput('');
    setError(null);
    setStreaming(true);

    // Platzhalter-Assistenten-Nachricht, die während des Streams gefüllt wird.
    onMessagesChange([...base, { role: 'assistant', content: '' }]);

    try {
      const response = await fetch(
        `${API_URL}/apps/projektmanagement/knowledge/${backendStep}/chat`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: base, projektauftrag }),
        }
      );

      if (!response.ok || !response.body) {
        let msg = 'Chat fehlgeschlagen';
        try { msg = (await response.json()).error || msg; } catch { /* nicht-JSON */ }
        throw new Error(msg);
      }

      let acc = '';
      for await (const ev of sseReader(response)) {
        if (ev.type === 'token' && ev.data?.text) {
          acc += ev.data.text;
          onMessagesChange([...base, { role: 'assistant', content: acc }]);
        } else if (ev.type === 'error') {
          throw new Error(ev.data?.message || 'Chat fehlgeschlagen');
        } else if (ev.type === 'done') {
          break;
        }
      }

      // Falls der Stream ohne Token endete: leere Assistenten-Nachricht entfernen.
      if (!acc) onMessagesChange(base);
    } catch (err) {
      setError(err.message || 'Chat fehlgeschlagen');
      onMessagesChange(base); // Platzhalter entfernen
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.messages}>
        {messages.length === 0 ? (
          <div style={styles.empty}>
            <div style={styles.emptyIcon}>
              <ChatIcon size={28} />
            </div>
            Frag den Wissenspool zu diesem Schritt — z. B. „Worauf kommt es hier an?" oder
            „Passt meine aktuelle Eingabe?". Antworten stützen sich auf das Masterclass-Wissen
            und deine bisherigen Eingaben.
          </div>
        ) : (
          messages.map((m, i) => {
            const isUser = m.role === 'user';
            const isLast = i === messages.length - 1;
            return (
              <div key={i} style={{ ...styles.row, ...(isUser ? styles.rowUser : styles.rowAssistant) }}>
                <div style={{ ...styles.bubble, ...(isUser ? styles.bubbleUser : styles.bubbleAssistant) }}>
                  {isUser ? (
                    m.content
                  ) : (
                    <ReactMarkdown components={mdComponents}>
                      {m.content || ''}
                    </ReactMarkdown>
                  )}
                  {!isUser && isLast && streaming && <span style={styles.cursor}>▍</span>}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      {error && <div style={styles.error}>{error}</div>}

      <div style={styles.inputBar}>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Projektauftrag lädt…' : 'Frage zum aktuellen Schritt…'}
          disabled={disabled || streaming}
        />
        <button
          style={{ ...styles.sendBtn, ...(canSend ? {} : styles.sendBtnDisabled) }}
          onClick={handleSend}
          disabled={!canSend}
          title="Senden (Enter)"
        >
          <SendIcon />
        </button>
      </div>
    </div>
  );
}

function ChatIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}
