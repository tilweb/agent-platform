/**
 * NK-Konfiguration (Scheibe C) — die Namenskonvention als konfigurierbarer Standard.
 *
 * Prinzip (mit User geklärt): der DEFAULT ist maximal gesetzt (der Paket-Standard,
 * kodiert in `nk.ts`) und wird NUR pro Kunde ADDITIV angepasst — der Kanon selbst
 * (Rollen-Präfixe C_/H_/T_, Negationsverbot, PascalCase) bleibt fix, nicht
 * überschreibbar. Pro Kunde erweiterbar sind nur:
 *   · namensraum        — Kunden-Präfix (z. B. „MW")
 *   · kategorieWoerter  — zusätzliche Kategorie-Wörter (Kunden-Vokabular)
 *   · verworfen         — zusätzliche verworfen→Ersatz-Wörter
 *   · ausnahmen         — dokumentierte Einzelausnahmen (analog zum nk_ausnahme-Schalter)
 *
 * Abgelegt am Kunden (`kunde.data.nkConfig`), gilt für alle seine Prozesse.
 */
import { KATEGORIE_WOERTER, VERWORFEN } from './nk';

export interface NkAusnahme { name: string; grund: string; }

/** Pro Kunde gespeicherte, rein ADDITIVE Anpassung des Standards. */
export interface NkConfig {
  namensraum?: string;
  kategorieWoerter?: string[];
  verworfen?: Record<string, string>;
  ausnahmen?: NkAusnahme[];
}

/** Der effektive Regelsatz = fixer Standard + additive Kunden-Ergänzungen. */
export interface EffektiveNk {
  namensraum?: string;
  kategorieWoerter: string[];
  verworfen: Record<string, string>;
  ausnahmen: Set<string>;          // Zielnamen, die von G6 ausgenommen sind
  ausnahmenListe: NkAusnahme[];
}

/** Legt die additive Kunden-Config über den fixen Paket-Standard. */
export function effektiveNk(override?: NkConfig | null): EffektiveNk {
  const o = override ?? {};
  const extraWoerter = (o.kategorieWoerter ?? []).map((w) => w.trim()).filter(Boolean);
  const extraVerworfen = Object.fromEntries(
    Object.entries(o.verworfen ?? {}).filter(([k, v]) => k.trim() && String(v).trim()),
  );
  const ausnahmen = (o.ausnahmen ?? []).filter((a) => a.name?.trim());
  return {
    namensraum: o.namensraum?.trim() || undefined,
    kategorieWoerter: [...KATEGORIE_WOERTER, ...extraWoerter],
    verworfen: { ...VERWORFEN, ...extraVerworfen },
    ausnahmen: new Set(ausnahmen.map((a) => a.name.trim())),
    ausnahmenListe: ausnahmen,
  };
}

/** Der reine Paket-Standard (ohne Kunden-Anpassung). */
export const STANDARD_NK: EffektiveNk = effektiveNk();
