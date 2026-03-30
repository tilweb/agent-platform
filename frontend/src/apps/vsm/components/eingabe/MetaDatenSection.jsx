import { useState, useEffect } from 'react';
import { formStyles as s } from './formStyles';

export default function MetaDatenSection({ data, onSave, saving, saved }) {
  const [form, setForm] = useState(data.meta_daten || {});

  useEffect(() => { setForm(data.meta_daten || {}); }, [data.meta_daten]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <h2 style={s.sectionTitle}>Projekt Meta-Daten</h2>
      <p style={s.sectionSubtitle}>Allgemeine Informationen zum VSM-Projekt</p>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Projekt-ID</label>
          <input style={s.input} value={form.projekt_id || ''} onChange={(e) => set('projekt_id', e.target.value)} placeholder="z.B. VSM-2026-001" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Unternehmen</label>
          <input style={s.input} value={form.unternehmen || ''} onChange={(e) => set('unternehmen', e.target.value)} placeholder="Firmenname" />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Standort</label>
          <input style={s.input} value={form.standort || ''} onChange={(e) => set('standort', e.target.value)} placeholder="Werk / Standort" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Produktfamilie</label>
          <input style={s.input} value={form.produktfamilie || ''} onChange={(e) => set('produktfamilie', e.target.value)} placeholder="z.B. Getriebe, Elektronik" />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Produkt</label>
          <input style={s.input} value={form.produkt || ''} onChange={(e) => set('produkt', e.target.value)} placeholder="Konkretes Produkt" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Erfasst von</label>
          <input style={s.input} value={form.erfasst_von || ''} onChange={(e) => set('erfasst_von', e.target.value)} placeholder="Name des Erfassers" />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Erfassungsmethode</label>
          <input style={s.input} value={form.erfassungsmethode || ''} onChange={(e) => set('erfassungsmethode', e.target.value)} placeholder="z.B. Gemba Walk, Interview" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Erfassungsdauer (Tage)</label>
          <input style={s.input} type="number" min="0" value={form.erfassungsdauer_tage || ''} onChange={(e) => set('erfassungsdauer_tage', parseInt(e.target.value) || 0)} />
        </div>
      </div>

      <div style={s.saveBar}>
        {saved && <span style={s.savedMessage}>Gespeichert</span>}
        <button
          style={{ ...s.saveButton, opacity: saving ? 0.6 : 1 }}
          onClick={() => onSave('meta_daten', { ...form, erfassungsdatum: new Date().toISOString().split('T')[0] })}
          disabled={saving}
        >
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
