/**
 * Vertragsmanagement Service
 * Business logic for contract management
 */

import { readFile } from 'fs/promises';
import { extname } from 'path';
import type { ContractMetadata, ContractFilters, ContractStats } from '../types';
import {
  getContracts,
  getContract,
  getContractDocument,
  saveContract,
  saveContractDocument,
  saveContractOriginal,
  deleteContract as deleteContractStorage,
  updateContract as updateContractStorage,
  generateContractId,
  getSchemas,
  getSchema,
} from './storage';
import { analyzeContract, computeDerivedFields } from './extraction';
import { convertDocument } from '../../services/documentConverter';

// Supported MIME types
const CONVERTIBLE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const TEXT_TYPES = [
  'text/plain',
  'text/markdown',
];

// ============== Document Conversion ==============

/** Konvertierung laeuft zentral (W8): Fetch, Allowlist, Timeout im documentConverter. */

/**
 * Process uploaded file and extract text
 */
async function processDocument(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const ext = extname(filename).toLowerCase();

  // Text/Markdown files - read directly
  if (TEXT_TYPES.includes(mimeType) || ['.txt', '.md'].includes(ext)) {
    return fileBuffer.toString('utf-8');
  }

  // PDF/Word — zentraler Konverter (W8); der Temp-Datei-Umweg entfaellt.
  if (CONVERTIBLE_TYPES.includes(mimeType) || ['.pdf', '.doc', '.docx'].includes(ext)) {
    return await convertDocument({ buffer: fileBuffer, filename });
  }

  throw new Error(`Nicht unterstützter Dateityp: ${mimeType || ext}`);
}

// ============== Contract CRUD ==============

/**
 * Upload and analyze a new contract
 */
export async function uploadContract(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string,
  userId: string,
  contractType?: string
): Promise<ContractMetadata> {
  // Generate ID
  const contractId = generateContractId();

  // Save original file
  await saveContractOriginal(contractId, fileBuffer, filename);

  // Convert document to Markdown
  const documentMarkdown = await processDocument(fileBuffer, filename, mimeType);

  // Save markdown document
  await saveContractDocument(contractId, documentMarkdown);

  // Analyze contract
  const analysis = await analyzeContract(documentMarkdown, contractType);

  // Create metadata
  const metadata: ContractMetadata = {
    id: contractId,
    contract_type: analysis.contract_type,
    upload_filename: filename,
    uploaded_at: new Date().toISOString(),
    uploaded_by: userId,
    extracted: analysis.extracted,
    computed: analysis.computed,
    obligations: analysis.obligations,
  };

  // Save metadata
  await saveContract(metadata);

  return metadata;
}

/**
 * List contracts with optional filtering
 */
export async function listContracts(
  filters?: ContractFilters
): Promise<ContractMetadata[]> {
  let contracts = await getContracts();

  if (!filters) {
    return contracts;
  }

  // Apply filters
  if (filters.type) {
    contracts = contracts.filter((c) => c.contract_type === filters.type);
  }

  if (filters.status) {
    contracts = contracts.filter((c) => c.computed.status === filters.status);
  }

  if (filters.party) {
    const searchParty = filters.party.toLowerCase();
    contracts = contracts.filter(
      (c) =>
        c.computed.party_a.toLowerCase().includes(searchParty) ||
        c.computed.party_b.toLowerCase().includes(searchParty)
    );
  }

  if (filters.search) {
    const searchTerm = filters.search.toLowerCase();
    contracts = contracts.filter(
      (c) =>
        c.computed.party_a.toLowerCase().includes(searchTerm) ||
        c.computed.party_b.toLowerCase().includes(searchTerm) ||
        c.upload_filename.toLowerCase().includes(searchTerm)
    );
  }

  return contracts;
}

/**
 * Get contract details
 */
export async function getContractDetails(
  contractId: string
): Promise<ContractMetadata | null> {
  return getContract(contractId);
}

/**
 * Get contract document text
 */
export async function getContractText(
  contractId: string
): Promise<string | null> {
  return getContractDocument(contractId);
}

/**
 * Update contract metadata (after manual editing)
 */
export async function updateContractMetadata(
  contractId: string,
  extracted: Record<string, any>
): Promise<ContractMetadata | null> {
  const contract = await getContract(contractId);
  if (!contract) {
    return null;
  }

  // Get schema for recomputation
  const schema = await getSchema(contract.contract_type);
  if (!schema) {
    return null;
  }

  // Recompute derived fields
  const computed = computeDerivedFields(extracted, schema);

  // Update contract
  return updateContractStorage(contractId, {
    extracted,
    computed,
  });
}

/**
 * Delete a contract
 */
export async function removeContract(contractId: string): Promise<boolean> {
  return deleteContractStorage(contractId);
}

// ============== Search & Analytics ==============

/**
 * Search contracts by text
 */
export async function searchContracts(
  query: string,
  userId: string
): Promise<ContractMetadata[]> {
  const contracts = await getContracts();

  // Simple text search across computed fields and filename
  const searchTerm = query.toLowerCase();

  return contracts.filter((c) => {
    const searchableText = [
      c.computed.party_a,
      c.computed.party_b,
      c.upload_filename,
      c.contract_type,
      JSON.stringify(c.extracted),
    ]
      .join(' ')
      .toLowerCase();

    return searchableText.includes(searchTerm);
  });
}

/**
 * Get contracts expiring within N days
 */
export async function getExpiringContracts(
  days: number = 90
): Promise<ContractMetadata[]> {
  const contracts = await getContracts();

  return contracts.filter((c) => {
    if (c.computed.days_to_expiry === null) {
      return false;
    }
    return c.computed.days_to_expiry >= 0 && c.computed.days_to_expiry <= days;
  });
}

/**
 * Get contract statistics
 */
export async function getContractStats(): Promise<ContractStats> {
  const contracts = await getContracts();

  const stats: ContractStats = {
    total: contracts.length,
    active: 0,
    expiring: 0,
    expired: 0,
    totalValue: 0,
  };

  for (const contract of contracts) {
    switch (contract.computed.status) {
      case 'active':
        stats.active++;
        break;
      case 'expiring':
        stats.expiring++;
        break;
      case 'expired':
        stats.expired++;
        break;
    }
    stats.totalValue += contract.computed.annual_value || 0;
  }

  return stats;
}

// ============== Schema Management ==============

/**
 * Get all available contract schemas
 */
export async function getContractSchemas() {
  return getSchemas();
}

/**
 * Get a specific contract schema
 */
export async function getContractSchema(typeId: string) {
  return getSchema(typeId);
}

// ============== Re-exports ==============

export { getContractDocument, getSchemas, getSchema } from './storage';
