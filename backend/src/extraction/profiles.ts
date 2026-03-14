/**
 * Extraction Profiles - YAML-based profile management
 *
 * Loads, caches, and provides CRUD for extraction profiles
 * stored in data/extraction-profiles/*.yaml
 */

import { readFile, writeFile, readdir, unlink, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type { ExtractionProfile } from './types';

const PROFILES_DIR = resolve(process.cwd(), '../data/extraction-profiles');

// In-memory cache
let profileCache: Map<string, ExtractionProfile> = new Map();
let cacheLoaded = false;

/**
 * Ensure profiles directory exists
 */
async function ensureDir(): Promise<void> {
  if (!existsSync(PROFILES_DIR)) {
    await mkdir(PROFILES_DIR, { recursive: true });
  }
}

/**
 * Load all profiles from disk into cache
 */
export async function loadProfiles(): Promise<void> {
  await ensureDir();
  profileCache.clear();

  const files = await readdir(PROFILES_DIR);
  const yamlFiles = files.filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));

  for (const file of yamlFiles) {
    try {
      const content = await readFile(join(PROFILES_DIR, file), 'utf-8');
      const profile = parseYaml(content) as ExtractionProfile;
      if (profile?.id) {
        profileCache.set(profile.id, profile);
      }
    } catch (error) {
      console.error(`[Extraction] Failed to load profile ${file}:`, error);
    }
  }

  cacheLoaded = true;
  console.log(`[Extraction] Loaded ${profileCache.size} extraction profiles`);
}

/**
 * Get all profiles
 */
export async function getAllProfiles(): Promise<ExtractionProfile[]> {
  if (!cacheLoaded) await loadProfiles();
  return Array.from(profileCache.values());
}

/**
 * Get a single profile by ID
 */
export async function getProfile(id: string): Promise<ExtractionProfile | null> {
  if (!cacheLoaded) await loadProfiles();
  return profileCache.get(id) || null;
}

/**
 * Save a profile (create or update)
 */
export async function saveProfile(profile: ExtractionProfile): Promise<void> {
  await ensureDir();
  const filePath = join(PROFILES_DIR, `${profile.id}.yaml`);
  const content = stringifyYaml(profile);
  await writeFile(filePath, content, 'utf-8');
  profileCache.set(profile.id, profile);
}

/**
 * Delete a profile
 */
export async function deleteProfile(id: string): Promise<boolean> {
  const filePath = join(PROFILES_DIR, `${id}.yaml`);
  if (!existsSync(filePath)) return false;

  await unlink(filePath);
  profileCache.delete(id);
  return true;
}

/**
 * Auto-detect profile from document text using keyword matching
 * Returns the best-matching profile ID or null
 */
export async function detectProfile(text: string): Promise<ExtractionProfile | null> {
  if (!cacheLoaded) await loadProfiles();

  const sample = text.substring(0, 3000).toLowerCase();
  let bestMatch: ExtractionProfile | null = null;
  let bestScore = 0;

  for (const profile of profileCache.values()) {
    const keywords = profile.detection?.keywords || [];
    if (keywords.length === 0) continue;

    let score = 0;
    for (const keyword of keywords) {
      if (sample.includes(keyword.toLowerCase())) {
        score++;
      }
    }

    // Normalize by keyword count to avoid bias toward profiles with more keywords
    const normalizedScore = score / keywords.length;

    if (normalizedScore > bestScore && score >= 2) {
      bestScore = normalizedScore;
      bestMatch = profile;
    }
  }

  return bestMatch;
}
