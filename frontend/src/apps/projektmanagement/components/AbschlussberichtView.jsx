/**
 * AbschlussberichtView — Phase F
 *
 * 1:1 zum Projekt. Empty-State (kein Bericht) zeigt einen Erstellen-Button mit
 * Pre-Fill aus letztem SB + Auftrag. Bestehender Bericht: Single-Form mit
 * Akkordeon-Sektionen. Final/Draft-Status; Owner kann reopen.
 *
 * Daten-Felder siehe types.ts:AbschlussberichtData. Pflege-Komponenten sind
 * bewusst leichtgewichtig (kein SB-Komponenten-Reuse, weil die SB-Komponenten
 * vom konkreten Statusbericht-Schema ausgehen — der Abschlussbericht hat
 * partiell andere Felder).
 */

import { useEffect, useState, useCallback } from 'react';
import { theme } from '../../../config/theme';
import { useProjektmanagement, VersionConflictError } from '../../../hooks/useProjektmanagement';
import { SparklesIcon, TrashIcon } from '../../../components/Icons';
import { API_URL } from '../../../utils/apiFetch';

const AMPEL_COLOR = {
  gruen: { fg: theme.colors.success, bg: theme.colors.successLight, label: 'Grün' },
  gelb: { fg: theme.colors.warning, bg: theme.colors.warningLight, label: 'Gelb' },
  rot: { fg: theme.colors.error, bg: theme.colors.errorLight, label: 'Rot' },
};

// Risk-Type ist im Wizard hardcoded (kein Config-Eintrag). Mapping deckt
// sowohl die englischen Wizard-Werte als auch Legacy-deutsche Daten ab.
const RISK_TYPE_LABEL = {
  threat: 'Bedrohung',
  chance: 'Chance',
  bedrohung: 'Bedrohung',
  technical: 'Technisch',
  technisch: 'Technisch',
  organizational: 'Organisatorisch',
  organisatorisch: 'Organisatorisch',
  financial: 'Finanziell',
  finanziell: 'Finanziell',
  schedule: 'Terminlich',
  terminlich: 'Terminlich',
  resource: 'Ressourcen',
  ressourcen: 'Ressourcen',
  external: 'Extern',
  extern: 'Extern',
};

function riskTypeLabel(value) {
  if (!value) return '–';
  return RISK_TYPE_LABEL[value] || value;
}

// Allgemeiner Helper fuer Config-basierte Selectboxes (probability/impact/
// risk_status/risk_strategie/…). Faellt auf den Rohwert zurueck wenn die
// Option nicht in der Config liegt — so brechen Legacy-Daten nicht.
function configLabel(appConfig, key, value) {
  if (!value) return '–';
  const opt = (appConfig?.[key] || []).find((o) => o.value === value);
  return opt?.label || value;
}

const styles = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: theme.spacing['2xl'],
  },
  emptyHero: {
    maxWidth: 640,
    margin: '0 auto',
    textAlign: 'center',
    padding: theme.spacing['2xl'],
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
  },
  emptyTitle: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.xl,
    lineHeight: 1.6,
  },
  primaryBtn: {
    padding: `${theme.spacing.md} ${theme.spacing.xl}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  statusBadge: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    borderRadius: theme.borderRadius.full,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
  },
  statusFinal: {
    backgroundColor: theme.colors.successLight,
    color: theme.colors.success,
  },
  statusDraft: {
    backgroundColor: theme.colors.surfaceHover,
    color: theme.colors.textMuted,
  },
  headerActions: {
    display: 'flex',
    gap: theme.spacing.md,
    flexWrap: 'wrap',
  },
  btn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    color: theme.colors.text,
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  btnPrimary: {
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
  },
  btnDanger: {
    color: theme.colors.error,
    borderColor: `${theme.colors.error}30`,
  },
  exportWrap: { position: 'relative' },
  dashboard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  dashCard: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
  },
  dashLabel: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: theme.spacing.xs,
  },
  dashValue: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
  },
  section: {
    backgroundColor: theme.colors.surface,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.xl,
    marginBottom: theme.spacing.lg,
  },
  sectionHeader: {
    padding: `${theme.spacing.lg} ${theme.spacing.xl}`,
    fontSize: theme.typography.sizes.base,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    cursor: 'pointer',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    userSelect: 'none',
  },
  sectionBody: {
    padding: `${theme.spacing.lg} ${theme.spacing.xl} ${theme.spacing.xl}`,
    borderTop: `1px solid ${theme.colors.border}`,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.lg,
  },
  fieldLabel: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  fieldHint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  input: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  textarea: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: 96,
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  select: {
    width: '100%',
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
    outline: 'none',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: theme.typography.sizes.sm,
  },
  th: {
    textAlign: 'left',
    padding: theme.spacing.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.textMuted,
    borderBottom: `1px solid ${theme.colors.border}`,
  },
  td: {
    padding: theme.spacing.sm,
    borderBottom: `1px solid ${theme.colors.border}`,
    verticalAlign: 'top',
  },
  ampelDot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    marginRight: theme.spacing.xs,
    verticalAlign: 'middle',
  },
  banner: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    marginBottom: theme.spacing.lg,
  },
  bannerInfo: {
    backgroundColor: theme.colors.primaryLight,
    color: theme.colors.primary,
  },
  bannerError: {
    backgroundColor: theme.colors.errorLight,
    color: theme.colors.error,
  },
  modalOverlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000,
  },
  modalCard: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.xl,
    padding: theme.spacing['2xl'],
    maxWidth: 480,
    width: '90%',
  },
  modalTitle: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  modalText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    marginBottom: theme.spacing.xl,
    lineHeight: 1.6,
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: theme.spacing.md,
  },
};

function fmtDate(iso) {
  if (!iso) return '–';
  try {
    return new Date(iso).toLocaleDateString('de-DE');
  } catch { return iso; }
}

function fmtCurrency(value) {
  if (value == null || isNaN(Number(value))) return '–';
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(Number(value));
}

function buildDashboard(data) {
  const out = [];
  if (data?.end_date_plan && (data.tasks_tracking || []).length) {
    const istEnd = (data.tasks_tracking || []).map((t) => t.ist_datum).filter(Boolean).sort().pop();
    if (istEnd) {
      const planMs = new Date(data.end_date_plan).getTime();
      const istMs = new Date(istEnd).getTime();
      if (!isNaN(planMs) && !isNaN(istMs)) {
        const diff = Math.round((istMs - planMs) / 86400000);
        out.push({ label: 'Termin-Abweichung', value: `${diff >= 0 ? '+' : ''}${diff} Tage` });
      }
    }
  }
  if (data?.cost_budget && (data.cost_months || []).length) {
    const ist = (data.cost_months || []).reduce((s, m) => s + (Number(m.ist) || 0), 0);
    const pct = ((ist - data.cost_budget) / data.cost_budget) * 100;
    out.push({ label: 'Budget-Abweichung', value: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` });
  }
  if ((data?.criteria_tracking || []).length) {
    const arr = data.criteria_tracking.map((c) => Number(c.fortschritt) || 0);
    const avg = arr.reduce((s, n) => s + n, 0) / arr.length;
    out.push({ label: 'Ziel-Erfüllung (Ø)', value: `${avg.toFixed(0)}%` });
  }
  if ((data?.risk_tracking || []).length) {
    let e = 0, v = 0, a = 0;
    for (const r of data.risk_tracking) {
      const s = (r.status || '').toLowerCase();
      if (s === 'eingetreten') e++;
      else if (s === 'vermieden') v++;
      else if (s === 'aktiv' || s === 'bewertet' || s === 'identifiziert') a++;
    }
    out.push({ label: 'Risiko-Bilanz', value: `${e} ein / ${v} verm / ${a} aktiv` });
  }
  if ((data?.stakeholder_akzeptanz || []).length) {
    let gr = 0, ge = 0, ro = 0;
    for (const s of data.stakeholder_akzeptanz) {
      if (s.bewertung === 'gruen') gr++;
      else if (s.bewertung === 'gelb') ge++;
      else if (s.bewertung === 'rot') ro++;
    }
    out.push({ label: 'Stakeholder-Akzeptanz', value: `${gr} / ${ge} / ${ro}` });
  }
  return out;
}

function Section({ title, defaultOpen, children }) {
  const [open, setOpen] = useState(defaultOpen ?? true);
  return (
    <div style={styles.section}>
      <div style={styles.sectionHeader} onClick={() => setOpen(!open)}>
        <span>{title}</span>
        <span style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
          {open ? '▾' : '▸'}
        </span>
      </div>
      {open && <div style={styles.sectionBody}>{children}</div>}
    </div>
  );
}

export default function AbschlussberichtView({ projektId, projektauftrag, statusberichte, canEdit, isOwner, appConfig, onProjektStatusUpdate }) {
  // Read-only-Tracking-Daten kommen live aus dem letzten Statusbericht — nicht
  // aus dem `data`-Snapshot. Sonst driftet die Tabelle, sobald jemand nach
  // Anlage des Abschlussberichts den SB editiert (z.B. Risiko-Status auf
  // 'eingetreten' aendert). Der Snapshot bleibt im `data` persistiert als
  // Fallback, falls SBs spaeter geloescht werden.
  const latestSb = (() => {
    if (!statusberichte || statusberichte.length === 0) return null;
    const finalSbs = statusberichte.filter((s) => s.status === 'final');
    const pool = finalSbs.length > 0 ? finalSbs : statusberichte;
    return [...pool].sort((a, b) => (b.nummer || 0) - (a.nummer || 0))[0] || null;
  })();
  const {
    getAbschlussbericht,
    createAbschlussbericht,
    updateAbschlussbericht,
    deleteAbschlussbericht,
    finalizeAbschlussbericht,
    reopenAbschlussbericht,
    suggestAbschlussDraft,
    getLessonsLearned,
  } = useProjektmanagement();

  const [bericht, setBericht] = useState(null);
  const [draft, setDraft] = useState(null);   // editable Kopie der `data`
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [error, setError] = useState(null);
  const [lifecycleModal, setLifecycleModal] = useState(false);
  // Selected project_status im Modal — Default = letzter Eintrag aus der Liste
  // (typischerweise "Gestoppt" oder "Abschluss"), aber User waehlt explizit.
  const [statusModalValue, setStatusModalValue] = useState('');
  const [lessons, setLessons] = useState([]);
  const [isDirty, setIsDirty] = useState(false);

  const reload = useCallback(async () => {
    if (!projektId) return;
    setIsLoading(true);
    try {
      const b = await getAbschlussbericht(projektId);
      setBericht(b);
      setDraft(b ? { ...b.data } : null);
      setIsDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [projektId, getAbschlussbericht]);

  useEffect(() => {
    reload();
  }, [reload]);

  // LL laden (live-Reference)
  useEffect(() => {
    if (!projektId) return;
    getLessonsLearned(projektId).then(setLessons).catch(() => {});
  }, [projektId, getLessonsLearned]);

  const isFinal = bericht?.status === 'final';
  const readOnly = !canEdit || isFinal;

  const handleCreate = async () => {
    setError(null);
    setIsSaving(true);
    try {
      const b = await createAbschlussbericht(projektId);
      setBericht(b);
      setDraft({ ...b.data });
      setIsDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const setField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    if (!draft || !bericht) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await updateAbschlussbericht(projektId, draft, { expectedVersion: bericht.version });
      setBericht(updated);
      setDraft({ ...updated.data });
      setIsDirty(false);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setError('Bericht wurde von jemand anderem geaendert. Bitte neu laden.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleFinalize = async () => {
    if (isDirty) {
      // Erst speichern, dann finalisieren — sonst gehen Edits verloren.
      await handleSave();
    }
    setIsSaving(true);
    setError(null);
    try {
      const updated = await finalizeAbschlussbericht(projektId, {
        expectedVersion: bericht?.version,
      });
      setBericht(updated);
      setDraft({ ...updated.data });
      setIsDirty(false);
      setLifecycleModal(true);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setError('Bericht wurde von jemand anderem geaendert. Bitte neu laden.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleReopen = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const updated = await reopenAbschlussbericht(projektId, {
        expectedVersion: bericht?.version,
      });
      setBericht(updated);
      setDraft({ ...updated.data });
      setIsDirty(false);
    } catch (err) {
      if (err instanceof VersionConflictError) {
        setError('Bericht wurde von jemand anderem geaendert. Bitte neu laden.');
      } else {
        setError(err.message);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Abschlussbericht wirklich loeschen?')) return;
    setIsSaving(true);
    try {
      await deleteAbschlussbericht(projektId);
      setBericht(null);
      setDraft(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSuggest = async () => {
    setIsSuggesting(true);
    setError(null);
    try {
      const sugg = await suggestAbschlussDraft(projektId);
      if (sugg) {
        setDraft((prev) => ({
          ...prev,
          management_summary: prev.management_summary || sugg.management_summary,
          key_findings: prev.key_findings || sugg.key_findings,
          folgeprojekt_empfehlung: prev.folgeprojekt_empfehlung || sugg.folgeprojekt_empfehlung,
        }));
        setIsDirty(true);
      } else {
        setError('Keine Vorschlaege moeglich — es gibt noch keine Statusberichte oder Lessons Learned.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSuggesting(false);
    }
  };

  const handleExport = async (format) => {
    setIsExporting(true);
    setExportMenuOpen(false);
    try {
      const response = await fetch(
        `${API_URL}/apps/projektmanagement/projektauftraege/${projektId}/abschlussbericht/export/${format}`,
        { credentials: 'include' },
      );
      if (!response.ok) throw new Error('Export fehlgeschlagen');
      const cd = response.headers.get('Content-Disposition') || '';
      const match = cd.match(/filename="(.+)"/);
      const filename = match ? match[1] : `Abschlussbericht.${format}`;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleLifecycleConfirm = async () => {
    if (!statusModalValue) {
      setLifecycleModal(false);
      return;
    }
    const chosen = statusModalValue;
    setLifecycleModal(false);
    setStatusModalValue('');
    if (onProjektStatusUpdate) {
      try {
        await onProjektStatusUpdate(chosen);
      } catch (err) {
        setError(`Projektstatus konnte nicht aktualisiert werden: ${err.message}`);
      }
    }
  };

  // ============== Render ==============

  if (isLoading) {
    return <div style={styles.container}><div>Lade…</div></div>;
  }

  if (!bericht) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyHero}>
          <div style={styles.emptyTitle}>Abschlussbericht erstellen</div>
          <div style={styles.emptyText}>
            Pro Projekt gibt es genau einen Abschlussbericht. Er wird mit Daten aus
            dem letzten Statusbericht und dem Projektauftrag vorbefüllt — du
            ergänzt Stakeholder-Akzeptanz, Übergabe und Abnahme. Optional steht
            ein KI-Entwurf für Management-Summary und Findings bereit.
          </div>
          {error && <div style={{ ...styles.banner, ...styles.bannerError, textAlign: 'left' }}>{error}</div>}
          {canEdit ? (
            <button type="button" style={styles.primaryBtn} onClick={handleCreate} disabled={isSaving}>
              {isSaving ? 'Erstelle…' : 'Abschlussbericht erstellen'}
            </button>
          ) : (
            <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
              Nur Editor+ kann den Bericht anlegen.
            </div>
          )}
        </div>
      </div>
    );
  }

  const dash = buildDashboard(draft || {});

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <span style={{ ...styles.statusBadge, ...(isFinal ? styles.statusFinal : styles.statusDraft) }}>
            {isFinal ? 'Final' : 'Entwurf'}
          </span>
          {bericht.finalizedAt && (
            <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              finalisiert am {fmtDate(bericht.finalizedAt)}
            </span>
          )}
        </div>
        <div style={styles.headerActions}>
          {!isFinal && canEdit && (
            <button type="button" style={styles.btn} onClick={handleSuggest} disabled={isSuggesting}>
              <SparklesIcon size={14} />
              {isSuggesting ? 'KI denkt…' : 'KI-Entwurf'}
            </button>
          )}
          {!isFinal && canEdit && (
            <button
              type="button"
              style={{ ...styles.btn, ...styles.btnPrimary }}
              onClick={handleSave}
              disabled={isSaving || !isDirty}
            >
              {isSaving ? 'Speichern…' : isDirty ? 'Speichern *' : 'Speichern'}
            </button>
          )}
          {!isFinal && canEdit && (
            <button type="button" style={styles.btn} onClick={handleFinalize} disabled={isSaving}>
              Als Final markieren
            </button>
          )}
          {isFinal && isOwner && (
            <button type="button" style={styles.btn} onClick={handleReopen} disabled={isSaving}>
              Wiedereröffnen
            </button>
          )}
          <div style={styles.exportWrap}>
            <button
              type="button"
              style={styles.btn}
              onClick={() => setExportMenuOpen((v) => !v)}
              disabled={isExporting}
            >
              Export ▾
            </button>
            {exportMenuOpen && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: 4,
                backgroundColor: theme.colors.surface,
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10,
                minWidth: 120,
              }}>
                {['pdf', 'docx', 'xlsx'].map((f) => (
                  <button
                    key={f}
                    type="button"
                    style={{
                      display: 'block', width: '100%', padding: theme.spacing.md,
                      border: 'none', background: 'transparent', textAlign: 'left',
                      color: theme.colors.text, cursor: 'pointer',
                      fontSize: theme.typography.sizes.sm,
                    }}
                    onClick={() => handleExport(f)}
                  >
                    {f.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
          {isOwner && (
            <button type="button" style={{ ...styles.btn, ...styles.btnDanger }} onClick={handleDelete}>
              <TrashIcon size={14} /> Loeschen
            </button>
          )}
        </div>
      </div>

      {error && <div style={{ ...styles.banner, ...styles.bannerError }}>{error}</div>}

      {dash.length > 0 && (
        <div style={styles.dashboard}>
          {dash.map((d) => (
            <div key={d.label} style={styles.dashCard}>
              <div style={styles.dashLabel}>{d.label}</div>
              <div style={styles.dashValue}>{d.value}</div>
            </div>
          ))}
        </div>
      )}

      <Section title="Basis">
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Gesamt-Ampel</label>
          <select
            style={styles.select}
            value={draft.ampel}
            onChange={(e) => setField('ampel', e.target.value)}
            disabled={readOnly}
          >
            <option value="gruen">Grün</option>
            <option value="gelb">Gelb</option>
            <option value="rot">Rot</option>
          </select>
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Abschluss-Datum</label>
          <input
            type="date"
            style={styles.input}
            value={draft.datum || ''}
            onChange={(e) => setField('datum', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Management Summary</label>
          <textarea
            style={{ ...styles.textarea, minHeight: 160 }}
            value={draft.management_summary || ''}
            onChange={(e) => setField('management_summary', e.target.value)}
            readOnly={readOnly}
          />
        </div>
      </Section>

      <Section title="Key Findings">
        <div style={styles.field}>
          <div style={styles.fieldHint}>Wo standen wir am Ende vs. Plan?</div>
          <textarea
            style={{ ...styles.textarea, minHeight: 160 }}
            value={draft.key_findings || ''}
            onChange={(e) => setField('key_findings', e.target.value)}
            readOnly={readOnly}
          />
        </div>
      </Section>

      <Section title="Ziele (aus letztem Statusbericht)">
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Ziele-Beschreibung</label>
          <textarea
            style={styles.textarea}
            value={draft.goals_snapshot || ''}
            onChange={(e) => setField('goals_snapshot', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div style={{ ...styles.field, marginBottom: 0 }}>
          <label style={styles.fieldLabel}>Bemerkung Ziel-Erreichung</label>
          <textarea
            style={styles.textarea}
            value={draft.goals_tracking?.bemerkung || ''}
            onChange={(e) => setField('goals_tracking', { ...(draft.goals_tracking || {}), bemerkung: e.target.value })}
            readOnly={readOnly}
          />
        </div>
        {(draft.criteria_snapshot || []).length > 0 && (
          <table style={{ ...styles.table, marginTop: theme.spacing.lg }}>
            <thead>
              <tr>
                <th style={styles.th}>Kriterium</th>
                <th style={styles.th}>Fortschritt</th>
                <th style={styles.th}>Ampel</th>
                <th style={styles.th}>Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {(draft.criteria_snapshot || []).map((c, i) => {
                const t = (draft.criteria_tracking || [])[i] || {};
                return (
                  <tr key={i}>
                    <td style={styles.td}>{c}</td>
                    <td style={styles.td}>{t.fortschritt != null ? `${t.fortschritt}%` : '–'}</td>
                    <td style={styles.td}>
                      {t.ampel && AMPEL_COLOR[t.ampel] && (
                        <>
                          <span style={{ ...styles.ampelDot, backgroundColor: AMPEL_COLOR[t.ampel].fg }} />
                          {AMPEL_COLOR[t.ampel].label}
                        </>
                      )}
                    </td>
                    <td style={styles.td}>{t.bemerkung || '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Scope (aus Projektauftrag)" defaultOpen={false}>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Scope-Beschreibung</label>
          <textarea
            style={styles.textarea}
            value={draft.scope || ''}
            onChange={(e) => setField('scope', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>In Scope</label>
          <textarea
            style={styles.textarea}
            value={(draft.in_scope || []).join('\n')}
            onChange={(e) => setField('in_scope', e.target.value.split('\n').filter(Boolean))}
            readOnly={readOnly}
          />
        </div>
        <div style={{ ...styles.field, marginBottom: 0 }}>
          <label style={styles.fieldLabel}>Out of Scope</label>
          <textarea
            style={styles.textarea}
            value={(draft.out_scope || []).join('\n')}
            onChange={(e) => setField('out_scope', e.target.value.split('\n').filter(Boolean))}
            readOnly={readOnly}
          />
        </div>
      </Section>

      <Section title="Roadmap (Soll vs Ist)" defaultOpen={false}>
        {(draft.milestones_snapshot || []).length === 0 ? (
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
            Keine Meilensteine aus dem Statusbericht uebernommen.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Meilenstein</th>
                <th style={styles.th}>Soll</th>
                <th style={styles.th}>Ist</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Ampel</th>
                <th style={styles.th}>Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {(draft.milestones_snapshot || []).map((m, i) => {
                const t = (draft.milestones_tracking || [])[i] || {};
                return (
                  <tr key={m.id || i}>
                    <td style={styles.td}>{m.name}</td>
                    <td style={styles.td}>{fmtDate(m.date)}</td>
                    <td style={styles.td}>{fmtDate(t.ist_datum)}</td>
                    <td style={styles.td}>{t.status || '–'}</td>
                    <td style={styles.td}>
                      {t.ampel && AMPEL_COLOR[t.ampel] && (
                        <>
                          <span style={{ ...styles.ampelDot, backgroundColor: AMPEL_COLOR[t.ampel].fg }} />
                          {AMPEL_COLOR[t.ampel].label}
                        </>
                      )}
                    </td>
                    <td style={styles.td}>{t.bemerkung || '–'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Kosten (EVM aus letztem SB)" defaultOpen={false}>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Gesamtbudget</label>
          <input
            type="number"
            style={styles.input}
            value={draft.cost_budget || 0}
            onChange={(e) => setField('cost_budget', Number(e.target.value) || 0)}
            readOnly={readOnly}
          />
        </div>
        {(draft.cost_months || []).length > 0 && (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Monat</th>
                <th style={styles.th}>Plan</th>
                <th style={styles.th}>Ist</th>
                <th style={styles.th}>Forecast</th>
              </tr>
            </thead>
            <tbody>
              {(draft.cost_months || []).map((m, i) => (
                <tr key={i}>
                  <td style={styles.td}>{m.month}</td>
                  <td style={styles.td}>{fmtCurrency(m.plan)}</td>
                  <td style={styles.td}>{fmtCurrency(m.ist)}</td>
                  <td style={styles.td}>{fmtCurrency(m.forecast)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Risiken (Plan vs Ist)" defaultOpen={false}>
        <h4 style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
          Plan (aus Projektauftrag)
        </h4>
        {/* Plan-Risiken aus dem Auftrag — `nature` ist die Art (Bedrohung/Chance),
            `type` waere der Risikotyp (Technisch/Organisatorisch/…). User-Wunsch:
            beide Tabellen zeigen die Art. Live aus projektauftrag.risks (nicht
            aus dem `risks_plan`-Snapshot), damit Auftrag-Edits sofort sichtbar
            sind. */}
        {(projektauftrag?.risks || draft.risks_plan || []).length === 0 ? (
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm, marginBottom: theme.spacing.lg }}>
            Keine geplanten Risiken.
          </div>
        ) : (
          <table style={{ ...styles.table, marginBottom: theme.spacing.xl }}>
            <thead>
              <tr>
                <th style={styles.th}>Art</th>
                <th style={styles.th}>Beschreibung</th>
                <th style={styles.th}>Wahrsch.</th>
                <th style={styles.th}>Auswirk.</th>
                <th style={styles.th}>Maßnahme</th>
              </tr>
            </thead>
            <tbody>
              {(projektauftrag?.risks || draft.risks_plan || []).map((r, i) => (
                <tr key={r.id || i}>
                  <td style={styles.td}>{riskTypeLabel(r.nature || r.type)}</td>
                  <td style={styles.td}>{r.description}</td>
                  <td style={styles.td}>{configLabel(appConfig, 'probability', r.probability)}</td>
                  <td style={styles.td}>{configLabel(appConfig, 'impact', r.impact)}</td>
                  <td style={styles.td}>{r.mitigation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <h4 style={{ fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, marginBottom: theme.spacing.sm }}>
          Ist (eingetreten/vermieden — aus letztem SB)
        </h4>
        {/* Live aus letztem SB (nicht aus draft.risk_tracking-Snapshot) — sonst
            zeigt die Tabelle veraltete Werte sobald jemand den SB nach Anlage
            des Abschlussberichts noch editiert. `data.risk_tracking` bleibt als
            Snapshot persistiert (Fallback wenn keine SBs mehr da sind). */}
        {(() => {
          const liveRiskTracking = latestSb?.risk_tracking ?? draft.risk_tracking ?? [];
          if (liveRiskTracking.length === 0) {
            return (
              <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
                Keine Risiko-Trackings im SB.
              </div>
            );
          }
          return (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Art</th>
                  <th style={styles.th}>Beschreibung</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Massnahmen</th>
                  <th style={styles.th}>Ampel</th>
                </tr>
              </thead>
              <tbody>
                {liveRiskTracking.map((r, i) => (
                  <tr key={r.id || i}>
                    <td style={styles.td}>{riskTypeLabel(r.type)}</td>
                    <td style={styles.td}>{r.beschreibung}</td>
                    <td style={styles.td}>{configLabel(appConfig, 'risk_status', r.status)}</td>
                    <td style={styles.td}>{r.massnahmen}</td>
                    <td style={styles.td}>
                      {r.ampel && AMPEL_COLOR[r.ampel] && (
                        <>
                          <span style={{ ...styles.ampelDot, backgroundColor: AMPEL_COLOR[r.ampel].fg }} />
                          {AMPEL_COLOR[r.ampel].label}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          );
        })()}
      </Section>

      <Section title="Stakeholder-Akzeptanz">
        {(draft.stakeholder_akzeptanz || []).length === 0 ? (
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
            Keine Stakeholder im Projektauftrag erfasst — nichts zu bewerten.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Stakeholder</th>
                <th style={styles.th}>Bewertung</th>
                <th style={styles.th}>Bemerkung</th>
              </tr>
            </thead>
            <tbody>
              {(draft.stakeholder_akzeptanz || []).map((s, i) => (
                <tr key={s.stakeholder_id || i}>
                  <td style={styles.td}>{s.name || s.stakeholder_id}</td>
                  <td style={styles.td}>
                    <select
                      style={{ ...styles.select, width: 120 }}
                      value={s.bewertung}
                      onChange={(e) => {
                        const next = [...draft.stakeholder_akzeptanz];
                        next[i] = { ...s, bewertung: e.target.value };
                        setField('stakeholder_akzeptanz', next);
                      }}
                      disabled={readOnly}
                    >
                      <option value="gruen">Grün</option>
                      <option value="gelb">Gelb</option>
                      <option value="rot">Rot</option>
                    </select>
                  </td>
                  <td style={styles.td}>
                    <input
                      type="text"
                      style={styles.input}
                      value={s.bemerkung || ''}
                      onChange={(e) => {
                        const next = [...draft.stakeholder_akzeptanz];
                        next[i] = { ...s, bemerkung: e.target.value };
                        setField('stakeholder_akzeptanz', next);
                      }}
                      readOnly={readOnly}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Übergabe">
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Übergabe an</label>
          <input
            type="text"
            style={styles.input}
            value={draft.uebergabe_an || ''}
            onChange={(e) => setField('uebergabe_an', e.target.value)}
            readOnly={readOnly}
            placeholder="Name / Rolle (PMO, Linie, Folgeprojekt-PL)"
          />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Übergabe-Datum</label>
          <input
            type="date"
            style={styles.input}
            value={draft.uebergabe_datum || ''}
            onChange={(e) => setField('uebergabe_datum', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div style={{ ...styles.field, marginBottom: 0 }}>
          <label style={styles.fieldLabel}>Inhalte</label>
          <div style={styles.fieldHint}>Dokumente, Systeme, offene Punkte</div>
          <textarea
            style={styles.textarea}
            value={draft.uebergabe_inhalte || ''}
            onChange={(e) => setField('uebergabe_inhalte', e.target.value)}
            readOnly={readOnly}
          />
        </div>
      </Section>

      <Section title="Empfehlung für Folgeprojekte">
        <div style={{ ...styles.field, marginBottom: 0 }}>
          <textarea
            style={{ ...styles.textarea, minHeight: 140 }}
            value={draft.folgeprojekt_empfehlung || ''}
            onChange={(e) => setField('folgeprojekt_empfehlung', e.target.value)}
            readOnly={readOnly}
          />
        </div>
      </Section>

      <Section title="Abnahme">
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Abnahme durch (Auftraggeber)</label>
          <input
            type="text"
            style={styles.input}
            value={draft.abnahme_durch || ''}
            onChange={(e) => setField('abnahme_durch', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div style={styles.field}>
          <label style={styles.fieldLabel}>Abnahme-Datum</label>
          <input
            type="date"
            style={styles.input}
            value={draft.abnahme_datum || ''}
            onChange={(e) => setField('abnahme_datum', e.target.value)}
            readOnly={readOnly}
          />
        </div>
        <div style={{ ...styles.field, marginBottom: 0, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <input
            type="checkbox"
            checked={!!draft.abnahme_signiert}
            onChange={(e) => setField('abnahme_signiert', e.target.checked)}
            disabled={readOnly}
          />
          <label style={styles.fieldLabel}>Formal abgenommen</label>
        </div>
      </Section>

      <Section title={`Lessons Learned (${lessons.length})`} defaultOpen={false}>
        {lessons.length === 0 ? (
          <div style={{ color: theme.colors.textMuted, fontSize: theme.typography.sizes.sm }}>
            Es sind noch keine Lessons Learned erfasst. Wechsle auf den „Lessons Learned"-
            Tab, um welche anzulegen — sie erscheinen dann hier automatisch.
          </div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Titel</th>
                <th style={styles.th}>Kategorie</th>
                <th style={styles.th}>Themengebiet</th>
                <th style={styles.th}>Empfehlung</th>
              </tr>
            </thead>
            <tbody>
              {lessons.map((l) => (
                <tr key={l.id}>
                  <td style={styles.td}>{l.title}</td>
                  <td style={styles.td}>{l.kategorie}</td>
                  <td style={styles.td}>{l.themengebiet}</td>
                  <td style={styles.td}>{l.empfehlung}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {lifecycleModal && (
        <div style={styles.modalOverlay} onClick={() => setLifecycleModal(false)}>
          <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalTitle}>Projektstatus aktualisieren?</div>
            <div style={styles.modalText}>
              Der Abschlussbericht ist als Final markiert. Soll der Projektstatus
              jetzt auf einen Endwert (z.B. „Abschluss" oder „Gestoppt") gesetzt
              werden? Du kannst den Projektstatus auch spaeter im Basis-Tab des
              Projektauftrags aendern.
            </div>
            <div style={{ marginBottom: theme.spacing.xl }}>
              <label style={{
                display: 'block',
                fontSize: theme.typography.sizes.sm,
                fontWeight: theme.typography.weights.medium,
                color: theme.colors.text,
                marginBottom: theme.spacing.xs,
              }}>
                Neuer Projektstatus
              </label>
              <select
                style={styles.select}
                value={statusModalValue}
                onChange={(e) => setStatusModalValue(e.target.value)}
              >
                <option value="">— Bitte waehlen —</option>
                {(appConfig?.project_status || []).map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div style={styles.modalActions}>
              <button type="button" style={styles.btn} onClick={() => { setLifecycleModal(false); setStatusModalValue(''); }}>
                Nein, spaeter
              </button>
              <button
                type="button"
                style={{ ...styles.btn, ...styles.btnPrimary, opacity: statusModalValue ? 1 : 0.5 }}
                onClick={handleLifecycleConfirm}
                disabled={!statusModalValue}
              >
                Status setzen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
