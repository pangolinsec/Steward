---
title: LLM Content Generation
layout: default
nav_order: 6
---

# Generating Content with LLMs

You can use any large language model (ChatGPT, Claude, Gemini, etc.) to generate characters, items, encounters, locations, rules, and more — then import the output directly into Almanac. This page provides ready-to-use prompts with the exact JSON format Almanac expects.

## How It Works

1. Copy one of the prompts below
2. Fill in the placeholder sections (marked with `[brackets]`) to describe your world
3. Paste it into your LLM of choice
4. Copy the JSON output
5. In Almanac, go to the relevant page (Characters, Items, Rules, etc.) and click **Import**
6. Paste or upload the JSON

You can also generate a **full campaign** JSON and import it via **Import Campaign** to create a complete campaign in one step.

---

## Prompt: Full Campaign

Generates a complete importable campaign with settings, characters, effects, items, encounters, locations, and rules.

````
Generate a complete campaign for the Almanac tabletop RPG tool. Output valid JSON matching the schema below.

**Setting:** [Describe your world. Examples: "A classic high-fantasy game set in a realm of warring kingdoms, ancient magic, and dragon lords" / "A gritty cyberpunk sci-fi world set on the mining colony of Yelez V" / "A gothic horror campaign in Victorian-era London with supernatural threats"]

**Tone:** [Describe the tone. Examples: "Epic and heroic" / "Dark and survival-focused" / "Lighthearted and comedic"]

**Number of PCs:** [e.g. 4]
**Number of NPCs:** [e.g. 6]
**Number of locations:** [e.g. 8]
**Number of encounters:** [e.g. 5]

Generate content that fits the setting. Invent creative names, descriptions, and mechanics that feel authentic to the world described.

### JSON Schema

```json
{
  "version": 1,
  "campaign": {
    "name": "Campaign Name",
    "attribute_definitions": [
      { "key": "strength", "label": "Strength" },
      { "key": "faction", "label": "Faction", "type": "tag", "options": ["Option A", "Option B"] }
    ],
    "time_of_day_thresholds": [
      { "label": "Night", "start": 0 },
      { "label": "Dawn", "start": 5 },
      { "label": "Morning", "start": 7 },
      { "label": "Afternoon", "start": 12 },
      { "label": "Dusk", "start": 17 },
      { "label": "Evening", "start": 19 },
      { "label": "Night", "start": 21 }
    ],
    "calendar_config": {
      "months": [{ "name": "MonthName", "days": 30 }],
      "weekdays": ["Day1", "Day2", "Day3", "Day4", "Day5"]
    },
    "weather_options": ["Clear", "Overcast", "Rain", "Storm"],
    "encounter_settings": { "enabled": true, "base_rate": 0.15, "min_interval_hours": 2 },
    "weather_volatility": 0.3
  },
  "status_effects": [
    {
      "name": "Effect Name",
      "description": "What it does narratively",
      "tags": ["buff", "magical"],
      "modifiers": [{ "attribute": "strength", "delta": 2 }],
      "duration_type": "timed | indefinite | rounds",
      "duration_value": 4
    }
  ],
  "items": [
    {
      "name": "Item Name",
      "description": "Item description",
      "item_type": "weapon | armor | accessory | consumable | misc",
      "properties": { "weight": 3, "rarity": "rare" },
      "stackable": false,
      "modifiers": [{ "attribute": "dexterity", "delta": 1 }]
    }
  ],
  "characters": [
    {
      "name": "Character Name",
      "type": "PC | NPC",
      "description": "Character description",
      "portrait_url": "",
      "base_attributes": { "strength": 14, "dexterity": 12 }
    }
  ],
  "locations": [
    {
      "name": "Location Name",
      "description": "Location description",
      "encounter_modifier": 1.0,
      "properties": { "terrain": "forest", "danger": "high" },
      "position_x": 100,
      "position_y": 200,
      "weather_override": null
    }
  ],
  "edges": [
    {
      "from_location_id": 1,
      "to_location_id": 2,
      "label": "Path Name",
      "description": "Path description",
      "travel_hours": 4.0,
      "bidirectional": 1,
      "encounter_modifier": 1.2,
      "properties": {}
    }
  ],
  "encounters": [
    {
      "name": "Encounter Name",
      "description": "Short description",
      "notes": "Detailed DM notes for running this encounter",
      "npcs": [],
      "environment_overrides": { "weather": "Fog" },
      "loot_table": [
        { "item_name": "Item Name", "quantity": 1, "drop_chance": 0.5 }
      ],
      "conditions": {
        "time_of_day": ["Night", "Dusk"],
        "weather": [],
        "weight": 1.0
      }
    }
  ],
  "rules": [
    {
      "name": "Rule Name",
      "description": "What this rule does",
      "enabled": true,
      "trigger_type": "on_time_advance | on_effect_change | on_item_change | on_threshold | on_location_change | on_rest | on_schedule | on_encounter",
      "trigger_config": {},
      "conditions": {
        "all": [
          { "type": "condition_type", "param": "value" }
        ]
      },
      "actions": [
        { "type": "action_type", "param": "value" }
      ],
      "action_mode": "auto | suggest",
      "priority": 100,
      "tags": ["survival"],
      "target_mode": "environment | all_pcs | all_npcs | all_characters",
      "target_config": {}
    }
  ],
  "environment": {
    "current_hour": 14,
    "current_minute": 0,
    "current_day": 1,
    "current_month": 1,
    "current_year": 1,
    "weather": "Clear",
    "environment_notes": ""
  }
}
```

### Rules for generating content

**Attributes:**
- Numeric attributes have `key` and `label` only. Use 4-8 core stats appropriate to the setting.
- Tag attributes add `"type": "tag"` and an `"options"` array. Use for traits like faction, species, class.
- All character `base_attributes` must use only keys from `attribute_definitions`.

**Status effects:**
- `modifiers` reference attributes by key. `delta` can be positive (buff) or negative (debuff).
- `duration_type`: `"indefinite"` (until removed), `"timed"` (hours), or `"rounds"` (combat rounds).
- Generate 5-8 effects with a mix of buffs, debuffs, and neutral effects.

**Items:**
- `modifiers` work like effect modifiers. Equipment has modifiers; consumables usually don't.
- `stackable`: true for consumables/supplies, false for unique equipment.
- Generate 6-10 items including weapons, armor, consumables, and misc.

**Characters:**
- Give each character attribute values between 3 and 20 for numeric attributes.
- Write 1-2 sentence descriptions that convey personality and role.
- Tag attribute values must be from the defined options.

**Locations:**
- `encounter_modifier`: 0.0-0.5 for safe areas, 1.0 for normal, 1.5-2.0 for dangerous areas.
- `position_x`/`position_y`: spread locations out (0-800 range) for a readable map.
- `properties`: include terrain type and any relevant tags.
- `weather_override`: usually null. Use `{"mode": "fixed", "value": "Snow"}` or `{"mode": "weighted", "value": {"Fog": 0.4, "Rain": 0.3, "Clear": 0.3}}` for special locations.

**Edges (paths between locations):**
- `from_location_id` and `to_location_id` are 1-indexed, referring to the order in the `locations` array.
- Connect locations into a logical geography. Not every location needs to connect to every other.
- `travel_hours`: 1-2 for short paths, 4-8 for long journeys.

**Encounters:**
- `loot_table` items reference item names that exist in the `items` array.
- `drop_chance`: 0.0 to 1.0 (probability).
- `conditions.time_of_day` values must match labels in `time_of_day_thresholds`.
- `conditions.weight`: relative probability (1.0 = normal, 2.0 = twice as likely).

**Rules:**
- Generate 3-5 automation rules appropriate to the setting.
- Actions reference effect/item names that exist in the `status_effects`/`items` arrays.
- Prefer `"action_mode": "suggest"` for judgment calls, `"auto"` for bookkeeping.
- Template variables: `{character.name}`, `{character.<attr>}`, `{environment.weather}`.

**Condition types:** `attribute_gte`, `attribute_lte`, `has_effect`, `lacks_effect`, `has_item`, `lacks_item`, `item_quantity_lte`, `weather_is`, `weather_in`, `time_of_day_is`, `time_between`, `location_property`, `season_is`, `random_chance`, `hours_since_last_rest`, `trait_equals`, `trait_in`, `character_type`.

**Action types:** `apply_effect`, `remove_effect`, `modify_attribute`, `consume_item`, `grant_item`, `set_weather`, `notify`, `log`, `roll_dice`, `random_from_list`.

Output ONLY the JSON object. No commentary.
````

---

## Prompt: Characters Only

````
Generate characters for a tabletop RPG campaign in the Almanac tool format.

**Setting:** [Describe your world]
**Number of PCs:** [e.g. 4]
**Number of NPCs:** [e.g. 6]

**Attribute keys for this campaign:** [List your campaign's attribute keys, e.g. "strength, dexterity, constitution, intelligence, wisdom, charisma" or "brawn, reflexes, wits, presence, tech, grit"]

**Tag attributes (if any):** [e.g. "faction (options: Rebels, Empire, Guild), species (options: Human, Elf, Dwarf)"]

Output a JSON object matching this schema:

```json
{
  "characters": [
    {
      "name": "Character Name",
      "type": "PC or NPC",
      "description": "1-2 sentence description with personality and role",
      "portrait_url": "",
      "base_attributes": { "strength": 14, "dexterity": 12 }
    }
  ]
}
```

Rules:
- Use only the attribute keys listed above. Values should be 3-20 for numeric attributes.
- Tag attribute values must be from the options listed above.
- PCs should feel like player-controlled heroes. NPCs should include allies, villains, and neutral figures.
- Write vivid descriptions that convey personality in 1-2 sentences.
- Output ONLY the JSON object.
````

---

## Prompt: Status Effects

````
Generate status effects for a tabletop RPG campaign in the Almanac tool format.

**Setting:** [Describe your world]
**Number of effects:** [e.g. 8]
**Attribute keys:** [List your campaign's attribute keys, e.g. "strength, dexterity, constitution, intelligence, wisdom, charisma"]

Output a JSON object matching this schema:

```json
{
  "status_effects": [
    {
      "name": "Effect Name",
      "description": "Narrative description of what happens",
      "tags": ["buff", "magical"],
      "modifiers": [
        { "attribute": "strength", "delta": 2 }
      ],
      "duration_type": "timed",
      "duration_value": 4
    }
  ]
}
```

Rules:
- `attribute` must be one of the listed attribute keys. `delta` is positive for buffs, negative for debuffs.
- `duration_type`: `"indefinite"` (persists until removed), `"timed"` (lasts N hours), `"rounds"` (lasts N combat rounds).
- `duration_value`: the number of hours or rounds (use 0 for indefinite).
- `tags`: categorize with labels like `buff`, `debuff`, `magical`, `physical`, `poison`, `mental`, `divine`, `environmental`.
- Include a mix: some pure buffs, some pure debuffs, some with tradeoffs (buff one stat, debuff another).
- Names and descriptions should fit the setting.
- Output ONLY the JSON object.
````

---

## Prompt: Items

````
Generate items for a tabletop RPG campaign in the Almanac tool format.

**Setting:** [Describe your world]
**Number of items:** [e.g. 10]
**Attribute keys:** [List your campaign's attribute keys]

Output a JSON object matching this schema:

```json
{
  "items": [
    {
      "name": "Item Name",
      "description": "Item description",
      "item_type": "weapon",
      "properties": { "weight": 4, "rarity": "rare" },
      "stackable": false,
      "modifiers": [
        { "attribute": "strength", "delta": 2 }
      ]
    }
  ]
}
```

Rules:
- `item_type`: use `"weapon"`, `"armor"`, `"accessory"`, `"consumable"`, or `"misc"`.
- `modifiers`: attribute/delta pairs for passive stat changes when equipped. Consumables and misc items typically have empty modifiers `[]`.
- `stackable`: `true` for consumables and supplies (potions, rations, ammo), `false` for unique equipment.
- `properties`: freeform key-value metadata. Common keys: `weight`, `rarity`, `damage`, `cursed`, `value`.
- Include a variety: weapons, armor, consumables, a cursed item, something mundane but useful.
- Output ONLY the JSON object.
````

---

## Prompt: Encounters

````
Generate encounters for a tabletop RPG campaign in the Almanac tool format.

**Setting:** [Describe your world]
**Number of encounters:** [e.g. 6]
**Available weather types:** [e.g. "Clear, Overcast, Rain, Heavy Rain, Snow, Fog, Storm"]
**Available time-of-day labels:** [e.g. "Night, Dawn, Morning, Afternoon, Dusk, Evening"]
**Item names in the campaign (for loot):** [e.g. "Healing Potion, Gold Coins, Iron Sword, Ancient Scroll"]

Output a JSON object matching this schema:

```json
{
  "encounters": [
    {
      "name": "Encounter Name",
      "description": "Brief encounter summary",
      "notes": "Detailed DM notes: tactics, terrain, enemy behavior, narrative hooks",
      "npcs": [],
      "environment_overrides": {},
      "loot_table": [
        { "item_name": "Healing Potion", "quantity": 2, "drop_chance": 0.5 }
      ],
      "conditions": {
        "time_of_day": ["Night", "Dusk"],
        "weather": [],
        "weight": 1.0
      }
    }
  ]
}
```

Rules:
- `notes` should be meaty — 3-5 sentences of tactical info, terrain description, and narrative hooks for the DM.
- `environment_overrides`: optional changes applied when the encounter starts (e.g., `{"weather": "Fog"}`). Leave as `{}` for most encounters.
- `loot_table`: items that can drop. `item_name` must match item names listed above. `drop_chance` is 0.0-1.0.
- `conditions.time_of_day`: when this encounter can randomly trigger. Use labels from the list above. Empty array `[]` means any time.
- `conditions.weather`: which weather allows this encounter. Empty `[]` means any weather.
- `conditions.weight`: relative probability vs other encounters (1.0 = normal, 2.0 = twice as likely, 0.5 = half as likely).
- Leave `npcs` as `[]` (NPC assignment happens inside the app after characters exist).
- Include a variety: combat encounters, social encounters, environmental hazards, mystery/exploration.
- Output ONLY the JSON object.
````

---

## Prompt: Locations and Map

````
Generate locations and connecting paths for a tabletop RPG campaign in the Almanac tool format.

**Setting:** [Describe your world]
**Number of locations:** [e.g. 8]
**Available weather types:** [e.g. "Clear, Overcast, Rain, Heavy Rain, Snow, Fog, Storm"]

Output a JSON object matching this schema:

```json
{
  "locations": [
    {
      "name": "Location Name",
      "description": "2-3 sentence description of the place",
      "encounter_modifier": 1.0,
      "properties": { "terrain": "forest", "population": "small" },
      "position_x": 100,
      "position_y": 200,
      "weather_override": null
    }
  ],
  "edges": [
    {
      "from_location_id": 1,
      "to_location_id": 2,
      "label": "Path Name",
      "description": "Description of the journey",
      "travel_hours": 4.0,
      "bidirectional": 1,
      "encounter_modifier": 1.2,
      "properties": {}
    }
  ]
}
```

Rules:
- `encounter_modifier`: multiplier on random encounter chance. 0.0-0.3 for towns/safe areas, 1.0 for wilderness, 1.5-2.0 for dangerous zones.
- `properties`: freeform tags. Use `terrain` (urban, forest, mountain, swamp, desert, etc.) and other setting-appropriate keys.
- `position_x`/`position_y`: layout coordinates (0-800 range). Arrange them so the map looks geographic — towns clustered, wilderness spread out, with logical spatial relationships.
- `weather_override`: null for most locations. For special areas, use `{"mode": "fixed", "value": "Snow"}` or `{"mode": "weighted", "value": {"Fog": 0.4, "Rain": 0.3, "Clear": 0.3}}`.
- **Edges:** `from_location_id`/`to_location_id` are 1-indexed positions in the `locations` array (first location = 1, second = 2, etc.).
- `bidirectional`: 1 for two-way paths (most), 0 for one-way (e.g., a waterfall descent).
- Connect locations into a realistic geography. Include some hubs with multiple connections and some remote locations with only one path in.
- Include a safe starting location (town/city) and at least one dangerous frontier area.
- Output ONLY the JSON object.
````

---

## Prompt: Rules

````
Generate automation rules for a tabletop RPG campaign in the Almanac tool format.

**Setting:** [Describe your world]
**Number of rules:** [e.g. 6]
**Attribute keys:** [List your campaign's attribute keys]
**Status effect names in this campaign:** [e.g. "Poisoned, Exhausted, Blessed, Enraged, Frozen"]
**Item names in this campaign:** [e.g. "Torch, Rations, Healing Potion, Antidote"]
**Weather types:** [e.g. "Clear, Overcast, Rain, Storm, Snow, Fog"]
**Time-of-day labels:** [e.g. "Night, Dawn, Morning, Afternoon, Dusk, Evening"]

Output a JSON object matching this schema:

```json
{
  "rules": [
    {
      "name": "Rule Name",
      "description": "What this rule does and why",
      "enabled": true,
      "trigger_type": "on_time_advance",
      "trigger_config": {},
      "conditions": {
        "all": [
          { "type": "has_item", "item_name": "Torch" },
          { "type": "time_of_day_is", "value": "Night" }
        ]
      },
      "actions": [
        { "type": "consume_item", "item_name": "Torch", "quantity": 1 },
        { "type": "notify", "message": "{character.name}'s torch burns lower.", "severity": "info" }
      ],
      "action_mode": "auto",
      "priority": 100,
      "tags": ["survival"],
      "target_mode": "all_pcs",
      "target_config": {}
    }
  ]
}
```

### Trigger types
- `on_time_advance` — fires when time advances
- `on_effect_change` — fires when an effect is applied or removed
- `on_item_change` — fires when an item is assigned or removed
- `on_threshold` — fires when an attribute crosses a boundary. Config: `{"attribute": "hp", "threshold": 5, "direction": "falling"}`
- `on_location_change` — fires when the party arrives at a new location
- `on_rest` — fires when a rest is taken
- `on_schedule` — fires at a specific calendar moment. Config: `{"datetime": {"month": 6, "day": 21, "hour": 12, "minute": 0}}`
- `on_encounter` — fires when an encounter starts or ends

### Condition types
- `attribute_gte` / `attribute_lte` / `attribute_eq` — check effective attribute value. Params: `attribute`, `value`.
- `has_effect` / `lacks_effect` — check if character has/lacks a status effect. Param: `effect_name`.
- `has_item` / `lacks_item` — check if character has/lacks an item. Param: `item_name`.
- `item_quantity_lte` — item quantity <= value. Params: `item_name`, `value`.
- `character_type` — PC or NPC. Param: `value`.
- `weather_is` — exact weather match. Param: `value`.
- `weather_in` — weather is one of a list. Param: `values` (array).
- `time_of_day_is` — time label matches. Param: `value`.
- `time_between` — hour range. Params: `from_hour`, `to_hour`.
- `location_property` — current location property check. Params: `property`, `value` (optional).
- `season_is` — season matches. Param: `value`.
- `random_chance` — probability roll. Param: `probability` (0.0-1.0).
- `hours_since_last_rest` — hours since rest. Params: `operator` ("gte"/"lte"), `hours`.
- `trait_equals` — tag attribute equals value. Params: `trait`, `value`.
- `trait_in` — tag attribute in list. Params: `trait`, `values`.

### Action types
- `apply_effect` — apply status effect. Params: `effect_name`, optional `duration_hours`.
- `remove_effect` — remove effect. Param: `effect_name`.
- `modify_attribute` — change base attribute. Params: `attribute`, `delta`.
- `consume_item` — remove from inventory. Params: `item_name`, `quantity` (default 1).
- `grant_item` — add to inventory. Params: `item_name`, `quantity` (default 1).
- `set_weather` — change weather. Param: `weather`.
- `notify` — show notification. Params: `message`, `severity` ("info"/"warning"/"error").
- `log` — write to session log. Param: `message`.
- `roll_dice` — roll dice. Params: `formula` (e.g. "2d6+3"), `store_as` (variable name).
- `random_from_list` — random pick. Params: `items` (array of `{value, weight}`), `store_as`.

### Target modes
- `environment` — rule runs once, no character context.
- `all_pcs` — runs once per PC.
- `all_npcs` — runs once per NPC.
- `all_characters` — runs once per character.

### Rules for generation
- `effect_name` and `item_name` in actions/conditions MUST match names from the lists above (exact, case-sensitive).
- Use `{character.name}` in notification messages for personalization.
- Prefer `"action_mode": "suggest"` for things the DM should decide. Use `"auto"` for mechanical bookkeeping.
- Priority: 10-50 for critical alerts, 100 for standard, 150+ for informational.
- Include a mix: resource tracking, environmental effects, combat triggers, rest recovery.
- Output ONLY the JSON object.
````

---

## Prompt: Campaign Settings Only

For generating just the attribute definitions and world configuration, without any entities.

````
Generate campaign settings for a tabletop RPG in the Almanac tool format.

**Setting:** [Describe your world]
**Tone:** [e.g. "Heroic fantasy", "Grimdark survival", "Space opera", "Urban supernatural"]

I need you to design:
- 4-8 core numeric attributes appropriate to this setting
- 1-3 tag attributes (string-valued traits like faction, species, class)
- Time-of-day periods that fit the world
- A calendar (month names and day counts)
- Weather types appropriate to the setting
- Weekday names (can be real-world or fictional)

Output a JSON object matching this schema:

```json
{
  "campaign": {
    "name": "Campaign Name",
    "attribute_definitions": [
      { "key": "strength", "label": "Strength" },
      { "key": "faction", "label": "Faction", "type": "tag", "options": ["Option A", "Option B"] }
    ],
    "time_of_day_thresholds": [
      { "label": "Period Name", "start": 0 }
    ],
    "calendar_config": {
      "months": [{ "name": "Month Name", "days": 30 }],
      "weekdays": ["Day1", "Day2", "Day3"]
    },
    "weather_options": ["Clear", "Rain", "Storm"],
    "encounter_settings": { "enabled": true, "base_rate": 0.15, "min_interval_hours": 2 },
    "weather_volatility": 0.3
  }
}
```

Rules:
- Numeric attributes: just `key` (lowercase_snake_case) and `label` (display name). Choose stats that feel native to this setting — don't just copy D&D stats unless it's a D&D-style game.
- Tag attributes: add `"type": "tag"` and `"options"` array. 3-8 options per tag. Good candidates: faction, species/race, class/role, background, allegiance.
- Time-of-day: define 4-8 periods. Each has a `label` and `start` hour (0-23). First entry should start at 0.
- Calendar: invent month names that fit the world. 4-12 months with 20-35 days each.
- Weather: 5-10 types appropriate to the setting. Fantasy worlds might have "Arcane Storm"; sci-fi might have "Acid Rain" or "Solar Flare".
- `weather_volatility`: 0.1-0.2 for stable climates, 0.3-0.5 for temperate, 0.6+ for chaotic weather worlds.
- `encounter_settings.base_rate`: 0.05-0.1 for low-danger settings, 0.15-0.25 for moderate, 0.3+ for survival horror.
- Output ONLY the JSON object.
````

---

## Tips for Best Results

**Be specific about your world.** Instead of "fantasy world", say "A low-magic medieval setting where gods are silent, magic is feared, and survival through harsh winters is the primary challenge." The more detail you give, the more flavorful the output.

**Generate in stages.** Start with Campaign Settings to establish attributes, then generate Characters (which need attribute keys), then Items and Effects, then Rules (which reference effect and item names). Each prompt builds on the previous output.

**Iterate.** If the LLM generates 6 characters but you want 2 more, ask it: "Generate 2 more NPCs in the same format, fitting the same setting. Use these attribute keys: [...]"

**Mix and match.** Generate encounters from one LLM, characters from another, and items yourself. As long as the JSON format matches and names are consistent across entity types, everything imports cleanly.

**Check cross-references.** Rules reference effects and items by exact name. If a rule says `"effect_name": "Poisoned"` but your effect is named `"Poison"`, it won't work. After importing, check the Rules page for yellow warning badges indicating missing references.
