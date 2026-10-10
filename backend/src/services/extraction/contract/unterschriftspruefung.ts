/**
 * Unterschriftspruefung — zweiter, gezielter Blick auf Unterschriftsseiten.
 *
 * Die Transkription liest Unterschriftsfelder gelegentlich falsch (leere Linie als
 * „unterschrieben", V3). Ein falsch bestaetigte Unterschrift ist fuer Vertraege der
 * teuerste Fehler. Darum fragt ein eigener, kleiner Bildaufruf je Unterschriftsseite
 * Feld fuer Feld: Tinte auf der Linie ja/nein? Stimmen Transkription und Pruefung
 * nicht ueberein, wird die Markierung zu {{unterschrift unklar | Partei}} — die
 * Konsolidierung macht daraus „Unterschrift prüfen" statt einer sicheren Aussage.
 */

import type { ContentPart, Message } from '../../llm';
import { gleichePartei, unterschriftsMarken } from './konsolidierung';
import { rufeModell, parallelBegrenzt, type ModellKontext } from './modell';
import type { SeitenBild } from './transkription';
import type { SeitenTranskript } from './types';

export interface FeldBefund { partei: string; unterschrieben: boolean }
export interface SeitenPruefung { seite: number; felder: FeldBefund[] }

const PRUEF_SYSTEM = `Du prüfst die Unterschriftsfelder auf einer Seite eines deutschen Vertrags.
Ein Unterschriftsfeld ist eine Linie, auf der eine Partei unterschreiben soll.
Liste JEDES Unterschriftsfeld der Seite einzeln auf, von links nach rechts und oben nach unten:
- partei: zu welcher Vertragspartei das Feld gehört — die Rollen- oder Firmenbezeichnung über dem Unterschriftsblock (z. B. "Auftraggeber:", "Auftragnehmer:") oder direkt unter der Linie (z. B. "Kunde", "EMobility Netzwerk Deutschland GmbH"). NICHT die Formularbeschriftung wie "Unterschrift und Firmenstempel" oder "Ort, Datum".
- position: "links", "rechts" oder "mitte"
- unterschrieben: true NUR, wenn auf oder direkt über der Linie eine handschriftliche Unterschrift, ein Handzeichen oder ein eingefügtes Unterschriftsbild zu sehen ist. Eine leere Linie ist false — auch wenn Ort und Datum ausgefüllt sind, ein Stempel daneben steht oder das Nachbarfeld unterschrieben ist.
Briefkopf und Fußzeile (z. B. Geschäftsführer-Namen) sind keine Unterschriften, Kürzel am Seitenrand ebenfalls nicht.`;

const SCHEMA = {
  type: 'object',
  properties: {
    felder: {
      type: 'array',
      items: { type: 'object', properties: { partei: { type: 'string' }, position: { type: 'string', enum: ['links', 'rechts', 'mitte'] }, unterschrieben: { type: 'boolean' } }, required: ['partei', 'unterschrieben'], additionalProperties: false },
    },
  },
  required: ['felder'],
  additionalProperties: false,
};

/** Seiten mit Unterschriftsfeldern: Rolle „unterschriften" oder parteigebundene Markierung. */
export function seitenZurPruefung(seiten: SeitenTranskript[]): number[] {
  return seiten
    .filter((s) => !s.fehler && (s.rolle === 'unterschriften' || /\{\{\s*(?:keine unterschrift|unterschrift:[^}]*\|)/i.test(s.text)))
    .map((s) => s.seite);
}

export async function pruefeSeite(kontext: ModellKontext, bild: SeitenBild): Promise<SeitenPruefung | null> {
  const inhalt: ContentPart[] = [
    { type: 'text', text: 'Antworte als JSON {"felder": [{"partei", "position", "unterschrieben"}]}. Keine Unterschriftsfelder auf der Seite → leere Liste.' },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${bild.png.toString('base64')}`, detail: 'high' } },
  ];
  const messages: Message[] = [{ role: 'system', content: PRUEF_SYSTEM }, { role: 'user', content: inhalt }];
  try {
    const a = await rufeModell(kontext, {
      messages, schema: SCHEMA, name: 'unterschriftspruefung', operation: 'contract_signature_check',
      timeoutMs: 120_000, maxTokens: 8192, label: `contract-structured Unterschriftsprüfung S. ${bild.seite}`,
    });
    const felder = Array.isArray(a.json?.felder) ? (a.json!.felder as unknown[]) : null;
    if (!felder) return null;
    return {
      seite: bild.seite,
      felder: felder
        .filter((f): f is FeldBefund => !!f && typeof (f as FeldBefund).partei === 'string' && typeof (f as FeldBefund).unterschrieben === 'boolean')
        .map((f) => ({ partei: f.partei.trim(), unterschrieben: f.unterschrieben })),
    };
  } catch {
    return null; // Pruefung ist eine Absicherung — ohne sie bleibt die Transkription unveraendert.
  }
}

/**
 * Markierungen gegen die Pruefung abgleichen. Nur parteigebundene Markierungen, deren Partei
 * genau einem geprueften Feld zuzuordnen ist; Widerspruch → {{unterschrift unklar | Partei}}.
 */
export function gleicheMitPruefungAb(seite: SeitenTranskript, pruefung: SeitenPruefung): { seite: SeitenTranskript; widersprueche: number } {
  let widersprueche = 0;
  const text = seite.text.replace(/\{\{\s*(keine unterschrift\s*|unterschrift:[^|}]*)\|\s*([^}]+?)\s*\}\}/gi, (ganz, _art: string, partei: string) => {
    const marke = unterschriftsMarken(ganz)[0];
    if (!marke) return ganz;
    const treffer = pruefung.felder.filter((f) => gleichePartei(f.partei, partei));
    if (treffer.length !== 1 || treffer[0]!.unterschrieben === marke.vorhanden) return ganz;
    widersprueche++;
    return `{{unterschrift unklar | ${partei}}}`;
  });
  return { seite: widersprueche ? { ...seite, text } : seite, widersprueche };
}

export async function pruefeUnterschriften(
  kontext: ModellKontext, bilder: SeitenBild[], seiten: SeitenTranskript[], parallel: number,
): Promise<{ seiten: SeitenTranskript[]; aufrufe: number; widersprueche: number }> {
  const nummern = new Set(seitenZurPruefung(seiten));
  const zuPruefen = bilder.filter((b) => nummern.has(b.seite));
  const pruefungen = await parallelBegrenzt(zuPruefen, parallel, (b) => pruefeSeite(kontext, b));
  const jeSeite = new Map(pruefungen.filter((p): p is SeitenPruefung => !!p).map((p) => [p.seite, p]));
  let widersprueche = 0;
  const neu = seiten.map((s) => {
    const p = jeSeite.get(s.seite);
    if (!p) return s;
    const r = gleicheMitPruefungAb(s, p);
    widersprueche += r.widersprueche;
    return r.seite;
  });
  return { seiten: neu, aufrufe: zuPruefen.length, widersprueche };
}
