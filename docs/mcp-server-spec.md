# Steward MCP Server Specification

An MCP (Model Context Protocol) server that enables LLMs to interact with Steward — a self-hosted tabletop RPG campaign management tool. This allows AI assistants to serve as DM co-pilots: running game sessions, managing characters, advancing the world, and querying campaign state.

## Architecture

- **Name**: `steward-mcp-server`
- **Language**: TypeScript (MCP TypeScript SDK + Zod validation)
- **Transport**: stdio (Steward is self-hosted; the MCP server runs as a local subprocess)
- **API**: Connects to Steward's REST API at a configurable `STEWARD_URL` (default `http://localhost:3001/api`)
- **Auth**: None required (Steward has no auth layer — it's a local-network tool)

```
steward-mcp-server/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # McpServer init + transport setup
│   ├── client.ts             # Shared HTTP client for Steward API
│   ├── format.ts             # Markdown/JSON response formatting helpers
│   ├── constants.ts          # STEWARD_URL, CHARACTER_LIMIT, defaults
│   ├── tools/
│   │   ├── campaigns.ts      # Campaign CRUD
│   │   ├── characters.ts     # Characters + effects + inventory
│   │   ├── environment.ts    # Time, weather, travel, rest
│   │   ├── entities.ts       # Status effects, items (definition CRUD)
│   │   ├── locations.ts      # Locations + edges
│   │   ├── encounters.ts     # Encounter definitions + start/end
│   │   ├── rules.ts          # Rule definitions + test + toggle
│   │   ├── notifications.ts  # Notification management
│   │   └── session-log.ts    # Session log read/write
│   └── types.ts              # Shared TypeScript interfaces
└── dist/
```

## Configuration

| Env Variable | Default | Description |
|---|---|---|
| `STEWARD_URL` | `http://localhost:3001/api` | Base URL for Steward API |
| `STEWARD_CAMPAIGN_ID` | *(none)* | Optional default campaign ID. When set, tools use this campaign and the `campaign_id` parameter becomes optional. |

---

## Tool Inventory

### Tier 1 — Session Play (highest priority)

These tools power a live game session. An LLM DM assistant needs these to run the game.

| Tool | Method | Description | Annotations |
|---|---|---|---|
| `steward_get_environment` | GET | Get full environment state: time, date, weather, location, calendar | readOnly |
| `steward_advance_time` | POST | Advance game clock by hours/minutes. Returns weather changes, rule events, encounter rolls | destructive |
| `steward_rest` | POST | Take short (1h) or long (8h) rest. Fires rest rules, expires effects | destructive |
| `steward_travel` | POST | Travel along a map edge. Advances time, rolls encounters, fires rules | destructive |
| `steward_set_party_position` | PATCH | Teleport party to a location (no time cost) | destructive |
| `steward_update_environment` | PATCH | Directly set weather, time, or environment notes | destructive |
| `steward_get_character` | GET | Get one character with computed stats, applied effects, and inventory | readOnly |
| `steward_list_characters` | GET | List all characters, filterable by type (PC/NPC) and search string | readOnly |
| `steward_apply_effect` | POST | Apply a status effect to a character | destructive |
| `steward_remove_effect` | DELETE | Remove an applied effect from a character | destructive |
| `steward_assign_item` | POST | Give an item to a character (with quantity) | destructive |
| `steward_update_item_quantity` | PATCH | Change quantity of an item a character holds | destructive |
| `steward_remove_item` | DELETE | Remove an item from a character's inventory | destructive |
| `steward_start_encounter` | POST | Start a specific encounter (applies env overrides, fires rules) | destructive |
| `steward_end_encounter` | POST | End an active encounter (fires rules) | destructive |
| `steward_get_notifications` | GET | Get pending notifications (rule suggestions, auto-applied alerts) | readOnly |
| `steward_apply_notification` | POST | Apply suggested actions from a rule notification | destructive |
| `steward_dismiss_notification` | PATCH | Dismiss a notification | destructive |
| `steward_undo_notification` | POST | Undo auto-applied rule actions via notification | destructive |
| `steward_get_session_log` | GET | Read session log entries with pagination and type filter | readOnly |
| `steward_add_log_entry` | POST | Add a narrative entry to the session log | destructive |

### Tier 2 — World Building & Reference

These tools let the LLM create and modify campaign content.

| Tool | Method | Description | Annotations |
|---|---|---|---|
| `steward_list_campaigns` | GET | List all campaigns | readOnly |
| `steward_get_campaign` | GET | Get campaign details (attributes, calendar, weather, encounter settings) | readOnly |
| `steward_update_campaign` | PUT | Update campaign settings | destructive |
| `steward_create_character` | POST | Create a new PC or NPC | destructive |
| `steward_update_character` | PUT | Update character fields (name, description, attributes) | destructive |
| `steward_delete_character` | DELETE | Delete a character | destructive |
| `steward_list_status_effects` | GET | List status effect definitions | readOnly |
| `steward_create_status_effect` | POST | Create a new status effect definition | destructive |
| `steward_update_status_effect` | PUT | Update a status effect definition | destructive |
| `steward_delete_status_effect` | DELETE | Delete a status effect definition | destructive |
| `steward_list_items` | GET | List item definitions | readOnly |
| `steward_create_item` | POST | Create a new item definition | destructive |
| `steward_update_item` | PUT | Update an item definition | destructive |
| `steward_delete_item` | DELETE | Delete an item definition | destructive |
| `steward_list_locations` | GET | Get all locations and edges (map data) | readOnly |
| `steward_create_location` | POST | Create a new location | destructive |
| `steward_update_location` | PUT | Update a location | destructive |
| `steward_delete_location` | DELETE | Delete a location and its edges | destructive |
| `steward_create_edge` | POST | Create a path between two locations | destructive |
| `steward_update_edge` | PUT | Update a path | destructive |
| `steward_delete_edge` | DELETE | Delete a path | destructive |
| `steward_list_encounters` | GET | List encounter definitions | readOnly |
| `steward_create_encounter` | POST | Create a new encounter definition | destructive |
| `steward_update_encounter` | PUT | Update an encounter definition | destructive |
| `steward_delete_encounter` | DELETE | Delete an encounter definition | destructive |

### Tier 3 — Rules & Automation

| Tool | Method | Description | Annotations |
|---|---|---|---|
| `steward_list_rules` | GET | List rules (filterable by trigger type, tag, search) | readOnly |
| `steward_get_rule` | GET | Get full rule details | readOnly |
| `steward_create_rule` | POST | Create a new automation rule | destructive |
| `steward_update_rule` | PUT | Update a rule | destructive |
| `steward_delete_rule` | DELETE | Delete a rule | destructive |
| `steward_toggle_rule` | PATCH | Enable or disable a rule | destructive |
| `steward_test_rule` | POST | Dry-run a rule and see what would fire | readOnly |
| `steward_get_rule_references` | GET | Find which rules reference a given entity | readOnly |

### Tier 4 — Import/Export

| Tool | Method | Description | Annotations |
|---|---|---|---|
| `steward_export_campaign` | GET | Export full campaign as JSON | readOnly |
| `steward_import_campaign` | POST | Import a full campaign (creates new campaign) | destructive |

**Total: 53 tools**

---

## Tool Specifications

Every tool accepts an optional `campaign_id` (integer). If `STEWARD_CAMPAIGN_ID` is set and `campaign_id` is omitted, the default is used. If neither is set, the tool returns an error prompting the user to specify a campaign.

### Environment & Session

#### `steward_get_environment`

Returns the full current state of the game world.

```
Input: { campaign_id? }
Output: {
  current_hour, current_minute, current_day, current_month, current_year,
  time_of_day,         // resolved label e.g. "Afternoon"
  month_name,          // resolved e.g. "Highsun"
  weather,             // current weather string
  current_location_id, current_location_name,
  current_edge_id,     // non-null if mid-travel
  environment_notes,
  calendar_config      // months, weekdays
}
```

#### `steward_advance_time`

Advances the game clock. Triggers weather transitions, rule evaluation, effect expiry, and encounter rolls.

```
Input: { campaign_id?, hours?: number, minutes?: number }
  — at least one of hours/minutes required
Output: {
  ...updated environment state,
  events: [
    { type: "time_advance", description },
    { type: "weather_change", from, to },
    { type: "effect_expired", character_name, effect_name },
    { type: "encounter_triggered", encounter: { name, description, ... }, probability },
    { type: "rule_notification", message, severity, rule_name }
  ]
}
```

#### `steward_rest`

```
Input: { campaign_id?, rest_type: "short" | "long" }
Output: same as advance_time (short = 1h, long = 8h, plus rest-specific rules)
```

#### `steward_travel`

Travel along a map edge. Advances time by the edge's `travel_hours`, applies edge weather overrides, rolls encounters.

```
Input: { campaign_id?, edge_id: number }
Output: {
  success, events,
  current_location_id, current_location_name
}
```

#### `steward_set_party_position`

Instantly move the party to a location (no time advance, no encounter rolls).

```
Input: { campaign_id?, location_id: number }
Output: { success, current_location_id, current_location_name }
```

#### `steward_update_environment`

Directly set environment fields. Use for manual overrides (e.g. "it starts snowing").

```
Input: {
  campaign_id?,
  weather?: string,
  current_hour?: number, current_minute?: number,
  current_day?: number, current_month?: number, current_year?: number,
  environment_notes?: string
}
Output: updated environment state
```

#### `steward_get_session_log`

```
Input: { campaign_id?, limit?: number (default 50), offset?: number, entry_type?: string }
Output: { entries: [...], total, limit, offset }
```

#### `steward_add_log_entry`

```
Input: { campaign_id?, message: string, entry_type?: string (default "manual") }
Output: { id, timestamp, entry_type, message }
```

### Characters

#### `steward_list_characters`

```
Input: { campaign_id?, type?: "PC" | "NPC", search?: string }
Output: Character[] — each includes base_attributes
```

#### `steward_get_character`

Returns a single character with computed stats (base + item modifiers + effect modifiers = effective), applied effects, and inventory. This is the primary "character sheet" tool.

```
Input: { campaign_id?, character_id: number }
Output: {
  ...character fields,
  computed: {
    base: { strength: 14, ... },
    item_modifiers: { strength: 2, ... },
    effect_modifiers: { constitution: -2, ... },
    effective: { strength: 16, constitution: 13, ... },
    breakdown: { strength: [{ source, value }, ...] }
  },
  applied_effects: [{ id, effect_name, remaining_hours, remaining_rounds, ... }],
  items: [{ id, item_name, quantity, ... }]
}
```

Implementation note: This tool calls three API endpoints in parallel: `GET /characters/:id`, `GET /characters/:id/computed`, and reconstructs the inventory/effects from the character data. The API already returns `applied_effects` and `items` on the character detail endpoint, so this may require only two calls.

#### `steward_create_character`

```
Input: {
  campaign_id?,
  name: string,
  type: "PC" | "NPC",
  description?: string,
  portrait_url?: string,
  base_attributes?: Record<string, number | string>
}
Output: created Character
```

#### `steward_update_character`

```
Input: {
  campaign_id?,
  character_id: number,
  name?: string, type?: string, description?: string,
  portrait_url?: string, base_attributes?: Record<string, number | string>
}
Output: updated Character
```

#### `steward_apply_effect`

```
Input: { campaign_id?, character_id: number, status_effect_id: number }
Output: AppliedEffect { id, character_id, status_effect_definition_id, applied_at, ... }
```

The LLM should first use `steward_list_status_effects` to find the effect's ID by name if needed.

#### `steward_remove_effect`

```
Input: { campaign_id?, character_id: number, applied_effect_id: number }
Output: { success: true }
```

The `applied_effect_id` comes from the `applied_effects` array on `steward_get_character`.

#### `steward_assign_item`

```
Input: { campaign_id?, character_id: number, item_definition_id: number, quantity?: number }
Output: CharacterItem { id, character_id, item_definition_id, quantity }
```

#### `steward_update_item_quantity`

```
Input: { campaign_id?, character_id: number, character_item_id: number, quantity: number }
Output: CharacterItem | { success: true, deleted: true } (if quantity reaches 0)
```

#### `steward_remove_item`

```
Input: { campaign_id?, character_id: number, character_item_id: number }
Output: { success: true }
```

### Entity Definitions (Status Effects, Items)

These follow a uniform CRUD pattern.

#### `steward_list_status_effects`

```
Input: { campaign_id?, search?: string, tag?: string }
Output: StatusEffect[] — each includes name, description, tags, modifiers, duration_type, duration_value
```

#### `steward_create_status_effect`

```
Input: {
  campaign_id?,
  name: string, description?: string,
  tags?: string[],
  modifiers?: { attribute: string, operation?: string, value: number }[],
  duration_type?: "indefinite" | "timed" | "rounds",
  duration_value?: number
}
Output: created StatusEffect
```

#### `steward_update_status_effect` / `steward_delete_status_effect`

Standard update (partial fields) and delete by ID.

#### `steward_list_items`

```
Input: { campaign_id?, search?: string, item_type?: string }
Output: Item[] — each includes name, description, item_type, properties, stackable, modifiers
```

#### `steward_create_item`

```
Input: {
  campaign_id?,
  name: string, description?: string,
  item_type?: "weapon" | "armor" | "accessory" | "consumable" | "misc",
  properties?: Record<string, any>,
  stackable?: boolean,
  modifiers?: { attribute: string, operation?: string, value: number }[]
}
Output: created Item
```

#### `steward_update_item` / `steward_delete_item`

Standard update and delete by ID.

### Locations & Map

#### `steward_list_locations`

Returns all locations and edges for the campaign map.

```
Input: { campaign_id? }
Output: {
  locations: Location[],
  edges: Edge[]
}
```

Each location includes: `id, name, description, parent_id, encounter_modifier, properties, position_x, position_y, weather_override`.

Each edge includes: `id, from_location_id, to_location_id, label, description, travel_hours, bidirectional, encounter_modifier, properties, weather_override`.

#### `steward_create_location`

```
Input: {
  campaign_id?,
  name: string, description?: string,
  parent_id?: number,
  encounter_modifier?: number,
  properties?: Record<string, any>,
  position_x?: number, position_y?: number,
  weather_override?: { mode: "fixed" | "weighted", value: string | Record<string, number> } | null
}
Output: created Location
```

#### `steward_create_edge`

```
Input: {
  campaign_id?,
  from_location_id: number, to_location_id: number,
  label?: string, description?: string,
  travel_hours?: number, bidirectional?: boolean,
  encounter_modifier?: number,
  properties?: Record<string, any>,
  weather_override?: { mode: "fixed" | "weighted", value: string | Record<string, number> } | null
}
Output: created Edge
```

### Encounters

#### `steward_list_encounters`

```
Input: { campaign_id?, search?: string }
Output: Encounter[] — each includes name, description, notes, npcs, loot_table, conditions, environment_overrides
```

#### `steward_create_encounter`

```
Input: {
  campaign_id?,
  name: string, description?: string, notes?: string,
  npcs?: { character_id: number, role: string }[],
  environment_overrides?: Record<string, any>,
  loot_table?: { item_name: string, quantity: number, drop_chance: number }[],
  conditions?: {
    location_ids?: number[],
    edge_ids?: number[],
    time_of_day?: string[],
    weather?: string[],
    weight?: number
  }
}
Output: created Encounter
```

#### `steward_start_encounter` / `steward_end_encounter`

```
Input: { campaign_id?, encounter_id: number }
Output: { success, encounter_name, events: [...] }
```

### Rules

#### `steward_list_rules`

```
Input: { campaign_id?, search?: string, trigger_type?: string, tag?: string }
Output: Rule[] — full rule objects
```

#### `steward_create_rule`

```
Input: {
  campaign_id?,
  name: string, description?: string,
  enabled?: boolean,
  trigger_type: "on_time_advance" | "on_effect_change" | "on_item_change" |
                "on_threshold" | "on_location_change" | "on_rest" | "on_schedule" | "on_encounter",
  trigger_config?: object,
  conditions?: object,    // { all: [...] } or { any: [...] } tree
  actions?: object[],     // action array
  action_mode?: "auto" | "suggest",
  priority?: number,
  tags?: string[],
  target_mode?: "environment" | "all_pcs" | "all_npcs" | "all_characters" | "specific_characters",
  target_config?: object
}
Output: created Rule
```

#### `steward_toggle_rule`

```
Input: { campaign_id?, rule_id: number }
Output: updated Rule (with toggled enabled state)
```

#### `steward_test_rule`

Dry-run a rule against current state without applying anything.

```
Input: { campaign_id?, rule_id: number, character_id?: number }
Output: {
  overall_pass: boolean,
  details: { condition evaluations... },
  character_used?: { id, name },
  environment_snapshot: { weather, time_of_day, ... },
  actions_would_fire: action[]
}
```

#### `steward_get_rule_references`

Find which rules reference a given entity (for impact analysis).

```
Input: { campaign_id?, entity_type: string, entity_name?: string, entity_id?: number }
Output: RuleReference[]
```

### Notifications

#### `steward_get_notifications`

```
Input: { campaign_id?, unread_only?: boolean, limit?: number, offset?: number }
Output: Notification[] — includes notification_type, message, severity, actions_data, read, dismissed
```

#### `steward_apply_notification`

Apply suggested actions from a "suggestion" type notification.

```
Input: { campaign_id?, notification_id: number }
Output: { success, results: [...] }
```

#### `steward_dismiss_notification`

```
Input: { campaign_id?, notification_id: number }
Output: { success: true }
```

#### `steward_undo_notification`

Undo auto-applied actions (reverts attribute changes, re-adds consumed items, etc).

```
Input: { campaign_id?, notification_id: number }
Output: { success, undone: number }
```

### Campaigns

#### `steward_list_campaigns`

```
Input: {}
Output: Campaign[] — id, name, created_at
```

#### `steward_get_campaign`

```
Input: { campaign_id }
Output: {
  id, name, created_at,
  attribute_definitions,    // [{ key, label, type?, options? }]
  time_of_day_thresholds,   // [{ label, start }]
  calendar_config,          // { months, weekdays }
  weather_options,          // string[]
  encounter_settings,       // { enabled, base_rate, min_interval_hours }
  weather_volatility,
  rules_settings,           // { cascade_depth_limit, engine_enabled }
  season_options
}
```

#### `steward_update_campaign`

```
Input: { campaign_id, ...partial campaign fields }
Output: updated Campaign
```

### Import/Export

#### `steward_export_campaign`

```
Input: { campaign_id }
Output: Full campaign JSON (version, campaign, all entities, environment, log)
```

#### `steward_import_campaign`

```
Input: { data: object }  // full campaign JSON
Output: { id, name } of newly created campaign
```

---

## Compound Tool: `steward_get_environment`

This is the most important tool for session play. It should return a rich, pre-formatted summary that gives the LLM full situational awareness in one call. The markdown format should look like:

```markdown
## Current State

**Time:** 14:30, Day 15 of Highsun, Year 1 (Afternoon)
**Weather:** Overcast
**Location:** Waterdeep
**Notes:** The merchant festival is underway

### Calendar
Month 6 of 12 (Highsun), 30 days | Weekday: Starday

### Party Members
- Thorin Ironforge (PC) — STR 20, CON 13 | Poisoned (-2 CON, 3h left)
- Elara Nightwhisper (PC) — WIS 18, INT 16 | Blessed (+2 WIS)

### Unread Notifications: 2
```

Implementation note: This tool should make parallel requests to `/environment`, `/characters` (PCs only), and `/notifications/count` to assemble a complete snapshot. This is a workflow tool that goes beyond a single API wrapper.

---

## Error Handling

All tools should return actionable error messages:

| Scenario | Error Message |
|---|---|
| No campaign specified | `"No campaign specified. Set STEWARD_CAMPAIGN_ID or pass campaign_id. Use steward_list_campaigns to see available campaigns."` |
| Campaign not found | `"Campaign #5 not found. Use steward_list_campaigns to see available campaigns."` |
| Character not found | `"Character #42 not found in campaign #1. Use steward_list_characters to see available characters."` |
| Effect not in catalog | `"Status effect #10 not found. Use steward_list_status_effects to see available effects."` |
| Steward unreachable | `"Cannot reach Steward at http://localhost:3001. Is the server running?"` |
| Travel with no location | `"Party has no current location. Use steward_set_party_position first."` |

---

## Design Decisions

### Why stdio over HTTP?
Steward is a self-hosted, single-user tool. The MCP server runs on the same machine as the Steward server and connects to it over localhost. There's no need for multi-client support or remote access. stdio is simpler to configure and has lower overhead.

### Why a default campaign ID?
Most users run one campaign at a time. Requiring `campaign_id` on every call would be tedious. The env var default makes 90% of interactions smoother while still supporting multi-campaign use.

### Why combine character + computed stats + inventory into one tool?
The LLM almost always needs the full picture when reasoning about a character. Three separate calls would waste context tokens and add latency. The single `steward_get_character` tool is the "character sheet" — one call, full picture.

### Why enrich `steward_get_environment` beyond the API?
Same reasoning. The LLM needs situational awareness. Returning just the raw environment row would require follow-up calls for character state, notifications, etc. The enriched version gives the LLM everything it needs to make decisions in one round-trip.

### Why include destructive tools?
An MCP server that can only read is of limited use for a DM assistant. The LLM needs to advance time, apply effects, manage inventory, and run encounters. The `destructiveHint` annotation lets clients prompt for confirmation on writes.

### Tool count
53 tools is high but justified: Steward has 60+ API endpoints across 8 entity types. Each tool maps to a clear, atomic operation. The tier system helps implementers prioritize — Tier 1 (21 tools) covers 90% of session-play use cases.

---

## Implementation Priorities

1. **Phase 1 — Session Play** (Tier 1): Ship the 21 tools needed to run a live game session
2. **Phase 2 — World Building** (Tier 2): Add entity CRUD for all 6 entity types
3. **Phase 3 — Rules & Advanced** (Tiers 3-4): Rules management, import/export
