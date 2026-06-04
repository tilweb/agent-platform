import { useState } from 'react';
import { useConnections } from '../hooks/useConnections';
import { theme } from '../config/theme';
import ReactMarkdown from 'react-markdown';
import { getProviderIcon } from '../components/Icons';

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
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing.xl,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    transition: `border-color ${theme.transitions.fast}`,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  icon: {
    width: '48px',
    height: '48px',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.background,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: theme.colors.primary,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  cardDescription: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  status: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
  },
  statusConnected: {
    backgroundColor: `${theme.colors.success}15`,
    color: theme.colors.success,
  },
  statusDisconnected: {
    backgroundColor: `${theme.colors.textMuted}15`,
    color: theme.colors.textMuted,
  },
  statusError: {
    backgroundColor: `${theme.colors.error}15`,
    color: theme.colors.error,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: 'currentColor',
  },
  statusText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  userInfo: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  button: {
    width: '100%',
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
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
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    color: theme.colors.textMuted,
  },
  error: {
    backgroundColor: `${theme.colors.error}15`,
    border: `1px solid ${theme.colors.error}30`,
    color: theme.colors.error,
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    marginBottom: theme.spacing.xl,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  setupButton: {
    width: '100%',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    marginTop: theme.spacing.sm,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
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
};

function getStatusStyle(status) {
  if (!status) return styles.statusDisconnected;
  switch (status.status) {
    case 'connected':
      return styles.statusConnected;
    case 'error':
    case 'expired':
      return styles.statusError;
    default:
      return styles.statusDisconnected;
  }
}

function getStatusText(status) {
  if (!status) return 'Not connected';
  switch (status.status) {
    case 'connected':
      return 'Connected';
    case 'error':
      return status.error || 'Connection error';
    case 'expired':
      return 'Token expired';
    default:
      return 'Not connected';
  }
}

// getProviderIcon imported from Icons.jsx

function ConnectionCard({ provider, onConnect, onDisconnect, loading, onShowSetup, admin = false, onToggleEnabled }) {
  const isConnected = provider.status?.status === 'connected';
  const statusStyle = { ...styles.status, ...getStatusStyle(provider.status) };
  const enabled = !!provider.enabledForUsers;

  return (
    <div style={styles.card}>
      <div style={styles.cardHeader}>
        <div style={styles.icon}>
          {getProviderIcon(provider.id, { size: 24 })}
        </div>
        <div style={styles.cardInfo}>
          <div style={styles.cardName}>{provider.name}</div>
          <div style={styles.cardDescription}>{provider.description}</div>
        </div>
      </div>

      {admin ? (
        /* === Admin-Modus: Freischalten + Setup, kein eigenes Verbinden === */
        <>
          <div style={{
            alignSelf: 'flex-start',
            display: 'inline-flex', alignItems: 'center',
            padding: `${theme.spacing.xs} ${theme.spacing.md}`,
            borderRadius: theme.borderRadius.full,
            fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium,
            backgroundColor: enabled ? theme.colors.successLight : theme.colors.surfaceHover,
            color: enabled ? theme.colors.success : theme.colors.textMuted,
          }}>
            {enabled ? 'Für Nutzer freigeschaltet' : 'Nicht freigeschaltet'}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: theme.spacing.md, marginTop: theme.spacing.sm,
          }}>
            <span style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>
              Für Nutzer freischalten
            </span>
            <button
              role="switch"
              aria-checked={enabled}
              onClick={() => onToggleEnabled(provider.id, !enabled)}
              disabled={loading}
              style={{
                width: 44, height: 24, borderRadius: 999, border: 'none', padding: 0, flexShrink: 0,
                cursor: loading ? 'default' : 'pointer', position: 'relative',
                backgroundColor: enabled ? theme.colors.success : theme.colors.border,
                transition: `background-color ${theme.transitions.fast}`,
              }}
            >
              <span style={{
                position: 'absolute', top: 2, left: enabled ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff',
                transition: `left ${theme.transitions.fast}`,
              }} />
            </button>
          </div>

          {provider.setupGuide && (
            <button
              style={styles.setupButton}
              onClick={() => onShowSetup(provider)}
              onMouseEnter={(e) => {
                e.target.style.borderColor = theme.colors.primary;
                e.target.style.color = theme.colors.primary;
              }}
              onMouseLeave={(e) => {
                e.target.style.borderColor = theme.colors.border;
                e.target.style.color = theme.colors.textSecondary;
              }}
            >
              Setup-Anleitung anzeigen
            </button>
          )}
        </>
      ) : (
        /* === User-Modus: eigenes Konto verbinden === */
        <>
          <div style={statusStyle}>
            <div style={styles.statusDot} />
            <span style={styles.statusText}>{getStatusText(provider.status)}</span>
          </div>

          {isConnected && provider.status?.userInfo && (
            <div style={styles.userInfo}>
              Verbunden als: {provider.status.userInfo.name || provider.status.userInfo.email}
            </div>
          )}

          {isConnected ? (
            <button
              style={{ ...styles.button, ...styles.disconnectButton, ...(loading ? styles.buttonDisabled : {}) }}
              onClick={() => onDisconnect(provider.id)}
              disabled={loading}
            >
              {loading ? 'Trenne...' : 'Trennen'}
            </button>
          ) : (
            <button
              style={{ ...styles.button, ...styles.connectButton, ...(loading ? styles.buttonDisabled : {}) }}
              onClick={() => onConnect(provider.id)}
              disabled={loading}
            >
              {loading ? 'Verbinde...' : 'Verbinden'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SetupGuideModal({ provider, onClose }) {
  if (!provider) return null;

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ ...styles.modalTitle, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            {getProviderIcon(provider.id, { size: 24 })} {provider.name} Setup
          </h2>
          <button style={styles.modalCloseButton} onClick={onClose}>
            ×
          </button>
        </div>
        <div style={styles.markdownContent}>
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
            {provider.setupGuide}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function CredentialsModal({ provider, onClose, onSubmit, submitting }) {
  const fields = provider.credentialFields || [];
  const [values, setValues] = useState(() =>
    fields.reduce((acc, f) => ({ ...acc, [f.key]: '' }), {})
  );
  const [localError, setLocalError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError(null);
    // Required-Check Frontend-seitig
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        setLocalError(`Pflichtfeld fehlt: ${f.label}`);
        return;
      }
    }
    try {
      await onSubmit(values);
    } catch (err) {
      setLocalError(err.message);
    }
  };

  return (
    <div style={styles.modal} onClick={onClose}>
      <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h2 style={{ ...styles.modalTitle, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            {getProviderIcon(provider.id, { size: 24 })} {provider.name} verbinden
          </h2>
          <button style={styles.modalCloseButton} onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: theme.spacing.xl, display: 'flex', flexDirection: 'column', gap: theme.spacing.lg }}>
          {fields.map((f) => (
            <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
              <label style={{ fontSize: theme.typography.sizes.sm, fontWeight: 600, color: theme.colors.text }}>
                {f.label}{f.required ? '' : ' (optional)'}
              </label>
              <input
                type={f.type === 'password' ? 'password' : 'text'}
                value={values[f.key] || ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                placeholder={f.placeholder || ''}
                autoComplete="off"
                style={{
                  padding: theme.spacing.sm + ' ' + theme.spacing.md,
                  fontSize: theme.typography.sizes.base,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: theme.borderRadius.md,
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  fontFamily: f.type === 'password' ? theme.typography.fontMono : 'inherit',
                }}
              />
              {f.helperText && (
                <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
                  {f.helperText}
                </span>
              )}
            </div>
          ))}

          {localError && (
            <div style={{
              padding: theme.spacing.md,
              backgroundColor: theme.colors.errorBg || '#fee',
              border: `1px solid ${theme.colors.error || '#f55'}`,
              borderRadius: theme.borderRadius.md,
              color: theme.colors.error || '#c33',
              fontSize: theme.typography.sizes.sm,
            }}>
              {localError}
            </div>
          )}

          <div style={{ display: 'flex', gap: theme.spacing.md, justifyContent: 'flex-end', marginTop: theme.spacing.md }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                ...styles.button,
                ...styles.disconnectButton,
                flex: '0 0 auto',
                paddingLeft: theme.spacing.xl,
                paddingRight: theme.spacing.xl,
              }}
              disabled={submitting}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              style={{
                ...styles.button,
                ...styles.connectButton,
                ...(submitting ? styles.buttonDisabled : {}),
                flex: '0 0 auto',
                paddingLeft: theme.spacing.xl,
                paddingRight: theme.spacing.xl,
              }}
              disabled={submitting}
            >
              {submitting ? 'Verbinde...' : 'Verbinden'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ConnectionsPage({ embedded = false, admin = false }) {
  const { providers, loading, error, connect, connectWithCredentials, disconnect, refresh, setProviderEnabled } = useConnections({ admin });
  const [actionLoading, setActionLoading] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [setupProvider, setSetupProvider] = useState(null);
  const [credentialsProvider, setCredentialsProvider] = useState(null);

  const handleToggleEnabled = async (providerId, enabled) => {
    setActionLoading(providerId);
    setActionError(null);
    try {
      await setProviderEnabled(providerId, enabled);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleConnect = async (providerId) => {
    const provider = providers.find((p) => p.id === providerId);
    if (provider?.authType === 'client-credentials') {
      // Kein OAuth-Popup — Modal mit Eingabefeldern oeffnen.
      setCredentialsProvider(provider);
      return;
    }

    setActionLoading(providerId);
    setActionError(null);

    try {
      await connect(providerId);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCredentialsSubmit = async (input) => {
    if (!credentialsProvider) return;
    setActionLoading(credentialsProvider.id);
    setActionError(null);
    try {
      await connectWithCredentials(credentialsProvider.id, input);
      setCredentialsProvider(null);
    } catch (err) {
      setActionError(err.message);
      throw err;
    } finally {
      setActionLoading(null);
    }
  };

  const handleDisconnect = async (providerId) => {
    setActionLoading(providerId);
    setActionError(null);

    try {
      await disconnect(providerId);
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div style={embedded ? { width: '100%' } : styles.container}>
        <div style={styles.loading}>Loading connections...</div>
      </div>
    );
  }

  return (
    <div style={embedded ? { width: '100%' } : styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <h1 style={styles.title}>{admin ? 'Connections' : 'Meine Verbindungen'}</h1>
          <p style={styles.subtitle}>
            {admin
              ? 'Provider einrichten und für Nutzer freischalten.'
              : 'Verbinde deine eigenen Konten für zusätzliche Tools und Funktionen.'}
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
            {admin ? 'Connections' : 'Meine Verbindungen'}
          </h2>
          <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
            {admin
              ? 'Provider einrichten und für Nutzer freischalten. Das Verbinden des eigenen Kontos erfolgt unter „Meine Verbindungen".'
              : 'Verbinde deine eigenen Konten für zusätzliche Tools und Funktionen.'}
          </p>
        </div>
      )}

      {(error || actionError) && (
        <div style={styles.error}>
          {error || actionError}
        </div>
      )}

      {providers.length === 0 ? (
        <div style={styles.emptyState}>
          <p>{admin ? 'Keine Connection-Provider konfiguriert.' : 'Noch keine Verbindungen freigeschaltet. Wende dich an einen Administrator.'}</p>
        </div>
      ) : (
        <div style={styles.grid}>
          {providers.map((provider) => (
            <ConnectionCard
              key={provider.id}
              provider={provider}
              onConnect={handleConnect}
              onDisconnect={handleDisconnect}
              loading={actionLoading === provider.id}
              onShowSetup={setSetupProvider}
              admin={admin}
              onToggleEnabled={handleToggleEnabled}
            />
          ))}
        </div>
      )}

      {setupProvider && (
        <SetupGuideModal
          provider={setupProvider}
          onClose={() => setSetupProvider(null)}
        />
      )}

      {credentialsProvider && (
        <CredentialsModal
          provider={credentialsProvider}
          onClose={() => setCredentialsProvider(null)}
          onSubmit={handleCredentialsSubmit}
          submitting={actionLoading === credentialsProvider.id}
        />
      )}
    </div>
  );
}
