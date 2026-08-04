/**
 * IdeeBasis — Tab 1 des Projektidee-Wizards.
 * Visuelles Pattern 1:1 wie components/steps/Basis.jsx.
 */

import { useCallback, useEffect, useState } from 'react';
import { theme } from '../../../../config/theme';
import { useProjektmanagement } from '../../../../hooks/useProjektmanagement';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.xl,
  },
  header: {
    marginBottom: theme.spacing.lg,
  },
  title: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.sm,
  },
  formRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: theme.spacing.lg,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    color: theme.colors.text,
  },
  required: {
    color: theme.colors.error,
    marginLeft: '2px',
  },
  input: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    transition: `border-color ${theme.transitions.fast}`,
  },
  textarea: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    outline: 'none',
    minHeight: '100px',
    resize: 'vertical',
    fontFamily: theme.typography.fontFamily,
  },
  select: {
    padding: theme.spacing.md,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    cursor: 'pointer',
  },
  hint: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  emptyBox: {
    padding: theme.spacing.md,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    fontStyle: 'italic',
    border: `1px dashed ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.background,
  },
  linkedList: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm },
  linkedRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: `${theme.spacing.sm} ${theme.spacing.md}`,
    border: `1px solid ${theme.colors.border}`,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.surface,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
  },
  unlinkBtn: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`,
    backgroundColor: 'transparent',
    color: theme.colors.error,
    border: `1px solid ${theme.colors.error}30`,
    borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs,
    cursor: 'pointer',
  },
  linkControls: { display: 'flex', gap: theme.spacing.md, alignItems: 'center', marginTop: theme.spacing.sm },
  linkBtn: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`,
    backgroundColor: theme.colors.primary,
    color: '#fff',
    border: 'none',
    borderRadius: theme.borderRadius.lg,
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  linkError: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.error,
    marginBottom: theme.spacing.sm,
  },
};

export default function IdeeBasis({ projektidee, onChange, config }) {
  const update = (field, value) => onChange({ ...projektidee, [field]: value });
  // Auswahloptionen aus der App-Config (einheitlich mit dem Projektauftrag).
  const opts = (key) => config?.[key] || [];

  // Abgeleitete Projektaufträge: manuell verknüpfen/lösen (setzt Auftrag.idee_id).
  const { getAvailableAuftraegeForIdee, linkAuftragToIdee, unlinkAuftragFromIdee } = useProjektmanagement();
  const [linked, setLinked] = useState(projektidee.abgeleitete_auftraege ?? []);
  const [available, setAvailable] = useState([]);
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const [linkError, setLinkError] = useState(null);

  const reloadAvailable = useCallback(async () => {
    if (!projektidee.id) return;
    try { setAvailable(await getAvailableAuftraegeForIdee(projektidee.id)); }
    catch { setAvailable([]); }
  }, [projektidee.id, getAvailableAuftraegeForIdee]);
  useEffect(() => { reloadAvailable(); }, [reloadAvailable]);

  const doLink = async () => {
    if (!selected) return;
    setBusy(true); setLinkError(null);
    try {
      await linkAuftragToIdee(projektidee.id, selected);
      const a = available.find((x) => x.id === selected);
      if (a) setLinked((prev) => [...prev, { id: a.id, name: a.name, status: a.status, created_at: '' }]);
      setAvailable((prev) => prev.filter((x) => x.id !== selected));
      setSelected('');
    } catch (e) { setLinkError(e.message); }
    finally { setBusy(false); }
  };

  const doUnlink = async (auftragId) => {
    setBusy(true); setLinkError(null);
    try {
      await unlinkAuftragFromIdee(projektidee.id, auftragId);
      const a = linked.find((x) => x.id === auftragId);
      setLinked((prev) => prev.filter((x) => x.id !== auftragId));
      if (a) setAvailable((prev) => [...prev, { id: a.id, name: a.name, status: a.status }]);
    } catch (e) { setLinkError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Basisdaten</h2>
        <p style={styles.subtitle}>
          Erfassen Sie die grundlegenden Informationen zur Projektidee.
        </p>
      </div>

      {/* Projekt-ID und Projektname */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekt-ID</label>
          <input
            type="text"
            value={projektidee.projekt_id || ''}
            onChange={(e) => update('projekt_id', e.target.value)}
            placeholder="z.B. PRJ-2026-001"
            style={styles.input}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>
            Projektname<span style={styles.required}>*</span>
          </label>
          <input
            type="text"
            value={projektidee.name || ''}
            onChange={(e) => update('name', e.target.value)}
            placeholder="z.B. KI-gestuetzte Bewerbungs-Triage"
            style={styles.input}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        </div>
      </div>

      {/* Projekttyp und Projektidee-Status */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekttyp</label>
          <select
            value={projektidee.project_type || ''}
            onChange={(e) => update('project_type', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte wählen —</option>
            {opts('project_type').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektidee-Status</label>
          <select
            value={projektidee.status || 'draft'}
            onChange={(e) => update('status', e.target.value)}
            style={styles.select}
          >
            {opts('idee_status').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Projektstatus und Projekttreiber */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektstatus</label>
          <select
            value={projektidee.project_status || ''}
            onChange={(e) => update('project_status', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte wählen —</option>
            {opts('project_status').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projekttreiber</label>
          <select
            value={projektidee.projekttreiber || ''}
            onChange={(e) => update('projekttreiber', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte wählen —</option>
            {opts('project_driver').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Projektgröße und Priorität */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektgröße</label>
          <select
            value={projektidee.projektgroesse || ''}
            onChange={(e) => update('projektgroesse', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte wählen —</option>
            {opts('project_size').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Priorität</label>
          <select
            value={projektidee.prioritaet || ''}
            onChange={(e) => update('prioritaet', e.target.value)}
            style={styles.select}
          >
            <option value="">— Bitte wählen —</option>
            {opts('priority').map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kurzbeschreibung */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Kurzbeschreibung</label>
        <textarea
          value={projektidee.description || ''}
          onChange={(e) => update('description', e.target.value)}
          placeholder="Beschreiben Sie die Projektidee in wenigen Sätzen..."
          style={styles.textarea}
          onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
          onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
        />
      </div>

      {/* Zeitraum */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Startdatum (geplant)</label>
          <input
            type="date"
            value={projektidee.start_date || ''}
            onChange={(e) => update('start_date', e.target.value)}
            style={styles.input}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Enddatum (geplant)</label>
          <input
            type="date"
            value={projektidee.end_date || ''}
            onChange={(e) => update('end_date', e.target.value)}
            style={styles.input}
          />
          <p style={styles.hint}>Optional in der Ideen-Phase.</p>
        </div>
      </div>

      {/* Verantwortliche */}
      <div style={styles.formRow}>
        <div style={styles.formGroup}>
          <label style={styles.label}>Projektleiter (vorgesehen)</label>
          <input
            type="text"
            value={projektidee.projektleiter || ''}
            onChange={(e) => update('projektleiter', e.target.value)}
            placeholder="Name"
            style={styles.input}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        </div>
        <div style={styles.formGroup}>
          <label style={styles.label}>Auftraggeber (vorgesehen)</label>
          <input
            type="text"
            value={projektidee.auftraggeber || ''}
            onChange={(e) => update('auftraggeber', e.target.value)}
            placeholder="Name oder Bereich"
            style={styles.input}
            onFocus={(e) => { e.target.style.borderColor = theme.colors.primary; }}
            onBlur={(e) => { e.target.style.borderColor = theme.colors.border; }}
          />
        </div>
      </div>

      {/* Abgeleitete Projektaufträge — manuelle Verknüpfung */}
      <div style={styles.formGroup}>
        <label style={styles.label}>Abgeleitete Projektaufträge</label>
        <p style={styles.hint}>
          Vorhandene Projektaufträge dieser Idee zuordnen. Nicht jeder muss automatisch über „Auftrag aus Idee
          erstellen" entstehen — auch manuell erfasste Aufträge lassen sich hier verknüpfen.
        </p>
        {linkError && <div style={styles.linkError}>{linkError}</div>}
        {linked.length === 0 ? (
          <div style={styles.emptyBox}>Noch keine Projektaufträge verknüpft.</div>
        ) : (
          <div style={styles.linkedList}>
            {linked.map((a) => (
              <div key={a.id} style={styles.linkedRow}>
                <span>{a.name}</span>
                <button type="button" style={styles.unlinkBtn} onClick={() => doUnlink(a.id)} disabled={busy}>
                  Lösen
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={styles.linkControls}>
          <select
            style={{ ...styles.select, flex: 1 }}
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="">
              {available.length === 0 ? '— Keine freien Projektaufträge —' : '— Vorhandenen Auftrag wählen —'}
            </option>
            {available.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
          <button
            type="button"
            style={{ ...styles.linkBtn, opacity: (!selected || busy) ? 0.5 : 1 }}
            onClick={doLink}
            disabled={!selected || busy}
          >
            Verknüpfen
          </button>
        </div>
      </div>
    </div>
  );
}
