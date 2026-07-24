/**
 * PortfolioList — Tab-Inhalt für Portfolios in ProjektePage.
 *
 * Aufbau analog zur Projekte-Liste (ProjektePage): Aktionsleiste → Stats-Grid →
 * Such-/Filterzeile → Zeilen-Liste. Alle Portfolios werden geladen und
 * clientseitig gefiltert (damit die Kennzahlen Gesamtwerte zeigen). "+ Neues
 * Portfolio" öffnet ein einfaches Create-Modal (Name + Beschreibung).
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';
import { useAppPermission } from '../../../../components/RequireAppPermission';
import { AppsIcon } from '../../../../components/Icons';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
  // Action bar
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  createButton: {
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
  statValueSuccess: { color: theme.colors.success },
  statValueInfo: { color: theme.colors.info },
  // Filters
  filtersRow: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  searchInput: {
    flex: 1,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  filterSelect: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    fontSize: theme.typography.sizes.base,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  // List
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  cardMeta: {
    display: 'flex',
    gap: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  cardDescription: {
    color: theme.colors.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: '420px',
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    flexShrink: 0,
  },
  statusActive: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusArchived: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyIcon: { marginBottom: theme.spacing.lg, opacity: 0.5 },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  emptyText: { fontSize: theme.typography.sizes.sm, maxWidth: 520, margin: '0 auto' },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  // Modal
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '90%',
    maxWidth: 520,
    padding: theme.spacing.xl,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  fieldLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: 80,
    resize: 'vertical',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
  cancelBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
  },
  primaryBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

export default function PortfolioList() {
  const navigate = useNavigate();
  const { listPortfolios, createPortfolio, getPortfolioProjekte, projektauftraege } = useProjektmanagement();
  const { role: appRole } = useAppPermission('projektmanagement');
  const canCreate = appRole === 'editor' || appRole === 'owner';

  const [portfolios, setPortfolios] = useState([]);
  const [projekteCounts, setProjekteCounts] = useState({});
  // IDs aller Projekte, die einem Portfolio zugeordnet sind (für die Budget-Summe).
  const [projektIds, setProjektIds] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: '' });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  // Alle Portfolios laden (Filterung clientseitig, damit Kennzahlen Gesamtwerte zeigen).
  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await listPortfolios({});
      setPortfolios(list);
      const counts = {};
      const ids = [];
      await Promise.all(list.map(async (p) => {
        try {
          const projekte = await getPortfolioProjekte(p.id);
          counts[p.id] = projekte.length;
          for (const pr of projekte) ids.push(pr.id);
        } catch {
          counts[p.id] = 0;
        }
      }));
      setProjekteCounts(counts);
      setProjektIds(ids);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [listPortfolios, getPortfolioProjekte]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => {
    let result = [...portfolios];
    if (filters.status) {
      result = result.filter((p) => (p.status || 'active') === filters.status);
    }
    if (filters.search) {
      const s = filters.search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.name || '').toLowerCase().includes(s) ||
          (p.description || '').toLowerCase().includes(s)
      );
    }
    return result;
  }, [portfolios, filters]);

  // Gesamtbudget je Projektauftrag (Projekt-ID == Auftrags-ID). Summe der Budget-Posten.
  const budgetByAuftrag = useMemo(() => {
    const m = {};
    for (const a of projektauftraege) {
      m[a.id] = (a.budget || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    }
    return m;
  }, [projektauftraege]);

  const stats = {
    total: portfolios.length,
    active: portfolios.filter((p) => (p.status || 'active') === 'active').length,
    archived: portfolios.filter((p) => p.status === 'archived').length,
    // Summe der Gesamtbudgets aller in Portfolios enthaltenen Projekte.
    budgetGesamt: projektIds.reduce((sum, id) => sum + (budgetByAuftrag[id] || 0), 0),
  };

  const formatCurrency = (value) =>
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);

  return (
    <div style={styles.container}>
      {/* Action bar */}
      {canCreate && (
        <div style={styles.actions}>
          <button
            type="button"
            style={styles.createButton}
            onClick={() => setShowCreate(true)}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primaryHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = theme.colors.primary; }}
          >
            <PlusIcon />
            Neues Portfolio
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Gesamt</div>
          <div style={styles.statValue}>{stats.total}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Aktiv</div>
          <div style={{ ...styles.statValue, ...styles.statValueSuccess }}>{stats.active}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Archiviert</div>
          <div style={styles.statValue}>{stats.archived}</div>
        </div>
        <div style={styles.statCard}>
          <div style={styles.statLabel}>Budget gesamt</div>
          <div style={styles.statValue}>{formatCurrency(stats.budgetGesamt)}</div>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersRow}>
        <input
          type="text"
          placeholder="Portfolios durchsuchen..."
          value={filters.search}
          onChange={(e) => setFilters({ ...filters, search: e.target.value })}
          style={styles.searchInput}
        />
        <select
          style={styles.filterSelect}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">Alle Status</option>
          <option value="active">Aktiv</option>
          <option value="archived">Archiviert</option>
        </select>
      </div>

      {/* List */}
      {error && <div style={{ ...styles.emptyState, color: theme.colors.error }}>{error}</div>}

      {isLoading ? (
        <div style={styles.loading}>Lade…</div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyIcon}>
            <AppsIcon size={48} color={theme.colors.textMuted} />
          </div>
          <div style={styles.emptyTitle}>
            {portfolios.length === 0 ? 'Noch keine Portfolios' : 'Keine Portfolios gefunden'}
          </div>
          <p style={styles.emptyText}>
            {portfolios.length === 0
              ? 'Portfolios gruppieren Projekte für die PMO-Sicht — mit Dashboard für Health, Phase-Mix, Top-Risiken und letzte Statusberichte.'
              : 'Versuchen Sie, Ihre Filter anzupassen.'}
          </p>
        </div>
      ) : (
        <div style={styles.list}>
          {filtered.map((p) => {
            const count = projekteCounts[p.id] ?? 0;
            const isArchived = p.status === 'archived';
            return (
              <div
                key={p.id}
                style={styles.card}
                onClick={() => navigate(`/apps/projektmanagement/portfolios/${p.id}`)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  e.currentTarget.style.borderColor = theme.colors.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.surface;
                  e.currentTarget.style.borderColor = theme.colors.border;
                }}
              >
                <div style={styles.cardInfo}>
                  <div style={styles.cardTitle}>{p.name}</div>
                  <div style={styles.cardMeta}>
                    <span>{count} {count === 1 ? 'Projekt' : 'Projekte'}</span>
                    {p.description && (
                      <>
                        <span>|</span>
                        <span style={styles.cardDescription}>{p.description}</span>
                      </>
                    )}
                  </div>
                </div>
                <span style={{ ...styles.statusBadge, ...(isArchived ? styles.statusArchived : styles.statusActive) }}>
                  {isArchived ? 'Archiviert' : 'Aktiv'}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreatePortfolioModal
          onClose={() => setShowCreate(false)}
          onCreate={async (input) => {
            const created = await createPortfolio(input);
            setShowCreate(false);
            navigate(`/apps/projektmanagement/portfolios/${created.id}`);
          }}
        />
      )}
    </div>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function CreatePortfolioModal({ onClose, onCreate }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async () => {
    if (!name.trim()) {
      setError('Name ist erforderlich.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await onCreate({ name: name.trim(), description: description.trim() || undefined });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}>
      <div style={styles.modalContent}>
        <div style={styles.modalTitle}>Neues Portfolio</div>
        {error && <div style={{ color: theme.colors.error, fontSize: theme.typography.sizes.sm }}>{error}</div>}
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Name</label>
          <input
            style={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Digitalisierung 2026"
            autoFocus
          />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Kurzbeschreibung (optional)</label>
          <textarea
            style={styles.textarea}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="1-2 Sätze: Worum geht es in diesem Portfolio?"
          />
        </div>
        <div style={styles.modalActions}>
          <button type="button" style={styles.cancelBtn} onClick={onClose} disabled={isSaving}>
            Abbrechen
          </button>
          <button type="button" style={styles.primaryBtn} onClick={submit} disabled={isSaving}>
            {isSaving ? 'Erstellen…' : 'Erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}
