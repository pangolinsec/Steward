# Almanac MCP Server

An MCP (Model Context Protocol) server that lets AI assistants interact with your Almanac campaign — acting as a DM co-pilot for running game sessions, managing characters, building worlds, and querying campaign state.

## Prerequisites

- **Node.js 18+** installed on the machine that will run the MCP server
- **Almanac** running and accessible (via Docker or otherwise)
- An MCP-compatible client (Claude Desktop, Claude Code, etc.)

## Installation

### 1. Install dependencies and build

From the repository root:

```bash
cd mcp-server
npm install
npm run build
```

This compiles TypeScript into `mcp-server/dist/`.

If you prefer building in Docker (to avoid installing Node locally):

```bash
docker run --rm -v "$(pwd)/mcp-server:/app" -w /app node:20-alpine sh -c "npm install && npx tsc"
```

### 2. Verify the build

```bash
ls mcp-server/dist/index.js
```

You should see the compiled entry point.

## Configuration

The MCP server is configured via environment variables:

| Variable | Default | Description |
|---|---|---|
| `ALMANAC_URL` | `http://localhost:3001/api` | Base URL for the Almanac REST API. If Almanac runs on port 3000 (the default Docker setup), set this to `http://localhost:3000/api`. |
| `ALMANAC_CAMPAIGN_ID` | *(none)* | Default campaign ID. When set, all tools use this campaign automatically and the `campaign_id` parameter becomes optional. Recommended for single-campaign use. |

## Setting up your MCP client

### Claude Desktop

Add to your `claude_desktop_config.json` (found at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "almanac": {
      "command": "node",
      "args": ["/absolute/path/to/DnDApp/mcp-server/dist/index.js"],
      "env": {
        "ALMANAC_URL": "http://localhost:3000/api",
        "ALMANAC_CAMPAIGN_ID": "1"
      }
    }
  }
}
```

Replace `/absolute/path/to/DnDApp` with the actual path on your system, and `"1"` with your campaign ID.

### Claude Code

Add to your project's `.claude/settings.json` or global settings:

```json
{
  "mcpServers": {
    "almanac": {
      "command": "node",
      "args": ["/absolute/path/to/DnDApp/mcp-server/dist/index.js"],
      "env": {
        "ALMANAC_URL": "http://localhost:3000/api",
        "ALMANAC_CAMPAIGN_ID": "1"
      }
    }
  }
}
```

### Other MCP clients

Any client that supports the MCP stdio transport can use this server. The key configuration is:
- **Command:** `node`
- **Args:** `["/path/to/mcp-server/dist/index.js"]`
- **Transport:** stdio

## Finding your campaign ID

If you don't know your campaign ID, you can omit `ALMANAC_CAMPAIGN_ID` and ask the AI to call `almanac_list_campaigns`. It will return all campaigns with their IDs. Then either set the env var or pass `campaign_id` explicitly in tool calls.

## Available tools (56 total)

### Session Play

These tools power a live game session — the core DM assistant experience.

#### Environment & Time

| Tool | Description |
|---|---|
| `almanac_get_environment` | Full situational awareness: time, date, weather, location, party summary, notification count |
| `almanac_advance_time` | Advance the game clock. Triggers weather changes, rule evaluation, effect expiry, encounter rolls |
| `almanac_rest` | Short rest (1h) or long rest (8h) with all associated triggers |
| `almanac_travel` | Travel along a map edge — advances time, rolls encounters, applies weather overrides |
| `almanac_set_party_position` | Teleport party to a location (no time cost) |
| `almanac_update_environment` | Manually set weather, time, or notes |

#### Characters

| Tool | Description |
|---|---|
| `almanac_list_characters` | List all characters, filterable by type (PC/NPC) and search |
| `almanac_get_character` | Full character sheet: base/effective attributes, applied effects, inventory |
| `almanac_apply_effect` | Apply a status effect to a character |
| `almanac_remove_effect` | Remove an applied effect |
| `almanac_assign_item` | Give an item to a character |
| `almanac_update_item_quantity` | Change how many of an item a character holds |
| `almanac_remove_item` | Remove an item from inventory |

#### Encounters

| Tool | Description |
|---|---|
| `almanac_start_encounter` | Start a specific encounter (applies overrides, fires rules) |
| `almanac_end_encounter` | End an active encounter |

#### Notifications (Rules Engine)

| Tool | Description |
|---|---|
| `almanac_get_notifications` | Get pending rule notifications (suggestions and auto-applied alerts) |
| `almanac_apply_notification` | Apply suggested actions from a notification |
| `almanac_dismiss_notification` | Dismiss a notification |
| `almanac_undo_notification` | Undo auto-applied rule actions |

#### Session Log

| Tool | Description |
|---|---|
| `almanac_get_session_log` | Read the session log with pagination and type filters |
| `almanac_add_log_entry` | Add a narrative entry to the log |

### World Building

Create and manage campaign content.

#### Campaign Settings

| Tool | Description |
|---|---|
| `almanac_list_campaigns` | List all campaigns (discover campaign IDs) |
| `almanac_get_campaign` | Full campaign config: attributes, calendar, weather, encounters, rules settings |
| `almanac_update_campaign` | Update campaign settings |

#### Character Management

| Tool | Description |
|---|---|
| `almanac_create_character` | Create a new PC or NPC |
| `almanac_update_character` | Update character fields |
| `almanac_delete_character` | Delete a character |

#### Status Effects

| Tool | Description |
|---|---|
| `almanac_list_status_effects` | List effect definitions (filterable by name/tag) |
| `almanac_create_status_effect` | Create a new status effect |
| `almanac_update_status_effect` | Update an effect definition |
| `almanac_delete_status_effect` | Delete an effect (removes all applied instances) |

#### Items

| Tool | Description |
|---|---|
| `almanac_list_items` | List item definitions (filterable by name/type) |
| `almanac_create_item` | Create a new item |
| `almanac_update_item` | Update an item definition |
| `almanac_delete_item` | Delete an item (removes from all inventories) |

#### Locations & Paths

| Tool | Description |
|---|---|
| `almanac_list_locations` | Get all locations and edges (the map) |
| `almanac_create_location` | Create a map location |
| `almanac_update_location` | Update a location |
| `almanac_delete_location` | Delete a location and its edges |
| `almanac_create_edge` | Create a path between two locations |
| `almanac_update_edge` | Update a path |
| `almanac_delete_edge` | Delete a path |

#### Encounters

| Tool | Description |
|---|---|
| `almanac_list_encounters` | List encounter definitions |
| `almanac_create_encounter` | Create a new encounter with trigger conditions |
| `almanac_update_encounter` | Update an encounter |
| `almanac_delete_encounter` | Delete an encounter |

### Rules & Automation

| Tool | Description |
|---|---|
| `almanac_list_rules` | List rules (filterable by search, trigger type, tag) |
| `almanac_get_rule` | Full rule details: conditions, actions, config |
| `almanac_create_rule` | Create an automation rule |
| `almanac_update_rule` | Update a rule |
| `almanac_delete_rule` | Delete a rule |
| `almanac_toggle_rule` | Enable or disable a rule |
| `almanac_test_rule` | Dry-run a rule against current state (no side effects) |
| `almanac_get_rule_references` | Find which rules reference a given entity (impact analysis) |

### Import / Export

| Tool | Description |
|---|---|
| `almanac_export_campaign` | Export full campaign as JSON |
| `almanac_import_campaign` | Import a campaign from JSON (creates new campaign) |

## Usage examples

Once configured, you can interact with your campaign naturally through the AI assistant:

**Session play:**
> "What's the current state of the game?"
> "Advance time by 4 hours"
> "The party travels along the Thornwood Trail"
> "Apply the Poisoned effect to Thorin"
> "Give Elara 3 healing potions"
> "Start the Goblin Ambush encounter"
> "Take a long rest"

**World building:**
> "Create an NPC named Garrick the Blacksmith with 12 strength and 14 charisma"
> "Create a status effect called Blessed that gives +2 wisdom for 8 hours"
> "Add a new location called Dragon's Lair with a 2x encounter modifier"
> "Create a path from Waterdeep to Dragon's Lair that takes 6 hours to travel"

**Rules and automation:**
> "Show me all rules that trigger on time advance"
> "Test the Weather Effect rule — would it fire right now?"
> "Create a rule that applies Frostbite to all PCs when the weather is Blizzard"
> "Which rules reference the Poisoned effect?"

**Campaign management:**
> "Export the full campaign so I can back it up"
> "What campaigns do I have?"

## Troubleshooting

### "Cannot reach Almanac at ..."
The MCP server can't connect to the Almanac API. Check that:
1. Almanac is running (`docker compose up` or similar)
2. `ALMANAC_URL` points to the correct host and port (default Docker setup uses port 3000, so set `ALMANAC_URL=http://localhost:3000/api`)

### "No campaign specified"
Either set `ALMANAC_CAMPAIGN_ID` in your MCP client config or ask the AI to call `almanac_list_campaigns` to discover available IDs.

### Tools not appearing in your client
1. Verify the build completed: `ls mcp-server/dist/index.js`
2. Check the path in your MCP client config is absolute and correct
3. Restart your MCP client after config changes

## Development

To work on the MCP server:

```bash
cd mcp-server
npm run dev    # runs with tsx watch for hot reload
```

The server communicates over stdio, so `dev` mode is mainly useful for checking that it starts without errors. For testing tool calls, use the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

### Project structure

```
mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Entry point: creates server, registers tools, connects stdio
│   ├── client.ts             # HTTP client for Almanac API (get/post/put/patch/del)
│   ├── constants.ts          # ALMANAC_URL, ALMANAC_CAMPAIGN_ID defaults
│   └── tools/
│       ├── campaigns.ts      # Campaign list, details, update
│       ├── characters.ts     # Character CRUD + effects + inventory
│       ├── encounters.ts     # Encounter CRUD + start/end
│       ├── entities.ts       # Status effect + item definition CRUD
│       ├── environment.ts    # Time, weather, travel, rest
│       ├── import-export.ts  # Full campaign import/export
│       ├── locations.ts      # Location + edge (path) CRUD
│       ├── notifications.ts  # Rule notification management
│       ├── rules.ts          # Rule CRUD + test + toggle + references
│       └── session-log.ts    # Session log read/write
└── dist/                     # Compiled output (after npm run build)
```
