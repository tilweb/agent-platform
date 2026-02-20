import { useState, useEffect } from 'react';
import { theme } from '../config/theme';
import McpServerEditor from '../components/McpServerEditor';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const styles = {
  container: {
    width: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.xl,
  },
  headerContent: {},
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textMuted,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  createButton: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: '#3b82f6',
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  stats: {
    display: 'flex',
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    flex: 1,
    textAlign: 'center',
  },
  statValue: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  statLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    transition: `all ${theme.transitions.fast}`,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  statusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    marginTop: '4px',
    flexShrink: 0,
  },
  statusConnected: {
    backgroundColor: '#10b981',
  },
  statusDisconnected: {
    backgroundColor: '#6b7280',
  },
  statusConnecting: {
    backgroundColor: '#f59e0b',
  },
  statusError: {
    backgroundColor: '#ef4444',
  },
  cardTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: '2px',
  },
  cardCommand: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
    backgroundColor: theme.colors.surfaceHover,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.sm,
    display: 'inline-block',
    marginTop: theme.spacing.xs,
  },
  cardMeta: {
    display: 'flex',
    gap: theme.spacing.md,
    marginTop: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  cardStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  cardTools: {
    color: '#3b82f6',
  },
  cardActions: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  actionButton: {
    flex: 1,
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  connectButton: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
    color: '#fff',
  },
  disconnectButton: {
    backgroundColor: theme.colors.surfaceHover,
  },
  error: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    color: theme.colors.error,
    marginBottom: theme.spacing.lg,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardError: {
    marginTop: theme.spacing.sm,
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.sm,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
  },
  emptyState: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
  },
  loading: {
    textAlign: 'center',
    padding: theme.spacing['3xl'],
    color: theme.colors.textMuted,
  },
  hint: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  presetCard: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  presetName: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  presetCommand: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    fontFamily: theme.typography.fontMono,
    marginTop: theme.spacing.xs,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  docsSection: {
    marginTop: theme.spacing['2xl'],
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    overflow: 'hidden',
  },
  docsHeader: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
  },
  docsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  docsContent: {
    padding: theme.spacing.xl,
  },
  docsTabs: {
    display: 'flex',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    paddingBottom: theme.spacing.md,
  },
  docsTab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    borderRadius: theme.borderRadius.md,
    border: 'none',
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  docsTabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  docsBlock: {
    marginBottom: theme.spacing.xl,
  },
  docsBlockTitle: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  docsBlockNumber: {
    width: '24px',
    height: '24px',
    borderRadius: '50%',
    backgroundColor: '#3b82f6',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.bold,
  },
  docsParagraph: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    marginBottom: theme.spacing.md,
  },
  docsCode: {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    padding: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.xs,
    overflow: 'auto',
    marginBottom: theme.spacing.md,
    whiteSpace: 'pre',
    lineHeight: '1.6',
  },
  docsCodeTitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.sm,
    fontFamily: theme.typography.fontMono,
  },
  docsNote: {
    backgroundColor: '#3b82f615',
    border: `1px solid #3b82f650`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  docsWarning: {
    backgroundColor: '#f59e0b15',
    border: `1px solid #f59e0b50`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  docsTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  docsTableHeader: {
    backgroundColor: theme.colors.surfaceHover,
    textAlign: 'left',
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
    fontWeight: theme.typography.weights.medium,
  },
  docsTableCell: {
    padding: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  copyButton: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: 'transparent',
    border: `1px solid #475569`,
    borderRadius: theme.borderRadius.sm,
    color: '#94a3b8',
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  codeWrapper: {
    position: 'relative',
  },
  codeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
};

function McpServersPage({ embedded = false }) {
  const [servers, setServers] = useState([]);
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditor, setShowEditor] = useState(false);
  const [editingServer, setEditingServer] = useState(null);
  const [showDocs, setShowDocs] = useState(false);
  const [docsTab, setDocsTab] = useState('client');

  const fetchServers = async () => {
    try {
      const response = await fetch(`${API_URL}/mcp/servers`);
      if (!response.ok) throw new Error('Failed to fetch servers');
      const data = await response.json();
      setServers(data.servers || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPresets = async () => {
    try {
      const response = await fetch(`${API_URL}/mcp/servers/presets`);
      if (!response.ok) return;
      const data = await response.json();
      setPresets(data.presets || []);
    } catch (err) {
      console.error('Failed to fetch presets:', err);
    }
  };

  useEffect(() => {
    fetchServers();
    fetchPresets();
  }, []);

  const handleConnect = async (serverId) => {
    try {
      await fetch(`${API_URL}/mcp/servers/${serverId}/connect`, { method: 'POST' });
      await fetchServers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDisconnect = async (serverId) => {
    try {
      await fetch(`${API_URL}/mcp/servers/${serverId}/disconnect`, { method: 'POST' });
      await fetchServers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (serverId) => {
    if (!confirm('Server wirklich löschen?')) return;
    try {
      await fetch(`${API_URL}/mcp/servers/${serverId}`, { method: 'DELETE' });
      await fetchServers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSave = async (serverData) => {
    const isNew = !editingServer;
    const url = isNew
      ? `${API_URL}/mcp/servers`
      : `${API_URL}/mcp/servers/${serverData.id}`;
    const method = isNew ? 'POST' : 'PUT';

    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(serverData),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to save server');
    }

    await fetchServers();
    setShowEditor(false);
    setEditingServer(null);
  };

  const openEditor = (server = null) => {
    setEditingServer(server);
    setShowEditor(true);
  };

  const openPreset = (preset) => {
    setEditingServer({
      id: preset.id,
      name: preset.name,
      command: preset.command,
      args: preset.args,
      env: preset.env,
      enabled: true,
      autoConnect: true,
    });
    setShowEditor(true);
  };

  const getStatusStyle = (status) => {
    switch (status) {
      case 'connected': return styles.statusConnected;
      case 'connecting': return styles.statusConnecting;
      case 'error': return styles.statusError;
      default: return styles.statusDisconnected;
    }
  };

  if (isLoading) {
    return <div style={styles.loading}>Lade MCP Server...</div>;
  }

  const connectedCount = servers.filter(s => s.status === 'connected').length;
  const totalTools = servers.reduce((sum, s) => sum + (s.toolCount || 0), 0);

  return (
    <div style={styles.container}>
      {!embedded && (
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h1 style={styles.title}>MCP Server</h1>
            <p style={styles.subtitle}>
              Verbinde externe MCP Server um deren Tools zu nutzen.
            </p>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.createButton} onClick={() => openEditor(null)}>
              <PlusIcon /> Server hinzufügen
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: theme.spacing.xl }}>
          <div>
            <h2 style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, marginBottom: theme.spacing.xs, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={theme.colors.primary} strokeWidth="2">
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
                <line x1="6" y1="6" x2="6.01" y2="6" />
                <line x1="6" y1="18" x2="6.01" y2="18" />
              </svg>
              MCP Server
            </h2>
            <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted }}>
              Verbinde externe MCP Server um deren Tools zu nutzen.
            </p>
          </div>
          <button style={styles.createButton} onClick={() => openEditor(null)}>
            <PlusIcon /> Server hinzufügen
          </button>
        </div>
      )}

      {error && (
        <div style={styles.error}>
          {error}
          <button
            onClick={() => setError(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: theme.colors.error }}
          >
            &times;
          </button>
        </div>
      )}

      <div style={styles.stats}>
        <div style={styles.statCard}>
          <div style={styles.statValue}>{servers.length}</div>
          <div style={styles.statLabel}>Server konfiguriert</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#10b981' }}>{connectedCount}</div>
          <div style={styles.statLabel}>Verbunden</div>
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.statValue, color: '#3b82f6' }}>{totalTools}</div>
          <div style={styles.statLabel}>Tools verfügbar</div>
        </div>
      </div>

      {servers.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: '48px', marginBottom: theme.spacing.md, opacity: 0.5 }}>
            <ServerIcon />
          </div>
          <div style={{ fontSize: theme.typography.sizes.lg, fontWeight: theme.typography.weights.semibold, marginBottom: theme.spacing.sm }}>
            Keine MCP Server konfiguriert
          </div>
          <div style={{ color: theme.colors.textMuted, marginBottom: theme.spacing.lg }}>
            Füge einen MCP Server hinzu oder wähle einen Preset.
          </div>

          {presets.length > 0 && (
            <>
              <div style={{ marginTop: theme.spacing.xl, color: theme.colors.textSecondary }}>
                Verfügbare Presets:
              </div>
              <div style={styles.presetGrid}>
                {presets.slice(0, 6).map((preset) => (
                  <div
                    key={preset.id}
                    style={styles.presetCard}
                    onClick={() => openPreset(preset)}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#3b82f6'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = theme.colors.border}
                  >
                    <div style={styles.presetName}>{preset.name}</div>
                    <div style={styles.presetCommand}>
                      {preset.args?.[1] || preset.command}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {servers.map((server) => (
            <div
              key={server.id}
              style={styles.card}
              onMouseOver={(e) => {
                e.currentTarget.style.boxShadow = theme.shadows.lg;
                e.currentTarget.style.borderColor = '#3b82f6';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.boxShadow = 'none';
                e.currentTarget.style.borderColor = theme.colors.border;
              }}
            >
              <div style={styles.cardHeader}>
                <div style={{ ...styles.statusDot, ...getStatusStyle(server.status) }} />
                <div style={{ flex: 1 }}>
                  <div style={styles.cardTitle}>{server.name}</div>
                  <div style={styles.cardCommand}>
                    {server.command} {server.args?.join(' ')}
                  </div>
                </div>
              </div>

              <div style={styles.cardMeta}>
                <span style={styles.cardStatus}>
                  Status: {server.status}
                </span>
                {server.toolCount > 0 && (
                  <span style={styles.cardTools}>
                    {server.toolCount} Tools
                  </span>
                )}
              </div>

              {server.error && (
                <div style={styles.cardError}>
                  {server.error}
                </div>
              )}

              <div style={styles.cardActions}>
                {server.status === 'connected' ? (
                  <button
                    style={{ ...styles.actionButton, ...styles.disconnectButton }}
                    onClick={() => handleDisconnect(server.id)}
                  >
                    Trennen
                  </button>
                ) : (
                  <button
                    style={{ ...styles.actionButton, ...styles.connectButton }}
                    onClick={() => handleConnect(server.id)}
                  >
                    Verbinden
                  </button>
                )}
                <button
                  style={styles.actionButton}
                  onClick={() => openEditor(server)}
                >
                  Bearbeiten
                </button>
                <button
                  style={styles.actionButton}
                  onClick={() => handleDelete(server.id)}
                >
                  Löschen
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={styles.hint}>
        <strong>Hinweis:</strong> MCP Server werden als externe Prozesse gestartet.
        Stelle sicher, dass die nötigen Umgebungsvariablen (API Keys etc.) gesetzt sind.
      </div>

      {/* Documentation Section */}
      <div style={styles.docsSection}>
        <div style={styles.docsHeader} onClick={() => setShowDocs(!showDocs)}>
          <div style={styles.docsTitle}>
            <BookIcon />
            Dokumentation & Anleitung
          </div>
          <ChevronIcon direction={showDocs ? 'up' : 'down'} />
        </div>

        {showDocs && (
          <div style={styles.docsContent}>
            <div style={styles.docsTabs}>
              <button
                style={{ ...styles.docsTab, ...(docsTab === 'client' ? styles.docsTabActive : {}) }}
                onClick={() => setDocsTab('client')}
              >
                MCP Server einbinden
              </button>
              <button
                style={{ ...styles.docsTab, ...(docsTab === 'server' ? styles.docsTabActive : {}) }}
                onClick={() => setDocsTab('server')}
              >
                Als MCP Server nutzen
              </button>
              <button
                style={{ ...styles.docsTab, ...(docsTab === 'about' ? styles.docsTabActive : {}) }}
                onClick={() => setDocsTab('about')}
              >
                Was ist MCP?
              </button>
            </div>

            {docsTab === 'about' && <AboutMcpDocs />}
            {docsTab === 'client' && <ClientModeDocs />}
            {docsTab === 'server' && <ServerModeDocs />}
          </div>
        )}
      </div>

      {showEditor && (
        <McpServerEditor
          server={editingServer}
          presets={presets}
          onSave={handleSave}
          onClose={() => {
            setShowEditor(false);
            setEditingServer(null);
          }}
        />
      )}
    </div>
  );
}

function PlusIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function ServerIcon({ size = 48 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2">
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function BookIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function ChevronIcon({ direction = 'down', size = 20 }) {
  const rotation = direction === 'up' ? 180 : 0;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{ transform: `rotate(${rotation}deg)`, transition: 'transform 0.2s' }}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

function CopyIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CodeBlock({ title, code, language }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={styles.codeWrapper}>
      <div style={styles.codeHeader}>
        <span style={styles.docsCodeTitle}>{title}</span>
        <button style={styles.copyButton} onClick={handleCopy}>
          <CopyIcon /> {copied ? 'Kopiert!' : 'Kopieren'}
        </button>
      </div>
      <pre style={styles.docsCode}>{code}</pre>
    </div>
  );
}

function AboutMcpDocs() {
  return (
    <>
      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>Was ist das Model Context Protocol (MCP)?</h3>
        <p style={styles.docsParagraph}>
          Das <strong>Model Context Protocol (MCP)</strong> ist ein offener Standard von Anthropic,
          der es ermöglicht, KI-Assistenten mit externen Datenquellen und Tools zu verbinden.
          MCP bietet eine standardisierte Schnittstelle, über die verschiedene Anwendungen
          miteinander kommunizieren können.
        </p>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>Wie funktioniert MCP?</h3>
        <p style={styles.docsParagraph}>
          MCP verwendet JSON-RPC 2.0 über stdio (Standard Input/Output) für die Kommunikation.
          Ein MCP Server wird als separater Prozess gestartet und kommuniziert über stdin/stdout
          mit dem Client.
        </p>

        <div style={styles.docsNote}>
          <strong>Hauptkonzepte:</strong>
          <ul style={{ margin: `${theme.spacing.sm} 0 0 ${theme.spacing.lg}`, paddingLeft: 0 }}>
            <li><strong>Tools</strong> - Funktionen, die der Server bereitstellt (z.B. Dateioperationen, API-Aufrufe)</li>
            <li><strong>Resources</strong> - Daten, die der Server verfügbar macht (z.B. Dateien, Datenbanken)</li>
            <li><strong>Prompts</strong> - Vordefinierte Prompt-Templates</li>
          </ul>
        </div>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>Wo laufen MCP Server?</h3>
        <p style={styles.docsParagraph}>
          MCP Server werden <strong>lokal auf deinem Rechner</strong> ausgeführt - es ist keine externe
          Infrastruktur oder Cloud-Dienst nötig. So funktioniert es:
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: theme.spacing.md,
          marginBottom: theme.spacing.lg
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#3b82f620',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: theme.typography.sizes.sm,
          }}>1</div>
          <div>
            <strong style={{ color: theme.colors.text }}>Verbinden klicken</strong>
            <p style={{ ...styles.docsParagraph, marginBottom: 0, marginTop: theme.spacing.xs }}>
              Die Agent Platform führt den konfigurierten Befehl aus (z.B. <code>npx -y @modelcontextprotocol/server-github</code>)
            </p>
          </div>

          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#3b82f620',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: theme.typography.sizes.sm,
          }}>2</div>
          <div>
            <strong style={{ color: theme.colors.text }}>Automatischer Download</strong>
            <p style={{ ...styles.docsParagraph, marginBottom: 0, marginTop: theme.spacing.xs }}>
              <code>npx</code> lädt das MCP-Server-Package automatisch herunter (falls nicht bereits im npm-Cache)
            </p>
          </div>

          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#3b82f620',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: theme.typography.sizes.sm,
          }}>3</div>
          <div>
            <strong style={{ color: theme.colors.text }}>Lokaler Prozess</strong>
            <p style={{ ...styles.docsParagraph, marginBottom: 0, marginTop: theme.spacing.xs }}>
              Der MCP Server startet als Child-Prozess der Agent Platform auf deinem lokalen Rechner
            </p>
          </div>

          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: '#3b82f620',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: theme.typography.sizes.sm,
          }}>4</div>
          <div>
            <strong style={{ color: theme.colors.text }}>Kommunikation via stdin/stdout</strong>
            <p style={{ ...styles.docsParagraph, marginBottom: 0, marginTop: theme.spacing.xs }}>
              Agent Platform und MCP Server kommunizieren über JSON-RPC Nachrichten
            </p>
          </div>
        </div>

        <div style={styles.docsNote}>
          <strong>Voraussetzungen:</strong>
          <ul style={{ margin: `${theme.spacing.sm} 0 0 ${theme.spacing.lg}`, paddingLeft: 0 }}>
            <li><strong>Node.js & npm</strong> müssen installiert sein (für <code>npx</code>)</li>
            <li><strong>Internetverbindung</strong> nur beim ersten Download des Packages nötig</li>
            <li><strong>Keine Cloud-Dienste</strong> - alles läuft lokal auf deinem Rechner</li>
          </ul>
        </div>

        <div style={styles.docsWarning}>
          <strong>Lebenszyklus:</strong> MCP Server laufen nur, solange sie verbunden sind.
          Bei "Trennen" wird der Prozess beendet. Beim nächsten "Verbinden" wird er neu gestartet
          (ohne erneuten Download, da im Cache).
        </div>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>Verfügbare MCP Server</h3>
        <table style={styles.docsTable}>
          <thead>
            <tr>
              <th style={styles.docsTableHeader}>Server</th>
              <th style={styles.docsTableHeader}>Package</th>
              <th style={styles.docsTableHeader}>Beschreibung</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style={styles.docsTableCell}>GitHub</td>
              <td style={{ ...styles.docsTableCell, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs }}>
                @modelcontextprotocol/server-github
              </td>
              <td style={styles.docsTableCell}>Repositories, Issues, Pull Requests</td>
            </tr>
            <tr>
              <td style={styles.docsTableCell}>Filesystem</td>
              <td style={{ ...styles.docsTableCell, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs }}>
                @modelcontextprotocol/server-filesystem
              </td>
              <td style={styles.docsTableCell}>Lokale Dateien lesen/schreiben</td>
            </tr>
            <tr>
              <td style={styles.docsTableCell}>SQLite</td>
              <td style={{ ...styles.docsTableCell, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs }}>
                @modelcontextprotocol/server-sqlite
              </td>
              <td style={styles.docsTableCell}>SQLite Datenbank-Abfragen</td>
            </tr>
            <tr>
              <td style={styles.docsTableCell}>Brave Search</td>
              <td style={{ ...styles.docsTableCell, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs }}>
                @modelcontextprotocol/server-brave-search
              </td>
              <td style={styles.docsTableCell}>Web-Suche via Brave API</td>
            </tr>
            <tr>
              <td style={styles.docsTableCell}>Puppeteer</td>
              <td style={{ ...styles.docsTableCell, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs }}>
                @modelcontextprotocol/server-puppeteer
              </td>
              <td style={styles.docsTableCell}>Browser-Automatisierung</td>
            </tr>
          </tbody>
        </table>
        <p style={styles.docsParagraph}>
          Weitere MCP Server findest du auf{' '}
          <a
            href="https://github.com/modelcontextprotocol/servers"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#3b82f6' }}
          >
            github.com/modelcontextprotocol/servers
          </a>
        </p>
      </div>
    </>
  );
}

function ClientModeDocs() {
  return (
    <>
      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>1</span>
          Externe MCP Server einbinden
        </h3>
        <p style={styles.docsParagraph}>
          Die Agent Platform kann externe MCP Server als Tool-Quellen nutzen. Alle Tools
          eines verbundenen MCP Servers werden automatisch in der Tool Registry registriert
          und stehen den Agenten zur Verfügung.
        </p>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>2</span>
          Server hinzufügen
        </h3>
        <p style={styles.docsParagraph}>
          Klicke auf <strong>"Server hinzufügen"</strong> oder wähle einen der vorkonfigurierten
          Presets. Du benötigst:
        </p>
        <ul style={{ ...styles.docsParagraph, marginLeft: theme.spacing.lg }}>
          <li><strong>ID</strong> - Eindeutige Kennung (z.B. "github")</li>
          <li><strong>Name</strong> - Anzeigename (z.B. "GitHub MCP Server")</li>
          <li><strong>Command</strong> - Startbefehl (meist "npx")</li>
          <li><strong>Arguments</strong> - Argumente für den Befehl</li>
          <li><strong>Umgebungsvariablen</strong> - API Keys und Konfiguration</li>
        </ul>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>3</span>
          Beispiel: GitHub MCP Server
        </h3>

        <CodeBlock
          title="Konfiguration"
          code={`ID: github
Name: GitHub MCP Server
Command: npx
Arguments: -y @modelcontextprotocol/server-github

Umgebungsvariablen:
  GITHUB_PERSONAL_ACCESS_TOKEN = \${GITHUB_TOKEN}`}
        />

        <div style={styles.docsWarning}>
          <strong>Wichtig:</strong> Umgebungsvariablen wie <code>$&#123;GITHUB_TOKEN&#125;</code> werden
          aus den System-Umgebungsvariablen ersetzt. Setze diese vor dem Start der Agent Platform:
          <pre style={{ marginTop: theme.spacing.sm, fontFamily: theme.typography.fontMono, fontSize: theme.typography.sizes.xs }}>
            export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
          </pre>
        </div>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>4</span>
          Tools verwenden
        </h3>
        <p style={styles.docsParagraph}>
          Nach erfolgreicher Verbindung werden die Tools des MCP Servers automatisch registriert.
          Sie erscheinen in der Tool-Liste mit dem Präfix <code>mcp_&#123;serverId&#125;_</code>.
        </p>
        <p style={styles.docsParagraph}>
          Beispiel: Ein Tool "create_issue" vom GitHub Server wird als <code>mcp_github_create_issue</code> registriert.
        </p>
      </div>
    </>
  );
}

function ServerModeDocs() {
  const claudeConfig = `{
  "mcpServers": {
    "agent-platform": {
      "command": "bun",
      "args": [
        "run",
        "/pfad/zu/agent-platform/backend/src/mcp/server/index.ts"
      ]
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "agent-platform": {
      "command": "bun",
      "args": [
        "run",
        "/pfad/zu/agent-platform/backend/src/mcp/server/index.ts"
      ]
    }
  }
}`;

  const npmStart = `cd /pfad/zu/agent-platform/backend
npm run mcp-server`;

  return (
    <>
      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>1</span>
          Agent Platform als MCP Server
        </h3>
        <p style={styles.docsParagraph}>
          Die Agent Platform kann selbst als MCP Server fungieren und ihre Tools externen
          Anwendungen wie Claude Desktop, Cursor IDE oder anderen MCP-kompatiblen Clients
          zur Verfügung stellen.
        </p>

        <div style={styles.docsNote}>
          <strong>Bereitgestellte Tools:</strong>
          <ul style={{ margin: `${theme.spacing.sm} 0 0 ${theme.spacing.lg}`, paddingLeft: 0 }}>
            <li><code>file_read</code> - Dateien aus dem Data-Verzeichnis lesen</li>
            <li><code>file_write</code> - Dateien schreiben</li>
            <li><code>file_list</code> - Verzeichnisse auflisten</li>
            <li><code>web_search</code> - Web-Suche durchführen</li>
            <li><code>delegate_to_agent</code> - Aufgaben an Agenten delegieren</li>
            <li>+ alle konfigurierten Custom API Tools</li>
          </ul>
        </div>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>2</span>
          Einrichtung in Claude Desktop
        </h3>
        <p style={styles.docsParagraph}>
          Öffne die Claude Desktop Konfigurationsdatei:
        </p>
        <ul style={{ ...styles.docsParagraph, marginLeft: theme.spacing.lg }}>
          <li><strong>macOS:</strong> <code>~/Library/Application Support/Claude/claude_desktop_config.json</code></li>
          <li><strong>Windows:</strong> <code>%APPDATA%\Claude\claude_desktop_config.json</code></li>
        </ul>

        <CodeBlock
          title="claude_desktop_config.json"
          code={claudeConfig}
        />

        <p style={styles.docsParagraph}>
          Starte Claude Desktop neu, um die Änderungen zu übernehmen. Die Agent Platform Tools
          erscheinen dann im Tool-Menü.
        </p>
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>3</span>
          Einrichtung in Cursor IDE
        </h3>
        <p style={styles.docsParagraph}>
          Cursor unterstützt MCP Server über die Einstellungen. Füge die folgende Konfiguration
          in den MCP-Einstellungen hinzu:
        </p>

        <CodeBlock
          title="Cursor MCP Konfiguration"
          code={cursorConfig}
        />
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>4</span>
          Manuell starten (zum Testen)
        </h3>
        <p style={styles.docsParagraph}>
          Du kannst den MCP Server auch manuell starten, um ihn zu testen:
        </p>

        <CodeBlock
          title="Terminal"
          code={npmStart}
        />

        <p style={styles.docsParagraph}>
          Der Server kommuniziert über stdin/stdout. Du kannst JSON-RPC Nachrichten senden:
        </p>

        <CodeBlock
          title="Beispiel: Tools auflisten"
          code={`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}`}
        />
      </div>

      <div style={styles.docsBlock}>
        <h3 style={styles.docsBlockTitle}>
          <span style={styles.docsBlockNumber}>5</span>
          Sicherheitshinweise
        </h3>

        <div style={styles.docsWarning}>
          <strong>Beachte:</strong>
          <ul style={{ margin: `${theme.spacing.sm} 0 0 ${theme.spacing.lg}`, paddingLeft: 0 }}>
            <li>Der MCP Server hat Zugriff auf das Data-Verzeichnis der Agent Platform</li>
            <li>Das <code>delegate_to_agent</code> Tool kann Aufgaben an Agenten delegieren</li>
            <li>Stelle sicher, dass nur vertrauenswürdige Anwendungen den MCP Server nutzen</li>
            <li>Führe den Server nicht mit erhöhten Rechten aus</li>
          </ul>
        </div>
      </div>
    </>
  );
}

export default McpServersPage;
