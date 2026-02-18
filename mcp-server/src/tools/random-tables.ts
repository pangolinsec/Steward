import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, del, campaignId, c, handleError } from "../client.js";

interface RandomTable {
  id: number;
  campaign_id: number;
  name: string;
  description: string;
  table_type: string;
  entries: { text: string; weight?: number }[];
}

interface RollResult {
  result: string;
  roll: number;
  total_weight: number;
  table_name: string;
}

export function registerRandomTableTools(server: McpServer): void {
  server.registerTool(
    "steward_list_random_tables",
    {
      title: "List Random Tables",
      description:
        "List all random tables in the campaign. Filterable by name search. Shows IDs needed for steward_roll_random_table.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        search: z.string().optional().describe("Search by table name"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.search) qp.set("search", params.search);
        const qs = qp.toString();
        const tables = await get<RandomTable[]>(c(cId, `/random-tables${qs ? "?" + qs : ""}`));
        if (tables.length === 0) return { content: [{ type: "text", text: "No random tables found." }] };

        const lines = ["## Random Tables\n"];
        for (const t of tables) {
          const entryCount = t.entries.length;
          lines.push(`- **${t.name}** (id: ${t.id}, ${t.table_type}, ${entryCount} entries)`);
          if (t.description) lines.push(`  ${t.description}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_roll_random_table",
    {
      title: "Roll on Random Table",
      description:
        "Roll on a random table and get a result. The roll is logged to the session log. Use steward_list_random_tables to find table IDs.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        table_id: z.number().int().describe("Random table ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<RollResult>(c(cId, `/random-tables/${params.table_id}/roll`));
        return {
          content: [
            {
              type: "text",
              text: `**${result.table_name}** roll: **${result.result}**`,
            },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- World Building toolset: Random Table CRUD ---

  server.registerTool(
    "steward_create_random_table",
    {
      title: "Create Random Table",
      description:
        'Create a new random table. Entries are { text, weight? } objects. Table type can be "weighted" (default, uses weights) or "sequential" (equal probability).',
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().min(1).describe("Table name"),
        description: z.string().optional().describe("Table description"),
        table_type: z
          .enum(["weighted", "sequential"])
          .optional()
          .describe("Roll type: weighted (uses entry weights) or sequential (equal chance)"),
        entries: z
          .array(
            z.object({
              text: z.string().describe("Entry text (the result)"),
              weight: z.number().optional().describe("Weight for weighted tables (default: 1)"),
            }),
          )
          .optional()
          .describe("Table entries"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<RandomTable>(c(cId, "/random-tables"), {
          name: params.name,
          description: params.description ?? "",
          table_type: params.table_type ?? "weighted",
          entries: params.entries ?? [],
        });
        return { content: [{ type: "text", text: `Random table **${result.name}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_random_table",
    {
      title: "Update Random Table",
      description: "Update a random table. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        table_id: z.number().int().describe("Random table ID"),
        name: z.string().optional().describe("Table name"),
        description: z.string().optional().describe("Table description"),
        table_type: z.enum(["weighted", "sequential"]).optional().describe("Roll type"),
        entries: z
          .array(z.object({ text: z.string(), weight: z.number().optional() }))
          .optional()
          .describe("Table entries (replaces all)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, table_id, ...fields } = params;
        const result = await put<RandomTable>(c(cId, `/random-tables/${table_id}`), fields);
        return { content: [{ type: "text", text: `Random table **${result.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_delete_random_table",
    {
      title: "Delete Random Table",
      description: "Delete a random table.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        table_id: z.number().int().describe("Random table ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/random-tables/${params.table_id}`));
        return { content: [{ type: "text", text: "Random table deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
