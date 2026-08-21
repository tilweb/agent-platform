import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { theme } from '../config/theme';
import { sanitizeUrl, validateShareUrl } from '../utils/sanitize';
import { AgentIcon } from './AgentPicker';
import { CommandPalette } from './CommandPalette';
import { useCommands } from '../hooks/useCommands';
import { LinkIcon, FolderIcon, MicrophoneIcon, StopIcon, PaperclipIcon, BookIcon, DocumentIcon, TimelineIcon } from './Icons';
import AgentLogPanel from './AgentLogPanel';
import { useAuth } from '../context/AuthContext';
import AddToCollectionModal from './AddToCollectionModal';
import CreateCollectionModal from './CreateCollectionModal';
import { AudioPlayer } from './AudioPlayer';
import { TranscriptBlock } from './TranscriptBlock';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useTranscription } from '../hooks/useTranscription';
import { GeneratedImage } from './GeneratedImage';
import { ImageLightbox } from './ImageLightbox';
import { ExportedDocument } from './ExportedDocument';
import ExportDropdown from './ExportDropdown';
import {
  ContextPill,
  AgentPill,
  ModelPill,
  TablePill,
  FilePill,
  ProjectPill,
  pillIconColors,
  spinnerKeyframes,
} from './ContextPill';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Share Modal Component
function ShareModal({ chatId, chatTitle, onClose }) {
  const [shareInfo, setShareInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_URL}/chats/${chatId}/share`, {
      credentials: 'include',
    })
      .then(res => res.json())
      .then(data => {
        if (data.shared) {
          setShareInfo(data);
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching share info:', err);
        setError('Fehler beim Laden');
        setLoading(false);
      });
  }, [chatId]);

  const handleCreateShare = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/chats/${chatId}/share`, {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setShareInfo({
          shared: true,
          shareToken: data.shareToken,
          shareUrl: data.shareUrl,
        });
      } else {
        setError(data.error || 'Fehler beim Erstellen');
      }
    } catch (err) {
      console.error('Error creating share:', err);
      setError('Netzwerkfehler');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeShare = async () => {
    setRevoking(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/chats/${chatId}/share`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setShareInfo(null);
      } else {
        setError(data.error || 'Fehler beim Widerrufen');
      }
    } catch (err) {
      console.error('Error revoking share:', err);
      setError('Netzwerkfehler');
    } finally {
      setRevoking(false);
    }
  };

  const handleCopyLink = async () => {
    const validatedUrl = validateShareUrl(shareInfo.shareUrl);
    if (!validatedUrl) {
      setError('Ungültiger Share-Link');
      return;
    }
    const fullUrl = `${window.location.origin}${validatedUrl}`;
    try {
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const modalStyles = {
    overlay: {
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
      maxWidth: '450px',
      width: '90%',
      boxShadow: theme.shadows.lg,
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: theme.spacing.lg,
      borderBottom: `1px solid ${theme.colors.border}`,
    },
    title: {
      fontSize: theme.typography.sizes.md,
      fontWeight: theme.typography.weights.semibold,
      color: theme.colors.text,
    },
    closeButton: {
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      color: theme.colors.textMuted,
      fontSize: '20px',
      padding: '4px',
      lineHeight: 1,
    },
    content: {
      padding: theme.spacing.lg,
    },
    chatTitleLabel: {
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.textMuted,
      marginBottom: theme.spacing.xs,
    },
    chatTitleValue: {
      fontSize: theme.typography.sizes.base,
      fontWeight: theme.typography.weights.medium,
      color: theme.colors.text,
      marginBottom: theme.spacing.lg,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.surfaceHover,
      borderRadius: theme.borderRadius.lg,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
    linkContainer: {
      display: 'flex',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    linkInput: {
      flex: 1,
      padding: theme.spacing.md,
      border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.lg,
      fontSize: theme.typography.sizes.sm,
      backgroundColor: theme.colors.background,
      color: theme.colors.text,
      outline: 'none',
    },
    copyButton: {
      padding: `${theme.spacing.md} ${theme.spacing.lg}`,
      backgroundColor: theme.colors.primary,
      color: 'white',
      border: 'none',
      borderRadius: theme.borderRadius.lg,
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
      transition: `all ${theme.transitions.fast}`,
    },
    revokeButton: {
      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
      backgroundColor: 'transparent',
      color: theme.colors.error,
      border: `1px solid ${theme.colors.error}30`,
      borderRadius: theme.borderRadius.lg,
      fontSize: theme.typography.sizes.sm,
      cursor: 'pointer',
      transition: `all ${theme.transitions.fast}`,
    },
    createButton: {
      width: '100%',
      padding: theme.spacing.md,
      backgroundColor: theme.colors.primary,
      color: 'white',
      border: 'none',
      borderRadius: theme.borderRadius.lg,
      fontSize: theme.typography.sizes.sm,
      fontWeight: theme.typography.weights.medium,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      transition: `all ${theme.transitions.fast}`,
    },
    info: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
      backgroundColor: theme.colors.warningLight,
      borderRadius: theme.borderRadius.lg,
      fontSize: theme.typography.sizes.sm,
      color: theme.colors.warning,
      marginTop: theme.spacing.md,
    },
    error: {
      padding: theme.spacing.md,
      backgroundColor: theme.colors.errorLight,
      borderRadius: theme.borderRadius.lg,
      color: theme.colors.error,
      fontSize: theme.typography.sizes.sm,
      marginBottom: theme.spacing.md,
    },
  };

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <span style={modalStyles.title}>Chat teilen</span>
          <button style={modalStyles.closeButton} onClick={onClose}>&times;</button>
        </div>
        <div style={modalStyles.content}>
          <div style={modalStyles.chatTitleLabel}>Chat</div>
          <div style={modalStyles.chatTitleValue} title={chatTitle}>
            {chatTitle}
          </div>

          {error && <div style={modalStyles.error}>{error}</div>}

          {loading ? (
            <div style={{ textAlign: 'center', padding: theme.spacing.lg, color: theme.colors.textMuted }}>
              Laden...
            </div>
          ) : shareInfo ? (
            <>
              <div style={modalStyles.linkContainer}>
                <input
                  type="text"
                  style={modalStyles.linkInput}
                  value={validateShareUrl(shareInfo.shareUrl) ? `${window.location.origin}${shareInfo.shareUrl}` : 'Ungültiger Link'}
                  readOnly
                  onClick={e => e.target.select()}
                />
                <button
                  style={modalStyles.copyButton}
                  onClick={handleCopyLink}
                  onMouseOver={e => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
                  onMouseOut={e => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
                >
                  {copied ? 'Kopiert!' : 'Kopieren'}
                </button>
              </div>
              <button
                style={modalStyles.revokeButton}
                onClick={handleRevokeShare}
                disabled={revoking}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = theme.colors.errorLight; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                {revoking ? 'Widerrufen...' : 'Link widerrufen'}
              </button>
              <div style={modalStyles.info}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>Jeder mit diesem Link kann den Chat lesen. Der Link kann jederzeit widerrufen werden.</span>
              </div>
            </>
          ) : (
            <>
              <button
                style={modalStyles.createButton}
                onClick={handleCreateShare}
                disabled={creating}
                onMouseOver={e => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
                onMouseOut={e => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
              >
                <LinkIcon size={16} />
                {creating ? 'Erstelle Link...' : 'Share-Link erstellen'}
              </button>
              <div style={modalStyles.info}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="16" x2="12" y2="12" />
                  <line x1="12" y1="8" x2="12.01" y2="8" />
                </svg>
                <span>Ein Share-Link ermöglicht es anderen, diesen Chat zu lesen (ohne Anmeldung). Du kannst den Link jederzeit widerrufen.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Custom styles for code blocks
const codeBlockStyles = {
  container: {
    position: 'relative',
    margin: '0.5em 0',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#1e1e1e',
    borderBottom: '1px solid #333',
  },
  language: {
    fontSize: '12px',
    color: '#888',
    textTransform: 'uppercase',
    fontWeight: 500,
  },
  copyButton: {
    background: 'none',
    border: 'none',
    color: '#888',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    transition: 'all 150ms ease',
  },
};

// Code block component with syntax highlighting and copy button
const CodeBlock = memo(function CodeBlock({ children, className, inline, ...props }) {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || '');
  const language = match ? match[1] : '';
  const codeString = String(children).replace(/\n$/, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Inline code (backticks in text)
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
        {...props}
      >
        {children}
      </code>
    );
  }

  // Code block (triple backticks) - with or without language
  return (
    <div style={codeBlockStyles.container}>
      <div style={codeBlockStyles.header}>
        <span style={codeBlockStyles.language}>{language || 'text'}</span>
        <button
          onClick={handleCopy}
          style={codeBlockStyles.copyButton}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#333';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#888';
          }}
        >
          {copied ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Kopiert
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              Kopieren
            </>
          )}
        </button>
      </div>
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '400px' }}>
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
            style: {
              fontFamily: theme.typography.fontMono,
            },
          }}
          wrapLongLines={false}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    </div>
  );
});

// Markdown components for react-markdown
const markdownComponents = {
  code: ({ children, className, inline, node, ...props }) => {
    // Determine if this is inline code or a code block
    // Code blocks have className (language-xxx) OR contain newlines OR inline is explicitly false
    const content = String(children);
    const hasLanguage = Boolean(className);
    const hasNewlines = content.includes('\n');
    const isInline = inline === true || (!hasLanguage && !hasNewlines && inline !== false);

    return (
      <CodeBlock className={className} inline={isInline} {...props}>
        {children}
      </CodeBlock>
    );
  },
  // Remove default pre wrapper since CodeBlock handles it
  pre: ({ children }) => <>{children}</>,
  // Ensure proper styling for other elements
  p: ({ children }) => <p style={{ margin: '0 0 0.5em 0' }}>{children}</p>,
  ul: ({ children }) => <ul style={{ margin: '0.4em 0', paddingLeft: '1.4em' }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: '0.4em 0', paddingLeft: '1.4em' }}>{children}</ol>,
  li: ({ children }) => <li style={{ margin: '0.2em 0' }}>{children}</li>,
  h1: ({ children }) => <h1 style={{ margin: '0.6em 0 0.3em 0', fontWeight: 600, lineHeight: 1.3, fontSize: '1.3em' }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ margin: '0.6em 0 0.3em 0', fontWeight: 600, lineHeight: 1.3, fontSize: '1.15em' }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ margin: '0.6em 0 0.3em 0', fontWeight: 600, lineHeight: 1.3, fontSize: '1.05em' }}>{children}</h3>,
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
  table: ({ children }) => (
    <div style={{ maxWidth: '100%', overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', margin: '0.5em 0', fontSize: '0.9em' }}>
        {children}
      </table>
    </div>
  ),
  th: ({ children }) => (
    <th style={{
      border: `1px solid ${theme.colors.border}`,
      padding: '0.3em 0.6em',
      background: 'rgba(0,0,0,0.04)',
      fontWeight: 600,
    }}>
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td style={{
      border: `1px solid ${theme.colors.border}`,
      padding: '0.3em 0.6em',
    }}>
      {children}
    </td>
  ),
  a: ({ children, href }) => {
    const safeHref = sanitizeUrl(href);

    // Handle API download links - convert to full backend URL and trigger download
    if (safeHref && safeHref.startsWith('/api/exports/download/')) {
      const fullUrl = `${API_URL}${safeHref.replace('/api', '')}`;
      return (
        <a
          href={fullUrl}
          style={{ color: theme.colors.primary, textDecoration: 'underline' }}
          onClick={async (e) => {
            e.preventDefault();
            try {
              const response = await fetch(fullUrl, { credentials: 'include' });
              if (!response.ok) throw new Error('Download failed');
              const blob = await response.blob();
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              const filename = safeHref.split('/').pop() || 'document';
              a.href = url;
              a.download = filename;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            } catch (err) {
              console.error('Download failed:', err);
            }
          }}
        >
          {children}
        </a>
      );
    }

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
  hr: () => <hr style={{ border: 'none', borderTop: `1px solid ${theme.colors.border}`, margin: '0.8em 0' }} />,
};

const chatStyles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.lg,
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  headerIcon: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.lg,
    background: `linear-gradient(135deg, ${theme.colors.primaryLight} 0%, ${theme.colors.primary}20 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.primary,
    flexShrink: 0,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 0,
  },
  headerActionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    position: 'relative',
  },
  folderDropdown: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: theme.spacing.xs,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    boxShadow: theme.shadows.lg,
    minWidth: '180px',
    zIndex: 100,
    overflow: 'hidden',
  },
  folderDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    transition: `background-color ${theme.transitions.fast}`,
    border: 'none',
    backgroundColor: 'transparent',
    width: '100%',
    textAlign: 'left',
  },
  folderCheckbox: {
    width: '14px',
    height: '14px',
    accentColor: theme.colors.primary,
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',  // Prevent horizontal overflow
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
    minWidth: 0,  // Allow flex shrinking
  },
  messageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    minWidth: 0,  // Allow flex shrinking
    width: '100%',  // Take full container width
    maxWidth: '100%',
  },
  message: {
    maxWidth: '85%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.xl,
    minWidth: 0,  // Allow flex shrinking
    wordBreak: 'break-word',  // Break long words
    lineHeight: theme.typography.lineHeight.relaxed,
    fontSize: theme.typography.sizes.base,
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: theme.colors.primary,
    color: 'white',
    borderBottomRightRadius: theme.borderRadius.sm,
  },
  // User message with attachments container
  userMessageContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    alignItems: 'flex-end',
    maxWidth: '75%',
  },
  // Attachment display in chat messages
  messageAttachments: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    width: '100%',
    maxWidth: '400px',
  },
  // Document preview in chat
  documentPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  documentIcon: {
    flexShrink: 0,
    color: theme.colors.warning,
  },
  documentName: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // Image attachment in chat
  imageAttachment: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    borderBottomLeftRadius: theme.borderRadius.sm,
  },
  agentBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xs,
  },
  agentBadgeIcon: {
    width: '14px',
    height: '14px',
  },
  // Copy button styles
  messageContainer: {
    position: 'relative',
    maxWidth: '85%',
    alignSelf: 'flex-start',
    minWidth: 0,  // Allow flex shrinking
  },
  assistantMessageWithCopy: {
    position: 'relative',
    width: '100%',  // Take full width
    maxWidth: '100%',  // But never exceed container
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    paddingRight: '40px', // Space for copy button
    borderRadius: theme.borderRadius.xl,
    borderBottomLeftRadius: theme.borderRadius.sm,
    lineHeight: theme.typography.lineHeight.relaxed,
    fontSize: theme.typography.sizes.base,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.text,
    minWidth: 0,  // Allow flex shrinking
    overflow: 'hidden',  // Prevent content overflow
    wordBreak: 'break-word',  // Break long words
    boxSizing: 'border-box',
  },
  copyButton: {
    position: 'absolute',
    top: '8px',
    right: '8px',
    padding: '4px',
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.sm,
    cursor: 'pointer',
    opacity: 0,
    transition: `opacity ${theme.transitions.fast}, background-color ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  copyButtonVisible: {
    opacity: 0.6,
  },
  copyButtonHover: {
    opacity: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  copyButtonIcon: {
    width: '16px',
    height: '16px',
    color: theme.colors.textMuted,
  },
  copyFeedback: {
    position: 'absolute',
    top: '6px',
    right: '6px',
    padding: '2px 6px',
    backgroundColor: theme.colors.success,
    color: 'white',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    zIndex: 2,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
    padding: theme.spacing['2xl'],
    textAlign: 'center',
  },
  emptyIcon: {
    width: '64px',
    height: '64px',
    marginBottom: theme.spacing.lg,
    color: theme.colors.primary,
    opacity: 0.8,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    maxWidth: '280px',
  },
  suggestedQuestions: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    width: '100%',
    maxWidth: '320px',
  },
  suggestedQuestion: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textAlign: 'left',
  },
  infoBox: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.warningLight,
    borderRadius: theme.borderRadius.lg,
    maxWidth: '320px',
  },
  infoBoxTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.warning,
    marginBottom: theme.spacing.xs,
  },
  infoBoxText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.warning,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  inputArea: {
    borderTop: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
  },
  inputContainer: {
    padding: theme.spacing.lg,
  },
  inputWrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  inputRow: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'flex-end',
  },
  inputActions: {
    display: 'flex',
    gap: theme.spacing.xs,
    alignItems: 'center',
    paddingLeft: theme.spacing.sm,
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  textarea: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: `1.5px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    resize: 'none',
    fontFamily: theme.typography.fontFamily,
    fontSize: theme.typography.sizes.base,
    outline: 'none',
    minHeight: '48px',
    maxHeight: '120px',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: theme.colors.surfaceHover,
  },
  sendButton: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: {
    backgroundColor: theme.colors.textLight,
    cursor: 'not-allowed',
  },
  statusContainer: {
    padding: `0 ${theme.spacing.xl} ${theme.spacing.md}`,
  },
  // Context Chips styles - unified design with gray background + colored icons
  contextChipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    paddingBottom: 0,
  },
  // Legacy styles kept for backward compatibility, but prefer ContextPill component
  contextChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: `6px ${theme.spacing.md}`,
    backgroundColor: theme.colors.surfaceHover,  // Grauer Hintergrund (neu)
    border: `1px solid ${theme.colors.border}`,  // Graue Border (neu)
    borderRadius: theme.borderRadius.lg,         // 12px statt full (neu)
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  contextChipIcon: {
    width: '14px',
    height: '14px',
  },
  contextChipRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    opacity: 0.6,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    marginLeft: '4px',
    transition: `opacity ${theme.transitions.fast}`,
  },
  // File upload styles
  attachmentButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `all ${theme.transitions.fast}`,
  },
  attachmentChipsContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    paddingTop: theme.spacing.md,
  },
  attachmentChip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: `6px ${theme.spacing.md}`,
    backgroundColor: theme.colors.surfaceHover,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    maxWidth: '200px',
  },
  attachmentChipIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  attachmentChipName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  attachmentChipRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    opacity: 0.6,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    marginLeft: '2px',
    transition: `opacity ${theme.transitions.fast}`,
  },
  inputWithAttachment: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  // Recording UI styles
  micButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `all ${theme.transitions.fast}`,
  },
  micButtonRecording: {
    color: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
  },
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.error}30`,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: theme.colors.error,
    animation: 'pulse 1s ease-in-out infinite',
  },
  recordingTime: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    fontWeight: theme.typography.weights.medium,
  },
  stopButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.error,
    cursor: 'pointer',
    padding: '4px',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `all ${theme.transitions.fast}`,
  },
  cancelButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.error,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    transition: `all ${theme.transitions.fast}`,
  },
  transcribeButton: {
    background: 'none',
    border: `1px solid ${theme.colors.primary}`,
    color: theme.colors.primary,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    marginLeft: theme.spacing.xs,
    transition: `all ${theme.transitions.fast}`,
    fontWeight: theme.typography.weights.medium,
  },
  transcribeButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  audioChipContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  languageSelect: {
    background: 'transparent',
    border: `1px solid ${theme.colors.error}50`,
    borderRadius: theme.borderRadius.sm,
    color: theme.colors.error,
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.xs}`,
    cursor: 'pointer',
    outline: 'none',
    fontWeight: theme.typography.weights.medium,
  },
  attachmentLanguageSelect: {
    background: theme.colors.surface,
    border: `1px solid ${theme.colors.primary}50`,
    borderRadius: theme.borderRadius.sm,
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.xs}`,
    cursor: 'pointer',
    outline: 'none',
    fontWeight: theme.typography.weights.medium,
    marginLeft: theme.spacing.xs,
  },
  transcriptionStatus: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
  },
};

// Materials Sidebar styles
const materialsSidebarStyles = {
  container: {
    width: '320px',
    minWidth: '320px',
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
    padding: theme.spacing.lg,
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
  headerBadge: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    minWidth: '20px',
    textAlign: 'center',
  },
  closeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `all ${theme.transitions.fast}`,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.md,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
  },
  emptyIcon: {
    width: '48px',
    height: '48px',
    marginBottom: theme.spacing.md,
    opacity: 0.5,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  materialItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.sm,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    border: `1px solid transparent`,
  },
  materialItemSelected: {
    borderColor: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
  },
  materialCheckbox: {
    width: '18px',
    height: '18px',
    accentColor: theme.colors.primary,
    flexShrink: 0,
    marginTop: '2px',
  },
  materialInfo: {
    flex: 1,
    minWidth: 0,
  },
  materialTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginBottom: '2px',
  },
  materialType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  materialTypeIcon: {
    width: '12px',
    height: '12px',
  },
  materialPreview: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    lineHeight: theme.typography.lineHeight.relaxed,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  materialRemove: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    opacity: 0,
    transition: `opacity ${theme.transitions.fast}`,
    flexShrink: 0,
  },
  footer: {
    padding: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    flexShrink: 0,
  },
  actionButton: {
    width: '100%',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    transition: `all ${theme.transitions.fast}`,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  // Toggle button in header (when sidebar is closed)
  headerMaterialsButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '32px',
    height: '32px',
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    position: 'relative',
  },
  materialsBadge: {
    position: 'absolute',
    top: '0px',
    right: '0px',
    backgroundColor: theme.colors.primary,
    color: 'white',
    fontSize: '10px',
    fontWeight: theme.typography.weights.bold,
    minWidth: '16px',
    height: '16px',
    borderRadius: theme.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 4px',
  },
};

import { apiGet } from '../utils/apiFetch';

const taskStatusStyles = {
  container: {
    maxWidth: '85%',
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.xs,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: '#fff7ed',  // orange light background
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: '#ea580c',  // orange text
    transition: `background-color ${theme.transitions.fast}`,
    border: '1px solid #fed7aa',
  },
  headerCompleted: {
    backgroundColor: '#dcfce7',
    color: '#16a34a',
    border: '1px solid #bbf7d0',
  },
  headerFailed: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    border: '1px solid #fecaca',
  },
  chevron: {
    width: '12px',
    height: '12px',
    transition: `transform ${theme.transitions.fast}`,
    flexShrink: 0,
  },
  content: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: '#fffbeb',
    borderRadius: `0 0 ${theme.borderRadius.lg} ${theme.borderRadius.lg}`,
    border: '1px solid #fed7aa',
    borderTop: 'none',
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    maxHeight: '300px',
    overflow: 'auto',
    lineHeight: '1.6',
  },
  contentCompleted: {
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
  },
  progressBar: {
    height: '4px',
    backgroundColor: '#fed7aa',
    borderRadius: '2px',
    marginTop: theme.spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#f97316',
    transition: 'width 0.3s ease',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid transparent',
    borderTopColor: '#ea580c',
    borderRightColor: '#ea580c',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    flexShrink: 0,
  },
  taskLink: {
    marginTop: theme.spacing.sm,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    textDecoration: 'none',
  },
};

const thinkingStyles = {
  container: {
    maxWidth: '85%',
    alignSelf: 'flex-start',
    marginBottom: theme.spacing.xs,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.thinkingLight,
    cursor: 'pointer',
    userSelect: 'none',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.thinking,
    transition: `background-color ${theme.transitions.fast}`,
  },
  chevron: {
    width: '12px',
    height: '12px',
    transition: `transform ${theme.transitions.fast}`,
    flexShrink: 0,
  },
  stepList: {
    listStyle: 'none',
    margin: 0,
    padding: `${theme.spacing.sm} ${theme.spacing.md} ${theme.spacing.sm} ${theme.spacing.xl}`,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  step: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
  },
  stepIcon: {
    width: '14px',
    height: '14px',
    flexShrink: 0,
  },
  stepDetail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginLeft: '22px',
    lineHeight: 1.4,
    wordBreak: 'break-word',
  },
  stepDetailTruncated: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginLeft: '22px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '400px',
  },
  stepArgs: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginLeft: '22px',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: '2px 6px',
    borderRadius: '4px',
    display: 'inline-block',
    maxWidth: '400px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid transparent',
    borderTopColor: theme.colors.thinking,
    borderRightColor: theme.colors.thinking,
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
    flexShrink: 0,
  },
};

function ThinkingBlock({ steps, isStreaming, reasoning, agentNameById, collectionNameById }) {
  const [expanded, setExpanded] = useState(isStreaming);
  const [reasoningExpanded, setReasoningExpanded] = useState(false);
  const hasSteps = steps && steps.length > 0;
  const hasReasoning = reasoning && reasoning.trim().length > 0;

  useEffect(() => {
    if (isStreaming) setExpanded(true);
    else setExpanded(false);
  }, [isStreaming]);

  // Auto-expand reasoning while streaming
  useEffect(() => {
    if (isStreaming && hasReasoning) setReasoningExpanded(true);
  }, [isStreaming, hasReasoning]);

  if (!hasSteps && !hasReasoning) return null;

  const stepCount = steps.length;

  const getStepIcon = (step, isLastStep) => {
    const isActive = isStreaming && isLastStep;

    switch (step.type) {
      case 'model_info':
        return (
          <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        );
      case 'thinking':
        return isActive
          ? <div style={thinkingStyles.spinner} />
          : (
            <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.thinking} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
          );
      case 'agent_selected':
        return (
          <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="8.5" cy="7" r="4" />
            <polyline points="17 11 19 13 23 9" />
          </svg>
        );
      case 'tool':
        return isActive
          ? <div style={{ ...thinkingStyles.spinner, borderTopColor: theme.colors.warning, borderRightColor: theme.colors.warning }} />
          : (
            <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.warning} strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          );
      case 'tool_complete':
        return (
          <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'delegation':
        return isActive
          ? <div style={{ ...thinkingStyles.spinner, borderTopColor: theme.colors.info, borderRightColor: theme.colors.info }} />
          : (
            <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.info} strokeWidth="2">
              <path d="M16 3h5v5" />
              <path d="M21 3l-7 7" />
              <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
            </svg>
          );
      case 'delegation_complete':
        return (
          <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        );
      case 'skill':
        return (
          <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      case 'workflow':
        return (
          <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        );
      case 'sub_agent_step':
        {
          const subColor = step.stepType === 'tool' ? theme.colors.warning
            : step.stepType === 'delegation' ? theme.colors.info
            : theme.colors.thinking;
          return isActive
            ? <div style={{ ...thinkingStyles.spinner, borderTopColor: subColor, borderRightColor: subColor }} />
            : (
              <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={subColor} strokeWidth="2">
                <path d="M9 18l6-6-6-6" />
              </svg>
            );
        }
      case 'document_analysis':
        return isActive
          ? <div style={{ ...thinkingStyles.spinner, borderTopColor: theme.colors.info, borderRightColor: theme.colors.info }} />
          : (
            <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.info} strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
          );
      case 'document_analysis_complete':
        return (
          <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <polyline points="9 13 11 15 15 11" />
          </svg>
        );
      default:
        return isActive
          ? <div style={thinkingStyles.spinner} />
          : (
            <svg style={thinkingStyles.stepIcon} viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
            </svg>
          );
    }
  };

  // Slug-IDs (z.B. "paul-personalmanagement-agent") gegen den Display-Namen
  // ("Paul Personal") aus der Agent-Liste tauschen — fallback auf die ID,
  // falls der Agent nicht im Cache ist (z.B. Connection-Agent zur Runtime).
  const labelForAgent = (id) => (id && agentNameById?.get(id)) || id;

  const getStepLabel = (step) => {
    switch (step.type) {
      case 'model_info': return `${step.providerName} / ${step.modelName}`;
      case 'thinking': return 'Denkt nach...';
      case 'agent_selected': return `Agent: ${labelForAgent(step.agentId)}`;
      case 'tool': return `Tool: ${step.tool}`;
      case 'tool_complete': return `Tool: ${step.tool} abgeschlossen`;
      case 'delegation': return `Delegiert an: ${labelForAgent(step.agentId)}`;
      case 'delegation_complete': return `Delegation an ${labelForAgent(step.agentId)} abgeschlossen`;
      case 'sub_agent_step': return `${labelForAgent(step.agentId)}: ${step.message}`;
      case 'document_analysis': return `Analysiere ${step.filename || step.attachmentId}…`;
      case 'document_analysis_complete': {
        const rel = step.relevance ? ` · Relevanz: ${step.relevance}` : '';
        const trunc = step.truncated ? ' [gekürzt]' : '';
        return `${step.filename || step.attachmentId} analysiert${rel}${trunc}`;
      }
      case 'skill': return step.message;
      case 'workflow': return step.message;
      default: return step.message;
    }
  };

  // Bekannte ID-Felder durch Display-Name ersetzen — der User soll im
  // Tool-Args-Render keine Slugs sehen, sondern lesbare Namen.
  // Slug bleibt als Fallback wenn die Map den Eintrag nicht hat.
  const beautifyArgValue = (key, value) => {
    if (typeof value !== 'string') return value;
    const k = key.toLowerCase();
    if ((k === 'collection_id' || k === 'collection') && collectionNameById?.has(value)) {
      return collectionNameById.get(value);
    }
    if ((k === 'agent_id' || k === 'agentid') && agentNameById?.has(value)) {
      return agentNameById.get(value);
    }
    return value;
  };

  const formatArgs = (args) => {
    if (!args) return null;
    if (typeof args === 'string') return args;
    return Object.entries(args).map(([k, v]) => `${k}: ${beautifyArgValue(k, v)}`).join(', ');
  };

  const formatDetail = (text, maxLen = 200) => {
    if (!text) return null;
    const s = typeof text === 'string' ? text : JSON.stringify(text);
    return s.length > maxLen ? s.slice(0, maxLen) + '...' : s;
  };

  return (
    <div style={thinkingStyles.container}>
      {/* Reasoning Block (from thinking models) */}
      {hasReasoning && (
        <>
          <div
            style={{
              ...thinkingStyles.header,
              backgroundColor: theme.colors.thinkingLight,
              borderRadius: hasSteps ? `${theme.borderRadius.md} ${theme.borderRadius.md} 0 0` : theme.borderRadius.md,
            }}
            onClick={() => setReasoningExpanded(e => !e)}
          >
            <svg
              style={{
                ...thinkingStyles.chevron,
                transform: reasoningExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {isStreaming && <div style={{ ...thinkingStyles.spinner, borderTopColor: theme.colors.thinking, borderRightColor: theme.colors.thinking }} />}
            <svg style={{ width: 14, height: 14, marginRight: 4 }} viewBox="0 0 24 24" fill="none" stroke={theme.colors.thinking} strokeWidth="2">
              <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 4.44-1.54" />
              <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-4.44-1.54" />
            </svg>
            <span style={{ color: theme.colors.thinking, fontWeight: theme.typography.weights.medium }}>
              Reasoning
            </span>
          </div>
          {reasoningExpanded && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.thinkingLight,
              borderTop: `1px solid ${theme.colors.thinking}20`,
              borderRadius: hasSteps ? 0 : `0 0 ${theme.borderRadius.md} ${theme.borderRadius.md}`,
              maxHeight: '300px',
              overflowY: 'auto',
              fontSize: theme.typography.sizes.sm,
              color: theme.colors.textSecondary,
              lineHeight: theme.typography.lineHeight.relaxed,
              whiteSpace: 'pre-wrap',
              fontFamily: theme.typography.fontMono,
            }}>
              {reasoning}
            </div>
          )}
        </>
      )}

      {/* Steps Block */}
      {hasSteps && (
        <>
          <div
            style={{
              ...thinkingStyles.header,
              borderRadius: hasReasoning ? `0 0 ${theme.borderRadius.md} ${theme.borderRadius.md}` : theme.borderRadius.md,
              borderTop: hasReasoning ? `1px solid ${theme.colors.border}` : 'none',
            }}
            onClick={() => setExpanded(e => !e)}
          >
            <svg
              style={{
                ...thinkingStyles.chevron,
                transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
              }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {isStreaming && !hasReasoning && <div style={thinkingStyles.spinner} />}
            <span>Thinking — {stepCount} {stepCount === 1 ? 'Schritt' : 'Schritte'}</span>
          </div>
          {expanded && (
            <ul style={thinkingStyles.stepList}>
              {steps.map((step, i) => {
                const isLastStep = i === steps.length - 1;
                const argsStr = formatArgs(step.args);
                const detailStr = step.detail ? formatDetail(step.detail) : null;
                const resultStr = step.result ? formatDetail(step.result) : null;

                const isSubAgent = step.type === 'sub_agent_step';

                return (
                  <li key={i} style={isSubAgent ? { marginLeft: '16px', borderLeft: `2px solid ${theme.colors.borderLight}`, paddingLeft: '8px' } : undefined}>
                    <div style={thinkingStyles.step}>
                      {getStepIcon(step, isLastStep)}
                      <span>{getStepLabel(step)}</span>
                    </div>
                    {step.type === 'tool' && argsStr && (
                      <div style={thinkingStyles.stepArgs} title={argsStr}>
                        {argsStr}
                      </div>
                    )}
                    {step.type === 'tool_complete' && resultStr && (
                      <div style={thinkingStyles.stepDetailTruncated} title={String(step.result)}>
                        → {resultStr}
                      </div>
                    )}
                    {(step.type === 'delegation' || step.type === 'delegation_complete') && detailStr && (
                      <div style={thinkingStyles.stepDetail}>
                        {step.type === 'delegation' ? 'Aufgabe: ' : '→ '}{detailStr}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

// TaskStatusBlock Component - shows task status with live updates
function TaskStatusBlock({ taskId, taskTitle, onComplete }) {
  const [expanded, setExpanded] = useState(false);
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [resultPosted, setResultPosted] = useState(false);

  // Poll for task status
  useEffect(() => {
    if (!taskId) return;

    const fetchTask = async () => {
      try {
        const res = await apiGet(`/tasks/${taskId}`);
        if (res.ok) {
          const data = await res.json();
          setTask(data);
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch task:', err);
        setLoading(false);
      }
    };

    fetchTask();

    // Poll every 3 seconds while task is running
    const interval = setInterval(() => {
      fetchTask();
    }, 3000);

    return () => clearInterval(interval);
  }, [taskId]);

  // When task completes, load full result and call onComplete
  useEffect(() => {
    if (task && task.status === 'completed' && !resultPosted && onComplete) {
      setResultPosted(true);

      // Load full result and post as message
      const loadAndPost = async () => {
        try {
          const res = await apiGet(`/tasks/${taskId}/result`);
          if (res.ok) {
            const data = await res.json();
            onComplete(taskId, taskTitle || task.title, data.response || task.result_summary || 'Task abgeschlossen.');
          } else {
            // Fallback to summary
            onComplete(taskId, taskTitle || task.title, task.result_summary || 'Task abgeschlossen.');
          }
        } catch (err) {
          console.error('Failed to load full result:', err);
          onComplete(taskId, taskTitle || task.title, task.result_summary || 'Task abgeschlossen.');
        }
      };
      loadAndPost();
    }
  }, [task?.status, resultPosted, onComplete, taskId, taskTitle]);

  const isRunning = task && ['pending', 'queued', 'running', 'in_progress'].includes(task.status);
  const isFailed = task?.status === 'failed' || task?.status === 'cancelled';

  // Don't render if task is completed (result is posted as message)
  if (task?.status === 'completed') {
    return null;
  }

  const getStatusText = () => {
    if (!task) return 'Lädt...';
    switch (task.status) {
      case 'pending': return 'Wartend';
      case 'queued': return 'In Warteschlange';
      case 'running':
      case 'in_progress': return `Läuft... ${task.progress || 0}%`;
      case 'failed': return 'Fehlgeschlagen';
      case 'cancelled': return 'Abgebrochen';
      default: return task.status;
    }
  };

  const headerStyle = {
    ...taskStatusStyles.header,
    ...(isFailed ? taskStatusStyles.headerFailed : {}),
  };

  return (
    <div style={taskStatusStyles.container}>
      <div style={headerStyle} onClick={() => setExpanded(e => !e)}>
        <svg
          style={{
            ...taskStatusStyles.chevron,
            transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
        {isRunning && <div style={taskStatusStyles.spinner} />}
        {isFailed && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        )}
        <span>Task: {taskTitle || task?.title || taskId} — {getStatusText()}</span>
      </div>

      {isRunning && task && (
        <div style={taskStatusStyles.progressBar}>
          <div style={{ ...taskStatusStyles.progressFill, width: `${task.progress || 0}%` }} />
        </div>
      )}

      {expanded && isFailed && task?.error_message && (
        <div style={{ ...taskStatusStyles.content, ...taskStatusStyles.headerFailed }}>
          <span style={{ color: '#dc2626' }}>{task.error_message}</span>
          <a
            href={`/tasks?open=${taskId}`}
            style={taskStatusStyles.taskLink}
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Details anzeigen
          </a>
        </div>
      )}
    </div>
  );
}

// MaterialsSidebar Component - Shows collected materials with collection integration
function MaterialsSidebar({
  materials,
  selectedMaterialIds,
  onToggleSelection,
  onRemoveMaterial,
  onClose,
  chatId,
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState(null);

  const selectedCount = selectedMaterialIds.size;
  const hasSelection = selectedCount > 0;

  // Convert materials to collection item format
  const materialToCollectionItem = (material) => ({
    id: material.id,
    type: 'material',
    title: material.title,
    content: material.content || '',  // Full content for indexing
    snippet: material.content?.slice(0, 200) || '',
    source: 'chat',
    metadata: {
      fromChat: true,
      chatId: chatId,
      materialType: material.type,
      ...material.metadata,
    },
  });

  const selectedItems = materials
    .filter((m) => selectedMaterialIds.has(m.id))
    .map(materialToCollectionItem);

  const getTypeLabel = (type) => {
    switch (type) {
      case 'upload': return 'Dokument';
      case 'transcript': return 'Transkript';
      case 'skill_result': return 'Skill-Ergebnis';
      case 'user_marked': return 'Markiert';
      default: return 'Material';
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'upload':
        return (
          <svg style={materialsSidebarStyles.materialTypeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        );
      case 'transcript':
        return (
          <svg style={materialsSidebarStyles.materialTypeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
          </svg>
        );
      case 'skill_result':
        return (
          <svg style={materialsSidebarStyles.materialTypeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      case 'user_marked':
      default:
        return (
          <svg style={materialsSidebarStyles.materialTypeIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        );
    }
  };

  return (
    <div style={materialsSidebarStyles.container}>
      {/* Header */}
      <div style={materialsSidebarStyles.header}>
        <div style={materialsSidebarStyles.headerTitle}>
          <span>Materialien</span>
          {materials.length > 0 && (
            <span style={materialsSidebarStyles.headerBadge}>{materials.length}</span>
          )}
        </div>
        <button
          style={materialsSidebarStyles.closeButton}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            e.currentTarget.style.color = theme.colors.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = theme.colors.textMuted;
          }}
          title="Sidebar schließen"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div style={materialsSidebarStyles.content}>
        {materials.length === 0 ? (
          <div style={materialsSidebarStyles.emptyState}>
            <svg style={materialsSidebarStyles.emptyIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
            <p style={materialsSidebarStyles.emptyText}>
              Noch keine Materialien gesammelt.<br />
              Dateien hochladen oder Antworten markieren.
            </p>
          </div>
        ) : (
          materials.map((material) => {
            const isSelected = selectedMaterialIds.has(material.id);
            const isHovered = hoveredItemId === material.id;

            return (
              <div
                key={material.id}
                style={{
                  ...materialsSidebarStyles.materialItem,
                  ...(isSelected ? materialsSidebarStyles.materialItemSelected : {}),
                }}
                onClick={() => onToggleSelection(material.id)}
                onMouseEnter={() => setHoveredItemId(material.id)}
                onMouseLeave={() => setHoveredItemId(null)}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelection(material.id)}
                  style={materialsSidebarStyles.materialCheckbox}
                  onClick={(e) => e.stopPropagation()}
                />
                <div style={materialsSidebarStyles.materialInfo}>
                  <div style={materialsSidebarStyles.materialTitle} title={material.title}>
                    {material.title}
                  </div>
                  <div style={materialsSidebarStyles.materialType}>
                    {getTypeIcon(material.type)}
                    <span>{getTypeLabel(material.type)}</span>
                  </div>
                  {material.content && (
                    <div style={materialsSidebarStyles.materialPreview}>
                      {material.content.slice(0, 100)}...
                    </div>
                  )}
                </div>
                <button
                  style={{
                    ...materialsSidebarStyles.materialRemove,
                    opacity: isHovered ? 0.6 : 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveMaterial(material.id);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = 1;
                    e.currentTarget.style.color = theme.colors.error;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = isHovered ? 0.6 : 0;
                    e.currentTarget.style.color = theme.colors.textMuted;
                  }}
                  title="Material entfernen"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Footer with actions */}
      {materials.length > 0 && (
        <div style={materialsSidebarStyles.footer}>
          <button
            style={{
              ...materialsSidebarStyles.actionButton,
              ...materialsSidebarStyles.primaryButton,
              ...(hasSelection ? {} : materialsSidebarStyles.disabledButton),
            }}
            onClick={() => hasSelection && setShowAddModal(true)}
            disabled={!hasSelection}
            onMouseEnter={(e) => {
              if (hasSelection) e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
            }}
            onMouseLeave={(e) => {
              if (hasSelection) e.currentTarget.style.backgroundColor = theme.colors.primary;
            }}
          >
            <BookIcon size={16} />
            Zu Collection hinzufügen {hasSelection && `(${selectedCount})`}
          </button>
          <button
            style={{
              ...materialsSidebarStyles.actionButton,
              ...materialsSidebarStyles.secondaryButton,
              ...(hasSelection ? {} : materialsSidebarStyles.disabledButton),
            }}
            onClick={() => hasSelection && setShowCreateModal(true)}
            disabled={!hasSelection}
            onMouseEnter={(e) => {
              if (hasSelection) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              if (hasSelection) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Neue Collection erstellen
          </button>
        </div>
      )}

      {/* Add to Collection Modal */}
      {showAddModal && (
        <AddToCollectionModal
          isOpen={showAddModal}
          onClose={() => setShowAddModal(false)}
          selectedItems={selectedItems}
          onSuccess={() => {
            setShowAddModal(false);
            // Optionally clear selection
          }}
        />
      )}

      {/* Create Collection Modal */}
      {showCreateModal && (
        <CreateCollectionModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          selectedItems={selectedItems}
          onSuccess={() => {
            setShowCreateModal(false);
            // Optionally clear selection
          }}
        />
      )}
    </div>
  );
}

// Bookmark Icon for "save as material" button
function BookmarkIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

// Materials toggle button for header (when sidebar is closed)
function MaterialsToggleButton({ materialsCount, onClick }) {
  return (
    <button
      style={materialsSidebarStyles.headerMaterialsButton}
      onClick={onClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
        e.currentTarget.style.color = theme.colors.primary;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = materialsCount > 0 ? theme.colors.primary : theme.colors.textMuted;
      }}
      title="Materialien anzeigen"
    >
      <BookmarkIcon size={16} />
      {materialsCount > 0 && (
        <span style={materialsSidebarStyles.materialsBadge}>{materialsCount}</span>
      )}
    </button>
  );
}

const suggestedQuestions = [
  'Was kannst du alles?',
  'Hilf mir beim Schreiben einer E-Mail',
  'Zeige mir die verfügbaren Dateien',
];

// Supported file types for upload - must match backend attachments.ts
const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'text/html',
];

const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

const SUPPORTED_AUDIO_TYPES = [
  'audio/mpeg',      // mp3
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',       // m4a
  'audio/webm',
  'audio/ogg',
  'audio/flac',
  'video/webm',      // MediaRecorder sometimes reports video/webm for audio-only
];

// File extensions for accept attribute
const SUPPORTED_FILE_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.html,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp3,.wav,.m4a,.webm,.ogg,.flac';

// Human-readable list of supported formats
const SUPPORTED_FORMATS_TEXT = 'PDF, Word, Excel, PowerPoint, Text, Markdown, HTML, PNG, JPG, GIF, WebP, SVG, MP3, WAV, M4A, WebM, OGG, FLAC';

// Normalize MIME type by removing codec parameters (e.g., "audio/webm;codecs=opus" -> "audio/webm")
const normalizeMimeType = (mimeType) => (mimeType || '').split(';')[0].trim();

const isDocumentType = (mimeType) => SUPPORTED_DOCUMENT_TYPES.includes(normalizeMimeType(mimeType));
const isImageType = (mimeType) => SUPPORTED_IMAGE_TYPES.includes(normalizeMimeType(mimeType));
const isAudioType = (mimeType) => SUPPORTED_AUDIO_TYPES.includes(normalizeMimeType(mimeType));
const isSupportedFileType = (mimeType) => isDocumentType(mimeType) || isImageType(mimeType) || isAudioType(mimeType);

// Helper to extract generated image data from content
function extractGeneratedImage(content) {
  if (!content) return null;

  // Strategy 1: Look for JSON with type: "generated_image"
  const jsonPatterns = [
    /\{"type"\s*:\s*"generated_image"[^}]*"url"\s*:\s*"[^"]+"/,
    /\{"type"\s*:\s*"generated_image"[^}]*"imageId"\s*:\s*"[^"]+"/,
  ];

  for (const pattern of jsonPatterns) {
    const match = content.match(pattern);
    if (match) {
      // Find the full JSON object by counting braces
      const startIdx = content.indexOf(match[0]);
      let braceCount = 0;
      let endIdx = startIdx;

      for (let i = startIdx; i < content.length; i++) {
        if (content[i] === '{') braceCount++;
        if (content[i] === '}') braceCount--;
        if (braceCount === 0) {
          endIdx = i + 1;
          break;
        }
      }

      const jsonStr = content.substring(startIdx, endIdx);
      try {
        const parsed = JSON.parse(jsonStr);
        if (parsed.type === 'generated_image' && (parsed.url || parsed.imageId)) {
          if (!parsed.url && parsed.imageId) {
            parsed.url = `/api/images/generated/${parsed.imageId}`;
          }
          let textContent = content.substring(0, startIdx) + content.substring(endIdx);
          // Remove empty code blocks left behind when JSON was inside ```json ... ```
          textContent = textContent.replace(/```(?:json)?\s*\n?\s*```/g, '');
          textContent = textContent.replace(/!\[[^\]]*\]\([^)]*generated[^)]*\)/g, '');
          textContent = textContent.replace(/!\[[^\]]*\]\(\)/g, '');
          // Remove hallucinated external image URLs (imgur, unsplash, etc.)
          textContent = textContent.replace(/!\[[^\]]*\]\(https?:\/\/[^)]+\)/g, '');
          textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();

          return {
            imageData: parsed,
            textContent,
          };
        }
      } catch {
        // Invalid JSON, continue
      }
    }
  }

  // Strategy 2: Look for Markdown image syntax pointing to generated images
  // Pattern: ![alt text](/api/images/generated/img_xxx)
  const markdownImagePattern = /!\[([^\]]*)\]\((\/api\/images\/generated\/(img_[a-zA-Z0-9_]+))\)/;
  const markdownMatch = content.match(markdownImagePattern);

  if (markdownMatch) {
    const [fullMatch, altText, url, imageId] = markdownMatch;

    // Remove the markdown image from content
    let textContent = content.replace(markdownImagePattern, '');
    textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();

    return {
      imageData: {
        type: 'generated_image',
        imageId: imageId,
        url: url,
        prompt: altText || 'Generiertes Bild',
      },
      textContent,
    };
  }

  return null;
}

// Helper to extract exported document data from content
function extractExportedDocument(content) {
  if (!content) return null;

  // Strategy 1: Look for JSON objects with type: "exported_document"
  const jsonStartPattern = /\{[^{}]*"type"\s*:\s*"exported_document"/g;
  let match;

  while ((match = jsonStartPattern.exec(content)) !== null) {
    let startIdx = match.index;
    let braceCount = 0;
    let endIdx = startIdx;

    for (let i = startIdx; i < content.length; i++) {
      if (content[i] === '{') braceCount++;
      if (content[i] === '}') braceCount--;
      if (braceCount === 0) {
        endIdx = i + 1;
        break;
      }
    }

    const jsonStr = content.substring(startIdx, endIdx);
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.type === 'exported_document' && parsed.downloadUrl) {
        let textContent = content.substring(0, startIdx) + content.substring(endIdx);
        textContent = textContent.replace(/\[.*?\]\(\/api\/exports\/download\/[^)]+\)/g, '');
        textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();

        return {
          documentData: parsed,
          textContent,
        };
      }
    } catch {
      // Invalid JSON, continue
    }
  }

  // Strategy 2: Look for markdown links to export downloads
  // Pattern: [Link Text](/api/exports/download/filename.ext)
  const linkPattern = /\[([^\]]+)\]\((\/api\/exports\/download\/([^)]+))\)/;
  const linkMatch = content.match(linkPattern);

  if (linkMatch) {
    const [fullMatch, linkText, downloadUrl, filename] = linkMatch;
    // Extract format from filename
    const formatMatch = filename.match(/\.(\w+)$/);
    const format = formatMatch ? formatMatch[1] : 'docx';

    // Extract title from link text or filename
    let title = linkText;
    // Remove format suffix from link text if present
    title = title.replace(/\s*\(\w+\)\s*$/, '').replace(/\s*\.\w+$/, '');
    // If title is generic like "Download" or "Download hier", use filename
    if (/^download/i.test(title)) {
      title = filename.replace(/[-_]/g, ' ').replace(/\.\w+$/, '').replace(/_\d+$/, '');
      // Capitalize first letter of each word
      title = title.replace(/\b\w/g, c => c.toUpperCase());
    }

    let textContent = content.replace(fullMatch, '');
    textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();

    return {
      documentData: {
        type: 'exported_document',
        success: true,
        title: title,
        downloadUrl: downloadUrl,
        filename: filename,
        format: format,
      },
      textContent,
    };
  }

  return null;
}

// Assistant message with copy functionality
function AssistantMessage({ content, isStreaming: isCurrentlyStreaming, onMarkAsMaterial, isMarkedAsMaterial, onAddImageMaterial, onOpenLightbox }) {
  const [isHovered, setIsHovered] = useState(false);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [bookmarkHovered, setBookmarkHovered] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleMarkAsMaterial = (e) => {
    e.stopPropagation();
    if (onMarkAsMaterial) {
      onMarkAsMaterial();
    }
  };

  // Check for generated image in content
  const imageExtraction = extractGeneratedImage(content);
  const hasGeneratedImage = imageExtraction !== null;
  const afterImageContent = hasGeneratedImage ? imageExtraction.textContent : content;
  const imageData = hasGeneratedImage ? imageExtraction.imageData : null;

  // Check for exported document in remaining content
  const documentExtraction = extractExportedDocument(afterImageContent);
  const hasExportedDocument = documentExtraction !== null;
  let textContent = hasExportedDocument ? documentExtraction.textContent : afterImageContent;
  const documentData = hasExportedDocument ? documentExtraction.documentData : null;

  // Remove hallucinated external image URLs (imgur, unsplash, placeholder, etc.)
  if (textContent) {
    textContent = textContent.replace(/!\[[^\]]*\]\(https?:\/\/[^)]+\)/g, '');
    // Remove tool call JSON code blocks (delegate_to_agent, etc.)
    // Pattern: ```json\n{"agent_id": ...}\n``` or ```\n{"agent_id": ...}\n```
    textContent = textContent.replace(/```(?:json)?\s*\n?\s*\{\s*"agent_id"\s*:[^`]*```/gs, '');
    textContent = textContent.replace(/```(?:json)?\s*\n?\s*\{\s*"name"\s*:\s*"[^"]*"\s*,\s*"arguments"\s*:[^`]*```/gs, '');
    // Remove generated_image/exported_document JSON code blocks (LLM may echo tool results)
    textContent = textContent.replace(/```(?:json)?\s*\n?\s*\{\s*"type"\s*:\s*"(?:generated_image|exported_document)"[^`]*```/gs, '');
    // Remove inline tool call JSON (without code blocks)
    textContent = textContent.replace(/\{\s*"agent_id"\s*:\s*"[^"]+"\s*,\s*"task"\s*:\s*"[^"]*"[^}]*\}/gs, '');
    // Remove empty code blocks (leftover from JSON extraction)
    textContent = textContent.replace(/```(?:json)?\s*\n?\s*```/g, '');
    textContent = textContent.replace(/\n{3,}/g, '\n\n').trim();
  }

  return (
    <div
      className="markdown-body"
      style={chatStyles.assistantMessageWithCopy}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {content && !isCurrentlyStreaming && (
        <>
          {copied ? (
            <div style={chatStyles.copyFeedback}>
              Kopiert!
            </div>
          ) : (
            <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', zIndex: 1 }}>
              {/* Bookmark/Save as Material button */}
              {onMarkAsMaterial && (
                <button
                  onClick={handleMarkAsMaterial}
                  onMouseEnter={() => setBookmarkHovered(true)}
                  onMouseLeave={() => setBookmarkHovered(false)}
                  style={{
                    ...chatStyles.copyButton,
                    position: 'static',
                    ...(isHovered ? chatStyles.copyButtonVisible : {}),
                    ...(bookmarkHovered ? chatStyles.copyButtonHover : {}),
                    ...(isMarkedAsMaterial ? { opacity: 1, color: theme.colors.primary } : {}),
                  }}
                  title={isMarkedAsMaterial ? 'Bereits als Material gespeichert' : 'Als Material speichern'}
                >
                  <svg style={chatStyles.copyButtonIcon} viewBox="0 0 24 24" fill={isMarkedAsMaterial ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
                  </svg>
                </button>
              )}
              {/* Copy button */}
              <button
                onClick={handleCopy}
                onMouseEnter={() => setButtonHovered(true)}
                onMouseLeave={() => setButtonHovered(false)}
                style={{
                  ...chatStyles.copyButton,
                  position: 'static',
                  ...(isHovered ? chatStyles.copyButtonVisible : {}),
                  ...(buttonHovered ? chatStyles.copyButtonHover : {}),
                }}
                title="In Zwischenablage kopieren"
              >
                <svg style={chatStyles.copyButtonIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
      {textContent ? (
        <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
          {textContent}
        </ReactMarkdown>
      ) : (
        isCurrentlyStreaming && <p>...</p>
      )}
      {/* Render generated image if present */}
      {hasGeneratedImage && imageData && (
        <GeneratedImage
          imageId={imageData.imageId}
          url={imageData.url}
          prompt={imageData.prompt}
          aspectRatio={imageData.aspectRatio}
          provider={imageData.provider}
          model={imageData.model}
          onAddToMaterials={onAddImageMaterial}
          onOpenLightbox={onOpenLightbox}
        />
      )}
      {/* Render exported document if present */}
      {hasExportedDocument && documentData && (
        <ExportedDocument
          title={documentData.title}
          filename={documentData.filename}
          format={documentData.format}
          downloadUrl={documentData.downloadUrl}
        />
      )}
    </div>
  );
}

// File icon component
function FileIcon({ type, style }) {
  if (type === 'image') {
    return (
      <svg style={style} viewBox="0 0 24 24" fill="none" stroke={theme.colors.info} strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    );
  }
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={theme.colors.warning} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

// Helper to convert relative API URLs to absolute URLs
function getAbsoluteUrl(relativeUrl) {
  if (!relativeUrl) return relativeUrl;
  if (relativeUrl.startsWith('http')) return relativeUrl;
  // Remove leading /api if present since API_URL already includes it
  const path = relativeUrl.startsWith('/api/') ? relativeUrl.slice(4) : relativeUrl;
  return `${API_URL}${path}`;
}

// Message Attachments - Renders attachments in chat history
function MessageAttachments({ attachments, onOpenLightbox }) {
  if (!attachments || attachments.length === 0) return null;

  return (
    <div style={chatStyles.messageAttachments}>
      {attachments.map((attachment) => {
        const { id, type, filename, mimeType, url, transcription, preview } = attachment;
        const absoluteUrl = getAbsoluteUrl(url);

        if (type === 'audio') {
          return (
            <div key={id} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              <AudioPlayer
                url={absoluteUrl}
                filename={filename}
                mimeType={mimeType}
              />
              {transcription && (
                <TranscriptBlock text={transcription} />
              )}
            </div>
          );
        }

        if (type === 'image') {
          return (
            <img
              key={id}
              src={absoluteUrl}
              alt={filename}
              style={chatStyles.imageAttachment}
              onClick={() => {
                if (onOpenLightbox) {
                  onOpenLightbox({
                    imageUrl: absoluteUrl,
                    prompt: filename,
                    imageId: id,
                  });
                } else {
                  window.open(absoluteUrl, '_blank');
                }
              }}
              title={`${filename} - Klicken zum Vergrößern`}
            />
          );
        }

        // Document type
        return (
          <div
            key={id}
            style={chatStyles.documentPreview}
            onClick={() => window.open(absoluteUrl, '_blank')}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = theme.colors.surface;
            }}
            title={`${filename} - Klicken zum Öffnen`}
          >
            <svg style={chatStyles.documentIcon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
            <span style={chatStyles.documentName}>{filename}</span>
          </div>
        );
      })}
    </div>
  );
}

// Attachment chips for files pending upload
// Now uses FilePill for consistent design with processing state support
// Audio files show automatic transcription status with language selector
function AttachmentChips({ files, onRemove, fileProcessingState = {}, sttAvailable = true, transcriptionLanguage, onLanguageChange, fileTranscriptions = {} }) {
  if (!files || files.length === 0) return null;

  return (
    <div style={chatStyles.attachmentChipsContainer}>
      {files.map((file, index) => {
        const isImage = isImageType(file.type);
        const isAudio = isAudioType(file.type);
        // Check if this file is being processed (by fileId if available, or filename as fallback)
        const fileKey = file.id || file.name;
        const processingStatus = fileProcessingState[fileKey];
        const isProcessing = processingStatus === 'processing';

        // Get transcription state for audio files
        const transcriptionState = fileTranscriptions[fileKey];
        const isTranscribing = transcriptionState?.status === 'transcribing';
        const transcriptionDone = transcriptionState?.status === 'done';
        const transcriptionError = transcriptionState?.status === 'error';

        return (
          <div key={fileKey || index} style={chatStyles.audioChipContainer}>
            <FilePill
              filename={file.name}
              isImage={isImage}
              isAudio={isAudio}
              isProcessing={isProcessing || isTranscribing}
              onRemove={() => onRemove(index)}
            />
            {isAudio && sttAvailable && (
              <>
                <select
                  value={transcriptionLanguage}
                  onChange={(e) => onLanguageChange?.(e.target.value)}
                  disabled={isTranscribing}
                  style={{
                    ...chatStyles.attachmentLanguageSelect,
                    ...(isTranscribing ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
                  }}
                  title="Sprache für Transkription (Änderung transkribiert erneut)"
                >
                  <option value="de">DE</option>
                  <option value="en">EN</option>
                  <option value="fr">FR</option>
                  <option value="es">ES</option>
                  <option value="it">IT</option>
                  <option value="pt">PT</option>
                  <option value="nl">NL</option>
                  <option value="pl">PL</option>
                  <option value="ru">RU</option>
                  <option value="zh">ZH</option>
                  <option value="ja">JA</option>
                </select>
                {/* Transcription status indicator */}
                <span
                  style={{
                    ...chatStyles.transcriptionStatus,
                    color: transcriptionError ? theme.colors.error :
                           transcriptionDone ? theme.colors.success :
                           theme.colors.textMuted,
                  }}
                  title={transcriptionError ? 'Transkription fehlgeschlagen' :
                         transcriptionDone ? `Transkribiert (${transcriptionState.text?.length || 0} Zeichen)` :
                         'Transkribiert automatisch...'}
                >
                  {isTranscribing && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                      <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
                    </svg>
                  )}
                  {transcriptionDone && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                  {transcriptionError && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="15" y1="9" x2="9" y2="15" />
                      <line x1="9" y1="9" x2="15" y2="15" />
                    </svg>
                  )}
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Source icon component for reader documents
function SourceIcon({ type, style }) {
  switch (type) {
    case 'chat':
    case 'chats':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={theme.colors.info} strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
    case 'knowledge':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'confluence':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 14s1.5 2 4 2 4-2 4-2" />
          <line x1="9" y1="9" x2="9.01" y2="9" />
          <line x1="15" y1="9" x2="15.01" y2="9" />
        </svg>
      );
    case 'gdrive':
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={theme.colors.warning} strokeWidth="2">
          <path d="M12 2L2 19h20L12 2z" />
          <path d="M12 2l10 17H2L12 2z" />
        </svg>
      );
    default:
      return (
        <svg style={style} viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
      );
  }
}

// Reader chips for documents loaded from search
function ReaderChips({ readers, onClear, isLoading }) {
  if ((!readers || readers.length === 0) && !isLoading) return null;

  return (
    <div style={chatStyles.attachmentChipsContainer}>
      {isLoading ? (
        <div style={chatStyles.attachmentChip}>
          <span style={{ fontSize: '14px' }}>⏳</span>
          <span style={chatStyles.attachmentChipName}>
            Dokumente werden vorbereitet...
          </span>
        </div>
      ) : (
        readers.map((reader, index) => (
          <div key={`${reader.type}-${reader.id}`} style={chatStyles.attachmentChip}>
            <SourceIcon type={reader.type} style={chatStyles.attachmentChipIcon} />
            <span style={chatStyles.attachmentChipName} title={reader.title}>
              {reader.title}
            </span>
            {index === readers.length - 1 && (
              <button
                style={chatStyles.attachmentChipRemove}
                onClick={onClear}
                onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
                onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                title="Alle Dokumente entfernen"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
        ))
      )}
    </div>
  );
}

// Paperclip/Attachment button
function AttachmentButton({ onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        ...chatStyles.attachmentButton,
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      onMouseOver={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
          e.currentTarget.style.color = theme.colors.primary;
        }
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = theme.colors.textMuted;
      }}
      title="Datei anhängen&#10;PDF, Word, Excel, PowerPoint, Bilder, Audio&#10;Max. 50 MB (Audio: 25 MB)"
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
      </svg>
    </button>
  );
}

// Context Chips Component - shows active selections (agent, model, table, project, etc.)
// Uses ContextPill components for unified design: gray background + colored icons
function ContextChips({
  selectedAgentId,
  agents,
  onRemoveAgent,
  selectedModelId,
  selectedModelName,
  onRemoveModel,
  selectedTable,
  onRemoveTable,
  project,
}) {
  const hasAgent = selectedAgentId != null;
  const hasModel = selectedModelId != null;  // Show if any model is explicitly selected
  const hasTable = selectedTable != null;
  const hasProject = project != null;

  if (!hasAgent && !hasModel && !hasTable && !hasProject) return null;

  const agent = hasAgent ? agents?.find(a => a.id === selectedAgentId) : null;

  return (
    <div style={chatStyles.contextChipsContainer}>
      {/* Project Pill - Lila (kein onRemove - Projekt ist fix in ProjectDetailPage) */}
      {hasProject && (
        <ProjectPill
          projectName={project.name}
        />
      )}

      {/* Agent Pill - Blau */}
      {hasAgent && (
        <AgentPill
          agentName={agent?.name || selectedAgentId}
          onRemove={onRemoveAgent}
        />
      )}

      {/* Model Pill - Lila */}
      {hasModel && (
        <ModelPill
          modelName={selectedModelName || selectedModelId}
          onRemove={onRemoveModel}
        />
      )}

      {/* Table Pill - Grün */}
      {hasTable && (
        <TablePill
          tableName={selectedTable.name || selectedTable.id}
          onRemove={onRemoveTable}
        />
      )}
    </div>
  );
}


function ChatWindow({
  messages,
  isStreaming,
  agentStatus,
  activeAgentId,
  agents,
  selectedAgentId,
  onSelectAgent,
  onSelectAuto,
  onSendMessage,
  onNewChat,
  onClearChat,
  activeTasks,
  onTaskCompleted,
  loadedReaders = [],
  onClearReaders,
  isPreparingReaders = false,
  // New props for unified context pills
  selectedModelId,
  selectedModelName,
  onRemoveModel,
  onModelChanged,     // Callback when model is changed via /model command
  activeModelName,    // Default active model name (from providers config)
  selectedTable,
  onRemoveTable,
  onTableSelected,    // Callback when table is selected via /table command
  fileProcessingState = {},  // Map of fileId -> 'processing' | 'ready'
  project = null,     // Optional: Project context { id, name, color }
  // Chat info props for header
  chatId = null,
  chatTitle = null,
  // Folder props
  folders = [],
  chatFolderIds = [],
  onUpdateChatFolders,
  // Materials props
  materials = [],
  onAddMaterial,
  onRemoveMaterial,
  onUpdateMaterials,
  agentLog = [],
  getSessionId,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const agentNameById = useMemo(
    () => new Map((agents || []).map((a) => [a.id, a.name])),
    [agents],
  );

  // Collection-IDs (slug) → Display-Name fuer Tool-Args wie collection_id.
  // Einmal beim Mount geladen — Liste aendert sich selten, kein Refresh-Bedarf.
  const [collectionNameById, setCollectionNameById] = useState(() => new Map());
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/knowledge/collections');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const map = new Map((data.collections || []).map((c) => [c.id, c.name]));
        setCollectionNameById(map);
      } catch {
        // Best effort — falls's failt, zeigen wir Slug-IDs wie bisher.
      }
    })();
    return () => { cancelled = true; };
  }, []);
  const [input, setInput] = useState('');
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandMessage, setCommandMessage] = useState(null);
  const [attachedFiles, setAttachedFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showFolderDropdown, setShowFolderDropdown] = useState(false);
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('de');
  // Track transcriptions per file: { [fileKey]: { status: 'pending'|'transcribing'|'done'|'error', text?: string, language?: string } }
  const [fileTranscriptions, setFileTranscriptions] = useState({});
  // Materials sidebar state
  const [showMaterialsSidebar, setShowMaterialsSidebar] = useState(false);
  // Agent log panel state
  const [showAgentLog, setShowAgentLog] = useState(false);
  const [selectedMaterialIds, setSelectedMaterialIds] = useState(new Set());
  // Image lightbox state
  const [lightboxData, setLightboxData] = useState(null);
  // Export state
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const { executeCommand } = useCommands();

  // Audio recording and transcription hooks
  const { isRecording, formattedTime, error: recordingError, startRecording, stopRecording, cancelRecording } = useAudioRecorder();
  const { transcribe, isTranscribing, error: transcriptionError, isAvailable: sttAvailable } = useTranscription();

  // Close folder dropdown on outside click
  useEffect(() => {
    if (!showFolderDropdown) return;
    const handleClickOutside = () => setShowFolderDropdown(false);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showFolderDropdown]);

  // Export chat in various formats (md, xlsx, pdf, docx)
  const handleExport = useCallback(async (format) => {
    if (!chatId) return;
    setIsExporting(true);
    setExportingFormat(format);
    try {
      // Markdown uses the download endpoint, other formats use export endpoint
      const endpoint = format === 'md'
        ? `${API_URL}/chats/${chatId}/download`
        : `${API_URL}/chats/${chatId}/export/${format}?scope=full`;

      const response = await fetch(endpoint, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const filename = response.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1]
        || `chat_${chatId}.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  }, [chatId]);

  const isAutoSelected = selectedAgentId === null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, agentStatus]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  // Show command message briefly
  useEffect(() => {
    if (commandMessage) {
      const timer = setTimeout(() => setCommandMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [commandMessage]);

  // Clear UI state when starting a new chat (messages become empty)
  useEffect(() => {
    if (messages.length === 0) {
      setCommandMessage(null);
      setAttachedFiles([]);
      setFileTranscriptions({});
      setSelectedMaterialIds(new Set());
    }
  }, [messages.length]);


  // Materials management functions
  const handleToggleMaterialSelection = useCallback((materialId) => {
    setSelectedMaterialIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(materialId)) {
        newSet.delete(materialId);
      } else {
        newSet.add(materialId);
      }
      return newSet;
    });
  }, []);

  const handleRemoveMaterial = useCallback((materialId) => {
    onRemoveMaterial?.(materialId);
    setSelectedMaterialIds(prev => {
      const newSet = new Set(prev);
      newSet.delete(materialId);
      return newSet;
    });
  }, [onRemoveMaterial]);

  // Add assistant message as material (user marked)
  const handleMarkAsMaterial = useCallback((messageIndex, content) => {
    if (!onAddMaterial) return;

    // Generate title from first line or first 50 chars
    const lines = content.split('\n').filter(l => l.trim());
    const firstLine = lines[0] || '';
    const title = firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine || 'Markierte Antwort';

    const material = {
      id: `material_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      type: 'user_marked',
      title,
      content,
      sourceMessageIndex: messageIndex,
      createdAt: Date.now(),
    };

    onAddMaterial(material);
    setCommandMessage('Als Material gespeichert');
  }, [onAddMaterial]);

  // Open command palette when "/" is typed at start
  useEffect(() => {
    if (input === '/') {
      setShowCommandPalette(true);
    } else if (!input.startsWith('/')) {
      setShowCommandPalette(false);
    }
  }, [input]);

  // Auto-transcription for audio files
  // Using a ref to track in-flight transcriptions to avoid dependency on fileTranscriptions
  const pendingTranscriptionsRef = useRef(new Set());

  useEffect(() => {
    if (!sttAvailable) return;

    // Find audio files that need transcription
    attachedFiles.forEach((file) => {
      const fileKey = file.id || file.name;
      const isAudio = isAudioType(file.type);
      if (!isAudio) return;

      // Check if already transcribing
      if (pendingTranscriptionsRef.current.has(fileKey)) return;

      setFileTranscriptions(prev => {
        const currentTranscription = prev[fileKey];

        // Start transcription if:
        // 1. No transcription exists (pending state)
        // 2. Language changed since last transcription
        const needsTranscription = !currentTranscription ||
          (currentTranscription.status === 'done' && currentTranscription.language !== transcriptionLanguage);

        if (needsTranscription) {
          // Mark as pending to avoid duplicate requests
          pendingTranscriptionsRef.current.add(fileKey);

          // Start transcription asynchronously
          transcribe(file, transcriptionLanguage)
            .then(text => {
              pendingTranscriptionsRef.current.delete(fileKey);
              setFileTranscriptions(p => ({
                ...p,
                [fileKey]: { status: 'done', text, language: transcriptionLanguage }
              }));
            })
            .catch(err => {
              pendingTranscriptionsRef.current.delete(fileKey);
              console.error('Auto-transcription failed:', err);
              setFileTranscriptions(p => ({
                ...p,
                [fileKey]: { status: 'error', error: err.message, language: transcriptionLanguage }
              }));
              setCommandMessage(err.message || 'Transkription fehlgeschlagen');
            });

          return {
            ...prev,
            [fileKey]: { status: 'transcribing', language: transcriptionLanguage }
          };
        }

        return prev;
      });
    });

    // Clean up transcriptions for removed files
    setFileTranscriptions(prev => {
      const fileKeys = new Set(attachedFiles.map(f => f.id || f.name));
      const filtered = {};
      for (const key of Object.keys(prev)) {
        if (fileKeys.has(key)) {
          filtered[key] = prev[key];
        }
      }
      // Also clean up pending refs
      for (const key of pendingTranscriptionsRef.current) {
        if (!fileKeys.has(key)) {
          pendingTranscriptionsRef.current.delete(key);
        }
      }
      return Object.keys(filtered).length !== Object.keys(prev).length ? filtered : prev;
    });
  }, [attachedFiles, transcriptionLanguage, sttAvailable, transcribe]);

  // File upload handlers
  const handleFileSelect = useCallback((files) => {
    const allFiles = Array.from(files);
    const validFiles = [];
    const rejectedFiles = [];

    allFiles.forEach(file => {
      if (isSupportedFileType(file.type)) {
        validFiles.push(file);
      } else {
        rejectedFiles.push(file.name);
        console.warn(`Unsupported file type: ${file.type} (${file.name})`);
      }
    });

    // Add valid files
    if (validFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...validFiles]);
    }

    // Show error message for rejected files
    if (rejectedFiles.length > 0) {
      const fileList = rejectedFiles.length <= 3
        ? rejectedFiles.join(', ')
        : `${rejectedFiles.slice(0, 3).join(', ')} (+${rejectedFiles.length - 3} weitere)`;
      setCommandMessage(`Nicht unterstützt: ${fileList}. Erlaubt: ${SUPPORTED_FORMATS_TEXT}`);
    }
  }, []);

  const handleFileInputChange = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  }, [handleFileSelect]);

  const handleRemoveFile = useCallback((index) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // Audio recording handlers
  const handleRecordClick = useCallback(async () => {
    if (isRecording) {
      // Stop recording and add file to attachments
      const file = await stopRecording();
      if (file) {
        setAttachedFiles(prev => [...prev, file]);
      }
    } else {
      // Start recording
      try {
        await startRecording();
      } catch (err) {
        // Error is handled in the hook
        console.error('Could not start recording:', err);
      }
    }
  }, [isRecording, startRecording, stopRecording]);

  // Show recording error as command message
  useEffect(() => {
    if (recordingError) {
      setCommandMessage(recordingError);
    }
  }, [recordingError]);

  // Show transcription error as command message
  useEffect(() => {
    if (transcriptionError) {
      setCommandMessage(transcriptionError);
    }
  }, [transcriptionError]);

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (showCommandPalette) {
      // Don't submit if command palette is open
      return;
    }
    if ((input.trim() || attachedFiles.length > 0) && !isStreaming) {
      // Pass both message and files
      onSendMessage(input.trim(), attachedFiles.length > 0 ? attachedFiles : undefined);
      setInput('');
      setAttachedFiles([]);
    }
  };

  const handleKeyDown = (e) => {
    // Let CommandPalette handle keys when open
    if (showCommandPalette) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowCommandPalette(false);
        setInput('');
      }
      // Don't process Enter when palette is open (palette handles it)
      if (e.key === 'Enter' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'Tab') {
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Handle command execution from palette
  const handleCommandExecute = useCallback(async (commandId, optionId, args, options) => {
    // If command needs argument, update input and keep palette open
    if (options?.needsArg) {
      setInput(`/${commandId} `);
      return;
    }

    // Close palette
    setShowCommandPalette(false);
    setInput('');

    // Execute the command
    const result = await executeCommand(commandId, optionId, args);

    if (result.success) {
      // Show confirmation message
      setCommandMessage(result.message);

      // Handle action
      if (result.action) {
        switch (result.action.type) {
          case 'agent_changed':
            if (result.action.payload.autoRoute) {
              onSelectAuto?.();
            } else {
              onSelectAgent?.(result.action.payload.agentId);
            }
            break;
          case 'new_chat':
            onNewChat?.();
            break;
          case 'chat_cleared':
            onClearChat?.();
            break;
          case 'skill_started':
            // Generate readable message based on skill and attachments
            const { skillId, skillName } = result.action.payload;
            let skillMessage;

            if (attachedFiles.length > 0) {
              // Generate human-readable message with file names
              const fileNames = attachedFiles.map(f => f.name).join(', ');

              // Skill-specific messages
              if (skillId === 'summarize') {
                skillMessage = attachedFiles.length === 1
                  ? `Fasse "${attachedFiles[0].name}" zusammen`
                  : `Fasse diese Dokumente zusammen: ${fileNames}`;
              } else if (skillId === 'write') {
                skillMessage = `/${skillId} (Kontext: ${fileNames})`;
              } else {
                // Generic message for other skills
                skillMessage = `${skillName}: ${fileNames}`;
              }

              // Send with attachments, skillId and clear attachments
              onSendMessage?.(skillMessage, attachedFiles, skillId);
              setAttachedFiles([]);
            } else {
              // No attachments - send skill command with skillId
              onSendMessage?.(`/${skillId}`, undefined, skillId);
            }
            break;
          case 'task_started':
            // Send task prompt as message
            onSendMessage?.(result.action.payload.prompt);
            break;
          case 'model_changed':
            // Model selection changed
            onModelChanged?.(result.action.payload);
            break;
          case 'table_opened':
            // Table selected for context
            onTableSelected?.(result.action.payload);
            break;
          case 'generate_image':
            // Send image generation prompt as message (will trigger image generation skill)
            onSendMessage?.(`Generiere ein Bild: ${result.action.payload.prompt}`);
            break;
          case 'image_model_changed':
            // Image generation model was changed - show confirmation
            // No additional action needed, message already shown
            break;
          case 'image_info':
            // Info about current image model - no action needed
            break;
        }
      }
    } else {
      setCommandMessage(result.message);
    }
  }, [executeCommand, onSelectAgent, onSelectAuto, onNewChat, onClearChat, onSendMessage, attachedFiles, onModelChanged, onTableSelected]);

  const handleCloseCommandPalette = useCallback(() => {
    setShowCommandPalette(false);
    setInput('');
    textareaRef.current?.focus();
  }, []);

  const handleSuggestedQuestion = (question) => {
    if (!isStreaming) {
      onSendMessage(question);
    }
  };

  const getAgentForMessage = (msg) => {
    if (!msg.agentId) return null;
    return agents?.find(a => a.id === msg.agentId);
  };

  const getSelectedAgentName = () => {
    if (isAutoSelected) return 'Auto-Routing';
    const agent = agents?.find(a => a.id === selectedAgentId);
    return agent?.name || 'Agent';
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', gap: theme.spacing.lg }}>
      <div style={{ ...chatStyles.container, flex: 1, minWidth: 0 }}>
      <style>{`
        .markdown-body {
          overflow-wrap: break-word;
          word-wrap: break-word;
          word-break: break-word;
          max-width: 100%;
          overflow: hidden;
        }
        .markdown-body > *:last-child { margin-bottom: 0; }
        .markdown-body strong { font-weight: 600; }
        .markdown-body em { font-style: italic; }
        .markdown-body > div {
          max-width: 100%;
          overflow: hidden;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes contextPillSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
      {/* Header */}
      <div style={chatStyles.header}>
        <div style={chatStyles.headerIcon}>
          <AssistantIcon />
        </div>
        <div style={chatStyles.headerText}>
          <div style={chatStyles.headerTitle}>
            {chatTitle || 'KI-Assistent'}
          </div>
          <div style={chatStyles.headerSubtitle}>
            {getSelectedAgentName()}
            {(selectedModelName || activeModelName) && ` · ${selectedModelName || activeModelName}`}
          </div>
        </div>
        {chatId && (
          <div style={chatStyles.headerActions}>
            {/* Folder assignment button */}
            <div style={{ position: 'relative' }}>
              <button
                style={{
                  ...chatStyles.headerActionButton,
                  ...(chatFolderIds.length > 0 ? { color: theme.colors.primary } : {}),
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFolderDropdown(!showFolderDropdown);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  if (chatFolderIds.length === 0) {
                    e.currentTarget.style.color = theme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  if (chatFolderIds.length === 0) {
                    e.currentTarget.style.color = theme.colors.textMuted;
                  }
                }}
                title={chatFolderIds.length > 0 ? `In ${chatFolderIds.length} Ordner(n)` : 'Zu Ordner hinzufügen'}
              >
                <FolderIcon size={16} />
                {chatFolderIds.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: theme.colors.primary,
                    borderRadius: '50%',
                  }} />
                )}
              </button>
              {showFolderDropdown && (
                <div
                  style={chatStyles.folderDropdown}
                  onClick={(e) => e.stopPropagation()}
                >
                  {folders.length === 0 ? (
                    <div style={{ padding: theme.spacing.md, color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                      Keine Ordner vorhanden. Erstelle zuerst einen Ordner in der Sidebar.
                    </div>
                  ) : (
                    folders.map(folder => {
                      const isInFolder = chatFolderIds.includes(folder.id);
                      return (
                        <button
                          key={folder.id}
                          style={chatStyles.folderDropdownItem}
                          onClick={() => {
                            const newFolderIds = isInFolder
                              ? chatFolderIds.filter(id => id !== folder.id)
                              : [...chatFolderIds, folder.id];
                            onUpdateChatFolders?.(newFolderIds);
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isInFolder}
                            readOnly
                            style={chatStyles.folderCheckbox}
                          />
                          <FolderIcon size={14} color={folder.color || theme.colors.textMuted} />
                          <span>{folder.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
            <button
              style={chatStyles.headerActionButton}
              onClick={() => setShowShareModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                e.currentTarget.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textMuted;
              }}
              title="Chat teilen"
            >
              <LinkIcon size={16} />
            </button>
            <ExportDropdown
              onExport={handleExport}
              formats={['md', 'pdf', 'docx', 'xlsx']}
              isLoading={isExporting}
              loadingFormat={exportingFormat}
              disabled={!chatId}
            />
            {/* Agent Log toggle button — Admin-only, enthaelt Tool-Calls + Args */}
            {isAdmin && (
              <button
                style={{
                  ...chatStyles.headerActionButton,
                  ...(showAgentLog ? { color: theme.colors.primary, backgroundColor: theme.colors.primaryLight } : {}),
                }}
                onClick={() => setShowAgentLog(!showAgentLog)}
                onMouseEnter={(e) => {
                  if (!showAgentLog) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                    e.currentTarget.style.color = theme.colors.primary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!showAgentLog) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.colors.textMuted;
                  }
                }}
                title="Agent Log"
              >
                <TimelineIcon size={16} />
                {agentLog.length > 0 && !showAgentLog && (
                  <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    width: '8px',
                    height: '8px',
                    backgroundColor: theme.colors.primary,
                    borderRadius: '50%',
                  }} />
                )}
              </button>
            )}
            {/* Materials toggle button - only show when sidebar is closed and materials exist or onAddMaterial is provided */}
            {onAddMaterial && !showMaterialsSidebar && (
              <MaterialsToggleButton
                materialsCount={materials.length}
                onClick={() => setShowMaterialsSidebar(true)}
              />
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && chatId && (
        <ShareModal
          chatId={chatId}
          chatTitle={chatTitle || 'Chat'}
          onClose={() => setShowShareModal(false)}
        />
      )}

      {/* Messages */}
      <div style={chatStyles.messagesContainer}>
        {messages.length === 0 ? (
          <div style={chatStyles.emptyState}>
            <div style={chatStyles.emptyIcon}>
              <AssistantIconLarge />
            </div>
            <div style={chatStyles.emptyTitle}>KI-Assistent</div>
            <div style={chatStyles.emptyDescription}>
              Stelle Fragen oder wähle einen spezialisierten Agenten für deine Aufgabe.
            </div>

            <div style={chatStyles.suggestedQuestions}>
              {suggestedQuestions.map((question, index) => (
                <button
                  key={index}
                  style={chatStyles.suggestedQuestion}
                  onClick={() => handleSuggestedQuestion(question)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.primary;
                    e.currentTarget.style.color = theme.colors.primary;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = theme.colors.border;
                    e.currentTarget.style.color = theme.colors.textSecondary;
                  }}
                >
                  {question}
                </button>
              ))}
            </div>

            <div style={chatStyles.infoBox}>
              <div style={chatStyles.infoBoxTitle}>Hinweis:</div>
              <div style={chatStyles.infoBoxText}>
                Die Antworten werden durch KI generiert und können Fehler enthalten.
                Bitte verifiziere wichtige Informationen.
              </div>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => {
            const msgAgent = msg.role === 'assistant' ? getAgentForMessage(msg) : null;

            return (
              <div
                key={index}
                style={{
                  ...chatStyles.messageWrapper,
                  alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                }}
              >
                {msg.role === 'assistant' && (msgAgent || msg.routedBy === 'supervisor') && (
                  <div style={chatStyles.agentBadge}>
                    {msgAgent ? (
                      <>
                        <AgentIcon agentId={msgAgent.id} style={chatStyles.agentBadgeIcon} />
                        <span>{msgAgent.name}</span>
                        {msg.routedBy === 'auto' && (
                          <span style={{ fontStyle: 'italic', opacity: 0.7 }}>(auto)</span>
                        )}
                      </>
                    ) : msg.routedBy === 'supervisor' ? (
                      <span style={{ fontStyle: 'italic', opacity: 0.7 }}>Supervisor</span>
                    ) : null}
                  </div>
                )}

                {msg.role === 'assistant' && (msg.thinkingSteps?.length > 0 || msg.reasoning) && (
                  <ThinkingBlock
                    steps={msg.thinkingSteps}
                    isStreaming={isStreaming && index === messages.length - 1}
                    reasoning={msg.reasoning}
                    agentNameById={agentNameById}
                    collectionNameById={collectionNameById}
                  />
                )}

                {msg.role === 'assistant' ? (
                  <AssistantMessage
                    content={msg.content}
                    isStreaming={isStreaming && index === messages.length - 1}
                    onMarkAsMaterial={onAddMaterial ? () => handleMarkAsMaterial(index, msg.content) : undefined}
                    isMarkedAsMaterial={materials.some(m => m.sourceMessageIndex === index)}
                    onAddImageMaterial={onAddMaterial ? (imageData) => {
                      onAddMaterial({
                        type: 'generated_image',
                        content: `![${imageData.prompt}](${imageData.url})`,
                        sourceMessageIndex: index,
                        metadata: {
                          imageId: imageData.imageId,
                          url: imageData.url,
                          prompt: imageData.prompt,
                          provider: imageData.provider,
                          model: imageData.model,
                        },
                      });
                    } : undefined}
                    onOpenLightbox={(data) => setLightboxData(data)}
                  />
                ) : (
                  <div style={chatStyles.userMessageContainer}>
                    {/* Attachments above the message text */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <MessageAttachments
                        attachments={msg.attachments}
                        onOpenLightbox={(data) => setLightboxData(data)}
                      />
                    )}
                    {/* User message text */}
                    <div
                      style={{
                        ...chatStyles.message,
                        ...chatStyles.userMessage,
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        {/* Active Task Status Blocks - rendered after all messages */}
        {activeTasks && activeTasks.length > 0 && (
          activeTasks.map((t) => (
            <TaskStatusBlock
              key={t.taskId}
              taskId={t.taskId}
              taskTitle={t.taskTitle}
              onComplete={onTaskCompleted}
            />
          ))
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          ...chatStyles.inputArea,
          ...(dragActive ? { backgroundColor: theme.colors.primaryLight, borderColor: theme.colors.primary } : {}),
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Context Chips - only shown when user has actively selected something */}
        <ContextChips
          selectedAgentId={selectedAgentId}
          agents={agents}
          onRemoveAgent={onSelectAuto}
          selectedModelId={selectedModelId}
          selectedModelName={selectedModelName}
          onRemoveModel={onRemoveModel}
          selectedTable={selectedTable}
          onRemoveTable={onRemoveTable}
          project={project}
        />

        {/* Attachment Chips - show pending file uploads with processing state */}
        <AttachmentChips
          files={attachedFiles}
          onRemove={handleRemoveFile}
          fileProcessingState={fileProcessingState}
          sttAvailable={sttAvailable}
          transcriptionLanguage={transcriptionLanguage}
          onLanguageChange={setTranscriptionLanguage}
          fileTranscriptions={fileTranscriptions}
        />

        {/* Reader Chips - show loaded documents from search */}
        <ReaderChips readers={loadedReaders} onClear={onClearReaders} isLoading={isPreparingReaders} />

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={SUPPORTED_FILE_EXTENSIONS}
          style={{ display: 'none' }}
          onChange={handleFileInputChange}
        />

        {/* Text Input */}
        <div style={{ ...chatStyles.inputContainer, position: 'relative' }}>
          {/* Command Palette */}
          <CommandPalette
            isOpen={showCommandPalette}
            onClose={handleCloseCommandPalette}
            onExecute={handleCommandExecute}
            inputValue={input}
            selectedAgentId={selectedAgentId}
          />

          {/* Command Feedback Message */}
          {commandMessage && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                marginBottom: theme.spacing.sm,
                padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
                backgroundColor: theme.colors.primaryLight,
                color: theme.colors.primary,
                borderRadius: theme.borderRadius.lg,
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                textAlign: 'center',
                boxShadow: theme.shadows.md,
                zIndex: 999,
              }}
            >
              {commandMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} style={chatStyles.inputWrapper}>
            {/* Recording UI - shown above input when recording */}
            {isRecording && (
              <div style={chatStyles.recordingIndicator}>
                <div style={chatStyles.recordingDot} />
                <span style={chatStyles.recordingTime}>{formattedTime}</span>
                <button
                  type="button"
                  onClick={handleRecordClick}
                  style={chatStyles.stopButton}
                  title="Aufnahme beenden"
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.errorLight;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <StopIcon size={16} />
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  style={chatStyles.cancelButton}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.errorLight;
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  Abbrechen
                </button>
              </div>
            )}

            {/* Input row: Textarea + Send button */}
            <div style={chatStyles.inputRow}>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={attachedFiles.length > 0 ? "Frage zu den Dateien stellen..." : "Nachricht eingeben... (/ für Befehle)"}
                style={chatStyles.textarea}
                rows={1}
                disabled={isStreaming || isRecording}
                onFocus={(e) => {
                  e.target.style.borderColor = theme.colors.borderFocus;
                  e.target.style.backgroundColor = theme.colors.surface;
                }}
                onBlur={(e) => {
                  // Don't blur if command palette is open
                  if (!showCommandPalette) {
                    e.target.style.borderColor = theme.colors.border;
                    e.target.style.backgroundColor = theme.colors.surfaceHover;
                  }
                }}
              />
              <button
              type="submit"
              disabled={(!input.trim() && attachedFiles.length === 0) || isStreaming || showCommandPalette || isRecording}
              style={{
                ...chatStyles.sendButton,
                ...((!input.trim() && attachedFiles.length === 0) || isStreaming || showCommandPalette || isRecording ? chatStyles.sendButtonDisabled : {}),
              }}
              onMouseOver={(e) => {
                if ((input.trim() || attachedFiles.length > 0) && !isStreaming && !showCommandPalette && !isRecording) {
                  e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                }
              }}
              onMouseOut={(e) => {
                if ((input.trim() || attachedFiles.length > 0) && !isStreaming && !showCommandPalette && !isRecording) {
                  e.currentTarget.style.backgroundColor = theme.colors.primary;
                }
              }}
            >
              <SendIcon />
            </button>
            </div>

            {/* Action buttons row: Record, Upload, Commands */}
            <div style={chatStyles.inputActions}>
              {/* Microphone button - only shown when STT is available and not recording */}
              {sttAvailable && !isRecording && (
                <button
                  type="button"
                  onClick={handleRecordClick}
                  disabled={isStreaming}
                  style={{
                    ...chatStyles.actionButton,
                    opacity: isStreaming ? 0.5 : 1,
                    cursor: isStreaming ? 'not-allowed' : 'pointer',
                  }}
                  onMouseOver={(e) => {
                    if (!isStreaming) {
                      e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                      e.currentTarget.style.color = theme.colors.primary;
                    }
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = theme.colors.textMuted;
                  }}
                  title="Audio aufnehmen"
                >
                  <MicrophoneIcon size={18} />
                </button>
              )}

              {/* Attachment/Upload button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isStreaming || isRecording}
                style={{
                  ...chatStyles.actionButton,
                  opacity: (isStreaming || isRecording) ? 0.5 : 1,
                  cursor: (isStreaming || isRecording) ? 'not-allowed' : 'pointer',
                }}
                onMouseOver={(e) => {
                  if (!isStreaming && !isRecording) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                    e.currentTarget.style.color = theme.colors.primary;
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textMuted;
                }}
                title="Datei hochladen"
              >
                <PaperclipIcon size={18} />
              </button>

              {/* Commands button (+) */}
              <button
                type="button"
                onClick={() => {
                  setShowCommandPalette(true);
                  setInput('/');
                  textareaRef.current?.focus();
                }}
                disabled={isStreaming || isRecording}
                style={{
                  ...chatStyles.actionButton,
                  opacity: (isStreaming || isRecording) ? 0.5 : 1,
                  cursor: (isStreaming || isRecording) ? 'not-allowed' : 'pointer',
                }}
                onMouseOver={(e) => {
                  if (!isStreaming && !isRecording) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                    e.currentTarget.style.color = theme.colors.primary;
                  }
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = theme.colors.textMuted;
                }}
                title="Befehle öffnen"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
      </div>

      {/* Agent Log Panel — Admin-only */}
      {showAgentLog && isAdmin && (
        <AgentLogPanel
          agentLog={agentLog}
          isStreaming={isStreaming}
          onClose={() => setShowAgentLog(false)}
          getSessionId={getSessionId}
        />
      )}

      {/* Materials Sidebar */}
      {showMaterialsSidebar && onAddMaterial && (
        <MaterialsSidebar
          materials={materials}
          selectedMaterialIds={selectedMaterialIds}
          onToggleSelection={handleToggleMaterialSelection}
          onRemoveMaterial={handleRemoveMaterial}
          onClose={() => setShowMaterialsSidebar(false)}
          chatId={chatId}
        />
      )}

      {/* Image Lightbox */}
      {lightboxData && (
        <ImageLightbox
          imageUrl={lightboxData.imageUrl}
          prompt={lightboxData.prompt}
          provider={lightboxData.provider}
          model={lightboxData.model}
          imageId={lightboxData.imageId}
          onClose={() => setLightboxData(null)}
        />
      )}
    </div>
  );
}

function AssistantIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  );
}

function AssistantIconLarge() {
  return (
    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M4.93 4.93l2.83 2.83" />
      <path d="M16.24 16.24l2.83 2.83" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="M4.93 19.07l2.83-2.83" />
      <path d="M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  );
}

function DownloadIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

export default ChatWindow;
