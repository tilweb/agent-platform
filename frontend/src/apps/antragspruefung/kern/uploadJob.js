/**
 * Upload am Vorgang als Hintergrund-Job (Backend: kern/vorgang-upload.ts). Fragt den Status ab, bis der Job fertig
 * ist, und liefert dann dieselbe Antwort wie der frühere synchrone Upload.
 */

const PAUSE_MS = 2000;
const MAX_MS = 30 * 60 * 1000;
const MAX_FEHLER_IN_FOLGE = 5;

export async function warteAufUploadJob(holeStatus, { onFortschritt } = {}) {
  const ende = Date.now() + MAX_MS;
  let fehlerInFolge = 0;
  for (;;) {
    let s;
    try {
      s = await holeStatus();
      fehlerInFolge = 0;
    } catch (e) {
      // Kurze Netzaussetzer überstehen; die Auswertung läuft im Backend weiter.
      if (++fehlerInFolge >= MAX_FEHLER_IN_FOLGE) throw e;
    }
    if (s?.status === 'fertig') return s.ergebnis;
    if (s?.status === 'fehler') throw new Error(s.fehler || 'Auswertung der Dokumente fehlgeschlagen');
    if (s) onFortschritt?.(s.status === 'wartet' ? 'In Warteschlange' : s.fortschritt || 'Dokumente werden ausgewertet');
    if (Date.now() > ende) throw new Error('Die Auswertung dauert ungewöhnlich lange. Bitte die Seite später neu laden.');
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }
}
