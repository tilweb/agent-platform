/**
 * SearchPage
 *
 * Unified search page with results from multiple sources.
 * Two view modes:
 * - Tab View (default): One source per tab, clean and organized
 * - List View: All results in a single filtered list
 */

import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useSearch } from '../hooks/useSearch';
import CreateCollectionModal from '../components/CreateCollectionModal';
import AddToCollectionModal from '../components/AddToCollectionModal';
import { getContentTypeIcon } from '../components/Icons';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: theme.colors.background,
    padding: theme.spacing.xl,
    gap: theme.spacing.lg,
    overflow: 'hidden',
  },
  // Search Box
  searchBox: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  searchInput: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
  },
  searchStats: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.md,
  },
  loadingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
  },
  smartLoadingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: '#8b5cf620',
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.sm,
    color: '#8b5cf6',
  },
  // Main Content Area
  mainContent: {
    display: 'flex',
    flex: 1,
    gap: theme.spacing.lg,
    overflow: 'hidden',
    minHeight: 0,
    maxHeight: 'calc(100vh - 280px)',
  },
  // Results Panel (left side)
  resultsPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
    overflow: 'hidden',
  },
  // View Header (Tab bar or Filter bar)
  viewHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.md,
  },
  // Tabs
  tabsContainer: {
    display: 'flex',
    gap: theme.spacing.xs,
    flex: 1,
    overflowX: 'auto',
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    whiteSpace: 'nowrap',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    transition: `all ${theme.transitions.fast}`,
  },
  tabBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.background,
  },
  // Filter Chips (for list view)
  filtersContainer: {
    display: 'flex',
    gap: theme.spacing.xs,
    flex: 1,
    overflowX: 'auto',
    alignItems: 'center',
  },
  filterLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginRight: theme.spacing.sm,
  },
  filterChip: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    transition: `all ${theme.transitions.fast}`,
    whiteSpace: 'nowrap',
  },
  filterChipActive: {
    backgroundColor: theme.colors.primaryLight,
    borderColor: theme.colors.primary,
    color: theme.colors.primary,
  },
  // View Toggle
  viewToggle: {
    display: 'flex',
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    padding: '2px',
    flexShrink: 0,
  },
  viewToggleButton: {
    padding: theme.spacing.sm,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: theme.borderRadius.sm,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.textMuted,
    transition: `all ${theme.transitions.fast}`,
  },
  viewToggleButtonActive: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
  },
  // Results Container
  resultsContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  resultsContent: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.md,
  },
  emptyResults: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100px',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  // Result Items
  resultItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
    marginBottom: theme.spacing.xs,
  },
  resultItemSelected: {
    backgroundColor: theme.colors.primaryLight,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    marginTop: '2px',
    cursor: 'pointer',
    accentColor: theme.colors.primary,
    flexShrink: 0,
  },
  resultContent: {
    flex: 1,
    minWidth: 0,
  },
  resultTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  sourceBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    flexShrink: 0,
  },
  resultTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  resultSnippet: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    lineHeight: theme.typography.lineHeight.relaxed,
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    marginBottom: theme.spacing.xs,
  },
  resultMeta: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  resultLink: {
    color: theme.colors.primary,
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: theme.typography.sizes.xs,
  },
  smartBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: theme.typography.sizes.xs,
    color: '#8b5cf6',
    backgroundColor: '#8b5cf620',
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    marginLeft: theme.spacing.xs,
  },
  // Selection Panel
  selectionPanel: {
    width: '320px',
    flexShrink: 0,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `2px solid ${theme.colors.primary}`,
    boxShadow: `0 0 0 4px ${theme.colors.primaryLight}`,
    overflow: 'hidden',
  },
  selectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.primaryLight,
    flexShrink: 0,
  },
  selectionTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  clearButton: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.xs,
  },
  selectedItems: {
    flex: 1,
    overflowY: 'auto',
    padding: theme.spacing.md,
    minHeight: 0,
  },
  selectedItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.sm,
  },
  selectedItemInfo: {
    flex: 1,
    minWidth: 0,
  },
  selectedItemTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  selectedItemType: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  removeButton: {
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.lg,
    flexShrink: 0,
  },
  emptySelection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '120px',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
    padding: theme.spacing.lg,
  },
  // Actions - sticky at bottom
  actions: {
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    flexShrink: 0,
  },
  primaryButton: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `background-color ${theme.transitions.fast}`,
  },
  secondaryButton: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  typeIcon: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '18px',
    height: '18px',
    borderRadius: theme.borderRadius.sm,
    fontSize: '12px',
  },
};

const sourceLabels = {
  chats: 'Chats',
  knowledge: 'Knowledge Base',
  confluence: 'Confluence',
  gdrive: 'Google Drive',
  gmail: 'Google Mail',
  pipedrive: 'Pipedrive',
  jira: 'Jira',
  youtrack: 'YouTrack',
  contracts: 'Verträge',
};

function SearchPage() {
  const navigate = useNavigate();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState('tabs'); // 'tabs' | 'list'
  const [activeTab, setActiveTab] = useState(null);
  const [listFilters, setListFilters] = useState({});

  const {
    query,
    setQuery,
    results,
    loading,
    smartLoading,
    error,
    sources,
    selectedItems,
    toggleSelection,
    isSelected,
    clearSelection,
    removeSelection,
    getTotalCount,
  } = useSearch();

  const connectedSources = useMemo(
    () => (sources || []).filter(s => s.connected),
    [sources]
  );

  // Set first tab with results as default
  useEffect(() => {
    if (!activeTab && connectedSources.length > 0) {
      const tabWithResults = connectedSources.find(s => (results[s.id]?.length || 0) > 0);
      setActiveTab(tabWithResults?.id || connectedSources[0].id);
    }
  }, [connectedSources, results, activeTab]);

  // Initialize all filters as active
  useEffect(() => {
    if (connectedSources.length > 0 && Object.keys(listFilters).length === 0) {
      const initialFilters = {};
      connectedSources.forEach(s => { initialFilters[s.id] = true; });
      setListFilters(initialFilters);
    }
  }, [connectedSources, listFilters]);

  const handleStartChat = () => {
    const params = new URLSearchParams();
    params.set('readers', JSON.stringify(selectedItems));
    navigate(`/?${params.toString()}`);
  };

  const handleCreateCollection = () => {
    setShowCreateModal(true);
  };

  const handleCollectionCreated = (collectionId) => {
    setShowCreateModal(false);
    clearSelection();
    navigate(`/knowledge?collection=${collectionId}`);
  };

  const handleAddToCollection = () => {
    setShowAddModal(true);
  };

  const handleAddedToCollection = (collectionId) => {
    setShowAddModal(false);
    clearSelection();
    navigate(`/knowledge?collection=${collectionId}`);
  };

  const toggleFilter = (sourceId) => {
    setListFilters(prev => ({
      ...prev,
      [sourceId]: !prev[sourceId],
    }));
  };

  // Merge results for list view
  const mergedResults = useMemo(() => {
    if (viewMode !== 'list') return [];

    const merged = [];
    for (const source of connectedSources) {
      if (!listFilters[source.id]) continue;

      const sourceResults = results[source.id] || [];
      for (const item of sourceResults) {
        merged.push({
          ...item,
          _sourceId: source.id,
          _sourceColor: source.color,
          _sourceName: source.name,
        });
      }
    }

    // Sort: Smart results first
    return merged.sort((a, b) => {
      if (a.metadata?.fromSmartSearch && !b.metadata?.fromSmartSearch) return -1;
      if (!a.metadata?.fromSmartSearch && b.metadata?.fromSmartSearch) return 1;
      return 0;
    });
  }, [viewMode, connectedSources, listFilters, results]);

  const totalResults = getTotalCount();
  const sourcePlaceholder = connectedSources.length > 0
    ? `Suche in ${connectedSources.map(s => s.name).join(', ')}...`
    : 'Suche...';

  return (
    <div style={styles.container}>
      {/* Search Box */}
      <div style={styles.searchBox}>
        <h1 style={styles.title}>Suche</h1>
        <div style={styles.searchWrapper}>
          <input
            type="text"
            placeholder={sourcePlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={styles.searchInput}
            autoFocus
          />
        </div>
        {(loading || smartLoading || error) && (
          <div style={styles.searchStats}>
            {loading && (
              <span style={styles.loadingIndicator}>Suche...</span>
            )}
            {!loading && smartLoading && (
              <span style={styles.smartLoadingIndicator}>Intelligente Suche...</span>
            )}
            {error && (
              <span style={{ color: theme.colors.error }}>Fehler: {error}</span>
            )}
          </div>
        )}
      </div>

      {/* Main Content: Results + Selection */}
      <div style={styles.mainContent}>
        {/* Results Panel */}
        <div style={styles.resultsPanel}>
          {/* View Header: Tabs or Filters */}
          <div style={styles.viewHeader}>
            {viewMode === 'tabs' ? (
              <SourceTabs
                sources={connectedSources}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                results={results}
              />
            ) : (
              <SourceFilters
                sources={connectedSources}
                filters={listFilters}
                onFilterChange={toggleFilter}
                results={results}
              />
            )}
            <ViewToggle mode={viewMode} onChange={setViewMode} />
          </div>

          {/* Results Area */}
          {viewMode === 'tabs' ? (
            <TabResultsView
              sourceId={activeTab}
              results={results[activeTab] || []}
              isSelected={isSelected}
              onToggle={toggleSelection}
              color={connectedSources.find(s => s.id === activeTab)?.color || theme.colors.primary}
            />
          ) : (
            <ListResultsView
              results={mergedResults}
              isSelected={isSelected}
              onToggle={toggleSelection}
            />
          )}
        </div>

        {/* Selection Panel */}
        <div style={styles.selectionPanel}>
          <div style={styles.selectionHeader}>
            <span style={styles.selectionTitle}>
              Auswahl ({selectedItems.length})
            </span>
            {selectedItems.length > 0 && (
              <button onClick={clearSelection} style={styles.clearButton}>
                Alle entfernen
              </button>
            )}
          </div>

          <div style={styles.selectedItems}>
            {selectedItems.length === 0 ? (
              <div style={styles.emptySelection}>
                <span>Keine Elemente ausgewählt</span>
                <span style={{ marginTop: theme.spacing.sm, fontSize: theme.typography.sizes.xs }}>
                  Wähle Ergebnisse aus, um sie als Kontext zu verwenden
                </span>
              </div>
            ) : (
              selectedItems.map((item) => {
                const sourceColor = sources?.find(s => s.id === item.type)?.color || '#666';
                return (
                  <div key={`${item.type}-${item.id}`} style={styles.selectedItem}>
                    <div style={styles.selectedItemInfo}>
                      <div style={styles.selectedItemTitle}>{item.title}</div>
                      <div style={styles.selectedItemType}>
                        <span
                          style={{
                            ...styles.typeIcon,
                            backgroundColor: `${sourceColor}20`,
                            color: sourceColor,
                          }}
                        >
                          {getTypeIcon(item.type)}
                        </span>
                        {sourceLabels[item.type] || item.type}
                      </div>
                    </div>
                    <button
                      onClick={() => removeSelection(item)}
                      style={styles.removeButton}
                      title="Entfernen"
                    >
                      ×
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Actions - always visible at bottom */}
          <div style={styles.actions}>
            <button
              onClick={handleStartChat}
              style={{
                ...styles.primaryButton,
                opacity: selectedItems.length === 0 ? 0.5 : 1,
                cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
              }}
              disabled={selectedItems.length === 0}
              onMouseEnter={(e) => {
                if (selectedItems.length > 0) {
                  e.target.style.backgroundColor = theme.colors.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = theme.colors.primary;
              }}
            >
              Chat starten
            </button>
            <button
              onClick={handleCreateCollection}
              style={{
                ...styles.secondaryButton,
                opacity: selectedItems.length === 0 ? 0.5 : 1,
                cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
              }}
              disabled={selectedItems.length === 0}
              onMouseEnter={(e) => {
                if (selectedItems.length > 0) {
                  e.target.style.backgroundColor = theme.colors.surfaceHover;
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              Collection erstellen
            </button>
            <button
              onClick={handleAddToCollection}
              style={{
                ...styles.secondaryButton,
                opacity: selectedItems.length === 0 ? 0.5 : 1,
                cursor: selectedItems.length === 0 ? 'not-allowed' : 'pointer',
              }}
              disabled={selectedItems.length === 0}
              onMouseEnter={(e) => {
                if (selectedItems.length > 0) {
                  e.target.style.backgroundColor = theme.colors.surfaceHover;
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
              }}
            >
              Zu Collection hinzufügen
            </button>
          </div>
        </div>
      </div>

      {/* Create Collection Modal */}
      <CreateCollectionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        selectedItems={selectedItems}
        onSuccess={handleCollectionCreated}
      />

      {/* Add to Collection Modal */}
      <AddToCollectionModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        selectedItems={selectedItems}
        onSuccess={handleAddedToCollection}
      />
    </div>
  );
}

// Tab navigation component
function SourceTabs({ sources, activeTab, onTabChange, results }) {
  return (
    <div style={styles.tabsContainer}>
      {sources.map(source => {
        const isActive = activeTab === source.id;
        const count = results[source.id]?.length || 0;

        return (
          <button
            key={source.id}
            style={{
              ...styles.tab,
              ...(isActive ? {
                backgroundColor: `${source.color}15`,
                color: source.color,
              } : {}),
            }}
            onClick={() => onTabChange(source.id)}
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
            {source.name}
            <span
              style={{
                ...styles.tabBadge,
                ...(isActive ? {
                  backgroundColor: `${source.color}25`,
                  color: source.color,
                } : {}),
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// Filter chips component for list view
function SourceFilters({ sources, filters, onFilterChange, results }) {
  return (
    <div style={styles.filtersContainer}>
      <span style={styles.filterLabel}>Filter:</span>
      {sources.map(source => {
        const isActive = filters[source.id];
        const count = results[source.id]?.length || 0;

        return (
          <button
            key={source.id}
            style={{
              ...styles.filterChip,
              ...(isActive ? {
                ...styles.filterChipActive,
                backgroundColor: `${source.color}15`,
                borderColor: source.color,
                color: source.color,
              } : {}),
            }}
            onClick={() => onFilterChange(source.id)}
          >
            {source.name}
            <span>({count})</span>
          </button>
        );
      })}
    </div>
  );
}

// View toggle component
function ViewToggle({ mode, onChange }) {
  return (
    <div style={styles.viewToggle}>
      <button
        style={{
          ...styles.viewToggleButton,
          ...(mode === 'tabs' ? styles.viewToggleButtonActive : {}),
        }}
        onClick={() => onChange('tabs')}
        title="Tab-Ansicht"
      >
        <TabsIcon />
      </button>
      <button
        style={{
          ...styles.viewToggleButton,
          ...(mode === 'list' ? styles.viewToggleButtonActive : {}),
        }}
        onClick={() => onChange('list')}
        title="Listen-Ansicht"
      >
        <ListIcon />
      </button>
    </div>
  );
}

// Tab results view (single source)
function TabResultsView({ sourceId, results, isSelected, onToggle, color }) {
  return (
    <div style={styles.resultsContainer}>
      <div style={styles.resultsContent}>
        {results.length === 0 ? (
          <div style={styles.emptyResults}>Keine Ergebnisse</div>
        ) : (
          results.map((item) => (
            <ResultItem
              key={item.id}
              item={item}
              sourceId={sourceId}
              selected={isSelected(item)}
              onToggle={onToggle}
              color={color}
              showSourceBadge={false}
            />
          ))
        )}
      </div>
    </div>
  );
}

// List results view (all sources merged)
function ListResultsView({ results, isSelected, onToggle }) {
  return (
    <div style={styles.resultsContainer}>
      <div style={styles.resultsContent}>
        {results.length === 0 ? (
          <div style={styles.emptyResults}>Keine Ergebnisse</div>
        ) : (
          results.map((item) => (
            <ResultItem
              key={`${item._sourceId}-${item.id}`}
              item={item}
              sourceId={item._sourceId}
              selected={isSelected(item)}
              onToggle={onToggle}
              color={item._sourceColor}
              showSourceBadge={true}
              sourceName={item._sourceName}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ResultItem({ item, sourceId, selected, onToggle, color, showSourceBadge, sourceName }) {
  const link = getItemLink(item, sourceId);

  const handleLinkClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div
      style={{
        ...styles.resultItem,
        ...(selected ? styles.resultItemSelected : {}),
      }}
      onClick={() => onToggle(item)}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.backgroundColor = 'transparent';
        }
      }}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={() => onToggle(item)}
        style={styles.checkbox}
        onClick={(e) => e.stopPropagation()}
      />
      <div style={styles.resultContent}>
        <div style={styles.resultTitleRow}>
          {showSourceBadge && (
            <span
              style={{
                ...styles.sourceBadge,
                backgroundColor: `${color}20`,
                color: color,
              }}
            >
              {sourceName}
            </span>
          )}
          <span style={styles.resultTitle}>
            {item.title}
          </span>
          {item.metadata?.fromSmartSearch && (
            <span style={styles.smartBadge}>
              <span style={{ fontSize: '10px' }}>✨</span>
              Smart
            </span>
          )}
        </div>
        {item.snippet && <div style={styles.resultSnippet}>{item.snippet}</div>}
        <div style={styles.resultMeta}>
          <span>
            {sourceId === 'chats' && item.metadata?.matchedIn && (
              `Gefunden in: ${item.metadata.matchedIn}`
            )}
            {sourceId === 'knowledge' && item.metadata?.collectionName && (
              item.metadata.collectionName
            )}
            {sourceId === 'confluence' && item.metadata?.spaceName && (
              item.metadata.spaceName
            )}
            {sourceId === 'gdrive' && item.metadata?.mimeType && (
              formatMimeType(item.metadata.mimeType)
            )}
            {sourceId === 'jira' && item.metadata?.status && (
              `${item.metadata.issueType || ''} | ${item.metadata.status}${item.metadata.assignee && item.metadata.assignee !== 'Unassigned' ? ` | ${item.metadata.assignee}` : ''}`
            )}
            {sourceId === 'youtrack' && item.metadata?.state && (
              `${item.metadata.issueType || ''} | ${item.metadata.state}${item.metadata.assignee ? ` | ${item.metadata.assignee}` : ''}`
            )}
            {sourceId === 'contracts' && item.metadata?.contract_type && (
              `${item.metadata.contract_type} | ${formatContractStatus(item.metadata.status)}`
            )}
          </span>
          {link && (
            <a
              href={link}
              target={sourceId === 'chats' ? '_self' : '_blank'}
              rel="noopener noreferrer"
              style={styles.resultLink}
              onClick={handleLinkClick}
            >
              <LinkIcon />
              Öffnen
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function getItemLink(item, sourceId) {
  switch (sourceId) {
    case 'chats':
      return `/?session=${item.id}`;
    case 'knowledge':
      return null;
    case 'confluence':
      return item.metadata?.url || null;
    case 'gdrive':
      return item.metadata?.link || null;
    case 'gmail':
      return item.metadata?.threadId
        ? `https://mail.google.com/mail/u/0/#all/${item.metadata.threadId}`
        : null;
    case 'pipedrive':
      return item.metadata?.dealId
        ? `https://app.pipedrive.com/deal/${item.metadata.dealId}`
        : item.metadata?.contactId
          ? `https://app.pipedrive.com/person/${item.metadata.contactId}`
          : null;
    case 'jira':
      return item.metadata?.issueKey || null;
    case 'youtrack':
      return item.metadata?.issueId || null;
    case 'contracts':
      return `/apps/vertragsmanagement/${item.id}`;
    default:
      return null;
  }
}

// Icons
function TabsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function getTypeIcon(type) {
  return getContentTypeIcon(type, { size: 16 });
}

function formatMimeType(mimeType) {
  if (!mimeType) return '';
  if (mimeType.includes('document')) return 'Dokument';
  if (mimeType.includes('spreadsheet')) return 'Tabelle';
  if (mimeType.includes('presentation')) return 'Präsentation';
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('image')) return 'Bild';
  if (mimeType.includes('folder')) return 'Ordner';
  return mimeType.split('/').pop() || mimeType;
}

function formatContractStatus(status) {
  switch (status) {
    case 'active': return 'Aktiv';
    case 'expiring': return 'Läuft aus';
    case 'expired': return 'Abgelaufen';
    default: return status || '';
  }
}

export default SearchPage;
