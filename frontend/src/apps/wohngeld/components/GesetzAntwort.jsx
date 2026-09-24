import { useState } from 'react';
import { theme } from '../../../config/theme';
import { ScaleIcon, CopyIcon, LinkIcon, ChevronDownIcon } from '../../../components/Icons';
import { wohngeldApi } from '../api';

/** Akzent des Gesetz-Modus (bewusst anders als der Antrags-Modus). */
const G = theme.colors.primaryDark;
const G_LIGHT = theme.colors.primaryLight;

const fold = (s) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');

/** Hebt Wörter hervor, deren Wortstamm einem Suchbegriff entspricht (nur Anzeige, Text bleibt unverändert). */
function Wortlaut({ text, begriffe }) {
  const stems = (begriffe || []).filter((b) => b.length >= 4);
  if (!stems.length) return <>{text}</>;
  const teile = text.split(/([A-Za-zÄÖÜäöüß]+)/);
  return (
    <>
      {teile.map((t, i) => {
        const f = fold(t);
        return stems.some((s) => f.startsWith(s))
          ? <mark key={i} style={styles.mark}>{t}</mark>
          : <span key={i}>{t}</span>;
      })}
    </>
  );
}

const fundstelle = (f) => [f.paragraph, f.absatz, f.gesetz].filter(Boolean).join(' ');

function FundstellenKarte({ f, begriffe }) {
  const [ganz, setGanz] = useState(null); // null | 'laedt' | Absätze[]
  const [kopiert, setKopiert] = useState(false);

  async function ganzenParagraph() {
    if (Array.isArray(ganz)) { setGanz(null); return; }
    setGanz('laedt');
    try { setGanz(await wohngeldApi.getParagraph(f.id)); } catch { setGanz(null); }
  }
  async function kopieren() {
    try {
      await navigator.clipboard.writeText(`${fundstelle(f)} — ${f.titel}\n${f.text}`);
      setKopiert(true);
      setTimeout(() => setKopiert(false), 1500);
    } catch { /* Zwischenablage nicht verfügbar */ }
  }

  const absaetze = Array.isArray(ganz) ? ganz : null;
  return (
    <div style={styles.karte}>
      <div style={styles.kartenKopf}>
        <ScaleIcon size={14} color={G} />
        <span style={styles.fundstelle}>{fundstelle(f)}</span>
        <span style={styles.titel}>{f.titel}</span>
      </div>
      <div style={styles.wortlaut}>
        {absaetze
          ? absaetze.map((a) => (
            <div key={a.id} style={a.id === f.id ? styles.absatzAktiv : styles.absatzWeitere}>
              <Wortlaut text={a.text} begriffe={a.id === f.id ? begriffe : []} />
            </div>
          ))
          : <Wortlaut text={f.text} begriffe={begriffe} />}
      </div>
      <div style={styles.kartenFuss}>
        <span style={styles.stand} title="Stand der amtlichen Fassung">Stand: {f.stand || 'unbekannt'}</span>
        <div style={styles.aktionen}>
          {f.paragraph?.startsWith('§') && (
            <button style={styles.aktion} onClick={ganzenParagraph} disabled={ganz === 'laedt'} aria-expanded={!!absaetze}>
              <ChevronDownIcon size={12} style={{ transform: absaetze ? 'rotate(180deg)' : 'none' }} />
              {absaetze ? 'nur diesen Absatz' : ganz === 'laedt' ? 'lädt …' : `ganzen ${f.paragraph}`}
            </button>
          )}
          <button style={styles.aktion} onClick={kopieren} title="Fundstelle und Wortlaut kopieren">
            <CopyIcon size={12} /> {kopiert ? 'kopiert' : 'kopieren'}
          </button>
          {f.url && (
            <button style={styles.aktion} onClick={() => window.open(f.url, '_blank', 'noopener,noreferrer')} title="Amtliche Fassung auf gesetze-im-internet.de öffnen">
              <LinkIcon size={12} /> Gesetzestext
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/** Antwort im Gesetz-Modus: ausschließlich Fundstellen im amtlichen Wortlaut. */
export default function GesetzAntwort({ message }) {
  const fundstellen = message.fundstellen || [];
  if (!fundstellen.length) {
    return (
      <div style={styles.leer}>
        Keine passende Stelle im WoGG, in der WoGV oder in §§ 60–67 SGB I gefunden.
        Tipp: Paragraph direkt eingeben, z. B. „§ 14 WoGG" oder „§ 66 SGB I".
      </div>
    );
  }
  return (
    <div style={styles.antwort}>
      {message.auswahl === 'vorauswahl' && (
        <div style={styles.vermerk}>Automatische Vorauswahl nach Suchbegriffen — die Auswahl durch den Assistenten war nicht verfügbar.</div>
      )}
      {fundstellen.map((f) => <FundstellenKarte key={f.id} f={f} begriffe={message.suchbegriffe} />)}
    </div>
  );
}

const styles = {
  antwort: { display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, width: '100%' },
  karte: { border: `1px solid ${theme.colors.border}`, borderLeft: `3px solid ${G}`, borderRadius: theme.borderRadius.md, backgroundColor: theme.colors.surface, overflow: 'hidden' },
  kartenKopf: { display: 'flex', alignItems: 'baseline', gap: theme.spacing.sm, padding: `${theme.spacing.sm} ${theme.spacing.md}`, backgroundColor: G_LIGHT, flexWrap: 'wrap' },
  fundstelle: { fontSize: theme.typography.sizes.sm, fontWeight: theme.typography.weights.semibold, color: G },
  titel: { fontSize: theme.typography.sizes.xs, color: theme.colors.text },
  wortlaut: { padding: theme.spacing.md, fontSize: theme.typography.sizes.sm, lineHeight: 1.55, color: theme.colors.text, whiteSpace: 'pre-wrap', fontFamily: 'Georgia, "Times New Roman", serif' },
  absatzAktiv: { marginBottom: theme.spacing.sm },
  absatzWeitere: { marginBottom: theme.spacing.sm, color: theme.colors.textMuted },
  mark: { backgroundColor: theme.colors.warningLight, color: 'inherit', padding: 0 },
  kartenFuss: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm, padding: `${theme.spacing.xs} ${theme.spacing.md}`, borderTop: `1px solid ${theme.colors.borderLight}`, flexWrap: 'wrap' },
  stand: { fontSize: '0.7rem', color: theme.colors.textMuted },
  aktionen: { display: 'flex', gap: theme.spacing.xs, flexWrap: 'wrap' },
  aktion: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', fontSize: '0.72rem', color: G, backgroundColor: 'transparent', border: `1px solid ${G_LIGHT}`, borderRadius: theme.borderRadius.sm, cursor: 'pointer' },
  vermerk: { fontSize: theme.typography.sizes.xs, color: theme.colors.textMuted, fontStyle: 'italic' },
  leer: { fontSize: theme.typography.sizes.sm, color: theme.colors.textMuted, padding: theme.spacing.md, border: `1px dashed ${theme.colors.border}`, borderRadius: theme.borderRadius.md },
};
