import { theme } from '../../../config/theme';
import DocumentViewer from './DocumentViewer';

const styles = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
    padding: theme.spacing.xl,
  },
  content: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    width: '90vw',
    maxWidth: '1100px',
    height: '85vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  headerLeft: { flex: 1, minWidth: 0 },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    marginTop: theme.spacing.xs,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    display: 'flex',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  refValue: {
    color: theme.colors.text,
    fontFamily: 'monospace',
    fontWeight: theme.typography.weights.medium,
  },
  refMissing: { fontStyle: 'italic' },
  closeBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  body: { flex: 1, minHeight: 0, padding: theme.spacing.lg },
};

function formatDocuwareDate(value) {
  if (typeof value !== 'string') return '';
  const m = value.match(/\/Date\((\d+)(?:[+-]\d{4})?\)\//);
  if (m) {
    const d = new Date(parseInt(m[1], 10));
    if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  const iso = Date.parse(value);
  if (!isNaN(iso)) return new Date(iso).toISOString().slice(0, 10);
  return value;
}

/**
 * Standalone-Viewer fuer ein einzelnes Dokument. Kein Vorgangs-Kontext,
 * keine Compliance — wird vor allem fuer Docs ohne REFERENCE verwendet, die
 * keine sinnvolle Vorgangs-Detail-Seite haben.
 */
export default function DocumentPreviewModal({ open, cabinetId, doc, config, onClose }) {
  if (!open || !doc) return null;

  const documentTypeField = config?.document_type_field || 'DOCUMENT_TYPE';
  const referenceField = config?.reference_field || 'REFERENCE';
  const docStatusField = config?.doc_status_field || 'STATUS';

  const docType = doc.fields?.[documentTypeField];
  const date = doc.fields?.DATUM || doc.fields?.DWSTOREDATETIME;
  const status = doc.fields?.[docStatusField];
  const refRaw = doc.fields?.[referenceField];
  const ref = typeof refRaw === 'string' && refRaw.trim() ? refRaw.trim() : '';

  return (
    <div
      style={styles.overlay}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
    >
      <div style={styles.content}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.title} title={doc.title}>{doc.title || `Dokument ${doc.id}`}</div>
            <div style={styles.meta}>
              {docType && <span>{docType}</span>}
              {date && <span>{formatDocuwareDate(date)}</span>}
              {status && <span>{status}</span>}
              <span>
                Referenz:{' '}
                {ref
                  ? <span style={styles.refValue}>{ref}</span>
                  : <span style={styles.refMissing}>keine</span>}
              </span>
              <span style={{ fontFamily: 'monospace', color: theme.colors.textMuted }}>#{doc.id}</span>
            </div>
          </div>
          <button type="button" style={styles.closeBtn} onClick={onClose}>Schliessen</button>
        </div>
        <div style={styles.body}>
          <DocumentViewer cabinetId={cabinetId} document={doc} />
        </div>
      </div>
    </div>
  );
}
