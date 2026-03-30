import { useState, useCallback } from 'react';
import { theme } from '../../../../config/theme';
import MetaDatenSection from '../eingabe/MetaDatenSection';
import KundeSection from '../eingabe/KundeSection';
import ProduktSection from '../eingabe/ProduktSection';
import LieferantenSection from '../eingabe/LieferantenSection';
import ProzessschritteSection from '../eingabe/ProzessschritteSection';
import InformationsflussSection from '../eingabe/InformationsflussSection';
import PersonalSection from '../eingabe/PersonalSection';

const SECTIONS = [
  { id: 'meta_daten', label: 'Meta-Daten', icon: 'clipboard' },
  { id: 'kunde', label: 'Kunde', icon: 'building' },
  { id: 'produkt_info', label: 'Produkt', icon: 'box' },
  { id: 'lieferanten', label: 'Lieferanten', icon: 'truck' },
  { id: 'prozessschritte', label: 'Prozessschritte', icon: 'cog' },
  { id: 'informationsfluss', label: 'Informationsfluss', icon: 'signal' },
  { id: 'personal', label: 'Personal', icon: 'users' },
];

const styles = {
  container: {
    display: 'flex',
    height: '100%',
  },
  sidebar: {
    width: '220px',
    minWidth: '220px',
    paddingTop: theme.spacing.xl,
    paddingLeft: theme.spacing.md,
    borderRight: `1px solid ${theme.colors.border}`,
  },
  sidebarTitle: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    marginBottom: theme.spacing.sm,
  },
  navItem: {
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
    textAlign: 'left',
    width: '100%',
    transition: `all ${theme.transitions.fast}`,
  },
  navItemActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  saveBar: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    padding: `${theme.spacing.lg} 0`,
    borderTop: `1px solid ${theme.colors.border}`,
    marginTop: theme.spacing.xl,
  },
  saveButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  savedMessage: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.success,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
};

function SectionIcon({ id }) {
  const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2 };
  switch (id) {
    case 'meta_daten':
      return <svg {...iconProps}><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" ry="1" /></svg>;
    case 'kunde':
      return <svg {...iconProps}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
    case 'produkt_info':
      return <svg {...iconProps}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" /></svg>;
    case 'lieferanten':
      return <svg {...iconProps}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></svg>;
    case 'prozessschritte':
      return <svg {...iconProps}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
    case 'informationsfluss':
      return <svg {...iconProps}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case 'personal':
      return <svg {...iconProps}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>;
    default:
      return null;
  }
}

export default function EingabeTab({ vsmData, onSave }) {
  const [activeSection, setActiveSection] = useState('meta_daten');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(async (section, data) => {
    setSaving(true);
    setSaved(false);
    try {
      await onSave(section, data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      setSaving(false);
    }
  }, [onSave]);

  const renderSection = () => {
    const props = { data: vsmData, onSave: handleSave, saving, saved };
    switch (activeSection) {
      case 'meta_daten': return <MetaDatenSection {...props} />;
      case 'kunde': return <KundeSection {...props} />;
      case 'produkt_info': return <ProduktSection {...props} />;
      case 'lieferanten': return <LieferantenSection {...props} />;
      case 'prozessschritte': return <ProzessschritteSection {...props} />;
      case 'informationsfluss': return <InformationsflussSection {...props} />;
      case 'personal': return <PersonalSection {...props} />;
      default: return null;
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>Datenbereiche</div>
        {SECTIONS.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              style={{ ...styles.navItem, ...(isActive ? styles.navItemActive : {}) }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
            >
              <SectionIcon id={section.id} />
              <span>{section.label}</span>
            </button>
          );
        })}
      </div>
      <div style={styles.content}>
        {renderSection()}
      </div>
    </div>
  );
}
