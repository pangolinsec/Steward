import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, patch, campaignId, c, handleError } from "../client.js";

interface EnvironmentState {
  campaign_id: number;
  current_hour: number;
  current_minute: number;
  current_day: number;
  current_month: number;
  current_year: number;
  weather: string;
  environment_notes: string;
  current_location_id: number | null;
  current_location_name: string | null;
  current_edge_id: number | null;
  time_of_day: string;
  month_name: string;
  calendar_config: { months: { name: string; days: number }[]; weekdays: string[] };
}

interface TimeEvent {
  type: string;
  description?: string;
  from?: string;
  to?: string;
  encounter?: { name: string; description?: string };
  probability?: number;
  message?: string;
  severity?: string;
  rule_name?: string;
  character_name?: string;
  effect_name?: string;
}

interface CharacterSummary {
  id: number;
  name: string;
  type: string;
}

interface ComputedStats {
  character: CharacterSummary;
  base: Record<string, unknown>;
  effective: Record<string, unknown>;
  effects_breakdown: { name: string; remaining_hours: number | null }[];
  items_breakdown: { name: string; quantity: number }[];
}

function formatTime(h: number, m: number): string {
  return `${h}:${String(m).padStart(2, "0")}`;
}

function formatEnvMarkdown(env: EnvironmentState, pcs?: ComputedStats[], unreadCount?: number): string {
  const lines: string[] = [];
  lines.push("## Current State\n");
  lines.push(`**Time:** ${formatTime(env.current_hour, env.current_minute)}, Day ${env.current_day} of ${env.month_name}, Year ${env.current_year} (${env.time_of_day})`);
  lines.push(`**Weather:** ${env.weather}`);
  lines.push(`**Location:** ${env.current_location_name || "Traveling"}`);
  if (env.environment_notes) lines.push(`**Notes:** ${env.environment_notes}`);
  lines.push("");

  if (pcs && pcs.length > 0) {
    lines.push("### Party Members\n");
    for (const pc of pcs) {
      const attrs = Object.entries(pc.effective)
        .filter(([, v]) => typeof v === "number")
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const effects = pc.effects_breakdown
        .map((e) => {
          const dur = e.remaining_hours != null ? `, ${e.remaining_hours}h left` : "";
          return `${e.name}${dur}`;
        })
        .join("; ");
      let line = `- **${pc.character.name}** — ${attrs}`;
      if (effects) line += ` | Effects: ${effects}`;
      lines.push(line);
    }
    lines.push("");
  }

  if (unreadCount != null && unreadCount > 0) {
    lines.push(`### Unread Notifications: ${unreadCount}\n`);
  }

  return lines.join("\n");
}

function formatEventsMarkdown(events: TimeEvent[]): string {
  if (!events || events.length === 0) return "";
  const lines = ["\n### Events\n"];
  for (const e of events) {
    if (e.type === "time_advance") lines.push(`- ${e.description}`);
    else if (e.type === "weather_change") lines.push(`- Weather: ${e.from} -> ${e.to}`);
    else if (e.type === "effect_expired") lines.push(`- Effect expired: ${e.effect_name} on ${e.character_name}`);
    else if (e.type === "encounter_triggered") lines.push(`- **Encounter triggered:** ${e.encounter?.name} (${Math.round((e.probability || 0) * 100)}% chance)`);
    else if (e.type === "rule_notification") lines.push(`- Rule "${e.rule_name}": ${e.message}`);
    else lines.push(`- ${e.type}: ${e.description || e.message || JSON.stringify(e)}`);
  }
  return lines.join("\n");
}

export function registerEnvironmentTools(server: McpServer): void {
  server.registerTool(
    "steward_get_environment",
    {
      title: "Get Environment State",
      description:
        "Get the full current state of the game world: time, date, weather, location, party summary, and notification count. This is the primary situational awareness tool.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID (uses default if omitted)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const [env, pcs, notif] = await Promise.all([
          get<EnvironmentState>(c(cId, "/environment")),
          get<CharacterSummary[]>(c(cId, "/characters?type=PC")).then((chars) =>
            Promise.all(chars.map((ch) => get<ComputedStats>(c(cId, `/characters/${ch.id}/computed`)))),
          ),
          get<{ count: number }>(c(cId, "/notifications/count")),
        ]);
        return { content: [{ type: "text", text: formatEnvMarkdown(env, pcs, notif.count) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_advance_time",
    {
      title: "Advance Time",
      description:
        "Advance the game clock by hours and/or minutes. Triggers weather transitions, rule evaluation, effect expiry, and encounter rolls. Returns all events that occurred.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        hours: z.number().int().min(0).default(0).describe("Hours to advance"),
        minutes: z.number().int().min(0).default(0).describe("Minutes to advance"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<EnvironmentState & { events: TimeEvent[] }>(c(cId, "/environment/advance"), {
          hours: params.hours,
          minutes: params.minutes,
        });
        const envText = formatEnvMarkdown(result);
        const eventsText = formatEventsMarkdown(result.events);
        return { content: [{ type: "text", text: envText + eventsText }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_rest",
    {
      title: "Take Rest",
      description:
        'Take a short rest (1 hour) or long rest (8 hours). Advances time, fires rest-related rules, and expires timed effects.',
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        rest_type: z.enum(["short", "long"]).describe("Rest type: short (1h) or long (8h)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<EnvironmentState & { events: TimeEvent[] }>(c(cId, "/rest"), {
          rest_type: params.rest_type,
        });
        const envText = formatEnvMarkdown(result);
        const eventsText = formatEventsMarkdown(result.events);
        return { content: [{ type: "text", text: `## ${params.rest_type === "long" ? "Long" : "Short"} Rest\n\n` + envText + eventsText }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_travel",
    {
      title: "Travel Along Path",
      description:
        "Travel along a map edge (path between locations). Advances time by the edge's travel hours, rolls encounters, applies weather overrides. Use steward_list_locations to find edge IDs.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        edge_id: z.number().int().describe("Edge (path) ID to travel along"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<{ success: boolean; events: TimeEvent[]; current_location_id: number; current_location_name: string }>(
          c(cId, "/locations/travel"),
          { edge_id: params.edge_id },
        );
        const lines = [`## Travel Complete\n`, `**Arrived at:** ${result.current_location_name}`];
        const eventsText = formatEventsMarkdown(result.events);
        return { content: [{ type: "text", text: lines.join("\n") + eventsText }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_set_party_position",
    {
      title: "Set Party Position",
      description:
        "Instantly move the party to a location (no time advance, no encounter rolls). Use steward_list_locations to find location IDs.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        location_id: z.number().int().describe("Location ID to place the party at"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await patch<{ success: boolean; current_location_id: number; current_location_name: string }>(
          c(cId, "/locations/position"),
          { location_id: params.location_id },
        );
        return { content: [{ type: "text", text: `Party moved to **${result.current_location_name}**` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_environment",
    {
      title: "Update Environment",
      description:
        "Directly set environment fields like weather, time, or notes. Use for manual overrides (e.g., 'it starts snowing').",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        weather: z.string().optional().describe("Set weather (must match campaign weather_options)"),
        current_hour: z.number().int().min(0).max(23).optional().describe("Set hour (0-23)"),
        current_minute: z.number().int().min(0).max(59).optional().describe("Set minute (0-59)"),
        current_day: z.number().int().min(1).optional().describe("Set day of month"),
        current_month: z.number().int().min(1).optional().describe("Set month number"),
        current_year: z.number().int().min(1).optional().describe("Set year"),
        environment_notes: z.string().optional().describe("Set environment notes"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, ...fields } = params;
        const result = await patch<EnvironmentState>(c(cId, "/environment"), fields);
        return { content: [{ type: "text", text: formatEnvMarkdown(result) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
