# Rules Engine Guide

The rules engine acts as a co-DM. You define rules that watch for game events (time passing, effects changing, travel, rest, etc.), check conditions against the current world state, and then either auto-apply changes or suggest them for your approval. Every auto-applied change can be undone.

---

## Quick Start

1. Open the **Rules Engine** page from the sidebar.
2. Click **Templates** to browse pre-built rules, or **+ New Rule** to create one from scratch.
3. Rules fire automatically as you play — advance time, travel, apply effects, rest, etc.
4. Watch the **bell icon** in the environment bar for notifications. Open the drawer to review, undo auto-applied changes, or approve suggestions.

---

## The Rules Page

The Rules page lists all rules for the current campaign. Each rule card shows:

- **Name** and optional description
- **Trigger type** tag (e.g., "Time Advance", "Effect Change")
- **Action mode** tag — green "Auto" or plain "Suggest"
- **Priority**, **target mode**, and any **tags**
- **Warning badges** for missing prerequisites (effects or items referenced but not defined)

### Actions on Each Rule

| Button | What it does |
|--------|-------------|
| **Enable / Disable** | Toggles whether the rule fires. Disabled rules are dimmed. |
| **Test** | Opens the test panel — dry-runs the rule against current game state without applying anything. |
| **Edit** | Opens the rule form to modify it. |
| **Delete** | Permanently removes the rule (with confirmation). |

Click a rule card to expand it and see a readable summary of its trigger config, conditions, and actions.

### Filtering

- **Search box** — filters rules by name/description.
- **Trigger dropdown** — shows only rules with a specific trigger type.

---

## Rule Anatomy

Every rule has these components:

| Component | Purpose |
|-----------|---------|
| **Trigger** | When the rule is evaluated (time advance, effect change, rest, etc.) |
| **Conditions** | Whether the rule fires (attribute checks, weather, location, etc.) |
| **Actions** | What happens when the rule fires (apply effects, modify attributes, notify, etc.) |
| **Target Mode** | Which characters the rule evaluates against |
| **Action Mode** | Auto-apply or suggest |
| **Priority** | Evaluation order (lower numbers fire first) |
| **Tags** | Organization labels |

---

## Creating a Rule

Click **+ New Rule** to open the rule form. Each field is described below.

### Name and Description

Give the rule a descriptive name (required). The description is optional but helps you remember what the rule does.

### Trigger Type

The trigger determines *when* the rule is evaluated. Choose one:

| Trigger | Fires when... | Trigger Config |
|---------|--------------|----------------|
| **Time Advance** | You advance time (quick buttons, custom advance, or travel). | None needed. |
| **Effect Change** | A status effect is applied to or removed from any character. | None needed. The engine provides `change_type` ("applied" or "removed") in context. |
| **Item Change** | An item is assigned to or removed from a character. | None needed. |
| **Threshold Crossed** | A character's effective attribute crosses a boundary. | `attribute` — which attribute to watch. `threshold` — the boundary value. `direction` — `"falling"` (went above → at/below), `"rising"` (went below → at/above), or `"either"`. |
| **Location Change** | The party arrives at a new location via travel or manual position change. | None needed. |
| **Rest** | A short or long rest is taken. | None needed. `rest_type` ("short" or "long") is available in context. |
| **Scheduled** | Time passes through a specific game calendar moment. | `month`, `day`, `hour`, `minute` — the calendar moment. The rule fires when time is advanced past this point. |
| **Encounter** | An encounter is started or ended. | None needed. |

**Trigger config** is a JSON field. Most triggers don't need configuration — just leave it as `{}`. The triggers that use it are **Threshold Crossed** and **Scheduled**.

Threshold config example:
```json
{"attribute": "stamina", "threshold": 3, "direction": "falling"}
```

Scheduled config example:
```json
{"datetime": {"month": 4, "day": 15, "hour": 6, "minute": 0}}
```

### Action Mode

- **Auto-apply** — When conditions pass, actions execute immediately and changes are applied to the game world. An "Undo" button appears in the notification drawer.
- **Suggest** — When conditions pass, a suggestion notification is created. You review it and click "Apply" or "Dismiss" in the notification drawer. Nothing changes until you approve it.

Use **Auto-apply** for mechanical bookkeeping you always want (torch consumption, effect expiry consequences). Use **Suggest** for judgment calls (applying weather debuffs, granting loot).

### Priority

A number that controls evaluation order. **Lower numbers fire first.** If multiple rules share a trigger type, they run in priority order. Default is 100.

Recommended ranges:

| Range | Use for |
|-------|---------|
| 10-50 | Critical/safety rules (low health warnings, resource alerts) |
| 100 | Standard rules (default) |
| 150-200 | Informational/cosmetic rules (flavor notifications) |

### Target Mode

Determines which characters (if any) the rule evaluates against:

| Target Mode | What it does |
|-------------|-------------|
| **Environment** | Rule runs once with no character context. Use for weather-related or general notifications. Character-specific conditions (like `has_effect`) will always fail. |
| **All PCs** | Rule runs once per PC. Conditions check each PC individually. |
| **All NPCs** | Rule runs once per NPC. |
| **All Characters** | Rule runs once per PC and NPC. |
| **Specific Characters** | Rule runs for specific characters only. Use the character picker to select targets. |

When a rule targets characters, it evaluates conditions and executes actions *per character*. So a "consume Torch" rule targeting All PCs will consume a torch from every PC who has one.

### Tags

Comma-separated labels for organization (e.g., `survival, resource`). Tags appear as badges on rule cards and are included in search. They have no mechanical effect.

---

## Conditions

Conditions determine *whether* a rule's actions fire. A rule with no conditions always passes.

### Builder vs Raw JSON

The form defaults to the **Builder view** with dropdowns and input fields. Click **Raw JSON** to switch to direct JSON editing — useful for complex nested logic. You can switch back and forth; the data syncs between views.

### Match Mode (Builder)

At the top of the condition builder, choose:

- **ALL conditions** — every condition must pass (logical AND).
- **ANY condition** — at least one condition must pass (logical OR).

### Nesting with Raw JSON

The builder supports a flat list with a single top-level AND/OR. For more complex logic (nested groups, NOT operators), use Raw JSON:

```json
{
  "all": [
    { "type": "weather_in", "values": ["Storm", "Heavy Rain"] },
    {
      "any": [
        { "type": "has_effect", "effect_name": "Exposed" },
        { "type": "lacks_item", "item_name": "Cloak" }
      ]
    }
  ]
}
```

To negate a condition, wrap it in `"not"`:

```json
{
  "not": { "type": "weather_is", "value": "Clear" }
}
```

### Condition Reference

#### Character Conditions

These require a character target (Target Mode must not be "Environment").

| Condition | Parameters | Passes when... |
|-----------|-----------|---------------|
| `attribute_gte` | `attribute`, `value` | Character's **effective** attribute (base + item modifiers + effect modifiers) is >= value. |
| `attribute_lte` | `attribute`, `value` | Effective attribute is <= value. |
| `attribute_eq` | `attribute`, `value` | Effective attribute equals value exactly. |
| `trait_equals` | `trait`, `value` | A raw base attribute or character field equals value (string comparison, not computed). Used for tag attributes. |
| `trait_in` | `trait`, `values` | A raw base attribute or character field is one of the listed values. |
| `character_type` | `value` | Character type matches — `"PC"` or `"NPC"`. |
| `has_effect` | `effect_name` | Character currently has this status effect applied. Uses the effect definition **name**, not ID. |
| `lacks_effect` | `effect_name` | Character does **not** have this effect. |
| `has_item` | `item_name` | Character has this item in inventory. Uses the item definition **name**. |
| `lacks_item` | `item_name` | Character does **not** have this item. |
| `item_quantity_lte` | `item_name`, `value` | Character's quantity of this item is <= value (0 if not carried). |
| `hours_since_effect` | `effect_name`, `operator`, `hours` | Hours since a timed effect was applied. `operator` is `"gte"` or `"lte"`. Only works for timed effects with remaining hours. |
| `hours_since_last_rest` | `operator`, `hours` | Hours since the character's last rest. `operator` is `"gte"` or `"lte"`. If no rest has been recorded, this is treated as infinite (always passes for `gte`). |

#### Environment Conditions

These check the current game world state and work with any target mode.

| Condition | Parameters | Passes when... |
|-----------|-----------|---------------|
| `weather_is` | `value` | Current weather exactly matches (e.g., `"Storm"`). |
| `weather_in` | `values` | Current weather is one of the listed values. In the builder, use checkboxes to select values. |
| `time_of_day_is` | `value` | Current time-of-day label matches (e.g., `"Morning"`, `"Night"`). Labels come from your campaign's time-of-day thresholds. |
| `time_between` | `from_hour`, `to_hour` | Current time is within the hour range. Supports wrapping past midnight (e.g., `from_hour: 22, to_hour: 4`). Optional `from_minute`, `to_minute` for precision. |
| `calendar_day` | `day`, `month` (optional) | Current day matches. If `month` is omitted, matches that day in any month. |
| `season_is` | `value` | Current month falls in the season. Seasons are quarter-based: first season = months 3-5, second = 6-8, third = 9-11, fourth = 12, 1-2. |
| `location_is` | `location_id` | Party is at the specific location (by ID). |
| `location_in` | `location_ids` | Party is at one of the listed locations. |
| `location_property` | `property`, `value` (optional) | The current location has a matching property in its properties JSON. If `value` is omitted, passes when the property exists and is truthy. |

#### Meta Conditions

| Condition | Parameters | Passes when... |
|-----------|-----------|---------------|
| `random_chance` | `probability` | Random roll succeeds. `probability` is 0.0 to 1.0 (e.g., `0.25` = 25% chance). Note: because this is random, the Test panel result may differ from actual firing. |

---

## Actions

Actions define *what happens* when a rule fires. They execute in the order listed. In the builder, use the arrow buttons to reorder actions.

### Template Variables

Many action fields (messages, effect names, item names, weather values) support template variables that get replaced at runtime:

| Variable | Resolves to |
|----------|-------------|
| `{character.name}` | The target character's name. |
| `{character.type}` | `"PC"` or `"NPC"`. |
| `{character.<attr>}` | A base attribute value, e.g., `{character.strength}`. |
| `{environment.weather}` | Current weather. |
| `{environment.current_hour}` | Current hour (0-23). |
| `{environment.current_day}` | Current day number. |
| `{var.<name>}` | A variable stored by a previous action in the same rule (see `roll_dice` and `random_from_list`). |

### Action Reference

#### Character Actions

These require a character target.

| Action | Parameters | What it does | Undoable |
|--------|-----------|-------------|----------|
| `apply_effect` | `effect_name`, `duration_hours` (optional), `allow_stack` (optional) | Applies the named status effect to the character. The effect must already exist in the campaign. By default, won't stack the same effect twice — set `allow_stack: true` to override. If `duration_hours` is set, overrides the effect's default duration. | Yes — effect is removed |
| `remove_effect` | `effect_name` | Removes the named effect from the character. | Yes — re-applied with original remaining duration |
| `modify_attribute` | `attribute`, `delta` | Changes a base attribute by delta (positive or negative). | Yes — delta is reversed |
| `consume_item` | `item_name`, `quantity` (default 1) | Removes quantity of the named item from the character's inventory. Deletes the item entry if quantity reaches 0. | Yes — quantity restored |
| `grant_item` | `item_name`, `quantity` (default 1) | Gives the named item to the character. The item must exist in the campaign. If stackable and already carried, adds to existing quantity. | Yes — quantity reversed |

#### Environment Actions

These work regardless of target mode.

| Action | Parameters | What it does | Undoable |
|--------|-----------|-------------|----------|
| `set_weather` | `weather` | Changes the current weather. | Yes — reverts to previous |
| `set_environment_note` | `note` | Replaces the environment notes text. | Yes — reverts to previous |
| `advance_time` | `hours`, `minutes` | Advances game time. Multiple `advance_time` actions within the same rule are batched. This can cascade — the time advance itself may trigger other `on_time_advance` rules. | No |

#### Notification and Logging Actions

| Action | Parameters | What it does | Undoable |
|--------|-----------|-------------|----------|
| `notify` | `message`, `severity` (default `"info"`) | Creates a notification and shows a toast. Severity: `"info"`, `"warning"`, or `"error"`. | No |
| `log` | `message` | Writes a message to the session log without creating a notification. | No |

#### Dice and Random Actions

| Action | Parameters | What it does | Undoable |
|--------|-----------|-------------|----------|
| `roll_dice` | `formula`, `store_as` | Rolls dice using `NdS+M` format (e.g., `"2d6+3"`, `"1d20"`, `"3d8-2"`). Stores the result in a variable accessible via `{var.<store_as>}` in subsequent actions. | No |
| `random_from_list` | `items`, `store_as` | Picks randomly from a weighted list. Each item has `value` and optional `weight` (default 1). Use Raw JSON for this action — the builder doesn't have a list editor. | No |

### Chaining Actions with Variables

Actions execute in order, and earlier actions can store values for later ones:

```json
[
  { "type": "roll_dice", "formula": "1d20", "store_as": "check" },
  { "type": "notify", "message": "Perception check: {var.check}", "severity": "info" }
]
```

```json
[
  { "type": "random_from_list", "store_as": "event",
    "items": [
      { "value": "Merchant caravan arrives", "weight": 3 },
      { "value": "Bandits spotted", "weight": 1 },
      { "value": "Traveling bard", "weight": 2 }
    ]
  },
  { "type": "notify", "message": "Random event: {var.event}" }
]
```

---

## Notifications and Undo

### The Bell Icon

The bell icon in the environment bar shows a badge with the count of unread notifications. Click it to open the notification drawer.

### Notification Drawer

The drawer slides in from the right side. It shows all notifications from rule firings.

**Filtering:** Use the buttons at the top (All, Info, Warning, Error) to filter by severity.

**Pinning:** Click the pin icon to keep the drawer open while you work. Otherwise it closes when you click outside it.

Each notification shows:
- The rule name that generated it
- The notification message
- The target character (if any)
- A timestamp

### Notification Types and Buttons

| Type | How it got there | Available buttons |
|------|-----------------|-------------------|
| **Auto-applied** | An auto-apply rule fired and changes were made. | **Undo** — reverses all changes from that rule firing. |
| **Suggestion** | A suggest-mode rule fired but changes are pending your approval. | **Apply** — executes the suggested actions. **Dismiss** — discards the suggestion. |

### What Can Be Undone

| Action | Undo behavior |
|--------|--------------|
| `apply_effect` | Effect is removed |
| `remove_effect` | Effect is re-applied with original remaining duration |
| `modify_attribute` | Delta is reversed |
| `set_weather` | Weather reverts to what it was before |
| `set_environment_note` | Note reverts to previous text |
| `consume_item` | Quantity restored |
| `grant_item` | Quantity reversed |

Actions like `notify`, `log`, `roll_dice`, and `advance_time` cannot be undone.

### Clear All

Click **Clear** in the drawer header to remove all notifications.

---

## Resting

The environment bar has **Short Rest** and **Long Rest** buttons (next to the time advance controls).

- **Short Rest** advances time by 1 hour.
- **Long Rest** advances time by 8 hours.

Both rest types:
1. Fire any `on_rest` trigger rules first.
2. Advance time (which fires `on_time_advance` rules, rolls weather, checks encounters).
3. Record the rest time for each character — this is used by the `hours_since_last_rest` condition.
4. Log the rest to the session log.

---

## Templates

Click **Templates** on the Rules page to browse pre-built rules organized by category:

| Category | Example templates |
|----------|------------------|
| **Survival** | Torch Burnout (consumes torches each hour), Starvation Warning (no rations after 8h without rest) |
| **Environmental** | Storm Exposure (suggests Exhausted in storms), Fog Navigation Hazard |
| **Effect Lifecycle** | Poison Weakens (auto-applies Exhausted when Poisoned), Blessed Healing Aura |
| **Location & Travel** | Dangerous Territory Warning (alerts on locations with `dangerous: true` property) |
| **Combat** | Low Stamina Warning (attribute threshold alert) |
| **Rest & Recovery** | Long Rest Recovery (suggests removing Exhausted) |
| **Economy & Time** | Daily Random Event (rolls 1d20 each morning) |

Click **Import** on a template to add it to your campaign as a new rule. The imported rule is fully editable — adjust conditions, actions, names, and targets to fit your campaign.

Templates reference specific effect and item names (like "Exhausted", "Torch", "Rations"). For a template to work, your campaign needs matching status effect and item definitions. Create them first, or edit the rule after importing to match your campaign's names.

---

## Tag Presets

Tag presets bundle a tag attribute definition with related rules into a reusable package. This is useful for common patterns like "faction" or "species" where you want the attribute and its associated automation rules together.

### Using Built-in Presets

On the **Settings** page, the Attribute Definitions section has a **Presets** button. Browse available presets and click **Import** to add one. This creates:

1. A new tag attribute (or merges options into an existing one)
2. All bundled rules, ready to enable

### Creating Custom Presets

Click **+ New Preset** in the preset browser to open the preset builder:

1. **Name** — a descriptive name for the preset
2. **Description** — what the preset does
3. **Tag Attribute** — select an existing tag attribute or define a new one (key, label, options)
4. **Rules** — select which rules that reference this attribute to include in the bundle

Custom presets are saved to the campaign and can be exported for use in other campaigns.

### Exporting and Sharing

Custom presets can be exported as JSON files and imported into other campaigns. The export includes the attribute definition and all bundled rule definitions.

---

## Testing Rules

Click **Test** on any rule card to open the test panel. This dry-runs the rule against the current game state without making any changes.

1. Optionally select a **test character** from the dropdown (or leave it on "Auto-select").
2. Click **Run Test**.

The panel shows:
- **Overall result** — PASS (rule would fire) or FAIL (rule would not fire).
- **Environment snapshot** — current weather, time of day, and hour used for the test.
- **Condition breakdown** — each condition listed with a green checkmark or red X, showing actual vs expected values. This is useful for debugging why a rule isn't firing as expected.
- **Actions that would fire** — lists which actions would execute if the rule passed.

Note: The `random_chance` condition uses an actual random roll during testing, so results may vary between test runs.

---

## Settings

On the **Settings** page, scroll down to the **Rules Engine** card.

### Enable / Disable

Uncheck **Engine enabled** to globally disable all rule evaluation. No rules will fire during time advance, effect changes, travel, rest, etc. This is useful if you want to temporarily pause automation.

### Cascade Depth Limit

When a rule fires and its actions trigger additional rules (e.g., an `apply_effect` action triggers an `on_effect_change` rule), this is called cascading. The **cascade depth limit** (default: 3) controls how deep this chain can go.

When the cascade limit is reached, any rules that would have auto-applied instead become suggestions. This prevents infinite loops while still letting you know the rule wanted to fire.

Increase the limit if you have legitimate chains of rules that need to cascade deeply. Keep it low (2-3) for most campaigns.

---

## Import and Export

Rules are included in campaign export/import. Click **Export** on the Rules page to export all rules as JSON, or **Import** to import rules from a file.

The import wizard handles conflicts — if a rule with the same name already exists, you can choose to skip, overwrite, or duplicate it.

---

## Tips and Examples

### Example: Survival Ration Tracking

Track rations per PC, consuming one every 8 hours:

- **Trigger:** Time Advance
- **Target:** All PCs
- **Conditions:** ALL of: `has_item` "Rations", `hours_since_last_rest` >= 8
- **Actions:** `consume_item` "Rations" (qty 1), `notify` "{character.name} ate a ration."
- **Mode:** Auto-apply
- **Priority:** 50

### Example: Weather-Based Combat Modifier

Suggest applying a debuff when fighting in a storm:

- **Trigger:** Encounter
- **Target:** All PCs
- **Conditions:** ALL of: `weather_in` ["Storm", "Heavy Rain"], `lacks_effect` "Wind-battered"
- **Actions:** `apply_effect` "Wind-battered"
- **Mode:** Suggest
- **Priority:** 100

### Example: Low Resource Alert

Warn when torch supply is running low:

- **Trigger:** Time Advance
- **Target:** All PCs
- **Conditions:** ALL of: `has_item` "Torch", `item_quantity_lte` "Torch" 2
- **Actions:** `notify` "{character.name} only has a few torches left!" severity "warning"
- **Mode:** Auto-apply
- **Priority:** 60

### Example: Scheduled Event

Something happens on a specific game date:

- **Trigger:** Scheduled
- **Trigger Config:** `{"datetime": {"month": 6, "day": 21, "hour": 12, "minute": 0}}`
- **Target:** Environment
- **Conditions:** (none)
- **Actions:** `notify` "The summer solstice festival begins!" severity "info", `set_environment_note` "Festival decorations fill the streets."
- **Mode:** Auto-apply

### Example: Location-Based Hazard

Apply a debuff when entering a swamp:

- **Trigger:** Location Change
- **Target:** All PCs
- **Conditions:** ALL of: `location_property` "terrain" = "swamp", `lacks_effect` "Swamp Sickness"
- **Actions:** `apply_effect` "Swamp Sickness"
- **Mode:** Suggest
- **Priority:** 80

### Example: Cascading Effect Chain

When poisoned, also apply exhausted; when exhausted + poisoned, warn the DM:

**Rule 1 — Poison Weakens** (priority 80):
- **Trigger:** Effect Change
- **Target:** All Characters
- **Conditions:** ALL of: `has_effect` "Poisoned", `lacks_effect` "Exhausted"
- **Actions:** `apply_effect` "Exhausted"
- **Mode:** Auto-apply

**Rule 2 — Critical Condition** (priority 90):
- **Trigger:** Effect Change
- **Target:** All Characters
- **Conditions:** ALL of: `has_effect` "Poisoned", `has_effect` "Exhausted"
- **Actions:** `notify` "{character.name} is in critical condition!" severity "error"
- **Mode:** Auto-apply

When Poisoned is applied, Rule 1 fires and applies Exhausted. That effect change cascades, and Rule 2 fires because both effects are now present.

### Example: Tag-Based Rule

Apply different effects based on a character's faction:

- **Trigger:** Location Change
- **Target:** All Characters
- **Conditions:** ALL of: `trait_equals` "faction" = "Outlaw", `location_property` "population" = "medium"
- **Actions:** `notify` "{character.name} should keep a low profile here." severity "warning"
- **Mode:** Auto-apply

### Best Practices

- **Start with Suggest mode** for new rules until you're confident they behave correctly. Switch to Auto-apply once verified.
- **Use the Test panel** to debug conditions before relying on a rule in play.
- **Keep priorities organized** — use 10-50 for critical/safety rules, 100 for standard rules, 150+ for informational/cosmetic rules.
- **Name effects and items consistently** — rules match by exact name. "Exhausted" won't match "exhausted".
- **Use tags** to organize rules by theme (survival, combat, weather, etc.) for easy filtering.
- **Don't over-automate** — the rules engine is a co-DM, not a replacement. Use Suggest mode for decisions that need DM judgment.
- **Check warning badges** — the Rules page shows warnings when a rule references effects or items that don't exist in the campaign.
- **Use variables for dynamic content** — chain `roll_dice` or `random_from_list` with `notify` to create dynamic event messages.
