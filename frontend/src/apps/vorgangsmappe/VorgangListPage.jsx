import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { theme } from '../../config/theme';
import { BriefcaseIcon } from '../../components/Icons';
import { useVorgangsmappeConfig, searchDocuments, previewNlu } from './hooks/useVorgangsmappe';
import ReferenceInput from './components/ReferenceInput';
import NluSearchBar from './components/NluSearchBar';
import VorgangCard from './components/VorgangCard';
import DocumentList from './components/DocumentList';
import DocumentPreviewModal from './components/DocumentPreviewModal';

const styles = {
  container: {
    height: '100%',
    overflow: 'auto',
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: `${theme.spacing.xl} ${theme.spacing['2xl']}`,
    borderBottom: `1px solid ${theme.colors.border}`,
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLeft: { flex: 1 },
  headerTitle: {
    fontSize: theme.typography.sizes['2xl'],
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.text,
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  settingsBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  headerSubtitle: {
    fontSize: theme.typography.sizes.base,
    color: theme.colors.textSecondary,
    marginTop: theme.spacing.sm,
  },
  body: {
    padding: theme.spacing['2xl'],
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing['2xl'],
    maxWidth: '1100px',
  },
  searchRow: {
    display: 'flex',
    gap: theme.spacing['2xl'],
    flexWrap: 'wrap',
  },
  warningCard: {
    backgroundColor: theme.colors.warningLight,
    color: theme.colors.warning,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
  },
  errorCard: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    fontSize: theme.typography.sizes.sm,
  },
  resultsHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
    paddingBottom: theme.spacing.md,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  resultsTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  resultsCount: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
  },
  tabsGroup: {
    display: 'flex',
    gap: theme.spacing.xs,
  },
  tab: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
  },
  tabActive: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  resultsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  empty: {
    padding: theme.spacing.xl,
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    textAlign: 'center',
  },
};

// Modul-level Cache: ueberlebt das Unmount der Page (z.B. beim Drilldown ins
// Vorgang-Detail) und wird beim Re-Mount wieder als Initial-State eingelesen.
// Geht beim Hard-Reload (F5) bewusst verloren.
let cachedSearchState = null;

export default function VorgangListPage() {
  const navigate = useNavigate();
  const { config, error: cfgError, loading: cfgLoading } = useVorgangsmappeConfig();

  const [nluQuery, setNluQuery] = useState(() => cachedSearchState?.nluQuery || '');
  const [nluFilters, setNluFilters] = useState(() => cachedSearchState?.nluFilters || null);
  const [nluInterpretation, setNluInterpretation] = useState(() => cachedSearchState?.nluInterpretation || null);
  const [previewing, setPreviewing] = useState(false);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState(null);
  const [results, setResults] = useState(() => cachedSearchState?.results || null);
  const [resultTab, setResultTab] = useState(() => cachedSearchState?.resultTab || 'vorgaenge');
  const [previewDoc, setPreviewDoc] = useState(null);

  // Cache synchronisieren bei jeder relevanten Aenderung.
  useEffect(() => {
    cachedSearchState = { nluQuery, nluFilters, nluInterpretation, results, resultTab };
  }, [nluQuery, nluFilters, nluInterpretation, results, resultTab]);

  const handlePreview = async () => {
    if (!nluQuery.trim()) return;
    setPreviewing(true);
    setSearchError(null);
    try {
      const interp = await previewNlu(nluQuery);
      setNluFilters(interp.filters || []);
      setNluInterpretation(interp.interpretation || '');
    } catch (err) {
      setSearchError(err?.message || 'NLU-Preview fehlgeschlagen.');
      setNluFilters([]);
    } finally {
      setPreviewing(false);
    }
  };

  const handleSearch = async () => {
    if (!nluQuery.trim()) return;
    setSearching(true);
    setSearchError(null);
    try {
      const res = await searchDocuments({ query: nluQuery });
      setResults(res);
      setNluFilters(res.filters || []);
      setNluInterpretation(res.interpretation || '');
      setResultTab(res.vorgaenge?.length ? 'vorgaenge' : 'documents');
    } catch (err) {
      setSearchError(err?.message || 'Suche fehlgeschlagen.');
      setResults(null);
    } finally {
      setSearching(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.headerTitle}>
            <BriefcaseIcon size={28} color={theme.colors.primary} />
            Vorgangsmappe
          </h1>
          <p style={styles.headerSubtitle}>
            Doku-Übersicht aller Vorgänge — direkt aus DocuWare.
          </p>
        </div>
        <button style={styles.settingsBtn} onClick={() => navigate('/apps/vorgangsmappe/settings')}>
          Einstellungen
        </button>
      </div>

      <div style={styles.body}>
        {cfgLoading && <p style={{ color: theme.colors.textMuted }}>Lade Konfiguration …</p>}

        {!cfgLoading && cfgError && (
          <div style={styles.warningCard}>
            <strong>Konfiguration noch nicht bereit:</strong> {cfgError}
          </div>
        )}

        {!cfgLoading && !cfgError && config && (
          <>
            <div style={styles.searchRow}>
              <ReferenceInput onSubmit={(ref) => navigate(`/apps/vorgangsmappe/${encodeURIComponent(ref)}`)} />
              <NluSearchBar
                value={nluQuery}
                onChange={(v) => {
                  setNluQuery(v);
                  // Filter zuruecksetzen wenn User Query aendert
                  if (nluFilters) {
                    setNluFilters(null);
                    setNluInterpretation(null);
                  }
                }}
                onPreview={handlePreview}
                onSubmit={handleSearch}
                filters={nluFilters}
                interpretation={nluInterpretation}
                loading={searching}
                previewing={previewing}
              />
            </div>

            {searchError && <div style={styles.errorCard}>{searchError}</div>}

            {results && (
              <div>
                <div style={styles.resultsHeader}>
                  <div style={styles.resultsTitle}>Treffer</div>
                  <span style={styles.resultsCount}>
                    {results.vorgaenge?.length || 0} {(results.vorgaenge?.length || 0) === 1 ? 'Vorgang' : 'Vorgänge'} ·{' '}
                    {results.documents?.length || 0} {(results.documents?.length || 0) === 1 ? 'Dokument' : 'Dokumente'}
                  </span>
                  <div style={{ flex: 1 }} />
                  <div style={styles.tabsGroup}>
                    <button
                      style={{ ...styles.tab, ...(resultTab === 'vorgaenge' ? styles.tabActive : {}) }}
                      onClick={() => setResultTab('vorgaenge')}
                    >
                      Vorgänge
                    </button>
                    <button
                      style={{ ...styles.tab, ...(resultTab === 'documents' ? styles.tabActive : {}) }}
                      onClick={() => setResultTab('documents')}
                    >
                      Einzel-Dokumente
                    </button>
                  </div>
                </div>

                <div style={{ ...styles.resultsList, marginTop: theme.spacing.lg }}>
                  {resultTab === 'vorgaenge' && (
                    (results.vorgaenge || []).length === 0 ? (
                      <div style={styles.empty}>Keine Vorgänge gefunden.</div>
                    ) : (
                      results.vorgaenge.map((v) => (
                        <VorgangCard
                          key={v.reference}
                          vorgang={v}
                          onClick={(x) => navigate(`/apps/vorgangsmappe/${encodeURIComponent(x.reference)}`)}
                        />
                      ))
                    )
                  )}
                  {resultTab === 'documents' && (
                    (results.documents || []).length === 0 ? (
                      <div style={styles.empty}>Keine Dokumente gefunden.</div>
                    ) : (
                      <DocumentList
                        documents={results.documents}
                        documentTypeField={config.document_type_field}
                        referenceField={config.reference_field}
                        statusField={config.doc_status_field || 'STATUS'}
                        showReference
                        onSelect={(doc) => {
                          const refRaw = doc.fields?.[config.reference_field];
                          const ref = typeof refRaw === 'string' && refRaw.trim() ? refRaw.trim() : '';
                          if (ref) {
                            navigate(`/apps/vorgangsmappe/${encodeURIComponent(ref)}?doc=${encodeURIComponent(doc.id)}`);
                          } else {
                            setPreviewDoc(doc);
                          }
                        }}
                      />
                    )
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <DocumentPreviewModal
        open={!!previewDoc}
        cabinetId={config?.cabinet?.id}
        doc={previewDoc}
        config={config}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
