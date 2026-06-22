/**
 * RoadmapModal — Vollbild-/Fenster-Ansicht der Gantt-Roadmap.
 * Rendert denselben GanttRoadmap größer (mehr Platz für lange Laufzeiten).
 */

import { theme } from '../../../config/theme';
import GanttRoadmap from './GanttRoadmap';

const styles = {
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: theme.spacing.xl,
  },
  modal: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    border: `1px solid ${theme.colors.border}`,
    width: '95%',
    maxWidth: '1200px',
    maxHeight: '88vh',
    overflow: 'auto',
    padding: theme.spacing['2xl'],
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.xl,
    lineHeight: 1,
    padding: theme.spacing.xs,
  },
};

function RoadmapModal({ open, onClose, title = 'Roadmap', items, rangeStart, rangeEnd, onItemClick }) {
  if (!open) return null;
  return (
    <div
      style={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button type="button" style={styles.closeBtn} onClick={onClose} aria-label="Schließen">×</button>
        </div>
        <GanttRoadmap
          items={items}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          onItemClick={onItemClick}
        />
      </div>
    </div>
  );
}

export default RoadmapModal;
