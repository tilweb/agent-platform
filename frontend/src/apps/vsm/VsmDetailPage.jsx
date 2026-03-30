import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useVsm } from '../../hooks/useVsm';
import EingabeTab from './components/tabs/EingabeTab';
import VisualisierungTab from './components/tabs/VisualisierungTab';
import AnalyseTab from './components/tabs/AnalyseTab';

const STATUS_LABELS = {
  entwurf: 'Entwurf',
  erfassung: 'Erfassung',
  analyse: 'Analyse',
  abgeschlossen: 'Abgeschlossen',
};

const STATUS_STYLES = {
  entwurf: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  erfassung: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  analyse: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  abgeschlossen: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
};

const TABS = [
  { id: 'eingabe', label: 'Eingabe' },
  { id: 'visualisierung', label: 'Visualisierung' },
  { id: 'analyse', label: 'Analyse' },
];

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
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
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
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
  },
  deleteButton: {
    color: theme.colors.error,
    borderColor: `${theme.colors.error}30`,
  },
  tabsRow: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    flexShrink: 0,
  },
  tab: {
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
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
    overflow: 'auto',
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  errorBox: {
    padding: theme.spacing.xl,
    margin: theme.spacing['2xl'],
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
  },
};

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}

export default function VsmDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getProjekt, updateProjekt, updateVsmSection, deleteProjekt, runAnalyse } = useVsm();

  const [projekt, setProjekt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('eingabe');

  const loadProjekt = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getProjekt(id);
      setProjekt(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id, getProjekt]);

  useEffect(() => {
    loadProjekt();
  }, [loadProjekt]);

  const handleSaveSection = useCallback(async (section, data) => {
    try {
      const updated = await updateVsmSection(id, section, data);
      setProjekt(updated);
    } catch (err) {
      console.error('Error saving section:', err);
      throw err;
    }
  }, [id, updateVsmSection]);

  const handleRunAnalyse = useCallback(async () => {
    try {
      const result = await runAnalyse(id);
      setProjekt(result.projekt);
      return result.analyse;
    } catch (err) {
      throw err;
    }
  }, [id, runAnalyse]);

  const handleDelete = useCallback(async () => {
    if (!confirm('VSM-Projekt wirklich loeschen?')) return;
    try {
      await deleteProjekt(id);
      navigate('/apps/vsm');
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  }, [id, deleteProjekt, navigate]);

  const handleStatusChange = useCallback(async (newStatus) => {
    try {
      const updated = await updateProjekt(id, { status: newStatus });
      setProjekt(updated);
    } catch (err) {
      console.error('Error updating status:', err);
    }
  }, [id, updateProjekt]);

  if (isLoading) return <div style={styles.loading}>Laden...</div>;
  if (error) return <div style={styles.errorBox}>Fehler: {error}</div>;
  if (!projekt) return <div style={styles.errorBox}>Projekt nicht gefunden</div>;

  const processCount = projekt.vsm_data?.prozessschritte?.length || 0;
  const supplierCount = projekt.vsm_data?.lieferanten?.length || 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/vsm')}>
          <ArrowLeftIcon /> Value Stream Mapping
        </button>
        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.headerTitle}>{projekt.name}</h1>
            <div style={styles.headerSubtitle}>
              <span>{projekt.vsm_data?.meta_daten?.unternehmen || 'Kein Unternehmen'}</span>
              <span>|</span>
              <span style={{ ...styles.statusBadge, ...STATUS_STYLES[projekt.status] }}>
                {STATUS_LABELS[projekt.status]}
              </span>
              <span>|</span>
              <span>{processCount} Prozessschritte, {supplierCount} Lieferanten</span>
            </div>
          </div>
          <div style={styles.headerActions}>
            {projekt.status === 'analyse' && (
              <button
                style={{ ...styles.actionButton, backgroundColor: theme.colors.successLight, color: theme.colors.success, borderColor: theme.colors.success }}
                onClick={() => handleStatusChange('abgeschlossen')}
              >
                Abschliessen
              </button>
            )}
            <button
              style={{ ...styles.actionButton, ...styles.deleteButton }}
              onClick={handleDelete}
            >
              Loeschen
            </button>
          </div>
        </div>
      </div>

      <div style={styles.tabsRow}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...styles.tab, ...(activeTab === tab.id ? styles.tabActive : {}) }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.content}>
        {activeTab === 'eingabe' && (
          <EingabeTab
            vsmData={projekt.vsm_data}
            onSave={handleSaveSection}
          />
        )}
        {activeTab === 'visualisierung' && (
          <VisualisierungTab
            vsmData={projekt.vsm_data}
          />
        )}
        {activeTab === 'analyse' && (
          <AnalyseTab
            projekt={projekt}
            onRunAnalyse={handleRunAnalyse}
          />
        )}
      </div>
    </div>
  );
}
