const RULE_TEMPLATES = {
  // === Survival ===
  torch_burnout: {
    category: 'survival',
    name: 'Torch Burnout',
    description: 'Consumes a torch every hour and notifies when supply is low.',
    trigger_type: 'on_time_advance',
    trigger_config: {},
    conditions: { all: [{ type: 'has_item', item_name: 'Torch' }] },
    actions: [
      { type: 'consume_item', item_name: 'Torch', quantity: 1 },
      { type: 'notify', message: '{character.name} used a torch.', severity: 'info' },
    ],
    action_mode: 'auto',
    priority: 100,
    tags: ['survival', 'resource'],
    target_mode: 'all_pcs',
    target_config: {},
  },

  starvation_warning: {
    category: 'survival',
    name: 'Starvation Warning',
    description: 'Warns when a character has no rations after 8+ hours without rest.',
    trigger_type: 'on_time_advance',
    trigger_config: {},
    conditions: { all: [
      { type: 'lacks_item', item_name: 'Rations' },
      { type: 'hours_since_last_rest', operator: 'gte', hours: 8 },
    ]},
    actions: [
      { type: 'notify', message: '{character.name} is hungry and has no rations!', severity: 'warning' },
    ],
    action_mode: 'auto',
    priority: 50,
    tags: ['survival'],
    target_mode: 'all_pcs',
    target_config: {},
  },

  // === Environmental ===
  storm_debuff: {
    category: 'environmental',
    name: 'Storm Exposure',
    description: 'Suggests applying Exhausted when caught in a storm.',
    trigger_type: 'on_time_advance',
    trigger_config: {},
    conditions: { all: [
      { type: 'weather_in', values: ['Storm', 'Heavy Rain'] },
      { type: 'lacks_effect', effect_name: 'Exhausted' },
    ]},
    actions: [
      { type: 'apply_effect', effect_name: 'Exhausted' },
    ],
    action_mode: 'suggest',
    priority: 100,
    tags: ['environmental', 'weather'],
    target_mode: 'all_pcs',
    target_config: {},
  },

  fog_navigation: {
    category: 'environmental',
    name: 'Fog Navigation Hazard',
    description: 'Notifies that navigation is difficult during fog.',
    trigger_type: 'on_time_advance',
    trigger_config: {},
    conditions: { all: [{ type: 'weather_is', value: 'Fog' }] },
    actions: [
      { type: 'notify', message: 'Dense fog makes navigation treacherous. Consider Wisdom checks.', severity: 'warning' },
    ],
    action_mode: 'auto',
    priority: 150,
    tags: ['environmental', 'weather'],
    target_mode: 'environment',
    target_config: {},
  },

  // === Effect Lifecycle ===
  poison_weakens: {
    category: 'effect_lifecycle',
    name: 'Poison Weakens',
    description: 'Automatically applies Exhausted when a character gets Poisoned.',
    trigger_type: 'on_effect_change',
    trigger_config: {},
    conditions: { all: [
      { type: 'has_effect', effect_name: 'Poisoned' },
      { type: 'lacks_effect', effect_name: 'Exhausted' },
    ]},
    actions: [
      { type: 'apply_effect', effect_name: 'Exhausted' },
      { type: 'notify', message: '{character.name} is weakened by poison!', severity: 'warning' },
    ],
    action_mode: 'auto',
    priority: 80,
    tags: ['effect_lifecycle', 'combat'],
    target_mode: 'all_characters',
    target_config: {},
  },

  blessed_bonus: {
    category: 'effect_lifecycle',
    name: 'Blessed Healing Aura',
    description: 'When Blessed is applied, notifies DM about enhanced healing.',
    trigger_type: 'on_effect_change',
    trigger_config: {},
    conditions: { all: [{ type: 'has_effect', effect_name: 'Blessed' }] },
    actions: [
      { type: 'notify', message: '{character.name} radiates divine healing energy while Blessed.', severity: 'info' },
    ],
    action_mode: 'auto',
    priority: 100,
    tags: ['effect_lifecycle', 'divine'],
    target_mode: 'all_characters',
    target_config: {},
  },

  // === Location/Travel ===
  dangerous_territory: {
    category: 'location_travel',
    name: 'Dangerous Territory Warning',
    description: 'Warns when arriving at a location with dangerous property.',
    trigger_type: 'on_location_change',
    trigger_config: {},
    conditions: { all: [{ type: 'location_property', property: 'dangerous', value: true }] },
    actions: [
      { type: 'notify', message: 'You have entered dangerous territory! Stay alert.', severity: 'warning' },
    ],
    action_mode: 'auto',
    priority: 50,
    tags: ['location_travel'],
    target_mode: 'environment',
    target_config: {},
  },

  // === Combat ===
  low_health_warning: {
    category: 'combat',
    name: 'Low Stamina Warning',
    description: 'Notifies when a character\'s stamina drops below 3.',
    trigger_type: 'on_threshold',
    trigger_config: { attribute: 'stamina', threshold: 3, direction: 'falling' },
    conditions: { all: [] },
    actions: [
      { type: 'notify', message: '{character.name} is critically fatigued!', severity: 'error' },
    ],
    action_mode: 'auto',
    priority: 10,
    tags: ['combat', 'survival'],
    target_mode: 'all_pcs',
    target_config: {},
  },

  // === Rest ===
  rest_recovery: {
    category: 'rest',
    name: 'Long Rest Recovery',
    description: 'Suggests removing Exhausted on long rest.',
    trigger_type: 'on_rest',
    trigger_config: {},
    conditions: { all: [{ type: 'has_effect', effect_name: 'Exhausted' }] },
    actions: [
      { type: 'remove_effect', effect_name: 'Exhausted' },
    ],
    action_mode: 'suggest',
    priority: 100,
    tags: ['rest', 'recovery'],
    target_mode: 'all_pcs',
    target_config: {},
  },

  // === Economy/Time ===
  daily_event_roll: {
    category: 'economy_time',
    name: 'Daily Random Event',
    description: 'Rolls for a random daily event each morning.',
    trigger_type: 'on_time_advance',
    trigger_config: {},
    conditions: { all: [{ type: 'time_of_day_is', value: 'Morning' }] },
    actions: [
      { type: 'roll_dice', formula: '1d20', store_as: 'daily_roll' },
      { type: 'notify', message: 'Daily event roll: {var.daily_roll}', severity: 'info' },
    ],
    action_mode: 'auto',
    priority: 200,
    tags: ['economy_time'],
    target_mode: 'environment',
    target_config: {},
  },
};

const TEMPLATE_CATEGORIES = {
  survival: 'Survival',
  environmental: 'Environmental',
  effect_lifecycle: 'Effect Lifecycle',
  location_travel: 'Location & Travel',
  combat: 'Combat',
  rest: 'Rest & Recovery',
  economy_time: 'Economy & Time',
};

module.exports = { RULE_TEMPLATES, TEMPLATE_CATEGORIES };
