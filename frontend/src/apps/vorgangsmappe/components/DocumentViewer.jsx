import { useEffect, useMemo, useState } from 'react';
import { theme } from '../../../config/theme';
import { apiFetch } from '../../../utils/apiFetch';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  toolbar: {
    display: 'flex',
    gap: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    fontSize: theme.typography.sizes.xs,
  },
  tabsGroup: { display: 'flex', gap: theme.spacing.xs },
  tab: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    border: 'none',
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: theme.colors.textMuted,
  },
  tabActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  spacer: { flex: 1 },
  pager: { display: 'flex', gap: theme.spacing.xs, alignItems: 'center' },
  pageBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    cursor: 'pointer',
    fontSize: theme.typography.sizes.xs,
  },
  pageBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  pageLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    minWidth: 60,
    textAlign: 'center',
  },
  body: {
    flex: 1,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.background,
    overflow: 'auto',
    position: 'relative',
  },
  iframe: { width: '100%', height: '100%', border: 'none' },
  pageImg: { maxWidth: '100%', maxHeight: '100%', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' },
  empty: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.sizes.sm,
    padding: theme.spacing.xl,
    textAlign: 'center',
  },
  error: {
    color: theme.colors.error,
    backgroundColor: theme.colors.errorLight,
    padding: theme.spacing.lg,
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    maxWidth: '480px',
  },
};

async function fetchAsObjectUrl(endpoint, accept) {
  const res = await apiFetch(endpoint, {
    method: 'GET',
    headers: { Accept: accept },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} — ${text.slice(0, 200) || 'Doku konnte nicht geladen werden.'}`);
  }
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export default function DocumentViewer({ cabinetId, document: doc }) {
  const [mode, setMode] = useState('pdf');
  const [page, setPage] = useState(1);
  const [fileUrl, setFileUrl] = useState(null);
  const [pageUrl, setPageUrl] = useState(null);
  const [error, setError] = useState(null);

  // DocuWare liefert die Seitenzahl im DWPAGECOUNT-Index-Feld. Fallback 1.
  const totalPages = useMemo(() => {
    const raw = doc?.fields?.DWPAGECOUNT;
    const n = typeof raw === 'number' ? raw : parseInt(String(raw ?? ''), 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }, [doc?.fields?.DWPAGECOUNT]);

  useEffect(() => {
    setPage(1);
    setMode('pdf');
    setError(null);
  }, [doc?.id]);

  // Endpoint-Pfade (an apiFetch uebergeben — fetch macht daraus eine
  // absolute URL gegen den API-Server, mit credentials:'include').
  const endpoints = useMemo(() => {
    if (!cabinetId || !doc?.id) return null;
    const base = `/connections/docuware/cabinets/${encodeURIComponent(cabinetId)}/documents/${encodeURIComponent(String(doc.id))}`;
    return {
      file: `${base}/file`,
      page: (n) => `${base}/pages/${n}`,
    };
  }, [cabinetId, doc?.id]);

  // PDF-Blob laden bei Doc-Wechsel (nur wenn aktueller Modus PDF ist —
  // sonst nicht zwingend, aber wir laden eager fuer Toggle-Speed).
  useEffect(() => {
    if (!endpoints) {
      setFileUrl(null);
      return;
    }
    let cancelled = false;
    let urlToRevoke = null;
    setError(null);
    fetchAsObjectUrl(endpoints.file, 'application/pdf')
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        urlToRevoke = url;
        setFileUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      setFileUrl(null);
    };
  }, [endpoints?.file]);

  // Page-Image laden bei Page-Wechsel oder Mode-Wechsel zu pages
  useEffect(() => {
    if (mode !== 'pages' || !endpoints) {
      setPageUrl(null);
      return;
    }
    let cancelled = false;
    let urlToRevoke = null;
    setError(null);
    fetchAsObjectUrl(endpoints.page(page), 'image/*')
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        urlToRevoke = url;
        setPageUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
      setPageUrl(null);
    };
  }, [mode, page, endpoints?.file]);

  if (!doc) {
    return (
      <div style={styles.container}>
        <div style={styles.empty}>Kein Dokument ausgewählt.</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.toolbar}>
        <div style={styles.tabsGroup}>
          <button
            style={{ ...styles.tab, ...(mode === 'pdf' ? styles.tabActive : {}) }}
            onClick={() => setMode('pdf')}
          >
            PDF
          </button>
          <button
            style={{ ...styles.tab, ...(mode === 'pages' ? styles.tabActive : {}) }}
            onClick={() => setMode('pages')}
          >
            Seitenweise
          </button>
        </div>
        <div style={styles.spacer} />
        {mode === 'pages' && (
          <div style={styles.pager}>
            <button
              style={{ ...styles.pageBtn, ...(page <= 1 ? styles.pageBtnDisabled : {}) }}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
            >
              ◀
            </button>
            <span style={styles.pageLabel}>
              Seite {page} / {totalPages}
            </span>
            <button
              style={{ ...styles.pageBtn, ...(page >= totalPages ? styles.pageBtnDisabled : {}) }}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
            >
              ▶
            </button>
          </div>
        )}
      </div>
      <div style={styles.body}>
        {error && <div style={styles.error}>{error}</div>}
        {!error && mode === 'pdf' && fileUrl && (
          <iframe key={fileUrl} title="Dokument" src={fileUrl} style={styles.iframe} />
        )}
        {!error && mode === 'pdf' && !fileUrl && (
          <div style={styles.empty}>Lade PDF …</div>
        )}
        {!error && mode === 'pages' && pageUrl && (
          <img key={pageUrl} src={pageUrl} alt={`Seite ${page}`} style={styles.pageImg} />
        )}
        {!error && mode === 'pages' && !pageUrl && (
          <div style={styles.empty}>Lade Seite …</div>
        )}
      </div>
    </div>
  );
}
