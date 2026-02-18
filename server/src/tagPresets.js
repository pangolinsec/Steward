const TAG_PRESETS = {
  // === Fantasy ===
  race_fantasy: {
    category: 'fantasy',
    name: 'Race (Fantasy)',
    description: 'Standard fantasy races with trait-based rules.',
    attribute: { key: 'race', label: 'Race', type: 'tag', options: ['Human', 'Elf', 'Dwarf', 'Halfling', 'Orc', 'Gnome'] },
    rules: [
      {
        name: 'Dwarven Poison Resistance',
        description: 'Dwarves shrug off poison effects.',
        trigger_type: 'on_effect_change',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'race', value: 'Dwarf' },
          { type: 'has_effect', effect_name: 'Poisoned' },
        ]},
        actions: [
          { type: 'remove_effect', effect_name: 'Poisoned' },
          { type: 'notify', message: '{character.name} resists poison (Dwarven constitution)!', severity: 'info' },
        ],
        action_mode: 'suggest', priority: 80, tags: ['race', 'trait'], target_mode: 'all_characters', target_config: {},
      },
      {
        name: 'Elven Fog Advantage',
        description: 'Elves see through fog with darkvision.',
        trigger_type: 'on_time_advance',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'race', value: 'Elf' },
          { type: 'weather_is', value: 'Fog' },
        ]},
        actions: [
          { type: 'notify', message: '{character.name}\'s elven darkvision pierces the fog.', severity: 'info' },
        ],
        action_mode: 'auto', priority: 100, tags: ['race', 'trait'], target_mode: 'all_characters', target_config: {},
      },
      {
        name: 'Halfling Luck',
        description: 'Halflings get a lucky feeling when things go badly.',
        trigger_type: 'on_effect_change',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'race', value: 'Halfling' },
          { type: 'has_effect', effect_name: 'Exhausted' },
        ]},
        actions: [
          { type: 'notify', message: '{character.name} feels a surge of halfling luck — consider allowing a re-roll!', severity: 'info' },
        ],
        action_mode: 'auto', priority: 90, tags: ['race', 'trait'], target_mode: 'all_characters', target_config: {},
      },
      {
        name: 'Orc Frenzy',
        description: 'Orcs enter a frenzy at low health.',
        trigger_type: 'on_threshold',
        trigger_config: { attribute: 'hp', threshold: 5, direction: 'falling' },
        conditions: { all: [
          { type: 'trait_equals', trait: 'race', value: 'Orc' },
        ]},
        actions: [
          { type: 'notify', message: '{character.name} enters an orcish frenzy! Consider granting bonus damage.', severity: 'warning' },
        ],
        action_mode: 'auto', priority: 70, tags: ['race', 'trait', 'combat'], target_mode: 'all_characters', target_config: {},
      },
    ],
  },

  class_fantasy: {
    category: 'fantasy',
    name: 'Class (Fantasy)',
    description: 'Standard fantasy classes with trait-based rules.',
    attribute: { key: 'class', label: 'Class', type: 'tag', options: ['Fighter', 'Wizard', 'Rogue', 'Cleric', 'Ranger'] },
    rules: [
      {
        name: 'Wizard Storm Vulnerability',
        description: 'Wizards are vulnerable to storms — concentration at risk.',
        trigger_type: 'on_time_advance',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'class', value: 'Wizard' },
          { type: 'weather_in', values: ['Storm', 'Heavy Rain'] },
        ]},
        actions: [
          { type: 'notify', message: '{character.name}\'s concentration wavers in the storm — consider a check!', severity: 'warning' },
        ],
        action_mode: 'auto', priority: 100, tags: ['class', 'trait', 'weather'], target_mode: 'all_characters', target_config: {},
      },
      {
        name: 'Ranger Wilderness Bonus',
        description: 'Rangers gain advantages in wilderness locations.',
        trigger_type: 'on_location_change',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'class', value: 'Ranger' },
          { type: 'location_property', property: 'terrain', value: 'wilderness' },
        ]},
        actions: [
          { type: 'notify', message: '{character.name} is in their element — Rangers gain advantage on Survival checks here.', severity: 'info' },
        ],
        action_mode: 'auto', priority: 100, tags: ['class', 'trait', 'location_travel'], target_mode: 'all_characters', target_config: {},
      },
      {
        name: 'Cleric Undead Turning',
        description: 'Clerics can attempt to turn undead creatures.',
        trigger_type: 'on_effect_change',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'class', value: 'Cleric' },
        ]},
        actions: [
          { type: 'notify', message: '{character.name} channels divine energy — consider Turn Undead if undead are present.', severity: 'info' },
        ],
        action_mode: 'suggest', priority: 120, tags: ['class', 'trait', 'combat'], target_mode: 'all_characters', target_config: {},
      },
    ],
  },

  creature_type: {
    category: 'fantasy',
    name: 'Creature Type',
    description: 'Creature type classification with type-based rules.',
    attribute: { key: 'creature_type', label: 'Creature Type', type: 'tag', options: ['Humanoid', 'Undead', 'Beast', 'Elemental', 'Fey'] },
    rules: [
      {
        name: 'Undead Exhaustion Immunity',
        description: 'Undead creatures resist exhaustion.',
        trigger_type: 'on_effect_change',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'creature_type', value: 'Undead' },
          { type: 'has_effect', effect_name: 'Exhausted' },
        ]},
        actions: [
          { type: 'remove_effect', effect_name: 'Exhausted' },
          { type: 'notify', message: '{character.name} is undead and immune to exhaustion.', severity: 'info' },
        ],
        action_mode: 'suggest', priority: 70, tags: ['creature_type', 'trait'], target_mode: 'all_characters', target_config: {},
      },
      {
        name: 'Elemental Weather Affinity',
        description: 'Elementals thrive in storms.',
        trigger_type: 'on_time_advance',
        trigger_config: {},
        conditions: { all: [
          { type: 'trait_equals', trait: 'creature_type', value: 'Elemental' },
          { type: 'weather_in', values: ['Storm', 'Heavy Rain'] },
        ]},
        actions: [
          { type: 'notify', message: '{character.name} draws power from the storm!', severity: 'info' },
        ],
        action_mode: 'auto', priority: 100, tags: ['creature_type', 'trait', 'weather'], target_mode: 'all_characters', target_config: {},
      },
    ],
  },

  // === General ===
  alignment: {
    category: 'general',
    name: 'Alignment',
    description: 'Classic 3x3 alignment grid. No bundled rules.',
    attribute: { key: 'alignment', label: 'Alignment', type: 'tag', options: [
      'Lawful Good', 'Neutral Good', 'Chaotic Good',
      'Lawful Neutral', 'True Neutral', 'Chaotic Neutral',
      'Lawful Evil', 'Neutral Evil', 'Chaotic Evil',
    ]},
    rules: [],
  },
};

const TAG_PRESET_CATEGORIES = {
  fantasy: 'Fantasy',
  general: 'General',
};

module.exports = { TAG_PRESETS, TAG_PRESET_CATEGORIES };
