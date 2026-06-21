/**
 * IdeePersonen — Personen-Schritt im Projektidee-Wizard.
 * Duenner Adapter: renutzt die gemeinsame Personen-Maske (steps/Personen.jsx)
 * und blendet zusaetzlich das Feld "Geplanter Einsatz" ein (showGeplanterEinsatz).
 *
 * Personen-State liegt direkt auf der Idee (organization / stakeholders),
 * analog zum Projektauftrag.
 */

import Personen from '../steps/Personen';

export default function IdeePersonen({ projektidee, onChange, config }) {
  return (
    <Personen
      data={projektidee}
      config={config}
      onChange={(delta) => onChange({ ...projektidee, ...delta })}
      showGeplanterEinsatz
    />
  );
}
