/**
 * Projektmanagement Routes
 * REST API endpoints for Projektauftrag management
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import {
  createProjektauftrag,
  createFromVorlage,
  listProjektauftraege,
  getProjektauftragDetails,
  updateProjektauftrag,
  updateProjektauftragStep,
  removeProjektauftrag,
  getProjektauftragStats,
  searchProjektauftraege,
  validateStep,
  calculateCompleteness,
  listVorlagen,
  getVorlageDetails,
} from './service';
import {
  getAllKnowledge,
  getStepKnowledge,
  getRawStepKnowledge,
  saveStepKnowledge,
  saveStepKnowledgeJson,
  generateAnalysisPrompt,
  getPruefkriterien,
  getTypischeFehler,
  getVerbesserungsvorschlaege,
} from './knowledge';
import { analyzeStep, analyzeGesamt, hasEnoughDataForAnalysis } from './analysis';
import { getConfig, saveConfig } from './storage';
import type { ProjektauftragFilters } from './types';
import { importProjektauftrag, importProjektidee } from './import-service';
import {
  createStatusbericht as createSB,
  listStatusberichte,
  getStatusberichtDetails,
  updateStatusbericht as updateSB,
  removeStatusbericht,
  getDashboard,
} from './statusbericht-service';
import {
  listIdeen,
  getIdeeDetails,
  createIdee,
  updateIdee,
  updateIdeeStep,
  removeIdee,
  createAuftragFromIdee,
} from './idee-service';
import {
  generateDocument,
  mapProjektauftragToDocument,
  mapStatusberichtToDocument,
  mapProjektideeToDocument,
  getMimeType,
  getFileExtension,
  type DocumentFormat,
} from '../../services/documentGenerator';

const projektmanagement = new Hono();

// ============== Config Endpoints ==============

/**
 * GET /api/apps/projektmanagement/config
 * Get app configuration (select options etc.)
 */
projektmanagement.get('/config', async (c) => {
  try {
    const config = await getConfig();
    return c.json(config);
  } catch (error) {
    console.error('Error getting config:', error);
    return c.json({ error: 'Failed to get config' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/config
 * Update app configuration
 */
projektmanagement.put('/config', async (c) => {
  try {
    const body = await c.req.json();
    await saveConfig(body);
    return c.json(body);
  } catch (error) {
    console.error('Error saving config:', error);
    return c.json({ error: 'Failed to save config' }, 500);
  }
});

// ============== Import Endpoint ==============

/**
 * POST /api/apps/projektmanagement/projektauftraege/import
 * Import Projektauftrag from multiple documents
 * Must be registered BEFORE /:id route
 */
projektmanagement.post('/projektauftraege/import', async (c) => {
  try {
    const formData = await c.req.formData();
    const userId = 'user_default';

    // Extract files from FormData
    const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'text/plain', 'text/markdown',
    ]);

    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        // Validate file count
        if (files.length >= 10) {
          return c.json({ error: 'Maximal 10 Dateien erlaubt' }, 400);
        }

        // Validate file size (50MB)
        if (value.size > 50 * 1024 * 1024) {
          return c.json({ error: `Datei "${value.name}" ist zu groß (max. 50 MB)` }, 400);
        }

        // Validate MIME type
        if (!allowedMimeTypes.has(value.type)) {
          return c.json({ error: `Dateityp "${value.type}" nicht unterstützt für "${value.name}"` }, 400);
        }

        const arrayBuffer = await value.arrayBuffer();
        files.push({
          buffer: Buffer.from(arrayBuffer),
          filename: value.name,
          mimeType: value.type,
        });
      }
    }

    if (files.length === 0) {
      return c.json({ error: 'Keine Dateien hochgeladen' }, 400);
    }

    console.log(`[PM-Import] Received ${files.length} files for import`);

    // SSE-Stream: Phasen-Events landen direkt beim Client. Heartbeats waehrend
    // langer Vision/LLM-Calls verhindern dass UI als "haengt" wahrgenommen wird.
    return streamSSE(c, async (stream) => {
      try {
        await importProjektauftrag(files, userId, async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        });
      } catch (error) {
        console.error('Error importing Projektauftrag:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: error instanceof Error ? error.message : 'Import fehlgeschlagen' }),
        });
      }
    });
  } catch (error) {
    console.error('Error importing Projektauftrag:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Import fehlgeschlagen' },
      500
    );
  }
});

// ============== Projektauftrag Endpoints ==============

/**
 * POST /api/apps/projektmanagement/projektauftraege
 * Create a new Projektauftrag
 */
projektmanagement.post('/projektauftraege', async (c) => {
  try {
    const body = await c.req.json();
    const userId = 'user_default'; // In real app would come from auth

    const projektauftrag = await createProjektauftrag(body, userId);
    return c.json({ projektauftrag }, 201);
  } catch (error) {
    console.error('Error creating Projektauftrag:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create Projektauftrag' },
      500
    );
  }
});

/**
 * POST /api/apps/projektmanagement/projektauftraege/from-vorlage
 * Create a new Projektauftrag from a Vorlage
 */
projektmanagement.post('/projektauftraege/from-vorlage', async (c) => {
  try {
    const { vorlageId } = await c.req.json<{ vorlageId: string }>();
    const userId = 'user_default';

    if (!vorlageId) {
      return c.json({ error: 'vorlageId is required' }, 400);
    }

    const projektauftrag = await createFromVorlage(vorlageId, userId);

    if (!projektauftrag) {
      return c.json({ error: 'Vorlage not found' }, 404);
    }

    return c.json({ projektauftrag }, 201);
  } catch (error) {
    console.error('Error creating from Vorlage:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create from Vorlage' },
      500
    );
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege
 * List all Projektauftraege with optional filters
 */
projektmanagement.get('/projektauftraege', async (c) => {
  try {
    const status = c.req.query('status') as ProjektauftragFilters['status'];
    const project_type = c.req.query('project_type');
    const projektleiter = c.req.query('projektleiter');
    const search = c.req.query('search');
    const from_date = c.req.query('from_date');
    const to_date = c.req.query('to_date');

    const filters: ProjektauftragFilters = {};
    if (status) filters.status = status;
    if (project_type) filters.project_type = project_type;
    if (projektleiter) filters.projektleiter = projektleiter;
    if (search) filters.search = search;
    if (from_date) filters.from_date = from_date;
    if (to_date) filters.to_date = to_date;

    const projektauftraege = await listProjektauftraege(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    return c.json({ projektauftraege });
  } catch (error) {
    console.error('Error listing Projektauftraege:', error);
    return c.json({ error: 'Failed to list Projektauftraege' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/stats
 * Get Projektauftrag statistics
 */
projektmanagement.get('/projektauftraege/stats', async (c) => {
  try {
    const stats = await getProjektauftragStats();
    return c.json({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    return c.json({ error: 'Failed to get statistics' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:id
 * Get Projektauftrag details
 */
projektmanagement.get('/projektauftraege/:id', async (c) => {
  try {
    const projektId = c.req.param('id');
    const projektauftrag = await getProjektauftragDetails(projektId);

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    // Add completeness info
    const completeness = calculateCompleteness(projektauftrag);

    return c.json({ projektauftrag, completeness });
  } catch (error) {
    console.error('Error getting Projektauftrag:', error);
    return c.json({ error: 'Failed to get Projektauftrag' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/projektauftraege/:id
 * Update Projektauftrag
 */
projektmanagement.put('/projektauftraege/:id', async (c) => {
  try {
    const projektId = c.req.param('id');
    const updates = await c.req.json();

    const projektauftrag = await updateProjektauftrag(projektId, updates);

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    return c.json({ projektauftrag });
  } catch (error) {
    console.error('Error updating Projektauftrag:', error);
    return c.json({ error: 'Failed to update Projektauftrag' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/projektauftraege/:id/step/:step
 * Update specific step of Projektauftrag
 */
projektmanagement.put('/projektauftraege/:id/step/:step', async (c) => {
  try {
    const projektId = c.req.param('id');
    const step = parseInt(c.req.param('step'), 10);
    const data = await c.req.json();

    if (isNaN(step) || step < 1 || step > 9) {
      return c.json({ error: 'Invalid step number' }, 400);
    }

    const projektauftrag = await updateProjektauftragStep(projektId, step, data);

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    // Validate the step
    const validation = validateStep(projektauftrag, step);
    const completeness = calculateCompleteness(projektauftrag);

    return c.json({ projektauftrag, validation, completeness });
  } catch (error) {
    console.error('Error updating step:', error);
    return c.json({ error: 'Failed to update step' }, 500);
  }
});

/**
 * DELETE /api/apps/projektmanagement/projektauftraege/:id
 * Delete a Projektauftrag
 */
projektmanagement.delete('/projektauftraege/:id', async (c) => {
  try {
    const projektId = c.req.param('id');
    const deleted = await removeProjektauftrag(projektId);

    if (!deleted) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting Projektauftrag:', error);
    return c.json({ error: 'Failed to delete Projektauftrag' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/projektauftraege/:id/validate/:step
 * Validate a specific step
 */
projektmanagement.post('/projektauftraege/:id/validate/:step', async (c) => {
  try {
    const projektId = c.req.param('id');
    const step = parseInt(c.req.param('step'), 10);

    const projektauftrag = await getProjektauftragDetails(projektId);

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    const validation = validateStep(projektauftrag, step);
    return c.json({ validation });
  } catch (error) {
    console.error('Error validating step:', error);
    return c.json({ error: 'Failed to validate step' }, 500);
  }
});

// ============== Search ==============

/**
 * GET /api/apps/projektmanagement/search
 * Search Projektauftraege
 */
projektmanagement.get('/search', async (c) => {
  try {
    const query = c.req.query('q');

    if (!query) {
      return c.json({ error: 'Missing search query' }, 400);
    }

    const results = await searchProjektauftraege(query);
    return c.json({ projektauftraege: results });
  } catch (error) {
    console.error('Error searching:', error);
    return c.json({ error: 'Failed to search' }, 500);
  }
});

// ============== Vorlagen Endpoints ==============

/**
 * GET /api/apps/projektmanagement/vorlagen
 * List all available Vorlagen
 */
projektmanagement.get('/vorlagen', async (c) => {
  try {
    const vorlagen = await listVorlagen();
    return c.json({ vorlagen });
  } catch (error) {
    console.error('Error listing Vorlagen:', error);
    return c.json({ error: 'Failed to list Vorlagen' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/vorlagen/:id
 * Get specific Vorlage
 */
projektmanagement.get('/vorlagen/:id', async (c) => {
  try {
    const vorlageId = c.req.param('id');
    const vorlage = await getVorlageDetails(vorlageId);

    if (!vorlage) {
      return c.json({ error: 'Vorlage not found' }, 404);
    }

    return c.json({ vorlage });
  } catch (error) {
    console.error('Error getting Vorlage:', error);
    return c.json({ error: 'Failed to get Vorlage' }, 500);
  }
});

// ============== KI-Analyse Endpoints ==============

/**
 * POST /api/apps/projektmanagement/analyse/step/:stepNumber
 * Analyze a specific step using LLM against Masterclass criteria
 */
projektmanagement.post('/analyse/step/:stepNumber', async (c) => {
  try {
    const stepNumber = parseInt(c.req.param('stepNumber'), 10);

    // Validate step number
    if (isNaN(stepNumber) || stepNumber < 2 || stepNumber > 7) {
      return c.json(
        { error: 'Analyse nur für Schritte 2-7 verfügbar' },
        400
      );
    }

    const { projektauftrag } = await c.req.json();

    if (!projektauftrag) {
      return c.json(
        { error: 'projektauftrag ist erforderlich' },
        400
      );
    }

    // Check if there's enough data to analyze
    if (!hasEnoughDataForAnalysis(stepNumber, projektauftrag)) {
      return c.json(
        { error: 'Nicht genügend Daten für Analyse vorhanden. Bitte füllen Sie zuerst die Felder aus.' },
        400
      );
    }

    // Get userId from auth context (or default)
    const userId = 'user_default'; // In real app would come from auth

    // Perform analysis
    const analysis = await analyzeStep(stepNumber, projektauftrag, userId);

    return c.json({ analysis });
  } catch (error) {
    console.error('Error analyzing step:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Analyse fehlgeschlagen' },
      500
    );
  }
});

/**
 * POST /api/apps/projektmanagement/analyse/gesamt
 * Generate overall project assessment (Gesamtbewertung)
 */
projektmanagement.post('/analyse/gesamt', async (c) => {
  try {
    const { projektauftrag, stepAnalyses } = await c.req.json();

    if (!projektauftrag) {
      return c.json(
        { error: 'projektauftrag ist erforderlich' },
        400
      );
    }

    // Check if project has minimum data for overall assessment
    const hasMinimumData = projektauftrag.name &&
      (projektauftrag.goals || projektauftrag.scope || (projektauftrag.tasks && projektauftrag.tasks.length > 0));

    if (!hasMinimumData) {
      return c.json(
        { error: 'Nicht genügend Projektdaten für Gesamtbewertung. Bitte füllen Sie mindestens Ziele, Umfang oder Aufgaben aus.' },
        400
      );
    }

    // Get userId from auth context (or default)
    const userId = 'user_default'; // In real app would come from auth

    // Perform overall assessment
    const gesamtbewertung = await analyzeGesamt(projektauftrag, stepAnalyses, userId);

    return c.json({ gesamtbewertung });
  } catch (error) {
    console.error('Error generating Gesamtbewertung:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Gesamtbewertung fehlgeschlagen' },
      500
    );
  }
});

// ============== Knowledge Endpoints ==============

/**
 * GET /api/apps/projektmanagement/knowledge
 * List all available PM Masterclass knowledge
 */
projektmanagement.get('/knowledge', async (c) => {
  try {
    const knowledge = await getAllKnowledge();

    // Return summary of each step's knowledge
    const summaries = knowledge.map((k) => ({
      step: k.meta.step,
      title: k.meta.title,
      description: k.meta.description,
      hasPruefkriterien: !!k.pruefkriterien,
      hasTypischeFehler: !!k.typische_fehler,
      hasVerbesserungsvorschlaege: !!k.verbesserungsvorschlaege,
    }));

    return c.json({ knowledge: summaries });
  } catch (error) {
    console.error('Error listing knowledge:', error);
    return c.json({ error: 'Failed to list knowledge' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step
 * Get complete knowledge for a specific step
 */
projektmanagement.get('/knowledge/:step', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const knowledge = await getStepKnowledge(step);

    if (!knowledge) {
      return c.json({ error: 'Knowledge not found for step' }, 404);
    }

    return c.json({ knowledge });
  } catch (error) {
    console.error('Error getting knowledge:', error);
    return c.json({ error: 'Failed to get knowledge' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/pruefkriterien
 * Get Prüfkriterien (validation criteria) for a step
 */
projektmanagement.get('/knowledge/:step/pruefkriterien', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const pruefkriterien = await getPruefkriterien(step);

    if (!pruefkriterien) {
      return c.json({ error: 'Prüfkriterien not found for step' }, 404);
    }

    return c.json({ pruefkriterien });
  } catch (error) {
    console.error('Error getting Prüfkriterien:', error);
    return c.json({ error: 'Failed to get Prüfkriterien' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/fehler
 * Get typical errors for a step
 */
projektmanagement.get('/knowledge/:step/fehler', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const fehler = await getTypischeFehler(step);

    if (!fehler) {
      return c.json({ error: 'Typische Fehler not found for step' }, 404);
    }

    return c.json({ typische_fehler: fehler });
  } catch (error) {
    console.error('Error getting typische Fehler:', error);
    return c.json({ error: 'Failed to get typische Fehler' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/verbesserungen
 * Get improvement suggestions for a step
 */
projektmanagement.get('/knowledge/:step/verbesserungen', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const verbesserungen = await getVerbesserungsvorschlaege(step);

    if (!verbesserungen) {
      return c.json({ error: 'Verbesserungsvorschläge not found for step' }, 404);
    }

    return c.json({ verbesserungsvorschlaege: verbesserungen });
  } catch (error) {
    console.error('Error getting Verbesserungsvorschläge:', error);
    return c.json({ error: 'Failed to get Verbesserungsvorschläge' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/prompt
 * Get generated analysis prompt for LLM analysis
 */
projektmanagement.get('/knowledge/:step/prompt', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const prompt = await generateAnalysisPrompt(step);

    if (!prompt) {
      return c.json({ error: 'Could not generate prompt for step' }, 404);
    }

    return c.json({ prompt });
  } catch (error) {
    console.error('Error generating prompt:', error);
    return c.json({ error: 'Failed to generate prompt' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/knowledge/:step/raw
 * Get raw YAML content for editing
 */
projektmanagement.get('/knowledge/:step/raw', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const yaml = await getRawStepKnowledge(step);

    if (!yaml) {
      return c.json({ error: 'Knowledge not found for step' }, 404);
    }

    return c.json({ step, yaml });
  } catch (error) {
    console.error('Error getting raw knowledge:', error);
    return c.json({ error: 'Failed to get raw knowledge' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/knowledge/:step
 * Update knowledge for a step (accepts JSON object, serializes to YAML)
 */
projektmanagement.put('/knowledge/:step', async (c) => {
  try {
    const step = parseInt(c.req.param('step'), 10);

    if (isNaN(step) || step < 1 || step > 7) {
      return c.json({ error: 'Invalid step number (1-7)' }, 400);
    }

    const body = await c.req.json();
    const { knowledge: knowledgeData } = body;

    if (!knowledgeData || typeof knowledgeData !== 'object') {
      return c.json({ error: 'Missing or invalid knowledge field' }, 400);
    }

    await saveStepKnowledgeJson(step, knowledgeData);

    // Return the saved knowledge to confirm
    const knowledge = await getStepKnowledge(step);
    return c.json({ knowledge });
  } catch (error: any) {
    console.error('Error saving knowledge:', error);
    return c.json({ error: 'Failed to save knowledge' }, 500);
  }
});

// ============== Export Endpoints ==============

/**
 * GET /api/apps/projektmanagement/projektauftraege/:id/export/:format
 * Export Projektauftrag in specified format
 * Supported formats: json, csv, xlsx, pdf, docx
 */
projektmanagement.get('/projektauftraege/:id/export/:format', async (c) => {
  try {
    const projektId = c.req.param('id');
    const format = c.req.param('format');

    const projektauftrag = await getProjektauftragDetails(projektId);

    if (!projektauftrag) {
      return c.json({ error: 'Projektauftrag not found' }, 404);
    }

    const filename = sanitizeFilename(projektauftrag.name || 'projektauftrag');

    switch (format) {
      case 'json':
        return c.json(projektauftrag, 200, {
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        });

      case 'csv':
        // Simple CSV export for tasks/milestones
        const csvContent = generateCSV(projektauftrag);
        return new Response(csvContent, {
          headers: {
            'Content-Type': 'text/csv; charset=utf-8',
            'Content-Disposition': `attachment; filename="${filename}.csv"`,
          },
        });

      case 'xlsx':
      case 'pdf':
      case 'docx': {
        // Document export using documentGenerator service
        const documentData = mapProjektauftragToDocument(projektauftrag);
        const buffer = await generateDocument(documentData, format as DocumentFormat);
        const mimeType = getMimeType(format as DocumentFormat);
        const extension = getFileExtension(format as DocumentFormat);

        return new Response(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
            'Content-Length': buffer.length.toString(),
          },
        });
      }

      default:
        return c.json({ error: 'Unsupported format. Use json, csv, xlsx, pdf, or docx.' }, 400);
    }
  } catch (error) {
    console.error('Error exporting:', error);
    return c.json({ error: 'Failed to export' }, 500);
  }
});

// ============== Statusbericht Endpoints ==============

/**
 * GET /api/apps/projektmanagement/statusberichte/dashboard
 * Dashboard: All active projects with their latest Ampel
 */
projektmanagement.get('/statusberichte/dashboard', async (c) => {
  try {
    const entries = await getDashboard();
    return c.json({ dashboard: entries });
  } catch (error) {
    console.error('Error getting dashboard:', error);
    return c.json({ error: 'Failed to get dashboard' }, 500);
  }
});

/**
 * POST /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte
 * Create a new Statusbericht
 */
projektmanagement.post('/projektauftraege/:projektId/statusberichte', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const userId = 'user_default';
    const sb = await createSB(projektId, userId);
    return c.json({ statusbericht: sb }, 201);
  } catch (error) {
    console.error('Error creating Statusbericht:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to create Statusbericht' },
      500
    );
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte
 * List all Statusberichte for a Projekt
 */
projektmanagement.get('/projektauftraege/:projektId/statusberichte', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const berichte = await listStatusberichte(projektId);
    return c.json({ statusberichte: berichte });
  } catch (error) {
    console.error('Error listing Statusberichte:', error);
    return c.json({ error: 'Failed to list Statusberichte' }, 500);
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId
 * Get single Statusbericht
 */
projektmanagement.get('/projektauftraege/:projektId/statusberichte/:sbId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const sb = await getStatusberichtDetails(projektId, sbId);
    if (!sb) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }
    return c.json({ statusbericht: sb });
  } catch (error) {
    console.error('Error getting Statusbericht:', error);
    return c.json({ error: 'Failed to get Statusbericht' }, 500);
  }
});

/**
 * PUT /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId
 * Update Statusbericht
 */
projektmanagement.put('/projektauftraege/:projektId/statusberichte/:sbId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const updates = await c.req.json();
    const sb = await updateSB(projektId, sbId, updates);
    if (!sb) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }
    return c.json({ statusbericht: sb });
  } catch (error) {
    console.error('Error updating Statusbericht:', error);
    return c.json({ error: 'Failed to update Statusbericht' }, 500);
  }
});

/**
 * DELETE /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId
 * Delete Statusbericht (only draft)
 */
projektmanagement.delete('/projektauftraege/:projektId/statusberichte/:sbId', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const deleted = await removeStatusbericht(projektId, sbId);
    if (!deleted) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting Statusbericht:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to delete Statusbericht' },
      500
    );
  }
});

/**
 * GET /api/apps/projektmanagement/projektauftraege/:projektId/statusberichte/:sbId/export/:format
 * Export Statusbericht in specified format
 * Supported formats: json, xlsx, pdf, docx
 */
projektmanagement.get('/projektauftraege/:projektId/statusberichte/:sbId/export/:format', async (c) => {
  try {
    const projektId = c.req.param('projektId');
    const sbId = c.req.param('sbId');
    const format = c.req.param('format');

    const sb = await getStatusberichtDetails(projektId, sbId);
    if (!sb) {
      return c.json({ error: 'Statusbericht not found' }, 404);
    }

    // Get full Projektauftrag for EVM + Risk Movement calculations
    const projekt = await getProjektauftragDetails(projektId);
    const projektName = projekt?.name || 'Unbekannt';

    const filename = sanitizeFilename(`Statusbericht_${sb.nummer}_${projektName}`);

    switch (format) {
      case 'json':
        return c.json(sb, 200, {
          'Content-Disposition': `attachment; filename="${filename}.json"`,
        });

      case 'xlsx':
      case 'pdf':
      case 'docx': {
        const documentData = mapStatusberichtToDocument(sb, projekt);
        const buffer = await generateDocument(documentData, format as DocumentFormat);
        const mimeType = getMimeType(format as DocumentFormat);
        const extension = getFileExtension(format as DocumentFormat);

        return new Response(buffer, {
          headers: {
            'Content-Type': mimeType,
            'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
            'Content-Length': buffer.length.toString(),
          },
        });
      }

      default:
        return c.json({ error: 'Unsupported format. Use json, xlsx, pdf, or docx.' }, 400);
    }
  } catch (error) {
    console.error('Error exporting Statusbericht:', error);
    return c.json({ error: 'Failed to export Statusbericht' }, 500);
  }
});

// ============== Helper Functions ==============

/**
 * Sanitize filename by removing/replacing invalid characters
 * and encoding for HTTP headers (RFC 5987)
 */
function sanitizeFilename(name: string): string {
  // Replace special characters and spaces
  const sanitized = name
    .replace(/[<>:"/\\|?*]/g, '-')
    .replace(/\s+/g, '_')
    .substring(0, 100);

  // For Content-Disposition, we need to handle non-ASCII characters
  // Use ASCII-safe version for compatibility
  return sanitized
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^\x00-\x7F]/g, '_');  // Replace non-ASCII with underscore
}

function generateCSV(projektauftrag: any): string {
  const lines: string[] = [];

  // Header info
  lines.push('Projektauftrag Export');
  lines.push(`Name,${projektauftrag.name}`);
  lines.push(`Projektleiter,${projektauftrag.projektleiter}`);
  lines.push(`Auftraggeber,${projektauftrag.auftraggeber}`);
  lines.push(`Start,${projektauftrag.start_date}`);
  lines.push(`Ende,${projektauftrag.end_date}`);
  lines.push('');

  // Tasks
  lines.push('Aufgaben');
  lines.push('Name,Verantwortlich,Start,Ende,Aufwand,Status');
  for (const task of projektauftrag.tasks || []) {
    lines.push(`"${task.name}","${task.responsible}",${task.start_date},${task.end_date},${task.effort},${task.status || ''}`);
  }
  lines.push('');

  // Milestones
  lines.push('Meilensteine');
  lines.push('Name,Datum,Beschreibung');
  for (const ms of projektauftrag.milestones || []) {
    lines.push(`"${ms.name}",${ms.date},"${ms.description || ''}"`);
  }
  lines.push('');

  // Budget
  lines.push('Budget');
  lines.push('Position,Anbieter,Betrag');
  for (const item of projektauftrag.budget || []) {
    lines.push(`"${item.item}","${item.provider || ''}",${item.amount}`);
  }

  return lines.join('\n');
}

// ============== Projektidee Endpoints ==============
//
// Eigene Entitaet (siehe idee-service.ts). Alle Routes leben unter
// /api/apps/projektmanagement/projektideen. Auftrag-aus-Idee-Generierung via
// POST /:id/erstelle-auftrag.

projektmanagement.get('/projektideen', async (c) => {
  try {
    const ideen = await listIdeen();
    return c.json({ projektideen: ideen });
  } catch (error) {
    console.error('Error listing Projektideen:', error);
    return c.json({ error: 'Failed to list Projektideen' }, 500);
  }
});

projektmanagement.post('/projektideen', async (c) => {
  try {
    const body = await c.req.json();
    const userId = 'user_default';
    const idee = await createIdee(body, userId);
    return c.json({ projektidee: idee }, 201);
  } catch (error) {
    console.error('Error creating Projektidee:', error);
    return c.json({ error: 'Failed to create Projektidee' }, 500);
  }
});

projektmanagement.get('/projektideen/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const idee = await getIdeeDetails(id);
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektidee: idee });
  } catch (error) {
    console.error('Error getting Projektidee:', error);
    return c.json({ error: 'Failed to get Projektidee' }, 500);
  }
});

projektmanagement.put('/projektideen/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json();
    const idee = await updateIdee(id, body);
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektidee: idee });
  } catch (error) {
    console.error('Error updating Projektidee:', error);
    return c.json({ error: 'Failed to update Projektidee' }, 500);
  }
});

projektmanagement.put('/projektideen/:id/step/:step', async (c) => {
  try {
    const id = c.req.param('id');
    const step = parseInt(c.req.param('step'), 10);
    const body = await c.req.json();
    const idee = await updateIdeeStep(id, step, body);
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektidee: idee });
  } catch (error) {
    console.error('Error updating Projektidee step:', error);
    return c.json({ error: 'Failed to update Projektidee step' }, 500);
  }
});

projektmanagement.delete('/projektideen/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const ok = await removeIdee(id);
    if (!ok) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting Projektidee:', error);
    return c.json({ error: 'Failed to delete Projektidee' }, 500);
  }
});

/**
 * POST /projektideen/:id/erstelle-auftrag
 * Erzeugt einen Projektauftrag aus der Idee mit Vor-Mapping. Idee bleibt erhalten,
 * Auftrag traegt einen Verweis auf die Idee (idee_id).
 */
/**
 * POST /api/apps/projektmanagement/projektideen/import
 * Multi-File-Import fuer Projektideen — gleiche Pipeline wie /projektauftraege/import,
 * aber mit Idee-Profil + idee-spezifischer Persistence.
 */
projektmanagement.post('/projektideen/import', async (c) => {
  try {
    const formData = await c.req.formData();
    const userId = 'user_default';

    const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
    const allowedMimeTypes = new Set([
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'text/plain', 'text/markdown',
    ]);

    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        if (files.length >= 10) {
          return c.json({ error: 'Maximal 10 Dateien erlaubt' }, 400);
        }
        if (value.size > 50 * 1024 * 1024) {
          return c.json({ error: `Datei "${value.name}" ist zu gross (max. 50 MB)` }, 400);
        }
        if (!allowedMimeTypes.has(value.type)) {
          return c.json({ error: `Dateityp "${value.type}" nicht unterstuetzt fuer "${value.name}"` }, 400);
        }
        const arrayBuffer = await value.arrayBuffer();
        files.push({
          buffer: Buffer.from(arrayBuffer),
          filename: value.name,
          mimeType: value.type,
        });
      }
    }

    if (files.length === 0) {
      return c.json({ error: 'Keine Dateien hochgeladen' }, 400);
    }

    console.log(`[PM-Idee-Import] Received ${files.length} files for import`);

    return streamSSE(c, async (stream) => {
      try {
        await importProjektidee(files, userId, async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        });
      } catch (error) {
        console.error('Error importing Projektidee:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: error instanceof Error ? error.message : 'Import fehlgeschlagen' }),
        });
      }
    });
  } catch (error) {
    console.error('Error importing Projektidee:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Import fehlgeschlagen' },
      500
    );
  }
});

projektmanagement.post('/projektideen/:id/erstelle-auftrag', async (c) => {
  try {
    const id = c.req.param('id');
    const userId = 'user_default';
    const auftrag = await createAuftragFromIdee(id, userId);
    if (!auftrag) return c.json({ error: 'Projektidee nicht gefunden' }, 404);
    return c.json({ projektauftrag: auftrag }, 201);
  } catch (error) {
    console.error('Error creating Auftrag from Idee:', error);
    return c.json({ error: 'Failed to create Auftrag from Idee' }, 500);
  }
});

/**
 * GET /projektideen/:id/export/:format
 * Export einer Projektidee in den Formaten md / pdf / docx / json.
 */
projektmanagement.get('/projektideen/:id/export/:format', async (c) => {
  try {
    const id = c.req.param('id');
    const format = c.req.param('format');

    const idee = await getIdeeDetails(id);
    if (!idee) return c.json({ error: 'Projektidee nicht gefunden' }, 404);

    const filename = sanitizeFilename(`Projektidee_${idee.name || 'unbenannt'}`);

    if (format === 'json') {
      return c.json(idee, 200, {
        'Content-Disposition': `attachment; filename="${filename}.json"`,
      });
    }

    if (!['md', 'pdf', 'docx'].includes(format)) {
      return c.json({ error: 'Unsupported format. Use md, pdf, docx, or json.' }, 400);
    }

    const documentData = mapProjektideeToDocument(idee);
    const buffer = await generateDocument(documentData, format as DocumentFormat);
    const mimeType = getMimeType(format as DocumentFormat);
    const extension = getFileExtension(format as DocumentFormat);

    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `attachment; filename="${filename}.${extension}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error exporting Projektidee:', error);
    return c.json({ error: 'Failed to export Projektidee' }, 500);
  }
});

export { projektmanagement as projektmanagementRoutes };
