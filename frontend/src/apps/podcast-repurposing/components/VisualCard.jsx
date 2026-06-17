import { useState } from 'react';
import { theme } from '../../../config/theme';
import { apiFetch, API_URL } from '../../../utils/apiFetch';

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.md,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  label: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  imgWrap: {
    width: '100%',
    aspectRatio: '1 / 1',
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  placeholder: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, padding: theme.spacing.md, textAlign: 'center' },
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
    textDecoration: 'none',
    display: 'inline-flex',
    alignItems: 'center',
  },
};

const ASPECT = { '16:9': '16 / 9', '1:1': '1 / 1', '9:16': '9 / 16' };

export default function VisualCard({ label, visual, onChanged }) {
  const [busy, setBusy] = useState(false);
  const imgUrl = visual.imageId ? `${API_URL}/images/generated/${visual.imageId}` : null;

  const regenerate = async () => {
    setBusy(true);
    try {
      const res = await apiFetch(`/apps/podcast-repurposing/visuals/${visual.id}/regenerate`, { method: 'POST' });
      const data = await res.json();
      if (data.visual) onChanged?.(data.visual);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={styles.card}>
      <span style={styles.label}>{label} · {visual.aspectRatio}</span>
      <div style={{ ...styles.imgWrap, aspectRatio: ASPECT[visual.aspectRatio] || '1 / 1' }}>
        {imgUrl ? (
          <img src={imgUrl} alt={label} style={styles.img} />
        ) : (
          <div style={styles.placeholder}>{visual.error || 'Kein Bild'}</div>
        )}
      </div>
      <div style={styles.actions}>
        {imgUrl && <a style={styles.btn} href={imgUrl} target="_blank" rel="noreferrer" download>Öffnen</a>}
        <button style={styles.btn} onClick={regenerate} disabled={busy}>Neu generieren</button>
      </div>
    </div>
  );
}
