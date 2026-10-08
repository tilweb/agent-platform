/**
 * DP-Produkte und Abrechnung (Konzept docs/konzept-dp-produktmodell-2026-10-09.md §5).
 *
 * Gezaehlt wird immer die Seite; jedes Produkt hat einen eigenen Seitenpreis. Der
 * Kostenfaktor ist intern (Aufwand relativ zu einer Seite Bildauslese = 1,0) und
 * dient der Preisfindung — er ist keine Kundeneinheit.
 */

export type ProduktId = 'formular' | 'text' | 'standard' | 'vorgang' | 'vertrag' | 'stapel-trennung';

export interface Produkt { id: ProduktId; label: string; kostenfaktor: number }

export const PRODUKTE: Record<ProduktId, Produkt> = {
  formular: { id: 'formular', label: 'Formular (digital)', kostenfaktor: 0.1 },
  text: { id: 'text', label: 'Text', kostenfaktor: 0.3 },
  standard: { id: 'standard', label: 'Standard', kostenfaktor: 1.0 },
  vorgang: { id: 'vorgang', label: 'Vorgang (mehrteilig)', kostenfaktor: 1.5 },
  vertrag: { id: 'vertrag', label: 'Vertrag', kostenfaktor: 3.0 },
  'stapel-trennung': { id: 'stapel-trennung', label: 'Stapel-Trennung', kostenfaktor: 1.0 },
};

/** Produkt einer Auswertung aus der genutzten Strategie (`segmented` = Segmentprofil). */
export function produktFuerStrategie(strategie: string | undefined): Produkt {
  switch (strategie) {
    case 'template-labelmap': return PRODUKTE.formular;
    case 'single-pass':
    case 'long-text-chunked': return PRODUKTE.text;
    case 'segmented': return PRODUKTE.vorgang;
    case 'contract-structured': return PRODUKTE.vertrag;
    default: return PRODUKTE.standard; // hybrid, vision-per-page, general-document, unbekannt
  }
}

export interface AbrechnungsPosten { produkt: ProduktId; seiten: number; kostenfaktor: number }

export function abrechnungsPosten(strategie: string | undefined, seiten: number): AbrechnungsPosten {
  const p = produktFuerStrategie(strategie);
  return { produkt: p.id, seiten: Math.max(1, seiten), kostenfaktor: p.kostenfaktor };
}

/** Posten gleichen Produkts zusammenfassen (Seiten addieren). */
export function fasseAbrechnungZusammen(posten: AbrechnungsPosten[]): AbrechnungsPosten[] {
  const out = new Map<ProduktId, AbrechnungsPosten>();
  for (const p of posten) {
    const vorhanden = out.get(p.produkt);
    if (vorhanden) vorhanden.seiten += p.seiten;
    else out.set(p.produkt, { ...p });
  }
  return [...out.values()];
}
