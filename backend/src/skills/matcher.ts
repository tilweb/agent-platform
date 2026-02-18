/**
 * Enhanced Skills - Matcher
 *
 * Matches user messages to skills using:
 * - Keyword matching
 * - Regex pattern matching
 * - Explicit /skill-id commands
 */

import type { EnhancedSkill, SkillMatch } from './types';
import { getEnabledSkills } from './loader';

/**
 * Check if message contains explicit skill command
 * Format: /skill-id or /skillId
 */
function matchExplicitCommand(message: string, skill: EnhancedSkill): SkillMatch | null {
  const commandPattern = new RegExp(`^\\s*/+${skill.id}\\b`, 'i');

  if (commandPattern.test(message)) {
    return {
      skill,
      confidence: 1.0,
      matchedBy: 'explicit',
      matchedTrigger: `/${skill.id}`,
    };
  }

  return null;
}

/**
 * Check if message matches any skill keywords
 */
function matchKeywords(message: string, skill: EnhancedSkill): SkillMatch | null {
  const keywords = skill.triggers.keywords || [];
  if (keywords.length === 0) return null;

  const messageLower = message.toLowerCase();

  for (const keyword of keywords) {
    const keywordLower = keyword.toLowerCase();

    // Check for word boundary match (not just substring)
    const wordBoundaryPattern = new RegExp(`\\b${escapeRegex(keywordLower)}\\b`, 'i');

    if (wordBoundaryPattern.test(messageLower)) {
      // Calculate confidence based on keyword specificity
      const confidence = calculateKeywordConfidence(keyword, message);

      return {
        skill,
        confidence,
        matchedBy: 'keyword',
        matchedTrigger: keyword,
      };
    }
  }

  return null;
}

/**
 * Check if message matches any skill patterns
 */
function matchPatterns(message: string, skill: EnhancedSkill): SkillMatch | null {
  const patterns = skill.triggers.patterns || [];
  if (patterns.length === 0) return null;

  for (const pattern of patterns) {
    try {
      const regex = new RegExp(pattern, 'i');

      if (regex.test(message)) {
        return {
          skill,
          confidence: 0.9, // Patterns are more specific, higher base confidence
          matchedBy: 'pattern',
          matchedTrigger: pattern,
        };
      }
    } catch (error) {
      console.warn(`Invalid regex pattern in skill ${skill.id}: ${pattern}`);
    }
  }

  return null;
}

/**
 * Calculate confidence for keyword match
 */
function calculateKeywordConfidence(keyword: string, message: string): number {
  // Base confidence
  let confidence = 0.7;

  // Longer keywords = more specific = higher confidence
  if (keyword.length > 10) confidence += 0.1;
  if (keyword.length > 20) confidence += 0.1;

  // Multi-word keywords are more specific
  if (keyword.includes(' ')) confidence += 0.1;

  // Cap at 0.95 (patterns and explicit commands are more confident)
  return Math.min(confidence, 0.95);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Filter options for skill matching based on agent configuration
 */
export interface SkillFilterOptions {
  /** List of skill IDs the agent can use (when skillMode is 'allow') */
  agentSkills?: string[];
  /**
   * Skill access mode:
   * - 'all' (default): Agent can use ALL available skills
   * - 'allow': Agent can ONLY use skills listed in agentSkills
   */
  skillMode?: 'all' | 'allow';
}

/**
 * Match a message against all enabled skills
 * Returns all matches sorted by confidence
 *
 * @param message - User message to match against
 * @param filterOptions - Optional filter based on agent skill configuration
 */
export async function matchSkills(
  message: string,
  filterOptions?: SkillFilterOptions
): Promise<SkillMatch[]> {
  let skills = await getEnabledSkills();

  // Filter skills based on agent configuration
  if (filterOptions?.skillMode === 'allow') {
    const allowedSkills = filterOptions.agentSkills || [];
    skills = skills.filter(s => allowedSkills.includes(s.id));
  }
  // 'all' mode or undefined: use all skills (no filtering)

  const matches: SkillMatch[] = [];

  for (const skill of skills) {
    // Skip skills that require explicit activation if they're not explicitly called
    if (skill.triggers.explicit) {
      const explicitMatch = matchExplicitCommand(message, skill);
      if (explicitMatch) {
        matches.push(explicitMatch);
      }
      continue;
    }

    // Check explicit command first (highest priority)
    const explicitMatch = matchExplicitCommand(message, skill);
    if (explicitMatch) {
      matches.push(explicitMatch);
      continue;
    }

    // Check patterns (more specific than keywords)
    const patternMatch = matchPatterns(message, skill);
    if (patternMatch) {
      matches.push(patternMatch);
      continue;
    }

    // Check keywords
    const keywordMatch = matchKeywords(message, skill);
    if (keywordMatch) {
      matches.push(keywordMatch);
    }
  }

  // Sort by confidence (highest first)
  matches.sort((a, b) => b.confidence - a.confidence);

  return matches;
}

/**
 * Get the best matching skill for a message
 * Returns null if no skill matches
 *
 * @param message - User message to match against
 * @param filterOptions - Optional filter based on agent skill configuration
 */
export async function matchBestSkill(
  message: string,
  filterOptions?: SkillFilterOptions
): Promise<SkillMatch | null> {
  const matches = await matchSkills(message, filterOptions);
  return matches[0] ?? null;
}

/**
 * Check if a specific skill matches the message
 */
export async function skillMatchesMessage(skillId: string, message: string): Promise<boolean> {
  const matches = await matchSkills(message);
  return matches.some(m => m.skill.id === skillId);
}
