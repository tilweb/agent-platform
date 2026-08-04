/**
 * Unternehmensrisiken — Risiken-Schritt im Projektidee-Wizard.
 *
 * Dünner Adapter: renutzt die Projektauftrag-Risiken-Maske (steps/Risiken.jsx)
 * — Art (Bedrohung/Chance), Risikotyp, Beschreibung, Wahrscheinlichkeit/Auswirkung
 * plus Risikomatrix. Die Daten liegen auf der Idee unter `unternehmensrisiken`;
 * die geteilte Maske arbeitet intern mit `risks`, daher die Übersetzung im
 * onChange-Adapter. Überschrift + Erläuterung bleiben idee-spezifisch.
 */

import Risiken from '../steps/Risiken';

export default function Unternehmensrisiken({ projektidee, onChange, config }) {
  return (
    <Risiken
      data={{ risks: projektidee.unternehmensrisiken ?? [] }}
      onChange={(delta) => onChange({ ...projektidee, unternehmensrisiken: delta.risks })}
      config={config}
      title="Unternehmensrisiken"
      subtitle="Identifizieren und bewerten Sie potenzielle Unternehmensrisiken und -chancen, die mit dieser Idee verbunden sind."
    />
  );
}
