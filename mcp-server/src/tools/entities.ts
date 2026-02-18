import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, del, campaignId, c, handleError } from "../client.js";

interface StatusEffect {
  id: number;
  name: string;
  description: string;
  tags: string[];
  modifiers: { attribute: string; delta: number }[];
  duration_type: string;
  duration_value: number;
}

interface Item {
  id: number;
  name: string;
  description: string;
  item_type: string;
  properties: Record<string, unknown>;
  stackable: boolean;
  modifiers: { attribute: string; delta: number }[];
}

interface Encounter {
  id: number;
  name: string;
  description: string;
  notes: string;
  conditions: Record<string, unknown>;
}

export function registerEntityTools(server: McpServer): void {
  server.registerTool(
    "almanac_list_status_effects",
    {
      title: "List Status Effects",
      description:
        "List all status effect definitions in the campaign. Shows IDs needed for almanac_apply_effect. Filterable by name search or tag.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        search: z.string().optional().describe("Search by name"),
        tag: z.string().optional().describe("Filter by tag (e.g., buff, debuff, poison)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.search) qp.set("search", params.search);
        if (params.tag) qp.set("tag", params.tag);
        const qs = qp.toString();
        const effects = await get<StatusEffect[]>(c(cId, `/status-effects${qs ? "?" + qs : ""}`));
        if (effects.length === 0) return { content: [{ type: "text", text: "No status effects found." }] };

        const lines = ["## Status Effects\n"];
        for (const e of effects) {
          const mods = e.modifiers.map((m) => `${m.attribute} ${m.delta >= 0 ? "+" : ""}${m.delta}`).join(", ");
          const tags = e.tags.length > 0 ? ` [${e.tags.join(", ")}]` : "";
          const dur = e.duration_type === "timed" ? ` (${e.duration_value}h)` : e.duration_type === "rounds" ? ` (${e.duration_value} rounds)` : " (indefinite)";
          lines.push(`- **${e.name}** (id: ${e.id})${tags}${dur} — ${mods || "no modifiers"}`);
          if (e.description) lines.push(`  ${e.description}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_list_items",
    {
      title: "List Items",
      description:
        "List all item definitions in the campaign. Shows IDs needed for almanac_assign_item. Filterable by name search or item type.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        search: z.string().optional().describe("Search by name"),
        item_type: z.string().optional().describe("Filter by type: weapon, armor, accessory, consumable, misc"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.search) qp.set("search", params.search);
        if (params.item_type) qp.set("item_type", params.item_type);
        const qs = qp.toString();
        const items = await get<Item[]>(c(cId, `/items${qs ? "?" + qs : ""}`));
        if (items.length === 0) return { content: [{ type: "text", text: "No items found." }] };

        const lines = ["## Items\n"];
        for (const i of items) {
          const mods = i.modifiers.map((m) => `${m.attribute} ${m.delta >= 0 ? "+" : ""}${m.delta}`).join(", ");
          const modsStr = mods ? ` — ${mods}` : "";
          const stack = i.stackable ? " (stackable)" : "";
          lines.push(`- **${i.name}** (id: ${i.id}, ${i.item_type})${stack}${modsStr}`);
          if (i.description) lines.push(`  ${i.description}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_list_encounters",
    {
      title: "List Encounters",
      description:
        "List all encounter definitions. Shows IDs needed for almanac_start_encounter/end_encounter. Filterable by name search.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        search: z.string().optional().describe("Search by name"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const qp = new URLSearchParams();
        if (params.search) qp.set("search", params.search);
        const qs = qp.toString();
        const encounters = await get<Encounter[]>(c(cId, `/encounters${qs ? "?" + qs : ""}`));
        if (encounters.length === 0) return { content: [{ type: "text", text: "No encounters found." }] };

        const lines = ["## Encounters\n"];
        for (const enc of encounters) {
          const conds: string[] = [];
          const co = enc.conditions as Record<string, unknown>;
          if (Array.isArray(co?.location_ids) && co.location_ids.length > 0) conds.push(`${co.location_ids.length} locations`);
          if (Array.isArray(co?.edge_ids) && co.edge_ids.length > 0) conds.push(`${co.edge_ids.length} paths`);
          if (Array.isArray(co?.time_of_day) && co.time_of_day.length > 0) conds.push((co.time_of_day as string[]).join("/"));
          if (Array.isArray(co?.weather) && co.weather.length > 0) conds.push((co.weather as string[]).join("/"));
          const condStr = conds.length > 0 ? ` | conditions: ${conds.join(", ")}` : "";
          lines.push(`- **${enc.name}** (id: ${enc.id})${condStr}`);
          if (enc.description) lines.push(`  ${enc.description}`);
        }
        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- Phase 2: Status Effect CRUD ---

  const modifierSchema = z.object({
    attribute: z.string().describe("Attribute key to modify"),
    delta: z.number().describe("Modifier value (positive or negative)"),
  });

  server.registerTool(
    "almanac_create_status_effect",
    {
      title: "Create Status Effect",
      description:
        "Create a new status effect definition. Use almanac_get_campaign to see available attribute keys for modifiers.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().min(1).describe("Effect name"),
        description: z.string().optional().describe("Effect description"),
        tags: z.array(z.string()).optional().describe("Tags (e.g. buff, debuff, poison)"),
        modifiers: z.array(modifierSchema).optional().describe("Attribute modifiers"),
        duration_type: z.enum(["indefinite", "timed", "rounds"]).optional().describe("Duration type (default: indefinite)"),
        duration_value: z.number().optional().describe("Duration amount (hours for timed, count for rounds)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<StatusEffect>(c(cId, "/status-effects"), {
          name: params.name,
          description: params.description ?? "",
          tags: params.tags ?? [],
          modifiers: params.modifiers ?? [],
          duration_type: params.duration_type ?? "indefinite",
          duration_value: params.duration_value ?? 0,
        });
        return { content: [{ type: "text", text: `Status effect **${result.name}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_update_status_effect",
    {
      title: "Update Status Effect",
      description: "Update a status effect definition. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        status_effect_id: z.number().int().describe("Status effect ID"),
        name: z.string().optional().describe("Effect name"),
        description: z.string().optional().describe("Effect description"),
        tags: z.array(z.string()).optional().describe("Tags"),
        modifiers: z.array(modifierSchema).optional().describe("Attribute modifiers (replaces all)"),
        duration_type: z.enum(["indefinite", "timed", "rounds"]).optional().describe("Duration type"),
        duration_value: z.number().optional().describe("Duration amount"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, status_effect_id, ...fields } = params;
        const result = await put<StatusEffect>(c(cId, `/status-effects/${status_effect_id}`), fields);
        return { content: [{ type: "text", text: `Status effect **${result.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_delete_status_effect",
    {
      title: "Delete Status Effect",
      description: "Delete a status effect definition. Also removes all applied instances from characters.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        status_effect_id: z.number().int().describe("Status effect ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/status-effects/${params.status_effect_id}`));
        return { content: [{ type: "text", text: "Status effect deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- Phase 2: Item Definition CRUD ---

  server.registerTool(
    "almanac_create_item",
    {
      title: "Create Item",
      description:
        "Create a new item definition. Use almanac_get_campaign to see available attribute keys for modifiers.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().min(1).describe("Item name"),
        description: z.string().optional().describe("Item description"),
        item_type: z.enum(["weapon", "armor", "accessory", "consumable", "misc"]).optional().describe("Item type (default: misc)"),
        properties: z.record(z.unknown()).optional().describe("Custom properties"),
        stackable: z.boolean().optional().describe("Whether the item stacks in inventory (default: false)"),
        modifiers: z.array(modifierSchema).optional().describe("Attribute modifiers when equipped/held"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<Item>(c(cId, "/items"), {
          name: params.name,
          description: params.description ?? "",
          item_type: params.item_type ?? "misc",
          properties: params.properties ?? {},
          stackable: params.stackable ?? false,
          modifiers: params.modifiers ?? [],
        });
        return { content: [{ type: "text", text: `Item **${result.name}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_update_item",
    {
      title: "Update Item",
      description: "Update an item definition. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        item_id: z.number().int().describe("Item definition ID"),
        name: z.string().optional().describe("Item name"),
        description: z.string().optional().describe("Item description"),
        item_type: z.enum(["weapon", "armor", "accessory", "consumable", "misc"]).optional().describe("Item type"),
        properties: z.record(z.unknown()).optional().describe("Custom properties (replaces all)"),
        stackable: z.boolean().optional().describe("Whether the item stacks"),
        modifiers: z.array(modifierSchema).optional().describe("Attribute modifiers (replaces all)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, item_id, ...fields } = params;
        const result = await put<Item>(c(cId, `/items/${item_id}`), fields);
        return { content: [{ type: "text", text: `Item **${result.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_delete_item",
    {
      title: "Delete Item",
      description: "Delete an item definition. Also removes all instances from character inventories.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        item_id: z.number().int().describe("Item definition ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/items/${params.item_id}`));
        return { content: [{ type: "text", text: "Item deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
