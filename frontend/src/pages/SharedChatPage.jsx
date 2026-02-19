import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { theme } from '../config/theme';
import { sanitizeUrl } from '../utils/sanitize';
import { formatDateTime } from '../utils/dateFormat';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: theme.colors.background,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.surface,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  logo: {
    width: '32px',
    height: '32px',
    borderRadius: theme.borderRadius.lg,
    background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary}20 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.primary,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  content: {
    flex: 1,
    maxWidth: theme.layout.maxContentWidth,
    width: '100%',
    margin: '0 auto',
    padding: theme.spacing.xl,
  },
  chatCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  },
  chatHeader: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  chatTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  chatMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  chatSummary: {
    marginTop: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  messagesContainer: {
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  messageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  message: {
    maxWidth: '85%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.xl,
    lineHeight: theme.typography.lineHeight.relaxed,
    fontSize: theme.typography.sizes.base,
    wordBreak: 'break-word',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    color: 'white',
    borderBottomRightRadius: theme.borderRadius.sm,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    borderBottomLeftRadius: theme.borderRadius.sm,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.md,
  },
  error: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    textAlign: 'center',
  },
  errorIcon: {
    width: '64px',
    height: '64px',
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
  },
  errorTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  errorDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
  },
  homeButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  footer: {
    padding: theme.spacing.lg,
    textAlign: 'center',
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  footerText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
};

// Code block component for markdown
const CodeBlock = ({ children, className }) => {
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  return (
    <div style={{ margin: '0.5em 0', borderRadius: '8px', overflow: 'hidden' }}>
      <SyntaxHighlighter
        style={oneDark}
        language={language || 'text'}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: '1em',
          fontSize: '13px',
          lineHeight: 1.5,
        }}
        codeTagProps={{
          style: { fontFamily: theme.typography.fontMono },
        }}
      >
        {codeString}
      </SyntaxHighlighter>
    </div>
  );
};

// Markdown components
const markdownComponents = {
  code: ({ children, className, inline }) => {
    if (inline) {
      return (
        <code
          style={{
            background: 'rgba(0,0,0,0.06)',
            padding: '0.15em 0.35em',
            borderRadius: '4px',
            fontSize: '0.88em',
            fontFamily: theme.typography.fontMono,
          }}
        >
          {children}
        </code>
      );
    }
    return <CodeBlock className={className}>{children}</CodeBlock>;
  },
  pre: ({ children }) => <>{children}</>,
  p: ({ children }) => <p style={{ margin: '0 0 0.5em 0' }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: '0.4em 0', paddingLeft: '1.4em' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0.4em 0', paddingLeft: '1.4em' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '0.2em 0' }}>{children}</li>,
  h1: ({ children }) => <h1 style={{ margin: '0.6em 0 0.3em 0', fontWeight: 600, fontSize: '1.3em' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ margin: '0.6em 0 0.3em 0', fontWeight: 600, fontSize: '1.15em' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ margin: '0.6em 0 0.3em 0', fontWeight: 600, fontSize: '1.05em' }}>{children}</h3>,
  blockquote: ({ children }) => (
    <blockquote style={{
      borderLeft: `3px solid ${theme.colors.primary}`,
      margin: '0.5em 0',
      padding: '0.2em 0.8em',
      color: theme.colors.textSecondary,
    }}>
      {children}
    </blockquote>
  ),
  a: ({ children, href }) => {
    const safeHref = sanitizeUrl(href);
    return (
      <a
        href={safeHref}
        style={{ color: theme.colors.primary, textDecoration: 'underline' }}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          if (safeHref === '#') {
            e.preventDefault();
          }
        }}
      >
        {children}
      </a>
    );
  },
};

function SharedChatPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [chat, setChat] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Kein Share-Token angegeben');
      setLoading(false);
      return;
    }

    // Validate token format (alphanumeric, 8-64 characters)
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(token)) {
      setError('Ungültiges Token-Format');
      setLoading(false);
      return;
    }

    fetch(`${API_URL}/shared/${token}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(response => {
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Der geteilte Chat wurde nicht gefunden oder der Link ist abgelaufen.');
          }
          throw new Error('Fehler beim Laden des Chats');
        }
        return response.json();
      })
      .then(data => {
        setChat(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [token]);

  // formatDateTime is imported from utils/dateFormat
  const formatDate = (dateString) => formatDateTime(dateString, '');

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logo}>
              <LogoIcon />
            </div>
            <span style={styles.headerTitle}>KI-Assistent</span>
          </div>
        </div>
        <div style={styles.content}>
          <div style={styles.chatCard}>
            <div style={styles.loading}>
              Lade geteilten Chat...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.logo}>
              <LogoIcon />
            </div>
            <span style={styles.headerTitle}>KI-Assistent</span>
          </div>
        </div>
        <div style={styles.content}>
          <div style={styles.chatCard}>
            <div style={styles.error}>
              <ErrorIcon style={styles.errorIcon} />
              <div style={styles.errorTitle}>Chat nicht gefunden</div>
              <div style={styles.errorDescription}>{error}</div>
              <button
                style={styles.homeButton}
                onClick={() => navigate('/login')}
                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
              >
                Zur Anmeldung
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logo}>
            <LogoIcon />
          </div>
          <span style={styles.headerTitle}>KI-Assistent</span>
        </div>
        <div style={styles.badge}>
          <LockOpenIcon />
          Geteilter Chat - Nur Lesen
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.chatCard}>
          <div style={styles.chatHeader}>
            <h1 style={styles.chatTitle}>{chat.title}</h1>
            <div style={styles.chatMeta}>
              <span>Erstellt: {formatDate(chat.createdAt)}</span>
              {chat.sharedAt && (
                <span>Geteilt: {formatDate(chat.sharedAt)}</span>
              )}
              <span>{chat.messages?.length || 0} Nachrichten</span>
            </div>
            {chat.summary && (
              <div style={styles.chatSummary}>
                {chat.summary}
              </div>
            )}
          </div>

          <div style={styles.messagesContainer}>
            {chat.messages?.map((msg, index) => (
              <div
                key={index}
                style={{
                  ...styles.messageWrapper,
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                <div
                  style={{
                    ...styles.message,
                    ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
                  }}
                >
                  {msg.role === 'assistant' ? (
                    <div className="markdown-body">
                      <ReactMarkdown components={markdownComponents}>
                        {msg.content}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    msg.content
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={styles.footer}>
        <p style={styles.footerText}>
          Dieser Chat wurde von einem Benutzer geteilt. Um eigene Chats zu erstellen, melde dich an.
        </p>
      </div>

      <style>{`
        .markdown-body > *:last-child { margin-bottom: 0; }
        .markdown-body strong { font-weight: 600; }
        .markdown-body em { font-style: italic; }
      `}</style>
    </div>
  );
}

function LogoIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function LockOpenIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  );
}

function ErrorIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

export default SharedChatPage;
