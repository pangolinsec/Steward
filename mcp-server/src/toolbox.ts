import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface ToolControl {
  enabled: boolean;
  enable(): void;
  disable(): void;
}

export const TOOLSETS: Record<string, { description: string; tools: string[] }> = {
  world_building: {
    description:
      "Campaign settings, character/effect/item/location/path/encounter/journal/random-table/session-prep CRUD (28 tools)",
    tools: [
      "almanac_update_campaign",
      "almanac_create_character",
      "almanac_update_character",
      "almanac_delete_character",
      "almanac_create_status_effect",
      "almanac_update_status_effect",
      "almanac_delete_status_effect",
      "almanac_create_item",
      "almanac_update_item",
      "almanac_delete_item",
      "almanac_create_location",
      "almanac_update_location",
      "almanac_delete_location",
      "almanac_create_edge",
      "almanac_update_edge",
      "almanac_delete_edge",
      "almanac_create_encounter",
      "almanac_update_encounter",
      "almanac_delete_encounter",
      "almanac_create_journal_note",
      "almanac_update_journal_note",
      "almanac_delete_journal_note",
      "almanac_create_random_table",
      "almanac_update_random_table",
      "almanac_delete_random_table",
      "almanac_create_session_prep",
      "almanac_update_session_prep",
      "almanac_delete_session_prep",
    ],
  },
  rules: {
    description:
      "Rule CRUD, enable/disable toggle, dry-run testing, entity reference scanning (8 tools)",
    tools: [
      "almanac_list_rules",
      "almanac_get_rule",
      "almanac_create_rule",
      "almanac_update_rule",
      "almanac_delete_rule",
      "almanac_toggle_rule",
      "almanac_test_rule",
      "almanac_get_rule_references",
    ],
  },
  import_export: {
    description: "Full campaign JSON export and import (2 tools)",
    tools: ["almanac_export_campaign", "almanac_import_campaign"],
  },
};

function getToolRegistry(server: McpServer): Record<string, ToolControl> {
  return (server as unknown as { _registeredTools: Record<string, ToolControl> })
    ._registeredTools;
}

export function disableToolset(server: McpServer, toolset: string): void {
  const registry = getToolRegistry(server);
  const entry = TOOLSETS[toolset];
  if (!entry) return;
  for (const name of entry.tools) registry[name]?.disable();
}

export function enableToolset(server: McpServer, toolset: string): void {
  const registry = getToolRegistry(server);
  const entry = TOOLSETS[toolset];
  if (!entry) return;
  for (const name of entry.tools) registry[name]?.enable();
}

export function getToolsetStatus(server: McpServer): string {
  const registry = getToolRegistry(server);
  const lines: string[] = ["## Toolbox\n"];
  for (const [name, entry] of Object.entries(TOOLSETS)) {
    const enabledCount = entry.tools.filter((t) => registry[t]?.enabled).length;
    const status = enabledCount === entry.tools.length ? "OPEN" : enabledCount > 0 ? "PARTIAL" : "closed";
    lines.push(`- **${name}** [${status}] — ${entry.description}`);
  }
  lines.push("\nAlways-on tools (session play) are not listed here.");
  return lines.join("\n");
}

export function disableAllToolsets(server: McpServer): void {
  for (const name of Object.keys(TOOLSETS)) {
    disableToolset(server, name);
  }
}
