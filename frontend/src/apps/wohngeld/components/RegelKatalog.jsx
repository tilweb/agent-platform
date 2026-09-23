import { useEffect, useMemo, useState } from 'react';
import { theme } from '../../../config/theme';
import SearchInput from '../../../components/overview/SearchInput';
import { ChevronDownIcon } from '../../../components/Icons';
import { wohngeldApi, ACCENT, ACCENT_LIGHT, PRUEF_KATEGORIE_LABEL, PRUEF_TYP_LABEL } from '../api';
import RegelDetails from './RegelDetails';

const styles = {
  intro: { fontSize: theme.typography.sizes.sm, color: theme.colors.textSecondary, lineHeight: 1.5, marginBottom: theme.spacing.lg, maxWidth: 820 },
  leiste: { display: 'flex', gap: theme.spacing.md, alignItems: 'center', flexWrap: 'wrap', marginBottom: theme.spacing.lg },
  chip: { fontSize: theme.typography.sizes.sm, padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, border: `1px solid ${theme.colors.border}`, backgroundColor: theme.colors.surface, color: theme.colors.text, cursor: 'pointer' },
  chipAktiv: { backgroundColor: ACCENT_LIGHT, borderColor: ACCENT, color: ACCENT, fontWeight: theme.typography.weights.medium },
  gruppe: { marginBottom: theme.spacing.xl },
  gruppeTitel: { fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: theme.spacing.sm },
  karte: { border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, backgroundColor: theme.colors.surface, marginBottom: theme.spacing.sm, overflow: 'hidden' },
  kopf: { display: 'flex', alignItems: 'center', gap: theme.spacing.md, padding: `${theme.spacing.md} ${theme.spacing.lg}`, cursor: 'pointer', width: '100%', border: 'none', background: 'none', textAlign: 'left' },
  titel: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium, color: theme.colors.text },
  kurz: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  badge: { fontSize: '0.7rem', fontWeight: theme.typography.weights.medium, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, whiteSpace: 'nowrap' },
  paragraf: { fontSize: theme.typography.sizes.xs, color: theme.colors.textSecondary, whiteSpace: 'nowrap' },
  inhalt: { padding: `0 ${theme.spacing.lg} ${theme.spacing.lg}`, borderTop: `1px solid ${theme.colors.border}`, paddingTop: theme.spacing.md },
  fuss: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, marginTop: theme.spacing.lg },
  leer: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, padding: theme.spacing.xl, textAlign: 'center' },
};

const typStil = (typ) => (typ === 'anforderung'
  ? { backgroundColor: theme.colors.warningLight, color: theme.colors.warning }
  : { backgroundColor: theme.colors.infoLight, color: theme.colors.info });

const GRUPPEN_REIHENFOLGE = ['grundangaben', 'wohnen', 'identitaet_versicherung', 'einkommen', 'familie_pflege', 'vermoegen', 'ausschluss', 'verfahren'];

/**
 * Aufrufbare Dokumentation aller Prüfregeln: nach Themen gruppiert, durchsuchbar,
 * filterbar nach Vollständigkeit/Plausibilität. Quelle: backend checker/regeln.ts.
 */
export default function RegelKatalog() {
  const [daten, setDaten] = useState(null);
  const [fehler, setFehler] = useState(null);
  const [suche, setSuche] = useState('');
  const [kategorie, setKategorie] = useState('alle');
  const [offen, setOffen] = useState(() => new Set());

  useEffect(() => {
    let abgebrochen = false;
    wohngeldApi.getRegeln()
      .then((d) => { if (!abgebrochen) setDaten(d); })
      .catch((e) => { if (!abgebrochen) setFehler(e.message || 'Prüfregeln konnten nicht geladen werden'); });
    return () => { abgebrochen = true; };
  }, []);

  const gruppen = useMemo(() => {
    if (!daten) return [];
    const q = suche.trim().toLowerCase();
    const passt = (r) => (kategorie === 'alle' || r.kategorie === kategorie)
      && (!q || [r.titel, r.ausloeser, r.rechtsgrundlage, r.nachweis, r.erledigung, r.id].some((t) => (t || '').toLowerCase().includes(q)));
    return GRUPPEN_REIHENFOLGE
      .map((g) => ({ id: g, label: daten.gruppen[g] || g, regeln: daten.regeln.filter((r) => r.gruppe === g && passt(r)) }))
      .filter((g) => g.regeln.length);
  }, [daten, suche, kategorie]);

  const umschalten = (id) => setOffen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (fehler) return <div style={styles.leer}>{fehler}</div>;
  if (!daten) return <div style={styles.leer}>Lädt…</div>;

  return (
    <div>
      <p style={styles.intro}>
        Nach diesen Regeln erzeugt die App automatisch Prüfschritte. Vollständigkeitsregeln melden fehlende Nachweise,
        Plausibilitätsregeln Widersprüche zwischen Antrag und Unterlagen. Jede Regel zeigt, wann sie greift, auf welche
        Rechtsgrundlage sie sich stützt und wie der Prüfschritt erledigt wird.
      </p>
      <div style={styles.leiste}>
        <SearchInput value={suche} onChange={setSuche} placeholder="Regel, Nachweis oder Paragraf suchen…" />
        {[['alle', 'Alle'], ['vollstaendigkeit', PRUEF_KATEGORIE_LABEL.vollstaendigkeit || 'Vollständigkeit'], ['plausibilitaet', PRUEF_KATEGORIE_LABEL.plausibilitaet || 'Plausibilität']].map(([k, l]) => (
          <button key={k} style={{ ...styles.chip, ...(kategorie === k ? styles.chipAktiv : {}) }} onClick={() => setKategorie(k)}>{l}</button>
        ))}
      </div>

      {gruppen.length === 0 && <div style={styles.leer}>Keine Regel passt zur Suche.</div>}
      {gruppen.map((g) => (
        <div key={g.id} style={styles.gruppe}>
          <div style={styles.gruppeTitel}>{g.label}</div>
          {g.regeln.map((r) => {
            const auf = offen.has(r.id);
            return (
              <div key={r.id} style={styles.karte}>
                <button style={styles.kopf} onClick={() => umschalten(r.id)} aria-expanded={auf}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.titel}>{r.titel}</div>
                    {!auf && <div style={styles.kurz}>{r.ausloeser}</div>}
                  </div>
                  <span style={{ ...styles.badge, ...typStil(r.typ) }}>{PRUEF_TYP_LABEL[r.typ] || r.typ}</span>
                  <span style={styles.paragraf}>{r.rechtsgrundlage.split(';')[0]}</span>
                  <ChevronDownIcon size={16} style={{ transform: auf ? 'rotate(180deg)' : 'none', color: theme.colors.textMuted, flexShrink: 0 }} />
                </button>
                {auf && <div style={styles.inhalt}><RegelDetails regel={r} /></div>}
              </div>
            );
          })}
        </div>
      ))}
      <div style={styles.fuss}>{daten.regeln.length} Regeln · Stand {daten.stand.split('-').reverse().join('.')}</div>
    </div>
  );
}
