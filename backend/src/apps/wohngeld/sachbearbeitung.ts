/** Sachbearbeitungs-Auswahl — Logik im Antrag-Kern (`apps/_antrag-kern/sachbearbeitung.ts`). */
import { ladeSachbearbeitung as kernLade, type Sachbearbeitung } from '../_antrag-kern/sachbearbeitung';

export { sachbearbeitungAusRechten, type Sachbearbeitung } from '../_antrag-kern/sachbearbeitung';

/** Auswahlliste für die App „wohngeld". */
export function ladeSachbearbeitung(): Promise<Sachbearbeitung[]> {
  return kernLade('wohngeld');
}
