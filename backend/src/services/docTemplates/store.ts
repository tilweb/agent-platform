/**
 * Persistenz der Dokumentvorlagen: Metadaten in documents.templates, Original in S3.
 */
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db';
import { docTemplates } from '../../db/schema/documents';
import { putObject, getObject, deleteObject } from '../../storage/s3';
import { s3Paths } from '../../storage/paths';
import { inspectTemplate, type TemplateInspection } from './render';

export type TemplateKind = 'design' | 'structure';
export type DocTemplateRow = typeof docTemplates.$inferSelect;

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/** Öffentliche Sicht auf eine Vorlage (ohne S3-Key). */
export function toDto(row: DocTemplateRow) {
  return {
    id: row.id,
    kind: row.kind as TemplateKind,
    name: row.name,
    description: row.description,
    filename: row.filename,
    sizeBytes: row.sizeBytes,
    isDefault: row.isDefault,
    inspection: row.inspection as TemplateInspection | null,
    ownerUserId: row.ownerUserId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listTemplates(kind: TemplateKind): Promise<DocTemplateRow[]> {
  return getDb().select().from(docTemplates).where(eq(docTemplates.kind, kind)).orderBy(desc(docTemplates.isDefault), docTemplates.name);
}

export async function getTemplate(id: string): Promise<DocTemplateRow | undefined> {
  const rows = await getDb().select().from(docTemplates).where(eq(docTemplates.id, id)).limit(1);
  return rows[0];
}

export async function createTemplate(input: {
  kind: TemplateKind;
  name: string;
  description?: string | null;
  filename: string;
  data: Uint8Array;
  ownerUserId: string;
}): Promise<DocTemplateRow> {
  // wirft TemplateError bei ungültigen Dateien — bevor irgendetwas gespeichert wird
  const inspection = await inspectTemplate(input.data);
  const id = `tpl_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  const s3Key = s3Paths.docTemplate(id);
  await putObject(s3Key, Buffer.from(input.data), DOCX_MIME);
  const [row] = await getDb().insert(docTemplates).values({
    id,
    kind: input.kind,
    name: input.name,
    description: input.description ?? null,
    ownerUserId: input.ownerUserId,
    filename: input.filename,
    s3Key,
    sizeBytes: input.data.byteLength,
    inspection: inspection as never,
  }).returning();
  return row!;
}

export async function updateTemplateMeta(id: string, patch: { name?: string; description?: string | null }): Promise<DocTemplateRow | undefined> {
  const [row] = await getDb().update(docTemplates)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(docTemplates.id, id))
    .returning();
  return row;
}

/** Setzt (oder entfernt mit id=null) die Standard-Designvorlage der Instanz. */
export async function setDefaultDesign(id: string | null): Promise<void> {
  await getDb().transaction(async (tx) => {
    await tx.update(docTemplates).set({ isDefault: false })
      .where(and(eq(docTemplates.kind, 'design'), eq(docTemplates.isDefault, true)));
    if (id) {
      await tx.update(docTemplates).set({ isDefault: true, updatedAt: new Date().toISOString() })
        .where(and(eq(docTemplates.id, id), eq(docTemplates.kind, 'design')));
    }
  });
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const row = await getTemplate(id);
  if (!row) return false;
  await getDb().delete(docTemplates).where(eq(docTemplates.id, id));
  await deleteObject(row.s3Key).catch(err => console.warn('[docTemplates] S3-Löschung fehlgeschlagen:', row.s3Key, err));
  return true;
}

export async function loadTemplateFile(row: DocTemplateRow): Promise<Uint8Array> {
  return new Uint8Array(await getObject(row.s3Key));
}

/**
 * Designvorlage für einen Export bestimmen: explizit gewählt → Instanz-Default → keine
 * (dann greift der eingebaute Generator). Eine unbekannte ID ist ein Fehler, damit das
 * LLM nicht stillschweigend ein anderes Design bekommt als angefragt.
 */
export async function resolveDesignTemplate(explicitId?: string | null): Promise<DocTemplateRow | null> {
  if (explicitId) {
    const row = await getTemplate(explicitId);
    if (!row || row.kind !== 'design') throw new Error(`Designvorlage "${explicitId}" nicht gefunden.`);
    return row;
  }
  const rows = await getDb().select().from(docTemplates)
    .where(and(eq(docTemplates.kind, 'design'), eq(docTemplates.isDefault, true))).limit(1);
  return rows[0] ?? null;
}
