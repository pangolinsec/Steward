# Almanac — DM Homebrew Manager

A self-hosted web application for tabletop RPG Dungeon Masters to manage homebrew content, characters, world state, and session automation. System-agnostic — define your own attributes, effects, items, and rules for any game system.

## Features

- **Characters** — PCs and NPCs with custom numeric and tag attributes, computed effective stats, modifier breakdowns
- **Status Effects** — Homebrew effects with attribute modifiers, tags, and duration tracking (indefinite, timed, rounds)
- **Items** — Equipment and consumables with passive modifiers, custom properties, and stackable quantities
- **Encounters** — Planned encounters with NPC rosters, loot tables, drop chances, and random encounter conditions
- **Locations & Travel** — Interactive map canvas, pathfinding, multi-leg route planning, travel with time advancement and encounter rolls
- **Rules Engine** — Declarative automation with 8 trigger types, 20 condition types, and 12 action types. Auto-apply or suggest changes. Full undo support.
- **Environment Tracker** — In-game time, custom calendar, weather with volatility and transition tables, seasons
- **Random Encounters** — Configurable base rates, location/edge modifiers, condition-filtered weighted selection
- **Notifications & Undo** — Rule-generated notifications with undo for auto-applied changes and approve/dismiss for suggestions
- **Resting** — Short and long rest with time advancement and rule triggers
- **Session Log** — Automatic logging of all DM actions with manual entries, filtering, and export
- **Import & Export** — Full campaign backup, partial merge import with conflict resolution, per-entity export/import
- **Tag Presets** — Bundled attribute definitions with associated rules for easy reuse
- **Multi-Campaign** — Independent campaigns with full data isolation

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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express, better-sqlite3 |
| Frontend | React 18, Vite, React Router, React Flow |
| Database | SQLite (WAL mode) |
| Deployment | Docker / docker-compose |

## Documentation

| Document | Description |
|----------|-------------|
| [Overview](docs/index.md) | What Almanac is and feature highlights |
| [Getting Started](docs/getting-started.md) | Installation, setup, and creating your first campaign |
| [User Guide](docs/user-guide.md) | Complete feature guide for DMs |
| [Rules Engine](docs/rules-engine.md) | Building automation rules, conditions, actions, and templates |
| [Administration](docs/administration.md) | Deployment, database, backup, API reference, and troubleshooting |
| [LLM Content Generation](docs/llm-generation.md) | Use AI to generate characters, items, encounters, and more |
