---
name: Tool Registry
version: 1.0
---

# Tool Registry

## Available Tools

### file_read
Reads the contents of a file from the data directory.

**Parameters:**
- `path` (string, required): File path relative to data directory

**Example:**
```json
{
  "path": "config/settings.md"
}
```

### file_write
Writes content to a file in the data directory.

**Parameters:**
- `path` (string, required): File path relative to data directory
- `content` (string, required): Content to write

**Example:**
```json
{
  "path": "memory/notes.md",
  "content": "# My Notes\n\nSome content here."
}
```

### file_list
Lists files and directories within a path.

**Parameters:**
- `path` (string, required): Directory path relative to data directory

**Example:**
```json
{
  "path": "config"
}
```

## Security

All file operations are restricted to the `/data/` directory. Path traversal attempts are blocked.
