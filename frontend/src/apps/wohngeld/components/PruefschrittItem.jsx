import { useState } from 'react';
import RegelDetails from './RegelDetails';
import { theme } from '../../../config/theme';
import { DocumentIcon } from '../../../components/Icons';
import { PRUEF_TYP_LABEL, PRUEF_KATEGORIE_LABEL, ACCENT, ACCENT_LIGHT, wohngeldApi } from '../api';

const styles = {
  item: { padding: theme.spacing.md, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.background, marginBottom: theme.spacing.sm },
  head: { display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start', flexWrap: 'wrap' },
  titel: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text, flex: 1, minWidth: 160 },
  titelDone: { textDecoration: 'line-through', color: theme.colors.textMuted },
  badge: { fontSize: '0.7rem', fontWeight: theme.typography.weights.medium, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, whiteSpace: 'nowrap' },
  meta: { fontSize: '0.7rem', color: theme.colors.textMuted, marginTop: 2 },
  belegLink: { fontSize: theme.typography.sizes.xs, color: ACCENT, cursor: 'pointer', background: 'none', border: 'none', padding: 0, marginTop: theme.spacing.xs },
  beleg: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, lineHeight: 1.5, marginTop: theme.spacing.xs, backgroundColor: theme.colors.surfaceHover, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm },
  docChip: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, marginTop: theme.spacing.xs, fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.medium, color: ACCENT, backgroundColor: ACCENT_LIGHT, border: 'none', borderRadius: theme.borderRadius.full, padding: `3px ${theme.spacing.sm}`, cursor: 'pointer' },
  links: { display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap' },
  regel: { marginTop: theme.spacing.xs, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, padding: theme.spacing.sm, backgroundColor: theme.colors.surface },
  actions: { display: 'flex', gap: theme.spacing.xs, marginTop: theme.spacing.sm, flexWrap: 'wrap' },
  btn: { fontSize: theme.typography.sizes.xs, padding: `4px ${theme.spacing.md}`, borderRadius: theme.borderRadius.md, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
};

function typBadgeStyle(typ) {
  return typ === 'anforderung'
    ? { backgroundColor: theme.colors.warningLight, color: theme.colors.warning }
    : { backgroundColor: theme.colors.infoLight, color: theme.colors.info };
}

function statusBadgeStyle(status) {
  if (status === 'erledigt') return { backgroundColor: theme.colors.successLight, color: theme.colors.success };
  if (status === 'verworfen') return { backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted };
  return { backgroundColor: theme.colors.errorLight, color: theme.colors.error };
}

/**
 * Ein Prüfschritt mit Typ/Kategorie-Badges, aufklappbarem Belegtext und Status-Aktionen.
 * onStatus(status) setzt „erledigt"/„verworfen"/„offen" (PUT durch den Aufrufer).
 * onOpenDokument(dokumentId) springt zum referenzierten Beleg-Dokument (optional).
 * dokumentLabel: Anzeigename des Beleg-Dokuments (optional, sonst generisch).
 */
export default function PruefschrittItem({ pruefschritt: p, onStatus, canEdit, busy, onOpenDokument, dokumentLabel }) {
  const [open, setOpen] = useState(false);
  const [warum, setWarum] = useState(false);
  const [regel, setRegel] = useState(null);
  const [regelFehler, setRegelFehler] = useState(null);
  const done = p.status !== 'offen';
  const basisId = (p.regelId || '').split(':')[0];

  async function warumUmschalten() {
    const neu = !warum;
    setWarum(neu);
    if (neu && !regel && !regelFehler) {
      try {
        const d = await wohngeldApi.getRegeln();
        const r = d.regeln.find((x) => x.id === basisId);
        if (r) setRegel(r); else setRegelFehler('Zu diesem Prüfschritt gibt es keine Regelbeschreibung (manuell angelegt).');
      } catch (e) { setRegelFehler(e.message || 'Regelbeschreibung konnte nicht geladen werden'); }
    }
  }
  return (
    <div style={styles.item}>
      <div style={styles.head}>
        <span style={{ ...styles.titel, ...(done ? styles.titelDone : {}) }}>{p.titel}</span>
        <span style={{ ...styles.badge, ...typBadgeStyle(p.typ) }}>{PRUEF_TYP_LABEL[p.typ] || p.typ}</span>
        <span style={{ ...styles.badge, backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted }}>
          {PRUEF_KATEGORIE_LABEL[p.kategorie] || p.kategorie}
        </span>
        {done && <span style={{ ...styles.badge, ...statusBadgeStyle(p.status) }}>{p.status === 'erledigt' ? 'erledigt' : 'verworfen'}</span>}
        {!p.automatisch && <span style={{ ...styles.badge, backgroundColor: theme.colors.surfaceHover, color: theme.colors.textMuted }}>manuell</span>}
      </div>
      {p.quellDokumentId && onOpenDokument && (
        <div>
          <button
            style={styles.docChip}
            onClick={() => onOpenDokument(p.quellDokumentId)}
            title="Zum referenzierten Dokument springen"
          >
            <DocumentIcon size={12} /> {dokumentLabel || 'Beleg-Dokument'}
          </button>
        </div>
      )}
      <div style={styles.links}>
        {p.belegtext && (
          <button style={styles.belegLink} onClick={() => setOpen((o) => !o)}>
            {open ? 'Beleg ausblenden' : 'Beleg anzeigen'}
          </button>
        )}
        {p.automatisch !== false && p.regelId && (
          <button style={styles.belegLink} onClick={warumUmschalten} aria-expanded={warum}>
            {warum ? 'Regel ausblenden' : 'Warum?'}
          </button>
        )}
      </div>
      {open && p.belegtext && <div style={styles.beleg}>{p.belegtext}</div>}
      {warum && (
        <div style={styles.regel}>
          {regel ? <RegelDetails regel={regel} kompakt /> : <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>{regelFehler || 'Lädt…'}</span>}
        </div>
      )}
      {canEdit && (
        <div style={styles.actions}>
          {p.status !== 'erledigt' && (
            <button style={styles.btn} disabled={busy} onClick={() => onStatus('erledigt')}>Als erledigt</button>
          )}
          {p.status !== 'verworfen' && (
            <button style={styles.btn} disabled={busy} onClick={() => onStatus('verworfen')}>Verwerfen</button>
          )}
          {p.status !== 'offen' && (
            <button style={styles.btn} disabled={busy} onClick={() => onStatus('offen')}>Wieder öffnen</button>
          )}
        </div>
      )}
    </div>
  );
}
