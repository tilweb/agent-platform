/**
 * API-Keys management page.
 *
 * Admin-only. List keys, create new keys (raw shown exactly once),
 * revoke existing keys. Embedded into SettingsPage via embedded={true}.
 */

import { useCallback, useEffect, useState } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPost, apiDelete } from '../utils/apiFetch';
import { KeyIcon, CopyIcon, PlusIcon, TrashIcon, XIcon, AlertTriangleIcon } from '../components/Icons';

const styles = {
  root: { width: '100%' },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.xs,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    margin: 0,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    margin: 0,
  },
  primaryBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  secondaryBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  dangerBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    overflow: 'hidden',
  },
  th: {
    textAlign: 'left',
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  td: {
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    borderBottom: `1px solid ${theme.colors.borderLight}`,
    verticalAlign: 'top',
  },
  tdLast: { borderBottom: 'none' },
  idMono: {
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
  },
  badgeActive: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  badgeRevoked: { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted },
  permList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  permItem: {
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
  },
  empty: {
    padding: theme.spacing.xl,
    textAlign: 'center',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
  },
  // Modal
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: theme.spacing.lg,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '640px',
    width: '100%',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: theme.shadows.xl,
  },
  modalHeader: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    margin: 0,
  },
  modalBody: { padding: theme.spacing.xl },
  modalFooter: {
    padding: theme.spacing.lg,
    borderTop: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.sm,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    color: theme.colors.textMuted,
  },
  // Form
  field: { marginBottom: theme.spacing.lg },
  label: {
    display: 'block',
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.background,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    boxSizing: 'border-box',
  },
  inlineRow: {
    display: 'flex',
    gap: theme.spacing.md,
  },
  checkList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    maxHeight: '240px',
    overflowY: 'auto',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
  },
  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.xs} 0`,
    cursor: 'pointer',
  },
  checkPrimary: {
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
  },
  checkDesc: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  errorBox: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
  },
  // Raw-key reveal
  rawKeyWarning: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  rawKeyBox: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.sm,
    wordBreak: 'break-all',
  },
};

function scopeIdentifier(scope) {
  if (!scope) return '';
  if (scope.type === 'service') return scope.serviceName ?? '';
  if (scope.type === 'org') return scope.orgId ?? '';
  if (scope.type === 'user') return scope.userId ?? '';
  return '';
}

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}

export default function ApiKeysPage({ embedded = false }) {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showRaw, setShowRaw] = useState(null); // {key, rawKey} once after create
  const [confirmRevoke, setConfirmRevoke] = useState(null); // key

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet('/admin/api-keys');
      if (!res.ok) throw new Error('Fehler beim Laden der API-Keys');
      const data = await res.json();
      setKeys(data.keys || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const onRevoke = async (id) => {
    try {
      const res = await apiDelete(`/admin/api-keys/${id}`);
      if (!res.ok) throw new Error('Widerruf fehlgeschlagen');
      setConfirmRevoke(null);
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const Header = (
    <div style={styles.header}>
      <div>
        <div style={styles.titleRow}>
          <KeyIcon size={20} color={theme.colors.primary} />
          <h2 style={styles.title}>API-Keys</h2>
        </div>
        <p style={styles.subtitle}>
          Zugangs-Schlüssel für die Public-API (<code>/api/public/v1</code>). Für externe Integrationen, Service-Accounts und Skripte.
        </p>
      </div>
      <button style={styles.primaryBtn} onClick={() => setShowCreate(true)}>
        <PlusIcon size={14} color="#fff" />
        Neuer Key
      </button>
    </div>
  );

  return (
    <div style={styles.root}>
      {!embedded && Header}
      {embedded && Header}

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.empty}>Lädt…</div>
      ) : keys.length === 0 ? (
        <div style={styles.empty}>Noch keine API-Keys angelegt.</div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Label</th>
              <th style={styles.th}>Scope</th>
              <th style={styles.th}>Permissions</th>
              <th style={styles.th}>Rate-Limit</th>
              <th style={styles.th}>Zuletzt genutzt</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k, idx) => {
              const last = idx === keys.length - 1;
              const td = { ...styles.td, ...(last ? styles.tdLast : {}) };
              return (
                <tr key={k.id}>
                  <td style={td}>
                    <div style={{ fontWeight: theme.typography.weights.medium }}>{k.label}</div>
                    <div style={styles.idMono}>{k.id}</div>
                  </td>
                  <td style={td}>
                    <div>{k.scope?.type}</div>
                    <div style={styles.idMono}>{scopeIdentifier(k.scope)}</div>
                  </td>
                  <td style={td}>
                    <div style={styles.permList}>
                      {(k.permissions || []).map(p => (
                        <span key={p} style={styles.permItem}>{p}</span>
                      ))}
                    </div>
                  </td>
                  <td style={td}>{k.rateLimit?.requests}/{k.rateLimit?.windowSec}s</td>
                  <td style={td}>{formatDate(k.lastUsedAt)}</td>
                  <td style={td}>
                    <span style={{ ...styles.badge, ...(k.isActive ? styles.badgeActive : styles.badgeRevoked) }}>
                      {k.isActive ? 'aktiv' : 'widerrufen'}
                    </span>
                  </td>
                  <td style={td}>
                    {k.isActive && (
                      <button style={styles.dangerBtn} onClick={() => setConfirmRevoke(k)}>
                        <TrashIcon size={12} color={theme.colors.error} />
                        Widerrufen
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showCreate && (
        <CreateKeyModal
          onClose={() => setShowCreate(false)}
          onCreated={(payload) => {
            setShowCreate(false);
            setShowRaw(payload);
            refresh();
          }}
        />
      )}

      {showRaw && (
        <RawKeyRevealModal
          payload={showRaw}
          onClose={() => setShowRaw(null)}
        />
      )}

      {confirmRevoke && (
        <ConfirmRevokeModal
          apiKey={confirmRevoke}
          onCancel={() => setConfirmRevoke(null)}
          onConfirm={() => onRevoke(confirmRevoke.id)}
        />
      )}
    </div>
  );
}

function CreateKeyModal({ onClose, onCreated }) {
  const [label, setLabel] = useState('');
  const [scopeType, setScopeType] = useState('service');
  const [scopeId, setScopeId] = useState('');
  const [rateRequests, setRateRequests] = useState('60');
  const [rateWindow, setRateWindow] = useState('60');
  const [expiresAt, setExpiresAt] = useState('');
  const [availablePerms, setAvailablePerms] = useState([]);
  const [selectedPerms, setSelectedPerms] = useState(new Set());
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/admin/api-keys/permissions');
        if (res.ok) {
          const data = await res.json();
          setAvailablePerms(data.permissions || []);
        }
      } catch { /* ignore */ }
    })();
  }, []);

  const toggle = (permId) => {
    const next = new Set(selectedPerms);
    if (next.has(permId)) next.delete(permId); else next.add(permId);
    setSelectedPerms(next);
  };

  const submit = async () => {
    setError(null);
    if (!label.trim()) return setError('Label ist erforderlich.');
    if (!scopeId.trim()) return setError(`${scopeType === 'service' ? 'Service-Name' : scopeType === 'org' ? 'Org-ID' : 'User-ID'} ist erforderlich.`);
    if (selectedPerms.size === 0) return setError('Mindestens eine Permission auswählen.');

    const scope = { type: scopeType };
    if (scopeType === 'service') scope.serviceName = scopeId.trim();
    if (scopeType === 'org') scope.orgId = scopeId.trim();
    if (scopeType === 'user') scope.userId = scopeId.trim();

    const body = {
      label: label.trim(),
      scope,
      permissions: Array.from(selectedPerms),
      rateLimit: { requests: Number(rateRequests), windowSec: Number(rateWindow) },
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    try {
      setSubmitting(true);
      const res = await apiPost('/admin/api-keys', body);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Key konnte nicht erstellt werden');
      onCreated({ key: data.key, rawKey: data.rawKey });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Neuer API-Key</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            <XIcon size={18} color={theme.colors.textMuted} />
          </button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Label</label>
            <input
              style={styles.input}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="z. B. EMMA IHK-Integration"
              maxLength={100}
            />
          </div>

          <div style={styles.inlineRow}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Scope-Typ</label>
              <select style={styles.select} value={scopeType} onChange={(e) => setScopeType(e.target.value)}>
                <option value="service">Service (Machine-to-Machine)</option>
                <option value="org">Organisation</option>
                <option value="user">Benutzer</option>
              </select>
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>
                {scopeType === 'service' ? 'Service-Name' : scopeType === 'org' ? 'Org-ID' : 'User-ID'}
              </label>
              <input
                style={styles.input}
                value={scopeId}
                onChange={(e) => setScopeId(e.target.value)}
                placeholder={scopeType === 'service' ? 'emma' : scopeType === 'org' ? 'org_xxx' : 'user_xxx'}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Permissions</label>
            {availablePerms.length === 0 ? (
              <div style={styles.hint}>Keine Public-Functions registriert.</div>
            ) : (
              <div style={styles.checkList}>
                {availablePerms.map(p => (
                  <label key={p.id} style={styles.checkItem}>
                    <input
                      type="checkbox"
                      checked={selectedPerms.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={styles.checkPrimary}>{p.id}</div>
                      <div style={styles.checkDesc}>{p.appName} → {p.functionId}: {p.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div style={styles.hint}>Permissions-Format: <code>app:&lt;appId&gt;:&lt;functionId&gt;</code></div>
          </div>

          <div style={styles.inlineRow}>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Rate-Limit (Requests)</label>
              <input style={styles.input} type="number" min="1" value={rateRequests} onChange={(e) => setRateRequests(e.target.value)} />
            </div>
            <div style={{ ...styles.field, flex: 1 }}>
              <label style={styles.label}>Zeitfenster (Sekunden)</label>
              <input style={styles.input} type="number" min="1" value={rateWindow} onChange={(e) => setRateWindow(e.target.value)} />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Ablaufdatum (optional)</label>
            <input style={styles.input} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.secondaryBtn} onClick={onClose} disabled={submitting}>Abbrechen</button>
          <button style={styles.primaryBtn} onClick={submit} disabled={submitting}>
            {submitting ? 'Erstelle…' : 'Key erstellen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function RawKeyRevealModal({ payload, onClose }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload.rawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };
  return (
    <div style={styles.overlay}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Key erstellt — jetzt kopieren</h3>
        </div>
        <div style={styles.modalBody}>
          <div style={styles.rawKeyWarning}>
            <AlertTriangleIcon size={18} color={theme.colors.warning} />
            <span>Dieser Schlüssel wird nur genau einmal angezeigt. Nach dem Schließen dieses Dialogs ist er nicht wiederherstellbar.</span>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Label</label>
            <div style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text }}>{payload.key?.label}</div>
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Raw-Key</label>
            <div style={styles.rawKeyBox}>
              <div style={{ flex: 1 }}>{payload.rawKey}</div>
              <button
                style={{ ...styles.secondaryBtn, padding: `${theme.spacing.xs} ${theme.spacing.md}` }}
                onClick={copy}
              >
                <CopyIcon size={14} color={theme.colors.text} />
                {copied ? 'Kopiert' : 'Kopieren'}
              </button>
            </div>
            <div style={styles.hint}>
              Format: <code>apk_&lt;prefix&gt;.&lt;secret&gt;</code> — als <code>Authorization: Bearer &lt;key&gt;</code> verwenden.
            </div>
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.primaryBtn} onClick={onClose}>Schließen</button>
        </div>
      </div>
    </div>
  );
}

function ConfirmRevokeModal({ apiKey, onCancel, onConfirm }) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={{ ...styles.modal, maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>API-Key widerrufen?</h3>
        </div>
        <div style={styles.modalBody}>
          <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, marginTop: 0 }}>
            Der Key <strong>{apiKey.label}</strong> (<span style={styles.idMono}>{apiKey.id}</span>) wird dauerhaft deaktiviert.
            Integrationen, die diesen Key nutzen, brechen sofort ab. Dieser Schritt ist nicht umkehrbar.
          </p>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.secondaryBtn} onClick={onCancel}>Abbrechen</button>
          <button
            style={{ ...styles.primaryBtn, backgroundColor: theme.colors.error }}
            onClick={onConfirm}
          >
            <TrashIcon size={14} color="#fff" />
            Widerrufen
          </button>
        </div>
      </div>
    </div>
  );
}
