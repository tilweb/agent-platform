/**
 * OwnerActionsMenu — Drei-Punkte-Menue fuer Auftrags-/Idee-Owner-Aktionen.
 *
 * Aktuell: "Berechtigungen verwalten" + "Loeschen". Sichtbar nur wenn der
 * aktuelle User Owner der Resource ist (canManagePermissions === canDelete).
 *
 * Wird in IdeeWizardPage und WizardPage verwendet — ersetzt den frueheren
 * direkten Loeschen-Button im Header.
 */

import { useEffect, useRef, useState } from 'react';
import { theme } from '../../../config/theme';
import { TrashIcon } from '../../../components/Icons';

const styles = {
  trigger: {
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    transition: `all ${theme.transitions.fast}`,
    minWidth: '40px',
    height: '40px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotIcon: {
    fontSize: '20px',
    lineHeight: '1',
    fontWeight: 'bold',
  },
  menu: {
    position: 'absolute',
    top: 'calc(100% + 4px)',
    right: 0,
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
    minWidth: '220px',
    overflow: 'hidden',
    zIndex: 100,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    border: 'none',
    color: theme.colors.text,
    fontSize: theme.typography.sizes.sm,
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: `background-color ${theme.transitions.fast}`,
  },
  menuItemDanger: {
    color: theme.colors.error,
  },
  separator: {
    height: '1px',
    backgroundColor: theme.colors.border,
  },
};

function KeyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
    </svg>
  );
}

export default function OwnerActionsMenu({ onManagePermissions, onDelete }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={wrapperRef} style={{ position: 'relative' }}>
      <button
        type="button"
        style={styles.trigger}
        onClick={() => setOpen((v) => !v)}
        title="Weitere Aktionen"
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <span style={styles.dotIcon}>···</span>
      </button>
      {open && (
        <div style={styles.menu}>
          <button
            type="button"
            style={styles.menuItem}
            onClick={() => { setOpen(false); onManagePermissions && onManagePermissions(); }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <KeyIcon /> Berechtigungen verwalten
          </button>
          <div style={styles.separator} />
          <button
            type="button"
            style={{ ...styles.menuItem, ...styles.menuItemDanger }}
            onClick={() => { setOpen(false); onDelete && onDelete(); }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.errorLight; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <TrashIcon size={14} /> Loeschen
          </button>
        </div>
      )}
    </div>
  );
}
