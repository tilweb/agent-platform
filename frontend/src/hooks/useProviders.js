import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiPut, apiDelete, API_URL } from '../utils/apiFetch';

export function useProviders() {
  const [providers, setProviders] = useState([]);
  const [activeSelection, setActiveSelection] = useState({
    chat: { provider_id: null, model_id: null },
    vision: { provider_id: null, model_id: null },
    tts: { provider_id: null, model_id: null },
    stt: { provider_id: null, model_id: null },
    text_to_image: { provider_id: null, model_id: null },
    image_to_image: { provider_id: null, model_id: null },
  });
  const [allowCustomProviders, setAllowCustomProviders] = useState(true);
  const [modelSyncConfigured, setModelSyncConfigured] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch providers, active selection, and config
  // silent=true skips the loading state to avoid scroll jumps on background refreshes
  const fetchProviders = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);

      const [providersRes, activeRes, configRes] = await Promise.all([
        apiGet('/providers'),
        apiGet('/providers/active'),
        apiGet('/providers/config'),
      ]);

      if (!providersRes.ok) {
        throw new Error('Failed to fetch providers');
      }

      const providersData = await providersRes.json();
      setProviders(providersData.providers || []);

      if (activeRes.ok) {
        const activeData = await activeRes.json();
        setActiveSelection(activeData.active || {
          chat: { provider_id: null, model_id: null },
          vision: { provider_id: null, model_id: null },
          tts: { provider_id: null, model_id: null },
          stt: { provider_id: null, model_id: null },
          text_to_image: { provider_id: null, model_id: null },
          image_to_image: { provider_id: null, model_id: null },
        });
      }

      if (configRes.ok) {
        const configData = await configRes.json();
        setAllowCustomProviders(configData.allowCustomProviders !== false);
        setModelSyncConfigured(configData.modelSyncConfigured === true);
      }
    } catch (err) {
      console.error('Error fetching providers:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Create a new provider
  const createProvider = useCallback(async (providerData) => {
    const response = await apiPost('/providers', providerData);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to create provider');
    }

    const data = await response.json();
    setProviders((prev) => [...prev, data.provider]);
    return data.provider;
  }, []);

  // Update a provider
  const updateProvider = useCallback(async (id, updates) => {
    const response = await apiPut(`/providers/${id}`, updates);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update provider');
    }

    const data = await response.json();
    setProviders((prev) =>
      prev.map((p) => (p.id === id ? data.provider : p))
    );
    return data.provider;
  }, []);

  // Delete a provider
  const deleteProvider = useCallback(async (id) => {
    const response = await apiDelete(`/providers/${id}`);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete provider');
    }

    setProviders((prev) => prev.filter((p) => p.id !== id));
  }, []);

  // Add a model to a provider
  const addModel = useCallback(async (providerId, modelData) => {
    const response = await apiPost(`/providers/${providerId}/models`, modelData);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to add model');
    }

    const data = await response.json();
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? { ...p, models: [...p.models, data.model] }
          : p
      )
    );
    return data.model;
  }, []);

  // Update a model
  const updateModel = useCallback(async (providerId, modelId, updates) => {
    const response = await apiPut(
      `/providers/${providerId}/models/${encodeURIComponent(modelId)}`,
      updates
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to update model');
    }

    const data = await response.json();
    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? {
              ...p,
              models: p.models.map((m) => {
                if (m.id === modelId) return data.model;
                // Clear default on other models when a new default is set
                if (data.model.default && m.default) return { ...m, default: false };
                return m;
              }),
            }
          : p
      )
    );
    return data.model;
  }, []);

  // Delete a model
  const deleteModel = useCallback(async (providerId, modelId) => {
    const response = await apiDelete(
      `/providers/${providerId}/models/${encodeURIComponent(modelId)}`
    );

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to delete model');
    }

    setProviders((prev) =>
      prev.map((p) =>
        p.id === providerId
          ? { ...p, models: p.models.filter((m) => m.id !== modelId) }
          : p
      )
    );
  }, []);

  // Set active model for a purpose
  const setActiveModel = useCallback(async (purpose, providerId, modelId) => {
    const response = await apiPut(`/providers/active/${purpose}`, {
      provider_id: providerId,
      model_id: modelId,
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to set active model');
    }

    setActiveSelection((prev) => ({
      ...prev,
      [purpose]: { provider_id: providerId, model_id: modelId },
    }));
  }, []);

  // Test provider connection
  const testConnection = useCallback(async (providerId) => {
    const response = await apiPost(`/providers/${providerId}/test`, {});

    const data = await response.json();
    return data;
  }, []);

  // Get available models from provider API
  const getAvailableModels = useCallback(async (providerId) => {
    const response = await apiGet(
      `/providers/${providerId}/models/available`
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.models || [];
  }, []);

  // Bulk-update enabled state for models of a provider (optionally filtered by modelIds)
  const bulkUpdateModels = useCallback(async (providerId, { enabled, modelIds }) => {
    const body = { enabled };
    if (modelIds) body.modelIds = modelIds;
    const response = await apiPut(`/providers/${providerId}/models/bulk`, body);

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Bulk-Update fehlgeschlagen');
    }

    const data = await response.json();
    // Silent refresh to avoid scroll jump
    await fetchProviders({ silent: true });
    return data.result;
  }, [fetchProviders]);

  // Sync models from provider API (SSE streaming with step callbacks)
  const syncModels = useCallback(async (providerId, { onStep } = {}) => {
    const url = `${API_URL}/providers/${providerId}/sync`;
    const response = await fetch(url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Synchronisierung fehlgeschlagen');
    }

    // Parse SSE stream from POST response
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let result = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          var currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ') && currentEvent) {
          const dataStr = line.slice(6);
          if (!dataStr || currentEvent === 'heartbeat') { currentEvent = null; continue; }
          let parsed;
          try { parsed = JSON.parse(dataStr); } catch { currentEvent = null; continue; }
          if (currentEvent === 'step' && onStep) {
            onStep(parsed);
          } else if (currentEvent === 'result') {
            result = parsed;
          } else if (currentEvent === 'error') {
            throw new Error(parsed.message || 'Synchronisierung fehlgeschlagen');
          }
          currentEvent = null;
        }
      }
    }

    // Silent refresh to avoid scroll jump
    await fetchProviders({ silent: true });
    return result;
  }, [fetchProviders]);

  // Helper: Get provider by ID
  const getProvider = useCallback(
    (id) => providers.find((p) => p.id === id) || null,
    [providers]
  );

  // Helper: Get enabled providers
  const enabledProviders = providers.filter((p) => p.enabled);

  // Helper: Get models for a purpose (chat, vision, tts, stt)
  // Filters out disabled models (enabled === false)
  const getModelsForPurpose = useCallback(
    (purpose) => {
      const results = [];
      for (const provider of enabledProviders) {
        for (const model of provider.models) {
          if (model.enabled === false) continue;
          let matches = false;
          const caps = Array.isArray(model.capabilities) ? model.capabilities : [];
          if (purpose === 'chat') {
            matches =
              (model.type === 'llm' || model.type === 'vllm') &&
              caps.includes('chat');
          } else if (purpose === 'vision') {
            matches = caps.includes('vision');
          } else if (purpose === 'tts') {
            matches = model.type === 'tts';
          } else if (purpose === 'stt') {
            matches = model.type === 'stt';
          } else if (purpose === 'text_to_image') {
            matches = model.type === 'image_gen' && caps.includes('text_to_image');
          } else if (purpose === 'image_to_image') {
            matches = model.type === 'image_gen' && caps.includes('image_to_image');
          }
          if (matches) {
            results.push({ provider, model });
          }
        }
      }
      return results;
    },
    [enabledProviders]
  );

  // Helper: Get active model info
  const getActiveModelInfo = useCallback(
    (purpose) => {
      const active = activeSelection[purpose];
      if (!active?.provider_id || !active?.model_id) return null;

      const provider = providers.find((p) => p.id === active.provider_id);
      if (!provider) return null;

      const model = provider.models.find((m) => m.id === active.model_id);
      if (!model) return null;

      return { provider, model };
    },
    [activeSelection, providers]
  );

  // Helper: Get extended capabilities for a model
  const getExtendedCapabilities = useCallback((model) => {
    // Use extended_capabilities if available
    if (model.extended_capabilities) {
      return model.extended_capabilities;
    }

    // Derive from basic capabilities
    const caps = model.capabilities || [];
    return {
      tool_use: caps.includes('function_calling'),
      vision: caps.includes('vision'),
      context_window: model.context_length || 4096,
      streaming: true,
      json_mode: false,
      max_output_tokens: model.max_tokens,
    };
  }, []);

  // Helper: Check if a model meets requirements
  const modelMeetsRequirements = useCallback(
    (model, requirements) => {
      const caps = getExtendedCapabilities(model);

      if (requirements.tool_use && !caps.tool_use) {
        return false;
      }
      if (requirements.vision && !caps.vision) {
        return false;
      }
      if (requirements.min_context_window && caps.context_window < requirements.min_context_window) {
        return false;
      }
      if (requirements.streaming && !caps.streaming) {
        return false;
      }

      return true;
    },
    [getExtendedCapabilities]
  );

  // Helper: Get models suitable for an agent based on its tools and capabilities
  const getModelsForAgent = useCallback(
    (agentConfig) => {
      const results = [];

      // Determine requirements based on agent config
      const requirements = {};

      // Agent has tools -> needs tool_use
      if (agentConfig.tools && agentConfig.tools.length > 0) {
        requirements.tool_use = true;
      }

      // Supervisor always needs tool_use
      if (agentConfig.id === 'supervisor') {
        requirements.tool_use = true;
      }

      // Agent needs vision -> check capabilities array
      if (Array.isArray(agentConfig.capabilities) && agentConfig.capabilities.includes('vision')) {
        requirements.vision = true;
      }

      // Filter enabled providers and their models
      for (const provider of enabledProviders) {
        for (const model of provider.models) {
          if (model.enabled === false) continue;
          // Only include chat-capable models (llm/vllm)
          if (model.type !== 'llm' && model.type !== 'vllm') continue;
          const caps = Array.isArray(model.capabilities) ? model.capabilities : [];
          if (!caps.includes('chat')) continue;

          // Check requirements
          if (modelMeetsRequirements(model, requirements)) {
            results.push({ provider, model });
          }
        }
      }

      return results;
    },
    [enabledProviders, modelMeetsRequirements]
  );

  // Helper: Get all tool-capable models
  const getToolCapableModels = useCallback(() => {
    const results = [];

    for (const provider of enabledProviders) {
      for (const model of provider.models) {
        if (model.enabled === false) continue;
        if (model.type !== 'llm' && model.type !== 'vllm') continue;
        const modelCaps = Array.isArray(model.capabilities) ? model.capabilities : [];
        if (!modelCaps.includes('chat')) continue;

        const caps = getExtendedCapabilities(model);
        if (caps.tool_use) {
          results.push({ provider, model });
        }
      }
    }

    return results;
  }, [enabledProviders, getExtendedCapabilities]);

  // Helper: Get all vision-capable models
  const getVisionCapableModels = useCallback(() => {
    const results = [];

    for (const provider of enabledProviders) {
      for (const model of provider.models) {
        if (model.enabled === false) continue;
        if (model.type !== 'llm' && model.type !== 'vllm') continue;

        const caps = getExtendedCapabilities(model);
        if (caps.vision) {
          results.push({ provider, model });
        }
      }
    }

    return results;
  }, [enabledProviders, getExtendedCapabilities]);

  return {
    providers,
    enabledProviders,
    activeSelection,
    allowCustomProviders,
    modelSyncConfigured,
    isLoading,
    error,
    // Actions
    refresh: fetchProviders,
    createProvider,
    updateProvider,
    deleteProvider,
    addModel,
    updateModel,
    deleteModel,
    setActiveModel,
    testConnection,
    getAvailableModels,
    syncModels,
    bulkUpdateModels,
    // Helpers
    getProvider,
    getModelsForPurpose,
    getActiveModelInfo,
    // Capability-based filtering
    getExtendedCapabilities,
    modelMeetsRequirements,
    getModelsForAgent,
    getToolCapableModels,
    getVisionCapableModels,
  };
}
