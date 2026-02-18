import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { post, put, del, campaignId, c, handleError } from "../client.js";

interface Encounter {
  id: number;
  campaign_id: number;
  name: string;
  description: string;
  notes: string;
  npcs: { character_id?: number; name?: string; role: string; count?: number }[];
  environment_overrides: Record<string, unknown>;
  loot_table: { item_name: string; quantity: number; drop_chance: number }[];
  conditions: Record<string, unknown>;
  starts_combat: boolean;
}

interface EncounterResult {
  success: boolean;
  encounter_name: string;
  events: { type: string; message?: string; rule_name?: string }[];
  combat_started?: boolean;
  combat_state?: Record<string, unknown>;
  combat_ended?: boolean;
  npcs_cleaned?: number;
}

export function registerEncounterTools(server: McpServer): void {
  server.registerTool(
    "steward_start_encounter",
    {
      title: "Start Encounter",
      description:
        "Start a specific encounter. Applies any environment overrides (e.g., weather changes) and fires on_encounter rules. Use steward_list_encounters to find encounter IDs.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        encounter_id: z.number().int().describe("Encounter definition ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<EncounterResult>(c(cId, `/encounters/${params.encounter_id}/start`));
        const lines = [`**Encounter started:** ${result.encounter_name}`];
        if (result.combat_started) {
          lines.push("**Combat auto-started** (Round 1)");
          const cs = result.combat_state as Record<string, unknown> | undefined;
          if (cs?.combatants && Array.isArray(cs.combatants)) {
            lines.push(`Combatants (${cs.combatants.length}):`);
            for (const c of cs.combatants as { name: string; type: string; initiative: number }[]) {
              lines.push(`- ${c.name} (${c.type}) — initiative ${c.initiative}`);
            }
          }
        }
        if (result.events?.length > 0) {
          for (const e of result.events) {
            lines.push(`- ${e.message || e.type}`);
          }
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_end_encounter",
    {
      title: "End Encounter",
      description: "End an active encounter. Fires on_encounter end rules.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        encounter_id: z.number().int().describe("Encounter definition ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<EncounterResult>(c(cId, `/encounters/${params.encounter_id}/end`));
        const lines = [`**Encounter ended:** ${result.encounter_name}`];
        if (result.combat_ended) lines.push("Combat ended.");
        if (result.npcs_cleaned && result.npcs_cleaned > 0) lines.push(`${result.npcs_cleaned} spawned NPC(s) cleaned up.`);
        if (result.events?.length > 0) {
          for (const e of result.events) {
            lines.push(`- ${e.message || e.type}`);
          }
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- Phase 2: Encounter Definition CRUD ---

  server.registerTool(
    "steward_create_encounter",
    {
      title: "Create Encounter",
      description:
        "Create a new encounter definition. Conditions control when it can trigger (locations, paths, time of day, weather). Use steward_list_locations to find location/edge IDs.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().min(1).describe("Encounter name"),
        description: z.string().optional().describe("Encounter description (shown to players)"),
        notes: z.string().optional().describe("DM notes (private)"),
        npcs: z
          .array(z.object({
            character_id: z.number().int().optional().describe("Existing character ID (use this OR name)"),
            name: z.string().optional().describe("Ad-hoc NPC name (use this OR character_id)"),
            role: z.string(),
            count: z.number().int().min(1).optional().describe("Number of this NPC to spawn (default: 1)"),
          }))
          .optional()
          .describe("NPCs in the encounter with roles"),
        environment_overrides: z.record(z.unknown()).optional().describe("Environment overrides when encounter is active"),
        loot_table: z
          .array(z.object({ item_name: z.string(), quantity: z.number(), drop_chance: z.number() }))
          .optional()
          .describe("Loot drops with quantities and chances (0-1)"),
        conditions: z
          .object({
            location_ids: z.array(z.number().int()).optional().describe("Trigger only at these locations"),
            edge_ids: z.array(z.number().int()).optional().describe("Trigger only on these paths"),
            time_of_day: z.array(z.string()).optional().describe("Trigger only during these times (e.g. Night)"),
            weather: z.array(z.string()).optional().describe("Trigger only during this weather"),
            weight: z.number().optional().describe("Relative probability weight"),
          })
          .optional()
          .describe("Trigger conditions (empty = can trigger anywhere)"),
        starts_combat: z.boolean().optional().describe("Auto-start combat when this encounter triggers (default: false)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<Encounter>(c(cId, "/encounters"), {
          name: params.name,
          description: params.description ?? "",
          notes: params.notes ?? "",
          npcs: params.npcs ?? [],
          environment_overrides: params.environment_overrides ?? {},
          loot_table: params.loot_table ?? [],
          conditions: params.conditions ?? {},
          starts_combat: params.starts_combat ?? false,
        });
        return { content: [{ type: "text", text: `Encounter **${result.name}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_encounter",
    {
      title: "Update Encounter",
      description: "Update an encounter definition. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        encounter_id: z.number().int().describe("Encounter ID"),
        name: z.string().optional().describe("Encounter name"),
        description: z.string().optional().describe("Encounter description"),
        notes: z.string().optional().describe("DM notes"),
        npcs: z.array(z.object({
          character_id: z.number().int().optional().describe("Existing character ID (use this OR name)"),
          name: z.string().optional().describe("Ad-hoc NPC name (use this OR character_id)"),
          role: z.string(),
          count: z.number().int().min(1).optional().describe("Number of this NPC to spawn (default: 1)"),
        })).optional().describe("NPCs (replaces all)"),
        environment_overrides: z.record(z.unknown()).optional().describe("Environment overrides (replaces all)"),
        loot_table: z.array(z.object({ item_name: z.string(), quantity: z.number(), drop_chance: z.number() })).optional().describe("Loot table (replaces all)"),
        conditions: z
          .object({
            location_ids: z.array(z.number().int()).optional(),
            edge_ids: z.array(z.number().int()).optional(),
            time_of_day: z.array(z.string()).optional(),
            weather: z.array(z.string()).optional(),
            weight: z.number().optional(),
          })
          .optional()
          .describe("Trigger conditions (replaces all)"),
        starts_combat: z.boolean().optional().describe("Auto-start combat when this encounter triggers"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, encounter_id, ...fields } = params;
        const result = await put<Encounter>(c(cId, `/encounters/${encounter_id}`), fields);
        return { content: [{ type: "text", text: `Encounter **${result.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_delete_encounter",
    {
      title: "Delete Encounter",
      description: "Delete an encounter definition.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        encounter_id: z.number().int().describe("Encounter ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/encounters/${params.encounter_id}`));
        return { content: [{ type: "text", text: "Encounter deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
