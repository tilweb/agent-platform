/**
 * Merkt sich die zuletzt genutzte Eingabeart am <html>-Element (`data-eingabe`):
 * - „maus" nach Maus-/Touch-/Stift-Eingabe
 * - „tastatur" nach Tab bzw. Shift+Tab (Fokus-Navigation)
 *
 * Hintergrund: Browser zeigen den Fokus-Rahmen (:focus-visible) auch nach einem
 * Mausklick, sobald danach irgendeine Taste gedrückt wird (Leertaste/Pfeile zum
 * Scrollen, Escape, Kürzel) — der angeklickte Button bekommt dann einen
 * „schwarzen Rahmen". Mit dem Modus blendet die globale CSS-Regel (App.jsx) den
 * Rahmen bei Maus-Bedienung aus; wer mit Tab navigiert, sieht ihn weiterhin.
 */
export function installiereEingabeModus(root = document.documentElement) {
  const setze = (modus) => { if (root.dataset.eingabe !== modus) root.dataset.eingabe = modus; };
  const zeiger = () => setze('maus');
  const taste = (e) => { if (e.key === 'Tab') setze('tastatur'); };
  window.addEventListener('pointerdown', zeiger, true);
  window.addEventListener('keydown', taste, true);
  return () => {
    window.removeEventListener('pointerdown', zeiger, true);
    window.removeEventListener('keydown', taste, true);
  };
}
