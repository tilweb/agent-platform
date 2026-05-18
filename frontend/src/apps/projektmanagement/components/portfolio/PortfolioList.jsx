/**
 * PortfolioList — Tab-Inhalt fuer Portfolios in ProjektePage.
 *
 * Card-Grid, analog Projekt-Cards. "+ Portfolio"-Button oeffnet ein einfaches
 * Create-Modal (Name + Beschreibung). Klick auf eine Karte navigiert zum
 * Portfolio-Detail.
 */

import { useEffect, useState, useCallback } from 'react';
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
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  toolbarLeft: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
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
  createBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    flexShrink: 0,
  },
  statusActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  statusArchived: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  cardMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.sm,
  },
  empty: {
    padding: theme.spacing['2xl'],
    textAlign: 'center',
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
  const { listPortfolios, createPortfolio, getPortfolioProjekte } = useProjektmanagement();
  const { role: appRole } = useAppPermission('projektmanagement');
  const canCreate = appRole === 'editor' || appRole === 'owner';

  const [portfolios, setPortfolios] = useState([]);
  const [projekteCounts, setProjekteCounts] = useState({});
  const [statusFilter, setStatusFilter] = useState('active');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const filter = statusFilter === 'all' ? undefined : statusFilter;
      const list = await listPortfolios({ status: filter });
      setPortfolios(list);
      // Projekt-Counts laden — ein Call pro Portfolio (in der Praxis < 20 Portfolios).
      const counts = {};
      await Promise.all(list.map(async (p) => {
        try {
          const projekte = await getPortfolioProjekte(p.id);
          counts[p.id] = projekte.length;
        } catch {
          counts[p.id] = 0;
        }
      }));
      setProjekteCounts(counts);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, listPortfolios, getPortfolioProjekte]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          <select
            style={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="active">Aktive</option>
            <option value="archived">Archivierte</option>
            <option value="all">Alle</option>
          </select>
        </div>
        {canCreate && (
          <button type="button" style={styles.createBtn} onClick={() => setShowCreate(true)}>
            + Portfolio
          </button>
        )}
      </div>

      {error && (
        <div style={{ ...styles.empty, color: theme.colors.error }}>{error}</div>
      )}

      {isLoading ? (
        <div style={styles.empty}>Lade…</div>
      ) : portfolios.length === 0 ? (
        <div style={styles.empty}>
          <div style={{ marginBottom: theme.spacing.md }}>
            <AppsIcon size={48} color={theme.colors.textMuted} />
          </div>
          <div style={{
            fontSize: theme.typography.sizes.lg,
            fontWeight: theme.typography.weights.semibold,
            color: theme.colors.text,
            marginBottom: theme.spacing.sm,
          }}>
            Noch keine Portfolios
          </div>
          <p style={{ fontSize: theme.typography.sizes.sm, maxWidth: 520, margin: '0 auto' }}>
            Portfolios gruppieren Projekte für die PMO-Sicht. Pro Portfolio gibt es ein
            Dashboard mit Health, Phase-Mix, Top-Risiken und letzten Statusberichten.
          </p>
        </div>
      ) : (
        <div style={styles.grid}>
          {portfolios.map((p) => (
            <div
              key={p.id}
              style={styles.card}
              onClick={() => navigate(`/apps/projektmanagement/portfolios/${p.id}`)}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.colors.primary; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.colors.border; }}
            >
              <div style={styles.cardHeader}>
                <div style={styles.cardTitle}>{p.name}</div>
                <span style={{
                  ...styles.statusBadge,
                  ...(p.status === 'archived' ? styles.statusArchived : styles.statusActive),
                }}>
                  {p.status === 'archived' ? 'Archiviert' : 'Aktiv'}
                </span>
              </div>
              {p.description && <div style={styles.cardDescription}>{p.description}</div>}
              <div style={styles.cardMeta}>
                <span>{projekteCounts[p.id] ?? 0} {projekteCounts[p.id] === 1 ? 'Projekt' : 'Projekte'}</span>
              </div>
            </div>
          ))}
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
