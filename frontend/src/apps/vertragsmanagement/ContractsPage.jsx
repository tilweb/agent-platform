/**
 * ContractsPage
 * Main overview page for contract management
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useContracts } from '../../hooks/useContracts';
import { apiGet } from '../../utils/apiFetch';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
  },
  uploadButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    textDecoration: 'none',
  },
  content: {
    flex: 1,
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
  // Stats cards
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  statValueSuccess: {
    color: theme.colors.success,
  },
  statValueWarning: {
    color: theme.colors.warning,
  },
  statValueError: {
    color: theme.colors.error,
  },
  // Filters
  filtersRow: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  filterSelect: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  searchInput: {
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    paddingRight: '44px',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  // Contract list
  contractsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  contractCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textDecoration: 'none',
  },
  contractInfo: {
    flex: 1,
  },
  contractTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  contractMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  contractRight: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  contractValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusActive: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusExpiring: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
  },
  statusExpired: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyIcon: {
    marginBottom: theme.spacing.lg,
    opacity: 0.5,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.xl,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  searchWrapper: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  searchInputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  clearButton: {
    position: 'absolute',
    right: theme.spacing.md,
    background: 'none',
    border: 'none',
    padding: theme.spacing.xs,
    cursor: 'pointer',
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.full,
  },
  searchIndicators: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.sm,
  },
  loadingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
  },
  smartLoadingIndicator: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: '#8b5cf620',
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    color: '#8b5cf6',
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
    marginLeft: theme.spacing.sm,
  },
};

function ContractsPage() {
  const navigate = useNavigate();
  const { contracts, stats, schemas, isLoading, refresh } = useContracts();
  const [filters, setFilters] = useState({
    type: '',
    status: '',
    search: '',
  });
  const [filteredContracts, setFilteredContracts] = useState([]);
  const [smartResults, setSmartResults] = useState([]);
  const [isSmartSearching, setIsSmartSearching] = useState(false);
  const [hasSearchExecuted, setHasSearchExecuted] = useState(false);

  // Fast search - filter local contracts
  const fastSearch = useCallback((searchTerm, contractsList) => {
    if (!searchTerm || searchTerm.length < 2) {
      return contractsList;
    }

    const search = searchTerm.toLowerCase();
    return contractsList.filter(
      (c) =>
        c.computed.party_a.toLowerCase().includes(search) ||
        c.computed.party_b.toLowerCase().includes(search) ||
        c.upload_filename.toLowerCase().includes(search) ||
        (c.contract_type && c.contract_type.toLowerCase().includes(search))
    );
  }, []);

  // Smart search - call backend LLM search
  const smartSearch = useCallback(async (searchTerm) => {
    if (!searchTerm || searchTerm.length < 2) {
      setSmartResults([]);
      return;
    }

    setIsSmartSearching(true);
    try {
      const response = await apiGet(`/search/contracts/smart?q=${encodeURIComponent(searchTerm)}`);
      if (response.ok) {
        const data = await response.json();
        const results = data.results || [];
        // Mark results as from smart search
        setSmartResults(results.map(r => ({ ...r, fromSmartSearch: true })));
      }
    } catch (err) {
      console.error('Smart search error:', err);
    } finally {
      setIsSmartSearching(false);
    }
  }, []);

  // Handle search input change (just update the input, don't search yet)
  const handleSearchInputChange = useCallback((value) => {
    setFilters(prev => ({ ...prev, search: value }));
    // Clear smart results when input changes
    if (!value) {
      setSmartResults([]);
    }
  }, []);

  // Execute search on Enter key
  const executeSearch = useCallback(() => {
    const value = filters.search;

    if (!value || value.length < 2) {
      setSmartResults([]);
      setHasSearchExecuted(false);
      return;
    }

    // Mark search as executed (for empty state display)
    setHasSearchExecuted(true);

    // Start smart search
    setIsSmartSearching(true);
    smartSearch(value);
  }, [filters.search, smartSearch]);

  // Clear search
  const clearSearch = useCallback(() => {
    setFilters(prev => ({ ...prev, search: '' }));
    setSmartResults([]);
    setIsSmartSearching(false);
    setHasSearchExecuted(false);
  }, []);

  // Apply filters and merge with smart results
  useEffect(() => {
    let result = [...contracts];

    // Apply type filter
    if (filters.type) {
      result = result.filter((c) => c.contract_type === filters.type);
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter((c) => c.computed.status === filters.status);
    }

    // Apply fast search filter only when search has been executed (Enter pressed)
    if (hasSearchExecuted && filters.search && filters.search.length >= 2) {
      result = fastSearch(filters.search, result);
    }

    // Merge with smart results (add unique ones from smart search)
    if (smartResults.length > 0) {
      const existingIds = new Set(result.map(c => c.id));
      const newFromSmart = smartResults
        .filter(sr => !existingIds.has(sr.id))
        .map(sr => {
          // Find full contract data
          const fullContract = contracts.find(c => c.id === sr.id);
          return fullContract ? { ...fullContract, fromSmartSearch: true } : null;
        })
        .filter(Boolean);
      result = [...result, ...newFromSmart];
    }

    setFilteredContracts(result);
  }, [contracts, filters, smartResults, fastSearch, hasSearchExecuted]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'active':
        return { style: styles.statusActive, label: 'Aktiv' };
      case 'expiring':
        return { style: styles.statusExpiring, label: 'Läuft aus' };
      case 'expired':
        return { style: styles.statusExpired, label: 'Abgelaufen' };
      default:
        return { style: {}, label: status };
    }
  };

  const getSchemaName = (typeId) => {
    const schema = schemas.find((s) => s.id === typeId);
    return schema?.name || typeId;
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>Vertragsmanagement</h1>
            <p style={styles.subtitle}>Verträge hochladen, analysieren und verwalten</p>
          </div>
        </div>
        <div style={styles.loading}>Lade Verträge...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Vertragsmanagement</h1>
          <p style={styles.subtitle}>Verträge hochladen, analysieren und verwalten</p>
        </div>
        <Link
          to="/apps/vertragsmanagement/upload"
          style={styles.uploadButton}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = theme.colors.primary;
          }}
        >
          <UploadIcon />
          Vertrag hochladen
        </Link>
      </div>

      <div style={styles.content}>
        {/* Stats Cards */}
        {stats && (
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Gesamt</div>
              <div style={styles.statValue}>{stats.total}</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Aktiv</div>
              <div style={{ ...styles.statValue, ...styles.statValueSuccess }}>
                {stats.active}
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Läuft aus (90 Tage)</div>
              <div style={{ ...styles.statValue, ...styles.statValueWarning }}>
                {stats.expiring}
              </div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statLabel}>Jahreswert</div>
              <div style={styles.statValue}>{formatCurrency(stats.totalValue)}</div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div style={styles.filtersRow}>
          <div style={styles.searchWrapper}>
            <div style={styles.searchInputWrapper}>
              <input
                type="text"
                placeholder="z.B. &quot;alle Verträge mit SLA unter 1 Stunde&quot; - Enter zum Suchen"
                value={filters.search}
                onChange={(e) => handleSearchInputChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    executeSearch();
                  }
                }}
                style={styles.searchInput}
              />
              {filters.search && (
                <button
                  style={styles.clearButton}
                  onClick={clearSearch}
                  title="Suche leeren"
                >
                  <ClearIcon />
                </button>
              )}
            </div>
            {isSmartSearching && (
              <div style={styles.searchIndicators}>
                <span style={styles.smartLoadingIndicator}>
                  <SpinnerIcon />
                  Intelligente Suche läuft...
                </span>
              </div>
            )}
          </div>
          <select
            value={filters.type}
            onChange={(e) => setFilters({ ...filters, type: e.target.value })}
            style={styles.filterSelect}
          >
            <option value="">Alle Typen</option>
            {schemas.map((schema) => (
              <option key={schema.id} value={schema.id}>
                {schema.name}
              </option>
            ))}
          </select>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            style={styles.filterSelect}
          >
            <option value="">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="expiring">Läuft aus</option>
            <option value="expired">Abgelaufen</option>
          </select>
        </div>

        {/* Contract List */}
        {filteredContracts.length === 0 && (contracts.length === 0 || hasSearchExecuted || filters.type || filters.status) ? (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>
              <ContractIcon size={48} color={theme.colors.textMuted} />
            </div>
            <div style={styles.emptyTitle}>
              {contracts.length === 0
                ? 'Noch keine Verträge'
                : 'Keine Verträge gefunden'}
            </div>
            <p style={styles.emptyText}>
              {contracts.length === 0
                ? 'Laden Sie Ihren ersten Vertrag hoch, um zu beginnen.'
                : 'Versuchen Sie, Ihre Filter anzupassen.'}
            </p>
            {contracts.length === 0 && (
              <Link
                to="/apps/vertragsmanagement/upload"
                style={styles.uploadButton}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primary;
                }}
              >
                <UploadIcon />
                Vertrag hochladen
              </Link>
            )}
          </div>
        ) : filteredContracts.length === 0 ? null : (
          <div style={styles.contractsList}>
            {filteredContracts.map((contract) => {
              const statusBadge = getStatusBadge(contract.computed.status);
              return (
                <Link
                  key={contract.id}
                  to={`/apps/vertragsmanagement/${contract.id}`}
                  style={styles.contractCard}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                    e.currentTarget.style.borderColor = theme.colors.primary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = theme.colors.surface;
                    e.currentTarget.style.borderColor = theme.colors.border;
                  }}
                >
                  <div style={styles.contractInfo}>
                    <div style={styles.contractTitle}>
                      {contract.computed.party_a} - {contract.computed.party_b}
                      {contract.fromSmartSearch && (
                        <span style={styles.smartBadge}>
                          <span style={{ fontSize: '10px' }}>✨</span>
                          Smart
                        </span>
                      )}
                    </div>
                    <div style={styles.contractMeta}>
                      <span>{getSchemaName(contract.contract_type)}</span>
                      <span>|</span>
                      <span>
                        {contract.computed.start_date} bis{' '}
                        {contract.computed.end_date || 'unbefristet'}
                      </span>
                      {contract.computed.days_to_expiry !== null && (
                        <>
                          <span>|</span>
                          <span>
                            {contract.computed.days_to_expiry > 0
                              ? `${contract.computed.days_to_expiry} Tage`
                              : 'Abgelaufen'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div style={styles.contractRight}>
                    <div style={styles.contractValue}>
                      {formatCurrency(contract.computed.annual_value)}/Jahr
                    </div>
                    <span style={{ ...styles.statusBadge, ...statusBadge.style }}>
                      {statusBadge.label}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function UploadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

function ContractIcon({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export default ContractsPage;
