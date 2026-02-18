import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { get, post, put, del, campaignId, c, handleError } from "../client.js";

interface Location {
  id: number;
  name: string;
  description: string;
  parent_id: number | null;
  encounter_modifier: number;
  properties: Record<string, unknown>;
  position_x: number;
  position_y: number;
}

interface Edge {
  id: number;
  from_location_id: number;
  to_location_id: number;
  label: string;
  description: string;
  travel_hours: number;
  bidirectional: number;
  encounter_modifier: number;
}

export function registerLocationTools(server: McpServer): void {
  server.registerTool(
    "almanac_list_locations",
    {
      title: "List Locations and Paths",
      description:
        "Get all locations and edges (paths) for the campaign map. Shows location IDs (for set_party_position) and edge IDs (for travel). Essential for navigation.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const data = await get<{ locations: Location[]; edges: Edge[] }>(c(cId, "/locations"));
        const locMap = new Map(data.locations.map((l) => [l.id, l.name]));

        const lines = ["## Locations\n"];
        if (data.locations.length === 0) {
          lines.push("No locations defined.\n");
        } else {
          for (const loc of data.locations) {
            const props = loc.properties && Object.keys(loc.properties).length > 0
              ? ` | ${Object.entries(loc.properties).map(([k, v]) => `${k}: ${v}`).join(", ")}`
              : "";
            const encMod = loc.encounter_modifier !== 1.0 ? ` | enc: ${loc.encounter_modifier}x` : "";
            lines.push(`- **${loc.name}** (id: ${loc.id})${encMod}${props}`);
            if (loc.description) lines.push(`  ${loc.description}`);
          }
        }
        lines.push("");

        lines.push("## Paths\n");
        if (data.edges.length === 0) {
          lines.push("No paths defined.\n");
        } else {
          for (const edge of data.edges) {
            const from = locMap.get(edge.from_location_id) || `#${edge.from_location_id}`;
            const to = locMap.get(edge.to_location_id) || `#${edge.to_location_id}`;
            const dir = edge.bidirectional ? "<->" : "->";
            const label = edge.label ? `"${edge.label}" ` : "";
            const encMod = edge.encounter_modifier !== 1.0 ? ` | enc: ${edge.encounter_modifier}x` : "";
            lines.push(`- ${label}${from} ${dir} ${to} — ${edge.travel_hours}h (edge_id: ${edge.id})${encMod}`);
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- Phase 2: Location CRUD ---

  const weatherOverrideSchema = z
    .object({
      mode: z.enum(["fixed", "weighted"]).describe("fixed = always this weather; weighted = probability distribution"),
      value: z.union([z.string(), z.record(z.number())]).describe("Weather string (fixed) or { weather: weight } map (weighted)"),
    })
    .nullable()
    .optional()
    .describe("Weather override for this location (null to clear)");

  server.registerTool(
    "almanac_create_location",
    {
      title: "Create Location",
      description: "Create a new map location.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        name: z.string().min(1).describe("Location name"),
        description: z.string().optional().describe("Location description"),
        parent_id: z.number().int().nullable().optional().describe("Parent location ID for nesting"),
        encounter_modifier: z.number().optional().describe("Encounter probability multiplier (default: 1.0)"),
        properties: z.record(z.unknown()).optional().describe("Custom properties"),
        position_x: z.number().optional().describe("Map X coordinate"),
        position_y: z.number().optional().describe("Map Y coordinate"),
        weather_override: weatherOverrideSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<Location>(c(cId, "/locations"), {
          name: params.name,
          description: params.description ?? "",
          parent_id: params.parent_id ?? null,
          encounter_modifier: params.encounter_modifier ?? 1.0,
          properties: params.properties ?? {},
          position_x: params.position_x ?? 0,
          position_y: params.position_y ?? 0,
          weather_override: params.weather_override ?? null,
        });
        return { content: [{ type: "text", text: `Location **${result.name}** created (id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_update_location",
    {
      title: "Update Location",
      description: "Update a location's fields. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        location_id: z.number().int().describe("Location ID"),
        name: z.string().optional().describe("Location name"),
        description: z.string().optional().describe("Location description"),
        parent_id: z.number().int().nullable().optional().describe("Parent location ID (null to unset)"),
        encounter_modifier: z.number().optional().describe("Encounter probability multiplier"),
        properties: z.record(z.unknown()).optional().describe("Custom properties (replaces all)"),
        position_x: z.number().optional().describe("Map X coordinate"),
        position_y: z.number().optional().describe("Map Y coordinate"),
        weather_override: weatherOverrideSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, location_id, ...fields } = params;
        const result = await put<Location>(c(cId, `/locations/${location_id}`), fields);
        return { content: [{ type: "text", text: `Location **${result.name}** updated.` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_delete_location",
    {
      title: "Delete Location",
      description: "Delete a location and all its connected edges. Clears party position if currently at this location.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        location_id: z.number().int().describe("Location ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/locations/${params.location_id}`));
        return { content: [{ type: "text", text: "Location deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  // --- Phase 2: Edge (Path) CRUD ---

  server.registerTool(
    "almanac_create_edge",
    {
      title: "Create Path",
      description: "Create a path (edge) between two locations. Use almanac_list_locations to find location IDs.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        from_location_id: z.number().int().describe("Starting location ID"),
        to_location_id: z.number().int().describe("Destination location ID"),
        label: z.string().optional().describe("Path name (e.g. 'Thornwood Trail')"),
        description: z.string().optional().describe("Path description"),
        travel_hours: z.number().optional().describe("Travel time in hours (default: 1)"),
        bidirectional: z.boolean().optional().describe("Can travel in both directions (default: true)"),
        encounter_modifier: z.number().optional().describe("Encounter probability multiplier (default: 1.0)"),
        properties: z.record(z.unknown()).optional().describe("Custom properties"),
        weather_override: weatherOverrideSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const result = await post<Edge>(c(cId, "/locations/edges"), {
          from_location_id: params.from_location_id,
          to_location_id: params.to_location_id,
          label: params.label ?? "",
          description: params.description ?? "",
          travel_hours: params.travel_hours ?? 1.0,
          bidirectional: params.bidirectional ?? true,
          encounter_modifier: params.encounter_modifier ?? 1.0,
          properties: params.properties ?? {},
          weather_override: params.weather_override ?? null,
        });
        return { content: [{ type: "text", text: `Path created (edge_id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_update_edge",
    {
      title: "Update Path",
      description: "Update a path's fields. Only include fields you want to change.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        edge_id: z.number().int().describe("Edge (path) ID"),
        label: z.string().optional().describe("Path name"),
        description: z.string().optional().describe("Path description"),
        travel_hours: z.number().optional().describe("Travel time in hours"),
        bidirectional: z.boolean().optional().describe("Can travel in both directions"),
        encounter_modifier: z.number().optional().describe("Encounter probability multiplier"),
        properties: z.record(z.unknown()).optional().describe("Custom properties (replaces all)"),
        weather_override: weatherOverrideSchema,
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        const { campaign_id: _, edge_id, ...fields } = params;
        const result = await put<Edge>(c(cId, `/locations/edges/${edge_id}`), fields);
        return { content: [{ type: "text", text: `Path updated (edge_id: ${result.id})` }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );

  server.registerTool(
    "almanac_delete_edge",
    {
      title: "Delete Path",
      description: "Delete a path (edge) between locations.",
      inputSchema: {
        campaign_id: z.number().int().optional().describe("Campaign ID"),
        edge_id: z.number().int().describe("Edge (path) ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const cId = campaignId(params.campaign_id);
        await del(c(cId, `/locations/edges/${params.edge_id}`));
        return { content: [{ type: "text", text: "Path deleted." }] };
      } catch (error) {
        return { content: [{ type: "text", text: handleError(error) }], isError: true };
      }
    },
  );
}
