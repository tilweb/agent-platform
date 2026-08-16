/**
 * Bauanleitungs-Generierung (D-061 interaktiv).
 *
 * Leitet aus der RGA (benotete Dimensionen + Befunde + Top-Hebel) eine
 * priorisierte, abhakbare Bauanleitung zum Ziel-Reifegrad ab — geerdet in
 * den Bau-Prinzipien, Absicherungs-Mustern und Bau-Ansätzen je Dimension
 * (WB25/44d/50). Instruct-Modell (strukturierte Generierung, schnell),
 * per ENV umschaltbar.
 */
import { llmService, type Message } from '../../services/llm';
import { ALL_DIMS, DIM_LABEL, type Dim } from './scoring';
import type { Baustand, Bauanleitung, Baukarte } from './types';

const BAUANLEITUNG_MODEL = {
  providerId: process.env.ECHOLOOP_BAUANLEITUNG_PROVIDER || 'adacor',
  modelId: process.env.ECHOLOOP_BAUANLEITUNG_MODEL || 'qwen3-5-a3b-35b-256k', // Instruct
};

/** Kondensiertes Methodik-Wissen (WB25 Prinzipien + C2-Muster, WB44d Bau-Ansätze). */
const METHODE = `Bau-Prinzipien (WB25): Warte auf Signal statt auf Zeit · Klick an Fund/Anker binden (Finden & Klicken) statt feste Koordinate · Jeder Prozess kennt seinen Ausgang (Erfolg- UND Fehler-Ausgang) · Idempotenz (Erledigtes markieren + Einstiegs-Filter) · Modularität (Master/Sub, CONFIG-Provider) · Human-in-the-loop für Unumkehrbares (gebündelt zurückspielen, nicht zurück-suchen lassen) · Robust zuerst (safe by default, fail loud statt still falsch).
7 Absicherungs-Muster: Signal-Warten · Recovery beim Start · Idempotenz-Marker · Erfolgs-Flag · Fenster-Normalisierung vor Tippen · Validierungs-Gate VOR Unumkehrbarem · Fehler-Queue statt Silent-Fail.
Bau-Ansätze je Dimension (WB44d):
- D1 Anker: feste Klicks an den Fund binden (Finden & Klicken); Text-Suchen durch Bild-/Form-Anker ersetzen; Suchbereich eingrenzen + Mindest-Trefferwert.
- D2 Timing: feste Wartezeit durch „Warten auf Element/Anker" ersetzen (Finden mit Zeitlimit / kleine Warte-Schleife: kurz warten → nachschauen → Deckel). Bestehende Waits NICHT verlängern.
- D3 Fehler/Ausgänge: Sonderfall-Prüfungen als saubere Verzweigung mit definiertem Ende + Status; generischer Catch-All (unbekannt → Screenshot, nie blind); Lauf-Status je Durchlauf.
- D4 Selbstheilung: unerwartete Dialoge abfangen (erkannt → schließen → weiter, sonst definierter Abbruch); EIN zweiter Versuch an den empfindlichsten Stellen; Recovery beim Start.
- D5 Idempotenz: Status-Marker unmittelbar NACH dem irreversiblen Schritt setzen; Einstiegs-Filter auf „noch nicht bearbeitet"; Abbruch-Probe zwischen Aktion und Marker.
- D6 Konfiguration: CONFIG-Excel/Provider für Pfade, Namen, Links; Einstellungs-Lader am Start (Änderungen ohne Prozess-Öffnung).
- D7 Messung: Lauf-Protokoll je Vorgang (eine Zeile: verarbeitet/übersprungen + Grund); Zähler mitführen.
- D8 Sicherheit: Kennwort in den Tresor; Freigabelinks als sensibel behandeln + in die Einstellungs-Datei.
- D9 Modularität: großen Block in 2–3 Bausteine schneiden; gemeinsame Bausteine (Browser öffnen/aufräumen, Config-Lader).
- D10 Portabilität: Config/Secrets externalisieren (erledigt meist die D6-Arbeit mit); nur bei geplanter Übertragung.
Bau-Logik-Reihenfolge der Karten: (1) ZUERST offene ❓ am Panel/Graph klären (aus den „frage"-Befunden) — bestimmt den Umfang. (2) DANN kundenwirksame Fehler zuerst (z. B. Doppelversand D5) — was der Empfänger sofort sieht. (3) DANN der Level-Blocker (Dimension mit größtem Ist<Soll-Abstand, die den Ziel-RG blockiert). (4) DANN Härtung der Wackelkandidaten (Timing D2, Anker D1, Konfiguration D6).`;

/**
 * Fundament-Welle (R4, Zwei-Naturen-Standard): jede Bauanleitung startet mit
 * „Fundament ohne Umbau" — drei Anker, die jede weitere Stufe tragen und OHNE
 * Prozess-Umbau setzbar sind. Deterministisch (nicht LLM-generiert), damit sie
 * immer und korrekt vorhanden ist; die LLM-Karten bauen darauf auf (ab BK-1).
 */
export function fundamentWelle(): Baukarte {
  return {
    id: 'BK-F',
    titel: 'Fundament ohne Umbau (zuerst — Voraussetzung, kein Umbau)',
    dimension: 'D6',
    prio: 'hoch',
    warum: 'Diese drei Anker tragen jede weitere Reifegrad-Stufe und sind ohne Eingriff in die Prozess-Logik setzbar. Sie sind die Fundament-Welle (R4): erst das Fundament, dann der Umbau.',
    schritte: [
      { text: 'Config-Bootstrap: Einstellungs-Datei mit fester Ablage (fester Anker), Existenz-Gate beim Start (fehlt die Datei → definierter Stopp statt Blindlauf) und Versionszeile im Kopf (K-23). Sicherstellen, falls noch nicht vorhanden. → Vereinbarungs-Gate D6-L3.', done: false },
      { text: 'Erfolgs-Semantik: jeder Prozess endet mit einem klaren A_Ergebnis — OK (verarbeitet), NICHTS-ZU-TUN (nichts zu tun, kein Fehler) oder GESTOPPT (bewusst abgebrochen, mit Grund). Kein stiller Erfolg, kein blindes Durchlaufen.', done: false },
      { text: 'Prozess-Kopfblock: Kopf-Kommentar mit Zweck, Auslöser, Ein-/Ausgaben und Pflege-Owner anlegen — der Prozess dokumentiert sich selbst.', done: false },
    ],
    status: 'offen',
    feedback: '',
  };
}

interface RawKarte {
  id?: string;
  titel?: string;
  dimension?: string;
  prio?: string;
  warum?: string;
  schritte?: unknown;
}

export function parseBauanleitungResponse(content: string): { zielLevel?: number; einleitung?: string; karten?: RawKarte[] } | null {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.karten)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function normPrio(p: unknown): Baukarte['prio'] {
  return p === 'hoch' || p === 'niedrig' ? p : 'mittel';
}

/** Nächst-höheres Ziel-Level (default = Gesamt-RG + 1, gedeckelt bei 5). */
function defaultZielLevel(baustand: Baustand): number {
  return Math.min((baustand.kennzahlen?.gesamtRg ?? 0) + 1, 5);
}

export async function generateBauanleitung(opts: {
  baustand: Baustand;
  zielLevel?: number;
  userId?: string;
  timeoutMs?: number;
}): Promise<Bauanleitung> {
  const { baustand, userId } = opts;
  const zielLevel = opts.zielLevel ?? defaultZielLevel(baustand);
  const timeoutMs = opts.timeoutMs ?? (Number(process.env.ECHOLOOP_BAUANLEITUNG_TIMEOUT_MS) || 120_000);

  const gaps = ALL_DIMS
    .map((d) => ({ d, dim: baustand.dimensionen?.[d] }))
    .filter(({ dim }) => dim && dim.relevanz !== 0 && (dim.soll ?? 0) > (dim.ist ?? 0))
    .map(({ d, dim }) => `${d.toUpperCase()} ${DIM_LABEL[d]}: Ist L${dim!.ist} → Soll L${dim!.soll}${dim!.beleg ? ` (${dim!.beleg})` : ''}`)
    .join('\n');
  const befunde = (baustand.befunde ?? [])
    .filter((f) => f.schwere !== 'niedrig')
    .slice(0, 25)
    .map((f) => `- ${f.pm} [${f.schwere}] P${f.prozessNr}${f.schrittId != null ? ` S${f.schrittId}` : ''}: ${f.befund}`)
    .join('\n');
  const hebel = (baustand.topHebel ?? []).map((t) => `- [${t.dim}] ${t.titel}: ${t.wirkung}`).join('\n');
  const offeneFragen = (baustand.befunde ?? [])
    .filter((f) => f.schwere === 'frage')
    .slice(0, 10)
    .map((f) => `- ${f.aspekt} (P${f.prozessNr}${f.schrittId != null ? ` S${f.schrittId}` : ''}): ${f.empfehlung}`)
    .join('\n');

  const system: Message = {
    role: 'system',
    content: `Du bist Bau-Berater für RPA-Prozesse (EMMA Studio). Erstelle eine priorisierte, umsetzbare Bauanleitung zum Ziel-Reifegrad RG${zielLevel}, geerdet in dieser Methodik:
${METHODE}

Antworte AUSSCHLIESSLICH mit JSON in genau dieser Form:
{
  "zielLevel": ${zielLevel},
  "einleitung": "<2-3 Sätze: Ausgangsstand (RGA), der zentrale Blocker für RG${zielLevel}, was diese Anleitung erreicht>",
  "karten": [
    { "id": "BK-1", "titel": "Zuerst: offene ❓ am Panel/Graph klären", "dimension": "", "prio": "hoch", "warum": "<warum zuerst>", "schritte": ["<konkreter Schritt mit Schritt-Zitat wo möglich>", "…"] },
    { "id": "BK-2", "titel": "<Maßnahme> (D5)", "dimension": "D5", "prio": "hoch", "warum": "<kundenwirksam, 1-2 Sätze>", "schritte": ["…"] }
  ]
}
Regeln: Die Karte „Fundament ohne Umbau" (BK-F: Config-Bootstrap, Erfolgs-Semantik A_Ergebnis, Prozess-Kopfblock) ist bereits als erste Karte gesetzt — NICHT wiederholen; deine Karten bauen darauf auf und beginnen bei BK-1. Reihenfolge = Bau-Logik (siehe oben). Jede Karte adressiert eine konkrete Lücke/einen Befund; Schritte sind imperativ und nennen wo möglich die Schritt-Nummer aus den Befunden (z. B. „S25"). 3–8 Karten. Keine Kennzahlen erfinden. Für Dimensionen ohne Lücke keine Karte.`,
  };
  const user: Message = {
    role: 'user',
    content: `## Reifegrad-Lücken (Ist < Soll)\n${gaps || '(keine)'}\n\n## Offene ❓ (zuerst klären)\n${offeneFragen || '(keine)'}\n\n## Deterministische Befunde\n${befunde || '(keine)'}\n\n## Priorisierte Top-Hebel\n${hebel || '(keine)'}`,
  };

  const res = await Promise.race([
    llmService.chat([system, user], undefined, { source: 'document_analysis', operation: 'echoloop_bauanleitung', triggeringUserId: userId, userId }, { modelOverride: BAUANLEITUNG_MODEL }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Bauanleitung-Timeout nach ${timeoutMs}ms`)), timeoutMs)),
  ]);

  const parsed = parseBauanleitungResponse(res.content ?? '');
  if (!parsed) throw new Error('Bauanleitung-Antwort nicht als JSON parsebar');

  // Fundament-Welle (R4) fest voran; LLM-Karten bauen darauf auf (BK-1 …).
  const llmKarten: Baukarte[] = (parsed.karten ?? []).map((k, i) => ({
    id: typeof k.id === 'string' && k.id && k.id !== 'BK-F' ? k.id : `BK-${i + 1}`,
    titel: k.titel ?? `Maßnahme ${i + 1}`,
    dimension: typeof k.dimension === 'string' ? k.dimension : undefined,
    prio: normPrio(k.prio),
    warum: k.warum ?? '',
    schritte: Array.isArray(k.schritte) ? k.schritte.filter((s) => typeof s === 'string').map((text) => ({ text, done: false })) : [],
    status: 'offen',
    feedback: '',
  }));
  const karten: Baukarte[] = [fundamentWelle(), ...llmKarten];

  return {
    zielLevel,
    einleitung: parsed.einleitung ?? '',
    karten,
    erzeugtAm: new Date().toISOString(),
    modell: BAUANLEITUNG_MODEL.modelId,
  };
}
