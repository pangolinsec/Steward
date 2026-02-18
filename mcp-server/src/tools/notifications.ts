import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, patch, campaignId, c, handleError } from "../client.js";

interface Notification {
  id: number;
  batch_id: string;
  rule_id: number;
  rule_name: string;
  notification_type: string;
  message: string;
  severity: string;
  target_character_id: number | null;
  target_character_name: string | null;
  actions_data: unknown;
  read: number;
  dismissed: number;
  created_at: string;
}

function formatNotifications(notifications: Notification[]): string {
  if (notifications.length === 0) return "No notifications.";
  const lines = ["## Notifications\n"];
  for (const n of notifications) {
    const icon = n.severity === "warning" ? "[!]" : n.severity === "error" ? "[!!]" : "";
    const typeLabel = n.notification_type === "suggestion" ? " (suggestion - can apply)"
      : n.notification_type === "auto_applied" ? " (auto-applied - can undo)"
      : "";
    const target = n.target_character_name ? ` | ${n.target_character_name}` : "";
    const readStatus = n.read ? " [read]" : "";
    lines.push(`- **#${n.id}** ${icon} ${n.message}${target}${typeLabel}${readStatus}`);
    lines.push(`  Rule: ${n.rule_name} | ${n.created_at}`);
  }
  return lines.join("\n");
}

export function registerNotificationTools(server: McpServer): void {
  server.registerTool(
    "almanac_get_notifications",
    {
      title: "Get Notifications",
      description:
        "Get pending notifications from the rules engine. Includes suggestions (approvable) and auto-applied actions (undoable). Returns notification IDs for use with apply/dismiss/undo tools.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        unread_only: z.boolean().default(true).describe("Only show unread notifications"),
        limit: z.number().int().min(1).max(100).default(20).describe("Max notifications to return"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.unread_only) qp.set("unread_only", "true");
        qp.set("limit", String(params.limit));
        const notifications = await get<Notification[]>(c(cId, `/notifications?${qp}`));
        return { content: [{ type: "text", text: formatNotifications(notifications) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_apply_notification",
    {
      title: "Apply Suggested Actions",
      description:
        'Apply the suggested actions from a "suggestion" type notification. This executes the rule\'s actions that were pending approval.',
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        notification_id: z.number().int().describe("Notification ID to apply"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<{ success: boolean; results: unknown[] }>(
          c(cId, `/notifications/${params.notification_id}/apply`),
        );
        return { content: [{ type: "text", text: `Actions applied. ${(result.results || []).length} action(s) executed.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_dismiss_notification",
    {
      title: "Dismiss Notification",
      description: "Dismiss a notification without applying its actions.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        notification_id: z.number().int().describe("Notification ID to dismiss"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await patch(c(cId, `/notifications/${params.notification_id}/dismiss`));
        return { content: [{ type: "text", text: "Notification dismissed." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_undo_notification",
    {
      title: "Undo Auto-Applied Actions",
      description:
        "Undo auto-applied rule actions (reverts attribute changes, re-adds consumed items, etc). Only works for auto_applied notification type.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        notification_id: z.number().int().describe("Notification ID to undo"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<{ success: boolean; undone: number }>(
          c(cId, `/notifications/${params.notification_id}/undo`),
        );
        return { content: [{ type: "text", text: `Undone ${result.undone} action(s).` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
