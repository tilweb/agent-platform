import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { integer } from 'drizzle-orm/pg-core';

/**
 * Echo-Loop App — RPA-Prozess-Reifegradanalyse (EMMA Studio).
 *
 * Drei-Ebenen-Modell aus der Spec (docs/Echo-Loop-App/01_Spec):
 *   Kunde (Zwilling-Wurzel) → Prozess (die "Prozess-Akte", Arbeitseinheit)
 *   → Baustand (ein Analyse-Stand: D1-D10+D6b Ist/Soll, Befunde, RG/RGQ/SE).
 *
 * Konvention wie projektmgmt.ts: Identitaets-/Filter-Spalten strukturiert,
 * die komplette Domaenen-Struktur als `data` jsonb, `permissions` als eigene
 * Spalte, `version` als Optimistic-Concurrency-Counter.
 *
 * Baustand traegt bewusst MEHRERE Staende je Prozess (append-only Historie)
 * — damit Ansicht C (Verlauf/Vergleich, Baustein c) spaeter ohne Migration
 * andockt. Status-Gate: entwurf → in_review → freigegeben (Mensch-Review).
 */
export const echoloopSchema = pgSchema('echoloop');

/** Ebene 1 — Kunde (Wurzel des spaeteren Kunden-Zwillings). */
export const elKunden = echoloopSchema.table('kunden', {
  id: text('id').primaryKey(),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  data: jsonb('data').notNull(),                    // { branche?, notizen? }
  permissions: jsonb('permissions'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  ownerIdx: index('el_kunde_owner_idx').on(t.ownerId),
}));

/** Ebene 2 — Prozess-Akte. Eine EMMA-Automatisierung eines Kunden. */
export const elProzesse = echoloopSchema.table('prozesse', {
  id: text('id').primaryKey(),
  kundeId: text('kunde_id').notNull().references(() => elKunden.id, { onDelete: 'cascade' }),
  ownerId: text('owner_id'),
  name: text('name').notNull(),
  emmaPlanNr: text('emma_plan_nr'),                 // EMMA Plan-/Prozessnummer (stabile Identitaet)
  data: jsonb('data').notNull(),                    // { beschreibung?, systeme?[], kritikalitaet?: K-Profil }
  permissions: jsonb('permissions'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  kundeIdx: index('el_prozess_kunde_idx').on(t.kundeId),
  ownerIdx: index('el_prozess_owner_idx').on(t.ownerId),
}));

/**
 * Ebene 3 — Baustand: ein Reifegrad-Analyse-Stand eines Prozesses.
 * `data` haelt: dimensionen {d1..d10,d6b: {ist, soll, relevanz, beleg, provenienz, konfidenz}},
 * befunde: PMFinding[], kennzahlen: {gesamtRG, rgStar, rgq, seQuotient, limiter[]}.
 */
export const elBaustaende = echoloopSchema.table('baustaende', {
  id: text('id').primaryKey(),
  prozessId: text('prozess_id').notNull().references(() => elProzesse.id, { onDelete: 'cascade' }),
  datum: text('datum').notNull(),                   // fachliches Analyse-/Baustand-Datum (ISO)
  status: text('status').notNull().default('entwurf'), // entwurf | in_review | freigegeben
  quelle: text('quelle'),                           // z.B. "Upload Prozess_1118.pdf (+3)"
  data: jsonb('data').notNull(),
  reviewerId: text('reviewer_id'),                  // wer freigegeben hat
  permissions: jsonb('permissions'),
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  prozessIdx: index('el_baustand_prozess_idx').on(t.prozessId, t.status),
}));

/** Hochgeladene EMMA-Export-Artefakte (PDF in S3 + gecachter Textextrakt). */
export const elArtefakte = echoloopSchema.table('artefakte', {
  id: text('id').primaryKey(),
  prozessId: text('prozess_id').notNull().references(() => elProzesse.id, { onDelete: 'cascade' }),
  baustandId: text('baustand_id'),                  // gesetzt sobald der Baustand aus der Analyse entstand
  filename: text('filename').notNull(),
  mimeType: text('mime_type'),
  s3Key: text('s3_key').notNull(),
  data: jsonb('data'),                              // { extractedText?, emmaProzessNr?, seiten? }
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  prozessIdx: index('el_artefakt_prozess_idx').on(t.prozessId),
}));
