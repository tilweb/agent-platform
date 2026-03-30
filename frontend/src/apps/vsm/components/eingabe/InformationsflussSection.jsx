import { useState, useEffect } from 'react';
import { formStyles as s } from './formStyles';

export default function InformationsflussSection({ data, onSave, saving, saved }) {
  const [form, setForm] = useState(data.informationsfluss || {});

  useEffect(() => { setForm(data.informationsfluss || {}); }, [data.informationsfluss]);

  const setNested = (group, key, value) => {
    setForm(prev => ({
      ...prev,
      [group]: { ...(prev[group] || {}), [key]: value },
    }));
  };

  const ae = form.auftragseingang || {};
  const pp = form.produktionsplanung || {};
  const fs = form.fertigungssteuerung || {};

  return (
    <div>
      <h2 style={s.sectionTitle}>Informationsfluss</h2>
      <p style={s.sectionSubtitle}>Wie fliessen Informationen durch das Produktionssystem?</p>

      <h4 style={s.subheading}>Auftragseingang</h4>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Quelle</label>
          <input style={s.input} value={ae.quelle || ''} onChange={(e) => setNested('auftragseingang', 'quelle', e.target.value)} placeholder="z.B. ERP, Fax, E-Mail" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Frequenz</label>
          <input style={s.input} value={ae.frequenz || ''} onChange={(e) => setNested('auftragseingang', 'frequenz', e.target.value)} placeholder="z.B. taeglich, woechentlich" />
        </div>
      </div>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Vorlaufzeit (Tage)</label>
          <input style={s.input} type="number" min="0" value={ae.vorlaufzeit_tage || ''} onChange={(e) => setNested('auftragseingang', 'vorlaufzeit_tage', parseInt(e.target.value) || 0)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Medium</label>
          <input style={s.input} value={ae.medium || ''} onChange={(e) => setNested('auftragseingang', 'medium', e.target.value)} placeholder="z.B. EDI, Papier" />
        </div>
      </div>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Bearbeitungszeit (Std)</label>
          <input style={s.input} type="number" min="0" value={ae.bearbeitungszeit_std || ''} onChange={(e) => setNested('auftragseingang', 'bearbeitungszeit_std', parseInt(e.target.value) || 0)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Verantwortlich</label>
          <input style={s.input} value={ae.verantwortlich || ''} onChange={(e) => setNested('auftragseingang', 'verantwortlich', e.target.value)} />
        </div>
      </div>

      <h4 style={s.subheading}>Produktionsplanung</h4>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>System</label>
          <input style={s.input} value={pp.system || ''} onChange={(e) => setNested('produktionsplanung', 'system', e.target.value)} placeholder="z.B. SAP PP, Excel" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Planungshorizont (Wochen)</label>
          <input style={s.input} type="number" min="0" value={pp.planungshorizont_wochen || ''} onChange={(e) => setNested('produktionsplanung', 'planungshorizont_wochen', parseInt(e.target.value) || 0)} />
        </div>
      </div>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Planungsrhythmus</label>
          <input style={s.input} value={pp.planungsrhythmus || ''} onChange={(e) => setNested('produktionsplanung', 'planungsrhythmus', e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Planungsdauer (Std)</label>
          <input style={s.input} type="number" min="0" value={pp.planungsdauer_std || ''} onChange={(e) => setNested('produktionsplanung', 'planungsdauer_std', parseInt(e.target.value) || 0)} />
        </div>
      </div>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Verantwortlich</label>
          <input style={s.input} value={pp.verantwortlich || ''} onChange={(e) => setNested('produktionsplanung', 'verantwortlich', e.target.value)} />
        </div>
        <div style={s.field}>
          <label style={s.label}>Automatisierungsgrad (%)</label>
          <input style={s.input} type="number" min="0" max="100" value={pp.automatisierungsgrad_prozent || ''} onChange={(e) => setNested('produktionsplanung', 'automatisierungsgrad_prozent', parseInt(e.target.value) || 0)} />
        </div>
      </div>

      <h4 style={s.subheading}>Fertigungssteuerung</h4>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Methode</label>
          <input style={s.input} value={fs.methode || ''} onChange={(e) => setNested('fertigungssteuerung', 'methode', e.target.value)} placeholder="z.B. Push, Pull, Kanban" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Steuerungsmittel</label>
          <input style={s.input} value={fs.steuerungsmittel || ''} onChange={(e) => setNested('fertigungssteuerung', 'steuerungsmittel', e.target.value)} placeholder="z.B. Fertigungsauftrag, Kanban-Karte" />
        </div>
      </div>
      <div style={s.row}>
        <div style={s.field}>
          <label style={s.label}>Weitergabe</label>
          <input style={s.input} value={fs.weitergabe || ''} onChange={(e) => setNested('fertigungssteuerung', 'weitergabe', e.target.value)} placeholder="z.B. Papier, Terminal, muendlich" />
        </div>
        <div style={s.field}>
          <label style={s.label}>Transparenz</label>
          <input style={s.input} value={fs.transparenz || ''} onChange={(e) => setNested('fertigungssteuerung', 'transparenz', e.target.value)} placeholder="z.B. hoch, mittel, niedrig" />
        </div>
      </div>

      <div style={s.saveBar}>
        {saved && <span style={s.savedMessage}>Gespeichert</span>}
        <button style={{ ...s.saveButton, opacity: saving ? 0.6 : 1 }} onClick={() => onSave('informationsfluss', form)} disabled={saving}>
          {saving ? 'Speichern...' : 'Speichern'}
        </button>
      </div>
    </div>
  );
}
