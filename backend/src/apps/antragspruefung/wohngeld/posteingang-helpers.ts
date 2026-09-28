/**
 * Wohngeld — reine, testbare Helfer der Posteingang-Warteschlange (fachlicher Teil).
 *
 * Betreff-Ableitung aus Antrag/Nachweisen. Hashing und Zustandsautomat liegen fachfrei
 * im Antrag-Kern (`apps/_antrag-kern/posteingang/zustand.ts`).
 */
import type { PosteingangDatei } from './types';

const ANTRAGSART_KURZ: Record<string, string> = {
  erstantrag: 'Erstantrag',
  weiterleistungsantrag: 'Weiterleistungsantrag',
  erhoehungsantrag: 'Erhöhungsantrag',
  aenderungsantrag: 'Änderungsantrag',
};

/**
 * Leitet einen sprechenden Betreff aus den (analysierten) Dateien ab, z. B.
 * „Müller, Anna — Erstantrag". Ohne Antrag: erste Nachweis-Identität; sonst der
 * erste Dateiname. Gibt undefined zurück, wenn nichts Sinnvolles ableitbar ist.
 */
export function leiteBetreffAb(dateien: PosteingangDatei[]): string | undefined {
  const antrag = dateien.find((d) => d.typ === 'wohngeldantrag' && d.stammdaten);
  const at = antrag?.stammdaten?.antragsteller;
  if (at && (at.nachname || at.vorname)) {
    const name = [at.nachname, at.vorname].filter(Boolean).join(', ');
    const art = antrag?.stammdaten?.antragsart ? ANTRAGSART_KURZ[antrag.stammdaten.antragsart] : undefined;
    return art ? `${name} — ${art}` : name;
  }
  const nachweis = dateien.map((d) => d.identitaet).find((i) => i && (i.nachname || i.vorname));
  if (nachweis && (nachweis.nachname || nachweis.vorname)) {
    return [nachweis.nachname, nachweis.vorname].filter(Boolean).join(', ');
  }
  return dateien[0]?.dateiname;
}
