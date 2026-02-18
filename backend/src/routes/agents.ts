/**
 * Agents Routes
 * REST API endpoints for agent management with RBAC
 */

import { Hono } from 'hono';
import { authMiddleware, getCurrentUserId } from '../auth';
import { canView, canEdit, canDelete, canManageAccess, listAccessibleResources } from '../rbac/accessControl';
import { initializeResourceAccess, deleteResourceAccess, hasAccessEntries } from '../rbac/storage';
import {
  listAgents,
  loadAgent,
  createAgent as createAgentService,
  updateAgent as updateAgentService,
  deleteAgent as deleteAgentService,
  getAgentFull,
  loadAllAgents,
} from '../services/agents';
import type { AgentConfig } from '../services/agents';

const agentRoutes = new Hono();

// Ensure auth on all routes
agentRoutes.use('/*', authMiddleware);

/**
 * GET /api/agents
 * List all agents the user has access to
 */
agentRoutes.get('/', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const allAgents = await listAgents();

    // Separate system agents (always visible) from user agents
    const systemAgents: AgentConfig[] = [];
    const userAgents: AgentConfig[] = [];

    for (const agent of allAgents) {
      if (agent.system) {
        // System agents are always visible
        systemAgents.push(agent);
      } else {
        userAgents.push(agent);
      }
    }

    // Filter user agents by RBAC
    const userAgentIds = userAgents.map((a) => a.id);
    const accessibleAgents = await listAccessibleResources(userId, 'agent', userAgentIds);
    const accessibleIds = new Set(accessibleAgents.map((a) => a.resourceId));

    // Build result with role info
    const agents = [
      // System agents with special marker
      ...systemAgents.map((a) => ({
        ...a,
        role: null as string | null, // System agents have no owner role
        isSystemAgent: true,
      })),
      // User agents with RBAC
      ...userAgents
        .filter((a) => accessibleIds.has(a.id))
        .map((a) => {
          const access = accessibleAgents.find((acc) => acc.resourceId === a.id);
          return {
            ...a,
            role: access?.role || 'viewer',
            isSystemAgent: false,
          };
        }),
    ];

    return c.json({ agents });
  } catch (error: any) {
    console.error('List agents error:', error);
    return c.json({ error: 'Fehler beim Laden der Agents' }, 500);
  }
});

/**
 * GET /api/agents/:id/full
 * Get full agent config including system prompt (for editing)
 */
agentRoutes.get('/:id/full', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const agentId = c.req.param('id');

    const agent = await getAgentFull(agentId);
    if (!agent) {
      return c.json({ error: 'Agent nicht gefunden' }, 404);
    }

    // System agents are always accessible for viewing
    if (agent.system) {
      return c.json(agent);
    }

    // Check access for user agents
    const accessResult = await canView(userId, 'agent', agentId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Zugriff verweigert' }, 403);
    }

    return c.json(agent);
  } catch (error: any) {
    console.error('Get agent full error:', error);
    return c.json({ error: 'Fehler beim Laden des Agents' }, 500);
  }
});

/**
 * GET /api/agents/:id
 * Get a single agent
 */
agentRoutes.get('/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const agentId = c.req.param('id');

    const agent = await loadAgent(agentId);
    if (!agent) {
      return c.json({ error: 'Agent nicht gefunden' }, 404);
    }

    // System agents are always accessible
    if (agent.system) {
      return c.json({
        agent,
        role: null,
        isSystemAgent: true,
      });
    }

    // Check access for user agents
    const accessResult = await canView(userId, 'agent', agentId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Zugriff verweigert' }, 403);
    }

    return c.json({
      agent,
      role: accessResult.effectiveRole,
      isSystemAgent: false,
    });
  } catch (error: any) {
    console.error('Get agent error:', error);
    return c.json({ error: 'Fehler beim Laden des Agents' }, 500);
  }
});

/**
 * POST /api/agents
 * Create a new agent (creator becomes owner)
 */
agentRoutes.post('/', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const body = await c.req.json();
    const { id, name, description, capabilities, tools, delegatable, systemPrompt, model } = body;

    if (!id || !name) {
      return c.json({ error: 'ID und Name sind erforderlich' }, 400);
    }

    if (!systemPrompt) {
      return c.json({ error: 'System Prompt ist erforderlich' }, 400);
    }

    // Create agent using service
    const agent = await createAgentService({
      id,
      name,
      description: description || '',
      capabilities: capabilities || [],
      tools: tools || ['file_read', 'file_list'],
      delegatable: delegatable !== false,
      systemPrompt,
      model,
    });

    // Initialize RBAC - creator becomes owner
    await initializeResourceAccess('agent', id, userId);

    return c.json({
      success: true,
      agent,
    });
  } catch (error: any) {
    console.error('Create agent error:', error);
    return c.json({ error: error.message || 'Fehler beim Erstellen des Agents' }, 500);
  }
});

/**
 * PUT /api/agents/:id
 * Update an agent
 */
agentRoutes.put('/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const agentId = c.req.param('id');

    const agent = await loadAgent(agentId);
    if (!agent) {
      return c.json({ error: 'Agent nicht gefunden' }, 404);
    }

    // System agents cannot be edited
    if (agent.system) {
      return c.json({ error: 'System-Agenten können nicht bearbeitet werden' }, 403);
    }

    // Check edit permission
    const accessResult = await canEdit(userId, 'agent', agentId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Keine Berechtigung zum Bearbeiten' }, 403);
    }

    const body = await c.req.json();
    const { name, description, capabilities, tools, delegatable, systemPrompt, model } = body;

    const updatedAgent = await updateAgentService(agentId, {
      name,
      description,
      capabilities,
      tools,
      delegatable,
      systemPrompt,
      model,
    });

    return c.json({
      success: true,
      agent: updatedAgent,
    });
  } catch (error: any) {
    console.error('Update agent error:', error);
    return c.json({ error: error.message || 'Fehler beim Aktualisieren des Agents' }, 500);
  }
});

/**
 * DELETE /api/agents/:id
 * Delete an agent
 */
agentRoutes.delete('/:id', async (c) => {
  try {
    const userId = getCurrentUserId(c)!;
    const agentId = c.req.param('id');

    const agent = await loadAgent(agentId);
    if (!agent) {
      return c.json({ error: 'Agent nicht gefunden' }, 404);
    }

    // System agents cannot be deleted
    if (agent.system) {
      return c.json({ error: 'System-Agenten können nicht gelöscht werden' }, 403);
    }

    // Check delete permission
    const accessResult = await canDelete(userId, 'agent', agentId);
    if (!accessResult.allowed) {
      return c.json({ error: 'Keine Berechtigung zum Löschen' }, 403);
    }

    // Delete agent using service
    await deleteAgentService(agentId);

    // Delete RBAC entries
    await deleteResourceAccess('agent', agentId);

    return c.json({ success: true });
  } catch (error: any) {
    console.error('Delete agent error:', error);
    return c.json({ error: error.message || 'Fehler beim Löschen des Agents' }, 500);
  }
});

/**
 * Migration: Initialize RBAC for existing user-created agents
 * Checks each non-system agent and creates owner access for agents without any access entries
 */
export async function migrateExistingAgents(defaultOwnerId: string): Promise<{ migrated: number; skipped: number }> {
  let migrated = 0;
  let skipped = 0;

  try {
    const allAgents = await loadAllAgents();

    for (const [agentId, agent] of allAgents) {
      // Skip system agents and internal agents
      if (agent.system || agent.internal) {
        continue;
      }

      const hasAccess = await hasAccessEntries('agent', agentId);

      if (!hasAccess) {
        await initializeResourceAccess('agent', agentId, defaultOwnerId);
        migrated++;
        console.log(`[RBAC Migration] Agent "${agentId}" - Owner zugewiesen`);
      } else {
        skipped++;
      }
    }
  } catch (error) {
    console.error('Error migrating agents:', error);
  }

  return { migrated, skipped };
}

export { agentRoutes };
