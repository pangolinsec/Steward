#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
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

const server = new McpServer({
  name: "almanac",
  version: "1.0.0",
});

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

const transport = new StdioServerTransport();
await server.connect(transport);
