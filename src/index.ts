
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "pg";
import { z } from "zod";

// Configure your Postgres connection here
const pgClient = new Client({
  user: process.env.PGUSER || "local_user",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "sigear_tst",
  password: process.env.PGPASSWORD || "local_password",
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 54320,
});

pgClient.connect();



// Define resources separately so tools can access them
const resources = {
  schemas: {
    async list(): Promise<string[]> {
      const res = await pgClient.query("SELECT schema_name FROM information_schema.schemata");
      return res.rows.map((r: { schema_name: string }) => r.schema_name);
    },
  },
  tables: {
    async list({ schema }: { schema: string }): Promise<string[]> {
      const res = await pgClient.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = $1",
        [schema]
      );
      return res.rows.map((r: { table_name: string }) => r.table_name);
    },
  },
  table_ddl: {
    async get({ schema, table }: { schema: string; table: string }): Promise<string | null> {
      const res = await pgClient.query(
        `SELECT 'CREATE TABLE ' || quote_ident(table_schema) || '.' || quote_ident(table_name) || E' (\n' ||
        string_agg('  ' || quote_ident(column_name) || ' ' || data_type ||
          coalesce('(' || character_maximum_length || ')', ''), ',\n') || E'\n);' as ddl
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        GROUP BY table_schema, table_name`,
        [schema, table]
      );
      return res.rows[0]?.ddl || null;
    },
  },
  table_data: {
    async get({ schema, table, limit }: { schema: string; table: string; limit?: number }): Promise<any[]> {
      const actualLimit = limit ?? 10;
      const res = await pgClient.query(
        `SELECT * FROM "${schema}"."${table}" LIMIT $1`,
        [actualLimit]
      );
      return res.rows;
    },
  },
};


// Create server instance
const server = new McpServer({
  name: "postgres-mcp",
  version: "1.0.0",
  capabilities: {
    resources,
    tools: {},
  },
});

// Register tools using server.tool() method
server.tool(
  "listSchemas",
  "List all schemas in the Postgres database",
  {},
  async () => {
    const schemas = await resources.schemas.list();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(schemas, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "listTables",
  "List all tables in a given schema",
  {
    schema: z.string().describe("Schema name"),
  },
  async ({ schema }) => {
    const tables = await resources.tables.list({ schema });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(tables, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "getTableDDL",
  "Get the DDL (CREATE TABLE statement) for a table",
  {
    schema: z.string().describe("Schema name"),
    table: z.string().describe("Table name"),
  },
  async ({ schema, table }) => {
    const ddl = await resources.table_ddl.get({ schema, table });
    return {
      content: [
        {
          type: "text",
          text: ddl || "Table not found or no DDL available",
        },
      ],
    };
  },
);

server.tool(
  "getTableData",
  "Get limited data from a table (default 10 rows)",
  {
    schema: z.string().describe("Schema name"),
    table: z.string().describe("Table name"),
    limit: z.number().optional().describe("Max rows to return (default 10)"),
  },
  async ({ schema, table, limit }) => {
    const data = limit !== undefined 
      ? await resources.table_data.get({ schema, table, limit })
      : await resources.table_data.get({ schema, table });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
    };
  },
);

server.tool(
  "executeSQL",
  "Execute arbitrary SQL queries on the database",
  {
    query: z.string().describe("SQL query to execute"),
    limit: z.number().optional().describe("Maximum number of rows to return (default 100)"),
  },
  async ({ query, limit }) => {
    try {
      // Add LIMIT clause if not present and limit is specified
      let finalQuery = query.trim();
      const actualLimit = limit ?? 100;
      
      // Check if query already has LIMIT clause (case insensitive)
      if (!/LIMIT\s+\d+/i.test(finalQuery)) {
        finalQuery = `${finalQuery} LIMIT ${actualLimit}`;
      }
      
      const result = await pgClient.query(finalQuery);
      
      return {
        content: [
          {
            type: "text",
            text: `Query executed successfully.\nRows affected: ${result.rowCount || 0}\n\nResults:\n${JSON.stringify(result.rows, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `SQL Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Postgres MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});