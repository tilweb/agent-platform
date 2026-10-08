import { expect, test } from 'bun:test';
import { ergaenzeDigitaleSignaturen, findeDigitaleSignaturen } from './signatur';

test('findeDigitaleSignaturen: signierte Felder mit Zeit, leere Felder ignoriert', () => {
  const pdf = Buffer.from("1 0 obj <</Type/Sig/Name(x)/M(D:20240725151833+02'00')/Prop_Build<</App<</Name/Kofax>>>>/Filter/Adobe.PPKLite/Contents<3082AB00>>> endobj 2 0 obj <</Type /Sig /Contents <0000000000>>> endobj", 'latin1');
  expect(findeDigitaleSignaturen(pdf)).toEqual([{ zeit: '25.07.2024 15:18' }]);
  expect(findeDigitaleSignaturen(Buffer.from('%PDF-1.4 kein Signaturfeld'))).toEqual([]);
});

test('ergaenzeDigitaleSignaturen haengt Marker an die Unterschriftsseite', () => {
  const s = ergaenzeDigitaleSignaturen([
    { seite: 1, rolle: 'vertragstext', text: '§ 1' },
    { seite: 2, rolle: 'unterschriften', text: 'Ort, Datum' },
  ], [{ zeit: '25.07.2024 15:18' }]);
  expect(s[1]!.text).toBe('Ort, Datum\n\n{{digitale signatur: im PDF elektronisch signiert am 25.07.2024 15:18}}');
  expect(s[0]!.text).toBe('§ 1');
});
