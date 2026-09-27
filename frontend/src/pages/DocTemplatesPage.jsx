/**
 * Dokumentvorlagen — Verwaltung der Word-Designvorlagen.
 *
 * Admin-only. Eine Designvorlage gibt das Corporate Design für Word-Exporte aus
 * dem Chat vor (Kopf-/Fußzeile, Logo, Formatvorlagen). Genau eine kann Standard
 * der Instanz sein. Embedded in SettingsPage via embedded={true}.
 */

import { useCallback, useEffect, useState } from 'react';
import { theme } from '../config/theme';
import { apiGet, apiPut, apiDelete, apiPostForm, API_URL } from '../utils/apiFetch';
import {
  DocumentIcon, UploadIcon, DownloadIcon, TrashIcon, XIcon, InfoIcon, CheckIcon, AlertTriangleIcon, EyeIcon,
} from '../components/Icons';

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
    whiteSpace: 'nowrap',
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
  smallBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    whiteSpace: 'nowrap',
  },
  dangerBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
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
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing.xs,
    justifyContent: 'flex-end',
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
  nameCol: { width: '30%', minWidth: '220px' },
  noteIcon: { flexShrink: 0, display: 'inline-flex', marginTop: '2px' },
  meta: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    whiteSpace: 'nowrap',
  },
  badgeDefault: { backgroundColor: theme.colors.successLight, color: theme.colors.success },
  checkList: {
    margin: 0,
    padding: 0,
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
  },
  checkItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    lineHeight: 1.4,
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
  infoBox: {
    display: 'flex',
    gap: theme.spacing.md,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.xl,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: 1.5,
  },
  infoTitle: {
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  infoList: {
    margin: `${theme.spacing.xs} 0 0`,
    paddingLeft: theme.spacing.lg,
  },
  code: {
    fontFamily: theme.typography.fontMono,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.surfaceHover,
    padding: `0 ${theme.spacing.xs}`,
    borderRadius: theme.borderRadius.sm,
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
    maxWidth: '560px',
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
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  errorBox: {
    padding: theme.spacing.md,
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.md,
  },
};

// Sprachneutrale Word-Formatvorlagen-Namen → deutsche Anzeige
const STYLE_LABELS = {
  title: 'Titel',
  'heading 1': 'Überschrift 1',
  'heading 2': 'Überschrift 2',
  'heading 3': 'Überschrift 3',
  'heading 4': 'Überschrift 4',
  'list paragraph': 'Listenabsatz',
  quote: 'Zitat',
  hyperlink: 'Hyperlink',
  'table grid': 'Tabellenraster',
};

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return iso;
  }
}

function formatSize(bytes) {
  if (!bytes) return '';
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
}

async function downloadFile(endpoint, filename) {
  const res = await fetch(`${API_URL}${endpoint}`, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Download fehlgeschlagen');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Prüfergebnis vom Upload als verständliche Hinweise. */
function InspectionNotes({ inspection }) {
  if (!inspection) return null;
  const ok = (text) => ({ ok: true, text });
  const warn = (text) => ({ ok: false, text });
  const notes = [];
  notes.push(inspection.hasHeaderOrFooter ? ok('Kopf-/Fußzeile vorhanden') : warn('Keine Kopf-/Fußzeile'));
  notes.push(inspection.hasContentMarker
    ? ok('Platz für den Inhalt markiert ({{INHALT}})')
    : warn('Kein {{INHALT}} – Inhalt wird am Dokumentende angefügt'));
  const fields = (inspection.placeholders || []).filter(p => p === 'TITEL' || p === 'DATUM');
  if (fields.length) notes.push(ok(`Felder: ${fields.map(f => `{{${f}}}`).join(', ')}`));
  if (inspection.missingStyles?.length) {
    notes.push(warn(`Ergänzt: ${inspection.missingStyles.map(s => STYLE_LABELS[s] || s).join(', ')}`));
  }
  if (inspection.unknownPlaceholders?.length) {
    notes.push(warn(`Unbekannte Platzhalter bleiben stehen: ${inspection.unknownPlaceholders.map(p => `{{${p}}}`).join(', ')}`));
  }
  return (
    <ul style={styles.checkList}>
      {notes.map((n, i) => (
        <li key={i} style={styles.checkItem}>
          <span style={styles.noteIcon}>
            {n.ok
              ? <CheckIcon size={12} color={theme.colors.success} />
              : <InfoIcon size={12} color={theme.colors.textMuted} />}
          </span>
          <span>{n.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function DocTemplatesPage({ embedded = false }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showUpload, setShowUpload] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet('/doc-templates?kind=design');
      if (!res.ok) throw new Error('Fehler beim Laden der Vorlagen');
      const data = await res.json();
      setTemplates(data.templates || []);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const run = async (id, fn) => {
    try {
      setBusyId(id);
      setError(null);
      await fn();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const toggleDefault = (tpl) => run(tpl.id, async () => {
    const res = tpl.isDefault ? await apiDelete('/doc-templates/default') : await apiPut(`/doc-templates/${tpl.id}/default`);
    if (!res.ok) throw new Error('Standard konnte nicht geändert werden');
    await refresh();
  });

  const onDelete = (tpl) => run(tpl.id, async () => {
    const res = await apiDelete(`/doc-templates/${tpl.id}`);
    if (!res.ok) throw new Error('Löschen fehlgeschlagen');
    setConfirmDelete(null);
    await refresh();
  });

  const Header = (
    <div style={styles.header}>
      <div>
        <div style={styles.titleRow}>
          <DocumentIcon size={20} color={theme.colors.primary} />
          <h2 style={styles.title}>Dokumentvorlagen</h2>
        </div>
        <p style={styles.subtitle}>
          Designvorlagen geben Word-Dokumenten aus dem Chat Ihr Corporate Design: Kopf- und Fußzeile, Logo, Schriften und Farben.
        </p>
      </div>
      <button style={styles.primaryBtn} onClick={() => setShowUpload(true)}>
        <UploadIcon size={14} color="#fff" />
        Designvorlage hochladen
      </button>
    </div>
  );

  return (
    <div style={styles.root}>
      {!embedded && Header}
      {embedded && Header}

      <div style={styles.infoBox}>
        <InfoIcon size={18} color={theme.colors.primary} />
        <div>
          <div style={styles.infoTitle}>So bereiten Sie eine Designvorlage vor</div>
          Nehmen Sie ein Word-Dokument in Ihrem Design und leeren Sie den Textkörper. Kopf- und Fußzeile, Logo und Seitenränder bleiben erhalten.
          <ul style={styles.infoList}>
            <li>Schreiben Sie <span style={styles.code}>{'{{INHALT}}'}</span> allein in einen Absatz – dort erscheint der Text aus dem Chat.</li>
            <li>Optional: <span style={styles.code}>{'{{TITEL}}'}</span> und <span style={styles.code}>{'{{DATUM}}'}</span> im Text, in der Kopf- oder Fußzeile.</li>
            <li>Überschriften, Listen, Tabellen und Links nutzen die Word-Formatvorlagen der Datei. Fehlende werden passend zu Ihrer „Überschrift 1“ bzw. Ihren Designfarben ergänzt.</li>
          </ul>
        </div>
      </div>

      {error && <div style={styles.errorBox}>{error}</div>}

      {loading ? (
        <div style={styles.empty}>Lädt…</div>
      ) : templates.length === 0 ? (
        <div style={styles.empty}>
          Noch keine Designvorlage hochgeladen. Word-Exporte nutzen bis dahin das neutrale Standard-Layout.
        </div>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, ...styles.nameCol }}>Vorlage</th>
              <th style={styles.th}>Prüfung</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}></th>
            </tr>
          </thead>
          <tbody>
            {templates.map((t, idx) => {
              const last = idx === templates.length - 1;
              const td = { ...styles.td, ...(last ? styles.tdLast : {}) };
              const busy = busyId === t.id;
              return (
                <tr key={t.id}>
                  <td style={td}>
                    <div style={{ fontWeight: theme.typography.weights.medium }}>{t.name}</div>
                    {t.description && <div style={styles.meta}>{t.description}</div>}
                    <div style={styles.meta}>{t.filename} · {formatSize(t.sizeBytes)} · {formatDate(t.createdAt)}</div>
                  </td>
                  <td style={td}><InspectionNotes inspection={t.inspection} /></td>
                  <td style={td}>
                    {t.isDefault && (
                      <span style={{ ...styles.badge, ...styles.badgeDefault }}>
                        <CheckIcon size={12} color={theme.colors.success} />
                        Standard
                      </span>
                    )}
                  </td>
                  <td style={td}>
                    <div style={styles.actions}>
                      <button
                        style={styles.smallBtn}
                        disabled={busy}
                        title="Beispieldokument mit Überschriften, Listen und Tabelle in dieser Vorlage erzeugen"
                        onClick={() => run(t.id, () => downloadFile(`/doc-templates/${t.id}/preview`, `Testdokument ${t.name}.docx`))}
                      >
                        <EyeIcon size={12} color={theme.colors.text} />
                        Testdokument
                      </button>
                      <button style={styles.smallBtn} disabled={busy} onClick={() => toggleDefault(t)}>
                        {t.isDefault ? 'Standard entfernen' : 'Als Standard'}
                      </button>
                      <button
                        style={styles.smallBtn}
                        disabled={busy}
                        title="Hochgeladene Originaldatei herunterladen"
                        onClick={() => run(t.id, () => downloadFile(`/doc-templates/${t.id}/file`, t.filename))}
                      >
                        <DownloadIcon size={12} color={theme.colors.text} />
                        Original
                      </button>
                      <button style={styles.dangerBtn} disabled={busy} onClick={() => setConfirmDelete(t)}>
                        <TrashIcon size={12} color={theme.colors.error} />
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={async () => {
            setShowUpload(false);
            await refresh();
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDeleteModal
          template={confirmDelete}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => onDelete(confirmDelete)}
        />
      )}
    </div>
  );
}

function UploadModal({ onClose, onUploaded }) {
  const [file, setFile] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const pickFile = (f) => {
    setFile(f);
    if (f && !name) setName(f.name.replace(/\.(docx|dotx)$/i, ''));
  };

  const submit = async () => {
    setError(null);
    if (!file) return setError('Bitte eine Word-Datei auswählen.');
    const form = new FormData();
    form.append('file', file);
    form.append('name', name.trim());
    form.append('description', description.trim());
    try {
      setSubmitting(true);
      const res = await apiPostForm('/doc-templates', form);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload fehlgeschlagen');
      await onUploaded(data.template);
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
          <h3 style={styles.modalTitle}>Designvorlage hochladen</h3>
          <button style={styles.closeBtn} onClick={onClose}>
            <XIcon size={18} color={theme.colors.textMuted} />
          </button>
        </div>
        <div style={styles.modalBody}>
          {error && <div style={styles.errorBox}>{error}</div>}

          <div style={styles.field}>
            <label style={styles.label}>Word-Datei</label>
            <input
              style={styles.input}
              type="file"
              accept=".docx,.dotx,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.wordprocessingml.template"
              onChange={(e) => pickFile(e.target.files?.[0] || null)}
            />
            <div style={styles.hint}>.docx oder .dotx, max. 20 MB. Die Datei wird beim Hochladen geprüft.</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <input
              style={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Geschäftsbrief Standard"
              maxLength={120}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Beschreibung (optional)</label>
            <input
              style={styles.input}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Wofür ist die Vorlage gedacht?"
            />
          </div>
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.secondaryBtn} onClick={onClose} disabled={submitting}>Abbrechen</button>
          <button style={styles.primaryBtn} onClick={submit} disabled={submitting}>
            {submitting ? 'Lädt hoch…' : 'Hochladen'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ template, onCancel, onConfirm }) {
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={{ ...styles.modal, maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={styles.modalTitle}>Vorlage löschen?</h3>
        </div>
        <div style={styles.modalBody}>
          <p style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.text, marginTop: 0 }}>
            Die Designvorlage <strong>{template.name}</strong> wird dauerhaft gelöscht.
          </p>
          {template.isDefault && (
            <div style={{ ...styles.checkItem, fontSize: theme.typography.sizes.sm }}>
              <AlertTriangleIcon size={16} color={theme.colors.warning} />
              <span>Sie ist der aktuelle Standard. Word-Exporte nutzen danach das neutrale Standard-Layout.</span>
            </div>
          )}
        </div>
        <div style={styles.modalFooter}>
          <button style={styles.secondaryBtn} onClick={onCancel}>Abbrechen</button>
          <button style={{ ...styles.primaryBtn, backgroundColor: theme.colors.error }} onClick={onConfirm}>
            <TrashIcon size={14} color="#fff" />
            Löschen
          </button>
        </div>
      </div>
    </div>
  );
}
