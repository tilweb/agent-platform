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

/**
 * PAKET_2 · L-VAR-Datenspine (additiv, Phase 0). Entscheidungspunkt D-A:
 * `prozesse` wird zur **Familie** umgewidmet (Zusatzfelder — familienkuerzel,
 * namenskonvention, token_prefix — leben in `prozesse.data`, keine Spalten-Migration);
 * die Einzelprozesse einer Familie hängen als Kind-Tabelle darunter.
 *
 * `el_prozess_items` (Einzelprozess-Steckbrief), `el_variablen` (Variablen mit
 * Fundstellen + NK-Befunden G1–G7), `el_cfg` (Konfigurations-Schlüssel mit 7 Diff-Klassen).
 * Herkunft der Extraktion: `apps/echoloop/extract/emma.ts` (koordinatenbasiert).
 */

/** Einzelprozess innerhalb einer Familie (= `prozesse`). Extraktions-Steckbrief je Lauf. */
export const elProzessItems = echoloopSchema.table('prozess_items', {
  id: text('id').primaryKey(),
  prozessId: text('prozess_id').notNull().references(() => elProzesse.id, { onDelete: 'cascade' }), // Familie
  baustandId: text('baustand_id'),                  // Analyse-/Extraktionslauf, aus dem der Steckbrief stammt
  nr: text('nr').notNull(),                          // EMMA-Prozessnummer
  nameExport: text('name_export'),                  // Export-Name aus dem Prozess-Kopf
  typ: text('typ'),                                 // Prozesstyp §A9: MP | TP | SP
  data: jsonb('data').notNull(),                    // { kritikalitaet?, kritGrund?, kopfblock?, prozessStand?, druckStand?, aufrufe?[], cvrefs?[], ausgaenge?, fingerprint? }
  version: integer('version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  prozessNrIdx: index('el_pitem_prozess_nr_idx').on(t.prozessId, t.nr),
}));

/** Variable eines Einzelprozesses (Zeile der EMMA-„Variable Informationen"-Tabelle). */
export const elVariablen = echoloopSchema.table('variablen', {
  id: text('id').primaryKey(),
  prozessItemId: text('prozess_item_id').notNull().references(() => elProzessItems.id, { onDelete: 'cascade' }),
  prozessId: text('prozess_id').notNull(),          // denormalisierte Familie (für familienweite Dublettencluster)
  p: text('p').notNull(),                           // Prozessnummer
  varId: text('var_id').notNull(),                  // EMMA-Variablen-ID
  name: text('name').notNull(),
  typ: text('typ'),                                 // string|int|bool|datetime|double|password|Timer
  schnitt: text('schnitt'),                         // Privat|Eingehend|Ausgehend|EinAus
  rolle: text('rolle'),                             // NK-Rolle: C_ | H_ | T_ | Fachwert | A_Ergebnis
  data: jsonb('data').notNull(),                    // { init?, pos?, fund?[], umbruch?, neu?, nkBefunde?: {g1..g7} }
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  itemIdx: index('el_var_item_idx').on(t.prozessItemId),
  familieNameIdx: index('el_var_familie_name_idx').on(t.prozessId, t.name),
}));

/** Konfigurations-Schlüssel einer Familie (CFG-Generator, 7 Diff-Klassen). */
export const elCfg = echoloopSchema.table('cfg', {
  id: text('id').primaryKey(),
  prozessId: text('prozess_id').notNull().references(() => elProzesse.id, { onDelete: 'cascade' }), // Familie
  schluessel: text('schluessel').notNull(),
  data: jsonb('data').notNull(),                    // { wert?, wertQuelle?, produzent?, konsument?, diffKlasse?, herkunft? }
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  schluesselIdx: index('el_cfg_prozess_schluessel_idx').on(t.prozessId, t.schluessel),
}));

/**
 * Append-only Telemetrie-Senke (Prinzip §3.8 Provenienz + Gold-Runner-Läufe,
 * Tresor-Sweeps, Verbrauchs-Messung). Bewusst OHNE FK/Cascade — der Audit-Log
 * überlebt das Löschen der referenzierten Entität. Nur Insert, nie Update.
 */
export const elTelemetrie = echoloopSchema.table('telemetrie', {
  id: text('id').primaryKey(),
  prozessId: text('prozess_id'),
  baustandId: text('baustand_id'),
  verfahren: text('verfahren').notNull(),           // lvar | rga | bau | gold | tresor | verbrauch
  event: text('event').notNull(),                   // extract | gold-run | tresor-sweep | benotung | …
  data: jsonb('data'),                              // { tokens?, dauerMs?, ergebnis?, drift?, verdikt?, … }
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
}, (t) => ({
  prozessIdx: index('el_tel_prozess_idx').on(t.prozessId),
  verfahrenIdx: index('el_tel_verfahren_idx').on(t.verfahren, t.createdAt),
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
