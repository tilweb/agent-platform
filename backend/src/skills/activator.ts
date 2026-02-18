/**
 * Enhanced Skills - Activator
 *
 * Activates a skill for execution:
 * - Checks tool availability
 * - Filters tools for the skill
 * - Builds enhanced system prompt
 */

import type { EnhancedSkill, SkillActivationContext, SkillMatch, WorkflowStep } from './types';
import { toolRegistry } from '../tools';

/**
 * Prepare a skill for activation
 * Checks tool requirements and returns activation context
 */
export function prepareSkillActivation(
  match: SkillMatch,
  agentTools: string[]
): SkillActivationContext {
  const skill = match.skill;
  const requiredTools = skill.tools.required || [];
  const optionalTools = skill.tools.optional || [];

  // Get all registered tool names
  const registeredTools = toolRegistry.getAll().map(t => t.name);

  // Check which required tools are missing
  const missingTools: string[] = [];
  const availableRequired: string[] = [];

  for (const tool of requiredTools) {
    if (registeredTools.includes(tool) && agentTools.includes(tool)) {
      availableRequired.push(tool);
    } else {
      missingTools.push(tool);
    }
  }

  // Check which optional tools are available
  const availableOptional: string[] = [];
  for (const tool of optionalTools) {
    if (registeredTools.includes(tool) && agentTools.includes(tool)) {
      availableOptional.push(tool);
    }
  }

  // Combine available tools
  const availableTools = [...availableRequired, ...availableOptional];

  // Can execute if all required tools are available
  const canExecute = missingTools.length === 0;

  return {
    skill,
    availableTools,
    missingTools,
    canExecute,
    error: canExecute ? undefined : `Fehlende Tools: ${missingTools.join(', ')}`,
  };
}

/**
 * Filter agent tools to only include skill-relevant tools
 * If skill has no tool restrictions, returns all agent tools
 */
export function filterToolsForSkill(
  agentTools: string[],
  skill: EnhancedSkill
): string[] {
  const requiredTools = skill.tools.required || [];
  const optionalTools = skill.tools.optional || [];

  // If skill has no tool requirements, use all agent tools
  if (requiredTools.length === 0 && optionalTools.length === 0) {
    return agentTools;
  }

  // Otherwise, filter to skill tools that agent has access to
  const skillTools = [...requiredTools, ...optionalTools];
  return agentTools.filter(tool => skillTools.includes(tool));
}

/**
 * Build enhanced system prompt with skill instructions
 */
export function buildSkillPrompt(
  basePrompt: string,
  skill: EnhancedSkill,
  availableTools: string[]
): string {
  const parts: string[] = [basePrompt];

  // Add skill header
  parts.push(`\n\n# Aktiver Skill: ${skill.name}`);

  if (skill.description) {
    parts.push(`\n${skill.description}`);
  }

  // Add skill instructions
  if (skill.instructions) {
    parts.push(`\n\n## Anweisungen\n\n${skill.instructions}`);
  }

  // Add workflow hints if present
  if (skill.workflow && skill.workflow.steps.length > 0) {
    parts.push('\n\n## Empfohlener Ablauf\n');
    parts.push(formatWorkflowHints(skill.workflow.steps, availableTools));
  }

  // Add output format hints if present
  if (skill.output?.template) {
    parts.push('\n\n## Ausgabeformat\n');
    parts.push('Strukturiere deine Antwort nach folgendem Format:\n');
    parts.push('```');
    parts.push(skill.output.template);
    parts.push('```');
  }

  // Add available tools info
  if (availableTools.length > 0) {
    parts.push(`\n\n## Verfügbare Tools für diesen Skill\n`);
    parts.push(availableTools.map(t => `- ${t}`).join('\n'));
  }

  return parts.join('');
}

/**
 * Format workflow steps as hints for the LLM
 */
function formatWorkflowHints(steps: WorkflowStep[], availableTools: string[]): string {
  const hints: string[] = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    if (!step) continue;
    let hint = `${i + 1}. `;

    switch (step.action) {
      case 'tool':
        if (step.tool && availableTools.includes(step.tool)) {
          hint += `**Tool verwenden: ${step.tool}**`;
        } else if (step.tool) {
          hint += `~~Tool: ${step.tool}~~ (nicht verfügbar)`;
        }
        break;
      case 'think':
        hint += '**Analysieren/Nachdenken**';
        break;
      case 'respond':
        hint += '**Antwort formulieren**';
        break;
      case 'delegate':
        hint += '**An anderen Agent delegieren**';
        break;
    }

    if (step.description) {
      hint += ` - ${step.description}`;
    }

    if (step.condition) {
      hint += ` _(${step.condition})_`;
    }

    if (step.repeat) {
      hint += ` [${step.repeat}x wiederholen]`;
    }

    hints.push(hint);
  }

  return hints.join('\n');
}

/**
 * Extract skill context from the user message
 * Removes explicit /skill-id command from message
 */
export function extractSkillContext(message: string, skillId: string): string {
  // Remove /skill-id prefix if present
  const commandPattern = new RegExp(`^\\s*/+${skillId}\\s*`, 'i');
  return message.replace(commandPattern, '').trim();
}

/**
 * Format skill activation event for SSE
 */
export function formatSkillActivationEvent(context: SkillActivationContext): {
  skillId: string;
  skillName: string;
  tools: string[];
  canExecute: boolean;
  error?: string;
} {
  return {
    skillId: context.skill.id,
    skillName: context.skill.name,
    tools: context.availableTools,
    canExecute: context.canExecute,
    error: context.error,
  };
}
