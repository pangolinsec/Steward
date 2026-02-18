---
title: Using LLMs with Steward
layout: default
nav_order: 6
---

# Using LLMs with Steward

Steward is designed to work with large language models in three ways:

1. **Generate static content** — Use any LLM to produce importable JSON (characters, encounters, full campaigns)
2. **AI Dungeon Master** — Use the MCP server with Claude Code to run a live game session
3. **AI world-building assistant** — Use the MCP server to create and manage campaign content conversationally

Each approach is independent. You can use any combination, or none at all.

---

## 1. Generate importable content with any LLM

The simplest way to use AI with Steward. No server integration needed — just copy-paste between your LLM and Steward's import feature.

### How it works

1. Open the [LLM Content Generation](llm-generation.md) page for ready-to-use prompts
2. Copy a prompt and fill in the bracketed placeholders with your world details
3. Paste it into any LLM (ChatGPT, Claude, Gemini, etc.)
4. Copy the JSON output
5. In Steward, import via the relevant page's **Import** button, or use **Import Campaign** for a full campaign

### Available prompts

| Prompt | What it generates |
|--------|-------------------|
| **Full Campaign** | Complete campaign with settings, characters, effects, items, encounters, locations, paths, rules, and environment |
| **Characters** | PCs and NPCs with attributes and descriptions |
| **Status Effects** | Buffs, debuffs, and conditions with modifiers and durations |
| **Items** | Weapons, armor, consumables, and misc items |
| **Encounters** | Encounter definitions with conditions, loot tables, and DM notes |
| **Locations and Map** | Locations with connecting paths for the map canvas |
| **Rules** | Automation rules with triggers, conditions, and actions |
| **Campaign Settings** | Just the attribute definitions, calendar, weather, and world configuration |

### Tips

- **Generate in stages.** Start with Campaign Settings to establish attributes, then Characters (which need attribute keys), then Items and Effects, then Rules (which reference effect and item names).
- **Be specific about your world.** "A low-magic medieval setting where gods are silent and survival through harsh winters is the primary challenge" produces better output than "fantasy world."
- **Check cross-references.** Rules reference effects and items by exact name. After importing, the Rules page shows yellow warning badges for missing references.

See [LLM Content Generation](llm-generation.md) for the full prompt library and detailed instructions.

---

## 2. AI Dungeon Master with the MCP server

Use Claude Code with the Steward MCP server to run a full tabletop RPG session. The AI acts as DM — narrating the world, running NPCs, rolling dice, tracking state, and managing combat — while the player interacts through natural conversation.

### Prerequisites

- [Steward MCP server](../MCP-server-usage.md) installed and configured
- Claude Code with the MCP server connected
- A campaign with content (characters, locations, encounters, etc.)

### Setup

1. Start Steward (`docker compose up -d`)
2. Open Claude Code with the Steward MCP server configured
3. Set the DM system prompt as your initial message or in a CLAUDE.md file

### DM system prompts

Two full DM system prompts are included in `LLM-prompts/`:

| File | Description |
|------|-------------|
| `LLM-prompts/DM_SYSTEM_PROMPT.md` | Standard DM prompt. The AI controls all NPCs directly. Best for most sessions. |
| `LLM-prompts/DM_SYSTEM_PROMPT_SUBAGENTS.md` | Advanced DM prompt with a hybrid NPC system. Key NPC companions get spawned as independent subagents for high-stakes decisions, giving them genuine autonomy. Best when you want NPC companions to surprise you. |

Both prompts cover:

- **Role and tone** — Gritty low-fantasy, player agency, no railroading
- **Dice rolling** — Mechanical resolution using `shuf` in bash, shown in the open
- **Combat system** — Initiative, attack resolution, HP tracking, death saves, status effects
- **NPC behavior** — Companions with independent goals, opinions, and reactions
- **World state management** — When to use each MCP tool (time, travel, rest, encounters, effects, inventory, logging)
- **Session flow** — Start-of-session recap, during-play state tracking, end-of-session wrap-up
- **Logging guidelines** — What to record in the session journal for cross-session continuity

### How to use

Start a Claude Code session and paste the DM system prompt as your first message (or put it in a project-level `CLAUDE.md`). Then tell the AI which campaign and character you're playing:

> "Load campaign 1. I'm playing Pip. Start the session."

The DM will call `steward_get_environment` and `steward_get_session_log` to load the world state, give you a recap, and ask "What do you do?"

From there, play naturally:

> "I check the notice board at the tavern."
>
> "I want to sneak past the guards."
>
> "I attack the goblin chief with my dagger."
>
> "We set up camp for the night — I take first watch."

The DM handles all the mechanics: rolling dice, updating HP, applying effects, advancing time, triggering encounters, and logging events.

### Modular prompts

If you don't need the full monolithic prompt, `LLM-prompts/` also contains modular files you can mix and match. Start with `dm-core.md` and add only what you need:

| File | Content |
|------|---------|
| `dm-core.md` | Role, tone, player expectations, golden rules. **Use this with any combination of the others.** |
| `dm-dice-and-mechanics.md` | Dice rolling, ability modifiers, checks, saves, contested checks |
| `dm-combat.md` | Initiative, combat tracker, turns, attacks, damage, death & dying, presentation |
| `dm-npc-companions.md` | Companion decision-making, autonomy, party conflict |
| `dm-characters-and-inventory.md` | Character, effect, and inventory tool reference |
| `dm-travel-and-environment.md` | Time, weather, location, and travel tool reference |
| `dm-encounters.md` | Predefined encounters, ad-hoc encounters, random checks |
| `dm-session-management.md` | Session start/end flow, logging guidelines, session prep and journal tools |
| `dm-rules-and-notifications.md` | Rules engine notification tools |

### Customizing the DM prompt

The included prompts use a specific campaign (The Shattered Crown) as an example. To use them with your own campaign:

- **Sections 1-5** (role, tone, dice, combat) are generic — keep them as-is or adjust the tone
- **Section 6** (NPC companions) — Replace the character prompts with your own NPCs. The subagent variant includes detailed personality profiles for each companion; the standard variant uses simpler behavior guidelines.
- **Sections 7-11** (tools, logging, session flow, encounters, golden rules) are generic — keep them as-is

---

## 3. AI world-building assistant with the MCP server

Use the MCP server conversationally to build and manage campaign content without touching the web UI. The AI can create characters, define locations, write encounters, set up rules, and more — all through natural language.

### Prerequisites

Same as the DM setup: Steward running, MCP server configured in Claude Code.

### Examples

**Create content from descriptions:**

> "Create an NPC named Garrick the Blacksmith. He's gruff but fair, runs the forge in Millhaven. STR 16, DEX 10, CON 14, INT 12, WIS 13, CHA 8."

> "Create a status effect called Frostbite that reduces dexterity by 3 and lasts 4 hours."

> "Add a new location called Dragon's Lair at the northeast corner of the map with a 2x encounter modifier."

> "Create an encounter called Goblin Ambush that only triggers on the Thornwood Trail at night. Add 3 goblins and a drop chance for a Rusty Shortsword."

**Set up automation:**

> "Create a rule that consumes one Torch from each PC every 4 hours when it's Night, and notifies if they run out."

> "Show me all rules that trigger on time advance. Disable the weather notification one."

**Manage existing content:**

> "What items does Kael have?"

> "Move the party to Stonekeep and advance time by 2 hours."

> "Export the full campaign as a backup."

### Toolbox

The MCP server organizes tools into groups. Session play tools (time, travel, characters, encounters, combat) are always available. World-building and rules tools load on demand when you ask for them:

> "Create a new location..." → The AI opens the world_building toolbox automatically

If your MCP client doesn't support dynamic tool loading (you'll know because tools fail after opening the toolbox), set `STEWARD_TOOLBOX=off` in your MCP server configuration. See the [MCP Server Guide](../MCP-server-usage.md) for details.

---

## Combining approaches

These approaches work well together:

1. **Bootstrap with static generation** — Use the Full Campaign prompt to generate a starting campaign with characters, locations, and encounters
2. **Refine with the world-building assistant** — Tweak attributes, add missing NPCs, adjust encounter conditions, and set up rules conversationally
3. **Play with the AI DM** — Run live sessions with the DM prompt, and the AI keeps the world state updated as you play

Or use just one approach. Generate a campaign from a prompt and play it entirely through the web UI. Or skip generation entirely and build everything through the MCP world-building tools. Steward doesn't require any LLM integration to function — it just makes it more convenient.
