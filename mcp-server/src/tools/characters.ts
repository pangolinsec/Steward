import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, patch, del, campaignId, c, handleError } from "../client.js";

interface Character {
  id: number;
  campaign_id: number;
  name: string;
  type: string;
  description: string;
  portrait_url: string;
  base_attributes: Record<string, unknown>;
  max_attributes: Record<string, unknown>;
  dm_notes: string;
  archived: boolean;
}

interface EffectBreakdown {
  id: number;
  definition_id: number;
  name: string;
  description: string;
  tags: string[];
  modifiers: { attribute: string; delta: number }[];
  remaining_rounds: number | null;
  remaining_hours: number | null;
  duration_type: string;
}

interface ItemBreakdown {
  id: number;
  definition_id: number;
  name: string;
  item_type: string;
  quantity: number;
  modifiers: { attribute: string; delta: number }[];
}

interface ComputedStats {
  character: Character;
  base: Record<string, unknown>;
  max_attributes: Record<string, unknown>;
  effective: Record<string, unknown>;
  effects_breakdown: EffectBreakdown[];
  items_breakdown: ItemBreakdown[];
}

function formatCharacterSheet(stats: ComputedStats): string {
  const ch = stats.character;
  const lines: string[] = [];
  const archivedTag = ch.archived ? " [archived]" : "";
  lines.push(`## ${ch.name} (${ch.type})${archivedTag}\n`);
  if (ch.description) lines.push(`*${ch.description}*\n`);
  if (ch.dm_notes) lines.push(`> **DM Notes:** ${ch.dm_notes}\n`);

  // Effective attributes
  const maxAttrs = stats.max_attributes || {};
  const hasAnyMax = Object.keys(maxAttrs).length > 0;
  lines.push("### Attributes\n");
  if (hasAnyMax) {
    lines.push("| Attribute | Base | Max | Effective |");
    lines.push("|-----------|------|-----|-----------|");
  } else {
    lines.push("| Attribute | Base | Effective |");
    lines.push("|-----------|------|-----------|");
  }
  for (const [key, baseVal] of Object.entries(stats.base)) {
    const effVal = stats.effective[key];
    const diff = typeof baseVal === "number" && typeof effVal === "number" ? effVal - baseVal : 0;
    const diffStr = diff > 0 ? ` (+${diff})` : diff < 0 ? ` (${diff})` : "";
    if (hasAnyMax) {
      const maxVal = maxAttrs[key] != null ? String(maxAttrs[key]) : "—";
      lines.push(`| ${key} | ${baseVal} | ${maxVal} | ${effVal}${diffStr} |`);
    } else {
      lines.push(`| ${key} | ${baseVal} | ${effVal}${diffStr} |`);
    }
  }
  lines.push("");

  // Applied effects
  if (stats.effects_breakdown.length > 0) {
    lines.push("### Applied Effects\n");
    for (const e of stats.effects_breakdown) {
      const mods = e.modifiers.map((m) => `${m.attribute} ${m.delta >= 0 ? "+" : ""}${m.delta}`).join(", ");
      let duration = "";
      if (e.remaining_hours != null) duration = ` (${e.remaining_hours}h remaining)`;
      else if (e.remaining_rounds != null) duration = ` (${e.remaining_rounds} rounds remaining)`;
      else if (e.duration_type === "indefinite") duration = " (indefinite)";
      lines.push(`- **${e.name}** [applied_effect_id: ${e.id}] — ${mods || "no stat modifiers"}${duration}`);
    }
    lines.push("");
  }

  // Inventory
  if (stats.items_breakdown.length > 0) {
    lines.push("### Inventory\n");
    for (const i of stats.items_breakdown) {
      const mods = i.modifiers.map((m) => `${m.attribute} ${m.delta >= 0 ? "+" : ""}${m.delta}`).join(", ");
      const modsStr = mods ? ` — ${mods}` : "";
      lines.push(`- **${i.name}** x${i.quantity} (${i.item_type}) [character_item_id: ${i.id}]${modsStr}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

export function registerCharacterTools(server: McpServer): void {
  server.registerTool(
    "steward_list_characters",
    {
      title: "List Characters",
      description:
        "List all characters in the campaign, optionally filtered by type (PC/NPC) or name search.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        type: z.enum(["PC", "NPC"]).optional().describe("Filter by character type"),
        search: z.string().optional().describe("Search by name"),
        include_spawned: z.boolean().optional().describe("Include encounter-spawned NPCs (hidden by default)"),
        include_archived: z.boolean().optional().describe("Include archived NPCs (hidden by default)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.type) qp.set("type", params.type);
        if (params.search) qp.set("search", params.search);
        if (params.include_spawned) qp.set("include_spawned", "1");
        if (params.include_archived) qp.set("include_archived", "1");
        const qs = qp.toString();
        const chars = await get<Character[]>(c(cId, `/characters${qs ? "?" + qs : ""}`));
        if (chars.length === 0) return { content: [{ type: "text", text: "No characters found." }] };

        const lines = ["## Characters\n"];
        for (const ch of chars) {
          const attrs = typeof ch.base_attributes === "object" && ch.base_attributes
            ? Object.entries(ch.base_attributes)
                .filter(([, v]) => typeof v === "number")
                .slice(0, 4)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")
            : "";
          const archivedTag = (ch as any).archived ? " [archived]" : "";
          lines.push(`- **${ch.name}**${archivedTag} (${ch.type}, id: ${ch.id}) — ${attrs || ch.description || ""}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_get_character",
    {
      title: "Get Character Sheet",
      description:
        "Get a full character sheet: base and effective attributes, applied effects (with IDs for removal), and inventory (with IDs for removal/quantity changes). This is the primary character inspection tool.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const stats = await get<ComputedStats>(c(cId, `/characters/${params.character_id}/computed`));
        return { content: [{ type: "text", text: formatCharacterSheet(stats) }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_apply_effect",
    {
      title: "Apply Effect to Character",
      description:
        "Apply a status effect to a character. Use steward_list_status_effects to find the status_effect_id.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
        status_effect_id: z.number().int().describe("Status effect definition ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<{ id: number }>(c(cId, `/characters/${params.character_id}/effects`), {
          status_effect_definition_id: params.status_effect_id,
        });
        return { content: [{ type: "text", text: `Effect applied (applied_effect_id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_remove_effect",
    {
      title: "Remove Effect from Character",
      description:
        "Remove an applied effect from a character. The applied_effect_id comes from steward_get_character's effects list.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
        applied_effect_id: z.number().int().describe("Applied effect instance ID (from get_character)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/characters/${params.character_id}/effects/${params.applied_effect_id}`));
        return { content: [{ type: "text", text: "Effect removed." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_assign_item",
    {
      title: "Give Item to Character",
      description:
        "Assign an item to a character's inventory. Stackable items auto-stack. Use steward_list_items to find item_definition_id.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
        item_definition_id: z.number().int().describe("Item definition ID"),
        quantity: z.number().int().min(1).default(1).describe("Quantity to give"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<{ id: number; quantity: number }>(c(cId, `/characters/${params.character_id}/items`), {
          item_definition_id: params.item_definition_id,
          quantity: params.quantity,
        });
        return { content: [{ type: "text", text: `Item assigned (character_item_id: ${result.id}, quantity: ${result.quantity})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_item_quantity",
    {
      title: "Update Item Quantity",
      description:
        "Change the quantity of an item a character holds. Setting to 0 removes it. The character_item_id comes from steward_get_character's inventory list.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
        character_item_id: z.number().int().describe("Character item instance ID (from get_character)"),
        quantity: z.number().int().min(0).describe("New quantity (0 to remove)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await patch<{ id?: number; quantity?: number; deleted?: boolean }>(
          c(cId, `/characters/${params.character_id}/items/${params.character_item_id}`),
          { quantity: params.quantity },
        );
        if (result.deleted) return { content: [{ type: "text", text: "Item removed (quantity reached 0)." }] };
        return { content: [{ type: "text", text: `Quantity updated to ${result.quantity}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_remove_item",
    {
      title: "Remove Item from Character",
      description:
        "Remove an item entirely from a character's inventory. The character_item_id comes from steward_get_character.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
        character_item_id: z.number().int().describe("Character item instance ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/characters/${params.character_id}/items/${params.character_item_id}`));
        return { content: [{ type: "text", text: "Item removed from inventory." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_modify_attribute",
    {
      title: "Modify Character Attribute",
      description:
        "Change a single attribute on a character without replacing all attributes. " +
        "Use `delta` for relative changes (e.g. -5 damage) or `value` for absolute sets. " +
        "Defaults to base attributes; set target to 'max' for max values.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
        attribute: z.string().describe("Attribute key to modify (e.g. 'hp', 'strength')"),
        delta: z.number().optional().describe("Relative change (e.g. -5 for damage, +3 for healing). Mutually exclusive with value."),
        value: z.number().optional().describe("Absolute value to set. Mutually exclusive with delta."),
        target: z.enum(["base", "max"]).default("base").describe("Which attribute set: 'base' (current values) or 'max' (maximum values)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        if (params.delta == null && params.value == null) {
          return { content: [{ type: "text", text: "Error: provide either `delta` or `value`." }], isError: true };
        }
        if (params.delta != null && params.value != null) {
          return { content: [{ type: "text", text: "Error: provide `delta` or `value`, not both." }], isError: true };
        }

        const cId = campaignId(params.campaign_id);
        const stats = await get<ComputedStats>(c(cId, `/characters/${params.character_id}/computed`));

        const isMax = params.target === "max";
        const attrs = isMax
          ? { ...(stats.max_attributes || {}) }
          : { ...(stats.base || {}) };

        const key = params.attribute;
        const oldVal = typeof attrs[key] === "number" ? (attrs[key] as number) : 0;

        let newVal: number;
        if (params.delta != null) {
          newVal = oldVal + params.delta;
        } else {
          newVal = params.value!;
        }
        attrs[key] = newVal;

        const updatePayload = isMax
          ? { max_attributes: attrs }
          : { base_attributes: attrs };

        // For base, we need to send the full base_attributes to avoid losing other attributes
        if (!isMax) {
          updatePayload.base_attributes = { ...stats.base, [key]: newVal };
        }

        await put<Character>(c(cId, `/characters/${params.character_id}`), updatePayload);

        const label = isMax ? "max" : "base";
        const changeDesc = params.delta != null
          ? `${params.delta >= 0 ? "+" : ""}${params.delta} (${oldVal} → ${newVal})`
          : `set to ${newVal} (was ${oldVal})`;
        return { content: [{ type: "text", text: `**${stats.character.name}** ${label} ${key}: ${changeDesc}` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- Phase 2: Character CRUD ---

  server.registerTool(
    "steward_create_character",
    {
      title: "Create Character",
      description:
        "Create a new PC or NPC. Use steward_get_campaign to see available attribute keys for base_attributes.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().min(1).describe("Character name"),
        type: z.enum(["PC", "NPC"]).describe("Character type"),
        description: z.string().optional().describe("Character description/backstory"),
        portrait_url: z.string().optional().describe("Portrait image URL"),
        base_attributes: z.record(z.union([z.number(), z.string()])).optional().describe("Base attributes (e.g. { strength: 14, class: 'Fighter' })"),
        max_attributes: z.record(z.number()).optional().describe("Max values for resource attributes (e.g. { hp: 20 })"),
        dm_notes: z.string().optional().describe("DM-only notes (private, not shown to players)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<Character>(c(cId, "/characters"), {
          name: params.name,
          type: params.type,
          description: params.description ?? "",
          portrait_url: params.portrait_url ?? "",
          base_attributes: params.base_attributes ?? {},
          max_attributes: params.max_attributes ?? {},
          dm_notes: params.dm_notes ?? "",
        });
        return { content: [{ type: "text", text: `Character **${result.name}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_update_character",
    {
      title: "Update Character",
      description:
        "Update a character's fields. Only include fields you want to change. base_attributes replaces the entire attribute set.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID"),
        name: z.string().optional().describe("Character name"),
        type: z.enum(["PC", "NPC"]).optional().describe("Character type"),
        description: z.string().optional().describe("Character description"),
        portrait_url: z.string().optional().describe("Portrait URL"),
        base_attributes: z.record(z.union([z.number(), z.string()])).optional().describe("Base attributes (replaces all)"),
        max_attributes: z.record(z.number()).optional().describe("Max values for resource attributes (replaces all)"),
        dm_notes: z.string().optional().describe("DM-only notes (private, not shown to players)"),
        archived: z.boolean().optional().describe("Archive this character (hidden from default lists)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, character_id, ...fields } = params;
        const result = await put<Character>(c(cId, `/characters/${character_id}`), fields);
        return { content: [{ type: "text", text: `Character **${result.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "steward_delete_character",
    {
      title: "Delete Character",
      description:
        "Permanently delete a character and all their applied effects and inventory.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        character_id: z.number().int().describe("Character ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/characters/${params.character_id}`));
        return { content: [{ type: "text", text: "Character deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
