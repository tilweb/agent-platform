/**
 * IdeeWizardPage
 * 6-Schritt-Wizard fuer Projektideen — visuelles Layout 1:1 wie WizardPage (Auftrag).
 * Schritte: Basis | Ziele | Projektkontext | Business Case | Unternehmensrisiken | Übersicht.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { useProjektideen } from '../../hooks/useProjektideen';
import { API_URL } from '../../utils/apiFetch';
import ExportDropdown from '../../components/ExportDropdown';
import IdeeBasis from './components/idee-steps/IdeeBasis';
import IdeeZiele from './components/idee-steps/IdeeZiele';
import Projektkontext from './components/idee-steps/Projektkontext';
import BusinessCase from './components/idee-steps/BusinessCase';
import Unternehmensrisiken from './components/idee-steps/Unternehmensrisiken';
import IdeeUebersicht from './components/idee-steps/IdeeUebersicht';

const STEPS = [
  { number: 1, title: 'Basis', component: IdeeBasis },
  { number: 2, title: 'Ziele', component: IdeeZiele },
  { number: 3, title: 'Projektkontext', component: Projektkontext },
  { number: 4, title: 'Business Case', component: BusinessCase },
  { number: 5, title: 'Unternehmensrisiken', component: Unternehmensrisiken },
  { number: 6, title: 'Übersicht', component: IdeeUebersicht },
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
  headerLeft: { flex: 1 },
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
  statusDraft: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  statusReview: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  statusApproved: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  statusRejected: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
  statusArchived: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  headerActions: { display: 'flex', gap: theme.spacing.md },
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
  // Horizontal Step Tabs (Pill-Style) — identisch zu WizardPage
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
  // Main content area
  main: {
    flex: 1,
    display: 'flex',
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing.xl,
  },
  stepContent: {
    maxWidth: '720px',
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
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
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
  errorBanner: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    margin: `${theme.spacing.lg} ${theme.spacing['2xl']}`,
    fontSize: theme.typography.sizes.sm,
  },
};

const STATUS_BADGE_STYLES = {
  draft: 'statusDraft',
  review: 'statusReview',
  approved: 'statusApproved',
  rejected: 'statusRejected',
  archived: 'statusArchived',
};

const STATUS_LABELS = {
  draft: 'Entwurf',
  review: 'In Pruefung',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
  archived: 'Archiviert',
};

function emptyIdee() {
  return {
    name: '',
    status: 'draft',
    goals: '',
    context: { ausgangslage: '', rahmenbedingungen: '' },
    in_scope: [],
    out_scope: [],
    business_case: { investitionen: [], nutzen: [] },
    unternehmensrisiken: [],
    current_step: 1,
  };
}

export default function IdeeWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getIdee, createIdee, updateIdee, deleteIdee, erstelleAuftragAusIdee } = useProjektideen({ autoLoad: false });

  const [idee, setIdee] = useState(emptyIdee());
  const [currentStep, setCurrentStep] = useState(1);
  const [maxVisitedStep, setMaxVisitedStep] = useState(1);
  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState(null);
  const [isCreatingAuftrag, setIsCreatingAuftrag] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);

  // Initial load
  useEffect(() => {
    if (id) {
      setIsLoading(true);
      getIdee(id)
        .then((data) => {
          setIdee(data);
          const step = data.current_step || 1;
          setCurrentStep(step);
          setMaxVisitedStep(Math.max(step, 1));
        })
        .catch((err) => {
          console.error(err);
          setError(err.message);
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, getIdee]);

  const handleChange = (next) => {
    setIdee(next);
    setIsDirty(true);
  };

  const save = async () => {
    setIsSaving(true);
    setError(null);
    try {
      if (idee.id) {
        const updated = await updateIdee(idee.id, idee);
        setIdee(updated);
      } else {
        if (!idee.name?.trim()) {
          setError('Bitte zuerst einen Projektnamen eintragen.');
          setIsSaving(false);
          return null;
        }
        const created = await createIdee(idee);
        setIdee(created);
        navigate(`/apps/projektmanagement/ideen/${created.id}`, { replace: true });
        return created;
      }
      setIsDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
    return null;
  };

  const goToStep = async (step) => {
    if (isDirty) {
      const result = await save();
      if (result === null && error) return;
    }
    setCurrentStep(step);
    setMaxVisitedStep((prev) => Math.max(prev, step));
  };

  const goNext = () => {
    if (currentStep < STEPS.length) goToStep(currentStep + 1);
  };
  const goPrev = () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  };

  const getStepStatus = (stepNumber) => {
    if (stepNumber === currentStep) return 'active';
    if (stepNumber < maxVisitedStep) return 'completed';
    return 'default';
  };

  const handleDelete = async () => {
    if (!idee.id) return;
    if (!confirm('Diese Projektidee wirklich loeschen? Die abgeleiteten Projektauftraege bleiben bestehen.')) return;
    try {
      await deleteIdee(idee.id);
      navigate('/apps/projektmanagement?tab=ideen');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleExport = async (format) => {
    if (!idee.id) {
      setError('Bitte die Idee zuerst speichern.');
      return;
    }
    try {
      setIsExporting(true);
      setExportingFormat(format);
      const response = await fetch(
        `${API_URL}/apps/projektmanagement/projektideen/${idee.id}/export/${format}`,
        { credentials: 'include' }
      );
      if (!response.ok) throw new Error('Export fehlgeschlagen');

      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `Projektidee_${idee.name || 'unbenannt'}.${format}`;
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
    } catch (err) {
      console.error('Export error:', err);
      setError('Export fehlgeschlagen. Bitte erneut versuchen.');
    } finally {
      setIsExporting(false);
      setExportingFormat(null);
    }
  };

  const handleCreateAuftrag = async () => {
    if (!idee.id) {
      setError('Bitte die Idee zuerst speichern.');
      return;
    }
    if (isDirty) {
      const saved = await save();
      if (saved === null && error) return;
    }
    setIsCreatingAuftrag(true);
    try {
      const auftrag = await erstelleAuftragAusIdee(idee.id);
      navigate(`/apps/projektmanagement/${auftrag.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCreatingAuftrag(false);
    }
  };

  if (isLoading) {
    return <div style={styles.container}><div style={styles.loading}>Lade Projektidee…</div></div>;
  }

  const StepComponent = STEPS[currentStep - 1].component;
  const badgeStyle = styles[STATUS_BADGE_STYLES[idee.status] ?? 'statusDraft'];

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/projektmanagement?tab=ideen')}>
          <ArrowLeftIcon /> Projektideen
        </button>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.headerTitle}>{idee.name || 'Neue Projektidee'}</h1>
            <div style={styles.headerSubtitle}>
              <span>Projektidee</span>
              <span>|</span>
              <span style={{ ...styles.statusBadge, ...badgeStyle }}>
                {STATUS_LABELS[idee.status] ?? idee.status}
              </span>
              {idee.abgeleitete_auftraege && idee.abgeleitete_auftraege.length > 0 && (
                <>
                  <span>|</span>
                  <span>{idee.abgeleitete_auftraege.length} abgeleitete Auftr.</span>
                </>
              )}
            </div>
          </div>
          <div style={styles.headerActions}>
            <button
              style={{
                ...styles.actionButton,
                ...styles.primaryButton,
                opacity: isSaving ? 0.7 : 1,
                ...(isDirty && !isSaving ? {
                  boxShadow: `0 0 0 3px ${theme.colors.primary}30`,
                } : {}),
              }}
              onClick={save}
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
            {idee.id && (
              <ExportDropdown
                onExport={handleExport}
                formats={['md', 'pdf', 'docx']}
                isLoading={isExporting}
                loadingFormat={exportingFormat}
              />
            )}
            {idee.id && (
              <button
                style={{ ...styles.actionButton, ...styles.primaryButton }}
                onClick={handleCreateAuftrag}
                disabled={isCreatingAuftrag}
              >
                {isCreatingAuftrag ? 'Erzeuge…' : 'Auftrag aus Idee erstellen'}
              </button>
            )}
            {idee.id && (
              <button
                style={{ ...styles.actionButton, ...styles.deleteButton }}
                onClick={handleDelete}
              >
                Löschen
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

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
          <div style={styles.stepContent}>
            <StepComponent
              projektidee={idee}
              onChange={handleChange}
              onCreateAuftrag={currentStep === 6 ? handleCreateAuftrag : undefined}
            />
          </div>
        </div>
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
          ← Zurück
        </button>
        <div style={styles.navInfo}>
          Schritt {currentStep} von {STEPS.length}
        </div>
        <button
          style={{
            ...styles.navButton,
            ...styles.navButtonNext,
            ...(currentStep === STEPS.length ? styles.navButtonDisabled : {}),
          }}
          onClick={goNext}
          disabled={currentStep === STEPS.length}
        >
          {currentStep === STEPS.length ? 'Fertig' : 'Weiter →'}
        </button>
      </div>
    </div>
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
