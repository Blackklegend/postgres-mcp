# MCP: Postgres MCP Server

A Model Context Protocol (MCP) server written in TypeScript that exposes Postgres database utilities over stdio.

- List schemas and tables
- Generate simple table DDL
- Preview table data
- Execute ad‑hoc SQL with safe default limits

Works with MCP-compatible IDEs/clients like Cursor and GitHub Copilot for VS Code.

## Requirements
- Node.js 18+
- npm
- TypeScript (via dev dependency)
- A reachable Postgres instance

## Install
```bash
npm install
```

## Build
```bash
npm run build
```
This compiles TypeScript from `src/` into `dist/` and makes `dist/index.js` executable.

## Run (direct)
The entry point is `dist/index.js`. Provide environment variables to configure Postgres.

```bash
# Example (with defaults) – update to your environment
PGUSER=local_user \
PGPASSWORD=local_password \
PGHOST=localhost \
PGDATABASE=sigear_tst \
PGPORT=54320 \
node ./dist/index.js
```

You should see:
```
Postgres MCP Server running on stdio
```

## Configure (Environment)
The server (`src/index.ts`) reads these variables:
- `PGUSER` (default: `local_user`)
- `PGPASSWORD` (default: `local_password`)
- `PGHOST` (default: `localhost`)
- `PGDATABASE` (default: `sigear_tst`)
- `PGPORT` (default: `54320`)

Set them per your DB.

## Add to Cursor (MCP) – Local Server
Cursor supports MCP providers via `~/.cursor/mcp.json` (or project `.cursor/mcp.json`). Add an entry pointing to the built JS file and stdio transport.

Example configuration:
```json
{
  "$schema": "https://schemas.cursor.sh/mcp.json",
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": ["/home/monte/projetos/mcp/dist/index.js"],
      "env": {
        "PGUSER": "local_user",
        "PGPASSWORD": "local_password",
        "PGHOST": "localhost",
        "PGDATABASE": "sigear_tst",
        "PGPORT": "54320"
      }
    }
  }
}
```
After saving the config, restart Cursor. In the MCP panel, enable the server and test the tools.

## Add to VS Code (GitHub Copilot)
GitHub Copilot for VS Code supports MCP servers. After building this project:

1) Install the "GitHub Copilot" extension in VS Code.
2) Open Settings (JSON): File → Preferences → Settings → Open Settings (JSON).
3) Add/merge the MCP server configuration:
```json
{
  "servers": {
    "postgres-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/monte/projetos/mcp/dist/index.js"],
      "env": {
        "PGUSER": "local_user",
        "PGPASSWORD": "local_password",
        "PGHOST": "localhost",
        "PGDATABASE": "sigear_tst",
        "PGPORT": "54320"
      }
    }
  }
}
```
4) Reload VS Code. Open the Copilot Chat view, ensure the MCP server is listed/enabled, and use tools by name (e.g., `listSchemas`).

Tip: Newer Copilot builds also support adding servers via the Command Palette (try: "MCP: Add Server").

## Capabilities (Tools)
- `listSchemas()` – List all schemas in the database.
- `listTables(schema)` – List tables for a schema.
- `getTableDDL(schema, table)` – Generate a basic `CREATE TABLE` DDL from information_schema.
- `getTableData(schema, table, limit=10)` – Return up to `limit` rows.
- `executeSQL(query, limit=100)` – Execute arbitrary SQL; auto‑appends `LIMIT` if missing.

Example prompts (from an MCP client like Cursor/Copilot):
- "Run `listSchemas`."
- "Use `listTables` with schema `public`."
- "Get DDL for table `public.users` using `getTableDDL`."
- "Preview 5 rows from `public.users` using `getTableData` with limit 5."
- "Run `executeSQL` with `SELECT id, email FROM public.users ORDER BY id` limit 50."

## Development Notes
- Source: `src/index.ts`
- Build output: `dist/`
- TypeScript config: `tsconfig.json`
- Package scripts: `npm run build`

## Troubleshooting
- Connection refused/timeouts: verify `PGHOST`, `PGPORT`, and DB accessibility.
- Auth errors: confirm `PGUSER`/`PGPASSWORD` are valid.
- No results: check schema/table names are correct and user has privileges.

## License
ISC
