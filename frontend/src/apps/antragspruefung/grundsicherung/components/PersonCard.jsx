import { useState } from 'react';
import { theme } from '../../../../config/theme';
import { CommentIcon, PlusIcon, TrashIcon, ChevronDownIcon } from '../../../../components/Icons';
import {
  ROLLE_LABEL, FAMILIENSTAND_LABEL, BETREUUNG_LABEL, KV_ART_LABEL,
  EINKOMMENSART_LABEL, VERMOEGENSART_LABEL, GDB_OPTIONS, MERKZEICHEN_OPTIONS,
  ACCENT, grundsicherungApi,
} from '../api';
import { FeldGrid } from '../../kern/components/SektionCard';
import PanelSection from '../../kern/components/PanelSection';
import FeldStatusMark, { FeldStatusDot, FeldStatusFreigabe } from '../../kern/components/FeldStatusMark';
import { fsKey } from '../../kern/feldStatusMap';

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
  secBtnGhost: { padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  secBtnPrimary: { padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, borderRadius: theme.borderRadius.md, border: 'none', backgroundColor: ACCENT, color: '#fff', cursor: 'pointer' },
  secBtns: { display: 'flex', gap: theme.spacing.sm },
  editGrid: { display: 'grid', gridTemplateColumns: 'minmax(140px, 200px) 1fr', rowGap: theme.spacing.sm, columnGap: theme.spacing.lg, alignItems: 'center' },
  editLabel: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, display: 'flex', alignItems: 'center', gap: theme.spacing.xs },
  input: { width: '100%', padding: `6px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  check: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.sm, color: theme.colors.text, cursor: 'pointer' },
  checkWrap: { display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' },
  inputWithSuffix: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs },
  suffix: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted },
  kiSammel: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs, flexWrap: 'wrap' },
  kiZeile: { display: 'flex', alignItems: 'center', gap: theme.spacing.xs },
  leRemove: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 2, background: 'none', border: 'none', borderRadius: theme.borderRadius.sm, color: theme.colors.textMuted, cursor: 'pointer', flexShrink: 0 },
  leAdd: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: `2px ${theme.spacing.sm}`, background: 'none', border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.md, color: theme.colors.textMuted, cursor: 'pointer', fontSize: theme.typography.sizes.xs },
  leEmpty: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.xs },
  leSummaryRow: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, padding: `${theme.spacing.xs} 0`, borderBottom: `1px solid ${theme.colors.borderLight}` },
  leSumme: { display: 'flex', justifyContent: 'space-between', fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text, paddingTop: theme.spacing.xs },
  itemBlock: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, marginBottom: theme.spacing.xs, overflow: 'hidden' },
  itemHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm, padding: `6px ${theme.spacing.sm}` },
  itemToggle: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: theme.colors.text, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, textAlign: 'left' },
  itemChevron: { transition: `transform ${theme.transitions.fast}`, flexShrink: 0, color: theme.colors.textMuted },
  itemHeadTitle: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  itemBody: { padding: `0 ${theme.spacing.sm} ${theme.spacing.sm}`, borderTop: `1px solid ${theme.colors.borderLight}` },
  fieldRow: { display: 'grid', gridTemplateColumns: 'minmax(120px, 180px) 1fr', alignItems: 'center', gap: theme.spacing.sm, padding: '6px 0' },
  fieldLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  fieldInput: { width: '100%', padding: `4px ${theme.spacing.sm}`, fontSize: theme.typography.sizes.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none' },
  auskunftRow: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm, flexWrap: 'wrap', marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.borderLight}` },
  auskunftLabel: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  auskunftBtn: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: `4px ${theme.spacing.md}`, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  hinweis: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginBottom: theme.spacing.sm, lineHeight: 1.5 },
};

const JA_NEIN = { ja: 'Ja', nein: 'Nein' };

function eur(v) {
  if (v == null || v === '') return '—';
  return Number(v).toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}
/** Datum ISO (YYYY-MM-DD) → TT.MM.JJJJ; Freitext/leer unverändert. */
function fmtDate(v) {
  if (!v) return null;
  const m = String(v).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(v);
}
function rowId() {
  return (globalThis.crypto?.randomUUID?.() || `row-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
}
function boolZuWahl(v) { return v === true ? 'ja' : v === false ? 'nein' : ''; }
function wahlZuBool(v) { return v === 'ja' ? true : v === 'nein' ? false : undefined; }

/** Anzeige-Wert eines Feldes nach Typ (null = nicht befüllt). */
function anzeigeWert(f, v) {
  if (v == null || v === '') return null;
  switch (f.type) {
    case 'date': return fmtDate(v);
    case 'euro': return eur(v);
    case 'number': return f.suffix ? `${v} ${f.suffix}` : String(v);
    case 'select': return f.options?.[v] || String(v);
    case 'bool': return v === true ? 'Ja' : v === false ? 'Nein' : null;
    case 'merkzeichen': return Array.isArray(v) && v.length ? v.join(', ') : null;
    default: return String(v);
  }
}
/** Feldwert → Draft-Wert (Formular-String bzw. Array). */
function zuDraft(f, v) {
  if (f.type === 'bool') return boolZuWahl(v);
  if (f.type === 'merkzeichen') return Array.isArray(v) ? [...v] : [];
  if (f.type === 'date') return v ? String(v).slice(0, 10) : '';
  if (f.type === 'number' || f.type === 'euro' || f.type === 'gdb') return v == null ? '' : String(v);
  return v ?? '';
}
/** Draft-Wert → gespeicherter Wert (leer = undefined). */
function ausDraft(f, v) {
  if (f.type === 'bool') return wahlZuBool(v);
  if (f.type === 'merkzeichen') return Array.isArray(v) && v.length ? v : undefined;
  if (f.type === 'number' || f.type === 'euro' || f.type === 'gdb') return v === '' || v == null ? undefined : Number(v);
  if (typeof v === 'string') return v.trim() || undefined;
  return v;
}

/** Eingabefeld je Feldtyp (Formular einer Sektion). */
function FeldEingabe({ f, value, onChange }) {
  if (f.type === 'select' || f.type === 'bool') {
    const options = f.type === 'bool' ? JA_NEIN : f.options;
    return (
      <select style={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">—</option>
        {Object.entries(options || {}).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    );
  }
  if (f.type === 'gdb') {
    return (
      <select style={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
        {GDB_OPTIONS.map((v) => <option key={v} value={v}>{v === '' ? '—' : v}</option>)}
      </select>
    );
  }
  if (f.type === 'merkzeichen') {
    const liste = Array.isArray(value) ? value : [];
    return (
      <div style={styles.checkWrap}>
        {MERKZEICHEN_OPTIONS.map((m) => (
          <label key={m} style={styles.check}>
            <input
              type="checkbox"
              checked={liste.includes(m)}
              onChange={(e) => onChange(e.target.checked ? [...liste, m] : liste.filter((x) => x !== m))}
            /> {m}
          </label>
        ))}
      </div>
    );
  }
  if (f.type === 'date') return <input type="date" style={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />;
  if (f.type === 'number' || f.type === 'euro') {
    return (
      <div style={styles.inputWithSuffix}>
        <input type="number" style={{ ...styles.input, flex: 1 }} value={value} onChange={(e) => onChange(e.target.value)} />
        {(f.suffix || f.type === 'euro') && <span style={styles.suffix}>{f.suffix || '€'}</span>}
      </div>
    );
  }
  return <input style={styles.input} value={value} onChange={(e) => onChange(e.target.value)} />;
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

/**
 * Sektion aus festen Feldern (Bearbeiten pro Block). `gruppe` = verschachteltes Objekt der Person
 * (z. B. 'erwerbsminderung'); ohne `gruppe` liegen die Felder direkt an der Person.
 * Feld-Status-Pfad: `feld` bzw. `gruppe.feld` (Fallback: ganze Gruppe).
 */
function FeldSektion({ person: p, title, gruppe, felder, emptyText, hinweis, canEdit, busy, onSavePerson, fsFor, renderDot, renderFreigabe }) {
  const quelle = gruppe ? (p[gruppe] || {}) : p;
  const [draft, setDraft] = useState(null);
  const [open, setOpen] = useState(null);
  const editing = draft !== null;
  const pfad = (key) => (gruppe ? `${gruppe}.${key}` : key);
  const fsPfad = (key) => (fsFor(pfad(key)) ? pfad(key) : (gruppe && fsFor(gruppe) ? gruppe : null));

  const read = felder
    .map((f) => {
      const fp = fsPfad(f.key);
      return { label: f.label, value: anzeigeWert(f, quelle[f.key]), dot: fp ? renderDot(fp) : undefined, mark: fp ? renderFreigabe(fp) : undefined };
    })
    .filter((r) => r.value != null && r.value !== '');
  const unbestaetigt = felder.some((f) => !!fsPfad(f.key));

  const start = () => {
    const d = {};
    for (const f of felder) d[f.key] = zuDraft(f, quelle[f.key]);
    setDraft(d);
    setOpen(true);
  };
  const cancel = () => setDraft(null);
  const save = async () => {
    const werte = {};
    for (const f of felder) werte[f.key] = ausDraft(f, draft[f.key]);
    // Pflichtfelder der Person (Name) nie auf undefined setzen.
    if (!gruppe) {
      if ('nachname' in werte) werte.nachname = werte.nachname ?? '';
      if ('vorname' in werte) werte.vorname = werte.vorname ?? '';
    }
    const patch = gruppe ? { [gruppe]: { ...(p[gruppe] || {}), ...werte } } : werte;
    await onSavePerson?.(p.id, patch);
    setDraft(null);
  };

  return (
    <PanelSection
      title={title}
      unbestaetigt={unbestaetigt}
      open={open ?? read.length > 0}
      onToggle={setOpen}
      action={<SecAction editing={editing} canEdit={canEdit} busy={busy} onEdit={start} onCancel={cancel} onSave={save} />}
    >
      {hinweis && <div style={styles.hinweis}>{hinweis}</div>}
      {editing ? (
        <div style={styles.editGrid}>
          {felder.map((f) => (
            <FeldZeileEdit key={f.key} f={f} dot={fsPfad(f.key) ? renderDot(fsPfad(f.key)) : null} value={draft[f.key]} onChange={(v) => setDraft((d) => ({ ...d, [f.key]: v }))} />
          ))}
        </div>
      ) : (
        read.length > 0 ? <FeldGrid felder={read} /> : <div style={styles.leEmpty}>{emptyText}</div>
      )}
    </PanelSection>
  );
}

function FeldZeileEdit({ f, dot, value, onChange }) {
  return (
    <>
      <span style={styles.editLabel}>{dot}{f.label}</span>
      <FeldEingabe f={f} value={value} onChange={onChange} />
    </>
  );
}

/**
 * KI-Vorschlag für eine ganze Liste (z. B. alle Einkommenspositionen aus dem Antrag):
 * Bestätigen/Verwerfen betrifft alle Einträge — daher einmal über den Zeilen.
 */
function KiSammelzeile({ ki, anzahl }) {
  return (
    <div style={styles.kiSammel}>
      {ki.dot}
      <span>KI-Vorschlag aus dem Antrag: alle {anzahl} Einträge</span>
      {ki.freigabe}
    </div>
  );
}

/**
 * „+"-Listeneditor für strukturierte Personen-Listen (Einkommen, Vermögen).
 * Jeder Eintrag ist im Bearbeiten-Modus ein einklappbarer Unter-Block mit Feld-Schema;
 * außerhalb eine read-only Zusammenfassung mit Monats- bzw. Gesamtsumme.
 */
function ListEditor({ title, itemLabel, items, fields, canEdit, busy, onSave, emptyText, summary, summe, unbestaetigt = false, ki = null }) {
  const initial = items || [];
  const [draft, setDraft] = useState(null);
  const [openIdx, setOpenIdx] = useState({});
  const [sectionOpen, setSectionOpen] = useState(initial.length > 0);
  const editing = draft !== null;

  const emptyRow = () => { const r = { id: rowId() }; for (const f of fields) r[f.key] = zuDraft(f, undefined); return r; };
  const start = () => {
    setDraft(initial.length ? initial.map((r) => { const d = { ...r }; for (const f of fields) d[f.key] = zuDraft(f, r[f.key]); return d; }) : [emptyRow()]);
    setOpenIdx(initial.length ? {} : { 0: true });
    setSectionOpen(true);
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
  const toItem = (r) => { const out = { ...r, id: r.id || rowId() }; for (const f of fields) out[f.key] = ausDraft(f, r[f.key]); return out; };
  const hasContent = (r) => fields.some((f) => ausDraft(f, r[f.key]) !== undefined);

  const save = () => {
    onSave((draft || []).filter(hasContent).map(toItem));
    setDraft(null); setOpenIdx({});
  };

  return (
    <PanelSection
      title={title}
      action={<SecAction editing={editing} canEdit={canEdit} busy={busy} onEdit={start} onSave={save} onCancel={cancel} />}
      unbestaetigt={unbestaetigt}
      open={sectionOpen}
      onToggle={setSectionOpen}
    >
      {!editing ? (
        initial.length === 0
          ? <div style={styles.leEmpty}>{emptyText}</div>
          : (
            <>
              {ki && initial.length > 1 && <KiSammelzeile ki={ki} anzahl={initial.length} />}
              {initial.map((r) => (
                <div key={r.id} style={{ ...styles.leSummaryRow, ...(ki ? styles.kiZeile : {}) }}>
                  {ki?.dot}
                  <span>{summary(r)}</span>
                  {ki && initial.length === 1 && ki.freigabe}
                </div>
              ))}
              {summe && initial.length > 1 && (
                <div style={styles.leSumme}><span>{summe.label}</span><span>{summe.wert(initial)}</span></div>
              )}
            </>
          )
      ) : (
        <>
          {draft.map((r, idx) => {
            const isOpen = !!openIdx[idx];
            const head = hasContent(r) ? summary(toItem(r)) : `Neu · ${itemLabel}`;
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
                        <FeldEingabe f={f} value={r[f.key]} onChange={(v) => setCell(idx, f.key, v)} />
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
  return [p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person ohne Namen';
}

// ── Feld-Schemata je Sektion ────────────────────────────────────────────────
const PERSOENLICH_FELDER = [
  { key: 'nachname', label: 'Nachname', type: 'text' },
  { key: 'vorname', label: 'Vorname', type: 'text' },
  { key: 'geburtsname', label: 'Geburtsname', type: 'text' },
  { key: 'geburtsdatum', label: 'Geburtsdatum', type: 'date' },
  { key: 'geburtsort', label: 'Geburtsort', type: 'text' },
  { key: 'familienstand', label: 'Familienstand', type: 'select', options: FAMILIENSTAND_LABEL },
  { key: 'staatsangehoerigkeit', label: 'Staatsangehörigkeit', type: 'text' },
  { key: 'betreuung', label: 'Rechtliche Vertretung', type: 'select', options: BETREUUNG_LABEL },
  { key: 'rolle', label: 'Rolle', type: 'select', options: ROLLE_LABEL },
  { key: 'telefon', label: 'Telefon', type: 'text' },
  { key: 'email', label: 'E-Mail', type: 'text' },
  { key: 'bemerkung', label: 'Bemerkung', type: 'text' },
];
const HAUSHALT_FELDER = PERSOENLICH_FELDER.filter((f) => ['nachname', 'vorname', 'geburtsdatum', 'rolle', 'bemerkung'].includes(f.key));
const ERWERBSMINDERUNG_FELDER = [
  { key: 'voll', label: 'Voll erwerbsgemindert', type: 'bool' },
  { key: 'dauerhaft', label: 'Dauerhaft', type: 'bool' },
  { key: 'befristet_bis', label: 'Befristet bis', type: 'date' },
  { key: 'arbeitsmarktabhaengig', label: 'Nur wegen Arbeitsmarktlage', type: 'bool' },
  { key: 'feststellung_rv', label: 'Feststellung der Rentenversicherung liegt vor', type: 'bool' },
];
const SCHWERBEHINDERUNG_FELDER = [
  { key: 'gdb', label: 'Grad der Behinderung (GdB)', type: 'gdb' },
  { key: 'merkzeichen', label: 'Merkzeichen', type: 'merkzeichen' },
  { key: 'gueltig_bis', label: 'Ausweis gültig bis', type: 'date' },
];
const MEHRBEDARF_FELDER = [
  { key: 'mehrbedarf_ernaehrung', label: 'Kostenaufwändige Ernährung geltend gemacht', type: 'bool' },
];
const KV_FELDER = [
  { key: 'art', label: 'Versicherungsart', type: 'select', options: KV_ART_LABEL },
  { key: 'kasse', label: 'Kasse / Versicherer', type: 'text' },
  { key: 'beitrag', label: 'Beitrag monatlich', type: 'euro' },
];
const UNTERHALT_FELDER = [
  { key: 'angegeben', label: 'Angaben zu Kindern/Eltern gemacht', type: 'bool' },
  { key: 'ueber_100k_moeglich', label: 'Einkommen über 100.000 € möglich', type: 'bool' },
];
const EINKOMMEN_FELDER = [
  { key: 'art', label: 'Art', type: 'select', options: EINKOMMENSART_LABEL },
  { key: 'betrag_monat', label: 'Betrag monatlich', type: 'euro' },
  { key: 'traeger', label: 'Träger / Zahler', type: 'text' },
];
const VERMOEGEN_FELDER = [
  { key: 'art', label: 'Art', type: 'select', options: VERMOEGENSART_LABEL },
  { key: 'betrag', label: 'Betrag / Wert', type: 'euro' },
  { key: 'schonvermoegen', label: 'Als geschützt angegeben', type: 'bool' },
];

/**
 * Person der Einsatzgemeinschaft (Antragsteller/in, Partner/in) mit Stammdaten, Erwerbsminderung,
 * Schwerbehinderung/Mehrbedarf, Krankenversicherung, Einkommen, Vermögen und Unterhalt Kinder/Eltern.
 * `haushaltsangehoerig` = true → nur Stammdaten (zählt nur für den Kopfteil der Wohnkosten).
 */
export default function PersonCard({
  person: p, feldStatusMap = {}, canEdit = false, busy = false, haushaltsangehoerig = false,
  onBestaetigen, onVerwerfen, onSavePerson, notizCount, onNotizClick,
}) {
  const [open, setOpen] = useState(false);
  const [auskunftBusy, setAuskunftBusy] = useState(false);
  const [auskunftError, setAuskunftError] = useState('');
  const einkommen = p.einkommen || [];
  const vermoegen = p.vermoegen || [];

  async function exportAuskunft(format) {
    setAuskunftBusy(true);
    setAuskunftError('');
    try {
      await grundsicherungApi.exportAuskunft(p.id, format);
    } catch (err) {
      setAuskunftError(err.message);
    } finally {
      setAuskunftBusy(false);
    }
  }

  const fsFor = (feldPfad) => feldStatusMap[fsKey('person', p.id, feldPfad)];
  const renderDot = (feldPfad) => <FeldStatusDot fs={fsFor(feldPfad)} />;
  const renderFreigabe = (feldPfad) => (
    <FeldStatusFreigabe fs={fsFor(feldPfad)} canEdit={canEdit} busy={busy} onBestaetigen={onBestaetigen} onVerwerfen={onVerwerfen} />
  );
  const kiFuer = (feldPfad) => (fsFor(feldPfad) ? { dot: renderDot(feldPfad), freigabe: renderFreigabe(feldPfad) } : null);
  const mark = (feldPfad) => {
    const fs = fsFor(feldPfad);
    return fs ? <FeldStatusMark fs={fs} canEdit={canEdit} busy={busy} onBestaetigen={onBestaetigen} onVerwerfen={onVerwerfen} /> : null;
  };
  const personUnbestaetigt = Object.keys(feldStatusMap).some((k) => k.startsWith(`person:${p.id}:`));
  const sektionProps = { person: p, canEdit, busy, onSavePerson, fsFor, renderDot, renderFreigabe };

  const einkommenSumme = einkommen.reduce((a, e) => a + (Number(e.betrag_monat) || 0), 0);
  const kopfInfo = [
    p.geburtsdatum ? `geb. ${fmtDate(p.geburtsdatum)}` : null,
    !haushaltsangehoerig && einkommen.length > 0 ? `${eur(einkommenSumme)} / Mon.` : null,
  ].filter(Boolean).join(' · ');

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
          {kopfInfo && <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>{kopfInfo}</span>}
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
          <FeldSektion
            {...sektionProps}
            title="Stammdaten"
            felder={haushaltsangehoerig ? HAUSHALT_FELDER : PERSOENLICH_FELDER}
            emptyText="Keine Stammdaten erfasst."
          />

          {!haushaltsangehoerig && (
            <>
              <FeldSektion
                {...sektionProps}
                title="Erwerbsminderung"
                gruppe="erwerbsminderung"
                felder={ERWERBSMINDERUNG_FELDER}
                emptyText="Keine Angaben zur Erwerbsminderung."
              />
              <FeldSektion
                {...sektionProps}
                title="Schwerbehinderung"
                gruppe="schwerbehinderung"
                felder={SCHWERBEHINDERUNG_FELDER}
                emptyText="Keine Angaben zur Schwerbehinderung."
              />
              <FeldSektion
                {...sektionProps}
                title="Mehrbedarf"
                felder={MEHRBEDARF_FELDER}
                emptyText="Kein Mehrbedarf geltend gemacht."
                hinweis="Mehrbedarf wegen Merkzeichen G ergibt sich aus der Schwerbehinderung."
              />
              <FeldSektion
                {...sektionProps}
                title="Kranken- und Pflegeversicherung"
                gruppe="krankenversicherung"
                felder={KV_FELDER}
                emptyText="Keine Angaben zur Versicherung."
              />
              <ListEditor
                title="Einkommen"
                itemLabel="Einkommensposition"
                items={einkommen}
                ki={kiFuer('einkommen')}
                canEdit={canEdit}
                busy={busy}
                emptyText="Keine Einkommenspositionen erfasst."
                fields={EINKOMMEN_FELDER}
                unbestaetigt={Object.keys(feldStatusMap).some((k) => k.startsWith(`person:${p.id}:einkommen`))}
                summary={(r) => [EINKOMMENSART_LABEL[r.art] || r.art || 'Einkommen', r.traeger, r.betrag_monat != null ? `${eur(r.betrag_monat)} / Mon.` : null].filter(Boolean).join(' · ')}
                summe={{ label: 'Summe monatlich', wert: (list) => eur(list.reduce((a, e) => a + (Number(e.betrag_monat) || 0), 0)) }}
                onSave={(rows) => onSavePerson?.(p.id, { einkommen: rows })}
              />
              <ListEditor
                title="Vermögen"
                itemLabel="Vermögensposition"
                items={vermoegen}
                ki={kiFuer('vermoegen')}
                canEdit={canEdit}
                busy={busy}
                emptyText="Keine Vermögenspositionen erfasst."
                fields={VERMOEGEN_FELDER}
                unbestaetigt={Object.keys(feldStatusMap).some((k) => k.startsWith(`person:${p.id}:vermoegen`))}
                summary={(r) => [VERMOEGENSART_LABEL[r.art] || r.art || 'Vermögen', r.betrag != null ? eur(r.betrag) : null, r.schonvermoegen ? 'als geschützt angegeben' : null].filter(Boolean).join(' · ')}
                summe={{ label: 'Summe', wert: (list) => eur(list.reduce((a, e) => a + (Number(e.betrag) || 0), 0)) }}
                onSave={(rows) => onSavePerson?.(p.id, { vermoegen: rows })}
              />
              <FeldSektion
                {...sektionProps}
                title="Unterhalt Kinder / Eltern"
                gruppe="unterhalt_kinder_eltern"
                felder={UNTERHALT_FELDER}
                emptyText="Keine Angaben zu unterhaltspflichtigen Kindern oder Eltern."
                hinweis="Nur Angabe erheben: Kinder und Eltern werden erst ab einem Jahreseinkommen über 100.000 € herangezogen."
              />
            </>
          )}

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
