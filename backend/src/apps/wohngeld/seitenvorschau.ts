/**
 * Wohngeld — Seitenvorschau als Bilder (PNG je Seite), serverseitig gerendert.
 *
 * Warum: Eingebettete PDF-Viewer (iframe/Blob) blockiert die Content-Security-Policy der
 * Instanz, und in Behörden-Umgebungen ist der Browser-PDF-Viewer oft abgeschaltet. Seitenbilder
 * funktionieren überall (img-src 'self') und sehen in allen Browsern gleich aus.
 */
import { countPdfPages, renderPdfToImages } from '../../services/extraction/pdf';

export type VorschauArt = 'pdf' | 'bild' | 'keine';

/** PDF am Inhalt erkennen („%PDF"), sonst am Content-Type. */
export function vorschauArt(bytes: Uint8Array, contentType?: string): VorschauArt {
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return 'pdf';
  const ct = (contentType || '').toLowerCase();
  if (ct.includes('pdf')) return 'pdf';
  if (/^image\/(png|jpe?g|gif|webp)/.test(ct)) return 'bild';
  return 'keine';
}

export async function vorschauInfo(bytes: Uint8Array, contentType?: string): Promise<{ art: VorschauArt; seiten: number }> {
  const art = vorschauArt(bytes, contentType);
  if (art === 'pdf') return { art, seiten: await countPdfPages(Buffer.from(bytes)) };
  return { art, seiten: art === 'bild' ? 1 : 0 };
}

/** Eine Seite als PNG (1-basiert). Auflösung für Bildschirmlesbarkeit, begrenzt. */
export async function seitenBild(bytes: Uint8Array, seite: number, dpi = 110): Promise<Buffer> {
  const [bild] = await renderPdfToImages(Buffer.from(bytes), { dpi: Math.min(Math.max(dpi, 60), 160), pageSelection: [seite] });
  if (!bild) throw new Error(`Seite ${seite} nicht vorhanden`);
  return bild.pngBuffer;
}
