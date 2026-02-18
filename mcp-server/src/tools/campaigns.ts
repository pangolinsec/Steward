import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, put, campaignId, handleError } from "../client.js";

interface CampaignSummary {
  id: number;
  name: string;
  created_at: string;
}

interface Campaign extends CampaignSummary {
  attribute_definitions: { key: string; label: string; type?: string; options?: string[] }[];
  time_of_day_thresholds: { label: string; start: number }[];
  calendar_config: { months: { name: string; days: number }[]; weekdays: string[] };
  weather_options: string[];
  encounter_settings: { enabled: boolean; base_rate: number; min_interval_hours: number };
  weather_volatility: number;
  rules_settings: { cascade_depth_limit: number; engine_enabled: boolean };
  season_options: string[];
}

export function registerCampaignTools(server: McpServer): void {
  server.registerTool(
    "almanac_list_campaigns",
    {
      title: "List Campaigns",
      description: "List all campaigns. Use this to discover campaign IDs.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const campaigns = await get<CampaignSummary[]>("/campaigns");
        if (campaigns.length === 0) return { content: [{ type: "text", text: "No campaigns found." }] };
        const lines = ["## Campaigns\n"];
        for (const c of campaigns) {
          lines.push(`- **${c.name}** (id: ${c.id})`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_get_campaign",
    {
      title: "Get Campaign Details",
      description:
        "Get full campaign settings: attribute definitions, calendar, weather options, encounter settings, time-of-day labels, and more. Essential for understanding the campaign's configuration.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const campaign = await get<Campaign>(`/campaigns/${cId}`);
        const lines = [`## ${campaign.name}\n`];

        // Attributes
        lines.push("### Attributes\n");
        for (const a of campaign.attribute_definitions) {
          if (a.type === "tag") {
            lines.push(`- **${a.label}** (\`${a.key}\`, tag) — options: ${a.options?.join(", ")}`);
          } else {
            lines.push(`- **${a.label}** (\`${a.key}\`, numeric)`);
          }
        }
        lines.push("");

        // Calendar
        lines.push("### Calendar\n");
        const monthList = campaign.calendar_config.months.map((m) => `${m.name} (${m.days}d)`).join(", ");
        lines.push(`Months: ${monthList}`);
        lines.push(`Weekdays: ${campaign.calendar_config.weekdays.join(", ")}`);
        lines.push("");

        // Time of day
        lines.push("### Time of Day\n");
        for (const t of campaign.time_of_day_thresholds) {
          lines.push(`- ${t.label}: starts at hour ${t.start}`);
        }
        lines.push("");

        // Weather
        lines.push(`### Weather\n`);
        lines.push(`Options: ${campaign.weather_options.join(", ")}`);
        lines.push(`Volatility: ${campaign.weather_volatility}`);
        lines.push("");

        // Encounters
        lines.push("### Encounter Settings\n");
        lines.push(`Enabled: ${campaign.encounter_settings.enabled}`);
        lines.push(`Base rate: ${campaign.encounter_settings.base_rate}`);
        lines.push(`Min interval: ${campaign.encounter_settings.min_interval_hours}h`);

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_update_campaign",
    {
      title: "Update Campaign Settings",
      description:
        "Update campaign settings: attributes, calendar, weather options, encounter settings, time-of-day labels, seasons, rules settings, and more. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().optional().describe("Campaign name"),
        attribute_definitions: z
          .array(z.object({
            key: z.string(),
            label: z.string(),
            type: z.string().optional(),
            options: z.array(z.string()).optional(),
          }))
          .optional()
          .describe("Attribute definitions"),
        time_of_day_thresholds: z
          .array(z.object({ label: z.string(), start: z.number() }))
          .optional()
          .describe("Time of day labels with start hours"),
        calendar_config: z
          .object({
            months: z.array(z.object({ name: z.string(), days: z.number() })),
            weekdays: z.array(z.string()),
          })
          .optional()
          .describe("Calendar configuration"),
        weather_options: z.array(z.string()).optional().describe("Available weather types"),
        encounter_settings: z
          .object({
            enabled: z.boolean(),
            base_rate: z.number(),
            min_interval_hours: z.number(),
          })
          .optional()
          .describe("Encounter roll settings"),
        weather_volatility: z.number().optional().describe("Weather change frequency (0-1)"),
        rules_settings: z
          .object({
            cascade_depth_limit: z.number().optional(),
            engine_enabled: z.boolean().optional(),
          })
          .optional()
          .describe("Rules engine settings"),
        season_options: z.array(z.string()).optional().describe("Available seasons"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, ...fields } = params;
        const campaign = await put<Campaign>(`/campaigns/${cId}`, fields);
        return { content: [{ type: "text", text: `Campaign **${campaign.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
