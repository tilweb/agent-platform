/**
 * WizardPage
 * 9-Step Wizard for creating/editing Projektaufträge
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useProjektmanagement } from '../../hooks/useProjektmanagement';
import { API_URL } from '../../utils/apiFetch';

// Step components
import Step1Basis from './components/steps/Step1Basis';
import Step2Ziele from './components/steps/Step2Ziele';
import Step3Umfang from './components/steps/Step3Umfang';
import Step4Aufgaben from './components/steps/Step4Aufgaben';
import Step5Meilensteine from './components/steps/Step5Meilensteine';
import Step6BudgetRisiken from './components/steps/Step6BudgetRisiken';
import Step7Organisation from './components/steps/Step7Organisation';
import Step8Uebersicht from './components/steps/Step8Uebersicht';
import Step9Vergleich from './components/steps/Step9Vergleich';
import KnowledgePanel from './components/KnowledgePanel';
import ExportDropdown from '../../components/ExportDropdown';

const STEPS = [
  { number: 1, title: 'Basis', component: Step1Basis },
  { number: 2, title: 'Ziele', component: Step2Ziele },
  { number: 3, title: 'Umfang', component: Step3Umfang },
  { number: 4, title: 'Aufgaben', component: Step4Aufgaben },
  { number: 5, title: 'Meilensteine', component: Step5Meilensteine },
  { number: 6, title: 'Budget & Risiken', component: Step6BudgetRisiken },
  { number: 7, title: 'Organisation', component: Step7Organisation },
  { number: 8, title: 'Übersicht', component: Step8Uebersicht },
  { number: 9, title: 'Vergleich', component: Step9Vergleich },
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
  } = useProjektmanagement();

  const [projektauftrag, setProjektauftrag] = useState(emptyProjektauftrag);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [completeness, setCompleteness] = useState(0);
  const [isNewProject, setIsNewProject] = useState(!id);
  // Step analyses state (shared between KnowledgePanel and Step8)
  const [stepAnalyses, setStepAnalyses] = useState({});
  // Gesamtbewertung state (for Step8)
  const [gesamtbewertung, setGesamtbewertung] = useState(null);

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
  }, [calculateCompleteness]);

  // Save current step
  const saveStep = async () => {
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
        setIsNewProject(false);
        // Update URL without reload
        window.history.replaceState(null, '', `/apps/projektmanagement/${created.id}`);
      } else {
        // Update existing
        const result = await updateStep(projektauftrag.id, currentStep, dataToSave);
        setProjektauftrag(result.projektauftrag);
        setCompleteness(result.completeness || 0);
      }
    } catch (error) {
      console.error('Error saving:', error);
    } finally {
      setIsSaving(false);
    }
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
        return !!projektauftrag.goals && projektauftrag.criteria?.length > 0;
      case 3:
        return !!projektauftrag.scope;
      case 4:
        return projektauftrag.tasks?.length > 0;
      case 5:
        return projektauftrag.milestones?.length > 0;
      case 6:
        return projektauftrag.budget?.length > 0 || projektauftrag.risks?.length > 0;
      case 7:
        return projektauftrag.organization?.length > 0;
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
            </div>
          </div>

          <div style={styles.headerActions}>
            {projektauftrag.id && (
              <ExportDropdown
                onExport={handleExport}
                formats={['xlsx', 'pdf', 'docx']}
                isLoading={isExporting}
                loadingFormat={exportingFormat}
                disabled={!projektauftrag.id}
              />
            )}
            {projektauftrag.id && (
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
            <button
              style={{
                ...styles.actionButton,
                ...styles.primaryButton,
                opacity: isSaving ? 0.7 : 1,
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
              {isSaving ? 'Speichern...' : 'Speichern'}
            </button>
          </div>
        </div>
      </div>

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
                {!isActive && isCompleted ? <CheckIcon /> : step.number}
              </div>
              {step.title}
            </button>
          );
        })}
      </div>

      {/* Main content */}
      <div style={styles.main}>
        {/* Step content */}
        <div style={styles.content}>
          <div style={currentStep === 8 ? {} : styles.stepContent}>{renderStepContent()}</div>
        </div>

        {/* Right sidebar - Knowledge Panel (only for steps 1-7) */}
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
              <div
                style={{
                  ...styles.completionFill,
                  width: `${completeness}%`,
                }}
              />
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
