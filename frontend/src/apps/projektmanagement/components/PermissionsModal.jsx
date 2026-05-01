/**
 * PermissionsModal — Berechtigungen einer Idee oder eines Auftrags verwalten.
 *
 * Phase-2: Auftrags-/Ideen-Owner berechtigt zusaetzliche User/Gruppen mit
 * Rolle (owner/editor/viewer). Der Ersteller (created_by) ist immer Owner —
 * unabhaengig von dieser Liste — und wird nicht hier verwaltet.
 *
 * Beim Mount: laedt aktuelle Permissions + eligible-principals (User+Gruppen
 * die App-Zugriff haben). User-Picker ist auf eligible-User beschraenkt,
 * damit kein User berechtigt wird der die App ueberhaupt nicht oeffnen kann.
 *
 * Speichern: PUT /apps/projektmanagement/<type>/<id>/permissions ueberschreibt
 * die komplette Liste.
 */

import { useEffect, useState } from 'react';
import { theme } from '../../../config/theme';
import { apiGet, apiPut } from '../../../utils/apiFetch';

const ROLE_LABELS = {
  owner: 'Owner',
  editor: 'Bearbeiter',
  viewer: 'Betrachter',
};

const styles = {
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
    maxWidth: '640px',
    width: '90%',
    maxHeight: '85vh',
    overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
  },
  ownerHint: {
    backgroundColor: theme.colors.surfaceHover,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.md,
  },
  empty: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    marginBottom: theme.spacing.md,
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
  name: {
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
  addRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 160px auto',
    gap: theme.spacing.md,
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  addButton: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  buttonRow: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
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
  cancelButton: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  error: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginTop: theme.spacing.md,
  },
};

/**
 * @param {{ type: 'idee'|'auftrag', id: string, ownerName?: string, onClose: ()=>void, onSaved?: ()=>void }} props
 */
export default function PermissionsModal({ type, id, ownerName, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [permissions, setPermissions] = useState({ users: [], groups: [] });
  const [eligible, setEligible] = useState({ users: [], groups: [] });
  // allUsers: ALLE aktiven User der Plattform — fuer Name-Lookup von Eintraegen
  // die nicht (mehr) in einer berechtigten Gruppe sind. Sonst wuerde die User-ID
  // angezeigt statt der Name.
  const [allUsersById, setAllUsersById] = useState({});
  const [pickKind, setPickKind] = useState('user');
  const [pickPrincipal, setPickPrincipal] = useState('');
  const [pickRole, setPickRole] = useState('viewer');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [permsRes, eligRes, usersRes] = await Promise.all([
          apiGet(`/apps/projektmanagement/${type === 'idee' ? 'projektideen' : 'projektauftraege'}/${id}/permissions`),
          apiGet('/apps/projektmanagement/eligible-principals'),
          apiGet('/users'),
        ]);
        if (cancelled) return;
        const permsData = permsRes.ok ? await permsRes.json() : { permissions: { users: [], groups: [] } };
        const eligData = eligRes.ok ? await eligRes.json() : { users: [], groups: [] };
        const usersData = usersRes.ok ? await usersRes.json() : { users: [] };
        setPermissions(permsData.permissions ?? { users: [], groups: [] });
        setEligible(eligData);
        const map = {};
        for (const u of (usersData.users ?? [])) {
          map[u.id] = { id: u.id, username: u.username, displayName: u.displayName ?? u.username };
        }
        setAllUsersById(map);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Fehler beim Laden');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [type, id]);

  const principalLookup = (kind, pid) => {
    if (kind === 'user') {
      const u = eligible.users.find((u) => u.id === pid) || allUsersById[pid];
      return u ? (u.displayName || u.username) : pid;
    }
    const g = eligible.groups.find((g) => g.id === pid);
    return g ? g.name : pid;
  };

  const isPrincipalEligible = (kind, pid) => {
    if (kind === 'user') return eligible.users.some((u) => u.id === pid);
    return eligible.groups.some((g) => g.id === pid);
  };

  const availableForKind = pickKind === 'user'
    ? eligible.users.filter((u) => !permissions.users.some((p) => p.userId === u.id))
    : eligible.groups.filter((g) => !permissions.groups.some((p) => p.groupId === g.id));

  const updateRole = (kind, pid, role) => {
    setPermissions((prev) => ({
      ...prev,
      users: kind === 'user'
        ? prev.users.map((p) => p.userId === pid ? { ...p, role } : p)
        : prev.users,
      groups: kind === 'group'
        ? prev.groups.map((p) => p.groupId === pid ? { ...p, role } : p)
        : prev.groups,
    }));
  };

  const removeEntry = (kind, pid) => {
    setPermissions((prev) => ({
      ...prev,
      users: kind === 'user' ? prev.users.filter((p) => p.userId !== pid) : prev.users,
      groups: kind === 'group' ? prev.groups.filter((p) => p.groupId !== pid) : prev.groups,
    }));
  };

  const addEntry = () => {
    if (!pickPrincipal) return;
    setPermissions((prev) => ({
      ...prev,
      users: pickKind === 'user'
        ? [...prev.users, { userId: pickPrincipal, role: pickRole }]
        : prev.users,
      groups: pickKind === 'group'
        ? [...prev.groups, { groupId: pickPrincipal, role: pickRole }]
        : prev.groups,
    }));
    setPickPrincipal('');
    setPickRole('viewer');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const path = type === 'idee' ? 'projektideen' : 'projektauftraege';
      const res = await apiPut(`/apps/projektmanagement/${path}/${id}/permissions`, { permissions });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Speichern fehlgeschlagen');
      }
      onSaved && onSaved();
      onClose();
    } catch (err) {
      setError(err.message || 'Unbekannter Fehler');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.title}>Berechtigungen verwalten</div>
        <div style={styles.subtitle}>
          {type === 'idee' ? 'Wer darf diese Projektidee sehen, bearbeiten oder loeschen?' : 'Wer darf diesen Projektauftrag sehen, bearbeiten oder loeschen?'}
        </div>

        {ownerName && (
          <div style={styles.ownerHint}>
            <strong>Eigentuemer:</strong> {ownerName} (Ersteller — bleibt immer Owner)
          </div>
        )}

        {loading ? (
          <div style={styles.empty}>Lade…</div>
        ) : (
          <>
            <div style={styles.sectionTitle}>Personen</div>
            {permissions.users.length === 0 ? (
              <div style={styles.empty}>Noch niemand explizit berechtigt.</div>
            ) : (
              <div style={styles.list}>
                {permissions.users.map((p) => {
                  const eligibleHere = isPrincipalEligible('user', p.userId);
                  return (
                    <div key={p.userId} style={styles.row}>
                      <span style={styles.name}>
                        {principalLookup('user', p.userId)}
                        {!eligibleHere && (
                          <span title="Hat keinen App-Zugriff — Berechtigung ohne Wirkung" style={{ marginLeft: theme.spacing.sm, color: theme.colors.warning, fontSize: theme.typography.sizes.xs }}>
                            ⚠ kein App-Zugriff
                          </span>
                        )}
                      </span>
                      <select style={styles.select} value={p.role} onChange={(e) => updateRole('user', p.userId, e.target.value)}>
                        <option value="owner">{ROLE_LABELS.owner}</option>
                        <option value="editor">{ROLE_LABELS.editor}</option>
                        <option value="viewer">{ROLE_LABELS.viewer}</option>
                      </select>
                      <button style={styles.removeButton} onClick={() => removeEntry('user', p.userId)} title="Entfernen">×</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={styles.sectionTitle}>Gruppen</div>
            {permissions.groups.length === 0 ? (
              <div style={styles.empty}>Noch keine Gruppe berechtigt.</div>
            ) : (
              <div style={styles.list}>
                {permissions.groups.map((p) => {
                  const eligibleHere = isPrincipalEligible('group', p.groupId);
                  return (
                    <div key={p.groupId} style={styles.row}>
                      <span style={styles.name}>
                        {principalLookup('group', p.groupId)}
                        {!eligibleHere && (
                          <span title="Hat keinen App-Zugriff — Berechtigung ohne Wirkung" style={{ marginLeft: theme.spacing.sm, color: theme.colors.warning, fontSize: theme.typography.sizes.xs }}>
                            ⚠ kein App-Zugriff
                          </span>
                        )}
                      </span>
                      <select style={styles.select} value={p.role} onChange={(e) => updateRole('group', p.groupId, e.target.value)}>
                        <option value="owner">{ROLE_LABELS.owner}</option>
                        <option value="editor">{ROLE_LABELS.editor}</option>
                        <option value="viewer">{ROLE_LABELS.viewer}</option>
                      </select>
                      <button style={styles.removeButton} onClick={() => removeEntry('group', p.groupId)} title="Entfernen">×</button>
                    </div>
                  );
                })}
              </div>
            )}

            <div style={styles.sectionTitle}>Hinzufuegen</div>
            <div style={{ display: 'flex', gap: theme.spacing.sm, marginBottom: theme.spacing.md }}>
              <button
                onClick={() => { setPickKind('user'); setPickPrincipal(''); }}
                style={{
                  ...styles.cancelButton,
                  fontSize: theme.typography.sizes.xs,
                  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                  ...(pickKind === 'user' ? { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary, borderColor: theme.colors.primary } : {}),
                }}
              >
                Person
              </button>
              <button
                onClick={() => { setPickKind('group'); setPickPrincipal(''); }}
                style={{
                  ...styles.cancelButton,
                  fontSize: theme.typography.sizes.xs,
                  padding: `${theme.spacing.xs} ${theme.spacing.md}`,
                  ...(pickKind === 'group' ? { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary, borderColor: theme.colors.primary } : {}),
                }}
              >
                Gruppe
              </button>
            </div>
            {eligible.users.length === 0 && eligible.groups.length === 0 ? (
              <div style={styles.empty}>
                Es gibt noch keine User oder Gruppen mit App-Zugriff. Admin muss zuerst die App-Berechtigungen konfigurieren.
              </div>
            ) : availableForKind.length === 0 ? (
              <div style={styles.empty}>
                Alle verfuegbaren {pickKind === 'user' ? 'Personen' : 'Gruppen'} sind bereits berechtigt.
              </div>
            ) : (
              <div style={styles.addRow}>
                <select style={styles.select} value={pickPrincipal} onChange={(e) => setPickPrincipal(e.target.value)}>
                  <option value="">— {pickKind === 'user' ? 'Person' : 'Gruppe'} auswaehlen —</option>
                  {availableForKind.map((p) => (
                    <option key={p.id} value={p.id}>
                      {pickKind === 'user' ? (p.displayName || p.username) : p.name}
                    </option>
                  ))}
                </select>
                <select style={styles.select} value={pickRole} onChange={(e) => setPickRole(e.target.value)}>
                  <option value="viewer">{ROLE_LABELS.viewer}</option>
                  <option value="editor">{ROLE_LABELS.editor}</option>
                  <option value="owner">{ROLE_LABELS.owner}</option>
                </select>
                <button style={styles.addButton} onClick={addEntry} disabled={!pickPrincipal}>
                  Hinzufuegen
                </button>
              </div>
            )}

            {error && <div style={styles.error}>{error}</div>}

            <div style={styles.buttonRow}>
              <button style={styles.cancelButton} onClick={onClose} disabled={saving}>Abbrechen</button>
              <button style={styles.saveButton} onClick={save} disabled={saving}>
                {saving ? 'Speichern…' : 'Speichern'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
