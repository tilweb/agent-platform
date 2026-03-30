import { useState, useEffect } from 'react';
import { formStyles as s } from './formStyles';

export default function PersonalSection({ data, onSave, saving, saved }) {
  const [form, setForm] = useState(data.personal || {});

  useEffect(() => { setForm(data.personal || {}); }, [data.personal]);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  return (
    <div>
      <h2 style={s.sectionTitle}>Personal & Betriebsmittel</h2>
      <p style={s.sectionSubtitle}>Schichtmodell, Arbeitszeiten und Personalstruktur</p>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Schichtmodell</label>
          <input style={s.input} value={form.schichtmodell_aktuell || ''} onChange={(e) => set('schichtmodell_aktuell', e.target.value)} placeholder="z.B. 1-Schicht, 2-Schicht, 3-Schicht" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Arbeitszeit pro Schicht (Std)</label>
          <input style={s.input} type="number" min="0" value={form.arbeitszeit_schicht_std || 8} onChange={(e) => set('arbeitszeit_schicht_std', parseInt(e.target.value) || 8)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Pausenzeit pro Schicht (Min)</label>
          <input style={s.input} type="number" min="0" value={form.pausenzeit_schicht_min || 30} onChange={(e) => set('pausenzeit_schicht_min', parseInt(e.target.value) || 30)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Arbeitstage pro Woche</label>
          <input style={s.input} type="number" min="0" value={form.arbeitstage_pro_woche || 5} onChange={(e) => set('arbeitstage_pro_woche', parseInt(e.target.value) || 5)} />
        </div>
      </div>

      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Betriebsferien (Wochen/Jahr)</label>
          <input style={s.input} type="number" min="0" value={form.betriebsferien_wochen_pro_jahr || 2} onChange={(e) => set('betriebsferien_wochen_pro_jahr', parseInt(e.target.value) || 2)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Krankenquote (%)</label>
          <input style={s.input} type="number" min="0" max="100" step="0.1" value={form.krankenquote_prozent || ''} onChange={(e) => set('krankenquote_prozent', parseFloat(e.target.value) || 0)} />
        </div>
      </div>

      <div style={s.saveBar}>
        {saved && <span style={s.savedMessage}>Gespeichert</span>}
        <button style={{ ...s.saveButton, opacity: saving ? 0.6 : 1 }} onClick={() => onSave('personal', form)} disabled={saving}>
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
