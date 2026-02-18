#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerCampaignTools } from "./tools/campaigns.js";
import { registerCharacterTools } from "./tools/characters.js";
import { registerEncounterTools } from "./tools/encounters.js";
import { registerEntityTools } from "./tools/entities.js";
import { registerEnvironmentTools } from "./tools/environment.js";
import { registerLocationTools } from "./tools/locations.js";
import { registerNotificationTools } from "./tools/notifications.js";
import { registerRuleTools } from "./tools/rules.js";
import { registerSessionLogTools } from "./tools/session-log.js";
import { registerImportExportTools } from "./tools/import-export.js";
import { registerCombatTools } from "./tools/combat.js";
import { registerJournalTools } from "./tools/journal.js";
import { registerRandomTableTools } from "./tools/random-tables.js";
import { registerSessionPrepTools } from "./tools/session-prep.js";
import {
  TOOLSETS,
  enableToolset,
  disableToolset,
  disableAllToolsets,
  getToolsetStatus,
} from "./toolbox.js";
import { TOOLBOX_ENABLED } from "./constants.js";

const server = new McpServer({
  name: "steward",
  version: "1.0.0",
});

// Register all tools (must happen before connect)
registerCampaignTools(server);
registerEnvironmentTools(server);
registerCharacterTools(server);
registerEncounterTools(server);
registerEntityTools(server);
registerLocationTools(server);
registerNotificationTools(server);
registerRuleTools(server);
registerSessionLogTools(server);
registerImportExportTools(server);
registerCombatTools(server);
registerJournalTools(server);
registerRandomTableTools(server);
registerSessionPrepTools(server);

if (TOOLBOX_ENABLED) {
  // Disable non-core toolsets — agents load them on demand via steward_open_toolbox
  disableAllToolsets(server);

  // Meta-tools for dynamic toolset management
  const toolsetNames = Object.keys(TOOLSETS);
  const toolsetEnum = z.enum(toolsetNames as [string, ...string[]]);
  const toolsetDescriptions = Object.entries(TOOLSETS)
    .map(([name, entry]) => `  - ${name}: ${entry.description}`)
    .join("\n");

  server.registerTool(
    "steward_open_toolbox",
    {
      title: "Open Toolbox",
      description: `Load additional tools for a specific task. Session play tools are always available; use this to access specialized toolsets:\n${toolsetDescriptions}\n\nCall steward_close_toolbox when done to reduce context.`,
      inputSchema: {
        toolset: toolsetEnum.describe("Toolset to load"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      enableToolset(server, params.toolset);
      const status = getToolsetStatus(server);
      return {
        content: [{ type: "text", text: `Toolset **${params.toolset}** opened.\n\n${status}` }],
      };
    },
  );

  server.registerTool(
    "steward_close_toolbox",
    {
      title: "Close Toolbox",
      description:
        "Unload a toolset to reduce context. Session play tools remain available.",
      inputSchema: {
        toolset: toolsetEnum.describe("Toolset to unload"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async (params) => {
      disableToolset(server, params.toolset);
      const status = getToolsetStatus(server);
      return {
        content: [{ type: "text", text: `Toolset **${params.toolset}** closed.\n\n${status}` }],
      };
    },
  );
}

const transport = new StdioServerTransport();
await server.connect(transport);
