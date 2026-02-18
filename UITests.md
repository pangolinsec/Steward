# Almanac UI Tests

**App URL:** http://localhost:3000
**Approach:** All tests start from a fresh state. Tests are ordered sequentially — later tests depend on data created by earlier ones.
**Note:** Tests marked with `[WIP]` cover features that may be unstable.

---

## Prerequisites

Before running tests:
1. App server and client are running at http://localhost:3000
2. Database is empty (no campaigns exist) OR tests create a new campaign to isolate

---

## TS-01: Campaign Management

### T-01.1: First Load — Empty State
1. Navigate to http://localhost:3000
2. **Verify** the page shows "Almanac" heading, "No campaigns found" message, and a "Create Campaign" button
3. **Verify** no sidebar or navigation is visible

### T-01.2: Create Campaign
1. Click "Create Campaign"
2. **Verify** a modal appears titled "Campaigns"
3. Type "Test Campaign" in the campaign name input
4. Click "Create"
5. **Verify** the modal closes, the sidebar appears with "Test Campaign" as the campaign name
6. **Verify** the app navigates to /characters showing "No characters yet"
7. **Verify** the environment bar appears at the top with default time (00:00), date, and weather

### T-01.3: Create Second Campaign
1. Click the campaign name ("Test Campaign") in the sidebar header
2. **Verify** the campaign modal opens showing "Test Campaign" in the list
3. Type "Second Campaign" in the name input, click "Create"
4. **Verify** the app switches to "Second Campaign" and navigates to /characters
5. **Verify** "Second Campaign" appears in the sidebar header

### T-01.4: Switch Between Campaigns
1. Click the campaign name in the sidebar header
2. Click on "Test Campaign" in the campaign list
3. **Verify** the sidebar updates to show "Test Campaign"
4. **Verify** the page navigates to /characters

### T-01.5: Campaign Modal Close
1. Click the campaign name to open the modal
2. Click the X button to close
3. **Verify** the modal closes and the current campaign remains selected

**Edge case — T-01.6: Empty Campaign Name**
1. Open the campaign modal
2. Leave the name input empty and click "Create"
3. **Verify** no campaign is created (button should be disabled when name is empty)

---

## TS-02: Sidebar Navigation

### T-02.1: Navigate to All Pages
1. Ensure "Test Campaign" is active
2. Click "Characters" in the sidebar — **verify** URL is /characters, heading shows "Characters"
3. Click "Status Effects" — **verify** URL is /status-effects, heading shows "Status Effects Library"
4. Click "Items" — **verify** URL is /items, heading shows "Items Library"
5. Click "Encounters" — **verify** URL is /encounters, heading shows "Encounters Library"
6. Click "Locations" — **verify** URL is /locations, page shows the React Flow canvas
7. Click "Settings" — **verify** URL is /environment, heading shows "Campaign Settings"
8. Click "Session Log" — **verify** URL is /session-log, heading shows "Session Log"

### T-02.2: Active Nav Highlight
1. Navigate to /characters
2. **Verify** the "Characters" nav link has an active/highlighted style
3. Navigate to /items
4. **Verify** "Items" is now highlighted and "Characters" is not

---

## TS-03: Environment Settings

### T-03.1: View Default Settings
1. Navigate to Settings (/environment)
2. **Verify** the page shows:
   - Attribute Definitions card with default D&D attributes (Strength, Dexterity, Constitution, Intelligence, Wisdom, Charisma)
   - Current Environment card with Hour, Minute, Day, Month, Year, Weather, and Notes fields
   - Time-of-Day Thresholds card with default periods
   - Weather Options card with default weather types
   - Weather Automation card with volatility slider
   - Random Encounters card
   - Calendar Configuration card

### T-03.2: Add a Custom Attribute
1. In the Attribute Definitions card, find the "key" and "Label" inputs at the bottom
2. Type "luck" in the key field and "Luck" in the Label field
3. Click "Add"
4. **Verify** "luck / Luck" appears in the attribute list
5. Click "Save Settings"
6. Reload the page
7. **Verify** the "Luck" attribute persists

### T-03.3: Remove an Attribute
1. Find the "Luck" attribute row
2. Click the X (delete) button on that row
3. Click "Save Settings"
4. Reload the page
5. **Verify** "Luck" no longer appears in the list

### T-03.4: Set Current Environment Time
1. In the Current Environment card, change Hour to 14 and Minute to 30
2. **Verify** the environment bar updates to show "14:30"
3. **Verify** the time-of-day tag updates accordingly (should show "afternoon" or similar based on thresholds)

### T-03.5: Set Current Date
1. Change Day to 15, Month to 3, Year to 1450
2. **Verify** the environment bar date updates to show the 3rd month name, day 15, year 1450

### T-03.6: Set Weather
1. Select a different weather type from the Weather dropdown (e.g., "Rain")
2. **Verify** the environment bar weather updates to show the rain icon and "Rain"

### T-03.7: Set Environment Notes
1. Type "A storm is brewing" in the Environment Notes textarea
2. **Verify** the environment bar shows "Notes: A storm is brewing"

### T-03.8: Add Weather Option
1. In the Weather Options card, type "Blizzard" in the new weather input
2. Click "Add"
3. **Verify** "Blizzard" appears as a tag
4. Click "Save Settings"
5. Reload — **verify** "Blizzard" persists

### T-03.9: Remove Weather Option
1. Find the "Blizzard" tag and click its X button
2. Click "Save Settings"
3. Reload — **verify** "Blizzard" is gone

### T-03.10: Weather Automation — Volatility Slider
1. In the Weather Automation card, drag the volatility slider to approximately 70%
2. **Verify** the label updates to show ~70%
3. Click "Save Settings"

### T-03.11: Weather Automation — Generate Transition Table
1. Click "Show Advanced Transition Table"
2. **Verify** a section appears with "Auto-generate" and "Clear" buttons
3. Click "Auto-generate"
4. **Verify** a table appears with weather types as rows/columns
5. **Verify** each row sums to approximately 1.00 (shown in green)
6. Click "Save Settings"

### T-03.12: Random Encounters — Enable
1. In the Random Encounters card, check the "Enable random encounters" checkbox
2. **Verify** additional fields appear: base encounter rate slider and minimum hours input
3. Adjust base rate slider and min interval
4. Click "Save Settings"

### T-03.13: Calendar Configuration — Add Month
1. Scroll to Calendar Configuration
2. Click "+ Add Month"
3. **Verify** a new row appears with "New Month" and 30 days
4. Change the name to "Deepwinter" and days to 28
5. Click "Save Settings"

### T-03.14: Calendar Configuration — Weekday Names
1. In the Weekday Names input, type "Moonday, Tideday, Windday, Fireday, Starday"
2. Click "Save Settings"
3. Reload — **verify** the weekday names persist

**Edge case — T-03.15: Time-of-Day Threshold Modification**
1. Add a new threshold by clicking "+ Add Threshold"
2. Set label to "Midnight" and start hour to 0
3. Click "Save Settings"
4. Set the current hour to 0 in Current Environment
5. **Verify** the time-of-day tag in the environment bar reflects the new threshold

---

## TS-04: Characters

### T-04.1: Empty State
1. Navigate to /characters
2. **Verify** the page shows "No characters yet. Create one to get started."

### T-04.2: Create a PC Character
1. Click "+ New Character"
2. **Verify** a modal appears titled "New Character"
3. Fill in:
   - Name: "Thorin Ironforge"
   - Type: PC (should be default)
   - Description: "A stout dwarf fighter"
   - Portrait URL: leave empty
   - Set Strength to 18, Dexterity to 12, Constitution to 16, Intelligence to 8, Wisdom to 14, Charisma to 10
4. Click "Create"
5. **Verify** the modal closes and a character card for "Thorin Ironforge" appears
6. **Verify** the card shows:
   - Initial letter avatar "T" (since no portrait)
   - Name: "Thorin Ironforge"
   - "PC" tag (with buff color)
   - Description preview
   - First 4 attribute abbreviations with values

### T-04.3: Create an NPC Character
1. Click "+ New Character"
2. Fill in:
   - Name: "Goblax the Goblin"
   - Type: NPC
   - Description: "A sneaky goblin scout"
   - Strength: 8, Dexterity: 16, Constitution: 10, Intelligence: 12, Wisdom: 10, Charisma: 6
3. Click "Create"
4. **Verify** the card appears with "NPC" tag (no buff color)

### T-04.4: Create Additional Characters
1. Create two more characters for later tests:
   - "Elara Moonwhisper" (PC): STR 10, DEX 14, CON 12, INT 18, WIS 16, CHA 14
   - "Bandit Captain" (NPC): STR 15, DEX 14, CON 14, INT 10, WIS 12, CHA 14

### T-04.5: Search Characters
1. Type "Thorin" in the search input
2. **Verify** only "Thorin Ironforge" card is visible
3. Clear the search
4. **Verify** all characters reappear

### T-04.6: Filter by Type — PCs Only
1. Select "PCs" from the type dropdown
2. **Verify** only PC characters appear (Thorin, Elara)
3. **Verify** NPC characters are hidden

### T-04.7: Filter by Type — NPCs Only
1. Select "NPCs" from the type dropdown
2. **Verify** only NPC characters appear (Goblax, Bandit Captain)

### T-04.8: Filter by Type — Reset to All
1. Select "All Types" from the dropdown
2. **Verify** all characters appear

### T-04.9: Click Character Card to View Detail
1. Click on the "Thorin Ironforge" card
2. **Verify** the URL changes to /characters/{id}
3. **Verify** the detail page shows:
   - Back button ("← Back to Characters")
   - Character header: name "Thorin Ironforge", "PC" tag, description, initial avatar
   - Edit and Delete buttons
   - Attributes table with columns: Attribute, Base, Modifiers, Effective
   - All 6 attributes listed with correct base values
   - Effective values equal to base values (no modifiers yet)
   - Modifiers column showing "--" for all
   - Applied Effects section showing "No active effects."
   - Inventory section showing "No items."
   - "+ Add Effect" and "+ Add Item" buttons

### T-04.10: Back Button Navigation
1. On the character detail page, click "← Back to Characters"
2. **Verify** the URL returns to /characters
3. **Verify** the character list is visible

**Edge case — T-04.11: Create Character with Empty Name**
1. Click "+ New Character"
2. Leave the Name field empty
3. Click "Create"
4. **Verify** the form does not submit (HTML required validation)

**Edge case — T-04.12: Search with No Results**
1. Type "ZZZZZ" in the search input
2. **Verify** the empty state message appears ("No characters yet")

---

## TS-05: Status Effects

### T-05.1: Empty State
1. Navigate to /status-effects
2. **Verify** the page shows "No status effects defined yet."

### T-05.2: Create Indefinite Effect
1. Click "+ New Effect"
2. **Verify** modal appears titled "New Status Effect"
3. Fill in:
   - Name: "Blessed"
   - Description: "Divine blessing grants increased fortitude"
   - Tags: "buff, divine"
   - Duration Type: Indefinite (default)
   - Click "+ Add Modifier": set Attribute to "Strength", Delta to 2
   - Click "+ Add Modifier": set Attribute to "Wisdom", Delta to 1
4. Click "Create"
5. **Verify** the effect appears in the table with:
   - Name: "Blessed" with description
   - Tags: "buff" and "divine" as chips
   - Modifiers showing "+2" and "+1"
   - Duration: "Indefinite"

### T-05.3: Create Rounds-Based Effect
1. Click "+ New Effect"
2. Fill in:
   - Name: "Poisoned"
   - Description: "Weakened by poison"
   - Tags: "debuff, poison"
   - Duration Type: Rounds
   - Rounds: 5
   - Add modifier: Constitution, Delta: -3
   - Add modifier: Strength, Delta: -2
3. Click "Create"
4. **Verify** the effect appears with Duration "5 rounds" and negative modifiers

### T-05.4: Create Timed Effect
1. Click "+ New Effect"
2. Fill in:
   - Name: "Haste"
   - Description: "Magically quickened"
   - Tags: "buff, magical"
   - Duration Type: Timed (hours)
   - Hours: 2
   - Add modifier: Dexterity, Delta: 4
3. Click "Create"
4. **Verify** the effect appears with Duration "2h"

### T-05.5: Search Effects
1. Type "Blessed" in the search bar
2. **Verify** only "Blessed" appears in the table
3. Clear search — **verify** all effects reappear

### T-05.6: Edit Effect
1. Click "Edit" on the "Blessed" effect
2. **Verify** the modal opens pre-populated with Blessed's data
3. Change Delta of the Strength modifier from 2 to 3
4. Click "Save"
5. **Verify** the table now shows the updated modifier (+3)

### T-05.7: Create Effect with No Modifiers
1. Create a new effect:
   - Name: "Frightened"
   - Description: "Overcome with fear"
   - Tags: "debuff, condition"
   - Duration: Indefinite
   - No modifiers
2. Click "Create"
3. **Verify** the effect appears with empty modifiers column

---

## TS-06: Items

### T-06.1: Empty State
1. Navigate to /items
2. **Verify** the page shows "No items defined yet."

### T-06.2: Create Non-Stackable Item with Modifiers
1. Click "+ New Item"
2. **Verify** modal appears titled "New Item"
3. Fill in:
   - Name: "Sword of Strength"
   - Item Type: "weapon"
   - Description: "A magical sword that enhances the wielder's strength"
   - Stackable: unchecked
   - Properties: "weight: 3\nrarity: rare"
   - Add modifier: Strength, Delta: 3
4. Click "Create"
5. **Verify** the item appears in the table with:
   - Name and description
   - Type tag: "weapon"
   - Modifier: "+3"
   - Properties: "weight: 3, rarity: rare"

### T-06.3: Create Stackable Item
1. Click "+ New Item"
2. Fill in:
   - Name: "Healing Potion"
   - Item Type: "consumable"
   - Description: "Restores vitality"
   - Stackable: checked
   - Add modifier: Constitution, Delta: 2
3. Click "Create"

### T-06.4: Create Item Without Modifiers
1. Create an item:
   - Name: "Rope"
   - Item Type: "misc"
   - Description: "50 feet of hempen rope"
   - Stackable: checked
   - No modifiers
   - Properties: "weight: 10\nlength: 50ft"
2. Click "Create"
3. **Verify** the modifiers column is empty and properties show correctly

### T-06.5: Search Items
1. Type "Sword" in the search bar
2. **Verify** only "Sword of Strength" appears
3. Clear search

### T-06.6: Filter by Item Type
1. Select "weapon" from the type dropdown
2. **Verify** only weapon items appear
3. Select "All Types" — **verify** all items reappear

### T-06.7: Edit Item
1. Click "Edit" on "Healing Potion"
2. Change description to "Restores significant vitality"
3. Click "Save"
4. **Verify** the updated description appears in the table

---

## TS-07: Character Detail — Effects & Items

### T-07.1: Apply Effect to Character
1. Navigate to /characters, click on "Thorin Ironforge"
2. Click "+ Add Effect"
3. **Verify** the effect picker modal appears with a search bar and list of effects
4. **Verify** "Blessed", "Poisoned", "Haste", and "Frightened" are all listed
5. Click "Apply" next to "Blessed"
6. **Verify** the modal closes
7. **Verify** "Blessed" appears in the Applied Effects list with:
   - Name: "Blessed"
   - Modifier summary (STR +3, WIS +1)
   - Tags: "buff", "divine"
   - X (remove) button
8. **Verify** the Attributes table updates:
   - Strength: Base 18, Modifiers show "+3", Effective = 21 (green)
   - Wisdom: Base 14, Modifiers show "+1", Effective = 15 (green)
   - Other attributes unchanged (Effective = Base)

### T-07.2: Apply Timed Effect
1. Click "+ Add Effect"
2. Apply "Haste"
3. **Verify** "Haste" appears with duration tag showing hours remaining
4. **Verify** Dexterity effective value increases by 4 (12 → 16)

### T-07.3: Multiple Modifiers Stack
1. **Verify** with both Blessed and Haste applied:
   - Strength: 18 base + 3 (Blessed) = 21
   - Dexterity: 12 base + 4 (Haste) = 16
   - Wisdom: 14 base + 1 (Blessed) = 15
2. **Verify** the modifiers column shows the individual source breakdowns

### T-07.4: Remove Effect
1. Click the X button on "Haste" in the Applied Effects list
2. **Verify** "Haste" disappears from the list
3. **Verify** Dexterity returns to base value of 12
4. **Verify** count in Applied Effects header decreases

### T-07.5: Assign Item to Character
1. Click "+ Add Item"
2. **Verify** the item picker modal appears
3. Click "Add" next to "Sword of Strength"
4. **Verify** the modal closes
5. **Verify** "Sword of Strength" appears in the Inventory list with:
   - Name and "weapon" type tag
   - Modifier display
6. **Verify** Strength effective value updates: 18 base + 3 (Blessed) + 3 (Sword) = 24

### T-07.6: Assign Stackable Item
1. Click "+ Add Item"
2. Add "Healing Potion"
3. **Verify** it appears with quantity 1
4. Click "+ Add Item" again, add "Healing Potion" again
5. **Verify** the quantity increases to 2 (stackable deduplication), not shown as duplicate
6. **Verify** Constitution modifier from the potion is reflected in effective value

### T-07.7: Adjust Stackable Item Quantity
1. Find "Healing Potion" in inventory (should show x2)
2. **Verify** the +/- quantity buttons are visible (because it's stackable)
3. Click the "+" button
4. **Verify** quantity increases to 3
5. Click the "-" button
6. **Verify** quantity decreases to 2

### T-07.8: Quantity to Zero Removes Item
1. Click "-" until Healing Potion quantity reaches 0
2. **Verify** the item is removed from the inventory
3. **Verify** Constitution effective value returns to its previous state

### T-07.9: Remove Non-Stackable Item
1. Click the X button next to "Sword of Strength"
2. **Verify** it disappears from inventory
3. **Verify** Strength effective value decreases by 3

### T-07.10: Non-Stackable Item Has No +/- Buttons
1. Add "Rope" to the inventory
2. **Verify** "Rope" appears but does NOT show +/- quantity buttons (it's stackable, so it should)
   - Actually, Rope is stackable, so it SHOULD have +/- buttons. Verify they appear.
3. Remove Rope

### T-07.11: Effect Picker Search
1. Click "+ Add Effect"
2. Type "Poison" in the search bar
3. **Verify** only "Poisoned" appears in the list
4. Close the modal

### T-07.12: Item Picker Search
1. Click "+ Add Item"
2. Type "Rope" in the search bar
3. **Verify** only "Rope" appears
4. Close the modal

### T-07.13: Edit Character from Detail Page
1. Click "Edit" button on the character header
2. **Verify** the edit modal appears pre-populated with Thorin's data
3. Change the description to "A stout dwarf fighter and party leader"
4. Click "Save"
5. **Verify** the description updates on the detail page

---

## TS-08: Encounters

### T-08.1: Empty State
1. Navigate to /encounters
2. **Verify** "No encounters defined yet."

### T-08.2: Create Basic Encounter
1. Click "+ New Encounter"
2. **Verify** modal appears titled "New Encounter"
3. Fill in:
   - Name: "Goblin Ambush"
   - Description: "A group of goblins attacks from the roadside"
   - Notes: "Goblins are hiding in the bushes. DC 14 Perception to spot them."
   - NPCs JSON: `[{"character_id": 2, "role": "leader"}]` (use ID of Goblax)
   - Environment Overrides JSON: `{"weather": "Fog"}`
   - Loot Table JSON: `[{"item_name": "Gold Coins", "quantity": 50, "drop_chance": 1}]`
4. Click "Create"
5. **Verify** the encounter card appears with:
   - Name: "Goblin Ambush"
   - Description
   - "1 NPCs" count
   - "1 loot entries" count

### T-08.3: Expand Encounter Details
1. Click on the encounter card body (not the buttons)
2. **Verify** the expanded section shows:
   - Notes text
   - Environment overrides (weather: Fog)
   - Loot table entry (Gold Coins x50, 100%)

### T-08.4: Collapse Encounter
1. Click the card body again
2. **Verify** the expanded section collapses

### T-08.5: Create Encounter with Conditions
1. Click "+ New Encounter"
2. Fill in:
   - Name: "Nighttime Wolves"
   - Description: "Wolves prowl the wilderness at night"
   - In the Conditions section:
     - Check time-of-day conditions: "Night" or "Evening" (whatever is available from thresholds)
     - Check weather conditions: "Clear"
     - Set Weight to 2.0
3. Click "Create"
4. **Verify** the encounter shows "Has conditions" badge

### T-08.6: Search Encounters
1. Type "Goblin" in the search bar
2. **Verify** only "Goblin Ambush" appears
3. Clear search

### T-08.7: Edit Encounter
1. Click "Edit" on "Goblin Ambush"
2. Change description to "A larger group of goblins ambushes the party"
3. Click "Save"
4. **Verify** the updated description appears

**Edge case — T-08.8: Invalid JSON in Encounter Form**
1. Click "+ New Encounter"
2. Enter "invalid json" in the NPCs JSON field
3. Fill in a valid name
4. Click "Create"
5. **Verify** an error message appears about invalid JSON (the form uses alert())

---

## TS-09: Environment Bar — Time Advancement

### T-09.1: Quick Advance +10 Minutes
1. Note the current time in the environment bar
2. Click the "+10m" button
3. **Verify** the time advances by 10 minutes
4. **Verify** the time display updates

### T-09.2: Quick Advance +1 Hour
1. Note the current time
2. Click "+1h"
3. **Verify** the time advances by 1 hour

### T-09.3: Quick Advance +8 Hours
1. Note the current time
2. Click "+8h"
3. **Verify** the time advances by 8 hours
4. **Verify** if the time crosses midnight, the date increments

### T-09.4: Custom Time Advance
1. Click the "Custom" button
2. **Verify** hours and minutes inputs appear with an "Advance" and "Cancel" button
3. Enter 2 hours and 30 minutes
4. Click "Advance"
5. **Verify** time advances by 2h 30m
6. **Verify** the custom input area closes

### T-09.5: Cancel Custom Advance
1. Click "Custom"
2. Click "Cancel"
3. **Verify** the custom input area closes without changing time

**Edge case — T-09.6: Time Rollover Past Midnight**
1. Go to Settings, set time to 23:00
2. Return to any page
3. Click "+1h" twice (or use +8h)
4. **Verify** time rolls past 00:00 and the day increments by 1

**Edge case — T-09.7: Date Rollover Past Month End**
1. Go to Settings, set Day to the last day of the current month, Hour to 23
2. Advance time past midnight
3. **Verify** the day resets to 1 and the month increments

---

## TS-10: Session Log

### T-10.1: View Log Entries
1. Navigate to /session-log
2. **Verify** the page shows log entries created by previous actions (time advances, effect applications, item assignments, etc.)
3. **Verify** each entry shows: timestamp, entry type tag, and message

### T-10.2: Add Manual Log Entry
1. Select "manual" from the type dropdown in the add form
2. Type "Party rested at the inn" in the message input
3. Click "Add"
4. **Verify** the new entry appears at the top of the log
5. **Verify** it has the "manual" type tag

### T-10.3: Add Different Type Log Entry
1. Select "general" from the type dropdown
2. Type "Session started" in the message input
3. Click "Add"
4. **Verify** entry appears with "general" type tag

### T-10.4: Filter by Type
1. Select "manual" from the filter dropdown
2. **Verify** only manual entries are shown
3. **Verify** the entry count updates to reflect the filtered total
4. Select "All Types" — **verify** all entries reappear

### T-10.5: Filter by Effect-Related Type
1. Select "effect_applied" from the filter
2. **Verify** only effect application log entries appear (from when we applied Blessed/Haste to Thorin)

### T-10.6: Export Log
1. Click "Export"
2. **Verify** a .txt file download is triggered with the session log contents

### T-10.7: Pagination (if enough entries exist)
1. If more than 50 entries exist, **verify** Previous/Next buttons and page range indicator appear
2. Click "Next" — **verify** the next page of entries loads
3. Click "Previous" — **verify** returns to the first page

**Edge case — T-10.8: Add Entry with Empty Message**
1. Leave the message input empty
2. Click "Add"
3. **Verify** no entry is created

---

## TS-11: Locations `[WIP]`

### T-11.1: Initial State
1. Navigate to /locations
2. **Verify** the page shows a React Flow canvas with controls and minimap
3. **Verify** the right panel shows instructions: "Double-click the canvas to create a location"

### T-11.2: Create Location via Double-Click
1. Double-click on the empty canvas
2. **Verify** a new node appears labeled "New Location"
3. **Verify** the right panel opens with a location detail form
4. **Verify** the Name input is focused and auto-selected
5. Change name to "Town of Millhaven"
6. Add description: "A small trading town on the river"
7. Click "Save"
8. **Verify** the node label updates to "Town of Millhaven"

### T-11.3: Create Second Location
1. Double-click a different area of the canvas
2. Name it "Dark Forest"
3. Description: "A dense, dangerous woodland"
4. Set Encounter Modifier to 2.0
5. Click "Save"
6. **Verify** the node shows an "Enc: 2x" badge

### T-11.4: Create Third Location
1. Double-click to create "Mountain Pass"
2. Description: "A narrow pass through the mountains"
3. Click "Save"

### T-11.5: Create Edge Between Locations
1. Drag from the bottom handle of "Town of Millhaven" to the top handle of "Dark Forest"
2. **Verify** an edge (line) appears connecting the two nodes
3. Click on the edge
4. **Verify** the right panel shows the Edge detail form
5. Fill in:
   - Label: "Forest Road"
   - Travel Time: 4 hours
   - Bidirectional: checked
   - Encounter Modifier: 1.5
6. Click "Save"
7. **Verify** the edge label updates to show "Forest Road (4h)"

### T-11.6: Create Another Edge
1. Create an edge from "Dark Forest" to "Mountain Pass"
2. Set Label: "Mountain Trail", Travel Time: 8 hours, Bidirectional: unchecked
3. Save
4. **Verify** the edge shows with an arrow (unidirectional)

### T-11.7: Set Party Position
1. Click on the "Town of Millhaven" node
2. In the detail panel, click "Set Party Here"
3. **Verify** the node shows a "Party" marker
4. **Verify** the environment bar updates to show "Location: Town of Millhaven"

### T-11.8: Location Weather Override — Fixed
1. Click on "Dark Forest" node
2. In the Weather Override section, select "Fixed"
3. Select "Fog" from the weather dropdown
4. Click "Save"
5. **Verify** the node shows a "Weather: Fog" badge

### T-11.9: Location Weather Override — Weighted
1. Click on "Mountain Pass" node
2. Select "Weighted" for weather override
3. Set Snow to 0.5, Clear to 0.3, Windy to 0.2
4. Click "Save"
5. **Verify** node shows "Weather: weighted" badge

### T-11.10: Location Parent
1. Click on "Mountain Pass" node
2. Set Parent Location to "Dark Forest"
3. Click "Save"

### T-11.11: Location Properties
1. Click on "Town of Millhaven"
2. Enter in Properties: "population: 500\ngovernment: council"
3. Click "Save"

### T-11.12: Drag Node to Reposition
1. Drag "Town of Millhaven" to a different position on the canvas
2. Release the mouse
3. Reload the page
4. **Verify** the node position persists at the new location

### T-11.13: Delete Edge
1. Click on the "Mountain Trail" edge
2. Click "Delete" in the edge panel
3. **Verify** a confirmation dialog appears
4. Confirm deletion
5. **Verify** the edge is removed

### T-11.14: Delete Location
1. Click on "Mountain Pass" node
2. Click "Delete"
3. Confirm deletion
4. **Verify** the node and any connected edges are removed
5. **Verify** the detail panel closes

### T-11.15: Click Pane to Deselect
1. Click on a node to select it (panel shows details)
2. Click on the empty canvas (not on a node or edge)
3. **Verify** the detail panel returns to the instruction view

---

## TS-12: Cross-Feature Integration

### T-12.1: Effect Modifiers Show in Character Detail Breakdown
1. Navigate to Thorin's detail page
2. **Verify** the Attributes table shows modifier sources:
   - Hover/check the modifier values — they should indicate "Blessed (effect)" as the source

### T-12.2: Item Modifiers Show in Character Detail
1. Add "Sword of Strength" back to Thorin
2. **Verify** Strength modifiers column shows two sources:
   - "+3" from Blessed (effect)
   - "+3" from Sword of Strength (item)
3. **Verify** Effective Strength = 18 + 3 + 3 = 24

### T-12.3: Session Log Records Effect Application
1. Navigate to Session Log
2. **Verify** there are entries of type "effect_applied" for when Blessed was applied to Thorin

### T-12.4: Session Log Records Item Assignment
1. **Verify** there are entries of type "item_assigned" for Sword of Strength

### T-12.5: Session Log Records Time Advances
1. **Verify** there are entries of type "time_advance" from the environment bar advances

### T-12.6: Deleting a Status Effect Definition Removes Applied Instances
1. Navigate to Status Effects, delete "Frightened"
2. **Verify** "Frightened" is removed from the table
3. If Frightened was applied to any character, verify it no longer appears in their Applied Effects

### T-12.7: Deleting an Item Definition Removes from Characters
1. Navigate to Items, delete "Rope"
2. **Verify** if Rope was assigned to anyone, it no longer appears in their inventory

### T-12.8: Environment Settings Changes Reflect in Bar
1. Navigate to Settings
2. Change weather to "Snow"
3. Navigate to Characters (or any other page)
4. **Verify** the environment bar shows the snow icon and "Snow"

---

## TS-13: Campaign Export & Import

### T-13.1: Export Campaign
1. Click the campaign name to open the campaign modal
2. Find "Test Campaign" and click the export (download) button
3. **Verify** a JSON file is downloaded named "almanac-campaign-{id}.json"

### T-13.2: Import Campaign as New
1. In the campaign modal, click "Import Campaign from JSON"
2. Select the previously exported JSON file
3. **Verify** a new campaign is created with "(Imported)" in the name
4. **Verify** the app switches to the imported campaign
5. Navigate through Characters, Status Effects, Items, Encounters
6. **Verify** all data from the original campaign exists in the imported copy

### T-13.3: Switch Back to Original
1. Open campaign modal
2. Click on "Test Campaign" (original)
3. **Verify** all original data is intact

---

## TS-14: Per-Page Import `[WIP]`

### T-14.1: Import Characters
1. Navigate to /characters
2. Click "Import"
3. **Verify** the ImportPreviewModal appears
4. **Verify** entity type is locked to "characters"

### T-14.2: Import Status Effects
1. Navigate to /status-effects
2. Click "Import"
3. **Verify** the ImportPreviewModal appears locked to "status_effects"

### T-14.3: Import Items
1. Navigate to /items
2. Click "Import"
3. **Verify** the ImportPreviewModal appears locked to "items"

### T-14.4: Import Encounters
1. Navigate to /encounters
2. Click "Import"
3. **Verify** the ImportPreviewModal appears locked to "encounters"

### T-14.5: Merge Import from Campaign Modal
1. Open the campaign modal
2. Click "Merge into Current Campaign"
3. **Verify** the ImportPreviewModal appears with all entity types selectable (not locked)

---

## TS-15: Edge Cases & Error Handling

### T-15.1: Direct URL Navigation
1. Navigate directly to http://localhost:3000/items
2. **Verify** the Items page loads correctly with the active campaign's data

### T-15.2: Navigate to Invalid Character ID
1. Navigate to http://localhost:3000/characters/99999
2. **Verify** the page shows "Loading..." and does not crash

### T-15.3: Negative Attribute Values
1. Create a status effect "Cursed" with Strength delta -20
2. Apply it to a character with Strength 10
3. **Verify** the effective Strength shows as -10 (negative is allowed)
4. **Verify** the effective value is displayed in red

### T-15.4: Multiple Same Effects Stacking
1. Apply "Blessed" to Thorin a second time
2. **Verify** TWO instances of "Blessed" appear in Applied Effects
3. **Verify** Strength modifiers show two "+3" entries
4. **Verify** total effective Strength reflects both (+6 from two Blessed instances)

### T-15.5: Delete Character
1. Navigate to any character's detail page (e.g., Bandit Captain)
2. Click "Delete"
3. **Verify** a confirmation prompt appears
4. Confirm deletion
5. **Verify** navigation returns to /characters
6. **Verify** the character no longer appears in the list

### T-15.6: Session Log Clear
1. Navigate to Session Log
2. Click "Clear Log"
3. **Verify** a confirmation prompt appears
4. Confirm
5. **Verify** all entries are removed and the empty state appears

### T-15.7: Long Text Handling
1. Create a character with a very long description (200+ characters)
2. **Verify** the character card truncates the description with ellipsis
3. **Verify** the detail page shows the full description

### T-15.8: Special Characters in Names
1. Create a character named "O'Brien the "Bold""
2. **Verify** the name displays correctly with quotes and apostrophe
3. Delete the character afterward

---

## Test Data Summary

After running all tests, the "Test Campaign" should contain:
- **Characters:** Thorin Ironforge (PC), Goblax the Goblin (NPC), Elara Moonwhisper (PC) — Bandit Captain may be deleted
- **Status Effects:** Blessed, Poisoned, Haste (Frightened may be deleted, Cursed added for edge case)
- **Items:** Sword of Strength, Healing Potion (Rope may be deleted)
- **Encounters:** Goblin Ambush, Nighttime Wolves
- **Locations:** Town of Millhaven, Dark Forest (Mountain Pass may be deleted) `[WIP]`
- **Session Log:** Various auto-generated + manual entries (may be cleared)
