/**
 * SpaceMembersList Component
 *
 * Manage space members with roles.
 */

import { useState } from 'react';
import { theme } from '../config/theme';
import { useToast } from '../components/Toast';
import { useSpaceMembers } from '../hooks/useSpaces';
import { useUsers } from '../hooks/useUsers';
import { useAuth } from '../context/AuthContext';
import { UserIcon, TrashIcon } from './Icons';
import Select from './Select';

const styles = {
  container: {},
  addSection: {
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
  addForm: {
    display: 'flex',
    gap: theme.spacing.md,
    alignItems: 'flex-end',
  },
  formGroup: {
    flex: 1,
  },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  addButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: '#9333ea',
    color: 'white',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    height: 'fit-content',
  },
  membersSection: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  membersList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  },
  memberCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.borderLight}`,
  },
  memberInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flex: 1,
  },
  avatar: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.full,
    backgroundColor: '#9333ea15',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#9333ea',
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    flexShrink: 0,
  },
  memberName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  memberEmail: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  memberActions: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  roleBadge: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  roleOwner: {
    backgroundColor: '#f59e0b20',
    color: '#f59e0b',
  },
  roleAdmin: {
    backgroundColor: '#3b82f620',
    color: '#3b82f6',
  },
  roleEditor: {
    backgroundColor: '#10b98120',
    color: '#10b981',
  },
  roleViewer: {
    backgroundColor: '#6b728020',
    color: '#6b7280',
  },
  removeButton: {
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    cursor: 'pointer',
    opacity: 0.6,
    transition: `all ${theme.transitions.fast}`,
  },
  emptyState: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
  },
  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: '#ef444420',
    color: '#ef4444',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
};

const ROLE_LABELS = {
  owner: 'Owner',
  admin: 'Admin',
  editor: 'Editor',
  viewer: 'Viewer',
};

const ROLE_STYLES = {
  owner: styles.roleOwner,
  admin: styles.roleAdmin,
  editor: styles.roleEditor,
  viewer: styles.roleViewer,
};

function getInitials(displayName) {
  if (!displayName) return '?';
  const parts = displayName.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return displayName.slice(0, 2).toUpperCase();
}

export default function SpaceMembersList({ spaceId }) {
  const toast = useToast();
  const { user: currentUser } = useAuth();
  const { members, loading, addMember, updateMemberRole, removeMember } = useSpaceMembers(spaceId);
  const { users, loading: usersLoading } = useUsers();

  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('editor');
  const [isAdding, setIsAdding] = useState(false);

  // Get current user's role in space
  const currentUserMember = members.find(m => m.userId === currentUser?.id);
  const canManageMembers = currentUserMember?.role === 'owner' || currentUserMember?.role === 'admin';

  // Filter out users who are already members
  const memberIds = new Set(members.map(m => m.userId));
  const availableUsers = users.filter(u => !memberIds.has(u.id));

  const handleAddMember = async () => {
    if (!selectedUserId) return;

    setIsAdding(true);
    try {
      await addMember(selectedUserId, selectedRole);
      setSelectedUserId('');
      setSelectedRole('editor');
    } catch (err) {
      toast.error('Fehler', err.message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await updateMemberRole(userId, newRole);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Mitglied wirklich entfernen?')) return;

    try {
      await removeMember(userId);
    } catch (err) {
      toast.error('Fehler', err.message);
    }
  };

  // Find user info for each member
  const getMemberInfo = (userId) => {
    return users.find(u => u.id === userId) || { id: userId, displayName: userId };
  };

  if (loading || usersLoading) {
    return <div style={styles.loading}>Lade Mitglieder...</div>;
  }

  return (
    <div style={styles.container}>
      {/* Add Member Section */}
      {canManageMembers && (
        <div style={styles.addSection}>
          <h3 style={styles.sectionTitle}>Mitglied hinzufuegen</h3>
          <div style={styles.addForm}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Benutzer</label>
              <Select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                placeholder="Benutzer waehlen..."
              >
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName} ({user.email || user.username})
                  </option>
                ))}
              </Select>
            </div>
            <div style={{ ...styles.formGroup, flex: '0 0 150px' }}>
              <label style={styles.label}>Rolle</label>
              <Select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                options={[
                  { value: 'admin', label: 'Admin' },
                  { value: 'editor', label: 'Editor' },
                  { value: 'viewer', label: 'Viewer' },
                ]}
              />
            </div>
            <button
              style={styles.addButton}
              onClick={handleAddMember}
              disabled={isAdding || !selectedUserId}
            >
              {isAdding ? 'Hinzufuegen...' : '+ Hinzufuegen'}
            </button>
          </div>
        </div>
      )}

      {/* Members List */}
      <div style={styles.membersSection}>
        <h3 style={styles.sectionTitle}>Mitglieder ({members.length})</h3>

        {members.length === 0 ? (
          <div style={styles.emptyState}>Keine Mitglieder vorhanden.</div>
        ) : (
          <div style={styles.membersList}>
            {members.map((member) => {
              const userInfo = getMemberInfo(member.userId);
              const isOwner = member.role === 'owner';
              const isCurrentUser = member.userId === currentUser?.id;
              const canModify = canManageMembers && !isOwner && !isCurrentUser;

              return (
                <div key={member.userId} style={styles.memberCard}>
                  <div style={styles.memberInfo}>
                    <div style={styles.avatar}>
                      {getInitials(userInfo.displayName)}
                    </div>
                    <div>
                      <div style={styles.memberName}>
                        {userInfo.displayName}
                        {isCurrentUser && ' (Du)'}
                      </div>
                      {userInfo.email && (
                        <div style={styles.memberEmail}>{userInfo.email}</div>
                      )}
                    </div>
                  </div>

                  <div style={styles.memberActions}>
                    {canModify ? (
                      <>
                        <Select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.userId, e.target.value)}
                          options={[
                            { value: 'admin', label: 'Admin' },
                            { value: 'editor', label: 'Editor' },
                            { value: 'viewer', label: 'Viewer' },
                          ]}
                        />
                        <button
                          style={styles.removeButton}
                          onClick={() => handleRemoveMember(member.userId)}
                          onMouseOver={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.color = theme.colors.textMuted;
                            e.currentTarget.style.opacity = '0.6';
                          }}
                        >
                          <TrashIcon size={16} />
                        </button>
                      </>
                    ) : (
                      <span style={{ ...styles.roleBadge, ...ROLE_STYLES[member.role] }}>
                        {ROLE_LABELS[member.role]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
