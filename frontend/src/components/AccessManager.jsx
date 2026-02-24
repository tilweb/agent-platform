/**
 * AccessManager Component
 *
 * Reusable component for managing resource access (RBAC).
 * Provides tabs for Users and Groups with add/edit/remove functionality.
 */

import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import { theme } from '../config/theme';
import { UserIcon, TrashIcon, SparklesIcon } from './Icons';
import Select from './Select';
import {
  useResourceAccess,
  useAvailableUsers,
  useAvailableGroups,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
} from '../hooks/useResourceAccess';

const styles = {
  container: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  },
  header: {
    padding: theme.spacing.lg,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: {
    fontSize: theme.typography.sizes.md,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    margin: 0,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
    margin: 0,
  },
  tabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
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
    padding: theme.spacing.lg,
  },
  addSection: {
    display: 'flex',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
  },
  addButton: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    transition: `background-color ${theme.transitions.fast}`,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  listItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryLight,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.primary,
    flexShrink: 0,
  },
  info: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    margin: 0,
  },
  meta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    margin: 0,
    marginTop: 2,
  },
  removeButton: {
    padding: theme.spacing.sm,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: `color ${theme.transitions.fast}`,
  },
  ownerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  empty: {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  error: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
  },
  noPermission: {
    padding: theme.spacing.lg,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
};

/**
 * AccessManager Component
 *
 * @param {string} resourceType - Type of resource (project, collection, etc.)
 * @param {string} resourceId - ID of the resource
 * @param {string} resourceName - Display name of the resource (optional)
 */
export default function AccessManager({ resourceType, resourceId, resourceName }) {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('users');
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedRole, setSelectedRole] = useState('viewer');

  const {
    users,
    groups,
    currentUser,
    loading,
    error,
    canManage,
    isOwner,
    addAccess,
    updateRole,
    removeAccess,
  } = useResourceAccess(resourceType, resourceId);

  const { users: availableUsers, refresh: refreshAvailableUsers } = useAvailableUsers(
    canManage ? resourceType : null,
    canManage ? resourceId : null
  );

  const { groups: availableGroups, refresh: refreshAvailableGroups } = useAvailableGroups(
    canManage ? resourceType : null,
    canManage ? resourceId : null
  );

  // Clear selected values when available options change
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedUser('');
  }, [availableUsers]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroup('');
  }, [availableGroups]);

  const handleAddUser = async () => {
    if (!selectedUser || !selectedRole) return;

    try {
      await addAccess('user', selectedUser, selectedRole);
      setSelectedUser('');
      refreshAvailableUsers();
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleAddGroup = async () => {
    if (!selectedGroup || !selectedRole) return;

    try {
      await addAccess('group', selectedGroup, selectedRole);
      setSelectedGroup('');
      refreshAvailableGroups();
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleUpdateRole = async (principalType, principalId, newRole) => {
    try {
      await updateRole(principalType, principalId, newRole);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleRemove = async (principalType, principalId) => {
    if (!confirm('Berechtigung wirklich entfernen?')) return;

    try {
      await removeAccess(principalType, principalId);
      if (principalType === 'user') {
        refreshAvailableUsers();
      } else {
        refreshAvailableGroups();
      }
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Berechtigungen werden geladen...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>{error}</div>
      </div>
    );
  }

  // Not authorized to view access
  if (!currentUser) {
    return (
      <div style={styles.container}>
        <div style={styles.noPermission}>
          Keine Berechtigung zum Anzeigen der Zugriffsrechte.
        </div>
      </div>
    );
  }

  const assignableRoles = isOwner
    ? ['admin', 'editor', 'viewer']
    : currentUser?.role === 'admin'
    ? ['admin', 'editor', 'viewer']
    : [];

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>Berechtigungen</h3>
        <p style={styles.subtitle}>
          {resourceName ? `Zugriffsrechte für ${resourceName}` : 'Zugriffsrechte verwalten'}
        </p>
      </div>

      <div style={styles.tabs}>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'users' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('users')}
        >
          Benutzer ({users.length})
        </button>
        <button
          style={{
            ...styles.tab,
            ...(activeTab === 'groups' ? styles.tabActive : {}),
          }}
          onClick={() => setActiveTab('groups')}
        >
          Gruppen ({groups.length})
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === 'users' && (
          <>
            {canManage && availableUsers.length > 0 && (
              <div style={styles.addSection}>
                <Select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  placeholder="Benutzer auswählen..."
                >
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.displayName || user.username}
                      {user.email ? ` (${user.email})` : ''}
                    </option>
                  ))}
                </Select>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  options={assignableRoles.map((role) => ({
                    value: role,
                    label: ROLE_LABELS[role],
                  }))}
                />
                <button
                  style={{
                    ...styles.addButton,
                    opacity: selectedUser ? 1 : 0.5,
                    cursor: selectedUser ? 'pointer' : 'not-allowed',
                  }}
                  onClick={handleAddUser}
                  disabled={!selectedUser}
                >
                  <SparklesIcon size={16} />
                  Hinzufügen
                </button>
              </div>
            )}

            <div style={styles.list}>
              {users.length === 0 ? (
                <div style={styles.empty}>
                  Keine Benutzer mit Zugriff
                </div>
              ) : (
                users.map((user) => (
                  <div key={user.principalId} style={styles.listItem}>
                    <div style={styles.avatar}>
                      <UserIcon size={18} />
                    </div>
                    <div style={styles.info}>
                      <p style={styles.name}>{user.displayName || user.username || 'Unbekannt'}</p>
                      {user.username && (
                        <p style={styles.meta}>@{user.username}</p>
                      )}
                    </div>
                    {user.role === 'owner' ? (
                      <span style={styles.ownerBadge}>
                        Eigentümer
                      </span>
                    ) : canManage ? (
                      <Select
                        value={user.role}
                        onChange={(e) => handleUpdateRole('user', user.principalId, e.target.value)}
                        options={assignableRoles.map((role) => ({
                          value: role,
                          label: ROLE_LABELS[role],
                        }))}
                      />
                    ) : (
                      <span style={styles.meta}>{ROLE_LABELS[user.role]}</span>
                    )}
                    {canManage && user.role !== 'owner' && (
                      <button
                        style={styles.removeButton}
                        onClick={() => handleRemove('user', user.principalId)}
                        title="Entfernen"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = theme.colors.error;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = theme.colors.textMuted;
                        }}
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}

        {activeTab === 'groups' && (
          <>
            {canManage && availableGroups.length > 0 && (
              <div style={styles.addSection}>
                <Select
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  placeholder="Gruppe auswählen..."
                >
                  {availableGroups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name} ({group.memberCount} Mitglieder)
                    </option>
                  ))}
                </Select>
                <Select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  options={assignableRoles.map((role) => ({
                    value: role,
                    label: ROLE_LABELS[role],
                  }))}
                />
                <button
                  style={{
                    ...styles.addButton,
                    opacity: selectedGroup ? 1 : 0.5,
                    cursor: selectedGroup ? 'pointer' : 'not-allowed',
                  }}
                  onClick={handleAddGroup}
                  disabled={!selectedGroup}
                >
                  <SparklesIcon size={16} />
                  Hinzufügen
                </button>
              </div>
            )}

            <div style={styles.list}>
              {groups.length === 0 ? (
                <div style={styles.empty}>
                  Keine Gruppen mit Zugriff
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.principalId} style={styles.listItem}>
                    <div style={{
                      ...styles.avatar,
                      backgroundColor: theme.colors.infoLight,
                      color: theme.colors.info,
                    }}>
                      <UserIcon size={18} />
                    </div>
                    <div style={styles.info}>
                      <p style={styles.name}>{group.name || 'Unbekannte Gruppe'}</p>
                      <p style={styles.meta}>{group.memberCount || 0} Mitglieder</p>
                    </div>
                    {canManage ? (
                      <Select
                        value={group.role}
                        onChange={(e) => handleUpdateRole('group', group.principalId, e.target.value)}
                        options={assignableRoles.map((role) => ({
                          value: role,
                          label: ROLE_LABELS[role],
                        }))}
                      />
                    ) : (
                      <span style={styles.meta}>{ROLE_LABELS[group.role]}</span>
                    )}
                    {canManage && (
                      <button
                        style={styles.removeButton}
                        onClick={() => handleRemove('group', group.principalId)}
                        title="Entfernen"
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = theme.colors.error;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = theme.colors.textMuted;
                        }}
                      >
                        <TrashIcon size={16} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
