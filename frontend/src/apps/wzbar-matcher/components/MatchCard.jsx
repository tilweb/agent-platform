import { useState } from 'react';
import { theme } from '../../../config/theme';
import { CopyIcon } from '../../../components/Icons';

const styles = {
  card: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
    transition: `all ${theme.transitions.fast}`,
  },
  cardPrimary: {
    boxShadow: theme.shadows.md,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.md,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  code: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    fontFamily: theme.typography.fontMono,
    color: theme.colors.text,
    letterSpacing: '0.05em',
  },
  codeSecondary: {
    fontSize: theme.typography.sizes.xl,
    color: theme.colors.textSecondary,
  },
  badge: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
  },
  primaryLabel: {
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.primary,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  copyButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
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
  kurztext: {
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  langtext: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.normal,
    marginBottom: theme.spacing.md,
  },
  reasoning: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    lineHeight: theme.typography.lineHeight.normal,
    paddingTop: theme.spacing.md,
    borderTop: `1px solid ${theme.colors.borderLight}`,
    fontStyle: 'italic',
  },
};

function confidenceStyle(confidence) {
  if (confidence >= 0.8) {
    return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  }
  if (confidence >= 0.5) {
    return { backgroundColor: theme.colors.warningLight, color: theme.colors.warning };
  }
  return { backgroundColor: theme.colors.errorLight, color: theme.colors.error };
}

export default function MatchCard({ candidate, isPrimary = false }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(candidate.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  };

  const pct = Math.round((candidate.confidence ?? 0) * 100);

  return (
    <div style={{ ...styles.card, ...(isPrimary ? styles.cardPrimary : {}) }}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          {isPrimary && <span style={styles.primaryLabel}>Bester Match</span>}
          <span style={isPrimary ? styles.code : styles.codeSecondary}>{candidate.code}</span>
          <span style={{ ...styles.badge, ...confidenceStyle(candidate.confidence ?? 0) }}>
            {pct}%
          </span>
        </div>
        <button
          style={{ ...styles.copyButton, ...(copied ? styles.copyButtonSuccess : {}) }}
          onClick={handleCopy}
          type="button"
        >
          <CopyIcon size={14} />
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
      <div style={styles.kurztext}>{candidate.kurztext}</div>
      {candidate.langtext && candidate.langtext !== candidate.kurztext && (
        <div style={styles.langtext}>{candidate.langtext}</div>
      )}
      {candidate.reasoning && <div style={styles.reasoning}>{candidate.reasoning}</div>}
    </div>
  );
}
