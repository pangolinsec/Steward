# Getting Started

## Quick Start (Docker)

The fastest way to run Almanac:

```bash
git clone <repo-url> && cd almanac
docker compose up -d
```

Open `http://localhost:3000` in your browser.

To use a different port:

```bash
PORT=8080 docker compose up -d
```

### Load Seed Data (Optional)

Seed data creates an example campaign with characters, effects, items, encounters, locations, and environment state — useful for exploring features before building your own campaign.

```bash
docker compose exec almanac node server/src/seed.js
```

This creates:

- **Campaign:** "Example Campaign" with 8 attributes (strength, dexterity, constitution, intelligence, wisdom, charisma, stamina, luck)
- **Characters:** Aldric (PC paladin), Mira (PC rogue), Goblin Chieftain (NPC)
- **Status Effects:** Enraged, Blessed, Poisoned, Inspired, Exhausted
- **Items:** Sword of Valor, Cloak of Shadows, Ring of Fortitude, Healing Potion, Cursed Amulet
- **Locations:** Silverdale (town), Thornwood (forest), Iron Hold (dwarven fortress) with connecting roads
- **Encounters:** Thornwood Ambush, Mountain Wolves (with conditions and loot tables)
- **Environment:** Day 15, Month 3, Year 1247, 14:30, Overcast, party at Silverdale

---

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

Run the backend and frontend dev servers separately for hot reloading:

```bash
# Terminal 1: Backend (auto-restarts on changes)
cd server && npm run dev

# Terminal 2: Frontend (hot reload via Vite, proxies API to :3000)
cd client && npm run dev
```

The frontend dev server runs on `http://localhost:5173` with API requests proxied to the backend.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ALMANAC_DATA_DIR` | `server/data/` | Directory for the SQLite database file |

In Docker, `ALMANAC_DATA_DIR` is set to `/data` and the `./data` host directory is mounted as a volume for persistence.

---

## Creating Your First Campaign

When you first open Almanac, you'll see an empty campaign list.

### 1. Create a Campaign

Click **+ New Campaign** and give it a name. This creates a campaign with sensible defaults:

- Standard time-of-day periods (Night, Dawn, Morning, Afternoon, Dusk, Evening, Night)
- A 12-month Gregorian calendar
- Common weather options (Clear, Overcast, Rain, Heavy Rain, Snow, Fog, Storm, Windy, Hail)
- Random encounters disabled
- Rules engine enabled

### 2. Define Attributes

Go to **Settings** and add the attributes your game system uses. Each attribute has:

- **Key** — internal identifier (e.g., `strength`)
- **Label** — display name (e.g., "Strength")
- **Type** — `numeric` (default, for stats with modifiers) or `tag` (for string values like faction, species, class)

For tag attributes, also define the available **options** (e.g., a "faction" attribute with options "Alliance", "Horde", "Neutral").

You can add as many attributes as you need. There are no hardcoded stats — Almanac adapts to your system.

### 3. Add Characters

Go to **Characters** and click **+ New Character**. Fill in:

- **Name** — required
- **Type** — PC or NPC
- **Description** — optional flavor text
- **Portrait URL** — optional image URL
- **Base Attributes** — set values for each attribute you defined (numeric defaults to 10, tags use a dropdown)

Characters immediately appear in the card grid. Click a character card to see their full detail page with computed stats, applied effects, and inventory.

### 4. Create Content

From the sidebar, create the building blocks for your campaign:

- **Status Effects** — buffs, debuffs, and conditions with attribute modifiers and duration
- **Items** — equipment, consumables, and misc items with modifiers and properties
- **Encounters** — planned encounters with NPC rosters and loot tables

### 5. Set Up the World

In **Settings**, configure:

- **Time-of-day thresholds** — when "Morning" becomes "Afternoon", etc.
- **Calendar** — month names and day counts (fantasy calendars welcome)
- **Weather options** — the weather types available in your world
- **Weather volatility** — how often weather changes on time advance (0% = never, 100% = every time)

### 6. Build the Map (Optional)

Go to **Locations** to build an interactive map:

- **Double-click** the canvas to create locations
- **Drag between** location nodes to create connecting paths
- Set travel times, encounter modifiers, and weather overrides per location and path
- Click **Set Party Here** to place the party at a starting location

### 7. Enable Automation (Optional)

Go to **Rules** to set up the rules engine:

- Browse **Templates** for pre-built rules (torch consumption, weather effects, rest recovery)
- Create custom rules with triggers, conditions, and actions
- Start with **Suggest** mode until you trust the rule, then switch to **Auto-apply**

See the [Rules Engine Guide](rules-engine.md) for full details.

---

## What's Next

- [User Guide](user-guide.md) — learn every feature in detail
- [Rules Engine](rules-engine.md) — automate your game world
- [Administration](administration.md) — deployment, backup, and API reference
