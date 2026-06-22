/**
 * Document-Split-Grenzprüfung — standalone Probe gegen ein OpenAI-kompatibles
 * LLM (Default: Adacor). Schickt die LETZTE Seite von Dokument A und die ERSTE
 * Seite des Folgesplits B + einen Prompt als Vision-Call an ein oder mehrere
 * Modelle und gibt deren Urteil aus.
 *
 * KOMPLETT STANDALONE: keine Imports aus dem Workplace-Code, nur Bun-Built-ins
 * (Bun.file, fetch, Buffer, process.env). Benötigt nur Bun + einen API-Key.
 *
 * Usage:
 *   bun run document-split-test.ts <pageA> <pageB> [options]
 *
 * Argumente:
 *   <pageA>            Bilddatei: letzte Seite des aktuellen Dokuments
 *   <pageB>            Bilddatei: erste Seite des Folgedokuments
 *
 * Optionen:
 *   --prompt <path>    Prompt-Datei (Default: eingebauter Prompt)
 *   --models <a,b,..>  Komma-Liste Modell-IDs (Default: qwen3-5-a3b-35b-256k)
 *   --base-url <url>   API-Base-URL (Default: https://api.adacor.ai/chat/privateai/v1)
 *   --key <key>        API-Key (Default: $ADACOR_AI_API_KEY)
 *   --max-tokens <n>   max_tokens (Default: 1500)
 *   -h, --help         Diese Hilfe
 *
 * Beispiel:
 *   ADACOR_AI_API_KEY=sk-... bun run document-split-test.ts pageA.png pageB.png \
 *     --models qwen3-5-a3b-35b-256k,mistral-3-24b-128k
 */

const DEFAULT_BASE_URL = 'https://api.adacor.ai/chat/privateai/v1';
const DEFAULT_MODELS = ['qwen3-5-a3b-35b-256k'];

const DEFAULT_PROMPT = `You are an expert document routing and classification system. Your sole task is to determine whether a proposed boundary split between two scanned pages represents a correct separation between two distinct documents.

You will be given two images:
* Page A: The final page of the current document cluster.
* Page B: The first page of the subsequent document cluster.

Documents that are contextually RELATED (same person/case/topic) MUST still be split if they are distinct functional entities (e.g. cover letter -> form; invoice -> remittance slip; letter -> ID scan; contract -> separate annex/signature sheet).

Verification indicators:
- Pagination/metadata: page numbering ("Seite 3 von 3" on A, "Seite 1"/unnumbered on B), changing header/footer, distinct case IDs or dates.
- Structural/layout shifts: paper type, background, formatting (typed letter -> dense form grid), margins/orientation.
- Content/linguistic: A ends with sign-off/signature/legal footer; B begins with new salutation ("Sehr geehrte..."), new subject ("Betreff:"), or document title ("Rechnung", "Bescheinigung").

Output: EXACTLY one lowercase word, either "true" or "false", no punctuation or whitespace.
- "true"  = cut CORRECT (A and B are separate documents)
- "false" = cut INCORRECT (A and B are the same continuous document)`;

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  webp: 'image/webp', gif: 'image/gif',
};

function parseArgs(argv: string[]) {
  const positional: string[] = [];
  const opts: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '-h' || a === '--help') { opts.help = '1'; }
    else if (a.startsWith('--')) { opts[a.slice(2)] = argv[++i] ?? ''; }
    else positional.push(a);
  }
  return { positional, opts };
}

function usage() {
  console.log(`Usage: bun run document-split-test.ts <pageA> <pageB> [options]

  <pageA>            Bild: letzte Seite des aktuellen Dokuments
  <pageB>            Bild: erste Seite des Folgedokuments
  --prompt <path>    Prompt-Datei (Default: eingebauter Prompt)
  --models <a,b,..>  Modell-IDs, kommagetrennt (Default: ${DEFAULT_MODELS.join(',')})
  --base-url <url>   API-Base-URL (Default: ${DEFAULT_BASE_URL})
  --key <key>        API-Key (Default: $ADACOR_AI_API_KEY)
  --max-tokens <n>   max_tokens (Default: 1500)
  -h, --help         Hilfe`);
}

async function toDataUrl(path: string): Promise<string> {
  const file = Bun.file(path);
  if (!(await file.exists())) throw new Error(`Datei nicht gefunden: ${path}`);
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const mime = MIME[ext];
  if (!mime) throw new Error(`Nicht unterstützter Bildtyp ".${ext}" (${path}). Erlaubt: ${Object.keys(MIME).join(', ')}`);
  const b64 = Buffer.from(await file.arrayBuffer()).toString('base64');
  return `data:${mime};base64,${b64}`;
}

async function main() {
  const { positional, opts } = parseArgs(Bun.argv.slice(2));
  if (opts.help || positional.length < 2) { usage(); process.exit(opts.help ? 0 : 1); }

  const [pageA, pageB] = positional;
  const baseUrl = (opts['base-url'] || DEFAULT_BASE_URL).replace(/\/$/, '');
  const apiKey = opts.key || process.env.ADACOR_AI_API_KEY;
  const models = (opts.models ? opts.models.split(',') : DEFAULT_MODELS).map((m) => m.trim()).filter(Boolean);
  const maxTokens = parseInt(opts['max-tokens'] || '1500', 10);

  if (!apiKey) {
    console.error('FEHLER: Kein API-Key. Setze $ADACOR_AI_API_KEY oder nutze --key <key>.');
    process.exit(1);
  }

  const prompt = opts.prompt ? await Bun.file(opts.prompt).text() : DEFAULT_PROMPT;
  const imgA = await toDataUrl(pageA!);
  const imgB = await toDataUrl(pageB!);

  const messages = [
    { role: 'system', content: prompt },
    {
      role: 'user',
      content: [
        { type: 'text', text: 'Page A (final page of current document cluster):' },
        { type: 'image_url', image_url: { url: imgA } },
        { type: 'text', text: 'Page B (first page of subsequent document cluster):' },
        { type: 'image_url', image_url: { url: imgB } },
      ],
    },
  ];

  console.log(`Base-URL: ${baseUrl}`);
  console.log(`Seite A:  ${pageA}`);
  console.log(`Seite B:  ${pageB}`);
  console.log(`Prompt:   ${opts.prompt || '(eingebauter Default)'}`);
  console.log(`Modelle:  ${models.join(', ')}`);

  for (const model of models) {
    process.stdout.write(`\n=== ${model} ===\n`);
    const t0 = Date.now();
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0, max_tokens: maxTokens }),
      });
      const ms = Date.now() - t0;
      const text = await res.text();
      if (!res.ok) { console.log(`HTTP ${res.status} (${ms}ms): ${text.slice(0, 500)}`); continue; }
      const content = JSON.parse(text).choices?.[0]?.message?.content ?? '(kein content)';
      console.log(`OK (${ms}ms): ${JSON.stringify(content).slice(0, 600)}`);
    } catch (err) {
      console.log(`EXCEPTION: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

main();
