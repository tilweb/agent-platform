/**
 * Dünne Schicht über pdf-lib-Formularen: Felder über normalisierte Namen setzen
 * (die amtlichen Vorlagen haben unregelmäßige Leerzeichen in Feldnamen),
 * Unterschrift zeichnen, flach machen.
 */
import {
  PDFDocument, PDFCheckBox, PDFTextField, PDFRadioGroup, PDFForm, StandardFonts, rgb, PDFName, PDFRef, PDFArray, type PDFPage,
} from 'pdf-lib';
import { esc, htmlZuPdf, rng, unterschriftPfad, wahl, zwischen } from '../lib';

export const norm = (n: string) => n.replace(/\s+/g, '').replace(/^MZ1\.3-/, '');

/**
 * Die Standardschrift (Helvetica/WinAnsi) kennt z. B. türkische Sonderzeichen nicht.
 * Im getippten Formular werden sie ersetzt — wie bei einer Eingabe ohne passende Tastatur.
 */
const WINANSI_ERSATZ: Record<string, string> = { 'ı': 'i', 'İ': 'I', 'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', 'ț': 't', 'ș': 's', 'ą': 'a', 'ę': 'e', 'ł': 'l', 'Ł': 'L', 'ń': 'n', 'ś': 's', 'ź': 'z', 'ż': 'z', 'ć': 'c', 'č': 'c', 'Č': 'C', 'ř': 'r', 'ě': 'e', 'ă': 'a', 'ő': 'o', 'ű': 'u' };
export const winAnsi = (s: string) => s.replace(/[^\u0000-\u00ff€]/g, (c) => WINANSI_ERSATZ[c] ?? c.normalize('NFD').replace(/[\u0300-\u036f]/g, ''));

export class Formular {
  /** Einheitliche Schriftgröße der Textfelder (Vorlage nutzt Auto-Größe). */
  schriftgroesse = 10;
  private groessen = new Map<string, number>();
  private abdecken: Array<{ seite: number; x: number; y: number; w: number; h: number }> = [];
  private freieTexte: Array<{ seite: number; x: number; y: number; w: number; h: number; wert: string }> = [];
  /** Handschrift-Modus: Werte nicht in Felder, sondern als Handschrift-Ebene über das Formular. */
  handschrift: false | { seed: string } = false;
  private hand: Array<{ seite: number; x: number; y: number; w: number; h: number; wert: string; kreuz?: boolean }> = [];
  private seitenVonWidget?: Map<string, number>;
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

  /** Seiten-Index (0-basiert) je Widget-Referenz — über die /Annots der Seiten. */
  private widgetPositionen(name: string): Array<{ seite: number; x: number; y: number; w: number; h: number }> {
    if (!this.seitenVonWidget) {
      this.seitenVonWidget = new Map();
      this.doc.getPages().forEach((page, i) => {
        const annots = page.node.lookup(PDFName.of('Annots'));
        if (annots instanceof PDFArray) for (const r of annots.asArray()) if (r instanceof PDFRef) this.seitenVonWidget!.set(r.toString(), i);
      });
    }
    const f = this.feld(name);
    return f.acroField.getWidgets().map((w) => {
      const ref = this.doc.context.getObjectRef(w.dict);
      const r = w.getRectangle();
      return { seite: ref ? (this.seitenVonWidget!.get(ref.toString()) ?? 0) : 0, x: r.x, y: r.y, w: r.width, h: r.height };
    });
  }

  /**
   * Textfeld setzen (leere Werte werden übersprungen); optional eigene Schriftgröße.
   * `nurSeite` (1-basiert): Wert nur im Widget auf dieser Seite zeigen — Widgets
   * desselben Felds auf anderen Seiten werden nach dem Flachmachen abgedeckt.
   */
  text(name: string, wert: string | number | undefined | null, groesse?: number, nurSeite?: number): void {
    if (wert === undefined || wert === null || wert === '') return;
    const positionen = this.widgetPositionen(name);
    if (this.handschrift) {
      for (const p of positionen) if (!nurSeite || p.seite === nurSeite - 1) this.hand.push({ ...p, wert: String(wert) });
      return;
    }
    if (nurSeite) for (const p of positionen) if (p.seite !== nurSeite - 1) this.abdecken.push(p);
    const f = this.feld(name);
    if (groesse) this.groessen.set(f.getName(), groesse);
    if (!(f instanceof PDFTextField)) throw new Error(`${name} ist kein Textfeld`);
    const s = winAnsi(String(wert));
    const max = f.getMaxLength();
    f.setText(max && s.length > max ? s.slice(0, max) : s);
  }

  /** Text an eine feste Position schreiben (für Stellen ohne eigenes Formularfeld); Seite 1-basiert. */
  textAn(seite: number, x: number, y: number, w: number, h: number, wert: string): void {
    if (!wert) return;
    const e = { seite: seite - 1, x, y, w, h, wert };
    if (this.handschrift) this.hand.push(e); else this.freieTexte.push(e);
  }

  /** Checkbox ankreuzen. */
  kreuz(name: string, an = true): void {
    if (!an) return;
    if (this.handschrift) {
      for (const p of this.widgetPositionen(name)) this.hand.push({ ...p, wert: 'X', kreuz: true });
      return;
    }
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
   * Handschrift-Ebene: je Formularseite eine transparente HTML-Seite mit den Werten
   * an den Feldpositionen (Handschrift-Schrift, leichte Schräglage/Versatz), über
   * Chrome gedruckt und über die Formularseite gelegt.
   */
  private async handschriftEbene(seed: string): Promise<void> {
    const r = rng(`hand:${seed}`);
    const schrift = wahl(r, ["'Bradley Hand'", "'Noteworthy'", "'Marker Felt'", "'Chalkboard SE'"] as const);
    const blockschrift = schrift === "'Marker Felt'" || r() < 0.25;
    const seiten = this.doc.getPages();
    const { width: W, height: H } = seiten[0]!.getSize();
    const html = seiten.map((_, i) => {
      const spans = this.hand.filter((e) => e.seite === i).map((e) => {
        const dreh = zwischen(r, -1.6, 1.6).toFixed(2);
        const dx = zwischen(r, 1, 5).toFixed(1);
        if (e.kreuz) {
          const g = Math.min(e.h, e.w) * 1.15;
          return `<div style="position:absolute;left:${e.x + e.w / 2 - g * 0.32}pt;top:${H - e.y - e.h / 2 - g * 0.78}pt;font-size:${g.toFixed(1)}pt;transform:rotate(${dreh}deg)">x</div>`;
        }
        const mehrzeilig = e.h > 30 || e.wert.includes('\n');
        const groesse = mehrzeilig ? 11.5 : Math.min(13, Math.max(7.5, e.h * 0.78));
        const wert = blockschrift ? e.wert.toUpperCase() : e.wert;
        return `<div style="position:absolute;left:${e.x + Number(dx)}pt;top:${H - e.y - e.h + (mehrzeilig ? 1 : e.h * 0.02)}pt;width:${e.w + 40}pt;font-size:${groesse.toFixed(1)}pt;line-height:1.15;white-space:pre-line;transform:rotate(${dreh}deg);transform-origin:left center">${esc(wert)}</div>`;
      }).join('');
      return `<div class="s">${spans}</div>`;
    }).join('');
    const css = `@page{size:${W}pt ${H}pt;margin:0} html,body{margin:0;padding:0;background:transparent} .s{position:relative;width:${W}pt;height:${H}pt;overflow:hidden;page-break-after:always} .s:last-child{page-break-after:auto} div{font-family:${schrift},cursive;color:#1b2a78}`;
    const pdf = await htmlZuPdf(`<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
    const ebene = await PDFDocument.load(pdf);
    const n = Math.min(ebene.getPageCount(), seiten.length);
    const eingebettet = await this.doc.embedPdf(ebene, Array.from({ length: n }, (_, i) => i));
    eingebettet.forEach((e, i) => seiten[i]!.drawPage(e, { x: 0, y: 0, width: W, height: H }));
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
    for (const a of this.abdecken) {
      this.doc.getPage(a.seite).drawRectangle({ x: a.x + 1, y: a.y + 1, width: a.w - 2, height: a.h - 2, color: rgb(1, 1, 1) });
    }
    for (const t of this.freieTexte) {
      this.doc.getPage(t.seite).drawText(winAnsi(t.wert), { x: t.x + 2, y: t.y + (t.h - this.schriftgroesse) / 2 + 2, size: this.schriftgroesse, font });
    }
    if (this.handschrift && this.hand.length) await this.handschriftEbene(this.handschrift.seed);
    this.zeichneUnterschriften();
    this.doc.setTitle(meta.titel);
    this.doc.setSubject('SYNTHETISCH — Testdaten Wohngeld Golden Dataset, keine echte Person');
    this.doc.setProducer('wohngeld-golden');
    this.doc.setCreator('wohngeld-golden');
    return this.doc.save();
  }
}
