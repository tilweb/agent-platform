/**
 * User Preferences Service
 *
 * Manages user-specific preferences, especially model selection per purpose.
 * Preferences are stored in the user's YAML file.
 */

import { loadUser, saveUser } from '../auth/storage';
import type { User, UserModelPreference, UserPreferences } from '../auth/types';
import { DEFAULT_FAVORITE_AGENT_IDS } from './agents';

export type ModelPurpose = 'chat' | 'vision' | 'tts' | 'stt' | 'text_to_image' | 'image_to_image';

/**
 * Get user's model preference for a specific purpose
 *
 * @param userId - The user ID
 * @param purpose - The model purpose (chat, vision, etc.)
 * @returns The user's preferred model or null if not set
 */
export async function getUserModelPreference(
  userId: string,
  purpose: ModelPurpose
): Promise<UserModelPreference | null> {
  const user = await loadUser(userId);
  if (!user) {
    return null;
  }

  const preference = user.preferences?.models?.[purpose];
  if (!preference?.provider_id || !preference?.model_id) {
    return null;
  }

  return preference;
}

/**
 * Get all model preferences for a user
 *
 * @param userId - The user ID
 * @returns Object with all model preferences
 */
export async function getAllUserModelPreferences(
  userId: string
): Promise<UserPreferences['models'] | null> {
  const user = await loadUser(userId);
  if (!user) {
    return null;
  }

  return user.preferences?.models || null;
}

/**
 * Set user's model preference for a specific purpose
 *
 * @param userId - The user ID
 * @param purpose - The model purpose (chat, vision, etc.)
 * @param providerId - The provider ID
 * @param modelId - The model ID
 */
export async function setUserModelPreference(
  userId: string,
  purpose: ModelPurpose,
  providerId: string,
  modelId: string
): Promise<void> {
  const user = await loadUser(userId);
  if (!user) {
    throw new Error(`User '${userId}' not found`);
  }

  // Initialize preferences structure if needed
  if (!user.preferences) {
    user.preferences = {};
  }
  if (!user.preferences.models) {
    user.preferences.models = {};
  }

  // Set the preference
  user.preferences.models[purpose] = {
    provider_id: providerId,
    model_id: modelId,
  };

  // Update the user
  user.updatedAt = new Date().toISOString();
  await saveUser(user);
}

/**
 * Clear user's model preference for a specific purpose (revert to system default)
 *
 * @param userId - The user ID
 * @param purpose - The model purpose (chat, vision, etc.)
 */
export async function clearUserModelPreference(
  userId: string,
  purpose: ModelPurpose
): Promise<void> {
  const user = await loadUser(userId);
  if (!user) {
    throw new Error(`User '${userId}' not found`);
  }

  // Remove the preference if it exists
  if (user.preferences?.models?.[purpose]) {
    delete user.preferences.models[purpose];

    // Clean up empty objects
    if (Object.keys(user.preferences.models).length === 0) {
      delete user.preferences.models;
    }
    if (Object.keys(user.preferences).length === 0) {
      delete user.preferences;
    }

    // Update the user
    user.updatedAt = new Date().toISOString();
    await saveUser(user);
  }
}

// ============== Favoriten-Agenten (Chat-Sidebar) ==============

/**
 * Get the user's favorite agent IDs.
 *
 * Unterscheidet bewusst zwei Zustände:
 * - `favorite_agents` fehlt (nie gesetzt) → Default-Favoriten vorbelegen, damit
 *   neue Nutzer sofort die Start-Agenten in der Sidebar-Schnellauswahl sehen.
 * - `favorite_agents` ist ein (auch leeres) Array → so übernehmen; ein bewusst
 *   geleertes Array bleibt leer (keine erneute Vorbelegung).
 */
export async function getFavoriteAgents(userId: string): Promise<string[]> {
  const user = await loadUser(userId);
  const fav = user?.preferences?.favorite_agents;
  if (fav === undefined) return [...DEFAULT_FAVORITE_AGENT_IDS];
  return fav;
}

/**
 * Replace the user's favorite agent IDs. Deduplicates and caps the list;
 * an empty array clears the preference.
 */
export async function setFavoriteAgents(userId: string, agentIds: string[]): Promise<string[]> {
  const user = await loadUser(userId);
  if (!user) {
    throw new Error(`User '${userId}' not found`);
  }

  const cleaned = [...new Set(
    agentIds.filter((id) => typeof id === 'string' && id.trim().length > 0).map((id) => id.trim())
  )].slice(0, 50);

  if (!user.preferences) {
    user.preferences = {};
  }
  // Auch ein leeres Array wird gespeichert (nicht gelöscht): so bleibt „bewusst
  // geleert" erhalten und wird von getFavoriteAgents NICHT erneut mit Defaults
  // vorbelegt (siehe dort).
  user.preferences.favorite_agents = cleaned;

  user.updatedAt = new Date().toISOString();
  await saveUser(user);
  return cleaned;
}

/**
 * Clear all model preferences for a user
 *
 * @param userId - The user ID
 */
export async function clearAllUserModelPreferences(userId: string): Promise<void> {
  const user = await loadUser(userId);
  if (!user) {
    throw new Error(`User '${userId}' not found`);
  }

  if (user.preferences?.models) {
    delete user.preferences.models;

    // Clean up empty preferences object
    if (Object.keys(user.preferences).length === 0) {
      delete user.preferences;
    }

    // Update the user
    user.updatedAt = new Date().toISOString();
    await saveUser(user);
  }
}
