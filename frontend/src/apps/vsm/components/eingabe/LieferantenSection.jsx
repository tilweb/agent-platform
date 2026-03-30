import { useState, useEffect } from 'react';
import { formStyles as s } from './formStyles';

const EMPTY_SUPPLIER = {
  lieferant_id: '', lieferant_name: '', material: '', lieferzeit_tage: 0,
  lieferrhythmus: '', mindestbestellmenge: '', zuverlaessigkeit_prozent: 0, letzter_liefertermin: '',
};

export default function LieferantenSection({ data, onSave, saving, saved }) {
  const [items, setItems] = useState(data.lieferanten || []);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_SUPPLIER });

  useEffect(() => { setItems(data.lieferanten || []); }, [data.lieferanten]);

  const set = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }));

  const startAdd = () => {
    setEditIndex(-1);
    setEditForm({ ...EMPTY_SUPPLIER });
  };

  const startEdit = (idx) => {
    setEditIndex(idx);
    setEditForm({ ...items[idx] });
  };

  const cancel = () => {
    setEditIndex(null);
    setEditForm({ ...EMPTY_SUPPLIER });
  };

  const save = () => {
    const newItems = [...items];
    if (editIndex === -1) {
      newItems.push(editForm);
    } else {
      newItems[editIndex] = editForm;
    }
    setItems(newItems);
    setEditIndex(null);
    onSave('lieferanten', newItems);
  };

  const remove = (idx) => {
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
    onSave('lieferanten', newItems);
  };

  return (
    <div>
      <h2 style={s.sectionTitle}>Lieferanten</h2>
      <p style={s.sectionSubtitle}>Material-Lieferanten und ihre Kennzahlen</p>

      {items.map((item, idx) => (
        <div key={idx} style={s.listItem}>
          <div style={s.listItemInfo}>
            <div style={s.listItemTitle}>{item.lieferant_name || 'Unbenannt'} ({item.lieferant_id || '-'})</div>
            <div style={s.listItemMeta}>
              Material: {item.material || '-'} | Lieferzeit: {item.lieferzeit_tage || 0} Tage | Zuverlaessigkeit: {item.zuverlaessigkeit_prozent || 0}%
            </div>
          </div>
          <div style={s.listItemActions}>
            <button style={s.iconButton} onClick={() => startEdit(idx)} title="Bearbeiten">&#9998;</button>
            <button style={{ ...s.iconButton, ...s.deleteButton }} onClick={() => remove(idx)} title="Loeschen">&#10005;</button>
          </div>
        </div>
      ))}

      {editIndex !== null && (
        <div style={s.editFormCard}>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Lieferanten-ID</label>
              <input style={s.input} value={editForm.lieferant_id} onChange={(e) => set('lieferant_id', e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Name</label>
              <input style={s.input} value={editForm.lieferant_name} onChange={(e) => set('lieferant_name', e.target.value)} />
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Material</label>
              <input style={s.input} value={editForm.material} onChange={(e) => set('material', e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Lieferzeit (Tage)</label>
              <input style={s.input} type="number" min="0" value={editForm.lieferzeit_tage} onChange={(e) => set('lieferzeit_tage', parseInt(e.target.value) || 0)} />
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Lieferrhythmus</label>
              <input style={s.input} value={editForm.lieferrhythmus} onChange={(e) => set('lieferrhythmus', e.target.value)} placeholder="z.B. woechentlich" />
            </div>
            <div style={s.field}>
              <label style={s.label}>Mindestbestellmenge</label>
              <input style={s.input} value={editForm.mindestbestellmenge} onChange={(e) => set('mindestbestellmenge', e.target.value)} />
            </div>
          </div>
          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Zuverlaessigkeit (%)</label>
              <input style={s.input} type="number" min="0" max="100" value={editForm.zuverlaessigkeit_prozent} onChange={(e) => set('zuverlaessigkeit_prozent', parseInt(e.target.value) || 0)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Letzter Liefertermin</label>
              <input style={s.input} type="date" value={editForm.letzter_liefertermin} onChange={(e) => set('letzter_liefertermin', e.target.value)} />
            </div>
          </div>
          <div style={s.editFormActions}>
            <button style={s.cancelButton} onClick={cancel}>Abbrechen</button>
            <button style={s.smallSaveButton} onClick={save}>Speichern</button>
          </div>
        </div>
      )}

      {editIndex === null && (
        <button style={s.addButton} onClick={startAdd}>+ Lieferant hinzufuegen</button>
      )}
    </div>
  );
}
