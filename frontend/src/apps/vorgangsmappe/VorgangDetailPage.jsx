import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { theme } from '../../config/theme';
import { ArrowLeftIcon } from '../../components/Icons';
import { useVorgang, useVorgangsmappeConfig } from './hooks/useVorgangsmappe';
import DocumentList from './components/DocumentList';
import DocumentViewer from './components/DocumentViewer';
import ComplianceChecklist from './components/ComplianceChecklist';
import MultiSelectDropdown from './components/MultiSelectDropdown';

const styles = {
  container: {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.primary,
    cursor: 'pointer',
    marginBottom: theme.spacing.lg,
    border: 'none',
    background: 'none',
    padding: 0,
    fontWeight: theme.typography.weights.medium,
  },
  title: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'grid',
    gridTemplateColumns: '320px 360px 1fr',
    gap: theme.spacing.lg,
    padding: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
  },
  panel: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.lg,
    border: `1px solid ${theme.colors.border}`,
    padding: theme.spacing.lg,
    overflow: 'auto',
    minHeight: 0,
  },
  panelHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  panelTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.md,
  },
  statusSelect: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    cursor: 'pointer',
    maxWidth: 180,
  },
  statusPill: {
    fontSize: theme.typography.sizes.xs,
    padding: `2px ${theme.spacing.sm}`,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
    fontWeight: theme.typography.weights.medium,
  },
  complianceStub: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    lineHeight: 1.5,
  },
  error: {
    padding: theme.spacing.xl,
    color: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
    borderRadius: theme.borderRadius.lg,
    margin: theme.spacing['2xl'],
    fontSize: theme.typography.sizes.sm,
  },
  empty: {
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
};

export default function VorgangDetailPage() {
  const { reference } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, error, loading } = useVorgang(reference);
  const { config } = useVorgangsmappeConfig();
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [statusFilter, setStatusFilter] = useState([]); // Multi-Select: array of selected status strings

  const documentTypeField = config?.document_type_field || 'DOCUMENT_TYPE';
  const docStatusField = config?.doc_status_field || 'STATUS';

  // Wenn URL `?doc=<id>` gesetzt ist und das Doc in der Liste vorkommt,
  // selektieren wir es initial. Danach den Param strippen, damit ein
  // spaeterer Doc-Wechsel die URL nicht mit-irritiert.
  useEffect(() => {
    if (!data?.documents?.length) {
      setSelectedDocId(null);
      return;
    }
    const requestedId = searchParams.get('doc');
    if (requestedId) {
      const match = data.documents.find((d) => String(d.id) === requestedId);
      if (match) {
        setSelectedDocId(match.id);
        // Param entfernen — bleibt bookmarkable beim direkten Aufruf, aber
        // wir wollen nicht, dass spaetere Selects damit kollidieren.
        setSearchParams({}, { replace: true });
        return;
      }
    }
    setSelectedDocId((current) => current || data.documents[0].id);
  }, [data, searchParams, setSearchParams]);

  // Distinkte Status-Werte aus den Dokumenten ableiten (fuer Filter-Multi-Select)
  const availableStatuses = useMemo(() => {
    const set = new Set();
    for (const doc of data?.documents || []) {
      const s = doc.fields?.[docStatusField];
      if (typeof s === 'string' && s.trim()) set.add(s.trim());
    }
    return Array.from(set).sort();
  }, [data, docStatusField]);

  const visibleDocuments = useMemo(() => {
    if (!data?.documents) return [];
    if (!statusFilter || statusFilter.length === 0) return data.documents;
    const filterSet = new Set(statusFilter);
    return data.documents.filter((d) => filterSet.has((d.fields?.[docStatusField] || '').trim()));
  }, [data, statusFilter, docStatusField]);

  // Wenn der aktuell selektierte Doc durch den Filter rausfaellt, ersten
  // sichtbaren auswaehlen.
  useEffect(() => {
    if (selectedDocId && visibleDocuments.length > 0 && !visibleDocuments.find((d) => d.id === selectedDocId)) {
      setSelectedDocId(visibleDocuments[0].id);
    }
  }, [visibleDocuments, selectedDocId]);

  const selectedDoc = data?.documents?.find((d) => d.id === selectedDocId) || null;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button style={styles.backLink} onClick={() => navigate('/apps/vorgangsmappe')}>
          <ArrowLeftIcon /> Vorgangsmappe
        </button>
        <h1 style={styles.title}>Vorgang {reference}</h1>
        <div style={styles.subtitle}>
          {loading && <span>Lade …</span>}
          {!loading && data && (
            <>
              <span>{data.documentCount} Dokument{data.documentCount === 1 ? '' : 'e'}</span>
              {data.dateRange && (
                <>
                  <span>·</span>
                  <span>{data.dateRange.from} bis {data.dateRange.to}</span>
                </>
              )}
              {data.status && (
                <>
                  <span>·</span>
                  <span
                    style={styles.statusPill}
                    title={data.status_source ? `Status aus ${data.status_source.documentTypeLabel}` : undefined}
                  >
                    {data.status}
                  </span>
                </>
              )}
              <span>·</span>
              <span>Cabinet: {data.cabinetName || data.cabinetId}</span>
            </>
          )}
        </div>
      </div>

      {error && <div style={styles.error}>{error}</div>}

      {!error && (
        <div style={styles.body}>
          <div style={styles.panel}>
            <div style={styles.panelTitle}>Pflicht-Dokumente</div>
            {loading && <div style={styles.empty}>Lade …</div>}
            {!loading && data && (
              <ComplianceChecklist
                compliance={data.compliance}
                onItemClick={(item) => {
                  if (item.matchedDocIds.length > 0) {
                    setSelectedDocId(item.matchedDocIds[0]);
                  }
                }}
              />
            )}
          </div>

          <div style={styles.panel}>
            <div style={styles.panelHeader}>
              <div style={styles.panelTitle}>Dokumente</div>
              {availableStatuses.length > 0 && (
                <MultiSelectDropdown
                  label="Alle Status"
                  options={availableStatuses}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              )}
            </div>
            {loading && <div style={styles.empty}>Lade …</div>}
            {!loading && data && (
              <>
                <DocumentList
                  documents={visibleDocuments}
                  selectedId={selectedDocId}
                  onSelect={(doc) => setSelectedDocId(doc.id)}
                  documentTypeField={documentTypeField}
                  statusField={docStatusField}
                />
                {statusFilter.length > 0 && visibleDocuments.length === 0 && (
                  <div style={styles.empty}>
                    Keine Dokumente mit dem ausgewaehlten Status.
                  </div>
                )}
              </>
            )}
          </div>

          <div style={{ ...styles.panel, padding: 0, display: 'flex', flexDirection: 'column' }}>
            <DocumentViewer
              cabinetId={data?.cabinetId}
              document={selectedDoc}
            />
          </div>
        </div>
      )}
    </div>
  );
}
