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

    const campaignResult = db.prepare(`
      INSERT INTO campaigns (name, attribute_definitions) VALUES (?, ?)
    `).run('Example Campaign', JSON.stringify(attrs));
    const campaignId = campaignResult.lastInsertRowid;

    // Create environment state
    db.prepare(`
      INSERT INTO environment_state (campaign_id, current_hour, current_minute, current_day, current_month, current_year, weather)
      VALUES (?, 14, 30, 15, 3, 1247, 'Overcast')
    `).run(campaignId);

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

    // Create an encounter
    db.prepare(`
      INSERT INTO encounter_definitions (campaign_id, name, description, notes, npcs, environment_overrides, loot_table)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(campaignId, 'Thornwood Ambush', 'The goblin warband springs a trap on the forest road.',
      'The goblins attack from the trees. 3 regular goblins flank while the chieftain commands from the rear.',
      JSON.stringify([{ character_id: goblinChief.lastInsertRowid, role: 'leader' }]),
      JSON.stringify({ weather: 'Fog', time_suggestion: 'Dusk' }),
      JSON.stringify([
        { item_name: 'Healing Potion', quantity: 2, drop_chance: 0.5 },
        { item_name: 'Cursed Amulet', quantity: 1, drop_chance: 0.1 },
      ]));

    console.log('Seed data created successfully.');
  });

  seedTransaction();
}

seed();
