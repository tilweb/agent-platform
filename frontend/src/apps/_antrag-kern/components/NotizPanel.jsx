import { useState } from 'react';
import { theme } from '../../../config/theme';
import { XIcon, TrashIcon } from '../../../components/Icons';

const styles = {
  overlay: {
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0, 0, 0, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1200,
  },
  card: {
    backgroundColor: theme.colors.surface, borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`, width: '90%', maxWidth: 460,
    maxHeight: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
  },
  head: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: theme.spacing.lg, borderBottom: `1px solid ${theme.colors.border}`,
  },
  title: { fontSize: theme.typography.sizes.md, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  iconBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: theme.spacing.xs, background: 'none', border: 'none', borderRadius: theme.borderRadius.md, cursor: 'pointer' },
  list: { padding: theme.spacing.lg, overflowY: 'auto', flex: 1 },
  empty: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },
  notiz: { padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.borderLight}` },
  notizText: { fontSize: theme.typography.sizes.sm, color: theme.colors.text, lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  meta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm, marginTop: 2 },
  metaText: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  foot: { padding: theme.spacing.lg, borderTop: `1px solid ${theme.colors.border}`, display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  textarea: {
    width: '100%', minHeight: 70, fontFamily: theme.typography.fontFamily, fontSize: theme.typography.sizes.sm,
    padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', resize: 'vertical',
  },
  btnRow: { display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.sm },
  btn: { padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: theme.colors.primary, color: '#fff', border: 'none', borderRadius: theme.borderRadius.lg, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, cursor: 'pointer' },
  delBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 2, background: 'none', border: 'none', borderRadius: theme.borderRadius.sm, cursor: 'pointer' },
};

function fmtDateTime(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
}

/**
 * Kleines Panel für Notizen zu einem Anker (Sektion/Person, WP4).
 * `notizen` sind bereits auf den Anker gefiltert.
 */
export default function NotizPanel({ label, notizen = [], canEdit = false, busy = false, onAdd, onDelete, onClose }) {
  const [text, setText] = useState('');

  async function submit() {
    const t = text.trim();
    if (!t) return;
    await onAdd?.(t);
    setText('');
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.head}>
          <span style={styles.title}>Notizen · {label}</span>
          <button style={styles.iconBtn} onClick={onClose} title="Schließen" aria-label="Schließen">
            <XIcon size={18} color={theme.colors.textMuted} />
          </button>
        </div>

        <div style={styles.list}>
          {notizen.length === 0 ? (
            <div style={styles.empty}>Noch keine Notizen.</div>
          ) : (
            notizen.slice().reverse().map((n) => (
              <div key={n.id} style={styles.notiz}>
                <div style={styles.notizText}>{n.text}</div>
                <div style={styles.meta}>
                  <span style={styles.metaText}>{[n.autor, fmtDateTime(n.created_at)].filter(Boolean).join(' · ')}</span>
                  {canEdit && (
                    <button style={styles.delBtn} onClick={() => onDelete?.(n)} disabled={busy} title="Löschen" aria-label="Notiz löschen">
                      <TrashIcon size={14} color={theme.colors.textMuted} />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {canEdit && (
          <div style={styles.foot}>
            <textarea
              style={styles.textarea}
              placeholder="Notiz hinzufügen…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div style={styles.btnRow}>
              <button style={styles.btn} onClick={submit} disabled={busy || !text.trim()}>Notiz hinzufügen</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
