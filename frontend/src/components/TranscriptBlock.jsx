/**
 * TranscriptBlock Component
 * Display transcription text with icon, collapsible for long transcripts
 */

import { useState } from 'react';
import { theme } from '../config/theme';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: 'pointer',
  },
  icon: {
    flexShrink: 0,
    color: theme.colors.primary,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  expandButton: {
    marginLeft: 'auto',
    background: 'none',
    border: 'none',
    padding: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    cursor: 'pointer',
    color: theme.colors.textMuted,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    transition: `all ${theme.transitions.fast}`,
  },
  content: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  contentCollapsed: {
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  charCount: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
};

// Number of characters above which we show collapse/expand
const COLLAPSE_THRESHOLD = 300;

export function TranscriptBlock({ text, language }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const isLong = text && text.length > COLLAPSE_THRESHOLD;
  const shouldCollapse = isLong && !isExpanded;

  return (
    <div style={styles.container}>
      <div
        style={styles.header}
        onClick={() => isLong && setIsExpanded(!isExpanded)}
      >
        <svg style={styles.icon} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <line x1="10" y1="9" x2="8" y2="9" />
        </svg>
        <span style={styles.label}>
          Transkript{language ? ` (${language.toUpperCase()})` : ''}
        </span>
        {isLong && (
          <button
            style={styles.expandButton}
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = theme.colors.primary;
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = theme.colors.textMuted;
            }}
          >
            {isExpanded ? (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                Weniger
              </>
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
                Mehr
              </>
            )}
          </button>
        )}
      </div>

      <div
        style={{
          ...styles.content,
          ...(shouldCollapse ? styles.contentCollapsed : {}),
        }}
      >
        {text || 'Kein Transkript verfügbar'}
      </div>

      {text && (
        <div style={styles.charCount}>
          {text.length} Zeichen
        </div>
      )}
    </div>
  );
}

export default TranscriptBlock;
