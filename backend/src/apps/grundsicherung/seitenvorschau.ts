/**
 * Grundsicherung — Seitenvorschau als Bilder (PNG je Seite), serverseitig gerendert.
 * (Gleiche Logik wie Wohngeld; liegt noch nicht im Antrag-Kern — Kandidat für den Kern.)
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

/** HTTP-Antwort für eine Seite (PDF-Seite als PNG oder das Bild selbst), 1-basiert. */
export async function seitenAntwort(bytes: Uint8Array, contentType: string | undefined, seite: number): Promise<Response> {
  const art = vorschauArt(bytes, contentType);
  const kopf = { 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' };
  if (art === 'bild') {
    return new Response(new Uint8Array(bytes), { headers: { ...kopf, 'Content-Type': contentType || 'application/octet-stream' } });
  }
  if (art !== 'pdf' || !Number.isInteger(seite) || seite < 1) {
    return Response.json({ error: 'Keine Seitenvorschau für diese Datei' }, { status: 404 });
  }
  try {
    const [bild] = await renderPdfToImages(Buffer.from(bytes), { dpi: 110, pageSelection: [seite] });
    if (!bild) throw new Error(`Seite ${seite} nicht vorhanden`);
    return new Response(new Uint8Array(bild.pngBuffer), { headers: { ...kopf, 'Content-Type': 'image/png' } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Seite nicht darstellbar' }, { status: 404 });
  }
}
