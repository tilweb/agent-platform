/**
 * Dünne Schicht über pdf-lib-Formularen: Felder über normalisierte Namen setzen
 * (die amtlichen Vorlagen haben unregelmäßige Leerzeichen in Feldnamen),
 * Unterschrift zeichnen, flach machen.
 */
import {
  PDFDocument, PDFCheckBox, PDFTextField, PDFRadioGroup, PDFForm, StandardFonts, rgb, PDFName, PDFRef, PDFArray, type PDFPage,
} from 'pdf-lib';
import { unterschriftPfad } from '../lib';

export const norm = (n: string) => n.replace(/\s+/g, '').replace(/^MZ1\.3-/, '');

export class Formular {
  /** Einheitliche Schriftgröße der Textfelder (Vorlage nutzt Auto-Größe). */
  schriftgroesse = 10;
  private groessen = new Map<string, number>();
  private unterschriften: Array<{ seite: number; x: number; y: number; name: string; breite: number }> = [];
  private constructor(public doc: PDFDocument, private form: PDFForm, private index: Map<string, string>) {}

  static async laden(pfad: string): Promise<Formular> {
    const doc = await PDFDocument.load(await Bun.file(pfad).arrayBuffer());
    const form = doc.getForm();
    const index = new Map(form.getFields().map((f) => [norm(f.getName()), f.getName()]));
    return new Formular(doc, form, index);
  }

  private feld(name: string) {
    const echt = this.index.get(norm(name));
    if (!echt) throw new Error(`Formularfeld nicht gefunden: ${name}`);
    return this.form.getField(echt);
  }

  /** Textfeld setzen (leere Werte werden übersprungen); optional eigene Schriftgröße. */
  text(name: string, wert: string | number | undefined | null, groesse?: number): void {
    if (wert === undefined || wert === null || wert === '') return;
    const f = this.feld(name);
    if (groesse) this.groessen.set(f.getName(), groesse);
    if (!(f instanceof PDFTextField)) throw new Error(`${name} ist kein Textfeld`);
    const s = String(wert);
    const max = f.getMaxLength();
    f.setText(max && s.length > max ? s.slice(0, max) : s);
  }

  /** Checkbox ankreuzen. */
  kreuz(name: string, an = true): void {
    if (!an) return;
    const f = this.feld(name);
    if (!(f instanceof PDFCheckBox)) throw new Error(`${name} ist keine Checkbox`);
    f.check();
  }

  /** Ja/Nein-Paar: kreuzt `<basis>Ja` oder `<basis>Nein`. */
  jaNein(basis: string, ja: boolean): void {
    this.kreuz(`${basis}${ja ? 'Ja' : 'Nein'}`);
  }

  /** Radiogruppe über Options-Index wählen (0 = erste Option). */
  radio(name: string, optionIndex: number): void {
    const f = this.feld(name);
    if (!(f instanceof PDFRadioGroup)) throw new Error(`${name} ist keine Radiogruppe`);
    const opts = f.getOptions();
    f.select(opts[optionIndex]!);
  }

  seite(n: number): PDFPage {
    return this.doc.getPage(n - 1);
  }

  /**
   * Unterschrift (Bézier-Linie) vormerken; x/y = linke untere Ecke in pt. Gezeichnet
   * wird erst nach dem Flachmachen, sonst überdecken Feld-Erscheinungsbilder sie.
   */
  unterschrift(seite: number, x: number, y: number, name: string, breite = 120): void {
    this.unterschriften.push({ seite, x, y, name, breite });
  }

  private zeichneUnterschriften(): void {
    for (const u of this.unterschriften) {
      const skala = u.breite / 170;
      this.seite(u.seite).drawSvgPath(unterschriftPfad(u.name), {
        x: u.x, y: u.y + 44 * skala, scale: skala, borderColor: rgb(0.1, 0.16, 0.42), borderWidth: 1.3,
      });
    }
  }

  /**
   * Nach dem Flachmachen: verwaiste Widget-Verweise aus /Annots entfernen und die
   * Tag-Struktur (barrierefreie Vorlage) verwerfen — sie zeigt sonst auf gelöschte
   * Widgets und erzeugt defekte Verweise. Ein „Ausdruck" braucht keine Tags.
   */
  private aufraeumen(): void {
    const ctx = this.doc.context;
    for (const page of this.doc.getPages()) {
      const annots = page.node.lookup(PDFName.of('Annots'));
      if (!(annots instanceof PDFArray)) continue;
      for (let i = annots.size() - 1; i >= 0; i--) {
        const ref = annots.get(i);
        if (ref instanceof PDFRef && !ctx.lookup(ref)) annots.remove(i);
      }
      if (annots.size() === 0) page.node.delete(PDFName.of('Annots'));
    }
    this.doc.catalog.delete(PDFName.of('StructTreeRoot'));
    this.doc.catalog.delete(PDFName.of('MarkInfo'));
  }

  /** Erscheinungsbilder aktualisieren und alle Felder flach machen (wie ein Ausdruck). */
  async flach(meta: { titel: string }): Promise<Uint8Array> {
    const font = await this.doc.embedFont(StandardFonts.Helvetica);
    for (const f of this.form.getFields()) {
      if (!(f instanceof PDFTextField)) continue;
      // Manche Vorlagen haben kein /DA (Standard-Erscheinungsbild) — dann selbst setzen.
      if (!f.acroField.getDefaultAppearance()) f.acroField.setDefaultAppearance(`/Helv ${this.schriftgroesse} Tf 0 g`);
      f.setFontSize(this.groessen.get(f.getName()) ?? this.schriftgroesse);
    }
    this.form.updateFieldAppearances(font);
    this.form.flatten();
    this.aufraeumen();
    this.zeichneUnterschriften();
    this.doc.setTitle(meta.titel);
    this.doc.setSubject('SYNTHETISCH — Testdaten Wohngeld Golden Dataset, keine echte Person');
    this.doc.setProducer('wohngeld-golden');
    this.doc.setCreator('wohngeld-golden');
    return this.doc.save();
  }
}
