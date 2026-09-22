import { useState } from 'react';
import { theme } from '../../../config/theme';
import { CommentIcon, PlusIcon, TrashIcon } from '../../../components/Icons';
import {
  ROLLE_LABEL, ERWERBSSTATUS_LABEL, UNTERHALT_KATEGORIE_LABEL,
  GESCHLECHT_LABEL, FAMILIENSTAND_LABEL, EINKOMMENSART_LABEL,
  GDB_OPTIONS, PFLEGEGRAD_OPTIONS, ACCENT, wohngeldApi,
} from '../api';
import { FeldGrid } from './SektionCard';
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
  body: { padding: `0 ${theme.spacing.md} ${theme.spacing.md}`, borderTop: `1px solid ${theme.colors.borderLight}` },
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
 * Schlanke „+"-Editor-Liste für eine strukturierte Personen-Liste (WP5).
 * cols: [{ key, label, type: 'text'|'number'|'select'|'checkbox', options?, width? }]
 * Lokaler Draft; „Speichern" erscheint nur bei Änderungen. Read-only ohne canEdit.
 */
function ListEditor({ title, items, cols, canEdit, busy, onSave, emptyText, renderRead }) {
  const initial = items || [];
  const [draft, setDraft] = useState(null); // null = nicht im Bearbeitungsmodus
  const editing = draft !== null;
  const rows = editing ? draft : initial;

  const emptyRow = () => { const r = { id: rowId() }; for (const c of cols) r[c.key] = c.type === 'checkbox' ? false : ''; return r; };
  const start = () => setDraft(initial.length ? initial.map((r) => ({ ...r })) : [emptyRow()]);
  const setCell = (idx, key, val) => setDraft((d) => d.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  const addRow = () => setDraft((d) => [...(d || []), emptyRow()]);
  const removeRow = (idx) => setDraft((d) => d.filter((_, i) => i !== idx));
  const cancel = () => setDraft(null);
  const save = () => {
    const cleaned = (draft || [])
      .map((r) => {
        const out = { id: r.id || rowId() };
        for (const c of cols) {
          if (c.type === 'number') out[c.key] = r[c.key] === '' || r[c.key] == null ? undefined : Number(r[c.key]);
          else if (c.type === 'checkbox') out[c.key] = !!r[c.key];
          else out[c.key] = (r[c.key] ?? '').trim ? (r[c.key] ?? '').trim() : r[c.key];
        }
        return out;
      })
      // Zeilen ohne inhaltliche Angabe verwerfen (leere Textfelder + kein Betrag)
      .filter((r) => cols.some((c) => (c.type === 'checkbox' ? false : r[c.key] !== undefined && r[c.key] !== '')));
    onSave(cleaned);
    setDraft(null);
  };

  if (!canEdit) {
    if (!initial.length) return renderRead ? null : <div style={styles.leEmpty}>{emptyText}</div>;
    return <div>{initial.map((r) => (renderRead ? renderRead(r) : (
      <div key={r.id} style={styles.leReadRow}>
        {cols.map((c) => (
          <span key={c.key}>{c.type === 'checkbox' ? (r[c.key] ? c.label : '') : (c.type === 'select' ? (c.options?.[r[c.key]] ?? r[c.key]) : r[c.key])}</span>
        ))}
      </div>
    )))}</div>;
  }

  if (!editing) {
    return (
      <div>
        {initial.length === 0
          ? <div style={styles.leEmpty}>{emptyText}</div>
          : initial.map((r) => (renderRead ? renderRead(r) : (
            <div key={r.id} style={styles.leReadRow}>
              {cols.map((c) => (
                <span key={c.key}>{c.type === 'checkbox' ? (r[c.key] ? c.label : '—') : (c.type === 'select' ? (c.options?.[r[c.key]] ?? r[c.key]) : (r[c.key] || '—'))}</span>
              ))}
            </div>
          )))}
        <button style={{ ...styles.leAdd, marginTop: theme.spacing.xs }} onClick={start} disabled={busy}>
          <PlusIcon size={12} /> {initial.length ? `${title} bearbeiten` : `${title} hinzufügen`}
        </button>
      </div>
    );
  }

  return (
    <div>
      {rows.map((r, idx) => (
        <div key={r.id || idx} style={styles.leRow}>
          {cols.map((c) => {
            if (c.type === 'checkbox') return (
              <label key={c.key} style={styles.leCheck}>
                <input type="checkbox" checked={!!r[c.key]} onChange={(e) => setCell(idx, c.key, e.target.checked)} /> {c.label}
              </label>
            );
            if (c.type === 'select') return (
              <select key={c.key} style={{ ...styles.leInput, flex: c.width || 1 }} value={r[c.key] ?? ''} onChange={(e) => setCell(idx, c.key, e.target.value)}>
                {Object.entries(c.options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            );
            return (
              <input
                key={c.key}
                type={c.type === 'number' ? 'number' : 'text'}
                style={{ ...styles.leInput, flex: c.width || 1 }}
                placeholder={c.label}
                value={r[c.key] ?? ''}
                onChange={(e) => setCell(idx, c.key, e.target.value)}
              />
            );
          })}
          <button style={styles.leRemove} onClick={() => removeRow(idx)} title="Zeile entfernen" aria-label="Zeile entfernen"><TrashIcon size={13} /></button>
        </div>
      ))}
      <button style={styles.leAdd} onClick={addRow}><PlusIcon size={12} /> Zeile</button>
      <div style={styles.leActions}>
        <button style={styles.leSave} onClick={save} disabled={busy}>Speichern</button>
        <button style={styles.leReset} onClick={cancel} disabled={busy}>Abbrechen</button>
      </div>
    </div>
  );
}

function fullName(p) {
  return [p.titel, p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person';
}

/** Sektions-Kopf mit Bearbeiten- bzw. Verwerfen/Speichern-Buttons. */
function SecHead({ title, editing, canEdit, busy, onEdit, onSave, onCancel }) {
  return (
    <div style={styles.secHead}>
      <span style={styles.subTitle}>{title}</span>
      {canEdit && (editing ? (
        <span style={styles.secBtns}>
          <button style={styles.secBtnGhost} onClick={onCancel} disabled={busy}>Verwerfen</button>
          <button style={styles.secBtnPrimary} onClick={onSave} disabled={busy}>{busy ? 'Speichert…' : 'Speichern'}</button>
        </span>
      ) : (
        <button style={styles.secBtnGhost} onClick={onEdit}>Bearbeiten</button>
      ))}
    </div>
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

  // ── Sektions-Edit-Handling ──
  const startSec = (sec) => { setDraft(buildDraft(p)); setEditSec(sec); };
  const cancelSec = () => { setEditSec(null); setDraft(null); };
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
          <SecHead
            title="Persönliches" editing={persoenlichEditing} canEdit={canEdit} busy={busy}
            onEdit={() => startSec('persoenlich')} onCancel={cancelSec}
            onSave={() => saveSec((d) => ({
              nachname: d.nachname.trim(), vorname: d.vorname.trim(),
              geburtsname: d.geburtsname.trim() || undefined, titel: d.titel.trim() || undefined,
              geburtsdatum: d.geburtsdatum || undefined, geburtsort: d.geburtsort.trim() || undefined,
              geschlecht: d.geschlecht || undefined, familienstand: d.familienstand || undefined,
              telefon: d.telefon.trim() || undefined, email: d.email.trim() || undefined,
              erwerbsstatus: d.erwerbsstatus || undefined, bemerkung: d.bemerkung.trim() || undefined,
            }))}
          />
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

          {/* ── Pflege & Behinderung ── */}
          <SecHead
            title="Pflege & Behinderung" editing={pflegeEditing} canEdit={canEdit} busy={busy}
            onEdit={() => startSec('pflege')} onCancel={cancelSec}
            onSave={() => saveSec((d) => ({
              pflege_behinderung: {
                schwerbehinderungsgrad: d.pb_schwerbehinderungsgrad === '' ? undefined : Number(d.pb_schwerbehinderungsgrad),
                pflegegrad: d.pb_pflegegrad === '' ? undefined : Number(d.pb_pflegegrad),
                pflegebeduerftig: !!d.pb_pflegebeduerftig,
              },
            }))}
          />
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

          {/* ── Sonstiges ── */}
          <SecHead
            title="Sonstiges" editing={sonstigesEditing} canEdit={canEdit} busy={busy}
            onEdit={() => startSec('sonstiges')} onCancel={cancelSec}
            onSave={() => saveSec((d) => ({
              erhaelt_kindergeld: !!d.erhaelt_kindergeld, hat_werbungskosten: !!d.hat_werbungskosten,
              aufforderung_wohngeld: !!d.aufforderung_wohngeld, eu_ewr: !!d.eu_ewr,
              staatsangehoerigkeit: d.staatsangehoerigkeit.trim() || undefined,
            }))}
          />
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

          {/* ── Einkommen ── */}
          <SecHead
            title="Einkommen" editing={einkommenEditing} canEdit={canEdit} busy={busy}
            onEdit={() => startSec('einkommen')} onCancel={cancelSec}
            onSave={() => saveSec(buildEinkommenPatch)}
          />
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

          <div style={styles.secHead}><span style={styles.subTitle}>Vermögen</span></div>
          {(!p.vermoegenPositionen || p.vermoegenPositionen.length === 0) && p.vermoegen != null && (
            <div style={styles.leEmpty}>Bisher als Einzelwert erfasst: {eur(p.vermoegen)}</div>
          )}
          <ListEditor
            title="Vermögensposition"
            items={p.vermoegenPositionen}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Vermögenspositionen erfasst."
            cols={[
              { key: 'art', label: 'Art (z. B. Bankguthaben)', type: 'text', width: 2 },
              { key: 'betrag', label: 'Betrag (€)', type: 'number', width: 1 },
            ]}
            renderRead={(r) => (
              <div key={r.id} style={styles.leReadRow}><span>{r.art || '—'}</span><span>{eur(r.betrag)}</span></div>
            )}
            onSave={(rows) => onSavePerson?.(p.id, { vermoegenPositionen: rows })}
          />

          <div style={styles.secHead}><span style={styles.subTitle}>Unterhaltsverpflichtungen (§18)</span></div>
          <ListEditor
            title="Verpflichtung"
            items={p.unterhaltsverpflichtungen}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Unterhaltsverpflichtungen erfasst."
            cols={[
              { key: 'empfaengerKategorie', label: 'Empfänger', type: 'select', options: UNTERHALT_KATEGORIE_LABEL, width: 2 },
              { key: 'betrag', label: 'Betrag/Jahr (€)', type: 'number', width: 1 },
              { key: 'titelVorhanden', label: 'Titel', type: 'checkbox' },
            ]}
            renderRead={(r) => (
              <div key={r.id} style={styles.leReadRow}>
                <span>{UNTERHALT_KATEGORIE_LABEL[r.empfaengerKategorie] || r.empfaengerKategorie}{r.titelVorhanden ? ' · mit Titel' : ''}</span>
                <span>{eur(r.betrag)}</span>
              </div>
            )}
            onSave={(rows) => onSavePerson?.(p.id, { unterhaltsverpflichtungen: rows })}
          />

          <div style={styles.secHead}><span style={styles.subTitle}>Unterhaltsansprüche</span></div>
          <ListEditor
            title="Anspruch"
            items={p.unterhaltsansprueche}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Unterhaltsansprüche erfasst."
            cols={[
              { key: 'art', label: 'Art (z. B. Kindesunterhalt)', type: 'text', width: 2 },
              { key: 'betrag', label: 'Betrag/Mon. (€)', type: 'number', width: 1 },
            ]}
            renderRead={(r) => (
              <div key={r.id} style={styles.leReadRow}><span>{r.art || '—'}</span><span>{eur(r.betrag)}</span></div>
            )}
            onSave={(rows) => onSavePerson?.(p.id, { unterhaltsansprueche: rows })}
          />

          <div style={styles.secHead}><span style={styles.subTitle}>Transferleistungen</span></div>
          <ListEditor
            title="Transferleistung"
            items={p.transferleistungenDetail}
            canEdit={canEdit}
            busy={busy}
            emptyText="Keine Transferleistungen erfasst."
            cols={[
              { key: 'art', label: 'Art (z. B. Bürgergeld)', type: 'text', width: 2 },
              { key: 'kduEnthalten', label: 'KdU enthalten', type: 'checkbox' },
              { key: 'bescheidVorhanden', label: 'Bescheid', type: 'checkbox' },
            ]}
            renderRead={(r) => (
              <div key={r.id} style={styles.leReadRow}>
                <span>{r.art || '—'}{r.kduEnthalten ? ' · KdU enthalten' : ''}</span>
                <span>{r.bescheidVorhanden ? 'Bescheid vorhanden' : 'ohne Bescheid'}</span>
              </div>
            )}
            onSave={(rows) => onSavePerson?.(p.id, { transferleistungenDetail: rows })}
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
