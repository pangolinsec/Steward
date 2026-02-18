---
title: Home
layout: default
nav_order: 1
permalink: /
---

# Almanac — DM Homebrew Manager

Almanac is a self-hosted web application for tabletop RPG Dungeon Masters. It manages homebrew content, tracks characters, automates game-world mechanics, and keeps a session log — all in one place.

Almanac is **system-agnostic**. It doesn't assume D&D 5e or any particular ruleset. You define your own attributes (strength, sanity, honor — whatever your game uses), your own status effects, items, weather options, calendar, and automation rules. It works for any tabletop RPG where a DM needs to track characters, world state, and homebrew mechanics.

## Feature Highlights

**Characters & Stats**
Define PCs and NPCs with custom numeric and tag attributes. Effective stats are computed automatically from base values, equipped item modifiers, and applied status effects — with a full breakdown of every modifier source.

**Status Effects & Items**
Create homebrew status effects with attribute modifiers, duration tracking (indefinite, timed, or round-based), and tags. Define items with passive modifiers, custom properties, and stackable quantities. Apply and remove them from characters with a few clicks.

**Encounters**
Build encounter definitions with NPC rosters, loot tables (with drop chances), environment overrides, and conditions that control when random encounters can trigger. Start encounters to apply their environment changes automatically.

**Locations & Travel**
Build an interactive map with locations and connecting paths. Set terrain properties, weather overrides, and encounter modifiers per location and edge. Plan multi-leg travel routes with Ctrl+click pathfinding, then execute travel to advance time, roll weather, and trigger random encounters along the way.

**Rules Engine**
A declarative automation system that acts as a co-DM. Define rules with triggers (time advance, effect change, rest, travel, threshold crossing, scheduled events, encounters), conditions (20 types covering attributes, effects, items, weather, time, location, probability), and actions (apply/remove effects, modify attributes, grant/consume items, change weather, roll dice, notify). Rules can auto-apply changes or suggest them for your approval. Every auto-applied change can be undone.

**Environment & Weather**
Track in-game time, calendar date, weather, and conditions. Weather transitions automatically with configurable volatility and a full transition probability table. Define custom time-of-day thresholds, calendar months, seasons, and weather options.

**Random Encounters**
Configure encounter rates per location with base probability, location modifiers, and minimum intervals. Encounters trigger during travel and time advancement with weighted selection based on conditions.

**Import & Export**
Export full campaigns as JSON for backup or sharing. Import with conflict detection and merge resolution — choose to skip, overwrite, or duplicate conflicting entities. Export and import individual entity types (characters, effects, items, encounters, rules).

**Session Log**
Every action is logged automatically. Add manual entries, filter by type, and export the log for session recaps.

**Notifications & Undo**
Rule actions generate notifications with severity levels. Auto-applied changes show an undo button. Suggested changes wait for your approval. A bell icon with unread count keeps you informed without interrupting play.

**Tag Presets**
Bundle a tag attribute definition with related rules into a reusable preset. Import presets to instantly add an attribute (like "faction" or "species") along with all the automation rules that go with it.

**LLM Integration**
Use any LLM to generate full campaigns, characters, items, encounters, and rules from ready-to-use prompts — then import the JSON directly. Or connect the [MCP server](using-llms.md) to Claude Code for an AI Dungeon Master that runs live sessions, or an AI world-building assistant that creates and manages content conversationally.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Node.js, Express, better-sqlite3 |
| Frontend | React 18, Vite, React Router, React Flow |
| Database | SQLite (WAL mode, foreign keys) |
| Deployment | Docker / docker-compose |

All data lives in a single SQLite file. No external database server required.

## Documentation

| Document | Description |
|----------|-------------|
| [Getting Started](getting-started.md) | Installation, setup, and creating your first campaign |
| [User Guide](user-guide.md) | Complete feature guide for DMs |
| [Rules Engine](rules-engine.md) | Building automation rules, conditions, actions, and templates |
| [Administration](administration.md) | Deployment, backup, API reference, and troubleshooting |
| [Using LLMs](using-llms.md) | AI-powered DM, world-building assistant, and content generation |
| [LLM Content Generation](llm-generation.md) | Ready-to-use prompts for generating importable JSON |
