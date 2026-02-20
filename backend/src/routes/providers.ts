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
} from '../services/providers';
import { isModelSyncConfigured, syncAdacorModels } from '../services/modelSync';
import { llmService } from '../services/llm';
import { OpenAIAdapter } from '../services/llm/adapters/openai';
import { OllamaAdapter } from '../services/llm/adapters/ollama';
import { authMiddleware } from '../auth';
import { internalError } from '../utils/errorHandler';
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
    return c.json({ error: 'Admin-Rechte erforderlich' }, 403);
  }
  return next();
};

// All provider routes require authentication
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

    return c.json({ providers: providerList });
  } catch (error) {
    console.error('Error listing providers:', error);
    return c.json(
      { error: 'Failed to list providers' },
      500
    );
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
      return c.json(
        { error: 'Eigene Provider sind deaktiviert. Nur Adacor-Modelle sind verfügbar.' },
        403
      );
    }

    const body = await c.req.json<CreateProviderRequest>();

    if (!body.name || !body.api_mode || !body.base_url) {
      return c.json(
        { error: 'Missing required fields: name, api_mode, base_url' },
        400
      );
    }

    const provider = await createProvider(body);
    return c.json({ provider }, 201);
  } catch (error) {
    console.error('Error creating provider:', error);
    return c.json(
      { error: 'Fehler beim Erstellen des Providers' },
      400
    );
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
    return c.json(
      { error: 'Failed to get active selection' },
      500
    );
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
      return c.json(
        { error: 'Invalid purpose. Must be one of: chat, vision, tts, stt, text_to_image, image_to_image' },
        400
      );
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
    return c.json(
      { error: 'Fehler beim Setzen des aktiven Modells' },
      400
    );
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
      return c.json(
        { error: 'Modell-Synchronisierung ist nicht konfiguriert (ADACOR_AI_API_BASE + ADACOR_AI_MODELS_PATH fehlt)' },
        400
      );
    }

    const result = await syncAdacorModels();
    return c.json({ result });
  } catch (error) {
    console.error('Error syncing Adacor models:', error);
    return c.json(
      { error: 'Fehler bei der Modell-Synchronisierung' },
      500
    );
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
      return c.json({ error: 'Provider not found' }, 404);
    }

    return c.json({ provider });
  } catch (error) {
    console.error('Error getting provider:', error);
    return c.json(
      { error: 'Failed to get provider' },
      500
    );
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

    const provider = await updateProvider(id, body);

    // Reload LLM service to pick up changes
    await llmService.reload();

    return c.json({ provider });
  } catch (error) {
    console.error('Error updating provider:', error);
    return c.json(
      { error: 'Fehler beim Aktualisieren des Providers' },
      400
    );
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
    return c.json(
      { error: 'Fehler beim Löschen des Providers' },
      400
    );
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
      return c.json(
        { error: 'Adacor-Modelle werden ausschließlich über die Modell-Synchronisierung verwaltet' },
        403
      );
    }

    if (!isCustomProvidersAllowed()) {
      return c.json(
        { error: 'Eigene Provider sind deaktiviert. Nur Adacor-Modelle sind verfügbar.' },
        403
      );
    }

    const body = await c.req.json<ModelConfig>();

    if (!body.id || !body.name || !body.type || !body.capabilities) {
      return c.json(
        { error: 'Missing required fields: id, name, type, capabilities' },
        400
      );
    }

    const model = await addModel(providerId, body);
    return c.json({ model }, 201);
  } catch (error) {
    console.error('Error adding model:', error);
    return c.json(
      { error: 'Fehler beim Hinzufügen des Modells' },
      400
    );
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

    // Strip enabled from updates — controlled exclusively by sync
    delete body.enabled;

    const model = await updateModel(providerId, modelId, body);
    return c.json({ model });
  } catch (error) {
    console.error('Error updating model:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Fehler beim Aktualisieren des Modells' },
      400
    );
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
    return c.json(
      { error: 'Fehler beim Löschen des Modells' },
      400
    );
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
      return c.json({ error: 'Provider not found' }, 404);
    }

    // Get API key from environment
    let apiKey: string | null = null;
    if (provider.api_key_env) {
      apiKey = process.env[provider.api_key_env] || null;
    }

    // Get a default model for testing
    const defaultModel = provider.models.find((m) => m.default) || provider.models[0];
    if (!defaultModel) {
      return c.json({ error: 'Provider hat keine Modelle konfiguriert' }, 400);
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
      return c.json(
        { error: `Unknown API mode: ${provider.api_mode}` },
        400
      );
    }

    return c.json(result);
  } catch (error) {
    console.error('Error testing provider:', error);
    return c.json({ error: 'Provider-Test fehlgeschlagen' }, 500);
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
      return c.json({ error: 'Provider not found' }, 404);
    }

    // Get API key from environment
    let apiKey: string | null = null;
    if (provider.api_key_env) {
      apiKey = process.env[provider.api_key_env] || null;
    }

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
    return c.json(
      { error: 'Failed to list available models' },
      500
    );
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
    return c.json(
      { error: 'Failed to get current model info' },
      500
    );
  }
});

export default providers;
