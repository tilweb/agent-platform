/**
 * Enhanced Skills Module
 *
 * Provides skill-based enhancement for agent interactions:
 * - YAML-based skill definitions
 * - Keyword and pattern matching
 * - Tool integration
 * - Workflow support (Phase 2)
 */

// Export types
export * from './types';

// Export loader functions
export {
  loadSkills,
  getSkillById,
  getEnabledSkills,
  clearSkillsCache,
  reloadSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  getSkillSummaries,
  loadSkillKnowledgeFiles,
} from './loader';

// Export matcher functions
export {
  matchSkills,
  matchBestSkill,
  skillMatchesMessage,
  type SkillFilterOptions,
} from './matcher';

// Export activator functions
export {
  prepareSkillActivation,
  filterToolsForSkill,
  buildSkillPrompt,
  extractSkillContext,
  formatSkillActivationEvent,
} from './activator';

// Export workflow functions
export {
  createWorkflowState,
  getWorkflowContext,
  advanceWorkflow,
  validateToolForStep,
  buildWorkflowPromptSection,
  createStepEvent,
  shouldAutoAdvance,
  getSuggestedTool,
  type WorkflowState,
  type WorkflowStepEvent,
  type WorkflowContext,
} from './workflow';
