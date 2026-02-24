import {
  llmService,
  type Message,
  type ToolCall,
  type StreamChunk,
  type ContentPart,
  type TextContentPart,
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
import { addMessage, getMessages, generateSessionId, restoreSessionIfEmpty } from '../services/memory';
import { loadAgent, listAgents, type AgentConfig, type AgentModelConfig } from '../services/agents';
import { loadUserMemory, formatMemoryForPrompt } from '../services/userMemory';
import { getSpaceContext } from '../spaces/service';
import { readFile } from 'fs/promises';
import { AGENTS_CONFIG } from '../utils/paths';
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

const MAX_ITERATIONS = 5;
const MAX_SUPERVISOR_ITERATIONS = 15;
const MAX_DELEGATION_DEPTH = 2;

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
  type: 'thinking' | 'response_chunk' | 'reasoning_chunk' | 'tool_start' | 'tool_end' | 'done' | 'error' | 'delegation_start' | 'delegation_end' | 'agent_selected' | 'skill_activated' | 'workflow_step' | 'sub_agent_step' | 'model_info' | 'task_created' | 'file_processing';
  content?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  agentId?: string;
  task?: string;
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
  // File processing data
  fileId?: string;
  filename?: string;
  status?: string;
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
  spaceId?: string;  // Space context for memory and KB injection
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
      ? userMessage.content.filter((p): p is TextContentPart => p.type === 'text').map(p => p.text).join('\n')
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

async function loadLegacyAgentConfig(): Promise<string> {
  const configPath = AGENTS_CONFIG;

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

  // Pattern 2: Tool call with nested arguments object
  // {"name": "delegate_to_agent", "arguments": {"agent_id": "...", "task": "..."}}
  if (toolCalls.length === 0) {
    const nestedPattern = /\{\s*"name"\s*:\s*"([^"]+)"\s*,\s*"arguments"\s*:\s*(\{[\s\S]*?\})\s*\}/g;
    while ((match = nestedPattern.exec(content)) !== null) {
      const [fullMatch, name, argsStr] = match;
      try {
        // Try to parse the full match to validate it's complete JSON
        const parsed = JSON.parse(fullMatch);
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

  // Remove Qwen {"name": ..., "arguments": ...} format
  result = result.replace(/\{\s*"name"\s*:\s*"[^"]+"\s*,\s*"arguments"\s*:\s*\{[\s\S]*?\}\s*\}/g, '');

  // Remove direct delegate_to_agent arguments (with optional markdown code block)
  // Pattern: ```json\n{"agent_id": ...}\n``` or just {"agent_id": ...}
  result = result.replace(/```json\s*\n?\s*\{\s*"agent_id"\s*:\s*"[^"]+"\s*,\s*"task"\s*:\s*"[\s\S]*?"\s*(?:,\s*"context"\s*:\s*"[\s\S]*?")?\s*\}\s*\n?```/g, '');
  result = result.replace(/\{\s*"agent_id"\s*:\s*"[^"]+"\s*,\s*"task"\s*:\s*"[\s\S]*?"\s*(?:,\s*"context"\s*:\s*"[\s\S]*?")?\s*\}/g, '');

  return result.trim();
}

/**
 * Build the supervisor prompt by injecting the dynamic agent list, user memory, and attachments
 */
async function buildSupervisorPrompt(agent: AgentConfig, attachments?: AttachmentWithContent[]): Promise<string> {
  const agents = await listAgents(); // non-internal agents only

  const agentListLines = agents.map(a => {
    const caps = a.capabilities.length > 0 ? a.capabilities.join(', ') : 'Keine';
    return `- **${a.id}** (${a.name}): ${a.description}\n  Faehigkeiten: ${caps}`;
  });

  const agentListStr = agentListLines.length > 0
    ? agentListLines.join('\n')
    : '(Keine Agenten verfuegbar)';

  // Load and format user memory
  let userMemoryStr = '';
  try {
    const memory = await loadUserMemory();
    if (memory.settings.include_in_prompt) {
      userMemoryStr = formatMemoryForPrompt(memory);
    }
  } catch (error) {
    console.warn('Failed to load user memory:', error);
    userMemoryStr = '';
  }

  // Build attachments section if present - inject document content directly for reliable access
  let attachmentsStr = '';
  if (attachments && attachments.length > 0) {
    const MAX_CONTENT_LENGTH = 15000;

    const attachmentSections = attachments.map((att, i) => {
      if (att.type === 'document' && att.markdownContent) {
        // Inject document content directly
        const truncatedContent = att.markdownContent.length > MAX_CONTENT_LENGTH
          ? att.markdownContent.slice(0, MAX_CONTENT_LENGTH) + '\n\n[... gekürzt ...]'
          : att.markdownContent;

        return `
### ${i + 1}. ${att.filename} (Dokument)

${truncatedContent}
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

### PRIORISIERUNG FÜR FRAGEN:

1. **ZUERST** die oben hochgeladenen Dokumente durchsuchen
2. Wenn die Antwort in den Dokumenten gefunden wird: **DIREKT antworten**
3. Zitiere relevante Passagen aus den Dokumenten
4. **NUR** wenn die Information definitiv NICHT in den Dokumenten ist, sage das klar

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
  // Delegated agents use their own model config, not the parent's override
  const delegatedAgentOptions: AgentLoopOptions = {
    agentId,
    delegationDepth: depth,
    parentSessionId,
    userId,
    // Don't pass parent modelOverride - each agent uses its own model config
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

  const systemPrompt = languageInstruction + contextInfo + agent.systemPrompt + skillInstructions;
  const tools = getToolsForAgent(agent, depth);

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

  let iteration = 0;
  let finalResult = '';

  // Track important tool results (images, documents) that should be in the final response
  let importantToolResults: string[] = [];

  while (iteration < MAX_ITERATIONS) {
    iteration++;
    console.log(`Delegated agent ${agentId} iteration ${iteration} (depth: ${depth})`);

    emit('thinking', 'Denkt nach...');

    const history = getMessages(delegationSessionId);
    const messages: Message[] = [
      { role: 'system', content: systemPrompt },
      ...history,
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

        if (delta.content) {
          accumulatedContent += delta.content;
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
          // Use robust removal function for Mistral format with nested JSON
          accumulatedContent = removeMistralToolCalls(accumulatedContent);
          // Also remove Qwen/generic format: {"name": "tool_name", ...}
          for (const call of extractedCalls) {
            const qwenPattern = new RegExp(`\\{[^{}]*"name"\\s*:\\s*"${call.function.name}"[^{}]*\\}`, 'g');
            accumulatedContent = accumulatedContent.replace(qwenPattern, '').trim();
          }
          assistantMessage.content = accumulatedContent || null;
          console.log(`[AgentLoop] Delegated agent: Extracted ${extractedCalls.length} tool call(s) from text`);
        }
      }

      if (toolCalls.length > 0) {
        assistantMessage.tool_calls = toolCalls;
      }

      addMessage(delegationSessionId, assistantMessage);
    }

    // Check if done
    if (toolCalls.length === 0 || finishReason === 'stop') {
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

      const result = await executeToolCall(toolCall, toolContext);

      // Track important tool results (images, documents) for injection if LLM doesn't include them
      if (toolName === 'generate_image' || toolName === 'export_document') {
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
  const { agentId, delegationDepth = 0, attachments, skillId, userId, readerContexts, spaceId } = options;

  // Load agent configuration
  let agent: AgentConfig | null = null;
  let systemPrompt: string;

  if (agentId) {
    agent = await loadAgent(agentId);
    if (agent) {
      // For the supervisor agent, inject the dynamic agent list and attachments
      if (agent.id === 'supervisor') {
        systemPrompt = await buildSupervisorPrompt(agent, attachments);
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
  }

  // Restore session from saved chat history if backend was restarted (must happen BEFORE addMessage)
  await restoreSessionIfEmpty(sessionId, userId);

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

  // Check if agent can use skills (skillMode: 'all' uses all, skillMode: 'allow' with empty skills means no skills)
  const agentSkills = Array.isArray(agent?.skills) ? agent.skills : [];
  const canUseSkills = agent?.skillMode !== 'allow' || agentSkills.length > 0;

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
  }

  // Build space context section if spaceId is provided
  let spaceContextSection = '';
  if (spaceId && userId) {
    try {
      const spaceContext = await getSpaceContext(spaceId, userId);
      if (spaceContext.success && spaceContext.data) {
        const { formattedMemory, spaceName } = spaceContext.data;
        if (formattedMemory) {
          spaceContextSection = `\n\n${formattedMemory}\n\n---\n`;
          console.log(`[AgentLoop] Injecting space context for: ${spaceName}`);
        }
      }
    } catch (error) {
      console.warn('[AgentLoop] Failed to load space context:', error);
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
      }
    } catch (error: any) {
      console.error('[AgentLoop] Image analysis failed:', error.message);
    }
  }

  // Build skill metadata section for agent decision-making (NEW: agent-driven skill loading)
  let skillMetadataSection = '';
  try {
    skillMetadataSection = await buildSkillMetadataSection(agent);
  } catch (error) {
    console.warn('[AgentLoop] Failed to build skill metadata section:', error);
  }

  let fullSystemPrompt = languageInstruction + contextInfo + spaceContextSection + imageAnalysisSection + systemPrompt + skillMetadataSection + readerContextSection;
  let agentToolNames = agent?.tools || ['file_read', 'file_write', 'file_list'];

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
      if (agent?.skillMode === 'allow') {
        const allowedSkills = agent.skills || [];
        return allowedSkills.includes(skillId);
      }
      // Default: all skills allowed
      return true;
    },
  };

  setLoadSkillHandler(loadSkillHandler);

  // Set up delegation handler for this context
  const delegationCallback = async (targetAgentId: string, task: string, context?: string): Promise<string> => {
    console.log(`Delegating to ${targetAgentId}: ${task}`);

    // If a skill is active, include skill instructions in the delegation context
    let enhancedContext = context || '';
    if (activeSkillContext?.canExecute && activeSkillContext.skill.instructions) {
      const skillInstructions = `\n\n[SKILL-ANWEISUNGEN: ${activeSkillContext.skill.name}]\n${activeSkillContext.skill.instructions}\n[/SKILL-ANWEISUNGEN]`;
      enhancedContext = enhancedContext + skillInstructions;
      console.log(`Passing skill instructions to delegated agent: ${activeSkillContext.skill.name}`);
    }

    // Auto-inject recent generated image IDs when delegating to image-generator
    // This ensures the sub-agent can edit previously generated images even if the
    // supervisor model didn't explicitly extract and pass the imageId
    if (targetAgentId === 'image-generator' && !enhancedContext.includes('image_id:')) {
      const history = getMessages(sessionId, userId);
      // Search backwards for the most recent generated_image in assistant messages or tool results
      for (let i = history.length - 1; i >= 0; i--) {
        const msg = history[i];
        if (!msg) continue;
        const content = typeof msg.content === 'string' ? msg.content : '';
        const imageMatch = content.match(/"imageId"\s*:\s*"(img_[^"]+)"/);
        if (imageMatch && imageMatch[1]) {
          enhancedContext = `image_id: ${imageMatch[1]}\n${enhancedContext}`;
          console.log(`[Delegation] Auto-injected image_id ${imageMatch[1]} for image-generator`);
          break;
        }
      }
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
  const maxIterations = agentId === 'supervisor' ? MAX_SUPERVISOR_ITERATIONS : MAX_ITERATIONS;

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

    // Build messages array
    // Note: Images are pre-analyzed and their descriptions are in the system prompt,
    // so we don't need to inject images here anymore
    const messages: Message[] = [
      { role: 'system', content: currentSystemPrompt },
      ...history,
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
                      const toolName = toolNameMatch[1] || '';
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
              // Also detect markdown code blocks that might contain tool calls
              const jsonToolCallStart = /\{\s*"(?:agent_id|name)"\s*:/;
              const codeBlockStart = /```(?:json)?\s*\n?\s*\{/;

              if (potentialJsonToolCall || jsonToolCallStart.test(contentToProcess) || codeBlockStart.test(contentToProcess) || contentToProcess.includes('```json')) {
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
              const toolName = toolNameMatch[1] || '';
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
      yield { type: 'error', content: `LLM Error: ${error.message}` };
      return;
    }

    // Extract JSON tool calls from content if model outputs them as text
    if (toolCalls.length === 0 && accumulatedContent) {
      const extractedCalls = extractJsonToolCalls(accumulatedContent);
      if (extractedCalls.length > 0) {
        toolCalls = extractedCalls;
        // Remove the tool call text from content to avoid showing it to the user
        // Use robust removal function for Mistral format with nested JSON
        accumulatedContent = removeMistralToolCalls(accumulatedContent);
        // Also remove Qwen/generic format: {"name": "tool_name", ...}
        for (const call of extractedCalls) {
          const qwenPattern = new RegExp(`\\{[^{}]*"name"\\s*:\\s*"${call.function.name}"[^{}]*\\}`, 'g');
          accumulatedContent = accumulatedContent.replace(qwenPattern, '').trim();
        }
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
    if (toolCalls.length === 0 || finishReason === 'stop') {
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

        // Clear event queue before delegation
        subAgentEventQueue.length = 0;

        const result = await executeToolCall(toolCall, toolContext);

        // Yield all sub-agent events collected during delegation
        for (const subEvent of subAgentEventQueue) {
          yield subEvent;
        }
        subAgentEventQueue.length = 0;

        yield {
          type: 'delegation_end',
          agentId: args.agent_id,
          toolResult: result,
        };

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

        const result = await executeToolCall(toolCall, toolContext);

        yield {
          type: 'tool_end',
          toolName,
          toolResult: result,
        };

        // Track important tool results (images, documents) for injection if LLM doesn't include them
        if (toolName === 'generate_image' || toolName === 'export_document') {
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

  // Max iterations reached
  yield { type: 'error', content: 'Maximum iterations reached' };
}
