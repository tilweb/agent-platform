/**
 * Vorgangsmappe — Settings-Storage (DB-Layer fuer document_types, incoterms,
 * required_document_mappings).
 *
 * Reine CRUD-Wrapper ueber Drizzle. Validation passiert in den Routen.
 */

import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../../db';
import {
  vmDocumentTypes,
  vmIncoterms,
  vmRequiredDocumentMappings,
} from '../../db/schema/vorgangsmappe';

/* ------------------------------------------------------------------ *
 * Document Types
 * ------------------------------------------------------------------ */

export interface DocumentType {
  id: string;
  label: string;
  bereich: string;
  matchAny: string[];
  description: string | null;
  statusgebend: boolean;
  sortOrder: number;
}

function rowToDocumentType(row: typeof vmDocumentTypes.$inferSelect): DocumentType {
  return {
    id: row.id,
    label: row.label,
    bereich: row.bereich,
    matchAny: Array.isArray(row.matchAny) ? row.matchAny as string[] : [],
    description: row.description ?? null,
    statusgebend: !!row.statusgebend,
    sortOrder: row.sortOrder,
  };
}

export async function listDocumentTypes(): Promise<DocumentType[]> {
  const db = getDb();
  const rows = await db.select().from(vmDocumentTypes).orderBy(asc(vmDocumentTypes.sortOrder));
  return rows.map(rowToDocumentType);
}

export async function getDocumentType(id: string): Promise<DocumentType | null> {
  const db = getDb();
  const rows = await db.select().from(vmDocumentTypes).where(eq(vmDocumentTypes.id, id)).limit(1);
  return rows[0] ? rowToDocumentType(rows[0]) : null;
}

export async function createDocumentType(input: DocumentType): Promise<DocumentType> {
  const db = getDb();
  await db.insert(vmDocumentTypes).values({
    id: input.id,
    label: input.label,
    bereich: input.bereich,
    matchAny: input.matchAny,
    description: input.description,
    statusgebend: input.statusgebend,
    sortOrder: input.sortOrder,
  });
  return input;
}

export async function updateDocumentType(id: string, patch: Partial<DocumentType>): Promise<DocumentType | null> {
  const db = getDb();
  const set: Record<string, unknown> = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.bereich !== undefined) set.bereich = patch.bereich;
  if (patch.matchAny !== undefined) set.matchAny = patch.matchAny;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.statusgebend !== undefined) set.statusgebend = patch.statusgebend;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  set.updatedAt = new Date().toISOString();

  if (Object.keys(set).length === 1) return getDocumentType(id);

  await db.update(vmDocumentTypes).set(set).where(eq(vmDocumentTypes.id, id));
  return getDocumentType(id);
}

export async function deleteDocumentType(id: string): Promise<boolean> {
  const db = getDb();
  // Mapping-Eintraege mit diesem Doc-Typ mitloeschen — sonst stale rows.
  await db.delete(vmRequiredDocumentMappings).where(eq(vmRequiredDocumentMappings.documentTypeId, id));
  const res = await db.delete(vmDocumentTypes).where(eq(vmDocumentTypes.id, id)).returning({ id: vmDocumentTypes.id });
  return res.length > 0;
}

/* ------------------------------------------------------------------ *
 * Incoterms
 * ------------------------------------------------------------------ */

export interface Incoterm {
  code: string;
  label: string;
  description: string | null;
  sortOrder: number;
}

function rowToIncoterm(row: typeof vmIncoterms.$inferSelect): Incoterm {
  return {
    code: row.code,
    label: row.label,
    description: row.description ?? null,
    sortOrder: row.sortOrder,
  };
}

export async function listIncoterms(): Promise<Incoterm[]> {
  const db = getDb();
  const rows = await db.select().from(vmIncoterms).orderBy(asc(vmIncoterms.sortOrder));
  return rows.map(rowToIncoterm);
}

export async function getIncoterm(code: string): Promise<Incoterm | null> {
  const db = getDb();
  const rows = await db.select().from(vmIncoterms).where(eq(vmIncoterms.code, code)).limit(1);
  return rows[0] ? rowToIncoterm(rows[0]) : null;
}

export async function createIncoterm(input: Incoterm): Promise<Incoterm> {
  const db = getDb();
  await db.insert(vmIncoterms).values({
    code: input.code,
    label: input.label,
    description: input.description,
    sortOrder: input.sortOrder,
  });
  return input;
}

export async function updateIncoterm(code: string, patch: Partial<Incoterm>): Promise<Incoterm | null> {
  const db = getDb();
  const set: Record<string, unknown> = {};
  if (patch.label !== undefined) set.label = patch.label;
  if (patch.description !== undefined) set.description = patch.description;
  if (patch.sortOrder !== undefined) set.sortOrder = patch.sortOrder;
  set.updatedAt = new Date().toISOString();

  if (Object.keys(set).length === 1) return getIncoterm(code);

  await db.update(vmIncoterms).set(set).where(eq(vmIncoterms.code, code));
  return getIncoterm(code);
}

export async function deleteIncoterm(code: string): Promise<boolean> {
  const db = getDb();
  await db.delete(vmRequiredDocumentMappings).where(eq(vmRequiredDocumentMappings.incoterm, code));
  const res = await db.delete(vmIncoterms).where(eq(vmIncoterms.code, code)).returning({ code: vmIncoterms.code });
  return res.length > 0;
}

/* ------------------------------------------------------------------ *
 * Required Document Mappings
 * ------------------------------------------------------------------ */

export interface RequiredDocumentMapping {
  id: number;
  incoterm: string;
  geschaeftsart: string;
  documentTypeId: string;
  required: boolean;
}

function rowToMapping(row: typeof vmRequiredDocumentMappings.$inferSelect): RequiredDocumentMapping {
  return {
    id: row.id,
    incoterm: row.incoterm,
    geschaeftsart: row.geschaeftsart,
    documentTypeId: row.documentTypeId,
    required: row.required,
  };
}

export async function listMappings(filter?: {
  incoterm?: string;
  geschaeftsart?: string;
}): Promise<RequiredDocumentMapping[]> {
  const db = getDb();
  const where = [];
  if (filter?.incoterm) where.push(eq(vmRequiredDocumentMappings.incoterm, filter.incoterm));
  if (filter?.geschaeftsart) where.push(eq(vmRequiredDocumentMappings.geschaeftsart, filter.geschaeftsart));
  const q = where.length > 0
    ? db.select().from(vmRequiredDocumentMappings).where(and(...where))
    : db.select().from(vmRequiredDocumentMappings);
  const rows = await q;
  return rows.map(rowToMapping);
}

/**
 * Upsert ein einzelnes Mapping. `required=false` loescht den Eintrag,
 * `required=true` legt ihn an (oder laesst ihn bestehen).
 */
export async function upsertMapping(
  incoterm: string,
  geschaeftsart: string,
  documentTypeId: string,
  required: boolean,
): Promise<void> {
  const db = getDb();
  if (!required) {
    await db.delete(vmRequiredDocumentMappings).where(
      and(
        eq(vmRequiredDocumentMappings.incoterm, incoterm),
        eq(vmRequiredDocumentMappings.geschaeftsart, geschaeftsart),
        eq(vmRequiredDocumentMappings.documentTypeId, documentTypeId),
      ),
    );
    return;
  }
  await db.insert(vmRequiredDocumentMappings)
    .values({ incoterm, geschaeftsart, documentTypeId, required: true })
    .onConflictDoNothing({
      target: [
        vmRequiredDocumentMappings.incoterm,
        vmRequiredDocumentMappings.geschaeftsart,
        vmRequiredDocumentMappings.documentTypeId,
      ],
    });
}

/**
 * Bulk-Upsert: ersetzt ALLE Mappings fuer eine (incoterm, geschaeftsart)-
 * Kombination durch die gegebene documentTypeIds-Liste. Praktisch fuer
 * Matrix-Editor (User klickt Checkboxen → wir bekommen die finale Liste).
 */
export async function replaceMappingsForKey(
  incoterm: string,
  geschaeftsart: string,
  documentTypeIds: string[],
): Promise<void> {
  const db = getDb();
  await db.delete(vmRequiredDocumentMappings).where(
    and(
      eq(vmRequiredDocumentMappings.incoterm, incoterm),
      eq(vmRequiredDocumentMappings.geschaeftsart, geschaeftsart),
    ),
  );
  if (documentTypeIds.length === 0) return;
  await db.insert(vmRequiredDocumentMappings).values(
    documentTypeIds.map((docId) => ({
      incoterm,
      geschaeftsart,
      documentTypeId: docId,
      required: true,
    })),
  );
}
