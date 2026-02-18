/**
 * Load Skill Tool - Allows agents to load skill instructions on demand
 *
 * Skills are knowledge resources (methodology, workflow) that agents load
 * when they decide they need specific work instructions for a task.
 *
 * When a skill is loaded:
 * 1. Skill instructions are returned to be injected into context
 * 2. Skill's allowed_tools are added to agent's available tools temporarily
 * 3. Skill's knowledge files are loaded into context (if specified)
 */

import type { Tool, ToolDefinition, ToolContext } from '../types';
import {
  getSkillById,
  getSkillSummaries,
  loadSkillKnowledgeFiles,
} from '../../skills/loader';
import type { EnhancedSkill, SkillLoadResult } from '../../skills/types';

/**
 * Callback type for adding temporary tools when a skill is loaded
 */
export type SkillToolsCallback = (tools: string[]) => void;

/**
 * Handler for loading skills - provided by the agent loop
 */
export interface LoadSkillHandler {
  /** Add temporary tools to the current agent loop iteration */
  addTemporaryTools: SkillToolsCallback;
  /** Get currently loaded skill IDs */
  getLoadedSkills: () => string[];
  /** Check if agent is allowed to use a skill */
  isSkillAllowed: (skillId: string) => boolean;
}

export class LoadSkillTool implements Tool {
  readonly name = 'load_skill';
  readonly type = 'local' as const;

  private handler: LoadSkillHandler | null = null;

  getDefinition(): ToolDefinition {
    return {
      type: 'function',
      function: {
        name: this.name,
        description:
          'Lade die Arbeitsanweisungen eines Skills in deinen Kontext. ' +
          'Nutze dies wenn du eine spezifische Methodik oder Arbeitsweise anwenden möchtest. ' +
          'Der Skill gibt dir detaillierte Anweisungen und kann zusätzliche Tools freischalten.',
        parameters: {
          type: 'object',
          properties: {
            skill_id: {
              type: 'string',
              description:
                'ID des zu ladenden Skills (z.B. "deep-research", "code-review", "web-research")',
            },
          },
          required: ['skill_id'],
        },
      },
    };
  }

  /**
   * Set the handler for skill loading operations
   */
  setHandler(handler: LoadSkillHandler | null): void {
    this.handler = handler;
  }

  /**
   * Get the current handler
   */
  getHandler(): LoadSkillHandler | null {
    return this.handler;
  }

  async execute(
    args: { skill_id: string },
    context?: ToolContext
  ): Promise<string> {
    const { skill_id } = args;

    if (!skill_id) {
      return JSON.stringify({
        success: false,
        error: 'skill_id ist erforderlich',
      } satisfies SkillLoadResult);
    }

    // Load the skill
    const skill = await getSkillById(skill_id);
    if (!skill) {
      // Provide helpful error with available skills
      const summaries = await getSkillSummaries();
      const availableIds = summaries.map(s => s.id).join(', ');
      return JSON.stringify({
        success: false,
        error: `Skill "${skill_id}" nicht gefunden. Verfügbare Skills: ${availableIds}`,
      } satisfies SkillLoadResult);
    }

    // Check if skill is enabled
    if (skill.enabled === false) {
      return JSON.stringify({
        success: false,
        error: `Skill "${skill_id}" ist deaktiviert`,
      } satisfies SkillLoadResult);
    }

    // Check if agent is allowed to use this skill
    if (this.handler && !this.handler.isSkillAllowed(skill_id)) {
      return JSON.stringify({
        success: false,
        error: `Skill "${skill_id}" ist für diesen Agent nicht freigegeben`,
      } satisfies SkillLoadResult);
    }

    // Check if skill is already loaded
    if (this.handler) {
      const loadedSkills = this.handler.getLoadedSkills();
      if (loadedSkills.includes(skill_id)) {
        return JSON.stringify({
          success: true,
          skill: { id: skill.id, name: skill.name },
          instructions: `Skill "${skill.name}" ist bereits geladen.`,
          addedTools: [],
          loadedFiles: [],
        } satisfies SkillLoadResult);
      }
    }

    // Load knowledge files if specified
    const loadedFiles: string[] = [];
    let knowledgeContent = '';

    if (skill.knowledge?.files && skill.knowledge.files.length > 0) {
      const { files, errors } = await loadSkillKnowledgeFiles(skill);

      for (const file of files) {
        loadedFiles.push(file.path);
        knowledgeContent += `\n\n### ${file.path}\n\n${file.content}`;
      }

      if (errors.length > 0) {
        console.warn(`[LoadSkillTool] Errors loading knowledge files:`, errors);
      }
    }

    // Add allowed_tools to temporary tools
    const addedTools: string[] = [];
    if (this.handler && skill.allowed_tools && skill.allowed_tools.length > 0) {
      this.handler.addTemporaryTools(skill.allowed_tools);
      addedTools.push(...skill.allowed_tools);
    }

    // Build skill instructions for context injection
    const instructionsText = buildSkillInstructions(skill, knowledgeContent, addedTools);

    return JSON.stringify({
      success: true,
      skill: { id: skill.id, name: skill.name },
      instructions: instructionsText,
      addedTools,
      loadedFiles,
    } satisfies SkillLoadResult);
  }

  async isAvailable(): Promise<boolean> {
    // Always available - agents can always try to load skills
    return true;
  }
}

/**
 * Build formatted skill instructions for context injection
 */
function buildSkillInstructions(
  skill: EnhancedSkill,
  knowledgeContent: string,
  addedTools: string[]
): string {
  const parts: string[] = [];

  // Header
  parts.push(`## Skill geladen: ${skill.name}\n`);

  if (skill.description) {
    parts.push(`*${skill.description}*\n`);
  }

  // Main instructions
  if (skill.instructions) {
    parts.push(`### Anweisungen\n\n${skill.instructions}`);
  }

  // Workflow hints if present
  if (skill.workflow && skill.workflow.steps.length > 0) {
    parts.push(`\n### Empfohlener Ablauf\n`);
    skill.workflow.steps.forEach((step, i) => {
      let stepText = `${i + 1}. `;

      switch (step.action) {
        case 'tool':
          stepText += step.tool ? `Tool: **${step.tool}**` : 'Tool verwenden';
          break;
        case 'think':
          stepText += '**Analysieren/Nachdenken**';
          break;
        case 'respond':
          stepText += '**Antwort formulieren**';
          break;
        case 'delegate':
          stepText += '**An anderen Agent delegieren**';
          break;
      }

      if (step.description) {
        stepText += ` - ${step.description}`;
      }

      if (step.condition) {
        stepText += ` _(${step.condition})_`;
      }

      parts.push(stepText);
    });
  }

  // Added tools info
  if (addedTools.length > 0) {
    parts.push(`\n### Zusätzliche Tools für diesen Skill\n`);
    parts.push(`Du hast jetzt Zugriff auf: ${addedTools.join(', ')}`);
  }

  // Knowledge content
  if (knowledgeContent) {
    parts.push(`\n### Skill-Wissen\n${knowledgeContent}`);
  }

  // Output format hints
  if (skill.output?.template) {
    parts.push(`\n### Ausgabeformat\n\nStrukturiere deine Antwort nach folgendem Format:\n\`\`\`\n${skill.output.template}\n\`\`\``);
  }

  return parts.join('\n');
}
