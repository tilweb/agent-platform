/**
 * Vertragsmanagement Storage Service
 * File-based storage for contracts and schemas
 */

import { parse, stringify } from 'yaml';
import type { ContractMetadata, ContractSchema } from '../types';

const BASE_PATH = './data/apps/vertragsmanagement';
const CONTRACTS_PATH = `${BASE_PATH}/contracts`;
const SCHEMAS_PATH = `${BASE_PATH}/schemas`;

// ============== Schema Storage ==============

/**
 * Get all contract schemas
 */
export async function getSchemas(): Promise<ContractSchema[]> {
  const schemas: ContractSchema[] = [];
  const glob = new Bun.Glob('*.yaml');

  try {
    for await (const path of glob.scan(SCHEMAS_PATH)) {
      const file = Bun.file(`${SCHEMAS_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        const schema = parse(content) as ContractSchema;
        schemas.push(schema);
      }
    }
  } catch (error) {
    // Directory might not exist yet
    console.log('No schemas found, returning empty list');
  }

  return schemas;
}

/**
 * Get a specific schema by type ID
 */
export async function getSchema(typeId: string): Promise<ContractSchema | null> {
  const file = Bun.file(`${SCHEMAS_PATH}/${typeId}.yaml`);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return parse(content) as ContractSchema;
}

/**
 * Save a schema
 */
export async function saveSchema(schema: ContractSchema): Promise<void> {
  await Bun.write(`${SCHEMAS_PATH}/${schema.id}.yaml`, stringify(schema));
}

// ============== Contract Storage ==============

/**
 * Generate a unique contract ID
 */
export function generateContractId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `contract-${timestamp}-${random}`;
}

/**
 * Get all contracts
 */
export async function getContracts(): Promise<ContractMetadata[]> {
  const contracts: ContractMetadata[] = [];

  try {
    // Read all contract directories
    const glob = new Bun.Glob('*/metadata.yaml');

    for await (const path of glob.scan(CONTRACTS_PATH)) {
      const file = Bun.file(`${CONTRACTS_PATH}/${path}`);
      if (await file.exists()) {
        const content = await file.text();
        const metadata = parse(content) as ContractMetadata;
        contracts.push(metadata);
      }
    }
  } catch (error) {
    // Directory might not exist yet
    console.log('No contracts found, returning empty list');
  }

  // Sort by upload date, newest first
  contracts.sort((a, b) =>
    new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
  );

  return contracts;
}

/**
 * Get a specific contract by ID
 */
export async function getContract(contractId: string): Promise<ContractMetadata | null> {
  const file = Bun.file(`${CONTRACTS_PATH}/${contractId}/metadata.yaml`);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return parse(content) as ContractMetadata;
}

/**
 * Get contract document (markdown)
 */
export async function getContractDocument(contractId: string): Promise<string | null> {
  const file = Bun.file(`${CONTRACTS_PATH}/${contractId}/document.md`);

  if (!(await file.exists())) {
    return null;
  }

  return file.text();
}

/**
 * Save contract metadata
 */
export async function saveContract(metadata: ContractMetadata): Promise<void> {
  const dir = `${CONTRACTS_PATH}/${metadata.id}`;

  // Ensure directory exists
  await Bun.$`mkdir -p ${dir}`;

  // Save metadata
  await Bun.write(`${dir}/metadata.yaml`, stringify(metadata));
}

/**
 * Save contract document (markdown)
 */
export async function saveContractDocument(
  contractId: string,
  document: string
): Promise<void> {
  const dir = `${CONTRACTS_PATH}/${contractId}`;

  // Ensure directory exists
  await Bun.$`mkdir -p ${dir}`;

  await Bun.write(`${dir}/document.md`, document);
}

/**
 * Save original file (PDF, DOCX, TXT, MD)
 */
export async function saveContractOriginal(
  contractId: string,
  fileBuffer: Buffer,
  filename: string
): Promise<void> {
  const dir = `${CONTRACTS_PATH}/${contractId}`;

  // Ensure directory exists
  await Bun.$`mkdir -p ${dir}`;

  await Bun.write(`${dir}/${filename}`, fileBuffer);
}

/**
 * Get original file path
 */
export async function getContractOriginalPath(contractId: string): Promise<string | null> {
  const dir = `${CONTRACTS_PATH}/${contractId}`;

  try {
    // Look for common document extensions
    const extensions = ['*.pdf', '*.docx', '*.doc', '*.txt', '*.md'];
    for (const ext of extensions) {
      const glob = new Bun.Glob(ext);
      for await (const path of glob.scan(dir)) {
        // Exclude document.md (the converted markdown)
        if (path !== 'document.md') {
          return `${dir}/${path}`;
        }
      }
    }
  } catch {
    // Directory doesn't exist
  }

  return null;
}

/**
 * Delete a contract
 */
export async function deleteContract(contractId: string): Promise<boolean> {
  const dir = `${CONTRACTS_PATH}/${contractId}`;
  const metadataFile = Bun.file(`${dir}/metadata.yaml`);

  if (!(await metadataFile.exists())) {
    return false;
  }

  // Remove entire contract directory
  await Bun.$`rm -rf ${dir}`;
  return true;
}

/**
 * Update contract metadata
 */
export async function updateContract(
  contractId: string,
  updates: Partial<ContractMetadata>
): Promise<ContractMetadata | null> {
  const existing = await getContract(contractId);

  if (!existing) {
    return null;
  }

  const updated: ContractMetadata = {
    ...existing,
    ...updates,
    id: contractId, // Ensure ID is not changed
  };

  await saveContract(updated);
  return updated;
}
