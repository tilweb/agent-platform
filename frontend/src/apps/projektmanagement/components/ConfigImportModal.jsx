/**
 * ConfigImportModal — Vorschau vor dem Anwenden eines Auswahllisten-Imports.
 *
 * Zeigt pro Liste das Diff (neu / geändert / entfernt) mit Checkbox. Angehakte
 * Listen werden komplett ersetzt (gesperrte Listen: nur Anzeigenamen), nicht
 * angehakte bleiben unverändert.
 */

import { useState, useMemo } from 'react';
import { theme } from '../../../config/theme';

// Anzeigenamen der Listen (spiegelt FIELD_LABELS in Einstellungen.jsx +
// abschluss_checkliste). Bei Listen-Änderungen mitpflegen.
const LIST_LABELS = {
  project_type: 'Projekttyp',
  project_size: 'Projektgröße',
  priority: 'Priorität',
  project_driver: 'Projekttreiber',
  project_status: 'Projektstatus',
  order_status: 'Projektauftragsstatus',
  idee_status: 'Projektidee-Status',
  role: 'Rolle',
  member_status: 'Status (intern/extern)',
  gruppe: 'Gruppe',
  interest: 'Interesse',
  influence: 'Einfluss',
  probability: 'Wahrscheinlichkeit',
  impact: 'Auswirkung',
  roadmap_status: 'Roadmap-Status',
  risk_strategie: 'Risiko-Strategie',
  risk_status: 'Risiko-Status',
  lesson_themengebiet: 'Themengebiet',
  lesson_kategorie: 'Kategorie',
  abschluss_checkliste: 'Abschluss-Checkliste',
};

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    maxWidth: '640px', width: '90%', maxHeight: '90vh',
    overflow: 'auto',
    padding: theme.spacing.xl,
    display: 'flex', flexDirection: 'column', gap: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  warnings: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    display: 'flex', flexDirection: 'column', gap: theme.spacing.xs,
  },
  list: {
    display: 'flex', flexDirection: 'column', gap: theme.spacing.xs,
  },
  row: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.md,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
  },
  rowMuted: { opacity: 0.55 },
  rowLabel: { flex: 1, fontSize: theme.typography.sizes.sm, color: theme.colors.text },
  rowKey: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  diffSummary: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textSecondary,
    display: 'flex', gap: theme.spacing.sm,
  },
  added: { color: theme.colors.success },
  changed: { color: theme.colors.warning },
  removed: { color: theme.colors.error },
  footer: {
    display: 'flex', justifyContent: 'flex-end', gap: theme.spacing.md,
    marginTop: theme.spacing.sm,
  },
  cancelBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: 'transparent', color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm, cursor: 'pointer',
  },
  applyBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary, color: '#fff', border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium, cursor: 'pointer',
  },
  errorText: { color: theme.colors.error, fontSize: theme.typography.sizes.sm },
};

function hasChanges(d) {
  return !!d && (d.added.length > 0 || d.changed.length > 0 || d.removed.length > 0);
}

export default function ConfigImportModal({ preview, onApply, onClose }) {
  const { lists = {}, diff = {}, warnings = [] } = preview || {};

  // Alle Listen aus der Datei (in stabiler Reihenfolge über LIST_LABELS).
  const listKeys = useMemo(
    () => Object.keys(LIST_LABELS).filter((k) => lists[k] !== undefined),
    [lists]
  );

  // Vorbelegung: Listen mit Änderungen sind angehakt.
  const [selected, setSelected] = useState(() => {
    const init = {};
    for (const k of listKeys) init[k] = hasChanges(diff[k]);
    return init;
  });
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState(null);

  const selectedCount = Object.values(selected).filter(Boolean).length;

  const toggle = (k) => setSelected((prev) => ({ ...prev, [k]: !prev[k] }));

  const handleApply = async () => {
    const keys = listKeys.filter((k) => selected[k]);
    if (keys.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      await onApply(keys);
    } catch (err) {
      setError(err.message || 'Import fehlgeschlagen');
      setApplying(false);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.content} onClick={(e) => e.stopPropagation()}>
        <div>
          <div style={styles.title}>Konfiguration importieren</div>
          <div style={styles.subtitle}>
            Wähle die Listen, die aus der Datei übernommen werden sollen. Angehakte Listen
            werden vollständig ersetzt; nicht angehakte bleiben unverändert.
          </div>
        </div>

        {warnings.length > 0 && (
          <div style={styles.warnings}>
            {warnings.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
        )}

        <div style={styles.list}>
          {listKeys.length === 0 && (
            <div style={styles.subtitle}>Keine bekannten Auswahllisten in der Datei gefunden.</div>
          )}
          {listKeys.map((k) => {
            const d = diff[k];
            const changed = hasChanges(d);
            return (
              <label
                key={k}
                style={{ ...styles.row, ...(changed ? {} : styles.rowMuted), cursor: 'pointer' }}
              >
                <input
                  type="checkbox"
                  checked={!!selected[k]}
                  onChange={() => toggle(k)}
                />
                <span style={styles.rowLabel}>
                  {LIST_LABELS[k] || k} <span style={styles.rowKey}>({k})</span>
                </span>
                {changed ? (
                  <span style={styles.diffSummary}>
                    {d.added.length > 0 && <span style={styles.added}>+{d.added.length} neu</span>}
                    {d.changed.length > 0 && <span style={styles.changed}>~{d.changed.length} geändert</span>}
                    {d.removed.length > 0 && <span style={styles.removed}>−{d.removed.length} entfernt</span>}
                  </span>
                ) : (
                  <span style={styles.rowKey}>keine Änderungen</span>
                )}
              </label>
            );
          })}
        </div>

        {error && <div style={styles.errorText}>{error}</div>}

        <div style={styles.footer}>
          <button style={styles.cancelBtn} onClick={onClose} disabled={applying}>
            Abbrechen
          </button>
          <button
            style={{ ...styles.applyBtn, opacity: selectedCount === 0 || applying ? 0.5 : 1 }}
            onClick={handleApply}
            disabled={selectedCount === 0 || applying}
          >
            {applying ? 'Übernehme…' : `Übernehmen (${selectedCount} ${selectedCount === 1 ? 'Liste' : 'Listen'})`}
          </button>
        </div>
      </div>
    </div>
  );
}
