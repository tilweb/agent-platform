# Persistenz

Die Plattform verwendet dateibasierte Persistenz. Jede App speichert ihre Daten unter `backend/data/apps/<app-id>/`. Es gibt keine Datenbank — Daten werden als YAML- oder JSON-Dateien gelesen und geschrieben.

## Verzeichnisstruktur

```
backend/data/apps/<app-id>/
├── items/
│   ├── item_1234.yaml
│   └── item_5678.yaml
├── config.yaml          (optional: App-Konfiguration)
└── ...
```

## Lesen und Schreiben mit Bun.file

Verwenden Sie `Bun.file()` für alle Dateioperationen — nicht `node:fs`:

### Datei lesen

```typescript
import { parse } from 'yaml';

async function loadItem(id: string): Promise<ItemData | null> {
  const path = `${ITEMS_DIR}/${id}.yaml`;
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return null;
  }

  const content = await file.text();
  return parse(content) as ItemData;
}
```

### Datei schreiben

```typescript
import { stringify } from 'yaml';

async function saveItem(item: ItemData): Promise<void> {
  const path = `${ITEMS_DIR}/${item.id}.yaml`;
  await Bun.write(path, stringify(item));
}
```

### Datei löschen

```typescript
import { unlink } from 'node:fs/promises';

async function deleteItemFile(id: string): Promise<boolean> {
  const path = `${ITEMS_DIR}/${id}.yaml`;
  const file = Bun.file(path);

  if (!(await file.exists())) {
    return false;
  }

  await unlink(path);
  return true;
}
```

### Alle Dateien auflisten

```typescript
import { readdir } from 'node:fs/promises';
import { parse } from 'yaml';

async function listItemFiles(): Promise<ItemData[]> {
  const dir = ITEMS_DIR;

  try {
    const files = await readdir(dir);
    const items: ItemData[] = [];

    for (const file of files) {
      if (!file.endsWith('.yaml')) continue;

      const content = await Bun.file(`${dir}/${file}`).text();
      items.push(parse(content) as ItemData);
    }

    return items;
  } catch {
    return [];
  }
}
```

## Storage-Modul

Kapseln Sie alle Dateioperationen in einem `storage.ts`-Modul:

```typescript
// backend/src/apps/meine-app/storage.ts

import { parse, stringify } from 'yaml';
import { readdir, unlink, mkdir } from 'node:fs/promises';
import { join } from 'path';
import { APPS_DIR } from '../../utils/paths';

const APP_DIR = join(APPS_DIR, 'meine-app');
const ITEMS_DIR = join(APP_DIR, 'items');

/**
 * Verzeichnis beim ersten Zugriff erstellen
 */
async function ensureDir(): Promise<void> {
  await mkdir(ITEMS_DIR, { recursive: true });
}

export async function loadItem(id: string): Promise<ItemData | null> {
  const file = Bun.file(join(ITEMS_DIR, `${id}.yaml`));
  if (!(await file.exists())) return null;
  return parse(await file.text()) as ItemData;
}

export async function saveItem(item: ItemData): Promise<void> {
  await ensureDir();
  await Bun.write(join(ITEMS_DIR, `${item.id}.yaml`), stringify(item));
}

export async function deleteItemFile(id: string): Promise<boolean> {
  const path = join(ITEMS_DIR, `${id}.yaml`);
  if (!(await Bun.file(path).exists())) return false;
  await unlink(path);
  return true;
}

export async function listItemFiles(): Promise<ItemData[]> {
  await ensureDir();
  const files = await readdir(ITEMS_DIR);
  const items: ItemData[] = [];

  for (const f of files) {
    if (!f.endsWith('.yaml')) continue;
    const content = await Bun.file(join(ITEMS_DIR, f)).text();
    items.push(parse(content) as ItemData);
  }

  return items;
}
```

## YAML vs. JSON

| Format | Verwendung |
|--------|------------|
| YAML | Strukturierte Daten, Konfiguration, Metadaten |
| JSON | Schnelle Serialisierung, Bulk-Daten |

Die meisten Apps verwenden YAML für bessere Lesbarkeit. Für Daten, die selten manuell bearbeitet werden, ist JSON ebenfalls möglich.

## Pfade

Importieren Sie Basispfade aus den zentralen Utilities:

```typescript
import { APPS_DIR } from '../../utils/paths';
import { join } from 'path';

const MY_APP_DIR = join(APPS_DIR, 'meine-app');
```

> [!tip]
> Erstellen Sie Verzeichnisse immer mit `mkdir(dir, { recursive: true })`, bevor Sie schreiben. Das ist idempotent und verhindert Fehler beim ersten Start.

## Dateibenennung

Verwenden Sie die ID als Dateinamen:

```
items/item_1708000000000.yaml   ← ID = item_1708000000000
items/item_1708000001234.yaml   ← ID = item_1708000001234
```

Das ermöglicht direkten Zugriff über die ID ohne Index-Datei.
