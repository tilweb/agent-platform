/**
 * AppPermissionsBox — Settings-Section pro App.
 *
 * Zeigt zugewiesene Gruppen mit Rolle (Owner/Editor/Viewer), erlaubt
 * hinzufuegen/entfernen/Rolle aendern.
 *
 * Layout:
 *  Berechtigungen
 *  ⚠ "App ist aktiv aber noch keine Gruppen zugewiesen" (wenn leer)
 *  - [Gruppe A]      [Owner ▾]    [✕]
 *  - [Gruppe B]      [Editor ▾]   [✕]
 *  + Gruppe hinzufuegen
 */

import { useEffect, useState } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPut } from '../utils/apiFetch';

const ROLE_LABELS = {
  owner: 'Owner',
  editor: 'Bearbeiter',
  viewer: 'Betrachter',
};

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  warningRow: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 160px 32px',
    gap: theme.spacing.md,
    alignItems: 'center',
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
  },
  groupName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  select: {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  removeButton: {
    background: 'none',
    border: 'none',
    color: theme.colors.error,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.lg,
    padding: 0,
  },
  addButton: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: 'transparent',
    color: theme.colors.primary,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    transition: `all ${theme.transitions.fast}`,
  },
  empty: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
  },
  // Modal
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '480px',
    width: '90%',
    padding: theme.spacing['2xl'],
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
  },
  modalLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    display: 'block',
  },
  modalSelectFull: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  modalButtonPrimary: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  modalButtonCancel: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

export default function AppPermissionsBox({ appId }) {
  const [permissions, setPermissions] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [pickGroup, setPickGroup] = useState('');
  const [pickRole, setPickRole] = useState('viewer');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [permsRes, groupsRes] = await Promise.all([
          apiGet(`/apps/${appId}/permissions`),
          apiGet('/auth/groups'),
        ]);
        if (cancelled) return;
        const permsData = permsRes.ok ? await permsRes.json() : { permissions: [] };
        const groupsData = groupsRes.ok ? await groupsRes.json() : { groups: [] };
        setPermissions(permsData.permissions ?? []);
        setGroups(groupsData.groups ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [appId]);

  const groupName = (groupId) => groups.find((g) => g.id === groupId)?.name || groupId;

  const persist = async (next) => {
    setPermissions(next);
    await apiPut(`/apps/${appId}/permissions`, { permissions: next });
  };

  const updateRole = async (groupId, role) => {
    const next = permissions.map((p) => (p.groupId === groupId ? { ...p, role } : p));
    await persist(next);
  };

  const removePerm = async (groupId) => {
    const next = permissions.filter((p) => p.groupId !== groupId);
    await persist(next);
  };

  const addPerm = async () => {
    if (!pickGroup) return;
    if (permissions.some((p) => p.groupId === pickGroup)) {
      setShowAddModal(false);
      return;
    }
    const next = [...permissions, { groupId: pickGroup, role: pickRole }];
    await persist(next);
    setShowAddModal(false);
    setPickGroup('');
    setPickRole('viewer');
  };

  const availableGroups = groups.filter((g) => !permissions.some((p) => p.groupId === g.id));

  if (loading) {
    return (
      <div style={styles.card}>
        <div style={styles.title}>Berechtigungen</div>
        <div style={styles.empty}>Lade…</div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.title}>
        <KeyIcon /> Berechtigungen
      </div>

      {permissions.length === 0 && (
        <div style={styles.warningRow}>
          ⚠ Diese App ist aktiv, aber noch keine Gruppe wurde berechtigt. User sehen
          beim Aufruf "Wartet auf Konfiguration".
        </div>
      )}

      {permissions.length > 0 && (
        <div style={styles.list}>
          {permissions.map((perm) => (
            <div key={perm.groupId} style={styles.row}>
              <span style={styles.groupName}>{groupName(perm.groupId)}</span>
              <select
                style={styles.select}
                value={perm.role}
                onChange={(e) => updateRole(perm.groupId, e.target.value)}
              >
                <option value="owner">{ROLE_LABELS.owner}</option>
                <option value="editor">{ROLE_LABELS.editor}</option>
                <option value="viewer">{ROLE_LABELS.viewer}</option>
              </select>
              <button
                style={styles.removeButton}
                onClick={() => removePerm(perm.groupId)}
                title="Berechtigung entfernen"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {availableGroups.length > 0 && (
        <button
          style={styles.addButton}
          onClick={() => setShowAddModal(true)}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = theme.colors.primary; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.colors.border; }}
        >
          + Gruppe hinzufuegen
        </button>
      )}

      {showAddModal && (
        <div style={styles.overlay} onClick={() => setShowAddModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Gruppe berechtigen</div>

            <label style={styles.modalLabel}>Gruppe</label>
            <select
              style={styles.modalSelectFull}
              value={pickGroup}
              onChange={(e) => setPickGroup(e.target.value)}
            >
              <option value="">— bitte auswaehlen —</option>
              {availableGroups.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>

            <label style={styles.modalLabel}>Rolle</label>
            <select
              style={styles.modalSelectFull}
              value={pickRole}
              onChange={(e) => setPickRole(e.target.value)}
            >
              <option value="viewer">{ROLE_LABELS.viewer}</option>
              <option value="editor">{ROLE_LABELS.editor}</option>
              <option value="owner">{ROLE_LABELS.owner}</option>
            </select>

            <div style={styles.modalActions}>
              <button style={styles.modalButtonCancel} onClick={() => setShowAddModal(false)}>
                Abbrechen
              </button>
              <button style={styles.modalButtonPrimary} onClick={addPerm} disabled={!pickGroup}>
                Hinzufuegen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KeyIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}
