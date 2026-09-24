/** Gemeinsame HTTP-Antwort für ein Seitenbild (PDF-Seite als PNG oder das Bild selbst). */
import { seitenBild, vorschauArt } from '../seitenvorschau';

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
    const png = await seitenBild(bytes, seite);
    return new Response(new Uint8Array(png), { headers: { ...kopf, 'Content-Type': 'image/png' } });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : 'Seite nicht darstellbar' }, { status: 404 });
  }
}
