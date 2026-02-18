---
title: Administration
layout: default
nav_order: 5
---

# Administration Guide

## Docker Deployment

### docker-compose.yml

```yaml
services:
  almanac:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    volumes:
      - ./data:/data
    environment:
      - ALMANAC_DATA_DIR=/data
      - PORT=3000
    restart: unless-stopped
```

### Running

```bash
# Start (builds if needed)
docker compose up -d

# Custom port
PORT=8080 docker compose up -d

# Rebuild after code changes
docker compose build && docker compose up -d

# View logs
docker compose logs -f almanac

# Stop
docker compose down
```

### Volumes

The `./data` directory on the host is mounted to `/data` in the container. This is where the SQLite database file (`almanac.db`) lives. The volume ensures data persists across container restarts and rebuilds.

### Restart Policy

`restart: unless-stopped` means the container restarts automatically after crashes or host reboots, unless you explicitly stop it with `docker compose down`.

---

## Bare-Metal Deployment

### Production

```bash
# Build the frontend
cd client && npm install && npm run build && cd ..

# Install server dependencies
cd server && npm install --production && cd ..

# Start the server
cd server && npm start
```

The server serves the built frontend and API on the configured port (default 3000).

### Behind a Reverse Proxy

Almanac runs on a single port serving both the frontend and API. Point your reverse proxy (nginx, Caddy, etc.) to `http://localhost:3000`:

```nginx
# nginx example
server {
    listen 80;
    server_name almanac.example.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ALMANAC_DATA_DIR` | `server/data/` | Directory for the SQLite database file |

In Docker, `ALMANAC_DATA_DIR` is set to `/data` by default.

---

## Database

### Storage

All data is stored in a single SQLite file: `almanac.db` in the configured data directory.

- **Docker:** `./data/almanac.db` on the host (mounted from `/data` in the container)
- **Bare-metal:** `server/data/almanac.db` by default

### SQLite Configuration

- **WAL mode** — Write-Ahead Logging for better concurrent read performance
- **Foreign keys** — enforced for referential integrity

### Schema

The database has 17 tables:

| Table | Purpose |
|-------|---------|
| `campaigns` | Campaign metadata, attribute definitions, calendar, weather, encounter settings, rules settings, presets |
| `characters` | PC and NPC definitions with base attributes. `spawned_from_encounter_id` tracks auto-spawned NPCs. |
| `status_effect_definitions` | Effect templates with modifiers and duration |
| `item_definitions` | Item templates with modifiers and properties |
| `encounter_definitions` | Encounter templates with NPCs, loot, conditions. `starts_combat` enables auto-combat. |
| `applied_effects` | Active effects on characters (junction table) |
| `character_items` | Items in character inventories (junction table) |
| `environment_state` | Current game world state (time, weather, location, combat state) |
| `locations` | Map locations with properties and weather overrides |
| `location_edges` | Connections between locations with travel data |
| `session_log` | Timestamped log of all game actions (includes in-game `game_time`) |
| `rule_definitions` | Automation rules with triggers, conditions, actions |
| `rule_state` | Persistent state for rules (e.g., last rest time) |
| `rule_action_log` | History of rule-applied changes (for undo) |
| `notifications` | Rule-generated notifications |
| `journal_notes` | DM journal entries with tags, starring, and wikilinks |
| `random_table_definitions` | Random table metadata and type (weighted/sequential) |

### Migrations

Schema migrations run automatically on startup. New columns are added idempotently using `ALTER TABLE` with duplicate-column error handling.

---

## Backup and Restore

### File-Based Backup

The simplest backup is copying the database file:

```bash
# Docker
cp ./data/almanac.db ./backups/almanac-$(date +%Y%m%d).db

# Bare-metal
cp server/data/almanac.db ./backups/almanac-$(date +%Y%m%d).db
```

To restore, stop the server and replace the database file.

### Export/Import Backup

Use the in-app export feature for portable, human-readable backups:

1. **Export** each campaign from the UI (JSON file per campaign)
2. To restore, create a new Almanac instance and **Import** each JSON file

This approach is more portable (not tied to SQLite version) but doesn't include notifications or rule action history.

---

## Seed Data

Load example data to explore features:

```bash
# Docker
docker compose exec almanac node server/src/seed.js

# Bare-metal
cd server && npm run seed
```

The seed script is idempotent — if "Example Campaign" already exists, it skips without error.

See [Getting Started](getting-started.md#load-seed-data-optional) for details on what the seed data includes.

---

## Updating

### Docker

```bash
# Pull latest code
git pull

# Rebuild and restart
docker compose build && docker compose up -d
```

Data persists in the `./data` volume across rebuilds.

### Bare-Metal

```bash
# Pull latest code
git pull

# Rebuild frontend
cd client && npm install && npm run build && cd ..

# Update server dependencies
cd server && npm install --production && cd ..

# Restart
cd server && npm start
```

---

## API Reference

All endpoints are prefixed with `/api`. Campaign-scoped endpoints use `/api/campaigns/:id/...`.

### Campaigns

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get campaign with parsed config fields |
| POST | `/api/campaigns` | Create campaign (`name` required) |
| PUT | `/api/campaigns/:id` | Update campaign (partial update supported) |
| DELETE | `/api/campaigns/:id` | Delete campaign and all associated data |

### Characters

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/characters` | List characters (query: `type`, `search`, `include_spawned`) |
| GET | `/api/campaigns/:id/characters/:charId` | Get character |
| GET | `/api/campaigns/:id/characters/:charId/computed` | Get computed stats with modifier breakdown |
| POST | `/api/campaigns/:id/characters` | Create character (`name`, `type` required) |
| PUT | `/api/campaigns/:id/characters/:charId` | Update character |
| DELETE | `/api/campaigns/:id/characters/:charId` | Delete character |

### Applied Effects

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/campaigns/:id/characters/:charId/effects` | Apply effect (`status_effect_definition_id` required) |
| DELETE | `/api/campaigns/:id/characters/:charId/effects/:effectId` | Remove applied effect |

Both endpoints fire `on_effect_change` rules and check `on_threshold` rules.

### Character Items

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/campaigns/:id/characters/:charId/items` | Assign item (`item_definition_id` required, `quantity` optional) |
| PATCH | `/api/campaigns/:id/characters/:charId/items/:itemId` | Update quantity (`quantity` required; 0 removes item) |
| DELETE | `/api/campaigns/:id/characters/:charId/items/:itemId` | Remove item |

Item changes fire `on_item_change` rules.

### Status Effect Definitions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/status-effects` | List definitions (query: `search`, `tag`) |
| GET | `/api/campaigns/:id/status-effects/:effectId` | Get definition |
| POST | `/api/campaigns/:id/status-effects` | Create definition (`name` required) |
| PUT | `/api/campaigns/:id/status-effects/:effectId` | Update definition |
| DELETE | `/api/campaigns/:id/status-effects/:effectId` | Delete definition (cascades to applied instances) |

### Item Definitions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/items` | List definitions (query: `search`, `item_type`) |
| GET | `/api/campaigns/:id/items/:itemId` | Get definition |
| POST | `/api/campaigns/:id/items` | Create definition (`name` required) |
| PUT | `/api/campaigns/:id/items/:itemId` | Update definition |
| DELETE | `/api/campaigns/:id/items/:itemId` | Delete definition (cascades to character items) |

### Encounter Definitions

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/encounters` | List encounters (query: `search`) |
| GET | `/api/campaigns/:id/encounters/:encId` | Get encounter |
| POST | `/api/campaigns/:id/encounters` | Create encounter (`name` required) |
| PUT | `/api/campaigns/:id/encounters/:encId` | Update encounter |
| DELETE | `/api/campaigns/:id/encounters/:encId` | Delete encounter |
| POST | `/api/campaigns/:id/encounters/:encId/start` | Start encounter (fires rules; auto-starts combat if `starts_combat` is set) |
| POST | `/api/campaigns/:id/encounters/:encId/end` | End encounter (fires rules, cleans up spawned NPCs, ends combat) |

### Environment

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/environment` | Get environment state (enriched with time_of_day, month_name, location_name) |
| PATCH | `/api/campaigns/:id/environment` | Update environment fields |
| POST | `/api/campaigns/:id/environment/advance` | Advance time (`hours`, `minutes`) |

### Locations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/locations` | Get all locations and edges |
| GET | `/api/campaigns/:id/locations/:locId` | Get single location |
| POST | `/api/campaigns/:id/locations` | Create location (`name` required) |
| PUT | `/api/campaigns/:id/locations/:locId` | Update location |
| DELETE | `/api/campaigns/:id/locations/:locId` | Delete location |
| GET | `/api/campaigns/:id/locations/edges/list` | Get all edges |
| POST | `/api/campaigns/:id/locations/edges` | Create edge (`from_location_id`, `to_location_id` required) |
| PUT | `/api/campaigns/:id/locations/edges/:edgeId` | Update edge |
| DELETE | `/api/campaigns/:id/locations/edges/:edgeId` | Delete edge |
| POST | `/api/campaigns/:id/locations/travel` | Travel along edge (`edge_id` required) |
| PATCH | `/api/campaigns/:id/locations/position` | Set party position (`location_id`, or null to clear) |

### Rest

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/campaigns/:id/rest` | Take rest (`rest_type`: "short" or "long") |

Short rest = 1 hour, Long rest = 8 hours. Fires `on_rest` rules, advances time, records rest time per character.

### Rules

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/rules` | List rules (query: `search`, `tag`, `trigger_type`) |
| GET | `/api/campaigns/:id/rules/:ruleId` | Get rule |
| POST | `/api/campaigns/:id/rules` | Create rule (`name`, `trigger_type` required) |
| PUT | `/api/campaigns/:id/rules/:ruleId` | Update rule |
| DELETE | `/api/campaigns/:id/rules/:ruleId` | Delete rule |
| PATCH | `/api/campaigns/:id/rules/:ruleId/toggle` | Toggle rule enabled/disabled |
| POST | `/api/campaigns/:id/rules/:ruleId/test` | Test rule (optional `character_id` in body) |
| GET | `/api/campaigns/:id/rules/templates` | Get all rule templates by category |
| POST | `/api/campaigns/:id/rules/templates/:name` | Import rule template |
| GET | `/api/campaigns/:id/rules/references` | Get rule references (query: `entity_type`, `entity_name`, `entity_id`) |

### Tag Presets

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/rules/tag-presets` | Get all presets (built-in + custom) |
| POST | `/api/campaigns/:id/rules/tag-presets/:name` | Import preset (creates attribute + rules) |
| POST | `/api/campaigns/:id/rules/tag-presets/custom` | Save custom preset |
| DELETE | `/api/campaigns/:id/rules/tag-presets/custom/:key` | Delete custom preset |
| GET | `/api/campaigns/:id/rules/tag-presets/custom/:key/export` | Export custom preset |

### Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/notifications` | Get notifications (query: `unread_only`, `limit`, `offset`) |
| GET | `/api/campaigns/:id/notifications/count` | Get unread count |
| PATCH | `/api/campaigns/:id/notifications/:nId/read` | Mark as read |
| PATCH | `/api/campaigns/:id/notifications/:nId/dismiss` | Dismiss notification |
| POST | `/api/campaigns/:id/notifications/:nId/apply` | Apply suggested actions |
| POST | `/api/campaigns/:id/notifications/:nId/undo` | Undo auto-applied actions |
| DELETE | `/api/campaigns/:id/notifications` | Clear all notifications |

### Session Log

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/session-log` | Get log entries (query: `limit`, `offset`, `entry_type`). Includes `game_time` with in-game timestamps. |
| POST | `/api/campaigns/:id/session-log` | Add manual entry (`message` required) |
| DELETE | `/api/campaigns/:id/session-log` | Clear all entries |

### Combat

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/combat` | Get combat state (round, turn index, combatants with stats/effects) |
| POST | `/api/campaigns/:id/combat` | Start combat (`combatants` array of `{character_id, initiative}` required) |
| DELETE | `/api/campaigns/:id/combat` | End combat and clear state |
| POST | `/api/campaigns/:id/combat/next-turn` | Advance to next turn (decrements round-based effects, fires rules on new round) |
| PATCH | `/api/campaigns/:id/combat` | Update combat settings (combatants, `advance_time`, `time_per_round_seconds`) |

Combat state is stored in the `environment_state` table. When `advance_time` is enabled (default), the game clock advances by `time_per_round_seconds` (default 6) at the start of each new round.

### Journal

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/journal` | List notes (query: `search`, `tag`, `starred`, `limit`, `offset`) |
| GET | `/api/campaigns/:id/journal/search-entities` | Search entities for wikilink autocomplete (query: `q`) |
| GET | `/api/campaigns/:id/journal/:noteId` | Get note |
| POST | `/api/campaigns/:id/journal` | Create note (`title`, `content`, `tags`, `starred`) |
| PUT | `/api/campaigns/:id/journal/:noteId` | Update note (partial update supported) |
| DELETE | `/api/campaigns/:id/journal/:noteId` | Delete note |

Journal notes support wikilinks (`[[Character Name]]`) that link to campaign entities.

### Random Tables

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/random-tables` | List tables (query: `search`) |
| GET | `/api/campaigns/:id/random-tables/:tableId` | Get table with entries |
| POST | `/api/campaigns/:id/random-tables` | Create table (`name` required, `entries`, `table_type`) |
| PUT | `/api/campaigns/:id/random-tables/:tableId` | Update table |
| DELETE | `/api/campaigns/:id/random-tables/:tableId` | Delete table |
| POST | `/api/campaigns/:id/random-tables/:tableId/roll` | Roll on table (result logged to session log) |

Tables can be `weighted` (entries have weights) or `sequential` (equal probability).

### Export / Import

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/campaigns/:id/export-import/export` | Export full campaign as JSON download |
| POST | `/api/campaigns/:id/export-import/import` | Import full campaign (creates new) |
| POST | `/api/campaigns/:id/export-import/import/preview` | Preview merge import with conflict detection |
| POST | `/api/campaigns/:id/export-import/import/merge` | Execute merge import with conflict decisions |

---

## Troubleshooting

### Database Locked

If you see "database is locked" errors, ensure only one server instance is running. SQLite allows one writer at a time. WAL mode handles concurrent reads well but multiple processes writing simultaneously will conflict.

### Port Already in Use

```bash
# Find what's using the port
lsof -i :3000

# Use a different port
PORT=8080 docker compose up -d
```

### Container Won't Start

```bash
# Check logs
docker compose logs almanac

# Rebuild from scratch
docker compose build --no-cache && docker compose up -d
```

### Data Directory Permissions

The data directory must be writable by the Node.js process. In Docker, the directory is created automatically. For bare-metal:

```bash
mkdir -p server/data
chmod 755 server/data
```

### Missing Seed Data

The seed script skips if "Example Campaign" already exists. To re-seed, delete the existing campaign first (or delete the database file and restart).

### Rules Not Firing

Common causes:

- **Engine disabled** — check Settings → Rules Engine → Engine enabled
- **Rule disabled** — check the toggle on the rule card
- **Conditions failing** — use the Test panel to see which conditions fail and why
- **Name mismatch** — rules reference effects and items by exact name (case-sensitive)
- **Wrong target mode** — character conditions fail in Environment target mode
- **Cascade limit reached** — deeply chained rules become suggestions instead of auto-applying

### Import Failures

- **Version mismatch** — imports expect the Almanac export format with a version header
- **Missing prerequisites** — imported rules may reference effects/items that don't exist. Create them first or edit the rules after import.
- **ID conflicts** — the import system remaps IDs automatically, but cross-references (like encounter NPC IDs) require matching entities to exist
