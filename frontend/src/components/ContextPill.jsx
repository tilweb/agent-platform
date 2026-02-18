/**
 * ContextPill Component
 *
 * Einheitliche Pill-Komponente für Kontext-Anzeige im Chat.
 * Design: Grauer Hintergrund + farbiges Icon (wie Datei-Uploads).
 *
 * Typen:
 * - agent: Blau (#3b82f6) - wenn Agent nicht Auto-Route
 * - model: Lila (#8b5cf6) - wenn nicht Default-Modell
 * - table: Grün (#059669) - wenn Tabelle ausgewählt
 * - file: Orange (#f59e0b) / Blau (#3b82f6 für Bilder)
 */

import { theme } from '../config/theme';

// Icon-Farben passend zu Sidebar navIconColors
export const pillIconColors = {
  agent: '#3b82f6',   // Blau (wie agents in Sidebar)
  model: '#8b5cf6',   // Lila (neu für models)
  table: '#059669',   // Grün (wie tables in Sidebar)
  file: '#f59e0b',    // Orange für Dokumente
  image: '#3b82f6',   // Blau für Bilder
  audio: '#ec4899',   // Pink für Audio
  project: '#9333ea', // Lila (wie projects in Sidebar)
};

const styles = {
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: `6px ${theme.spacing.md}`,
    backgroundColor: theme.colors.surfaceHover,  // Grau #f1f5f9
    border: `1px solid ${theme.colors.border}`,  // #e2e8f0
    borderRadius: theme.borderRadius.lg,         // 12px
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    maxWidth: '200px',
  },
  iconWrapper: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
  },
  label: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  },
  processingText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginLeft: '4px',
  },
  removeButton: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    opacity: 0.6,
    padding: 0,
    display: 'flex',
    alignItems: 'center',
    marginLeft: '2px',
    transition: `opacity ${theme.transitions.fast}`,
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid transparent',
    borderRadius: '50%',
    animation: 'contextPillSpin 1s linear infinite',
    flexShrink: 0,
  },
};

// Spinner-Keyframes (werden in ChatWindow.jsx global definiert)
export const spinnerKeyframes = `
  @keyframes contextPillSpin {
    to { transform: rotate(360deg); }
  }
`;

/**
 * Spinner-Komponente für Processing-State
 */
function Spinner({ size = 14, color }) {
  return (
    <div
      style={{
        ...styles.spinner,
        width: `${size}px`,
        height: `${size}px`,
        borderTopColor: color,
        borderRightColor: color,
      }}
    />
  );
}

/**
 * Standard Close/Remove Icon
 */
function CloseIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

/**
 * Agent Icon
 */
export function AgentPillIcon({ color = pillIconColors.agent, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <polyline points="17 11 19 13 23 9" />
    </svg>
  );
}

/**
 * Model Icon (Brain)
 */
export function ModelPillIcon({ color = pillIconColors.model, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M12 2a9 9 0 0 1 9 9c0 3.6-2.4 6.6-5.7 7.7-.3.1-.5.3-.7.6l-1.1 2.2c-.3.6-1.1.6-1.4 0l-1.1-2.2c-.2-.3-.4-.5-.7-.6A9 9 0 0 1 3 11a9 9 0 0 1 9-9Z" />
      <circle cx="12" cy="11" r="3" />
    </svg>
  );
}

/**
 * Table Icon
 */
export function TablePillIcon({ color = pillIconColors.table, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M3 9h18" />
      <path d="M3 15h18" />
      <path d="M9 3v18" />
    </svg>
  );
}

/**
 * Document File Icon
 */
export function FilePillIcon({ color = pillIconColors.file, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

/**
 * Image File Icon
 */
export function ImagePillIcon({ color = pillIconColors.image, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

/**
 * Audio File Icon
 */
export function AudioPillIcon({ color = pillIconColors.audio, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </svg>
  );
}

/**
 * Project Icon (Briefcase)
 */
export function ProjectPillIcon({ color = pillIconColors.project, size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  );
}

/**
 * ContextPill - Einheitliche Pill-Komponente
 *
 * @param {React.ReactNode} icon - SVG Icon Element
 * @param {string} iconColor - Farbe für Icon und Spinner
 * @param {string} label - Angezeigter Text
 * @param {function} onRemove - Optional: Callback zum Entfernen
 * @param {boolean} isProcessing - Zeigt Spinner statt Icon
 * @param {string} processingText - Optional: Text während Processing
 * @param {string} title - Optional: Tooltip-Text
 */
export function ContextPill({
  icon,
  iconColor,
  label,
  onRemove,
  isProcessing = false,
  processingText,
  title,
}) {
  return (
    <div style={styles.pill} title={title || label}>
      <div style={styles.iconWrapper}>
        {isProcessing ? (
          <Spinner size={14} color={iconColor} />
        ) : (
          icon
        )}
      </div>
      <span style={styles.label}>{label}</span>
      {isProcessing && processingText && (
        <span style={styles.processingText}>{processingText}</span>
      )}
      {onRemove && (
        <button
          style={styles.removeButton}
          onClick={onRemove}
          onMouseOver={(e) => { e.currentTarget.style.opacity = '1'; }}
          onMouseOut={(e) => { e.currentTarget.style.opacity = '0.6'; }}
          title="Entfernen"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * AgentPill - Vorkonfigurierte Pill für Agent-Auswahl
 */
export function AgentPill({ agentName, onRemove }) {
  return (
    <ContextPill
      icon={<AgentPillIcon color={pillIconColors.agent} size={16} />}
      iconColor={pillIconColors.agent}
      label={`Agent: ${agentName}`}
      onRemove={onRemove}
      title="Agent-Auswahl zurücksetzen auf Auto-Routing"
    />
  );
}

/**
 * ModelPill - Vorkonfigurierte Pill für Modell-Auswahl
 */
export function ModelPill({ modelName, onRemove }) {
  return (
    <ContextPill
      icon={<ModelPillIcon color={pillIconColors.model} size={16} />}
      iconColor={pillIconColors.model}
      label={`Modell: ${modelName}`}
      onRemove={onRemove}
      title="Modell-Auswahl zurücksetzen auf Standard"
    />
  );
}

/**
 * TablePill - Vorkonfigurierte Pill für Tabellen-Auswahl
 */
export function TablePill({ tableName, onRemove }) {
  return (
    <ContextPill
      icon={<TablePillIcon color={pillIconColors.table} size={16} />}
      iconColor={pillIconColors.table}
      label={tableName}
      onRemove={onRemove}
      title="Tabellen-Kontext entfernen"
    />
  );
}

/**
 * FilePill - Vorkonfigurierte Pill für Datei-Uploads
 */
export function FilePill({ filename, isImage = false, isAudio = false, isProcessing = false, onRemove }) {
  let color = pillIconColors.file;
  let Icon = FilePillIcon;

  if (isImage) {
    color = pillIconColors.image;
    Icon = ImagePillIcon;
  } else if (isAudio) {
    color = pillIconColors.audio;
    Icon = AudioPillIcon;
  }

  return (
    <ContextPill
      icon={<Icon color={color} size={16} />}
      iconColor={color}
      label={filename}
      onRemove={onRemove}
      isProcessing={isProcessing}
      processingText={isProcessing ? "Wird verarbeitet..." : undefined}
      title={filename}
    />
  );
}

/**
 * ProjectPill - Vorkonfigurierte Pill für Space-Kontext
 */
export function ProjectPill({ projectName, onRemove }) {
  return (
    <ContextPill
      icon={<ProjectPillIcon color={pillIconColors.project} size={16} />}
      iconColor={pillIconColors.project}
      label={projectName}
      onRemove={onRemove}
      title={onRemove ? "Space-Kontext entfernen" : `Space: ${projectName}`}
    />
  );
}

export default ContextPill;
