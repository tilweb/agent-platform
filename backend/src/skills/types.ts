/**
 * Enhanced Skills - Type Definitions
 *
 * Skills are knowledge resources that agents can load on demand.
 * Agent = WAS (Tools, capabilities, model)
 * Skill = WIE (Work instructions, methodology, workflow)
 */

/**
 * Skill trigger configuration (DEPRECATED - will be removed in future)
 * Kept for backward compatibility during migration period.
 * New skills should use metadata.use_when instead.
 */
export interface SkillTriggers {
  /** Keywords that activate this skill (DEPRECATED) */
  keywords?: string[];
  /** Regex patterns for more precise matching (DEPRECATED) */
  patterns?: string[];
  /** Intent identifier for LLM-based matching (DEPRECATED) */
  intent?: string;
  /** If true, skill only activates with explicit /skill-id command (DEPRECATED) */
  explicit?: boolean;
}

/**
 * Skill tool requirements (DEPRECATED - use allowed_tools instead)
 * Kept for backward compatibility during migration period.
 */
export interface SkillTools {
  /** Tools that must be available for the skill to work (DEPRECATED) */
  required?: string[];
  /** Tools that enhance the skill but aren't mandatory (DEPRECATED) */
  optional?: string[];
}

/**
 * Skill metadata for agent decision-making
 * This information is shown to agents in their system prompt
 * so they can decide when to load a skill.
 */
export interface SkillMetadata {
  /**
   * Describes when this skill should be used.
   * Shown to agents in system prompt for decision-making.
   * Example:
   *   - User asks for comprehensive research
   *   - Complex topic with multiple aspects
   *   - Source-based analysis required
   */
  use_when?: string;

  /**
   * Expected effort/duration hint for the agent.
   * Example: "5-15 minutes"
   */
  estimated_effort?: string;

  /**
   * Type of output the skill produces.
   * Example: "Structured report", "Analysis document"
   */
  output_type?: string;
}

/**
 * Knowledge references for skills
 * Allows skills to reference both explicit files and KB collections.
 */
export interface SkillKnowledge {
  /**
   * Explicit file paths relative to the skill folder.
   * These files are loaded deterministically when skill is activated.
   * Example: ["methodology.md", "quality-criteria.md"]
   */
  files?: string[];

  /**
   * Knowledge base collection IDs to reference.
   * Agent uses kb_search to find relevant docs from these collections.
   * Example: ["compliance/dsgvo", "hr/policies"]
   */
  collections?: string[];

  /**
   * Whether to inject collection manifests into skill context.
   * Gives agent overview of what's available in referenced collections.
   */
  inject_manifests?: boolean;
}

/**
 * Workflow step actions
 */
export type WorkflowAction = 'tool' | 'think' | 'respond' | 'delegate';

/**
 * Single workflow step
 */
export interface WorkflowStep {
  /** Unique step identifier */
  id: string;
  /** Type of action */
  action: WorkflowAction;
  /** Tool to use (when action is 'tool') */
  tool?: string;
  /** Description of what this step does */
  description: string;
  /** Condition for executing this step (natural language) */
  condition?: string;
  /** Repeat pattern, e.g., "2-3" for 2-3 times */
  repeat?: string;
  /** Query template for search tools */
  queryTemplate?: string;
}

/**
 * Skill workflow definition
 */
export interface SkillWorkflow {
  /** Ordered list of workflow steps */
  steps: WorkflowStep[];
}

/**
 * Output format options
 */
export type OutputFormat = 'markdown' | 'json' | 'text';

/**
 * Skill output configuration
 */
export interface SkillOutput {
  /** Output format type */
  format: OutputFormat;
  /** Mustache-style template for structuring output */
  template?: string;
  /** If true, the skill result will be automatically added as a material in the chat sidebar */
  markAsMaterial?: boolean;
  /** Custom title for the material (defaults to skill name if not specified) */
  materialTitle?: string;
}

/**
 * Skill parameter for user input
 */
export interface SkillParameter {
  /** Parameter name */
  name: string;
  /** Parameter type */
  type: 'string' | 'number' | 'boolean' | 'enum';
  /** Description shown to user */
  description?: string;
  /** Default value */
  default?: string | number | boolean;
  /** Options for enum type */
  options?: string[];
  /** Is this parameter required? */
  required?: boolean;
}

/**
 * Skill constraints
 */
export interface SkillConstraints {
  /** Maximum input/file size in characters */
  maxFileSize?: number;
  /** Allowed file extensions */
  allowedExtensions?: string[];
  /** Maximum workflow iterations */
  maxIterations?: number;
}

/**
 * Complete Enhanced Skill definition
 *
 * Skills are knowledge resources that agents load on demand via load_skill tool.
 * They provide work instructions, methodology, and optionally extend agent tools.
 */
export interface EnhancedSkill {
  /** Unique skill identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Skill version */
  version: string;
  /** Description of what the skill does */
  description: string;

  /**
   * Metadata for agent decision-making (NEW)
   * Shown in system prompt so agents can decide when to load this skill.
   */
  metadata?: SkillMetadata;

  /**
   * Tools that this skill ADDS to the agent when loaded (NEW)
   * Unlike the old tools.required which restricted tools,
   * allowed_tools EXTENDS the agent's available tools temporarily.
   * Example: Agent without web_search gets it when loading a research skill.
   */
  allowed_tools?: string[];

  /**
   * Knowledge references for the skill (NEW)
   * Allows skills to reference files and KB collections.
   */
  knowledge?: SkillKnowledge;

  /**
   * Trigger configuration (DEPRECATED - use metadata.use_when)
   * Kept for backward compatibility during migration.
   */
  triggers: SkillTriggers;

  /**
   * Tool requirements (DEPRECATED - use allowed_tools)
   * Kept for backward compatibility during migration.
   */
  tools: SkillTools;

  /** Instructions for the LLM */
  instructions: string;
  /** Optional workflow definition */
  workflow?: SkillWorkflow;
  /** Output configuration */
  output?: SkillOutput;
  /** User-configurable parameters */
  parameters?: SkillParameter[];
  /** Constraints and limits */
  constraints?: SkillConstraints;
  /** Whether skill is enabled */
  enabled?: boolean;
  /** Source file path */
  path?: string;
  /** Whether this is a system skill (not editable) */
  system?: boolean;
}

/**
 * Skill match result
 */
export interface SkillMatch {
  /** The matched skill */
  skill: EnhancedSkill;
  /** Match confidence (0-1) */
  confidence: number;
  /** What triggered the match */
  matchedBy: 'keyword' | 'pattern' | 'intent' | 'explicit';
  /** The specific trigger that matched */
  matchedTrigger: string;
}

/**
 * Skill activation context
 */
export interface SkillActivationContext {
  /** The matched skill */
  skill: EnhancedSkill;
  /** Available tools (filtered for skill) */
  availableTools: string[];
  /** Missing required tools */
  missingTools: string[];
  /** Whether skill can be executed */
  canExecute: boolean;
  /** Error message if cannot execute */
  error?: string;
}

/**
 * Legacy skill format (for backward compatibility)
 */
export interface LegacySkill {
  name: string;
  keywords: string[];
  content: string;
  path: string;
}

/**
 * Result of loading a skill via load_skill tool
 */
export interface SkillLoadResult {
  /** Whether the skill was loaded successfully */
  success: boolean;
  /** Basic info about the loaded skill */
  skill?: {
    id: string;
    name: string;
  };
  /** Skill instructions formatted for context injection */
  instructions?: string;
  /** Tools that were added to the agent's available tools */
  addedTools?: string[];
  /** Knowledge files that were loaded into context */
  loadedFiles?: string[];
  /** Error message (if failed) */
  error?: string;
}

/**
 * Skill summary for system prompt injection
 * Minimal info to help agent decide which skill to load
 */
export interface SkillSummary {
  /** Skill ID (used with load_skill tool) */
  id: string;
  /** Human-readable name */
  name: string;
  /** Short description */
  description: string;
  /** When to use this skill */
  use_when?: string;
  /** Expected output type */
  output_type?: string;
}
