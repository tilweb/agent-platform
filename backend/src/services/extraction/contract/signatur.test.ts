import { expect, test } from 'bun:test';
import {
  alsSignatur, ergaenzeDigitaleSignaturen, findeDigitaleSignaturen, hatQcKennzeichnung, istTechnischeKennung,
  parsePdfsig, signaturArt, signaturBefunde, signaturMarker, type PdfSignatur,
} from './signatur';

const ZWEI_SIGNATUREN = `Digital Signature Info of: /tmp/x/dokument.pdf
Signature #1:
  - Signature Field Name: SigA
  - Signer Certificate Common Name: Erika Mustermann
  - Signer full Distinguished Name: CN=Erika Mustermann,O=Test GmbH
  - Signing Time: Jul 25 2024 15:18:33
  - Signing Hash Algorithm: SHA-256
  - Signature Type: adbe.pkcs7.detached
  - Signed Ranges: [0 - 980786], [1000788 - 1001227]
  - Not total document signed
  - Signature Validation: Signature is Valid.
Signature #2:
  - Signature Field Name: SigB
  - Signer Certificate Common Name: 3f2b9c1e-7a4d-4e21-9b0f-5c6d7e8f9a0b
  - Signing Time: Aug  2 2024 09:05:00
  - Signature Type: ETSI.CAdES.detached
  - Signed Ranges: [0 - 1002184], [1022186 - 1022515]
  - Total document signed
  - Signature Validation: Digest Mismatch.
`;

test('parsePdfsig: Felder, Bereichsende, Gesamt-Flag, Validierung', () => {
  const [a, b] = parsePdfsig(ZWEI_SIGNATUREN);
  expect(a).toEqual({
    feld: 'SigA', cn: 'Erika Mustermann', zeit: 'Jul 25 2024 15:18:33', typ: 'adbe.pkcs7.detached',
    bereichEnde: 1001227, gesamt: false, validierung: 'Signature is Valid.',
  });
  expect(b!.bereichEnde).toBe(1022515);
  expect(b!.gesamt).toBe(true);
  expect(parsePdfsig('')).toEqual([]);
});

test('parsePdfsig: aeltere Ausgabe ohne DN, Gesamt-Flag und Validierung bleibt lesbar', () => {
  const [a] = parsePdfsig('Signature #1:\n  - Signer Certificate Common Name: Max Muster\n  - Signing Time: Jan  5 2023 08:00:00\n  - Signed Ranges: [0 - 10], [20 - 30]\n');
  expect(a).toMatchObject({ feld: '', cn: 'Max Muster', bereichEnde: 30, gesamt: undefined, validierung: undefined });
});

test('alsSignatur: Zeit, Name vs. technische Kennung, Art, Integritaet', () => {
  const [a, b] = parsePdfsig(ZWEI_SIGNATUREN).map((e) => alsSignatur(e));
  expect(a).toMatchObject({ zeit: '25.07.2024 15:18', unterzeichner: 'Erika Mustermann', art: 'pkcs7', integritaet: 'intakt', deckung: 'unbekannt' });
  expect(a!.unterzeichner_technisch).toBeUndefined();
  expect(b).toMatchObject({ zeit: '02.08.2024 09:05', unterzeichner_technisch: true, art: 'pades', integritaet: 'verletzt', deckung: 'vollstaendig' });
  expect(b!.unterzeichner).toBeUndefined();
});

test('istTechnischeKennung', () => {
  for (const t of ['3f2b9c1e-7a4d-4e21-9b0f-5c6d7e8f9a0b', 'S-1-5-21-123-456-789', 'A1B2C3D4E5F60718', 'DEV-20240725-0042', '']) expect(istTechnischeKennung(t)).toBe(true);
  for (const n of ['Erika Mustermann', 'Müller, Hans', 'erika.mustermann@firma.de', 'Dr. Jürgen Weiß']) expect(istTechnischeKennung(n)).toBe(false);
});

test('signaturArt', () => {
  expect(signaturArt('adbe.pkcs7.sha1')).toBe('pkcs7');
  expect(signaturArt('ETSI.CAdES.detached')).toBe('pades');
  expect(signaturArt('ETSI.RFC3161')).toBe('zeitstempel');
  expect(signaturArt(undefined)).toBe('sonstige');
});

test('hatQcKennzeichnung sucht die DER-OID QcCompliance', () => {
  expect(hatQcKennzeichnung(Buffer.from([0x30, 0x06, 0x06, 0x04, 0x00, 0x8e, 0x46, 0x01, 0x01, 0x00]))).toBe(true);
  expect(hatQcKennzeichnung(Buffer.from([0x06, 0x06, 0x04, 0x00, 0x8e, 0x46, 0x01, 0x04]))).toBe(false);
});

test('findeDigitaleSignaturen (Rueckfall): signierte Felder mit Zeit, leere Felder ignoriert', () => {
  const pdf = Buffer.from("1 0 obj <</Type/Sig/Name(x)/M(D:20240725151833+02'00')/Prop_Build<</App<</Name/Kofax>>>>/Filter/Adobe.PPKLite/Contents<3082AB00>>> endobj 2 0 obj <</Type /Sig /Contents <0000000000>>> endobj", 'latin1');
  expect(findeDigitaleSignaturen(pdf)).toEqual([{ zeit: '25.07.2024 15:18' }]);
  expect(findeDigitaleSignaturen(Buffer.from('%PDF-1.4 kein Signaturfeld'))).toEqual([]);
});

test('signaturMarker: mit Name, ohne Name, Zeitstempel ohne Marker', () => {
  expect(signaturMarker({ zeit: '25.07.2024 15:18', unterzeichner: 'Erika Mustermann', art: 'pkcs7' }))
    .toBe('{{digitale signatur: im PDF elektronisch signiert von Erika Mustermann am 25.07.2024 15:18}}');
  expect(signaturMarker({ zeit: '25.07.2024 15:18', art: 'pades' })).toBe('{{digitale signatur: im PDF elektronisch signiert am 25.07.2024 15:18}}');
  expect(signaturMarker({ zeit: '25.07.2024 15:18', art: 'zeitstempel' })).toBeNull();
});

test('ergaenzeDigitaleSignaturen haengt Marker an die Unterschriftsseite', () => {
  const seiten = [
    { seite: 1, rolle: 'vertragstext' as const, text: '§ 1' },
    { seite: 2, rolle: 'unterschriften' as const, text: 'Ort, Datum' },
  ];
  const s = ergaenzeDigitaleSignaturen(seiten, [{ zeit: '25.07.2024 15:18', art: 'pkcs7' }]);
  expect(s[1]!.text).toBe('Ort, Datum\n\n{{digitale signatur: im PDF elektronisch signiert am 25.07.2024 15:18}}');
  expect(s[0]!.text).toBe('§ 1');
  expect(ergaenzeDigitaleSignaturen(seiten, [{ zeit: 'x', art: 'zeitstempel' }])).toBe(seiten);
});

const BASIS: PdfSignatur = { feld: 'Sig', zeit: '25.07.2024 15:18', art: 'pkcs7', integritaet: 'unbekannt', bereich_ende: 100, deckung: 'vollstaendig' };

test('signaturBefunde: nur bei Aenderung bzw. verletzter Integritaet', () => {
  expect(signaturBefunde([BASIS, { ...BASIS, deckung: 'spaetere_signatur' }, { ...BASIS, deckung: 'nachtrag_ohne_aenderung' }])).toEqual([]);
  const [b] = signaturBefunde([{ ...BASIS, unterzeichner: 'Erika Mustermann', deckung: 'geaendert', aenderung: { seiten: [1], art: ['text'], hinzu: 'Anlage 2' } }]);
  expect(b).toEqual({
    typ: 'nach_signatur_geaendert',
    text: 'Nach der elektronischen Signatur von Erika Mustermann vom 25.07.2024 15:18 wurde das Dokument verändert (Seite 1; hinzugekommen „Anlage 2"). Maßgeblich ist die signierte Fassung.',
  });
  const [c] = signaturBefunde([{ ...BASIS, deckung: 'geaendert', aenderung: { seiten: [3, 9], seitenzahl: [8, 9], art: ['seiten', 'sichtbar'] } }]);
  expect(c!.text).toContain('Seitenzahl 8 → 9; Seiten 3, 9; sichtbare Änderung');
  expect(signaturBefunde([{ ...BASIS, integritaet: 'verletzt' }])[0]!.typ).toBe('signatur_beschaedigt');
});
