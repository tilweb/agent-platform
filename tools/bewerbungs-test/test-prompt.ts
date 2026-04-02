#!/usr/bin/env bun
/**
 * Test the Bewerbungs-Manager system prompt against the Adacor LLM API.
 * Tests both categorization (Bewerbung vs Sonstige) and CV-based labels (Sprachlevel, Standort).
 *
 * Usage: bun tools/bewerbungs-test/test-prompt.ts
 */

import { readFileSync } from 'node:fs';

// --- Config ---
const ADACOR_BASE = 'https://api.adacor.ai/chat/privateai/v1';
const ADACOR_KEY = process.env.ADACOR_AI_API_KEY || '';
const MODEL = 'qwen3-a3b-30b-256k';

const DATA_DIR = import.meta.dir;
const EMAILS_FILE = `${DATA_DIR}/all-emails.json`;
const GROUND_TRUTH_FILE = `${DATA_DIR}/ground-truth.json`;
const AGENT_CONFIG_PATH = `${DATA_DIR}/../../data/agents/bewerbungs-manager/config.md`;

function loadSystemPrompt(): string {
  const raw = readFileSync(AGENT_CONFIG_PATH, 'utf-8');
  const parts = raw.split('---');
  if (parts.length >= 3) return parts.slice(2).join('---').trim();
  return raw;
}

// --- LLM call ---
async function callLLM(systemPrompt: string, userMessage: string, maxTokens = 500): Promise<string> {
  const response = await fetch(`${ADACOR_BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ADACOR_KEY}` },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.1,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${text}`);
  }

  const data = await response.json() as any;
  return data.choices?.[0]?.message?.content || '';
}

// --- Test: Categorization (Bewerbung label) ---
function formatCategorizePrompt(email: any): string {
  return `Kategorisiere die folgende E-Mail. Antworte NUR mit einem JSON-Objekt:
{"bewerbung": "Bewerbung/...", "reasoning": "kurze Begruendung"}

Moegliche Werte: "Bewerbung/Cloud Developer", "Bewerbung/Cloud Engineer", "Bewerbung/Initiativ", "Sonstige Mails"

---

**Subject**: ${email.subject}
**From**: ${email.from}
**To**: ${email.to}
**Date**: ${email.date}

**Body**:
${email.body?.substring(0, 5000) || '(leer)'}`;
}

// --- Test: CV Analysis (Sprachlevel + Standort) ---
function formatCVPrompt(email: any): string {
  const cvTexts = email.attachments
    .filter((a: any) => !a.text.startsWith('[error') && !a.text.startsWith('[unsupported'))
    .map((a: any) => `### ${a.filename}\n${a.text.substring(0, 8000)}`)
    .join('\n\n');

  return `Analysiere den CV/Lebenslauf dieser Bewerbung. Antworte NUR mit einem JSON-Objekt:
{"sprachlevel": "Sprachlevel/...", "standort": "Standort/...", "sprachlevel_evidence": "...", "standort_evidence": "..."}

**Sprachlevel** (Deutsch-Kenntnisse):
- "Sprachlevel/A" — Grundkenntnisse (A1/A2)
- "Sprachlevel/B" — Gute Kenntnisse (B1/B2, "gute Kenntnisse", "intermediate")
- "Sprachlevel/C" — Sehr gut bis Muttersprache (C1/C2, "verhandlungssicher", "fliessend", "Muttersprache")
Hinweis: Ist der CV auf Deutsch und die Person hat einen deutschen Namen/deutsche Nationalitaet, ist C wahrscheinlich.

**Standort** (Wohnort/Region):
- "Standort/DE" — Deutschland
- "Standort/EU" — EU-Ausland (nicht Deutschland)
- "Standort/World" — Ausserhalb der EU

---

**E-Mail-Betreff**: ${email.subject}
**Absender**: ${email.from}

**CV-Inhalt**:
${cvTexts || '(kein CV vorhanden)'}`;
}

// --- Parse helpers ---
function parseCategorization(response: string): { bewerbung: string; reasoning: string } | null {
  const jsonMatch = response.match(/\{[^}]*"bewerbung"[^}]*\}/s);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  const labels = ['Bewerbung/Cloud Developer', 'Bewerbung/Cloud Engineer', 'Bewerbung/Initiativ', 'Sonstige Mails'];
  for (const label of labels) {
    if (response.includes(label)) return { bewerbung: label, reasoning: response.substring(0, 200) };
  }
  return null;
}

function parseCVAnalysis(response: string): { sprachlevel: string; standort: string; sprachlevel_evidence?: string; standort_evidence?: string } | null {
  // Try JSON extraction
  const jsonMatch = response.match(/\{[^}]*"sprachlevel"[^}]*"standort"[^}]*\}/s);
  if (jsonMatch) {
    try { return JSON.parse(jsonMatch[0]); } catch {}
  }
  // Relaxed: try to find any JSON with these fields
  const relaxed = response.match(/\{[\s\S]*?"sprachlevel"[\s\S]*?"standort"[\s\S]*?\}/);
  if (relaxed) {
    try { return JSON.parse(relaxed[0]); } catch {}
  }
  // Fallback: extract labels from text
  let sprachlevel = '', standort = '';
  if (response.includes('Sprachlevel/C')) sprachlevel = 'Sprachlevel/C';
  else if (response.includes('Sprachlevel/B')) sprachlevel = 'Sprachlevel/B';
  else if (response.includes('Sprachlevel/A')) sprachlevel = 'Sprachlevel/A';
  if (response.includes('Standort/DE')) standort = 'Standort/DE';
  else if (response.includes('Standort/EU')) standort = 'Standort/EU';
  else if (response.includes('Standort/World')) standort = 'Standort/World';
  if (sprachlevel && standort) return { sprachlevel, standort };
  return null;
}

function checkMatch(got: string, expected: string, alsoAccept?: string[]): boolean {
  if (got === expected) return true;
  if (alsoAccept && alsoAccept.includes(got)) return true;
  return false;
}

// --- Main ---
async function main() {
  console.log('=== Bewerbungs-Manager Full Test ===\n');
  console.log(`Model: ${MODEL}`);
  console.log(`API: ${ADACOR_BASE}\n`);

  const emails = JSON.parse(readFileSync(EMAILS_FILE, 'utf-8'));
  const groundTruth = JSON.parse(readFileSync(GROUND_TRUTH_FILE, 'utf-8'));
  const systemPrompt = loadSystemPrompt();

  console.log(`System prompt: ${systemPrompt.length} chars`);
  console.log(`Emails: ${emails.length} | Ground truth: ${groundTruth.emails.length}\n`);

  const truthMap = new Map<string, any>();
  for (const gt of groundTruth.emails) truthMap.set(gt.id, gt);

  // Stats
  let catCorrect = 0, catTotal = 0;
  let slCorrect = 0, slTotal = 0;
  let soCorrect = 0, soTotal = 0;
  const results: any[] = [];

  // ====== PART 1: Categorization ======
  console.log('━'.repeat(80));
  console.log('PART 1: Kategorisierung (Bewerbung/Sonstige)');
  console.log('━'.repeat(80));

  for (const email of emails) {
    const truth = truthMap.get(email.id);
    if (!truth) continue;

    catTotal++;
    const prompt = formatCategorizePrompt(email);
    process.stdout.write(`[${catTotal}/${emails.length}] ${email.subject.substring(0, 55).padEnd(55)} `);

    try {
      const response = await callLLM(systemPrompt, prompt);
      const parsed = parseCategorization(response);

      if (!parsed) {
        console.log(`❌ PARSE ERROR`);
        results.push({ id: email.id, phase: 'categorize', expected: truth.bewerbung, got: 'PARSE_ERROR', correct: false });
        continue;
      }

      const ok = checkMatch(parsed.bewerbung, truth.bewerbung, truth.bewerbungAlsoAccept);
      if (ok) { catCorrect++; console.log(`✅ ${parsed.bewerbung}`); }
      else {
        console.log(`❌ Expected: ${truth.bewerbung} | Got: ${parsed.bewerbung}`);
      }
      results.push({ id: email.id, phase: 'categorize', expected: truth.bewerbung, got: parsed.bewerbung, correct: ok, reasoning: parsed.reasoning });
    } catch (err: any) {
      console.log(`❌ API ERROR`);
      results.push({ id: email.id, phase: 'categorize', expected: truth.bewerbung, got: 'API_ERROR', correct: false });
    }
  }

  console.log(`\n📊 Kategorisierung: ${catCorrect}/${catTotal} (${Math.round(catCorrect/catTotal*100)}%)\n`);

  // ====== PART 2: CV Analysis ======
  console.log('━'.repeat(80));
  console.log('PART 2: CV-Analyse (Sprachlevel + Standort)');
  console.log('━'.repeat(80));

  const cvEmails = emails.filter((e: any) => {
    const truth = truthMap.get(e.id);
    return truth && truth.sprachlevel && e.attachments?.length > 0;
  });

  for (const email of cvEmails) {
    const truth = truthMap.get(email.id)!;
    const hasValidAtt = email.attachments.some((a: any) => !a.text.startsWith('[error') && !a.text.startsWith('[unsupported'));
    if (!hasValidAtt) {
      console.log(`⚠️  ${email.subject.substring(0, 55)} — no readable attachments, skipping`);
      continue;
    }

    slTotal++;
    soTotal++;
    const prompt = formatCVPrompt(email);
    process.stdout.write(`[${slTotal}] ${email.subject.substring(0, 55).padEnd(55)} `);

    try {
      const response = await callLLM(systemPrompt, prompt, 600);
      const parsed = parseCVAnalysis(response);

      if (!parsed) {
        console.log(`❌ PARSE ERROR`);
        console.log(`    Response: ${response.substring(0, 200)}`);
        results.push({ id: email.id, phase: 'cv', correct: false });
        continue;
      }

      const slOk = checkMatch(parsed.sprachlevel, truth.sprachlevel, truth.sprachlevelAlsoAccept);
      const soOk = checkMatch(parsed.standort, truth.standort, truth.standortAlsoAccept);
      if (slOk) slCorrect++;
      if (soOk) soCorrect++;

      const slIcon = slOk ? '✅' : '❌';
      const soIcon = soOk ? '✅' : '❌';
      console.log(`${slIcon} ${parsed.sprachlevel} | ${soIcon} ${parsed.standort}`);
      if (!slOk) console.log(`${''.padEnd(60)} Sprache erwartet: ${truth.sprachlevel} | Evidence: ${parsed.sprachlevel_evidence?.substring(0, 80) || '-'}`);
      if (!soOk) console.log(`${''.padEnd(60)} Standort erwartet: ${truth.standort} | Evidence: ${parsed.standort_evidence?.substring(0, 80) || '-'}`);

      results.push({ id: email.id, phase: 'cv', sprachlevel: { expected: truth.sprachlevel, got: parsed.sprachlevel, correct: slOk }, standort: { expected: truth.standort, got: parsed.standort, correct: soOk } });
    } catch (err: any) {
      console.log(`❌ API ERROR: ${err.message.substring(0, 80)}`);
      results.push({ id: email.id, phase: 'cv', correct: false });
    }
  }

  // ====== SUMMARY ======
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 GESAMTERGEBNIS:\n');
  console.log(`  Kategorisierung:  ${catCorrect}/${catTotal} (${Math.round(catCorrect/catTotal*100)}%)`);
  console.log(`  Sprachlevel:      ${slCorrect}/${slTotal} (${slTotal > 0 ? Math.round(slCorrect/slTotal*100) : 0}%)`);
  console.log(`  Standort:         ${soCorrect}/${soTotal} (${soTotal > 0 ? Math.round(soCorrect/soTotal*100) : 0}%)`);

  const totalTests = catTotal + slTotal + soTotal;
  const totalCorrect = catCorrect + slCorrect + soCorrect;
  console.log(`\n  GESAMT:           ${totalCorrect}/${totalTests} (${Math.round(totalCorrect/totalTests*100)}%)`);

  if (totalCorrect === totalTests) {
    console.log('\n🎉 Alle Tests bestanden!');
  }

  await Bun.write(`${DATA_DIR}/test-results.json`, JSON.stringify({
    model: MODEL, timestamp: new Date().toISOString(),
    categorization: { correct: catCorrect, total: catTotal },
    sprachlevel: { correct: slCorrect, total: slTotal },
    standort: { correct: soCorrect, total: soTotal },
    results,
  }, null, 2));
  console.log(`\nResults saved to test-results.json`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
