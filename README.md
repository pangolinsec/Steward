# Steward — DM Homebrew Manager

A self-hosted web application for tabletop RPG Dungeon Masters to manage homebrew content, characters, world state, and session automation. System-agnostic — define your own attributes, effects, items, and rules for any game system.

## Features

- **Characters** — PCs and NPCs with custom numeric and tag attributes, computed effective stats, modifier breakdowns
- **Status Effects** — Homebrew effects with attribute modifiers, tags, and duration tracking (indefinite, timed, rounds)
- **Items** — Equipment and consumables with passive modifiers, custom properties, and stackable quantities
- **Encounters** — Planned encounters with NPC rosters (existing or ad-hoc, with counts), loot tables, drop chances, random encounter conditions, and optional auto-combat that spawns NPCs and rolls initiative
- **Locations & Travel** — Interactive map canvas, pathfinding, multi-leg route planning, travel with time advancement and encounter rolls
- **Rules Engine** — Declarative automation with 8 trigger types, 20 condition types, and 12 action types. Auto-apply or suggest changes. Full undo support.
- **Environment Tracker** — In-game time, custom calendar, weather with volatility and transition tables, seasons
- **Random Encounters** — Configurable base rates, location/edge modifiers, condition-filtered weighted selection
- **Notifications & Undo** — Rule-generated notifications with undo for auto-applied changes and approve/dismiss for suggestions
- **Resting** — Short and long rest with time advancement and rule triggers
- **Session Prep** — Structured session planning (strong start, scenes, secrets) with location linking and carry-forward
- **Session Log** — Automatic logging of all DM actions with manual entries, filtering, and export
- **Import & Export** — Full campaign backup, partial merge import with conflict resolution, per-entity export/import
- **Tag Presets** — Bundled attribute definitions with associated rules for easy reuse
- **Multi-Campaign** — Independent campaigns with full data isolation
- **LLM Integration** — Generate importable content with any LLM using ready-to-use prompts, or connect the MCP server for an AI Dungeon Master or world-building assistant

## Quick Start (Docker)

```bash
docker compose up -d
```

The app will be available at `http://localhost:3000`.

To get started with a pre-built campaign, import the included oneshot from the campaign switcher (top-left menu → Import):

```
sample-data/classic-oneshot.json
```

This loads a complete fantasy oneshot with characters, items, effects, encounters, locations, and automation rules — ready to play or use as a reference for building your own campaign.

Alternatively, load minimal seed data programmatically:

```bash
docker compose exec steward node server/src/seed.js
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
| [Overview](docs/index.md) | What Steward is and feature highlights |
| [Getting Started](docs/getting-started.md) | Installation, setup, and creating your first campaign |
| [User Guide](docs/user-guide.md) | Complete feature guide for DMs |
| [Rules Engine](docs/rules-engine.md) | Building automation rules, conditions, actions, and templates |
| [Administration](docs/administration.md) | Deployment, database, backup, API reference, and troubleshooting |
| [Using LLMs](docs/using-llms.md) | AI Dungeon Master, world-building assistant, and content generation |
| [LLM Content Generation](docs/llm-generation.md) | Ready-to-use prompts for generating importable JSON |
| [MCP Server Guide](MCP-server-usage.md) | Installation and tool reference for the Steward MCP server |

## License

All rights reserved. This software is provided for **personal, non-commercial use only**. You may use, copy, and modify it for your own tabletop RPG sessions. You may not sell it, host it as a paid service, or use it in any commercial product. For commercial licensing inquiries, contact the author.
