import { useState } from 'react';
import { theme } from '../../../../config/theme';
import DokumentUpload from './DokumentUpload';
import ContractPicker, { LinkedContract } from './ContractPicker';

const styles = {
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  },
  section: {
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceHover,
    borderRadius: theme.borderRadius.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  row: {
    display: 'flex',
    gap: theme.spacing.lg,
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    minWidth: 140,
  },
  input: {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
  },
  select: {
    padding: theme.spacing.sm,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    cursor: 'pointer',
  },
  toggleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing.sm,
    cursor: 'pointer',
  },
  toggleLabel: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  actions: {
    display: 'flex',
    gap: theme.spacing.md,
    justifyContent: 'flex-end',
  },
  btnPrimary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
  btnSecondary: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: 'transparent',
    color: theme.colors.text,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
  },
};

function ToggleSwitch({ checked, onChange }) {
  return (
    <span onClick={() => onChange(!checked)} style={{ cursor: 'pointer', display: 'inline-flex' }}>
      {checked ? (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.colors.success} strokeWidth="2">
          <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
          <circle cx="16" cy="12" r="3" fill={theme.colors.success} />
        </svg>
      ) : (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={theme.colors.textMuted} strokeWidth="2">
          <rect x="1" y="5" width="22" height="14" rx="7" ry="7" />
          <circle cx="8" cy="12" r="3" />
        </svg>
      )}
    </span>
  );
}

// Migrate legacy boolean dora_konform to new string values
function normalizeDora(value) {
  if (value === true || value === 'ja') return 'ja';
  if (value === false || value === 'nein') return 'nein';
  if (value === 'nicht_anwendbar') return 'nicht_anwendbar';
  return 'nicht_anwendbar';
}

const DOC_TYP_MAP = {
  avv: 'avv_dokument',
  nda: 'nda_dokument',
  rahmenvertrag: 'rahmenvertrag_dokument',
};

const CONTRACT_TYPE_MAP = {
  nda: 'nda',
  rahmenvertrag: 'dienstleistung',
};

export default function RegulatorikForm({ regulatorik, onSave, onCancel, supplierId, onUploadDokument }) {
  const [values, setValues] = useState({
    personenbezogene_daten: regulatorik?.personenbezogene_daten || false,
    datenschutz_rolle: regulatorik?.datenschutz_rolle || '',
    avv: {
      vorhanden: regulatorik?.avv?.vorhanden || false,
      abgeschlossen_am: regulatorik?.avv?.abgeschlossen_am || '',
      gueltig_bis: regulatorik?.avv?.gueltig_bis || '',
      contract_id: regulatorik?.avv?.contract_id || '',
    },
    nda: {
      vorhanden: regulatorik?.nda?.vorhanden || false,
      abgeschlossen_am: regulatorik?.nda?.abgeschlossen_am || '',
      gueltig_bis: regulatorik?.nda?.gueltig_bis || '',
      contract_id: regulatorik?.nda?.contract_id || '',
    },
    rahmenvertrag: {
      vorhanden: regulatorik?.rahmenvertrag?.vorhanden || false,
      abgeschlossen_am: regulatorik?.rahmenvertrag?.abgeschlossen_am || '',
      gueltig_bis: regulatorik?.rahmenvertrag?.gueltig_bis || '',
      dora_konform: normalizeDora(regulatorik?.rahmenvertrag?.dora_konform),
      contract_id: regulatorik?.rahmenvertrag?.contract_id || '',
    },
  });

  const [pickerDocKey, setPickerDocKey] = useState(null);

  const updateDoc = (doc, field, value) => {
    setValues({
      ...values,
      [doc]: { ...values[doc], [field]: value },
    });
  };

  const handleContractSelect = (contract) => {
    if (pickerDocKey) {
      updateDoc(pickerDocKey, 'contract_id', contract.id);
    }
    setPickerDocKey(null);
  };

  const renderDocSection = (key, title) => {
    const hasContractPicker = key === 'nda' || key === 'rahmenvertrag';
    const linkedContractId = values[key]?.contract_id;

    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>{title}</div>
        <div style={styles.row}>
          <div style={styles.toggleRow} onClick={() => updateDoc(key, 'vorhanden', !values[key].vorhanden)}>
            <ToggleSwitch checked={values[key].vorhanden} onChange={(v) => updateDoc(key, 'vorhanden', v)} />
            <span style={styles.toggleLabel}>Vorhanden</span>
          </div>
        </div>
        {values[key].vorhanden && (
          <>
            <div style={styles.row}>
              <span style={styles.label}>Abgeschlossen am</span>
              <input
                type="date"
                style={styles.input}
                value={values[key].abgeschlossen_am}
                onChange={(e) => updateDoc(key, 'abgeschlossen_am', e.target.value)}
              />
            </div>
            <div style={styles.row}>
              <span style={styles.label}>Gueltig bis</span>
              <input
                type="date"
                style={styles.input}
                value={values[key].gueltig_bis}
                onChange={(e) => updateDoc(key, 'gueltig_bis', e.target.value)}
              />
            </div>
            {key === 'rahmenvertrag' && (
              <div style={styles.row}>
                <span style={styles.label}>DORA-konform</span>
                <select
                  style={styles.select}
                  value={values.rahmenvertrag.dora_konform}
                  onChange={(e) => updateDoc('rahmenvertrag', 'dora_konform', e.target.value)}
                >
                  <option value="ja">Ja</option>
                  <option value="nein">Nein</option>
                  <option value="nicht_anwendbar">Nicht anwendbar</option>
                </select>
              </div>
            )}
            {hasContractPicker && linkedContractId && (
              <div style={styles.row}>
                <span style={styles.label}>Vertrag</span>
                <LinkedContract
                  contractId={linkedContractId}
                  onRemove={() => updateDoc(key, 'contract_id', '')}
                />
              </div>
            )}
            {supplierId && onUploadDokument && (
              <div style={styles.row}>
                <span style={styles.label}>Dokumente</span>
                <DokumentUpload
                  supplierId={supplierId}
                  dokumentTyp={DOC_TYP_MAP[key]}
                  onUpload={onUploadDokument}
                  onLinkContract={hasContractPicker && !linkedContractId ? () => setPickerDocKey(key) : undefined}
                />
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <div style={styles.form}>
      <div style={styles.section}>
        <div style={styles.toggleRow} onClick={() => setValues({ ...values, personenbezogene_daten: !values.personenbezogene_daten, datenschutz_rolle: !values.personenbezogene_daten ? values.datenschutz_rolle : '' })}>
          <ToggleSwitch checked={values.personenbezogene_daten} onChange={(v) => setValues({ ...values, personenbezogene_daten: v, datenschutz_rolle: v ? values.datenschutz_rolle : '' })} />
          <span style={{ ...styles.toggleLabel, fontWeight: theme.typography.weights.medium }}>
            Personenbezogene Daten werden verarbeitet
          </span>
        </div>
        {values.personenbezogene_daten && (
          <div style={{ ...styles.row, marginTop: theme.spacing.md }}>
            <span style={styles.label}>Datenschutz-Rolle</span>
            <select
              style={styles.select}
              value={values.datenschutz_rolle}
              onChange={(e) => setValues({ ...values, datenschutz_rolle: e.target.value })}
            >
              <option value="">-- Waehlen --</option>
              <option value="verantwortlicher">Verantwortlicher</option>
              <option value="auftragsverarbeiter">Auftragsverarbeiter</option>
              <option value="gemeinsame_verantwortung">Gemeinsame Verantwortung</option>
            </select>
          </div>
        )}
      </div>

      {renderDocSection('avv', 'Auftragsverarbeitungsvertrag (AVV)')}
      {renderDocSection('nda', 'Geheimhaltungsvereinbarung (NDA)')}
      {renderDocSection('rahmenvertrag', 'Rahmenvertrag')}

      <div style={styles.actions}>
        {onCancel && <button style={styles.btnSecondary} onClick={onCancel}>Abbrechen</button>}
        <button style={styles.btnPrimary} onClick={() => onSave(values)}>Speichern</button>
      </div>

      {pickerDocKey && (
        <ContractPicker
          contractType={CONTRACT_TYPE_MAP[pickerDocKey]}
          onSelect={handleContractSelect}
          onClose={() => setPickerDocKey(null)}
        />
      )}
    </div>
  );
}
