
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Client } from "pg";
import mysql from "mysql2/promise";
import { z } from "zod";

// Determine database type from environment
const dbType = process.env.DB_TYPE || "postgres"; // "postgres" or "mysql"

// Configure your Postgres connection here
const pgClient = dbType === "postgres" ? new Client({
  user: process.env.PGUSER || "local_user",
  host: process.env.PGHOST || "localhost",
  database: process.env.PGDATABASE || "sigear_tst",
  password: process.env.PGPASSWORD || "local_password",
  port: process.env.PGPORT ? parseInt(process.env.PGPORT) : 54320,
}) : null as any;

// Configure your MySQL connection here
let mysqlConnection: mysql.Connection | null = null;
if (dbType === "mysql") {
  mysqlConnection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || "localhost",
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "password",
    database: process.env.MYSQL_DATABASE || "test",
    port: process.env.MYSQL_PORT ? parseInt(process.env.MYSQL_PORT) : 3306,
  });
}

if (pgClient) {
  pgClient.connect();
}



// Define resources separately so tools can access them
const resources = {
  schemas: {
    async list(): Promise<string[]> {
      if (dbType === "postgres") {
        const res = await pgClient.query("SELECT schema_name FROM information_schema.schemata");
        return res.rows.map((r: { schema_name: string }) => r.schema_name);
      } else {
        const [rows] = await mysqlConnection!.query("SELECT schema_name FROM information_schema.schemata");
        return (rows as any[]).map((r: { schema_name: string }) => r.schema_name);
      }
    },
  },
  tables: {
    async list({ schema }: { schema: string }): Promise<string[]> {
      if (dbType === "postgres") {
        const res = await pgClient.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = $1",
          [schema]
        );
        return res.rows.map((r: { table_name: string }) => r.table_name);
      } else {
        const [rows] = await mysqlConnection!.query(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = ?",
          [schema]
        );
        return (rows as any[]).map((r: { table_name: string }) => r.table_name);
      }
    },
  },
  table_ddl: {
    async get({ schema, table }: { schema: string; table: string }): Promise<string | null> {
      if (dbType === "postgres") {
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
      } else {
        const [rows] = await mysqlConnection!.query(
          `SELECT CONCAT('CREATE TABLE \`', table_schema, '\`.\`', table_name, '\` (\n',
            GROUP_CONCAT(
              CONCAT('  \`', column_name, '\` ', column_type,
                CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END)
              ORDER BY ordinal_position SEPARATOR ',\n'
            ), '\n);') as ddl
          FROM information_schema.columns
          WHERE table_schema = ? AND table_name = ?
          GROUP BY table_schema, table_name`,
          [schema, table]
        );
        return (rows as any[])[0]?.ddl || null;
      }
    },
  },
  table_data: {
    async get({ schema, table, limit }: { schema: string; table: string; limit?: number }): Promise<any[]> {
      const actualLimit = limit ?? 10;
      if (dbType === "postgres") {
        const res = await pgClient.query(
          `SELECT * FROM "${schema}"."${table}" LIMIT $1`,
          [actualLimit]
        );
        return res.rows;
      } else {
        const [rows] = await mysqlConnection!.query(
          `SELECT * FROM \`${schema}\`.\`${table}\` LIMIT ?`,
          [actualLimit]
        );
        return rows as any[];
      }
    },
  },
  table_relationships: {
    async get({ schema, table }: { schema: string; table: string }): Promise<{ outbound: any[]; inbound: any[] }> {
      if (dbType === "postgres") {
        const outboundQuery = `
          SELECT
            tc.constraint_name,
            kcu.table_schema   AS source_table_schema,
            kcu.table_name     AS source_table_name,
            ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position) AS source_columns,
            ccu.table_schema   AS target_table_schema,
            ccu.table_name     AS target_table_name,
            ARRAY_AGG(ccu.column_name ORDER BY kcu.ordinal_position) AS target_columns,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.constraint_schema = kcu.constraint_schema
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
           AND tc.constraint_schema = rc.constraint_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON rc.unique_constraint_name = ccu.constraint_name
           AND rc.unique_constraint_schema = ccu.constraint_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = $1
            AND tc.table_name = $2
          GROUP BY
            tc.constraint_name,
            kcu.table_schema,
            kcu.table_name,
            ccu.table_schema,
            ccu.table_name,
            rc.update_rule,
            rc.delete_rule
          ORDER BY tc.constraint_name`;

        const inboundQuery = `
          SELECT
            tc.constraint_name,
            kcu.table_schema   AS source_table_schema,
            kcu.table_name     AS source_table_name,
            ARRAY_AGG(kcu.column_name ORDER BY kcu.ordinal_position) AS source_columns,
            ccu.table_schema   AS target_table_schema,
            ccu.table_name     AS target_table_name,
            ARRAY_AGG(ccu.column_name ORDER BY kcu.ordinal_position) AS target_columns,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
           AND tc.constraint_schema = kcu.constraint_schema
          JOIN information_schema.referential_constraints AS rc
            ON tc.constraint_name = rc.constraint_name
           AND tc.constraint_schema = rc.constraint_schema
          JOIN information_schema.constraint_column_usage AS ccu
            ON rc.unique_constraint_name = ccu.constraint_name
           AND rc.unique_constraint_schema = ccu.constraint_schema
          WHERE tc.constraint_type = 'FOREIGN KEY'
            AND ccu.table_schema = $1
            AND ccu.table_name = $2
          GROUP BY
            tc.constraint_name,
            kcu.table_schema,
            kcu.table_name,
            ccu.table_schema,
            ccu.table_name,
            rc.update_rule,
            rc.delete_rule
          ORDER BY tc.constraint_name`;

        const [outbound, inbound] = await Promise.all([
          pgClient.query(outboundQuery, [schema, table]).then(r => r.rows),
          pgClient.query(inboundQuery, [schema, table]).then(r => r.rows),
        ]);

        return { outbound, inbound };
      } else {
        // MySQL foreign key relationships
        const outboundQuery = `
          SELECT
            kcu.constraint_name,
            kcu.table_schema AS source_table_schema,
            kcu.table_name AS source_table_name,
            GROUP_CONCAT(kcu.column_name ORDER BY kcu.ordinal_position) AS source_columns,
            kcu.referenced_table_schema AS target_table_schema,
            kcu.referenced_table_name AS target_table_name,
            GROUP_CONCAT(kcu.referenced_column_name ORDER BY kcu.ordinal_position) AS target_columns,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.referential_constraints rc
            ON kcu.constraint_name = rc.constraint_name
            AND kcu.constraint_schema = rc.constraint_schema
          WHERE kcu.referenced_table_name IS NOT NULL
            AND kcu.table_schema = ?
            AND kcu.table_name = ?
          GROUP BY
            kcu.constraint_name,
            kcu.table_schema,
            kcu.table_name,
            kcu.referenced_table_schema,
            kcu.referenced_table_name,
            rc.update_rule,
            rc.delete_rule
          ORDER BY kcu.constraint_name`;

        const inboundQuery = `
          SELECT
            kcu.constraint_name,
            kcu.table_schema AS source_table_schema,
            kcu.table_name AS source_table_name,
            GROUP_CONCAT(kcu.column_name ORDER BY kcu.ordinal_position) AS source_columns,
            kcu.referenced_table_schema AS target_table_schema,
            kcu.referenced_table_name AS target_table_name,
            GROUP_CONCAT(kcu.referenced_column_name ORDER BY kcu.ordinal_position) AS target_columns,
            rc.update_rule,
            rc.delete_rule
          FROM information_schema.key_column_usage kcu
          JOIN information_schema.referential_constraints rc
            ON kcu.constraint_name = rc.constraint_name
            AND kcu.constraint_schema = rc.constraint_schema
          WHERE kcu.referenced_table_name IS NOT NULL
            AND kcu.referenced_table_schema = ?
            AND kcu.referenced_table_name = ?
          GROUP BY
            kcu.constraint_name,
            kcu.table_schema,
            kcu.table_name,
            kcu.referenced_table_schema,
            kcu.referenced_table_name,
            rc.update_rule,
            rc.delete_rule
          ORDER BY kcu.constraint_name`;

        const [outboundResult, inboundResult] = await Promise.all([
          mysqlConnection!.query(outboundQuery, [schema, table]),
          mysqlConnection!.query(inboundQuery, [schema, table]),
        ]);

        return {
          outbound: outboundResult[0] as any[],
          inbound: inboundResult[0] as any[],
        };
      }
    },
  },
};


// Create server instance
const server = new McpServer({
  name: dbType === "postgres" ? "postgres-mcp" : "mysql-mcp",
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
  "getTableRelationships",
  "Get inbound and outbound foreign key relationships for a table",
  {
    schema: z.string().describe("Schema name"),
    table: z.string().describe("Table name"),
  },
  async ({ schema, table }) => {
    const rels = await resources.table_relationships.get({ schema, table });
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(rels, null, 2),
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
      
      if (dbType === "postgres") {
        const result = await pgClient.query(finalQuery);
        return {
          content: [
            {
              type: "text",
              text: `Query executed successfully.\nRows affected: ${result.rowCount || 0}\n\nResults:\n${JSON.stringify(result.rows, null, 2)}`,
            },
          ],
        };
      } else {
        const [rows, fields] = await mysqlConnection!.query(finalQuery);
        const rowsArray = rows as any[];
        return {
          content: [
            {
              type: "text",
              text: `Query executed successfully.\nRows affected: ${Array.isArray(rowsArray) ? rowsArray.length : 0}\n\nResults:\n${JSON.stringify(rowsArray, null, 2)}`,
            },
          ],
        };
      }
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
  console.error(`${dbType === "postgres" ? "Postgres" : "MySQL"} MCP Server running on stdio`);
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});