# MCP: PostgreSQL/MySQL MCP Server

A Model Context Protocol (MCP) server written in TypeScript that exposes PostgreSQL or MySQL database utilities over stdio.

- List schemas and tables
- Generate simple table DDL
- Preview table data
- Discover table relationships
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
The entry point is `dist/index.js`. Provide environment variables to configure your database.

### PostgreSQL Example:
```bash
DB_TYPE=postgres \
PGUSER=local_user \
PGPASSWORD=local_password \
PGHOST=localhost \
PGDATABASE=sigear_tst \
PGPORT=54320 \
node ./dist/index.js
```

### MySQL Example:
```bash
DB_TYPE=mysql \
MYSQL_HOST=localhost \
MYSQL_USER=root \
MYSQL_PASSWORD=password \
MYSQL_DATABASE=test \
MYSQL_PORT=3306 \
node ./dist/index.js
```

You should see:
```
Postgres MCP Server running on stdio
```
or
```
MySQL MCP Server running on stdio
```

## Configure (Environment)
The server (`src/index.ts`) reads these variables:

### Common:
- `DB_TYPE` – Set to `"postgres"` or `"mysql"` (default: `"postgres"`)

### PostgreSQL:
- `PGUSER` (default: `local_user`)
- `PGPASSWORD` (default: `local_password`)
- `PGHOST` (default: `localhost`)
- `PGDATABASE` (default: `sigear_tst`)
- `PGPORT` (default: `54320`)

### MySQL:
- `MYSQL_HOST` (default: `localhost`)
- `MYSQL_USER` (default: `root`)
- `MYSQL_PASSWORD` (default: `password`)
- `MYSQL_DATABASE` (default: `test`)
- `MYSQL_PORT` (default: `3306`)

Set them per your DB.

## Add to Cursor (MCP) – Local Server
Cursor supports MCP providers via `~/.cursor/mcp.json` (or project `.cursor/mcp.json`). Add an entry pointing to the built JS file and stdio transport.

### PostgreSQL Configuration:
```json
{
  "$schema": "https://schemas.cursor.sh/mcp.json",
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": ["/home/monte/projetos/mcp/dist/index.js"],
      "env": {
        "DB_TYPE": "postgres",
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

### MySQL Configuration:
```json
{
  "$schema": "https://schemas.cursor.sh/mcp.json",
  "mcpServers": {
    "mysql-mcp": {
      "command": "node",
      "args": ["/home/monte/projetos/mcp/dist/index.js"],
      "env": {
        "DB_TYPE": "mysql",
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "password",
        "MYSQL_DATABASE": "test",
        "MYSQL_PORT": "3306"
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

### PostgreSQL Configuration:
```json
{
  "servers": {
    "postgres-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/monte/projetos/mcp/dist/index.js"],
      "env": {
        "DB_TYPE": "postgres",
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
### MySQL Configuration:
```json
{
  "servers": {
    "mysql-mcp": {
      "type": "stdio",
      "command": "node",
      "args": ["/home/monte/projetos/mcp/dist/index.js"],
      "env": {
        "DB_TYPE": "mysql",
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "root",
        "MYSQL_PASSWORD": "password",
        "MYSQL_DATABASE": "test",
        "MYSQL_PORT": "3306"
      }
    }
  }
}
```

4) Reload VS Code. Open the Copilot Chat view, ensure the MCP server is listed/enabled, and use tools by name (e.g., `listSchemas`).

Tip: Newer Copilot builds also support adding servers via the Command Palette (try: "MCP: Add Server").

## Capabilities (Tools)
- `listSchemas()` – List all schemas/databases.
- `listTables(schema)` – List tables for a schema/database.
- `getTableDDL(schema, table)` – Generate a basic `CREATE TABLE` DDL from information_schema.
- `getTableData(schema, table, limit=10)` – Return up to `limit` rows.
- `getTableRelationships(schema, table)` – Get inbound and outbound foreign key relationships.
- `executeSQL(query, limit=100)` – Execute arbitrary SQL; auto‑appends `LIMIT` if missing.

Supports both PostgreSQL and MySQL. Choose the database type via the `DB_TYPE` environment variable.

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
- Connection refused/timeouts: verify `PGHOST`/`MYSQL_HOST`, `PGPORT`/`MYSQL_PORT`, and DB accessibility.
- Auth errors: confirm `PGUSER`/`MYSQL_USER` and `PGPASSWORD`/`MYSQL_PASSWORD` are valid.
- No results: check schema/database/table names are correct and user has privileges.
- Wrong database type: ensure `DB_TYPE` is set to `"postgres"` or `"mysql"`.

## License
ISC
