/**
 * Dateipfade der App — relativ zu diesem Modul, nicht zum Arbeitsverzeichnis.
 *
 * assets/          Laufzeit-Daten (im Image, beim Start in den Speicher geladen)
 * assets/quellen/  amtliche Destatis-Quellen, aus denen die Builder die
 *                  Laufzeit-Daten erzeugen (nur Build-Zeit + Eval)
 */

export const ASSETS_DIR = `${import.meta.dir}/assets`;

export const CATALOG_PATH = `${ASSETS_DIR}/catalog.json`;
export const EMBEDDINGS_PATH = `${ASSETS_DIR}/embeddings.json`;
export const ALIAS_META_PATH = `${ASSETS_DIR}/alias-embeddings.meta.json`;
export const ALIAS_BIN_PATH = `${ASSETS_DIR}/alias-embeddings.bin`;

/** WZ-2025-Schluesseltabelle (cp1252, ';'-getrennt) → catalog.json + embeddings.json */
export const SCHLUESSELTABELLE_PATH = `${ASSETS_DIR}/quellen/WZ2025-Schluesseltabelle.csv`;
/** Stichwoerter des Klassifikationsservers → Alias-Vektoren (enrich-Haelfte) + Eval-Gold (eval-Haelfte) */
export const STICHWOERTER_PATH = `${ASSETS_DIR}/quellen/WZ2025-Stichwoerter.csv`;
