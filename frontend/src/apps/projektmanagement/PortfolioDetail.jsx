/**
 * PortfolioDetail — Portfolio-Detail-Seite mit 4 Tabs.
 *
 * Tabs:
 *   - uebersicht   → PortfolioDashboard (KPIs, Phase-Mix, Top-Risiken, letzte SBs)
 *   - projekte     → Liste der zugeordneten Projekte + "Projekt hinzufuegen"-Selector
 *   - strategie    → Markdown-Freitext fuer Strategy / Description
 *   - einstellungen → Name, Status, Loeschen
 *
 * URL-Sync: ?tab=...
 */

import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useProjektmanagement, VersionConflictError } from '../../hooks/useProjektmanagement';
import { useAppPermission } from '../../components/RequireAppPermission';
import { ArrowLeftIcon, TrashIcon } from '../../components/Icons';
import ConfirmModal from '../../components/ConfirmModal';
import PortfolioDashboard from './components/portfolio/PortfolioDashboard';

const styles = {
  container: { height: '100%', display: 'flex', flexDirection: 'column' },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  backLink: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm, color: theme.colors.primary,
    cursor: 'pointer', marginBottom: theme.spacing.lg, border: 'none',
    background: 'none', padding: 0, fontWeight: theme.typography.weights.medium,
  },
  headerContent: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
    gap: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'], fontWeight: theme.typography.weights.bold,
    color: theme.colors.text, marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base, color: theme.colors.textSecondary,
    display: 'flex', alignItems: 'center', gap: theme.spacing.md,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs, padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium,
  },
  statusActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  statusArchived: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  headerActions: { display: 'flex', gap: theme.spacing.md },
  actionButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent', color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium,
    cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm,
  },
  primaryButton: { backgroundColor: theme.colors.primary, color: '#fff', border: 'none' },
  deleteButton: { color: theme.colors.error, borderColor: `${theme.colors.error}30` },
  // Tabs
  tabs: {
    display: 'flex', gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing['2xl']} 0`,
    backgroundColor: 'transparent',
  },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent', border: 'none', borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted, cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
  },
  tabActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  content: { flex: 1, padding: theme.spacing['2xl'], overflow: 'auto' },
  // Generische Form-Helpers (Strategie / Einstellungen)
  field: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, marginBottom: theme.spacing.lg },
  fieldLabel: {
    fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text,
  },
  fieldHint: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  input: {
    width: '100%', padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface,
    color: theme.colors.text, outline: 'none', boxSizing: 'border-box',
  },
  textarea: {
    width: '100%', padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface,
    color: theme.colors.text, outline: 'none', minHeight: 200, resize: 'vertical',
    boxSizing: 'border-box', fontFamily: 'inherit',
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface,
    color: theme.colors.text, cursor: 'pointer', outline: 'none',
  },
  // Tabellen (Projekte-Tab)
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: `1px solid ${theme.colors.border}`, padding: theme.spacing.sm,
  },
  td: {
    padding: theme.spacing.sm, fontSize: theme.typography.sizes.sm,
    color: theme.colors.text, borderBottom: `1px solid ${theme.colors.border}`,
  },
  linkLike: {
    color: theme.colors.primary, background: 'none', border: 'none',
    padding: 0, cursor: 'pointer', fontFamily: 'inherit',
    fontSize: 'inherit', fontWeight: theme.typography.weights.medium,
  },
  empty: {
    padding: theme.spacing['2xl'], textAlign: 'center',
    color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm,
  },
  toolbar: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  banner: {
    padding: theme.spacing.md, borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.md,
  },
  bannerError: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  bannerSuccess: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
};

const TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'projekte', label: 'Projekte' },
  { id: 'strategie', label: 'Strategie' },
  { id: 'einstellungen', label: 'Einstellungen' },
];

export default function PortfolioDetail() {
  const { id: portfolioId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role: appRole } = useAppPermission('projektmanagement');
  const {
    getPortfolio, updatePortfolio, deletePortfolio,
    getPortfolioProjekte, getAvailableProjekteForPortfolio,
    updateProjekt, getConfig,
  } = useProjektmanagement();

  const [portfolio, setPortfolio] = useState(null);
  const [projekteCount, setProjekteCount] = useState(0);
  const [appConfig, setAppConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const requestedTab = searchParams.get('tab') || 'uebersicht';
  const activeTab = TABS.find((t) => t.id === requestedTab)?.id || 'uebersicht';
  const setTab = (next) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', next);
      return params;
    }, { replace: true });
  };

  // Permission-Heuristik: App-Editor/Owner duerfen alles editieren.
  // Resource-Level-Permissions sind in den Routes geprueft — UI nutzt die
  // App-Rolle als grobes Gate (analog WizardPage/AbschlussberichtView).
  const canEdit = appRole === 'editor' || appRole === 'owner';
  const canDelete = appRole === 'owner';

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [p, projekte, cfg] = await Promise.all([
        getPortfolio(portfolioId),
        getPortfolioProjekte(portfolioId).catch(() => []),
        getConfig().catch(() => null),
      ]);
      if (!p) {
        setError('Portfolio nicht gefunden.');
        setPortfolio(null);
      } else {
        setPortfolio(p);
        setProjekteCount(projekte.length);
      }
      setAppConfig(cfg);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId, getPortfolio, getPortfolioProjekte, getConfig]);

  useEffect(() => { reload(); }, [reload]);

  if (isLoading) {
    return <div style={styles.empty}>Lade Portfolio…</div>;
  }
  if (!portfolio) {
    return <div style={{ ...styles.empty, color: theme.colors.error }}>{error || 'Nicht gefunden.'}</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button type="button" style={styles.backLink} onClick={() => navigate('/apps/projektmanagement?tab=portfolios')}>
          <ArrowLeftIcon /> Portfolios
        </button>
        <div style={styles.headerContent}>
          <div style={{ flex: 1 }}>
            <h1 style={styles.title}>{portfolio.name}</h1>
            <div style={styles.subtitle}>
              <span style={{
                ...styles.statusBadge,
                ...(portfolio.status === 'archived' ? styles.statusArchived : styles.statusActive),
              }}>
                {portfolio.status === 'archived' ? 'Archiviert' : 'Aktiv'}
              </span>
              <span>·</span>
              <span>{projekteCount} {projekteCount === 1 ? 'Projekt' : 'Projekte'}</span>
            </div>
          </div>
        </div>
      </div>

      <div style={styles.tabs}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              style={{ ...styles.tab, ...(isActive ? styles.tabActive : {}) }}
              onClick={() => setTab(tab.id)}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={styles.content}>
        {activeTab === 'uebersicht' && (
          <PortfolioDashboard portfolioId={portfolioId} appConfig={appConfig} />
        )}
        {activeTab === 'projekte' && (
          <ProjekteTab
            portfolioId={portfolioId}
            canEdit={canEdit}
            getPortfolioProjekte={getPortfolioProjekte}
            getAvailableProjekteForPortfolio={getAvailableProjekteForPortfolio}
            updateProjekt={updateProjekt}
            onCountChange={setProjekteCount}
            navigate={navigate}
          />
        )}
        {activeTab === 'strategie' && (
          <StrategieTab
            portfolio={portfolio}
            canEdit={canEdit}
            updatePortfolio={updatePortfolio}
            onSaved={(p) => setPortfolio(p)}
          />
        )}
        {activeTab === 'einstellungen' && (
          <EinstellungenTab
            portfolio={portfolio}
            canEdit={canEdit}
            canDelete={canDelete}
            updatePortfolio={updatePortfolio}
            deletePortfolio={deletePortfolio}
            onSaved={(p) => setPortfolio(p)}
            onDeleted={() => navigate('/apps/projektmanagement?tab=portfolios')}
          />
        )}
      </div>
    </div>
  );
}

// ============== Projekte-Tab ==============

function ProjekteTab({ portfolioId, canEdit, getPortfolioProjekte, getAvailableProjekteForPortfolio, updateProjekt, onCountChange, navigate }) {
  const [projekte, setProjekte] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [available, setAvailable] = useState([]);
  const [selectedToAdd, setSelectedToAdd] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getPortfolioProjekte(portfolioId);
      setProjekte(list);
      onCountChange(list.length);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [portfolioId, getPortfolioProjekte, onCountChange]);

  useEffect(() => { reload(); }, [reload]);

  const openAddDialog = async () => {
    setShowAdd(true);
    try {
      const list = await getAvailableProjekteForPortfolio(portfolioId);
      setAvailable(list);
      if (list[0]) setSelectedToAdd(list[0].id);
    } catch (err) {
      setError(err.message);
    }
  };

  const addProjekt = async () => {
    if (!selectedToAdd) return;
    setIsAdding(true);
    try {
      // Projekt updaten — portfolioId setzen.
      await updateProjekt(selectedToAdd, { portfolioId });
      setShowAdd(false);
      setSelectedToAdd('');
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const removeProjekt = async (projektId) => {
    try {
      await updateProjekt(projektId, { portfolioId: null });
      await reload();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div>
      <div style={styles.toolbar}>
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
          Projekte koennen nur dann zugeordnet werden, wenn du sie auch im Wizard editieren darfst.
        </div>
        {canEdit && (
          <button type="button" style={{ ...styles.actionButton, ...styles.primaryButton }} onClick={openAddDialog}>
            + Projekt hinzufügen
          </button>
        )}
      </div>

      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      {isLoading ? (
        <div style={styles.empty}>Lade…</div>
      ) : projekte.length === 0 ? (
        <div style={styles.empty}>Keine Projekte zugeordnet.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Projekt</th>
              <th style={styles.th}>Rolle</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {projekte.map((p) => (
              <tr key={p.id}>
                <td style={styles.td}>
                  <button type="button" style={styles.linkLike} onClick={() => navigate(`/apps/projektmanagement/${p.id}`)}>
                    {p.name}
                  </button>
                </td>
                <td style={styles.td}>{p.role || '—'}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {canEdit && (
                    <button
                      type="button"
                      style={{ ...styles.actionButton, ...styles.deleteButton, padding: `${theme.spacing.xs} ${theme.spacing.md}` }}
                      onClick={() => removeProjekt(p.id)}
                    >
                      Entfernen
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showAdd && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
            alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !isAdding) setShowAdd(false); }}
        >
          <div style={{
            backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl,
            padding: theme.spacing.xl, width: '90%', maxWidth: 520,
            display: 'flex', flexDirection: 'column', gap: theme.spacing.lg,
          }}>
            <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold }}>
              Projekt hinzufügen
            </div>
            {available.length === 0 ? (
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                Keine Projekte ohne Portfolio verfügbar — alle, auf die du Zugriff hast, sind bereits einem Portfolio zugeordnet.
              </div>
            ) : (
              <select style={styles.select} value={selectedToAdd} onChange={(e) => setSelectedToAdd(e.target.value)}>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md }}>
              <button type="button" style={styles.actionButton} onClick={() => setShowAdd(false)} disabled={isAdding}>
                Abbrechen
              </button>
              <button
                type="button"
                style={{ ...styles.actionButton, ...styles.primaryButton }}
                onClick={addProjekt}
                disabled={isAdding || !selectedToAdd || available.length === 0}
              >
                {isAdding ? 'Hinzufügen…' : 'Hinzufügen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============== Strategie-Tab ==============

function StrategieTab({ portfolio, canEdit, updatePortfolio, onSaved }) {
  const [description, setDescription] = useState(portfolio.description || '');
  const [strategy, setStrategy] = useState(portfolio.strategy || '');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setDescription(portfolio.description || '');
    setStrategy(portfolio.strategy || '');
    setIsDirty(false);
  }, [portfolio]);

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updatePortfolio(
        portfolio.id,
        {
          description: description.trim() || null,
          strategy: strategy.trim() || null,
        },
        { expectedVersion: portfolio.version },
      );
      onSaved(updated);
      setIsDirty(false);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setError('Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Kurzbeschreibung</label>
        <div style={styles.fieldHint}>1-2 Sätze — wird als Subtitle in der Portfolio-Liste angezeigt.</div>
        <textarea
          style={{ ...styles.textarea, minHeight: 70 }}
          value={description}
          onChange={(e) => { setDescription(e.target.value); setIsDirty(true); }}
          readOnly={!canEdit}
          placeholder="z.B. Bundling aller Digitalisierungs-Initiativen im Geschäftsjahr 2026."
        />
      </div>
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Strategie (Markdown)</label>
        <div style={styles.fieldHint}>
          Strategische Stoßrichtung, Value-Drivers, Prioritäten. Markdown-Syntax (Überschriften, Listen, Links) erlaubt — Rendering folgt später.
        </div>
        <textarea
          style={{ ...styles.textarea, minHeight: 280 }}
          value={strategy}
          onChange={(e) => { setStrategy(e.target.value); setIsDirty(true); }}
          readOnly={!canEdit}
          placeholder={'## Ziele\n- Kostensenkung\n- Time-to-Market\n\n## Value-Drivers\n- ...'}
        />
      </div>
      {canEdit && (
        <button
          type="button"
          style={{
            ...styles.actionButton, ...styles.primaryButton,
            opacity: isSaving ? 0.7 : 1,
            ...(isDirty && !isSaving ? { boxShadow: `0 0 0 3px ${theme.colors.primary}30` } : {}),
          }}
          onClick={save}
          disabled={isSaving || !isDirty}
        >
          {isSaving ? 'Speichern…' : isDirty ? 'Speichern *' : 'Gespeichert'}
        </button>
      )}
    </div>
  );
}

// ============== Einstellungen-Tab ==============

function EinstellungenTab({ portfolio, canEdit, canDelete, updatePortfolio, deletePortfolio, onSaved, onDeleted }) {
  const [name, setName] = useState(portfolio.name);
  const [status, setStatus] = useState(portfolio.status);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setName(portfolio.name);
    setStatus(portfolio.status);
    setIsDirty(false);
  }, [portfolio]);

  const save = async () => {
    if (!name.trim()) {
      setError('Name ist erforderlich.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updatePortfolio(
        portfolio.id,
        { name: name.trim(), status },
        { expectedVersion: portfolio.version },
      );
      onSaved(updated);
      setIsDirty(false);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setError('Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const doDelete = async () => {
    setIsDeleting(true);
    try {
      await deletePortfolio(portfolio.id);
      setConfirmDelete(false);
      onDeleted();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div>
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Name</label>
        <input
          style={styles.input}
          value={name}
          onChange={(e) => { setName(e.target.value); setIsDirty(true); }}
          readOnly={!canEdit}
        />
      </div>
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Status</label>
        <select
          style={styles.select}
          value={status}
          onChange={(e) => { setStatus(e.target.value); setIsDirty(true); }}
          disabled={!canEdit}
        >
          <option value="active">Aktiv</option>
          <option value="archived">Archiviert</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: theme.spacing.md, marginTop: theme.spacing.xl }}>
        {canEdit && (
          <button
            type="button"
            style={{
              ...styles.actionButton, ...styles.primaryButton,
              opacity: isSaving ? 0.7 : 1,
              ...(isDirty && !isSaving ? { boxShadow: `0 0 0 3px ${theme.colors.primary}30` } : {}),
            }}
            onClick={save}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? 'Speichern…' : isDirty ? 'Speichern *' : 'Gespeichert'}
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            style={{ ...styles.actionButton, ...styles.deleteButton }}
            onClick={() => setConfirmDelete(true)}
          >
            <TrashIcon /> Portfolio löschen
          </button>
        )}
      </div>

      <ConfirmModal
        open={confirmDelete}
        title="Portfolio löschen?"
        message="Das Portfolio wird gelöscht. Die zugeordneten Projekte werden NICHT mitgelöscht — sie verlieren nur die Portfolio-Zuordnung."
        confirmLabel="Löschen"
        destructive
        busy={isDeleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
