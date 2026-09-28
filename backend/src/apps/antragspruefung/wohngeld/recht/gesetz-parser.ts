/**
 * Parser für die amtliche XML-Fassung von gesetze-im-internet.de (DTD gii-norm 1.01).
 *
 * Zerlegt ein Gesetz in Absätze (Einheit einer Fundstelle, z. B. „§ 14 Abs. 2 WoGG").
 * Der Wortlaut wird NICHT verändert: Es werden nur Auszeichnungen entfernt, Aufzählungen
 * als nummerierte Zeilen und Tabellen als Zeilen („Zelle | Zelle") wiedergegeben.
 * Reine Funktionen, ohne IO — genutzt vom Importskript und von Tests.
 *
 * Spec: docs/wohngeld-gesetzes-nachschlagen-spec-2026-09-24.md
 */

export interface GesetzAbsatz {
  /** Stabile ID, z. B. „wogg-14-abs2", „wogg-3", „wogg-anlage-1", „sgb1-66-abs1". */
  id: string;
  /** Amtliche Abkürzung, z. B. „WoGG", „WoGV", „SGB I". */
  gesetz: string;
  /** „§ 14" bzw. „Anlage 1". */
  paragraph: string;
  /** „Abs. 2" — fehlt bei Paragraphen ohne nummerierte Absätze und bei Anlagen. */
  absatz?: string;
  /** Amtliche Überschrift des Paragraphen. */
  titel: string;
  /** Amtlicher Wortlaut des Absatzes. */
  text: string;
  /** Link auf die amtliche Einzelnorm. */
  url: string;
}

export interface GesetzQuelle {
  gesetz: string;
  /** Langbezeichnung, z. B. „Wohngeldgesetz". */
  name: string;
  /** Stand laut amtlicher Fassung, z. B. „Zuletzt geändert durch Art. 11 Abs. 8 G v. 16.4.2026 I Nr. 107". */
  stand: string;
  /** Erstellungsdatum der XML (JJJJ-MM-TT). */
  abgerufen: string;
  url: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function dekodiere(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
}

/** Inhalt eines <P> (oder einer Anlage) in lesbaren Text mit Zeilenstruktur. */
export function absatzText(xml: string): string {
  let s = xml
    .replace(/<noindex>[\s\S]*?<\/noindex>/g, '')
    .replace(/<SUP[^>]*>([\s\S]*?)<\/SUP>/gi, '$1')
    .replace(/<BR\s*\/?>/gi, '\n')
    // Aufzählungen: „1." + Text in eine eigene Zeile.
    .replace(/<DT[^>]*>([\s\S]*?)<\/DT>/g, '\n$1 ')
    .replace(/<\/DL>/g, '\n')
    // Tabellen: Zeile je <row>, Zellen mit „ | ".
    .replace(/<row[^>]*>/g, '\n')
    .replace(/<\/entry>\s*<entry[^>]*>/g, ' | ')
    .replace(/<\/?(Content|P|DL|DD|LA|table|tgroup|colspec|thead|tbody|row|entry|Split|F|SUB|pre|kommentar)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ');
  s = dekodiere(s);
  return s
    .split('\n')
    .map((z) => z.replace(/[ \t ]+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const inhalt = (s: string, tag: string) => {
  const m = s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
  return m ? m[1]! : '';
};

export interface ParseOptionen {
  /** ID-Präfix, z. B. „wogg". */
  schluessel: string;
  /** Pfad auf gesetze-im-internet.de, z. B. „wogg" oder „sgb_1". */
  pfad: string;
  /** Nur diese Paragraphen übernehmen (Nummern als Text, z. B. ["60","61"]). Fehlt ⇒ alle. */
  nurParagraphen?: string[];
  /** Anlagen übernehmen (Standard: ja). */
  anlagen?: boolean;
  /** Anzeige-Abkürzung (sonst aus der XML). */
  abkuerzung?: string;
}

/** Stand der Fassung: bevorzugt „Zuletzt geändert …", sonst alle Standangaben. */
function standAus(kopf: string): string {
  const angaben = (kopf.match(/<standangabe[\s\S]*?<\/standangabe>/g) ?? [])
    .map((a) => dekodiere(inhalt(a, 'standkommentar')).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  return angaben.find((a) => /zuletzt geändert/i.test(a)) ?? angaben.join('; ');
}

/** Zerlegt eine amtliche Gesetzes-XML in Absätze und Quellenangabe. */
export function parseGesetzXml(xml: string, o: ParseOptionen): { quelle: GesetzQuelle; absaetze: GesetzAbsatz[] } {
  const normen = xml.match(/<norm [\s\S]*?<\/norm>/g) ?? [];
  const kopf = normen[0] ?? '';
  const abk = o.abkuerzung ?? dekodiere(inhalt(kopf, 'amtabk') || inhalt(kopf, 'jurabk')).trim();
  const basisUrl = `https://www.gesetze-im-internet.de/${o.pfad}/`;
  const build = (xml.match(/builddate="(\d{8})/)?.[1] ?? '');
  const quelle: GesetzQuelle = {
    gesetz: abk,
    name: dekodiere(inhalt(kopf, 'langue')).trim(),
    stand: standAus(kopf),
    abgerufen: build ? `${build.slice(0, 4)}-${build.slice(4, 6)}-${build.slice(6, 8)}` : '',
    url: basisUrl,
  };

  const absaetze: GesetzAbsatz[] = [];
  for (const n of normen) {
    const meta = inhalt(n, 'metadaten');
    const enbez = dekodiere(inhalt(meta, 'enbez')).trim();
    const para = enbez.match(/^§\s*(\d+[a-z]?)$/);
    const anlage = enbez.match(/^Anlage\s*(\d+[a-z]?)?/);
    if (!para && !anlage) continue;
    if (para && o.nurParagraphen && !o.nurParagraphen.includes(para[1]!)) continue;
    if (anlage && (o.anlagen === false || o.nurParagraphen)) continue;

    const titel = absatzText(inhalt(meta, 'titel'));
    const content = inhalt(inhalt(n, 'textdaten'), 'text');
    if (!content.trim()) continue;

    if (anlage) {
      const nr = anlage[1] ?? '';
      const text = absatzText(content);
      if (text) absaetze.push({ id: `${o.schluessel}-anlage-${nr || 'x'}`, gesetz: abk, paragraph: enbez, titel, text, url: basisUrl });
      continue;
    }

    const nr = para![1]!;
    const url = `${basisUrl}__${nr}.html`;
    const ps = (content.match(/<P[^>]*>[\s\S]*?<\/P>/g) ?? []).map(absatzText).filter(Boolean);
    const nummeriert = ps.filter((p) => /^\(\d+[a-z]?\)/.test(p));
    if (ps.length > 1 && nummeriert.length === ps.length) {
      for (const p of ps) {
        const abs = p.match(/^\((\d+[a-z]?)\)/)![1]!;
        absaetze.push({ id: `${o.schluessel}-${nr}-abs${abs}`, gesetz: abk, paragraph: `§ ${nr}`, absatz: `Abs. ${abs}`, titel, text: p, url });
      }
    } else if (nummeriert.length >= 1 && ps.length > 1) {
      // Gemischt (z. B. Einleitungssatz + Absätze): Nicht-nummerierte Teile an den vorherigen Absatz hängen.
      let aktuell: GesetzAbsatz | null = null;
      for (const p of ps) {
        const m = p.match(/^\((\d+[a-z]?)\)/);
        if (m || !aktuell) {
          const abs = m?.[1];
          aktuell = { id: abs ? `${o.schluessel}-${nr}-abs${abs}` : `${o.schluessel}-${nr}`, gesetz: abk, paragraph: `§ ${nr}`, ...(abs ? { absatz: `Abs. ${abs}` } : {}), titel, text: p, url };
          absaetze.push(aktuell);
        } else {
          aktuell.text += `\n${p}`;
        }
      }
    } else {
      absaetze.push({ id: `${o.schluessel}-${nr}`, gesetz: abk, paragraph: `§ ${nr}`, titel, text: ps.join('\n'), url });
    }
  }
  return { quelle, absaetze };
}

/** Anzeige-Fundstelle, z. B. „§ 14 Abs. 2 WoGG". */
export function fundstelle(a: Pick<GesetzAbsatz, 'paragraph' | 'absatz' | 'gesetz'>): string {
  return [a.paragraph, a.absatz, a.gesetz].filter(Boolean).join(' ');
}
