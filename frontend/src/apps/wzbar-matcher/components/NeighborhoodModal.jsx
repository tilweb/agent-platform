import { useEffect, useState } from 'react';
import { theme } from '../../../config/theme';
import { apiGet } from '../../../utils/apiFetch';
import { CopyIcon, XIcon } from '../../../components/Icons';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    width: '90%',
    maxWidth: '720px',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    padding: theme.spacing.xl,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  title: {
    margin: 0,
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  closeButton: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    overflowY: 'auto',
    padding: theme.spacing.lg,
  },
  empty: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    padding: theme.spacing.xl,
    textAlign: 'center',
  },
  loading: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    padding: theme.spacing.xl,
    textAlign: 'center',
  },
  error: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.md,
    margin: theme.spacing.md,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.md,
    transition: `background-color ${theme.transitions.fast}`,
  },
  rowCurrent: {
    backgroundColor: theme.colors.primaryLight,
  },
  code: {
    fontFamily: theme.typography.fontMono,
    fontWeight: theme.typography.weights.semibold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    minWidth: '80px',
  },
  codeCurrent: {
    color: theme.colors.primary,
  },
  texts: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  kurztext: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontWeight: theme.typography.weights.medium,
  },
  langtext: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  copyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    backgroundColor: 'transparent',
    color: theme.colors.textSecondary,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
  },
  copyButtonSuccess: {
    color: theme.colors.success,
    borderColor: theme.colors.success,
  },
  levelLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    fontWeight: theme.typography.weights.semibold,
    letterSpacing: '0.05em',
    padding: `${theme.spacing.md} ${theme.spacing.md} ${theme.spacing.xs}`,
  },
};

const LEVEL_NAMES = {
  4: 'Klasse',
  5: 'Unterklasse',
  6: 'Detail-Unterklasse',
};

function CopyCell({ code }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };
  return (
    <button
      type="button"
      style={{ ...styles.copyButton, ...(copied ? styles.copyButtonSuccess : {}) }}
      onClick={onCopy}
    >
      <CopyIcon size={12} />
      {copied ? 'Kopiert' : 'Kopieren'}
    </button>
  );
}

export default function NeighborhoodModal({ open, code, onClose }) {
  const [nodes, setNodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !code) return;
    setLoading(true);
    setError(null);
    apiGet(`/apps/wzbar-matcher/neighborhood/${encodeURIComponent(code)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) {
          setError(data?.error || 'Umfeld konnte nicht geladen werden');
          setNodes([]);
        } else {
          setNodes(data.nodes || []);
        }
      })
      .catch((e) => setError(e?.message || 'Netzwerkfehler'))
      .finally(() => setLoading(false));
  }, [open, code]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // Group by level for clearer rendering
  const byLevel = { 4: [], 5: [], 6: [] };
  for (const n of nodes) {
    if (byLevel[n.level]) byLevel[n.level].push(n);
  }

  return (
    <div
      style={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
    >
      <div style={styles.content}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <h2 style={styles.title}>Umfeld zu {code}</h2>
            <div style={styles.subtitle}>Hierarchische Nachbarcodes (Klasse → Unterklasse → Detail-Unterklasse)</div>
          </div>
          <button type="button" style={styles.closeButton} onClick={onClose} aria-label="Schliessen">
            <XIcon size={18} />
          </button>
        </div>

        <div style={styles.body}>
          {loading && <div style={styles.loading}>Wird geladen…</div>}
          {error && <div style={styles.error}>{error}</div>}
          {!loading && !error && nodes.length === 0 && (
            <div style={styles.empty}>Keine Nachbarcodes gefunden.</div>
          )}
          {!loading && !error && nodes.length > 0 && (
            <>
              {[4, 5, 6].map((level) => {
                const list = byLevel[level];
                if (!list || list.length === 0) return null;
                return (
                  <div key={level}>
                    <div style={styles.levelLabel}>
                      {LEVEL_NAMES[level]} ({level}-stellig)
                    </div>
                    {list.map((n) => (
                      <div
                        key={n.code}
                        style={{
                          ...styles.row,
                          ...(n.isCurrent ? styles.rowCurrent : {}),
                          paddingLeft: `calc(${theme.spacing.md} + ${n.indent * 24}px)`,
                        }}
                      >
                        <span style={{ ...styles.code, ...(n.isCurrent ? styles.codeCurrent : {}) }}>
                          {n.code}
                        </span>
                        <div style={styles.texts}>
                          <div style={styles.kurztext}>{n.kurztext}</div>
                          {n.langtext && n.langtext !== n.kurztext && (
                            <div style={styles.langtext} title={n.langtext}>{n.langtext}</div>
                          )}
                        </div>
                        <CopyCell code={n.code} />
                      </div>
                    ))}
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
