import { pgSchema, text, timestamp, jsonb, index, integer, uniqueIndex } from 'drizzle-orm/pg-core';

export const projektmgmtSchema = pgSchema('projektmgmt');

/**
 * Projekt: das Top-Level-Objekt fuer den PM-Lifecycle.
 *
 * Identitaet + Hierarchie-Referenzen leben hier. Inhaltliche Artefakte
 * (Auftrag, Statusberichte, Lessons Learned, Abschluss) sind als
 * Sub-Resources via FK auf projekte.id angebunden.
 *
 * Migration: existierende Projektauftraege werden 1:1 mit gleicher ID als
 * Projekte angelegt (siehe scripts/migrate-projekte.ts). Dadurch bleiben
 * bestehende URLs `/apps/projektmanagement/<id>` funktional.
 *
 * Status-Wahrheit: die PM-Phase lebt seit Phase F im Projektauftrag-Data-Blob
 * unter `project_status` (Initiierung/Planung/Umsetzung/Abschluss/Gestoppt).
 * Eine alte `lifecycle`-Spalte hier wurde durch Migration 0013 entfernt — sie
 * driftete still vom tatsaechlichen Stand weg und war nicht mehr UI-gesetzt.
 * Siehe docs/projektmanagement-status-felder-2026-05-18.md.
 */
export const paProjekte = projektmgmtSchema.table('projekte', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  portfolioId: text('portfolio_id'),                            // FK auf portfolios.id (Phase D), nullable
  ideeId: text('idee_id'),                                       // FK auf projektideen.id, optional (nicht jedes Projekt entstammt einer Idee)
  metadata: jsonb('metadata'),                                   // freier Bucket fuer kuenftige Felder ohne Migration
  permissions: jsonb('permissions'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('projekt_owner_idx').on(t.ownerId),
  portfolioIdx: index('projekt_portfolio_idx').on(t.portfolioId),
  ideeIdx: index('projekt_idee_idx').on(t.ideeId),
}));

/**
 * Projektideen: leichtgewichtige Vorstufe zum Projektauftrag.
 * Eine Idee kann 0..n Projektauftraege auslösen (verlinkt via paProjektauftraege.ideeId).
 * Die Idee bleibt persistent — selbst wenn alle daraus abgeleiteten Auftraege entfernt
 * werden, bleibt sie als historische Vision-Spur erhalten.
 */
export const paProjektideen = projektmgmtSchema.table('projektideen', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),  // draft | review | approved | rejected | archived
  data: jsonb('data').notNull(),                    // komplette Projektidee-Struktur
  metadata: jsonb('metadata'),
  permissions: jsonb('permissions'),                // { users: [{userId, role}], groups: [{groupId, role}] } — null = nur Ersteller (ownerId)
  version: integer('version').notNull().default(1),  // Optimistic-Concurrency-Counter
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('idee_owner_idx').on(t.ownerId),
  statusIdx: index('idee_status_idx').on(t.status),
}));

export const paProjektauftraege = projektmgmtSchema.table('projektauftraege', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  status: text('status').notNull().default('draft'),
  ideeId: text('idee_id'),                          // FK auf projektideen.id (nullable — Auftrag muss nicht aus Idee kommen)
  data: jsonb('data').notNull(),                    // komplette Projektauftrag-Struktur
  metadata: jsonb('metadata'),                      // erstellt/geaendert datums, version, ...
  permissions: jsonb('permissions'),                // { users: [{userId, role}], groups: [{groupId, role}] } — null = nur Ersteller (ownerId)
  version: integer('version').notNull().default(1),  // Optimistic-Concurrency-Counter
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('pa_owner_idx').on(t.ownerId),
  statusIdx: index('pa_status_idx').on(t.status),
  ideeIdx: index('pa_idee_idx').on(t.ideeId),
}));

export const paStatusberichte = projektmgmtSchema.table('statusberichte', {
  id: text('id').primaryKey(),
  paId: text('pa_id').notNull().references(() => paProjektauftraege.id, { onDelete: 'cascade' }),
  reportDate: timestamp('report_date', { withTimezone: true, mode: 'string' }).notNull(),
  data: jsonb('data').notNull(),
  version: integer('version').notNull().default(1),  // Optimistic-Concurrency-Counter
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  paIdx: index('pa_statusberichte_pa_idx').on(t.paId, t.reportDate),
}));

export const paVorlagen = projektmgmtSchema.table('vorlagen', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  data: jsonb('data').notNull(),
  isSystem: text('is_system').notNull().default('false'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
});

export const paAttachments = projektmgmtSchema.table('attachments', {
  id: text('id').primaryKey(),
  paId: text('pa_id').notNull().references(() => paProjektauftraege.id, { onDelete: 'cascade' }),
  filename: text('filename').notNull(),
  contentType: text('content_type'),
  s3Key: text('s3_key').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  paIdx: index('pa_attachments_pa_idx').on(t.paId),
}));

/**
 * Lessons Learned — Sub-Resource am Projektauftrag/Projekt. SWOT-orientiert
 * (kategorie ∈ strength/weakness/opportunity/threat), pro Themengebiet aus
 * der App-Config (Default-Liste siehe types.ts LESSON_THEMENGEBIET_DEFAULTS).
 *
 * FK heute noch auf paProjektauftraege.id (= Projekt-ID, da Phase-A-IDs 1:1
 * uebernommen werden). Spaetere Phase ziehen den FK auf paProjekte.id um.
 */
export const paLessonsLearned = projektmgmtSchema.table('lessons_learned', {
  id: text('id').primaryKey(),
  paId: text('pa_id').notNull().references(() => paProjektauftraege.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  themengebiet: text('themengebiet').notNull(),
  kategorie: text('kategorie').notNull(),
  beschreibung: text('beschreibung').notNull().default(''),
  auswirkung: text('auswirkung').notNull().default(''),
  empfehlung: text('empfehlung').notNull().default(''),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  paIdx: index('pa_lessons_learned_pa_idx').on(t.paId),
  themaIdx: index('pa_lessons_learned_thema_idx').on(t.themengebiet),
  kategorieIdx: index('pa_lessons_learned_kategorie_idx').on(t.kategorie),
}));

/**
 * Abschlussbericht (Phase F) — 1:1 zum Projektauftrag/Projekt, formale
 * Schluss-Sicht. Vorbefuellt aus dem letzten Statusbericht + Projektauftrag,
 * ergaenzt um abschluss-spezifische Felder (Stakeholder-Akzeptanz, Uebergabe,
 * Abnahme).
 *
 * UNIQUE(pa_id) erzwingt 1:1. Inhaltliche Felder im jsonb-data (analog SB),
 * Identitaets-/Lifecycle-Felder strukturiert oben.
 */
export const paAbschlussberichte = projektmgmtSchema.table('abschlussberichte', {
  id: text('id').primaryKey(),
  paId: text('pa_id').notNull().references(() => paProjektauftraege.id, { onDelete: 'cascade' }),
  data: jsonb('data').notNull(),
  status: text('status').notNull().default('draft'),       // 'draft' | 'final'
  finalizedAt: timestamp('finalized_at', { withTimezone: true, mode: 'string' }),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  paUnique: uniqueIndex('pa_abschlussberichte_pa_unique').on(t.paId),
  statusIdx: index('pa_abschlussberichte_status_idx').on(t.status),
}));
