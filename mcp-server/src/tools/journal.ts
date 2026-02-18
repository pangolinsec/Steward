import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, del, campaignId, c, handleError } from "../client.js";

interface JournalNote {
  id: number;
  campaign_id: number;
  title: string;
  content: string;
  tags: string[];
  starred: boolean;
  created_at: string;
  updated_at: string;
}

export function registerJournalTools(server: McpServer): void {
  server.registerTool(
    "steward_list_journal",
    {
      title: "List Journal Notes",
      description:
        "List DM journal notes. Filterable by search text, tag, or starred status. Notes support wikilinks to campaign entities.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        search: z.string().optional().describe("Search in title and content"),
        tag: z.string().optional().describe("Filter by tag"),
        starred: z.boolean().optional().describe("Only show starred notes"),
        limit: z.number().int().min(1).max(100).default(30).describe("Max notes to return"),
        offset: z.number().int().min(0).default(0).describe("Pagination offset"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.search) qp.set("search", params.search);
        if (params.tag) qp.set("tag", params.tag);
        if (params.starred) qp.set("starred", "1");
        qp.set("limit", String(params.limit));
        qp.set("offset", String(params.offset));
        const result = await get<{ notes: JournalNote[]; total: number }>(c(cId, `/journal?${qp}`));
        if (result.notes.length === 0) return { content: [{ type: "text", text: "No journal notes found." }] };

        const lines = [`## Journal Notes (${result.notes.length} of ${result.total})\n`];
        for (const n of result.notes) {
          const star = n.starred ? " [starred]" : "";
          const tags = n.tags.length > 0 ? ` [${n.tags.join(", ")}]` : "";
          lines.push(`- **${n.title || "(untitled)"}** (id: ${n.id})${star}${tags}`);
          if (n.content) {
            const preview = n.content.length > 100 ? n.content.slice(0, 100) + "..." : n.content;
            lines.push(`  ${preview}`);
          }
        }
        if (result.total > params.offset + result.notes.length) {
          lines.push(
            `\n*${result.total - params.offset - result.notes.length} more notes. Use offset=${params.offset + result.notes.length} to see next page.*`,
          );
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_get_journal_note",
    {
      title: "Get Journal Note",
      description: "Get the full content of a journal note.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        note_id: z.number().int().describe("Journal note ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const note = await get<JournalNote>(c(cId, `/journal/${params.note_id}`));
        const lines: string[] = [];
        const star = note.starred ? " [starred]" : "";
        const tags = note.tags.length > 0 ? `\n**Tags:** ${note.tags.join(", ")}` : "";
        lines.push(`## ${note.title || "(untitled)"}${star}${tags}\n`);
        lines.push(note.content || "*(empty)*");
        lines.push(`\n---\n*Created: ${note.created_at} | Updated: ${note.updated_at}*`);
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- World Building toolset: Journal CRUD ---

  server.registerTool(
    "steward_create_journal_note",
    {
      title: "Create Journal Note",
      description:
        "Create a new DM journal note. Supports wikilinks like [[Character Name]] to link to campaign entities.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        title: z.string().optional().describe("Note title"),
        content: z.string().optional().describe("Note content (supports wikilinks like [[Entity Name]])"),
        tags: z.array(z.string()).optional().describe("Tags for organization"),
        starred: z.boolean().optional().describe("Star this note (default: false)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<JournalNote>(c(cId, "/journal"), {
          title: params.title ?? "",
          content: params.content ?? "",
          tags: params.tags ?? [],
          starred: params.starred ?? false,
        });
        return { content: [{ type: "text", text: `Journal note **${result.title || "(untitled)"}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_journal_note",
    {
      title: "Update Journal Note",
      description: "Update a journal note. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        note_id: z.number().int().describe("Journal note ID"),
        title: z.string().optional().describe("Note title"),
        content: z.string().optional().describe("Note content"),
        tags: z.array(z.string()).optional().describe("Tags (replaces all)"),
        starred: z.boolean().optional().describe("Star/unstar the note"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, note_id, ...fields } = params;
        const result = await put<JournalNote>(c(cId, `/journal/${note_id}`), fields);
        return { content: [{ type: "text", text: `Journal note **${result.title || "(untitled)"}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_delete_journal_note",
    {
      title: "Delete Journal Note",
      description: "Permanently delete a journal note.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        note_id: z.number().int().describe("Journal note ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/journal/${params.note_id}`));
        return { content: [{ type: "text", text: "Journal note deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
