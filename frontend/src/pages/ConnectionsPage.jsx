import { useState } from 'react';
import { useConnections } from '../hooks/useConnections';
import { useAuth } from '../context/AuthContext';
import { theme } from '../config/theme';
import ReactMarkdown from 'react-markdown';
import PluginConfigForm from '../components/PluginConfigForm';
import { getProviderIcon } from '../components/Icons';
import { useToast } from '../components/Toast';

const styles = {
  container: {
    padding: theme.spacing['2xl'],
    width: '100%',
  },
  header: {
    marginBottom: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textMuted,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing.lg,
  },
  // Card
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    transition: `all ${theme.transitions.fast}`,
    display: 'flex',
    flexDirection: 'column',
  },
  cardDisabled: {
    opacity: 0.45,
  },
  // Header: Logo + Name + Toggle
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  logoCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: theme.spacing.xs,
    flexShrink: 0,
  },
  logo: {
    width: '40px',
    height: '40px',
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  versionBadge: {
    fontSize: '10px',
    color: theme.colors.textMuted,
    backgroundColor: theme.colors.surfaceHover,
    padding: `1px ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.full,
    fontWeight: theme.typography.weights.medium,
    lineHeight: 1.4,
  },
  cardTitleRow: {
    flex: 1,
    minWidth: 0,
  },
  cardName: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    lineHeight: 1.3,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: 2,
    lineHeight: 1.4,
  },
  // Toggle (oben rechts, wie SettingsPage "Apps verwalten")
  toggleButton: {
    display: 'flex',
    alignItems: 'center',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    flexShrink: 0,
  },
  // Status-Zeile: Dot + Text + Version
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  statusSeparator: {
    color: theme.colors.border,
    fontSize: theme.typography.sizes.xs,
  },
  versionText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  userInfo: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: `-${theme.spacing.sm}`,
    marginBottom: theme.spacing.lg,
  },
  // Actions
  actions: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  button: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  connectButton: {
    backgroundColor: theme.colors.primary,
    color: 'white',
  },
  disconnectButton: {
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
  },
  configureButton: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  linkButton: {
    width: '100%',
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
    transition: `color ${theme.transitions.fast}`,
  },
  // Allgemein
  loading: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  // Modal
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: theme.colors.background,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    maxWidth: '700px',
    width: '90%',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  modalTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  modalCloseButton: {
    background: 'none',
    border: 'none',
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    padding: theme.spacing.sm,
  },
  markdownContent: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    lineHeight: 1.6,
  },
  setupGuideSection: {
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
  },
  setupGuideToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    padding: 0,
  },
};

function getStatusColor(provider) {
  if (!provider.enabled) return theme.colors.textMuted;
  if (!provider.configured) return theme.colors.warning;
  if (!provider.status) return theme.colors.textMuted;
  switch (provider.status.status) {
    case 'connected': return theme.colors.success;
    case 'error':
    case 'expired': return theme.colors.error;
    default: return theme.colors.textMuted;
  }
}

function getStatusText(provider) {
  if (!provider.enabled) return 'Deaktiviert';
  if (!provider.configured) return 'Nicht konfiguriert';
  if (!provider.status) return 'Nicht verbunden';
  switch (provider.status.status) {
    case 'connected': return 'Verbunden';
    case 'error': return 'Fehler';
    case 'expired': return 'Abgelaufen';
    default: return 'Nicht verbunden';
  }
}

function ConnectionCard({ provider, isAdmin, onConnect, onDisconnect, onConfigure, onToggleEnabled, loading }) {
  const isConnected = provider.status?.status === 'connected';
  const isConfigured = provider.configured;
  const isEnabled = provider.enabled !== false;
  const statusColor = getStatusColor(provider);

  return (
    <div style={styles.card}>
      {/* Header: Logo + Name/Description + Toggle — immer aktiv */}
      <div style={styles.cardHeader}>
        <div style={styles.logo}>
          {getProviderIcon(provider.id, { size: 24 })}
        </div>
        <div style={styles.cardTitleRow}>
          <div style={styles.cardName}>{provider.name}</div>
          <div style={styles.cardDescription}>{provider.description}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: theme.spacing.xs }}>
          {isAdmin && (
            <button
              style={styles.toggleButton}
              onClick={() => onToggleEnabled(provider.id, !isEnabled)}
              title={isEnabled ? 'Deaktivieren' : 'Aktivieren'}
              disabled={loading}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {isEnabled ? <ToggleOnIcon /> : <ToggleOffIcon />}
            </button>
          )}
          {provider.version && (
            <span style={styles.versionBadge}>v{provider.version}</span>
          )}
        </div>
      </div>

      {/* Status + Actions — gedimmt wenn deaktiviert */}
      <div style={{ ...styles.statusRow, ...(!isEnabled ? styles.cardDisabled : {}) }}>
        <div style={{ ...styles.statusDot, backgroundColor: statusColor }} />
        <span style={{ ...styles.statusText, color: statusColor }}>
          {getStatusText(provider)}
        </span>
        {isEnabled && isConnected && provider.status?.userInfo && (
          <>
            <span style={styles.statusSeparator}>&middot;</span>
            <span style={styles.versionText}>
              {provider.status.userInfo.name || provider.status.userInfo.email}
            </span>
          </>
        )}
      </div>

      <div style={{ ...styles.actions, ...(!isEnabled ? styles.cardDisabled : {}) }}>
        {!isEnabled ? (
          // Deaktiviert — keine Actions für normale User
          isAdmin ? null : (
            <button style={{ ...styles.button, ...styles.buttonDisabled }} disabled>
              Deaktiviert
            </button>
          )
        ) : isConnected ? (
          <button
            style={{ ...styles.button, ...styles.disconnectButton, ...(loading ? styles.buttonDisabled : {}) }}
            onClick={() => onDisconnect(provider.id)}
            disabled={loading}
          >
            {loading ? 'Trennen...' : 'Trennen'}
          </button>
        ) : isConfigured ? (
          <button
            style={{ ...styles.button, ...styles.connectButton, ...(loading ? styles.buttonDisabled : {}) }}
            onClick={() => onConnect(provider.id)}
            disabled={loading}
          >
            {loading ? 'Verbinden...' : 'Verbinden'}
          </button>
        ) : isAdmin ? (
          <button
            style={{ ...styles.button, ...styles.configureButton }}
            onClick={() => onConfigure(provider)}
          >
            Konfigurieren
          </button>
        ) : (
          <button style={{ ...styles.button, ...styles.buttonDisabled }} disabled>
            Nicht konfiguriert
          </button>
        )}

        {isConfigured && isAdmin && isEnabled && (
          <button
            style={styles.linkButton}
            onClick={() => onConfigure(provider)}
            onMouseEnter={(e) => { e.target.style.color = theme.colors.primary; }}
            onMouseLeave={(e) => { e.target.style.color = theme.colors.textMuted; }}
          >
            Credentials bearbeiten
          </button>
        )}
      </div>
    </div>
  );
}

function ConfigureModal({ provider, onClose, onSave, onDelete, saving }) {
  const [showGuide, setShowGuide] = useState(false);

  if (!provider) return null;

  const setupGuide = provider.setupGuide || provider.pluginSetupGuide;

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ ...styles.modalTitle, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            {getProviderIcon(provider.id, { size: 24 })} {provider.name} konfigurieren
          </h2>
          <button style={styles.modalCloseButton} onClick={onClose}>
            ×
          </button>
        </div>

        {setupGuide && (
          <div style={styles.setupGuideSection}>
            <button
              style={styles.setupGuideToggle}
              onClick={() => setShowGuide(!showGuide)}
            >
              {showGuide ? '▾' : '▸'} Setup-Anleitung {showGuide ? 'ausblenden' : 'anzeigen'}
            </button>
            {showGuide && (
              <div style={{ ...styles.markdownContent, marginTop: theme.spacing.md }}>
                <MarkdownRenderer content={setupGuide} />
              </div>
            )}
          </div>
        )}

        <PluginConfigForm
          configSchema={provider.configSchema || []}
          initialValues={provider.configValues || {}}
          onSave={onSave}
          onCancel={onClose}
          onDelete={provider.hasExistingConfig ? onDelete : null}
          saving={saving}
          hasExistingConfig={provider.hasExistingConfig}
        />
      </div>
    </div>
  );
}

function MarkdownRenderer({ content }) {
  return (
    <ReactMarkdown
      components={{
        h2: ({ children }) => (
          <h2 style={{ fontSize: theme.typography.sizes.lg, fontWeight: 600, marginTop: theme.spacing.xl, marginBottom: theme.spacing.md, color: theme.colors.text }}>
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 style={{ fontSize: theme.typography.sizes.base, fontWeight: 600, marginTop: theme.spacing.lg, marginBottom: theme.spacing.sm, color: theme.colors.text }}>
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p style={{ marginBottom: theme.spacing.md, color: theme.colors.textSecondary }}>
            {children}
          </p>
        ),
        ol: ({ children }) => (
          <ol style={{ marginBottom: theme.spacing.md, paddingLeft: theme.spacing.xl, color: theme.colors.textSecondary }}>
            {children}
          </ol>
        ),
        ul: ({ children }) => (
          <ul style={{ marginBottom: theme.spacing.md, paddingLeft: theme.spacing.xl, color: theme.colors.textSecondary }}>
            {children}
          </ul>
        ),
        li: ({ children }) => (
          <li style={{ marginBottom: theme.spacing.xs }}>
            {children}
          </li>
        ),
        code: ({ inline, children }) => (
          inline ? (
            <code style={{ backgroundColor: theme.colors.surfaceHover, padding: '2px 6px', borderRadius: theme.borderRadius.sm, fontFamily: theme.typography.fontMono, fontSize: '0.9em' }}>
              {children}
            </code>
          ) : (
            <pre style={{ backgroundColor: theme.colors.surfaceHover, padding: theme.spacing.md, borderRadius: theme.borderRadius.md, overflow: 'auto', marginBottom: theme.spacing.md }}>
              <code style={{ fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.sm }}>
                {children}
              </code>
            </pre>
          )
        ),
        pre: ({ children }) => <>{children}</>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: theme.colors.primary, textDecoration: 'underline' }}>
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
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

export default function ConnectionsPage({ embedded = false }) {
  const { user } = useAuth();
  const toast = useToast();
  const { providers, loading, connect, disconnect, loadConfig, saveConfig, deleteConfig, toggleEnabled } = useConnections();
  const [actionLoading, setActionLoading] = useState(null);
  const [configProvider, setConfigProvider] = useState(null);
  const [configSaving, setConfigSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  const handleConnect = async (providerId) => {
    setActionLoading(providerId);

    try {
      await connect(providerId);
    } catch (err) {
      toast.error('Fehler', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (providerId) => {
    setActionLoading(providerId);

    try {
      await disconnect(providerId);
    } catch (err) {
      toast.error('Fehler', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenConfigure = async (provider) => {
    try {
      const configData = await loadConfig(provider.id);
      setConfigProvider({
        ...provider,
        configSchema: configData.configSchema || [],
        configValues: configData.config || {},
        pluginSetupGuide: configData.setupGuide || provider.setupGuide,
        hasExistingConfig: Object.keys(configData.config || {}).length > 0,
      });
    } catch {
      // No existing config — open with empty form
      setConfigProvider({
        ...provider,
        configValues: {},
        hasExistingConfig: false,
      });
    }
  };

  const handleSaveConfig = async (values) => {
    if (!configProvider) return;
    setConfigSaving(true);

    try {
      await saveConfig(configProvider.id, values);
      setConfigProvider(null);
    } catch (err) {
      toast.error('Fehler', err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  const handleToggleEnabled = async (pluginId, enabled) => {
    setActionLoading(pluginId);

    try {
      await toggleEnabled(pluginId, enabled);
    } catch (err) {
      toast.error('Fehler', err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteConfig = async () => {
    if (!configProvider) return;
    setConfigSaving(true);

    try {
      await deleteConfig(configProvider.id);
      setConfigProvider(null);
    } catch (err) {
      toast.error('Fehler', err.message);
    } finally {
      setConfigSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={embedded ? { width: '100%' } : styles.container}>
        <div style={styles.loading}>Lade Verbindungen...</div>
      </div>
    );
  }

  return (
    <div style={embedded ? { width: '100%' } : styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <h1 style={styles.title}>Connections</h1>
          <p style={styles.subtitle}>
            Verbinde externe Dienste für zusätzliche Tools und Funktionen.
          </p>
        </div>
      )}

      {embedded && (
        <div style={{ marginBottom: theme.spacing.xl }}>
          <h2 style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.xs, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Connections
          </h2>
          <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
            Verbinde externe Dienste für zusätzliche Tools und Funktionen.
          </p>
        </div>
      )}

      {providers.length === 0 ? (
        <div style={styles.emptyState}>
          <p>Keine Verbindungs-Provider verfügbar.</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {providers.map((provider) => (
            <ConnectionCard
              key={provider.id}
              provider={provider}
              isAdmin={isAdmin}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              onConfigure={handleOpenConfigure}
              onToggleEnabled={handleToggleEnabled}
              loading={actionLoading === provider.id}
            />
          ))}
        </div>
      )}

      {configProvider && (
        <ConfigureModal
          provider={configProvider}
          onClose={() => setConfigProvider(null)}
          onSave={handleSaveConfig}
          onDelete={handleDeleteConfig}
          saving={configSaving}
        />
      )}
    </div>
  );
}
