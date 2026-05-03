/**
 * Learning Extraction Service
 *
 * Orchestrates: extract (using ingest/vision from existing code), train, regenerate guidelines.
 */

import { llmService, type Message, type ChatOptions, createImageContent, type ContentPart } from '../../services/llm';
import type { UsageContext } from '../../services/usageTracking';
import { resolveActiveModel } from '../../services/providers';
import { OpenAIAdapter } from '../../services/llm/adapters/openai';
import type { ExtractionSource } from '../types';
import { attachmentsService } from '../../services/attachments';
import { correctNumber, correctDate } from './validators';
import { getProject, updateProject } from './projects';
import { getExamples, saveExample, selectFewShotExamples } from './examples';
import { buildFunctionSchema, buildToolChoice, buildSystemPrompt } from './prompt-builder';
import { generateGuidelines } from './guideline-generator';
import type { ExtractionProject, TrainingExample } from './types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, resolve } from 'path';

const MAX_RETRIES = 2;
const MARKITDOWN_URL = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

// ============== Document Ingestion (reused from existing pipeline) ==============

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
        return { imageBase64: attachment.base64Data || '', imageMimeType: attachment.mimeType };
      }
      throw new Error(`Attachment-Typ "${attachment.type}" wird nicht unterstuetzt`);
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

      const textExts = ['.txt', '.md'];
      if (textExts.includes(ext)) {
        const content = await readFile(filePath, 'utf-8');
        return { text: content };
      }

      // Convert via Markitdown API
      const file = Bun.file(filePath);
      const formData = new FormData();
      formData.append('document', file, source.filename);

      const response = await fetch(MARKITDOWN_URL, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${MARKITDOWN_API_KEY}` },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Markitdown-Konvertierung fehlgeschlagen: ${response.status} - ${errorText}`);
      }

      const text = await response.text();
      return { text };
    }

    default:
      throw new Error('Unbekannter Quelltyp');
  }
}

async function prepareVision(
  imageBase64: string,
  imageMimeType: string,
  userId?: string
): Promise<string> {
  console.log('[Extraction] Using Vision LLM to describe image...');

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

  const result = await visionAdapter.chat(messages, visionModel.model.id);

  if (!result.content) {
    throw new Error('Vision-LLM hat keinen Text zurueckgegeben');
  }

  console.log(`[Extraction] Vision extracted ${result.content.length} chars`);
  return result.content;
}

// ============== Extraction ==============

/**
 * Extract data from document using project definition + learned knowledge
 */
export async function extract(
  projectId: string,
  source: ExtractionSource,
  userId?: string
): Promise<{
  success: boolean;
  data: Record<string, unknown>;
  document_text: string;
  error?: string;
}> {
  try {
    // Load project
    const project = await getProject(projectId);
    if (!project) {
      throw new Error(`Projekt "${projectId}" nicht gefunden`);
    }

    // Ingest document
    console.log(`[Extraction] Ingesting document for project ${projectId}...`);
    const ingested = await ingest(source);

    let documentText: string;
    if (ingested.text) {
      documentText = ingested.text;
    } else if (ingested.imageBase64 && ingested.imageMimeType) {
      documentText = await prepareVision(ingested.imageBase64, ingested.imageMimeType, userId);
    } else {
      throw new Error('Kein Dokumenttext oder Bild vorhanden');
    }

    if (!documentText.trim()) {
      throw new Error('Dokument ist leer');
    }

    // Load few-shot examples
    const fewShotExamples = await selectFewShotExamples(projectId);

    // Build prompt and schema
    const systemPrompt = buildSystemPrompt(project, fewShotExamples);
    const functionSchema = buildFunctionSchema(project);
    const toolChoice = buildToolChoice(project);

    // Extract with retries
    let retries = 0;
    let lastErrors: string | undefined;

    while (retries <= MAX_RETRIES) {
      console.log(`[Extraction] Extract attempt ${retries + 1} for project ${projectId}...`);

      const systemParts = [systemPrompt];
      if (lastErrors) {
        systemParts.push(
          '',
          'ACHTUNG: Dein vorheriger Extraktionsversuch hatte folgende Fehler:',
          lastErrors,
          '',
          'Bitte korrigiere diese Fehler in deiner Antwort.'
        );
      }

      const messages: Message[] = [
        { role: 'system', content: systemParts.join('\n') },
        { role: 'user', content: `Extrahiere die strukturierten Daten aus folgendem Dokument:\n\n${documentText}` },
      ];

      const usageContext: UsageContext = {
        userId,
        source: 'extraction',
        operation: 'extract',
      };

      const options: ChatOptions = {
        userId,
        toolChoice: toolChoice as ChatOptions['toolChoice'],
      };

      const response = await llmService.chat(messages, [functionSchema], usageContext, options);

      let data: Record<string, unknown> | null = null;

      // Parse response
      if (response.tool_calls && response.tool_calls.length > 0) {
        const args = response.tool_calls[0]!.function.arguments;
        try {
          data = JSON.parse(args);
        } catch {
          throw new Error(`Ungueltiges JSON in Function-Call-Antwort: ${args.substring(0, 200)}`);
        }
      } else if (response.content) {
        const jsonMatch = response.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            data = JSON.parse(jsonMatch[0]);
          } catch {
            // Fall through
          }
        }
      }

      if (!data) {
        throw new Error('LLM hat keine strukturierten Daten zurueckgegeben');
      }

      // Validate + auto-correct
      const errors = validateFlat(data, project);

      if (errors.length === 0 || retries >= MAX_RETRIES) {
        console.log(`[Extraction] Done for ${projectId} (${retries} retries, ${errors.length} remaining errors)`);
        return { success: true, data, document_text: documentText };
      }

      lastErrors = errors.map(e => `- Feld "${e.field}": ${e.message}`).join('\n');
      retries++;
    }

    throw new Error('Maximale Anzahl an Extraktionsversuchen erreicht');
  } catch (error: any) {
    console.error(`[Extraction] Error for project ${projectId}:`, error.message);
    return { success: false, data: {}, document_text: '', error: error.message };
  }
}

// ============== Validation for flat fields ==============

interface FieldError {
  field: string;
  message: string;
}

function validateFlat(data: Record<string, unknown>, project: ExtractionProject): FieldError[] {
  const errors: FieldError[] = [];

  for (const [fieldId, field] of Object.entries(project.fields)) {
    const value = data[fieldId];

    // Required check
    if (field.required && (value === null || value === undefined || value === '')) {
      errors.push({ field: fieldId, message: 'Pflichtfeld fehlt' });
      continue;
    }

    if (value === null || value === undefined || value === '') continue;

    // Type validation + auto-correction
    switch (field.type) {
      case 'number': {
        if (typeof value !== 'number') {
          const corrected = correctNumber(value);
          if (corrected !== null) {
            data[fieldId] = corrected;
          } else {
            errors.push({ field: fieldId, message: `Erwarteter Typ: Zahl, erhalten: "${value}"` });
          }
        }
        break;
      }
      case 'date': {
        if (typeof value === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          const corrected = correctDate(value);
          if (corrected) {
            data[fieldId] = corrected;
          } else {
            errors.push({ field: fieldId, message: `Ungueltiges Datumsformat: "${value}"` });
          }
        }
        break;
      }
      case 'boolean': {
        if (typeof value !== 'boolean') {
          if (typeof value === 'string') {
            const lower = value.toLowerCase();
            if (['true', 'ja', 'yes', '1'].includes(lower)) {
              data[fieldId] = true;
            } else if (['false', 'nein', 'no', '0'].includes(lower)) {
              data[fieldId] = false;
            } else {
              errors.push({ field: fieldId, message: `Erwarteter Typ: Boolean, erhalten: "${value}"` });
            }
          }
        }
        break;
      }
      case 'text': {
        if (typeof value !== 'string' && typeof value === 'number') {
          data[fieldId] = String(value);
        }
        break;
      }
    }
  }

  return errors;
}

// ============== Training ==============

/**
 * Save a training example and potentially regenerate guidelines
 */
export async function train(
  projectId: string,
  data: {
    source_filename: string;
    document_text: string;
    initial_extraction: Record<string, unknown>;
    corrected_extraction: Record<string, unknown>;
  },
  userId?: string
): Promise<{
  example: TrainingExample;
  guidelines_updated: boolean;
}> {
  // Save example
  const example = await saveExample(projectId, data);

  // Update project learning metadata
  const allExamples = await getExamples(projectId);
  const totalExamples = allExamples.length;
  const correctExamples = allExamples.filter(e => e.confirmed_correct).length;
  const accuracyEstimate = totalExamples > 0 ? Math.round((correctExamples / totalExamples) * 100) : 0;

  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Projekt "${projectId}" nicht gefunden`);
  }

  let guidelinesUpdated = false;

  // Auto-generate guidelines if enough examples with corrections
  if (totalExamples >= 3 && !example.confirmed_correct) {
    try {
      console.log(`[Extraction] Regenerating guidelines for ${projectId} (${totalExamples} examples)...`);
      const newGuidelines = await generateGuidelines(project, allExamples, userId);

      await updateProject(projectId, {
        guidelines: newGuidelines,
        learning: {
          total_examples: totalExamples,
          accuracy_estimate: accuracyEstimate,
          guideline_version: project.learning.guideline_version + 1,
        },
      });
      guidelinesUpdated = true;
    } catch (error: any) {
      console.error(`[Extraction] Guideline generation failed:`, error.message);
      // Still update metadata even if guideline gen fails
      await updateProject(projectId, {
        learning: {
          total_examples: totalExamples,
          accuracy_estimate: accuracyEstimate,
          guideline_version: project.learning.guideline_version,
        },
      });
    }
  } else {
    await updateProject(projectId, {
      learning: {
        total_examples: totalExamples,
        accuracy_estimate: accuracyEstimate,
        guideline_version: project.learning.guideline_version,
      },
    });
  }

  return { example, guidelines_updated: guidelinesUpdated };
}

/**
 * Force regenerate guidelines
 */
export async function regenerateGuidelines(
  projectId: string,
  userId?: string
): Promise<{ guidelines: string }> {
  const project = await getProject(projectId);
  if (!project) {
    throw new Error(`Projekt "${projectId}" nicht gefunden`);
  }

  const examples = await getExamples(projectId);
  if (examples.length < 1) {
    throw new Error('Mindestens 1 Trainingsbeispiel benoetigt');
  }

  const guidelines = await generateGuidelines(project, examples, userId);

  await updateProject(projectId, {
    guidelines,
    learning: {
      ...project.learning,
      guideline_version: project.learning.guideline_version + 1,
    },
  });

  return { guidelines };
}
