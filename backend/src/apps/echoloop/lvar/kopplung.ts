/**
 * Namenskopplung + Umbenennen-Cockpit (Reiter 1).
 *
 * Baut auf dem NK-Gate auf:
 *   · **Dublette vs. Konsolidierung** (G4): ein Zielname von mehreren Alt-Namen
 *     beansprucht — selber Prozess = Dublette (Defekt), verschiedene = Konsolidierung.
 *   · **Kopplungs-Riss (P-A):** ein Ziel ist in einem Prozess schon umbenannt
 *     (Alt-Name == Zielname), in einem anderen noch der alte Name. EMMA koppelt
 *     Fachwerte/Config über Namensgleichheit — die Übergabe ist TOT, bis BEIDE
 *     Stellen umgestellt sind. Paarweise anfassen.
 *   · **Umbenennen-Cockpit (D-061):** je Alt→Neu eine abhakbare Karte mit
 *     APPEND-ONLY Token-ID (nie umbenennen/umnummerieren), Status + Feedback.
 *     Schon umbenannte Ziele werden vorab abgehakt — außer Reiter 3 sperrt den
 *     Vorabhaken (D-085-Kreuz-Widerspruch).
 *
 * Rein & deterministisch (kein LLM). Gegen den Übungsfall kalibriert (1 Riss).
 */
import { pruefeNK, type NkNamensmodul, type VarFundort } from './nk';

export interface KopplungsRiss {
  neu: string;
  renamedIn: string[];   // Prozesse, in denen der Zielname bereits steht
  oldIn: string[];       // Prozesse, in denen noch der alte Name steht
  altName: string;       // der noch offene alte Name
}

export type KartenStatus = 'offen' | 'erledigt' | 'frage' | 'anders_gebaut';

export interface UmbenennenKarte {
  id: string;            // APPEND-ONLY Token (nie umbenennen/umnummerieren)
  alt: string;
  neu: string;
  rolle: string;
  prozesse: string[];    // wo der Alt-Name vorkommt
  vorabHaken: boolean;   // schon umbenannt (alt===neu) und nicht gesperrt
  gesperrt: boolean;     // D-085: Reiter 3 sperrt den Vorabhaken
  status: KartenStatus;
  feedback: string;
}

export interface KopplungErgebnis {
  risse: KopplungsRiss[];
  dubletten: string[];         // Ziel-Namen mit Dublette (G4)
  konsolidierungen: string[];  // Ziel-Namen mit gewollter Konsolidierung (G4)
  karten: UmbenennenKarte[];
}

function slug(s: string): string {
  return s.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Analysiert Namenskopplung + baut die Umbenennen-Karten.
 * `opts.gesperrt` = Ziel-Namen, deren Vorabhaken durch Reiter 3 (D-085) gesperrt ist.
 */
export function analysiereKopplung(
  modul: NkNamensmodul,
  fundorte: VarFundort[] = [],
  opts: { gesperrt?: string[] } = {},
): KopplungErgebnis {
  const gesperrt = new Set(opts.gesperrt ?? []);

  const byName = new Map<string, Set<string>>();
  for (const f of fundorte) {
    if (!byName.has(f.name)) byName.set(f.name, new Set());
    byName.get(f.name)!.add(f.p);
  }
  const prozesseVon = (name: string) => [...(byName.get(name) ?? [])].sort();

  // Ziel → MAP-Einträge
  const byNeu = new Map<string, typeof modul.map>();
  for (const e of modul.map) {
    if (!byNeu.has(e.neu)) byNeu.set(e.neu, []);
    byNeu.get(e.neu)!.push(e);
  }

  // Kopplungs-Risse: Selbst-Umbenennung (alt===neu) in einem Prozess + alter Name in einem anderen.
  const risse: KopplungsRiss[] = [];
  for (const [neu, eintraege] of byNeu) {
    const self = eintraege.filter((e) => e.alt === neu);
    const alt = eintraege.filter((e) => e.alt !== neu);
    if (!self.length || !alt.length) continue;
    const renamedIn = prozesseVon(neu);
    for (const a of alt) {
      const oldIn = prozesseVon(a.alt).filter((p) => !renamedIn.includes(p));
      if (oldIn.length) risse.push({ neu, renamedIn, oldIn, altName: a.alt });
    }
  }

  // Dublette/Konsolidierung aus dem NK-Gate (G4).
  const nk = pruefeNK(modul, fundorte);
  const dubletten = Object.values(nk.g4).filter((x) => x.art === 'dublette').map((x) => x.neu);
  const konsolidierungen = Object.values(nk.g4).filter((x) => x.art === 'konsolidierung').map((x) => x.neu);

  // Umbenennen-Karten (D-061): eine je MAP-Eintrag.
  const karten: UmbenennenKarte[] = modul.map.map((e) => {
    const schonUmbenannt = e.alt === e.neu;
    const istGesperrt = gesperrt.has(e.neu);
    const vorabHaken = schonUmbenannt && !istGesperrt;
    const status: KartenStatus = istGesperrt ? 'frage' : schonUmbenannt ? 'erledigt' : 'offen';
    return {
      id: `UB-${slug(e.alt)}`,
      alt: e.alt, neu: e.neu, rolle: e.rolle,
      prozesse: prozesseVon(e.alt),
      vorabHaken, gesperrt: istGesperrt, status, feedback: '',
    };
  });

  return { risse, dubletten, konsolidierungen, karten };
}
