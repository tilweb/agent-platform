import { useEffect, useRef, useState } from 'react';
import { theme } from '../../../config/theme';
import { ChatIcon, SendIcon, XIcon, DocumentIcon } from '../../../components/Icons';
import { wohngeldApi, ACCENT, ACCENT_LIGHT } from '../api';

/** Kontextuelle Startfragen (grounded Fall-Q&A). */
const VORSCHLAEGE = [
  'Was fehlt noch?',
  'Wie hoch ist das anrechenbare Einkommen?',
  'Ist die Miethöhe plausibel?',
];

/**
 * Fall-gebundenes Chat-Panel (schwebend, andockbar unten rechts).
 * Antworten kommen ausschließlich aus den Vorgangsdaten (Stufe C1).
 *
 * Props:
 *  - vorgang: { id, antragsId }
 *  - onClose: () => void
 *  - onOpenDokument?: (dokumentId) => void  (optional, springt zum Dokumente-Tab)
 */
export default function FallChat({ vorgang, onClose, onOpenDokument }) {
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [error, setError] = useState('');
  const listRef = useRef(null);

  // Verlauf laden.
  useEffect(() => {
    let cancelled = false;
    wohngeldApi.getChat(vorgang.id)
      .then((msgs) => { if (!cancelled) setMessages(msgs || []); })
      .catch(() => { /* leerer Verlauf ist ok */ });
    return () => { cancelled = true; };
  }, [vorgang.id]);

  // Autoscroll ans Ende.
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, streamingText, minimized]);

  async function send(text) {
    const frage = (text ?? input).trim();
    if (!frage || busy) return;
    setError('');
    setInput('');
    setBusy(true);
    setStreamingText('');
    // Optimistisch die Nutzerfrage anzeigen.
    setMessages((prev) => [...prev, { id: `local-${Date.now()}`, rolle: 'user', content: frage }]);

    let acc = '';
    await wohngeldApi.streamChat(vorgang.id, frage, {
      onDelta: (chunk) => { acc += chunk; setStreamingText(acc); },
      onDone: (msg) => {
        setMessages((prev) => [...prev, msg || { id: `a-${Date.now()}`, rolle: 'assistant', content: acc }]);
        setStreamingText('');
      },
      onError: (msg) => { setError(msg || 'Antwort fehlgeschlagen'); setStreamingText(''); },
    });
    setBusy(false);
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const hasMessages = messages.length > 0 || streamingText;

  return (
    <div style={{ ...styles.panel, ...(minimized ? styles.panelMin : {}) }}>
      {/* Kopf */}
      <div style={styles.header}>
        <div style={styles.headerTitle}>
          <ChatIcon size={16} color="#fff" />
          <span>Vorgang {vorgang.antragsId}</span>
        </div>
        <div style={styles.headerActions}>
          <button
            style={styles.headerBtn}
            onClick={() => setMinimized((m) => !m)}
            title={minimized ? 'Öffnen' : 'Minimieren'}
            aria-label={minimized ? 'Öffnen' : 'Minimieren'}
          >
            {minimized
              ? <ChatIcon size={16} color="#fff" />
              : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /></svg>}
          </button>
          <button style={styles.headerBtn} onClick={onClose} title="Schließen" aria-label="Schließen">
            <XIcon size={16} color="#fff" />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Nachrichten */}
          <div style={styles.list} ref={listRef}>
            {!hasMessages && (
              <div style={styles.empty}>
                Fragen Sie zum Vorgang — die Antworten stützen sich ausschließlich auf die erfassten
                Vorgangsdaten und Nachweise.
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} onOpenDokument={onOpenDokument} />
            ))}

            {streamingText && (
              <div style={styles.assistantRow}>
                <div style={styles.assistantBubble}>{streamingText}</div>
              </div>
            )}

            {busy && !streamingText && (
              <div style={styles.assistantRow}>
                <div style={{ ...styles.assistantBubble, color: theme.colors.textMuted }}>Suche im Fall …</div>
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}
          </div>

          {/* Vorschlags-Chips */}
          <div style={styles.chips}>
            {VORSCHLAEGE.map((v) => (
              <button
                key={v}
                style={styles.chip}
                disabled={busy}
                onClick={() => send(v)}
                onMouseEnter={(e) => { if (!busy) e.currentTarget.style.backgroundColor = ACCENT_LIGHT; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surface; }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* Eingabe */}
          <div style={styles.inputRow}>
            <textarea
              style={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Frage zum Vorgang …"
              rows={1}
              disabled={busy}
            />
            <button
              style={{ ...styles.sendBtn, ...(busy || !input.trim() ? styles.sendBtnDisabled : {}) }}
              onClick={() => send()}
              disabled={busy || !input.trim()}
              title="Senden"
              aria-label="Senden"
            >
              <SendIcon size={16} color="#fff" />
            </button>
          </div>

          {/* Vertraulichkeitshinweis */}
          <div style={styles.hint}>
            Nachrichten werden vertraulich behandelt und nicht weitergegeben. Die Entscheidung im
            Einzelfall treffen Sie.
          </div>
        </>
      )}
    </div>
  );
}

function MessageBubble({ message, onOpenDokument }) {
  const isUser = message.rolle === 'user';
  if (isUser) {
    return (
      <div style={styles.userRow}>
        <div style={styles.userBubble}>{message.content}</div>
      </div>
    );
  }
  return (
    <div style={styles.assistantRow}>
      <div style={styles.assistantBubble}>{message.content}</div>
      {message.sources && message.sources.length > 0 && (
        <div style={styles.sourceRow}>
          {message.sources.map((s) => (
            <button
              key={s.dokumentId}
              style={styles.sourceChip}
              onClick={() => onOpenDokument?.(s.dokumentId)}
              title={s.label}
            >
              <DocumentIcon size={12} color={ACCENT} />
              <span style={styles.sourceLabel}>{s.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  panel: {
    position: 'fixed',
    bottom: theme.spacing.xl,
    right: theme.spacing.xl,
    width: '380px',
    maxWidth: 'calc(100vw - 32px)',
    maxHeight: 'calc(100vh - 96px)',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
    zIndex: 1200,
    overflow: 'hidden',
  },
  panelMin: {
    maxHeight: 'none',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: ACCENT,
    color: '#fff',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing.xs,
  },
  headerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 26,
    height: 26,
    padding: 0,
    background: 'rgba(255, 255, 255, 0.15)',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
    minHeight: '200px',
  },
  empty: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    lineHeight: 1.5,
  },
  userRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  userBubble: {
    maxWidth: '85%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: ACCENT,
    color: '#fff',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  assistantRow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
  },
  assistantBubble: {
    maxWidth: '90%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  sourceRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
  },
  sourceChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    maxWidth: '100%',
    padding: `2px ${theme.spacing.sm}`,
    backgroundColor: ACCENT_LIGHT,
    color: ACCENT,
    border: 'none',
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
  },
  sourceLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '240px',
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    padding: `0 ${theme.spacing.lg} ${theme.spacing.sm}`,
  },
  chip: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  input: {
    flex: 1,
    resize: 'none',
    maxHeight: '96px',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontFamily: 'inherit',
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    lineHeight: 1.4,
  },
  sendBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    flexShrink: 0,
    backgroundColor: ACCENT,
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
  },
  sendBtnDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  hint: {
    padding: `0 ${theme.spacing.lg} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: 1.4,
  },
  error: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
  },
};
