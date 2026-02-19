# Backend — Projekt-spezifische Hinweise

## Bun Runtime

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- `.env` liegt im Root-Verzeichnis. Bun lädt sie via `--env-file=../.env` (siehe `package.json`). Kein dotenv verwenden.

## System-Abhängigkeiten

- **ffmpeg**: Wird für Audio-Transkription benötigt (Konvertierung von WebM/M4A zu MP3)
  - Installation: `brew install ffmpeg` (macOS) / `apk add ffmpeg` (Alpine)

## APIs

- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use Hono for routing (not Express, not `Bun.serve()` direkt)
- `bun:test` for tests
- `Bun.$\`cmd\`` instead of execa for shell commands

## Testing

```ts
import { test, expect } from "bun:test";

test("example", () => {
  expect(1).toBe(1);
});
```

Run with: `bun test`
