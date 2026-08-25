/**
 * NK-Config (Scheibe C): Default maximal, additive Kunden-Anpassung, Kanon fix.
 * Prüft den Merge + die Wirkung auf pruefeNK (G6) und die Vorschlags-Engine.
 */
import { test, expect, describe } from 'bun:test';
import { effektiveNk, STANDARD_NK } from './nkconfig';
import { pruefeNK, type NkNamensmodul } from './nk';
import { schlageNamenVor } from './vorschlag';

const modulKonto: NkNamensmodul = { map: [{ alt: 'x', neu: 'C_KontoText', rolle: 'C' }] };

describe('NkConfig', () => {
  test('Default = Paket-Standard (Kanon-Wörter da, keine Ausnahmen)', () => {
    expect(STANDARD_NK.kategorieWoerter).toContain('Pfad');
    expect(STANDARD_NK.verworfen.Ordner).toBe('Pfad');
    expect(STANDARD_NK.ausnahmen.size).toBe(0);
  });

  test('Kunden-Override ist additiv — Standard bleibt, Ergänzung kommt dazu', () => {
    const eff = effektiveNk({
      namensraum: 'MW',
      kategorieWoerter: ['Kennung'],
      verworfen: { Konto: 'Nummer' },
      ausnahmen: [{ name: 'C_LegacyDrucker', grund: 'Altbestand' }],
    });
    expect(eff.namensraum).toBe('MW');
    expect(eff.kategorieWoerter).toContain('Pfad');       // Standard bleibt
    expect(eff.kategorieWoerter).toContain('Kennung');    // Ergänzung
    expect(eff.verworfen.Ordner).toBe('Pfad');            // Standard bleibt
    expect(eff.verworfen.Konto).toBe('Nummer');           // Ergänzung
    expect(eff.ausnahmen.has('C_LegacyDrucker')).toBe(true);
  });

  test('pruefeNK nutzt kundenspezifische verworfen-Wörter (G6 schlägt an)', () => {
    const eff = effektiveNk({ verworfen: { Konto: 'Nummer' } });
    const nk = pruefeNK(modulKonto, [], { verworfen: eff.verworfen, ausnahmen: eff.ausnahmen });
    expect(nk.gates.G6.erfuellt).toBe(false);
    expect(nk.gates.G6.details.join(' ')).toContain('Konto');
  });

  test('dokumentierte Ausnahme nimmt einen Namen von G6 aus', () => {
    const eff = effektiveNk({ verworfen: { Konto: 'Nummer' }, ausnahmen: [{ name: 'C_KontoText', grund: 'bewusst' }] });
    const nk = pruefeNK(modulKonto, [], { verworfen: eff.verworfen, ausnahmen: eff.ausnahmen });
    expect(nk.gates.G6.erfuellt).toBe(true);
  });

  test('ohne Config identisch zum Standard (G6 kennt „Konto" nicht)', () => {
    const nk = pruefeNK(modulKonto, []);
    expect(nk.gates.G6.erfuellt).toBe(true);
  });

  test('schlageNamenVor nutzt kundenspezifische verworfen-Ersetzung', () => {
    const eff = effektiveNk({ verworfen: { Konto: 'Nummer' } });
    const { vorschlaege } = schlageNamenVor(
      [{ name: 'Kunden Konto', p: '1' }],
      [{ name: 'Kunden Konto', p: '1', typ: 'string' }],
      { verworfen: eff.verworfen, kategorieWoerter: eff.kategorieWoerter },
    );
    expect(vorschlaege[0]!.neu.endsWith('KundenNummer')).toBe(true);
  });
});
