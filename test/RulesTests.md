# Rules Engine — UI Tests

**App URL:** http://localhost:3000
**Approach:** These tests build on data from the main `UITests.md` suite. They assume "Test Campaign" exists with characters (Thorin Ironforge PC, Elara Moonwhisper PC, Goblax the Goblin NPC), status effects (Blessed, Poisoned, Haste), and items (Sword of Strength, Healing Potion). Tests are sequential — later tests depend on data created by earlier ones.

---

## Prerequisites

Before running these tests:
1. The app is running at http://localhost:3000
2. "Test Campaign" is active with the data described above
3. Create additional data if missing:
   - Status effect "Exhausted" — tags: `debuff`, duration: Indefinite, modifier: Strength -2
   - Item "Torch" — type: misc, stackable: checked, no modifiers
   - Item "Rations" — type: consumable, stackable: checked, no modifiers
   - Give Thorin 5x Torch and 3x Rations via the character detail page
   - A location "Town of Millhaven" exists with the party positioned there
   - A location "Swamp of Sorrows" exists with properties: `dangerous: true` (add via the location detail panel Properties field as `dangerous: true`)

---

## TS-R01: Rules Page — Navigation and Empty State

### T-R01.1: Navigate to Rules Page
1. Click "Rules Engine" in the sidebar (between Encounters and Locations)
2. **Verify** the URL is /rules
3. **Verify** the heading shows "Rules Engine"
4. **Verify** three buttons appear in the header: "Templates", "Import", and "+ New Rule"

### T-R01.2: Empty State
1. **Verify** the page shows "No rules defined yet. Create rules to automate game-world changes."
2. **Verify** the search bar and trigger filter dropdown are visible above the empty state

### T-R01.3: Sidebar Active Highlight
1. **Verify** the "Rules Engine" nav link has the active/highlighted style
2. Click "Characters" — **verify** "Rules Engine" is no longer highlighted
3. Click "Rules Engine" to return

---

## TS-R02: Rule Templates

### T-R02.1: Open Template Browser
1. Click "Templates"
2. **Verify** a modal appears titled "Rule Templates"
3. **Verify** category filter buttons appear: All, Survival, Environmental, Effect Lifecycle, Location & Travel, Combat, Rest & Recovery, Economy & Time
4. **Verify** the "All" button is active by default
5. **Verify** 10 template cards are listed

### T-R02.2: Filter Templates by Category
1. Click "Survival"
2. **Verify** only 2 templates appear: "Torch Burnout" and "Starvation Warning"
3. Click "Environmental"
4. **Verify** 2 templates appear: "Storm Exposure" and "Fog Navigation Hazard"
5. Click "All"
6. **Verify** all 10 templates reappear

### T-R02.3: Template Card Details
1. Find the "Torch Burnout" template
2. **Verify** it shows:
   - Name: "Torch Burnout"
   - Category tag: "Survival"
   - Action mode tag: green "Auto"
   - Description: "Consumes a torch every hour and notifies when supply is low."
   - Footer showing: Trigger, Target, and Actions info
   - An "Import" button

### T-R02.4: Import a Template
1. Click "Import" on "Torch Burnout"
2. **Verify** a success toast appears: "Template imported as new rule"
3. Close the template browser modal (click X or click outside)
4. **Verify** "Torch Burnout" now appears as a rule card on the Rules page

### T-R02.5: Import a Second Template
1. Click "Templates" again
2. Click "Import" on "Fog Navigation Hazard"
3. **Verify** a success toast appears
4. Close the browser
5. **Verify** both "Torch Burnout" and "Fog Navigation Hazard" appear in the rules list

### T-R02.6: Close Template Browser
1. Click "Templates"
2. Click the X button
3. **Verify** the modal closes and the rules list is still visible
4. Click "Templates" again
5. Click outside the modal (on the overlay)
6. **Verify** the modal closes

---

## TS-R03: Rule CRUD

### T-R03.1: Create a Rule via the Form — Notify Action
1. Click "+ New Rule"
2. **Verify** a modal appears titled "New Rule"
3. **Verify** the form contains: Name, Description, Trigger Type, Action Mode, Priority, Target Mode, Tags, Trigger Config (JSON), and Conditions & Actions sections
4. Fill in:
   - Name: "Storm Warning"
   - Description: "Alerts when weather is stormy"
   - Trigger Type: Time Advance
   - Action Mode: Auto-apply
   - Priority: 50
   - Target Mode: Environment
   - Tags: `weather, alert`
5. In the Conditions section (builder view), click "+ Condition"
6. Select "Weather In" from the condition type dropdown
7. In the values field, type: `Storm, Heavy Rain`
8. In the Actions section, click "+ Action"
9. Select "Notify" from the action type dropdown
10. In the message field, type: `Severe weather warning: {environment.weather}`
11. In the severity field, type: `warning`
12. Click "Create"
13. **Verify** the modal closes and "Storm Warning" appears in the rules list

### T-R03.2: Verify Rule Card Display
1. Find the "Storm Warning" card
2. **Verify** it shows:
   - Name: "Storm Warning"
   - "Time Advance" trigger tag
   - Green "Auto" action mode tag
   - Description: "Alerts when weather is stormy"
   - Priority: 50
   - Target: environment
   - Tags: "weather" and "alert" as small badges

### T-R03.3: Expand Rule Details
1. Click on the "Storm Warning" card body (not the buttons)
2. **Verify** an expanded section appears showing:
   - Conditions summary (e.g. "ALL of 1 condition")
   - Actions summary (e.g. "notify")
   - Trigger Config (raw JSON)
   - Conditions (raw JSON) showing the weather_in condition
   - Actions (raw JSON) showing the notify action
3. Click the card body again
4. **Verify** the expanded section collapses

### T-R03.4: Edit a Rule
1. Click "Edit" on "Storm Warning"
2. **Verify** the modal opens pre-populated with the rule's data:
   - Name: "Storm Warning"
   - Trigger Type: Time Advance selected
   - Action Mode: Auto-apply selected
   - Priority: 50
3. Change the description to "Alerts the DM about dangerous weather"
4. Click "Save"
5. **Verify** the modal closes and the card shows the updated description

### T-R03.5: Disable a Rule
1. Click "Disable" on "Storm Warning"
2. **Verify** the button text changes to "Enable"
3. **Verify** the rule card becomes dimmed (lower opacity)

### T-R03.6: Re-enable a Rule
1. Click "Enable" on "Storm Warning"
2. **Verify** the button text changes back to "Disable"
3. **Verify** the card returns to full opacity

### T-R03.7: Delete a Rule
1. Click "Delete" on "Fog Navigation Hazard"
2. **Verify** a confirmation dialog appears: 'Delete rule "Fog Navigation Hazard"?'
3. Click OK/confirm
4. **Verify** "Fog Navigation Hazard" is removed from the list

### T-R03.8: Create a Suggest-Mode Rule
1. Click "+ New Rule"
2. Fill in:
   - Name: "Storm Exhaustion"
   - Description: "Suggests applying Exhausted during storms"
   - Trigger Type: Time Advance
   - Action Mode: Suggest
   - Priority: 100
   - Target Mode: All PCs
   - Tags: `weather, debuff`
3. Add condition: "Weather In", values: `Storm, Heavy Rain`
4. Add condition: "Lacks Effect", effect_name: `Exhausted`
5. Add action: "Apply Effect", effect_name: `Exhausted`
6. Click "Create"
7. **Verify** the card shows "Suggest" tag (without green highlight, unlike "Auto")

---

## TS-R04: Rule Form — Builder and Raw JSON

### T-R04.1: Builder View — Condition Builder
1. Click "+ New Rule"
2. **Verify** the Conditions section shows the builder view by default
3. **Verify** it shows a "Match" dropdown (set to "ALL conditions") and a "+ Condition" button
4. **Verify** below the conditions it says "No conditions (rule always passes)"

### T-R04.2: Add Multiple Conditions
1. Click "+ Condition" — **verify** a condition row appears with a type dropdown and input fields
2. Select "Has Item", type `Torch` in the item_name field
3. Click "+ Condition" again
4. Select "Time of Day", type `Night` in the value field
5. **Verify** two condition rows are visible

### T-R04.3: Change Match Mode
1. Change the Match dropdown from "ALL conditions" to "ANY condition"
2. **Verify** the dropdown updates

### T-R04.4: Remove a Condition
1. Click the X button on the second condition (Time of Day)
2. **Verify** only the Has Item condition remains

### T-R04.5: Action Builder — Add and Reorder
1. In the Actions section, click "+ Action"
2. Select "Consume Item", set item_name: `Torch`, quantity: `1`
3. Click "+ Action" again
4. Select "Notify", set message: `{character.name} burned a torch`, severity: `info`
5. **Verify** two action rows appear, in order: Consume Item, Notify
6. **Verify** each row has up/down arrow buttons

### T-R04.6: Reorder Actions
1. Click the down arrow on the first action (Consume Item)
2. **Verify** the order changes to: Notify, Consume Item
3. Click the up arrow on the second action (Consume Item)
4. **Verify** the order returns to: Consume Item, Notify

### T-R04.7: Remove an Action
1. Click the X button on the Notify action
2. **Verify** only the Consume Item action remains

### T-R04.8: Toggle to Raw JSON
1. Click the "Raw JSON" button (next to "Conditions & Actions" heading)
2. **Verify** the builder is replaced by two textareas: "Conditions (JSON)" and "Actions (JSON)"
3. **Verify** the conditions textarea contains the JSON representation of the condition built earlier
4. **Verify** the actions textarea contains the JSON for the Consume Item action

### T-R04.9: Edit Raw JSON
1. In the Conditions JSON textarea, change the content to:
   ```json
   {"any": [{"type": "has_item", "item_name": "Torch"}, {"type": "weather_is", "value": "Clear"}]}
   ```
2. **Verify** the textarea accepts the edit

### T-R04.10: Toggle Back to Builder View
1. Click "Builder View"
2. **Verify** the builder shows the Match dropdown set to "ANY condition"
3. **Verify** two condition rows appear: Has Item (Torch) and Weather Is (Clear)
4. Click "Cancel" to close the form without saving

### T-R04.11: Trigger Config for Threshold
1. Click "+ New Rule"
2. Set Trigger Type to "Threshold Crossed"
3. In the Trigger Config (JSON) textarea, enter:
   ```json
   {"attribute": "strength", "threshold": 5, "direction": "falling"}
   ```
4. **Verify** the textarea accepts valid JSON
5. Click "Cancel"

### T-R04.12: Target Mode — Specific Characters
1. Click "+ New Rule"
2. Change Target Mode to "Specific Characters"
3. **Verify** a "Target Config (JSON)" textarea appears
4. Enter: `{"character_ids": [1, 2]}`
5. **Verify** the textarea is visible and accepts input
6. Change Target Mode back to "All PCs"
7. **Verify** the Target Config textarea disappears
8. Click "Cancel"

### T-R04.13: Template Variable Hints
1. Click "+ New Rule"
2. Scroll to the Actions section
3. **Verify** a hint line is visible showing available variables: `{character.name}`, `{character.<attr>}`, `{environment.weather}`, `{var.<name>}`
4. Click "Cancel"

**Edge case — T-R04.14: Invalid JSON in Form**
1. Click "+ New Rule", fill in name "Test Invalid JSON"
2. Click "Raw JSON"
3. In the Conditions textarea, type `not valid json`
4. Click "Create"
5. **Verify** an alert appears: "Invalid JSON in one of the fields"
6. **Verify** the modal remains open (not submitted)
7. Click "Cancel"

---

## TS-R05: Rule Search and Filtering

### T-R05.1: Search by Name
1. Type "Storm" in the search input
2. **Verify** only "Storm Warning" and "Storm Exhaustion" appear (not "Torch Burnout")
3. Clear the search
4. **Verify** all rules reappear

### T-R05.2: Search by Description
1. Type "torch" in the search input
2. **Verify** "Torch Burnout" appears (its description mentions torches)
3. Clear the search

### T-R05.3: Filter by Trigger Type
1. Select "Time Advance" from the trigger dropdown
2. **Verify** only rules with trigger_type "on_time_advance" are shown (Torch Burnout, Storm Warning, Storm Exhaustion)
3. Select "All triggers"
4. **Verify** all rules reappear

### T-R05.4: Combined Search and Filter
1. Select "Time Advance" from the trigger dropdown
2. Type "Storm" in the search
3. **Verify** only Storm Warning and Storm Exhaustion appear (Time Advance trigger + "Storm" in name)
4. Clear search and reset filter to "All triggers"

---

## TS-R06: Rule Testing

### T-R06.1: Open Test Panel
1. Click "Test" on the "Torch Burnout" rule
2. **Verify** a modal appears titled "Test Rule: Torch Burnout"
3. **Verify** it contains:
   - A "Test Character" dropdown with "Auto-select" and all campaign characters listed
   - A "Run Test" button

### T-R06.2: Run Test — Pass
1. Select "Thorin Ironforge" from the character dropdown (Thorin should have 5 Torches from prerequisites)
2. Click "Run Test"
3. **Verify** the result shows:
   - Green box: "PASS — Rule would fire"
   - "Tested with: Thorin Ironforge"
   - Environment snapshot showing current weather, time of day, and hour
4. **Verify** a Condition Breakdown section appears with a green checkmark next to the `has_item` condition, showing "Torch" is found
5. **Verify** an "Actions That Would Fire" section lists: `consume_item` and `notify`

### T-R06.3: Run Test — Fail
1. Select "Elara Moonwhisper" (who should NOT have Torches)
2. Click "Run Test"
3. **Verify** the result shows:
   - Red box: "FAIL — Rule would not fire"
   - Condition Breakdown shows a red X next to the `has_item` condition

### T-R06.4: Test Environment-Only Rule
1. Close the test panel
2. Click "Test" on "Storm Warning"
3. **Verify** the character dropdown shows "Auto-select" (environment-targeted rules don't need a character)
4. Click "Run Test"
5. **Verify** the result shows PASS or FAIL depending on current weather
6. **Verify** the environment snapshot shows current weather/time
7. If weather is not Storm/Heavy Rain, **verify** the `weather_in` condition shows a red X with the actual weather value

### T-R06.5: Close Test Panel
1. Click the X button on the test modal
2. **Verify** the modal closes and the rules list is visible

---

## TS-R07: Rules Firing on Time Advance

### T-R07.1: Prepare — Set Weather to Storm
1. Navigate to Settings (/environment)
2. Change weather to "Storm"
3. Click "Save Settings"
4. **Verify** the environment bar shows "Storm"

### T-R07.2: Auto-Apply Rule Fires on Time Advance
1. Click "+1h" in the environment bar
2. **Verify** a toast appears with the Storm Warning notification message (something like "Severe weather warning: Storm")
3. **Verify** the bell icon shows a notification badge (count >= 1)

### T-R07.3: Torch Burnout Rule Fires
1. **Verify** a toast also appears for Torch Burnout (Thorin has torches)
2. Navigate to Thorin's character detail page
3. **Verify** his Torch count decreased by 1 (from 5 to 4, or less if time was advanced before)

### T-R07.4: Suggest Rule Creates Suggestion (Not Auto-Applied)
1. Navigate back to any page
2. **Verify** a toast appears for "Storm Exhaustion" (suggest mode)
3. **Verify** Thorin does NOT yet have the "Exhausted" effect (suggestion is pending, not applied)

### T-R07.5: Review Notifications in Drawer
1. Click the bell icon in the environment bar
2. **Verify** the notification drawer slides in from the right
3. **Verify** it contains notifications including:
   - An "auto_applied" notification for Storm Warning with an "Undo" button
   - An "auto_applied" notification for Torch Burnout with an "Undo" button
   - A "suggestion" notification for Storm Exhaustion with "Apply" and "Dismiss" buttons
4. **Verify** each notification shows the rule name, message, and timestamp

### T-R07.6: Reset Weather
1. Close the notification drawer
2. Navigate to Settings, change weather back to "Clear"
3. Click "Save Settings"

---

## TS-R08: Notification Drawer

### T-R08.1: Filter Notifications by Severity
1. Click the bell icon to open the drawer
2. Click "Warning" filter button
3. **Verify** only warning-severity notifications are shown
4. Click "Info" filter button
5. **Verify** only info-severity notifications are shown
6. Click "All"
7. **Verify** all notifications reappear

### T-R08.2: Pin the Drawer
1. Click the pin icon button in the drawer header
2. **Verify** the pin button shows an active/highlighted state
3. Click outside the drawer (on the overlay area)
4. **Verify** the drawer stays open (because it is pinned)
5. Click the pin icon again to unpin
6. Click outside the drawer
7. **Verify** the drawer closes

### T-R08.3: Apply a Suggestion
1. Click the bell icon to open the drawer
2. Find the "Storm Exhaustion" suggestion notification (if present from T-R07.4)
3. Click "Apply"
4. **Verify** a success toast appears (e.g. "Applied: ...")
5. Navigate to Thorin's character detail page
6. **Verify** "Exhausted" now appears in his Applied Effects list
7. **Verify** his Strength effective value reflects the -2 modifier from Exhausted

### T-R08.4: Undo an Auto-Applied Action
1. First, ensure Thorin has the "Exhausted" effect (from T-R08.3)
2. Navigate to Settings, change weather to "Storm", save
3. Advance time +1h — this should fire "Storm Warning" again (auto-applied)
4. Click the bell icon, find the newest "Storm Warning" auto-applied notification
5. Click "Undo"
6. **Verify** a toast appears: "Undid 1 action(s)" (or similar)
7. Reset weather to "Clear" and save

### T-R08.5: Dismiss a Suggestion
1. Change weather to "Storm", save settings
2. Remove the "Exhausted" effect from Thorin if still applied (via character detail page)
3. Advance time +1h — should generate a new "Storm Exhaustion" suggestion
4. Open the notification drawer
5. Find the suggestion and click "Dismiss"
6. **Verify** the notification disappears from the list
7. **Verify** Thorin does NOT have the "Exhausted" effect (action was dismissed, not applied)
8. Reset weather to "Clear" and save

### T-R08.6: Clear All Notifications
1. Click the bell icon
2. Click "Clear" in the drawer header
3. **Verify** all notifications are removed
4. **Verify** the drawer shows "No notifications"
5. Close the drawer
6. **Verify** the bell icon badge disappears (count is 0)

### T-R08.7: Close Drawer via X Button
1. Click the bell icon to open
2. Click the X button in the drawer header
3. **Verify** the drawer closes

---

## TS-R09: Resting

### T-R09.1: Short Rest
1. Note the current time in the environment bar
2. Click the "Short Rest" button in the environment bar
3. **Verify** time advances by 1 hour
4. **Verify** a toast appears: "Short rest (1h)"
5. **Verify** the session log (navigate to /session-log) has a "rest" entry: "Short rest taken (1 hours)"

### T-R09.2: Long Rest
1. Note the current time
2. Click "Long Rest"
3. **Verify** time advances by 8 hours
4. **Verify** a toast appears: "Long rest (8h)"
5. **Verify** the session log has a "rest" entry: "Long rest taken (8 hours)"

### T-R09.3: Rest Fires on_rest Rules
1. Navigate to Rules, create a new rule:
   - Name: "Rest Recovery Test"
   - Trigger Type: Rest
   - Action Mode: Auto-apply
   - Target Mode: Environment
   - No conditions
   - Action: Notify, message: `Party rested`, severity: `info`
2. Click "Short Rest" in the environment bar
3. **Verify** a toast appears with "Party rested" (from the rule's notify action)
4. **Verify** a notification appears in the drawer

### T-R09.4: Hours Since Last Rest Condition
1. Create a new rule:
   - Name: "Rest Reminder"
   - Trigger Type: Time Advance
   - Action Mode: Auto-apply
   - Target Mode: All PCs
   - Condition: "Hours Since Rest", operator: `gte`, hours: `2`
   - Action: Notify, message: `{character.name} could use a rest`, severity: `info`
2. Click "Long Rest" (resets the timer)
3. Click "+1h" twice (2 hours since rest)
4. **Verify** a toast appears with rest reminders for each PC
5. Delete "Rest Reminder" and "Rest Recovery Test" rules to keep the list clean

---

## TS-R10: Effect Duration Expiry

### T-R10.1: Apply Timed Effect
1. Navigate to Thorin's character detail page
2. Click "+ Add Effect" and apply "Haste" (which has duration 2 hours)
3. **Verify** "Haste" appears with remaining time displayed

### T-R10.2: Advance Time Past Duration
1. Click "+1h" in the environment bar
2. **Verify** "Haste" is still applied (1 hour remaining)
3. Click "+1h" again
4. **Verify** a toast appears: "Effect expired: Haste on Thorin Ironforge"
5. Navigate to Thorin's detail page
6. **Verify** "Haste" is no longer in his Applied Effects list
7. **Verify** Dexterity returns to its base value

### T-R10.3: Expiry Logged to Session Log
1. Navigate to /session-log
2. **Verify** there is an "effect_expired" entry: '"Haste" expired on "Thorin Ironforge"'

---

## TS-R11: Effect Change Trigger

### T-R11.1: Create on_effect_change Rule
1. Navigate to Rules, click "+ New Rule"
2. Fill in:
   - Name: "Poison Cascade"
   - Trigger Type: Effect Change
   - Action Mode: Auto-apply
   - Target Mode: All Characters
   - Condition 1: Has Effect, effect_name: `Poisoned`
   - Condition 2: Lacks Effect, effect_name: `Exhausted`
   - Action: Apply Effect, effect_name: `Exhausted`
3. Click "Create"

### T-R11.2: Trigger by Applying an Effect
1. Navigate to Thorin's detail page
2. Remove "Exhausted" if present
3. Click "+ Add Effect" and apply "Poisoned"
4. **Verify** a toast appears indicating the "Poison Cascade" rule fired
5. **Verify** "Exhausted" has been auto-applied to Thorin (from the rule)
6. **Verify** both "Poisoned" and "Exhausted" appear in Applied Effects

### T-R11.3: Rule Does Not Double-Fire
1. Remove "Poisoned" from Thorin
2. Remove "Exhausted" from Thorin
3. Apply "Poisoned" again
4. **Verify** "Exhausted" is auto-applied (rule fires)
5. Apply "Poisoned" a second time (if stacking is allowed)
6. **Verify** the rule does NOT apply a second "Exhausted" (the `lacks_effect` condition fails)

### T-R11.4: Cleanup
1. Remove "Poisoned" and "Exhausted" from Thorin
2. Delete the "Poison Cascade" rule

---

## TS-R12: Item Change Trigger

### T-R12.1: Create on_item_change Rule
1. Click "+ New Rule"
2. Fill in:
   - Name: "Torch Pickup Notice"
   - Trigger Type: Item Change
   - Action Mode: Auto-apply
   - Target Mode: All PCs
   - Condition: Has Item, item_name: `Torch`
   - Action: Notify, message: `{character.name} is carrying torches`, severity: `info`
3. Click "Create"

### T-R12.2: Trigger by Assigning an Item
1. Navigate to Elara's detail page
2. Click "+ Add Item" and add "Torch"
3. **Verify** a toast appears with the notification about Elara carrying torches
4. Remove the Torch from Elara

### T-R12.3: Cleanup
1. Delete the "Torch Pickup Notice" rule

---

## TS-R13: Location Change Trigger

### T-R13.1: Create on_location_change Rule
1. Click "+ New Rule"
2. Fill in:
   - Name: "Danger Alert"
   - Trigger Type: Location Change
   - Action Mode: Auto-apply
   - Target Mode: Environment
   - Condition: Location Property, property: `dangerous`, value: `true`
   - Action: Notify, message: `Danger! This area is known to be hazardous.`, severity: `warning`
3. Click "Create"

### T-R13.2: Trigger by Changing Location
1. Navigate to Locations (/locations)
2. Ensure "Swamp of Sorrows" exists with `dangerous: true` in properties
3. Click on "Swamp of Sorrows" node and click "Set Party Here"
4. **Verify** a toast appears with the danger warning from the rule
5. **Verify** a notification appears in the drawer
6. Move the party back to "Town of Millhaven"

### T-R13.3: Rule Does Not Fire for Non-Matching Location
1. Move the party to "Town of Millhaven" (no dangerous property)
2. **Verify** no danger alert toast appears

### T-R13.4: Cleanup
1. Delete the "Danger Alert" rule

---

## TS-R14: Threshold Trigger

### T-R14.1: Create on_threshold Rule
1. Click "+ New Rule"
2. Fill in:
   - Name: "Low Strength Alert"
   - Trigger Type: Threshold Crossed
   - Action Mode: Auto-apply
   - Target Mode: All PCs
   - Trigger Config: `{"attribute": "strength", "threshold": 10, "direction": "falling"}`
   - No conditions (always passes when threshold is crossed)
   - Action: Notify, message: `{character.name} is dangerously weak!`, severity: `error`
3. Click "Create"

### T-R14.2: Trigger by Crossing Threshold
1. Navigate to Thorin's detail page (Strength base: 18)
2. Thorin needs a status effect that reduces Strength below 10
3. Create a new status effect "Weakened" with modifier: Strength -10
4. Apply "Weakened" to Thorin
5. **Verify** Thorin's effective Strength drops below 10 (18 - 10 = 8)
6. **Verify** a toast appears with the low strength alert

### T-R14.3: Threshold Does Not Re-Fire Above Threshold
1. Remove "Weakened" from Thorin (Strength returns to 18)
2. **Verify** NO alert fires (the threshold is `falling`, and Strength rose, not fell)

### T-R14.4: Cleanup
1. Delete the "Low Strength Alert" rule
2. Delete the "Weakened" status effect if desired

---

## TS-R15: Scheduled Trigger

### T-R15.1: Create on_schedule Rule
1. Note the current game day and month from the environment bar (e.g. month 3, day 15)
2. Click "+ New Rule"
3. Fill in:
   - Name: "Festival Announcement"
   - Trigger Type: Scheduled
   - Action Mode: Auto-apply
   - Target Mode: Environment
   - Trigger Config: set to a datetime just ahead of current time, e.g. if current is month 3, day 15, hour 10, set: `{"datetime": {"month": 3, "day": 15, "hour": 14, "minute": 0}}`
   - No conditions
   - Action: Notify, message: `The festival begins!`, severity: `info`
4. Click "Create"

### T-R15.2: Advance Time Past the Scheduled Point
1. Navigate to Settings, set the time to just before the scheduled time (e.g. hour 13, minute 50 for a 14:00 schedule)
2. Save settings
3. Advance time by +1h
4. **Verify** a toast appears with "The festival begins!"
5. **Verify** a notification appears in the drawer

### T-R15.3: Schedule Does Not Re-Fire
1. Advance time another +1h
2. **Verify** the festival notification does NOT fire again (it only fires when time passes through the scheduled moment)

### T-R15.4: Cleanup
1. Delete the "Festival Announcement" rule

---

## TS-R16: Encounter Trigger

### T-R16.1: Create on_encounter Rule
1. Click "+ New Rule"
2. Fill in:
   - Name: "Combat Buff Reminder"
   - Trigger Type: Encounter
   - Action Mode: Auto-apply
   - Target Mode: Environment
   - No conditions
   - Action: Notify, message: `Remember to roll initiative!`, severity: `info`
3. Click "Create"

### T-R16.2: Trigger by Starting Encounter
1. Navigate to Encounters
2. Click "Start" on "Goblin Ambush"
3. **Verify** a toast appears with "Remember to roll initiative!"

### T-R16.3: Cleanup
1. Delete the "Combat Buff Reminder" rule

---

## TS-R17: Actions — Game State Modifications

### T-R17.1: Apply Effect Action
1. Create a rule:
   - Name: "Auto Bless"
   - Trigger: Time Advance, Auto-apply, Target: All PCs
   - No conditions
   - Action: Apply Effect, effect_name: `Blessed`
2. Remove "Blessed" from Thorin and Elara if present
3. Advance time +10m
4. **Verify** "Blessed" is applied to both Thorin and Elara
5. **Verify** their Strength effective values increased

### T-R17.2: Remove Effect Action
1. Edit "Auto Bless": change the action to "Remove Effect", effect_name: `Blessed`
2. Advance time +10m
3. **Verify** "Blessed" is removed from both characters
4. Delete the "Auto Bless" rule

### T-R17.3: Modify Attribute Action
1. Create a rule:
   - Name: "Drain Stamina" (or any attribute your campaign uses)
   - Trigger: Time Advance, Auto-apply, Target: All PCs
   - No conditions
   - Action: Modify Attribute, attribute: `strength`, delta: `-1`
2. Note Thorin's base Strength
3. Advance time +10m
4. Navigate to Thorin's detail page
5. **Verify** his base Strength decreased by 1
6. Delete the "Drain Stamina" rule
7. Restore Thorin's Strength via Settings or by creating a reverse rule

### T-R17.4: Consume Item Action
1. Ensure Thorin has Torches (check from prerequisites)
2. Note current Torch count
3. The "Torch Burnout" template rule should still exist — advance time +1h
4. **Verify** Thorin's Torch count decreased by 1

### T-R17.5: Set Weather Action
1. Create a rule:
   - Name: "Force Clear"
   - Trigger: Time Advance, Auto-apply, Target: Environment
   - No conditions
   - Action: Set Weather, weather: `Clear`
2. Navigate to Settings, change weather to "Storm", save
3. Advance time +10m
4. **Verify** the environment bar weather changes to "Clear" (rule overrode it)
5. Delete the "Force Clear" rule

### T-R17.6: Roll Dice Action with Template Variable
1. Create a rule:
   - Name: "Luck Roll"
   - Trigger: Time Advance, Auto-apply, Target: Environment
   - No conditions
   - Actions (use Raw JSON):
     ```json
     [
       {"type": "roll_dice", "formula": "1d20", "store_as": "luck"},
       {"type": "notify", "message": "Luck roll: {var.luck}", "severity": "info"}
     ]
     ```
2. Advance time +10m
3. **Verify** a toast appears with "Luck roll: " followed by a number between 1-20
4. Delete the "Luck Roll" rule

### T-R17.7: Log Action
1. Create a rule:
   - Name: "Silent Logger"
   - Trigger: Time Advance, Auto-apply, Target: Environment
   - No conditions
   - Action: Log Message, message: `Time passed silently.`
2. Advance time +10m
3. **Verify** no toast appears for this action (log is silent)
4. Navigate to Session Log
5. **Verify** an entry with "Time passed silently." appears
6. Delete the "Silent Logger" rule

---

## TS-R18: Undo System

### T-R18.1: Undo Apply Effect
1. Create a rule: Trigger: Time Advance, Auto, Target: All PCs, Action: Apply Effect "Blessed"
2. Remove "Blessed" from all characters
3. Advance time +10m
4. **Verify** "Blessed" is applied to PCs
5. Open notification drawer, find the auto-applied notification, click "Undo"
6. **Verify** toast: "Undid N action(s)"
7. Navigate to Thorin's detail page
8. **Verify** "Blessed" is no longer applied (undo removed it)
9. Delete the rule

### T-R18.2: Undo Modify Attribute
1. Note Thorin's base Strength
2. Create a rule: Trigger: Time Advance, Auto, Target: All PCs, Action: Modify Attribute, attribute: `strength`, delta: `-3`
3. Advance time +10m
4. **Verify** Thorin's base Strength decreased by 3
5. Open drawer, click "Undo" on the notification
6. **Verify** Thorin's base Strength is restored to its previous value
7. Delete the rule

### T-R18.3: Undo Set Weather
1. Navigate to Settings, set weather to "Clear", save
2. Create a rule: Trigger: Time Advance, Auto, Target: Environment, Action: Set Weather `Storm`
3. Advance time +10m
4. **Verify** weather changed to "Storm"
5. Open drawer, click "Undo"
6. **Verify** weather reverts to "Clear"
7. Delete the rule

---

## TS-R19: Rules Engine Settings

### T-R19.1: View Settings Card
1. Navigate to Settings (/environment)
2. Scroll to the "Rules Engine" card
3. **Verify** it shows:
   - A description: "The rules engine evaluates conditions and auto-applies or suggests game-world changes."
   - A checkbox: "Enable rules engine" (checked by default)
   - A "Cascade depth limit" label with a slider (default 3)

### T-R19.2: Disable Rules Engine
1. Uncheck "Enable rules engine"
2. **Verify** the cascade depth slider disappears
3. Click "Save Settings"
4. Navigate to Rules, create a simple rule:
   - Name: "Disabled Test"
   - Trigger: Time Advance, Auto, Target: Environment
   - No conditions
   - Action: Notify, message: `This should not fire`
5. Advance time +10m
6. **Verify** NO notification toast appears (engine is disabled)

### T-R19.3: Re-enable Rules Engine
1. Navigate to Settings
2. Check "Enable rules engine"
3. **Verify** the cascade depth slider reappears
4. Click "Save Settings"
5. Advance time +10m
6. **Verify** the "Disabled Test" rule NOW fires (toast appears)
7. Delete "Disabled Test" rule

### T-R19.4: Adjust Cascade Depth Limit
1. Navigate to Settings
2. Drag the cascade depth slider to 5
3. **Verify** the label updates: "Cascade depth limit: 5"
4. **Verify** the helper text updates: "After 5 cascading rule fires, auto actions become suggestions."
5. Click "Save Settings"
6. Reload the page
7. **Verify** the slider still shows 5
8. Reset to 3, save

---

## TS-R20: Import and Export Rules

### T-R20.1: Rules Included in Campaign Export
1. Ensure at least one rule exists (Torch Burnout, Storm Warning, etc.)
2. Click the campaign name to open the campaign modal
3. Click the export button on "Test Campaign"
4. Open the downloaded JSON file in a text editor
5. **Verify** the JSON contains a `"rules"` array with the campaign's rules

### T-R20.2: Import Rules via Rules Page
1. Navigate to Rules
2. Click "Import"
3. **Verify** the Import Preview modal opens with entity type locked to "Rules"
4. Select a previously exported campaign JSON file
5. **Verify** the preview shows the rules from the file
6. Close the modal (testing that the locked entity type works is sufficient)

### T-R20.3: Rules Survive Campaign Import
1. Export "Test Campaign"
2. Create a new campaign "Rules Import Test"
3. Open the campaign modal, click "Merge into Current Campaign"
4. Upload the exported JSON, select "Rules" as an entity type
5. Complete the import
6. Navigate to Rules
7. **Verify** the imported rules appear
8. Switch back to "Test Campaign"

---

## TS-R21: Condition Types — Detailed Verification

Use the Test panel to verify each condition type evaluates correctly against current game state.

### T-R21.1: Attribute Conditions
1. Create a rule (don't save, just use for testing):
   - Target: All PCs
   - Condition: `attribute_gte`, attribute: `strength`, value: `15`
2. Click "Create", then "Test" on the rule, select Thorin (STR 18)
3. **Verify** condition passes (18 >= 15)
4. Edit the rule: change condition to `attribute_lte`, value: `15`
5. Test with Thorin — **verify** condition fails (18 is not <= 15)
6. Test with Elara (STR 10) — **verify** condition passes (10 <= 15)
7. Delete the rule

### T-R21.2: Has/Lacks Effect Conditions
1. Apply "Blessed" to Thorin
2. Create and test a rule with condition `has_effect` "Blessed" targeting Thorin — **verify** passes
3. Change condition to `lacks_effect` "Blessed" — **verify** fails
4. Test with Elara (no Blessed) — `lacks_effect` should pass
5. Delete the rule, remove Blessed from Thorin

### T-R21.3: Has/Lacks Item Conditions
1. Thorin should have Torches
2. Create and test a rule with `has_item` "Torch" targeting Thorin — **verify** passes
3. Test with Elara (no Torch) — **verify** fails
4. Change to `lacks_item` "Torch", test Elara — **verify** passes
5. Delete the rule

### T-R21.4: Weather Conditions
1. Set weather to "Rain" via Settings, save
2. Create and test an environment rule with `weather_is`, value: `Rain` — **verify** passes
3. Change to `weather_is`, value: `Clear` — **verify** fails
4. Change to `weather_in`, values: `Rain, Storm` — **verify** passes
5. Delete the rule, reset weather to "Clear"

### T-R21.5: Time of Day Condition
1. Set time to 14:00 via Settings (should be "Afternoon")
2. Create and test an environment rule with `time_of_day_is`, value: `Afternoon` — **verify** passes
3. Change value to `Morning` — **verify** fails
4. Delete the rule

### T-R21.6: Season Condition
1. Set month to 7 via Settings (should be summer)
2. Create and test a rule with `season_is`, value: `summer` — **verify** passes
3. Change to `season_is`, value: `winter` — **verify** fails
4. Delete the rule

### T-R21.7: Random Chance Condition
1. Create and test a rule with `random_chance`, probability: `1.0`
2. **Verify** it always passes
3. Change probability to `0.0`
4. **Verify** it always fails
5. Delete the rule

### T-R21.8: Location Condition
1. Ensure party is at "Town of Millhaven"
2. Note the location ID from the Locations page (click the node, check the URL or data)
3. Create and test a rule with `location_is`, location_id: (the ID)
4. **Verify** passes
5. Delete the rule

---

## TS-R22: Multiple Conditions — Logic

### T-R22.1: ALL Conditions (AND)
1. Create a rule with two conditions (match: ALL):
   - `has_item` "Torch"
   - `weather_is` "Clear"
2. Set weather to "Clear", Thorin has Torches
3. Test with Thorin — **verify** both conditions pass, overall PASS
4. Set weather to "Rain", save settings
5. Test with Thorin — **verify** has_item passes, weather_is fails, overall FAIL
6. Delete the rule, reset weather

### T-R22.2: ANY Conditions (OR)
1. Create a rule (use Raw JSON for conditions):
   ```json
   {"any": [{"type": "weather_is", "value": "Storm"}, {"type": "weather_is", "value": "Clear"}]}
   ```
2. Set weather to "Clear"
3. Test — **verify** overall PASS (second condition matches)
4. Set weather to "Rain"
5. Test — **verify** overall FAIL (neither matches)
6. Delete the rule, reset weather

### T-R22.3: NOT Condition (via Raw JSON)
1. Create a rule (Raw JSON conditions):
   ```json
   {"not": {"type": "weather_is", "value": "Storm"}}
   ```
2. Set weather to "Clear"
3. Test — **verify** PASS (NOT Storm = true)
4. Set weather to "Storm"
5. Test — **verify** FAIL (NOT Storm = false)
6. Delete the rule, reset weather to "Clear"

---

## TS-R23: Cascade Behavior

### T-R23.1: Cascading Rules
1. Create two rules:
   - Rule A "Cascade Source": Trigger: Time Advance, Auto, Target: All PCs, No conditions, Action: Apply Effect "Poisoned"
   - Rule B "Cascade Follow": Trigger: Effect Change, Auto, Target: All Characters, Condition: Has Effect "Poisoned" AND Lacks Effect "Exhausted", Action: Apply Effect "Exhausted"
2. Remove Poisoned and Exhausted from all characters
3. Advance time +10m
4. **Verify** Rule A fires (Poisoned applied)
5. **Verify** Rule B cascades (Poisoned triggers effect change, which fires Rule B, applying Exhausted)
6. **Verify** Thorin has both Poisoned and Exhausted
7. Clean up: remove effects, delete both rules

### T-R23.2: Cascade Depth Limit
1. Navigate to Settings, set cascade depth to 1, save
2. Re-create Rules A and B from above
3. Remove all effects from characters
4. Advance time +10m
5. **Verify** Rule A fires (auto — Poisoned applied)
6. **Verify** Rule B's action becomes a suggestion (not auto-applied) because cascade depth 1 is reached
7. **Verify** a suggestion notification appears in the drawer for Exhausted
8. Clean up: remove effects, delete rules, reset cascade depth to 3

---

## TS-R24: Session Log Integration

### T-R24.1: Rule Actions Logged
1. Create a simple auto-apply rule with a Log action
2. Advance time +10m
3. Navigate to Session Log
4. **Verify** the log entry from the rule's action appears with type "rule_log"

### T-R24.2: Effect Apply/Remove by Rules Logged
1. Create a rule that applies an effect on time advance
2. Advance time
3. Navigate to Session Log
4. **Verify** an "effect_applied" entry appears with "[Rule]" prefix in the message
5. Clean up

### T-R24.3: Rest Events Logged
1. Click "Short Rest"
2. Navigate to Session Log
3. **Verify** a "rest" entry appears: "Short rest taken (1 hours)"

---

## TS-R25: Edge Cases

### T-R25.1: Rule Referencing Non-Existent Effect
1. Create a rule: Auto, Time Advance, Target: All PCs, Action: Apply Effect "NonExistentEffect"
2. Advance time +10m
3. **Verify** no crash occurs — the action should silently fail
4. **Verify** a notification may appear indicating the effect was not found
5. Delete the rule

### T-R25.2: Rule Referencing Non-Existent Item
1. Create a rule: Auto, Time Advance, Target: All PCs, Action: Consume Item "FakeItem"
2. Advance time +10m
3. **Verify** no crash occurs
4. Delete the rule

### T-R25.3: Rule with Empty Conditions (Always Passes)
1. Create a rule with no conditions, Auto, Notify action
2. Test the rule — **verify** it shows PASS
3. Advance time — **verify** the notification fires
4. Delete the rule

### T-R25.4: Disabled Rule Does Not Fire
1. Create and then disable a rule (click "Disable")
2. Advance time
3. **Verify** the rule's action does NOT fire
4. Re-enable the rule, advance time
5. **Verify** the action fires
6. Delete the rule

### T-R25.5: Multiple Rules Same Trigger — Priority Order
1. Create Rule A: priority 10, Time Advance, Auto, Target: Environment, Action: Notify "First"
2. Create Rule B: priority 200, Time Advance, Auto, Target: Environment, Action: Notify "Second"
3. Advance time +10m
4. **Verify** both toasts appear
5. Open the notification drawer — **verify** "First" (priority 10) appears before "Second" (priority 200) in the notification list
6. Delete both rules

### T-R25.6: Effect Stacking Prevention
1. Apply "Blessed" to Thorin manually
2. Create a rule: Auto, Time Advance, Target: All PCs, Action: Apply Effect "Blessed"
3. Advance time +10m
4. **Verify** a second "Blessed" is NOT applied (the action executor prevents stacking by default)
5. Open the notification drawer — the notification should mention "already applied"
6. Remove Blessed from Thorin, delete the rule

---

## Final Cleanup

After all tests are complete:

1. Delete all test rules created during testing (Storm Warning, Storm Exhaustion, Torch Burnout, and any others)
2. Remove any test effects from characters (Poisoned, Exhausted, etc.)
3. Clear notifications via the drawer
4. Optionally clear the session log

---

## Test Data Summary

Rules tests use and create the following data in "Test Campaign":

**Status Effects used:** Blessed, Poisoned, Haste, Exhausted (created in prerequisites), Weakened (created in T-R14.2)
**Items used:** Torch (5x on Thorin), Rations (3x on Thorin), Sword of Strength, Healing Potion
**Locations used:** Town of Millhaven, Swamp of Sorrows (with `dangerous: true`)
**Rules created during tests:** Various (all should be deleted during cleanup)
**Templates imported:** Torch Burnout, Fog Navigation Hazard (Fog deleted in T-R03.7)
