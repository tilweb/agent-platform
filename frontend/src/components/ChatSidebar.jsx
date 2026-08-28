import { useState, useEffect, useMemo } from 'react';
import { theme } from '../config/theme';
import { SearchIcon, FolderIcon, PenIcon } from './Icons';
import { AgentIcon } from './AgentPicker';
import AgentFavoritesModal from './AgentFavoritesModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getTimeGroup(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  // Check if same day
  if (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  ) {
    return 'Heute';
  }

  // Check if yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'Gestern';
  }

  if (diffDays < 7) return 'Letzte 7 Tage';
  if (diffDays < 30) return 'Letzte 30 Tage';

  // Return month and year for older
  const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

const styles = {
  container: {
    width: '260px',
    minWidth: '260px',
    borderRight: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
  },
  header: {
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  newChatButton: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primary,
    color: '#ffffff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    fontFamily: theme.typography.fontFamily,
    transition: `background-color ${theme.transitions.fast}`,
  },
  searchContainer: {
    position: 'relative',
  },
  searchInput: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    paddingLeft: '32px',
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
    boxSizing: 'border-box',
  },
  searchIcon: {
    position: 'absolute',
    left: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    color: theme.colors.textMuted,
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center',
  },
  clearButton: {
    position: 'absolute',
    right: '8px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    padding: '2px',
    fontSize: theme.typography.sizes.xs,
    lineHeight: 1,
    borderRadius: theme.borderRadius.sm,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: `${theme.spacing.xs} 0`,
  },
  groupHeader: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginTop: theme.spacing.sm,
  },
  groupHeaderFirst: {
    marginTop: 0,
  },
  chatItem: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    transition: `background-color ${theme.transitions.fast}`,
    borderRadius: theme.borderRadius.md,
    margin: `0 ${theme.spacing.sm}`,
  },
  chatItemActive: {
    backgroundColor: theme.colors.surfaceHover,
  },
  chatItemHover: {
    backgroundColor: theme.colors.surfaceHover,
  },
  chatInfo: {
    flex: 1,
    minWidth: 0,
    marginRight: theme.spacing.xs,
  },
  chatTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    lineHeight: theme.typography.lineHeight.normal,
  },
  chatSnippet: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: '2px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontStyle: 'italic',
  },
  actionButtons: {
    display: 'flex',
    gap: '2px',
    flexShrink: 0,
  },
  actionButton: {
    opacity: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    padding: '2px 4px',
    borderRadius: theme.borderRadius.sm,
    lineHeight: 1,
    transition: `opacity ${theme.transitions.fast}, color ${theme.transitions.fast}`,
  },
  actionButtonVisible: {
    opacity: 1,
  },
  empty: {
    padding: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  searchResults: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  loadMoreButton: {
    margin: `${theme.spacing.md} ${theme.spacing.md}`,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontFamily: theme.typography.fontFamily,
    transition: `all ${theme.transitions.fast}`,
    textAlign: 'center',
  },
  // Favoriten-Agenten
  agentsSection: {
    borderBottom: `1px solid ${theme.colors.border}`,
    padding: `${theme.spacing.sm} 0`,
  },
  agentsSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `0 ${theme.spacing.md}`,
    margin: `0 ${theme.spacing.sm}`,
  },
  agentsSectionTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  agentsEditButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    padding: '2px',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    transition: `color ${theme.transitions.fast}`,
  },
  agentItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    margin: `0 ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    transition: `background-color ${theme.transitions.fast}`,
  },
  agentItemHover: {
    backgroundColor: theme.colors.surfaceHover,
  },
  agentItemIcon: {
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  agentItemName: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.weights.medium,
  },
  addAgentsButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    margin: `0 ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    border: 'none',
    backgroundColor: 'transparent',
    width: 'calc(100% - 16px)',
    transition: `all ${theme.transitions.fast}`,
  },
  // Folder styles
  foldersSection: {
    borderBottom: `1px solid ${theme.colors.border}`,
    padding: `${theme.spacing.sm} 0`,
  },
  folderItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    margin: `0 ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    transition: `background-color ${theme.transitions.fast}`,
  },
  folderItemActive: {
    backgroundColor: theme.colors.surfaceHover,
  },
  folderIcon: {
    color: theme.colors.textMuted,
    flexShrink: 0,
  },
  folderName: {
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    fontWeight: theme.typography.weights.medium,
  },
  folderDeleteButton: {
    position: 'absolute',
    opacity: 0,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    padding: '2px 4px',
    borderRadius: theme.borderRadius.sm,
    lineHeight: 1,
    transition: `opacity ${theme.transitions.fast}, color ${theme.transitions.fast}`,
  },
  folderDeleteButtonVisible: {
    opacity: 1,
  },
  folderCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    padding: `1px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    minWidth: '16px',
    textAlign: 'center',
  },
  folderActions: {
    position: 'relative',
    width: '24px',
    height: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addFolderButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    margin: `${theme.spacing.xs} ${theme.spacing.sm} 0`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    border: 'none',
    backgroundColor: 'transparent',
    width: 'calc(100% - 16px)',
    transition: `all ${theme.transitions.fast}`,
  },
  folderFilterBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  clearFilterButton: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.primary,
    fontSize: theme.typography.sizes.xs,
    padding: 0,
  },
  // Confirm Modal
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
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    maxWidth: '400px',
    width: '90%',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  modalText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
    lineHeight: 1.5,
  },
  modalButtons: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  modalButtonCancel: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  modalButtonDelete: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.error,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
};

function ChatSidebar({
  chats,
  activeChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  hasMore,
  onLoadMore,
  total,
  // Folder props
  folders = [],
  activeFolder = null,
  onSelectFolder,
  onCreateFolder,
  onDeleteFolder,
  folderChats = [],
  // Favoriten-Agenten props
  agents = [],
  favoriteAgentIds = [],
  onSaveFavoriteAgents,
  onStartAgentChat,
}) {
  const [hoveredId, setHoveredId] = useState(null);
  const [hoveredFolderId, setHoveredFolderId] = useState(null);
  const [hoveredAgentId, setHoveredAgentId] = useState(null);
  const [showFavoritesModal, setShowFavoritesModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState(null); // { id, name } for confirm modal
  const [chatToDelete, setChatToDelete] = useState(null); // { id, title } for confirm modal

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 3) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await fetch(`${API_URL}/chats/search?q=${encodeURIComponent(searchQuery)}`, {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setSearchResults(data.results);
        }
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const handleLoadMore = async () => {
    if (!onLoadMore || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      await onLoadMore();
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleAddFolder = async () => {
    if (!newFolderName.trim() || !onCreateFolder) return;
    try {
      await onCreateFolder(newFolderName.trim());
      setNewFolderName('');
      setShowAddFolder(false);
    } catch (err) {
      console.error('Error creating folder:', err);
    }
  };

  const handleFolderKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAddFolder();
    } else if (e.key === 'Escape') {
      setShowAddFolder(false);
      setNewFolderName('');
    }
  };

  // Determine which chats to show
  const displayChats = activeFolder ? folderChats : chats;

  // Group chats by time period
  const groupedChats = useMemo(() => {
    if (searchResults !== null) return null; // Don't group search results

    const groups = [];
    let currentGroup = null;

    for (const chat of displayChats) {
      const group = getTimeGroup(chat.updatedAt);

      if (group !== currentGroup) {
        currentGroup = group;
        groups.push({ group, chats: [] });
      }

      groups[groups.length - 1].chats.push(chat);
    }

    return groups;
  }, [displayChats, searchResults]);

  const isSearchMode = searchResults !== null;
  const isFolderMode = activeFolder !== null && !isSearchMode;

  // Favoriten-IDs zu Agenten auflösen (gelöschte/unzugängliche fallen raus)
  const favoriteAgents = useMemo(
    () => favoriteAgentIds.map((id) => agents.find((a) => a.id === id)).filter(Boolean),
    [favoriteAgentIds, agents],
  );

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.newChatButton}
          onClick={onNewChat}
          onMouseEnter={(e) => { e.target.style.backgroundColor = theme.colors.primaryHover; }}
          onMouseLeave={(e) => { e.target.style.backgroundColor = theme.colors.primary; }}
        >
          + Neuer Chat
        </button>
        <div style={styles.searchContainer}>
          <span style={styles.searchIcon}><SearchIcon size={14} /></span>
          <input
            type="text"
            style={styles.searchInput}
            placeholder="Chats durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
          {searchQuery && (
            <button
              style={styles.clearButton}
              onClick={handleClearSearch}
              title="Suche leeren"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Favoriten-Agenten: Schnellstart eines neuen Chats mit einem Agenten */}
      {!isSearchMode && (
        <div style={styles.agentsSection}>
          <div style={styles.agentsSectionHeader}>
            <span style={styles.agentsSectionTitle}>Agenten</span>
            {favoriteAgents.length > 0 && (
              <button
                style={styles.agentsEditButton}
                onClick={() => setShowFavoritesModal(true)}
                onMouseEnter={(e) => { e.currentTarget.style.color = theme.colors.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = theme.colors.textMuted; }}
                title="Favoriten bearbeiten"
              >
                <PenIcon size={12} />
              </button>
            )}
          </div>
          {favoriteAgents.map((agent) => {
            const isHovered = hoveredAgentId === agent.id;
            return (
              <div
                key={agent.id}
                style={{
                  ...styles.agentItem,
                  ...(isHovered ? styles.agentItemHover : {}),
                }}
                onClick={() => onStartAgentChat?.(agent.id)}
                onMouseEnter={() => setHoveredAgentId(agent.id)}
                onMouseLeave={() => setHoveredAgentId(null)}
                title={`Neuen Chat mit ${agent.name} starten`}
              >
                <span style={styles.agentItemIcon}>
                  <AgentIcon agentId={agent.id} style={{ width: 15, height: 15 }} />
                </span>
                <span style={styles.agentItemName}>{agent.name}</span>
              </div>
            );
          })}
          {favoriteAgents.length === 0 && (
            <button
              style={styles.addAgentsButton}
              onClick={() => setShowFavoritesModal(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textMuted;
              }}
            >
              <span>+</span>
              <span>Agenten wählen</span>
            </button>
          )}
        </div>
      )}

      {/* Folders Section - always show to allow creating folders */}
      {!isSearchMode && (
        <div style={styles.foldersSection}>
          {folders.map(folder => {
            const isHovered = hoveredFolderId === folder.id;
            const isActive = activeFolder === folder.id;
            return (
              <div
                key={folder.id}
                style={{
                  ...styles.folderItem,
                  ...(isActive ? styles.folderItemActive : {}),
                  ...(isHovered && !isActive ? styles.folderItemActive : {}),
                }}
                onClick={() => onSelectFolder?.(isActive ? null : folder.id)}
                onMouseEnter={() => setHoveredFolderId(folder.id)}
                onMouseLeave={() => setHoveredFolderId(null)}
              >
                <FolderIcon size={14} color={folder.color || theme.colors.textMuted} style={styles.folderIcon} />
                <span style={styles.folderName}>{folder.name}</span>
                <div style={styles.folderActions}>
                  {folder.chatCount > 0 && (
                    <span style={{ ...styles.folderCount, opacity: isHovered ? 0 : 1, transition: `opacity ${theme.transitions.fast}` }}>
                      {folder.chatCount}
                    </span>
                  )}
                  <button
                    style={{
                      ...styles.folderDeleteButton,
                      ...(isHovered ? styles.folderDeleteButtonVisible : {}),
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setFolderToDelete({ id: folder.id, name: folder.name });
                    }}
                    onMouseEnter={(e) => { e.target.style.color = theme.colors.error; }}
                    onMouseLeave={(e) => { e.target.style.color = theme.colors.textMuted; }}
                    title="Ordner löschen"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
          {showAddFolder ? (
            <div style={{ padding: `${theme.spacing.xs} ${theme.spacing.sm}`, margin: `${theme.spacing.xs} ${theme.spacing.sm} 0` }}>
              <input
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={handleFolderKeyDown}
                onBlur={() => {
                  if (!newFolderName.trim()) {
                    setShowAddFolder(false);
                  }
                }}
                placeholder="Ordnername..."
                autoFocus
                style={{
                  width: '100%',
                  padding: theme.spacing.xs,
                  fontSize: theme.typography.sizes.xs,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.sm,
                  backgroundColor: theme.colors.background,
                  color: theme.colors.text,
                  outline: 'none',
                }}
              />
            </div>
          ) : (
            <button
              style={styles.addFolderButton}
              onClick={() => setShowAddFolder(true)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                e.currentTarget.style.color = theme.colors.text;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.color = theme.colors.textMuted;
              }}
            >
              <span>+</span>
              <span>Neuer Ordner</span>
            </button>
          )}
        </div>
      )}

      {isSearchMode && (
        <div style={styles.searchResults}>
          {isSearching ? 'Suche...' : `${searchResults.length} Ergebnis${searchResults.length !== 1 ? 'se' : ''}`}
        </div>
      )}

      {isFolderMode && (
        <div style={styles.folderFilterBadge}>
          <FolderIcon size={12} />
          <span>{folders.find(f => f.id === activeFolder)?.name || 'Ordner'}</span>
          <button
            style={styles.clearFilterButton}
            onClick={() => onSelectFolder?.(null)}
          >
            Alle anzeigen
          </button>
        </div>
      )}

      <div style={styles.list}>
        {isSearchMode ? (
          // Search results (flat list)
          searchResults.length === 0 ? (
            <div style={styles.empty}>Keine Treffer</div>
          ) : (
            searchResults.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                isActive={chat.id === activeChatId}
                isHovered={chat.id === hoveredId}
                onSelect={onSelectChat}
                onDelete={(id) => setChatToDelete({ id, title: chat.title })}
                onHover={setHoveredId}
                showSnippet
              />
            ))
          )
        ) : (
          // Grouped chats
          <>
            {groupedChats?.length === 0 ? (
              <div style={styles.empty}>Noch keine Chats</div>
            ) : (
              groupedChats?.map((group, groupIndex) => (
                <div key={group.group}>
                  <div
                    style={{
                      ...styles.groupHeader,
                      ...(groupIndex === 0 ? styles.groupHeaderFirst : {}),
                    }}
                  >
                    {group.group}
                  </div>
                  {group.chats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      isHovered={chat.id === hoveredId}
                      onSelect={onSelectChat}
                      onDelete={(id) => setChatToDelete({ id, title: chat.title })}
                      onHover={setHoveredId}
                    />
                  ))}
                </div>
              ))
            )}

            {hasMore && (
              <button
                style={styles.loadMoreButton}
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = theme.colors.surfaceHover;
                  e.target.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.borderColor = theme.colors.border;
                }}
              >
                {isLoadingMore ? 'Laden...' : `Ältere Chats laden (${total - chats.length} weitere)`}
              </button>
            )}
          </>
        )}
      </div>

      {/* Favoriten-Agenten Auswahl-Modal */}
      {showFavoritesModal && (
        <AgentFavoritesModal
          agents={agents}
          selectedIds={favoriteAgentIds}
          onSave={onSaveFavoriteAgents}
          onClose={() => setShowFavoritesModal(false)}
        />
      )}

      {/* Delete Folder Confirm Modal */}
      {folderToDelete && (
        <div
          style={styles.modalOverlay}
          onClick={() => setFolderToDelete(null)}
        >
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalTitle}>Ordner löschen</div>
            <div style={styles.modalText}>
              Möchtest du den Ordner <strong>"{folderToDelete.name}"</strong> wirklich löschen?
              <br /><br />
              Die Chats in diesem Ordner bleiben erhalten und werden nur aus dem Ordner entfernt.
            </div>
            <div style={styles.modalButtons}>
              <button
                style={styles.modalButtonCancel}
                onClick={() => setFolderToDelete(null)}
              >
                Abbrechen
              </button>
              <button
                style={styles.modalButtonDelete}
                onClick={() => {
                  onDeleteFolder?.(folderToDelete.id);
                  setFolderToDelete(null);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Chat Confirm Modal */}
      {chatToDelete && (
        <div
          style={styles.modalOverlay}
          onClick={() => setChatToDelete(null)}
        >
          <div
            style={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.modalTitle}>Chat löschen</div>
            <div style={styles.modalText}>
              Möchtest du den Chat <strong>"{chatToDelete.title}"</strong> wirklich löschen?
              <br /><br />
              Diese Aktion kann nicht rückgängig gemacht werden.
            </div>
            <div style={styles.modalButtons}>
              <button
                style={styles.modalButtonCancel}
                onClick={() => setChatToDelete(null)}
              >
                Abbrechen
              </button>
              <button
                style={styles.modalButtonDelete}
                onClick={() => {
                  onDeleteChat?.(chatToDelete.id);
                  setChatToDelete(null);
                }}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChatItem({ chat, isActive, isHovered, onSelect, onDelete, onHover, showSnippet }) {
  return (
    <div
      style={{
        ...styles.chatItem,
        ...(isActive ? styles.chatItemActive : {}),
        ...(isHovered && !isActive ? styles.chatItemHover : {}),
      }}
      onClick={() => onSelect(chat.id)}
      onMouseEnter={() => onHover(chat.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div style={styles.chatInfo}>
        <div style={styles.chatTitle}>{chat.title}</div>
        {showSnippet && chat.snippet && (
          <div style={styles.chatSnippet}>{chat.snippet}</div>
        )}
      </div>
      <div style={styles.actionButtons}>
        <button
          style={{
            ...styles.actionButton,
            ...(isHovered ? styles.actionButtonVisible : {}),
          }}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(chat.id);
          }}
          onMouseEnter={(e) => { e.target.style.color = theme.colors.error; }}
          onMouseLeave={(e) => { e.target.style.color = theme.colors.textMuted; }}
          title="Chat löschen"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

export default ChatSidebar;
