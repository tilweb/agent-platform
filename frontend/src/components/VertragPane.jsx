import { useState } from 'react';
import { theme } from '../config/theme';

/**
 * Vertragsauswertung (DP-Strategie `contract-structured`) im Review-Dialog:
 * Katalog, Pflichten/Fristen, Klauseln und Befunde — lesend. Fundstellen sind
 * Klausel-IDs; ein Klick zeigt den Wortlaut und springt zur Seite.
 */

const KATALOG_LABEL = {
  vertragsart: 'Vertragsart', parteien: 'Parteien', vertragsnummern: 'Vertrags-/Kundennummern', unterschriften: 'Unterschriften',
  datum_abschluss: 'Abschluss', beginn: 'Beginn', laufzeit: 'Laufzeit', verlaengerung: 'Verlängerung', kuendigung: 'Kündigung',
  entgelte: 'Entgelte', zahlungsbedingungen: 'Zahlungsbedingungen', preisanpassung: 'Preisanpassung', haftung: 'Haftung',
  gewaehrleistung: 'Gewährleistung', verfuegbarkeit_sla: 'Verfügbarkeit / Störungen', vertragsstrafe: 'Vertragsstrafe',
  vertraulichkeit: 'Vertraulichkeit', exklusivitaet_wettbewerb: 'Exklusivität / Wettbewerb', gerichtsstand: 'Gerichtsstand',
  rechtswahl: 'Rechtswahl', schriftform: 'Schriftform', widerruf: 'Widerruf', anlagen: 'Anlagen',
};

const STATUS = {
  gefunden: { label: 'geregelt', bg: theme.colors.successLight, fg: theme.colors.success },
  nicht_geregelt: { label: 'nicht geregelt', bg: theme.colors.surfaceHover, fg: theme.colors.textMuted },
  anlage_fehlt: { label: 'Anlage fehlt', bg: theme.colors.warningLight, fg: theme.colors.warning },
  delegiert: { label: 'anderer Vertrag', bg: theme.colors.infoLight, fg: theme.colors.info },
  geerbt: { label: 'geerbt', bg: theme.colors.infoLight, fg: theme.colors.info },
  bedingt: { label: 'bedingt', bg: theme.colors.warningLight, fg: theme.colors.warning },
};

const BEFUND_LABEL = {
  anlage_fehlt: 'Anlage fehlt', unterschrift_fehlt: 'Unterschrift fehlt', verweis_ins_leere: 'Verweis ins Leere',
  platzhalter: 'Platzhalter', widerspruch: 'Auffälligkeit', verarbeitung: 'Verarbeitung',
};

const TYP_LABEL = { pflicht: 'Pflicht', recht: 'Recht', frist: 'Frist', ausschluss: 'Ausschluss', haftung: 'Haftung', zahlung: 'Zahlung', sonstiges: 'Sonstiges' };
const MODAL_LABEL = { muss: 'muss', soll: 'soll', bemueht: 'bemüht sich', kann: 'kann', darf_nicht: 'darf nicht' };

const styles = {
  tabs: { display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap', marginBottom: theme.spacing.md },
  tab: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`, backgroundColor: 'transparent', border: 'none',
    borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted, cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
  },
  tabActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  badge: { fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap' },
  zeile: { padding: `${theme.spacing.sm} 0`, borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.typography.sizes.sm },
  label: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs, marginBottom: 2 },
  fund: {
    fontSize: theme.typography.sizes.xs, padding: `1px ${theme.spacing.xs}`, marginRight: theme.spacing.xs, marginTop: 2,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.sm, background: theme.colors.surface,
    color: theme.colors.primary, cursor: 'pointer',
  },
  wortlaut: {
    margin: `${theme.spacing.sm} 0`, padding: theme.spacing.md, backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm,
    whiteSpace: 'pre-wrap', color: theme.colors.text,
  },
  suche: {
    width: '100%', padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', marginBottom: theme.spacing.sm,
  },
  hinweis: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
};

function Badge({ bg, fg, children }) {
  return <span style={{ ...styles.badge, backgroundColor: bg, color: fg }}>{children}</span>;
}

/** Katalogwert lesbar machen (elementabhängig, sonst generisch). */
function formatWert(el, wert) {
  if (wert == null) return '—';
  const v = (x) => (x == null || x === '' ? null : String(x));
  const fristText = (f) => (f ? f.wortlaut || [f.dauer, f.einheit, f.richtung, f.bezug, f.zum && `zum ${f.zum}`].filter(Boolean).join(' ') : null);
  switch (el) {
    case 'parteien': return wert.map((p) => `${p.rolle ?? 'Partei'}: ${p.name ?? '—'}${p.anschrift ? `, ${p.anschrift}` : ''}`).join('\n');
    case 'unterschriften': return wert.map((u) => `${u.partei ?? 'Partei'}: ${u.vorhanden === false ? 'fehlt' : 'vorhanden'}${u.datum ? `, ${u.datum}` : ''}${u.ort ? ` (${u.ort})` : ''}`).join('\n');
    case 'kuendigung': return [fristText(wert.frist), v(wert.form) && `Form: ${wert.form}`, v(wert.ausserordentlich) && `außerordentlich: ${wert.ausserordentlich}`].filter(Boolean).join('\n') || '—';
    case 'laufzeit': return [v(wert.art), v(wert.dauer), v(wert.ende) && `bis ${wert.ende}`].filter(Boolean).join(', ') || '—';
    case 'verlaengerung': return wert.automatisch ? `automatisch${wert.schritt ? ` um ${wert.schritt}` : ''}` : (v(wert.schritt) ?? 'keine automatische Verlängerung');
    case 'entgelte': return wert.map((e) => [e.bezeichnung, e.betrag != null ? `${e.betrag} €` : e.formel, e.bezugsgroesse, e.rhythmus, e.netto_brutto, e.richtung && `(${e.richtung})`].filter(Boolean).join(' · ')).join('\n');
    case 'anlagen': return wert.map((a) => `${a.bezeichnung ?? 'Anlage'}${a.vorhanden === false ? ' — nicht im Dokument' : ''}`).join('\n');
    default:
      if (Array.isArray(wert)) return wert.map((x) => (typeof x === 'object' ? Object.values(x).filter((y) => y != null && y !== '').join(' · ') : String(x))).join('\n') || '—';
      if (typeof wert === 'object') {
        if ('text' in wert) return v(wert.text) ?? '—';
        return Object.entries(wert).filter(([, x]) => x != null && x !== '' && typeof x !== 'object').map(([k, x]) => (['datum', 'ort', 'zusage', 'bezeichnung'].includes(k) ? String(x) : `${k}: ${x}`)).join(', ') || '—';
      }
      return String(wert);
  }
}

export default function VertragPane({ vertrag, onJumpToPage }) {
  const [tab, setTab] = useState('ueberblick');
  const [offen, setOffen] = useState(null);       // Klausel-ID mit sichtbarem Wortlaut
  const [suche, setSuche] = useState('');
  if (!vertrag) return null;

  const klausel = Object.fromEntries((vertrag.klauseln ?? []).map((k) => [k.id, k]));
  const zeigen = (id) => {
    const k = klausel[id];
    if (!k) return;
    setOffen((cur) => (cur === id ? null : id));
    if (onJumpToPage && k.seiten?.[0]) onJumpToPage(k.seiten[0]);
  };
  const Fundstellen = ({ ids, ort }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap' }}>
      {(ids ?? []).map((id) => (
        <button key={`${ort}-${id}`} type="button" style={styles.fund} title={klausel[id]?.titelpfad?.join(' › ')} onClick={() => zeigen(id)}>{id}</button>
      ))}
      {(ids ?? []).filter((id) => id === offen).map((id) => (
        <div key={`w-${ort}-${id}`} style={{ ...styles.wortlaut, width: '100%' }}>
          <div style={styles.label}>{klausel[id]?.titelpfad?.join(' › ')} · S. {klausel[id]?.seiten?.join('–')}</div>
          {klausel[id]?.text || '(ohne Text)'}
        </div>
      ))}
    </div>
  );

  const befunde = (vertrag.befunde ?? []).filter((b) => b.typ !== 'verarbeitung');
  const tabs = [
    ['ueberblick', 'Überblick'],
    ['pflichten', `Pflichten & Fristen (${vertrag.inventar?.length ?? 0})`],
    ['klauseln', `Klauseln (${vertrag.klauseln?.length ?? 0})`],
    ['befunde', `Befunde (${befunde.length})`],
  ];
  const katalog = Object.entries(vertrag.katalog ?? {});
  const geregelt = katalog.filter(([, w]) => w.status !== 'nicht_geregelt');
  const nichtGeregelt = katalog.filter(([, w]) => w.status === 'nicht_geregelt');
  const q = suche.trim().toLowerCase();

  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      <div style={styles.tabs}>
        {tabs.map(([id, label]) => (
          <button key={id} type="button" style={{ ...styles.tab, ...(tab === id ? styles.tabActive : {}) }}
            onMouseEnter={(e) => { if (tab !== id) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
            onMouseLeave={(e) => { if (tab !== id) e.currentTarget.style.backgroundColor = 'transparent'; }}
            onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {tab === 'ueberblick' && (
        <div>
          {geregelt.map(([el, w]) => (
            <div key={el} style={styles.zeile}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm, alignItems: 'baseline' }}>
                <span style={{ fontWeight: theme.typography.weights.medium }}>{KATALOG_LABEL[el] ?? el}</span>
                <Badge bg={STATUS[w.status]?.bg} fg={STATUS[w.status]?.fg}>{STATUS[w.status]?.label ?? w.status}</Badge>
              </div>
              <div style={{ whiteSpace: 'pre-wrap', marginTop: 2 }}>{formatWert(el, w.wert)}</div>
              {(w.bedingung || w.verweis) && <div style={styles.hinweis}>{w.bedingung ? `Bedingung: ${w.bedingung}` : `Verweis: ${w.verweis}`}</div>}
              <Fundstellen ids={w.klauseln} ort={el} />
            </div>
          ))}
          {nichtGeregelt.length > 0 && (
            <div style={{ ...styles.hinweis, marginTop: theme.spacing.sm }}>
              Nicht geregelt: {nichtGeregelt.map(([el]) => KATALOG_LABEL[el] ?? el).join(', ')}
            </div>
          )}
          {(vertrag.verknuepfungen ?? []).length > 0 && (
            <div style={{ ...styles.zeile, borderBottom: 'none' }}>
              <div style={styles.label}>Bezüge zu anderen Verträgen</div>
              {vertrag.verknuepfungen.map((v, i) => <div key={i}>{v.art.replace('_', ' ')}: {v.wert}</div>)}
            </div>
          )}
        </div>
      )}

      {tab === 'pflichten' && (
        <div>
          <div style={styles.hinweis}>Fristen sind als Regel angegeben — die Berechnung konkreter Termine übernimmt das Fristenradar.</div>
          {(vertrag.inventar ?? []).map((e, i) => (
            <div key={i} style={styles.zeile}>
              <div style={{ display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Badge bg={theme.colors.surfaceHover} fg={theme.colors.text}>{TYP_LABEL[e.typ] ?? e.typ}</Badge>
                <Badge bg={e.modalitaet === 'bemueht' || e.modalitaet === 'soll' ? theme.colors.warningLight : theme.colors.primaryLight}
                  fg={e.modalitaet === 'bemueht' || e.modalitaet === 'soll' ? theme.colors.warning : theme.colors.primary}>{MODAL_LABEL[e.modalitaet] ?? e.modalitaet}</Badge>
                <span style={{ fontWeight: theme.typography.weights.medium }}>{e.partei}</span>
                {e.gegenueber && <span style={styles.hinweis}>gegenüber {e.gegenueber}</span>}
              </div>
              <div style={{ marginTop: 2 }}>{e.inhalt}</div>
              {(e.frist || e.ausloeser || e.bedingung) && (
                <div style={styles.hinweis}>
                  {[e.frist && `Frist: ${e.frist.wortlaut || [e.frist.dauer, e.frist.einheit, e.frist.richtung, e.frist.bezug].filter(Boolean).join(' ')}`,
                    e.ausloeser && `Auslöser: ${e.ausloeser}`, e.bedingung && `Bedingung: ${e.bedingung}`].filter(Boolean).join(' · ')}
                </div>
              )}
              <Fundstellen ids={e.klauseln} ort={`i${i}`} />
            </div>
          ))}
        </div>
      )}

      {tab === 'klauseln' && (
        <div>
          <input style={styles.suche} placeholder="In Klauseln suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
          {(vertrag.klauseln ?? [])
            .filter((k) => !q || k.text.toLowerCase().includes(q) || k.titelpfad.join(' ').toLowerCase().includes(q))
            .map((k) => (
              <div key={k.id} style={{ ...styles.zeile, paddingLeft: `calc(${theme.spacing.md} * ${Math.max(0, k.ebene - 1)})`, cursor: 'pointer' }} onClick={() => zeigen(k.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm }}>
                  <span><span style={{ color: theme.colors.primary }}>{k.id}</span> {k.ebene === 1 ? k.titelpfad[0] : k.titelpfad[k.titelpfad.length - 1]}</span>
                  <span style={styles.hinweis}>S. {k.seiten[0] === k.seiten[1] ? k.seiten[0] : k.seiten.join('–')}{k.rolle !== 'vertragstext' ? ` · ${k.rolle}` : ''}</span>
                </div>
                {offen === k.id && <div style={styles.wortlaut}>{k.text || '(ohne Text)'}</div>}
              </div>
            ))}
        </div>
      )}

      {tab === 'befunde' && (
        <div>
          {befunde.length === 0 && <div style={styles.hinweis}>Keine Befunde.</div>}
          {befunde.map((b, i) => (
            <div key={i} style={styles.zeile}>
              <Badge bg={theme.colors.warningLight} fg={theme.colors.warning}>{BEFUND_LABEL[b.typ] ?? b.typ}</Badge>
              <div style={{ marginTop: 2 }}>{b.text}</div>
              <Fundstellen ids={b.klauseln} ort={`b${i}`} />
            </div>
          ))}
          {(vertrag.gueltigkeit ?? []).length > 0 && (
            <div style={{ marginTop: theme.spacing.md }}>
              <div style={styles.label}>Nicht geltender bzw. handschriftlicher Text</div>
              {vertrag.gueltigkeit.map((g, i) => (
                <div key={i} style={styles.zeile}>
                  <span style={styles.hinweis}>{g.art === 'gestrichen' ? 'gestrichen' : g.art === 'nicht_angekreuzt' ? 'nicht angekreuzt' : 'handschriftlich'} · {g.klausel}</span>
                  <div style={g.art === 'gestrichen' ? { textDecoration: 'line-through', color: theme.colors.textMuted } : {}}>{g.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
