# Almanac — DM Homebrew Manager

A self-hosted web application for tabletop RPG Dungeon Masters to manage homebrew content, characters, status effects, items, encounters, and in-game environment state during sessions.

## Features

- **Characters** — Manage PCs and NPCs with user-defined attributes and computed effective stats
- **Status Effects** — Define homebrew status effects with attribute modifiers, tags, and duration tracking
- **Items** — Create items with passive modifiers, properties, and quantity tracking
- **Encounters** — Plan encounters with NPC lists, loot tables, and environment overrides
- **Environment Tracker** — Track in-game time, calendar date, weather, and freeform conditions
- **Session Log** — Automatic logging of all DM actions with manual entry support
- **Multi-Campaign** — Manage multiple campaigns with independent data
- **Import/Export** — Full campaign backup and restore as JSON

## Quick Start (Docker)

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`.

To load example seed data (optional):

```bash
docker compose exec almanac node server/src/seed.js
```

To use a custom port:

```bash
PORT=8080 docker compose up -d
```

## Bare-Metal Setup

### Prerequisites

- Node.js 18+
- npm

### Install & Run

```bash
# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies and build
cd client && npm install && npm run build && cd ..

# Seed example data (optional)
cd server && npm run seed && cd ..

# Start the server
cd server && npm start
```

The server serves both the API and the built frontend on `http://localhost:3000`.

### Development Mode

Run the backend and frontend dev servers separately:

```bash
# Terminal 1: Backend (auto-restarts on changes)
cd server && npm run dev

# Terminal 2: Frontend (hot reload via Vite, proxies API to :3000)
cd client && npm run dev
```

Frontend dev server runs on `http://localhost:5173` with API proxied to the backend.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `ALMANAC_DATA_DIR` | `server/data/` | Directory for SQLite database |

## Seed Data

Load example campaign data:

```bash
cd server && npm run seed
```

This creates:
- **Campaign:** "Example Campaign" with 8 attributes (strength, dexterity, constitution, intelligence, wisdom, charisma, stamina, luck)
- **Characters:** Aldric (PC), Mira (PC), Goblin Chieftain (NPC)
- **Status Effects:** Enraged, Blessed, Poisoned, Inspired, Exhausted
- **Items:** Sword of Valor, Cloak of Shadows, Ring of Fortitude, Healing Potion, Cursed Amulet
- **Encounter:** Thornwood Ambush
- **Environment:** Day 15, Month 3, Year 1247, 14:30, Overcast

## API Endpoints

All endpoints are prefixed with `/api`. Campaign-scoped endpoints use `/api/campaigns/:id/...`.

### Campaigns

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns` | List all campaigns |
| GET | `/api/campaigns/:id` | Get campaign details |
| POST | `/api/campaigns` | Create campaign |
| PUT | `/api/campaigns/:id` | Update campaign |
| DELETE | `/api/campaigns/:id` | Delete campaign |

### Characters

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns/:id/characters` | List characters (query: `type`, `search`) |
| GET | `/api/campaigns/:id/characters/:charId` | Get character |
| GET | `/api/campaigns/:id/characters/:charId/computed` | Get computed stats with breakdown |
| POST | `/api/campaigns/:id/characters` | Create character |
| PUT | `/api/campaigns/:id/characters/:charId` | Update character |
| DELETE | `/api/campaigns/:id/characters/:charId` | Delete character |

### Applied Effects

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/campaigns/:id/characters/:charId/effects` | Apply effect (`{status_effect_definition_id}`) |
| DELETE | `/api/campaigns/:id/characters/:charId/effects/:effectId` | Remove applied effect |

### Character Items

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/campaigns/:id/characters/:charId/items` | Assign item (`{item_definition_id, quantity}`) |
| PATCH | `/api/campaigns/:id/characters/:charId/items/:itemId` | Update quantity (`{quantity}`) |
| DELETE | `/api/campaigns/:id/characters/:charId/items/:itemId` | Remove item |

### Status Effect Definitions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns/:id/status-effects` | List definitions (query: `search`, `tag`) |
| GET | `/api/campaigns/:id/status-effects/:effectId` | Get definition |
| POST | `/api/campaigns/:id/status-effects` | Create definition |
| PUT | `/api/campaigns/:id/status-effects/:effectId` | Update definition |
| DELETE | `/api/campaigns/:id/status-effects/:effectId` | Delete definition |

### Item Definitions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns/:id/items` | List definitions (query: `search`, `item_type`) |
| GET | `/api/campaigns/:id/items/:itemId` | Get definition |
| POST | `/api/campaigns/:id/items` | Create definition |
| PUT | `/api/campaigns/:id/items/:itemId` | Update definition |
| DELETE | `/api/campaigns/:id/items/:itemId` | Delete definition |

### Encounter Definitions

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns/:id/encounters` | List encounters (query: `search`) |
| GET | `/api/campaigns/:id/encounters/:encId` | Get encounter |
| POST | `/api/campaigns/:id/encounters` | Create encounter |
| PUT | `/api/campaigns/:id/encounters/:encId` | Update encounter |
| DELETE | `/api/campaigns/:id/encounters/:encId` | Delete encounter |

### Environment

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns/:id/environment` | Get environment state |
| PATCH | `/api/campaigns/:id/environment` | Update environment |
| POST | `/api/campaigns/:id/environment/advance` | Advance time (`{hours, minutes}`) |

### Session Log

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns/:id/session-log` | Get log (query: `limit`, `offset`, `entry_type`) |
| POST | `/api/campaigns/:id/session-log` | Add manual entry |
| DELETE | `/api/campaigns/:id/session-log` | Clear log |

### Export / Import

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/campaigns/:id/export` | Export full campaign as JSON |
| POST | `/api/campaigns/:id/import` | Import campaign from JSON |

## UI Pages

- **Characters** — Card grid of all characters with type filter and search. Click to open detail view.
- **Character Detail** — Full attribute table with base/modifier/effective columns, applied effects list with remove buttons, inventory with quantity controls, and quick-apply modals for effects and items (3 clicks max).
- **Status Effects Library** — Searchable table of all effect definitions with CRUD.
- **Items Library** — Searchable table of all item definitions with CRUD.
- **Encounters Library** — Expandable cards for encounters with "Start" button to apply environment overrides.
- **Settings** — Configure campaign attributes, time-of-day thresholds, calendar months, weather options, and current environment state.
- **Session Log** — Paginated, filterable log with manual entry and export.

## Tech Stack

- **Backend:** Node.js, Express, better-sqlite3
- **Frontend:** React 18, Vite, React Router
- **Database:** SQLite (WAL mode)
- **Deployment:** Docker / docker-compose

## Data Storage

All data is stored in a single SQLite database file (`almanac.db`) in the configured data directory. The database uses WAL mode for performance and foreign keys for referential integrity.
