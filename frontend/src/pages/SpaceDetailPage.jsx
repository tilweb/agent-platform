/**
 * SpaceDetailPage
 *
 * Space management page with 50/50 split layout:
 * - Left: ChatWindow with space context pre-selected
 * - Right: Tabs for Overview, Memory, KB, Chats, Members, Settings
 */

import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { apiGet } from '../utils/apiFetch';
import { useSpace } from '../hooks/useSpaces';
import { useStreaming } from '../hooks/useStreaming';
import { useAgentContext } from '../context/AgentContext';
import { BriefcaseIcon, ArrowLeftIcon } from '../components/Icons';
import ChatWindow from '../components/ChatWindow';
import SpaceMemorySection from '../components/SpaceMemorySection';
// SpaceMembersList replaced by AccessManager for RBAC support
import SpaceKBLinks from '../components/SpaceKBLinks';
import SpaceChatsSection from '../components/SpaceChatsSection';
import SpaceOverview from '../components/SpaceOverview';
import SpaceSettings from '../components/SpaceSettings';
import AccessManager from '../components/AccessManager';

const styles = {
  // Outer wrapper for back link + main content
  pageWrapper: {
    display: 'flex',
    flexDirection: 'column',
    height: `calc(100vh - ${theme.layout.headerHeight})`,  // Account for app header
    overflow: 'hidden',
  },
  backLinkContainer: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    flexShrink: 0,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: '#9333ea',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  // 50/50 Split Container
  container: {
    display: 'flex',
    flexDirection: 'row',
    flex: 1,
    height: 0,  // Combined with flex: 1, this ensures it takes exactly available space
    gap: theme.spacing.md,
    padding: `0 ${theme.spacing.lg} ${theme.spacing.lg}`,
    minHeight: 0, // Important for flex children to scroll
    overflow: 'hidden',  // Prevent container overflow
  },
  // Left side: Chat
  chatSection: {
    flex: '1 1 0',  // Equal flex-grow, flex-shrink, and base size
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,  // Critical: allows flex item to shrink below content size
    minHeight: 0,
    overflow: 'hidden',  // Prevent content from pushing layout
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.lg,  // Shadow on section, not on ChatWindow
  },
  // Right side: Detail tabs
  detailSection: {
    flex: '1 1 0',  // Equal flex-grow, flex-shrink, and base size
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,  // Critical: allows flex item to shrink below content size
    minHeight: 0,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    boxShadow: theme.shadows.lg,
    overflow: 'hidden',
  },
  // Detail header (compact)
  detailHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  iconWrapper: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.lg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerContent: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  // Tabs (Pill-Style)
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    flexShrink: 0,
    overflowX: 'auto',
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    whiteSpace: 'nowrap',
  },
  tabActive: {
    backgroundColor: '#9333ea15',
    color: '#9333ea',
  },
  // Tab content area
  content: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.xl,
    minWidth: 0,
    maxWidth: '100%',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
    height: '100%',
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: '#ef444420',
    color: '#ef4444',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    margin: theme.spacing.xl,
  },
};

const TABS = [
  { id: 'overview', label: 'Uebersicht' },
  { id: 'memory', label: 'Memory' },
  { id: 'kb', label: 'Knowledge Base' },
  { id: 'chats', label: 'Chats' },
  { id: 'access', label: 'Berechtigungen' },
  { id: 'settings', label: 'Einstellungen' },
];

export default function SpaceDetailPage() {
  const { spaceId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');

  // Space data
  const { space, loading, error, refresh, updateSpace, updateSettings } = useSpace(spaceId);

  // Chat/Streaming hooks
  const {
    messages,
    isStreaming,
    agentStatus,
    activeAgentId,
    sendMessage,
    clearMessages,
    loadExistingChat,
    sessionIdRef,
    activeTasks,
    onTaskCompleted,
    fileProcessingState,
  } = useStreaming();

  // Agent context for agent selection
  const {
    agents,
    selectedAgentId,
    isAutoRoute,
    selectAgent,
    selectAutoRoute,
  } = useAgentContext();

  // Send message handler with space context
  const handleSendMessage = useCallback((message, files, skillId) => {
    sendMessage(message, {
      agentId: selectedAgentId,
      autoRoute: isAutoRoute,
      files,
      skillId,
      spaceId: spaceId,  // Pass space ID to backend
    });
  }, [sendMessage, selectedAgentId, isAutoRoute, spaceId]);

  // New chat handler
  const handleNewChat = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  // Load existing chat handler
  const handleLoadChat = useCallback(async (chatId) => {
    try {
      const response = await apiGet(`/spaces/${spaceId}/chats/${chatId}`);
      if (response.ok) {
        const chat = await response.json();
        loadExistingChat(chat.messages || [], chatId);
      }
    } catch (err) {
      console.error('Failed to load chat:', err);
    }
  }, [spaceId, loadExistingChat]);

  if (loading) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.loading}>Lade Space...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.backLinkContainer}>
          <button style={styles.backLink} onClick={() => navigate('/spaces')}>
            <ArrowLeftIcon size={16} /> Spaces
          </button>
        </div>
        <div style={styles.error}>Fehler: {error}</div>
      </div>
    );
  }

  if (!space) {
    return (
      <div style={styles.pageWrapper}>
        <div style={styles.backLinkContainer}>
          <button style={styles.backLink} onClick={() => navigate('/spaces')}>
            <ArrowLeftIcon size={16} /> Spaces
          </button>
        </div>
        <div style={styles.error}>Space nicht gefunden</div>
      </div>
    );
  }

  const color = space.color || '#9333ea';

  // Space object for ChatWindow
  const spaceContext = {
    id: spaceId,
    name: space.name,
    color: color,
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return (
          <SpaceOverview
            space={space}
            onUpdate={updateSpace}
            onRefresh={refresh}
          />
        );
      case 'memory':
        return <SpaceMemorySection spaceId={spaceId} />;
      case 'kb':
        return <SpaceKBLinks spaceId={spaceId} />;
      case 'chats':
        return <SpaceChatsSection spaceId={spaceId} onLoadChat={handleLoadChat} onNewChat={handleNewChat} />;
      case 'access':
        return (
          <AccessManager
            resourceType="space"
            resourceId={spaceId}
            resourceName={space.name}
          />
        );
      case 'settings':
        return (
          <SpaceSettings
            space={space}
            onUpdateSettings={updateSettings}
            onRefresh={refresh}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={styles.pageWrapper}>
      {/* Back link */}
      <div style={styles.backLinkContainer}>
        <button style={styles.backLink} onClick={() => navigate('/spaces')}>
          <ArrowLeftIcon size={16} /> Spaces
        </button>
      </div>

      {/* 50/50 Split Layout */}
      <div style={styles.container}>
        {/* Left: Chat Section */}
        <div style={styles.chatSection}>
          <ChatWindow
            messages={messages}
            isStreaming={isStreaming}
            agentStatus={agentStatus}
            activeAgentId={activeAgentId}
            agents={agents}
            selectedAgentId={selectedAgentId}
            onSelectAgent={selectAgent}
            onSelectAuto={selectAutoRoute}
            onSendMessage={handleSendMessage}
            onNewChat={handleNewChat}
            onClearChat={clearMessages}
            activeTasks={activeTasks}
            onTaskCompleted={onTaskCompleted}
            fileProcessingState={fileProcessingState}
            project={spaceContext}
          />
        </div>

        {/* Right: Detail Section */}
        <div style={styles.detailSection}>
          {/* Compact Header */}
          <div style={styles.detailHeader}>
            <div
              style={{
                ...styles.iconWrapper,
                backgroundColor: `${color}15`,
              }}
            >
              <BriefcaseIcon size={20} color={color} />
            </div>
            <div style={styles.headerContent}>
              <div style={styles.title}>{space.name}</div>
              {space.description && (
                <div style={styles.subtitle}>{space.description}</div>
              )}
            </div>
          </div>

          {/* Tabs */}
          <div style={styles.tabs}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  style={{
                    ...styles.tab,
                    ...(isActive ? styles.tabActive : {}),
                  }}
                  onClick={() => setActiveTab(tab.id)}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div style={styles.content}>
            {renderTabContent()}
          </div>
        </div>
      </div>
    </div>
  );
}
