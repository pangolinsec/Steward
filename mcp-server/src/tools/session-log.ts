import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, campaignId, c, handleError } from "../client.js";

interface LogEntry {
  id: number;
  campaign_id: number;
  timestamp: string;
  entry_type: string;
  message: string;
}

export function registerSessionLogTools(server: McpServer): void {
  server.registerTool(
    "steward_get_session_log",
    {
      title: "Get Session Log",
      description:
        "Read the session activity log. Shows time advances, weather changes, item/effect changes, travel, encounters, and manual notes. Supports pagination and filtering by entry type.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        limit: z.number().int().min(1).max(200).default(30).describe("Max entries to return"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
        entry_type: z.string().optional().describe("Filter by type: manual, effect_applied, effect_removed, item_assigned, item_removed, travel, rest, encounter_start, encounter_end, time_advance, weather_change"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        qp.set("limit", String(params.limit));
        qp.set("offset", String(params.offset));
        if (params.entry_type) qp.set("entry_type", params.entry_type);
        const result = await get<{ entries: LogEntry[]; total: number }>(c(cId, `/session-log?${qp}`));
        if (result.entries.length === 0) return { content: [{ type: "text", text: "Session log is empty." }] };

        const lines = [`## Session Log (${result.entries.length} of ${result.total})\n`];
        for (const entry of result.entries) {
          const ts = entry.timestamp ? entry.timestamp.split("T")[0] + " " + (entry.timestamp.split("T")[1] || "").slice(0, 5) : "";
          lines.push(`- [${entry.entry_type}] ${entry.message} *(${ts})*`);
        }
        if (result.total > params.offset + result.entries.length) {
          lines.push(`\n*${result.total - params.offset - result.entries.length} more entries. Use offset=${params.offset + result.entries.length} to see next page.*`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_add_log_entry",
    {
      title: "Add Session Log Entry",
      description:
        "Add a manual narrative entry to the session log. Use this to record story beats, player decisions, or DM notes.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        message: z.string().min(1).describe("Log entry text"),
        entry_type: z.string().default("manual").describe("Entry type (default: manual)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<LogEntry>(c(cId, "/session-log"), {
          message: params.message,
          entry_type: params.entry_type,
        });
        return { content: [{ type: "text", text: `Log entry added (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
