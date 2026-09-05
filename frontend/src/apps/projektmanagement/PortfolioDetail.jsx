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

import { useEffect, useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useProjektmanagement, VersionConflictError } from '../../hooks/useProjektmanagement';
import { useAppPermission } from '../../components/RequireAppPermission';
import { ArrowLeftIcon, TrashIcon } from '../../components/Icons';
import ConfirmModal from '../../components/ConfirmModal';
import PortfolioDashboard from './components/portfolio/PortfolioDashboard';
import StepNav from './components/StepNav';
import KnowledgePanel from './components/KnowledgePanel';
import Personen from './components/steps/Personen';
import Ziele from './components/steps/Ziele';
import GanttRoadmap from './components/GanttRoadmap';
import PortfolioCostChart from './components/portfolio/PortfolioCostChart';

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
  uebersichtRow: { display: 'flex', gap: theme.spacing.xl, alignItems: 'flex-start' },
  kiSidebar: {
    width: '380px',
    minWidth: '380px',
    position: 'sticky',
    top: theme.spacing.lg,
    alignSelf: 'flex-start',
    height: 'calc(100vh - 220px)',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
  },
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

// Kopfzeile eines Tabs — gleiches Muster wie die Step-Headlines im Projektauftrag
// (Personen/Ziele bringen ihre Headline über die geteilten Step-Komponenten mit).
function TabHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      <h2 style={{
        fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.semibold,
        color: theme.colors.text, marginBottom: theme.spacing.sm,
      }}>{title}</h2>
      {subtitle && (
        <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

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

// Tabs mit einem zentralen Speichern-Button im Header (analog Projektauftrag).
// Der aktive Tab wird per Ref angesprochen (imperativer save()-Handle).
const SAVABLE_TABS = new Set(['basis', 'personen', 'ziele', 'roadmap', 'risiken']);

// Anzeigename eines Config-Werts (z.B. Portfoliostatus) — Fallback auf den Wert.
function optionLabel(appConfig, key, value) {
  const opt = (appConfig?.[key] || []).find((o) => o.value === value);
  return opt ? opt.label : (value || '—');
}
function statusLabel(appConfig, status) {
  return optionLabel(appConfig, 'portfolio_status', status);
}

export default function PortfolioDetail() {
  const { id: portfolioId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { role: appRole } = useAppPermission('projektmanagement');
  const { getPortfolio, getPortfolioProjekte, getConfig, updatePortfolio } = useProjektmanagement();

  const [portfolio, setPortfolio] = useState(null);
  const [projekteCount, setProjekteCount] = useState(0);
  const [appConfig, setAppConfig] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  // KI-Balken (Übersicht): Chatverlauf in-session; Analyse persistiert an der Idee/Portfolio.
  const [portfolioChat, setPortfolioChat] = useState([]);

  // KI-Analyse des Portfolios persistieren (Übersicht ist read-only → kein Edit-
  // Konflikt mit der versionsbasierten Tab-Speicherung).
  const handlePortfolioAnalyse = async (analysis) => {
    setPortfolio((prev) => (prev ? { ...prev, analyses: { ...(prev.analyses || {}), _general: analysis } } : prev));
    try {
      if (portfolio?.id) {
        const updated = await updatePortfolio(
          portfolio.id,
          { analyses: { ...(portfolio.analyses || {}), _general: analysis } },
          { expectedVersion: portfolio.version },
        );
        setPortfolio(updated);
      }
    } catch (e) {
      console.error('Portfolio-Analyse konnte nicht gespeichert werden:', e);
    }
  };

  // Zentrale Speichern-Steuerung im Header: der aktive Tab meldet seinen
  // Dirty-/Saving-Zustand (tabState) und stellt save() per Ref bereit.
  const activeTabRef = useRef(null);
  const [tabState, setTabState] = useState({ dirty: false, saving: false });

  const requestedTab = searchParams.get('tab') || 'uebersicht';
  const activeTab = TABS.find((t) => t.id === requestedTab)?.id || 'uebersicht';
  const setTab = (next) => {
    setTabState({ dirty: false, saving: false });
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

          {canEdit && SAVABLE_TABS.has(activeTab) && (
            <div style={styles.headerActions}>
              <button
                type="button"
                style={{
                  ...styles.actionButton,
                  ...styles.primaryButton,
                  opacity: tabState.saving ? 0.7 : 1,
                  ...(tabState.dirty && !tabState.saving ? { boxShadow: `0 0 0 3px ${theme.colors.primary}30` } : {}),
                }}
                onClick={() => activeTabRef.current?.save?.()}
                disabled={tabState.saving}
              >
                <SaveIcon />
                {tabState.saving ? 'Speichern…' : tabState.dirty ? 'Speichern *' : 'Speichern'}
              </button>
            </div>
          )}
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
          <div style={styles.uebersichtRow}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <TabHeader
                title="Übersicht"
                subtitle="KPIs, Phasen-Mix, Top-Risiken und letzte Statusberichte der zugeordneten Projekte."
              />
              <PortfolioDashboard portfolioId={portfolioId} appConfig={appConfig} />
            </div>
            <div style={styles.kiSidebar}>
              <KnowledgePanel
                element="portfolio"
                segment="_general"
                canAnalyze
                entity={portfolio}
                analysis={portfolio.analyses?._general || null}
                onAnalysisComplete={handlePortfolioAnalyse}
                chatMessages={portfolioChat}
                onChatMessagesChange={setPortfolioChat}
              />
            </div>
          </div>
        )}
        {activeTab === 'basis' && (
          <BasisTab
            key={`${portfolio.id}-${portfolio.version}`}
            ref={activeTabRef}
            portfolio={portfolio}
            appConfig={appConfig}
            canEdit={canEdit}
            canDelete={canDelete}
            onStateChange={setTabState}
            onSaved={(p) => setPortfolio(p)}
            onDeleted={() => navigate('/apps/projektmanagement?tab=portfolios')}
            onCountChange={setProjekteCount}
            navigate={navigate}
          />
        )}
        {activeTab === 'personen' && (
          <PersonenTab
            key={`${portfolio.id}-${portfolio.version}`}
            ref={activeTabRef}
            portfolio={portfolio}
            appConfig={appConfig}
            canEdit={canEdit}
            onStateChange={setTabState}
            onSaved={(p) => setPortfolio(p)}
          />
        )}
        {activeTab === 'ziele' && (
          <ZieleTab
            key={`${portfolio.id}-${portfolio.version}`}
            ref={activeTabRef}
            portfolio={portfolio}
            canEdit={canEdit}
            onStateChange={setTabState}
            onSaved={(p) => setPortfolio(p)}
          />
        )}
        {activeTab === 'roadmap' && (
          <RoadmapTab
            key={`${portfolio.id}-${portfolio.version}`}
            ref={activeTabRef}
            portfolio={portfolio}
            canEdit={canEdit}
            onStateChange={setTabState}
            onSaved={(p) => setPortfolio(p)}
            navigate={navigate}
          />
        )}
        {activeTab === 'kosten' && (
          <KostenTab key={portfolio.id} portfolio={portfolio} navigate={navigate} />
        )}
        {activeTab === 'risiken' && (
          <RisikenTab
            key={`${portfolio.id}-${portfolio.version}`}
            ref={activeTabRef}
            portfolio={portfolio}
            canEdit={canEdit}
            onStateChange={setTabState}
            onSaved={(p) => setPortfolio(p)}
            navigate={navigate}
          />
        )}
      </div>
    </div>
  );
}

// ============== Personen-Tab (Portfolioteam + Portfolio-Stakeholder) ==============
//
// Analog zur Personen-Maske des Projektauftrags (geteilte Personen-Komponente),
// nur mit Portfolio-Labels. Team + Stakeholder werden im Portfolio persistiert
// (metadata-JSONB auf DB, Top-Level in YAML).

const PersonenTab = forwardRef(function PersonenTab({ portfolio, appConfig, onStateChange, onSaved }, ref) {
  const { updatePortfolio } = useProjektmanagement();
  const [data, setData] = useState({
    organization: portfolio.organization || [],
    stakeholders: portfolio.stakeholders || [],
  });
  const [error, setError] = useState(null);

  const handleChange = (patch) => {
    setData((d) => ({ ...d, ...patch }));
    onStateChange?.({ dirty: true, saving: false });
  };

  const save = async () => {
    onStateChange?.({ dirty: true, saving: true }); setError(null);
    try {
      const updated = await updatePortfolio(portfolio.id, {
        organization: data.organization,
        stakeholders: data.stakeholders,
      }, { expectedVersion: portfolio.version });
      onStateChange?.({ dirty: false, saving: false });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof VersionConflictError
        ? 'Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.'
        : err.message);
      onStateChange?.({ dirty: true, saving: false });
    }
  };
  useImperativeHandle(ref, () => ({ save }));

  return (
    <div>
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}
      <Personen
        data={data}
        onChange={handleChange}
        config={appConfig}
        title="Personen"
        subtitle="Definieren Sie das Portfolioteam und die wichtigsten Portfolio-Stakeholder."
        teamLabel="Portfolioteam"
        stakeholderLabel="Portfolio-Stakeholder"
      />
    </div>
  );
});

// ============== Ziele-Tab (Portfolioziele + Erfolgskriterien) ==============
//
// Analog zur Ziele-Maske des Projektauftrags (geteilte Ziele-Komponente), nur mit
// Portfoliowording. goals (Freitext) + criteria (Liste) werden im Portfolio
// persistiert (metadata-JSONB auf DB, Top-Level in YAML).

const PORTFOLIO_GOALS_PLACEHOLDER = `Beschreiben Sie die übergeordneten Ziele des Portfolios...

Beispiel:
- Bündelung aller Digitalisierungs-Initiativen unter einem strategischen Dach
- Verbesserung der Ressourcen-Auslastung über alle Projekte um 15%
- Aufbau einer einheitlichen Projekt-Governance`;

const ZieleTab = forwardRef(function ZieleTab({ portfolio, onStateChange, onSaved }, ref) {
  const { updatePortfolio } = useProjektmanagement();
  const [data, setData] = useState({
    goals: portfolio.goals || '',
    criteria: portfolio.criteria || [],
  });
  const [error, setError] = useState(null);

  const handleChange = (patch) => {
    setData((d) => ({ ...d, ...patch }));
    onStateChange?.({ dirty: true, saving: false });
  };

  const save = async () => {
    onStateChange?.({ dirty: true, saving: true }); setError(null);
    try {
      const updated = await updatePortfolio(portfolio.id, {
        goals: data.goals,
        criteria: (data.criteria || []).map((c) => c.trim()).filter(Boolean),
      }, { expectedVersion: portfolio.version });
      onStateChange?.({ dirty: false, saving: false });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof VersionConflictError
        ? 'Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.'
        : err.message);
      onStateChange?.({ dirty: true, saving: false });
    }
  };
  useImperativeHandle(ref, () => ({ save }));

  return (
    <div>
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}
      <Ziele
        data={data}
        onChange={handleChange}
        title="Ziele"
        subtitle="Definieren Sie die übergeordneten Portfolioziele und messbaren Erfolgskriterien."
        goalsLabel="Portfolioziele"
        goalsPlaceholder={PORTFOLIO_GOALS_PLACEHOLDER}
        criteriaHint="Definieren Sie messbare Kriterien, an denen der Portfolioerfolg gemessen wird."
        tipText="Gute Portfolioziele richten alle zugeordneten Projekte auf einen gemeinsamen Nutzen aus. Stellen Sie sicher, dass Ihre Ziele:"
      />
    </div>
  );
});

// ============== Roadmap-Tab (Gantt aus Projekten + Projektideen) ==============
//
// Ein Balken pro zugeordnetem Projekt (Termine aus dem Auftrag, Balkenfarbe =
// Ampel des letzten genehmigten Statusberichts, sonst grau) und pro Projektidee
// (immer grau). Projekt-Abhängigkeiten werden hier gepflegt (Finish-to-Start)
// und als Verbindungspfeile im Gantt dargestellt. Aggregat kommt aus
// GET /portfolios/:id/roadmap; Abhängigkeiten werden am Portfolio gespeichert.

const ROADMAP_GREY = theme.colors.textMuted;

function RoadmapLegend() {
  const dot = (bg) => ({
    width: 12, height: 12, borderRadius: theme.borderRadius.full,
    backgroundColor: `${bg}33`, border: `2px solid ${bg}`, flexShrink: 0,
  });
  const entries = [
    [theme.colors.success, 'Status grün'],
    [theme.colors.warning, 'Status gelb'],
    [theme.colors.error, 'Status rot'],
    [ROADMAP_GREY, 'Ohne genehmigten Statusbericht / Projektidee'],
  ];
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', gap: theme.spacing.lg,
      marginTop: theme.spacing.md, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary,
    }}>
      {entries.map(([c, label]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <div style={dot(c)} />
          {label}
        </div>
      ))}
    </div>
  );
}

const RoadmapTab = forwardRef(function RoadmapTab({ portfolio, canEdit, onStateChange, onSaved, navigate }, ref) {
  const { getPortfolioRoadmap, updatePortfolio } = useProjektmanagement();
  const [roadmap, setRoadmap] = useState(null);
  const [deps, setDeps] = useState(portfolio.dependencies || []);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const reload = useCallback(async () => {
    setIsLoading(true); setError(null);
    try { setRoadmap(await getPortfolioRoadmap(portfolio.id)); }
    catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [portfolio.id, getPortfolioRoadmap]);
  useEffect(() => { reload(); }, [reload]);

  const projekte = useMemo(() => roadmap?.projekte || [], [roadmap]);
  const ideen = useMemo(() => roadmap?.ideen || [], [roadmap]);

  // Namen aller Endpunkte (Projekte + Ideen) für Dependency-Tabelle. Ideen mit
  // Suffix „(Idee)" zur Unterscheidung.
  const nameById = useMemo(() => {
    const m = new Map();
    projekte.forEach((p) => m.set(p.id, p.name));
    ideen.forEach((i) => m.set(i.id, `${i.name} (Idee)`));
    return m;
  }, [projekte, ideen]);

  const ganttItems = useMemo(() => {
    const items = [];
    for (const p of projekte) {
      items.push({
        id: `projekt-${p.id}`, refId: p.id, _kind: 'projekt', type: 'task', name: p.name,
        start_date: p.start_date, end_date: p.end_date,
        tracking: p.ampel ? { ampel: p.ampel } : undefined,
        color: p.ampel ? undefined : ROADMAP_GREY,
      });
    }
    for (const i of ideen) {
      items.push({
        id: `idee-${i.id}`, refId: i.id, _kind: 'idee', type: 'task', name: `${i.name} (Idee)`,
        start_date: i.start_date, end_date: i.end_date, color: ROADMAP_GREY,
      });
    }
    return items;
  }, [projekte, ideen]);

  // Gantt-Item-IDs sind mit `projekt-`/`idee-` gewrappt; das Kind ergibt sich aus
  // dem ID-Präfix des Endpunkts (Projekt-IDs `projekt-…`, Ideen-IDs `idee-…`).
  const ganttNodeId = (id) => (id.startsWith('idee-') ? `idee-${id}` : `projekt-${id}`);
  const ganttDeps = useMemo(
    () => deps.map((d) => ({ from: ganttNodeId(d.from), to: ganttNodeId(d.to) })),
    [deps],
  );

  const addDep = () => {
    if (!from || !to || from === to) return;
    if (deps.some((d) => d.from === from && d.to === to)) return;
    setDeps((prev) => [...prev, { from, to }]);
    setFrom(''); setTo('');
    onStateChange?.({ dirty: true, saving: false });
  };
  const removeDep = (idx) => {
    setDeps((prev) => prev.filter((_, i) => i !== idx));
    onStateChange?.({ dirty: true, saving: false });
  };

  const save = async () => {
    onStateChange?.({ dirty: true, saving: true }); setError(null);
    try {
      const updated = await updatePortfolio(portfolio.id, { dependencies: deps }, { expectedVersion: portfolio.version });
      onStateChange?.({ dirty: false, saving: false });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof VersionConflictError
        ? 'Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.'
        : err.message);
      onStateChange?.({ dirty: true, saving: false });
    }
  };
  useImperativeHandle(ref, () => ({ save }));

  const onItemClick = (it) => {
    if (it._kind === 'idee') navigate(`/apps/projektmanagement/ideen/${it.refId}`);
    else navigate(`/apps/projektmanagement/${it.refId}`);
  };

  const sectionTitle = {
    fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text, margin: `${theme.spacing['2xl']} 0 ${theme.spacing.md}`,
  };
  const projName = (id) => nameById.get(id) || '(entfernt)';

  if (isLoading) return <div style={styles.empty}>Lade Roadmap…</div>;

  return (
    <div>
      <TabHeader
        title="Roadmap"
        subtitle="Zeitliche Einordnung aller zugeordneten Projekte und Projektideen inkl. Abhängigkeiten."
      />
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      {ganttItems.length === 0 ? (
        <div style={styles.empty}>
          Noch keine Projekte oder Projektideen zugeordnet. Ordne im Tab „Basis" welche zu — sie erscheinen
          dann hier nach Startdatum.
        </div>
      ) : (
        <>
          <GanttRoadmap items={ganttItems} dependencies={ganttDeps} onItemClick={onItemClick} />
          <RoadmapLegend />
        </>
      )}

      <div style={sectionTitle}>Abhängigkeiten</div>
      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
        Definiere, welches Element einem anderen vorausgeht (Vorgänger → Nachfolger) — Projekte und Projektideen.
        Die Abhängigkeit wird als Pfeil im Gantt dargestellt.
      </div>

      {canEdit && (
        <div style={{ display: 'flex', gap: theme.spacing.md, alignItems: 'center', flexWrap: 'wrap', marginBottom: theme.spacing.lg }}>
          <select style={styles.select} value={from} onChange={(e) => setFrom(e.target.value)}>
            <option value="">Vorgänger…</option>
            {projekte.length > 0 && (
              <optgroup label="Projekte">
                {projekte.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
            {ideen.length > 0 && (
              <optgroup label="Projektideen">
                {ideen.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            )}
          </select>
          <span style={{ color: theme.colors.textMuted }}>→</span>
          <select style={styles.select} value={to} onChange={(e) => setTo(e.target.value)}>
            <option value="">Nachfolger…</option>
            {projekte.length > 0 && (
              <optgroup label="Projekte">
                {projekte.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </optgroup>
            )}
            {ideen.length > 0 && (
              <optgroup label="Projektideen">
                {ideen.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
              </optgroup>
            )}
          </select>
          <button
            type="button"
            style={{ ...styles.actionButton, ...styles.primaryButton, opacity: (!from || !to || from === to) ? 0.5 : 1 }}
            onClick={addDep}
            disabled={!from || !to || from === to}
          >
            + Hinzufügen
          </button>
        </div>
      )}

      {deps.length === 0 ? (
        <div style={styles.empty}>Keine Abhängigkeiten definiert.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Vorgänger</th>
              <th style={styles.th}>Nachfolger</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {deps.map((d, idx) => (
              <tr key={`${d.from}->${d.to}`}>
                <td style={styles.td}>{projName(d.from)}</td>
                <td style={styles.td}>{projName(d.to)}</td>
                <td style={{ ...styles.td, textAlign: 'right' }}>
                  {canEdit && (
                    <button
                      type="button"
                      style={{ ...styles.actionButton, ...styles.deleteButton, padding: `${theme.spacing.xs} ${theme.spacing.md}` }}
                      onClick={() => removeDep(idx)}
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
    </div>
  );
});

// ============== Kosten-Tab (Aggregat: Budget/Ist/Prognose + Termin) ==============
//
// Read-only Übersicht: Summen über alle Projekte + Ideen, gestapelter
// Kostenvergleich (Budget/Ist/Prognose je Projekt) und eine Detailtabelle mit
// Prognose-Termin. Aggregat kommt aus GET /portfolios/:id/costs.

const fmtEUR = (n) => new Intl.NumberFormat('de-DE', {
  style: 'currency', currency: 'EUR', minimumFractionDigits: 0, maximumFractionDigits: 0,
}).format(Number(n) || 0);
const fmtDate = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
};
// Vorzeichen-behafteter Euro-Betrag: „+257.365 €" / „-1.234 €".
const fmtSignedEUR = (n) => {
  const v = Number(n) || 0;
  const s = fmtEUR(Math.abs(v));
  return v > 0 ? `+${s}` : v < 0 ? `-${s}` : s;
};
// △ Kosten: „+257.365 € (+14,0 %)"; ohne Prozent, wenn pct null.
const fmtDeltaKosten = (eur, pct) => {
  const base = fmtSignedEUR(eur);
  if (pct === null || pct === undefined || Number.isNaN(pct)) return base;
  const p = `${pct >= 0 ? '+' : ''}${pct.toFixed(1).replace('.', ',')} %`;
  return `${base} (${p})`;
};
// Farbe: über Budget (Prognose > Budget) = rot, unter Budget = grün, sonst neutral.
const deltaKostenColor = (eur) => {
  const v = Number(eur) || 0;
  return v > 0 ? theme.colors.error : v < 0 ? theme.colors.success : theme.colors.textMuted;
};

function KostenKpi({ label, value, valueColor }) {
  return (
    <div style={{
      backgroundColor: theme.colors.surface, border: `1px solid ${theme.colors.border}`,
      borderRadius: theme.borderRadius.lg, padding: theme.spacing.lg,
    }}>
      <div style={{
        fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted,
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: theme.spacing.xs,
      }}>{label}</div>
      <div style={{ fontSize: theme.typography.sizes.xl, fontWeight: theme.typography.weights.bold, color: valueColor || theme.colors.text }}>
        {value}
      </div>
    </div>
  );
}

function KostenTab({ portfolio, navigate }) {
  const { getPortfolioCosts } = useProjektmanagement();
  const [costs, setCosts] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setIsLoading(true); setError(null);
    try { setCosts(await getPortfolioCosts(portfolio.id)); }
    catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [portfolio.id, getPortfolioCosts]);
  useEffect(() => { reload(); }, [reload]);

  const projekte = useMemo(() => costs?.projekte || [], [costs]);
  const ideen = useMemo(() => costs?.ideen || [], [costs]);
  const summary = costs?.summary || {
    budget: 0, plan: 0, ist: 0, forecast: 0, ist_plus_forecast: 0,
    prognose_budget: 0, delta_kosten: 0, delta_kosten_pct: null, ideen_investitionen: 0,
  };

  const chartProjekte = useMemo(() => projekte.map((p) => ({
    id: p.id, name: p.name,
    values: {
      budget: p.budget, plan: p.plan,
      ist_plus_forecast: p.ist_plus_forecast, prognose_budget: p.prognose_budget,
    },
  })), [projekte]);
  const metrics = [
    { key: 'budget', label: 'Budget' },
    { key: 'plan', label: 'Plan' },
    { key: 'ist_plus_forecast', label: 'Ist + Forecast' },
    { key: 'prognose_budget', label: 'Kosten-Prognose' },
  ];

  const sectionTitle = {
    fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text, margin: `${theme.spacing['2xl']} 0 ${theme.spacing.md}`,
  };
  const thRight = { ...styles.th, textAlign: 'right' };
  const tdRight = { ...styles.td, textAlign: 'right' };

  if (isLoading) return <div style={styles.empty}>Lade Kosten…</div>;

  const hasAny = projekte.length > 0 || ideen.length > 0;

  return (
    <div>
      <TabHeader
        title="Kosten"
        subtitle="Aggregierte Kosten und Termin-Prognosen aller zugeordneten Projekte und Projektideen."
      />
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      {!hasAny ? (
        <div style={styles.empty}>
          Noch keine Projekte oder Projektideen zugeordnet. Ordne im Tab „Basis" welche zu — ihre Kosten
          erscheinen dann hier.
        </div>
      ) : (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: theme.spacing.lg, marginBottom: theme.spacing.xl,
          }}>
            <KostenKpi label="Budget (Projekte)" value={fmtEUR(summary.budget)} />
            <KostenKpi label="Plan (Projekte)" value={fmtEUR(summary.plan)} />
            <KostenKpi label="Ist + Forecast (Projekte)" value={fmtEUR(summary.ist_plus_forecast)} />
            <KostenKpi label="Kosten-Prognose (Projekte)" value={fmtEUR(summary.prognose_budget)} />
            <KostenKpi
              label="△ Kosten (Projekte)"
              value={fmtDeltaKosten(summary.delta_kosten, summary.delta_kosten_pct)}
              valueColor={deltaKostenColor(summary.delta_kosten)}
            />
            <KostenKpi label="Ideen (Investitionsschätzung)" value={fmtEUR(summary.ideen_investitionen)} />
          </div>

          {projekte.length > 0 && (
            <>
              <div style={sectionTitle}>Kostenvergleich (Summe je Kennzahl, gestapelt nach Projekt)</div>
              <PortfolioCostChart projekte={chartProjekte} metrics={metrics} formatValue={fmtEUR} />

              <div style={sectionTitle}>Projekte</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Projekt</th>
                      <th style={thRight}>Budget</th>
                      <th style={thRight}>Plan</th>
                      <th style={thRight}>Ist</th>
                      <th style={thRight}>Forecast</th>
                      <th style={thRight}>Ist + Forecast</th>
                      <th style={thRight}>Kosten-Prognose</th>
                      <th style={thRight}>△ Kosten</th>
                      <th style={styles.th}>Termin-Ende (PA)</th>
                      <th style={styles.th}>Termin-Prognose</th>
                      <th style={thRight}>△ Tage</th>
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
                        <td style={tdRight}>{fmtEUR(p.budget)}</td>
                        <td style={tdRight}>{fmtEUR(p.plan)}</td>
                        <td style={tdRight}>{fmtEUR(p.ist)}</td>
                        <td style={tdRight}>{fmtEUR(p.forecast)}</td>
                        <td style={tdRight}>{fmtEUR(p.ist_plus_forecast)}</td>
                        <td style={tdRight}>
                          {fmtEUR(p.prognose_budget)}
                          {!p.hat_prognose && (
                            <span style={{ color: theme.colors.textMuted }} title="Keine Ist-/Fortschrittsdaten — Budget angenommen"> *</span>
                          )}
                        </td>
                        <td style={{ ...tdRight, color: deltaKostenColor(p.delta_kosten) }}>
                          {fmtDeltaKosten(p.delta_kosten, p.delta_kosten_pct)}
                        </td>
                        <td style={styles.td}>{fmtDate(p.plan_ende)}</td>
                        <td style={styles.td}>{fmtDate(p.prognose_ende)}</td>
                        <td style={{
                          ...tdRight,
                          color: (p.termin_abweichung_tage ?? 0) > 0 ? theme.colors.error : theme.colors.textMuted,
                        }}>
                          {p.termin_abweichung_tage != null
                            ? (p.termin_abweichung_tage > 0 ? `+${p.termin_abweichung_tage}` : p.termin_abweichung_tage)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ ...styles.td, fontWeight: theme.typography.weights.semibold }}>Summe</td>
                      <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold }}>{fmtEUR(summary.budget)}</td>
                      <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold }}>{fmtEUR(summary.plan)}</td>
                      <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold }}>{fmtEUR(summary.ist)}</td>
                      <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold }}>{fmtEUR(summary.forecast)}</td>
                      <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold }}>{fmtEUR(summary.ist_plus_forecast)}</td>
                      <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold }}>{fmtEUR(summary.prognose_budget)}</td>
                      <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold, color: deltaKostenColor(summary.delta_kosten) }}>
                        {fmtDeltaKosten(summary.delta_kosten, summary.delta_kosten_pct)}
                      </td>
                      <td style={styles.td} />
                      <td style={styles.td} />
                      <td style={styles.td} />
                    </tr>
                  </tbody>
                </table>
              </div>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
                Werte stammen aus dem letzten genehmigten Statusbericht je Projekt. <b>Budget</b> = genehmigtes
                Gesamtbudget · <b>Plan</b> = Summe der Plan-Monate · <b>Ist + Forecast</b> = verbrauchtes Budget plus
                Forecast der Zukunftsmonate · <b>Kosten-Prognose</b> = EAC (Budget ÷ CPI) · <b>△ Kosten</b> =
                Kosten-Prognose − Budget · <b>Termin-Prognose</b> via SPI. „*" = kein Ist/Fortschritt vorhanden,
                Budget angenommen.
              </div>
            </>
          )}

          {ideen.length > 0 && (
            <>
              <div style={sectionTitle}>Projektideen (Investitionsschätzung)</div>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Projektidee</th>
                    <th style={thRight}>Investition (geschätzt)</th>
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
                      <td style={tdRight}>{fmtEUR(i.investitionen)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td style={{ ...styles.td, fontWeight: theme.typography.weights.semibold }}>Summe</td>
                    <td style={{ ...tdRight, fontWeight: theme.typography.weights.semibold }}>{fmtEUR(summary.ideen_investitionen)}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.sm }}>
                Projektideen tragen nur eine grobe Investitionsschätzung (Business Case) — kein Ist/Prognose.
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ============== Risiken-Tab (Aggregat + Dashboard-Tracking-Markierung) ==============
//
// Aggregiert alle Risiken aus dem letzten genehmigten Statusbericht der
// zugeordneten Projekte (GET /portfolios/:id/risks). Pro Risiko kann markiert
// werden, ob es später im PMO-Dashboard verfolgt wird — gespeichert als
// portfolio.tracked_risks (Marker-Keys). Savable Tab (Header-Speichern).

const AMPEL_DOT = { gruen: theme.colors.success, gelb: theme.colors.warning, rot: theme.colors.error };

const RisikenTab = forwardRef(function RisikenTab({ portfolio, canEdit, onStateChange, onSaved, navigate }, ref) {
  const { getPortfolioRisks, updatePortfolio } = useProjektmanagement();
  const [risiken, setRisiken] = useState([]);
  const [tracked, setTracked] = useState(() => new Set(portfolio.tracked_risks || []));
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setIsLoading(true); setError(null);
    try { const r = await getPortfolioRisks(portfolio.id); setRisiken(r?.risiken || []); }
    catch (err) { setError(err.message); }
    finally { setIsLoading(false); }
  }, [portfolio.id, getPortfolioRisks]);
  useEffect(() => { reload(); }, [reload]);

  const toggle = (key) => {
    setTracked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
    onStateChange?.({ dirty: true, saving: false });
  };

  const save = async () => {
    onStateChange?.({ dirty: true, saving: true }); setError(null);
    try {
      const updated = await updatePortfolio(portfolio.id, { tracked_risks: [...tracked] }, { expectedVersion: portfolio.version });
      onStateChange?.({ dirty: false, saving: false });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof VersionConflictError
        ? 'Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.'
        : err.message);
      onStateChange?.({ dirty: true, saving: false });
    }
  };
  useImperativeHandle(ref, () => ({ save }));

  const scoreColor = (s) => (s >= 6 ? theme.colors.error : s >= 3 ? theme.colors.warning : theme.colors.textMuted);
  const thCenter = { ...styles.th, textAlign: 'center' };
  const tdCenter = { ...styles.td, textAlign: 'center' };

  if (isLoading) return <div style={styles.empty}>Lade Risiken…</div>;

  return (
    <div>
      <TabHeader
        title="Risiken"
        subtitle={<>Risiken aus dem letzten genehmigten Statusbericht aller zugeordneten Projekte. Markiere per Häkchen,
          welche Risiken später im PMO-Dashboard verfolgt werden sollen — {tracked.size} markiert.</>}
      />
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      {risiken.length === 0 ? (
        <div style={styles.empty}>Keine Risiken in den Statusberichten der zugeordneten Projekte.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={thCenter} title="Im Dashboard tracken">Track</th>
              <th style={styles.th}>Projekt</th>
              <th style={styles.th}>Typ</th>
              <th style={styles.th}>Risiko</th>
              <th style={thCenter}>W</th>
              <th style={thCenter}>A</th>
              <th style={thCenter}>Score</th>
              <th style={thCenter}>Ampel</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Verantwortlich</th>
            </tr>
          </thead>
          <tbody>
            {risiken.map((r) => (
              <tr key={r.key}>
                <td style={tdCenter}>
                  <input type="checkbox" checked={tracked.has(r.key)} disabled={!canEdit} onChange={() => toggle(r.key)} />
                </td>
                <td style={styles.td}>
                  <button type="button" style={styles.linkLike} onClick={() => navigate(`/apps/projektmanagement/${r.projekt_id}`)}>
                    {r.projekt_name}
                  </button>
                </td>
                <td style={styles.td}>{r.type === 'chance' ? 'Chance' : 'Bedrohung'}</td>
                <td style={styles.td}>{r.beschreibung || r.auswirkung || '—'}</td>
                <td style={tdCenter}>{r.wahrscheinlichkeit || '—'}</td>
                <td style={tdCenter}>{r.auswirkung_bewertung || '—'}</td>
                <td style={{ ...tdCenter, color: scoreColor(r.score), fontWeight: theme.typography.weights.semibold }}>
                  {r.score || '—'}
                </td>
                <td style={tdCenter}>
                  {r.ampel
                    ? <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: theme.borderRadius.full, backgroundColor: AMPEL_DOT[r.ampel] || theme.colors.textMuted }} />
                    : '—'}
                </td>
                <td style={styles.td}>{r.status || '—'}</td>
                <td style={styles.td}>{r.verantwortlich || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
});

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

const BasisTab = forwardRef(function BasisTab({ portfolio, appConfig, canEdit, canDelete, onStateChange, onSaved, onDeleted, onCountChange, navigate }, ref) {
  const {
    updatePortfolio, deletePortfolio,
    getPortfolioProjekte, getAvailableProjekteForPortfolio, updateProjekt,
    getPortfolioIdeen, getAvailableIdeenForPortfolio, assignIdeeToPortfolio, unassignIdeeFromPortfolio,
  } = useProjektmanagement();

  const initForm = () => ({
    portfolio_id: portfolio.portfolio_id || '',
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
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const set = (k, v) => {
    setForm((f) => ({ ...f, [k]: v }));
    onStateChange?.({ dirty: true, saving: false });
  };
  const opts = (key) => appConfig?.[key] || [];

  const save = async () => {
    if (!form.name.trim()) { setError('Name ist erforderlich.'); return; }
    onStateChange?.({ dirty: true, saving: true }); setError(null);
    try {
      const updated = await updatePortfolio(portfolio.id, {
        portfolio_id: form.portfolio_id.trim() || undefined,
        name: form.name.trim(),
        status: form.status,
        type: form.type || undefined,
        driver: form.driver || undefined,
        description: form.description.trim() || null,
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
      }, { expectedVersion: portfolio.version });
      onStateChange?.({ dirty: false, saving: false });
      onSaved(updated);
    } catch (err) {
      setError(err instanceof VersionConflictError
        ? 'Das Portfolio wurde von jemand anderem geändert. Bitte neu laden.'
        : err.message);
      onStateChange?.({ dirty: true, saving: false });
    }
  };
  useImperativeHandle(ref, () => ({ save }));

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
      <TabHeader
        title="Basis"
        subtitle="Stammdaten des Portfolios sowie zugeordnete Projekte und Projektideen."
      />
      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Portfolio-ID</label>
          <input
            style={styles.input}
            value={form.portfolio_id}
            onChange={(e) => set('portfolio_id', e.target.value)}
            placeholder="z.B. PF-2026-001"
            readOnly={!canEdit}
          />
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
});

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

// Icons (lokal, konsistent mit WizardPage)
function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}
