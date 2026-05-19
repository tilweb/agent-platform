/**
 * Vertragsmanagement Routes
 * REST API endpoints for contract management
 */

import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
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
import {
  getContractOriginal,
  getAttachmentBytes,
  updateAttachmentRole,
  saveContract,
  getContract,
} from './storage';
import { importContract, reextractContract } from './import-service';
import { getCurrentUserId } from '../../auth/middleware';
import type {
  ContractFilters,
  ContractDocumentRole,
} from '../types';
import { requireAppAccess } from '../permissions-middleware';
import { contentDispositionHeader } from '../../utils/contentDisposition';
import { importRateLimit } from '../../middleware/rateLimit';

const contracts = new Hono();

// Berechtigungs-Pruefung
contracts.use('*', requireAppAccess('vertragsmanagement'));

// ============== Phase-2 Multi-File Import Endpoints ==============

const ALLOWED_IMPORT_MIME_TYPES = new Set([
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
const VALID_DOCUMENT_ROLES: ContractDocumentRole[] = ['hauptvertrag', 'anhang', 'toolbox', 'korrespondenz', 'sonstiges'];

/**
 * POST /api/apps/vertragsmanagement/contracts/import
 * Multi-File-Import via SSE-Stream — Phasen siehe import-service.ts.
 */
contracts.post('/contracts/import', importRateLimit, async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const formData = await c.req.formData();

    const files: { buffer: Buffer; filename: string; mimeType: string }[] = [];
    let totalBytes = 0;
    const MAX_TOTAL_BYTES = 200 * 1024 * 1024; // 200 MB
    for (const [key, value] of formData.entries()) {
      if (key === 'files' && value instanceof File) {
        if (files.length >= 10) {
          return c.json({ error: 'Maximal 10 Dateien erlaubt' }, 400);
        }
        if (value.size > 50 * 1024 * 1024) {
          return c.json({ error: `Datei "${value.name}" ist zu gross (max. 50 MB)` }, 400);
        }
        totalBytes += value.size;
        if (totalBytes > MAX_TOTAL_BYTES) {
          return c.json({ error: 'Gesamtgroesse aller Dateien ueberschreitet 200 MB' }, 400);
        }
        if (!ALLOWED_IMPORT_MIME_TYPES.has(value.type)) {
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

    console.log(`[VM-Import] Received ${files.length} files for import`);

    return streamSSE(c, async (stream) => {
      try {
        await importContract(files, userId, async (event) => {
          await stream.writeSSE({
            event: event.type,
            data: JSON.stringify(event.data),
          });
        });
      } catch (error) {
        console.error('Error importing contract:', error);
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: error instanceof Error ? error.message : 'Import fehlgeschlagen' }),
        });
      }
    });
  } catch (error) {
    console.error('Error importing contract:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Import fehlgeschlagen' }, 500);
  }
});

/**
 * POST /api/apps/vertragsmanagement/contracts/:id/reextract
 * Re-Extraktion mit anderem Vertragstyp (User-Korrektur). Body: { contractType }.
 * Markdown ist gecached → keine Wiederholung von Phase 1+2. Alter Stand wird
 * in `extracted_history[]` archiviert.
 */
contracts.post('/contracts/:id/reextract', importRateLimit, async (c) => {
  try {
    const userId = getCurrentUserId(c);
    if (!userId) return c.json({ error: 'Authentication required' }, 401);
    const contractId = c.req.param('id');
    const body = await c.req.json<{ contractType?: string }>();
    if (!body.contractType) {
      return c.json({ error: 'contractType is required' }, 400);
    }

    return streamSSE(c, async (stream) => {
      try {
        await reextractContract(contractId, body.contractType!, userId, async (event) => {
          await stream.writeSSE({ event: event.type, data: JSON.stringify(event.data) });
        });
      } catch (error) {
        await stream.writeSSE({
          event: 'error',
          data: JSON.stringify({ message: error instanceof Error ? error.message : 'Re-Extraktion fehlgeschlagen' }),
        });
      }
    });
  } catch (error) {
    console.error('Error reextracting contract:', error);
    return c.json({ error: error instanceof Error ? error.message : 'Re-Extraktion fehlgeschlagen' }, 500);
  }
});

/**
 * GET /api/apps/vertragsmanagement/contracts/:id/attachments/:attachmentId
 * Download eines Attachment-Originals. Streamt Buffer mit korrektem
 * Content-Disposition.
 */
contracts.get('/contracts/:id/attachments/:attachmentId', async (c) => {
  try {
    const contractId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');
    const result = await getAttachmentBytes(contractId, attachmentId);
    if (!result) return c.json({ error: 'Attachment nicht gefunden' }, 404);
    return new Response(result.buffer as unknown as BodyInit, {
      headers: {
        'Content-Type': result.contentType,
        'Content-Disposition': contentDispositionHeader(result.filename, result.contentType),
        'Content-Length': result.buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('Error fetching attachment:', error);
    return c.json({ error: 'Failed to fetch attachment' }, 500);
  }
});

/**
 * PUT /api/apps/vertragsmanagement/contracts/:id/attachments/:attachmentId/role
 * Aenderung der Document-Role (User-Korrektur). Body: { role }.
 */
contracts.put('/contracts/:id/attachments/:attachmentId/role', async (c) => {
  try {
    const contractId = c.req.param('id');
    const attachmentId = c.req.param('attachmentId');
    const body = await c.req.json<{ role?: ContractDocumentRole }>();
    if (!body.role || !VALID_DOCUMENT_ROLES.includes(body.role)) {
      return c.json({ error: `role muss eines von ${VALID_DOCUMENT_ROLES.join(', ')} sein` }, 400);
    }
    await updateAttachmentRole(contractId, attachmentId, body.role);
    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating attachment role:', error);
    return c.json({ error: 'Failed to update role' }, 500);
  }
});

/**
 * PUT /api/apps/vertragsmanagement/contracts/:id/primary-attachment
 * Aenderung welcher Anhang der Hauptvertrag ist. Body: { attachmentId }.
 */
contracts.put('/contracts/:id/primary-attachment', async (c) => {
  try {
    const contractId = c.req.param('id');
    const body = await c.req.json<{ attachmentId?: string }>();
    if (!body.attachmentId) return c.json({ error: 'attachmentId is required' }, 400);
    const contract = await getContract(contractId);
    if (!contract) return c.json({ error: 'Vertrag nicht gefunden' }, 404);
    contract.primary_attachment_id = body.attachmentId;
    await saveContract(contract);
    return c.json({ success: true, contract });
  } catch (error) {
    console.error('Error setting primary attachment:', error);
    return c.json({ error: 'Failed to update primary attachment' }, 500);
  }
});

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
    const original = await getContractOriginal(contractId);

    if (!original) {
      return c.json({ error: 'Original file not found' }, 404);
    }

    return new Response(new Uint8Array(original.buffer), {
      headers: {
        'Content-Type': original.contentType,
        'Content-Disposition': contentDispositionHeader(original.filename, original.contentType),
      },
    });
  } catch (error) {
    console.error('Error downloading original:', error);
    return c.json({ error: 'Failed to download original' }, 500);
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

    // Validate mapping paths — verhindert dass User-Schemas mit falschen
    // mapping-Pfaden in der DB landen (sonst keine Basisdaten in der UI).
    const { validateContractSchema, formatSchemaIssues } = await import('./schema-validation');
    const issues = validateContractSchema(schema);
    if (issues.length > 0) {
      return c.json({
        error: 'Schema-Validation fehlgeschlagen',
        details: formatSchemaIssues(issues),
        issues,
      }, 400);
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

    // Validate mapping paths (siehe POST oben).
    const { validateContractSchema, formatSchemaIssues } = await import('./schema-validation');
    const issues = validateContractSchema(updatedSchema);
    if (issues.length > 0) {
      return c.json({
        error: 'Schema-Validation fehlgeschlagen',
        details: formatSchemaIssues(issues),
        issues,
      }, 400);
    }

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
    const schemaPath = `./data/apps/vertragsmanagement/schemas/${typeId}.yaml`;
    await Bun.$`rm -f ${schemaPath}`;

    return c.json({ success: true, message: 'Schema deleted' });
  } catch (error) {
    console.error('Error deleting schema:', error);
    return c.json({ error: 'Failed to delete schema' }, 500);
  }
});

export { contracts as contractRoutes };
