/**
 * Learning Extraction Service
 *
 * Orchestrates: extract (using ingest/vision from existing code), train, regenerate guidelines.
 */

import { type Message, createImageContent, type ContentPart } from '../../services/llm';
import { resolveActiveModel } from '../../services/providers';
import { OpenAIAdapter } from '../../services/llm/adapters/openai';
import type { ExtractionSource } from '../types';
import { attachmentsService } from '../../services/attachments';
import { runPipeline, type PreparedFile } from '../../services/extraction';
import { getProject, updateProject } from './projects';
import { getExamples, saveExample, selectFewShotExamples } from './examples';
import { generateGuidelines } from './guideline-generator';
import { extractionProjectToExtractionSchema, PROJECT_FIELD_GROUP } from './pipeline-adapter';
import type { TrainingExample } from './types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { extname, resolve } from 'path';

const MARKITDOWN_URL = process.env.MARKITDOWN_API_URL || 'https://api.adacor.ai/v1/documentMarkdown/';
const MARKITDOWN_API_KEY = process.env.ADACOR_AI_API_KEY || '';

// ============== Document Ingestion (reused from existing pipeline) ==============

async function ingest(source: ExtractionSource): Promise<{
  text?: string;
  imageBase64?: string;
  imageMimeType?: string;
  /** Roh-Bytes fuer Vision-Strategien (vision-per-page/hybrid), z.B. bei PDFs. */
  rawBuffer?: Buffer;
  rawMimeType?: string;
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

      // PDFs: Die Roh-Bytes sind die PRIMAERE Quelle fuer die Vision-Strategien
      // (vision-per-page/hybrid). Markitdown liefert nur Bonus-Text (document_text
      // fuer den Learning-Loop) und ist bei gescannten PDFs ohnehin unzuverlaessig.
      // Daher best-effort mit Timeout — ein langsamer/fehlender Markitdown-Dienst
      // darf die Vision-Extraktion NICHT blockieren oder scheitern lassen.
      if (ext === '.pdf') {
        const rawBuffer = await readFile(filePath);
        let text = '';
        try {
          const file = Bun.file(filePath);
          const formData = new FormData();
          formData.append('document', file, source.filename);
          const response = await fetch(MARKITDOWN_URL, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${MARKITDOWN_API_KEY}` },
            body: formData,
            signal: AbortSignal.timeout(15000),
          });
          if (response.ok) {
            text = await response.text();
          } else {
            console.warn(`[Extraction] Markitdown ${response.status} fuer PDF — fahre nur mit Vision fort.`);
          }
        } catch (err) {
          console.warn('[Extraction] Markitdown nicht erreichbar fuer PDF — fahre nur mit Vision fort:', err instanceof Error ? err.message : err);
        }
        return { text, rawBuffer, rawMimeType: 'application/pdf' };
      }

      // Andere Dokumenttypen (docx/xlsx/…) haben keinen Vision-Fallback — hier ist
      // Markitdown die einzige Quelle und daher Pflicht.
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

      return { text: await response.text() };
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
 * Extract data from document using project definition + learned knowledge.
 *
 * Engine ist die generische Heavy-Pipeline (`services/extraction/runPipeline`).
 * Das Projekt-Schema wird via `extractionProjectToExtractionSchema` adaptiert;
 * gelernte Guidelines + Few-Shot landen in `profile.guidelines`. Strategie kommt
 * aus `project.extraction` (Default `hybrid`).
 */
export async function extract(
  projectId: string,
  source: ExtractionSource,
  userId?: string
): Promise<{
  success: boolean;
  data: Record<string, unknown>;
  document_text: string;
  fieldConfidences?: Record<string, number>;
  boxes?: Record<string, { page: number; x: number; y: number; w: number; h: number }>;
  pageImages?: { page: number; dataUri: string; width: number; height: number }[];
  strategyUsed?: string;
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

    // PreparedFile(s) fuer die Pipeline bauen. document_text wird zusaetzlich
    // gesichert — der Learning-Loop (train/Few-Shot) braucht den Dokumenttext.
    let documentText: string;
    const files: PreparedFile[] = [];
    if (ingested.rawBuffer && ingested.rawMimeType) {
      // Vision-faehige Quelle (z.B. PDF): Roh-Bytes fuer vision-per-page/hybrid.
      // Markitdown-Text (falls vorhanden) bleibt als document_text fuer den
      // Learning-Loop; die eigentliche Extraktion macht die Pipeline ueber die
      // gerenderten Seiten.
      documentText = ingested.text ?? '';
      files.push({
        filename: 'document',
        text: ingested.text ?? '',
        mimeType: ingested.rawMimeType,
        rawBuffer: ingested.rawBuffer,
      });
    } else if (ingested.text && ingested.text.trim()) {
      documentText = ingested.text;
      files.push({ filename: 'document', text: ingested.text, mimeType: 'text/plain' });
    } else if (ingested.imageBase64 && ingested.imageMimeType) {
      // Bild: Vision-Beschreibung NUR fuer document_text (Learning-Loop). Die
      // eigentliche Extraktion macht die Pipeline ueber den rawBuffer
      // (vision-per-page / hybrid rendern das Bild selbst).
      documentText = await prepareVision(ingested.imageBase64, ingested.imageMimeType, userId);
      files.push({
        filename: 'image',
        text: '',
        mimeType: ingested.imageMimeType,
        rawBuffer: Buffer.from(ingested.imageBase64, 'base64'),
      });
    } else {
      throw new Error('Kein Dokumenttext oder Bild vorhanden');
    }

    // Few-Shot + Schema fuer die Heavy-Pipeline
    const fewShotExamples = await selectFewShotExamples(projectId);
    const schema = extractionProjectToExtractionSchema(project, fewShotExamples);

    const result = await runPipeline({
      files,
      schema,
      userId: userId ?? '',
    });

    // Synthetische Gruppe (`felder.<id>`) wieder zu flach entpacken.
    const data = (result.extracted[PROJECT_FIELD_GROUP] ?? {}) as Record<string, unknown>;
    const prefix = `${PROJECT_FIELD_GROUP}.`;
    const fieldConfidences: Record<string, number> = {};
    for (const [path, conf] of Object.entries(result.fieldConfidences)) {
      fieldConfidences[path.startsWith(prefix) ? path.slice(prefix.length) : path] = conf;
    }
    // Boxen ebenfalls auf flache Feld-IDs entpacken (felder.<id> → <id>).
    const boxes: Record<string, { page: number; x: number; y: number; w: number; h: number }> = {};
    for (const [path, box] of Object.entries(result.boxes ?? {})) {
      boxes[path.startsWith(prefix) ? path.slice(prefix.length) : path] = box;
    }

    console.log(`[Extraction] Done for ${projectId} via ${result.strategyUsed} (${result.llmCalls} calls, ${result.warnings.length} warnings)`);
    return {
      success: true,
      data,
      document_text: documentText,
      fieldConfidences,
      boxes,
      pageImages: result.pageImages,
      strategyUsed: result.strategyUsed,
    };
  } catch (error: any) {
    console.error(`[Extraction] Error for project ${projectId}:`, error.message);
    return { success: false, data: {}, document_text: '', error: error.message };
  }
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
