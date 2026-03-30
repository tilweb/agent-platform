import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useVsm } from '../../hooks/useVsm';

const STATUS_LABELS = {
  entwurf: 'Entwurf',
  erfassung: 'Erfassung',
  analyse: 'Analyse',
  abgeschlossen: 'Abgeschlossen',
};

const STATUS_STYLES = {
  entwurf: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  erfassung: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  analyse: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  abgeschlossen: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
};

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    maxWidth: '1200px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  createButton: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  statsRow: {
    display: 'flex',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing['2xl'],
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  filterRow: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
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
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
    gap: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
    lineHeight: theme.typography.lineHeight.relaxed,
  },
  cardMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardMetaInfo: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  cardInfo: {
    display: 'flex',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.medium,
    marginBottom: theme.spacing.sm,
    color: theme.colors.text,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.xl,
  },
  modalOverlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '500px',
    width: '90%',
    padding: theme.spacing['2xl'],
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    marginBottom: theme.spacing.lg,
    color: theme.colors.text,
  },
  formGroup: {
    marginBottom: theme.spacing.lg,
  },
  formLabel: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  formInput: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
  },
  formTextarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '80px',
    resize: 'vertical',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.xl,
  },
  cancelButton: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

export default function VsmPage() {
  const navigate = useNavigate();
  const { projekte, stats, isLoading, refresh, createProjekt } = useVsm();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjekt, setNewProjekt] = useState({ name: '', beschreibung: '' });
  const [creating, setCreating] = useState(false);

  const filtered = projekte.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.name.toLowerCase().includes(s) && !p.beschreibung.toLowerCase().includes(s)) return false;
    }
    return true;
  });

  const handleCreate = async () => {
    if (!newProjekt.name.trim()) return;
    setCreating(true);
    try {
      const projekt = await createProjekt(newProjekt);
      setShowCreateModal(false);
      setNewProjekt({ name: '', beschreibung: '' });
      navigate(`/apps/vsm/${projekt.id}`);
    } catch (err) {
      console.error('Error creating VSM project:', err);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (iso) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getProcessCount = (p) => p.vsm_data?.prozessschritte?.length || 0;
  const getSupplierCount = (p) => p.vsm_data?.lieferanten?.length || 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Value Stream Mapping</h1>
          <p style={styles.subtitle}>Wertstromanlysen erstellen, visualisieren und KI-gestuetzt auswerten</p>
        </div>
        <button style={styles.createButton} onClick={() => setShowCreateModal(true)}>
          + Neues VSM-Projekt
        </button>
      </div>

      {stats && (
        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <div style={styles.statValue}>{stats.total}</div>
            <div style={styles.statLabel}>Gesamt</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: theme.colors.primary }}>{stats.erfassung}</div>
            <div style={styles.statLabel}>In Erfassung</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: theme.colors.warning }}>{stats.analyse}</div>
            <div style={styles.statLabel}>Analysiert</div>
          </div>
          <div style={styles.statCard}>
            <div style={{ ...styles.statValue, color: theme.colors.success }}>{stats.abgeschlossen}</div>
            <div style={styles.statLabel}>Abgeschlossen</div>
          </div>
        </div>
      )}

      <div style={styles.filterRow}>
        <input
          style={styles.searchInput}
          placeholder="VSM-Projekte suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select style={styles.filterSelect} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Alle Status</option>
          <option value="entwurf">Entwurf</option>
          <option value="erfassung">Erfassung</option>
          <option value="analyse">Analyse</option>
          <option value="abgeschlossen">Abgeschlossen</option>
        </select>
      </div>

      {isLoading ? (
        <div style={styles.emptyState}>Laden...</div>
      ) : filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={styles.emptyTitle}>
            {projekte.length === 0 ? 'Noch keine VSM-Projekte' : 'Keine Treffer'}
          </div>
          <div style={styles.emptyText}>
            {projekte.length === 0
              ? 'Erstelle dein erstes VSM-Projekt, um mit der Wertstromanalyse zu beginnen.'
              : 'Passe die Filterkriterien an.'}
          </div>
          {projekte.length === 0 && (
            <button style={styles.createButton} onClick={() => setShowCreateModal(true)}>
              + Neues VSM-Projekt
            </button>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((p) => (
            <div
              key={p.id}
              style={styles.card}
              onClick={() => navigate(`/apps/vsm/${p.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.colors.primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.colors.border; }}
            >
              <div style={styles.cardTitle}>{p.name}</div>
              {p.beschreibung && <div style={styles.cardDescription}>{p.beschreibung}</div>}
              <div style={styles.cardInfo}>
                <span>{getProcessCount(p)} Prozessschritte</span>
                <span>{getSupplierCount(p)} Lieferanten</span>
              </div>
              <div style={styles.cardMeta}>
                <span style={styles.cardMetaInfo}>
                  {p.vsm_data?.meta_daten?.unternehmen || 'Kein Unternehmen'} | {formatDate(p.updated_at)}
                </span>
                <span style={{ ...styles.statusBadge, ...STATUS_STYLES[p.status] }}>
                  {STATUS_LABELS[p.status]}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div style={styles.modalOverlay} onClick={() => setShowCreateModal(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Neues VSM-Projekt</div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Projektname</label>
              <input
                style={styles.formInput}
                placeholder="z.B. Wertstromanalyse Fertigung Halle 3"
                value={newProjekt.name}
                onChange={(e) => setNewProjekt(prev => ({ ...prev, name: e.target.value }))}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div style={styles.formGroup}>
              <label style={styles.formLabel}>Beschreibung (optional)</label>
              <textarea
                style={styles.formTextarea}
                placeholder="Kurze Beschreibung des Analyseprojekts..."
                value={newProjekt.beschreibung}
                onChange={(e) => setNewProjekt(prev => ({ ...prev, beschreibung: e.target.value }))}
              />
            </div>
            <div style={styles.modalActions}>
              <button style={styles.cancelButton} onClick={() => setShowCreateModal(false)}>
                Abbrechen
              </button>
              <button
                style={{ ...styles.createButton, opacity: creating ? 0.6 : 1 }}
                onClick={handleCreate}
                disabled={creating || !newProjekt.name.trim()}
              >
                {creating ? 'Erstelle...' : 'Projekt erstellen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
