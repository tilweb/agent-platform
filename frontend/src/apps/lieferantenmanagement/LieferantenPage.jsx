/**
 * LieferantenPage - Main page with sidebar navigation
 * Pattern: SettingsPage.jsx
 */

import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { useSuppliers } from '../../hooks/useSuppliers';

import DashboardTab from './components/tabs/DashboardTab';
import SuppliersListTab from './components/tabs/SuppliersListTab';
import SupplierFormTab from './components/tabs/SupplierFormTab';
import RiskMatrixTab from './components/tabs/RiskMatrixTab';
import ComplianceTab from './components/tabs/ComplianceTab';
import DoraTab from './components/tabs/DoraTab';
import AuditPlanTab from './components/tabs/AuditPlanTab';
import AuditsListTab from './components/tabs/AuditsListTab';
import SettingsTab from './components/tabs/SettingsTab';

const TABS = [
  { id: 'divider-overview', type: 'divider', label: 'Uebersicht' },
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon },

  { id: 'divider-suppliers', type: 'divider', label: 'Lieferanten' },
  { id: 'suppliers', label: 'Alle Lieferanten', icon: SuppliersIcon },
  { id: 'new', label: 'Neuer Lieferant', icon: PlusIcon },

  { id: 'divider-risk', type: 'divider', label: 'Risiko & Compliance' },
  { id: 'risk-matrix', label: 'Risikomatrix', icon: MatrixIcon },
  { id: 'compliance', label: 'Compliance', icon: ShieldIcon },
  { id: 'dora', label: 'DORA', icon: LockIcon },

  { id: 'divider-audits', type: 'divider', label: 'Pruefungen' },
  { id: 'audit-plan', label: 'Auditplan', icon: CalendarIcon },
  { id: 'audits', label: 'Alle Pruefungen', icon: ChecklistIcon },

  { id: 'divider-settings', type: 'divider', label: 'Verwaltung' },
  { id: 'settings', label: 'Einstellungen', icon: SettingsIcon },
];

const styles = {
  container: {
    display: 'flex',
    height: '100%',
  },
  sidebar: {
    width: '240px',
    minWidth: '240px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    paddingTop: theme.spacing.xl,
    paddingLeft: theme.spacing.lg,
  },
  sidebarHeader: {
    paddingLeft: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  tabsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    padding: theme.spacing.md,
    overflowY: 'auto',
    flex: 1,
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    textAlign: 'left',
    width: '100%',
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  tabIcon: {
    width: '18px',
    height: '18px',
    flexShrink: 0,
  },
  tabDivider: {
    padding: `${theme.spacing.lg} ${theme.spacing.md} ${theme.spacing.sm}`,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: theme.spacing.md,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: theme.colors.background,
  },
  embeddedPage: {
    height: '100%',
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
};

export default function LieferantenPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';
  const { suppliers, stats, config, isLoading, refresh, refreshConfig } = useSuppliers();

  const setActiveTab = (tabId, filters = {}) => {
    const params = { tab: tabId };
    if (filters.status) params.status = filters.status;
    if (filters.risk) params.risk = filters.risk;
    if (filters.dora) params.dora = filters.dora;
    setSearchParams(params);
  };

  // Read filter params from URL for SuppliersListTab
  const listFilters = {
    status: searchParams.get('status') || '',
    risk: searchParams.get('risk') || '',
    dora: searchParams.get('dora') || '',
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab stats={stats} suppliers={suppliers} onNavigate={setActiveTab} />;
      case 'suppliers':
        return <SuppliersListTab suppliers={suppliers} isLoading={isLoading} onRefresh={refresh} config={config} initialFilters={listFilters} />;
      case 'new':
        return <SupplierFormTab onCreated={() => { refresh(); setActiveTab('suppliers'); }} />;
      case 'risk-matrix':
        return <RiskMatrixTab />;
      case 'compliance':
        return <ComplianceTab />;
      case 'dora':
        return <DoraTab />;
      case 'audit-plan':
        return <AuditPlanTab config={config} />;
      case 'audits':
        return <AuditsListTab config={config} />;
      case 'settings':
        return <SettingsTab config={config} onConfigUpdate={() => refreshConfig()} />;
      default:
        return <DashboardTab stats={stats} suppliers={suppliers} onNavigate={setActiveTab} />;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h1 style={styles.title}>Lieferanten</h1>
          <p style={styles.subtitle}>Lieferantenmanagement</p>
        </div>

        <div style={styles.tabsContainer}>
          {TABS.map((tab) => {
            if (tab.type === 'divider') {
              return <div key={tab.id} style={styles.tabDivider}>{tab.label}</div>;
            }

            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;

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
                <IconComponent style={styles.tabIcon} color={isActive ? theme.colors.primary : theme.colors.textMuted} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.embeddedPage}>
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

// Local icon components
function DashboardIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function SuppliersIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PlusIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function MatrixIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M3 3v18h18" />
      <rect x="7" y="13" width="3" height="5" rx="0.5" fill={color} opacity="0.3" />
      <rect x="12" y="9" width="3" height="9" rx="0.5" fill={color} opacity="0.3" />
      <rect x="17" y="5" width="3" height="13" rx="0.5" fill={color} opacity="0.3" />
    </svg>
  );
}

function ShieldIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function LockIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function CalendarIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ChecklistIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function SettingsIcon({ style, color }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}
