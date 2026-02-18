import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, patch, campaignId, c, handleError } from "../client.js";

interface Combatant {
  character_id: number;
  initiative: number;
  name: string;
  type: string;
  effective_attributes: Record<string, unknown>;
  applied_effects: { name: string; remaining_rounds: number | null }[];
}

interface CombatState {
  active: boolean;
  round?: number;
  turn_index?: number;
  combatants?: Combatant[];
  advance_time?: boolean;
  time_per_round_seconds?: number;
  events?: { type: string; character_name?: string; effect_name?: string; message?: string }[];
}

function formatCombatState(state: CombatState): string {
  if (!state.active) return "**No active combat.**";

  const lines: string[] = [];
  lines.push(`## Combat — Round ${state.round}\n`);

  if (state.combatants && state.combatants.length > 0) {
    lines.push("### Initiative Order\n");
    for (let i = 0; i < state.combatants.length; i++) {
      const c = state.combatants[i];
      const current = i === state.turn_index ? " **<< CURRENT TURN**" : "";
      const attrs = Object.entries(c.effective_attributes || {})
        .filter(([, v]) => typeof v === "number")
        .slice(0, 4)
        .map(([k, v]) => `${k}: ${v}`)
        .join(", ");
      const effects = (c.applied_effects || [])
        .map((e) => {
          const dur = e.remaining_rounds != null ? ` (${e.remaining_rounds}r)` : "";
          return `${e.name}${dur}`;
        })
        .join(", ");
      const effectsStr = effects ? ` | ${effects}` : "";
      lines.push(
        `${i + 1}. **${c.name}** (${c.type}, init: ${c.initiative}) — ${attrs}${effectsStr}${current}`,
      );
    }
    lines.push("");
  }

  if (state.events && state.events.length > 0) {
    lines.push("### Events\n");
    for (const e of state.events) {
      if (e.type === "effect_expired") lines.push(`- Effect expired: ${e.effect_name} on ${e.character_name}`);
      else lines.push(`- ${e.message || e.type}`);
    }
  }

  return lines.join("\n");
}

export function registerCombatTools(server: McpServer): void {
  server.registerTool(
    "almanac_get_combat",
    {
      title: "Get Combat State",
      description:
        "Get the current combat state: round number, initiative order, whose turn it is, and combatant stats/effects.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const state = await get<CombatState>(c(cId, "/combat"));
        return { content: [{ type: "text", text: formatCombatState(state) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_start_combat",
    {
      title: "Start Combat",
      description:
        "Start combat with an initiative-ordered combatant list. Each combatant needs a character_id and initiative roll. Use almanac_list_characters to find character IDs.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        combatants: z
          .array(
            z.object({
              character_id: z.number().int().describe("Character ID"),
              initiative: z.number().describe("Initiative roll result"),
            }),
          )
          .min(1)
          .describe("Combatants with initiative rolls"),
        advance_time: z.boolean().optional().describe("Advance game clock during combat (default: true)"),
        time_per_round_seconds: z.number().optional().describe("Game-world seconds per round (default: 6)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const state = await post<CombatState>(c(cId, "/combat/start"), {
          combatants: params.combatants,
          advance_time: params.advance_time ?? true,
          time_per_round_seconds: params.time_per_round_seconds ?? 6,
        });
        return { content: [{ type: "text", text: formatCombatState(state) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_end_combat",
    {
      title: "End Combat",
      description: "End the current combat and clear combat state.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await post(c(cId, "/combat/end"));
        return { content: [{ type: "text", text: "Combat ended." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_next_turn",
    {
      title: "Next Combat Turn",
      description:
        "Advance to the next combatant's turn. When a new round starts: decrements round-based effects (expiring if needed), fires on_round_advance rules, and optionally advances the game clock.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const state = await post<CombatState>(c(cId, "/combat/next-turn"));
        return { content: [{ type: "text", text: formatCombatState(state) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_update_combat",
    {
      title: "Update Combat",
      description:
        "Update combat settings mid-fight: change combatants (add/remove/reorder), toggle time advancement, or adjust round duration.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        combatants: z
          .array(
            z.object({
              character_id: z.number().int().describe("Character ID"),
              initiative: z.number().describe("Initiative value"),
            }),
          )
          .optional()
          .describe("Updated combatant list (replaces all, re-sorted by initiative)"),
        advance_time: z.boolean().optional().describe("Whether to advance game clock"),
        time_per_round_seconds: z.number().optional().describe("Game-world seconds per round"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, ...fields } = params;
        const state = await patch<CombatState>(c(cId, "/combat"), fields);
        return { content: [{ type: "text", text: formatCombatState(state) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
