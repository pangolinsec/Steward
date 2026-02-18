import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

interface ToolControl {
  enabled: boolean;
  enable(): void;
  disable(): void;
}

export const TOOLSETS: Record<string, { description: string; tools: string[] }> = {
  world_building: {
    description:
      "Campaign settings, character/effect/item/location/path/encounter/journal/random-table/session-prep CRUD (29 tools)",
    tools: [
      "steward_create_campaign",
      "steward_update_campaign",
      "steward_create_character",
      "steward_update_character",
      "steward_delete_character",
      "steward_create_status_effect",
      "steward_update_status_effect",
      "steward_delete_status_effect",
      "steward_create_item",
      "steward_update_item",
      "steward_delete_item",
      "steward_create_location",
      "steward_update_location",
      "steward_delete_location",
      "steward_create_edge",
      "steward_update_edge",
      "steward_delete_edge",
      "steward_create_encounter",
      "steward_update_encounter",
      "steward_delete_encounter",
      "steward_create_journal_note",
      "steward_update_journal_note",
      "steward_delete_journal_note",
      "steward_create_random_table",
      "steward_update_random_table",
      "steward_delete_random_table",
      "steward_create_session_prep",
      "steward_update_session_prep",
      "steward_delete_session_prep",
    ],
  },
  rules: {
    description:
      "Rule CRUD, enable/disable toggle, dry-run testing, entity reference scanning (8 tools)",
    tools: [
      "steward_list_rules",
      "steward_get_rule",
      "steward_create_rule",
      "steward_update_rule",
      "steward_delete_rule",
      "steward_toggle_rule",
      "steward_test_rule",
      "steward_get_rule_references",
    ],
  },
  import_export: {
    description: "Full campaign JSON export and import (2 tools)",
    tools: ["steward_export_campaign", "steward_import_campaign"],
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
