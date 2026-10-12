import { Fragment, useState } from 'react';
import { theme } from '../config/theme';
import { AlertTriangleIcon, CheckCircleIcon, PenIcon } from './Icons';
import VolltextPane from './VolltextPane';
import { KATALOG_LABEL, NICHT_GEREGELT_SCHLUESSEL, REIHENFOLGE, pruefElemente } from '../utils/vertragKatalog';

/**
 * Vertragsauswertung (DP-Strategie `contract-structured`) im Prüfdialog.
 *
 * Überblick = der feste Vertragskatalog als Karten: lesbare Werte, Status, Fundstellen mit Seite. Sind die
 * Katalogfelder im Ergebnis (`katalog_*`, Gruppe „Vertragskatalog"), ist jede Karte über „Bearbeiten" korrigierbar
 * (Eingaben liefert der Prüfdialog über `renderEingabe`) und wird im Prüfmodus abgehakt. Ältere Ergebnisse ohne
 * Katalogfelder werden lesend aus `vertrag.katalog` angezeigt.
 */

/** label = Badge, option = Auswahl beim Bearbeiten, tip = Erklärung (Tooltip). */
const STATUS = {
  gefunden: { label: 'geregelt', option: 'Im Vertrag geregelt', tip: 'Der Vertrag enthält dazu eine Bestimmung — Wert und Fundstelle stehen in der Karte.', bg: theme.colors.successLight, fg: theme.colors.success },
  nicht_geregelt: { label: 'nicht geregelt', option: 'Nicht geregelt', tip: 'Der Vertrag sagt dazu nichts. Dann gilt in der Regel das Gesetz bzw. nichts Besonderes.', bg: theme.colors.surfaceHover, fg: theme.colors.textMuted },
  anlage_fehlt: { label: 'Anlage fehlt', option: 'In einer fehlenden Anlage', tip: 'Der Vertrag verweist dafür auf eine Anlage, die nicht im Dokument liegt (z. B. „Preise gemäß Anlage 2").', bg: theme.colors.warningLight, fg: theme.colors.warning },
  delegiert: { label: 'anderer Vertrag', option: 'In einem anderen Vertrag', tip: 'Die Regelung steht in einem anderen Vertrag (z. B. „gemäß Rahmenvertrag").', bg: theme.colors.infoLight, fg: theme.colors.info },
  geerbt: { label: 'geerbt', option: 'Wie im Hauptvertrag', tip: 'Es gilt, was im Hauptvertrag steht — typisch bei Zusatzvereinbarungen („Laufzeit wie Wartungsvertrag").', bg: theme.colors.infoLight, fg: theme.colors.info },
  bedingt: { label: 'bedingt', option: 'Nur unter einer Bedingung', tip: 'Gilt nur unter einer Bedingung (z. B. „nur wenn der Kunde Kaufmann ist").', bg: theme.colors.warningLight, fg: theme.colors.warning },
};
const ABWEICHEND = new Set(['anlage_fehlt', 'bedingt', 'geerbt', 'delegiert']);

const BEFUND_LABEL = {
  anlage_fehlt: 'Anlage fehlt', unterschrift_fehlt: 'Unterschrift fehlt', unterschrift_pruefen: 'Unterschrift prüfen', beilage_nicht_unterzeichnet: 'Beilage nicht unterzeichnet', verweis_ins_leere: 'Verweis ins Leere',
  platzhalter: 'Platzhalter', widerspruch: 'Auffälligkeit', verarbeitung: 'Verarbeitung',
};

const TEIL_LABEL = {
  bezeichnung: 'Bezeichnung', kategorie: 'Kategorie', beschraenkung: 'Beschränkung', hoechstbetrag: 'Höchstbetrag', ausnahmen: 'Ausnahmen',
  zahlungsziel: 'Zahlungsziel', verfahren: 'Verfahren', zusage: 'Zusage', modalitaet: 'Verbindlichkeit', ort: 'Ort', bedingung: 'Gilt nur, wenn',
  art: 'Art', dauer: 'Dauer', ende: 'Ende', datum: 'Datum', regel: 'Regel', form: 'Form', ausserordentlich: 'außerordentlich', schritt: 'Schritt',
};

const TYP_LABEL = { pflicht: 'Pflicht', recht: 'Recht', frist: 'Frist', ausschluss: 'Ausschluss', haftung: 'Haftung', zahlung: 'Zahlung', sonstiges: 'Sonstiges' };
const MODAL_LABEL = { muss: 'muss', soll: 'soll', bemueht: 'bemüht sich', kann: 'kann', darf_nicht: 'darf nicht' };

const styles = {
  tabs: { display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap', marginBottom: theme.spacing.lg },
  tab: {
    padding: `${theme.spacing.sm} ${theme.spacing.lg}`, backgroundColor: 'transparent', border: 'none',
    borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.medium,
    color: theme.colors.textMuted, cursor: 'pointer', transition: `all ${theme.transitions.fast}`,
  },
  tabActive: { backgroundColor: theme.colors.primaryLight, color: theme.colors.primary },
  badge: { fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}`, borderRadius: theme.borderRadius.full, fontWeight: theme.typography.weights.medium, whiteSpace: 'nowrap' },
  karte: {
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.lg, padding: `${theme.spacing.md} ${theme.spacing.lg}`,
    marginBottom: theme.spacing.sm, backgroundColor: theme.colors.surface, fontSize: theme.typography.sizes.sm,
  },
  kartenKopf: { display: 'flex', alignItems: 'center', gap: theme.spacing.sm },
  kartenTitel: { fontWeight: theme.typography.weights.medium, color: theme.colors.text, flex: 1, minWidth: 0 },
  zeilen: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  wertZeile: { display: 'flex', gap: theme.spacing.sm, alignItems: 'baseline' },
  wertLabel: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs, minWidth: 110, flexShrink: 0 },
  zeile: { padding: `${theme.spacing.md} 0`, borderBottom: `1px solid ${theme.colors.border}`, fontSize: theme.typography.sizes.sm },
  label: { color: theme.colors.textMuted, fontSize: theme.typography.sizes.xs, marginBottom: theme.spacing.xs },
  fundstellen: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  fund: {
    fontSize: theme.typography.sizes.xs, padding: `2px ${theme.spacing.sm}`,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.sm, background: theme.colors.surface,
    color: theme.colors.primary, cursor: 'pointer',
  },
  wortlaut: {
    marginTop: theme.spacing.sm, padding: theme.spacing.md, backgroundColor: theme.colors.background,
    border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md, fontSize: theme.typography.sizes.sm,
    whiteSpace: 'pre-wrap', color: theme.colors.text, width: '100%',
  },
  suche: {
    width: '100%', padding: theme.spacing.sm, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.sm, backgroundColor: theme.colors.surface, color: theme.colors.text, outline: 'none', marginBottom: theme.spacing.md,
  },
  hinweis: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted },
  zwischenTitel: {
    fontSize: theme.typography.sizes.xs, fontWeight: theme.typography.weights.semibold, color: theme.colors.textMuted,
    textTransform: 'uppercase', letterSpacing: '0.05em', margin: `${theme.spacing.lg} 0 ${theme.spacing.sm}`,
  },
  zusammenfassung: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  befundLeiste: {
    display: 'flex', alignItems: 'center', gap: theme.spacing.sm, width: '100%', marginBottom: theme.spacing.md,
    padding: `${theme.spacing.sm} ${theme.spacing.md}`, borderRadius: theme.borderRadius.lg, border: 'none',
    backgroundColor: theme.colors.warningLight, color: theme.colors.warning, fontSize: theme.typography.sizes.sm, cursor: 'pointer', textAlign: 'left',
  },
  kleinBtn: {
    display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, padding: `2px ${theme.spacing.sm}`,
    backgroundColor: 'transparent', border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.md,
    fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, cursor: 'pointer',
  },
  check: { display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs, fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' },
  bearbeiten: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, marginTop: theme.spacing.md, paddingTop: theme.spacing.md, borderTop: `1px solid ${theme.colors.border}` },
  eingabeZeile: { display: 'flex', flexDirection: 'column', gap: theme.spacing.xs },
  statusWahl: { display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs },
  statusOption: {
    padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderRadius: theme.borderRadius.full, border: `1px solid ${theme.colors.border}`,
    backgroundColor: theme.colors.surface, color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs, cursor: 'pointer',
  },
  entfernen: { border: 'none', background: 'transparent', color: theme.colors.textMuted, cursor: 'pointer', padding: 0, fontSize: theme.typography.sizes.sm, lineHeight: 1 },
  fundAuswahl: {
    padding: `2px ${theme.spacing.sm}`, border: `1px solid ${theme.colors.border}`, borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.surface, color: theme.colors.textSecondary, fontSize: theme.typography.sizes.xs, maxWidth: 280,
  },
};

function Badge({ bg, fg, title, children }) {
  return <span title={title} style={{ ...styles.badge, backgroundColor: bg, color: fg, ...(title ? { cursor: 'help' } : {}) }}>{children}</span>;
}

/** Für „korrigiert": leere Texte, leere Listen und Zeilen ohne Inhalt gelten als gleich leer. */
function normiert(v) {
  if (v === '' || v == null) return null;
  if (Array.isArray(v)) {
    const zeilen = v.filter((z) => (z && typeof z === 'object' ? Object.values(z).some((x) => !leer(x)) : !leer(z)));
    return zeilen.length ? zeilen : null;
  }
  return v;
}

const leer = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
const text = (v) => (typeof v === 'boolean' ? (v ? 'ja' : 'nein') : String(v));

/** Feld-IDs eines Katalogelements (Werte ohne Status/Fundstellen). */
function elementFelder(el, felder) {
  return Object.keys(felder).filter((id) => (id === `katalog_${el}` || id.startsWith(`katalog_${el}_`))
    && id !== `katalog_${el}_status` && id !== `katalog_${el}_fundstellen`);
}

/** Lesbare Zeilen eines Elements aus den flachen Feldwerten: [{ label?, wert, ton? }]. */
function wertZeilen(el, felder, values) {
  const elLabel = KATALOG_LABEL[el];
  const ids = elementFelder(el, felder);
  const zeilen = [];
  // Frist (Kündigung): Wortlaut genügt, sonst aus den Teilen zusammensetzen.
  const fristIds = ids.filter((id) => id.includes('_frist_'));
  if (fristIds.length) {
    const t = (k) => values[`katalog_${el}_frist_${k}`];
    const f = t('wortlaut') || [t('dauer'), t('einheit'), t('richtung'), t('bezug'), t('zum') && `zum ${t('zum')}`].filter((x) => !leer(x)).join(' ');
    if (f) zeilen.push({ label: 'Frist', wert: f });
  }
  for (const id of ids.filter((x) => !x.includes('_frist_'))) {
    const v = values[id];
    if (leer(v)) continue;
    const f = felder[id];
    const label = f.label === elLabel ? null : f.label.replace(`${elLabel}: `, '');
    if (f.type !== 'list') { zeilen.push({ label, wert: text(v) }); continue; }
    for (const z of v) {
      if (el === 'anlagen') zeilen.push({ wert: z.bezeichnung || 'Anlage', ton: z.vorhanden === false ? 'fehlt' : z.vorhanden === true ? 'liegt' : null });
      else if (el === 'parteien') zeilen.push({ label: z.rolle || 'Partei', wert: [z.name, z.anschrift].filter((x) => !leer(x)).join(', ') || '—' });
      else if (el === 'unterschriften') zeilen.push({ label: z.partei || 'Partei', wert: [z.vorhanden === false ? 'fehlt' : 'vorhanden', z.datum, z.ort].filter((x) => !leer(x)).join(' · '), ton: z.vorhanden === false ? 'fehlt' : null });
      else if (el === 'entgelte') zeilen.push({ label: z.bezeichnung || null, wert: [z.betrag != null && z.betrag !== '' ? `${z.betrag} €` : z.formel, z.bezugsgroesse, z.rhythmus, z.netto_brutto].filter((x) => !leer(x)).join(' · ') || '—' });
      else zeilen.push({ wert: Object.values(z).filter((x) => !leer(x)).map(text).join(' · ') || '—' });
    }
  }
  return zeilen;
}

/** Ältere Ergebnisse ohne Katalogfelder: Zeilen direkt aus `vertrag.katalog`. */
function wertZeilenAusKatalog(el, wert) {
  if (wert == null) return [];
  if (Array.isArray(wert)) {
    return wert.map((z) => (typeof z === 'object' && z
      ? { wert: Object.values(z).filter((x) => !leer(x) && typeof x !== 'object').map(text).join(' · ') || '—' }
      : { wert: text(z) }));
  }
  if (typeof wert === 'object') {
    if ('text' in wert) return leer(wert.text) ? [] : [{ wert: wert.text }];
    const zeilen = [];
    for (const [k, v] of Object.entries(wert)) {
      if (leer(v)) continue;
      if (typeof v === 'object') {
        const w = v.wortlaut || Object.values(v).filter((x) => !leer(x)).map(text).join(' ');
        if (w) zeilen.push({ label: k === 'frist' ? 'Frist' : TEIL_LABEL[k] ?? k, wert: w });
      } else zeilen.push({ label: TEIL_LABEL[k] ?? k, wert: text(v) });
    }
    return zeilen;
  }
  return [{ wert: text(wert) }];
}

export default function VertragPane({
  vertrag, volltext, onJumpToPage, felder = {}, values = {}, original = {}, renderEingabe,
  pruefModus = false, geprueft = {}, onGeprueft, zusatz = null, onFeldAendern,
}) {
  const [tab, setTab] = useState('ueberblick');
  const [offen, setOffen] = useState(null);         // `${ort}|${klausel}` mit sichtbarem Wortlaut
  const [inBearbeitung, setInBearbeitung] = useState(null);
  const [suche, setSuche] = useState('');
  if (!vertrag) return null;

  const klausel = Object.fromEntries((vertrag.klauseln ?? []).map((k) => [k.id, k]));
  const seitenText = (id) => {
    const s = klausel[id]?.seiten;
    return s ? (s[0] === s[1] ? `S. ${s[0]}` : `S. ${s[0]}–${s[1]}`) : null;
  };
  const zeigen = (ort, id) => {
    const k = klausel[id];
    if (!k) return;
    setOffen((cur) => (cur === `${ort}|${id}` ? null : `${ort}|${id}`));
    // Seite öffnen und der Vorschau sagen, welche Klausel dort zu suchen ist (Koordinaten der Klausel gibt es nicht).
    if (onJumpToPage && k.seiten?.[0]) onJumpToPage(k.seiten[0], `${id} ${k.titelpfad?.[k.titelpfad.length - 1] ?? ''}`.trim());
  };
  const fundstellenListe = (ids, ort) => {
    const liste = (ids ?? []).filter(Boolean);
    if (!liste.length) return null;
    const auf = liste.find((id) => offen === `${ort}|${id}`);
    return (
      <Fragment key={`f-${ort}`}>
        <div style={styles.fundstellen}>
          {liste.map((id) => (
            <button key={id} type="button" style={styles.fund} title={`${klausel[id]?.titelpfad?.join(' › ') ?? id} — Wortlaut zeigen und zur Seite springen`} onClick={() => zeigen(ort, id)}>
              {id}{seitenText(id) ? ` · ${seitenText(id)}` : ''}
            </button>
          ))}
        </div>
        {auf && (
          <div style={styles.wortlaut}>
            <div style={styles.label}>{klausel[auf]?.titelpfad?.join(' › ')} · {seitenText(auf)}</div>
            {klausel[auf]?.text || '(ohne Text)'}
          </div>
        )}
      </Fragment>
    );
  };

  const befunde = (vertrag.befunde ?? []).filter((b) => b.typ !== 'verarbeitung');
  const tabs = [
    ['ueberblick', 'Überblick'],
    ...(zusatz ? [['zusatz', `Zusatzfelder (${zusatz.anzahl})`]] : []),
    ['pflichten', `Pflichten & Fristen (${vertrag.inventar?.length ?? 0})`],
    ['klauseln', `Klauseln (${vertrag.klauseln?.length ?? 0})`],
    ...(volltext?.seiten?.length ? [['volltext', 'Volltext']] : []),
    ['befunde', `Befunde (${befunde.length})`],
  ];

  // Katalog: aus den (korrigierbaren) Feldwerten, sonst lesend aus vertrag.katalog.
  const mitFeldern = Object.keys(felder).some((id) => id.startsWith('katalog_')) && values.katalog_beginn_status !== undefined;
  const status = (el) => (mitFeldern ? values[`katalog_${el}_status`] : vertrag.katalog?.[el]?.status) ?? 'nicht_geregelt';
  const fundstellen = (el) => (mitFeldern
    ? String(values[`katalog_${el}_fundstellen`] ?? '').split(/,\s*/).filter(Boolean)
    : vertrag.katalog?.[el]?.klauseln ?? []);
  const geaendert = (el) => mitFeldern && [`katalog_${el}_status`, `katalog_${el}_fundstellen`, ...elementFelder(el, felder)]
    .some((id) => JSON.stringify(normiert(values[id])) !== JSON.stringify(normiert(original[id])));
  const setze = (id, wert) => onFeldAendern?.(id, wert);
  /** Status ändern; „nicht geregelt" leert Werte und Fundstellen des Elements (sonst widersprüchlich). */
  const setzeStatus = (el, neu) => {
    setze(`katalog_${el}_status`, neu);
    if (neu === 'nicht_geregelt') {
      for (const id of elementFelder(el, felder)) setze(id, felder[id]?.type === 'list' ? [] : null);
      setze(`katalog_${el}_fundstellen`, null);
    }
  };
  const setzeFundstellen = (el, ids) => setze(`katalog_${el}_fundstellen`, ids.length ? ids.join(', ') : null);
  const abweichend = REIHENFOLGE.filter((el) => ABWEICHEND.has(status(el)));
  const geregelt = REIHENFOLGE.filter((el) => status(el) === 'gefunden');
  const nichtGeregelt = REIHENFOLGE.filter((el) => status(el) === 'nicht_geregelt');
  const katalogPflicht = pruefElemente(vertrag, felder, values);
  // Wie im Prüfdialog: Zusatzfelder zählen mit, sobald es Katalogfelder gibt.
  const pflicht = katalogPflicht.length && zusatz ? [...katalogPflicht, zusatz.schluessel] : katalogPflicht;
  const erledigt = pflicht.filter((k) => geprueft[k]).length;
  const bearbeitbar = mitFeldern && pruefModus && !!renderEingabe && !!onFeldAendern;
  const klauselAuswahl = (vertrag.klauseln ?? []).map((k) => ({ id: k.id, text: `${k.id} — ${k.titelpfad?.[k.titelpfad.length - 1] ?? ''}${seitenText(k.id) ? ` (${seitenText(k.id)})` : ''}` }));

  // Als Funktion aufgerufen, nicht als eigene Komponente: sonst baut React die Eingaben bei jedem Tastendruck neu auf.
  function karte(el) {
    const s = status(el);
    const k = vertrag.katalog?.[el];
    const zeilen = mitFeldern ? wertZeilen(el, felder, values) : wertZeilenAusKatalog(el, k?.wert);
    const offenEdit = inBearbeitung === el;
    return (
      <div key={el} style={styles.karte}>
        <div style={styles.kartenKopf}>
          {pruefModus && mitFeldern && (
            <label style={styles.check} title="Am Original geprüft">
              <input type="checkbox" checked={!!geprueft[el]} onChange={(e) => onGeprueft?.(el, e.target.checked)} />
            </label>
          )}
          <span style={styles.kartenTitel}>
            {KATALOG_LABEL[el] ?? el}
            {geaendert(el) && <span style={{ ...styles.hinweis, color: theme.colors.info, marginLeft: theme.spacing.sm }}>korrigiert</span>}
          </span>
          <Badge bg={STATUS[s]?.bg} fg={STATUS[s]?.fg} title={STATUS[s]?.tip}>{STATUS[s]?.label ?? s}</Badge>
          {bearbeitbar && (
            <button type="button" style={styles.kleinBtn} title="Werte, Status und Fundstellen korrigieren"
              onClick={() => { if (offenEdit) onGeprueft?.(el, true); setInBearbeitung(offenEdit ? null : el); }}>
              <PenIcon size={12} /> {offenEdit ? 'Fertig' : 'Bearbeiten'}
            </button>
          )}
        </div>
        {zeilen.length > 0 && (
          <div style={styles.zeilen}>
            {zeilen.map((z, i) => (
              <div key={i} style={styles.wertZeile}>
                {z.label && <span style={styles.wertLabel}>{z.label}</span>}
                <span style={{ color: z.ton === 'fehlt' ? theme.colors.warning : theme.colors.text, whiteSpace: 'pre-wrap', minWidth: 0 }}>
                  {z.wert}
                  {z.ton === 'liegt' && <span style={{ color: theme.colors.success, marginLeft: theme.spacing.sm }}><CheckCircleIcon size={12} /> liegt bei</span>}
                  {z.ton === 'fehlt' && el === 'anlagen' && <span style={{ marginLeft: theme.spacing.sm }}><AlertTriangleIcon size={12} /> fehlt</span>}
                </span>
              </div>
            ))}
          </div>
        )}
        {(k?.bedingung || k?.verweis) && (
          <div style={{ ...styles.hinweis, marginTop: theme.spacing.sm }}>{k.bedingung ? `Gilt nur, wenn: ${k.bedingung}` : `Verweis: ${k.verweis}`}</div>
        )}
        {fundstellenListe(fundstellen(el), el)}
        {offenEdit && (
          <div style={styles.bearbeiten}>
            <div style={styles.eingabeZeile}>
              <span style={styles.wertLabel}>Regelt der Vertrag „{KATALOG_LABEL[el]}"?</span>
              <div style={styles.statusWahl} role="radiogroup">
                {Object.entries(STATUS).map(([id, st]) => (
                  <button key={id} type="button" role="radio" aria-checked={s === id} title={st.tip}
                    style={{ ...styles.statusOption, ...(s === id ? { backgroundColor: st.bg, color: st.fg, borderColor: st.bg } : {}) }}
                    onClick={() => setzeStatus(el, id)}>{st.option}</button>
                ))}
              </div>
            </div>
            {s === 'nicht_geregelt' ? (
              <div style={styles.hinweis}>
                Nichts einzutragen. Steht doch etwas dazu im Vertrag, oben „Im Vertrag geregelt" wählen — dann erscheinen die Felder.
              </div>
            ) : (
              <>
                {elementFelder(el, felder).filter((id) => felder[id]).map((id) => (
                  <div key={id} style={styles.eingabeZeile}>
                    <span style={styles.wertLabel}>{felder[id].label === KATALOG_LABEL[el] ? 'Einträge' : felder[id].label.replace(`${KATALOG_LABEL[el]}: `, '')}</span>
                    {renderEingabe(id, felder[id])}
                  </div>
                ))}
                <div style={styles.eingabeZeile}>
                  <span style={styles.wertLabel}>Fundstellen im Vertrag</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs, alignItems: 'center' }}>
                    {fundstellen(el).map((id) => (
                      <span key={id} style={{ ...styles.fund, cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs }}>
                        {id}{seitenText(id) ? ` · ${seitenText(id)}` : ''}
                        <button type="button" title="Fundstelle entfernen" style={styles.entfernen}
                          onClick={() => setzeFundstellen(el, fundstellen(el).filter((x) => x !== id))}>×</button>
                      </span>
                    ))}
                    <select value="" style={styles.fundAuswahl} onChange={(e) => e.target.value && setzeFundstellen(el, [...fundstellen(el), e.target.value])}>
                      <option value="">+ Fundstelle hinzufügen …</option>
                      {klauselAuswahl.filter((k) => !fundstellen(el).includes(k.id)).map((k) => <option key={k.id} value={k.id}>{k.text}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: theme.spacing.lg }}>
      {befunde.length > 0 && tab !== 'befunde' && (
        <button type="button" style={styles.befundLeiste} onClick={() => setTab('befunde')}>
          <AlertTriangleIcon size={14} />
          <span style={{ flex: 1 }}>
            {befunde.length === 1 ? '1 Befund' : `${befunde.length} Befunde`}: {[...new Set(befunde.map((b) => BEFUND_LABEL[b.typ] ?? b.typ))].join(', ')}
          </span>
          <span style={{ fontWeight: theme.typography.weights.medium }}>ansehen</span>
        </button>
      )}

      <div style={styles.tabs}>
        {tabs.map(([id, label]) => {
          const warn = (id === 'befunde' && befunde.length > 0) || (id === 'zusatz' && zusatz?.unsicher > 0);
          const aktiv = tab === id;
          return (
            <button key={id} type="button"
              style={{ ...styles.tab, ...(aktiv ? styles.tabActive : {}), ...(warn && !aktiv ? { color: theme.colors.warning } : {}), ...(warn && aktiv ? { backgroundColor: theme.colors.warningLight, color: theme.colors.warning } : {}) }}
              onMouseEnter={(e) => { if (!aktiv) e.currentTarget.style.backgroundColor = theme.colors.surfaceHover; }}
              onMouseLeave={(e) => { if (!aktiv) e.currentTarget.style.backgroundColor = 'transparent'; }}
              onClick={() => setTab(id)}>{label}</button>
          );
        })}
      </div>

      {tab === 'ueberblick' && (
        <div>
          <div style={styles.zusammenfassung}>
            <span style={{ flex: 1, minWidth: 0, color: theme.colors.textSecondary, fontSize: theme.typography.sizes.sm, lineHeight: 1.5 }}>
              Geprüft werden die {REIHENFOLGE.length} Standardelemente eines Vertrags (Parteien, Laufzeit, Kündigung, Entgelte …).
              Davon sind <strong>{geregelt.length + abweichend.length} im Vertrag geregelt</strong>
              {abweichend.length > 0 && <> ({abweichend.length} mit Besonderheit)</>} und <strong>{nichtGeregelt.length} nicht geregelt</strong>.
            </span>
            {pruefModus && pflicht.length > 0 && (
              <span style={{ ...styles.hinweis, whiteSpace: 'nowrap', color: erledigt === pflicht.length ? theme.colors.success : theme.colors.textMuted }}>
                {erledigt} von {pflicht.length} geprüft
              </span>
            )}
          </div>

          {abweichend.length > 0 && <div style={{ ...styles.zwischenTitel, marginTop: 0 }}>Im Vertrag geregelt — mit Besonderheit</div>}
          {abweichend.map(karte)}

          {geregelt.length > 0 && <div style={{ ...styles.zwischenTitel, ...(abweichend.length ? {} : { marginTop: 0 }) }}>Im Vertrag geregelt</div>}
          {geregelt.map(karte)}

          {nichtGeregelt.length > 0 && (
            <>
              <div style={{ ...styles.zwischenTitel, display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                <span style={{ flex: 1 }}>Im Vertrag nicht geregelt ({nichtGeregelt.length})</span>
                {pruefModus && mitFeldern && (
                  <label style={{ ...styles.check, textTransform: 'none', letterSpacing: 0, fontWeight: theme.typography.weights.normal }}>
                    <input type="checkbox" checked={!!geprueft[NICHT_GEREGELT_SCHLUESSEL]} onChange={(e) => onGeprueft?.(NICHT_GEREGELT_SCHLUESSEL, e.target.checked)} />
                    geprüft
                  </label>
                )}
              </div>
              <details style={styles.karte}>
                <summary style={{ cursor: 'pointer', color: theme.colors.textMuted }}>
                  {nichtGeregelt.map((el) => KATALOG_LABEL[el] ?? el).join(', ')}
                </summary>
                <div style={{ marginTop: theme.spacing.md }}>
                  <div style={{ ...styles.hinweis, marginBottom: theme.spacing.sm }}>Ist eines davon doch geregelt: „Bearbeiten" in der Karte und „Im Vertrag geregelt" wählen.</div>
                  {nichtGeregelt.map(karte)}
                </div>
              </details>
            </>
          )}

          {(vertrag.verknuepfungen ?? []).length > 0 && (
            <>
              <div style={styles.zwischenTitel}>Bezüge zu anderen Verträgen</div>
              <div style={styles.karte}>
                {vertrag.verknuepfungen.map((v, i) => (
                  <div key={i} style={styles.wertZeile}><span style={styles.wertLabel}>{v.art.replace('_', ' ')}</span><span>{v.wert}</span></div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'pflichten' && (
        <div>
          <div style={{ ...styles.hinweis, marginBottom: theme.spacing.sm }}>Fristen sind als Regel angegeben — die Berechnung konkreter Termine übernimmt das Fristenradar.</div>
          {(vertrag.inventar ?? []).map((e, i) => (
            <div key={i} style={styles.zeile}>
              <div style={{ display: 'flex', gap: theme.spacing.sm, flexWrap: 'wrap', alignItems: 'baseline' }}>
                <Badge bg={theme.colors.surfaceHover} fg={theme.colors.text}>{TYP_LABEL[e.typ] ?? e.typ}</Badge>
                <Badge bg={e.modalitaet === 'bemueht' || e.modalitaet === 'soll' ? theme.colors.warningLight : theme.colors.primaryLight}
                  fg={e.modalitaet === 'bemueht' || e.modalitaet === 'soll' ? theme.colors.warning : theme.colors.primary}>{MODAL_LABEL[e.modalitaet] ?? e.modalitaet}</Badge>
                <span style={{ fontWeight: theme.typography.weights.medium }}>{e.partei}</span>
                {e.gegenueber && <span style={styles.hinweis}>gegenüber {e.gegenueber}</span>}
              </div>
              <div style={{ marginTop: theme.spacing.xs }}>{e.inhalt}</div>
              {(e.frist || e.ausloeser || e.bedingung) && (
                <div style={{ ...styles.hinweis, marginTop: theme.spacing.xs }}>
                  {[e.frist && `Frist: ${e.frist.wortlaut || [e.frist.dauer, e.frist.einheit, e.frist.richtung, e.frist.bezug].filter(Boolean).join(' ')}`,
                    e.ausloeser && `Auslöser: ${e.ausloeser}`, e.bedingung && `Bedingung: ${e.bedingung}`].filter(Boolean).join(' · ')}
                </div>
              )}
              {fundstellenListe(e.klauseln, `i${i}`)}
            </div>
          ))}
        </div>
      )}

      {tab === 'klauseln' && (
        <div>
          <input style={styles.suche} placeholder="In Klauseln suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} />
          {(vertrag.klauseln ?? [])
            .filter((k) => { const q = suche.trim().toLowerCase(); return !q || k.text.toLowerCase().includes(q) || k.titelpfad.join(' ').toLowerCase().includes(q); })
            .map((k) => (
              <div key={k.id} style={{ ...styles.zeile, paddingLeft: `calc(${theme.spacing.md} * ${Math.max(0, k.ebene - 1)})`, cursor: 'pointer' }} onClick={() => zeigen('k', k.id)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm }}>
                  <span><span style={{ color: theme.colors.primary }}>{k.id}</span> {k.ebene === 1 ? k.titelpfad[0] : k.titelpfad[k.titelpfad.length - 1]}</span>
                  <span style={styles.hinweis}>{seitenText(k.id)}{k.rolle !== 'vertragstext' ? ` · ${k.rolle}` : ''}</span>
                </div>
                {offen === `k|${k.id}` && <div style={styles.wortlaut}>{k.text || '(ohne Text)'}</div>}
              </div>
            ))}
        </div>
      )}

      {tab === 'zusatz' && zusatz && (
        <div>
          <div style={{ ...styles.zusammenfassung, justifyContent: 'space-between' }}>
            <span style={styles.hinweis}>Eigene Felder dieses Profils{zusatz.unsicher > 0 ? ` · ${zusatz.unsicher} unsicher` : ''}</span>
            {pruefModus && (
              <label style={styles.check}>
                <input type="checkbox" checked={!!geprueft[zusatz.schluessel]} onChange={(e) => onGeprueft?.(zusatz.schluessel, e.target.checked)} />
                Zusatzfelder am Original geprüft
              </label>
            )}
          </div>
          {zusatz.render({
            // Leere Liste → nichts anzeigen; sonst Chips wie im Überblick.
            fundstellenFuer: (fid) => fundstellenListe(vertrag.feld_fundstellen?.[fid] ?? [], `z-${fid}`),
          })}
        </div>
      )}

      {tab === 'volltext' && <VolltextPane volltext={volltext} onJumpToPage={onJumpToPage} />}

      {tab === 'befunde' && (
        <div>
          {befunde.length === 0 && <div style={styles.hinweis}>Keine Befunde.</div>}
          {befunde.map((b, i) => (
            <div key={i} style={styles.zeile}>
              <Badge bg={theme.colors.warningLight} fg={theme.colors.warning}>{BEFUND_LABEL[b.typ] ?? b.typ}</Badge>
              <div style={{ marginTop: theme.spacing.xs }}>{b.text}</div>
              {fundstellenListe(b.klauseln, `b${i}`)}
            </div>
          ))}
          {(vertrag.gueltigkeit ?? []).length > 0 && (
            <>
              <div style={styles.zwischenTitel}>Nicht geltender bzw. handschriftlicher Text</div>
              {vertrag.gueltigkeit.map((g, i) => (
                <div key={i} style={styles.zeile}>
                  <span style={styles.hinweis}>{g.art === 'gestrichen' ? 'gestrichen' : g.art === 'nicht_angekreuzt' ? 'nicht angekreuzt' : 'handschriftlich'} · {g.klausel}</span>
                  <div style={{ marginTop: theme.spacing.xs, ...(g.art === 'gestrichen' ? { textDecoration: 'line-through', color: theme.colors.textMuted } : {}) }}>{g.text}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
