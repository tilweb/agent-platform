/**
 * Wohngeld — wer kann Vorgänge bearbeiten? Auswahlliste für die Zuweisung der Sachbearbeitung.
 *
 * Grundlage sind die App-Berechtigungen (Gruppen mit Rolle editor/owner) — dieselbe Quelle wie
 * das Zugriffs-Gate. Globale Plattform-Admins erscheinen nur, wenn sie in einer berechtigten
 * Gruppe stehen. Spec: docs/wohngeld-testrueckmeldungen-umsetzung-spec-2026-09-24.md (Punkt 4)
 */
import { listAppPermissions } from '../permissions';
import { loadGroup } from '../../auth/groups';
import { listUsers } from '../../auth/storage';
import type { AppGroupPermission } from '../types';

export interface Sachbearbeitung {
  id: string;
  name: string;
}

interface GruppeKurz { id: string; memberIds: string[] }
interface NutzerKurz { id: string; username: string; displayName?: string; isActive: boolean }

/** Reine Funktion: aktive Nutzer aus Gruppen mit Bearbeitungsrecht, alphabetisch. */
export function sachbearbeitungAusRechten(rechte: AppGroupPermission[], gruppen: GruppeKurz[], nutzer: NutzerKurz[]): Sachbearbeitung[] {
  const berechtigt = new Set(rechte.filter((r) => r.role === 'editor' || r.role === 'owner').map((r) => r.groupId));
  const ids = new Set(gruppen.filter((g) => berechtigt.has(g.id)).flatMap((g) => g.memberIds));
  return nutzer
    .filter((n) => n.isActive && ids.has(n.id))
    .map((n) => ({ id: n.id, name: (n.displayName || n.username || '').trim() || n.id }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

/** Auswahlliste für die App „wohngeld". */
export async function ladeSachbearbeitung(): Promise<Sachbearbeitung[]> {
  const rechte = await listAppPermissions('wohngeld');
  const gruppen = (await Promise.all(rechte.map((r) => loadGroup(r.groupId)))).filter((g): g is NonNullable<typeof g> => !!g);
  return sachbearbeitungAusRechten(rechte, gruppen, await listUsers());
}
