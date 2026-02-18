# DM Features — UI Tests

**App URL:** http://localhost:3000
**Approach:** These tests build on data from the main `UITests.md` suite. They assume "Test Campaign" exists with characters (Thorin Ironforge PC, Elara Moonwhisper PC, Goblax the Goblin NPC), status effects (Blessed, Poisoned, Haste), items (Sword of Strength, Healing Potion), and encounters (Goblin Ambush with NPCs, Nighttime Wolves). Tests are sequential — later tests depend on data created by earlier ones.

---

## Prerequisites

Before running these tests:
1. The app is running at http://localhost:3000
2. "Test Campaign" is active with the data described above
3. Create additional data if missing:
   - Encounter "Goblin Ambush" with at least one NPC (Goblax the Goblin, role: "leader"), and environment overrides `{"weather": "Fog"}`
   - Encounter "Nighttime Wolves" with no NPCs
   - At least 2 locations exist with a path between them (e.g. "Town of Millhaven" → "Dark Forest" via "Forest Road")
   - Party is positioned at "Town of Millhaven"

---

## TS-D01: DM Notes — Character Form

### T-D01.1: DM Notes Field in New Character Form
1. Navigate to /characters
2. Click "+ New Character"
3. **Verify** the form contains a "DM Notes" textarea field below the attributes section
4. **Verify** the placeholder text reads "Private DM notes..."
5. Click "Cancel"

### T-D01.2: Create Character with DM Notes
1. Click "+ New Character"
2. Fill in:
   - Name: "Test NPC"
   - Type: NPC
   - Description: "A test character for DM notes"
3. In the DM Notes textarea, type: "Secret: This NPC is actually a dragon in disguise. [[Thorin Ironforge]] knows the truth."
4. Click "Create"
5. **Verify** the modal closes and "Test NPC" appears in the character list

### T-D01.3: DM Notes Visible on Character Detail
1. Click on "Test NPC" to navigate to the detail page
2. **Verify** a "DM Notes" card appears below the character description
3. **Verify** the card shows the full notes text: "Secret: This NPC is actually a dragon in disguise."
4. **Verify** the wikilink `[[Thorin Ironforge]]` is rendered as a clickable link

### T-D01.4: DM Notes Card Collapse/Expand
1. On the "Test NPC" detail page, find the DM Notes card header
2. Click the collapse toggle (arrow/chevron)
3. **Verify** the notes content collapses (hidden)
4. Click the toggle again
5. **Verify** the notes content expands (visible again)

### T-D01.5: Wikilink Click in DM Notes
1. Click the `[[Thorin Ironforge]]` link in the DM Notes
2. **Verify** a journal search or navigation action occurs (depends on wikilink resolver behavior)
3. Navigate back to the "Test NPC" detail page

### T-D01.6: DM Notes in Edit Character Modal
1. Click "Edit" on the Test NPC detail page
2. **Verify** the edit modal opens with the DM Notes textarea pre-populated with the existing notes
3. Change the notes to: "Updated: The dragon reveal happens in session 5."
4. Click "Save"
5. **Verify** the DM Notes card on the detail page shows the updated text

### T-D01.7: DM Notes on Existing Character (Thorin)
1. Navigate to Thorin Ironforge's detail page
2. Click "Edit"
3. In the DM Notes textarea, type: "Thorin's backstory hook: his family's mine was taken by orcs."
4. Click "Save"
5. **Verify** the DM Notes card appears on Thorin's detail page with the notes

### T-D01.8: Character with Empty DM Notes
1. Navigate to Elara Moonwhisper's detail page
2. **Verify** the DM Notes card either does not appear or shows empty content (no "undefined" or errors)

**Edge case — T-D01.9: DM Notes Preserved Across Edit**
1. Navigate to "Test NPC" detail page
2. Click "Edit"
3. Change the character description but do NOT change DM Notes
4. Click "Save"
5. **Verify** the DM Notes remain unchanged

---

## TS-D02: DM Notes — Combat Tracker

### T-D02.1: Prepare Combat with DM Notes Character
1. Navigate to /characters
2. Click "Start Combat"
3. **Verify** the Combat Setup modal appears
4. Select at least "Test NPC" (who has DM notes) and "Thorin Ironforge" (who also has DM notes)
5. Set initiative values (e.g. Thorin: 15, Test NPC: 10)
6. Click "Start Combat"
7. **Verify** the combat tracker appears

### T-D02.2: DM Notes Icon in Combatant Row
1. In the combat tracker, find the row for "Test NPC"
2. **Verify** a small notes icon/button appears (since Test NPC has non-empty dm_notes)
3. Find the row for "Thorin Ironforge"
4. **Verify** the notes icon also appears for Thorin

### T-D02.3: Expand DM Notes in Combat
1. Click the notes icon on "Test NPC"
2. **Verify** the DM notes expand inline below the combatant row
3. **Verify** the notes text is visible: "Updated: The dragon reveal happens in session 5."

### T-D02.4: Collapse DM Notes in Combat
1. Click the notes icon on "Test NPC" again
2. **Verify** the notes collapse and are hidden

### T-D02.5: No Notes Icon for Character Without Notes
1. If Elara is in combat, find her row
2. **Verify** no notes icon appears (she has no DM notes)

### T-D02.6: End Combat
1. Click "End Combat" in the page header
2. **Verify** combat ends and the character list reappears

---

## TS-D03: Damage/Healing Quick-Entry in Combat

### T-D03.1: Start Combat for Delta Testing
1. Navigate to /characters
2. Click "Start Combat"
3. Select Thorin Ironforge and Elara Moonwhisper
4. Set initiative (Thorin: 18, Elara: 12)
5. Click "Start Combat"
6. **Verify** the combat tracker appears with attribute columns

### T-D03.2: Open Delta Popover
1. Click on Thorin's Strength value in the combat tracker
2. **Verify** a delta popover appears anchored to the cell
3. **Verify** the popover shows:
   - The current effective value prominently
   - A text input field (auto-focused)
   - "Damage" and "Heal" buttons

### T-D03.3: Deal Damage via Input
1. In the delta input, type "-5"
2. Press Enter (or click the input's submit)
3. **Verify** Thorin's base Strength decreases by 5
4. **Verify** the cell flashes red briefly (damage animation)
5. **Verify** the popover closes

### T-D03.4: Heal via Input
1. Click on Thorin's Strength value again
2. Type "+3"
3. Press Enter
4. **Verify** Thorin's base Strength increases by 3
5. **Verify** the cell flashes green briefly (heal animation)

### T-D03.5: Damage Button
1. Click on Elara's Constitution value
2. Type "4" (no sign)
3. Click the "Damage" button
4. **Verify** Elara's Constitution base value decreases by 4
5. **Verify** red flash animation

### T-D03.6: Heal Button
1. Click on Elara's Constitution value
2. Type "2"
3. Click the "Heal" button
4. **Verify** Elara's Constitution base value increases by 2
5. **Verify** green flash animation

### T-D03.7: Absolute Value Set
1. Note Thorin's current Strength base value
2. Click on Thorin's Strength value
3. Type "20" (no sign, no Damage/Heal button — just press Enter)
4. **Verify** Thorin's Strength base is set to exactly 20 (absolute set, not delta)

### T-D03.8: Cancel Delta Popover
1. Click on any attribute value to open the popover
2. Press Escape
3. **Verify** the popover closes without changing any values

### T-D03.9: Delta Logged to Session Log
1. Navigate to /session-log
2. **Verify** entries with type "combat" appear recording the attribute changes
3. **Verify** entries show format like "Thorin Ironforge: strength 18 → 13 (-5)"

### T-D03.10: End Combat
1. Navigate to /characters
2. Click "End Combat"

**Edge case — T-D03.11: Zero Delta**
1. Start combat, click an attribute value
2. Type "0" and press Enter
3. **Verify** no change occurs and no flash animation plays

**Edge case — T-D03.12: Large Negative Delta**
1. Start combat, click on a low attribute value (e.g. a character with STR 8)
2. Type "-20" and press Enter
3. **Verify** the value goes negative (e.g. -12) without crashing
4. End combat

---

## TS-D04: Random Tables — CRUD

### T-D04.1: Navigate to Random Tables
1. Click "Random Tables" in the sidebar
2. **Verify** the URL is /random-tables
3. **Verify** the heading shows "Random Tables"
4. **Verify** the page shows an empty state: "No random tables yet."

### T-D04.2: Create Weighted Table
1. Click "+ New Table"
2. **Verify** a modal appears titled "New Random Table"
3. Fill in:
   - Name: "Wild Magic Surge"
   - Description: "Roll when a wild magic sorcerer casts a spell"
   - Table Type: Weighted (should be default)
4. In the entries section, add entries:
   - Entry 1: Text "Fireball centered on self", Weight 2
   - Entry 2: Text "Turn invisible for 1 minute", Weight 3
   - Entry 3: Text "Nothing happens", Weight 5
5. **Verify** the probability preview shows:
   - Fireball: ~20% (2/10)
   - Invisible: ~30% (3/10)
   - Nothing: ~50% (5/10)
6. Click "Create"
7. **Verify** the modal closes and "Wild Magic Surge" appears as a card

### T-D04.3: Verify Table Card Display
1. Find the "Wild Magic Surge" card
2. **Verify** it shows:
   - Name: "Wild Magic Surge"
   - Description: "Roll when a wild magic sorcerer casts a spell"
   - "Weighted" type badge
   - Entry count: 3 entries
   - A "Roll" button

### T-D04.4: Create Sequential Table
1. Click "+ New Table"
2. Fill in:
   - Name: "NPC Names"
   - Description: "Random NPC name generator"
   - Table Type: Sequential
3. Add entries:
   - Entry 1: "Aldric the Brave"
   - Entry 2: "Brenna Swiftfoot"
   - Entry 3: "Cormac Ironhand"
   - Entry 4: "Delphine Starfall"
4. **Verify** weight inputs are hidden for sequential type
5. Click "Create"
6. **Verify** "NPC Names" card appears with "Sequential" badge

### T-D04.5: Edit Random Table
1. Click "Edit" on "Wild Magic Surge"
2. **Verify** the modal opens pre-populated with the table data
3. Add a new entry: Text "Polymorph into a sheep", Weight 2
4. Click "Save"
5. **Verify** the card now shows 4 entries

### T-D04.6: Search Random Tables
1. Type "Wild" in the search bar
2. **Verify** only "Wild Magic Surge" appears
3. Clear the search
4. **Verify** both tables reappear

### T-D04.7: Reorder Entries
1. Click "Edit" on "Wild Magic Surge"
2. Click the "Move Down" button on the first entry (Fireball)
3. **Verify** the first and second entries swap positions
4. Click the "Move Up" button on the moved entry
5. **Verify** it returns to original position
6. Click "Cancel"

**Edge case — T-D04.8: Create Table with No Entries**
1. Click "+ New Table"
2. Fill in Name: "Empty Table", keep entries empty
3. Click "Create"
4. **Verify** the table is created (rolling it may produce no result)
5. Delete "Empty Table"

---

## TS-D05: Random Tables — Rolling

### T-D05.1: Roll Weighted Table
1. Find "Wild Magic Surge" card
2. Click "Roll"
3. **Verify** a result appears on the card showing one of the entries (Fireball, Invisible, Nothing, or Polymorph)
4. **Verify** the result has a visual highlight or animation

### T-D05.2: Roll Multiple Times
1. Click "Roll" on "Wild Magic Surge" again
2. **Verify** the result updates (may be same or different — randomness)
3. Roll a few more times
4. **Verify** all results are from the defined entries

### T-D05.3: Roll Sequential Table
1. Click "Roll" on "NPC Names"
2. **Verify** the result is one of the 4 defined names
3. Roll several times — **verify** all results are valid names from the table

### T-D05.4: Roll Logged to Session Log
1. Navigate to /session-log
2. **Verify** entries with type "table_roll" appear
3. **Verify** the entries show the table name and result

### T-D05.5: Session Log Table Roll Color
1. On the session log page, find a "table_roll" entry
2. **Verify** the type tag uses the accent color (consistent with other entry type styling)

---

## TS-D06: Random Tables — Dice Roller Integration

### T-D06.1: Tables Section in Dice Roller
1. Click the dice roller button (floating dice icon) to expand it
2. **Verify** a "Tables" section appears below the roll history
3. **Verify** the tables section lists "Wild Magic Surge" and "NPC Names"

### T-D06.2: Roll from Dice Roller
1. In the Tables section, click "Roll" next to "Wild Magic Surge"
2. **Verify** a result appears inline next to the table name
3. Click "Roll" next to "NPC Names"
4. **Verify** a result appears for that table too

### T-D06.3: Close and Reopen Dice Roller
1. Close the dice roller
2. Reopen it
3. **Verify** the Tables section reloads the table list

---

## TS-D07: Random Tables — Delete

### T-D07.1: Delete Random Table
1. Navigate to /random-tables
2. Click "Delete" on "NPC Names"
3. **Verify** a confirmation dialog appears
4. Confirm deletion
5. **Verify** "NPC Names" is removed from the list
6. **Verify** only "Wild Magic Surge" remains

---

## TS-D08: Encounter → Combat Bridge — Encounters Page

### T-D08.1: Start Encounter with NPCs — Combat Prompt
1. Navigate to /encounters
2. Find "Goblin Ambush" (which has NPCs defined)
3. Click "Start"
4. **Verify** a prompt/modal appears asking to start combat with the encounter's NPCs
5. **Verify** the prompt shows options like "Start Combat" and "Log Only"

### T-D08.2: Start Combat from Encounter
1. Click "Start Combat" on the prompt
2. **Verify** the app navigates to /characters
3. **Verify** the Combat Setup modal opens automatically
4. **Verify** the encounter NPCs (Goblax the Goblin) are pre-selected in the combatant list
5. **Verify** the modal header or subtitle references the encounter name "Goblin Ambush"

### T-D08.3: Complete Combat Setup from Encounter
1. Select additional characters if desired (e.g. Thorin)
2. Set initiative values
3. Click "Start Combat"
4. **Verify** combat begins with the pre-selected NPCs included
5. End combat

### T-D08.4: Log Only from Encounter
1. Navigate to /encounters
2. Click "Start" on "Goblin Ambush" again
3. Click "Log Only" on the combat prompt
4. **Verify** the encounter is logged but no combat setup opens
5. **Verify** the session log records an encounter_start entry

### T-D08.5: Encounter Without NPCs — No Combat Prompt
1. Find "Nighttime Wolves" (which has no NPCs)
2. Click "Start"
3. **Verify** no combat prompt appears (or only a simple log confirmation)
4. **Verify** the encounter is logged normally

---

## TS-D09: Encounter → Combat Bridge — Environment Bar

### T-D09.1: Random Encounter Modal Combat Button
1. Enable random encounters in Settings if not already enabled:
   - Navigate to /environment
   - Check "Enable random encounters"
   - Set base rate high (e.g. 0.9) and min interval to 0 hours for testing
   - Click "Save Settings"
2. Advance time repeatedly (+1h) until a random encounter triggers
3. **Verify** the encounter trigger modal appears
4. **Verify** the modal has three buttons: "Dismiss", "Start Encounter", and (if NPCs exist) "Start Combat"

### T-D09.2: Start Combat from Random Encounter
1. If the triggered encounter has NPCs, click "Start Combat"
2. **Verify** the app navigates to /characters with the Combat Setup modal open
3. **Verify** encounter NPCs are pre-selected
4. Close the modal without starting combat
5. Reset encounter settings to reasonable values

### T-D09.3: Dismiss Random Encounter
1. Advance time until another random encounter triggers
2. Click "Dismiss"
3. **Verify** the modal closes
4. **Verify** a toast appears: "Encounter dismissed"

---

## TS-D10: Dashboard — Navigation

### T-D10.1: Dashboard in Sidebar
1. **Verify** "Dashboard" appears as the first item in the sidebar navigation
2. **Verify** it has a grid-style icon

### T-D10.2: Navigate to Dashboard
1. Click "Dashboard" in the sidebar
2. **Verify** the URL is /dashboard
3. **Verify** the heading shows "Dashboard"
4. **Verify** a "Refresh" button appears in the header

### T-D10.3: Dashboard is Default Landing
1. Click the campaign name to open the campaign modal
2. Click on "Test Campaign" to re-select it
3. **Verify** the app navigates to /dashboard (not /characters)

### T-D10.4: Sidebar Active Highlight
1. **Verify** the "Dashboard" nav link has the active/highlighted style when on /dashboard
2. Click "Characters" — **verify** "Dashboard" is no longer highlighted

---

## TS-D11: Dashboard — Party Overview Card

### T-D11.1: Party Overview Shows PCs
1. Navigate to /dashboard
2. Find the "Party Overview" card
3. **Verify** the card header shows "Party Overview" with a PC count (e.g. "2 PCs" or "3 PCs")
4. **Verify** only PC characters are listed (not NPCs like Goblax or Test NPC)

### T-D11.2: PC Row Details
1. Find Thorin Ironforge's row
2. **Verify** it shows:
   - Name: "Thorin Ironforge"
   - Portrait initial "T" (or portrait image if set)
   - First 4 attribute abbreviations with values (e.g. "STR 18", "DEX 12", etc.)

### T-D11.3: Click PC Row Navigates to Detail
1. Click on Thorin's row in the Party Overview
2. **Verify** the app navigates to /characters/{thorin_id} (Thorin's detail page)
3. Navigate back to /dashboard

---

## TS-D12: Dashboard — Environment Card

### T-D12.1: Environment Snapshot
1. On the dashboard, find the "Environment" card
2. **Verify** it shows:
   - Current time (HH:MM format) with time-of-day tag
   - Current date (month name, day, year)
   - Current weather with icon
   - Current location (if party is positioned)

### T-D12.2: Environment Notes Shown
1. Navigate to Settings, set environment notes to "A chill wind blows"
2. Navigate back to /dashboard
3. **Verify** the Environment card shows the notes text

### T-D12.3: Quick Time Advance from Dashboard
1. Find the +10m and +1h buttons in the Environment card
2. Note the current time
3. Click "+10m"
4. **Verify** the time advances by 10 minutes
5. Click "+1h"
6. **Verify** the time advances by 1 hour

---

## TS-D13: Dashboard — Combat Status Card

### T-D13.1: No Active Combat
1. On the dashboard, find the "Combat" card
2. **Verify** it shows "No active combat."
3. **Verify** a "Start Combat" button is present

### T-D13.2: Start Combat from Dashboard
1. Click "Start Combat" in the Combat card
2. **Verify** the app navigates to /characters (where combat can be set up)

### T-D13.3: Active Combat Shown
1. Start a combat on the Characters page (Thorin vs Goblax, any initiative)
2. Navigate to /dashboard
3. **Verify** the Combat card shows:
   - Round number (e.g. "Round 1")
   - Current turn character name
   - Number of combatants
4. End combat

---

## TS-D14: Dashboard — Quick Roll Card

### T-D14.1: Quick Roll Interface
1. On the dashboard, find the "Quick Roll" card
2. **Verify** it shows:
   - A die selector dropdown (d4, d6, d8, d10, d12, d20, d100)
   - A modifier input field
   - A "Roll" button

### T-D14.2: Roll a d20
1. Select d20 from the die dropdown (should be default)
2. Set modifier to 0
3. Click "Roll"
4. **Verify** a result appears with:
   - A large number (the total)
   - A breakdown showing "1d20(X)" where X is the raw roll
5. **Verify** the result is between 1 and 20

### T-D14.3: Roll with Modifier
1. Set modifier to 5
2. Click "Roll"
3. **Verify** the result shows the roll breakdown: "1d20(X) + 5"
4. **Verify** the total equals X + 5

### T-D14.4: Different Die Types
1. Select d6
2. Click "Roll"
3. **Verify** the result is between 1 and 6
4. Select d100
5. Click "Roll"
6. **Verify** the result is between 1 and 100

---

## TS-D15: Dashboard — Recent Log Card

### T-D15.1: Recent Log Entries
1. On the dashboard, find the "Recent Log" card
2. **Verify** it shows recent session log entries (up to ~8)
3. **Verify** each entry shows a type tag and message text

### T-D15.2: View All Link
1. Click "View All" in the Recent Log card header
2. **Verify** the app navigates to /session-log
3. Navigate back to /dashboard

---

## TS-D16: Dashboard — Pinned Notes Card

### T-D16.1: Empty Pinned Notes
1. On the dashboard, find the "Pinned Notes" card
2. If no journal notes are starred, **verify** it shows "No starred journal notes. Star notes to pin them here."

### T-D16.2: View All Journal Link
1. Click "View All" in the Pinned Notes card header
2. **Verify** the app navigates to /journal
3. Navigate back to /dashboard

---

## TS-D17: Dashboard — Random Tables Card

### T-D17.1: Random Tables Quick Roll
1. On the dashboard, **verify** a "Random Tables" card appears (since "Wild Magic Surge" exists)
2. **Verify** it lists the table name with a "Roll" button

### T-D17.2: Roll from Dashboard
1. Click "Roll" next to "Wild Magic Surge"
2. **Verify** a result appears inline next to the table name
3. **Verify** the result is one of the defined entries

### T-D17.3: View All Link
1. Click "View All" in the Random Tables card header
2. **Verify** the app navigates to /random-tables
3. Navigate back to /dashboard

---

## TS-D18: Dashboard — Refresh

### T-D18.1: Refresh Button
1. On the dashboard, make a change elsewhere (e.g. advance time from the environment bar)
2. Click the "Refresh" button in the dashboard header
3. **Verify** all cards update with the latest data (e.g. time updates in Environment card)

---

## TS-D19: Export/Import Integration

### T-D19.1: DM Notes in Campaign Export
1. Click the campaign name to open the campaign modal
2. Export "Test Campaign"
3. Open the downloaded JSON file
4. **Verify** character objects include `dm_notes` fields with the notes we created

### T-D19.2: Random Tables in Campaign Export
1. In the same exported JSON
2. **Verify** a `random_tables` array exists containing "Wild Magic Surge" with entries

### T-D19.3: Import Campaign with DM Features
1. Import the exported campaign as a new campaign
2. Navigate to Characters, click on any character that had DM notes
3. **Verify** the DM Notes card shows the imported notes
4. Navigate to Random Tables
5. **Verify** "Wild Magic Surge" exists with all entries
6. Switch back to "Test Campaign"

---

## TS-D20: Session Log — New Entry Types

### T-D20.1: Table Roll Entry Type
1. Navigate to /session-log
2. Filter by type — **verify** "table_roll" appears in the type dropdown
3. Select "table_roll"
4. **Verify** only table roll entries are shown

### T-D20.2: Combat Entry Type
1. Filter by type — **verify** "combat" appears in the type dropdown
2. Select "combat"
3. **Verify** combat damage/heal entries are shown (from the delta popover tests)

### T-D20.3: Entry Type Colors
1. Select "All Types"
2. **Verify** "table_roll" entries have accent-colored type tags
3. **Verify** "combat" entries have red-colored type tags
4. **Verify** "encounter_start" and "encounter_end" entries have yellow-colored type tags

---

## TS-D21: Edge Cases

### T-D21.1: DM Notes with Markdown
1. Navigate to a character's detail page, click "Edit"
2. Set DM Notes to: "## Secret Info\n\n- **Important**: This is bold\n- *Italic text* here\n- A [link](https://example.com)"
3. Click "Save"
4. **Verify** the DM Notes card renders the markdown:
   - "Secret Info" as a heading
   - Bold and italic text styled appropriately
   - A clickable link

### T-D21.2: DM Notes Preserved on Character Edit (No Overwrite)
1. Navigate to Thorin's detail page
2. Note his current DM notes
3. Click "Edit"
4. Change ONLY the description text
5. Click "Save"
6. **Verify** DM notes are unchanged

### T-D21.3: Random Table with Single Entry
1. Navigate to /random-tables
2. Create a table with name "Fate Decider", type Weighted, one entry: "Doom" with weight 1
3. Roll the table
4. **Verify** the result is always "Doom"
5. Delete "Fate Decider"

### T-D21.4: Combat Delta with Non-Numeric Input
1. Start combat
2. Click an attribute value to open the delta popover
3. Type "abc" (non-numeric)
4. Press Enter
5. **Verify** no crash occurs — the value should not change or should show NaN handling
6. End combat

### T-D21.5: Dashboard with No PCs
1. Switch to "Second Campaign" (which has no characters)
2. Navigate to /dashboard
3. **Verify** the Party Overview card shows "No PCs in campaign." or similar empty state
4. **Verify** the Environment card still shows time/date/weather
5. Switch back to "Test Campaign"

### T-D21.6: Random Tables Not Shown on Dashboard When None Exist
1. Delete "Wild Magic Surge" from /random-tables
2. Navigate to /dashboard
3. **Verify** the Random Tables card does not appear (since no tables exist)
4. Re-create "Wild Magic Surge" for future tests (or skip if cleanup is happening)

---

## Final Cleanup

After all tests are complete:

1. Delete "Test NPC" character (created in T-D01.2)
2. Remove DM notes from Thorin if desired (via Edit)
3. Restore any attribute values changed during combat delta testing (via Edit)
4. Delete "Wild Magic Surge" random table (or keep for future sessions)
5. Reset encounter settings (disable or set reasonable base rate)
6. Clear environment notes if set during testing

---

## Test Data Summary

DM Features tests use and create the following data in "Test Campaign":

**Characters used:** Thorin Ironforge (PC), Elara Moonwhisper (PC), Goblax the Goblin (NPC), Test NPC (created in T-D01.2, deleted in cleanup)
**Encounters used:** Goblin Ambush (with NPCs), Nighttime Wolves (without NPCs)
**Random Tables created:** Wild Magic Surge (weighted, 4 entries), NPC Names (sequential, 4 entries — deleted in T-D07.1), Fate Decider (created and deleted in T-D21.3)
**DM Notes added to:** Test NPC, Thorin Ironforge
**Session Log new types:** table_roll, combat, encounter_start, encounter_end
**Locations used:** Town of Millhaven, Dark Forest (with path between them)
