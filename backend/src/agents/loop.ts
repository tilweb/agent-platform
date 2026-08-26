import {
  llmService,
  type Message,
  type ToolCall,
  type StreamChunk,
  type ContentPart,
  type MessageContent,
  type ChatOptions,
  createImageContent,
} from '../services/llm';
import type { UsageContext } from '../services/usageTracking';
import {
  toolRegistry,
  executeToolCall,
  setDelegationHandler,
  setLoadSkillHandler,
  getLoadSkillTool,
  type ToolDefinition,
  type ToolContext,
  type LoadSkillHandler,
} from '../tools';
import {
  matchBestSkill,
  getSkillById,
  prepareSkillActivation,
  buildSkillPrompt,
  filterToolsForSkill,
  extractSkillContext,
  formatSkillActivationEvent,
  createWorkflowState,
  advanceWorkflow,
  buildWorkflowPromptSection,
  shouldAutoAdvance,
  createStepEvent,
  getSkillSummaries,
  type SkillMatch,
  type SkillActivationContext,
  type WorkflowState,
  type SkillFilterOptions,
  type SkillSummary,
  type SkillLoadResult,
} from '../skills';
import { addMessage, getMessages, generateSessionId } from '../services/memory';
import { loadAgent, listAgents, type AgentConfig, type AgentModelConfig } from '../services/agents';
import { mcpManager } from '../mcp';
import { loadUserMemory, formatMemoryForPrompt } from '../services/userMemory';
import { getProjectContext } from '../projects/service';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { existsSync } from 'fs';
import { buildReaderContextSection, type DocumentContext } from '../services/documentFetcher';
import {
  resolveModel,
  resolveActiveModel,
  getAgentModelRequirements,
  modelMeetsRequirements,
  getExtendedCapabilities
} from '../services/providers';
import { getSystemAgentModel, type SystemAgentPurpose } from '../config/platformModels';
import type { ResolvedModel, ModelRequirements } from '../types/providers';
import { writeAgentLog } from '../services/agentLog';

// Iterations-Budgets (= LLM-Zuege; in der Praxis ~1 Tool-Aufruf/Zug). Das Limit
// ist eine Runaway-/Kosten-Notbremse, KEINE Normalbetriebs-Decke — ein realer
// Ablauf "suchen -> eingrenzen -> lesen -> synthetisieren" braucht schon 3-4
// Zuege, plus Luft fuer behebbare Tool-Fehler. Per ENV tunebar (leer/0 -> Default).
const MAX_ITERATIONS = Number(process.env.AGENT_MAX_ITERATIONS) || 12;
const MAX_DELEGATED_ITERATIONS = Number(process.env.AGENT_MAX_DELEGATED_ITERATIONS) || 20;
const MAX_SUPERVISOR_ITERATIONS = Number(process.env.AGENT_MAX_SUPERVISOR_ITERATIONS) || 25;
const MAX_DELEGATION_DEPTH = 2;

// Ab welchem maxIterations-Budget eines Ziel-Agenten eine Delegation in einen
// Hintergrund-Task ausgelagert wird (statt synchron inline im Chat zu laufen).
// Bewusst hoeher als MAX_DELEGATED_ITERATIONS und per ENV tunebar, damit laengere
// Workflow-Ketten im Chat bleiben. Auf 0/leer -> Default 30.
const BACKGROUND_TASK_ITERATION_THRESHOLD =
  Number(process.env.BACKGROUND_TASK_THRESHOLD) || 30;

/**
 * Loop state for tracking temporary tools and loaded skills within a single agent loop execution.
 * This state persists across LLM iterations within one runAgentLoop call.
 */
interface LoopState {
  /** Tools temporarily added by load_skill calls */
  temporaryTools: string[];
  /** IDs of skills loaded via load_skill tool */
  loadedSkills: string[];
  /** Skill instructions loaded via load_skill (accumulated) */
  loadedSkillInstructions: string[];
}

/**
 * Resolve the model to use for an agent based on the resolution hierarchy:
 *
 * 1. If agent has model.locked=true or model.inherit=false with provider_id/model_id:
 *    → Use the agent's defined model
 *
 * 2. For system agents (supervisor, vision, code, etc.):
 *    - If agent has model.inherit=true: Use user preference/system default
 *    - If agent ID matches a system agent purpose: Check ENV config first
 *
 * 3. For user-created agents with model defined:
 *    → Always use the agent's model (locked by default)
 *
 * 4. Fallback: Use modelOverride → user preference → system default
 *
 * @param agent - The agent configuration
 * @param options - Agent loop options (modelOverride, userId)
 * @returns Model override object or undefined to use default resolution
 */
async function resolveAgentModel(
  agent: AgentConfig | null,
  options: AgentLoopOptions
): Promise<{ providerId: string; modelId: string } | undefined> {
  // No agent specified - use default resolution
  if (!agent) {
    return options.modelOverride;
  }

  const agentModel = agent.model;

  // Case 1: Agent has explicit model with locked=true or inherit=false
  if (agentModel?.provider_id && agentModel?.model_id) {
    if (agentModel.locked || agentModel.inherit === false) {
      console.log(`[AgentLoop] Using agent-defined model: ${agentModel.provider_id}/${agentModel.model_id}`);
      return {
        providerId: agentModel.provider_id,
        modelId: agentModel.model_id,
      };
    }
  }

  // Case 2: Check for system agent ENV configuration
  const systemAgentMap: Record<string, SystemAgentPurpose> = {
    'vision-agent': 'vision',
    'code-agent': 'code',
    'research-agent': 'research',
    'supervisor': 'supervisor',
  };

  const systemAgentPurpose = systemAgentMap[agent.id];
  if (agent.system && systemAgentPurpose) {
    // Only check ENV if agent doesn't have inherit=true explicitly set
    if (agentModel?.inherit !== true) {
      const systemModel = await getSystemAgentModel(systemAgentPurpose);
      if (systemModel) {
        console.log(`[AgentLoop] Using system agent model from ENV: ${systemModel.provider.id}/${systemModel.model.id}`);
        return {
          providerId: systemModel.provider.id,
          modelId: systemModel.model.id,
        };
      }
    }
  }

  // Case 3: Agent has model.inherit=true or no model config
  // → Use the provided modelOverride (from chat session) or undefined (for user preference/system default)
  if (!agentModel || agentModel.inherit === true) {
    // For supervisor and general agents, modelOverride from session applies
    if (agent.id === 'supervisor' || agent.id === 'general') {
      return options.modelOverride;
    }

    // For other agents without locked model, also allow override
    return options.modelOverride;
  }

  // Default: Use modelOverride if provided
  return options.modelOverride;
}

/**
 * Validate that a model meets the requirements for an agent
 * Throws an error if the model is incompatible
 */
async function validateModelForAgent(
  modelOverride: { providerId: string; modelId: string } | undefined,
  agent: AgentConfig | null,
  userId?: string
): Promise<void> {
  if (!agent) return;

  // Determine model requirements based on agent configuration
  const requirements = getAgentModelRequirements({
    id: agent.id,
    tools: agent.tools,
    capabilities: agent.capabilities,
  });

  // If no specific requirements, skip validation
  if (!requirements.tool_use && !requirements.vision) {
    return;
  }

  // Resolve the model that will be used
  let resolved: ResolvedModel | null = null;

  if (modelOverride) {
    resolved = await resolveModel(modelOverride.providerId, modelOverride.modelId);
  } else {
    resolved = await resolveActiveModel('chat', userId);
  }

  if (!resolved) {
    console.warn(`[AgentLoop] Could not resolve model for capability validation`);
    return;
  }

  // Check capabilities
  const extendedCaps = getExtendedCapabilities(resolved.model);

  if (requirements.tool_use && !extendedCaps.tool_use) {
    throw new Error(
      `Model "${resolved.model.name}" unterstützt kein Tool Calling, ` +
      `aber Agent "${agent.name}" benötigt Tools. ` +
      `Bitte wähle ein Modell mit Tool-Calling-Unterstützung.`
    );
  }

  if (requirements.vision && !extendedCaps.vision) {
    throw new Error(
      `Model "${resolved.model.name}" unterstützt keine Bildverarbeitung, ` +
      `aber Agent "${agent.name}" benötigt Vision-Capability. ` +
      `Bitte wähle ein Vision-fähiges Modell.`
    );
  }
}

export interface AgentEvent {
  type: 'thinking' | 'response_chunk' | 'reasoning_chunk' | 'tool_start' | 'tool_end' | 'done' | 'error' | 'delegation_start' | 'delegation_end' | 'agent_selected' | 'skill_activated' | 'workflow_step' | 'sub_agent_step' | 'model_info' | 'task_created' | 'system_prompt' | 'context_loaded' | 'iteration_start' | 'document_analysis_start' | 'document_analysis_end';
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  agentId?: string;
  task?: string;
  // Document analysis data (per attachment)
  attachmentId?: string;
  filename?: string;
  pages?: number;
  truncated?: boolean;
  relevance?: 'hoch' | 'mittel' | 'niedrig';
  // Skill activation data
  skillId?: string;
  skillName?: string;
  skillTools?: string[];
  skillError?: string;
  // Workflow data
  stepIndex?: number;
  stepAction?: string;
  stepDescription?: string;
  totalSteps?: number;
  workflowProgress?: number;
  // Sub-agent step data
  subAgentId?: string;
  subStepType?: string;
  subStepMessage?: string;
  // Model info data
  providerName?: string;
  modelName?: string;
  // Task created data
  taskId?: string;
  taskTitle?: string;
  // Iteration data
  iteration?: number;
  maxIterations?: number;
  messagesCount?: number;
  toolsCount?: number;
  // Timing
  durationMs?: number;
}

// Attachment metadata type (from attachments service)
export interface AttachmentMetadata {
  id: string;
  filename: string;
  mimeType: string;
  type: 'document' | 'image' | 'audio';
  size: number;
  pages?: number;
}

// Full attachment with content (for direct context injection)
export interface AttachmentWithContent extends AttachmentMetadata {
  markdownContent?: string;  // For documents
  base64Data?: string;       // For images
  transcription?: string;    // For audio
}

export interface AgentLoopOptions {
  agentId?: string;
  delegationDepth?: number;
  parentSessionId?: string;
  attachments?: AttachmentWithContent[];  // Attachments with full content for direct injection
  skillId?: string;  // Explicit skill to activate (bypasses matching)
  userId?: string;   // User ID for connection tools and personalization
  readerContexts?: DocumentContext[];  // Pre-loaded document contexts from search selection
  projectId?: string;  // Project context for memory and KB injection
  modelOverride?: { providerId: string; modelId: string };  // Per-chat model override (highest priority)
}

/**
 * Inject image attachments into messages for vision-capable models.
 * Modifies the last user message to include image content parts.
 */
function injectImagesIntoMessages(
  messages: Message[],
  attachments?: AttachmentWithContent[]
): Message[] {
  // Filter image attachments with base64 data
  const imageAttachments = attachments?.filter(
    att => att.type === 'image' && att.base64Data
  ) || [];

  if (imageAttachments.length === 0) {
    return messages;
  }

  // Find the last user message to inject images into
  const lastUserIndex = messages.findLastIndex(m => m.role === 'user');
  if (lastUserIndex === -1) {
    return messages;
  }

  // Create a copy of messages to avoid mutation
  const modifiedMessages = [...messages];
  const userMessage = modifiedMessages[lastUserIndex];

  // Guard against undefined (TypeScript satisfaction - we already checked lastUserIndex)
  if (!userMessage) {
    return messages;
  }

  // Build multimodal content
  const contentParts: ContentPart[] = [];

  // Add original text content first
  const textContent = typeof userMessage.content === 'string'
    ? userMessage.content
    : Array.isArray(userMessage.content)
      ? userMessage.content.filter(p => p.type === 'text').map(p => (p as any).text).join('\n')
      : '';

  if (textContent) {
    contentParts.push({ type: 'text', text: textContent });
  }

  // Add image content parts
  for (const img of imageAttachments) {
    if (img.base64Data) {
      contentParts.push(createImageContent(img.base64Data, img.mimeType));
      console.log(`[AgentLoop] Injecting image: ${img.filename} (${img.mimeType})`);
    }
  }

  // Update the user message with multimodal content
  modifiedMessages[lastUserIndex] = {
    ...userMessage,
    content: contentParts,
  };

  console.log(`[AgentLoop] Injected ${imageAttachments.length} image(s) into user message`);
  return modifiedMessages;
}

/**
 * Automatically analyze images before processing user message.
 * Calls the vision-capable LLM directly with images and returns text descriptions.
 */
async function analyzeImagesAutomatically(
  attachments: AttachmentWithContent[],
  userMessage: string,
  userId?: string
): Promise<{ analysisText: string; analyzedImages: string[] }> {
  const imageAttachments = attachments.filter(
    att => att.type === 'image' && att.base64Data
  );

  if (imageAttachments.length === 0) {
    return { analysisText: '', analyzedImages: [] };
  }

  console.log(`[AgentLoop] Auto-analyzing ${imageAttachments.length} image(s)...`);

  const analyzedImages: string[] = [];
  const analysisResults: string[] = [];

  for (const img of imageAttachments) {
    if (!img.base64Data) continue;

    try {
      // Build multimodal message with image
      const contentParts: ContentPart[] = [
        {
          type: 'text',
          text: `Analysiere dieses Bild detailliert. Der Benutzer hat folgende Nachricht dazu geschrieben: "${userMessage}"

Erstelle eine strukturierte Analyse mit:
1. **Beschreibung**: Was ist auf dem Bild zu sehen?
2. **Details**: Wichtige Elemente, Text, Zahlen, Farben
3. **Kontext**: Worum handelt es sich (Screenshot, Foto, Diagramm, etc.)?

Falls Text im Bild ist, extrahiere ihn vollständig.
Falls es ein Fehler/Problem zeigt, beschreibe es genau.
Antworte auf Deutsch.`,
        },
        createImageContent(img.base64Data, img.mimeType),
      ];

      const messages: Message[] = [
        {
          role: 'user',
          content: contentParts,
        },
      ];

      // Call LLM with vision
      const imageUsageContext: UsageContext = {
        userId,
        source: 'image_analysis',
        operation: 'auto_analyze',
      };
      let analysisContent = '';
      for await (const chunk of llmService.streamChat(messages, [], imageUsageContext)) {
        if (!chunk?.choices?.[0]?.delta?.content) continue;
        analysisContent += chunk.choices[0].delta.content;
      }

      if (analysisContent) {
        analysisResults.push(`### Bild: ${img.filename}\n\n${analysisContent}`);
        analyzedImages.push(img.filename);
        console.log(`[AgentLoop] Analyzed image: ${img.filename} (${analysisContent.length} chars)`);
      }
    } catch (error: any) {
      console.error(`[AgentLoop] Failed to analyze image ${img.filename}:`, error.message);
      analysisResults.push(`### Bild: ${img.filename}\n\n[Analyse fehlgeschlagen: ${error.message}]`);
    }
  }

  if (analysisResults.length === 0) {
    return { analysisText: '', analyzedImages: [] };
  }

  const analysisText = `
## Hochgeladene Bilder - Automatische Analyse

Die folgenden Bilder wurden vom Benutzer hochgeladen und automatisch analysiert.
Bei Fragen zu den Bildern beziehe dich auf diese Analyse.

${analysisResults.join('\n\n---\n\n')}

---
`;

  return { analysisText, analyzedImages };
}

// Pro Document-Attachment ein dedizierter LLM-Call mit dem vollen Markdown-Text
// im Context. Ersetzt die alte 15k-Truncation in buildSupervisorPrompt durch
// eine echte Pre-Analysis-Section. Pattern analog zu analyzeImagesAutomatically.
//
// Token-Budget Qwen 30B: 128k Context. Effektiv nutzbar für Doc: ~120k Tokens
// (≈ 480k Zeichen). Drei Stufen:
//   - <15k chars : direkt im Supervisor-Prompt (keine Sub-Analyse, kein Round-Trip)
//   - 15k-480k   : Document-Agent mit Volltext, einer pro Doc, parallel
//   - >480k      : auf 480k gekürzt + Warning-Disclaimer im Output
//
// Concurrency: 3 parallel. Hard-Cap: 5 Documents pro User-Message.
const DOC_INLINE_THRESHOLD = 15000;
const DOC_MAX_CONTENT_LENGTH = 480000;
const DOC_MAX_CONCURRENT = 3;
const DOC_MAX_PER_REQUEST = 5;

interface AnalyzedDocument {
  attachmentId: string;
  filename: string;
  pages?: number;
  relevance: 'hoch' | 'mittel' | 'niedrig' | 'unbekannt';
  analysisMarkdown: string;
  truncated: boolean;
  error?: string;
}

function parseRelevance(text: string): AnalyzedDocument['relevance'] {
  const m = text.match(/##\s*Relevanz\s*:\s*(hoch|mittel|niedrig)/i);
  if (m) return m[1]!.toLowerCase() as AnalyzedDocument['relevance'];
  return 'unbekannt';
}

async function analyzeDocumentsAutomatically(
  attachments: AttachmentWithContent[],
  userMessage: string,
  userId: string | undefined,
  emit: (event: AgentEvent) => void,
): Promise<{ analysisText: string; analyzedDocumentIds: Set<string>; skippedOversizedCount: number }> {
  const docAttachments = attachments.filter(
    att => att.type === 'document' && typeof att.markdownContent === 'string' && att.markdownContent.length > 0,
  );

  if (docAttachments.length === 0) {
    return { analysisText: '', analyzedDocumentIds: new Set(), skippedOversizedCount: 0 };
  }

  // Trennung: kleine Docs (<15k) inline, große (>=15k) via Sub-Agent
  const smallDocs = docAttachments.filter(d => (d.markdownContent || '').length < DOC_INLINE_THRESHOLD);
  const bigDocs = docAttachments.filter(d => (d.markdownContent || '').length >= DOC_INLINE_THRESHOLD);
  const eligibleBig = bigDocs.slice(0, DOC_MAX_PER_REQUEST);
  const skippedOversized = bigDocs.slice(DOC_MAX_PER_REQUEST);

  console.log(`[AgentLoop] Documents: ${smallDocs.length} inline, ${eligibleBig.length} via Sub-Agent (${skippedOversized.length} skipped due to per-request cap)`);

  // Sub-Agent-Calls parallel, Concurrency-Cap = DOC_MAX_CONCURRENT
  const subAgentResults: AnalyzedDocument[] = new Array(eligibleBig.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const idx = nextIndex++;
      if (idx >= eligibleBig.length) return;
      const doc = eligibleBig[idx]!;
      subAgentResults[idx] = await analyzeOneDocument(doc, userMessage, userId, emit);
    }
  };
  await Promise.all(Array.from({ length: Math.min(DOC_MAX_CONCURRENT, eligibleBig.length) }, worker));

  // Build sections
  const allSections: string[] = [];
  let counter = 0;

  for (const doc of smallDocs) {
    counter += 1;
    const content = doc.markdownContent || '';
    const pagesNote = doc.pages ? ` (~${doc.pages} Seiten)` : '';
    allSections.push(
      `### ${counter}. ${doc.filename}${pagesNote} — Inline (kleines Dokument, Volltext)\nattachment_id: \`${doc.id}\`\n\n${content}`,
    );
  }

  for (const r of subAgentResults) {
    counter += 1;
    const sizeNote = r.truncated ? ' — **Original >480k Zeichen, gekürzt für Sub-Agent-Analyse**' : '';
    const pagesNote = r.pages ? ` (~${r.pages} Seiten)` : '';
    const errorNote = r.error ? `\n\n[Fehler bei Analyse: ${r.error}]` : '';
    allSections.push(
      `### ${counter}. ${r.filename}${pagesNote} — Sub-Agent-Analyse${sizeNote}\nattachment_id: \`${r.attachmentId}\`\n\n${r.analysisMarkdown}${errorNote}`,
    );
  }

  if (allSections.length === 0 && skippedOversized.length === 0) {
    return { analysisText: '', analyzedDocumentIds: new Set(), skippedOversizedCount: 0 };
  }

  const skippedNote = skippedOversized.length > 0
    ? `\n\n> Hinweis: ${skippedOversized.length} weitere Dokument(e) wurden NICHT vollanalysiert (Cap: ${DOC_MAX_PER_REQUEST} Sub-Agent-Analysen pro Nachricht). Diese Dokumente:\n${skippedOversized.map(a => `> - \`${a.id}\` ${a.filename}`).join('\n')}\n> Bei Bedarf via \`read_chat_attachment\` mit \`format: "summary"\` oder \`"full"\` nachladen.`
    : '';

  const intro = subAgentResults.length > 0
    ? `Pro großem Dokument (≥15k Zeichen) wurde **bereits** ein dedizierter Sub-Agent mit dem vollständigen Inhalt im Context gestartet. Kleine Dokumente sind direkt inline.

**WICHTIG — Antwort-Strategie**:
1. **Antworte DIREKT aus diesen Analysen.** Sie enthalten die wichtigsten Inhalte, Zitate und eine relevanzgewichtete Antwort auf die User-Frage.
2. **Delegiere NICHT an \`chat-document-reader\`** — das wäre Doppelarbeit und kann bei großen Dokumenten zu 413-Fehlern führen.
3. Nur wenn die Analyse für eine sehr spezifische Detailfrage nicht ausreicht: \`read_chat_attachment\` mit \`format: "summary"\` für einen 2k-Auszug. \`format: "full"\` nur als letzte Option und nur, wenn das Dokument klein ist (<50 Seiten).`
    : `Kleine Dokumente sind direkt inline. Antworte direkt aus diesem Inhalt — keine Delegation an \`chat-document-reader\` nötig.`;

  const analysisText = `
## Hochgeladene Dokumente

${intro}

${allSections.join('\n\n---\n\n')}${skippedNote}

---
`;

  const analyzedDocumentIds = new Set<string>([
    ...smallDocs.map(d => d.id),
    ...subAgentResults.map(r => r.attachmentId),
    ...skippedOversized.map(d => d.id),
  ]);

  return { analysisText, analyzedDocumentIds, skippedOversizedCount: skippedOversized.length };
}

async function analyzeOneDocument(
  doc: AttachmentWithContent,
  userMessage: string,
  userId: string | undefined,
  emit: (event: AgentEvent) => void,
): Promise<AnalyzedDocument> {
  const started = Date.now();
  const original = doc.markdownContent || '';
  const truncated = original.length > DOC_MAX_CONTENT_LENGTH;
  const docContent = truncated ? original.slice(0, DOC_MAX_CONTENT_LENGTH) + '\n\n[... Dokument wurde an dieser Stelle gekürzt — Original war länger als verarbeitbar ...]' : original;

  emit({
    type: 'document_analysis_start',
    attachmentId: doc.id,
    filename: doc.filename,
    pages: doc.pages,
    truncated,
  });

  const sysPrompt = `Du bist ein Document-Analyzer für ein vom User hochgeladenes Dokument. Du hast den vollständigen Inhalt direkt vor dir und sollst dem Supervisor-Agent eine kompakte, zitatbelegte Analyse liefern.

DOKUMENT: ${doc.filename}${doc.pages ? ` (~${doc.pages} Seiten)` : ''}${truncated ? ' [GEKÜRZT auf 480k Zeichen — Analyse basiert auf dem Anfang]' : ''}

INHALT:
"""
${docContent}
"""

USER-FRAGE:
"${userMessage}"

Antworte STRENG nach diesem Markdown-Schema:

## Relevanz: hoch | mittel | niedrig
(Wie relevant ist dieses Dokument für die User-Frage? "hoch" = direkt verwertbare Antwort enthalten, "mittel" = Kontext/Hintergrund, "niedrig" = Frage geht nicht über dieses Dokument.)

## Zusammenfassung
(Max 5 Sätze. Worum geht das Dokument inhaltlich.)

## Schlüsselstellen
(Bis zu 5 wörtliche Zitate aus dem Dokument, die für die User-Frage am wichtigsten sind. Format: \`- "..." (Abschnitt/Seite falls erkennbar)\`. Nur Zitate aus dem Dokument, nichts erfinden.)

## Antwort auf User-Frage
(Wenn Relevanz hoch oder mittel: konkrete Antwort auf "${userMessage}" mit Bezug zu den Zitaten oben. Wenn niedrig: dieses Feld weglassen oder kurz erklären warum nicht antwortbar.)
${truncated ? '\n## Hinweis: Dokument war länger als 480k Zeichen — diese Analyse basiert nur auf den ersten 160 Seiten.' : ''}`;

  const messages: Message[] = [
    { role: 'system', content: sysPrompt },
    { role: 'user', content: 'Erstelle die Analyse gemäss Schema oben.' },
  ];

  const usageContext: UsageContext = {
    userId,
    source: 'document_analysis',
    operation: doc.id,
    resourceId: doc.id,
  };

  let analysisContent = '';
  let error: string | undefined;
  try {
    for await (const chunk of llmService.streamChat(messages, [], usageContext)) {
      const piece = chunk?.choices?.[0]?.delta?.content;
      if (piece) analysisContent += piece;
    }
    if (!analysisContent.trim()) {
      error = 'leere Antwort vom Modell';
    }
  } catch (e: any) {
    error = e?.message || String(e);
    console.error(`[AgentLoop] Document analysis failed for ${doc.filename}:`, error);
  }

  const relevance = parseRelevance(analysisContent);
  const result: AnalyzedDocument = {
    attachmentId: doc.id,
    filename: doc.filename,
    pages: doc.pages,
    relevance,
    analysisMarkdown: analysisContent || `[Analyse fehlgeschlagen${error ? ': ' + error : ''}]`,
    truncated,
    error,
  };

  emit({
    type: 'document_analysis_end',
    attachmentId: doc.id,
    filename: doc.filename,
    pages: doc.pages,
    truncated,
    relevance: relevance === 'unbekannt' ? undefined : (relevance as 'hoch' | 'mittel' | 'niedrig'),
    durationMs: Date.now() - started,
  });

  return result;
}

async function loadLegacyAgentConfig(): Promise<string> {
  const configPath = resolve(process.cwd(), '../data/config/agents.md');

  if (!existsSync(configPath)) {
    return `You are a helpful AI assistant. You can use tools to read and write files, and help users with various tasks.`;
  }

  const content = await readFile(configPath, 'utf-8');
  // Remove frontmatter if present
  return content.replace(/^---\n[\s\S]*?\n---\n/, '').trim();
}

function mergeToolCalls(existingCalls: ToolCall[], delta: StreamChunk['choices'][0]['delta']): ToolCall[] {
  if (!delta.tool_calls) return existingCalls;

  const calls = [...existingCalls];

  for (const tc of delta.tool_calls) {
    const index = tc.index;

    // Initialize if new
    if (!calls[index]) {
      calls[index] = {
        id: tc.id || '',
        type: 'function',
        function: {
          name: tc.function?.name || '',
          arguments: tc.function?.arguments || '',
        },
      };
    } else {
      // Merge incrementally
      if (tc.id) calls[index].id = tc.id;
      if (tc.function?.name) calls[index].function.name += tc.function.name;
      if (tc.function?.arguments) calls[index].function.arguments += tc.function.arguments;
    }
  }

  return calls;
}

/**
 * Extract tool calls from message content when models output them as JSON text
 * instead of using proper tool_calls format (common with some Qwen and Mistral deployments)
 */
function extractJsonToolCalls(content: string): ToolCall[] {
  if (!content) return [];

  // Strip <tool_call> XML wrapper tags (Qwen3 format)
  content = content.replace(/<\/?tool_call>/g, '').trim();

  const toolCalls: ToolCall[] = [];
  let match;

  // Pattern 0: Mistral format - [TOOL_CALLS]tool_name{...args...}
  // Example: [TOOL_CALLS]delegate_to_agent{"agent_id": "image-generator", "task": "...", "context": ""}
  const mistralPattern = /\[TOOL_CALLS\](\w+)(\{[\s\S]*?\})(?=\s*$|\s*\[TOOL_CALLS\])/g;
  while ((match = mistralPattern.exec(content)) !== null) {
    const [, name, argsStr] = match;
    if (!name || !argsStr) continue;
    try {
      // Validate the arguments are valid JSON
      JSON.parse(argsStr);
      toolCalls.push({
        id: `extracted_${Date.now()}_${toolCalls.length}`,
        type: 'function',
        function: {
          name,
          arguments: argsStr,
        },
      });
      console.log(`[extractJsonToolCalls] Extracted Mistral tool call: ${name}`);
    } catch (e) {
      // Try to find balanced braces for nested JSON
      const balancedJson = extractBalancedJson(content, content.indexOf(argsStr));
      if (balancedJson) {
        try {
          JSON.parse(balancedJson);
          toolCalls.push({
            id: `extracted_${Date.now()}_${toolCalls.length}`,
            type: 'function',
            function: {
              name,
              arguments: balancedJson,
            },
          });
          console.log(`[extractJsonToolCalls] Extracted Mistral tool call (balanced): ${name}`);
        } catch {
          // Invalid JSON, skip
        }
      }
    }
  }

  if (toolCalls.length > 0) return toolCalls;

  // Pattern 1: {"name": "tool_name", "arguments": {...}}
  // This is what Qwen sometimes outputs
  const toolCallPattern = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[^}]+\})\s*\}/g;

  while ((match = toolCallPattern.exec(content)) !== null) {
    const [, name, argsStr] = match;
    if (!name || !argsStr) continue;
    try {
      // Validate the arguments are valid JSON
      JSON.parse(argsStr);
      toolCalls.push({
        id: `extracted_${Date.now()}_${toolCalls.length}`,
        type: 'function',
        function: {
          name,
          arguments: argsStr,
        },
      });
    } catch {
      // Invalid JSON in arguments, skip
    }
  }

  // Pattern 2: Tool call with nested arguments object using balanced brace extraction
  // {"name": "delegate_to_agent", "arguments": {"agent_id": "...", "task": "..."}}
  if (toolCalls.length === 0) {
    const nameMarkerPattern = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*/g;
    while ((match = nameMarkerPattern.exec(content)) !== null) {
      const [prefix, name] = match;
      if (!name) continue;
      // Find the opening brace of the outer object
      const outerBracePos = match.index;
      const fullJson = extractBalancedJson(content, outerBracePos);
      if (fullJson) {
        try {
          const parsed = JSON.parse(fullJson);
          if (parsed.name && parsed.arguments) {
            toolCalls.push({
              id: `extracted_${Date.now()}_${toolCalls.length}`,
              type: 'function',
              function: {
                name: parsed.name,
                arguments: typeof parsed.arguments === 'string'
                  ? parsed.arguments
                  : JSON.stringify(parsed.arguments),
              },
            });
          }
        } catch {
          // Invalid JSON, skip
        }
      }
    }
  }

  // Pattern 3: Direct delegate_to_agent arguments (when model outputs just the args)
  // {"agent_id": "...", "task": "...", "context": "..."}
  // This happens when models don't properly wrap the tool call
  if (toolCalls.length === 0) {
    const delegatePattern = /\{\s*"agent_id"\s*:\s*"([^"]+)"\s*,\s*"task"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"context"\s*:\s*"([\s\S]*?)")?\s*\}/g;
    while ((match = delegatePattern.exec(content)) !== null) {
      const [fullMatch, agentId, task, context] = match;
      if (agentId && task) {
        const args = {
          agent_id: agentId,
          task: task,
          context: context || '',
        };
        toolCalls.push({
          id: `extracted_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: 'delegate_to_agent',
            arguments: JSON.stringify(args),
          },
        });
        console.log(`[extractJsonToolCalls] Extracted direct delegate_to_agent call to: ${agentId}`);
      }
    }
  }

  // Pattern 4: Direct create_task arguments (when model outputs just the args)
  // {"title": "...", "description": "...", "assigned_agent": "...", "priority": "..."}
  if (toolCalls.length === 0) {
    const createTaskPattern = /\{\s*"title"\s*:\s*"([^"]+)"\s*,\s*"description"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"assigned_agent"\s*:\s*"([^"]*)")?\s*(?:,\s*"priority"\s*:\s*"([^"]*)")?\s*\}/g;
    while ((match = createTaskPattern.exec(content)) !== null) {
      const [, title, description, assignedAgent, priority] = match;
      if (title && description) {
        const args: Record<string, string> = { title, description };
        if (assignedAgent) args.assigned_agent = assignedAgent;
        if (priority) args.priority = priority;
        toolCalls.push({
          id: `extracted_${Date.now()}_${toolCalls.length}`,
          type: 'function',
          function: {
            name: 'create_task',
            arguments: JSON.stringify(args),
          },
        });
        console.log(`[extractJsonToolCalls] Extracted direct create_task: ${title}`);
      }
    }
  }

  return toolCalls;
}

/**
 * Extract a balanced JSON object from a string starting at a given position
 * Handles nested braces correctly
 */
function extractBalancedJson(content: string, startPos: number): string | null {
  if (startPos < 0 || startPos >= content.length) return null;

  // Find the opening brace
  let pos = startPos;
  while (pos < content.length && content[pos] !== '{') pos++;
  if (pos >= content.length) return null;

  const start = pos;
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = start; i < content.length; i++) {
    const char = content[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === '\\' && inString) {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === '{') braceCount++;
      if (char === '}') braceCount--;

      if (braceCount === 0) {
        return content.substring(start, i + 1);
      }
    }
  }

  return null;
}

/**
 * Remove extracted tool calls from content
 * Handles:
 * - Mistral format: [TOOL_CALLS]tool_name{...nested json...}
 * - Qwen format: {"name": "...", "arguments": {...}}
 * - Direct delegate_to_agent: {"agent_id": "...", "task": "...", "context": "..."}
 * - Markdown code blocks containing these formats
 */
function removeMistralToolCalls(content: string): string {
  let result = content;

  // Remove Mistral [TOOL_CALLS] format
  const marker = '[TOOL_CALLS]';
  let searchStart = 0;

  while (true) {
    const markerPos = result.indexOf(marker, searchStart);
    if (markerPos === -1) break;

    // Find where the tool name ends (at the opening brace)
    const bracePos = result.indexOf('{', markerPos + marker.length);
    if (bracePos === -1) break;

    // Extract the balanced JSON object
    const jsonStr = extractBalancedJson(result, bracePos);
    if (!jsonStr) {
      searchStart = bracePos + 1;
      continue;
    }

    // Remove the entire [TOOL_CALLS]tool_name{...} section
    const endPos = bracePos + jsonStr.length;
    result = result.substring(0, markerPos) + result.substring(endPos);
    // Don't advance searchStart since we removed content
  }

  // Remove <tool_call> XML wrapper tags
  result = result.replace(/<\/?tool_call>/g, '');

  // Remove Qwen {"name": ..., "arguments": ...} format using balanced brace extraction
  const namePattern = /\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:/;
  let nameMatch;
  while ((nameMatch = namePattern.exec(result)) !== null) {
    const fullJson = extractBalancedJson(result, nameMatch.index);
    if (fullJson) {
      result = result.substring(0, nameMatch.index) + result.substring(nameMatch.index + fullJson.length);
    } else {
      break; // Avoid infinite loop if extraction fails
    }
  }

  // Remove direct delegate_to_agent arguments (with optional markdown code block)
  // Pattern: ```json\n{"agent_id": ...}\n``` or just {"agent_id": ...}
  result = result.replace(/```json\s*\n?\s*\{\s*"agent_id"\s*:\s*"[^"]+"\s*,\s*"task"\s*:\s*"[\s\S]*?"\s*(?:,\s*"context"\s*:\s*"[\s\S]*?")?\s*\}\s*\n?```/g, '');
  result = result.replace(/\{\s*"agent_id"\s*:\s*"[^"]+"\s*,\s*"task"\s*:\s*"[\s\S]*?"\s*(?:,\s*"context"\s*:\s*"[\s\S]*?")?\s*\}/g, '');

  return result.trim();
}

/**
 * Build the supervisor prompt by injecting the dynamic agent list, user memory, and attachments.
 *
 * Security: die Agent-Liste wird nach User-Permissions gefiltert — der
 * Supervisor sieht nur die Agenten, an die der User selbst delegieren darf.
 * System-Agenten sind fuer alle sichtbar; User-Agenten brauchen `canView`.
 * Ohne userId werden ausschliesslich System-Agenten aufgelistet (defensiv).
 */
async function buildSupervisorPrompt(agent: AgentConfig, attachments?: AttachmentWithContent[], userId?: string): Promise<string> {
  const allAgents = await listAgents(); // non-internal agents only

  // "Built-in" = system OR internal — beide bedeuten "ships with code".
  const isBuiltIn = (a: typeof allAgents[number]) => a.system || a.internal;
  let agents: typeof allAgents;
  if (userId) {
    const userAgentIds = allAgents.filter(a => !isBuiltIn(a)).map(a => a.id);
    const { listAccessibleResources } = await import('../rbac/accessControl');
    const accessible = await listAccessibleResources(userId, 'agent', userAgentIds);
    const allowedIds = new Set(accessible.map(a => a.resourceId));
    agents = allAgents.filter(a => isBuiltIn(a) || allowedIds.has(a.id));
  } else {
    agents = allAgents.filter(isBuiltIn);
  }

  const agentListLines = agents.map(a => {
    const caps = a.capabilities.length > 0 ? a.capabilities.join(', ') : 'Keine';
    return `- **${a.id}** (${a.name}): ${a.description}\n  Faehigkeiten: ${caps}`;
  });

  const agentListStr = agentListLines.length > 0
    ? agentListLines.join('\n')
    : '(Keine Agenten verfuegbar)';

  // Load and format user memory. Skip entirely if userId is unknown to avoid
  // leaking the shared `default.yaml` into another user's prompt.
  let userMemoryStr = '';
  if (userId) {
    try {
      const memory = await loadUserMemory(userId);
      if (memory.settings.include_in_prompt) {
        userMemoryStr = formatMemoryForPrompt(memory);
      }
    } catch (error) {
      console.warn('Failed to load user memory:', error);
      userMemoryStr = '';
    }
  }

  // Build attachments section if present - inject document content directly for reliable access
  let attachmentsStr = '';
  if (attachments && attachments.length > 0) {
    const MAX_CONTENT_LENGTH = 15000;

    const attachmentSections = attachments.map((att, i) => {
      if (att.type === 'document') {
        // Document content is injected via documentAnalysisSection (Pre-Analysis) earlier
        // in the prompt. Hier nur Metadaten — der Inhalt steht oben in der
        // "Hochgeladene Dokumente"-Sektion. Bewusst KEIN Hinweis auf
        // read_chat_attachment oder chat-document-reader, um den Supervisor
        // nicht zur Doppel-Delegation zu verleiten.
        const pagesNote = att.pages ? ` (~${att.pages} Seiten)` : '';
        return `
### ${i + 1}. ${att.filename} (Dokument${pagesNote})
- **attachment_id:** \`${att.id}\`
- Inhalt + Analyse: siehe Sektion "Hochgeladene Dokumente" weiter oben.
`;
      } else if (att.type === 'image') {
        // Images are automatically analyzed - include ID for edit_image tool
        return `
### ${i + 1}. ${att.filename} (Bild)
- **attachment_id:** \`${att.id}\`
- Das Bild wurde automatisch analysiert. Die detaillierte Analyse findest du weiter oben.

**Zum Bearbeiten dieses Bildes:** Verwende das \`edit_image\` Tool mit dieser attachment_id.
`;
      } else if (att.type === 'audio' && att.transcription) {
        // Inject audio transcription directly
        const truncatedTranscription = att.transcription.length > MAX_CONTENT_LENGTH
          ? att.transcription.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... gekürzt ...]'
          : att.transcription;

        return `
### ${i + 1}. ${att.filename} (Audio-Transkription)

${truncatedTranscription}
`;
      } else {
        return `
### ${i + 1}. ${att.filename} (${att.type})

[Konnte nicht geladen werden]
`;
      }
    });

    attachmentsStr = `

## WICHTIG: Hochgeladene Dateien

Der Benutzer hat folgende Dateien hochgeladen. Der Inhalt (Dokumente, Audio-Transkriptionen) ist hier direkt verfuegbar:

${attachmentSections.join('\n')}

---

### PRIORISIERUNG FÜR FRAGEN ZU HOCHGELADENEN DATEIEN:

1. **NICHT an chat-document-reader delegieren** — du hast den Dokumentinhalt bereits oben vorliegen
2. **DIREKT antworten** basierend auf dem oben eingebetteten Inhalt
3. Zitiere relevante Passagen aus den Dokumenten
4. **NUR** wenn die Information definitiv NICHT in den Dokumenten ist, sage das klar
5. Falls du doch delegieren musst, gib die **attachment_id** im context-Parameter mit

`;
  }

  let prompt = agent.systemPrompt
    .replace('{{AGENT_LIST}}', agentListStr)
    .replace('{{USER_MEMORY}}', userMemoryStr);

  // Inject attachments section before the final rules (or at the end if no marker)
  if (attachmentsStr) {
    // Insert before "## Wichtige Regeln" if it exists
    if (prompt.includes('## Wichtige Regeln')) {
      prompt = prompt.replace('## Wichtige Regeln', attachmentsStr + '\n## Wichtige Regeln');
    } else {
      prompt = prompt + '\n' + attachmentsStr;
    }
  }

  return prompt;
}

/**
 * Build the skill metadata section for system prompt injection.
 * Shows available skills so agents can decide which to load.
 */
async function buildSkillMetadataSection(
  agent: AgentConfig | null
): Promise<string> {
  // Build filter options from agent configuration
  const filterOptions = {
    agentSkills: agent?.skills,
    skillMode: agent?.skillMode,
  };

  // Check if agent can use skills
  const agentSkills = Array.isArray(agent?.skills) ? agent.skills : [];
  const canUseSkills = agent?.skillMode !== 'allow' || agentSkills.length > 0;

  if (!canUseSkills) {
    return ''; // No skill section if agent has no skill access
  }

  // Get skill summaries
  const summaries = await getSkillSummaries(filterOptions);

  if (summaries.length === 0) {
    return ''; // No skills available
  }

  // Build the skill metadata section
  const skillLines = summaries.map(s => {
    let line = `- **${s.id}** (${s.name}): ${s.description}`;
    if (s.use_when) {
      // Indent use_when hints
      const hints = s.use_when.split('\n').map(h => `  ${h.trim()}`).join('\n');
      line += `\n  Nutze wenn:\n${hints}`;
    }
    if (s.output_type) {
      line += `\n  Ausgabe: ${s.output_type}`;
    }
    return line;
  });

  return `
## Verfügbare Skills

Du kannst bei Bedarf Skills laden um spezifische Methodiken zu nutzen.
Nutze das Tool \`load_skill\` mit der Skill-ID um einen Skill zu aktivieren.

${skillLines.join('\n\n')}

**Hinweis:** Skills werden nur geladen wenn du sie explizit aufrufst. Entscheide selbst ob ein Skill für die aktuelle Aufgabe hilfreich ist.

`;
}

/**
 * Get tools for an agent based on its configuration
 */
function getAgentTools(agent: AgentConfig, depth: number, temporaryTools?: string[]): ToolDefinition[] {
  const tools = Array.isArray(agent.tools) ? agent.tools : [];
  console.log(`[getAgentTools] Agent ${agent.id} has tools config:`, tools);

  // Start with agent's base tools
  const toolNames = tools.filter(name => {
    // Exclude delegation tool if at max depth
    if (name === 'delegate_to_agent' && depth >= MAX_DELEGATION_DEPTH) {
      return false;
    }
    return true;
  });

  // Add load_skill as a base tool for all agents (unless skillMode is 'allow' with empty skills)
  // This allows agents to load skills on demand
  const canUseSkills = agent.skillMode !== 'allow' || (agent.skills && agent.skills.length > 0);
  if (canUseSkills && !toolNames.includes('load_skill')) {
    toolNames.push('load_skill');
    console.log(`[getAgentTools] Added load_skill as base tool`);
  }

  // Add temporary tools from loaded skills (if not already present)
  if (temporaryTools && temporaryTools.length > 0) {
    for (const tempTool of temporaryTools) {
      if (!toolNames.includes(tempTool)) {
        toolNames.push(tempTool);
        console.log(`[getAgentTools] Added temporary tool from skill: ${tempTool}`);
      }
    }
  }

  const definitions = toolRegistry.getDefinitions(toolNames);
  console.log(`[getAgentTools] Returning ${definitions.length} tool definitions for ${toolNames.join(', ')}`);
  return definitions;
}

/**
 * Get tools for an agent, including delegation tool if applicable
 * @param agent - Agent configuration
 * @param depth - Current delegation depth
 * @param temporaryTools - Additional tools from loaded skills
 */
function getToolsForAgent(agent: AgentConfig | null, depth: number, temporaryTools?: string[]): ToolDefinition[] {
  console.log(`[getToolsForAgent] agent=${agent?.id || 'null'}, depth=${depth}, temporaryTools=${temporaryTools?.length || 0}`);
  if (!agent) {
    // Fallback to basic tools (plus any temporary tools)
    console.log('[getToolsForAgent] No agent, using fallback tools');
    const baseTools = ['file_read', 'file_write', 'file_list'];
    if (temporaryTools) {
      baseTools.push(...temporaryTools.filter(t => !baseTools.includes(t)));
    }
    return toolRegistry.getDefinitions(baseTools);
  }

  const tools = getAgentTools(agent, depth, temporaryTools);
  console.log(`[getToolsForAgent] Returning ${tools.length} tools for ${agent.id}`);
  return tools;
}

/**
 * Run a delegated agent task (non-streaming, returns result)
 */
async function runDelegatedAgent(
  agentId: string,
  task: string,
  context: string | undefined,
  depth: number,
  eventCallback?: (event: AgentEvent) => void,
  parentSessionId?: string,
  userId?: string,
  parentModelOverride?: { providerId: string; modelId: string }
): Promise<string> {
  const agent = await loadAgent(agentId);
  if (!agent) {
    return `Error: Agent "${agentId}" not found`;
  }

  // Resolve the model for this delegated agent
  // Pass parent's modelOverride so non-locked agents inherit the chat model selection
  const delegatedAgentOptions: AgentLoopOptions = {
    agentId,
    delegationDepth: depth,
    parentSessionId,
    userId,
    modelOverride: parentModelOverride,
  };
  const delegatedModelOverride = await resolveAgentModel(agent, delegatedAgentOptions);

  // Validate model capabilities
  try {
    await validateModelForAgent(delegatedModelOverride, agent, userId);
  } catch (error: any) {
    return `Error: ${error.message}`;
  }

  // Create a temporary session for the delegated task
  const delegationSessionId = generateSessionId();

  // Separate skill instructions from regular context
  let skillInstructions = '';
  let regularContext = context || '';

  // Check if context contains skill instructions
  const skillMatch = regularContext.match(/\[SKILL-ANWEISUNGEN: ([^\]]+)\]([\s\S]*?)\[\/SKILL-ANWEISUNGEN\]/);
  if (skillMatch && skillMatch[1] && skillMatch[2]) {
    skillInstructions = `\n\n## Aktiver Skill: ${skillMatch[1]}\n${skillMatch[2].trim()}`;
    regularContext = regularContext.replace(skillMatch[0], '').trim();
  }

  // Build the delegated message
  let delegatedMessage = task;
  if (regularContext) {
    delegatedMessage = `Context: ${regularContext}\n\nTask: ${task}`;
  }

  // Add user message to delegation session
  addMessage(delegationSessionId, { role: 'user', content: delegatedMessage });

  // Build system prompt with language instruction, date context, and optional skill instructions
  const languageInstruction = `[SPRACHE: Du MUSST auf Deutsch antworten. Wechsle NIEMALS ins Englische.]\n\n`;

  // Add current date/time context
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  const currentDate = now.toLocaleDateString('de-DE', dateOptions);
  const currentTime = now.toLocaleTimeString('de-DE', timeOptions);
  const contextInfo = `[AKTUELLES DATUM UND UHRZEIT: ${currentDate}, ${currentTime}]\n\n`;

  const baseSystemPrompt = languageInstruction + contextInfo + agent.systemPrompt + skillInstructions;

  // Create tool context - pass parentSessionId for attachment access, userId for connections
  const toolContext: ToolContext = {
    sessionId: delegationSessionId,
    agentId,
    delegationDepth: depth,
    parentSessionId,
    userId,
  };

  const emit = (subStepType: string, subStepMessage: string) => {
    if (eventCallback) {
      eventCallback({
        type: 'sub_agent_step',
        subAgentId: agentId,
        subStepType,
        subStepMessage,
      });
    }
  };

  // Set up skill loading support (same mechanism as main agent loop)
  const loopState: LoopState = {
    temporaryTools: [],
    loadedSkills: [],
    loadedSkillInstructions: [],
  };

  // Save previous handler and set up new one for this delegated agent
  const previousHandler = getLoadSkillTool()?.getHandler() || null;
  const loadSkillHandler: LoadSkillHandler = {
    addTemporaryTools: (tools: string[]) => {
      for (const tool of tools) {
        if (!loopState.temporaryTools.includes(tool)) {
          loopState.temporaryTools.push(tool);
          console.log(`[DelegatedAgent] Added temporary tool from skill: ${tool}`);
        }
      }
    },
    getLoadedSkills: () => loopState.loadedSkills,
    isSkillAllowed: (skillId: string) => {
      if (agent.skillMode === 'none') return false;
      if (agent.skillMode === 'allow') {
        const allowedSkills = agent.skills || [];
        return allowedSkills.includes(skillId);
      }
      return true;
    },
  };
  setLoadSkillHandler(loadSkillHandler);

  const maxIterations = agent.maxIterations || MAX_DELEGATED_ITERATIONS;

  let iteration = 0;
  let finalResult = '';

  // Track important tool results (images, documents) that should be in the final response
  let importantToolResults: string[] = [];

  while (iteration < maxIterations) {
    iteration++;
    console.log(`Delegated agent ${agentId} iteration ${iteration}/${maxIterations} (depth: ${depth})`);

    emit('thinking', 'Denkt nach...');

    // Build system prompt with skill instructions (updated each iteration)
    let currentSystemPrompt = baseSystemPrompt;
    if (loopState.loadedSkillInstructions.length > 0) {
      currentSystemPrompt += '\n\n' + loopState.loadedSkillInstructions.join('\n\n');
    }

    // Get tools including temporary tools from loaded skills
    const tools = getToolsForAgent(agent, depth, loopState.temporaryTools);

    const history = getMessages(delegationSessionId);

    // Context window management: truncate old tool results to prevent body explosion
    // Keep recent messages intact, compress older tool results
    const MAX_TOOL_RESULT_LENGTH = 2000;
    const RECENT_MESSAGES_KEEP = 6; // Keep last N messages untruncated
    const compressedHistory = history.map((msg, idx) => {
      // Keep recent messages intact
      if (idx >= history.length - RECENT_MESSAGES_KEEP) return msg;
      // Only truncate tool results
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > MAX_TOOL_RESULT_LENGTH) {
        return {
          ...msg,
          content: msg.content.substring(0, MAX_TOOL_RESULT_LENGTH) + '\n\n[... truncated, see scratchpad for details]',
        };
      }
      return msg;
    });

    const messages: Message[] = [
      { role: 'system', content: currentSystemPrompt },
      ...compressedHistory,
    ];

    // Create usage context for delegation
    const delegationUsageContext: UsageContext = {
      userId,
      source: 'delegation',
      operation: agentId,
    };

    // Build chat options for per-request model resolution
    // Use the delegated agent's resolved model override
    const chatOptions: ChatOptions = {
      userId,
      modelOverride: delegatedModelOverride,
    };

    let accumulatedContent = '';
    let toolCalls: ToolCall[] = [];
    let finishReason: string | null = null;

    // Track <think> blocks (Qwen3 etc.) - strip from content to keep messages lean
    let insideThinkBlock = false;
    let thinkBuffer = '';

    try {
      for await (const chunk of llmService.streamChat(messages, tools, delegationUsageContext, chatOptions)) {
        // Guard against malformed chunks
        if (!chunk || !chunk.choices || !Array.isArray(chunk.choices)) {
          continue;
        }

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (!delta) continue;

        // Skip reasoning_content (Qwen-thinking, DeepSeek-R1) - not needed in delegation results
        // delta.reasoning_content is intentionally ignored

        if (delta.content) {
          let contentToProcess = delta.content;

          // Handle <think> tags - strip thinking from delegated agent output
          if (contentToProcess.includes('<think>') || insideThinkBlock) {
            thinkBuffer += contentToProcess;

            while (true) {
              if (!insideThinkBlock && thinkBuffer.includes('<think>')) {
                const startIdx = thinkBuffer.indexOf('<think>');
                const beforeThink = thinkBuffer.slice(0, startIdx);
                if (beforeThink) {
                  accumulatedContent += beforeThink;
                }
                thinkBuffer = thinkBuffer.slice(startIdx + 7);
                insideThinkBlock = true;
              } else if (insideThinkBlock && thinkBuffer.includes('</think>')) {
                const endIdx = thinkBuffer.indexOf('</think>');
                // Discard think content
                thinkBuffer = thinkBuffer.slice(endIdx + 8);
                insideThinkBlock = false;
              } else {
                break;
              }
            }

            // If inside think block, keep buffering (discard later)
            if (insideThinkBlock && thinkBuffer.length > 200) {
              thinkBuffer = thinkBuffer.slice(-20); // Keep tail for tag detection
            }

            // Emit remaining buffer as content if not in think block
            if (!insideThinkBlock && thinkBuffer && !thinkBuffer.includes('<think>')) {
              accumulatedContent += thinkBuffer;
              thinkBuffer = '';
            }
          } else {
            accumulatedContent += contentToProcess;
          }
        }

        if (delta.tool_calls) {
          toolCalls = mergeToolCalls(toolCalls, delta);
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }
    } catch (error: any) {
      console.error('[AgentLoop] Delegate agent error:', error);
      return `Error in delegated agent: ${error.message}`;
    }

    // Add assistant message
    if (accumulatedContent || toolCalls.length > 0) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: accumulatedContent || null,
      };

      // Extract JSON tool calls from content if model outputs them as text
      if (toolCalls.length === 0 && accumulatedContent) {
        const extractedCalls = extractJsonToolCalls(accumulatedContent);
        if (extractedCalls.length > 0) {
          toolCalls = extractedCalls;
          // Remove the tool call text from content to avoid showing it to the user
          // Strip <tool_call> XML wrapper tags first
          accumulatedContent = accumulatedContent.replace(/<\/?tool_call>/g, '');
          // Use robust removal function for Mistral format with nested JSON
          accumulatedContent = removeMistralToolCalls(accumulatedContent);
          // Also remove Qwen/generic format using balanced brace extraction
          for (const call of extractedCalls) {
            const namePattern = new RegExp(`\\{\\s*"name"\\s*:\\s*"${call.function.name}"`);
            const nameMatch = namePattern.exec(accumulatedContent);
            if (nameMatch) {
              const fullJson = extractBalancedJson(accumulatedContent, nameMatch.index);
              if (fullJson) {
                accumulatedContent = accumulatedContent.replace(fullJson, '');
              }
            }
          }
          accumulatedContent = accumulatedContent.trim();
          assistantMessage.content = accumulatedContent || null;
          console.log(`[AgentLoop] Delegated agent: Extracted ${extractedCalls.length} tool call(s) from text`);
        }
      }

      if (toolCalls.length > 0) {
        assistantMessage.tool_calls = toolCalls;
      }

      addMessage(delegationSessionId, assistantMessage);
    }

    // Check if done (only when no tool calls — don't exit early if tools were extracted from text)
    if (toolCalls.length === 0) {
      // For agents with high iteration budgets (e.g. researcher with 30):
      // Don't exit on iteration 1 if the agent hasn't done any real work yet.
      // The LLM might output a plan as text without tool calls — force it to continue.
      if (iteration === 1 && maxIterations > MAX_DELEGATED_ITERATIONS) {
        console.log(`[AgentLoop] Delegated agent ${agentId}: No tool calls in iteration 1, but agent has budget ${maxIterations}. Forcing continuation.`);
        // Add the text as assistant message and prompt the agent to use tools
        addMessage(delegationSessionId, {
          role: 'user',
          content: 'Du hast bisher keine Tools aufgerufen. Beginne JETZT mit der Recherche: Rufe `file_write` auf um den Plan ins Scratchpad zu schreiben, dann `web_search` für die erste Kernfrage.'
        });
        continue;
      }
      finalResult = accumulatedContent;
      break;
    }

    // Execute tools
    for (const toolCall of toolCalls) {
      if (!toolCall.id || !toolCall.function.name) continue;

      const toolName = toolCall.function.name;

      if (toolName === 'delegate_to_agent') {
        // Sub-delegation (e.g. knowledge → kb-reader)
        let subArgs: { agent_id: string; task: string; context?: string };
        try { subArgs = JSON.parse(toolCall.function.arguments); } catch { subArgs = { agent_id: '?', task: '' }; }
        emit('delegation', `Delegiert an: ${subArgs.agent_id}`);
      } else {
        // Regular tool call — show tool name and key args
        let argsPreview = '';
        try {
          const parsed = JSON.parse(toolCall.function.arguments);
          // Show most useful arg (level, collection_id, document_path)
          const keys = ['level', 'collection_id', 'document_path', 'action', 'query'];
          const parts = keys.filter(k => parsed[k]).map(k => `${k}: ${parsed[k]}`);
          argsPreview = parts.length > 0 ? ` (${parts.join(', ')})` : '';
        } catch {}
        emit('tool', `${toolName}${argsPreview}`);
      }

      let result = await executeToolCall(toolCall, toolContext);

      // Handle load_skill tool result - inject skill instructions into loop state
      if (toolName === 'load_skill') {
        try {
          const skillResult: SkillLoadResult = JSON.parse(result);
          if (skillResult.success && skillResult.skill && skillResult.instructions) {
            if (!loopState.loadedSkills.includes(skillResult.skill.id)) {
              loopState.loadedSkills.push(skillResult.skill.id);
            }
            loopState.loadedSkillInstructions.push(skillResult.instructions);
            console.log(`[DelegatedAgent] Skill loaded: ${skillResult.skill.name}, ` +
              `added ${skillResult.addedTools?.length || 0} tools, ` +
              `loaded ${skillResult.loadedFiles?.length || 0} knowledge files`);

            // Replace result with shortened version — full instructions are already
            // injected into the system prompt via loopState, no need to duplicate them
            // in the tool result message (saves ~10-15KB per skill)
            result = JSON.stringify({
              success: true,
              skill: skillResult.skill,
              instructions: `[Skill "${skillResult.skill.name}" geladen – Anweisungen im System-Prompt aktiv]`,
              addedTools: skillResult.addedTools,
              loadedFiles: skillResult.loadedFiles,
            });
          }
        } catch {
          // Ignore parse errors
        }
      }

      // Track important tool results (images, documents) for injection if LLM doesn't include them
      if (toolName === 'generate_image' || toolName === 'edit_image' || toolName === 'export_document') {
        try {
          const parsed = JSON.parse(result);
          if (parsed.type === 'generated_image' || parsed.type === 'exported_document') {
            importantToolResults.push(result);
            console.log(`[DelegatedAgent] Tracked important tool result: ${parsed.type}`);
          }
        } catch {
          // Ignore parse errors
        }
      }

      addMessage(delegationSessionId, {
        role: 'tool',
        content: result,
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
      });
    }
  }

  // If loop exhausted iterations without a final response, do one synthesis call (no tools)
  if (!finalResult) {
    console.log(`[AgentLoop] Delegated agent ${agentId}: no final result after ${iteration} iterations, forcing synthesis`);
    emit('thinking', 'Fasst Ergebnisse zusammen...');

    let currentSystemPrompt = baseSystemPrompt;
    if (loopState.loadedSkillInstructions.length > 0) {
      currentSystemPrompt += '\n\n' + loopState.loadedSkillInstructions.join('\n\n');
    }

    const history = getMessages(delegationSessionId);
    // Aggressively truncate for synthesis — only need key findings, not raw web content
    const synthHistory = history.map((msg, idx) => {
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 1000) {
        return { ...msg, content: msg.content.substring(0, 1000) + '\n\n[... truncated]' };
      }
      return msg;
    });
    const synthMessages: Message[] = [
      { role: 'system', content: currentSystemPrompt },
      ...synthHistory,
      { role: 'user', content: 'Fasse jetzt alle gesammelten Informationen in einer vollständigen, strukturierten Antwort zusammen. Antworte direkt mit dem Ergebnis.' },
    ];

    const synthUsageContext: UsageContext = { userId, source: 'delegation', operation: agentId };
    const synthChatOptions: ChatOptions = { userId, modelOverride: delegatedModelOverride };

    try {
      let synthContent = '';
      for await (const chunk of llmService.streamChat(synthMessages, [], synthUsageContext, synthChatOptions)) {
        if (!chunk?.choices?.[0]?.delta?.content) continue;
        synthContent += chunk.choices[0].delta.content;
      }
      // Strip think tags from synthesis
      synthContent = synthContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      if (synthContent) {
        finalResult = synthContent;
        console.log(`[AgentLoop] Delegated agent ${agentId}: synthesis produced ${synthContent.length} chars`);
      }
    } catch (error: any) {
      console.error(`[AgentLoop] Delegated agent ${agentId}: synthesis failed:`, error.message);
    }
  }

  // Restore previous load_skill handler
  setLoadSkillHandler(previousHandler);

  // Inject important tool results (images, documents) if LLM didn't include them
  for (const importantResult of importantToolResults) {
    try {
      const parsed = JSON.parse(importantResult);
      // Check both formats: with and without space after colon
      const typeMarkerNoSpace = `"type":"${parsed.type}"`;
      const typeMarkerWithSpace = `"type": "${parsed.type}"`;
      const uniqueId = parsed.imageId || parsed.downloadUrl || '';

      const alreadyInContent =
        finalResult.includes(typeMarkerNoSpace) ||
        finalResult.includes(typeMarkerWithSpace) ||
        (uniqueId && finalResult.includes(uniqueId));

      if (!alreadyInContent) {
        // Inject the missing JSON
        finalResult += '\n\n' + importantResult;
        console.log(`[DelegatedAgent] Injected important tool result: ${parsed.type}`);
      }
    } catch {
      // Ignore parse errors
    }
  }

  return finalResult || 'Delegated task completed without response';
}

export async function* runAgentLoop(
  sessionId: string,
  userMessage: string,
  options: AgentLoopOptions = {}
): AsyncGenerator<AgentEvent> {
  const { agentId, delegationDepth = 0, attachments, skillId, userId, readerContexts, projectId } = options;

  // Agent log helper — writes to JSONL file, fire-and-forget
  const log = (eventType: string, message: string, data?: Record<string, any>, durationMs?: number) => {
    writeAgentLog(sessionId, { eventType, agentId: agentId || undefined, message, data, durationMs });
  };

  // Per-User-OAuth-MCP-Tools (z.B. Notion) sicherstellen — falls die In-Memory-
  // Registrierung nach einem Backend-Neustart verloren ging, werden sie hier
  // lazy mit dem gespeicherten User-Token re-registriert (idempotent).
  if (userId) {
    await mcpManager.ensureUserOAuthToolsRegistered(userId);
  }

  // Load agent configuration
  let agent: AgentConfig | null = null;
  let systemPrompt: string;

  if (agentId) {
    agent = await loadAgent(agentId);
    if (agent) {
      // For the supervisor agent, inject the dynamic agent list and attachments
      if (agent.id === 'supervisor') {
        systemPrompt = await buildSupervisorPrompt(agent, attachments, userId);
      } else {
        systemPrompt = agent.systemPrompt;
      }
      console.log(`Using agent: ${agent.name} (${agent.id})`);
    } else {
      console.warn(`Agent "${agentId}" not found, using legacy config`);
      systemPrompt = await loadLegacyAgentConfig();
    }
  } else {
    // Use legacy config if no agent specified
    systemPrompt = await loadLegacyAgentConfig();
  }

  // Resolve the model to use based on agent configuration
  const resolvedModelOverride = await resolveAgentModel(agent, options);

  // Validate model capabilities for this agent (throws if incompatible)
  try {
    await validateModelForAgent(resolvedModelOverride, agent, userId);
  } catch (error: any) {
    yield { type: 'error', content: error.message };
    return;
  }

  // Emit model info as first thinking step
  const modelInfo = llmService.getCurrentModel();
  if (modelInfo) {
    yield {
      type: 'model_info',
      providerName: modelInfo.provider,
      modelName: modelInfo.model,
    };
    log('model_info', `${modelInfo.provider} / ${modelInfo.model}`, { providerName: modelInfo.provider, modelName: modelInfo.model });
  }

  // Add user message to memory
  addMessage(sessionId, { role: 'user', content: userMessage });

  // Match enhanced skills - explicit skillId takes precedence over message matching
  // Skill access is now controlled by agent.skillMode and agent.skills config
  let skillMatch: SkillMatch | null = null;

  // Build skill filter options from agent configuration
  const skillFilterOptions: SkillFilterOptions = {
    agentSkills: agent?.skills,
    skillMode: agent?.skillMode,
  };

  // Check if agent can use skills (skillMode: 'none' disables all, 'allow' with empty skills means no skills)
  const agentSkills = Array.isArray(agent?.skills) ? agent.skills : [];
  const canUseSkills = agent?.skillMode !== 'none' && (agent?.skillMode !== 'allow' || agentSkills.length > 0);

  if (canUseSkills) {
    if (skillId) {
      // Explicit skill activation (from /skill command)
      const explicitSkill = await getSkillById(skillId);
      if (explicitSkill) {
        // Verify agent is allowed to use this skill
        const isAllowed = agent?.skillMode !== 'allow' || agent?.skills?.includes(explicitSkill.id);
        if (isAllowed) {
          skillMatch = {
            skill: explicitSkill,
            confidence: 1.0,
            matchedBy: 'explicit',
            matchedTrigger: `/${skillId}`,
          };
          console.log(`Explicit skill activation: ${explicitSkill.name} (/${skillId})`);
        } else {
          console.warn(`Skill "${skillId}" not allowed for agent "${agent?.id}", skipping`);
        }
      } else {
        console.warn(`Skill "${skillId}" not found, falling back to message matching`);
        skillMatch = await matchBestSkill(userMessage, skillFilterOptions);
      }
    } else {
      // Match based on user message (filtered by agent skill config)
      skillMatch = await matchBestSkill(userMessage, skillFilterOptions);
    }
  } else {
    console.log(`Skipping skill matching for agent "${agent?.id}" - skillMode: allow with no skills`);
  }

  let activeSkillContext: SkillActivationContext | null = null;
  let workflowState: WorkflowState | null = null;

  // Global language instruction - prepended to every system prompt
  const languageInstruction = `[SPRACHE: Du MUSST auf Deutsch antworten. Wechsle NIEMALS ins Englische, auch nicht teilweise. Diese Anweisung hat höchste Priorität.]\n\n`;

  // Build context info section with current date/time
  const now = new Date();
  const dateOptions: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  };
  const currentDate = now.toLocaleDateString('de-DE', dateOptions);
  const currentTime = now.toLocaleTimeString('de-DE', timeOptions);
  const contextInfo = `[AKTUELLES DATUM UND UHRZEIT: ${currentDate}, ${currentTime}]\n\n`;

  // Build reader context section if documents were loaded
  let readerContextSection = '';
  if (readerContexts && readerContexts.length > 0) {
    readerContextSection = buildReaderContextSection(readerContexts);
    console.log(`[AgentLoop] Injecting ${readerContexts.length} reader document(s) into context`);
    for (const doc of readerContexts) {
      log('context_loaded', `Dokument: ${doc.title || doc.source}`, {
        contextType: 'reader',
        name: doc.title || doc.source,
        length: doc.content?.length || 0,
        preview: (doc.content || '').slice(0, 200),
      });
    }
  }

  // Build project context section if projectId is provided
  let projectContextSection = '';
  if (projectId && userId) {
    try {
      const projectContext = await getProjectContext(projectId, userId);
      if (projectContext.success && projectContext.data) {
        const { formattedMemory, projectName } = projectContext.data;
        if (formattedMemory) {
          projectContextSection = `\n\n${formattedMemory}\n\n---\n`;
          console.log(`[AgentLoop] Injecting project context for: ${projectName}`);
          log('context_loaded', `Projekt: ${projectName}`, {
            contextType: 'project',
            name: projectName,
            length: formattedMemory.length,
            preview: formattedMemory.slice(0, 200),
          });
        }
      }
    } catch (error) {
      console.warn('[AgentLoop] Failed to load project context:', error);
    }
  }

  // Automatically analyze images before processing
  let imageAnalysisSection = '';
  if (attachments && attachments.some(a => a.type === 'image' && a.base64Data)) {
    try {
      yield { type: 'thinking' };  // Show thinking indicator during analysis
      const { analysisText, analyzedImages } = await analyzeImagesAutomatically(attachments, userMessage, userId);
      if (analysisText) {
        imageAnalysisSection = analysisText;
        console.log(`[AgentLoop] Auto-analyzed ${analyzedImages.length} image(s): ${analyzedImages.join(', ')}`);
        log('context_loaded', `Bildanalyse: ${analyzedImages.length} Bild(er)`, {
          contextType: 'image_analysis',
          name: analyzedImages.join(', '),
          length: analysisText.length,
          preview: analysisText.slice(0, 200),
        });
      }
    } catch (error: any) {
      console.error('[AgentLoop] Image analysis failed:', error.message);
    }
  }

  // Pro Document einen Sub-Agent mit dem vollen Inhalt im Context starten.
  // Kleine Docs (<15k chars) werden inline geliefert (kein Round-Trip), große
  // (>=15k chars, max 480k) werden parallel von dedizierten Sub-Agents
  // analysiert. Per-Doc Events (start/end) werden in einem Queue gesammelt und
  // nach Promise.all an den Stream geliefert.
  let documentAnalysisSection = '';
  if (attachments && attachments.some(a => a.type === 'document' && a.markdownContent)) {
    try {
      yield { type: 'thinking' };
      const docEventQueue: AgentEvent[] = [];
      const { analysisText, analyzedDocumentIds, skippedOversizedCount } = await analyzeDocumentsAutomatically(
        attachments,
        userMessage,
        userId,
        (event) => { docEventQueue.push(event); },
      );
      // Drain per-doc events to the SSE-Stream
      for (const ev of docEventQueue) {
        yield ev;
      }
      if (analysisText) {
        documentAnalysisSection = analysisText;
        console.log(`[AgentLoop] Auto-analyzed ${analyzedDocumentIds.size} document(s); skipped ${skippedOversizedCount} due to per-request cap`);
        log('context_loaded', `Dokumentanalyse: ${analyzedDocumentIds.size} Dokument(e)`, {
          contextType: 'document_analysis',
          length: analysisText.length,
          preview: analysisText.slice(0, 200),
          skippedOversizedCount,
        });
      }
    } catch (error: any) {
      console.error('[AgentLoop] Document analysis failed:', error.message);
    }
  }

  // Build skill metadata section for agent decision-making (NEW: agent-driven skill loading)
  let skillMetadataSection = '';
  try {
    skillMetadataSection = await buildSkillMetadataSection(agent);
    if (skillMetadataSection) {
      log('context_loaded', 'Skill-Katalog', {
        contextType: 'skill_metadata',
        length: skillMetadataSection.length,
        preview: skillMetadataSection.slice(0, 200),
      });
    }
  } catch (error) {
    console.warn('[AgentLoop] Failed to build skill metadata section:', error);
  }

  let fullSystemPrompt = languageInstruction + contextInfo + projectContextSection + imageAnalysisSection + documentAnalysisSection + systemPrompt + skillMetadataSection + readerContextSection;
  let agentToolNames = agent?.tools || ['file_read', 'file_write', 'file_list'];

  // Log the assembled system prompt with section breakdown
  {
    const sections: Array<{ name: string; charLength: number }> = [];
    if (languageInstruction) sections.push({ name: 'Sprach-Anweisung', charLength: languageInstruction.length });
    if (contextInfo) sections.push({ name: 'Datum/Uhrzeit', charLength: contextInfo.length });
    if (projectContextSection) sections.push({ name: 'Projekt-Kontext', charLength: projectContextSection.length });
    if (imageAnalysisSection) sections.push({ name: 'Bildanalyse', charLength: imageAnalysisSection.length });
    if (documentAnalysisSection) sections.push({ name: 'Dokumentanalyse', charLength: documentAnalysisSection.length });
    if (systemPrompt) sections.push({ name: 'Agent Prompt', charLength: systemPrompt.length });
    if (skillMetadataSection) sections.push({ name: 'Skill-Katalog', charLength: skillMetadataSection.length });
    if (readerContextSection) sections.push({ name: 'Reader-Dokumente', charLength: readerContextSection.length });
    log('system_prompt', `System Prompt (${Math.round(fullSystemPrompt.length / 1024)}k)`, {
      content: fullSystemPrompt,
      sections,
      totalChars: fullSystemPrompt.length,
    });
  }

  // Initialize loop state for tracking loaded skills and temporary tools
  const loopState: LoopState = {
    temporaryTools: [],
    loadedSkills: [],
    loadedSkillInstructions: [],
  };

  if (skillMatch) {
    console.log(`Matched skill: ${skillMatch.skill.name} (${skillMatch.matchedBy}: ${skillMatch.matchedTrigger})`);

    // Prepare skill activation
    activeSkillContext = prepareSkillActivation(skillMatch, agentToolNames);

    // Create workflow state if skill has workflow
    if (activeSkillContext.skill.workflow?.steps?.length) {
      workflowState = createWorkflowState(activeSkillContext.skill);
      console.log(`Workflow initialized: ${activeSkillContext.skill.workflow.steps.length} steps`);
    }

    // Emit skill activation event
    yield {
      type: 'skill_activated',
      skillId: activeSkillContext.skill.id,
      skillName: activeSkillContext.skill.name,
      skillTools: activeSkillContext.availableTools,
      skillError: activeSkillContext.error,
      totalSteps: activeSkillContext.skill.workflow?.steps?.length || 0,
    };
    log('skill_activated', `Skill: ${activeSkillContext.skill.name}`, {
      skillId: activeSkillContext.skill.id,
      skillName: activeSkillContext.skill.name,
      tools: activeSkillContext.availableTools,
      instructions: activeSkillContext.skill.instructions?.slice(0, 500),
    });

    if (activeSkillContext.canExecute) {
      // Build enhanced system prompt with skill
      fullSystemPrompt = buildSkillPrompt(
        systemPrompt,
        activeSkillContext.skill,
        activeSkillContext.availableTools
      );

      // Filter tools for skill (optional: for now we keep all agent tools)
      // agentToolNames = filterToolsForSkill(agentToolNames, activeSkillContext.skill);
    } else {
      console.warn(`Skill ${skillMatch.skill.id} cannot execute: ${activeSkillContext.error}`);
      // Continue without skill restrictions
    }
  }

  // Create tool context
  const toolContext: ToolContext = {
    sessionId,
    agentId: agentId || undefined,
    delegationDepth,
    userId,
  };

  // Event queue for collecting sub-agent events during delegation
  const subAgentEventQueue: AgentEvent[] = [];

  // Set up load_skill handler for agent-driven skill loading
  const loadSkillHandler: LoadSkillHandler = {
    addTemporaryTools: (tools: string[]) => {
      for (const tool of tools) {
        if (!loopState.temporaryTools.includes(tool)) {
          loopState.temporaryTools.push(tool);
          console.log(`[AgentLoop] Added temporary tool from skill: ${tool}`);
        }
      }
    },
    getLoadedSkills: () => loopState.loadedSkills,
    isSkillAllowed: (skillId: string) => {
      // Check agent skill access configuration
      if (agent?.skillMode === 'none') return false;
      if (agent?.skillMode === 'allow') {
        const allowedSkills = agent.skills || [];
        return allowedSkills.includes(skillId);
      }
      // Default: all skills allowed
      return true;
    },
  };

  setLoadSkillHandler(loadSkillHandler);

  // Code-Level Anti-Retry-Schutz: zaehle identische Delegation-Anfragen.
  // Wenn der Supervisor 3+ Mal mit (gleicher target, gleicher task-Anfang) ruft,
  // weisen wir die weiteren Calls hart ab — verhindert Endlos-Loops, falls der
  // Prompt-Schutz versagt.
  const delegationFingerprints = new Map<string, number>();
  const DELEGATION_RETRY_LIMIT = 2;
  const fingerprintFor = (target: string, task: string) => `${target}::${task.slice(0, 200)}`;

  // Set up delegation handler for this context
  const delegationCallback = async (targetAgentId: string, task: string, context?: string): Promise<string> => {
    console.log(`Delegating to ${targetAgentId}: ${task}`);

    // Anti-Retry: bei 3+ Calls mit identischer (target, task)-Kombination abbrechen
    const fp = fingerprintFor(targetAgentId, task);
    const prevCount = delegationFingerprints.get(fp) ?? 0;
    if (prevCount >= DELEGATION_RETRY_LIMIT) {
      console.warn(`[AgentLoop] Anti-Retry: blockiere ${prevCount + 1}. identische Delegation an ${targetAgentId} — ${task.slice(0, 80)}`);
      return `Error: Identische Delegation (${targetAgentId}) wurde bereits ${prevCount}x mit gleicher Aufgabe versucht und ist gescheitert. Anti-Retry-Schutz greift — weitere Versuche mit identischen Argumenten sind blockiert. Bitte antworte dem User mit dem aktuellen Wissensstand und erklaere, was nicht funktioniert hat. Versuche NICHT, dieselbe Delegation noch einmal.`;
    }
    delegationFingerprints.set(fp, prevCount + 1);

    // Check if the target agent has a high iteration budget → run as background task.
    // Schwelle bewusst hoch (BACKGROUND_TASK_ITERATION_THRESHOLD), damit laengere
    // Workflow-Ketten synchron im Chat laufen statt ausgelagert zu werden.
    const targetAgent = await loadAgent(targetAgentId);
    if (targetAgent?.maxIterations && targetAgent.maxIterations > BACKGROUND_TASK_ITERATION_THRESHOLD) {
      console.log(`[AgentLoop] Agent ${targetAgentId} has maxIterations=${targetAgent.maxIterations} > ${BACKGROUND_TASK_ITERATION_THRESHOLD} — creating background task instead of synchronous delegation`);
      try {
        const { createTask, enqueueTask } = await import('../services/taskService');
        const bgTask = await createTask({
          title: `Recherche: ${task.substring(0, 80)}`,
          description: task + (context ? `\n\nKontext: ${context}` : ''),
          type: 'deep-research',
          priority: 'normal',
          trigger: 'delegation',
          assigned_agent: targetAgentId,
          created_by: 'supervisor',
          source_session_id: sessionId,
          userId,
          config: { context },
        });
        await enqueueTask(bgTask.id, 'normal');
        // Emit task_created SSE event so frontend shows TaskStatusBlock
        subAgentEventQueue.push({
          type: 'task_created',
          taskId: bgTask.id,
          taskTitle: bgTask.title,
        });
        console.log(`[AgentLoop] Background task created: ${bgTask.id}`);
        return `Recherche-Task "${bgTask.title}" wurde erstellt und läuft im Hintergrund (Task-ID: ${bgTask.id}). Der Fortschritt kann auf der Tasks-Seite verfolgt werden.`;
      } catch (error: any) {
        console.error('[AgentLoop] Failed to create background task, falling back to sync delegation:', error);
        // Fall through to synchronous delegation
      }
    }

    // If a skill is active, include skill instructions in the delegation context
    let enhancedContext = context || '';
    if (activeSkillContext?.canExecute && activeSkillContext.skill.instructions) {
      const skillInstructions = `\n\n[SKILL-ANWEISUNGEN: ${activeSkillContext.skill.name}]\n${activeSkillContext.skill.instructions}\n[/SKILL-ANWEISUNGEN]`;
      enhancedContext = enhancedContext + skillInstructions;
      console.log(`Passing skill instructions to delegated agent: ${activeSkillContext.skill.name}`);
    }

    return await runDelegatedAgent(
      targetAgentId,
      task,
      enhancedContext || undefined,
      delegationDepth + 1,
      (event) => subAgentEventQueue.push(event),
      sessionId,  // Pass parent sessionId for attachment access
      userId,     // Pass userId for connection tools
      resolvedModelOverride  // Pass parent's model override (for inherit:true agents)
    );
  };

  setDelegationHandler(delegationCallback);

  let iteration = 0;
  const maxIterations = agentId === 'supervisor'
    ? MAX_SUPERVISOR_ITERATIONS
    : (agent?.maxIterations || MAX_ITERATIONS);

  // Track important tool results (images, documents) that should be in the final response
  let importantToolResults: string[] = [];

  while (iteration < maxIterations) {
    iteration++;
    console.log(`Agent loop iteration ${iteration}`);

    yield { type: 'thinking' };

    // Get conversation history
    const history = getMessages(sessionId);

    // Build system prompt with workflow context if active
    let currentSystemPrompt = fullSystemPrompt;
    if (workflowState && activeSkillContext?.skill.workflow) {
      const workflowSection = buildWorkflowPromptSection(
        activeSkillContext.skill,
        workflowState
      );
      currentSystemPrompt = fullSystemPrompt + workflowSection;
    }

    // Append loaded skill instructions to system prompt (from load_skill tool)
    if (loopState.loadedSkillInstructions.length > 0) {
      currentSystemPrompt += '\n\n' + loopState.loadedSkillInstructions.join('\n\n');
    }

    // Get tools for this agent (including temporary tools from loaded skills)
    const tools = getToolsForAgent(agent, delegationDepth, loopState.temporaryTools);

    // Emit iteration_start (SSE + log)
    yield {
      type: 'iteration_start',
      iteration,
      maxIterations,
      messagesCount: history.length,
      toolsCount: tools?.length || 0,
    };
    log('iteration_start', `Iteration ${iteration}/${maxIterations}`, {
      iteration,
      maxIterations,
      messagesCount: history.length,
      toolsCount: tools?.length || 0,
    });

    // Build messages array with context window management
    // Truncate old tool results to prevent body size explosion (especially for high-iteration agents)
    const MSG_TRUNCATE_LIMIT = 2000;
    const MSG_RECENT_KEEP = 6;
    const compressedHistory = history.map((msg, idx) => {
      if (idx >= history.length - MSG_RECENT_KEEP) return msg;
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > MSG_TRUNCATE_LIMIT) {
        return {
          ...msg,
          content: msg.content.substring(0, MSG_TRUNCATE_LIMIT) + '\n\n[... truncated, see scratchpad for details]',
        };
      }
      return msg;
    });

    const messages: Message[] = [
      { role: 'system', content: currentSystemPrompt },
      ...compressedHistory,
    ];

    // Stream LLM response
    let accumulatedContent = '';
    let accumulatedReasoning = '';
    let toolCalls: ToolCall[] = [];
    let finishReason: string | null = null;

    // Track if we're inside a <think> block for models that use tags
    let insideThinkBlock = false;
    let thinkBuffer = '';

    // Track if we're inside a [TOOL_CALLS] block (Mistral format)
    let insideToolCallBlock = false;
    let toolCallBuffer = '';

    // Track potential JSON tool calls (Qwen format: {"agent_id":...} or {"name":...})
    let jsonToolCallBuffer = '';
    let potentialJsonToolCall = false;

    // Create usage context for main chat
    const chatUsageContext: UsageContext = {
      userId,
      source: 'chat',
      operation: agentId || 'default',
    };

    // Build chat options for per-request model resolution
    // Use the resolved model override (from agent config or session override)
    const chatOptions: ChatOptions = {
      userId,
      modelOverride: resolvedModelOverride,
    };

    // Debug: Log tools being passed to LLM
    console.log(`[AgentLoop] About to call LLM with ${tools?.length || 0} tools:`, tools?.map(t => t.function?.name));

    try {
      for await (const chunk of llmService.streamChat(messages, tools, chatUsageContext, chatOptions)) {
        // Guard against malformed chunks
        if (!chunk || !chunk.choices || !Array.isArray(chunk.choices)) {
          console.warn('[AgentLoop] Received malformed chunk:', JSON.stringify(chunk).slice(0, 200));
          continue;
        }

        const choice = chunk.choices[0];
        if (!choice) continue;

        const delta = choice.delta;
        if (!delta) continue;

        // Handle reasoning_content field (used by Qwen-thinking, DeepSeek-R1, etc.)
        if (delta.reasoning_content) {
          accumulatedReasoning += delta.reasoning_content;
          yield { type: 'reasoning_chunk', content: delta.reasoning_content };
        }

        // Accumulate content (handle <think> tags for models that use them)
        if (delta.content) {
          let contentToProcess = delta.content;

          // Check for <think> tags in the content stream
          if (contentToProcess.includes('<think>') || insideThinkBlock) {
            // Buffer content to handle tags that may be split across chunks
            thinkBuffer += contentToProcess;

            // Process complete think blocks
            while (true) {
              if (!insideThinkBlock && thinkBuffer.includes('<think>')) {
                // Start of think block
                const startIdx = thinkBuffer.indexOf('<think>');
                // Emit content before the think block
                const beforeThink = thinkBuffer.slice(0, startIdx);
                if (beforeThink) {
                  accumulatedContent += beforeThink;
                  yield { type: 'response_chunk', content: beforeThink };
                }
                thinkBuffer = thinkBuffer.slice(startIdx + 7); // Remove <think>
                insideThinkBlock = true;
              } else if (insideThinkBlock && thinkBuffer.includes('</think>')) {
                // End of think block
                const endIdx = thinkBuffer.indexOf('</think>');
                const thinkContent = thinkBuffer.slice(0, endIdx);
                if (thinkContent) {
                  accumulatedReasoning += thinkContent;
                  yield { type: 'reasoning_chunk', content: thinkContent };
                }
                thinkBuffer = thinkBuffer.slice(endIdx + 8); // Remove </think>
                insideThinkBlock = false;
              } else {
                break;
              }
            }

            // If we're inside a think block, stream reasoning incrementally
            if (insideThinkBlock && thinkBuffer.length > 50) {
              // Emit buffered reasoning content periodically
              const toEmit = thinkBuffer.slice(0, -20); // Keep last 20 chars for tag detection
              if (toEmit) {
                accumulatedReasoning += toEmit;
                yield { type: 'reasoning_chunk', content: toEmit };
                thinkBuffer = thinkBuffer.slice(-20);
              }
            }

            // If not inside think block, emit remaining buffer as content
            if (!insideThinkBlock && thinkBuffer && !thinkBuffer.includes('<think>')) {
              accumulatedContent += thinkBuffer;
              yield { type: 'response_chunk', content: thinkBuffer };
              thinkBuffer = '';
            }
          } else {
            // Check for [TOOL_CALLS] marker (Mistral format)
            if (contentToProcess.includes('[TOOL_CALLS]') || insideToolCallBlock) {
              toolCallBuffer += contentToProcess;

              // Check if we're starting a tool call block
              if (!insideToolCallBlock && toolCallBuffer.includes('[TOOL_CALLS]')) {
                const markerIdx = toolCallBuffer.indexOf('[TOOL_CALLS]');
                // Emit content before the tool call marker
                const beforeMarker = toolCallBuffer.slice(0, markerIdx);
                if (beforeMarker) {
                  accumulatedContent += beforeMarker;
                  yield { type: 'response_chunk', content: beforeMarker };
                }
                toolCallBuffer = toolCallBuffer.slice(markerIdx);
                insideToolCallBlock = true;
                console.log('[AgentLoop] Detected [TOOL_CALLS] marker, buffering...');
              }

              // If inside tool call block, check if we have a complete JSON object
              if (insideToolCallBlock) {
                const braceStart = toolCallBuffer.indexOf('{');
                if (braceStart !== -1) {
                  // Try to extract balanced JSON
                  const jsonStr = extractBalancedJson(toolCallBuffer, braceStart);
                  if (jsonStr) {
                    // We have a complete tool call - extract it
                    const toolNameMatch = toolCallBuffer.match(/\[TOOL_CALLS\](\w+)/);
                    if (toolNameMatch) {
                      const toolName = toolNameMatch[1];
                      try {
                        JSON.parse(jsonStr); // Validate JSON
                        toolCalls.push({
                          id: `mistral_${Date.now()}_${toolCalls.length}`,
                          type: 'function',
                          function: {
                            name: toolName,
                            arguments: jsonStr,
                          },
                        });
                        console.log(`[AgentLoop] Extracted Mistral tool call from stream: ${toolName}`);
                      } catch (e) {
                        console.warn('[AgentLoop] Invalid JSON in tool call buffer:', e);
                      }
                    }
                    // Clear the processed tool call from buffer
                    const endIdx = braceStart + jsonStr.length;
                    toolCallBuffer = toolCallBuffer.slice(endIdx);
                    insideToolCallBlock = toolCallBuffer.includes('[TOOL_CALLS]');
                  }
                }
              }
            } else {
              // Check for potential JSON tool call start (Qwen format)
              // Look for patterns like {"agent_id" or {"name" which indicate tool calls
              // Also match with optional whitespace after opening brace
              // Also detect markdown code blocks or <tool_call> XML tags
              const jsonToolCallStart = /\{\s*"(?:agent_id|name)"\s*:/;
              const codeBlockStart = /```(?:json)?\s*\n?\s*\{/;

              if (potentialJsonToolCall || jsonToolCallStart.test(contentToProcess) || codeBlockStart.test(contentToProcess) || contentToProcess.includes('```json') || contentToProcess.includes('<tool_call>')) {
                jsonToolCallBuffer += contentToProcess;
                potentialJsonToolCall = true;

                // Try to extract a complete JSON object
                const braceStart = jsonToolCallBuffer.indexOf('{');
                if (braceStart !== -1) {
                  const jsonStr = extractBalancedJson(jsonToolCallBuffer, braceStart);
                  if (jsonStr) {
                    // Check if it's a tool call
                    try {
                      const parsed = JSON.parse(jsonStr);
                      if (parsed.agent_id || (parsed.name && parsed.arguments)) {
                        // It's a tool call - extract it
                        const toolName = parsed.name || 'delegate_to_agent';
                        const toolArgs = parsed.arguments
                          ? (typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments))
                          : JSON.stringify(parsed);

                        toolCalls.push({
                          id: `json_${Date.now()}_${toolCalls.length}`,
                          type: 'function',
                          function: {
                            name: toolName,
                            arguments: toolArgs,
                          },
                        });
                        console.log(`[AgentLoop] Extracted JSON tool call from stream: ${toolName}`);

                        // Emit any content before the JSON
                        const beforeJson = jsonToolCallBuffer.slice(0, braceStart);
                        if (beforeJson.trim()) {
                          accumulatedContent += beforeJson;
                          yield { type: 'response_chunk', content: beforeJson };
                        }

                        // Keep any content after the JSON
                        jsonToolCallBuffer = jsonToolCallBuffer.slice(braceStart + jsonStr.length);
                        potentialJsonToolCall = jsonToolCallBuffer.includes('{');
                      } else {
                        // Not a tool call - emit buffered content
                        accumulatedContent += jsonToolCallBuffer;
                        yield { type: 'response_chunk', content: jsonToolCallBuffer };
                        jsonToolCallBuffer = '';
                        potentialJsonToolCall = false;
                      }
                    } catch {
                      // Invalid JSON, keep buffering or emit if too long
                      if (jsonToolCallBuffer.length > 2000) {
                        accumulatedContent += jsonToolCallBuffer;
                        yield { type: 'response_chunk', content: jsonToolCallBuffer };
                        jsonToolCallBuffer = '';
                        potentialJsonToolCall = false;
                      }
                    }
                  }
                }
              } else {
                // No special markers, emit content directly
                accumulatedContent += contentToProcess;
                yield { type: 'response_chunk', content: contentToProcess };
              }
            }
          }
        }

        // Merge tool calls
        if (delta.tool_calls) {
          toolCalls = mergeToolCalls(toolCalls, delta);
        }

        if (choice.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }

      // Handle any remaining think buffer content at end of stream
      if (thinkBuffer) {
        if (insideThinkBlock) {
          // Unclosed think block - emit as reasoning
          accumulatedReasoning += thinkBuffer;
          yield { type: 'reasoning_chunk', content: thinkBuffer };
        } else {
          // Regular content
          accumulatedContent += thinkBuffer;
          yield { type: 'response_chunk', content: thinkBuffer };
        }
        thinkBuffer = '';
      }

      // Handle any remaining tool call buffer at end of stream
      if (toolCallBuffer) {
        // Try to extract any remaining tool call
        const braceStart = toolCallBuffer.indexOf('{');
        if (braceStart !== -1) {
          const jsonStr = extractBalancedJson(toolCallBuffer, braceStart);
          if (jsonStr) {
            const toolNameMatch = toolCallBuffer.match(/\[TOOL_CALLS\](\w+)/);
            if (toolNameMatch) {
              const toolName = toolNameMatch[1];
              try {
                JSON.parse(jsonStr);
                toolCalls.push({
                  id: `mistral_${Date.now()}_${toolCalls.length}`,
                  type: 'function',
                  function: {
                    name: toolName,
                    arguments: jsonStr,
                  },
                });
                console.log(`[AgentLoop] Extracted Mistral tool call at stream end: ${toolName}`);
              } catch (e) {
                // Invalid JSON - emit as content
                accumulatedContent += toolCallBuffer;
                yield { type: 'response_chunk', content: toolCallBuffer };
              }
            }
          } else {
            // Incomplete tool call - emit as content
            accumulatedContent += toolCallBuffer;
            yield { type: 'response_chunk', content: toolCallBuffer };
          }
        }
        toolCallBuffer = '';
      }

      // Handle any remaining JSON tool call buffer at end of stream
      if (jsonToolCallBuffer) {
        // Strip <tool_call> XML wrapper tags before extraction
        jsonToolCallBuffer = jsonToolCallBuffer.replace(/<\/?tool_call>/g, '');
        const braceStart = jsonToolCallBuffer.indexOf('{');
        if (braceStart !== -1) {
          const jsonStr = extractBalancedJson(jsonToolCallBuffer, braceStart);
          if (jsonStr) {
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.agent_id || (parsed.name && parsed.arguments)) {
                // It's a tool call
                const toolName = parsed.name || 'delegate_to_agent';
                const toolArgs = parsed.arguments
                  ? (typeof parsed.arguments === 'string' ? parsed.arguments : JSON.stringify(parsed.arguments))
                  : JSON.stringify(parsed);

                toolCalls.push({
                  id: `json_${Date.now()}_${toolCalls.length}`,
                  type: 'function',
                  function: {
                    name: toolName,
                    arguments: toolArgs,
                  },
                });
                console.log(`[AgentLoop] Extracted JSON tool call at stream end: ${toolName}`);

                // Emit content before JSON (if any)
                const beforeJson = jsonToolCallBuffer.slice(0, braceStart);
                if (beforeJson.trim()) {
                  accumulatedContent += beforeJson;
                  yield { type: 'response_chunk', content: beforeJson };
                }
              } else {
                // Not a tool call - emit as content
                accumulatedContent += jsonToolCallBuffer;
                yield { type: 'response_chunk', content: jsonToolCallBuffer };
              }
            } catch {
              // Invalid JSON - emit as content
              accumulatedContent += jsonToolCallBuffer;
              yield { type: 'response_chunk', content: jsonToolCallBuffer };
            }
          } else {
            // No complete JSON - emit as content
            accumulatedContent += jsonToolCallBuffer;
            yield { type: 'response_chunk', content: jsonToolCallBuffer };
          }
        } else {
          // No brace found - emit as content
          accumulatedContent += jsonToolCallBuffer;
          yield { type: 'response_chunk', content: jsonToolCallBuffer };
        }
        jsonToolCallBuffer = '';
      }
    } catch (error: any) {
      console.error('[AgentLoop] LLM streaming error:', error);
      log('error', `LLM Error: ${error.message}`, { error: error.message });
      yield { type: 'error', content: `LLM Error: ${error.message}` };
      return;
    }

    // Extract JSON tool calls from content if model outputs them as text
    if (toolCalls.length === 0 && accumulatedContent) {
      const extractedCalls = extractJsonToolCalls(accumulatedContent);
      if (extractedCalls.length > 0) {
        toolCalls = extractedCalls;
        // Remove the tool call text from content to avoid showing it to the user
        // Strip <tool_call> XML wrapper tags first
        accumulatedContent = accumulatedContent.replace(/<\/?tool_call>/g, '');
        // Use robust removal function for Mistral format with nested JSON
        accumulatedContent = removeMistralToolCalls(accumulatedContent);
        // Also remove Qwen/generic format using balanced brace extraction
        for (const call of extractedCalls) {
          // Find and remove the complete tool call JSON including nested braces
          const namePattern = new RegExp(`\\{\\s*"name"\\s*:\\s*"${call.function.name}"`);
          const nameMatch = namePattern.exec(accumulatedContent);
          if (nameMatch) {
            const fullJson = extractBalancedJson(accumulatedContent, nameMatch.index);
            if (fullJson) {
              accumulatedContent = accumulatedContent.replace(fullJson, '');
            }
          }
        }
        accumulatedContent = accumulatedContent.trim();
        console.log(`[AgentLoop] Extracted ${extractedCalls.length} tool call(s) from text content`);
      }
    }

    // Add assistant message to memory
    if (accumulatedContent || toolCalls.length > 0) {
      const assistantMessage: Message = {
        role: 'assistant',
        content: accumulatedContent || null,
      };

      if (toolCalls.length > 0) {
        assistantMessage.tool_calls = toolCalls;
      }

      addMessage(sessionId, assistantMessage);
    }

    // Check if we should execute tools
    // Note: Don't check finishReason === 'stop' here — text-extracted tool calls
    // (from <tool_call> tags, [TOOL_CALLS], or JSON in content) always have finishReason 'stop'
    if (toolCalls.length === 0) {
      // Inject important tool results (images, documents) if LLM didn't include them
      for (const importantResult of importantToolResults) {
        // Check if this result is already in the accumulated content
        try {
          const parsed = JSON.parse(importantResult);
          // Check both formats: with and without space after colon
          const typeMarkerNoSpace = `"type":"${parsed.type}"`;
          const typeMarkerWithSpace = `"type": "${parsed.type}"`;
          const uniqueId = parsed.imageId || parsed.downloadUrl || '';

          const alreadyInContent =
            accumulatedContent.includes(typeMarkerNoSpace) ||
            accumulatedContent.includes(typeMarkerWithSpace) ||
            (uniqueId && accumulatedContent.includes(uniqueId));

          if (!alreadyInContent) {
            // Inject the missing JSON
            const injectedContent = '\n\n' + importantResult;
            yield { type: 'response_chunk', content: injectedContent };
            accumulatedContent += injectedContent;
          }
        } catch {
          // Ignore parse errors
        }
      }
      importantToolResults = []; // Clear for next iteration

      // Cleanup handlers on successful completion
      setDelegationHandler(null);
      setLoadSkillHandler(null);

      log('done', 'Fertig', {});
      yield { type: 'done' };
      return;
    }

    // Execute each tool call
    for (const toolCall of toolCalls) {
      if (!toolCall.id || !toolCall.function.name) continue;

      const toolName = toolCall.function.name;
      const toolArgs = toolCall.function.arguments;

      // Special handling for delegation tool
      if (toolName === 'delegate_to_agent') {
        let args: { agent_id: string; task: string; context?: string };
        try {
          args = JSON.parse(toolArgs);
        } catch (e) {
          yield {
            type: 'tool_end',
            toolName,
            toolResult: 'Error parsing delegation arguments',
          };
          continue;
        }

        yield {
          type: 'delegation_start',
          agentId: args.agent_id,
          task: args.task,
        };
        log('delegation_start', `Delegiert an: ${args.agent_id}`, { agentId: args.agent_id, task: args.task });

        // Clear event queue before delegation
        subAgentEventQueue.length = 0;

        const delegationStartTime = Date.now();
        const result = await executeToolCall(toolCall, toolContext);
        const delegationDurationMs = Date.now() - delegationStartTime;

        // Yield all sub-agent events collected during delegation
        for (const subEvent of subAgentEventQueue) {
          yield subEvent;
        }
        subAgentEventQueue.length = 0;

        yield {
          type: 'delegation_end',
          agentId: args.agent_id,
          toolResult: result,
          durationMs: delegationDurationMs,
        };
        log('delegation_end', `Delegation fertig (${delegationDurationMs}ms)`, { agentId: args.agent_id, result: result.slice(0, 500), durationMs: delegationDurationMs }, delegationDurationMs);

        // Track important results from delegation (images, documents)
        // Extract JSON objects with type: "generated_image" or "exported_document"
        const extractImportantJson = (text: string, typeValue: string): string | null => {
          const marker = `"type":"${typeValue}"`;
          const markerAlt = `"type": "${typeValue}"`;
          const idx = text.indexOf(marker) !== -1 ? text.indexOf(marker) : text.indexOf(markerAlt);
          if (idx === -1) return null;

          // Find the start of this JSON object
          let start = idx;
          while (start > 0 && text[start] !== '{') start--;

          // Find the end by counting braces
          let braceCount = 0;
          let end = start;
          for (let i = start; i < text.length; i++) {
            if (text[i] === '{') braceCount++;
            if (text[i] === '}') braceCount--;
            if (braceCount === 0) {
              end = i + 1;
              break;
            }
          }

          const jsonStr = text.substring(start, end);
          try {
            JSON.parse(jsonStr); // Validate
            return jsonStr;
          } catch {
            return null;
          }
        };

        const imageJson = extractImportantJson(result, 'generated_image');
        if (imageJson) importantToolResults.push(imageJson);

        const docJson = extractImportantJson(result, 'exported_document');
        if (docJson) importantToolResults.push(docJson);

        // Add tool result to memory
        addMessage(sessionId, {
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
          name: toolName,
        });
      } else {
        // Regular tool execution
        yield {
          type: 'tool_start',
          toolName,
          toolArgs,
        };
        log('tool_start', toolName, { tool: toolName, args: toolArgs });

        const toolStartTime = Date.now();
        let result = await executeToolCall(toolCall, toolContext);
        const toolDurationMs = Date.now() - toolStartTime;

        yield {
          type: 'tool_end',
          toolName,
          toolResult: result,
          durationMs: toolDurationMs,
        };
        log('tool_end', `${toolName} (${toolDurationMs}ms)`, { tool: toolName, result: result.slice(0, 500), durationMs: toolDurationMs }, toolDurationMs);

        // Track important tool results (images, documents) for injection if LLM doesn't include them
        if (toolName === 'generate_image' || toolName === 'edit_image' || toolName === 'export_document') {
          try {
            const parsed = JSON.parse(result);
            if (parsed.type === 'generated_image' || parsed.type === 'exported_document') {
              importantToolResults.push(result);
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Emit task_created event if create_task was successful
        if (toolName === 'create_task') {
          try {
            const taskResult = JSON.parse(result);
            if (taskResult.success && taskResult.task) {
              yield {
                type: 'task_created',
                taskId: taskResult.task.id,
                taskTitle: taskResult.task.title,
              };
              log('task_created', `Task: ${taskResult.task.title}`, { taskId: taskResult.task.id, taskTitle: taskResult.task.title });
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Handle load_skill tool result - inject skill instructions into loop state
        if (toolName === 'load_skill') {
          try {
            const skillResult: SkillLoadResult = JSON.parse(result);
            if (skillResult.success && skillResult.skill && skillResult.instructions) {
              // Track loaded skill
              if (!loopState.loadedSkills.includes(skillResult.skill.id)) {
                loopState.loadedSkills.push(skillResult.skill.id);
              }

              // Add skill instructions to be injected in next iteration
              loopState.loadedSkillInstructions.push(skillResult.instructions);

              console.log(`[AgentLoop] Skill loaded: ${skillResult.skill.name}, ` +
                `added ${skillResult.addedTools?.length || 0} tools, ` +
                `loaded ${skillResult.loadedFiles?.length || 0} knowledge files`);

              // Emit skill_activated event for UI
              yield {
                type: 'skill_activated',
                skillId: skillResult.skill.id,
                skillName: skillResult.skill.name,
                skillTools: skillResult.addedTools,
              };
              log('skill_activated', `Skill geladen: ${skillResult.skill.name}`, {
                skillId: skillResult.skill.id,
                skillName: skillResult.skill.name,
                tools: skillResult.addedTools,
                instructions: skillResult.instructions?.slice(0, 500),
              });

              // Replace result with shortened version — full instructions are already
              // injected into the system prompt via loopState, no need to duplicate them
              // in the tool result message (saves ~10-15KB per skill)
              result = JSON.stringify({
                success: true,
                skill: skillResult.skill,
                instructions: `[Skill "${skillResult.skill.name}" geladen – Anweisungen im System-Prompt aktiv]`,
                addedTools: skillResult.addedTools,
                loadedFiles: skillResult.loadedFiles,
              });
            }
          } catch {
            // Ignore parse errors
          }
        }

        // Add tool result to memory
        addMessage(sessionId, {
          role: 'tool',
          content: result,
          tool_call_id: toolCall.id,
          name: toolName,
        });

        // Advance workflow if applicable
        if (workflowState && activeSkillContext?.skill.workflow) {
          if (shouldAutoAdvance(workflowState, activeSkillContext.skill.workflow, toolName)) {
            const stepEvent = createStepEvent(workflowState, activeSkillContext.skill.workflow, 'complete');

            yield {
              type: 'workflow_step',
              skillId: workflowState.skillId,
              stepIndex: stepEvent.stepIndex,
              stepAction: stepEvent.stepAction,
              stepDescription: stepEvent.stepDescription,
              totalSteps: stepEvent.totalSteps,
              workflowProgress: stepEvent.progress,
            };

            workflowState = advanceWorkflow(workflowState, activeSkillContext.skill.workflow);

            console.log(`Workflow advanced to step ${workflowState.currentStepIndex + 1}, ` +
              `completed: ${workflowState.completedSteps.length}/${activeSkillContext.skill.workflow.steps.length}`);
          }
        }
      }
    }

    // Continue loop to let LLM respond to tool results
  }

  // Cleanup
  setDelegationHandler(null);
  setLoadSkillHandler(null);

  // Iterationslimit erreicht ohne finale Antwort. Statt hart mit einem Error
  // abzubrechen (wie frueher) spiegeln wir das Verhalten des delegierten Loops:
  // EIN Synthese-Aufruf ohne Tools erzeugt eine Best-Effort-Antwort aus dem,
  // was bereits gesammelt wurde — der Nutzer bekommt ein verwertbares Ergebnis
  // mit transparentem Hinweis statt einer leeren Fehlermeldung.
  console.log(`[AgentLoop] Agent ${agentId}: kein finales Ergebnis nach ${maxIterations} Iterationen, erzwinge Synthese`);
  yield { type: 'thinking' };

  try {
    let synthSystemPrompt = fullSystemPrompt;
    if (loopState.loadedSkillInstructions.length > 0) {
      synthSystemPrompt += '\n\n' + loopState.loadedSkillInstructions.join('\n\n');
    }

    const synthHistory = getMessages(sessionId).map((msg) => {
      if (msg.role === 'tool' && typeof msg.content === 'string' && msg.content.length > 6000) {
        return { ...msg, content: msg.content.substring(0, 6000) + '\n\n[... gekürzt]' };
      }
      return msg;
    });

    const synthMessages: Message[] = [
      { role: 'system', content: synthSystemPrompt },
      ...synthHistory,
      { role: 'user', content: 'Du hast dein Schritt-Budget erreicht. Erzeuge JETZT die vollständige, strukturierte Endantwort aus den bereits gesammelten Informationen — direkt, ohne weitere Tool-Aufrufe. Nutze, was vorliegt, und markiere echte Lücken transparent. Gib NIEMALS „konnte nichts finden" zurück, wenn relevante Dokumente gelesen wurden.' },
    ];

    const synthUsageContext: UsageContext = { userId, source: 'chat', operation: agentId || 'default' };
    const synthChatOptions: ChatOptions = { userId, modelOverride: resolvedModelOverride };

    let synthContent = '';
    for await (const chunk of llmService.streamChat(synthMessages, [], synthUsageContext, synthChatOptions)) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (!delta) continue;
      synthContent += delta;
      yield { type: 'response_chunk', content: delta };
    }
    synthContent = synthContent.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

    if (synthContent) {
      addMessage(sessionId, { role: 'assistant', content: synthContent });
      console.log(`[AgentLoop] Agent ${agentId}: Synthese lieferte ${synthContent.length} Zeichen`);
      log('done', 'Fertig (Synthese am Schritt-Budget)', {});
      yield { type: 'done' };
      return;
    }
  } catch (error: any) {
    console.error(`[AgentLoop] Agent ${agentId}: Synthese fehlgeschlagen:`, error?.message);
  }

  // Synthese lieferte nichts Verwertbares → als letztes Mittel der Fehler.
  log('error', 'Maximum iterations reached', { error: 'Maximum iterations reached' });
  yield { type: 'error', content: 'Maximum iterations reached' };
}
