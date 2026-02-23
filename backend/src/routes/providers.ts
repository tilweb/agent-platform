/**
 * Provider Routes
 * REST API endpoints for managing AI providers and models
 *
 * All routes require authentication, management routes require admin role.
 */

import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import {
  getProviders,
  getProvider,
  createProvider,
  updateProvider,
  deleteProvider,
  addModel,
  updateModel,
  deleteModel,
  getActiveSelection,
  setActiveModel,
  resolveModel,
  isCustomProvidersAllowed,
  resolveApiKey,
  sanitizeProvider,
  findLogoFile,
} from '../services/providers';
import { isModelSyncConfigured, syncAdacorModels } from '../services/modelSync';
import { llmService } from '../services/llm';
import { OpenAIAdapter } from '../services/llm/adapters/openai';
import { OllamaAdapter } from '../services/llm/adapters/ollama';
import { authMiddleware } from '../auth';
import { internalError, validationError, notFoundError, forbiddenError } from '../utils/errorHandler';
import { PROVIDERS_DIR } from '../utils/paths';
import { join } from 'path';
import type {
  CreateProviderRequest,
  UpdateProviderRequest,
  ModelConfig,
  SetActiveModelRequest,
} from '../types/providers';

const providers = new Hono();

// Admin middleware - requires admin role
const adminMiddleware: MiddlewareHandler = async (c, next) => {
  const user = c.get('user');
  if (!user || user.role !== 'admin') {
    return forbiddenError(c, 'Admin-Rechte erforderlich');
  }
  return next();
};

// ============== Logo Endpoint (before auth — <img> tags don't send cookies) ==============

const EXT_TO_CONTENT_TYPE: Record<string, string> = {
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

/**
 * GET /api/providers/:id/logo
 * Serve the provider logo file. No auth required (used by <img> tags).
 */
providers.get('/:id/logo', async (c) => {
  const id = c.req.param('id');

  // Validate ID: only allow safe characters (prevent path traversal)
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) {
    return c.text('Invalid provider ID', 400);
  }

  const logoFilename = await findLogoFile(id);
  if (!logoFilename) {
    return c.text('Logo not found', 404);
  }

  const logoPath = join(PROVIDERS_DIR, id, logoFilename);
  const file = Bun.file(logoPath);
  if (!(await file.exists())) {
    return c.text('Logo not found', 404);
  }

  const ext = logoFilename.substring(logoFilename.lastIndexOf('.'));
  const contentType = EXT_TO_CONTENT_TYPE[ext] || 'application/octet-stream';

  return new Response(file, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// All remaining provider routes require authentication
providers.use('*', authMiddleware);

// ============== Provider Endpoints ==============

/**
 * GET /api/providers
 * List all providers
 * When ALLOW_CUSTOM_PROVIDERS=false, only returns protected providers
 */
providers.get('/', async (c) => {
  try {
    let providerList = await getProviders();

    if (!isCustomProvidersAllowed()) {
      providerList = providerList.filter((p) => p.protected);
    }

    return c.json({ providers: providerList.map(sanitizeProvider) });
  } catch (error) {
    console.error('Error listing providers:', error);
    return internalError(c, error);
  }
});

/**
 * POST /api/providers
 * Create a new provider (admin only)
 * Blocked when ALLOW_CUSTOM_PROVIDERS=false
 */
providers.post('/', adminMiddleware, async (c) => {
  try {
    if (!isCustomProvidersAllowed()) {
      return forbiddenError(c, 'Eigene Provider sind deaktiviert. Nur Adacor-Modelle sind verfügbar.');
    }

    const body = await c.req.json<CreateProviderRequest>();

    if (!body.name || !body.api_mode || !body.base_url) {
      return validationError(c, 'Missing required fields: name, api_mode, base_url');
    }

    if (body.icon_url && body.icon_url.length > 200_000) {
      return validationError(c, 'Logo ist zu groß (max. 200 KB als Data-URI)');
    }

    const provider = await createProvider(body);
    return c.json({ provider: sanitizeProvider(provider) }, 201);
  } catch (error) {
    console.error('Error creating provider:', error);
    return validationError(c, 'Fehler beim Erstellen des Providers');
  }
});

/**
 * GET /api/providers/active
 * Get active model selection for all purposes
 */
providers.get('/active', async (c) => {
  try {
    const active = await getActiveSelection();
    return c.json({ active });
  } catch (error) {
    console.error('Error getting active selection:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/providers/active/:purpose
 * Set active model for a specific purpose (admin only)
 */
providers.put('/active/:purpose', adminMiddleware, async (c) => {
  try {
    const purpose = c.req.param('purpose') as 'chat' | 'vision' | 'tts' | 'stt' | 'text_to_image' | 'image_to_image';

    if (!['chat', 'vision', 'tts', 'stt', 'text_to_image', 'image_to_image'].includes(purpose)) {
      return validationError(c, 'Invalid purpose. Must be one of: chat, vision, tts, stt, text_to_image, image_to_image');
    }

    const body = await c.req.json<SetActiveModelRequest>();

    await setActiveModel(purpose, body.provider_id, body.model_id);

    // Reload LLM service if chat model changed
    if (purpose === 'chat') {
      await llmService.reload();
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error setting active model:', error);
    return validationError(c, 'Fehler beim Setzen des aktiven Modells');
  }
});

/**
 * GET /api/providers/config
 * Get provider configuration flags for the frontend
 */
providers.get('/config', async (c) => {
  return c.json({
    allowCustomProviders: isCustomProvidersAllowed(),
    modelSyncConfigured: isModelSyncConfigured(),
  });
});

/**
 * POST /api/providers/adacor/sync
 * Trigger manual model sync from Adacor AI API (admin only)
 */
providers.post('/adacor/sync', adminMiddleware, async (c) => {
  try {
    if (!isModelSyncConfigured()) {
      return validationError(c, 'Modell-Synchronisierung ist nicht konfiguriert (ADACOR_AI_API_BASE + ADACOR_AI_MODELS_PATH fehlt)');
    }

    const result = await syncAdacorModels();
    return c.json({ result });
  } catch (error) {
    console.error('Error syncing Adacor models:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/providers/:id
 * Get a specific provider
 */
providers.get('/:id', async (c) => {
  try {
    const id = c.req.param('id');
    const provider = await getProvider(id);

    if (!provider) {
      return notFoundError(c, 'Provider');
    }

    return c.json({ provider: sanitizeProvider(provider) });
  } catch (error) {
    console.error('Error getting provider:', error);
    return internalError(c, error);
  }
});

/**
 * PUT /api/providers/:id
 * Update a provider (admin only)
 */
providers.put('/:id', adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    const body = await c.req.json<UpdateProviderRequest>();

    if (body.icon_url && body.icon_url.length > 200_000) {
      return validationError(c, 'Logo ist zu groß (max. 200 KB als Data-URI)');
    }

    const provider = await updateProvider(id, body);

    // Reload LLM service to pick up changes
    await llmService.reload();

    return c.json({ provider: sanitizeProvider(provider) });
  } catch (error) {
    console.error('Error updating provider:', error);
    return validationError(c, 'Fehler beim Aktualisieren des Providers');
  }
});

/**
 * DELETE /api/providers/:id
 * Delete a provider (admin only)
 */
providers.delete('/:id', adminMiddleware, async (c) => {
  try {
    const id = c.req.param('id');
    await deleteProvider(id);

    // Reload LLM service in case the deleted provider was active
    await llmService.reload();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting provider:', error);
    return validationError(c, 'Fehler beim Löschen des Providers');
  }
});

// ============== Model Endpoints ==============

/**
 * POST /api/providers/:id/models
 * Add a model to a provider (admin only)
 * - Adacor: always blocked (sync-only)
 * - Other providers: blocked when ALLOW_CUSTOM_PROVIDERS=false
 */
providers.post('/:id/models', adminMiddleware, async (c) => {
  try {
    const providerId = c.req.param('id');

    // Adacor models are managed exclusively via sync
    if (providerId === 'adacor') {
      return forbiddenError(c, 'Adacor-Modelle werden ausschließlich über die Modell-Synchronisierung verwaltet');
    }

    if (!isCustomProvidersAllowed()) {
      return forbiddenError(c, 'Eigene Provider sind deaktiviert. Nur Adacor-Modelle sind verfügbar.');
    }

    const body = await c.req.json<ModelConfig>();

    if (!body.id || !body.name || !body.type || !body.capabilities) {
      return validationError(c, 'Missing required fields: id, name, type, capabilities');
    }

    const model = await addModel(providerId, body);
    return c.json({ model }, 201);
  } catch (error) {
    console.error('Error adding model:', error);
    return validationError(c, 'Fehler beim Hinzufügen des Modells');
  }
});

/**
 * PUT /api/providers/:id/models/:modelId
 * Update a model (admin only)
 * Rejects manual re-enabling of sync-deactivated models
 */
providers.put('/:id/models/:modelId', adminMiddleware, async (c) => {
  try {
    const providerId = c.req.param('id');
    const modelId = c.req.param('modelId');
    const body = await c.req.json<Partial<ModelConfig>>();

    // enabled is validated in the service layer (sync-protection for feature_set models)
    const model = await updateModel(providerId, modelId, body);
    return c.json({ model });
  } catch (error) {
    console.error('Error updating model:', error);
    return validationError(c, error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Modells');
  }
});

/**
 * DELETE /api/providers/:id/models/:modelId
 * Delete a model (admin only)
 */
providers.delete('/:id/models/:modelId', adminMiddleware, async (c) => {
  try {
    const providerId = c.req.param('id');
    const modelId = c.req.param('modelId');

    await deleteModel(providerId, modelId);

    // Reload LLM service in case the deleted model was active
    await llmService.reload();

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting model:', error);
    return validationError(c, 'Fehler beim Löschen des Modells');
  }
});

// ============== Test Endpoint ==============

/**
 * POST /api/providers/:id/test
 * Test connection to a provider
 */
providers.post('/:id/test', async (c) => {
  try {
    const id = c.req.param('id');
    const provider = await getProvider(id);

    if (!provider) {
      return notFoundError(c, 'Provider');
    }

    // Resolve API key (encrypted or env var)
    const apiKey = await resolveApiKey(provider);

    // Get a default model for testing
    const defaultModel = provider.models.find((m) => m.default) || provider.models[0];
    if (!defaultModel) {
      return validationError(c, 'Provider hat keine Modelle konfiguriert');
    }
    const modelId = defaultModel.id;

    let result;

    if (provider.api_mode === 'openai') {
      const adapter = new OpenAIAdapter({
        baseUrl: provider.base_url,
        apiKey,
        defaultModel: modelId,
      });
      result = await adapter.testConnection();
    } else if (provider.api_mode === 'ollama') {
      const adapter = new OllamaAdapter({
        baseUrl: provider.base_url,
        defaultModel: modelId,
      });
      result = await adapter.testConnection();
    } else {
      return validationError(c, `Unknown API mode: ${provider.api_mode}`);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error testing provider:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/providers/:id/models/available
 * List available models from the provider's API
 */
providers.get('/:id/models/available', async (c) => {
  try {
    const id = c.req.param('id');
    const provider = await getProvider(id);

    if (!provider) {
      return notFoundError(c, 'Provider');
    }

    // Resolve API key (encrypted or env var)
    const apiKey = await resolveApiKey(provider);

    let models: string[] = [];

    if (provider.api_mode === 'openai') {
      const adapter = new OpenAIAdapter({
        baseUrl: provider.base_url,
        apiKey,
      });
      models = await adapter.listModels();
    } else if (provider.api_mode === 'ollama') {
      const adapter = new OllamaAdapter({
        baseUrl: provider.base_url,
      });
      models = await adapter.listModels();
    }

    return c.json({ models });
  } catch (error) {
    console.error('Error listing available models:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/providers/current
 * Get the currently active chat model info
 */
providers.get('/current/info', async (c) => {
  try {
    const current = llmService.getCurrentModel();
    return c.json({ current });
  } catch (error) {
    console.error('Error getting current model:', error);
    return internalError(c, error);
  }
});

export default providers;
