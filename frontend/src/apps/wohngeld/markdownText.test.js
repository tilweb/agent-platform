import { expect, test } from 'bun:test';
import { markdownZuText } from './markdownText';

test('Markdown wird zu briefgeeignetem Klartext', () => {
  const t = '## Fehlende Unterlagen\n\nFür **Frau Kessler** fehlen:\n\n* Rentenbescheid (*aktuell*)\n* Kontoauszug\n\n1. Anfordern\n2. Frist setzen\n\n| Nachweis | Status |\n|---|---|\n| Mietvertrag | liegt vor |\n\nSiehe [§ 14 WoGG](https://x) und `kv_pv`.';
  expect(markdownZuText(t)).toBe('Fehlende Unterlagen\n\nFür Frau Kessler fehlen:\n\n- Rentenbescheid (aktuell)\n- Kontoauszug\n\n1. Anfordern\n2. Frist setzen\n\nNachweis · Status\nMietvertrag · liegt vor\n\nSiehe § 14 WoGG und kv_pv.');
});
