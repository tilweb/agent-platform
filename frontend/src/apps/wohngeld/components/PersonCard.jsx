import { useState } from 'react';
import { theme } from '../../../config/theme';
import { CommentIcon } from '../../../components/Icons';
import { ROLLE_LABEL, ERWERBSSTATUS_LABEL, ACCENT } from '../api';
import { FeldGrid } from './SektionCard';
import FeldStatusMark from './FeldStatusMark';
import { fsKey } from '../feldStatusMap';

const styles = {
  card: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, marginBottom: theme.spacing.sm, overflow: 'hidden' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md, padding: theme.spacing.md, cursor: 'pointer' },
  notizBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 3,
    padding: `2px ${theme.spacing.sm}`, background: 'none',
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.full,
    color: theme.colors.textMuted, cursor: 'pointer', fontSize: theme.typography.sizes.xs,
  },
  name: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: theme.colors.text },
  rolle: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2 },
  body: { padding: `0 ${theme.spacing.md} ${theme.spacing.md}`, borderTop: `1px solid ${theme.colors.borderLight}` },
  subTitle: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: ACCENT, textTransform: 'uppercase', letterSpacing: '0.04em', margin: `${theme.spacing.md} 0 ${theme.spacing.sm}` },
  einkTable: { width: '100%', borderCollapse: 'collapse', fontSize: theme.typography.sizes.sm },
  th: { textAlign: 'left', padding: `${theme.spacing.xs} ${theme.spacing.sm}`, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontWeight: theme.typography.weights.medium, borderBottom: `1px solid ${theme.colors.borderLight}` },
  td: { padding: `${theme.spacing.xs} ${theme.spacing.sm}`, color: theme.colors.text, borderBottom: `1px solid ${theme.colors.borderLight}` },
};

function eur(v) {
  if (v == null) return '—';
  return v.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' });
}

function fullName(p) {
  return [p.titel, p.vorname, p.nachname].filter(Boolean).join(' ') || 'Person';
}

export default function PersonCard({
  person: p, feldStatusMap = {}, canEdit = false, busy = false,
  onBestaetigen, onVerwerfen, notizCount, onNotizClick,
}) {
  const [open, setOpen] = useState(false);
  const einkommen = p.einkommen || [];
  const pb = p.pflege_behinderung || {};

  const fsFor = (feldPfad) => feldStatusMap[fsKey('person', p.id, feldPfad)];
  const mark = (feldPfad) => {
    const fs = fsFor(feldPfad);
    return fs ? <FeldStatusMark fs={fs} canEdit={canEdit} busy={busy} onBestaetigen={onBestaetigen} onVerwerfen={onVerwerfen} /> : null;
  };

  const persoenlich = [
    { label: 'Geburtsdatum', value: p.geburtsdatum, mark: mark('geburtsdatum') },
    { label: 'Geburtsort', value: p.geburtsort },
    { label: 'Geburtsname', value: p.geburtsname },
    { label: 'Familienstand', value: p.familienstand },
    { label: 'Erwerbsstatus', value: p.erwerbsstatus ? ERWERBSSTATUS_LABEL[p.erwerbsstatus] : null },
    { label: 'Staatsangehörigkeit', value: p.staatsangehoerigkeit },
    { label: 'Telefon', value: p.telefon },
    { label: 'E-Mail', value: p.email },
  ].filter((f) => f.value != null && f.value !== '');

  const sonstiges = [
    { label: 'EU/EWR', value: p.eu_ewr == null ? null : (p.eu_ewr ? 'Ja' : 'Nein') },
    { label: 'Erhält Kindergeld', value: p.erhaelt_kindergeld == null ? null : (p.erhaelt_kindergeld ? 'Ja' : 'Nein') },
    { label: 'Werbungskosten', value: p.hat_werbungskosten == null ? null : (p.hat_werbungskosten ? 'Ja' : 'Nein') },
    { label: 'Transferleistungen', value: (p.transferleistungen || []).join(', ') || null },
    { label: 'Bemerkung', value: p.bemerkung },
  ].filter((f) => f.value != null && f.value !== '');

  const pflege = [
    { label: 'Behinderungsgrad (GdB)', value: pb.schwerbehinderungsgrad != null ? String(pb.schwerbehinderungsgrad) : null },
    { label: 'Pflegegrad', value: pb.pflegegrad != null ? String(pb.pflegegrad) : null },
    { label: 'Pflegebedürftig', value: pb.pflegebeduerftig == null ? null : (pb.pflegebeduerftig ? 'Ja' : 'Nein') },
  ].filter((f) => f.value != null);

  return (
    <div style={styles.card}>
      <div
        style={styles.head}
        onClick={() => setOpen((o) => !o)}
        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <div>
          <div style={styles.name}>
            {open ? '▾ ' : '▸ '}{fullName(p)}
            {(fsFor('nachname') || fsFor('vorname')) && (
              <span onClick={(e) => e.stopPropagation()}>
                {mark('nachname')}{mark('vorname')}
              </span>
            )}
          </div>
          <div style={styles.rolle}>{ROLLE_LABEL[p.rolle] || p.rolle}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }} onClick={(e) => e.stopPropagation()}>
          {einkommen.length > 0 && (
            <span style={{ fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted }}>
              {einkommen.length} Einkommenspos.
            </span>
          )}
          {onNotizClick && (
            <button style={styles.notizBtn} onClick={onNotizClick} title="Notizen">
              <CommentIcon size={13} />
              {notizCount > 0 && <span>{notizCount}</span>}
            </button>
          )}
        </div>
      </div>

      {open && (
        <div style={styles.body}>
          {persoenlich.length > 0 && (
            <>
              <div style={styles.subTitle}>Persönliches</div>
              <FeldGrid felder={persoenlich} />
            </>
          )}

          {pflege.length > 0 && (
            <>
              <div style={styles.subTitle}>Pflege & Behinderung</div>
              <FeldGrid felder={pflege} />
            </>
          )}

          {sonstiges.length > 0 && (
            <>
              <div style={styles.subTitle}>Sonstiges</div>
              <FeldGrid felder={sonstiges} />
            </>
          )}

          {einkommen.length > 0 && (
            <>
              <div style={styles.subTitle}>Einkommenspositionen</div>
              <table style={styles.einkTable}>
                <thead>
                  <tr>
                    <th style={styles.th}>Art</th>
                    <th style={styles.th}>Monatlich</th>
                    <th style={styles.th}>Jährlich</th>
                    <th style={styles.th}>Berücksichtigt</th>
                  </tr>
                </thead>
                <tbody>
                  {einkommen.map((e) => (
                    <tr key={e.id}>
                      <td style={styles.td}>{e.bezeichnung || e.art}</td>
                      <td style={styles.td}>{eur(e.betrag_monatlich)}</td>
                      <td style={styles.td}>{eur(e.betrag_jaehrlich)}</td>
                      <td style={styles.td}>{e.beruecksichtigt ? 'ja' : 'nein'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={styles.subTitle}>Vermögen</div>
          <FeldGrid felder={[{ label: 'Vermögen (z. B. Bankguthaben)', value: eur(p.vermoegen) }]} />
        </div>
      )}
    </div>
  );
}
