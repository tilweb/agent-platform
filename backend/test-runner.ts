/**
 * Isolated Test Runner
 *
 * Runs each test file in a separate bun process to avoid mock.module()
 * contamination between test files (known bun:test limitation).
 *
 * Usage: bun run test-runner.ts [filter]
 *   filter — optional substring to match test file paths
 */

import { Glob } from "bun";

const filter = process.argv[2] || "";

// Discover all test files
const testFiles: string[] = [];
const glob = new Glob("src/**/*.test.ts");
for await (const file of glob.scan(".")) {
  if (!filter || file.includes(filter)) {
    testFiles.push(file);
  }
}
testFiles.sort();

if (testFiles.length === 0) {
  console.log("Keine Testdateien gefunden.");
  process.exit(0);
}

console.log(`\nStarte ${testFiles.length} Testdateien (isoliert)...\n`);

let totalPass = 0;
let totalFail = 0;
let totalTests = 0;
let failedFiles: string[] = [];

for (const file of testFiles) {
  const proc = Bun.spawn(["bun", "test", file], {
    cwd: import.meta.dir,
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const output = stdout + stderr;
  await proc.exited;

  // Parse results from output
  const passMatch = output.match(/(\d+) pass/);
  const failMatch = output.match(/(\d+) fail/);
  const totalMatch = output.match(/Ran (\d+) tests/);

  const pass = passMatch ? parseInt(passMatch[1] ?? '0') : 0;
  const fail = failMatch ? parseInt(failMatch[1] ?? '0') : 0;
  const tests = totalMatch ? parseInt(totalMatch[1] ?? '0') : 0;

  totalPass += pass;
  totalFail += fail;
  totalTests += tests;

  const status = fail > 0 || proc.exitCode !== 0 ? "\x1b[31m✗\x1b[0m" : "\x1b[32m✓\x1b[0m";
  const shortName = file.replace("src/", "").replace("/__tests__/", "/");
  console.log(`  ${status} ${shortName} — ${pass} pass${fail > 0 ? `, ${fail} fail` : ""}`);

  if (fail > 0 || proc.exitCode !== 0) {
    failedFiles.push(file);
    // Show error details for failed files
    const errorLines = output.split("\n").filter(l =>
      l.includes("error:") || l.includes("Error") || l.includes("SyntaxError")
    ).slice(0, 3);
    for (const line of errorLines) {
      console.log(`    ${line.trim()}`);
    }
  }
}

console.log(`\n${"─".repeat(60)}`);
console.log(`  Tests:  ${totalPass} pass, ${totalFail} fail (${totalTests} gesamt)`);
console.log(`  Dateien: ${testFiles.length - failedFiles.length}/${testFiles.length} bestanden`);
if (failedFiles.length > 0) {
  console.log(`\n  Fehlgeschlagen:`);
  for (const f of failedFiles) {
    console.log(`    - ${f}`);
  }
}
console.log();

process.exit(failedFiles.length > 0 ? 1 : 0);
