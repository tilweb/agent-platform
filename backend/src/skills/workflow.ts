/**
 * Enhanced Skills - Workflow Engine
 *
 * Manages workflow execution for skills:
 * - Tracks current step
 * - Provides step hints to LLM
 * - Validates tool usage
 * - Reports progress via events
 */

import type { EnhancedSkill, SkillWorkflow, WorkflowStep } from './types';

/**
 * Workflow execution state
 */
export interface WorkflowState {
  skillId: string;
  currentStepIndex: number;
  completedSteps: number[];
  startedAt: number;
  lastStepAt: number | null;
  isComplete: boolean;
}

/**
 * Workflow step event
 */
export interface WorkflowStepEvent {
  type: 'workflow_step_start' | 'workflow_step_complete' | 'workflow_complete';
  skillId: string;
  stepIndex: number;
  stepId: string;
  stepAction: string;
  stepDescription?: string;
  totalSteps: number;
  progress: number; // 0-100
}

/**
 * Workflow context for LLM
 */
export interface WorkflowContext {
  currentStep: WorkflowStep | null;
  nextStep: WorkflowStep | null;
  previousStep: WorkflowStep | null;
  progress: number;
  stepsRemaining: number;
  hints: string[];
}

/**
 * Create initial workflow state
 */
export function createWorkflowState(skill: EnhancedSkill): WorkflowState | null {
  if (!skill.workflow?.steps?.length) {
    return null;
  }

  return {
    skillId: skill.id,
    currentStepIndex: 0,
    completedSteps: [],
    startedAt: Date.now(),
    lastStepAt: null,
    isComplete: false,
  };
}

/**
 * Get workflow context for LLM prompting
 */
export function getWorkflowContext(
  skill: EnhancedSkill,
  state: WorkflowState
): WorkflowContext {
  const steps = skill.workflow?.steps || [];
  const currentIndex = state.currentStepIndex;

  const currentStep = steps[currentIndex] ?? null;
  const nextStep = steps[currentIndex + 1] ?? null;
  const previousStep = currentIndex > 0 ? (steps[currentIndex - 1] ?? null) : null;

  const progress = steps.length > 0
    ? Math.round((state.completedSteps.length / steps.length) * 100)
    : 100;

  const stepsRemaining = steps.length - state.completedSteps.length;

  // Generate hints for current step
  const hints: string[] = [];

  if (currentStep) {
    hints.push(`Aktueller Schritt (${currentIndex + 1}/${steps.length}): ${currentStep.description || currentStep.action}`);

    if (currentStep.action === 'tool' && currentStep.tool) {
      hints.push(`Verwende das Tool "${currentStep.tool}" für diesen Schritt.`);
    }

    if (currentStep.condition) {
      hints.push(`Bedingung: ${currentStep.condition}`);
    }

    if (currentStep.repeat) {
      hints.push(`Dieser Schritt kann ${currentStep.repeat} mal wiederholt werden.`);
    }
  }

  if (nextStep) {
    hints.push(`Nächster Schritt: ${nextStep.description || nextStep.action}`);
  }

  return {
    currentStep,
    nextStep,
    previousStep,
    progress,
    stepsRemaining,
    hints,
  };
}

/**
 * Advance to next workflow step
 */
export function advanceWorkflow(
  state: WorkflowState,
  workflow: SkillWorkflow
): WorkflowState {
  const steps = workflow.steps || [];

  if (state.isComplete) {
    return state;
  }

  const newCompletedSteps = [...state.completedSteps, state.currentStepIndex];
  const nextIndex = state.currentStepIndex + 1;
  const isComplete = nextIndex >= steps.length;

  return {
    ...state,
    currentStepIndex: isComplete ? state.currentStepIndex : nextIndex,
    completedSteps: newCompletedSteps,
    lastStepAt: Date.now(),
    isComplete,
  };
}

/**
 * Check if a tool call matches the expected workflow step
 */
export function validateToolForStep(
  toolName: string,
  step: WorkflowStep
): { valid: boolean; message?: string } {
  if (step.action !== 'tool') {
    return {
      valid: true,
      message: 'Step does not require a specific tool',
    };
  }

  if (!step.tool) {
    return {
      valid: true,
      message: 'Step has no specific tool requirement',
    };
  }

  if (toolName === step.tool) {
    return {
      valid: true,
    };
  }

  return {
    valid: false,
    message: `Expected tool "${step.tool}" but got "${toolName}"`,
  };
}

/**
 * Build workflow section for system prompt
 */
export function buildWorkflowPromptSection(
  skill: EnhancedSkill,
  state: WorkflowState
): string {
  const workflow = skill.workflow;
  if (!workflow?.steps?.length) {
    return '';
  }

  const context = getWorkflowContext(skill, state);
  const steps = workflow.steps;

  const lines: string[] = [
    '\n## Workflow Status',
    `Fortschritt: ${context.progress}% (${state.completedSteps.length}/${steps.length} Schritte)`,
    '',
  ];

  // Show all steps with status
  lines.push('### Schritte:');
  steps.forEach((step, index) => {
    const isCompleted = state.completedSteps.includes(index);
    const isCurrent = index === state.currentStepIndex && !state.isComplete;

    let status = '○'; // pending
    if (isCompleted) status = '✓'; // completed
    if (isCurrent) status = '▶'; // current

    let stepLine = `${status} ${index + 1}. `;

    switch (step.action) {
      case 'tool':
        stepLine += `**Tool: ${step.tool}**`;
        break;
      case 'think':
        stepLine += '**Analysieren**';
        break;
      case 'respond':
        stepLine += '**Antworten**';
        break;
      case 'delegate':
        stepLine += '**Delegieren**';
        break;
    }

    if (step.description) {
      stepLine += ` - ${step.description}`;
    }

    if (isCurrent && step.condition) {
      stepLine += ` _(${step.condition})_`;
    }

    lines.push(stepLine);
  });

  // Add current step hints
  if (!state.isComplete && context.currentStep) {
    lines.push('');
    lines.push('### Aktueller Schritt:');
    context.hints.forEach(hint => {
      lines.push(`- ${hint}`);
    });
  }

  if (state.isComplete) {
    lines.push('');
    lines.push('✅ **Workflow abgeschlossen** - Formuliere jetzt die finale Antwort.');
  }

  return lines.join('\n');
}

/**
 * Create workflow step event
 */
export function createStepEvent(
  state: WorkflowState,
  workflow: SkillWorkflow,
  type: 'start' | 'complete'
): WorkflowStepEvent {
  const steps = workflow.steps || [];
  const currentStep = steps[state.currentStepIndex];
  const progress = steps.length > 0
    ? Math.round((state.completedSteps.length / steps.length) * 100)
    : 100;

  return {
    type: type === 'start' ? 'workflow_step_start' : 'workflow_step_complete',
    skillId: state.skillId,
    stepIndex: state.currentStepIndex,
    stepId: currentStep?.id || `step_${state.currentStepIndex}`,
    stepAction: currentStep?.action || 'unknown',
    stepDescription: currentStep?.description,
    totalSteps: steps.length,
    progress,
  };
}

/**
 * Determine if workflow should auto-advance based on tool completion
 */
export function shouldAutoAdvance(
  state: WorkflowState,
  workflow: SkillWorkflow,
  completedToolName?: string
): boolean {
  if (state.isComplete) {
    return false;
  }

  const currentStep = workflow.steps?.[state.currentStepIndex];
  if (!currentStep) {
    return false;
  }

  // Auto-advance when:
  // 1. Current step is a tool step and matching tool was used
  // 2. Current step is 'think' (always advance after thinking)
  // 3. Current step has no repeat requirement

  if (currentStep.action === 'tool' && completedToolName) {
    if (currentStep.tool === completedToolName) {
      // Check repeat requirement
      if (!currentStep.repeat) {
        return true;
      }
      // TODO: Implement repeat counting
    }
  }

  return false;
}

/**
 * Get suggested tool for current step
 */
export function getSuggestedTool(
  state: WorkflowState,
  workflow: SkillWorkflow
): string | null {
  if (state.isComplete) {
    return null;
  }

  const currentStep = workflow.steps?.[state.currentStepIndex];
  if (!currentStep || currentStep.action !== 'tool') {
    return null;
  }

  return currentStep.tool || null;
}
