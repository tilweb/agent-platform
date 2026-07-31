/**
 * Kundenfähige Narrativ-Synthese (Gold-Form, D-050-Sprachregeln).
 *
 * On-demand nach dem Review: verdichtet die benoteten Dimensionen + Checker-
 * Belege + Top-Hebel zu einer kundenfähigen RGA-Fassung (exec / „neue-Kollegin"-
 * Prosa / je Dimension Beleg+Empfehlungen). Nutzt bewusst die REASONING-Variante
 * (Qwen 3.5 Thinking), da es echte Analyse-Synthese ist — per ENV umschaltbar.
 *
 * Hinweis: Thinking-Modelle sind langsam und emittieren ggf. <think>-Blöcke —
 * der Parser streift sie ab. Der Aufrufer (SSE-Route) hält die Verbindung per
 * Heartbeat offen.
 */
import { llmService, type Message } from '../../services/llm';
import { ALL_DIMS, DIM_LABEL, type Dim } from './scoring';
import type { Baustand, Narrativ, DimNarrativ } from './types';

/**
 * Modell für die Narrativ-Synthese. Default = Instruct: das Reasoning-Modell
 * (Qwen 3.5 Thinking) ist in dieser Umgebung zu langsam und läuft in HTTP-
 * Timeouts, bevor es antwortet. Instruct liefert dieselbe Gold-Form in ~20 s.
 * Auf Reasoning umstellbar: ECHOLOOP_NARRATIV_MODEL=qwen3-5-a3b-35bthinking-256k.
 */
const NARRATIV_MODEL = {
  providerId: process.env.ECHOLOOP_NARRATIV_PROVIDER || 'adacor',
  modelId: process.env.ECHOLOOP_NARRATIV_MODEL || 'qwen3-5-a3b-35b-256k',
};

/** Statische Zweck-Fragen je Dimension (Laiensprache, aus dem Gold-Standard). */
const DIM_PURPOSE: Record<Dim, string> = {
  d1: 'Findet der Roboter Knöpfe und Felder zuverlässig wieder — auch wenn sich Fenster oder Auflösung ändern?',
  d2: 'Wartet der Prozess auf ein sichtbares Signal statt auf eine fest eingestellte Zeitspanne?',
  d3: 'Was passiert bei einem Sonderfall — ein sauber gemeldeter Status oder ein harter Abbruch mittendrin?',
  d4: 'Kann sich der Prozess selbst helfen (Störfenster wegklicken, neu anmelden, neu starten) — oder braucht er einen Menschen?',
  d5: 'Darf man den Prozess nach einem Abbruch gefahrlos neu starten — ohne dass etwas doppelt angelegt oder versendet wird?',
  d6: 'Stehen Pfade, Filter und Zugangsdaten zentral in einer Einstellung — oder fest im Prozess verdrahtet?',
  d6b: 'Werden Daten sauber zwischen den Schritten übergeben — ohne dass Werte still überschrieben werden?',
  d7: 'Liefert der Prozess von selbst Kennzahlen — was lief durch, was nicht, wie lange?',
  d8: 'Sind Zugangsdaten verschlüsselt und getrennt abgelegt — statt im Klartext im Prozess?',
  d9: 'Ist der Prozess in überschaubare, wiederverwendbare Bausteine zerlegt?',
  d10: 'Läuft der Prozess ohne Umbau auch in einer anderen Umgebung oder an einem anderen Standort?',
};

const SCHREIBREGELN = `Schreibregeln (D-050, verbindlich):
- Leserin ist eine Erstleserin mit wenig KI/RPA-Wissen. Jeder Satz muss auf Anhieb verständlich sein — kein Jargon (kein „Idempotenz", „Konfiguration", „Monitoring"; nutze Alltagsbilder).
- Wertschätzend, Sie-Form. Anerkennung zuerst: würdige, was gut gebaut ist, bevor du Hebel nennst.
- KEINE Defizit-Sprache. Statt „Schwäche" sage, WAS noch nicht abgedeckt ist bzw. WER es heute auffängt.
- Jeder Beleg-Satz hängt an einem konkreten Befund/Schritt aus dem Input (kein Allgemeinplatz, kein Horoskop).
- Unsicheres ehrlich mit „❓ am Ablauf-Graph/Panel prüfen" markieren — nichts erfinden.
- Das Bild „wie eine neue Kollegin" ist erlaubt (beschreibe die Arbeitsweise, keine Charakter-Etiketten).
- Keine Vergleiche/Benchmarks mit anderen Häusern.`;

interface DimInputZeile {
  key: string;
  name: string;
  ist: number;
  soll: number;
  beleg: string;
  begruendung: string;
}

function buildPrompt(baustand: Baustand, prozessText: string): [Message, Message] {
  const dimZeilen: DimInputZeile[] = ALL_DIMS.map((d) => {
    const dim = baustand.dimensionen?.[d];
    return {
      key: d.toUpperCase(),
      name: DIM_LABEL[d],
      ist: dim?.ist ?? 0,
      soll: dim?.soll ?? 0,
      beleg: dim?.beleg ?? '',
      begruendung: baustand.llmBegruendung?.[d] ?? '',
    };
  });
  const dimText = dimZeilen
    .map((z) => `${z.key} ${z.name}: Ist L${z.ist} / Soll L${z.soll} — Beleg: ${z.beleg} ${z.begruendung}`)
    .join('\n');
  const befundText = (baustand.befunde ?? [])
    .filter((f) => f.schwere !== 'niedrig')
    .slice(0, 25)
    .map((f) => `- ${f.pm} [${f.schwere}] P${f.prozessNr}${f.schrittId != null ? ` S${f.schrittId}` : ''}: ${f.befund}`)
    .join('\n');
  const hebelText = (baustand.topHebel ?? []).map((t) => `- [${t.dim}] ${t.titel}: ${t.wirkung}`).join('\n');

  const system: Message = {
    role: 'system',
    content: `Du erstellst die kundenfähige Fassung einer Prozess-Reifegrad-Analyse (RPA/EMMA Studio).
${SCHREIBREGELN}

Antworte AUSSCHLIESSLICH mit JSON in genau dieser Form (keine weiteren Felder, kein Text davor/danach):
{
  "exec": { "was": "<2-3 Sätze: was die Prozesse fachlich tun>", "findings": ["<kundenfähiger Kern-Befund>", "…"], "staerken": ["<konkrete Stärke>", "…"] },
  "prosa": ["<Absatz: die Prozesse als neue Kollegin, was sie schon kann>", "<Absatz: was die Stabilisierung konkret bringt>"],
  "dims": { "d1": { "beleg": "<kundenfähige Beleg-Prosa mit konkretem Bezug>", "recs": ["<Empfehlung>", "…"] }, "d2": { … }, "… bis d10 und d6b …": {} },
  "stabilityNote": "<1-2 Sätze: ehrliche Einordnung des Stands (z. B. Erstbau)>"
}
Regeln: 2-3 recs je Dimension. Für maskierte/nicht-relevante oder bereits erfüllte Dimensionen kurze recs oder [] . Keine Kennzahlen erfinden.`,
  };
  const user: Message = {
    role: 'user',
    content: `## Benotung je Dimension (Ist/Soll + Beleg)\n${dimText}\n\n## Deterministische Befunde\n${befundText || '(keine auffälligen)'}\n\n## Priorisierte Top-Hebel\n${hebelText || '(keine)'}\n\n## Prozess-Export (gekürzt)\n${prozessText.slice(0, 12000)}`,
  };
  return [system, user];
}

/** Strippt <think>-Blöcke und extrahiert das erste JSON-Objekt. */
export function parseNarrativResponse(content: string): Partial<Narrativ> | null {
  const cleaned = content.replace(/<think>[\s\S]*?<\/think>/gi, '').replace(/```json|```/gi, '');
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== 'object' || !parsed.exec || !parsed.dims) return null;
    return parsed as Partial<Narrativ>;
  } catch {
    return null;
  }
}

/**
 * Führt die Narrativ-Synthese aus (Reasoning-Modell). Wirft bei Timeout/Fehler —
 * der Aufrufer entscheidet über Fallback (der Baustand bleibt vollständig).
 */
export async function synthesizeNarrativ(opts: {
  baustand: Baustand;
  prozessText: string;
  userId?: string;
  timeoutMs?: number;
}): Promise<Narrativ> {
  const { baustand, prozessText, userId } = opts;
  const timeoutMs = opts.timeoutMs ?? (Number(process.env.ECHOLOOP_NARRATIV_TIMEOUT_MS) || 300_000);
  const [system, user] = buildPrompt(baustand, prozessText);

  const res = await Promise.race([
    llmService.chat([system, user], undefined, { source: 'document_analysis', operation: 'echoloop_narrativ', triggeringUserId: userId, userId }, { modelOverride: NARRATIV_MODEL }),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(`Narrativ-Timeout nach ${timeoutMs}ms (Reasoning-Modell zu langsam — ggf. ECHOLOOP_NARRATIV_MODEL auf Instruct setzen)`)), timeoutMs)),
  ]);

  const parsed = parseNarrativResponse(res.content ?? '');
  if (!parsed) throw new Error('Narrativ-Antwort nicht als JSON parsebar');

  // Dimensionen normalisieren + statische Zweck-Frage ergänzen
  const dims: Partial<Record<Dim, DimNarrativ>> = {};
  for (const d of ALL_DIMS) {
    const n = parsed.dims?.[d];
    dims[d] = {
      purpose: DIM_PURPOSE[d],
      beleg: n?.beleg ?? '',
      recs: Array.isArray(n?.recs) ? n!.recs.filter((r) => typeof r === 'string') : [],
    };
  }

  return {
    exec: {
      was: parsed.exec?.was ?? '',
      findings: Array.isArray(parsed.exec?.findings) ? parsed.exec!.findings : [],
      staerken: Array.isArray(parsed.exec?.staerken) ? parsed.exec!.staerken : [],
    },
    prosa: Array.isArray(parsed.prosa) ? parsed.prosa : [],
    dims,
    stabilityNote: parsed.stabilityNote,
    erzeugtAm: new Date().toISOString(),
    modell: NARRATIV_MODEL.modelId,
  };
}
