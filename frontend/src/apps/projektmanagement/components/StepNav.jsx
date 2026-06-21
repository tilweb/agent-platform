/**
 * StepNav — einheitliche Step-/Sub-Navigation der PM-Eingabemasken
 * (Projektauftrag, Projektidee, Statusbericht).
 *
 * Rendert eine Zeile aus nummerierten Kreis-Tabs. Die "erledigt"-Logik liefert
 * der Aufrufer via getStatus(number) -> 'active' | 'completed' | 'default', damit
 * jede Maske ihre eigenen Vollstaendigkeits-Regeln behaelt, aber identisch aussieht.
 *
 * Props:
 *  - steps:    [{ number, title }]
 *  - getStatus(number) => 'active' | 'completed' | 'default'
 *  - onSelect(number)
 *  - leading?  ReactNode (z. B. "SB #3" links in der Zeile)
 *  - trailing? ReactNode (z. B. Export/Speichern rechts, via marginLeft: auto)
 */

import { theme } from '../../../config/theme';

const styles = {
  stepTabs: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing['2xl']}`,
    backgroundColor: 'transparent',
    overflowX: 'auto',
    flexWrap: 'nowrap',
  },
  stepTab: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    whiteSpace: 'nowrap',
  },
  stepTabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  stepTabCompleted: {
    color: theme.colors.success,
  },
  stepTabNumber: {
    width: '20px',
    height: '20px',
    borderRadius: theme.borderRadius.full,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    flexShrink: 0,
  },
  stepTabNumberDefault: {
    backgroundColor: theme.colors.border,
    color: theme.colors.textMuted,
  },
  stepTabNumberActive: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
  },
  stepTabNumberCompleted: {
    backgroundColor: theme.colors.success,
    color: '#fff',
  },
};

function StepNav({ steps, getStatus, onSelect, leading = null, trailing = null }) {
  return (
    <div style={styles.stepTabs}>
      {leading}
      {steps.map((step) => {
        const status = getStatus(step.number);
        const isActive = status === 'active';
        const isCompleted = status === 'completed';
        return (
          <button
            key={step.number}
            type="button"
            style={{
              ...styles.stepTab,
              ...(isActive ? styles.stepTabActive : {}),
              ...(!isActive && isCompleted ? styles.stepTabCompleted : {}),
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSelect(step.number);
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = theme.colors.surfaceHover;
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                e.currentTarget.style.backgroundColor = 'transparent';
              }
            }}
          >
            <div
              style={{
                ...styles.stepTabNumber,
                ...(isActive ? styles.stepTabNumberActive : {}),
                ...(!isActive && isCompleted ? styles.stepTabNumberCompleted : {}),
                ...(!isActive && !isCompleted ? styles.stepTabNumberDefault : {}),
              }}
            >
              {step.number}
            </div>
            {step.title}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}

export default StepNav;
