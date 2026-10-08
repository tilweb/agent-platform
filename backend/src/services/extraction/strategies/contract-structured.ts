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
import { extractionVisionDpi } from '../defaults';
import { renderPdfToImages, pdfToLayoutText } from '../pdf';
import { baueStruktur } from '../contract/struktur';
import { textlayerJeSeite, transkribiere, type SeitenBild } from '../contract/transkription';
import { werteAus, type ErweiterungsFeld } from '../contract/auswertung';
import { konsolidiere } from '../contract/konsolidierung';
import {
  StrategyExecutionError,
  type CostEstimate, type ExtractionStrategy, type FieldProvenance, type PageImage, type ProgressEmit, type StrategyInput, type StrategyResult,
} from '../types';

const VERTRAGS_DPI_MIN = 200;

/** Profilfelder (Gruppe `felder` + Listengruppen) → Erweiterungsfelder. */
export function erweiterungsFelder(profileFields: StrategyInput['schema']['profile']['fields']): { felder: Record<string, ErweiterungsFeld>; gruppeVon: Record<string, string | null> } {
  const felder: Record<string, ErweiterungsFeld> = {};
  const gruppeVon: Record<string, string | null> = {};
  const typ = (f: FieldDefinition) => f.type;
  for (const [gruppe, def] of Object.entries(profileFields)) {
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
      felder[id] = { type: typ(f), label: f.label ?? id, ...(f.hint ? { description: f.hint } : {}) };
      gruppeVon[id] = gruppe;
    }
  }
  return { felder, gruppeVon };
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

    // P1 Seiten
    await emit({ phase: 'preparing', message: 'Seiten werden gerendert' });
    let bilder: SeitenBild[];
    if (datei.mimeType === 'application/pdf') {
      const pages = await renderPdfToImages(datei.rawBuffer, { dpi: Math.max(VERTRAGS_DPI_MIN, extractionVisionDpi()), maxPages: input.schema.config.max_pages });
      let layout: string[] = [];
      try { layout = textlayerJeSeite(await pdfToLayoutText(datei.rawBuffer)); } catch { /* kein Textlayer */ }
      bilder = pages.map((p) => ({ seite: p.pageNumber, png: p.pngBuffer, hilfstext: layout[p.pageNumber - 1] }));
    } else {
      bilder = [{ seite: 1, png: datei.rawBuffer }];
    }
    const pageImages: PageImage[] = bilder.map((b) => {
      const { width, height } = { width: b.png.readUInt32BE(16), height: b.png.readUInt32BE(20) };
      return { page: b.seite, dataUri: `data:image/png;base64,${b.png.toString('base64')}`, width, height };
    });

    // P2 Transkription
    const seiten = await transkribiere(kontext, bilder, {
      parallel,
      beiSeite: (fertig, gesamt) => emit({ phase: 'extracting', chunkIndex: fertig - 1, chunkTotal: gesamt, pageIndex: fertig, pageTotal: gesamt }),
    });
    if (seiten.every((s) => s.fehler)) {
      throw new StrategyExecutionError(`Keine Seite konnte gelesen werden (${seiten[0]?.fehler ?? 'unbekannt'}).`);
    }

    // P3 Struktur, P4 Auswertung, P5 Konsolidierung
    const klauseln = baueStruktur(seiten);
    const { felder, gruppeVon } = erweiterungsFelder(input.schema.profile.fields);
    const aw = await werteAus(kontext, klauseln, {
      felder, parallel, anweisungen: input.schema.profile.guidelines,
      beiSchritt: (schritt) => emit({ phase: 'preparing', message: schritt === 'katalog' ? 'Vertragskatalog wird ausgewertet' : `Pflichten und Fristen werden erfasst (${schritt.split(':')[1]} Abschnittsgruppen)` }),
    });
    await emit({ phase: 'validating', warningCount: 0 });
    const { vertrag, erweiterung } = konsolidiere(seiten, klauseln, aw);

    // Erweiterung in die Profilform zurueck (Gruppe `felder` + Listengruppen)
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

    const lesefehler = seiten.filter((s) => s.fehler);
    return {
      extracted,
      fieldConfidences,
      provenance,
      pageImages,
      warnings: vertrag.befunde.filter((b) => b.typ === 'verarbeitung').map((b) => b.text),
      processingIssues: lesefehler.map((s) => ({ severity: 'error' as const, message: `Seite ${s.seite}: nicht lesbar (${s.fehler}) — Inhalte dieser Seite fehlen.` })),
      llmCalls: bilder.length + aw.aufrufe,
      strategyUsed: 'contract-structured',
      contract: vertrag,
    };
  },
};
