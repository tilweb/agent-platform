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
import {
  DocumentIcon,
  UserIcon,
  TargetIcon,
  ListIcon,
  TimelineIcon,
  BarChartIcon,
  AlertTriangleIcon,
  AppsIcon,
  TableIcon,
  BookIcon,
  BriefcaseIcon,
  CircleIcon,
} from '../../../components/Icons';

// Icon je Step-Titel — Single Source of Truth für alle drei PM-Wizards
// (Projektidee, Projektauftrag, Statusbericht). Gleicher Titel ⇒ gleiches Icon,
// unabhängig von der Nummerierung/Reihenfolge im jeweiligen Bereich.
const STEP_ICONS = {
  Basis: DocumentIcon,
  Personen: UserIcon,
  Ziele: TargetIcon,
  Inhalt: ListIcon,
  Roadmap: TimelineIcon,
  Kosten: BarChartIcon,
  Risiken: AlertTriangleIcon,
  Übersicht: AppsIcon,
  Vergleich: TableIcon,
  Projektkontext: BookIcon,
  'Business Case': BriefcaseIcon,
  Unternehmensrisiken: AlertTriangleIcon, // gleiches Konzept wie „Risiken"
};

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
  stepTabIcon: {
    display: 'flex',
    alignItems: 'center',
    flexShrink: 0,
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
        const StepIcon = STEP_ICONS[step.title] || CircleIcon;
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
            <span style={styles.stepTabIcon}>
              <StepIcon size={16} />
            </span>
            {step.title}
          </button>
        );
      })}
      {trailing}
    </div>
  );
}

export default StepNav;
