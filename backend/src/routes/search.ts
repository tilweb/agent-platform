/**
 * Search Routes
 * REST API for unified search across all sources
 */

import { Hono } from 'hono';
import { internalError } from '../utils/errorHandler';
import { unifiedSearch, smartKnowledgeSearch, smartContractSearch } from '../services/searchService';
import { searchChatHistoriesWithScoring } from '../services/memory';
import { smartChatSearch } from '../services/smartChatSearch';
import { optionalAuthMiddleware } from '../auth/middleware';
import { connectionRegistry } from '../connections/registry';

export const searchRoutes = new Hono();

// Apply optional auth middleware to all routes
searchRoutes.use('*', optionalAuthMiddleware);

/**
 * GET /api/search
 * Unified search across chats, knowledge base, Confluence, and Google Drive
 *
 * Query params:
 * - q: Search query (required, min 2 chars)
 * - sources: Comma-separated list of sources (optional, defaults to all)
 */
searchRoutes.get('/', async (c) => {
  try {
    const query = c.req.query('q');
    const sourcesParam = c.req.query('sources');

    // Get userId from auth middleware
    const userId = c.get('userId');

    // Validate query
    if (!query || query.length < 2) {
      return c.json({ error: 'Query must be at least 2 characters' }, 400);
    }

    // Parse sources
    const validSources = ['chats', 'knowledge', 'confluence', 'gdrive', 'contracts'];
    let sources = validSources;

    if (sourcesParam) {
      const requested = sourcesParam.split(',').map(s => s.trim().toLowerCase());
      sources = requested.filter(s => validSources.includes(s));

      if (sources.length === 0) {
        return c.json({ error: `Invalid sources. Valid options: ${validSources.join(', ')}` }, 400);
      }
    }

    // Perform search
    const results = await unifiedSearch(query, userId, sources);

    return c.json(results);
  } catch (error) {
    console.error('Search error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/search/sources
 * List available search sources and their connection status
 */
searchRoutes.get('/sources', async (c) => {
  try {
    const { toolRegistry } = await import('../tools/registry');
    const { loadRegistry } = await import('../apps/registry');
    const userId = c.get('userId');

    // Check connection status for external sources
    let confluenceConnected = false;
    let gdriveConnected = false;

    if (userId) {
      // Check Confluence connection
      const confluenceTokens = await connectionRegistry.getTokens(userId, 'confluence');
      confluenceConnected = !!confluenceTokens;

      // Check Google Drive connection
      const gdriveTokens = await connectionRegistry.getTokens(userId, 'google-drive');
      gdriveConnected = !!gdriveTokens;
    }

    // Check if Vertragsmanagement app is enabled
    const registry = await loadRegistry();
    const vertragsmanagementApp = registry.apps?.vertragsmanagement;
    const contractsEnabled = vertragsmanagementApp?.enabled ?? false;

    const sources = [
      {
        id: 'chats',
        name: 'Chats',
        description: 'Chat-Verlauf durchsuchen',
        available: true,
        connected: true, // Always available
        color: '#14b8a6',
      },
      {
        id: 'knowledge',
        name: 'Knowledge Base',
        description: 'Indexierte Dokumente durchsuchen',
        available: true,
        connected: true, // Always available
        color: '#f97316',
      },
      {
        id: 'confluence',
        name: 'Confluence',
        description: 'Confluence-Seiten durchsuchen',
        available: toolRegistry.has('confluence_search'),
        connected: confluenceConnected,
        requiresConnection: true,
        color: '#0052CC',
      },
      {
        id: 'gdrive',
        name: 'Google Drive',
        description: 'Google Drive-Dateien durchsuchen',
        available: toolRegistry.has('gdrive_search'),
        connected: gdriveConnected,
        requiresConnection: true,
        color: '#4285F4',
      },
      {
        id: 'contracts',
        name: 'Verträge',
        description: 'Vertragsmanagement durchsuchen',
        available: contractsEnabled,
        connected: contractsEnabled, // Available when app is enabled
        requiresApp: 'vertragsmanagement',
        color: '#8b5cf6',
      },
    ];

    return c.json({ sources });
  } catch (error) {
    console.error('Error listing search sources:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/search/smart
 * Intelligent search using LLM to find relevant knowledge base documents
 * Understands synonyms, context, and multilingual queries
 *
 * Query params:
 * - q: Search query (required, min 2 chars)
 */
searchRoutes.get('/smart', async (c) => {
  try {
    const query = c.req.query('q');

    // Validate query
    if (!query || query.length < 2) {
      return c.json({ error: 'Query must be at least 2 characters' }, 400);
    }

    // Perform smart search
    const results = await smartKnowledgeSearch(query);

    return c.json(results);
  } catch (error) {
    console.error('Smart search error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/search/contracts/smart
 * Intelligent contract search using LLM
 * Understands contract terms, parties, and context
 *
 * Query params:
 * - q: Search query (required, min 2 chars)
 */
searchRoutes.get('/contracts/smart', async (c) => {
  try {
    const query = c.req.query('q');

    // Validate query
    if (!query || query.length < 2) {
      return c.json({ error: 'Query must be at least 2 characters' }, 400);
    }

    // Perform smart contract search
    const results = await smartContractSearch(query);

    return c.json(results);
  } catch (error) {
    console.error('Smart contract search error:', error);
    return internalError(c, error);
  }
});

/**
 * GET /api/search/chats/smart
 * Two-stage intelligent chat search:
 * Stage 1: Fast substring/keyword search with scoring
 * Stage 2: LLM-based re-ranking of top candidates
 *
 * Query params:
 * - q: Search query (required, min 2 chars)
 */
searchRoutes.get('/chats/smart', async (c) => {
  try {
    const query = c.req.query('q');

    // Validate query
    if (!query || query.length < 2) {
      return c.json({ error: 'Query must be at least 2 characters' }, 400);
    }

    // Stage 1: Fast search with scoring
    const fastResults = await searchChatHistoriesWithScoring({
      query,
      limit: 50,
      includeMessages: true,
    });

    // Add type to all results
    const resultsWithType = fastResults.map(r => ({ ...r, type: 'chat' as const }));

    // Stage 2: Smart re-ranking (only if we have enough results)
    if (fastResults.length >= 3) {
      const smartResponse = await smartChatSearch(query, fastResults);
      // Add type to smart results too
      return c.json({
        ...smartResponse,
        results: smartResponse.results.map(r => ({ ...r, type: 'chat' as const })),
      });
    }

    // Not enough results for smart search
    return c.json({
      results: resultsWithType,
      isSmartRanked: false,
    });
  } catch (error) {
    console.error('Smart chat search error:', error);
    return internalError(c, error);
  }
});
