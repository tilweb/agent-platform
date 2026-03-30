import { useState, useEffect, useMemo } from 'react';
import { formStyles as s } from './formStyles';

export default function KundeSection({ data, onSave, saving, saved }) {
  const [form, setForm] = useState(data.kunde || {});

  useEffect(() => { setForm(data.kunde || {}); }, [data.kunde]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const tagesbedarf = useMemo(() => {
    if (form.monatsbedarf_stueck && form.arbeitstage_pro_monat) {
      return Math.round(form.monatsbedarf_stueck / form.arbeitstage_pro_monat);
    }
    return 0;
  }, [form.monatsbedarf_stueck, form.arbeitstage_pro_monat]);

  return (
    <div>
      <h2 style={s.sectionTitle}>Kundendaten</h2>
      <p style={s.sectionSubtitle}>Kundentakt und Nachfrage bestimmen den Rhythmus des Wertstroms</p>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Kundenname</label>
          <input style={s.input} value={form.kundenname || ''} onChange={(e) => set('kundenname', e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Kundennummer</label>
          <input style={s.input} value={form.kundennummer || ''} onChange={(e) => set('kundennummer', e.target.value)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Monatsbedarf (Stueck)</label>
          <input style={s.input} type="number" min="0" value={form.monatsbedarf_stueck || ''} onChange={(e) => set('monatsbedarf_stueck', parseInt(e.target.value) || 0)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Arbeitstage pro Monat</label>
          <input style={s.input} type="number" min="1" value={form.arbeitstage_pro_monat || 20} onChange={(e) => set('arbeitstage_pro_monat', parseInt(e.target.value) || 20)} />
        </div>
      </div>

      {tagesbedarf > 0 && (
        <div style={s.infoBox}>
          Berechneter Tagesbedarf: {tagesbedarf} Stueck/Tag (Kundentakt: {((form.arbeitstage_pro_monat || 20) * 480 / (form.monatsbedarf_stueck || 1)).toFixed(1)} min/Stueck)
        </div>
      )}

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Lieferrhythmus</label>
          <input style={s.input} value={form.lieferrhythmus || ''} onChange={(e) => set('lieferrhythmus', e.target.value)} placeholder="z.B. taeglich, woechentlich" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Lieferrhythmus (Tage)</label>
          <input style={s.input} type="number" min="0" value={form.lieferrhythmus_tage || ''} onChange={(e) => set('lieferrhythmus_tage', parseInt(e.target.value) || 0)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Bestellmenge (Stueck)</label>
          <input style={s.input} type="number" min="0" value={form.bestellmenge_stueck || ''} onChange={(e) => set('bestellmenge_stueck', parseInt(e.target.value) || 0)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Lieferzeit Forderung (Tage)</label>
          <input style={s.input} type="number" min="0" value={form.lieferzeit_forderung_tage || ''} onChange={(e) => set('lieferzeit_forderung_tage', parseInt(e.target.value) || 0)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Lieferzeit aktuell (Tage)</label>
          <input style={s.input} type="number" min="0" value={form.lieferzeit_aktuell_tage || ''} onChange={(e) => set('lieferzeit_aktuell_tage', parseInt(e.target.value) || 0)} />
        </div>
        <div style={s.field} />
      </div>

      <div style={s.saveBar}>
        {saved && <span style={s.savedMessage}>Gespeichert</span>}
        <button style={{ ...s.saveButton, opacity: saving ? 0.6 : 1 }} onClick={() => onSave('kunde', { ...form, tagesbedarf_stueck: tagesbedarf })} disabled={saving}>
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
