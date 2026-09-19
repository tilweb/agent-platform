import { useState } from 'react';
import { theme } from '../../../config/theme';
import { CommentIcon, PlusIcon, TrashIcon } from '../../../components/Icons';
import { ROLLE_LABEL, ERWERBSSTATUS_LABEL, UNTERHALT_KATEGORIE_LABEL, ACCENT } from '../api';
import { FeldGrid } from './SektionCard';
import FeldStatusMark from './FeldStatusMark';
import { fsKey } from '../feldStatusMap';

const styles = {
  card: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.sm, overflow: 'hidden' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, cursor: 'pointer' },
  notizBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: `2px ${theme.spacing.sm}`, background: 'none',
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.full,
    color: theme.colors.textMuted, cursor: 'pointer', fontSize: theme.typography.sizes.xs,
  },
  name: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  rolle: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  body: { padding: `0 ${theme.spacing.md} ${theme.spacing.md}`, borderTop: `1px solid ${theme.colors.borderLight}` },
  subTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.04em', margin: `${theme.spacing.md} 0 ${theme.spacing.sm}` },
  einkTable: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm },
  th: { textAlign: 'left', padding: `${theme.spacing.xs} ${theme.spacing.sm}`, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium, borderBottom: `1px solid ${theme.colors.borderLight}` },
  td: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, color: theme.colors.text, borderBottom: `1px solid ${theme.colors.borderLight}` },
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
};

function eur(v) {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

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

export default function PersonCard({
  person: p, feldStatusMap = {}, canEdit = false, busy = false,
  onBestaetigen, onVerwerfen, onSavePerson, notizCount, onNotizClick,
}) {
  const [open, setOpen] = useState(false);
  const einkommen = p.einkommen || [];
  const pb = p.pflege_behinderung || {};

  const fsFor = (feldPfad) => feldStatusMap[fsKey('person', p.id, feldPfad)];
  const mark = (feldPfad) => {
    const fs = fsFor(feldPfad);
    return fs ? <FeldStatusMark fs={fs} canEdit={canEdit} busy={busy} onBestaetigen={onBestaetigen} onVerwerfen={onVerwerfen} /> : null;
  };

  const persoenlich = [
    { label: 'Geburtsdatum', value: p.geburtsdatum, mark: mark('geburtsdatum') },
    { label: 'Geburtsort', value: p.geburtsort },
    { label: 'Geburtsname', value: p.geburtsname },
    { label: 'Familienstand', value: p.familienstand },
    { label: 'Erwerbsstatus', value: p.erwerbsstatus ? ERWERBSSTATUS_LABEL[p.erwerbsstatus] : null },
    { label: 'Staatsangehörigkeit', value: p.staatsangehoerigkeit },
    { label: 'Telefon', value: p.telefon },
    { label: 'E-Mail', value: p.email },
  ].filter((f) => f.value != null && f.value !== '');

  const sonstiges = [
    { label: 'EU/EWR', value: p.eu_ewr == null ? null : (p.eu_ewr ? 'Ja' : 'Nein') },
    { label: 'Erhält Kindergeld', value: p.erhaelt_kindergeld == null ? null : (p.erhaelt_kindergeld ? 'Ja' : 'Nein') },
    { label: 'Werbungskosten', value: p.hat_werbungskosten == null ? null : (p.hat_werbungskosten ? 'Ja' : 'Nein') },
    { label: 'Transferleistungen', value: (p.transferleistungen || []).join(', ') || null },
    { label: 'Bemerkung', value: p.bemerkung },
  ].filter((f) => f.value != null && f.value !== '');

  const pflege = [
    { label: 'Behinderungsgrad (GdB)', value: pb.schwerbehinderungsgrad != null ? String(pb.schwerbehinderungsgrad) : null },
    { label: 'Pflegegrad', value: pb.pflegegrad != null ? String(pb.pflegegrad) : null },
    { label: 'Pflegebedürftig', value: pb.pflegebeduerftig == null ? null : (pb.pflegebeduerftig ? 'Ja' : 'Nein') },
  ].filter((f) => f.value != null);

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
          {persoenlich.length > 0 && (
            <>
              <div style={styles.subTitle}>Persönliches</div>
              <FeldGrid felder={persoenlich} />
            </>
          )}

          {pflege.length > 0 && (
            <>
              <div style={styles.subTitle}>Pflege & Behinderung</div>
              <FeldGrid felder={pflege} />
            </>
          )}

          {sonstiges.length > 0 && (
            <>
              <div style={styles.subTitle}>Sonstiges</div>
              <FeldGrid felder={sonstiges} />
            </>
          )}

          {einkommen.length > 0 && (
            <>
              <div style={styles.subTitle}>Einkommenspositionen</div>
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
                      <td style={styles.td}>{e.bezeichnung || e.art}</td>
                      <td style={styles.td}>{eur(e.betrag_monatlich)}</td>
                      <td style={styles.td}>{eur(e.betrag_jaehrlich)}</td>
                      <td style={styles.td}>{e.beruecksichtigt ? 'ja' : 'nein'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={styles.subTitle}>Vermögen</div>
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

          <div style={styles.subTitle}>Unterhaltsverpflichtungen (§18)</div>
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

          <div style={styles.subTitle}>Unterhaltsansprüche</div>
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

          <div style={styles.subTitle}>Transferleistungen</div>
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
        </div>
      )}
    </div>
  );
}
