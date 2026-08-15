/**
 * WizardPage
 * 9-Step Wizard for creating/editing Projektaufträge
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useProjektmanagement, VersionConflictError } from '../../hooks/useProjektmanagement';
import ProjektUebersichtPanel from './components/ProjektUebersichtPanel';
import LessonsLearnedView from './components/LessonsLearnedView';
import AbschlussberichtView from './components/AbschlussberichtView';
import { usePmResourcePermission, hasMinRole } from '../../hooks/usePmResourcePermission';
import { useAppPermission } from '../../components/RequireAppPermission';
import RoleBadge from '../../components/RoleBadge';
import ReadOnlyBanner from '../../components/ReadOnlyBanner';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import OwnerActionsMenu from './components/OwnerActionsMenu';
import PermissionsModal from './components/PermissionsModal';
import ConfirmModal from '../../components/ConfirmModal';
import { API_URL } from '../../utils/apiFetch';

// Step components
import Basis from './components/steps/Basis';
import Personen from './components/steps/Personen';
import Ziele from './components/steps/Ziele';
import Inhalt from './components/steps/Inhalt';
import Roadmap from './components/steps/Roadmap';
import Budget from './components/steps/Budget';
import Risiken from './components/steps/Risiken';
import Uebersicht from './components/steps/Uebersicht';
import Vergleich from './components/steps/Vergleich';
import KnowledgePanel from './components/KnowledgePanel';
import StepNav from './components/StepNav';
import StepImportButton from './components/StepImportButton';
import ExportDropdown from '../../components/ExportDropdown';
// Statusbericht components
import StatusberichtBlade from './components/StatusberichtBlade';
import StatusberichtBasis from './components/statusbericht/StatusberichtBasis';
import StatusberichtZiele from './components/statusbericht/StatusberichtZiele';
import StatusberichtRoadmap from './components/statusbericht/StatusberichtRoadmap';
import StatusberichtKosten from './components/statusbericht/StatusberichtKosten';
import StatusberichtRisiken from './components/statusbericht/StatusberichtRisiken';
import StatusberichtPersonen from './components/statusbericht/StatusberichtPersonen';

const STEPS = [
  { number: 1, title: 'Basis', component: Basis },
  { number: 2, title: 'Personen', component: Personen },
  { number: 3, title: 'Ziele', component: Ziele },
  { number: 4, title: 'Inhalt', component: Inhalt },
  { number: 5, title: 'Roadmap', component: Roadmap },
  { number: 6, title: 'Kosten', component: Budget },
  { number: 7, title: 'Risiken', component: Risiken },
  { number: 8, title: 'Übersicht', component: Uebersicht },
  { number: 9, title: 'Vergleich', component: Vergleich },
];

// Statusbericht-Sub-Nav (id = sbTab-State, number = Anzeige in StepNav).
const SB_STEPS = [
  { number: 1, title: 'Basis', id: 'basis' },
  { number: 2, title: 'Ziele', id: 'ziele' },
  { number: 3, title: 'Roadmap', id: 'roadmap' },
  { number: 4, title: 'Kosten', id: 'kosten' },
  { number: 5, title: 'Risiken', id: 'risiken' },
  { number: 6, title: 'Personen', id: 'personen' },
];

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background,
  },
  // App Detail Header (Standard-Pattern)
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statusBadge: {
    fontSize: theme.typography.sizes.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
  },
  statusDraft: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  statusActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  statusCompleted: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  actionButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  primaryButton: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
  },
  deleteButton: {
    color: theme.colors.error,
    borderColor: `${theme.colors.error}30`,
  },
  // Step-Tab-Styles leben jetzt in StepNav (components/StepNav.jsx).
  main: {
    flex: 1,
    display: 'flex',
    // kein overflow:hidden — würde das sticky-Verhalten des Slates brechen;
    // die Seite scrollt natürlich weiter (wie vor dem Chat).
  },
  // Main content area
  content: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.xl,
  },
  stepContent: {
    maxWidth: '720px',
  },
  // Right sidebar - Knowledge panel. Sticky: bleibt beim Scrollen im Viewport,
  // während die Seite (Formular) darunter natürlich weiterscrollt. Feste Höhe =
  // Viewport minus Header (oben) und ein Stück Luft (unten) — so ist die
  // Chat-Eingabe immer sichtbar, ohne das restliche Layout zu verändern.
  rightSidebar: {
    width: '400px',
    minWidth: '400px',
    borderLeft: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    display: 'flex',
    flexDirection: 'column',
    position: 'sticky',
    top: theme.layout.headerHeight,
    alignSelf: 'flex-start',
    height: `calc(100vh - ${theme.layout.headerHeight} - ${theme.spacing.xl})`,
    overflow: 'hidden',
  },
  // Navigation (Rounded Box)
  navigation: {
    margin: `${theme.spacing.lg} ${theme.spacing['2xl']}`,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.lg,
  },
  navButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  navButtonPrev: {
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
  },
  navButtonNext: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
  },
  navButtonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textMuted,
  },
  // Top-Level Tab-Bar (Phase B) — Pill-Style analog ToolsPage.jsx
  topTabBar: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  topTab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  topTabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  completionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  completionBar: {
    width: '120px',
    height: '6px',
    backgroundColor: theme.colors.border,
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    backgroundColor: theme.colors.primary,
    borderRadius: theme.borderRadius.full,
    transition: 'width 0.3s ease',
  },
};

// Default empty Projektauftrag
const emptyProjektauftrag = {
  name: '',
  project_type: 'internal',
  start_date: '',
  end_date: '',
  projektleiter: '',
  auftraggeber: '',
  description: '',
  goals: '',
  criteria: [],
  scope: '',
  in_scope: [],
  out_scope: [],
  tasks: [],
  milestones: [],
  budget: [],
  risks: [],
  organization: [],
  stakeholders: [],
  status: 'draft',
  current_step: 1,
};

function WizardPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const {
    createProjektauftrag,
    getProjektauftrag,
    getProjekt,
    updateProjekt,
    updateProjektauftrag,
    updateStep,
    deleteProjektauftrag,
    getConfig,
    getStatusberichte,
    createStatusbericht,
    updateStatusbericht: updateSbApi,
    deleteStatusbericht: deleteSbApi,
    getAbschlussbericht,
  } = useProjektmanagement();

  // Phase-2: Effektive Auftrags-Rolle des aktuellen Users. Bei "neu" (ohne id)
  // wird der Wizard immer voll editierbar gerendert — der Backend-POST prueft
  // die App-Editor+ Berechtigung. Bei "bearbeiten" gilt die Auftrags-Rolle.
  const { role: auftragRole } = usePmResourcePermission('auftrag', id);
  const { role: appRole } = useAppPermission();
  const canEdit = id ? hasMinRole(auftragRole, 'editor') : (appRole === 'owner' || appRole === 'editor');
  const canDelete = id && auftragRole === 'owner';
  const canManagePermissions = canDelete; // Same: nur Owner

  const [projektauftrag, setProjektauftrag] = useState(emptyProjektauftrag);
  const [appConfig, setAppConfig] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [completeness, setCompleteness] = useState(0);
  const [isNewProject, setIsNewProject] = useState(!id);
  const [isDirty, setIsDirty] = useState(false);
  // Phase-2: Permissions-Modal-State
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  // ConfirmModal: { title, message, confirmLabel, onConfirm }
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [isConfirming, setIsConfirming] = useState(false);
  // Optimistic-Concurrency state.
  const [serverVersion, setServerVersion] = useState(null);
  const [conflict, setConflict] = useState(null);
  // Step analyses state (shared between KnowledgePanel and Step8)
  const [stepAnalyses, setStepAnalyses] = useState({});

  // Ephemerer Chat-Verlauf pro Step (Wissenspool-Chat im rechten Slate).
  // Bewusst NICHT persistiert — lebt nur solange der Wizard offen ist.
  const [chatHistories, setChatHistories] = useState({});
  // Gesamtbewertung state (for Step8)
  const [gesamtbewertung, setGesamtbewertung] = useState(null);
  // Phase B: Top-Level-Tab-State. URL-synced via ?tab=. Werte: uebersicht | auftrag | statusberichte.
  // Default fuer bestehende Projekte: 'uebersicht' (sauberer Lifecycle-Einstieg).
  // Default fuer "neu" (kein id): 'auftrag' (Uebersicht haette keinen Inhalt).
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = (() => {
    const fromUrl = searchParams.get('tab');
    if (
      fromUrl === 'uebersicht'
      || fromUrl === 'auftrag'
      || fromUrl === 'statusberichte'
      || fromUrl === 'lessons'
      || fromUrl === 'abschluss'
    ) return fromUrl;
    return id ? 'uebersicht' : 'auftrag';
  })();
  const [mode, setMode] = useState(initialMode);
  const [projekt, setProjekt] = useState(null); // paProjekte-Row (Lifecycle etc.)
  const [abschlussbericht, setAbschlussbericht] = useState(null); // fuer Uebersicht-Karte
  const [statusberichte, setStatusberichte] = useState([]);
  // Statusbericht-Auswahl wird via URL `?sb=<id>` synchronisiert — damit
  // Browser-Back + Bookmark + Tab-Wechsel die Auswahl behalten.
  const [selectedSbId, setSelectedSbId] = useState(() => searchParams.get('sb'));
  const [currentSb, setCurrentSb] = useState(null);
  const [sbTab, setSbTab] = useState('basis');
  const [isSbDirty, setIsSbDirty] = useState(false);
  const [isSbCreating, setIsSbCreating] = useState(false);
  const [isSbSaving, setIsSbSaving] = useState(false);
  const [isSbExporting, setIsSbExporting] = useState(false);
  const [sbExportingFormat, setSbExportingFormat] = useState(null);

  // Load config
  useEffect(() => {
    getConfig().then(setAppConfig).catch(console.error);
  }, [getConfig]);

  // Load existing Projektauftrag
  useEffect(() => {
    if (id) {
      loadProjektauftrag();
    }
  }, [id]);

  // Phase A/B: parallele Projekt-Entity laden. Best-effort — fehlt sie (Auftrag
  // wurde noch nicht migriert), bleibt projekt=null und Header zeigt fallback.
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getProjekt(id).then((p) => {
      if (!cancelled) setProjekt(p);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, getProjekt]);

  // Phase F: Abschlussbericht-Stand fuers Uebersicht-Panel laden (best-effort).
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    getAbschlussbericht(id).then((a) => {
      if (!cancelled) setAbschlussbericht(a);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [id, getAbschlussbericht, mode]);

  // Tab-State <-> URL-Sync. Setze ?tab=... beim Wechsel, lese beim Mount.
  // Beim Verlassen des SB-Tabs raeumen wir `?sb=...` aus der URL — der
  // Parameter macht nur im SB-Kontext Sinn.
  const setModeAndUrl = useCallback((next) => {
    setMode(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      params.set('tab', next);
      if (next !== 'statusberichte') params.delete('sb');
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  // selectedSbId <-> URL-Sync. Beim setSelectedSbId schreiben wir `?sb=<id>`
  // mit; bei null wird der Parameter entfernt.
  const setSelectedSbIdAndUrl = useCallback((next) => {
    setSelectedSbId(next);
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev);
      if (next) params.set('sb', next);
      else params.delete('sb');
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  const loadProjektauftrag = async () => {
    try {
      setIsLoading(true);
      const data = await getProjektauftrag(id);
      setProjektauftrag(data.projektauftrag);
      setServerVersion(data.projektauftrag.version ?? 1);
      setCurrentStep(data.projektauftrag.current_step || 1);
      setCompleteness(data.completeness || 0);
      setIsNewProject(false);
      // Restore saved step analyses
      if (data.projektauftrag.stepAnalyses) {
        setStepAnalyses(data.projektauftrag.stepAnalyses);
      }
      // Restore saved Gesamtbewertung
      if (data.projektauftrag.gesamtbewertung) {
        setGesamtbewertung(data.projektauftrag.gesamtbewertung);
      }
    } catch (error) {
      console.error('Error loading Projektauftrag:', error);
      navigate('/apps/projektmanagement');
    } finally {
      setIsLoading(false);
    }
  };

  // ============== Statusbericht Functions ==============

  // Load statusberichte when project is loaded and has an id
  useEffect(() => {
    if (projektauftrag.id) {
      loadStatusberichte(projektauftrag.id);
    }
  }, [projektauftrag.id]);

  const loadStatusberichte = async (projektId) => {
    try {
      const berichte = await getStatusberichte(projektId);
      setStatusberichte(berichte);
    } catch (err) {
      console.error('Error loading Statusberichte:', err);
    }
  };

  // Select a statusbericht
  useEffect(() => {
    if (selectedSbId && projektauftrag.id) {
      const found = statusberichte.find((sb) => sb.id === selectedSbId);
      if (found) {
        setCurrentSb({ ...found });
      }
    } else {
      setCurrentSb(null);
    }
  }, [selectedSbId, statusberichte]);

  const handleCreateSb = async () => {
    if (!projektauftrag.id) return;
    try {
      setIsSbCreating(true);
      const sb = await createStatusbericht(projektauftrag.id);
      await loadStatusberichte(projektauftrag.id);
      setSelectedSbIdAndUrl(sb.id);
      setSbTab('basis');
    } catch (err) {
      console.error('Error creating Statusbericht:', err);
    } finally {
      setIsSbCreating(false);
    }
  };

  const handleSbChange = (updates) => {
    setCurrentSb((prev) => ({ ...prev, ...updates }));
    setIsSbDirty(true);
  };

  const handleSaveSb = async ({ force = false } = {}) => {
    if (!currentSb || !projektauftrag.id) return;
    try {
      setIsSbSaving(true);
      const updated = await updateSbApi(projektauftrag.id, currentSb.id, currentSb, {
        expectedVersion: currentSb.version,
        force,
      });
      // updated kann null sein bei 404 — sonst neue Version uebernehmen.
      if (updated) setCurrentSb(updated);
      await loadStatusberichte(projektauftrag.id);
      setIsSbDirty(false);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setConflict({ current: err.current, kind: 'sb' });
        return;
      }
      console.error('Error saving Statusbericht:', err);
    } finally {
      setIsSbSaving(false);
    }
  };

  const handleDeleteSb = () => {
    if (!currentSb || !projektauftrag.id) return;
    setConfirmDialog({
      title: 'Statusbericht löschen?',
      message: `Statusbericht #${currentSb.nummer} wird unwiderruflich gelöscht.`,
      confirmLabel: 'Löschen',
      onConfirm: async () => {
        try {
          await deleteSbApi(projektauftrag.id, currentSb.id);
          setSelectedSbIdAndUrl(null);
          setCurrentSb(null);
          await loadStatusberichte(projektauftrag.id);
        } catch (err) {
          console.error('Error deleting Statusbericht:', err);
          alert(err.message);
        }
      },
    });
  };

  // Export Statusbericht
  const handleSbExport = async (format) => {
    if (!projektauftrag.id || !currentSb?.id) return;

    try {
      setIsSbExporting(true);
      setSbExportingFormat(format);

      const response = await fetch(
        `${API_URL}/apps/projektmanagement/projektauftraege/${projektauftrag.id}/statusberichte/${currentSb.id}/export/${format}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Export fehlgeschlagen');
      }

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Statusbericht_${currentSb.nummer}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('SB Export error:', error);
      alert('Export fehlgeschlagen. Bitte versuchen Sie es erneut.');
    } finally {
      setIsSbExporting(false);
      setSbExportingFormat(null);
    }
  };

  // Show mode toggle if project is active or has statusberichte
  // Phase B: keine Conditional-Logic mehr — Tabs sind immer sichtbar.
  // showModeToggle entfernt; siehe ProjektUebersichtPanel + Top-Tab-Bar.

  // Calculate completeness locally
  const calculateCompleteness = useCallback((data) => {
    const checks = [
      !!data.name,
      !!data.projektleiter,
      !!data.auftraggeber,
      !!data.start_date,
      !!data.goals,
      data.criteria?.length > 0,
      !!data.scope,
      data.tasks?.length > 0,
      data.milestones?.length > 0,
      data.budget?.length > 0,
      data.risks?.length > 0,
      data.organization?.length > 0,
    ];
    const completed = checks.filter(Boolean).length;
    return Math.round((completed / checks.length) * 100);
  }, []);

  // Update local state
  const updateLocalState = useCallback((updates) => {
    setProjektauftrag((prev) => {
      const updated = { ...prev, ...updates };
      setCompleteness(calculateCompleteness(updated));
      return updated;
    });
    setIsDirty(true);
  }, [calculateCompleteness]);

  // Additiver Merge eines Step-Imports in den Live-State:
  // Array-Felder werden ANGEHÄNGT (rein additiv), Skalar-Felder nur gesetzt,
  // wenn sie aktuell leer sind. Gibt eine Kurz-Zusammenfassung zurück.
  const STEP_IMPORT_ARRAY_LABELS = {
    criteria: 'Kriterien', in_scope: 'In-Scope', out_scope: 'Out-Scope',
    tasks: 'Aufgaben', milestones: 'Meilensteine', quality_gates: 'Quality Gates',
    budget: 'Budgetposten', risks: 'Risiken', organization: 'Teammitglieder',
    stakeholders: 'Stakeholder',
  };
  const mergeStepImport = (extracted) => {
    if (!extracted || typeof extracted !== 'object') return 'Keine Daten gefunden';
    const updates = {};
    const parts = [];
    let scalarCount = 0;
    for (const [key, val] of Object.entries(extracted)) {
      if (val === undefined || val === null) continue;
      if (key in STEP_IMPORT_ARRAY_LABELS) {
        if (Array.isArray(val) && val.length > 0) {
          updates[key] = [...(projektauftrag[key] || []), ...val];
          parts.push(`${val.length} ${STEP_IMPORT_ARRAY_LABELS[key]}`);
        }
      } else {
        // Skalar: nur füllen, wenn aktuell leer
        const cur = projektauftrag[key];
        if ((cur === undefined || cur === null || cur === '') && val !== '') {
          updates[key] = val;
          scalarCount += 1;
        }
      }
    }
    if (scalarCount > 0) parts.push(`${scalarCount} Feld(er)`);
    if (Object.keys(updates).length > 0) updateLocalState(updates);
    return parts.length > 0 ? `${parts.join(', ')} ergänzt` : 'Keine neuen Daten gefunden';
  };

  // Save current step
  const saveStep = async ({ force = false } = {}) => {
    try {
      setIsSaving(true);

      // Include step analyses and Gesamtbewertung in the data to save
      const dataToSave = {
        ...projektauftrag,
        current_step: currentStep,
        stepAnalyses: Object.keys(stepAnalyses).length > 0 ? stepAnalyses : undefined,
        gesamtbewertung: gesamtbewertung || undefined,
      };

      if (isNewProject) {
        // Create new Projektauftrag
        const created = await createProjektauftrag(dataToSave);
        setProjektauftrag(created);
        setServerVersion(created.version ?? null);
        setIsNewProject(false);
        // Update URL without reload
        window.history.replaceState(null, '', `/apps/projektmanagement/${created.id}`);
      } else {
        // Update existing
        const result = await updateStep(projektauftrag.id, currentStep, dataToSave, {
          expectedVersion: serverVersion ?? undefined,
          force,
        });
        setProjektauftrag(result.projektauftrag);
        setServerVersion(result.projektauftrag.version ?? null);
        setCompleteness(result.completeness || 0);
      }
      setIsDirty(false);
    } catch (error) {
      if (error instanceof VersionConflictError) {
        setConflict({ current: error.current });
        return;
      }
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleConflictReload = () => {
    if (!conflict) return;
    if (conflict.kind === 'sb') {
      setCurrentSb(conflict.current);
      setIsSbDirty(false);
    } else {
      setProjektauftrag(conflict.current);
      setServerVersion(conflict.current.version ?? null);
      setIsDirty(false);
    }
    setConflict(null);
  };
  const handleConflictForce = async () => {
    const kind = conflict?.kind;
    setConflict(null);
    if (kind === 'sb') {
      await handleSaveSb({ force: true });
    } else {
      await saveStep({ force: true });
    }
  };
  const handleConflictCancel = () => {
    setConflict(null);
  };

  // Navigation
  const goToStep = (step) => {
    if (step >= 1 && step <= 9) {
      setCurrentStep(step);
    }
  };

  const goNext = async () => {
    await saveStep();
    if (currentStep < 9) {
      setCurrentStep(currentStep + 1);
    }
  };

  const goPrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Export project
  const handleExport = async (format) => {
    if (!projektauftrag.id) {
      alert('Bitte speichern Sie den Projektauftrag zuerst.');
      return;
    }

    try {
      setIsExporting(true);
      setExportingFormat(format);

      const response = await fetch(
        `${API_URL}/apps/projektmanagement/projektauftraege/${projektauftrag.id}/export/${format}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Export fehlgeschlagen');
      }

      // Get filename from Content-Disposition header or generate default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `${projektauftrag.name || 'projektauftrag'}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export fehlgeschlagen. Bitte versuchen Sie es erneut.');
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  // Delete project
  const handleDelete = () => {
    if (!projektauftrag.id) {
      navigate('/apps/projektmanagement');
      return;
    }
    setConfirmDialog({
      title: 'Projektauftrag löschen?',
      message: `„${projektauftrag.name || 'Unbenannt'}" wird inkl. aller Statusberichte, Lessons Learned und Abschlussbericht unwiderruflich gelöscht.`,
      confirmLabel: 'Löschen',
      onConfirm: async () => {
        try {
          await deleteProjektauftrag(projektauftrag.id);
          navigate('/apps/projektmanagement');
        } catch (error) {
          console.error('Error deleting:', error);
        }
      },
    });
  };

  // Render current step component
  const renderStepContent = () => {
    const StepComponent = STEPS[currentStep - 1]?.component;
    if (!StepComponent) return null;

    // Pass stepAnalyses and gesamtbewertung to Step8Uebersicht
    const extraProps = currentStep === 8 ? {
      stepAnalyses,
      gesamtbewertung,
      onGesamtbewertungComplete: setGesamtbewertung,
    } : currentStep === 2 ? {
      // Personen im Projektauftrag: Kapazitaetsplanung-Panel je Teammitglied.
      showKapazitaet: true,
    } : {};

    return (
      <StepComponent
        data={projektauftrag}
        onChange={updateLocalState}
        onSave={saveStep}
        config={appConfig}
        {...extraProps}
      />
    );
  };

  // Get step status
  // Rein inhaltsbasiert: grün nur bei tatsächlich vorhandenen Daten (kein
  // positionsbasiertes "Schein-Grün" für bereits passierte Schritte).
  const getStepStatus = (stepNumber) => {
    if (stepNumber === currentStep) return 'active';
    if (isStepCompleted(stepNumber)) return 'completed';
    return 'default';
  };

  const isStepCompleted = (stepNumber) => {
    switch (stepNumber) {
      case 1:
        return !!projektauftrag.name && !!projektauftrag.projektleiter;
      case 2:
        return projektauftrag.organization?.length > 0;
      case 3:
        return !!projektauftrag.goals && projektauftrag.criteria?.length > 0;
      case 4:
        return !!projektauftrag.scope;
      case 5:
        return projektauftrag.milestones?.length > 0 || projektauftrag.tasks?.length > 0;
      case 6:
        return projektauftrag.budget?.length > 0;
      case 7:
        return projektauftrag.risks?.length > 0;
      case 8: // Übersicht: kein eigener Inhalt -> erledigt, wenn alle Schritte davor erledigt
        return [1, 2, 3, 4, 5, 6, 7].every((n) => isStepCompleted(n));
      default: // 9 Vergleich: Analyse-Tool, kein Vollständigkeits-Trigger
        return false;
    }
  };

  // Statusbericht-Sub-Nav: gleiche inhaltsbasierte Logik wie der Projektauftrag.
  const isSbStepCompleted = (stepNumber) => {
    if (!currentSb) return false;
    switch (stepNumber) {
      case 1: // Basis
        return !!currentSb.ampel && !!currentSb.datum && !!currentSb.management_summary;
      case 2: // Ziele
        return currentSb.criteria_tracking?.length > 0
          || (currentSb.goals_tracking?.fortschritt ?? -1) >= 0;
      case 3: // Roadmap
        return currentSb.milestones_tracking?.length > 0
          || currentSb.tasks_tracking?.length > 0
          || currentSb.quality_gates_tracking?.length > 0;
      case 4: // Kosten
        return currentSb.cost_budget > 0 || currentSb.cost_months?.length > 0;
      case 5: // Risiken
        return currentSb.risk_tracking?.length > 0;
      case 6: // Personen (read-only Snapshot)
        return currentSb.organization_snapshot?.length > 0
          || currentSb.stakeholders_snapshot?.length > 0;
      default:
        return false;
    }
  };

  const getSbStepStatus = (stepNumber) => {
    const activeNumber = SB_STEPS.find((s) => s.id === sbTab)?.number ?? 1;
    if (stepNumber === activeNumber) return 'active';
    if (isSbStepCompleted(stepNumber)) return 'completed';
    return 'default';
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Projektauftrag...</div>
      </div>
    );
  }

  // Get project-status badge style. Anzeigt den manuell gepflegten
  // `project_status` (Initiierung/Planung/Umsetzung/Abschluss/Gestoppt) —
  // nicht den Wizard-Status `auftrag.status`. Label-Quelle: App-Config.
  const getStatusBadge = () => {
    const value = projektauftrag.project_status;
    if (!value) {
      return { style: styles.statusDraft, label: 'Nicht gesetzt' };
    }
    const option = (appConfig?.project_status || []).find((o) => o.value === value);
    const label = option?.label || value;
    // Farb-Mapping rein heuristisch — niedrige Stati grau/blau, Abschluss gruen, Gestoppt rot.
    let style = styles.statusDraft;
    if (value === 'stopped') style = { backgroundColor: theme.colors.errorLight, color: theme.colors.error };
    else if (value === 'closing') style = styles.statusCompleted;
    else if (value === 'execution') style = styles.statusActive;
    return { style, label };
  };

  const statusBadge = getStatusBadge();

  // Get project type label
  const getProjectTypeLabel = () => {
    const types = {
      internal: 'Intern',
      external: 'Extern',
      research: 'Forschung',
      infrastructure: 'IT/Infrastruktur',
    };
    return types[projektauftrag.project_type] || projektauftrag.project_type;
  };

  return (
    <div style={styles.container}>
      {/* Header - App Detail Pattern */}
      <div style={styles.header}>
        <button
          style={styles.backLink}
          onClick={() => navigate('/apps/projektmanagement')}
        >
          <ArrowLeftIcon />
          Projektmanagement
        </button>

        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={{ ...styles.headerTitle, display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
              <span>{projektauftrag.name || 'Neuer Projektauftrag'}</span>
              {auftragRole && <RoleBadge role={auftragRole} size="sm" />}
            </h1>
            <div style={styles.headerSubtitle}>
              {projektauftrag.projektleiter && (
                <>
                  <span>{projektauftrag.projektleiter}</span>
                  <span>|</span>
                </>
              )}
              <span>{getProjectTypeLabel()}</span>
              <span>|</span>
              <span style={{ ...styles.statusBadge, ...statusBadge.style }}>
                {statusBadge.label}
              </span>
              {projektauftrag.start_date && projektauftrag.end_date && (
                <>
                  <span>|</span>
                  <span>{projektauftrag.start_date} - {projektauftrag.end_date}</span>
                </>
              )}
              {projektauftrag.idee && (
                <>
                  <span>|</span>
                  <span>
                    Aus Idee:{' '}
                    <Link
                      to={`/apps/projektmanagement/ideen/${projektauftrag.idee.id}`}
                      style={{ color: theme.colors.primary, fontWeight: theme.typography.weights.medium }}
                    >
                      {projektauftrag.idee.name}
                    </Link>
                  </span>
                </>
              )}
            </div>
          </div>

          <div style={styles.headerActions}>
            {mode === 'auftrag' && projektauftrag.id && (
              <ExportDropdown
                onExport={handleExport}
                formats={['xlsx', 'pdf', 'docx']}
                isLoading={isExporting}
                loadingFormat={exportingFormat}
                disabled={!projektauftrag.id}
              />
            )}
            {mode === 'auftrag' && projektauftrag.id && canDelete && (
              <OwnerActionsMenu
                onManagePermissions={() => setShowPermissionsModal(true)}
                onDelete={handleDelete}
              />
            )}
            {mode === 'auftrag' && canEdit && (
              <button
                style={{
                  ...styles.actionButton,
                  ...styles.primaryButton,
                  opacity: isSaving ? 0.7 : 1,
                  ...(isDirty && !isSaving ? {
                    boxShadow: `0 0 0 3px ${theme.colors.primary}30`,
                  } : {}),
                }}
                onClick={saveStep}
                disabled={isSaving}
                onMouseEnter={(e) => {
                  if (!isSaving) {
                    e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = theme.colors.primary;
                }}
              >
                <SaveIcon />
                {isSaving ? 'Speichern...' : isDirty ? 'Speichern *' : 'Speichern'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top-Level Tabs (Phase B): Uebersicht | Projektauftrag | Statusberichte.
          Bei "neu" (kein id) blenden wir die Tab-Bar aus — der Wizard ist allein
          zustaendig, ein neues Projekt anzulegen; die Sub-Resources entstehen
          erst nach dem ersten Save. */}
      {id && (
        <div style={styles.topTabBar}>
          <button
            type="button"
            style={{ ...styles.topTab, ...(mode === 'uebersicht' ? styles.topTabActive : {}) }}
            onClick={() => setModeAndUrl('uebersicht')}
          >
            Übersicht
          </button>
          <button
            type="button"
            style={{ ...styles.topTab, ...(mode === 'auftrag' ? styles.topTabActive : {}) }}
            onClick={() => setModeAndUrl('auftrag')}
          >
            Projektauftrag
          </button>
          <button
            type="button"
            style={{ ...styles.topTab, ...(mode === 'statusberichte' ? styles.topTabActive : {}) }}
            onClick={() => setModeAndUrl('statusberichte')}
          >
            Statusberichte{statusberichte.length > 0 ? ` (${statusberichte.length})` : ''}
          </button>
          <button
            type="button"
            style={{ ...styles.topTab, ...(mode === 'lessons' ? styles.topTabActive : {}) }}
            onClick={() => setModeAndUrl('lessons')}
          >
            Lessons Learned
          </button>
          <button
            type="button"
            style={{ ...styles.topTab, ...(mode === 'abschluss' ? styles.topTabActive : {}) }}
            onClick={() => setModeAndUrl('abschluss')}
          >
            Abschluss
          </button>
        </div>
      )}

      {!canEdit && id && (
        <div style={{ padding: `0 ${theme.spacing['2xl']}`, marginTop: theme.spacing.md }}>
          <ReadOnlyBanner ownerName={projektauftrag.created_by} />
        </div>
      )}

      {mode === 'uebersicht' && id && (
        <ProjektUebersichtPanel
          projekt={projekt}
          projektauftrag={projektauftrag}
          statusberichte={statusberichte}
          abschlussbericht={abschlussbericht}
          appConfig={appConfig}
          onNavigate={setModeAndUrl}
          canEdit={canEdit}
          onProjektUpdated={(updated) => setProjekt(updated)}
        />
      )}

      {mode === 'lessons' && id && (
        <LessonsLearnedView
          projektId={id}
          canEdit={canEdit}
          appConfig={appConfig}
        />
      )}

      {mode === 'abschluss' && id && (
        <AbschlussberichtView
          projektId={id}
          projektauftrag={projektauftrag}
          statusberichte={statusberichte}
          canEdit={canEdit}
          isOwner={auftragRole === 'owner'}
          appConfig={appConfig}
          onProjektStatusUpdate={async (newProjectStatus) => {
            // Setzt project_status (manuell pflegbares Feld im Basis-Tab)
            // via Auftrag-Update. Optimistic concurrency: nutze die aktuelle
            // Server-Version (sonst Conflict beim parallel offenen Wizard).
            const updated = await updateProjektauftrag(
              id,
              { project_status: newProjectStatus },
              { expectedVersion: serverVersion ?? undefined },
            );
            setProjektauftrag(updated);
            setServerVersion(updated.version ?? serverVersion);
          }}
        />
      )}

      {mode === 'auftrag' && (
        <>
          {/* Step Tabs (Horizontal Pill-Style) — siehe StepNav */}
          <StepNav steps={STEPS} getStatus={getStepStatus} onSelect={goToStep} />

          {/* Step-bezogener, additiver Dokument-Import (nur editierbare Steps 1–7) */}
          {canEdit && currentStep <= 7 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', padding: `0 ${theme.spacing['2xl']}`, marginBottom: theme.spacing.sm }}>
              <StepImportButton step={currentStep} onMerge={mergeStepImport} />
            </div>
          )}

          {/* Main content */}
          <div style={styles.main}>
            <div style={styles.content}>
              {/* Read-only Mode: fieldset disabled macht alle Inputs/Selects/Textareas
                  non-interactive — Browser-native. Step-Content bleibt scrollbar/lesbar. */}
              <fieldset
                disabled={!canEdit}
                style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}
              >
                <div style={currentStep === 8 ? {} : styles.stepContent}>{renderStepContent()}</div>
              </fieldset>
            </div>
            {currentStep <= 7 && (
              <div style={styles.rightSidebar}>
                <KnowledgePanel
                  currentStep={currentStep}
                  projektauftrag={projektauftrag}
                  analyses={stepAnalyses}
                  onAnalysisComplete={(step, analysis) => {
                    setStepAnalyses(prev => ({ ...prev, [step]: analysis }));
                  }}
                  chatMessages={chatHistories[currentStep] || []}
                  onChatMessagesChange={(msgs) =>
                    setChatHistories(prev => ({ ...prev, [currentStep]: msgs }))
                  }
                />
              </div>
            )}
          </div>

          {/* Navigation */}
          <div style={styles.navigation}>
            <button
              style={{
                ...styles.navButton,
                ...styles.navButtonPrev,
                ...(currentStep === 1 ? styles.navButtonDisabled : {}),
              }}
              onClick={goPrev}
              disabled={currentStep === 1}
            >
              <ArrowLeftIcon />
              Zurück
            </button>
            <div style={styles.navInfo}>
              <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                Schritt {currentStep} von 9
              </span>
              <div style={styles.completionInfo}>
                <span>{completeness}%</span>
                <div style={styles.completionBar}>
                  <div style={{ ...styles.completionFill, width: `${completeness}%` }} />
                </div>
              </div>
            </div>
            <button
              style={{
                ...styles.navButton,
                ...styles.navButtonNext,
                ...(currentStep === 9 ? styles.navButtonDisabled : {}),
              }}
              onClick={goNext}
              disabled={currentStep === 9}
              onMouseEnter={(e) => {
                if (currentStep < 9) {
                  e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.primary;
              }}
            >
              {currentStep === 9 ? 'Fertig' : 'Weiter'}
              {currentStep < 9 && <ArrowRightIcon />}
            </button>
          </div>
        </>
      )}

      {mode === 'statusberichte' && (
        <>
          {/* Statusbericht Main */}
          <div style={styles.main}>
            <StatusberichtBlade
              berichte={statusberichte}
              selectedId={selectedSbId}
              onSelect={setSelectedSbIdAndUrl}
              onCreate={handleCreateSb}
              isCreating={isSbCreating}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Sub-Nav — nur wenn ein Bericht ausgewählt (einheitlich via StepNav) */}
              {currentSb && (
                <StepNav
                  steps={SB_STEPS}
                  getStatus={getSbStepStatus}
                  onSelect={(n) => {
                    const t = SB_STEPS.find((s) => s.number === n);
                    if (t) setSbTab(t.id);
                  }}
                  leading={(
                    <span style={{
                      fontSize: theme.typography.sizes.sm,
                      fontWeight: theme.typography.weights.bold,
                      color: theme.colors.text,
                      padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                      marginRight: theme.spacing.sm,
                    }}>
                      SB #{currentSb.nummer}
                    </span>
                  )}
                  trailing={(
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: theme.spacing.sm, alignItems: 'center' }}>
                      <ExportDropdown
                        onExport={handleSbExport}
                        formats={['xlsx', 'pdf', 'docx']}
                        isLoading={isSbExporting}
                        loadingFormat={sbExportingFormat}
                      />
                      {currentSb.status === 'draft' && canEdit && (
                        <button
                          type="button"
                          style={{ ...styles.actionButton, ...styles.deleteButton }}
                          onClick={handleDeleteSb}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.errorLight;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <TrashIcon />
                          Löschen
                        </button>
                      )}
                      {canEdit && (
                        <button
                          type="button"
                          style={{
                            ...styles.actionButton,
                            ...styles.primaryButton,
                            opacity: isSbSaving ? 0.7 : 1,
                            ...(isSbDirty && !isSbSaving ? {
                              boxShadow: `0 0 0 3px ${theme.colors.primary}30`,
                            } : {}),
                          }}
                          onClick={handleSaveSb}
                          disabled={isSbSaving}
                          onMouseEnter={(e) => {
                            if (!isSbSaving) {
                              e.currentTarget.style.backgroundColor = theme.colors.primaryHover;
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = theme.colors.primary;
                          }}
                        >
                          <SaveIcon />
                          {isSbSaving ? 'Speichern...' : isSbDirty ? 'Speichern *' : 'Speichern'}
                        </button>
                      )}
                    </div>
                  )}
                />
              )}
              {/* Content */}
              <div style={styles.content}>
                {currentSb ? (
                  <fieldset
                    disabled={!canEdit}
                    style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}
                  >
                    <div style={styles.stepContent}>
                    {sbTab === 'basis' ? (
                      <StatusberichtBasis data={currentSb} onChange={handleSbChange} />
                    ) : sbTab === 'ziele' ? (
                      <StatusberichtZiele
                        data={currentSb}
                        onChange={handleSbChange}
                        projektauftrag={projektauftrag}
                      />
                    ) : sbTab === 'roadmap' ? (
                      <StatusberichtRoadmap
                        data={currentSb}
                        onChange={handleSbChange}
                        projektauftrag={projektauftrag}
                        config={appConfig}
                      />
                    ) : sbTab === 'kosten' ? (
                      <StatusberichtKosten
                        data={currentSb}
                        onChange={handleSbChange}
                        projektauftrag={projektauftrag}
                      />
                    ) : sbTab === 'risiken' ? (
                      <StatusberichtRisiken
                        data={currentSb}
                        onChange={handleSbChange}
                        projektauftrag={projektauftrag}
                        config={appConfig}
                      />
                    ) : (
                      <StatusberichtPersonen
                        data={currentSb}
                        onChange={handleSbChange}
                        projektauftrag={projektauftrag}
                        config={appConfig}
                      />
                    )}
                    </div>
                  </fieldset>
                ) : (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: theme.colors.textMuted,
                    fontSize: theme.typography.sizes.sm,
                  }}>
                    {statusberichte.length === 0
                      ? 'Erstellen Sie den ersten Statusbericht.'
                      : 'Wählen Sie einen Statusbericht aus der Liste.'}
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {conflict && (
        <ConflictResolutionModal
          entityLabel={mode === 'statusberichte' ? 'Statusbericht' : 'Projektauftrag'}
          serverData={conflict.current}
          onReload={handleConflictReload}
          onForce={handleConflictForce}
          onCancel={handleConflictCancel}
        />
      )}

      {showPermissionsModal && projektauftrag.id && (
        <PermissionsModal
          type="auftrag"
          id={projektauftrag.id}
          ownerName={projektauftrag.created_by}
          onClose={() => setShowPermissionsModal(false)}
        />
      )}

      <ConfirmModal
        open={!!confirmDialog}
        title={confirmDialog?.title}
        message={confirmDialog?.message}
        confirmLabel={confirmDialog?.confirmLabel || 'Bestätigen'}
        destructive
        busy={isConfirming}
        onConfirm={async () => {
          if (!confirmDialog) return;
          setIsConfirming(true);
          try {
            await confirmDialog.onConfirm();
          } finally {
            setIsConfirming(false);
            setConfirmDialog(null);
          }
        }}
        onCancel={() => setConfirmDialog(null)}
      />
    </div>
  );
}

// Icons
function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

export default WizardPage;
