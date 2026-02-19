/**
 * Vertragsmanagement Routes
 * REST API endpoints for contract management
 */

import { Hono } from 'hono';
import {
  uploadContract,
  listContracts,
  getContractDetails,
  getContractText,
  updateContractMetadata,
  removeContract,
  searchContracts,
  getExpiringContracts,
  getContractStats,
  getContractSchemas,
  getContractSchema,
} from './service';
import { getContractOriginalPath } from './storage';
import type { ContractFilters } from '../types';
import { join } from 'path';
import { APPS_DIR } from '../../utils/paths';

const contracts = new Hono();

// ============== Contract Endpoints ==============

/**
 * POST /api/apps/vertragsmanagement/contracts
 * Upload and analyze a new contract
 */
contracts.post('/contracts', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    const contractType = formData.get('contractType') as string | null;

    if (!file) {
      return c.json({ error: 'No file uploaded' }, 400);
    }

    // Get user ID (simplified - in real app would come from auth)
    const userId = 'user_default';

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const contract = await uploadContract(
      buffer,
      file.name,
      file.type,
      userId,
      contractType || undefined
    );

    return c.json({ contract }, 201);
  } catch (error) {
    console.error('Error uploading contract:', error);
    return c.json(
      { error: error instanceof Error ? error.message : 'Failed to upload contract' },
      500
    );
  }
});

/**
 * GET /api/apps/vertragsmanagement/contracts
 * List all contracts with optional filters
 */
contracts.get('/contracts', async (c) => {
  try {
    const type = c.req.query('type');
    const status = c.req.query('status') as ContractFilters['status'];
    const party = c.req.query('party');
    const search = c.req.query('search');

    const filters: ContractFilters = {};
    if (type) filters.type = type;
    if (status) filters.status = status;
    if (party) filters.party = party;
    if (search) filters.search = search;

    const contractsList = await listContracts(
      Object.keys(filters).length > 0 ? filters : undefined
    );

    return c.json({ contracts: contractsList });
  } catch (error) {
    console.error('Error listing contracts:', error);
    return c.json({ error: 'Failed to list contracts' }, 500);
  }
});

/**
 * GET /api/apps/vertragsmanagement/contracts/stats
 * Get contract statistics
 */
contracts.get('/contracts/stats', async (c) => {
  try {
    const stats = await getContractStats();
    return c.json({ stats });
  } catch (error) {
    console.error('Error getting stats:', error);
    return c.json({ error: 'Failed to get statistics' }, 500);
  }
});

/**
 * GET /api/apps/vertragsmanagement/contracts/:id
 * Get contract details
 */
contracts.get('/contracts/:id', async (c) => {
  try {
    const contractId = c.req.param('id');
    const contract = await getContractDetails(contractId);

    if (!contract) {
      return c.json({ error: 'Contract not found' }, 404);
    }

    return c.json({ contract });
  } catch (error) {
    console.error('Error getting contract:', error);
    return c.json({ error: 'Failed to get contract' }, 500);
  }
});

/**
 * PUT /api/apps/vertragsmanagement/contracts/:id
 * Update contract metadata
 */
contracts.put('/contracts/:id', async (c) => {
  try {
    const contractId = c.req.param('id');
    const body = await c.req.json<{ extracted: Record<string, any> }>();

    if (!body.extracted) {
      return c.json({ error: 'Missing extracted field' }, 400);
    }

    const contract = await updateContractMetadata(contractId, body.extracted);

    if (!contract) {
      return c.json({ error: 'Contract not found' }, 404);
    }

    return c.json({ contract });
  } catch (error) {
    console.error('Error updating contract:', error);
    return c.json({ error: 'Failed to update contract' }, 500);
  }
});

/**
 * DELETE /api/apps/vertragsmanagement/contracts/:id
 * Delete a contract
 */
contracts.delete('/contracts/:id', async (c) => {
  try {
    const contractId = c.req.param('id');
    const deleted = await removeContract(contractId);

    if (!deleted) {
      return c.json({ error: 'Contract not found' }, 404);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting contract:', error);
    return c.json({ error: 'Failed to delete contract' }, 500);
  }
});

/**
 * GET /api/apps/vertragsmanagement/contracts/:id/document
 * Get contract document (markdown)
 */
contracts.get('/contracts/:id/document', async (c) => {
  try {
    const contractId = c.req.param('id');
    const document = await getContractText(contractId);

    if (!document) {
      return c.json({ error: 'Document not found' }, 404);
    }

    return c.json({ document });
  } catch (error) {
    console.error('Error getting document:', error);
    return c.json({ error: 'Failed to get document' }, 500);
  }
});

/**
 * GET /api/apps/vertragsmanagement/contracts/:id/original
 * Download original file (PDF, DOCX, TXT, MD)
 */
contracts.get('/contracts/:id/original', async (c) => {
  try {
    const contractId = c.req.param('id');
    const originalPath = await getContractOriginalPath(contractId);

    if (!originalPath) {
      return c.json({ error: 'Original file not found' }, 404);
    }

    const file = Bun.file(originalPath);
    const content = await file.arrayBuffer();
    const filename = originalPath.split('/').pop() || 'contract';

    // Determine content type based on extension
    const ext = filename.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      doc: 'application/msword',
      txt: 'text/plain',
      md: 'text/markdown',
    };
    const contentType = contentTypes[ext || ''] || 'application/octet-stream';

    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error downloading original:', error);
    return c.json({ error: 'Failed to download original file' }, 500);
  }
});

// ============== Search & Analytics ==============

/**
 * GET /api/apps/vertragsmanagement/search
 * Search contracts
 */
contracts.get('/search', async (c) => {
  try {
    const query = c.req.query('q');

    if (!query) {
      return c.json({ error: 'Missing search query' }, 400);
    }

    const userId = 'user_default';
    const results = await searchContracts(query, userId);

    return c.json({ contracts: results });
  } catch (error) {
    console.error('Error searching contracts:', error);
    return c.json({ error: 'Failed to search contracts' }, 500);
  }
});

/**
 * GET /api/apps/vertragsmanagement/expiring
 * Get contracts expiring within N days
 */
contracts.get('/expiring', async (c) => {
  try {
    const daysParam = c.req.query('days');
    const days = daysParam ? parseInt(daysParam, 10) : 90;

    const contractsList = await getExpiringContracts(days);

    return c.json({ contracts: contractsList });
  } catch (error) {
    console.error('Error getting expiring contracts:', error);
    return c.json({ error: 'Failed to get expiring contracts' }, 500);
  }
});

// ============== Schema Endpoints ==============

/**
 * GET /api/apps/vertragsmanagement/schemas
 * List all contract schemas
 */
contracts.get('/schemas', async (c) => {
  try {
    const schemas = await getContractSchemas();
    return c.json({ schemas });
  } catch (error) {
    console.error('Error listing schemas:', error);
    return c.json({ error: 'Failed to list schemas' }, 500);
  }
});

/**
 * GET /api/apps/vertragsmanagement/schemas/:type
 * Get a specific schema
 */
contracts.get('/schemas/:type', async (c) => {
  try {
    const typeId = c.req.param('type');
    const schema = await getContractSchema(typeId);

    if (!schema) {
      return c.json({ error: 'Schema not found' }, 404);
    }

    return c.json({ schema });
  } catch (error) {
    console.error('Error getting schema:', error);
    return c.json({ error: 'Failed to get schema' }, 500);
  }
});

/**
 * POST /api/apps/vertragsmanagement/schemas/suggest
 * Generate a schema suggestion using AI
 */
contracts.post('/schemas/suggest', async (c) => {
  try {
    const body = await c.req.json<{ contractType: string }>();

    if (!body.contractType || body.contractType.trim().length === 0) {
      return c.json({ error: 'Contract type description is required' }, 400);
    }

    const { generateSchemaSuggestion } = await import('./extraction');
    const suggestion = await generateSchemaSuggestion(body.contractType.trim());

    return c.json({ suggestion });
  } catch (error) {
    console.error('Error generating schema suggestion:', error);
    return c.json({ error: 'Failed to generate schema suggestion' }, 500);
  }
});

/**
 * POST /api/apps/vertragsmanagement/schemas
 * Create a new contract schema
 */
contracts.post('/schemas', async (c) => {
  try {
    const schema = await c.req.json();

    if (!schema.id || !schema.name) {
      return c.json({ error: 'Schema ID and name are required' }, 400);
    }

    // Check if schema already exists
    const existing = await getContractSchema(schema.id);
    if (existing) {
      return c.json({ error: 'Schema with this ID already exists' }, 409);
    }

    // Import saveSchema from storage
    const { saveSchema } = await import('./storage');
    await saveSchema(schema);

    return c.json({ schema }, 201);
  } catch (error) {
    console.error('Error creating schema:', error);
    return c.json({ error: 'Failed to create schema' }, 500);
  }
});

/**
 * PUT /api/apps/vertragsmanagement/schemas/:type
 * Update an existing contract schema
 */
contracts.put('/schemas/:type', async (c) => {
  try {
    const typeId = c.req.param('type');
    const updates = await c.req.json();

    // Check if schema exists
    const existing = await getContractSchema(typeId);
    if (!existing) {
      return c.json({ error: 'Schema not found' }, 404);
    }

    // Merge updates with existing schema, keeping the ID
    const updatedSchema = {
      ...existing,
      ...updates,
      id: typeId, // Ensure ID is not changed
    };

    // Import saveSchema from storage
    const { saveSchema } = await import('./storage');
    await saveSchema(updatedSchema);

    return c.json({ schema: updatedSchema });
  } catch (error) {
    console.error('Error updating schema:', error);
    return c.json({ error: 'Failed to update schema' }, 500);
  }
});

/**
 * DELETE /api/apps/vertragsmanagement/schemas/:type
 * Delete a contract schema
 */
contracts.delete('/schemas/:type', async (c) => {
  try {
    const typeId = c.req.param('type');

    // Check if schema exists
    const existing = await getContractSchema(typeId);
    if (!existing) {
      return c.json({ error: 'Schema not found' }, 404);
    }

    // Delete schema file
    const schemaPath = join(APPS_DIR, 'vertragsmanagement/schemas', `${typeId}.yaml`);
    await Bun.$`rm -f ${schemaPath}`;

    return c.json({ success: true, message: 'Schema deleted' });
  } catch (error) {
    console.error('Error deleting schema:', error);
    return c.json({ error: 'Failed to delete schema' }, 500);
  }
});

export { contracts as contractRoutes };
