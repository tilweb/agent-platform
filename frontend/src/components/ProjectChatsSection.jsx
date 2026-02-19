/**
 * ProjectChatsSection Component
 *
 * Display and manage project chats.
 */

import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useProjectChats } from '../hooks/useProjects';
import { ChatIcon, TrashIcon } from './Icons';
import { formatDateRelative } from '../utils/dateFormat';

const styles = {
  container: {},
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    flex: 1,
    minWidth: 0,
    margin: 0,
  },
  newChatButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: '#9333ea',
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    flexShrink: 0,
    whiteSpace: 'nowrap',
  },
  chatsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  chatCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.borderLight}`,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  chatInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
    minWidth: 0,
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.md,
    backgroundColor: '#14b8a615',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  chatContent: {
    flex: 1,
    minWidth: 0,
  },
  chatTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chatSummary: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  chatMeta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    flexShrink: 0,
  },
  deleteButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    opacity: 0.6,
    transition: `all ${theme.transitions.fast}`,
  },
  emptyState: {
    padding: theme.spacing['2xl'],
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  emptyIcon: {
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: '#ef444420',
    color: '#ef4444',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
  },
};

function formatDate(dateString) {
  return formatDateRelative(dateString, { showTimeToday: true });
}

export default function ProjectChatsSection({ projectId, onLoadChat, onNewChat }) {
  const navigate = useNavigate();
  const { chats, loading, error, deleteChat } = useProjectChats(projectId);

  const handleNewChat = () => {
    if (onNewChat) {
      // Embedded mode: tell parent to start new chat
      onNewChat();
    } else {
      // Standalone mode: navigate to separate page
      navigate(`/projects/${projectId}/chat`);
    }
  };

  const handleChatClick = (chatId) => {
    if (onLoadChat) {
      // Embedded mode: load chat in the ChatWindow
      onLoadChat(chatId);
    } else {
      // Standalone mode: navigate to separate page
      navigate(`/projects/${projectId}/chat?session=${chatId}`);
    }
  };

  const handleDeleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (!confirm('Chat wirklich loeschen?')) return;

    try {
      await deleteChat(chatId);
    } catch (err) {
      console.error('Failed to delete chat:', err);
    }
  };

  if (loading) {
    return <div style={styles.loading}>Lade Chats...</div>;
  }

  if (error) {
    return <div style={styles.error}>Fehler: {error}</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>Space-Chats ({chats.length})</h3>
          <button
            style={styles.newChatButton}
            onClick={handleNewChat}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#7c22ce'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#9333ea'}
          >
            <ChatIcon size={16} />
            Neuer Chat
          </button>
        </div>

        {chats.length === 0 ? (
          <div style={styles.emptyState}>
            <ChatIcon size={40} style={styles.emptyIcon} />
            <div>Noch keine Chats in diesem Space.</div>
            <div style={{ marginTop: theme.spacing.sm }}>
              Starte einen Chat, um im Space-Kontext zu arbeiten.
            </div>
          </div>
        ) : (
          <div style={styles.chatsList}>
            {chats.map((chat) => (
              <div
                key={chat.id}
                style={styles.chatCard}
                onClick={() => handleChatClick(chat.id)}
                onMouseOver={(e) => {
                  e.currentTarget.style.borderColor = '#9333ea40';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.borderColor = theme.colors.borderLight;
                }}
              >
                <div style={styles.chatInfo}>
                  <div style={styles.iconWrapper}>
                    <ChatIcon size={20} color="#14b8a6" />
                  </div>
                  <div style={styles.chatContent}>
                    <div style={styles.chatTitle}>{chat.title}</div>
                    {chat.summary && (
                      <div style={styles.chatSummary}>{chat.summary}</div>
                    )}
                  </div>
                </div>
                <span style={styles.chatMeta}>{formatDate(chat.updatedAt)}</span>
                <button
                  style={styles.deleteButton}
                  onClick={(e) => handleDeleteChat(e, chat.id)}
                  onMouseOver={(e) => {
                    e.currentTarget.style.color = '#ef4444';
                    e.currentTarget.style.opacity = '1';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.color = theme.colors.textMuted;
                    e.currentTarget.style.opacity = '0.6';
                  }}
                >
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
