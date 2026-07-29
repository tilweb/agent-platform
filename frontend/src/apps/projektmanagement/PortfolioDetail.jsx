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
import StepNav from './components/StepNav';

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

// Zielstruktur (RuhrPM-Konzept), am Projektauftrag ausgerichtet. `label` = Titel
// in StepNav und zugleich Schlüssel der Icon-Zuordnung (STEP_ICONS).
const TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'basis', label: 'Basis' },
  { id: 'personen', label: 'Personen' },
  { id: 'ziele', label: 'Ziele' },
  { id: 'roadmap', label: 'Roadmap' },
  { id: 'kosten', label: 'Kosten' },
  { id: 'risiken', label: 'Risiken' },
];

const PLACEHOLDER_TABS = new Set(['personen', 'ziele', 'roadmap', 'kosten', 'risiken']);

// Anzeigename eines Config-Werts (z.B. Portfoliostatus) — Fallback auf den Wert.
function optionLabel(appConfig, key, value) {
  const opt = (appConfig?.[key] || []).find((o) => o.value === value);
  return opt ? opt.label : (value || '—');
}
function statusLabel(appConfig, status) {
  return optionLabel(appConfig, 'portfolio_status', status);
}

function PlaceholderTab() {
  return <div style={styles.empty}>Dieser Bereich wird als Nächstes umgesetzt.</div>;
}

export default function PortfolioDetail() {
  const { id: portfolioId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role: appRole } = useAppPermission('projektmanagement');
  const { getPortfolio, getPortfolioProjekte, getConfig } = useProjektmanagement();

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
                {statusLabel(appConfig, portfolio.status)}
              </span>
              <span>·</span>
              <span>{projekteCount} {projekteCount === 1 ? 'Projekt' : 'Projekte'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Icon-Tab-Leiste (geteilte StepNav, Icons per Titel) */}
      <StepNav
        steps={TABS.map((t, i) => ({ number: i + 1, title: t.label }))}
        getStatus={(n) => (TABS[n - 1].id === activeTab ? 'active' : 'default')}
        onSelect={(n) => setTab(TABS[n - 1].id)}
      />

      <div style={styles.content}>
        {activeTab === 'uebersicht' && (
          <PortfolioDashboard portfolioId={portfolioId} appConfig={appConfig} />
        )}
        {activeTab === 'basis' && (
          <BasisTab
            key={`${portfolio.id}-${portfolio.version}`}
            portfolio={portfolio}
            appConfig={appConfig}
            canEdit={canEdit}
            canDelete={canDelete}
            onSaved={(p) => setPortfolio(p)}
            onDeleted={() => navigate('/apps/projektmanagement?tab=portfolios')}
            onCountChange={setProjekteCount}
            navigate={navigate}
          />
        )}
        {PLACEHOLDER_TABS.has(activeTab) && <PlaceholderTab />}
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

// ============== Basis-Tab (Stammdaten + Projekt-/Ideen-Zuordnung + Löschen) ==============

function BasisTab({ portfolio, appConfig, canEdit, canDelete, onSaved, onDeleted, onCountChange, navigate }) {
  const {
    updatePortfolio, deletePortfolio,
    getPortfolioProjekte, getAvailableProjekteForPortfolio, updateProjekt,
    getPortfolioIdeen, getAvailableIdeenForPortfolio, assignIdeeToPortfolio, unassignIdeeFromPortfolio,
  } = useProjektmanagement();

  const initForm = () => ({
    name: portfolio.name || '',
    type: portfolio.type || '',
    status: portfolio.status || 'active',
    driver: portfolio.driver || '',
    description: portfolio.description || '',
    start_date: portfolio.start_date || '',
    end_date: portfolio.end_date || '',
  });
  // Formular wird aus dem Portfolio initialisiert; die Komponente wird per key
  // (portfolio.version) neu gemountet, wenn sich das Portfolio ändert (nach Save).
  const [form, setForm] = useState(initForm);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); setIsDirty(true); };
  const opts = (key) => appConfig?.[key] || [];

  const save = async () => {
    if (!form.name.trim()) { setError('Name ist erforderlich.'); return; }
    setIsSaving(true); setError(null);
    try {
      const updated = await updatePortfolio(portfolio.id, {
        name: form.name.trim(),
        status: form.status,
        type: form.type || undefined,
        driver: form.driver || undefined,
        description: form.description.trim() || null,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      }, { expectedVersion: portfolio.version });
      onSaved(updated);
      setIsDirty(false);
    } catch (err) {
      setError(err instanceof VersionConflictError
        ? 'Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.'
        : err.message);
    } finally { setIsSaving(false); }
  };

  const doDelete = async () => {
    setIsDeleting(true);
    try { await deletePortfolio(portfolio.id); setConfirmDelete(false); onDeleted(); }
    catch (err) { setError(err.message); }
    finally { setIsDeleting(false); }
  };

  const sectionTitle = {
    fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text, margin: `${theme.spacing['2xl']} 0 ${theme.spacing.md}`,
  };

  return (
    <div>
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>ID</label>
          <input style={{ ...styles.input, color: theme.colors.textMuted }} value={portfolio.id} readOnly />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Name</label>
          <input style={styles.input} value={form.name} onChange={(e) => set('name', e.target.value)} readOnly={!canEdit} />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Portfoliotyp</label>
          <select style={styles.select} value={form.type} onChange={(e) => set('type', e.target.value)} disabled={!canEdit}>
            <option value="">—</option>
            {opts('portfolio_type').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Portfoliostatus</label>
          <select style={styles.select} value={form.status} onChange={(e) => set('status', e.target.value)} disabled={!canEdit}>
            {opts('portfolio_status').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Portfoliotreiber</label>
          <select style={styles.select} value={form.driver} onChange={(e) => set('driver', e.target.value)} disabled={!canEdit}>
            <option value="">—</option>
            {opts('portfolio_driver').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div />
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Startdatum</label>
          <input type="date" style={styles.input} value={form.start_date} onChange={(e) => set('start_date', e.target.value)} readOnly={!canEdit} />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Enddatum</label>
          <input type="date" style={styles.input} value={form.end_date} onChange={(e) => set('end_date', e.target.value)} readOnly={!canEdit} />
        </div>
      </div>
      <div style={styles.field}>
        <label style={styles.fieldLabel}>Kurzbeschreibung</label>
        <div style={styles.fieldHint}>1-2 Sätze — erscheint als Subtitle in der Portfolio-Liste.</div>
        <textarea
          style={{ ...styles.textarea, minHeight: 80 }}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          readOnly={!canEdit}
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

      <div style={sectionTitle}>Zugeordnete Projekte</div>
      <ProjekteTab
        portfolioId={portfolio.id}
        canEdit={canEdit}
        getPortfolioProjekte={getPortfolioProjekte}
        getAvailableProjekteForPortfolio={getAvailableProjekteForPortfolio}
        updateProjekt={updateProjekt}
        onCountChange={onCountChange}
        navigate={navigate}
      />

      <div style={sectionTitle}>Zugeordnete Projektideen</div>
      <IdeenTab
        portfolioId={portfolio.id}
        canEdit={canEdit}
        getPortfolioIdeen={getPortfolioIdeen}
        getAvailableIdeenForPortfolio={getAvailableIdeenForPortfolio}
        assignIdeeToPortfolio={assignIdeeToPortfolio}
        unassignIdeeFromPortfolio={unassignIdeeFromPortfolio}
        navigate={navigate}
      />

      {canDelete && (
        <div style={{ marginTop: theme.spacing['2xl'] }}>
          <button type="button" style={{ ...styles.actionButton, ...styles.deleteButton }} onClick={() => setConfirmDelete(true)}>
            <TrashIcon /> Portfolio löschen
          </button>
        </div>
      )}
      <ConfirmModal
        open={confirmDelete}
        title="Portfolio löschen?"
        message="Das Portfolio wird gelöscht. Die zugeordneten Projekte/Ideen werden NICHT mitgelöscht — sie verlieren nur die Portfolio-Zuordnung."
        confirmLabel="Löschen"
        destructive
        busy={isDeleting}
        onConfirm={doDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}

// ============== Ideen-Zuordnung (im Basis-Tab) ==============

function IdeenTab({ portfolioId, canEdit, getPortfolioIdeen, getAvailableIdeenForPortfolio, assignIdeeToPortfolio, unassignIdeeFromPortfolio, navigate }) {
  const [ideen, setIdeen] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [available, setAvailable] = useState([]);
  const [selectedToAdd, setSelectedToAdd] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try { setIdeen(await getPortfolioIdeen(portfolioId)); }
    catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [portfolioId, getPortfolioIdeen]);
  useEffect(() => { reload(); }, [reload]);

  const openAddDialog = async () => {
    setShowAdd(true);
    try {
      const list = await getAvailableIdeenForPortfolio(portfolioId);
      setAvailable(list);
      if (list[0]) setSelectedToAdd(list[0].id);
    } catch (err) { setError(err.message); }
  };
  const addIdee = async () => {
    if (!selectedToAdd) return;
    setIsAdding(true);
    try { await assignIdeeToPortfolio(portfolioId, selectedToAdd); setShowAdd(false); setSelectedToAdd(''); await reload(); }
    catch (err) { setError(err.message); }
    finally { setIsAdding(false); }
  };
  const removeIdee = async (ideeId) => {
    try { await unassignIdeeFromPortfolio(portfolioId, ideeId); await reload(); }
    catch (err) { setError(err.message); }
  };

  return (
    <div>
      <div style={styles.toolbar}>
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
          Ideen können nur zugeordnet werden, wenn du sie auch editieren darfst.
        </div>
        {canEdit && (
          <button type="button" style={{ ...styles.actionButton, ...styles.primaryButton }} onClick={openAddDialog}>
            + Projektidee hinzufügen
          </button>
        )}
      </div>

      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      {isLoading ? (
        <div style={styles.empty}>Lade…</div>
      ) : ideen.length === 0 ? (
        <div style={styles.empty}>Keine Projektideen zugeordnet.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Projektidee</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {ideen.map((i) => (
              <tr key={i.id}>
                <td style={styles.td}>
                  <button type="button" style={styles.linkLike} onClick={() => navigate(`/apps/projektmanagement/ideen/${i.id}`)}>
                    {i.name}
                  </button>
                </td>
                <td style={styles.td}>{i.status || '—'}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {canEdit && (
                    <button
                      type="button"
                      style={{ ...styles.actionButton, ...styles.deleteButton, padding: `${theme.spacing.xs} ${theme.spacing.md}` }}
                      onClick={() => removeIdee(i.id)}
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
              Projektidee hinzufügen
            </div>
            {available.length === 0 ? (
              <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                Keine Ideen ohne Portfolio verfügbar.
              </div>
            ) : (
              <select style={styles.select} value={selectedToAdd} onChange={(e) => setSelectedToAdd(e.target.value)}>
                {available.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md }}>
              <button type="button" style={styles.actionButton} onClick={() => setShowAdd(false)} disabled={isAdding}>Abbrechen</button>
              <button
                type="button"
                style={{ ...styles.actionButton, ...styles.primaryButton }}
                onClick={addIdee}
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
