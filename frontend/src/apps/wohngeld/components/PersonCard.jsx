import { useState } from 'react';
import { theme } from '../../../config/theme';
import { CommentIcon, PlusIcon, TrashIcon, ChevronDownIcon } from '../../../components/Icons';
import {
  ROLLE_LABEL, ERWERBSSTATUS_LABEL, UNTERHALT_KATEGORIE_LABEL,
  GESCHLECHT_LABEL, FAMILIENSTAND_LABEL, EINKOMMENSART_LABEL,
  FREQUENZ_LABEL, VERWANDTSCHAFT_LABEL, AUSSCHLUSS_GRUND_LABEL,
  GDB_OPTIONS, PFLEGEGRAD_OPTIONS, ACCENT, wohngeldApi,
} from '../api';
import { FeldGrid } from './SektionCard';
import PanelSection from './PanelSection';
import FeldStatusMark, { FeldStatusDot, FeldStatusFreigabe } from './FeldStatusMark';
import { fsKey } from '../feldStatusMap';

const styles = {
  card: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.sm, overflow: 'hidden' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, cursor: 'pointer' },
  headDot: { display: 'inline-block', width: 8, height: 8, borderRadius: theme.borderRadius.full, backgroundColor: ACCENT, flexShrink: 0, marginLeft: theme.spacing.xs, animation: 'wg-pulse 1.6s ease-in-out infinite', verticalAlign: 'middle' },
  notizBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: `2px ${theme.spacing.sm}`, background: 'none',
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.full,
    color: theme.colors.textMuted, cursor: 'pointer', fontSize: theme.typography.sizes.xs,
  },
  name: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  rolle: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  body: { padding: theme.spacing.md, borderTop: `1px solid ${theme.colors.borderLight}` },
  secHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm, margin: `${theme.spacing.md} 0 ${theme.spacing.sm}` },
  subTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.04em' },
  secBtnGhost: { padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  secBtnPrimary: { padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: 'none', backgroundColor: ACCENT, color: '#fff', cursor: 'pointer' },
  secBtns: { display: 'flex', gap: theme.spacing.sm },
  editGrid: { display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', rowGap: theme.spacing.sm, columnGap: theme.spacing.lg, alignItems: 'center' },
  editLabel: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, display: 'flex', alignItems: 'center', gap: theme.spacing.xs },
  input: { width: '100%', padding: `6px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  checkRow: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, marginTop: theme.spacing.xs },
  check: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.sm, fontSize: theme.typography.sizes.sm, color: theme.colors.text, cursor: 'pointer' },
  einkTable: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm },
  th: { textAlign: 'left', padding: `${theme.spacing.xs} ${theme.spacing.sm}`, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium, borderBottom: `1px solid ${theme.colors.borderLight}` },
  td: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, color: theme.colors.text, borderBottom: `1px solid ${theme.colors.borderLight}` },
  ekEditRow: { display: 'grid', gridTemplateColumns: '1.4fr 1.6fr 1fr 1fr auto', gap: theme.spacing.sm, alignItems: 'center', marginBottom: theme.spacing.xs },
  ekCheckRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.sm, flexWrap: 'wrap' },
  leRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.xs },
  leInput: { flex: 1, minWidth: 60, padding: `4px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  leCheck: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, whiteSpace: 'nowrap', cursor: 'pointer' },
  leRemove: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 2, background: 'none', border: 'none', borderRadius: theme.borderRadius.sm, color: theme.colors.textMuted, cursor: 'pointer', flexShrink: 0 },
  leAdd: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: `2px ${theme.spacing.sm}`, background: 'none', border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.md, color: theme.colors.textMuted, cursor: 'pointer', fontSize: theme.typography.sizes.xs },
  leActions: { display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.xs },
  leSave: { padding: `2px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: 'none', backgroundColor: ACCENT, color: '#fff', cursor: 'pointer' },
  leReset: { padding: `2px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  leEmpty: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  leReadRow: { display: 'flex', justifyContent: 'space-between', gap: theme.spacing.md, fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, padding: '2px 0' },
  // ── forml-Listenblöcke (U2): einklappbare Unter-Blöcke je Eintrag ──
  leBlock: { marginTop: theme.spacing.xs },
  leSummaryRow: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, padding: `${theme.spacing.xs} 0`, borderBottom: `1px solid ${theme.colors.borderLight}` },
  itemBlock: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.xs, overflow: 'hidden' },
  itemHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, padding: `6px ${theme.spacing.sm}` },
  itemToggle: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.colors.text, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, textAlign: 'left' },
  itemChevron: { transition: `transform ${theme.transitions.fast}`, flexShrink: 0, color: theme.colors.textMuted },
  itemHeadTitle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemBody: { padding: `0 ${theme.spacing.sm} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.borderLight}` },
  fieldRow: { display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', alignItems: 'center', gap: theme.spacing.sm, padding: `6px 0` },
  fieldLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  fieldInput: { width: '100%', padding: `4px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  inputWithSuffix: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs },
  suffix: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },
  auskunftRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap', marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.borderLight}` },
  auskunftLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  auskunftBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
};

function eur(v) {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
/** Datum ISO (YYYY-MM-DD) → TT.MM.JJJJ; Freitext/leer unverändert. */
function fmtDate(v) {
  if (!v) return null;
  const iso = String(v).slice(0, 10);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v);
}
function num(v) { return v === '' || v == null ? undefined : Number(v); }

function rowId() {
  return (globalThis.crypto?.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}

/**
 * Reicher „+"-Listeneditor für strukturierte Personen-Listen (forml-Feldset, U2).
 * Jeder Eintrag ist im Bearbeiten-Modus ein einklappbarer Unter-Block mit einem
 * Feld-Schema; außerhalb des Bearbeiten-Modus eine read-only Zusammenfassung.
 * Block-Bearbeiten-Muster (Bearbeiten → Verwerfen/Speichern) konsistent zu U1.
 *
 *   fields:  [{ key, label, type: 'text'|'number'|'date'|'select', options?, suffix? }]
 *   summary: (item) => string  — Zusammenfassungszeile (read-only + Item-Kopf)
 *   note:    optionaler Knoten unter der Kopfzeile (z. B. Legacy-Hinweis)
 */
function ListEditor({ title, itemLabel, items, fields, canEdit, busy, onSave, emptyText, summary, note = null, unbestaetigt = false }) {
  const initial = items || [];
  const [draft, setDraft] = useState(null);     // null = read-only
  const [openIdx, setOpenIdx] = useState({});   // aufgeklappte Items im Bearbeiten-Modus
  const [sectionOpen, setSectionOpen] = useState(initial.length > 0); // Karte offen, wenn Inhalt
  const editing = draft !== null;

  const emptyRow = () => { const r = { id: rowId() }; for (const f of fields) r[f.key] = ''; return r; };
  const start = () => {
    setDraft(initial.length ? initial.map((r) => ({ ...r })) : [emptyRow()]);
    setOpenIdx(initial.length ? {} : { 0: true });
    setSectionOpen(true);   // beim Bearbeiten immer aufklappen
  };
  const cancel = () => { setDraft(null); setOpenIdx({}); };
  const setCell = (idx, key, val) => setDraft((d) => d.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  const addRow = () => setDraft((d) => {
    const next = [...(d || []), emptyRow()];
    setOpenIdx((o) => ({ ...o, [next.length - 1]: true }));
    return next;
  });
  const removeRow = (idx) => setDraft((d) => d.filter((_, i) => i !== idx));
  const toggle = (idx) => setOpenIdx((o) => ({ ...o, [idx]: !o[idx] }));
  const hasContent = (r) => fields.some((f) => r[f.key] !== undefined && r[f.key] !== '' && r[f.key] != null);

  const save = () => {
    const cleaned = (draft || [])
      .map((r) => {
        const out = { ...r, id: r.id || rowId() };   // Legacy-Felder erhalten (nicht hart entfernen)
        for (const f of fields) {
          if (f.type === 'number') out[f.key] = r[f.key] === '' || r[f.key] == null ? undefined : Number(r[f.key]);
          else out[f.key] = typeof r[f.key] === 'string' ? (r[f.key].trim() || undefined) : r[f.key];
        }
        return out;
      })
      .filter((r) => fields.some((f) => r[f.key] !== undefined && r[f.key] !== ''));
    onSave(cleaned);
    setDraft(null); setOpenIdx({});
  };

  const action = <SecAction editing={editing} canEdit={canEdit} busy={busy} onEdit={start} onSave={save} onCancel={cancel} />;

  return (
    <PanelSection
      title={title}
      action={action}
      unbestaetigt={unbestaetigt}
      open={sectionOpen}
      onToggle={setSectionOpen}
    >
      {note}
      {!editing ? (
        // ── read-only Zusammenfassung ──
        initial.length === 0
          ? <div style={styles.leEmpty}>{emptyText}</div>
          : initial.map((r) => <div key={r.id} style={styles.leSummaryRow}>{summary(r)}</div>)
      ) : (
        // ── Bearbeiten-Modus: einklappbare Unter-Blöcke ──
        <>
          {draft.map((r, idx) => {
            const isOpen = !!openIdx[idx];
            const head = hasContent(r) ? summary(r) : `Neu · ${itemLabel}`;
            return (
              <div key={r.id || idx} style={styles.itemBlock}>
                <div style={styles.itemHead}>
                  <button style={styles.itemToggle} onClick={() => toggle(idx)} aria-expanded={isOpen} title={isOpen ? 'Einklappen' : 'Ausklappen'}>
                    <ChevronDownIcon size={14} style={{ ...styles.itemChevron, transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)' }} />
                    <span style={styles.itemHeadTitle}>{head}</span>
                  </button>
                  <button style={styles.leRemove} onClick={() => removeRow(idx)} title="Eintrag entfernen" aria-label="Eintrag entfernen"><TrashIcon size={13} /></button>
                </div>
                {isOpen && (
                  <div style={styles.itemBody}>
                    {fields.map((f, fi) => (
                      <div key={f.key} style={{ ...styles.fieldRow, borderBottom: fi === fields.length - 1 ? 'none' : `1px solid ${theme.colors.borderLight}` }}>
                        <span style={styles.fieldLabel}>{f.label}</span>
                        {f.type === 'select' ? (
                          <select style={styles.fieldInput} value={r[f.key] ?? ''} onChange={(e) => setCell(idx, f.key, e.target.value)}>
                            <option value="">— bitte wählen —</option>
                            {Object.entries(f.options || {}).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                          </select>
                        ) : f.type === 'date' ? (
                          <input type="date" style={styles.fieldInput} placeholder="tt.mm.jjjj" value={r[f.key] ? String(r[f.key]).slice(0, 10) : ''} onChange={(e) => setCell(idx, f.key, e.target.value)} />
                        ) : f.type === 'number' ? (
                          <div style={styles.inputWithSuffix}>
                            <input type="number" style={{ ...styles.fieldInput, flex: 1 }} placeholder={f.label} value={r[f.key] ?? ''} onChange={(e) => setCell(idx, f.key, e.target.value)} />
                            {f.suffix && <span style={styles.suffix}>{f.suffix}</span>}
                          </div>
                        ) : (
                          <input type="text" style={styles.fieldInput} placeholder={f.label} value={r[f.key] ?? ''} onChange={(e) => setCell(idx, f.key, e.target.value)} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          <button style={styles.leAdd} onClick={addRow}><PlusIcon size={12} /> {itemLabel} hinzufügen</button>
        </>
      )}
    </PanelSection>
  );
}

function fullName(p) {
  return [p.titel, p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person';
}

/**
 * Kopf-Aktion einer Sektion für `PanelSection.action`: Bearbeiten bzw. im Edit-Modus
 * Verwerfen/Speichern. Rendert nichts ohne Bearbeiten-Recht.
 */
function SecAction({ editing, canEdit, busy, onEdit, onSave, onCancel }) {
  if (!canEdit) return null;
  return editing ? (
    <span style={styles.secBtns}>
      <button style={styles.secBtnGhost} onClick={onCancel} disabled={busy}>Verwerfen</button>
      <button style={styles.secBtnPrimary} onClick={onSave} disabled={busy}>{busy ? 'Speichert…' : 'Speichern'}</button>
    </span>
  ) : (
    <button style={styles.secBtnGhost} onClick={onEdit}>Bearbeiten</button>
  );
}

/** Draft-Shape aus einer Person aufbauen (Basisfelder + Pflege + Einkommen). */
function buildDraft(p) {
  const pb = p.pflege_behinderung || {};
  return {
    nachname: p.nachname || '', vorname: p.vorname || '', geburtsname: p.geburtsname || '',
    titel: p.titel || '', geburtsdatum: p.geburtsdatum ? String(p.geburtsdatum).slice(0, 10) : '',
    geburtsort: p.geburtsort || '', telefon: p.telefon || '', email: p.email || '', bemerkung: p.bemerkung || '',
    geschlecht: p.geschlecht || '', familienstand: p.familienstand || '', erwerbsstatus: p.erwerbsstatus || '',
    staatsangehoerigkeit: p.staatsangehoerigkeit || '',
    erhaelt_kindergeld: !!p.erhaelt_kindergeld, hat_werbungskosten: !!p.hat_werbungskosten,
    aufforderung_wohngeld: !!p.aufforderung_wohngeld, eu_ewr: !!p.eu_ewr,
    pb_schwerbehinderungsgrad: pb.schwerbehinderungsgrad != null ? String(pb.schwerbehinderungsgrad) : '',
    pb_pflegegrad: pb.pflegegrad != null ? String(pb.pflegegrad) : '',
    pb_pflegebeduerftig: !!pb.pflegebeduerftig,
    einkommen: (p.einkommen || []).map((e) => ({
      id: e.id || rowId(), art: e.art || 'lohn_gehalt', bezeichnung: e.bezeichnung || '',
      betrag_monatlich: e.betrag_monatlich ?? '', betrag_jaehrlich: e.betrag_jaehrlich ?? '',
      beruecksichtigt: e.beruecksichtigt !== false,
    })),
  };
}

export default function PersonCard({
  person: p, feldStatusMap = {}, canEdit = false, busy = false,
  onBestaetigen, onVerwerfen, onSavePerson, notizCount, onNotizClick,
}) {
  const [open, setOpen] = useState(false);
  const [editSec, setEditSec] = useState(null);   // 'persoenlich' | 'sonstiges' | 'pflege' | 'einkommen' | null
  const [openSec, setOpenSec] = useState({});     // Offen-Zustand je feste Sektion (sonst Default)
  const [draft, setDraft] = useState(null);
  const [auskunftBusy, setAuskunftBusy] = useState(false);
  const [auskunftError, setAuskunftError] = useState('');
  const einkommen = p.einkommen || [];
  const pb = p.pflege_behinderung || {};

  async function exportAuskunft(format) {
    setAuskunftBusy(true);
    setAuskunftError('');
    try {
      await wohngeldApi.exportAuskunft(p.id, format);
    } catch (err) {
      setAuskunftError(err.message);
    } finally {
      setAuskunftBusy(false);
    }
  }

  const fsFor = (feldPfad) => feldStatusMap[fsKey('person', p.id, feldPfad)];
  const dot = (feldPfad) => <FeldStatusDot fs={fsFor(feldPfad)} />;
  const freigabe = (feldPfad) => (
    <FeldStatusFreigabe fs={fsFor(feldPfad)} canEdit={canEdit} busy={busy} onBestaetigen={onBestaetigen} onVerwerfen={onVerwerfen} />
  );
  // Head-Marke (Punkt + Freigabe) für Name — bleibt am Namen sichtbar.
  const mark = (feldPfad) => {
    const fs = fsFor(feldPfad);
    return fs ? <FeldStatusMark fs={fs} canEdit={canEdit} busy={busy} onBestaetigen={onBestaetigen} onVerwerfen={onVerwerfen} /> : null;
  };
  // Person enthält ≥1 unbestätigten KI-Vorschlag? (Head-Punkt-Indikator)
  const personUnbestaetigt = Object.keys(feldStatusMap).some((k) => k.startsWith(`person:${p.id}:`));

  // Unbestätigte KI-Feldstatus je Sektion (für den KI-Punkt an der jeweiligen Karte).
  const fsPrefix = `person:${p.id}:`;
  const fsKeys = Object.keys(feldStatusMap).filter((k) => k.startsWith(fsPrefix)).map((k) => k.slice(fsPrefix.length));
  const secUnbest = {
    persoenlich: fsKeys.some((f) => ['geburtsname', 'titel', 'geburtsdatum', 'geburtsort', 'geschlecht', 'familienstand', 'telefon', 'email', 'erwerbsstatus', 'bemerkung'].includes(f)),
    pflege: fsKeys.some((f) => f.startsWith('pflege_behinderung')),
    sonstiges: fsKeys.some((f) => ['staatsangehoerigkeit', 'erhaelt_kindergeld', 'hat_werbungskosten', 'aufforderung_wohngeld', 'eu_ewr'].includes(f)),
    einkommen: fsKeys.some((f) => f.startsWith('einkommen')),
    vermoegen: fsKeys.some((f) => f.startsWith('vermoegen')),
    kinderbetreuung: fsKeys.some((f) => f.startsWith('kinderbetreuung')),
    uverpf: fsKeys.some((f) => f.startsWith('unterhaltsverpflichtungen')),
    uanspr: fsKeys.some((f) => f.startsWith('unterhaltsansprueche')),
    ausschluesse: fsKeys.some((f) => f.startsWith('ausschluesse')),
  };

  // ── Sektions-Edit-Handling ──
  const startSec = (sec) => { setDraft(buildDraft(p)); setEditSec(sec); setOpenSec((s) => ({ ...s, [sec]: true })); };
  const cancelSec = () => { setEditSec(null); setDraft(null); };
  // Offen-Props einer festen Sektion (kontrolliert; fällt auf `def` zurück).
  const secOpenProps = (key, def) => ({ open: openSec[key] ?? def, onToggle: (v) => setOpenSec((s) => ({ ...s, [key]: v })) });
  const setField = (key, val) => setDraft((d) => ({ ...d, [key]: val }));
  const saveSec = async (patchBuilder) => {
    await onSavePerson?.(p.id, patchBuilder(draft));
    setEditSec(null); setDraft(null);
  };

  // Einkommen-Draft-Helfer (mit ×12 / ÷12-Ableitung als Hilfe)
  const ekEmpty = () => ({ id: rowId(), art: 'lohn_gehalt', bezeichnung: '', betrag_monatlich: '', betrag_jaehrlich: '', beruecksichtigt: true });
  const setEk = (idx, key, val) => setDraft((d) => ({ ...d, einkommen: d.einkommen.map((r, i) => (i === idx ? { ...r, [key]: val } : r)) }));
  const setEkMonat = (idx, val) => setDraft((d) => ({
    ...d,
    einkommen: d.einkommen.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, betrag_monatlich: val };
      if (val !== '' && (r.betrag_jaehrlich === '' || r.betrag_jaehrlich == null)) next.betrag_jaehrlich = Math.round(Number(val) * 12);
      return next;
    }),
  }));
  const setEkJahr = (idx, val) => setDraft((d) => ({
    ...d,
    einkommen: d.einkommen.map((r, i) => {
      if (i !== idx) return r;
      const next = { ...r, betrag_jaehrlich: val };
      if (val !== '' && (r.betrag_monatlich === '' || r.betrag_monatlich == null)) next.betrag_monatlich = Math.round((Number(val) / 12) * 100) / 100;
      return next;
    }),
  }));
  const addEk = () => setDraft((d) => ({ ...d, einkommen: [...d.einkommen, ekEmpty()] }));
  const removeEk = (idx) => setDraft((d) => ({ ...d, einkommen: d.einkommen.filter((_, i) => i !== idx) }));
  const buildEinkommenPatch = (d) => ({
    einkommen: d.einkommen
      .map((r) => ({
        id: r.id || rowId(), art: r.art || 'sonstiges', bezeichnung: (r.bezeichnung || '').trim() || undefined,
        betrag_monatlich: num(r.betrag_monatlich), betrag_jaehrlich: num(r.betrag_jaehrlich), beruecksichtigt: !!r.beruecksichtigt,
      }))
      .filter((r) => r.betrag_monatlich != null || r.betrag_jaehrlich != null || r.bezeichnung),
  });

  // ── Read-Ansichten (nur befüllte Felder) ──
  const persoenlichRead = [
    { label: 'Geburtsdatum', value: fmtDate(p.geburtsdatum), dot: dot('geburtsdatum'), mark: freigabe('geburtsdatum') },
    { label: 'Geburtsort', value: p.geburtsort, dot: dot('geburtsort'), mark: freigabe('geburtsort') },
    { label: 'Geburtsname', value: p.geburtsname },
    { label: 'Geschlecht', value: p.geschlecht ? (GESCHLECHT_LABEL[p.geschlecht] || p.geschlecht) : null, dot: dot('geschlecht'), mark: freigabe('geschlecht') },
    { label: 'Familienstand', value: p.familienstand ? (FAMILIENSTAND_LABEL[p.familienstand] || p.familienstand) : null, dot: dot('familienstand'), mark: freigabe('familienstand') },
    { label: 'Erwerbsstatus', value: p.erwerbsstatus ? (ERWERBSSTATUS_LABEL[p.erwerbsstatus] || p.erwerbsstatus) : null, dot: dot('erwerbsstatus'), mark: freigabe('erwerbsstatus') },
    { label: 'Staatsangehörigkeit', value: p.staatsangehoerigkeit },
    { label: 'Telefon', value: p.telefon },
    { label: 'E-Mail', value: p.email },
    { label: 'Bemerkung', value: p.bemerkung },
  ].filter((f) => f.value != null && f.value !== '');

  const sonstigesRead = [
    { label: 'Erhält Kindergeld', value: p.erhaelt_kindergeld == null ? null : (p.erhaelt_kindergeld ? 'Ja' : 'Nein') },
    { label: 'Werbungskosten', value: p.hat_werbungskosten == null ? null : (p.hat_werbungskosten ? 'Ja' : 'Nein') },
    { label: 'Aufforderung Wohngeld', value: p.aufforderung_wohngeld == null ? null : (p.aufforderung_wohngeld ? 'Ja' : 'Nein') },
    { label: 'EU/EWR', value: p.eu_ewr == null ? null : (p.eu_ewr ? 'Ja' : 'Nein') },
    { label: 'Staatsangehörigkeit', value: p.staatsangehoerigkeit },
  ].filter((f) => f.value != null && f.value !== '');

  const pflegeRead = [
    { label: 'Behinderungsgrad (GdB)', value: pb.schwerbehinderungsgrad != null ? String(pb.schwerbehinderungsgrad) : null },
    { label: 'Pflegegrad', value: pb.pflegegrad != null ? String(pb.pflegegrad) : null },
    { label: 'Pflegebedürftig', value: pb.pflegebeduerftig == null ? null : (pb.pflegebeduerftig ? 'Ja' : 'Nein') },
  ].filter((f) => f.value != null);

  const persoenlichEditing = editSec === 'persoenlich';
  const sonstigesEditing = editSec === 'sonstiges';
  const pflegeEditing = editSec === 'pflege';
  const einkommenEditing = editSec === 'einkommen';

  return (
    <div style={styles.card}>
      <div
        style={styles.head}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <div>
          <div style={styles.name}>
            {open ? '▾ ' : '▸ '}{fullName(p)}
            {(fsFor('nachname') || fsFor('vorname')) && (
              <span onClick={(e) => e.stopPropagation()}>
                {mark('nachname')}{mark('vorname')}
              </span>
            )}
            {!open && personUnbestaetigt && !fsFor('nachname') && !fsFor('vorname') && (
              <span style={styles.headDot} title="Enthält unbestätigte KI-Vorschläge" aria-label="Unbestätigte KI-Vorschläge" />
            )}
          </div>
          <div style={styles.rolle}>{ROLLE_LABEL[p.rolle] || p.rolle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }} onClick={(e) => e.stopPropagation()}>
          {einkommen.length > 0 && (
            <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              {einkommen.length} Einkommenspos.
            </span>
          )}
          {onNotizClick && (
            <button style={styles.notizBtn} onClick={onNotizClick} title="Notizen">
              <CommentIcon size={13} />
              {notizCount > 0 && <span>{notizCount}</span>}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div style={styles.body}>
          {/* ── Persönliches ── */}
          <PanelSection
            title="Persönliches"
            unbestaetigt={secUnbest.persoenlich}
            {...secOpenProps('persoenlich', persoenlichRead.length > 0)}
            action={<SecAction
              editing={persoenlichEditing} canEdit={canEdit} busy={busy}
              onEdit={() => startSec('persoenlich')} onCancel={cancelSec}
              onSave={() => saveSec((d) => ({
                nachname: d.nachname.trim(), vorname: d.vorname.trim(),
                geburtsname: d.geburtsname.trim() || undefined, titel: d.titel.trim() || undefined,
                geburtsdatum: d.geburtsdatum || undefined, geburtsort: d.geburtsort.trim() || undefined,
                geschlecht: d.geschlecht || undefined, familienstand: d.familienstand || undefined,
                telefon: d.telefon.trim() || undefined, email: d.email.trim() || undefined,
                erwerbsstatus: d.erwerbsstatus || undefined, bemerkung: d.bemerkung.trim() || undefined,
              }))}
            />}
          >
          {persoenlichEditing ? (
            <div style={styles.editGrid}>
              <span style={styles.editLabel}>Nachname</span>
              <input style={styles.input} value={draft.nachname} onChange={(e) => setField('nachname', e.target.value)} />
              <span style={styles.editLabel}>Vorname</span>
              <input style={styles.input} value={draft.vorname} onChange={(e) => setField('vorname', e.target.value)} />
              <span style={styles.editLabel}>Geburtsname</span>
              <input style={styles.input} value={draft.geburtsname} onChange={(e) => setField('geburtsname', e.target.value)} />
              <span style={styles.editLabel}>Titel</span>
              <input style={styles.input} value={draft.titel} onChange={(e) => setField('titel', e.target.value)} />
              <span style={styles.editLabel}>{dot('geburtsdatum')}Geburtsdatum</span>
              <input type="date" style={styles.input} placeholder="tt.mm.jjjj" value={draft.geburtsdatum} onChange={(e) => setField('geburtsdatum', e.target.value)} />
              <span style={styles.editLabel}>Geburtsort</span>
              <input style={styles.input} value={draft.geburtsort} onChange={(e) => setField('geburtsort', e.target.value)} />
              <span style={styles.editLabel}>{dot('geschlecht')}Geschlecht</span>
              <select style={styles.input} value={draft.geschlecht} onChange={(e) => setField('geschlecht', e.target.value)}>
                <option value="">—</option>
                {Object.entries(GESCHLECHT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span style={styles.editLabel}>{dot('familienstand')}Familienstand</span>
              <select style={styles.input} value={draft.familienstand} onChange={(e) => setField('familienstand', e.target.value)}>
                <option value="">—</option>
                {Object.entries(FAMILIENSTAND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span style={styles.editLabel}>Telefon</span>
              <input style={styles.input} value={draft.telefon} onChange={(e) => setField('telefon', e.target.value)} />
              <span style={styles.editLabel}>E-Mail</span>
              <input style={styles.input} value={draft.email} onChange={(e) => setField('email', e.target.value)} />
              <span style={styles.editLabel}>{dot('erwerbsstatus')}Erwerbsstatus</span>
              <select style={styles.input} value={draft.erwerbsstatus} onChange={(e) => setField('erwerbsstatus', e.target.value)}>
                <option value="">—</option>
                {Object.entries(ERWERBSSTATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span style={styles.editLabel}>Bemerkung</span>
              <input style={styles.input} value={draft.bemerkung} onChange={(e) => setField('bemerkung', e.target.value)} />
            </div>
          ) : (
            persoenlichRead.length > 0
              ? <FeldGrid felder={persoenlichRead} />
              : <div style={styles.leEmpty}>Keine persönlichen Angaben erfasst.</div>
          )}
          </PanelSection>

          {/* ── Pflege & Behinderung ── */}
          <PanelSection
            title="Pflege & Behinderung"
            unbestaetigt={secUnbest.pflege}
            {...secOpenProps('pflege', pflegeRead.length > 0)}
            action={<SecAction
              editing={pflegeEditing} canEdit={canEdit} busy={busy}
              onEdit={() => startSec('pflege')} onCancel={cancelSec}
              onSave={() => saveSec((d) => ({
                pflege_behinderung: {
                  schwerbehinderungsgrad: d.pb_schwerbehinderungsgrad === '' ? undefined : Number(d.pb_schwerbehinderungsgrad),
                  pflegegrad: d.pb_pflegegrad === '' ? undefined : Number(d.pb_pflegegrad),
                  pflegebeduerftig: !!d.pb_pflegebeduerftig,
                },
              }))}
            />}
          >
          {pflegeEditing ? (
            <div style={styles.editGrid}>
              <span style={styles.editLabel}>Schwerbehinderungsgrad (GdB)</span>
              <select style={styles.input} value={draft.pb_schwerbehinderungsgrad} onChange={(e) => setField('pb_schwerbehinderungsgrad', e.target.value)}>
                {GDB_OPTIONS.map((v) => <option key={v} value={v}>{v === '' ? '—' : v}</option>)}
              </select>
              <span style={styles.editLabel}>Pflegegrad</span>
              <select style={styles.input} value={draft.pb_pflegegrad} onChange={(e) => setField('pb_pflegegrad', e.target.value)}>
                {PFLEGEGRAD_OPTIONS.map((v) => <option key={v} value={v}>{v === '' ? '—' : v}</option>)}
              </select>
              <span style={styles.editLabel}>Pflegebedürftig</span>
              <label style={styles.check}>
                <input type="checkbox" checked={draft.pb_pflegebeduerftig} onChange={(e) => setField('pb_pflegebeduerftig', e.target.checked)} /> Ja
              </label>
            </div>
          ) : (
            pflegeRead.length > 0
              ? <FeldGrid felder={pflegeRead} />
              : <div style={styles.leEmpty}>Keine Angaben zu Pflege & Behinderung.</div>
          )}
          </PanelSection>

          {/* ── Sonstiges ── */}
          <PanelSection
            title="Sonstiges"
            unbestaetigt={secUnbest.sonstiges}
            {...secOpenProps('sonstiges', sonstigesRead.length > 0)}
            action={<SecAction
              editing={sonstigesEditing} canEdit={canEdit} busy={busy}
              onEdit={() => startSec('sonstiges')} onCancel={cancelSec}
              onSave={() => saveSec((d) => ({
                erhaelt_kindergeld: !!d.erhaelt_kindergeld, hat_werbungskosten: !!d.hat_werbungskosten,
                aufforderung_wohngeld: !!d.aufforderung_wohngeld, eu_ewr: !!d.eu_ewr,
                staatsangehoerigkeit: d.staatsangehoerigkeit.trim() || undefined,
              }))}
            />}
          >
          {sonstigesEditing ? (
            <div>
              <div style={styles.checkRow}>
                <label style={styles.check}><input type="checkbox" checked={draft.erhaelt_kindergeld} onChange={(e) => setField('erhaelt_kindergeld', e.target.checked)} /> Erhält Kindergeld</label>
                <label style={styles.check}><input type="checkbox" checked={draft.hat_werbungskosten} onChange={(e) => setField('hat_werbungskosten', e.target.checked)} /> Werbungskosten</label>
                <label style={styles.check}><input type="checkbox" checked={draft.aufforderung_wohngeld} onChange={(e) => setField('aufforderung_wohngeld', e.target.checked)} /> Aufforderung Wohngeld</label>
                <label style={styles.check}><input type="checkbox" checked={draft.eu_ewr} onChange={(e) => setField('eu_ewr', e.target.checked)} /> EU/EWR</label>
              </div>
              <div style={{ ...styles.editGrid, marginTop: theme.spacing.sm }}>
                <span style={styles.editLabel}>Staatsangehörigkeit</span>
                <input style={styles.input} value={draft.staatsangehoerigkeit} onChange={(e) => setField('staatsangehoerigkeit', e.target.value)} />
              </div>
            </div>
          ) : (
            sonstigesRead.length > 0
              ? <FeldGrid felder={sonstigesRead} />
              : <div style={styles.leEmpty}>Keine sonstigen Angaben erfasst.</div>
          )}
          </PanelSection>

          {/* ── Einkommen ── */}
          <PanelSection
            title="Einkommen"
            unbestaetigt={secUnbest.einkommen}
            {...secOpenProps('einkommen', einkommen.length > 0)}
            action={<SecAction
              editing={einkommenEditing} canEdit={canEdit} busy={busy}
              onEdit={() => startSec('einkommen')} onCancel={cancelSec}
              onSave={() => saveSec(buildEinkommenPatch)}
            />}
          >
          {einkommenEditing ? (
            <div>
              {draft.einkommen.length === 0 && <div style={styles.leEmpty}>Keine Positionen — mit „Position" hinzufügen.</div>}
              {draft.einkommen.map((r, idx) => (
                <div key={r.id || idx}>
                  <div style={styles.ekEditRow}>
                    <select style={styles.leInput} value={r.art} onChange={(e) => setEk(idx, 'art', e.target.value)}>
                      {Object.entries(EINKOMMENSART_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                    <input style={styles.leInput} placeholder="Bezeichnung" value={r.bezeichnung} onChange={(e) => setEk(idx, 'bezeichnung', e.target.value)} />
                    <input type="number" style={styles.leInput} placeholder="€/Mon." value={r.betrag_monatlich} onChange={(e) => setEkMonat(idx, e.target.value)} />
                    <input type="number" style={styles.leInput} placeholder="€/Jahr" value={r.betrag_jaehrlich} onChange={(e) => setEkJahr(idx, e.target.value)} />
                    <button style={styles.leRemove} onClick={() => removeEk(idx)} title="Position entfernen" aria-label="Position entfernen"><TrashIcon size={13} /></button>
                  </div>
                  <label style={{ ...styles.leCheck, marginBottom: theme.spacing.sm }}>
                    <input type="checkbox" checked={!!r.beruecksichtigt} onChange={(e) => setEk(idx, 'beruecksichtigt', e.target.checked)} /> berücksichtigt
                  </label>
                </div>
              ))}
              <button style={styles.leAdd} onClick={addEk}><PlusIcon size={12} /> Position</button>
            </div>
          ) : (
            einkommen.length > 0 ? (
              <table style={styles.einkTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Art</th>
                    <th style={styles.th}>Monatlich</th>
                    <th style={styles.th}>Jährlich</th>
                    <th style={styles.th}>Berücksichtigt</th>
                  </tr>
                </thead>
                <tbody>
                  {einkommen.map((e) => (
                    <tr key={e.id}>
                      <td style={styles.td}>{e.bezeichnung || EINKOMMENSART_LABEL[e.art] || e.art}</td>
                      <td style={styles.td}>{eur(e.betrag_monatlich)}</td>
                      <td style={styles.td}>{eur(e.betrag_jaehrlich)}</td>
                      <td style={styles.td}>{e.beruecksichtigt ? 'ja' : 'nein'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : <div style={styles.leEmpty}>Keine Einkommenspositionen erfasst.</div>
          )}
          </PanelSection>

          {/* ── Vermögen ── */}
          <ListEditor
            title="Vermögen"
            itemLabel="Vermögensposition"
            items={p.vermoegenPositionen}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Vermögenspositionen erfasst."
            fields={[
              { key: 'art', label: 'Art', type: 'text' },
              { key: 'betrag', label: 'Betrag', type: 'number', suffix: '€' },
            ]}
            unbestaetigt={secUnbest.vermoegen}
            summary={(r) => [r.art || 'Vermögensposition', r.betrag != null ? eur(r.betrag) : null].filter(Boolean).join(' · ')}
            note={(!p.vermoegenPositionen || p.vermoegenPositionen.length === 0) && p.vermoegen != null
              ? <div style={styles.leEmpty}>Bisher als Einzelwert erfasst: {eur(p.vermoegen)}</div>
              : null}
            onSave={(rows) => onSavePerson?.(p.id, { vermoegenPositionen: rows })}
          />

          {/* ── Kinderbetreuungskosten (nur Erfassung/Anzeige — kein §13-Abzug) ── */}
          <ListEditor
            title="Kinderbetreuungskosten"
            itemLabel="Kinderbetreuungskosten"
            items={p.kinderbetreuungskosten}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Kinderbetreuungskosten erfasst."
            fields={[
              { key: 'frequenz', label: 'Frequenz', type: 'select', options: FREQUENZ_LABEL },
              { key: 'bemerkung', label: 'Bemerkung', type: 'text' },
              { key: 'betrag', label: 'Betrag', type: 'number', suffix: '€' },
            ]}
            unbestaetigt={secUnbest.kinderbetreuung}
            summary={(r) => [r.bemerkung || 'Kinderbetreuung', r.frequenz ? FREQUENZ_LABEL[r.frequenz] : null, r.betrag != null ? eur(r.betrag) : null].filter(Boolean).join(' · ')}
            onSave={(rows) => onSavePerson?.(p.id, { kinderbetreuungskosten: rows })}
          />

          {/* ── Unterhaltsverpflichtungen (§18) ── */}
          <ListEditor
            title="Unterhaltsverpflichtungen (§18)"
            itemLabel="Unterhaltsverpflichtung"
            items={p.unterhaltsverpflichtungen}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Unterhaltsverpflichtungen erfasst."
            fields={[
              { key: 'verwandtschaft', label: 'Verwandtschaft', type: 'select', options: VERWANDTSCHAFT_LABEL },
              { key: 'empfaengerVorname', label: 'Vorname Empfänger', type: 'text' },
              { key: 'empfaengerNachname', label: 'Nachname Empfänger', type: 'text' },
              { key: 'frequenz', label: 'Frequenz', type: 'select', options: FREQUENZ_LABEL },
              { key: 'betrag', label: 'Betrag', type: 'number', suffix: '€' },
            ]}
            unbestaetigt={secUnbest.uverpf}
            summary={(r) => {
              const kat = r.verwandtschaft ? VERWANDTSCHAFT_LABEL[r.verwandtschaft]
                : r.empfaengerKategorie ? UNTERHALT_KATEGORIE_LABEL[r.empfaengerKategorie] : null;
              const name = [r.empfaengerVorname, r.empfaengerNachname].filter(Boolean).join(' ');
              return [name || kat || 'Verpflichtung', name && kat ? `(${kat})` : null,
                r.frequenz ? FREQUENZ_LABEL[r.frequenz] : (r.titelVorhanden ? 'mit Titel' : null),
                r.betrag != null ? eur(r.betrag) : null].filter(Boolean).join(' · ');
            }}
            onSave={(rows) => onSavePerson?.(p.id, { unterhaltsverpflichtungen: rows })}
          />

          {/* ── Unterhaltsansprüche ── */}
          <ListEditor
            title="Unterhaltsansprüche"
            itemLabel="Unterhaltsanspruch"
            items={p.unterhaltsansprueche}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Unterhaltsansprüche erfasst."
            fields={[
              { key: 'vonVorname', label: 'Vorname (von)', type: 'text' },
              { key: 'vonNachname', label: 'Nachname (von)', type: 'text' },
              { key: 'frequenz', label: 'Frequenz', type: 'select', options: FREQUENZ_LABEL },
              { key: 'betrag', label: 'Betrag', type: 'number', suffix: '€' },
            ]}
            unbestaetigt={secUnbest.uanspr}
            summary={(r) => {
              const name = [r.vonVorname, r.vonNachname].filter(Boolean).join(' ');
              return [name || r.art || 'Anspruch', r.frequenz ? FREQUENZ_LABEL[r.frequenz] : null, r.betrag != null ? eur(r.betrag) : null].filter(Boolean).join(' · ');
            }}
            onSave={(rows) => onSavePerson?.(p.id, { unterhaltsansprueche: rows })}
          />

          {/* ── Ausschlüsse (§7) — ersetzt Transferleistungen; Altdaten als Hinweis ── */}
          <ListEditor
            title="Ausschlüsse (§7)"
            itemLabel="Ausschluss"
            items={p.ausschluesse}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Ausschlüsse erfasst."
            fields={[
              { key: 'grund', label: 'Grund', type: 'select', options: AUSSCHLUSS_GRUND_LABEL },
              { key: 'von', label: 'Von', type: 'date' },
              { key: 'bis', label: 'Bis', type: 'date' },
              { key: 'freitext', label: 'Bemerkung', type: 'text' },
            ]}
            unbestaetigt={secUnbest.ausschluesse}
            summary={(r) => [r.grund ? AUSSCHLUSS_GRUND_LABEL[r.grund] : (r.freitext || 'Ausschluss'),
              (r.von || r.bis) ? `${fmtDate(r.von) || '?'} – ${fmtDate(r.bis) || '?'}` : null].filter(Boolean).join(' · ')}
            note={p.transferleistungenDetail?.length > 0
              ? (
                <div style={{ marginBottom: theme.spacing.xs }}>
                  <div style={styles.leEmpty}>Frühere Transferleistungs-Angaben (Altbestand):</div>
                  {p.transferleistungenDetail.map((t) => (
                    <div key={t.id} style={styles.leSummaryRow}>
                      {[t.art || '—', t.kduEnthalten ? 'KdU enthalten' : null, t.bescheidVorhanden ? 'Bescheid' : null].filter(Boolean).join(' · ')}
                    </div>
                  ))}
                </div>
              )
              : null}
            onSave={(rows) => onSavePerson?.(p.id, { ausschluesse: rows })}
          />

          {canEdit && (
            <div style={styles.auskunftRow}>
              <span style={styles.auskunftLabel}>Betroffenenrechte (Art. 15 DSGVO):</span>
              <button style={styles.auskunftBtn} onClick={() => exportAuskunft('pdf')} disabled={auskunftBusy}>
                {auskunftBusy ? 'Erstellt…' : 'Auskunft (Art. 15) exportieren · PDF'}
              </button>
              <button style={styles.auskunftBtn} onClick={() => exportAuskunft('json')} disabled={auskunftBusy}>
                JSON
              </button>
              {auskunftError && <span style={{ ...styles.auskunftLabel, color: theme.colors.error }}>{auskunftError}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
