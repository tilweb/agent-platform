/**
 * SettingsPage
 *
 * User settings and account management page with tabs for admin settings.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { theme } from '../config/theme';
import { useAuth } from '../context/AuthContext';
import ProvidersPage from './ProvidersPage';
import McpServersPage from './McpServersPage';
import ConnectionsPage from './ConnectionsPage';
import AuditLogPage from './AuditLogPage';
import UsagePage from './UsagePage';
import { useApps } from '../context/AppsContext';
import SchemaEditor from '../apps/vertragsmanagement/SchemaEditor';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/apiFetch';
import { useUserPreferences } from '../hooks/useUserPreferences';
import { useProviders } from '../hooks/useProviders';
import { formatDateTime } from '../utils/dateFormat';
import { useToast } from '../components/Toast';
import Select from '../components/Select';

const styles = {
  container: {
    display: 'flex',
    height: '100%',
  },
  // Left Sidebar
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
  tabLabel: {
    flex: 1,
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
  // Main Content
  content: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: theme.colors.background,
  },
  profileContent: {
    padding: theme.spacing['2xl'],
    maxWidth: '800px',
  },
  section: {
    marginBottom: theme.spacing['2xl'],
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  sectionIcon: {
    width: '20px',
    height: '20px',
    color: theme.colors.primary,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${theme.spacing.md} 0`,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
  },
  infoRowLast: {
    borderBottom: 'none',
  },
  infoLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.weights.medium,
  },
  infoValue: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  avatar: {
    width: '80px',
    height: '80px',
    borderRadius: theme.borderRadius.full,
    background: `linear-gradient(135deg, ${theme.colors.primary} 0%, ${theme.colors.primaryDark} 100%)`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    marginBottom: theme.spacing.lg,
  },
  userName: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  userEmail: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  profileSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    paddingBottom: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  comingSoon: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginLeft: theme.spacing.sm,
  },
  embeddedPage: {
    height: '100%',
    padding: theme.spacing['2xl'],
    overflow: 'auto',
  },
  // Modal styles
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing.xl,
    maxWidth: '500px',
    width: '90%',
  },
  input: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    outline: 'none',
  },
  primaryButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  cancelButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  dangerButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.error,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

const TABS = [
  // User section
  { id: 'profile', label: 'Profil', icon: UserIcon },
  { id: 'mymodels', label: 'Meine Modelle', icon: ProvidersIcon },
  // Admin section - Users
  { id: 'divider-users', type: 'divider', label: 'Benutzerverwaltung', adminOnly: true },
  { id: 'users', label: 'Benutzer', icon: UsersIcon, adminOnly: true },
  { id: 'groups', label: 'Benutzergruppen', icon: GroupIcon, adminOnly: true },
  // Admin section - System
  { id: 'divider-system', type: 'divider', label: 'System', adminOnly: true },
  { id: 'providers', label: 'KI-Modelle', icon: ProvidersIcon, adminOnly: true },
  { id: 'mcp', label: 'MCP Server', icon: McpIcon, adminOnly: true },
  { id: 'connections', label: 'Connections', icon: ConnectionsIcon, adminOnly: true },
  { id: 'apps', label: 'Apps', icon: AppsIcon, adminOnly: true },
  // Admin section - Monitoring
  { id: 'divider-monitoring', type: 'divider', label: 'Monitoring', adminOnly: true },
  { id: 'usage', label: 'Nutzung', icon: UsageIcon, adminOnly: true },
  { id: 'audit', label: 'Audit Log', icon: AuditIcon, adminOnly: true },
];

function SettingsPage() {
  const { user } = useAuth();
  const { apps, toggleApp, reorderApps } = useApps();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'profile';
  const isAdmin = user?.role === 'admin';
  const [selectedAppConfig, setSelectedAppConfig] = useState(null);

  // App reorder state
  const [draggedAppId, setDraggedAppId] = useState(null);
  // { id, half: 'top' | 'bottom' } — which row and which half the cursor is in
  const [dropTarget, setDropTarget] = useState(null);

  const handleAppDragStart = (e, appId) => {
    e.dataTransfer.setData('text/plain', appId);
    e.dataTransfer.effectAllowed = 'move';
    requestAnimationFrame(() => setDraggedAppId(appId));
  };

  const handleAppDragOver = (e, appId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (appId === draggedAppId) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const half = e.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom';
    setDropTarget((prev) =>
      prev?.id === appId && prev?.half === half ? prev : { id: appId, half }
    );
  };

  const handleAppDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDropTarget(null);
    }
  };

  const handleAppDrop = async (e) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain');
    const target = dropTarget;
    setDropTarget(null);
    setDraggedAppId(null);

    if (!sourceId || !target || sourceId === target.id) return;

    const currentOrder = apps.map((a) => a.id);
    const fromIndex = currentOrder.indexOf(sourceId);
    let toIndex = currentOrder.indexOf(target.id);
    if (fromIndex === -1 || toIndex === -1) return;

    // Remove source first
    currentOrder.splice(fromIndex, 1);
    // Recalculate target index after removal
    toIndex = currentOrder.indexOf(target.id);
    // Insert before or after depending on half
    const insertAt = target.half === 'bottom' ? toIndex + 1 : toIndex;
    currentOrder.splice(insertAt, 0, sourceId);

    try {
      await reorderApps(currentOrder);
    } catch (err) {
      console.error('Error reordering apps:', err);
    }
  };

  const handleAppDragEnd = () => {
    setDraggedAppId(null);
    setDropTarget(null);
  };

  const handleMoveApp = async (appId, direction) => {
    const currentOrder = apps.map((a) => a.id);
    const index = currentOrder.indexOf(appId);
    if (index === -1) return;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;

    currentOrder.splice(index, 1);
    currentOrder.splice(newIndex, 0, appId);

    try {
      await reorderApps(currentOrder);
    } catch (err) {
      console.error('Error reordering apps:', err);
    }
  };

  // User model preferences
  const {
    preferences: userModelPrefs,
    systemDefaults,
    isLoading: prefsLoading,
    setPreference: setModelPreference,
    clearPreference: clearModelPreference,
  } = useUserPreferences();

  // Available models for selection
  const { providers, enabledProviders } = useProviders();

  // User management state
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({ username: '', email: '', displayName: '', role: 'user' });
  const [createdPassword, setCreatedPassword] = useState(null);
  const [resetPassword, setResetPassword] = useState(null); // { userId, password }
  const [userToDelete, setUserToDelete] = useState(null);

  // Group management state
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(false);
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newGroup, setNewGroup] = useState({ name: '', description: '', color: '' });
  const [editingGroup, setEditingGroup] = useState(null); // Group being edited (for members)
  const [groupToDelete, setGroupToDelete] = useState(null);

  const toast = useToast();

  // Load users when tab is active
  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const response = await apiGet('/auth/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Error loading users:', err);
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  // Load groups
  const loadGroups = useCallback(async () => {
    if (!isAdmin) return;
    setGroupsLoading(true);
    try {
      const response = await apiGet('/auth/groups');
      const data = await response.json();
      setGroups(data.groups || []);
    } catch (err) {
      console.error('Error loading groups:', err);
    } finally {
      setGroupsLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    if (activeTab === 'users' && isAdmin) {
      loadUsers();
    }
  }, [activeTab, isAdmin, loadUsers]);

  useEffect(() => {
    if (activeTab === 'groups' && isAdmin) {
      loadGroups();
      loadUsers(); // Also load users for member selection
    }
  }, [activeTab, isAdmin, loadGroups, loadUsers]);

  // Filter tabs based on admin status
  const visibleTabs = TABS.filter((tab) => !tab.adminOnly || isAdmin);

  const handleTabChange = (tabId) => {
    setSearchParams({ tab: tabId });
  };

  // Get user initials for avatar
  const getInitials = () => {
    if (!user) return '?';
    if (user.displayName) {
      const parts = user.displayName.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
      }
      return user.displayName.slice(0, 2).toUpperCase();
    }
    return user.username?.slice(0, 2).toUpperCase() || '?';
  };

  // formatDateTime is imported from utils/dateFormat
  const formatDate = formatDateTime;

  // User management handlers
  const handleCreateUser = async () => {
    if (!newUser.username.trim()) return;
    try {
      const response = await apiPost('/auth/users', newUser);
      const data = await response.json();
      if (data.success) {
        setCreatedPassword({ username: data.user.username, password: data.initialPassword });
        setShowAddUser(false);
        setNewUser({ username: '', email: '', displayName: '', role: 'user' });
        loadUsers();
        toast.success('Erstellt', 'Benutzer erstellt');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Erstellen');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      toast.error('Fehler', 'Fehler beim Erstellen des Benutzers');
    }
  };

  const handleUpdateUserRole = async (userId, newRole) => {
    try {
      const response = await apiPut(`/auth/users/${userId}`, { role: newRole });
      const data = await response.json();
      if (data.success) {
        loadUsers();
        toast.success('Aktualisiert', 'Benutzer aktualisiert');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Aktualisieren');
      }
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  const handleToggleUserActive = async (userId, isActive) => {
    try {
      const response = await apiPut(`/auth/users/${userId}`, { isActive });
      const data = await response.json();
      if (data.success) {
        loadUsers();
        toast.success('Aktualisiert', 'Benutzer aktualisiert');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Aktualisieren');
      }
    } catch (err) {
      console.error('Error updating user:', err);
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const response = await apiPost(`/auth/users/${userId}/reset-password`);
      const data = await response.json();
      if (data.success) {
        const targetUser = users.find(u => u.id === userId);
        setResetPassword({ username: targetUser?.username, password: data.newPassword });
        toast.success('Zurückgesetzt', 'Passwort zurückgesetzt');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Zurücksetzen');
      }
    } catch (err) {
      console.error('Error resetting password:', err);
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      const response = await apiDelete(`/auth/users/${userId}`);
      const data = await response.json();
      if (data.success) {
        setUserToDelete(null);
        loadUsers();
        toast.success('Gelöscht', 'Benutzer gelöscht');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Löschen');
      }
    } catch (err) {
      console.error('Error deleting user:', err);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Group management handlers
  const handleCreateGroup = async () => {
    if (!newGroup.name.trim()) return;
    try {
      const response = await apiPost('/auth/groups', newGroup);
      const data = await response.json();
      if (data.success) {
        setShowAddGroup(false);
        setNewGroup({ name: '', description: '', color: '' });
        loadGroups();
        toast.success('Erstellt', 'Gruppe erstellt');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Erstellen');
      }
    } catch (err) {
      console.error('Error creating group:', err);
      toast.error('Fehler', 'Fehler beim Erstellen der Gruppe');
    }
  };

  const handleUpdateGroupMembers = async (groupId, memberIds) => {
    try {
      const response = await apiPut(`/auth/groups/${groupId}`, { memberIds });
      const data = await response.json();
      if (data.success) {
        loadGroups();
        if (editingGroup?.id === groupId) {
          setEditingGroup(data.group);
        }
        toast.success('Aktualisiert', 'Gruppe aktualisiert');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Aktualisieren');
      }
    } catch (err) {
      console.error('Error updating group members:', err);
    }
  };

  const handleDeleteGroup = async (groupId) => {
    try {
      const response = await apiDelete(`/auth/groups/${groupId}`);
      const data = await response.json();
      if (data.success) {
        setGroupToDelete(null);
        loadGroups();
        toast.success('Gelöscht', 'Gruppe gelöscht');
      } else {
        toast.error('Fehler', data.error || 'Fehler beim Löschen');
      }
    } catch (err) {
      console.error('Error deleting group:', err);
    }
  };

  const renderTabContent = () => {
    // Check if current tab requires admin and user is not admin
    const currentTab = TABS.find(t => t.id === activeTab);
    if (currentTab?.adminOnly && !isAdmin) {
      return (
        <div style={styles.profileContent}>
          <div style={styles.card}>
            <div style={{ textAlign: 'center', padding: theme.spacing.xl }}>
              <LockIcon style={{ width: '48px', height: '48px', color: theme.colors.textMuted, marginBottom: theme.spacing.md }} />
              <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.base }}>
                Dieser Bereich ist nur für Administratoren zugänglich.
              </p>
            </div>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'mymodels':
        return renderMyModelsContent();
      case 'users':
        return renderUsersContent();
      case 'groups':
        return renderGroupsContent();
      case 'providers':
        return (
          <div style={styles.embeddedPage}>
            <ProvidersPage embedded />
          </div>
        );
      case 'mcp':
        return (
          <div style={styles.embeddedPage}>
            <McpServersPage embedded />
          </div>
        );
      case 'connections':
        return (
          <div style={styles.embeddedPage}>
            <ConnectionsPage embedded />
          </div>
        );
      case 'apps':
        return renderAppsContent();
      case 'usage':
        return (
          <div style={styles.embeddedPage}>
            <UsagePage embedded />
          </div>
        );
      case 'audit':
        return (
          <div style={styles.embeddedPage}>
            <AuditLogPage embedded />
          </div>
        );
      case 'profile':
      default:
        return renderProfileContent();
    }
  };

  // Helper: Get model info for display
  const getModelDisplayInfo = (providerId, modelId) => {
    if (!providerId || !modelId) return null;
    const provider = providers.find(p => p.id === providerId);
    if (!provider) return null;
    const model = provider.models.find(m => m.id === modelId);
    if (!model) return null;
    return { providerName: provider.name, modelName: model.name };
  };

  // Helper: Get models suitable for a purpose (filters disabled models)
  const getModelsForPurposeLocal = (purpose) => {
    const results = [];
    for (const provider of enabledProviders) {
      for (const model of provider.models) {
        if (model.enabled === false) continue;
        let matches = false;
        if (purpose === 'chat') {
          matches = (model.type === 'llm' || model.type === 'vllm') && model.capabilities?.includes('chat');
        } else if (purpose === 'vision') {
          matches = model.capabilities?.includes('vision');
        } else if (purpose === 'tts') {
          matches = model.type === 'tts';
        } else if (purpose === 'stt') {
          matches = model.type === 'stt';
        } else if (purpose === 'text_to_image') {
          matches = model.type === 'image_gen' && model.capabilities?.includes('text_to_image');
        } else if (purpose === 'image_to_image') {
          matches = model.type === 'image_gen' && model.capabilities?.includes('image_to_image');
        }
        if (matches) {
          results.push({ provider, model });
        }
      }
    }
    return results;
  };

  const handleModelPreferenceChange = async (purpose, value) => {
    if (value === 'system') {
      await clearModelPreference(purpose);
    } else if (value) {
      const [providerId, modelId] = value.split('::');
      await setModelPreference(purpose, providerId, modelId);
    }
  };

  const renderMyModelsContent = () => {
    const modelPurposes = [
      { key: 'chat', label: 'Chat-Modell', description: 'Standard-Modell für Chat-Konversationen' },
      { key: 'vision', label: 'Vision-Modell', description: 'Modell für Bildanalyse und -verarbeitung' },
    ];

    return (
      <div style={styles.profileContent}>
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <ProvidersIcon style={styles.sectionIcon} />
            Meine Modelle
          </div>
          <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.xl }}>
            Wähle deine bevorzugten KI-Modelle. Diese überschreiben die System-Defaults nur für dich.
          </p>

          {prefsLoading ? (
            <div style={styles.card}>
              <p style={{ color: theme.colors.textMuted }}>Laden...</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
              {modelPurposes.map(({ key, label, description }) => {
                const userPref = userModelPrefs[key];
                const systemDefault = systemDefaults[key];
                const hasUserPref = !!(userPref?.provider_id && userPref?.model_id);
                const availableModels = getModelsForPurposeLocal(key);
                const systemDefaultInfo = getModelDisplayInfo(systemDefault?.provider_id, systemDefault?.model_id);

                return (
                  <div key={key} style={styles.card}>
                    <div style={{ marginBottom: theme.spacing.md }}>
                      <div style={{ fontSize: theme.typography.sizes.base, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.xs }}>
                        {label}
                      </div>
                      <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
                        {description}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
                      {/* Radio: System Default */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                        padding: theme.spacing.md,
                        borderRadius: theme.borderRadius.lg,
                        border: `1px solid ${!hasUserPref ? theme.colors.primary : theme.colors.border}`,
                        backgroundColor: !hasUserPref ? theme.colors.primaryLight : 'transparent',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="radio"
                          name={`model-${key}`}
                          checked={!hasUserPref}
                          onChange={() => handleModelPreferenceChange(key, 'system')}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                            System Default
                          </div>
                          <div style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                            {systemDefaultInfo ? `${systemDefaultInfo.providerName} - ${systemDefaultInfo.modelName}` : 'Nicht konfiguriert'}
                          </div>
                        </div>
                      </label>

                      {/* Radio: Own Selection */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing.md,
                        padding: theme.spacing.md,
                        borderRadius: theme.borderRadius.lg,
                        border: `1px solid ${hasUserPref ? theme.colors.primary : theme.colors.border}`,
                        backgroundColor: hasUserPref ? theme.colors.primaryLight : 'transparent',
                        cursor: 'pointer',
                      }}>
                        <input
                          type="radio"
                          name={`model-${key}`}
                          checked={hasUserPref}
                          onChange={() => {
                            // Select first available if not already set
                            if (!hasUserPref && availableModels.length > 0) {
                              const first = availableModels[0];
                              handleModelPreferenceChange(key, `${first.provider.id}::${first.model.id}`);
                            }
                          }}
                          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                        />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text, marginBottom: theme.spacing.xs }}>
                            Eigene Auswahl
                          </div>
                          <Select
                            value={hasUserPref ? `${userPref.provider_id}::${userPref.model_id}` : ''}
                            onChange={(e) => handleModelPreferenceChange(key, e.target.value)}
                            disabled={!hasUserPref && availableModels.length === 0}
                          >
                            <option value="">Modell auswählen...</option>
                            {availableModels.map(({ provider, model }) => (
                              <option key={`${provider.id}::${model.id}`} value={`${provider.id}::${model.id}`}>
                                {provider.name} - {model.name}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderUsersContent = () => (
    <div style={styles.profileContent}>
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <div style={styles.sectionTitle}>
            <UsersIcon style={styles.sectionIcon} />
            Benutzer verwalten
          </div>
          <button
            style={{
              padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
              backgroundColor: theme.colors.primary,
              color: '#fff',
              border: 'none',
              borderRadius: theme.borderRadius.md,
              fontSize: theme.typography.sizes.sm,
              fontWeight: theme.typography.weights.medium,
              cursor: 'pointer',
            }}
            onClick={() => setShowAddUser(true)}
          >
            + Benutzer hinzufügen
          </button>
        </div>

        <div style={styles.card}>
          {usersLoading ? (
            <p style={{ color: theme.colors.textMuted }}>Laden...</p>
          ) : users.length === 0 ? (
            <p style={{ color: theme.colors.textMuted }}>Keine Benutzer gefunden.</p>
          ) : (
            users.map((u, index) => (
              <div
                key={u.id}
                style={{
                  ...styles.infoRow,
                  ...(index === users.length - 1 ? styles.infoRowLast : {}),
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                    <span style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
                      {u.displayName || u.username}
                    </span>
                    {!u.isActive && (
                      <span style={{
                        fontSize: theme.typography.sizes.xs,
                        padding: `2px ${theme.spacing.sm}`,
                        borderRadius: theme.borderRadius.full,
                        backgroundColor: theme.colors.errorLight,
                        color: theme.colors.error,
                      }}>
                        Deaktiviert
                      </span>
                    )}
                    {u.id === user?.id && (
                      <span style={{
                        fontSize: theme.typography.sizes.xs,
                        padding: `2px ${theme.spacing.sm}`,
                        borderRadius: theme.borderRadius.full,
                        backgroundColor: theme.colors.primaryLight,
                        color: theme.colors.primary,
                      }}>
                        Du
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                    @{u.username} {u.email && `• ${u.email}`}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                  <Select
                    value={u.role}
                    onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                    disabled={u.id === user?.id}
                    style={{ width: 'auto' }}
                    options={[
                      { value: 'user', label: 'User' },
                      { value: 'admin', label: 'Admin' },
                    ]}
                  />
                  <button
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: 'transparent',
                      color: theme.colors.primary,
                      border: `1px solid ${theme.colors.primary}30`,
                      borderRadius: theme.borderRadius.md,
                      fontSize: theme.typography.sizes.xs,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleResetPassword(u.id)}
                    title="Passwort zurücksetzen"
                  >
                    Passwort
                  </button>
                  {u.id !== user?.id && (
                    <>
                      <button
                        style={{
                          padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                          backgroundColor: 'transparent',
                          color: u.isActive ? theme.colors.warning : theme.colors.success,
                          border: `1px solid ${u.isActive ? theme.colors.warning : theme.colors.success}30`,
                          borderRadius: theme.borderRadius.md,
                          fontSize: theme.typography.sizes.xs,
                          cursor: 'pointer',
                        }}
                        onClick={() => handleToggleUserActive(u.id, !u.isActive)}
                      >
                        {u.isActive ? 'Deaktivieren' : 'Aktivieren'}
                      </button>
                      <button
                        style={{
                          padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                          backgroundColor: 'transparent',
                          color: theme.colors.error,
                          border: `1px solid ${theme.colors.error}30`,
                          borderRadius: theme.borderRadius.md,
                          fontSize: theme.typography.sizes.xs,
                          cursor: 'pointer',
                        }}
                        onClick={() => setUserToDelete(u)}
                      >
                        Löschen
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div style={styles.modalOverlay} onClick={() => setShowAddUser(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: theme.spacing.lg, color: theme.colors.text }}>Neuen Benutzer anlegen</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              <input
                type="text"
                placeholder="Benutzername *"
                value={newUser.username}
                onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Anzeigename"
                value={newUser.displayName}
                onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                style={styles.input}
              />
              <input
                type="email"
                placeholder="E-Mail"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                style={styles.input}
              />
              <Select
                value={newUser.role}
                onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                options={[
                  { value: 'user', label: 'User' },
                  { value: 'admin', label: 'Admin' },
                ]}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
              <button
                style={styles.cancelButton}
                onClick={() => setShowAddUser(false)}
              >
                Abbrechen
              </button>
              <button
                style={styles.primaryButton}
                onClick={handleCreateUser}
              >
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Display Modal */}
      {(createdPassword || resetPassword) && (
        <div style={styles.modalOverlay} onClick={() => { setCreatedPassword(null); setResetPassword(null); }}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: theme.spacing.md, color: theme.colors.text }}>
              {createdPassword ? 'Benutzer erstellt' : 'Passwort zurückgesetzt'}
            </h3>
            <p style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
              {createdPassword
                ? `Der Benutzer "${createdPassword.username}" wurde erstellt.`
                : `Das Passwort für "${resetPassword.username}" wurde zurückgesetzt.`
              }
            </p>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.md,
              padding: theme.spacing.md,
              backgroundColor: theme.colors.background,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
            }}>
              <code style={{ flex: 1, fontSize: theme.typography.sizes.base, fontFamily: 'monospace' }}>
                {createdPassword?.password || resetPassword?.password}
              </code>
              <button
                style={{
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                  backgroundColor: theme.colors.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: theme.borderRadius.md,
                  fontSize: theme.typography.sizes.sm,
                  cursor: 'pointer',
                }}
                onClick={() => copyToClipboard(createdPassword?.password || resetPassword?.password)}
              >
                Kopieren
              </button>
            </div>
            <p style={{ color: theme.colors.warning, fontSize: theme.typography.sizes.sm, marginTop: theme.spacing.md }}>
              Dieses Passwort wird nur einmal angezeigt. Bitte kopieren und sicher weitergeben.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme.spacing.xl }}>
              <button
                style={styles.primaryButton}
                onClick={() => { setCreatedPassword(null); setResetPassword(null); }}
              >
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirm Modal */}
      {userToDelete && (
        <div style={styles.modalOverlay} onClick={() => setUserToDelete(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: theme.spacing.md, color: theme.colors.text }}>Benutzer löschen</h3>
            <p style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
              Möchtest du den Benutzer <strong>"{userToDelete.displayName || userToDelete.username}"</strong> wirklich löschen?
              <br /><br />
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
              <button style={styles.cancelButton} onClick={() => setUserToDelete(null)}>
                Abbrechen
              </button>
              <button
                style={styles.dangerButton}
                onClick={() => handleDeleteUser(userToDelete.id)}
              >
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderGroupsContent = () => (
    <div style={styles.profileContent}>
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.lg }}>
          <div style={styles.sectionTitle}>
            <GroupIcon style={styles.sectionIcon} />
            Benutzergruppen
          </div>
          <button
            style={styles.primaryButton}
            onClick={() => setShowAddGroup(true)}
          >
            + Gruppe erstellen
          </button>
        </div>

        <div style={styles.card}>
          {groupsLoading ? (
            <p style={{ color: theme.colors.textMuted }}>Laden...</p>
          ) : groups.length === 0 ? (
            <p style={{ color: theme.colors.textMuted }}>Keine Gruppen vorhanden.</p>
          ) : (
            groups.map((group, index) => (
              <div
                key={group.id}
                style={{
                  ...styles.infoRow,
                  ...(index === groups.length - 1 ? styles.infoRowLast : {}),
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                    {group.color && (
                      <span style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: group.color,
                        flexShrink: 0,
                      }} />
                    )}
                    <span style={{ fontWeight: theme.typography.weights.semibold, color: theme.colors.text }}>
                      {group.name}
                    </span>
                    <span style={{
                      fontSize: theme.typography.sizes.xs,
                      padding: `2px ${theme.spacing.sm}`,
                      borderRadius: theme.borderRadius.full,
                      backgroundColor: theme.colors.surfaceHover,
                      color: theme.colors.textMuted,
                    }}>
                      {group.memberIds?.length || 0} Mitglieder
                    </span>
                  </div>
                  {group.description && (
                    <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                      {group.description}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                  <button
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: 'transparent',
                      color: theme.colors.primary,
                      border: `1px solid ${theme.colors.primary}30`,
                      borderRadius: theme.borderRadius.md,
                      fontSize: theme.typography.sizes.xs,
                      cursor: 'pointer',
                    }}
                    onClick={() => setEditingGroup(group)}
                  >
                    Mitglieder
                  </button>
                  <button
                    style={{
                      padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
                      backgroundColor: 'transparent',
                      color: theme.colors.error,
                      border: `1px solid ${theme.colors.error}30`,
                      borderRadius: theme.borderRadius.md,
                      fontSize: theme.typography.sizes.xs,
                      cursor: 'pointer',
                    }}
                    onClick={() => setGroupToDelete(group)}
                  >
                    Löschen
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Add Group Modal */}
      {showAddGroup && (
        <div style={styles.modalOverlay} onClick={() => setShowAddGroup(false)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: theme.spacing.lg, color: theme.colors.text }}>Neue Gruppe erstellen</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
              <input
                type="text"
                placeholder="Gruppenname *"
                value={newGroup.name}
                onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                style={styles.input}
              />
              <input
                type="text"
                placeholder="Beschreibung"
                value={newGroup.description}
                onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                style={styles.input}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.md }}>
                <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>Farbe:</span>
                <input
                  type="color"
                  value={newGroup.color || '#6366f1'}
                  onChange={(e) => setNewGroup({ ...newGroup, color: e.target.value })}
                  style={{ width: '40px', height: '32px', border: 'none', cursor: 'pointer' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm, marginTop: theme.spacing.xl }}>
              <button style={styles.cancelButton} onClick={() => setShowAddGroup(false)}>
                Abbrechen
              </button>
              <button style={styles.primaryButton} onClick={handleCreateGroup}>
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Group Members Modal */}
      {editingGroup && (
        <div style={styles.modalOverlay} onClick={() => setEditingGroup(null)}>
          <div style={{ ...styles.modalContent, maxWidth: '600px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: theme.spacing.lg, color: theme.colors.text }}>
              Mitglieder von "{editingGroup.name}"
            </h3>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {users.map((u) => {
                const isMember = editingGroup.memberIds?.includes(u.id);
                return (
                  <div
                    key={u.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: theme.spacing.sm,
                      borderBottom: `1px solid ${theme.colors.borderLight}`,
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: theme.typography.weights.medium, color: theme.colors.text }}>
                        {u.displayName || u.username}
                      </span>
                      <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginLeft: theme.spacing.sm }}>
                        @{u.username}
                      </span>
                    </div>
                    <button
                      style={{
                        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                        backgroundColor: isMember ? theme.colors.error : theme.colors.success,
                        color: '#fff',
                        border: 'none',
                        borderRadius: theme.borderRadius.md,
                        fontSize: theme.typography.sizes.xs,
                        cursor: 'pointer',
                      }}
                      onClick={() => {
                        const newMemberIds = isMember
                          ? editingGroup.memberIds.filter(id => id !== u.id)
                          : [...(editingGroup.memberIds || []), u.id];
                        handleUpdateGroupMembers(editingGroup.id, newMemberIds);
                      }}
                    >
                      {isMember ? 'Entfernen' : 'Hinzufügen'}
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: theme.spacing.xl }}>
              <button style={styles.primaryButton} onClick={() => setEditingGroup(null)}>
                Schließen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Group Confirm Modal */}
      {groupToDelete && (
        <div style={styles.modalOverlay} onClick={() => setGroupToDelete(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: theme.spacing.md, color: theme.colors.text }}>Gruppe löschen</h3>
            <p style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
              Möchtest du die Gruppe <strong>"{groupToDelete.name}"</strong> wirklich löschen?
              <br /><br />
              Die Benutzer in dieser Gruppe bleiben erhalten.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm }}>
              <button style={styles.cancelButton} onClick={() => setGroupToDelete(null)}>
                Abbrechen
              </button>
              <button style={styles.dangerButton} onClick={() => handleDeleteGroup(groupToDelete.id)}>
                Löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderAppConfig = (appId) => {
    switch (appId) {
      case 'vertragsmanagement':
        return <SchemaEditor />;
      default:
        return (
          <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
            Keine Konfiguration für diese App verfügbar.
          </p>
        );
    }
  };

  const renderAppsContent = () => (
    <div style={styles.profileContent}>
      {/* Back button when viewing app config */}
      {selectedAppConfig && (
        <button
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.xs,
            background: 'none',
            border: 'none',
            color: theme.colors.primary,
            fontSize: theme.typography.sizes.sm,
            fontWeight: theme.typography.weights.medium,
            cursor: 'pointer',
            padding: 0,
            marginBottom: theme.spacing.lg,
          }}
          onClick={() => setSelectedAppConfig(null)}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Zurück zur Übersicht
        </button>
      )}

      {selectedAppConfig ? (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <AppsIcon style={styles.sectionIcon} />
            {apps.find(a => a.id === selectedAppConfig)?.name || 'App'} - Konfiguration
          </div>
          <div style={styles.card}>
            {renderAppConfig(selectedAppConfig)}
          </div>
        </div>
      ) : (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <AppsIcon style={styles.sectionIcon} />
            Apps verwalten
          </div>
          <div style={styles.card}>
            {apps.length === 0 ? (
              <p style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                Keine Apps verfügbar.
              </p>
            ) : (
              apps.map((app, index) => {
                const isDropTop = dropTarget?.id === app.id && dropTarget?.half === 'top';
                const isDropBottom = dropTarget?.id === app.id && dropTarget?.half === 'bottom';
                return (
                <div key={app.id} style={{ position: 'relative' }}>
                  {/* Drop indicator line — top */}
                  {isDropTop && (
                    <div style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      backgroundColor: theme.colors.primary,
                      zIndex: 1,
                    }} />
                  )}
                  <div
                    draggable
                    onDragStart={(e) => handleAppDragStart(e, app.id)}
                    onDragOver={(e) => handleAppDragOver(e, app.id)}
                    onDragLeave={handleAppDragLeave}
                    onDrop={handleAppDrop}
                    onDragEnd={handleAppDragEnd}
                    style={{
                      ...styles.infoRow,
                      ...(index === apps.length - 1 ? styles.infoRowLast : {}),
                      ...(draggedAppId === app.id ? { opacity: 0.4 } : {}),
                      cursor: 'grab',
                    }}
                  >
                  {/* Drag Handle */}
                  <div style={{ display: 'flex', alignItems: 'center', marginRight: theme.spacing.md, color: theme.colors.textMuted }}>
                    <DragHandleIcon />
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ ...styles.infoValue, display: 'block', fontWeight: theme.typography.weights.semibold }}>{app.name}</span>
                    <span style={{ ...styles.infoLabel, fontSize: theme.typography.sizes.xs }}>
                      {app.description}
                    </span>
                  </div>
                  <div draggable={false} style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                    {/* Arrow Buttons */}
                    <button
                      draggable={false}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'none',
                        border: 'none',
                        cursor: index === 0 ? 'default' : 'pointer',
                        padding: theme.spacing.xs,
                        borderRadius: theme.borderRadius.md,
                        color: index === 0 ? theme.colors.borderLight : theme.colors.textMuted,
                      }}
                      onClick={() => handleMoveApp(app.id, -1)}
                      disabled={index === 0}
                      title="Nach oben"
                      onMouseEnter={(e) => {
                        if (index !== 0) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <ChevronUpIcon />
                    </button>
                    <button
                      draggable={false}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'none',
                        border: 'none',
                        cursor: index === apps.length - 1 ? 'default' : 'pointer',
                        padding: theme.spacing.xs,
                        borderRadius: theme.borderRadius.md,
                        color: index === apps.length - 1 ? theme.colors.borderLight : theme.colors.textMuted,
                      }}
                      onClick={() => handleMoveApp(app.id, 1)}
                      disabled={index === apps.length - 1}
                      title="Nach unten"
                      onMouseEnter={(e) => {
                        if (index !== apps.length - 1) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      <ChevronDownIcon />
                    </button>
                    <div style={{ width: '1px', height: '20px', backgroundColor: theme.colors.borderLight, margin: `0 ${theme.spacing.xs}` }} />
                    <button
                      draggable={false}
                      style={{
                        padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                        backgroundColor: 'transparent',
                        color: theme.colors.primary,
                        border: `1px solid ${theme.colors.primary}30`,
                        borderRadius: theme.borderRadius.md,
                        fontSize: theme.typography.sizes.xs,
                        fontWeight: theme.typography.weights.medium,
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedAppConfig(app.id)}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.primaryLight;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      Konfigurieren
                    </button>
                    <button
                      draggable={false}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: theme.spacing.sm,
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: theme.spacing.xs,
                        borderRadius: theme.borderRadius.md,
                      }}
                      onClick={() => toggleApp(app.id)}
                      title={app.enabled ? 'Deaktivieren' : 'Aktivieren'}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
                    >
                      {app.enabled ? <ToggleOnIcon /> : <ToggleOffIcon />}
                    </button>
                  </div>
                  </div>
                  {/* Drop indicator line — bottom */}
                  {isDropBottom && (
                    <div style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: '2px',
                      backgroundColor: theme.colors.primary,
                      zIndex: 1,
                    }} />
                  )}
                </div>
              );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );

  const renderProfileContent = () => (
    <div style={styles.profileContent}>
      {/* Profile Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <UserIcon style={styles.sectionIcon} />
          Profil
        </div>
        <div style={styles.card}>
          <div style={styles.profileSection}>
            <div style={styles.avatar}>
              {getInitials()}
            </div>
            <div style={styles.userName}>
              {user?.displayName || user?.username || 'Benutzer'}
            </div>
            {user?.email && (
              <div style={styles.userEmail}>{user.email}</div>
            )}
          </div>

          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Benutzername</span>
            <span style={styles.infoValue}>{user?.username || '-'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Anzeigename</span>
            <span style={styles.infoValue}>{user?.displayName || '-'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>E-Mail</span>
            <span style={styles.infoValue}>{user?.email || '-'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Rolle</span>
            <span style={styles.infoValue}>{user?.role || 'user'}</span>
          </div>
          <div style={{ ...styles.infoRow, ...styles.infoRowLast }}>
            <span style={styles.infoLabel}>Erstellt am</span>
            <span style={styles.infoValue}>{formatDate(user?.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <PreferencesIcon style={styles.sectionIcon} />
          Einstellungen
          <span style={styles.comingSoon}>(coming soon)</span>
        </div>
        <div style={styles.card}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Sprache</span>
            <span style={styles.infoValue}>Deutsch</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Theme</span>
            <span style={styles.infoValue}>Hell</span>
          </div>
          <div style={{ ...styles.infoRow, ...styles.infoRowLast }}>
            <span style={styles.infoLabel}>Benachrichtigungen</span>
            <span style={styles.infoValue}>Aktiviert</span>
          </div>
        </div>
      </div>

      {/* Security Section */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <SecurityIcon style={styles.sectionIcon} />
          Sicherheit
          <span style={styles.comingSoon}>(coming soon)</span>
        </div>
        <div style={styles.card}>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Passwort</span>
            <span style={styles.infoValue}>************</span>
          </div>
          <div style={{ ...styles.infoRow, ...styles.infoRowLast }}>
            <span style={styles.infoLabel}>Zwei-Faktor-Authentifizierung</span>
            <span style={styles.infoValue}>Deaktiviert</span>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={styles.container}>
      {/* Left Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h1 style={styles.title}>Einstellungen</h1>
          <p style={styles.subtitle}>Profil & System</p>
        </div>

        {/* Vertical Tabs */}
        <div style={styles.tabsContainer}>
          {visibleTabs.map((tab) => {
            // Render divider
            if (tab.type === 'divider') {
              return (
                <div key={tab.id} style={styles.tabDivider}>
                  {tab.label}
                </div>
              );
            }

            const IconComponent = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <IconComponent style={styles.tabIcon} />
                <span style={styles.tabLabel}>{tab.label}</span>
                {tab.adminOnly && (
                  <LockIcon style={{ width: '12px', height: '12px', opacity: 0.5 }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div style={styles.content}>
        {renderTabContent()}
      </div>
    </div>
  );
}

// Icons
function UserIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function UsersIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function GroupIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="7" r="3" />
      <circle cx="15" cy="7" r="3" />
      <path d="M5.5 21v-1.5a3.5 3.5 0 0 1 3.5-3.5h6a3.5 3.5 0 0 1 3.5 3.5V21" />
      <path d="M12 14a3.5 3.5 0 0 0-3.5-3.5" />
      <path d="M12 14a3.5 3.5 0 0 1 3.5-3.5" />
    </svg>
  );
}

function PreferencesIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

function SecurityIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function ProvidersIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
      <polyline points="7.5 19.79 7.5 14.6 3 12" />
      <polyline points="21 12 16.5 14.6 16.5 19.79" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  );
}

function McpIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function ConnectionsIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function AppsIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

function ToggleOnIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="16" cy="12" r="3" fill={theme.colors.success} />
    </svg>
  );
}

function ToggleOffIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
      <circle cx="8" cy="12" r="3" />
    </svg>
  );
}

function DragHandleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="15" cy="6" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="18" r="1.5" />
      <circle cx="15" cy="18" r="1.5" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="18 15 12 9 6 15" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function LockIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function AuditIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
}

function UsageIcon({ style }) {
  return (
    <svg style={style} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export default SettingsPage;
