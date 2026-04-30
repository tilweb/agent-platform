/**
 * IdeeWizardPage
 * 6-Schritt-Wizard fuer Projektideen. Schlanker als der Auftrag-Wizard.
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
  container: { height: '100%', display: 'flex', flexDirection: 'column' },
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
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'center',
  },
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
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  sidebar: {
    width: '240px',
    minWidth: '240px',
    paddingTop: theme.spacing.xl,
    paddingLeft: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    borderRight: `1px solid ${theme.colors.border}`,
  },
  stepButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
  },
  stepButtonActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  stepBubble: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  stepBubbleActive: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
  },
  content: { flex: 1, padding: theme.spacing['2xl'], overflow: 'auto' },
  contentInner: { maxWidth: '900px', margin: '0 auto' },
  navBar: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing.xl,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  navButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    border: `1px solid ${theme.colors.border}`,
    color: theme.colors.text,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  navButtonDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  navButtonPrimary: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
  },
  loading: { padding: theme.spacing['2xl'], textAlign: 'center', color: theme.colors.textMuted },
  errorBanner: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    margin: `${theme.spacing.lg} ${theme.spacing['2xl']}`,
    fontSize: theme.typography.sizes.sm,
  },
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
          setCurrentStep(data.current_step || 1);
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
  };

  const next = () => {
    if (currentStep < STEPS.length) goToStep(currentStep + 1);
  };
  const prev = () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  };

  const handleDelete = async () => {
    if (!idee.id) return;
    if (!confirm('Diese Projektidee wirklich loeschen? Die abgeleiteten Projektauftraege bleiben bestehen.')) return;
    try {
      await deleteIdee(idee.id);
      navigate('/apps/projektmanagement/ideen');
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

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/projektmanagement/ideen')}>
          <ArrowLeftIcon /> Projektideen
        </button>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.title}>{idee.name || 'Neue Projektidee'}</h1>
            <div style={styles.subtitle}>
              <span>{idee.id ? 'Idee' : 'Neue Idee'}</span>
              <span>|</span>
              <span>{STATUS_LABELS[idee.status] ?? idee.status}</span>
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
              style={styles.actionButton}
              onClick={save}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Speichert…' : isDirty ? 'Speichern' : 'Gespeichert ✓'}
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

      <div style={styles.body}>
        <div style={styles.sidebar}>
          {STEPS.map((s) => {
            const isActive = s.number === currentStep;
            return (
              <button
                key={s.number}
                style={{ ...styles.stepButton, ...(isActive ? styles.stepButtonActive : {}) }}
                onClick={() => goToStep(s.number)}
              >
                <span style={{ ...styles.stepBubble, ...(isActive ? styles.stepBubbleActive : {}) }}>
                  {s.number}
                </span>
                <span>{s.title}</span>
              </button>
            );
          })}
        </div>

        <div style={styles.content}>
          <div style={styles.contentInner}>
            <StepComponent
              projektidee={idee}
              onChange={handleChange}
              onCreateAuftrag={currentStep === 6 ? handleCreateAuftrag : undefined}
            />
          </div>
        </div>
      </div>

      <div style={styles.navBar}>
        <button
          style={{ ...styles.navButton, ...(currentStep === 1 ? styles.navButtonDisabled : {}) }}
          onClick={prev}
          disabled={currentStep === 1}
        >
          ← Zurück
        </button>
        <button
          style={{ ...styles.navButton, ...styles.navButtonPrimary, ...(currentStep === STEPS.length ? styles.navButtonDisabled : {}) }}
          onClick={next}
          disabled={currentStep === STEPS.length}
        >
          Weiter →
        </button>
      </div>
    </div>
  );
}
