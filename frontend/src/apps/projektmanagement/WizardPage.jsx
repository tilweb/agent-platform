/**
 * WizardPage
 * 9-Step Wizard for creating/editing Projektaufträge
 */

import { useState, useEffect, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useProjektmanagement, VersionConflictError } from '../../hooks/useProjektmanagement';
import ConflictResolutionModal from './components/ConflictResolutionModal';
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
import ExportDropdown from '../../components/ExportDropdown';
// Statusbericht components
import StatusberichtBlade from './components/StatusberichtBlade';
import StatusberichtBasis from './components/statusbericht/StatusberichtBasis';
import StatusberichtZiele from './components/statusbericht/StatusberichtZiele';
import StatusberichtRoadmap from './components/statusbericht/StatusberichtRoadmap';
import StatusberichtKosten from './components/statusbericht/StatusberichtKosten';
import StatusberichtRisiken from './components/statusbericht/StatusberichtRisiken';

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
  // Horizontal Step Tabs (Pill-Style)
  stepTabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing['2xl']}`,
    backgroundColor: 'transparent',
    overflowX: 'auto',
    flexWrap: 'nowrap',
  },
  stepTab: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    whiteSpace: 'nowrap',
  },
  stepTabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  stepTabCompleted: {
    color: theme.colors.success,
  },
  stepTabNumber: {
    width: '20px',
    height: '20px',
    borderRadius: theme.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  stepTabNumberDefault: {
    backgroundColor: theme.colors.border,
    color: theme.colors.textMuted,
  },
  stepTabNumberActive: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
  },
  stepTabNumberCompleted: {
    backgroundColor: theme.colors.success,
    color: '#fff',
  },
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
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
  // Right sidebar - Knowledge panel
  rightSidebar: {
    width: '400px',
    minWidth: '400px',
    borderLeft: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
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
  // Mode Toggle (Segmented Control)
  modeToggle: {
    display: 'flex',
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    padding: '2px',
  },
  modeButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
  },
  modeButtonActive: {
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    boxShadow: theme.shadows.sm,
  },
  // Statusbericht tabs
  sbTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    flexShrink: 0,
  },
  sbTab: {
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
  sbTabActive: {
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
    updateStep,
    deleteProjektauftrag,
    getConfig,
    getStatusberichte,
    createStatusbericht,
    updateStatusbericht: updateSbApi,
    deleteStatusbericht: deleteSbApi,
  } = useProjektmanagement();

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
  // Optimistic-Concurrency state.
  const [serverVersion, setServerVersion] = useState(null);
  const [conflict, setConflict] = useState(null);
  // Step analyses state (shared between KnowledgePanel and Step8)
  const [stepAnalyses, setStepAnalyses] = useState({});
  // Gesamtbewertung state (for Step8)
  const [gesamtbewertung, setGesamtbewertung] = useState(null);
  // Statusbericht state
  const [mode, setMode] = useState('auftrag'); // 'auftrag' | 'statusbericht'
  const [statusberichte, setStatusberichte] = useState([]);
  const [selectedSbId, setSelectedSbId] = useState(null);
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
      setSelectedSbId(sb.id);
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

  const handleDeleteSb = async () => {
    if (!currentSb || !projektauftrag.id) return;
    if (!window.confirm('Möchten Sie diesen Statusbericht wirklich löschen?')) return;
    try {
      await deleteSbApi(projektauftrag.id, currentSb.id);
      setSelectedSbId(null);
      setCurrentSb(null);
      await loadStatusberichte(projektauftrag.id);
    } catch (err) {
      console.error('Error deleting Statusbericht:', err);
      alert(err.message);
    }
  };

  const handleDeleteSbById = async (sbId) => {
    if (!projektauftrag.id) return;
    try {
      await deleteSbApi(projektauftrag.id, sbId);
      if (selectedSbId === sbId) {
        setSelectedSbId(null);
        setCurrentSb(null);
      }
      await loadStatusberichte(projektauftrag.id);
    } catch (err) {
      console.error('Error deleting Statusbericht:', err);
      alert(err.message);
    }
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
  const showModeToggle = projektauftrag.id && (projektauftrag.status === 'active' || statusberichte.length > 0);

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
  const handleDelete = async () => {
    if (!projektauftrag.id) {
      navigate('/apps/projektmanagement');
      return;
    }

    if (window.confirm('Möchten Sie diesen Projektauftrag wirklich löschen?')) {
      try {
        await deleteProjektauftrag(projektauftrag.id);
        navigate('/apps/projektmanagement');
      } catch (error) {
        console.error('Error deleting:', error);
      }
    }
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
  const getStepStatus = (stepNumber) => {
    if (stepNumber === currentStep) return 'active';
    if (stepNumber < currentStep || isStepCompleted(stepNumber)) return 'completed';
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
      default:
        return false;
    }
  };

  if (isLoading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Lade Projektauftrag...</div>
      </div>
    );
  }

  // Get status badge style
  const getStatusBadge = () => {
    switch (projektauftrag.status) {
      case 'active':
        return { style: styles.statusActive, label: 'Aktiv' };
      case 'completed':
        return { style: styles.statusCompleted, label: 'Abgeschlossen' };
      case 'cancelled':
        return { style: { backgroundColor: theme.colors.errorLight, color: theme.colors.error }, label: 'Abgebrochen' };
      default:
        return { style: styles.statusDraft, label: 'Entwurf' };
    }
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
            <h1 style={styles.headerTitle}>
              {projektauftrag.name || 'Neuer Projektauftrag'}
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
            {showModeToggle && (
              <div style={styles.modeToggle}>
                <button
                  style={{
                    ...styles.modeButton,
                    ...(mode === 'auftrag' ? styles.modeButtonActive : {}),
                  }}
                  onClick={() => setMode('auftrag')}
                >
                  Projektauftrag
                </button>
                <button
                  style={{
                    ...styles.modeButton,
                    ...(mode === 'statusbericht' ? styles.modeButtonActive : {}),
                  }}
                  onClick={() => setMode('statusbericht')}
                >
                  Statusberichte
                </button>
              </div>
            )}
            {mode === 'auftrag' && projektauftrag.id && (
              <ExportDropdown
                onExport={handleExport}
                formats={['xlsx', 'pdf', 'docx']}
                isLoading={isExporting}
                loadingFormat={exportingFormat}
                disabled={!projektauftrag.id}
              />
            )}
            {mode === 'auftrag' && projektauftrag.id && (
              <button
                style={{ ...styles.actionButton, ...styles.deleteButton }}
                onClick={handleDelete}
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
            {mode === 'statusbericht' && currentSb && currentSb.status === 'draft' && (
              <button
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
            {mode === 'auftrag' ? (
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
            ) : currentSb && (
              <button
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
        </div>
      </div>

      {mode === 'auftrag' ? (
        <>
          {/* Step Tabs (Horizontal Pill-Style) */}
          <div style={styles.stepTabs}>
            {STEPS.map((step) => {
              const status = getStepStatus(step.number);
              const isActive = status === 'active';
              const isCompleted = status === 'completed';
              return (
                <button
                  key={step.number}
                  type="button"
                  style={{
                    ...styles.stepTab,
                    ...(isActive ? styles.stepTabActive : {}),
                    ...(!isActive && isCompleted ? styles.stepTabCompleted : {}),
                  }}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    goToStep(step.number);
                  }}
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
                  <div
                    style={{
                      ...styles.stepTabNumber,
                      ...(isActive ? styles.stepTabNumberActive : {}),
                      ...(!isActive && isCompleted ? styles.stepTabNumberCompleted : {}),
                      ...(!isActive && !isCompleted ? styles.stepTabNumberDefault : {}),
                    }}
                  >
                    {step.number}
                  </div>
                  {step.title}
                </button>
              );
            })}
          </div>

          {/* Main content */}
          <div style={styles.main}>
            <div style={styles.content}>
              <div style={currentStep === 8 ? {} : styles.stepContent}>{renderStepContent()}</div>
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
      ) : (
        <>
          {/* Statusbericht Main */}
          <div style={styles.main}>
            <StatusberichtBlade
              berichte={statusberichte}
              selectedId={selectedSbId}
              onSelect={setSelectedSbId}
              onCreate={handleCreateSb}
              isCreating={isSbCreating}
              onDelete={handleDeleteSbById}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Tabs — nur wenn ein Bericht ausgewählt */}
              {currentSb && (
                <div style={styles.sbTabs}>
                  <span style={{
                    fontSize: theme.typography.sizes.sm,
                    fontWeight: theme.typography.weights.bold,
                    color: theme.colors.text,
                    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                    marginRight: theme.spacing.sm,
                  }}>
                    SB #{currentSb.nummer}
                  </span>
                  {[
                    { id: 'basis', label: 'Basis' },
                    { id: 'ziele', label: 'Ziele' },
                    { id: 'roadmap', label: 'Roadmap' },
                    { id: 'kosten', label: 'Kosten' },
                    { id: 'risiken', label: 'Risiken' },
                  ].map((tab) => {
                    const isActive = sbTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        style={{
                          ...styles.sbTab,
                          ...(isActive ? styles.sbTabActive : {}),
                        }}
                        onClick={() => setSbTab(tab.id)}
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
                        {tab.label}
                      </button>
                    );
                  })}
                  <div style={{ marginLeft: 'auto' }}>
                    <ExportDropdown
                      onExport={handleSbExport}
                      formats={['xlsx', 'pdf', 'docx']}
                      isLoading={isSbExporting}
                      loadingFormat={sbExportingFormat}
                    />
                  </div>
                </div>
              )}
              {/* Content */}
              <div style={styles.content}>
                {currentSb ? (
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
                    ) : (
                      <StatusberichtRisiken
                        data={currentSb}
                        onChange={handleSbChange}
                        projektauftrag={projektauftrag}
                        config={appConfig}
                      />
                    )}
                  </div>
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
          entityLabel={mode === 'auftrag' ? 'Projektauftrag' : 'Statusbericht'}
          serverData={conflict.current}
          onReload={handleConflictReload}
          onForce={handleConflictForce}
          onCancel={handleConflictCancel}
        />
      )}
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
