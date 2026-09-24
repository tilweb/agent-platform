/**
 * CountryFlag — runde Flagge als echtes SVG (circle-flags, MIT).
 *
 * Ersetzt durchgängig Emoji-Flaggen (die auf Windows nur als Länderkürzel
 * rendern). Flaggen sind vendored unter assets/flags/ (self-contained,
 * kein externer Request). Herkunft/Lizenz: assets/flags/NOTICE.md.
 *
 * FLAGGEN-POLITIK (Produktentscheid): Angezeigt werden nur fünf Flaggen —
 * Deutschland, EU, Schweiz, USA und Welt. Länder-Codes werden hier ZENTRAL
 * auf ihre Kategorie gemappt (NL → EU-Flagge, JP → Welt); der konkrete Ort
 * (z. B. „Niederlande") bleibt als Text an den Render-Stellen sichtbar.
 * Dadurch ist jede Verwendungsstelle automatisch konform.
 */

import { EU_EEA_COUNTRIES } from '../utils/providerMeta';

// eager + ?url: baut eine Map { '../assets/flags/de.svg': '/assets/de-xyz.svg', ... }
const FLAG_URLS = import.meta.glob('../assets/flags/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const FLAGS = {};
for (const path in FLAG_URLS) {
  const code = path.split('/').pop().replace('.svg', '').toLowerCase();
  FLAGS[code] = FLAG_URLS[path];
}

// Firmensitz-Region → Flaggen-Code: Deutschland / EU / International (Welt).
const REGION_CODE = { germany: 'de', eu: 'eu', world: 'un' };

// Land → Flaggen-Kategorie (de | eu | ch | us | un). Pseudo-Codes (eu/un/xx)
// werden durchgereicht, damit Sektions-Header sie direkt verwenden können.
function flagCategory(rawCode) {
  const c = String(rawCode || '').toUpperCase();
  if (!c) return null;
  if (c === 'DE') return 'de';
  if (c === 'CH') return 'ch';
  if (c === 'US') return 'us';
  if (c === 'EU') return 'eu';
  if (c === 'UN' || c === 'XX') return c.toLowerCase();
  if (EU_EEA_COUNTRIES.includes(c)) return 'eu';
  return 'un'; // Welt — alles andere
}

export default function CountryFlag({ code, region, size = 18, title }) {
  const key = region ? REGION_CODE[region] : flagCategory(code);
  const src = FLAGS[key] || FLAGS.xx;
  if (!src) return null;

  return (
    <img
      src={src}
      width={size}
      height={size}
      alt={title || code || region || ''}
      title={title}
      style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: '50%', flexShrink: 0 }}
    />
  );
}
