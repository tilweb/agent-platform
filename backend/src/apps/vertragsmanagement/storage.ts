/**
 * Vertragsmanagement Storage Service
 * File-based storage for contracts and schemas
 */

import { parse, stringify } from 'yaml';
import type {
  ContractMetadata,
  ContractSchema,
  ContractAttachment,
  ContractDocumentRole,
} from '../types';

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
/**
 * Liest die Bytes des Original-Files aus dem Dateisystem (demo/messe-Variante).
 * Schnittstelle identisch zur main/Drizzle-Version, damit routes.ts auf
 * beiden Worktrees gleich aussieht.
 */
export async function getContractOriginal(
  contractId: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const path = await getContractOriginalPath(contractId);
  if (!path) return null;
  const file = Bun.file(path);
  if (!(await file.exists())) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = path.split('/').pop() ?? 'document';
  const ext = (filename.split('.').pop() || 'bin').toLowerCase();
  const contentTypeMap: Record<string, string> = {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    doc: 'application/msword',
    txt: 'text/plain',
    md: 'text/markdown',
  };
  return { buffer, contentType: contentTypeMap[ext] || 'application/octet-stream', filename };
}

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

// ============== Attachments (Multi-File, Phase 2) ==============

export function generateAttachmentId(): string {
  const random = Math.random().toString(36).substring(2, 10);
  return `att-${Date.now().toString(36)}-${random}`;
}

export async function listAttachments(contractId: string): Promise<ContractAttachment[]> {
  const meta = await getContract(contractId);
  return meta?.attachments ?? [];
}

export async function getAttachment(attachmentId: string): Promise<ContractAttachment | null> {
  // Quer ueber alle Vertraege suchen — fuer demo/messe pragmatisch (kleine
  // Datasets), prod-ready waere ein Index. Reicht hier.
  const allContracts = await getContracts();
  for (const c of allContracts) {
    const att = c.attachments?.find((a) => a.id === attachmentId);
    if (att) return att;
  }
  return null;
}

/**
 * Persistiert ein Attachment KOMPLETT — Bytes ins Dateisystem + Metadata in
 * die metadata.yaml-Liste. Identisches Interface zur main-Variante (S3),
 * damit der Import-Service auf beiden Worktrees identisch ist.
 *
 * `bytes` und `markdown` sind die Original-Datei + die Markitdown-Konversion;
 * letzteres optional (Bilder/text haben keinen markdown-cache).
 */
export async function saveAttachmentWithBytes(
  att: Omit<ContractAttachment, 's3_key_original' | 's3_key_markdown'>,
  bytes: Buffer,
  markdown: string | null,
): Promise<ContractAttachment> {
  const dir = `${CONTRACTS_PATH}/${att.contract_id}/attachments/${att.id}`;
  await Bun.$`mkdir -p ${dir}`;
  await Bun.write(`${dir}/${att.filename}`, bytes);
  let s3KeyMarkdown: string | null = null;
  if (markdown) {
    s3KeyMarkdown = `${dir}/document.md`;
    await Bun.write(s3KeyMarkdown, markdown);
  }
  const stored: ContractAttachment = {
    ...att,
    s3_key_original: `${dir}/${att.filename}`,
    s3_key_markdown: s3KeyMarkdown,
  };
  const meta = await getContract(att.contract_id);
  if (!meta) throw new Error(`Vertrag nicht gefunden: ${att.contract_id}`);
  const attachments = meta.attachments ?? [];
  const existingIdx = attachments.findIndex((a) => a.id === att.id);
  if (existingIdx >= 0) attachments[existingIdx] = stored;
  else attachments.push(stored);
  meta.attachments = attachments;
  await saveContract(meta);
  return stored;
}

export async function updateAttachmentRole(
  contractId: string,
  attachmentId: string,
  role: ContractDocumentRole,
): Promise<void> {
  const meta = await getContract(contractId);
  if (!meta?.attachments) return;
  const att = meta.attachments.find((a) => a.id === attachmentId);
  if (!att) return;
  att.document_role = role;
  await saveContract(meta);
}

export async function deleteAttachment(
  contractId: string,
  attachmentId: string,
): Promise<boolean> {
  const meta = await getContract(contractId);
  if (!meta?.attachments) return false;
  const att = meta.attachments.find((a) => a.id === attachmentId);
  if (!att) return false;
  // Files loeschen (best-effort)
  const dir = `${CONTRACTS_PATH}/${contractId}/attachments/${attachmentId}`;
  try { await Bun.$`rm -rf ${dir}`; } catch { /* ignore */ }
  meta.attachments = meta.attachments.filter((a) => a.id !== attachmentId);
  if (meta.primary_attachment_id === attachmentId) meta.primary_attachment_id = null;
  await saveContract(meta);
  return true;
}

export async function getAttachmentBytes(
  contractId: string,
  attachmentId: string,
): Promise<{ buffer: Buffer; contentType: string; filename: string } | null> {
  const meta = await getContract(contractId);
  const att = meta?.attachments?.find((a) => a.id === attachmentId);
  if (!att) return null;
  const file = Bun.file(att.s3_key_original);
  if (!(await file.exists())) return null;
  const buffer = Buffer.from(await file.arrayBuffer());
  return {
    buffer,
    contentType: att.content_type ?? 'application/octet-stream',
    filename: att.filename,
  };
}
