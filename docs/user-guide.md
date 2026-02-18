---
title: User Guide
layout: default
nav_order: 3
---

# User Guide

This guide covers every feature in Steward from the DM's perspective.

---

## Campaigns

Steward supports multiple independent campaigns. Each campaign has its own characters, effects, items, encounters, locations, rules, environment state, and session log.

**Switching campaigns** — Use the campaign selector at the top of the sidebar. The current campaign name is always visible.

**Creating a campaign** — Click **+ New Campaign** and enter a name. New campaigns start with default settings (Gregorian calendar, standard weather options, rules engine enabled, random encounters disabled).

**Deleting a campaign** — Delete from the campaign list. This permanently removes the campaign and all its data. Campaign export is recommended before deletion.

---

## Characters

### Character List

The **Characters** page shows all characters in a card grid. Each card displays:

- Portrait (or initial avatar)
- Name and type badge (PC / NPC)
- Description preview
- First four attribute values

**Filter** by type (All / PC / NPC) using the dropdown. **Search** by name using the search box. **Show Archived** reveals archived NPCs (hidden by default), which appear dimmed with an "Archived" tag.

### Creating a Character

Click **+ New Character** to open the form:

- **Name** — required
- **Type** — PC or NPC
- **Description** — optional flavor text
- **Portrait URL** — link to an image (displayed as a circle)
- **Base Attributes** — numeric attributes default to 10; tag attributes use a dropdown of predefined options

### Character Detail Page

Click any character card to open the detail page. This shows:

**Attributes Table** — for numeric attributes, three columns:

| Column | Description |
|--------|-------------|
| Base | The raw value you set |
| Modifiers | Sum of all modifiers from effects and items, with source breakdown on hover |
| Effective | Base + Modifiers (green if positive net modifier, red if negative) |

Tag attributes display below the numeric table as label/value pairs.

**Applied Effects** — all status effects currently active on the character. Each entry shows the effect name, modifier summary, tags, and remaining duration. Click the remove button to strip an effect. Click **Add Effect** to open a searchable picker of all effect definitions.

**Inventory** — all items the character carries. Shows item name, type, modifiers, and quantity. For stackable items, use the +/- buttons to adjust quantity. Click **Add Item** to open the item picker.

**Archiving NPCs** — click **Archive** on an NPC's detail page (or check the Archived box in the edit modal) to hide it from the main character list. Archived NPCs remain available in encounter NPC pickers. Use **Unarchive** to restore visibility.

### Computed Stats

Effective stats are computed as: `base_attribute + sum(effect_modifiers) + sum(item_modifiers)`.

The detail page shows the full modifier breakdown — every effect and item contributing to each attribute. Hover over the modifier column to see individual sources.

### Import & Export

Use the **Export** button on the Characters page to download all characters as JSON. Use **Import** to load characters from a JSON file, with conflict preview and merge options.

---

## Status Effects

Status effects are reusable definitions that can be applied to any character.

### Defining an Effect

Each effect definition has:

- **Name** — must be unique within the campaign (rules reference effects by name)
- **Description** — flavor text
- **Tags** — categorization labels (e.g., "buff", "debuff", "magical", "physical")
- **Modifiers** — a list of attribute/delta pairs (e.g., strength +3, wisdom -2)
- **Duration Type**:
  - **Indefinite** — stays until manually removed
  - **Timed** — lasts a number of hours (tracked as remaining hours, decremented on time advance)
  - **Rounds** — lasts a number of combat rounds (tracked as remaining rounds)
- **Duration Value** — the number of hours or rounds (ignored for indefinite)

### Applying and Removing

From a character's detail page, click **Add Effect** to apply an effect. The character immediately gains all attribute modifiers from that effect, visible in the computed stats breakdown.

Click the remove button next to an applied effect to strip it. The modifiers are removed and effective stats recalculate.

Effects can also be applied and removed by [rules engine actions](rules-engine.md).

---

## Items

Items are reusable definitions that can be assigned to characters.

### Defining an Item

Each item definition has:

- **Name** — must be unique (rules reference items by name)
- **Description** — flavor text
- **Item Type** — categorization (weapon, armor, accessory, consumable, misc, or custom)
- **Properties** — freeform key-value pairs (e.g., weight, rarity, cursed)
- **Stackable** — whether multiple copies combine into a single inventory entry with quantity tracking
- **Modifiers** — attribute/delta pairs, same as effects (e.g., dexterity +3 for a magic cloak)

### Inventory Management

From a character's detail page:

- **Add Item** — opens a picker to assign an item definition. If the item is stackable and already in inventory, the quantity increases.
- **Quantity** — for stackable items, use +/- buttons or type a number. Setting quantity to 0 removes the item.
- **Remove** — removes the item entry entirely.

Item modifiers affect the character's effective stats just like effect modifiers, and appear in the modifier breakdown.

---

## Encounters

Encounters are pre-planned scenarios that can be started during play or triggered randomly during travel.

### Defining an Encounter

Each encounter definition has:

- **Name** and **Description**
- **Notes** — extended text for DM reference during play
- **NPCs** — a roster of characters with assigned roles (leader, member, hostile, neutral). NPCs can reference existing characters or be defined ad-hoc by name. Each entry has a **count** for spawning multiples (e.g., 3 goblins).
- **Starts Combat** — when enabled, starting the encounter automatically spawns NPCs, rolls d20 initiative for all PCs and NPCs, and creates combat state. Ending the encounter cleans up spawned NPCs and ends combat.
- **Loot Table** — items with quantities and drop chances (0-100%)
- **Environment Overrides** — key-value pairs applied when the encounter starts (e.g., weather → "Fog", time_suggestion → "Dusk")
- **Random Encounter Conditions** — controls when this encounter can be randomly selected:
  - **Location IDs** — which locations this encounter can occur at
  - **Edge IDs** — which paths (edges) this encounter can trigger on during travel
  - **Time of Day** — which time periods (Morning, Night, etc.)
  - **Weather** — which weather conditions
  - **Weight** — relative probability compared to other eligible encounters

### Starting an Encounter

Click **Start** on an encounter card. This:

1. Applies environment overrides (e.g., changes weather)
2. Fires `on_encounter` rules with phase "start"
3. Logs the encounter start to the session log
4. If **Starts Combat** is enabled: spawns NPCs (cloning templates when count > 1, creating ad-hoc NPCs by name), rolls d20 initiative for all PCs and encounter NPCs, and navigates to the combat view

Click **End** to conclude the encounter. This fires rules with phase "end", cleans up any encounter-spawned NPCs, and ends active combat if running. Spawned NPCs are automatically filtered from the default character list to prevent clutter.

### Random Encounter Triggers

When random encounters are enabled (see [Settings](#random-encounter-settings)), they can trigger during time advancement and travel. The system:

1. Rolls against the base encounter rate, modified by location and edge encounter modifiers
2. Filters eligible encounters by location, time of day, and weather conditions
3. Selects one based on relative weights
4. Presents the encounter to the DM for approval before applying

---

## Locations & Travel

The **Locations** page provides an interactive map for building your game world's geography.

### The Map Canvas

The map uses a node-and-edge graph:

- **Locations** are nodes positioned on the canvas
- **Paths** are edges connecting locations

**Creating locations** — double-click an empty area of the canvas. Enter a name in the prompt. The location appears as a draggable node.

**Creating paths** — drag from one location node to another. This creates an edge (bidirectional by default).

**Selecting** — click a location or path to select it and open the detail panel on the right.

### Location Properties

Select a location to edit:

- **Name** and **Description**
- **Parent Location** — optional hierarchy (e.g., a room inside a dungeon)
- **Encounter Modifier** — multiplier on the base encounter rate (1.0 = normal, 0.2 = rare, 1.5 = frequent, 0 = no encounters)
- **Weather Override** — override global weather at this location:
  - **None** — use global weather
  - **Fixed** — always a specific weather type
  - **Weighted** — probability distribution across weather types
- **Properties** — key-value pairs from the property registry (e.g., terrain = "forest", danger = "high"). Properties can be checked by rule conditions.
- **Set Party Here** — moves the party to this location immediately

### Path (Edge) Properties

Select a path to edit:

- **Label** — display name (e.g., "Forest Road")
- **Description** — flavor text
- **Travel Hours** — how long it takes to traverse this path
- **Bidirectional** — whether the path works in both directions
- **Encounter Modifier** — multiplier applied during travel on this path
- **Weather Override** — same as locations (none, fixed, or weighted)
- **Properties** — key-value pairs

### Travel

Once the party is positioned at a location:

**Route planning** — Ctrl+click locations to add them as waypoints. The route panel shows each leg with the path label and travel time. Click **Travel** to execute the route.

**Travel execution** — for each leg of the route:

1. Time advances by the path's travel hours
2. Weather may transition based on volatility settings
3. Random encounters may trigger (based on rates, location/edge modifiers, and conditions)
4. If an encounter triggers, travel pauses and presents the encounter
5. `on_location_change` rules fire when the party arrives

**Route management** — click the X on any leg to remove it and all subsequent legs. Click **Clear** to reset the route entirely.

### Map Interaction Summary

| Action | Result |
|--------|--------|
| Double-click canvas | Create new location |
| Drag between nodes | Create connecting path |
| Click node/edge | Select and open detail panel |
| Drag node | Reposition location |
| Ctrl+click location | Add waypoint to travel route |
| Scroll wheel | Zoom in/out |

---

## Environment & Time

The environment bar at the top of the page shows the current game state: time, date, weather, time of day, and current location.

### Time Advancement

Use the environment bar controls to advance time:

- **Quick buttons** — customizable presets (defaults: +10m, +30m, +1h, +4h). See [Time Advance Presets](#time-advance-presets) in Settings.
- **Custom** — enter hours and minutes

When time advances:

1. The clock and calendar update (wrapping hours → days → months → years)
2. Weather may transition based on volatility
3. Timed effects tick down (effects reaching 0 remaining hours are not auto-removed — use rules for that)
4. Random encounter rolls occur
5. `on_time_advance` rules fire
6. `on_schedule` rules fire if time passes through their scheduled moment
7. `on_threshold` rules check for attribute boundary crossings

### Weather

Weather is displayed in the environment bar and can be changed manually or by rules.

**Weather volatility** (configured in Settings) controls the chance of weather changing on each time advance. At 0%, weather never auto-transitions. At 100%, it transitions every time.

**Weather transition table** (optional, in Settings) defines the probability of transitioning from one weather type to another. If no table is set, transitions pick randomly from the weather options list with built-in heuristics.

Weather overrides at locations and edges replace the global weather while the party is there.

### Calendar

The calendar is fully customizable in Settings:

- **Months** — any number of months with custom names and day counts
- **Weekdays** — custom weekday names

The environment bar shows the current date as "Day X, MonthName, Year Y" and the weekday name.

### Resting

The environment bar has **Short Rest** and **Long Rest** buttons:

| Rest Type | Duration | What Happens |
|-----------|----------|--------------|
| Short Rest | 1 hour | Fires `on_rest` rules, advances time (triggering all time-based systems), records rest time for each character |
| Long Rest | 8 hours | Same as short rest but 8 hours of time advancement |

Rest time is tracked per character. The `hours_since_last_rest` condition in rules checks against this recorded time.

---

## Random Encounter Settings

Configure in **Settings** under the Random Encounters card:

- **Enabled** — master toggle for random encounters
- **Base Rate** — probability per hour of travel/advancement (0-100%)
- **Minimum Interval** — minimum hours between encounters (prevents back-to-back triggers)

The effective encounter rate is: `base_rate × location_modifier × edge_modifier`. A cumulative probability over 8 hours is shown for reference.

When a random encounter triggers, eligible encounters are filtered by their conditions (location, time of day, weather) and one is selected based on relative weight.

---

## Session Log

The session log automatically records all DM actions:

- Time advances with old → new time
- Weather changes
- Effects applied/removed
- Items assigned/removed
- Encounters started/ended
- Rest taken
- Travel and location changes
- Rule firings and notifications

**Manual entries** — click the add button to write custom log entries (session notes, narrative beats, rulings).

**Filtering** — filter by entry type to see only specific kinds of entries.

**Export** — export the session log for session recaps or record-keeping.

**Clear** — clear all log entries (with confirmation).

---

## Import & Export

### Full Campaign Export

From the sidebar, use **Export Campaign** to download the entire campaign as a JSON file. This includes all entities, relationships, environment state, rules, notifications, and session log.

### Full Campaign Import

Use **Import Campaign** to create a new campaign from a JSON file. The imported campaign is created as a new entry with "(Imported)" appended to the name. No existing data is modified.

### Partial / Merge Import

For importing specific entity types into an existing campaign:

1. Open import and select the entity types to import (characters, effects, items, encounters, rules)
2. **Preview** shows conflicts — entities that already exist with the same name
3. For each conflict, choose:
   - **Skip** — keep the existing entity, ignore the import
   - **Overwrite** — replace the existing entity with the imported version
   - **Duplicate** — import as a new entity alongside the existing one
4. Click **Merge** to execute

### Per-Entity Export/Import

Individual pages (Characters, Rules, Encounters, etc.) have their own export/import buttons for moving specific entity types between campaigns.

### Import Validation

On import, Steward checks for prerequisite references. If imported rules reference effects or items that don't exist in the target campaign, a warning is shown listing the missing prerequisites.

---

## Settings

The **Settings** page (Environment Settings) configures campaign-wide options.

### Attribute Definitions

Define the attributes used by characters in this campaign:

- **Numeric attributes** — stats with numeric values and modifiers (e.g., strength, dexterity). These support computed effective values from effects and items.
- **Tag attributes** — string-valued traits with predefined options (e.g., faction, species, class). These support `trait_equals` and `trait_in` conditions in the rules engine.

Each attribute has a key (internal identifier) and label (display name). Tag attributes also have an options list.

Rule reference badges show how many rules reference each attribute, linking to the rules that would break if the attribute were removed.

### Time-of-Day Thresholds

Define the time periods for your game world. Each threshold has a label and a start hour:

| Label | Start Hour |
|-------|-----------|
| Night | 0 |
| Dawn | 5 |
| Morning | 7 |
| Afternoon | 12 |
| Dusk | 17 |
| Evening | 19 |
| Night | 21 |

These labels are used by the `time_of_day_is` condition and displayed in the environment bar.

### Calendar Configuration

- **Weekday names** — comma-separated list
- **Months** — name and day count for each month

### Weather Options

The list of weather types available in your campaign. These appear in weather selectors throughout the app (environment bar, location overrides, rule conditions and actions).

### Weather Volatility & Transition Table

- **Volatility** — slider from 0% to 100% controlling how often weather changes on time advance
- **Transition Table** — optional matrix defining the probability of transitioning from each weather type to every other type. Each row must sum to 1.0. Click **Auto-Generate** to create a starting table based on weather type names.

### Season Options

Define the seasons for your campaign (default: Spring, Summer, Autumn, Winter). Seasons are quarter-based: months 3-5 = first season, 6-8 = second, 9-11 = third, 12 + 1-2 = fourth. Used by the `season_is` rule condition.

### Random Encounter Settings

See [Random Encounter Settings](#random-encounter-settings) above.

### Rules Engine Settings

- **Engine Enabled** — master toggle for all rule evaluation
- **Cascade Depth Limit** — how deep rule chains can cascade before forced into suggest mode (default: 3)

See the [Rules Engine Guide](rules-engine.md) for details.

### Property Key Registry

Define the property keys available for locations and edges. Each key has a name and optional list of allowed values. Properties defined here appear in location/edge property editors as dropdowns. New properties used in locations are auto-registered.

### Tag Presets

Bundle a tag attribute definition with associated rules into a reusable preset. Steward includes built-in presets for common fantasy archetypes (Race, Class, Creature Type, Alignment), and you can create custom presets from your campaign's existing attributes and rules. Custom presets can be exported as JSON files and shared between campaigns.

Click **Presets** in the Attribute Definitions section to open the preset browser. See the [Tag Presets](rules-engine.md#tag-presets) section of the Rules Engine Guide for full details.

---

### Time Advance Presets

Customize the quick-advance buttons in two independent places:

- **Banner presets** — configured in Settings. These drive the environment bar's quick buttons (defaults: +10m, +30m, +1h, +4h). Each preset has a label, hours, and minutes.
- **Dashboard presets** — editable inline on the Dashboard's Quick Advance card. Click the gear icon to enter edit mode, where you can add, remove, rename, and drag-to-reorder presets. The dashboard card also includes Short Rest and Long Rest buttons.

Both preset sets are stored per-campaign.

---

## Session Prep

Session prep sheets help you plan sessions using the [Lazy DM prep method](https://slyflourish.com/eight_steps_2023.html). Each prep has a structured format:

- **Strong Start** — the opening scene to kick off the session with momentum (supports [[wikilinks]])
- **Scenes** — potential scenes that might occur, each optionally linked to one or more map locations. Check them off as they play out.
- **Secrets & Clues** — information the players might discover, each optionally linked to locations. Mark them as revealed during play. Unrevealed secrets can be carried forward to the next session's prep.
- **Notes** — freeform DM notes (supports [[wikilinks]])

### Workflow

1. **Create** a new session prep from the Session Prep page
2. **Edit** — fill in your strong start, add scenes and secrets, link them to locations
3. **Activate** — set the prep as active when the session begins. Any previously active prep is automatically completed.
4. **During play** — check off scenes as they happen, reveal secrets as players discover them
5. **Complete** — mark the prep as done. When creating the next prep, use **Carry Forward** to copy unrevealed secrets.

### Location Linking

Scenes and secrets can be linked to map locations. When the party arrives at a linked location during travel, a notification reminds you of the relevant scenes and secrets. This integrates session prep with the travel system.

### Dashboard Integration

The active session prep appears on the Dashboard, showing the strong start and notes with rendered markdown and clickable wikilinks.

---

## Notifications & Undo

The **bell icon** in the environment bar shows unread notification count. Click to open the notification drawer.

### Notification Types

| Type | Source | Available Actions |
|------|--------|-------------------|
| Auto-applied | An auto-apply rule fired and made changes | **Undo** — reverses all changes from that firing |
| Suggestion | A suggest-mode rule fired | **Apply** — execute the suggested actions. **Dismiss** — discard |

### What Can Be Undone

- `apply_effect` — the effect is removed
- `remove_effect` — the effect is re-applied with original remaining duration
- `modify_attribute` — the delta is reversed
- `set_weather` — weather reverts to previous value
- `set_environment_note` — note reverts to previous text
- `consume_item` / `grant_item` — quantity change is reversed

Actions like `notify`, `log`, `roll_dice`, and `advance_time` cannot be undone.

### Drawer Features

- **Filter** by severity (All, Info, Warning, Error)
- **Pin** the drawer to keep it open while working
- **Clear** all notifications
