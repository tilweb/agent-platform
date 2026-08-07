/**
 * Extraction API Routes
 *
 * REST API for the document extraction pipeline.
 * Provides profile CRUD and extraction endpoints.
 */

import { Hono } from 'hono';
import {
  getAllProfiles,
  getProfile,
  saveProfile,
  deleteProfile,
  loadProfiles,
} from '../extraction/profiles';
import { extract, detectProfileFromText, generateProfile } from '../extraction/service';
import type { ExtractionProfile, ExtractionSource } from '../extraction/types';
import { extname, resolve, join } from 'path';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { existsSync } from 'fs';
import { convertDocument } from '../services/documentConverter';

const app = new Hono();

// ============== Profile CRUD ==============

/**
 * GET /api/extraction/profiles
 * List all extraction profiles
 */
app.get('/profiles', async (c) => {
  try {
    const profiles = await getAllProfiles();
    return c.json({
      profiles: profiles.map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        version: p.version,
        keywords: p.detection?.keywords || [],
        fieldCount: countFields(p),
      })),
    });
  } catch (error: any) {
    console.error('[Extraction API] Error listing profiles:', error);
    return c.json({ error: 'Fehler beim Laden der Profile' }, 500);
  }
});

/**
 * GET /api/extraction/profiles/:id
 * Get a single profile
 */
app.get('/profiles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const profile = await getProfile(id);
    if (!profile) {
      return c.json({ error: 'Profil nicht gefunden' }, 404);
    }
    return c.json({ profile });
  } catch (error: any) {
    console.error('[Extraction API] Error getting profile:', error);
    return c.json({ error: 'Fehler beim Laden des Profils' }, 500);
  }
});

/**
 * POST /api/extraction/profiles
 * Create a new profile
 */
app.post('/profiles', async (c) => {
  try {
    const profile = await c.req.json<ExtractionProfile>();

    if (!profile.id || !profile.name) {
      return c.json({ error: 'id und name sind erforderlich' }, 400);
    }

    // Check if already exists
    const existing = await getProfile(profile.id);
    if (existing) {
      return c.json({ error: `Profil "${profile.id}" existiert bereits` }, 409);
    }

    // Set defaults
    if (!profile.version) profile.version = '1.0';
    if (!profile.detection) profile.detection = { keywords: [] };
    if (!profile.fields) profile.fields = {};

    await saveProfile(profile);
    return c.json({ profile }, 201);
  } catch (error: any) {
    console.error('[Extraction API] Error creating profile:', error);
    return c.json({ error: error.message || 'Fehler beim Erstellen des Profils' }, 500);
  }
});

/**
 * PUT /api/extraction/profiles/:id
 * Update an existing profile
 */
app.put('/profiles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const existing = await getProfile(id);
    if (!existing) {
      return c.json({ error: 'Profil nicht gefunden' }, 404);
    }

    const updates = await c.req.json<Partial<ExtractionProfile>>();
    const updated: ExtractionProfile = { ...existing, ...updates, id }; // Prevent ID change

    await saveProfile(updated);
    return c.json({ profile: updated });
  } catch (error: any) {
    console.error('[Extraction API] Error updating profile:', error);
    return c.json({ error: error.message || 'Fehler beim Aktualisieren des Profils' }, 500);
  }
});

/**
 * DELETE /api/extraction/profiles/:id
 * Delete a profile
 */
app.delete('/profiles/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const deleted = await deleteProfile(id);
    if (!deleted) {
      return c.json({ error: 'Profil nicht gefunden' }, 404);
    }
    return c.json({ success: true });
  } catch (error: any) {
    console.error('[Extraction API] Error deleting profile:', error);
    return c.json({ error: 'Fehler beim Loeschen des Profils' }, 500);
  }
});

// ============== Extraction ==============

/**
 * POST /api/extraction/extract
 * Extract structured data from a document
 *
 * Accepts either:
 * - JSON body with { text, profile_id } for text extraction
 * - FormData with file upload + profile_id
 */
app.post('/extract', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';

    let source: ExtractionSource;
    let profileId: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      // File upload
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      profileId = formData.get('profile_id') as string | undefined;

      if (!file) {
        return c.json({ error: 'Keine Datei hochgeladen' }, 400);
      }

      // Save temp file
      const tempDir = resolve(process.cwd(), '../data/temp');
      if (!existsSync(tempDir)) {
        await mkdir(tempDir, { recursive: true });
      }

      const tempPath = join(tempDir, `extract-${Date.now()}-${file.name}`);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(tempPath, buffer);

      source = { type: 'file', path: tempPath, filename: file.name };

      // Extract and clean up temp file
      const result = await extract({ source, profile_id: profileId || undefined });

      // Clean up temp file
      try { await unlink(tempPath); } catch {}

      return c.json(result);
    } else {
      // JSON body
      const body = await c.req.json<{
        text?: string;
        profile_id?: string;
        attachment_id?: string;
        session_id?: string;
      }>();

      if (body.attachment_id) {
        source = {
          type: 'attachment',
          attachment_id: body.attachment_id,
          session_id: body.session_id,
        };
      } else if (body.text) {
        source = { type: 'text', content: body.text };
      } else {
        return c.json({ error: 'text oder attachment_id ist erforderlich' }, 400);
      }

      profileId = body.profile_id;
    }

    const result = await extract({ source, profile_id: profileId || undefined });
    return c.json(result);
  } catch (error: any) {
    console.error('[Extraction API] Error extracting:', error);
    return c.json({ error: error.message || 'Extraktion fehlgeschlagen' }, 500);
  }
});

/**
 * POST /api/extraction/detect
 * Auto-detect the profile for a document without extracting
 */
app.post('/detect', async (c) => {
  try {
    const body = await c.req.json<{ text: string }>();
    if (!body.text) {
      return c.json({ error: 'text ist erforderlich' }, 400);
    }

    const result = await detectProfileFromText(body.text);
    return c.json(result);
  } catch (error: any) {
    console.error('[Extraction API] Error detecting profile:', error);
    return c.json({ error: 'Profil-Erkennung fehlgeschlagen' }, 500);
  }
});

/**
 * POST /api/extraction/generate-profile
 * Generate a profile suggestion from a sample document using LLM
 *
 * Accepts:
 * - FormData with file + optional description (file upload)
 * - JSON with { text, description } (raw text)
 */
app.post('/generate-profile', async (c) => {
  try {
    const contentType = c.req.header('content-type') || '';
    let text: string;
    let description: string | undefined;

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData();
      const file = formData.get('file') as File | null;
      description = (formData.get('description') as string) || undefined;

      if (!file) {
        return c.json({ error: 'Keine Datei hochgeladen' }, 400);
      }

      // Convert file to text
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const textExts = ['txt', 'md', 'csv'];

      if (textExts.includes(ext)) {
        text = await file.text();
      } else {
        // Convert via Markitdown API
        // Zentraler Konverter (W8) — der Temp-Datei-Umweg entfaellt.
        const buffer = Buffer.from(await file.arrayBuffer());
        text = await convertDocument({ buffer, filename: file.name });
      }
    } else {
      const body = await c.req.json<{ text: string; description?: string }>();
      if (!body.text) {
        return c.json({ error: 'text ist erforderlich' }, 400);
      }
      text = body.text;
      description = body.description;
    }

    const result = await generateProfile(text, description);

    if (!result.success) {
      return c.json({ error: result.error || 'Profil-Generierung fehlgeschlagen' }, 500);
    }

    return c.json({ profile: result.profile });
  } catch (error: any) {
    console.error('[Extraction API] Error generating profile:', error);
    return c.json({ error: error.message || 'Profil-Generierung fehlgeschlagen' }, 500);
  }
});

// ============== Helpers ==============

function countFields(profile: ExtractionProfile): number {
  let count = 0;
  for (const group of Object.values(profile.fields)) {
    if ('_array' in group && group._array) {
      count += Object.keys((group as any)._item_fields || {}).length;
    } else {
      count += Object.keys(group).length;
    }
  }
  return count;
}

export { app as extractionRoutes };
