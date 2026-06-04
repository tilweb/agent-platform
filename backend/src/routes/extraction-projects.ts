/**
 * Extraction Projects Routes
 *
 * REST API for learning extraction projects, training, and guidelines.
 */

import { Hono } from 'hono';
import {
  getAllProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  getExamples,
  deleteExample,
  extract,
  train,
  regenerateGuidelines,
} from '../extraction/learning';

export const extractionProjectRoutes = new Hono();

// ============== Project CRUD ==============

/**
 * GET /projects — List all projects
 */
extractionProjectRoutes.get('/projects', async (c) => {
  const projects = await getAllProjects();
  return c.json(projects.map(p => ({
    id: p.id,
    name: p.name,
    description: p.description,
    field_count: Object.keys(p.fields).length,
    created: p.created,
    updated: p.updated,
    learning: p.learning,
  })));
});

/**
 * GET /projects/:id — Project details
 */
extractionProjectRoutes.get('/projects/:id', async (c) => {
  const project = await getProject(c.req.param('id'));
  if (!project) {
    return c.json({ error: 'Projekt nicht gefunden' }, 404);
  }
  return c.json(project);
});

/**
 * POST /projects — Create project
 */
extractionProjectRoutes.post('/projects', async (c) => {
  const body = await c.req.json();

  if (!body.name || !body.fields || Object.keys(body.fields).length === 0) {
    return c.json({ error: 'Name und mindestens ein Feld erforderlich' }, 400);
  }

  const project = await createProject({
    name: body.name,
    description: body.description,
    fields: body.fields,
    extraction: body.extraction,
  });

  return c.json(project, 201);
});

/**
 * PUT /projects/:id — Update project
 */
extractionProjectRoutes.put('/projects/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const updated = await updateProject(id, {
    name: body.name,
    description: body.description,
    fields: body.fields,
    extraction: body.extraction,
  });

  if (!updated) {
    return c.json({ error: 'Projekt nicht gefunden' }, 404);
  }

  return c.json(updated);
});

/**
 * DELETE /projects/:id — Delete project with all examples
 */
extractionProjectRoutes.delete('/projects/:id', async (c) => {
  const deleted = await deleteProject(c.req.param('id'));
  if (!deleted) {
    return c.json({ error: 'Projekt nicht gefunden' }, 404);
  }
  return c.json({ success: true });
});

// ============== Extraction ==============

/**
 * POST /projects/:id/extract — Extract data from document
 *
 * Accepts: JSON { text } or FormData with file
 */
extractionProjectRoutes.post('/projects/:id/extract', async (c) => {
  const projectId = c.req.param('id');
  const contentType = c.req.header('content-type') || '';

  let source: any;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return c.json({ error: 'Keine Datei hochgeladen' }, 400);
    }

    // Save temp file
    const tmpDir = '/tmp/extraction';
    const { mkdir } = await import('fs/promises');
    const { existsSync } = await import('fs');
    if (!existsSync(tmpDir)) await mkdir(tmpDir, { recursive: true });

    const tmpPath = `${tmpDir}/${Date.now()}_${file.name}`;
    const buffer = await file.arrayBuffer();
    await Bun.write(tmpPath, buffer);

    source = { type: 'file', path: tmpPath, filename: file.name };
  } else {
    const body = await c.req.json();
    if (!body.text) {
      return c.json({ error: 'Text oder Datei erforderlich' }, 400);
    }
    source = { type: 'text', content: body.text };
  }

  const result = await extract(projectId, source);
  return c.json(result);
});

// ============== Training ==============

/**
 * POST /projects/:id/train — Save training example (initial + corrected)
 */
extractionProjectRoutes.post('/projects/:id/train', async (c) => {
  const projectId = c.req.param('id');
  const body = await c.req.json();

  if (!body.document_text || !body.initial_extraction || !body.corrected_extraction) {
    return c.json({ error: 'document_text, initial_extraction und corrected_extraction erforderlich' }, 400);
  }

  const result = await train(projectId, {
    source_filename: body.source_filename || 'unknown',
    document_text: body.document_text,
    initial_extraction: body.initial_extraction,
    corrected_extraction: body.corrected_extraction,
  });

  return c.json(result);
});

/**
 * GET /projects/:id/examples — List training examples
 */
extractionProjectRoutes.get('/projects/:id/examples', async (c) => {
  const examples = await getExamples(c.req.param('id'));
  return c.json(examples.map(e => ({
    id: e.id,
    created: e.created,
    source_filename: e.source_filename,
    corrections_count: e.corrections.length,
    confirmed_correct: e.confirmed_correct,
  })));
});

/**
 * DELETE /projects/:id/examples/:exId — Delete training example
 */
extractionProjectRoutes.delete('/projects/:id/examples/:exId', async (c) => {
  const deleted = await deleteExample(c.req.param('id'), c.req.param('exId'));
  if (!deleted) {
    return c.json({ error: 'Beispiel nicht gefunden' }, 404);
  }
  return c.json({ success: true });
});

// ============== Guidelines ==============

/**
 * POST /projects/:id/regenerate — Force regenerate guidelines
 */
extractionProjectRoutes.post('/projects/:id/regenerate', async (c) => {
  try {
    const result = await regenerateGuidelines(c.req.param('id'));
    return c.json(result);
  } catch (error: any) {
    return c.json({ error: error.message }, 400);
  }
});
