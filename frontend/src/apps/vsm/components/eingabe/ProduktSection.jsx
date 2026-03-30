import { useState, useEffect } from 'react';
import { formStyles as s } from './formStyles';

export default function ProduktSection({ data, onSave, saving, saved }) {
  const [form, setForm] = useState(data.produkt_info || {});

  useEffect(() => { setForm(data.produkt_info || {}); }, [data.produkt_info]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <h2 style={s.sectionTitle}>Produktinformationen</h2>
      <p style={s.sectionSubtitle}>Details zum analysierten Produkt</p>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Artikelnummer</label>
          <input style={s.input} value={form.artikelnummer || ''} onChange={(e) => set('artikelnummer', e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Bezeichnung</label>
          <input style={s.input} value={form.bezeichnung || ''} onChange={(e) => set('bezeichnung', e.target.value)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Aktuelle Losgroesse</label>
          <input style={s.input} type="number" min="0" value={form.losgrösse_aktuell || ''} onChange={(e) => set('losgrösse_aktuell', parseInt(e.target.value) || 0)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Gewicht (kg)</label>
          <input style={s.input} type="number" min="0" step="0.01" value={form.gewicht_kg || ''} onChange={(e) => set('gewicht_kg', parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Materialkosten (EUR)</label>
          <input style={s.input} type="number" min="0" step="0.01" value={form.materialkosten_euro || ''} onChange={(e) => set('materialkosten_euro', parseFloat(e.target.value) || 0)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Verkaufspreis (EUR)</label>
          <input style={s.input} type="number" min="0" step="0.01" value={form.verkaufspreis_euro || ''} onChange={(e) => set('verkaufspreis_euro', parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Anzahl Komponenten</label>
          <input style={s.input} type="number" min="0" value={form.anzahl_komponenten || ''} onChange={(e) => set('anzahl_komponenten', parseInt(e.target.value) || 0)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Zeichnungsnummer</label>
          <input style={s.input} value={form.zeichnungsnummer || ''} onChange={(e) => set('zeichnungsnummer', e.target.value)} />
        </div>
      </div>

      <div style={s.saveBar}>
        {saved && <span style={s.savedMessage}>Gespeichert</span>}
        <button style={{ ...s.saveButton, opacity: saving ? 0.6 : 1 }} onClick={() => onSave('produkt_info', form)} disabled={saving}>
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
