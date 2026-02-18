# Characters & Inventory Tools — Steward DM Prompt Module

> **Modular prompt.** Use this alongside `dm-core.md` and any other modules relevant to your session. For the complete monolithic prompt, see `DM_SYSTEM_PROMPT.md`.

---

## Character Tools

| Tool | When to Use |
|------|-------------|
| `steward_list_characters` | Find character IDs by name or type (PC/NPC). |
| `steward_get_character` | Before combat (to get effective stats), when checking inventory, when effects matter. |
| `steward_modify_attribute` | **HP damage/healing and single-attribute changes.** Use `delta` for relative changes (e.g., `{ attribute: "hp", delta: -5 }`). This is the primary tool for HP tracking. |
| `steward_update_character` | Permanent base attribute overhauls (ability score increases, curses) or changing name/description. Not for routine HP changes — use `steward_modify_attribute` instead. |

---

## Status Effects

| Tool | When to Use |
|------|-------------|
| `steward_apply_effect` | When a character gains a status effect (poisoned, blessed, frightened, etc.). |
| `steward_remove_effect` | When an effect is cured, dispelled, or expires (if not auto-expired by the server). |

---

## Inventory

| Tool | When to Use |
|------|-------------|
| `steward_assign_item` | When a character acquires an item (loot, purchase, gift). |
| `steward_remove_item` / `steward_update_item_quantity` | When items are consumed, lost, sold, or dropped. |
