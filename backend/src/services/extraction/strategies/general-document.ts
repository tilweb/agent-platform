/**
 * general-document — Basisprofil „Allgemein" (Konzept DP-Produktmodell §4).
 *
 * Fuer Dokumente ohne passende Pipeline: Volltext je Seite ueber das Bild
 * (gemeinsamer Lesekern mit `contract-structured`, auch fuer Scans), Gliederung
 * und ein Aufruf fuer die Profilfelder (Kernwerte wie Dokumentart, Absender,
 * Datum, Betreff). Ersatz fuer Docling/Markitdown.
 */

import { leseDokument, alsVolltext } from '../contract/lesen';
import { werteFelderAus } from '../contract/auswertung';
import { klauselnAlsText } from '../contract/struktur';
import { erweiterungsFelder, inProfilform } from './contract-structured';
import { StrategyExecutionError, type CostEstimate, type ExtractionStrategy, type ProgressEmit, type StrategyInput, type StrategyResult } from '../types';

const ALLGEMEIN_ANWEISUNG = `Du wertest ein deutschsprachiges Dokument unbekannter Art aus (Brief, Bescheid, Rechnung, Formular, Nachweis …). Das Dokument liegt als Liste von Abschnitten vor, jeder mit ID in eckigen Klammern, Titelpfad und Seiten.
Regeln:
- Fundstellen ("klauseln") sind IMMER IDs aus der Liste. Keine IDs erfinden.
- Nur angeben, was im Dokument steht; nichts ergänzen. Nicht Vorhandenes als null.
- Durchgestrichener Text (~~…~~) gilt nicht. {{hs: …}} ist handschriftlich, {{unterschrift: …}} eine Unterschrift, {{stempel: …}} ein Stempel.
- Datumsangaben als YYYY-MM-DD, wenn eindeutig. Mehrere Werte (z. B. Referenznummern) durch "; " getrennt.

Fülle die folgenden Felder.`;

export const generalDocumentStrategy: ExtractionStrategy = {
  id: 'general-document',

  estimateCost(input: StrategyInput): CostEstimate {
    const seiten = input.files.reduce((n, f) => n + (f.pageCount ?? 3), 0);
    return { tokens: seiten * 4500, calls: seiten + 1, etaSeconds: Math.ceil(seiten / 4) * 15 + 20 };
  },

  async run(input: StrategyInput, emit: ProgressEmit): Promise<StrategyResult> {
    const datei = input.files.find((f) => f.rawBuffer && (f.mimeType === 'application/pdf' || f.mimeType.startsWith('image/')));
    if (!datei?.rawBuffer) throw new StrategyExecutionError('Das Basisprofil benötigt eine PDF- oder Bilddatei.');
    const override = input.modelOverride
      ?? (input.schema.config.model_override
        ? { providerId: input.schema.config.model_override.provider_id, modelId: input.schema.config.model_override.model_id }
        : null);
    const kontext = { userId: input.userId, modelOverride: override };
    const parallel = Math.max(1, input.schema.config.max_concurrent);

    const gelesen = await leseDokument(kontext, { rawBuffer: datei.rawBuffer, mimeType: datei.mimeType }, { maxSeiten: input.schema.config.max_pages, parallel, emit });
    if (gelesen.seiten.every((s) => s.fehler)) {
      throw new StrategyExecutionError(`Keine Seite konnte gelesen werden (${gelesen.seiten[0]?.fehler ?? 'unbekannt'}).`);
    }

    const { felder, gruppeVon } = erweiterungsFelder(input.schema.profile.fields);
    await emit({ phase: 'preparing', message: 'Kernwerte werden ausgelesen' });
    const r = Object.keys(felder).length
      ? await werteFelderAus(kontext, klauselnAlsText(gelesen.klauseln), felder, { anweisung: ALLGEMEIN_ANWEISUNG })
      : { data: {}, fundstellen: {}, probleme: [] as string[] };
    const { extracted, fieldConfidences, provenance } = inProfilform(r, gruppeVon);

    const lesefehler = gelesen.seiten.filter((s) => s.fehler);
    return {
      extracted,
      fieldConfidences,
      provenance,
      pageImages: gelesen.pageImages,
      warnings: [],
      processingIssues: [
        ...lesefehler.map((s) => ({ severity: 'error' as const, message: `Seite ${s.seite}: nicht lesbar (${s.fehler}) — Inhalte dieser Seite fehlen.` })),
        ...r.probleme.map((p) => ({ severity: 'error' as const, message: `Auswertung unvollständig — ${p}` })),
      ],
      llmCalls: gelesen.bilder.length + (Object.keys(felder).length ? 1 : 0),
      strategyUsed: 'general-document',
      volltext: alsVolltext(gelesen),
    };
  },
};
