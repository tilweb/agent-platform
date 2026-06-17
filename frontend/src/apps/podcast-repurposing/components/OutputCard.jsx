import { useState, useEffect } from 'react';
import { theme } from '../../../config/theme';
import { apiFetch } from '../../../utils/apiFetch';

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  label: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  actions: { display: 'flex', gap: theme.spacing.xs },
  btn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnPrimary: { backgroundColor: theme.colors.primary, color: '#fff', border: 'none' },
  titleInput: {
    width: '100%',
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    minHeight: '120px',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
    lineHeight: 1.5,
  },
  meta: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  chip: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.primary,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: theme.borderRadius.full,
    padding: `2px ${theme.spacing.sm}`,
  },
  subject: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  errorBadge: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.md,
    padding: `2px ${theme.spacing.sm}`,
  },
};

export default function OutputCard({ label, output, onChanged }) {
  const [title, setTitle] = useState(output.title || '');
  const [content, setContent] = useState(output.content || '');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setTitle(output.title || '');
    setContent(output.content || '');
  }, [output.id, output.content, output.title]);

  const dirty = title !== (output.title || '') || content !== (output.content || '');
  const fields = output.fields || {};

  const save = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`/apps/podcast-repurposing/outputs/${output.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (data.output) onChanged?.(data.output);
    } finally {
      setBusy(false);
    }
  };

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`/apps/podcast-repurposing/outputs/${output.id}/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (data.output) onChanged?.(data.output);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    const subject = fields.subject ? `Betreff: ${fields.subject}\n\n` : '';
    const hashtags = Array.isArray(fields.hashtags) && fields.hashtags.length ? `\n\n${fields.hashtags.join(' ')}` : '';
    await navigator.clipboard.writeText(`${title ? title + '\n\n' : ''}${subject}${content}${hashtags}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={styles.card}>
      <div style={styles.head}>
        <span style={styles.label}>{label}</span>
        <div style={styles.actions}>
          {output.status === 'failed' && <span style={styles.errorBadge}>Fehler</span>}
          <button style={styles.btn} onClick={copy} disabled={busy}>{copied ? 'Kopiert' : 'Kopieren'}</button>
          <button style={styles.btn} onClick={regenerate} disabled={busy}>Neu generieren</button>
          {dirty && <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={save} disabled={busy}>Speichern</button>}
        </div>
      </div>

      {(output.title !== null && output.title !== undefined) && (
        <input style={styles.titleInput} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titel" />
      )}
      {fields.subject !== undefined && <div style={styles.subject}>Betreff: {fields.subject}</div>}

      <textarea style={styles.textarea} value={content} onChange={(e) => setContent(e.target.value)} />

      {Array.isArray(fields.hashtags) && fields.hashtags.length > 0 && (
        <div style={styles.meta}>
          {fields.hashtags.map((h, i) => <span key={i} style={styles.chip}>{h}</span>)}
        </div>
      )}
      {fields.cta && <div style={styles.subject}>CTA: {fields.cta}</div>}
      {output.error && <div style={styles.errorBadge}>{output.error}</div>}
    </div>
  );
}
