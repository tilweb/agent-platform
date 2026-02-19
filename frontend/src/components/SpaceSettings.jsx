/**
 * SpaceSettings Component
 *
 * Space settings management.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../config/theme';
import { useSpaces } from '../hooks/useSpaces';
import { TrashIcon, ArchiveIcon } from './Icons';

const styles = {
  container: {},
  section: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  sectionDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.lg,
  },
  settingRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  settingRowLast: {
    borderBottom: 'none',
  },
  settingLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  settingDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  checkbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    accentColor: '#9333ea',
  },
  dangerSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid #ef444430`,
    padding: theme.spacing.xl,
  },
  dangerTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: '#ef4444',
    marginBottom: theme.spacing.lg,
  },
  dangerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  dangerRowLast: {
    borderBottom: 'none',
  },
  dangerLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  dangerDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  dangerButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: '#ef4444',
    border: `1px solid #ef444430`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  archiveButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
};

export default function SpaceSettings({ space, onUpdateSettings, onRefresh }) {
  const navigate = useNavigate();
  const { deleteSpace, archiveSpace, unarchiveSpace } = useSpaces();
  const [isDeleting, setIsDeleting] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  const settings = space.settings || {};

  const handleSettingChange = async (key, value) => {
    try {
      await onUpdateSettings({ [key]: value });
    } catch (err) {
      console.error('Failed to update setting:', err);
    }
  };

  const handleArchive = async () => {
    if (!confirm(space.archived
      ? 'Space wieder aktivieren?'
      : 'Space archivieren? Er wird nicht mehr in der Uebersicht angezeigt.')) return;

    setIsArchiving(true);
    try {
      if (space.archived) {
        await unarchiveSpace(space.id);
      } else {
        await archiveSpace(space.id);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to archive:', err);
    } finally {
      setIsArchiving(false);
    }
  };

  const handleDelete = async () => {
    const confirmText = `Space "${space.name}" wirklich loeschen? Diese Aktion kann nicht rueckgaengig gemacht werden!`;
    if (!confirm(confirmText)) return;

    // Double confirmation
    if (!confirm('Bist du sicher? Alle Daten werden unwiderruflich geloescht.')) return;

    setIsDeleting(true);
    try {
      await deleteSpace(space.id);
      navigate('/spaces');
    } catch (err) {
      console.error('Failed to delete:', err);
      alert('Fehler beim Loeschen: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Chat Settings */}
      <div style={styles.section}>
        <h3 style={styles.sectionTitle}>Chat-Einstellungen</h3>
        <p style={styles.sectionDescription}>
          Konfiguriere, wie der Assistent im Space-Kontext arbeitet.
        </p>

        <div style={styles.settingRow}>
          <div>
            <div style={styles.settingLabel}>Memory in Prompts einbinden</div>
            <div style={styles.settingDescription}>
              Space-Memory (Fakten, Anweisungen, Phasen) wird automatisch im Chat-Kontext beruecksichtigt.
            </div>
          </div>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={settings.include_memory_in_prompt !== false}
            onChange={(e) => handleSettingChange('include_memory_in_prompt', e.target.checked)}
          />
        </div>

        <div style={{ ...styles.settingRow, ...styles.settingRowLast }}>
          <div>
            <div style={styles.settingLabel}>Knowledge Base in Prompts einbinden</div>
            <div style={styles.settingDescription}>
              Verknuepfte KB-Collections werden bei RAG-Suchen priorisiert.
            </div>
          </div>
          <input
            type="checkbox"
            style={styles.checkbox}
            checked={settings.include_kb_in_prompt !== false}
            onChange={(e) => handleSettingChange('include_kb_in_prompt', e.target.checked)}
          />
        </div>
      </div>

      {/* Danger Zone */}
      <div style={styles.dangerSection}>
        <h3 style={styles.dangerTitle}>Gefahrenzone</h3>

        <div style={styles.dangerRow}>
          <div>
            <div style={styles.dangerLabel}>
              {space.archived ? 'Space reaktivieren' : 'Space archivieren'}
            </div>
            <div style={styles.dangerDescription}>
              {space.archived
                ? 'Der Space wird wieder in der Uebersicht angezeigt.'
                : 'Archivierte Spaces werden ausgeblendet, bleiben aber erhalten.'}
            </div>
          </div>
          <button
            style={styles.archiveButton}
            onClick={handleArchive}
            disabled={isArchiving}
          >
            <ArchiveIcon size={16} />
            {isArchiving
              ? 'Bitte warten...'
              : space.archived
                ? 'Reaktivieren'
                : 'Archivieren'}
          </button>
        </div>

        <div style={{ ...styles.dangerRow, ...styles.dangerRowLast }}>
          <div>
            <div style={styles.dangerLabel}>Space loeschen</div>
            <div style={styles.dangerDescription}>
              Der Space und alle zugehoerigen Daten werden unwiderruflich geloescht.
            </div>
          </div>
          <button
            style={styles.dangerButton}
            onClick={handleDelete}
            disabled={isDeleting}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#ef444415'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <TrashIcon size={16} />
            {isDeleting ? 'Loesche...' : 'Loeschen'}
          </button>
        </div>
      </div>
    </div>
  );
}
