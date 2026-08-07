/**
 * Extraction Service
 *
 * Orchestrates the 5-stage document extraction pipeline:
 * 1. Ingest - Accept and convert document
 * 2. Resolve - Determine extraction profile
 * 3. Prepare - Text or Vision processing
 * 4. Extract - LLM with forced function calling
 * 5. Validate + Retry - Type checking, auto-correction, retry on errors
 */

import { llmService, type Message, type ChatOptions, createImageContent, type ContentPart } from '../services/llm';
import type { UsageContext } from '../services/usageTracking';
import { resolveActiveModel } from '../services/providers';
import { OpenAIAdapter } from '../services/llm/adapters/openai';
import { attachmentsService } from '../services/attachments';
import { getProfile, detectProfile, getAllProfiles } from './profiles';
import { buildFunctionSchema, buildToolChoice } from './schema-builder';
import { validateExtraction, formatValidationErrors } from './validator';
import type { ExtractionRequest, ExtractionResult, ExtractionSource } from './types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, resolve } from 'path';
import { EXTRACTION_SAMPLING } from '../services/extraction/extract-call';
import { convertDocument } from '../services/documentConverter';

const MAX_RETRIES = 2;


/**
 * Stage 1: Ingest - Get document content from source
 */
async function ingest(source: ExtractionSource): Promise<{
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
}> {
  switch (source.type) {
    case 'text':
      return { text: source.content };

    case 'base64_image':
      return { imageBase64: source.data, imageMimeType: source.mime_type };

    case 'attachment': {
      const attachment = await attachmentsService.getAttachment(
        source.attachment_id,
        source.session_id
      );
      if (!attachment) {
        throw new Error(`Attachment "${source.attachment_id}" nicht gefunden`);
      }

      if (attachment.type === 'document') {
        return { text: attachment.markdownContent || '' };
      }

      if (attachment.type === 'image') {
        return {
          imageBase64: attachment.base64Data || '',
          imageMimeType: attachment.mimeType,
        };
      }

      throw new Error(`Attachment-Typ "${attachment.type}" wird nicht unterstuetzt (nur document/image)`);
    }

    case 'file': {
      const filePath = resolve(source.path);
      if (!existsSync(filePath)) {
        throw new Error(`Datei nicht gefunden: ${source.path}`);
      }

      const ext = extname(source.filename).toLowerCase();
      const imageExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

      if (imageExts.includes(ext)) {
        const buffer = await readFile(filePath);
        const base64 = buffer.toString('base64');
        const mimeType = ext === '.png' ? 'image/png' :
                         ext === '.webp' ? 'image/webp' :
                         ext === '.gif' ? 'image/gif' : 'image/jpeg';
        return { imageBase64: base64, imageMimeType: mimeType };
      }

      // Text or document files
      const textExts = ['.txt', '.md'];
      if (textExts.includes(ext)) {
        const content = await readFile(filePath, 'utf-8');
        return { text: content };
      }

      // Zentraler Konverter (W8)
      const buffer = await readFile(filePath);
      const text = await convertDocument({ buffer, filename: source.filename });
      return { text };
    }

    default:
      throw new Error('Unbekannter Quelltyp');
  }
}

/**
 * Stage 3: Prepare - Convert image to text via Vision LLM if needed
 */
async function prepareVision(
  imageBase64: string,
  imageMimeType: string,
  userId?: string
): Promise<string> {
  console.log('[Extraction] Using Vision LLM to describe image...');

  // Resolve vision model
  const visionModel = await resolveActiveModel('vision', userId);
  if (!visionModel) {
    throw new Error('Kein Vision-Modell konfiguriert');
  }

  const visionAdapter = new OpenAIAdapter({
    baseUrl: visionModel.base_url,
    apiKey: visionModel.api_key || null,
    defaultModel: visionModel.model.id,
  });

  const contentParts: ContentPart[] = [
    {
      type: 'text',
      text: `Beschreibe dieses Dokument detailliert. Extrahiere ALLEN sichtbaren Text vollstaendig und woertlich.
Behalte die Struktur bei (Tabellen, Listen, Kopfdaten).
Gib den Text in der Originalsprache wieder.
Antworte NUR mit dem extrahierten Inhalt, keine eigenen Kommentare.`,
    },
    createImageContent(imageBase64, imageMimeType),
  ];

  const messages: Message[] = [
    { role: 'user', content: contentParts },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'vision_prepare',
  };

  // Use non-streaming call via adapter
  const result = await visionAdapter.chat(messages, visionModel.model.id, undefined, undefined, EXTRACTION_SAMPLING);

  if (!result.content) {
    throw new Error('Vision-LLM hat keinen Text zurueckgegeben');
  }

  console.log(`[Extraction] Vision extracted ${result.content.length} chars`);
  return result.content;
}

/**
 * Stage 4: Extract - Call LLM with forced function calling
 */
async function extractWithLLM(
  text: string,
  profile: ReturnType<typeof buildFunctionSchema> extends infer T ? T : never,
  toolChoice: ReturnType<typeof buildToolChoice>,
  guidelines: string | undefined,
  userId?: string,
  previousErrors?: string
): Promise<Record<string, unknown>> {
  const systemParts: string[] = [
    'Du bist ein Dokumenten-Extraktions-Experte. Deine Aufgabe ist es, strukturierte Daten aus dem gegebenen Dokumenttext zu extrahieren.',
    '',
    'Allgemeine Regeln:',
    '- Datumsangaben immer im Format YYYY-MM-DD',
    '- Fehlende Werte als null setzen, NICHT erfinden',
    '- Zahlen als numerische Werte (nicht als String)',
    '- Text exakt aus dem Dokument uebernehmen',
  ];

  if (guidelines) {
    systemParts.push('', 'Dokumentspezifische Hinweise:', guidelines);
  }

  if (previousErrors) {
    systemParts.push(
      '',
      'ACHTUNG: Dein vorheriger Extraktionsversuch hatte folgende Fehler:',
      previousErrors,
      '',
      'Bitte korrigiere diese Fehler in deiner Antwort.'
    );
  }

  const messages: Message[] = [
    { role: 'system', content: systemParts.join('\n') },
    { role: 'user', content: `Extrahiere die strukturierten Daten aus folgendem Dokument:\n\n${text}` },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'extract',
  };

  const options: ChatOptions = {
    userId,
    toolChoice: toolChoice as ChatOptions['toolChoice'],
    ...EXTRACTION_SAMPLING,
  };

  const response = await llmService.chat(messages, [profile], usageContext, options);

  // Primary path: tool_calls (function calling)
  if (response.tool_calls && response.tool_calls.length > 0) {
    const args = response.tool_calls[0]!.function.arguments;
    try {
      return JSON.parse(args);
    } catch {
      throw new Error(`Ungültiges JSON in Function-Call-Antwort: ${args.substring(0, 200)}`);
    }
  }

  // Fallback: Try to extract JSON from content (for models without function calling)
  if (response.content) {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        // Fall through to error
      }
    }
  }

  throw new Error('LLM hat keine strukturierten Daten zurueckgegeben (weder tool_calls noch JSON im Content)');
}

/**
 * Main extraction pipeline
 */
export async function extract(request: ExtractionRequest): Promise<ExtractionResult> {
  const startTime = Date.now();

  try {
    // Stage 1: Ingest
    console.log('[Extraction] Stage 1: Ingest...');
    const ingested = await ingest(request.source);

    // Stage 3: Prepare (Vision if needed)
    let documentText: string;
    if (ingested.text) {
      documentText = ingested.text;
    } else if (ingested.imageBase64 && ingested.imageMimeType) {
      documentText = await prepareVision(
        ingested.imageBase64,
        ingested.imageMimeType,
        request.user_id
      );
    } else {
      throw new Error('Kein Dokumenttext oder Bild vorhanden');
    }

    if (!documentText.trim()) {
      throw new Error('Dokument ist leer');
    }

    // Stage 2: Resolve profile
    console.log('[Extraction] Stage 2: Resolve profile...');
    let profile;
    if (request.profile_id) {
      profile = await getProfile(request.profile_id);
      if (!profile) {
        throw new Error(`Extraktionsprofil "${request.profile_id}" nicht gefunden`);
      }
    } else {
      profile = await detectProfile(documentText);
      if (!profile) {
        throw new Error('Kein passendes Extraktionsprofil erkannt. Bitte profile_id angeben.');
      }
      console.log(`[Extraction] Auto-detected profile: ${profile.id}`);
    }

    // Build function schema
    const functionSchema = buildFunctionSchema(profile);
    const toolChoice = buildToolChoice(profile);

    // Stage 4 + 5: Extract + Validate with retry
    let retries = 0;
    let lastErrors: string | undefined;

    while (retries <= MAX_RETRIES) {
      console.log(`[Extraction] Stage 4: Extract (attempt ${retries + 1})...`);
      const data = await extractWithLLM(
        documentText,
        functionSchema,
        toolChoice,
        profile.guidelines,
        request.user_id,
        lastErrors
      );

      console.log('[Extraction] Stage 5: Validate...');
      const validation = validateExtraction(data, profile);

      if (validation.valid || retries >= MAX_RETRIES) {
        const elapsed = Date.now() - startTime;
        console.log(`[Extraction] Complete in ${elapsed}ms (${retries} retries, valid: ${validation.valid})`);

        return {
          success: true,
          profile_id: profile.id,
          profile_name: profile.name,
          data,
          validation,
          retries,
        };
      }

      // Retry with error feedback
      lastErrors = formatValidationErrors(validation.errors);
      console.log(`[Extraction] Validation failed, retrying... Errors: ${validation.errors.length}`);
      retries++;
    }

    // Should not reach here, but just in case
    throw new Error('Maximale Anzahl an Extraktionsversuchen erreicht');
  } catch (error: any) {
    console.error('[Extraction] Pipeline error:', error.message);
    return {
      success: false,
      profile_id: request.profile_id || 'unknown',
      profile_name: '',
      data: {},
      validation: { valid: false, errors: [{ field: '_pipeline', message: error.message }], corrected: [] },
      retries: 0,
      error: error.message,
    };
  }
}

/**
 * Detect profile without extracting
 */
export async function detectProfileFromText(text: string): Promise<{
  detected: boolean;
  profile_id?: string;
  profile_name?: string;
  confidence?: string;
}> {
  const profile = await detectProfile(text);
  if (!profile) {
    return { detected: false };
  }

  return {
    detected: true,
    profile_id: profile.id,
    profile_name: profile.name,
  };
}

/**
 * Generate an extraction profile from a sample document using LLM
 */
export async function generateProfile(
  sampleText: string,
  description?: string,
  userId?: string
): Promise<{ success: boolean; profile?: Record<string, unknown>; error?: string }> {
  console.log('[Extraction] Generating profile from sample document...');

  const systemPrompt = `Du bist ein Experte fuer Dokumentenanalyse und Datenextraktion.
Deine Aufgabe: Analysiere das gegebene Beispieldokument und erstelle ein Extraktionsprofil als JSON.

Das Profil muss exakt dieses Format haben:
{
  "id": "kebab-case-id",
  "name": "Lesbare Bezeichnung",
  "description": "Was dieser Dokumenttyp enthaelt",
  "version": "1.0",
  "detection": {
    "keywords": ["Keyword1", "Keyword2", "..."],
    "description": "Woran man diesen Dokumenttyp erkennt"
  },
  "fields": {
    "gruppenname": {
      "feldname": {
        "type": "text|number|date|boolean",
        "required": true/false,
        "label": "Lesbare Bezeichnung",
        "hint": "Hilfestellung fuer die Extraktion"
      }
    }
  },
  "guidelines": "Mehrzeilige Extraktions-Anweisungen"
}

Regeln:
- Erkenne die logische Struktur des Dokuments und bilde sie als Feldgruppen ab
- Verwende sinnvolle Gruppennamen (z.B. "kopfdaten", "positionen", "adressen")
- Fuer wiederkehrende Elemente (z.B. Positionen, Zeilen) verwende Arrays:
  "gruppenname": { "_array": true, "_item_fields": { "feld": { "type": "text", ... } } }
- Setze required: true nur fuer Felder die im Dokument IMMER vorhanden sein werden
- Waehle den passenden Typ: text, number (fuer Mengen/Preise), date (fuer Datumsangaben), boolean
- Die "hint" Eigenschaft soll dem LLM helfen, das Feld korrekt zu extrahieren
- Die "detection.keywords" sollen charakteristische Woerter sein, die diesen Dokumenttyp identifizieren
- Die "guidelines" sollen uebergreifende Extraktions-Hinweise enthalten (Edge Cases, Normalisierung, etc.)
- Die "id" soll ein kebab-case Bezeichner sein (z.B. "lieferschein", "eingangsrechnung")

Antworte NUR mit dem JSON-Objekt, kein erklaeerender Text.`;

  const userParts: string[] = [];

  if (description) {
    userParts.push(`Gewuenschte Extraktion: ${description}\n`);
  }

  userParts.push(`Beispieldokument:\n\n${sampleText.substring(0, 8000)}`);

  const messages: Message[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userParts.join('\n') },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'extraction',
    operation: 'generate_profile',
  };

  try {
    const response = await llmService.chat(messages, undefined, usageContext, { userId, ...EXTRACTION_SAMPLING });

    if (!response.content) {
      return { success: false, error: 'LLM hat keine Antwort geliefert' };
    }

    // Extract JSON from response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: 'Kein JSON in der LLM-Antwort gefunden' };
    }

    const profile = JSON.parse(jsonMatch[0]);

    // Basic validation
    if (!profile.id || !profile.name || !profile.fields) {
      return { success: false, error: 'Generiertes Profil ist unvollstaendig (id, name oder fields fehlen)' };
    }

    console.log(`[Extraction] Profile generated: ${profile.id} (${profile.name})`);
    return { success: true, profile };
  } catch (error: any) {
    console.error('[Extraction] Profile generation error:', error.message);
    return { success: false, error: error.message };
  }
}
