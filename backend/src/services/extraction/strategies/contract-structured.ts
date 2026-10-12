/**
 * contract-structured — Vertragsauswertung (Spezifikation:
 * docs/vertragsextraktion-strategie-spec-2026-10-08.md).
 *
 * P1 Seiten rendern → P2 Transkription je Seite (Bild) → P3 Strukturbaum →
 * P4 Katalog/Inventar/Erweiterung (Text, Klausel-IDs) → P5 Konsolidierung.
 *
 * `extracted` traegt wie bei den anderen Strategien nur die Profilfelder
 * (Erweiterung) — Review, Korrektur, Eval und Export der DP-Oberflaeche
 * funktionieren unveraendert. Alles Vertragsspezifische liegt in
 * `StrategyResult.contract`.
 */

import { isArrayGroup, type ArrayGroupDefinition, type FieldDefinition } from '../../../extraction/types';
import { istKatalogFeld, katalogWerte } from '../../../extraction/vertragskatalog';
import { validateExtraction } from '../../../extraction/validator';
import { werteAus, type ErweiterungsFeld } from '../contract/auswertung';
import { konsolidiere } from '../contract/konsolidierung';
import { alsVolltext, leseDokument } from '../contract/lesen';
import {
  StrategyExecutionError,
  type CostEstimate, type ExtractionStrategy, type FieldProvenance, type ProgressEmit, type StrategyInput, type StrategyResult,
} from '../types';

/** Profilfelder (Gruppe `felder` + Listengruppen) → Erweiterungsfelder. */
export function erweiterungsFelder(profileFields: StrategyInput['schema']['profile']['fields']): { felder: Record<string, ErweiterungsFeld>; gruppeVon: Record<string, string | null> } {
  const felder: Record<string, ErweiterungsFeld> = {};
  const gruppeVon: Record<string, string | null> = {};
  const typ = (f: FieldDefinition) => f.type;
  for (const [gruppe, def] of Object.entries(profileFields)) {
    // Katalogfelder fuellt die Strategie aus dem festen Katalog — nicht noch einmal vom Modell erfragen.
    if (istKatalogFeld(gruppe)) continue;
    if (isArrayGroup(def)) {
      const g = def as ArrayGroupDefinition;
      felder[gruppe] = {
        type: 'list', label: g._label ?? gruppe, ...(g._hint ? { description: g._hint } : {}),
        item_fields: Object.fromEntries(Object.entries(g._item_fields).map(([id, f]) => [id, { type: typ(f), label: f.label ?? id, ...(f.hint ? { description: f.hint } : {}) }])),
      };
      gruppeVon[gruppe] = null;
      continue;
    }
    for (const [id, f] of Object.entries(def as Record<string, FieldDefinition>)) {
      if (istKatalogFeld(id)) continue;
      felder[id] = { type: typ(f), label: f.label ?? id, ...(f.hint ? { description: f.hint } : {}) };
      gruppeVon[id] = gruppe;
    }
  }
  return { felder, gruppeVon };
}

/**
 * Katalogwerte in die Profilform legen — nur fuer Katalogfelder, die das Profil fuehrt (beim Laden angehaengt;
 * eingefrorene Profile ohne sie bleiben unveraendert).
 */
export function katalogInProfilform(
  katalog: Parameters<typeof katalogWerte>[0],
  profileFields: StrategyInput['schema']['profile']['fields'],
  ziel: { extracted: Record<string, unknown>; fieldConfidences: Record<string, number> },
): void {
  const { werte, konfidenz } = katalogWerte(katalog);
  for (const [gruppe, def] of Object.entries(profileFields)) {
    if (isArrayGroup(def)) {
      if (!(gruppe in werte)) continue;
      ziel.extracted[gruppe] = werte[gruppe];
      ziel.fieldConfidences[gruppe] = konfidenz[gruppe] ?? 0;
      // Zellen erben die Konfidenz der Liste (die Triage prueft je Zelle).
      for (const [i, zeile] of ((werte[gruppe] as Record<string, unknown>[]) ?? []).entries()) {
        for (const spalte of Object.keys(zeile)) ziel.fieldConfidences[`${gruppe}[${i}].${spalte}`] = konfidenz[gruppe] ?? 0;
      }
      continue;
    }
    for (const id of Object.keys(def as Record<string, FieldDefinition>)) {
      if (!(id in werte)) continue;
      ziel.extracted[gruppe] = { ...(ziel.extracted[gruppe] as Record<string, unknown> ?? {}), [id]: werte[id] };
      ziel.fieldConfidences[`${gruppe}.${id}`] = konfidenz[id] ?? 0;
    }
  }
}

/** Feldwerte + Fundstellen → Profilform (Gruppe `felder` + Listengruppen), Konfidenz und Provenienz. */
export function inProfilform(
  erweiterung: { data: Record<string, unknown>; fundstellen: Record<string, string[]> },
  gruppeVon: Record<string, string | null>,
): { extracted: Record<string, unknown>; fieldConfidences: Record<string, number>; provenance: FieldProvenance[] } {
  const extracted: Record<string, unknown> = {};
  const fieldConfidences: Record<string, number> = {};
  const provenance: FieldProvenance[] = [];
  for (const [id, wert] of Object.entries(erweiterung.data)) {
    const gruppe = gruppeVon[id];
    const pfad = gruppe ? `${gruppe}.${id}` : id;
    if (gruppe) extracted[gruppe] = { ...(extracted[gruppe] as Record<string, unknown> ?? {}), [id]: wert };
    else extracted[id] = wert;
    const belegt = (erweiterung.fundstellen[id] ?? []).length > 0;
    const leer = wert === null || wert === undefined || (Array.isArray(wert) && !wert.length);
    fieldConfidences[pfad] = leer ? 0 : belegt ? 0.85 : 0.6;
    if (!leer) provenance.push({ field: pfad, value: wert, source: `k:${(erweiterung.fundstellen[id] ?? []).join('+') || '?'}`, confidence: fieldConfidences[pfad] });
  }
  return { extracted, fieldConfidences, provenance };
}

export const contractStructuredStrategy: ExtractionStrategy = {
  id: 'contract-structured',

  estimateCost(input: StrategyInput): CostEstimate {
    const seiten = input.files.reduce((n, f) => n + (f.pageCount ?? 10), 0);
    // Transkription je Seite + Katalog + ~1 Inventar-Aufruf je 6 Seiten + Erweiterung
    const calls = seiten + 2 + Math.ceil(seiten / 6);
    return { tokens: seiten * 5000, calls, etaSeconds: Math.ceil(seiten / 4) * 20 + 60 };
  },

  async run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult> {
    const datei = input.files.find((f) => f.rawBuffer && (f.mimeType === 'application/pdf' || f.mimeType.startsWith('image/')));
    if (!datei?.rawBuffer) {
      throw new StrategyExecutionError('Vertragsauswertung benötigt eine PDF- oder Bilddatei.');
    }
    const override = input.modelOverride
      ?? (input.schema.config.model_override
        ? { providerId: input.schema.config.model_override.provider_id, modelId: input.schema.config.model_override.model_id }
        : null);
    const kontext = { userId: input.userId, modelOverride: override };
    const parallel = Math.max(1, input.schema.config.max_concurrent);

    // P1 Seiten, P2 Transkription (+ digitale Signaturen), P3 Strukturbaum — gemeinsamer Lesekern
    const { bilder, pageImages, seiten, klauseln, pruefAufrufe } = await leseDokument(kontext, { rawBuffer: datei.rawBuffer, mimeType: datei.mimeType }, {
      maxSeiten: input.schema.config.max_pages, parallel, emit, unterschriftenPruefen: true,
    });
    if (seiten.every((s) => s.fehler)) {
      throw new StrategyExecutionError(`Keine Seite konnte gelesen werden (${seiten[0]?.fehler ?? 'unbekannt'}).`);
    }

    // P4 Auswertung, P5 Konsolidierung
    const { felder, gruppeVon } = erweiterungsFelder(input.schema.profile.fields);
    const aw = await werteAus(kontext, klauseln, {
      felder, parallel, anweisungen: input.schema.profile.guidelines,
      beiSchritt: (schritt) => emit({ phase: 'preparing', message: schritt === 'katalog' ? 'Vertragskatalog wird ausgewertet' : `Pflichten und Fristen werden erfasst (${schritt.split(':')[1]} Abschnittsgruppen)` }),
    });
    await emit({ phase: 'validating', warningCount: 0 });
    const { vertrag, erweiterung } = konsolidiere(seiten, klauseln, aw);

    const { extracted, fieldConfidences, provenance } = inProfilform(erweiterung, gruppeVon);
    katalogInProfilform(vertrag.katalog, input.schema.profile.fields, { extracted, fieldConfidences });
    // Formate (Datum, Zahl …) hier angleichen wie die anderen Strategien — sonst haelt der Abschluss-Schritt der
    // Pipeline die Angleichung fuer eine nachtraegliche Aenderung („erneut pruefen", Konfidenz 0).
    validateExtraction(extracted, input.schema.profile);

    const lesefehler = seiten.filter((s) => s.fehler);
    return {
      extracted,
      fieldConfidences,
      provenance,
      pageImages,
      warnings: vertrag.befunde.filter((b) => b.typ === 'verarbeitung' && !aw.probleme.includes(b.text)).map((b) => b.text),
      // Lesefehler und gescheiterte Auswertungsschritte erzwingen „Zu pruefen" — ein lueckenhaftes Ergebnis darf nicht unauffaellig wirken.
      processingIssues: [
        ...lesefehler.map((s) => ({ severity: 'error' as const, message: `Seite ${s.seite}: nicht lesbar (${s.fehler}) — Inhalte dieser Seite fehlen.` })),
        ...aw.probleme.map((p) => ({ severity: 'error' as const, message: `Vertragsauswertung unvollständig — ${p}` })),
      ],
      llmCalls: bilder.length + pruefAufrufe + aw.aufrufe,
      strategyUsed: 'contract-structured',
      contract: vertrag,
      // Wie „Allgemein" und der Profil-Schalter: Seitentranskript + Gliederung immer mitliefern (einheitliche API).
      volltext: alsVolltext({ seiten, klauseln }),
    };
  },
};
