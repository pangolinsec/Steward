// Single source of truth for all entity type definitions.
// Drives export, import, conflict detection, and validation generically.

const ENTITY_CONFIG = {
  status_effects: {
    table: 'status_effect_definitions',
    exportKey: 'status_effects',
    displayName: 'Status Effects',
    nameField: 'name',
    columns: [
      { name: 'name',           type: 'text',    default: '' },
      { name: 'description',    type: 'text',    default: '' },
      { name: 'tags',           type: 'json',    default: [] },
      { name: 'modifiers',      type: 'json',    default: [] },
      { name: 'duration_type',  type: 'text',    default: 'indefinite' },
      { name: 'duration_value', type: 'integer', default: 0 },
    ],
    modifierColumns: ['modifiers'],
    idMapKey: 'effectIdMap',
    relations: [],
  },
  items: {
    table: 'item_definitions',
    exportKey: 'items',
    displayName: 'Items',
    nameField: 'name',
    columns: [
      { name: 'name',        type: 'text',     default: '' },
      { name: 'description', type: 'text',     default: '' },
      { name: 'item_type',   type: 'text',     default: 'misc' },
      { name: 'properties',  type: 'json',     default: {} },
      { name: 'stackable',   type: 'bool_int', default: false },
      { name: 'modifiers',   type: 'json',     default: [] },
    ],
    modifierColumns: ['modifiers'],
    idMapKey: 'itemIdMap',
    relations: [],
  },
  characters: {
    table: 'characters',
    exportKey: 'characters',
    displayName: 'Characters',
    nameField: 'name',
    columns: [
      { name: 'name',            type: 'text', default: '' },
      { name: 'type',            type: 'text', default: 'NPC' },
      { name: 'description',     type: 'text', default: '' },
      { name: 'portrait_url',    type: 'text', default: '' },
      { name: 'base_attributes', type: 'json', default: {} },
    ],
    modifierColumns: [],
    idMapKey: 'charIdMap',
    relations: [
      {
        table: 'applied_effects',
        foreignKey: 'character_id',
        otherForeignKey: 'status_effect_definition_id',
        otherIdMapKey: 'effectIdMap',
        exportKey: 'applied_effects',
        columns: [
          { name: 'applied_at',       type: 'text',    default: null },
          { name: 'remaining_rounds', type: 'integer', default: null },
          { name: 'remaining_hours',  type: 'real',    default: null },
        ],
      },
      {
        table: 'character_items',
        foreignKey: 'character_id',
        otherForeignKey: 'item_definition_id',
        otherIdMapKey: 'itemIdMap',
        exportKey: 'character_items',
        columns: [
          { name: 'quantity', type: 'integer', default: 1 },
        ],
      },
    ],
  },
  encounters: {
    table: 'encounter_definitions',
    exportKey: 'encounters',
    displayName: 'Encounters',
    nameField: 'name',
    columns: [
      { name: 'name',                  type: 'text', default: '' },
      { name: 'description',           type: 'text', default: '' },
      { name: 'notes',                 type: 'text', default: '' },
      { name: 'npcs',                  type: 'json', default: [] },
      { name: 'environment_overrides', type: 'json', default: {} },
      { name: 'loot_table',            type: 'json', default: [] },
    ],
    modifierColumns: [],
    idMapKey: 'encounterIdMap',
    relations: [],
    postProcess: 'remapEncounterNpcs',
  },
};

// Order matters: effects and items before characters (for relation ID mapping),
// encounters last (needs charIdMap for NPC remapping).
const IMPORT_ORDER = ['status_effects', 'items', 'characters', 'encounters'];

module.exports = { ENTITY_CONFIG, IMPORT_ORDER };
