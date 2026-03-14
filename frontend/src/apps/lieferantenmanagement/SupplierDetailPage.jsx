/**
 * SupplierDetailPage - Detail page with horizontal tabs
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { apiGet, apiPut, apiDelete } from '../../utils/apiFetch';
import RiskBadge from './components/shared/RiskBadge';


// Lazy-load panels to isolate errors
import StammdatenPanel from './components/detail/StammdatenPanel';
import LeistungenPanel from './components/detail/LeistungenPanel';
import RegulatorikPanel from './components/detail/RegulatorikPanel';
import DokumentePanel from './components/detail/DokumentePanel';
import PruefungenPanel from './components/detail/PruefungenPanel';
import HistoriePanel from './components/detail/HistoriePanel';

const BASE = '/apps/lieferantenmanagement';

const TABS = [
  { id: 'stammdaten', label: 'Stammdaten' },
  { id: 'leistungen', label: 'Leistungen' },
  { id: 'regulatorik', label: 'Regulatorik' },
  { id: 'dokumente', label: 'Dokumente' },
  { id: 'pruefungen', label: 'Pruefungen' },
  { id: 'historie', label: 'Historie' },
];

const STATUS_STYLES = {
  active: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  inactive: { backgroundColor: theme.colors.warningLight, color: theme.colors.warning },
  beendet: { backgroundColor: theme.colors.errorLight, color: theme.colors.error },
};

const STATUS_LABELS = {
  active: 'Aktiv',
  inactive: 'Inaktiv',
  beendet: 'Beendet',
};

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
  },
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
    flexWrap: 'wrap',
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
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  tabsRow: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing['2xl']}`,
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
    padding: theme.spacing['2xl'],
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  errorBox: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
};

export default function SupplierDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [supplier, setSupplier] = useState(null);
  const [config, setConfig] = useState(null);
  const validTabs = TABS.map((t) => t.id);
  const initialTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'stammdaten';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadSupplier = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [supplierRes, configRes] = await Promise.all([
        apiGet(`${BASE}/suppliers/${id}`),
        apiGet(`${BASE}/config`),
      ]);

      if (!supplierRes.ok) throw new Error('Lieferant nicht gefunden');

      const supplierData = await supplierRes.json();
      setSupplier(supplierData.supplier);

      if (configRes.ok) {
        const configData = await configRes.json();
        setConfig(configData);
      }
    } catch (err) {
      console.error('Error loading supplier:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSupplier();
  }, [loadSupplier]);

  const handleUpdate = async (updates) => {
    try {
      const res = await apiPut(`${BASE}/suppliers/${id}`, updates);
      if (!res.ok) throw new Error('Update fehlgeschlagen');
      const data = await res.json();
      setSupplier(data.supplier);
    } catch (err) {
      console.error('Error updating supplier:', err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Lieferant wirklich loeschen?')) return;
    try {
      await apiDelete(`${BASE}/suppliers/${id}`);
      navigate('/apps/lieferantenmanagement?tab=suppliers');
    } catch (err) {
      console.error('Error deleting supplier:', err);
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>Laden...</div>;
  }

  if (error || !supplier) {
    return (
      <div style={{ padding: theme.spacing['2xl'] }}>
        <div style={styles.errorBox}>
          {error || 'Lieferant nicht gefunden'}
        </div>
      </div>
    );
  }

  const renderPanel = () => {
    try {
      switch (activeTab) {
        case 'stammdaten':
          return <StammdatenPanel supplier={supplier} onUpdate={handleUpdate} />;
        case 'leistungen':
          return <LeistungenPanel supplier={supplier} onUpdate={loadSupplier} config={config} />;
        case 'regulatorik':
          return <RegulatorikPanel supplier={supplier} onUpdate={loadSupplier} />;
        case 'dokumente':
          return <DokumentePanel supplier={supplier} />;
        case 'pruefungen':
          return <PruefungenPanel supplier={supplier} config={config} />;
        case 'historie':
          return <HistoriePanel supplier={supplier} />;
        default:
          return null;
      }
    } catch (err) {
      console.error('Panel render error:', err);
      return <div style={styles.errorBox}>Fehler beim Laden: {err.message}</div>;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button
          style={styles.backLink}
          onClick={() => navigate('/apps/lieferantenmanagement?tab=suppliers')}
        >
          <ArrowLeftIcon /> Lieferantenmanagement
        </button>

        <div style={styles.headerContent}>
          <div style={styles.headerLeft}>
            <h1 style={styles.headerTitle}>{supplier.firmenname}</h1>
            <div style={styles.headerSubtitle}>
              <span style={{
                ...styles.statusBadge,
                ...(STATUS_STYLES[supplier.status] || STATUS_STYLES.active),
              }}>
                {STATUS_LABELS[supplier.status] || supplier.status}
              </span>
              <span>|</span>
              <RiskBadge level={supplier.gesamtrisiko} size="small" />
              <span>|</span>
              <span>{supplier.leistungen?.filter((l) => l.status === 'active').length || 0} aktive Leistungen</span>
              {supplier.stammdaten?.kundennummer && (
                <>
                  <span>|</span>
                  <span>Nr. {supplier.stammdaten.kundennummer}</span>
                </>
              )}
            </div>
          </div>

          <div style={styles.headerActions}>
            <button style={styles.actionButton} onClick={handleDelete}>
              Loeschen
            </button>
          </div>
        </div>
      </div>

      <div style={styles.tabsRow}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              style={{
                ...styles.tab,
                ...(isActive ? styles.tabActive : {}),
              }}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={styles.content}>
        {renderPanel()}
      </div>
    </div>
  );
}

function ArrowLeftIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  );
}
