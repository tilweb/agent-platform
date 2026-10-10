/**
 * Vertragsauswertung P2 — Transkription je Seite ueber das Bild (Qwen 3.5).
 *
 * Immer der Bildweg, auch bei Textlayer: Vertraege sind ueberwiegend Scans,
 * OCR-Layer sind fehlerhaft und Unterschriften/handschriftliche Daten stehen
 * nur im Bild. Ein vorhandener Textlayer geht als Hilfstext mit.
 *
 * Die Auszeichnung (## Kopf, ~~gestrichen~~, [x]/[ ], {{hs: …}},
 * {{unterschrift: …}}, {{stempel: …}}) traegt bereits die Gueltigkeitsschicht —
 * die Konsolidierung liest sie deterministisch aus.
 */

import type { ContentPart, Message } from '../../llm';
import { rufeModell, parallelBegrenzt, type ModellKontext } from './modell';
import { SEITEN_ROLLEN, type SeitenRolle, type SeitenTranskript } from './types';

export const TRANSKRIPTION_SYSTEM = `Du transkribierst EINE Seite eines Vertragsdokuments wortgetreu (Deutsch). Du fasst nichts zusammen und lässt keinen Vertragstext weg.

Regeln für "text" (Markdown, Lesereihenfolge; gedrehte Seiten richtig herum lesen):
- Überschriften von Paragraphen, Ziffern, Artikeln, Anlagen/Anhängen und der Präambel als eigene Zeile mit "## " davor, inklusive Nummer und Titel (z. B. "## § 6 Vertragsdauer und Kündigung", "## Ziffer 3 Stromversorgung", "## Anlage 1 Standortliste").
- Die Nummer einer Überschrift GENAU so wie im Dokument übernehmen: "3. Stromversorgung" bleibt "## 3. Stromversorgung" (kein "§" ergänzen), "§ 6" bleibt "## § 6".
- Nur Überschriften auszeichnen, die auf DIESER Seite stehen. Beginnt die Seite mit fortgesetztem Text eines vorherigen Abschnitts, KEINE Überschrift dafür erfinden oder wiederholen.
- Nummerierungen von Absätzen exakt übernehmen ("1.", "(2)", "2.5.3", "a)"). Jeder nummerierte Absatz beginnt auf einer neuen Zeile. Zwischen unnummerierten Absätzen eine Leerzeile.
- Durchgestrichenen Text als ~~Text~~ markieren — auch dünne gedruckte Durchstreichungen in Listen, Preistabellen und Optionen sowie Streichungen von Hand. Jede Zeile einzeln prüfen: Ist der Text von einer Linie durchzogen?
- Ankreuzfelder als [x] (angekreuzt) oder [ ] (leer).
- Handschriftliche Einträge als {{hs: Text}}.
- Unterschriftsfelder: für JEDES Feld genau eine Markierung; hinter "|" steht die gedruckte Beschriftung unter oder neben genau diesem Feld. Beispiele:
  {{unterschrift: M. Müller | Kunde}} — auf der Linie ist eine Unterschrift in Tinte oder eine digitale Signatur. Den Namen nur angeben, wenn er in der Unterschrift lesbar ist (nie aus Briefkopf oder Fußzeile), sonst {{unterschrift: vorhanden | Kunde}}.
  {{keine unterschrift | EMobility Netzwerk Deutschland GmbH}} — die Linie ist leer, auch wenn Ort und Datum ausgefüllt sind.
  Ohne gedruckte Beschriftung am Feld: {{unterschrift: vorhanden}} bzw. {{keine unterschrift}}. Stehen Felder nebeneinander, jedes Feld seiner Spalte zuordnen.
- Paraphen (kurze Kürzel am Seitenrand oder -fuß, außerhalb von Unterschriftsfeldern) als {{paraphe: SA}} — sie sind keine Unterschrift.
- Stempel als {{stempel: lesbarer Text}}.
- Nicht lesbare Stellen als {{unleserlich}}.
- Tabellen als Markdown-Tabelle, alle Zeilen und Spalten.
- Wiederkehrender Briefkopf/Logo und Fußzeile (Registergericht, Bankverbindung, Geschäftsführer, Kontaktdaten des Briefbogens) NICHT in "text", sondern einmal in "fusszeile".
- Seitenzahlen weglassen.

"rolle" der Seite:
- vertragstext: Paragraphen/Ziffern des Vertrags
- deckblatt: Titel, Parteien, Präambel vor dem ersten Paragraphen
- unterschriften: überwiegend Unterschriftsfelder
- anlage: Anlage/Anhang des Vertrags (z. B. Standortliste, Preisblatt)
- mandat: SEPA-Lastschriftmandat o. ä. eigenständiges Formular
- muster: Beispiel-/Musterdokument (z. B. Musterrechnung), kein Vertragsinhalt
- vorlage: leeres Vertragsformular/Vorlage ohne ausgefüllte Daten
- datenblatt: technisches Datenblatt, Zeichnung, Herstellerunterlage
- sonstiges: alles andere
- leer: leere Seite`;

export function transkriptionsSchema(): Record<string, unknown> {
  return {
    type: 'object',
    properties: {
      rolle: { type: 'string', enum: SEITEN_ROLLEN },
      text: { type: 'string' },
      fusszeile: { type: 'string' },
    },
    required: ['rolle', 'text'],
    additionalProperties: false,
  };
}

const istRolle = (r: unknown): r is SeitenRolle => typeof r === 'string' && (SEITEN_ROLLEN as string[]).includes(r);

export interface SeitenBild {
  seite: number;
  png: Buffer;
  /** Textlayer dieser Seite (pdftotext), falls vorhanden. */
  hilfstext?: string;
}

export async function transkribiereSeite(kontext: ModellKontext, bild: SeitenBild, seitenGesamt: number): Promise<SeitenTranskript> {
  const hilfe = bild.hilfstext && bild.hilfstext.replace(/\s+/g, '').length > 200
    ? `\n\nTextlayer dieser Seite als Hilfe (kann Fehler enthalten und Handschrift fehlen — das Bild gilt):\n${bild.hilfstext.slice(0, 12000)}`
    : '';
  const inhalt: ContentPart[] = [
    { type: 'text', text: `Seite ${bild.seite} von ${seitenGesamt}. Antworte als JSON {"rolle", "text", "fusszeile"}.${hilfe}` },
    { type: 'image_url', image_url: { url: `data:image/png;base64,${bild.png.toString('base64')}`, detail: 'high' } },
  ];
  const messages: Message[] = [
    { role: 'system', content: TRANSKRIPTION_SYSTEM },
    { role: 'user', content: inhalt },
  ];
  try {
    const a = await rufeModell(kontext, {
      messages, schema: transkriptionsSchema(), name: 'seitentranskript', operation: 'contract_transcription',
      timeoutMs: 180_000, maxTokens: 8192, label: `contract-structured Transkription S. ${bild.seite}`,
    });
    if (a.json && typeof a.json.text === 'string') {
      return {
        seite: bild.seite,
        rolle: istRolle(a.json.rolle) ? a.json.rolle : 'sonstiges',
        text: a.json.text,
        ...(typeof a.json.fusszeile === 'string' && a.json.fusszeile.trim() ? { fusszeile: a.json.fusszeile.trim() } : {}),
      };
    }
    // Unlesbares JSON: Rohtext als Transkript retten statt die Seite zu verlieren.
    if (a.roh.trim()) return { seite: bild.seite, rolle: 'sonstiges', text: a.roh.trim() };
    return { seite: bild.seite, rolle: 'sonstiges', text: '', fehler: 'leere Modellantwort' };
  } catch (err) {
    return { seite: bild.seite, rolle: 'sonstiges', text: '', fehler: err instanceof Error ? err.message : String(err) };
  }
}

/** Alle Seiten parallel (begrenzt) transkribieren; Reihenfolge bleibt erhalten. */
export async function transkribiere(
  kontext: ModellKontext,
  bilder: SeitenBild[],
  opts: { parallel: number; beiSeite?: (fertig: number, gesamt: number) => void | Promise<void> },
): Promise<SeitenTranskript[]> {
  let fertig = 0;
  return parallelBegrenzt(bilder, opts.parallel, async (b) => {
    const t = await transkribiereSeite(kontext, b, bilder.length);
    fertig += 1;
    await opts.beiSeite?.(fertig, bilder.length);
    return t;
  });
}

/** Textlayer je Seite aus `pdftotext -layout` (Seiten durch Formfeed getrennt). */
export function textlayerJeSeite(layoutText: string): string[] {
  return layoutText.split('\f');
}
