import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, c, campaignId, handleError } from "../client.js";

export function registerImportExportTools(server: McpServer): void {
  server.registerTool(
    "steward_export_campaign",
    {
      title: "Export Campaign",
      description:
        "Export a full campaign as JSON. Includes all settings, characters, items, effects, locations, edges, encounters, rules, environment state, and session log.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const data = await get<Record<string, unknown>>(c(cId, "/export"));
        const name = (data.campaign as Record<string, unknown>)?.name ?? "campaign";
        const json = JSON.stringify(data, null, 2);
        return {
          content: [
            { type: "text", text: `## Exported: ${name}\n\nFull campaign JSON (${json.length} characters):\n\n\`\`\`json\n${json}\n\`\`\`` },
          ],
        };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_import_campaign",
    {
      title: "Import Campaign",
      description:
        "Import a full campaign from JSON (creates a new campaign). The data should be in the same format as steward_export_campaign output.",
      inputSchema: {
        data: z.record(z.unknown()).describe("Full campaign JSON (same structure as export output)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const result = await post<{ id: number; name: string }>("/campaigns/_/import", params.data);
        return { content: [{ type: "text", text: `Campaign **${result.name}** imported (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
