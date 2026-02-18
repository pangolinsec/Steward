import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, del, campaignId, c, handleError } from "../client.js";

interface SessionPrep {
  id: number;
  campaign_id: number;
  title: string;
  status: string;
  strong_start: string;
  scenes: { text: string; done: boolean; location_ids?: number[] }[];
  secrets: { text: string; revealed: boolean; location_ids?: number[] }[];
  notes: string;
  created_at: string;
  updated_at: string;
}

function formatPrep(p: SessionPrep): string {
  const lines: string[] = [];
  lines.push(`## ${p.title || "(untitled)"} [${p.status}] (id: ${p.id})\n`);
  if (p.strong_start) lines.push(`**Strong Start:** ${p.strong_start}\n`);

  if (p.scenes.length > 0) {
    lines.push("**Scenes:**");
    for (const s of p.scenes) {
      const locSuffix = s.location_ids?.length ? ` [locations: ${s.location_ids.join(", ")}]` : "";
      lines.push(`- [${s.done ? "x" : " "}] ${s.text}${locSuffix}`);
    }
    lines.push("");
  }

  if (p.secrets.length > 0) {
    lines.push("**Secrets & Clues:**");
    for (const s of p.secrets) {
      const locSuffix = s.location_ids?.length ? ` [locations: ${s.location_ids.join(", ")}]` : "";
      lines.push(`- ${s.revealed ? "~~" + s.text + "~~ (revealed)" : s.text}${locSuffix}`);
    }
    lines.push("");
  }

  if (p.notes) lines.push(`**Notes:** ${p.notes}\n`);
  lines.push(`*Created: ${p.created_at} | Updated: ${p.updated_at}*`);
  return lines.join("\n");
}

export function registerSessionPrepTools(server: McpServer): void {
  server.registerTool(
    "steward_list_session_preps",
    {
      title: "List Session Preps",
      description:
        "List session prep sheets. Filterable by status (prep, active, completed).",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        status: z.enum(["prep", "active", "completed"]).optional().describe("Filter by status"),
        limit: z.number().int().min(1).max(100).default(30).describe("Max preps to return"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.status) qp.set("status", params.status);
        qp.set("limit", String(params.limit));
        qp.set("offset", String(params.offset));
        const result = await get<{ preps: SessionPrep[]; total: number }>(c(cId, `/session-preps?${qp}`));
        if (result.preps.length === 0) return { content: [{ type: "text" as const, text: "No session preps found." }] };

        const lines = [`## Session Preps (${result.preps.length} of ${result.total})\n`];
        for (const p of result.preps) {
          const sceneDone = p.scenes.filter(s => s.done).length;
          const secretRevealed = p.secrets.filter(s => s.revealed).length;
          lines.push(
            `- **${p.title || "(untitled)"}** (id: ${p.id}) [${p.status}] — scenes: ${sceneDone}/${p.scenes.length}, secrets: ${secretRevealed}/${p.secrets.length} revealed`,
          );
        }
        if (result.total > params.offset + result.preps.length) {
          lines.push(
            `\n*${result.total - params.offset - result.preps.length} more preps. Use offset=${params.offset + result.preps.length} to see next page.*`,
          );
        }
        return { content: [{ type: "text" as const, text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_get_session_prep",
    {
      title: "Get Session Prep",
      description: "Get full details of a session prep sheet.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        prep_id: z.number().int().describe("Session prep ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const prep = await get<SessionPrep>(c(cId, `/session-preps/${params.prep_id}`));
        return { content: [{ type: "text" as const, text: formatPrep(prep) }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_get_active_session_prep",
    {
      title: "Get Active Session Prep",
      description: "Get the currently active session prep, if any.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const prep = await get<SessionPrep>(c(cId, "/session-preps/active"));
        return { content: [{ type: "text" as const, text: formatPrep(prep) }] };
      } catch (error) {
        if (String(error).includes("404")) {
          return { content: [{ type: "text" as const, text: "No active session prep." }] };
        }
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );

  // --- World Building toolset: Session Prep CRUD ---

  server.registerTool(
    "steward_create_session_prep",
    {
      title: "Create Session Prep",
      description:
        "Create a new session prep sheet. Use carry_forward to copy unrevealed secrets from the most recently completed prep.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        title: z.string().optional().describe("Session title"),
        strong_start: z.string().optional().describe("Strong start description"),
        scenes: z.array(z.object({ text: z.string(), done: z.boolean().default(false), location_ids: z.array(z.number().int()).optional() })).optional().describe("Potential scenes"),
        secrets: z.array(z.object({ text: z.string(), revealed: z.boolean().default(false), location_ids: z.array(z.number().int()).optional() })).optional().describe("Secrets & clues"),
        notes: z.string().optional().describe("General notes"),
        carry_forward: z.boolean().optional().describe("Copy unrevealed secrets from last completed prep"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<SessionPrep>(c(cId, "/session-preps"), {
          title: params.title ?? "New Session",
          strong_start: params.strong_start ?? "",
          scenes: params.scenes ?? [],
          secrets: params.secrets ?? [],
          notes: params.notes ?? "",
          carry_forward: params.carry_forward ?? false,
        });
        return { content: [{ type: "text" as const, text: `Session prep **${result.title}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_session_prep",
    {
      title: "Update Session Prep",
      description: "Update a session prep sheet. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        prep_id: z.number().int().describe("Session prep ID"),
        title: z.string().optional().describe("Session title"),
        strong_start: z.string().optional().describe("Strong start description"),
        scenes: z.array(z.object({ text: z.string(), done: z.boolean().default(false), location_ids: z.array(z.number().int()).optional() })).optional().describe("Potential scenes (replaces all)"),
        secrets: z.array(z.object({ text: z.string(), revealed: z.boolean().default(false), location_ids: z.array(z.number().int()).optional() })).optional().describe("Secrets & clues (replaces all)"),
        notes: z.string().optional().describe("General notes"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, prep_id, ...fields } = params;
        const result = await put<SessionPrep>(c(cId, `/session-preps/${prep_id}`), fields);
        return { content: [{ type: "text" as const, text: `Session prep **${result.title}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_activate_session_prep",
    {
      title: "Activate Session Prep",
      description: "Set a session prep as active. Any previously active prep becomes completed.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        prep_id: z.number().int().describe("Session prep ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await put<SessionPrep>(c(cId, `/session-preps/${params.prep_id}/activate`), {});
        return { content: [{ type: "text" as const, text: `Session prep **${result.title}** is now active.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_complete_session_prep",
    {
      title: "Complete Session Prep",
      description: "Mark a session prep as completed.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        prep_id: z.number().int().describe("Session prep ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await put<SessionPrep>(c(cId, `/session-preps/${params.prep_id}/complete`), {});
        return { content: [{ type: "text" as const, text: `Session prep **${result.title}** marked as completed.` }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_delete_session_prep",
    {
      title: "Delete Session Prep",
      description: "Permanently delete a session prep sheet.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        prep_id: z.number().int().describe("Session prep ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/session-preps/${params.prep_id}`));
        return { content: [{ type: "text" as const, text: "Session prep deleted." }] };
      } catch (error) {
        return { content: [{ type: "text" as const, text: handleError(error) }], isError: true };
      }
    },
  );
}
