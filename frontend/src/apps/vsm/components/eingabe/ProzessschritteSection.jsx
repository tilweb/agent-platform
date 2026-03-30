import { useState, useEffect } from 'react';
import { theme } from '../../../../config/theme';
import { formStyles as s } from './formStyles';

const EMPTY_PROCESS = {
  schritt_nr: 0, bezeichnung: '', typ: 'Prozess', standort: '',
};

const TYPE_COLORS = {
  Prozess: { bg: theme.colors.primaryLight, color: theme.colors.primary },
  Lager: { bg: theme.colors.warningLight, color: theme.colors.warning },
  Puffer: { bg: theme.colors.surfaceHover, color: theme.colors.textMuted },
};

export default function ProzessschritteSection({ data, onSave, saving, saved }) {
  const [items, setItems] = useState(data.prozessschritte || []);
  const [editIndex, setEditIndex] = useState(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_PROCESS });

  useEffect(() => { setItems(data.prozessschritte || []); }, [data.prozessschritte]);

  const set = (key, value) => setEditForm(prev => ({ ...prev, [key]: value }));

  const startAdd = () => {
    setEditIndex(-1);
    setEditForm({ ...EMPTY_PROCESS, schritt_nr: items.length });
  };

  const startEdit = (idx) => {
    setEditIndex(idx);
    setEditForm({ ...items[idx] });
  };

  const cancel = () => {
    setEditIndex(null);
  };

  const save = () => {
    // Auto-calc netto_arbeitszeit
    if (editForm.typ === 'Prozess' && editForm.arbeitszeit_pro_tag_min && editForm.pausen_min !== undefined) {
      editForm.netto_arbeitszeit_min = editForm.arbeitszeit_pro_tag_min - editForm.pausen_min;
    }
    const newItems = [...items];
    if (editIndex === -1) {
      newItems.push(editForm);
    } else {
      newItems[editIndex] = editForm;
    }
    // Sort by schritt_nr
    newItems.sort((a, b) => a.schritt_nr - b.schritt_nr);
    setItems(newItems);
    setEditIndex(null);
    onSave('prozessschritte', newItems);
  };

  const remove = (idx) => {
    const newItems = items.filter((_, i) => i !== idx);
    setItems(newItems);
    onSave('prozessschritte', newItems);
  };

  return (
    <div>
      <h2 style={s.sectionTitle}>Prozessschritte</h2>
      <p style={s.sectionSubtitle}>Der Wertstrom: Prozesse, Lager und Puffer in Reihenfolge</p>

      {items.map((item, idx) => {
        const typeStyle = TYPE_COLORS[item.typ] || TYPE_COLORS.Prozess;
        return (
          <div key={idx} style={s.listItem}>
            <div style={s.listItemInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <span style={{
                  fontSize: theme.typography.sizes.xs,
                  padding: `2px ${theme.spacing.sm}`,
                  borderRadius: theme.borderRadius.full,
                  backgroundColor: typeStyle.bg,
                  color: typeStyle.color,
                  fontWeight: theme.typography.weights.medium,
                }}>
                  {item.typ}
                </span>
                <span style={s.listItemTitle}>
                  #{item.schritt_nr} {item.bezeichnung || 'Unbenannt'}
                </span>
              </div>
              <div style={s.listItemMeta}>
                {item.typ === 'Prozess' ? (
                  <>Maschine: {item.maschine || '-'} | Zykluszeit: {item.zykluszeit_min || 0} min | Verfuegbarkeit: {item.verfuegbarkeit_prozent || 0}% | Ausschuss: {item.ausschuss_prozent || 0}%{item.engpass ? ' | ENGPASS' : ''}</>
                ) : (
                  <>Bestand: {item.bestand_stueck || 0} Stk. / {item.bestand_tage || 0} Tage | Lagersystem: {item.lagersystem || '-'}</>
                )}
              </div>
            </div>
            <div style={s.listItemActions}>
              <button style={s.iconButton} onClick={() => startEdit(idx)} title="Bearbeiten">&#9998;</button>
              <button style={{ ...s.iconButton, ...s.deleteButton }} onClick={() => remove(idx)} title="Loeschen">&#10005;</button>
            </div>
          </div>
        );
      })}

      {editIndex !== null && (
        <div style={s.editFormCard}>
          <div style={s.row3}>
            <div style={s.field}>
              <label style={s.label}>Schritt Nr.</label>
              <input style={s.input} type="number" min="0" value={editForm.schritt_nr} onChange={(e) => set('schritt_nr', parseInt(e.target.value) || 0)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Bezeichnung</label>
              <input style={s.input} value={editForm.bezeichnung} onChange={(e) => set('bezeichnung', e.target.value)} />
            </div>
            <div style={s.field}>
              <label style={s.label}>Typ</label>
              <select style={s.select} value={editForm.typ} onChange={(e) => set('typ', e.target.value)}>
                <option value="Prozess">Prozess</option>
                <option value="Lager">Lager</option>
                <option value="Puffer">Puffer</option>
              </select>
            </div>
          </div>

          <div style={s.row}>
            <div style={s.field}>
              <label style={s.label}>Standort</label>
              <input style={s.input} value={editForm.standort || ''} onChange={(e) => set('standort', e.target.value)} />
            </div>
            <div style={s.field} />
          </div>

          {editForm.typ === 'Prozess' && (
            <>
              <h4 style={s.subheading}>Maschine & Zeiten</h4>
              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Maschine</label>
                  <input style={s.input} value={editForm.maschine || ''} onChange={(e) => set('maschine', e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Maschinen-ID</label>
                  <input style={s.input} value={editForm.maschinen_id || ''} onChange={(e) => set('maschinen_id', e.target.value)} />
                </div>
              </div>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Zykluszeit (min)</label>
                  <input style={s.input} type="number" min="0" step="0.01" value={editForm.zykluszeit_min || ''} onChange={(e) => set('zykluszeit_min', parseFloat(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Ruestzeit (min)</label>
                  <input style={s.input} type="number" min="0" value={editForm.ruestzeit_min || ''} onChange={(e) => set('ruestzeit_min', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Bearbeitungszeit/Stk (min)</label>
                  <input style={s.input} type="number" min="0" step="0.01" value={editForm.bearbeitungszeit_pro_stueck_min || ''} onChange={(e) => set('bearbeitungszeit_pro_stueck_min', parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <h4 style={s.subheading}>Verfuegbarkeit & Qualitaet</h4>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Verfuegbarkeit (%)</label>
                  <input style={s.input} type="number" min="0" max="100" value={editForm.verfuegbarkeit_prozent || ''} onChange={(e) => set('verfuegbarkeit_prozent', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Ausschuss (%)</label>
                  <input style={s.input} type="number" min="0" max="100" step="0.01" value={editForm.ausschuss_prozent || ''} onChange={(e) => set('ausschuss_prozent', parseFloat(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Ausschussgrund</label>
                  <input style={s.input} value={editForm.ausschussgrund || ''} onChange={(e) => set('ausschussgrund', e.target.value)} />
                </div>
              </div>

              <h4 style={s.subheading}>Arbeitszeit & Kapazitaet</h4>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Schichtmodell</label>
                  <input style={s.input} value={editForm.schichtmodell || ''} onChange={(e) => set('schichtmodell', e.target.value)} placeholder="z.B. 1-Schicht" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Arbeitszeit/Tag (min)</label>
                  <input style={s.input} type="number" min="0" value={editForm.arbeitszeit_pro_tag_min || 480} onChange={(e) => set('arbeitszeit_pro_tag_min', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Pausen (min)</label>
                  <input style={s.input} type="number" min="0" value={editForm.pausen_min || 30} onChange={(e) => set('pausen_min', parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Kapazitaet (Stk/Tag)</label>
                  <input style={s.input} type="number" min="0" value={editForm.kapazitaet_stueck_pro_tag || ''} onChange={(e) => set('kapazitaet_stueck_pro_tag', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Aktuelle Produktion (Stk/Tag)</label>
                  <input style={s.input} type="number" min="0" value={editForm.aktuelle_produktion_stueck_pro_tag || ''} onChange={(e) => set('aktuelle_produktion_stueck_pro_tag', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Auslastung (%)</label>
                  <input style={s.input} type="number" min="0" max="100" value={editForm.auslastung_prozent || ''} onChange={(e) => set('auslastung_prozent', parseInt(e.target.value) || 0)} />
                </div>
              </div>

              <h4 style={s.subheading}>Personal</h4>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Mitarbeiter Anzahl</label>
                  <input style={s.input} type="number" min="0" value={editForm.mitarbeiter_anzahl || ''} onChange={(e) => set('mitarbeiter_anzahl', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Qualifikation</label>
                  <input style={s.input} value={editForm.mitarbeiter_qualifikation || ''} onChange={(e) => set('mitarbeiter_qualifikation', e.target.value)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Erfahrung (Jahre)</label>
                  <input style={s.input} type="number" min="0" value={editForm.mitarbeiter_erfahrung_jahre || ''} onChange={(e) => set('mitarbeiter_erfahrung_jahre', parseInt(e.target.value) || 0)} />
                </div>
              </div>

              <div style={{ ...s.row, marginTop: theme.spacing.md }}>
                <div style={s.field}>
                  <label style={s.checkbox}>
                    <input type="checkbox" checked={editForm.engpass || false} onChange={(e) => set('engpass', e.target.checked)} />
                    <span style={s.label}>Als Engpass markieren</span>
                  </label>
                </div>
                <div style={s.field}>
                  <label style={s.label}>Baujahr</label>
                  <input style={s.input} type="number" min="1900" max="2100" value={editForm.baujahr || ''} onChange={(e) => set('baujahr', parseInt(e.target.value) || 2020)} />
                </div>
              </div>
            </>
          )}

          {(editForm.typ === 'Lager' || editForm.typ === 'Puffer') && (
            <>
              <h4 style={s.subheading}>{editForm.typ}-Details</h4>
              <div style={s.row3}>
                <div style={s.field}>
                  <label style={s.label}>Bestand (Tage)</label>
                  <input style={s.input} type="number" min="0" value={editForm.bestand_tage || ''} onChange={(e) => set('bestand_tage', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Bestand (Stueck)</label>
                  <input style={s.input} type="number" min="0" value={editForm.bestand_stueck || ''} onChange={(e) => set('bestand_stueck', parseInt(e.target.value) || 0)} />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Flaeche (qm)</label>
                  <input style={s.input} type="number" min="0" value={editForm.flaeche_qm || ''} onChange={(e) => set('flaeche_qm', parseInt(e.target.value) || 0)} />
                </div>
              </div>
              <div style={s.row}>
                <div style={s.field}>
                  <label style={s.label}>Lagersystem</label>
                  <input style={s.input} value={editForm.lagersystem || ''} onChange={(e) => set('lagersystem', e.target.value)} placeholder="z.B. Regallager, Bodenlager" />
                </div>
                <div style={s.field}>
                  <label style={s.label}>Mitarbeiter Anzahl</label>
                  <input style={s.input} type="number" min="0" step="0.1" value={editForm.mitarbeiter_anzahl || ''} onChange={(e) => set('mitarbeiter_anzahl', parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              {editForm.typ === 'Puffer' && (
                <>
                  <div style={s.row}>
                    <div style={s.field}>
                      <label style={s.label}>Bestandsschwankung (Stk)</label>
                      <input style={s.input} type="number" min="0" value={editForm.bestand_schwankung_stueck || ''} onChange={(e) => set('bestand_schwankung_stueck', parseInt(e.target.value) || 0)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Wartegrund</label>
                      <input style={s.input} value={editForm.wartegrund || ''} onChange={(e) => set('wartegrund', e.target.value)} />
                    </div>
                  </div>
                  <div style={s.row3}>
                    <div style={s.field}>
                      <label style={s.label}>Transportart</label>
                      <input style={s.input} value={editForm.transportart || ''} onChange={(e) => set('transportart', e.target.value)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Transportdistanz (m)</label>
                      <input style={s.input} type="number" min="0" value={editForm.transportdistanz_meter || ''} onChange={(e) => set('transportdistanz_meter', parseInt(e.target.value) || 0)} />
                    </div>
                    <div style={s.field}>
                      <label style={s.label}>Transportzeit (min)</label>
                      <input style={s.input} type="number" min="0" value={editForm.transportzeit_min || ''} onChange={(e) => set('transportzeit_min', parseInt(e.target.value) || 0)} />
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          <div style={s.editFormActions}>
            <button style={s.cancelButton} onClick={cancel}>Abbrechen</button>
            <button style={s.smallSaveButton} onClick={save}>Speichern</button>
          </div>
        </div>
      )}

      {editIndex === null && (
        <button style={s.addButton} onClick={startAdd}>+ Prozessschritt hinzufuegen</button>
      )}
    </div>
  );
}
