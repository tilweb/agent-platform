/**
 * IdeeWizardPage
 * 6-Schritt-Wizard fuer Projektideen — visuelles Layout 1:1 wie WizardPage (Auftrag).
 * Schritte: Basis | Ziele | Projektkontext | Business Case | Unternehmensrisiken | Übersicht.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { useProjektideen, VersionConflictError } from '../../hooks/useProjektideen';
import { useProjektmanagement } from '../../hooks/useProjektmanagement';
import { usePmResourcePermission, hasMinRole } from '../../hooks/usePmResourcePermission';
import { useAppPermission } from '../../components/RequireAppPermission';
import RoleBadge from '../../components/RoleBadge';
import ReadOnlyBanner from '../../components/ReadOnlyBanner';
import ConflictResolutionModal from './components/ConflictResolutionModal';
import OwnerActionsMenu from './components/OwnerActionsMenu';
import PermissionsModal from './components/PermissionsModal';
import ConfirmModal from '../../components/ConfirmModal';
import { API_URL } from '../../utils/apiFetch';
import ExportDropdown from '../../components/ExportDropdown';
import StepNav from './components/StepNav';
import KnowledgePanel from './components/KnowledgePanel';
import IdeeBasis from './components/idee-steps/IdeeBasis';
import IdeePersonen from './components/idee-steps/IdeePersonen';
import IdeeZiele from './components/idee-steps/IdeeZiele';
import Projektkontext from './components/idee-steps/Projektkontext';
import BusinessCase from './components/idee-steps/BusinessCase';
import Unternehmensrisiken from './components/idee-steps/Unternehmensrisiken';
import IdeeUebersicht from './components/idee-steps/IdeeUebersicht';

const STEPS = [
  { number: 1, title: 'Basis', component: IdeeBasis },
  { number: 2, title: 'Personen', component: IdeePersonen },
  { number: 3, title: 'Ziele', component: IdeeZiele },
  { number: 4, title: 'Projektkontext', component: Projektkontext },
  { number: 5, title: 'Business Case', component: BusinessCase },
  { number: 6, title: 'Unternehmensrisiken', component: Unternehmensrisiken },
  { number: 7, title: 'Übersicht', component: IdeeUebersicht },
];

// Idee-UI-Step → Masterclass-Segment (Registry-Schlüssel). Übersicht (7) ist
// eine reine Zusammenfassung → kein KI-Balken.
const IDEE_SEGMENTS = {
  1: { segment: 'basis', canAnalyze: true },
  2: { segment: 'personen', canAnalyze: true },
  3: { segment: 'ziele', canAnalyze: true },
  4: { segment: 'projektkontext', canAnalyze: true },
  5: { segment: 'businesscase', canAnalyze: true },
  6: { segment: 'unternehmensrisiken', canAnalyze: true },
};

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
  // Step-Tab-Styles leben jetzt in StepNav (components/StepNav.jsx).
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
  rightSidebar: {
    width: '400px',
    minWidth: '400px',
    borderLeft: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
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
    organization: [],
    stakeholders: [],
    current_step: 1,
  };
}

export default function IdeeWizardPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getIdee, createIdee, updateIdee, deleteIdee, erstelleAuftragAusIdee } = useProjektideen({ autoLoad: false });
  const { getConfig } = useProjektmanagement();

  // Phase-2: Effektive Idee-Rolle. Bei "neu" (ohne id) wird die App-Editor-Rolle
  // gecheckt — der Backend-POST prueft das nochmal hart.
  const { role: ideeRole } = usePmResourcePermission('idee', id);
  const { role: appRole } = useAppPermission();
  const canEdit = id ? hasMinRole(ideeRole, 'editor') : (appRole === 'owner' || appRole === 'editor');
  const canDelete = id && ideeRole === 'owner';
  const canManagePermissions = canDelete; // Same: nur Owner

  const [idee, setIdee] = useState(emptyIdee());
  const [appConfig, setAppConfig] = useState(null);
  const [currentStep, setCurrentStep] = useState(1);
  // KI-Analysen liegen direkt an der Idee (idee.analyses[segment]) → persistieren
  // beim Speichern der Idee. Chatverläufe bleiben in-session.
  const [chatHistories, setChatHistories] = useState({});
  const [isLoading, setIsLoading] = useState(!!id);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [error, setError] = useState(null);
  const [isCreatingAuftrag, setIsCreatingAuftrag] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);
  // Phase-2: Permissions-Modal-State
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmCreateAuftrag, setConfirmCreateAuftrag] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Server-Version fuer Optimistic-Concurrency. Null heisst: Idee noch nicht
  // gespeichert oder Version unbekannt → kein Check beim ersten Save.
  const [serverVersion, setServerVersion] = useState(null);
  // Konflikt-State: { current, retry } — current ist die Server-Version,
  // retry ist die Closure die der "Force"-Button aufruft.
  const [conflict, setConflict] = useState(null);

  // Initial load
  useEffect(() => {
    if (id) {
      setIsLoading(true);
      getIdee(id)
        .then((data) => {
          setIdee(data);
          setServerVersion(data.version ?? 1);
          const step = data.current_step || 1;
          setCurrentStep(step);
        })
        .catch((err) => {
          console.error(err);
          setError(err.message);
        })
        .finally(() => setIsLoading(false));
    }
  }, [id, getIdee]);

  // App-Config laden (Auswahloptionen fuer die Personen-Maske).
  useEffect(() => {
    getConfig().then(setAppConfig).catch(console.error);
  }, [getConfig]);

  const handleChange = (next) => {
    setIdee(next);
    setIsDirty(true);
  };

  const save = async ({ force = false } = {}) => {
    setIsSaving(true);
    setError(null);
    try {
      if (idee.id) {
        const updated = await updateIdee(idee.id, idee, {
          expectedVersion: serverVersion ?? undefined,
          force,
        });
        setIdee(updated);
        setServerVersion(updated.version ?? null);
      } else {
        if (!idee.name?.trim()) {
          setError('Bitte zuerst einen Projektnamen eintragen.');
          setIsSaving(false);
          return null;
        }
        const created = await createIdee(idee);
        setIdee(created);
        setServerVersion(created.version ?? null);
        navigate(`/apps/projektmanagement/ideen/${created.id}`, { replace: true });
        return created;
      }
      setIsDirty(false);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setConflict({ current: err.current });
        setIsSaving(false);
        return null;
      }
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
    return null;
  };

  // Konflikt-Handler: User waehlt zwischen Reload (Server-Version uebernehmen)
  // und Force-Overwrite (eigene Aenderungen mit force speichern).
  const handleConflictReload = () => {
    if (!conflict) return;
    setIdee(conflict.current);
    setServerVersion(conflict.current.version ?? null);
    setIsDirty(false);
    setConflict(null);
  };
  const handleConflictForce = async () => {
    setConflict(null);
    await save({ force: true });
  };
  const handleConflictCancel = () => {
    setConflict(null);
  };

  const goToStep = async (step) => {
    if (isDirty) {
      const result = await save();
      if (result === null && error) return;
    }
    setCurrentStep(step);
  };

  const goNext = () => {
    if (currentStep < STEPS.length) goToStep(currentStep + 1);
  };
  const goPrev = () => {
    if (currentStep > 1) goToStep(currentStep - 1);
  };

  // Inhaltsbasierte "erledigt"-Logik — einheitlich wie beim Projektauftrag.
  const isStepCompleted = (stepNumber) => {
    switch (stepNumber) {
      case 1: // Basis
        return !!idee.name && !!idee.projekt_id;
      case 2: // Personen
        return idee.organization?.length > 0;
      case 3: // Ziele
        return !!idee.goals;
      case 4: // Projektkontext
        return !!idee.context?.ausgangslage
          || !!idee.context?.rahmenbedingungen
          || idee.in_scope?.length > 0
          || idee.out_scope?.length > 0;
      case 5: // Business Case
        return idee.business_case?.investitionen?.length > 0
          || idee.business_case?.nutzen?.length > 0;
      case 6: // Unternehmensrisiken
        return idee.unternehmensrisiken?.length > 0;
      case 7: // Übersicht: kein eigener Inhalt -> erledigt, wenn alle Schritte davor erledigt
        return [1, 2, 3, 4, 5, 6].every((n) => isStepCompleted(n));
      default:
        return false;
    }
  };

  // Rein inhaltsbasiert: grün nur bei tatsächlich vorhandenen Daten (kein
  // positionsbasiertes "Schein-Grün" für bereits passierte Schritte).
  const getStepStatus = (stepNumber) => {
    if (stepNumber === currentStep) return 'active';
    if (isStepCompleted(stepNumber)) return 'completed';
    return 'default';
  };

  const handleDelete = () => {
    if (!idee.id) return;
    setConfirmDelete(true);
  };

  const confirmDeleteNow = async () => {
    if (!idee.id) return;
    setIsDeleting(true);
    try {
      await deleteIdee(idee.id);
      navigate('/apps/projektmanagement?tab=ideen');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
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

  // Öffnet die Sicherheitsabfrage (echtes Modal statt window.confirm).
  const handleCreateAuftrag = () => {
    if (!idee.id) {
      setError('Bitte die Idee zuerst speichern.');
      return;
    }
    setConfirmCreateAuftrag(true);
  };

  const confirmCreateAuftragNow = async () => {
    if (!idee.id) return;
    setConfirmCreateAuftrag(false);
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
            <h1 style={{ ...styles.headerTitle, display: 'flex', alignItems: 'center', gap: theme.spacing.md, flexWrap: 'wrap' }}>
              <span>{idee.name || 'Neue Projektidee'}</span>
              {ideeRole && <RoleBadge role={ideeRole} size="sm" />}
            </h1>
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
            {canEdit && (
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
            )}
            {idee.id && (
              <ExportDropdown
                onExport={handleExport}
                formats={['md', 'pdf', 'docx']}
                isLoading={isExporting}
                loadingFormat={exportingFormat}
              />
            )}
            {idee.id && (appRole === 'owner' || appRole === 'editor') && (
              <button
                style={{ ...styles.actionButton, ...styles.primaryButton }}
                onClick={handleCreateAuftrag}
                disabled={isCreatingAuftrag}
              >
                {isCreatingAuftrag ? 'Erzeuge…' : 'Auftrag aus Idee erstellen'}
              </button>
            )}
            {idee.id && canDelete && (
              <OwnerActionsMenu
                onManagePermissions={() => setShowPermissionsModal(true)}
                onDelete={handleDelete}
              />
            )}
          </div>
        </div>
      </div>

      {error && <div style={styles.errorBanner}>{error}</div>}

      {!canEdit && id && (
        <div style={{ padding: `0 ${theme.spacing['2xl']}`, marginTop: theme.spacing.md }}>
          <ReadOnlyBanner ownerName={idee.created_by} />
        </div>
      )}

      {/* Step Tabs (Horizontal Pill-Style) — siehe StepNav */}
      <StepNav steps={STEPS} getStatus={getStepStatus} onSelect={goToStep} />

      {/* Main content */}
      <div style={styles.main}>
        <div style={styles.content}>
          {/* Read-only Mode bei !canEdit: fieldset disabled macht alle Inputs
              non-interactive (Browser-native). Stelle sicher dass Lesen weiter
              moeglich ist und der Wizard scrollbar bleibt. */}
          <fieldset
            disabled={!canEdit}
            style={{ border: 'none', padding: 0, margin: 0, minWidth: 0 }}
          >
            <div style={styles.stepContent}>
              <StepComponent
                projektidee={idee}
                onChange={handleChange}
                config={appConfig}
                onCreateAuftrag={currentStep === 7 ? handleCreateAuftrag : undefined}
              />
            </div>
          </fieldset>
        </div>
        {IDEE_SEGMENTS[currentStep] && (
          <div style={styles.rightSidebar}>
            <KnowledgePanel
              element="projektidee"
              segment={IDEE_SEGMENTS[currentStep].segment}
              canAnalyze={IDEE_SEGMENTS[currentStep].canAnalyze}
              entity={idee}
              analysis={idee.analyses?.[IDEE_SEGMENTS[currentStep].segment] || null}
              onAnalysisComplete={(analysis) => {
                const seg = IDEE_SEGMENTS[currentStep].segment;
                setIdee((prev) => ({ ...prev, analyses: { ...(prev.analyses || {}), [seg]: analysis } }));
                setIsDirty(true);
              }}
              chatMessages={chatHistories[currentStep] || []}
              onChatMessagesChange={(msgs) => setChatHistories((prev) => ({ ...prev, [currentStep]: msgs }))}
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

      {conflict && (
        <ConflictResolutionModal
          entityLabel="Projektidee"
          serverData={conflict.current}
          onReload={handleConflictReload}
          onForce={handleConflictForce}
          onCancel={handleConflictCancel}
        />
      )}

      {showPermissionsModal && idee.id && (
        <PermissionsModal
          type="idee"
          id={idee.id}
          ownerName={idee.created_by}
          onClose={() => setShowPermissionsModal(false)}
        />
      )}

      <ConfirmModal
        open={confirmDelete}
        title="Projektidee löschen?"
        message={`„${idee.name || 'Unbenannte Idee'}" wird unwiderruflich gelöscht. Abgeleitete Projektaufträge bleiben bestehen.`}
        confirmLabel="Löschen"
        destructive
        busy={isDeleting}
        onConfirm={confirmDeleteNow}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmCreateAuftrag}
        title="Projektauftrag aus Idee erstellen?"
        message={`Aus der Idee „${idee.name || 'Unbenannte Idee'}" wird ein neuer Projektauftrag erstellt. Die Idee bleibt erhalten.`}
        confirmLabel="Auftrag erstellen"
        busy={isCreatingAuftrag}
        onConfirm={confirmCreateAuftragNow}
        onCancel={() => setConfirmCreateAuftrag(false)}
      />
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
