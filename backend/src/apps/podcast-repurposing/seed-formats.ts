/**
 * Podcast-Repurposing — Format-Vorlagen-Seeder.
 *
 * Beim Boot werden die Standard-Formate idempotent eingespielt (bestehende
 * Einträge werden NICHT überschrieben — der Admin kann Prompts via Settings-UI
 * anpassen, ohne dass der Seed sie zurückdreht).
 *
 * Jedes Text-Format weist das Modell an, striktes JSON zu liefern; jedes
 * Visual-Format erzeugt einen Bild-Prompt (JSON {prompt}).
 */

import { getDb } from '../../db';
import { prFormats } from '../../db/schema/podcast-repurposing';

interface SeedFormat {
  id: string;
  kind: 'social' | 'blog' | 'email' | 'visual';
  platform?: string;
  label: string;
  variants?: number;
  aspectRatio?: string;
  systemPrompt: string;
  userPromptTemplate: string;
  sortOrder: number;
}

const JSON_NOTE =
  'Gib AUSSCHLIESSLICH ein gültiges JSON-Objekt zurück (kein Markdown-Codeblock, kein Fließtext drumherum).';

const DEFAULT_FORMATS: SeedFormat[] = [
  {
    id: 'facebook_post',
    kind: 'social',
    platform: 'facebook',
    label: 'Facebook-Post',
    sortOrder: 100,
    systemPrompt: `Du bist Social-Media-Redakteur:in. Schreibe einen Facebook-Post zu einer Podcast-Folge: locker, nahbar, 1–2 kurze Absätze, mit einem klaren Call-to-Action zum Reinhören. ${JSON_NOTE} Schema: {"content": string, "hashtags": string[], "cta": string}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript:\n{{transcript}}\n\nSchreibe daraus einen Facebook-Post.',
  },
  {
    id: 'linkedin_post',
    kind: 'social',
    platform: 'linkedin',
    label: 'LinkedIn-Post',
    sortOrder: 110,
    systemPrompt: `Du bist B2B-Content-Redakteur:in. Schreibe einen LinkedIn-Post zu einer Podcast-Folge: professioneller Ton, starker Hook in der ersten Zeile, eine konkrete Erkenntnis/These, eine Frage zum Ende. ${JSON_NOTE} Schema: {"content": string, "hashtags": string[], "cta": string}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript:\n{{transcript}}\n\nSchreibe daraus einen LinkedIn-Post.',
  },
  {
    id: 'tiktok_caption',
    kind: 'social',
    platform: 'tiktok',
    label: 'TikTok-Caption',
    sortOrder: 120,
    systemPrompt: `Du schreibst kurze, hook-getriebene TikTok-Captions. Sehr knapp, neugierig machend, passende Emojis und Hashtags. ${JSON_NOTE} Schema: {"content": string, "hashtags": string[]}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript:\n{{transcript}}\n\nSchreibe eine TikTok-Caption.',
  },
  {
    id: 'instagram_caption',
    kind: 'social',
    platform: 'instagram',
    label: 'Instagram-Caption',
    sortOrder: 130,
    systemPrompt: `Du schreibst Instagram-Captions: bildhaft, mit Zeilenumbrüchen und einem Hashtag-Block am Ende. ${JSON_NOTE} Schema: {"content": string, "hashtags": string[]}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript:\n{{transcript}}\n\nSchreibe eine Instagram-Caption.',
  },
  {
    id: 'blog_post',
    kind: 'blog',
    label: 'Blogpost',
    sortOrder: 200,
    systemPrompt: `Du bist Blog-Redakteur:in. Schreibe einen strukturierten Blogartikel (Markdown) zur Podcast-Folge: Einleitung, 3–5 Abschnitte mit Zwischenüberschriften, Fazit. ${JSON_NOTE} Schema: {"title": string, "content": string} — content ist Markdown.`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript:\n{{transcript}}\n\nSchreibe daraus einen Blogartikel.',
  },
  {
    id: 'guest_thankyou_email',
    kind: 'email',
    label: 'Danke-Mail an Gäste',
    sortOrder: 300,
    systemPrompt: `Du schreibst eine warme, persönliche Danke-Mail an die Gesprächspartner:innen einer Podcast-Folge. Wertschätzend, konkret auf Inhalte der Folge eingehend, mit Hinweis auf die Veröffentlichung. ${JSON_NOTE} Schema: {"subject": string, "content": string}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript:\n{{transcript}}\n\nSchreibe eine Danke-Mail an die Gäste.',
  },
  {
    id: 'youtube_thumbnail',
    kind: 'visual',
    platform: 'youtube',
    label: 'YouTube-Thumbnail (16:9)',
    aspectRatio: '16:9',
    sortOrder: 400,
    systemPrompt: `Du erstellst Bild-Prompts für auffällige YouTube-Thumbnails (16:9). Beschreibe Bildmotiv, Komposition, Stil und Stimmung — bildhaft und konkret, ohne Text im Bild. ${JSON_NOTE} Schema: {"prompt": string}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript-Auszug:\n{{transcript}}\n\nEntwirf einen Bild-Prompt für ein YouTube-Thumbnail.',
  },
  {
    id: 'quote_card',
    kind: 'visual',
    label: 'Zitat-Karte (1:1)',
    aspectRatio: '1:1',
    sortOrder: 410,
    systemPrompt: `Du erstellst Bild-Prompts für quadratische Zitat-/Highlight-Karten (1:1) zu einer Podcast-Folge. Beschreibe Hintergrund, Stil und Stimmung — ohne Text im Bild. ${JSON_NOTE} Schema: {"prompt": string}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript-Auszug:\n{{transcript}}\n\nEntwirf einen Bild-Prompt für eine Zitat-Karte.',
  },
  {
    id: 'vertical_story',
    kind: 'visual',
    label: 'Vertical Story/Reel (9:16)',
    aspectRatio: '9:16',
    sortOrder: 420,
    systemPrompt: `Du erstellst Bild-Prompts für vertikale Promo-Visuals (9:16) für Reels/Shorts/Stories. Beschreibe Bildmotiv, Komposition, Stil — ohne Text im Bild. ${JSON_NOTE} Schema: {"prompt": string}`,
    userPromptTemplate:
      'Titel der Folge: {{title}}\n\nTranskript-Auszug:\n{{transcript}}\n\nEntwirf einen Bild-Prompt für ein vertikales Promo-Visual.',
  },
];

export async function seedPodcastRepurposingFormats(): Promise<{ added: number }> {
  if (!process.env.SCALINGO_POSTGRES) return { added: 0 };
  const db = getDb();
  const ts = new Date().toISOString();
  let added = 0;
  for (const f of DEFAULT_FORMATS) {
    const res = await db
      .insert(prFormats)
      .values({
        id: f.id,
        kind: f.kind,
        platform: f.platform ?? null,
        label: f.label,
        enabled: true,
        variants: f.variants ?? 1,
        aspectRatio: f.aspectRatio ?? null,
        systemPrompt: f.systemPrompt,
        userPromptTemplate: f.userPromptTemplate,
        sortOrder: f.sortOrder,
        createdAt: ts,
        updatedAt: ts,
      })
      .onConflictDoNothing({ target: prFormats.id })
      .returning({ id: prFormats.id });
    if (res.length > 0) added++;
  }
  console.log(`[seed-podcast-repurposing] formats added=${added}`);
  return { added };
}
