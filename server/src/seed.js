const db = require('./db');

function seed() {
  console.log('Seeding database...');

  const existing = db.prepare('SELECT id FROM campaigns WHERE name = ?').get('Example Campaign');
  if (existing) {
    console.log('Seed data already exists. Skipping.');
    return;
  }

  const seedTransaction = db.transaction(() => {
    // Create campaign
    const attrs = [
      { key: 'strength', label: 'Strength' },
      { key: 'dexterity', label: 'Dexterity' },
      { key: 'constitution', label: 'Constitution' },
      { key: 'intelligence', label: 'Intelligence' },
      { key: 'wisdom', label: 'Wisdom' },
      { key: 'charisma', label: 'Charisma' },
      { key: 'stamina', label: 'Stamina' },
      { key: 'luck', label: 'Luck' },
    ];

    const encounterSettings = { enabled: true, base_rate: 0.15, min_interval_hours: 2 };

    const campaignResult = db.prepare(`
      INSERT INTO campaigns (name, attribute_definitions, encounter_settings, weather_volatility)
      VALUES (?, ?, ?, ?)
    `).run('Example Campaign', JSON.stringify(attrs), JSON.stringify(encounterSettings), 0.3);
    const campaignId = campaignResult.lastInsertRowid;

    // Create locations
    const silverdale = db.prepare(`
      INSERT INTO locations (campaign_id, name, description, encounter_modifier, properties, position_x, position_y)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Silverdale', 'A peaceful trading town nestled in a valley. The party\'s home base.',
      0.2, JSON.stringify({ terrain: 'urban', population: 'medium' }), 100, 300);

    const thornwood = db.prepare(`
      INSERT INTO locations (campaign_id, name, description, encounter_modifier, properties, position_x, position_y, weather_override)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Thornwood', 'A dense, ancient forest teeming with dangerous creatures.',
      1.5, JSON.stringify({ terrain: 'forest', danger: 'high' }), 400, 150,
      JSON.stringify({ mode: 'weighted', value: { 'Fog': 0.3, 'Rain': 0.3, 'Overcast': 0.2, 'Clear': 0.1, 'Storm': 0.1 } }));

    const ironHold = db.prepare(`
      INSERT INTO locations (campaign_id, name, description, encounter_modifier, properties, position_x, position_y)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Iron Hold', 'A dwarven fortress carved into the mountainside.',
      0.5, JSON.stringify({ terrain: 'mountain', population: 'small' }), 700, 300);

    // Create edges
    db.prepare(`
      INSERT INTO location_edges (campaign_id, from_location_id, to_location_id, label, description, travel_hours, bidirectional, encounter_modifier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, silverdale.lastInsertRowid, thornwood.lastInsertRowid, 'Forest Road',
      'A well-worn dirt road winding through the Thornwood. Bandits have been spotted here recently.', 4, 1, 1.2);

    db.prepare(`
      INSERT INTO location_edges (campaign_id, from_location_id, to_location_id, label, description, travel_hours, bidirectional, encounter_modifier, weather_override)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, thornwood.lastInsertRowid, ironHold.lastInsertRowid, 'Mountain Pass',
      'A narrow, treacherous path carved into the mountainside. Snow and ice make footing dangerous.',
      6, 1, 1.5,
      JSON.stringify({ mode: 'weighted', value: { 'Snow': 0.4, 'Fog': 0.2, 'Windy': 0.2, 'Clear': 0.1, 'Storm': 0.1 } }));

    // Create environment state with starting location
    db.prepare(`
      INSERT INTO environment_state (campaign_id, current_hour, current_minute, current_day, current_month, current_year, weather, current_location_id)
      VALUES (?, 14, 30, 15, 3, 1247, 'Overcast', ?)
    `).run(campaignId, silverdale.lastInsertRowid);

    // Create characters
    const aldric = db.prepare(`
      INSERT INTO characters (campaign_id, name, type, description, base_attributes) VALUES (?, ?, ?, ?, ?)
    `).run(campaignId, 'Aldric', 'PC', 'A stalwart human paladin, devoted to the Order of the Silver Dawn.',
      JSON.stringify({ strength: 16, dexterity: 10, constitution: 14, intelligence: 8, wisdom: 13, charisma: 15, stamina: 12, luck: 10 }));

    const mira = db.prepare(`
      INSERT INTO characters (campaign_id, name, type, description, base_attributes) VALUES (?, ?, ?, ?, ?)
    `).run(campaignId, 'Mira', 'PC', 'A quick-witted half-elf rogue with a talent for finding trouble.',
      JSON.stringify({ strength: 8, dexterity: 17, constitution: 10, intelligence: 14, wisdom: 11, charisma: 13, stamina: 9, luck: 15 }));

    const goblinChief = db.prepare(`
      INSERT INTO characters (campaign_id, name, type, description, base_attributes) VALUES (?, ?, ?, ?, ?)
    `).run(campaignId, 'Goblin Chieftain', 'NPC', 'A cunning goblin leader who commands a warband in the Thornwood.',
      JSON.stringify({ strength: 12, dexterity: 14, constitution: 11, intelligence: 10, wisdom: 8, charisma: 12, stamina: 10, luck: 7 }));

    // Create status effects
    const enraged = db.prepare(`
      INSERT INTO status_effect_definitions (campaign_id, name, description, tags, modifiers, duration_type, duration_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Enraged', 'Blind fury overtakes the character, enhancing strength but clouding judgment.',
      JSON.stringify(['buff', 'debuff', 'mental']),
      JSON.stringify([{ attribute: 'strength', delta: 3 }, { attribute: 'wisdom', delta: -2 }]),
      'rounds', 5);

    const blessed = db.prepare(`
      INSERT INTO status_effect_definitions (campaign_id, name, description, tags, modifiers, duration_type, duration_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Blessed', 'Divine favor grants a small bonus to all abilities.',
      JSON.stringify(['buff', 'magical', 'divine']),
      JSON.stringify([
        { attribute: 'strength', delta: 1 }, { attribute: 'dexterity', delta: 1 },
        { attribute: 'constitution', delta: 1 }, { attribute: 'intelligence', delta: 1 },
        { attribute: 'wisdom', delta: 1 }, { attribute: 'charisma', delta: 1 },
        { attribute: 'stamina', delta: 1 }, { attribute: 'luck', delta: 1 },
      ]),
      'timed', 8);

    db.prepare(`
      INSERT INTO status_effect_definitions (campaign_id, name, description, tags, modifiers, duration_type, duration_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Poisoned', 'Venom courses through the veins, weakening the body.',
      JSON.stringify(['debuff', 'poison', 'physical']),
      JSON.stringify([{ attribute: 'constitution', delta: -2 }, { attribute: 'strength', delta: -1 }]),
      'timed', 4);

    db.prepare(`
      INSERT INTO status_effect_definitions (campaign_id, name, description, tags, modifiers, duration_type, duration_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Inspired', 'A surge of confidence and eloquence.',
      JSON.stringify(['buff', 'mental']),
      JSON.stringify([{ attribute: 'charisma', delta: 2 }, { attribute: 'wisdom', delta: 1 }]),
      'indefinite', 0);

    db.prepare(`
      INSERT INTO status_effect_definitions (campaign_id, name, description, tags, modifiers, duration_type, duration_value)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Exhausted', 'Physical fatigue drains the body.',
      JSON.stringify(['debuff', 'physical']),
      JSON.stringify([
        { attribute: 'strength', delta: -1 }, { attribute: 'dexterity', delta: -1 },
        { attribute: 'constitution', delta: -1 },
      ]),
      'indefinite', 0);

    // Create items
    db.prepare(`
      INSERT INTO item_definitions (campaign_id, name, description, item_type, properties, stackable, modifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Sword of Valor', 'A gleaming longsword imbued with holy energy.', 'weapon',
      JSON.stringify({ weight: 4, rarity: 'rare' }), 0,
      JSON.stringify([{ attribute: 'strength', delta: 2 }]));

    db.prepare(`
      INSERT INTO item_definitions (campaign_id, name, description, item_type, properties, stackable, modifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Cloak of Shadows', 'A dark cloak that enhances agility but unsettles those nearby.', 'armor',
      JSON.stringify({ weight: 1, rarity: 'uncommon' }), 0,
      JSON.stringify([{ attribute: 'dexterity', delta: 3 }, { attribute: 'charisma', delta: -1 }]));

    db.prepare(`
      INSERT INTO item_definitions (campaign_id, name, description, item_type, properties, stackable, modifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Ring of Fortitude', 'A sturdy iron ring that bolsters endurance.', 'accessory',
      JSON.stringify({ weight: 0, rarity: 'uncommon' }), 0,
      JSON.stringify([{ attribute: 'constitution', delta: 2 }]));

    db.prepare(`
      INSERT INTO item_definitions (campaign_id, name, description, item_type, properties, stackable, modifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Healing Potion', 'A vial of red liquid that restores vitality.', 'consumable',
      JSON.stringify({ weight: 0.5, rarity: 'common' }), 1,
      JSON.stringify([]));

    db.prepare(`
      INSERT INTO item_definitions (campaign_id, name, description, item_type, properties, stackable, modifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Cursed Amulet', 'A strange amulet that sharpens the mind but twists fate.', 'accessory',
      JSON.stringify({ weight: 0.5, rarity: 'rare', cursed: true }), 0,
      JSON.stringify([{ attribute: 'intelligence', delta: 3 }, { attribute: 'luck', delta: -2 }]));

    // Create encounters with conditions
    db.prepare(`
      INSERT INTO encounter_definitions (campaign_id, name, description, notes, npcs, environment_overrides, loot_table, conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Thornwood Ambush', 'The goblin warband springs a trap on the forest road.',
      'The goblins attack from the trees. 3 regular goblins flank while the chieftain commands from the rear.',
      JSON.stringify([{ character_id: goblinChief.lastInsertRowid, role: 'leader' }]),
      JSON.stringify({ weather: 'Fog', time_suggestion: 'Dusk' }),
      JSON.stringify([
        { item_name: 'Healing Potion', quantity: 2, drop_chance: 0.5 },
        { item_name: 'Cursed Amulet', quantity: 1, drop_chance: 0.1 },
      ]),
      JSON.stringify({
        location_ids: [thornwood.lastInsertRowid],
        time_of_day: ['Night', 'Dusk', 'Evening'],
        weather: [],
        weight: 2.0,
      }));

    db.prepare(`
      INSERT INTO encounter_definitions (campaign_id, name, description, notes, npcs, environment_overrides, loot_table, conditions)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Mountain Wolves', 'A pack of dire wolves stalks the mountain pass.',
      'The wolves circle the party, testing for weakness before attacking.',
      JSON.stringify([]),
      JSON.stringify({}),
      JSON.stringify([]),
      JSON.stringify({
        location_ids: [ironHold.lastInsertRowid, thornwood.lastInsertRowid],
        time_of_day: ['Night', 'Dawn', 'Dusk'],
        weather: ['Snow', 'Fog', 'Clear'],
        weight: 1.0,
      }));

    console.log('Seed data created successfully.');
  });

  seedTransaction();
}

seed();
