const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// GET export full campaign
router.get('/export', (req, res) => {
  const campaignId = req.params.id;

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const characters = db.prepare('SELECT * FROM characters WHERE campaign_id = ?').all(campaignId);
  const statusEffects = db.prepare('SELECT * FROM status_effect_definitions WHERE campaign_id = ?').all(campaignId);
  const items = db.prepare('SELECT * FROM item_definitions WHERE campaign_id = ?').all(campaignId);
  const encounters = db.prepare('SELECT * FROM encounter_definitions WHERE campaign_id = ?').all(campaignId);
  const environment = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  const sessionLog = db.prepare('SELECT * FROM session_log WHERE campaign_id = ?').all(campaignId);

  // Get applied effects and character items
  const charIds = characters.map(c => c.id);
  let appliedEffects = [];
  let characterItems = [];

  if (charIds.length > 0) {
    const placeholders = charIds.map(() => '?').join(',');
    appliedEffects = db.prepare(`SELECT * FROM applied_effects WHERE character_id IN (${placeholders})`).all(...charIds);
    characterItems = db.prepare(`SELECT * FROM character_items WHERE character_id IN (${placeholders})`).all(...charIds);
  }

  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    campaign: {
      ...campaign,
      attribute_definitions: JSON.parse(campaign.attribute_definitions),
      time_of_day_thresholds: JSON.parse(campaign.time_of_day_thresholds),
      calendar_config: JSON.parse(campaign.calendar_config),
      weather_options: JSON.parse(campaign.weather_options),
    },
    characters: characters.map(c => ({ ...c, base_attributes: JSON.parse(c.base_attributes) })),
    status_effects: statusEffects.map(e => ({ ...e, tags: JSON.parse(e.tags), modifiers: JSON.parse(e.modifiers) })),
    items: items.map(i => ({
      ...i,
      properties: JSON.parse(i.properties),
      modifiers: JSON.parse(i.modifiers),
      stackable: !!i.stackable,
    })),
    encounters: encounters.map(e => ({
      ...e,
      npcs: JSON.parse(e.npcs),
      environment_overrides: JSON.parse(e.environment_overrides),
      loot_table: JSON.parse(e.loot_table),
    })),
    applied_effects: appliedEffects,
    character_items: characterItems,
    environment,
    session_log: sessionLog,
  };

  res.setHeader('Content-Disposition', `attachment; filename="almanac-${campaign.name.replace(/\s+/g, '-')}.json"`);
  res.json(exportData);
});

// POST import campaign
router.post('/import', (req, res) => {
  const data = req.body;
  if (!data || !data.campaign) return res.status(400).json({ error: 'Invalid import data' });

  const importTransaction = db.transaction(() => {
    // Create campaign
    const campaignResult = db.prepare(`
      INSERT INTO campaigns (name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.campaign.name + ' (Imported)',
      JSON.stringify(data.campaign.attribute_definitions || []),
      JSON.stringify(data.campaign.time_of_day_thresholds || []),
      JSON.stringify(data.campaign.calendar_config || {}),
      JSON.stringify(data.campaign.weather_options || []),
    );
    const newCampaignId = campaignResult.lastInsertRowid;

    // ID mappings for references
    const charIdMap = {};
    const effectIdMap = {};
    const itemIdMap = {};

    // Import status effects
    for (const e of (data.status_effects || [])) {
      const result = db.prepare(`
        INSERT INTO status_effect_definitions (campaign_id, name, description, tags, modifiers, duration_type, duration_value)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(newCampaignId, e.name, e.description || '', JSON.stringify(e.tags || []), JSON.stringify(e.modifiers || []), e.duration_type || 'indefinite', e.duration_value || 0);
      effectIdMap[e.id] = result.lastInsertRowid;
    }

    // Import items
    for (const i of (data.items || [])) {
      const result = db.prepare(`
        INSERT INTO item_definitions (campaign_id, name, description, item_type, properties, stackable, modifiers)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(newCampaignId, i.name, i.description || '', i.item_type || 'misc', JSON.stringify(i.properties || {}), i.stackable ? 1 : 0, JSON.stringify(i.modifiers || []));
      itemIdMap[i.id] = result.lastInsertRowid;
    }

    // Import characters
    for (const c of (data.characters || [])) {
      const result = db.prepare(`
        INSERT INTO characters (campaign_id, name, type, description, portrait_url, base_attributes)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(newCampaignId, c.name, c.type, c.description || '', c.portrait_url || '', JSON.stringify(c.base_attributes || {}));
      charIdMap[c.id] = result.lastInsertRowid;
    }

    // Import applied effects
    for (const ae of (data.applied_effects || [])) {
      const newCharId = charIdMap[ae.character_id];
      const newEffectId = effectIdMap[ae.status_effect_definition_id];
      if (newCharId && newEffectId) {
        db.prepare(`
          INSERT INTO applied_effects (character_id, status_effect_definition_id, applied_at, remaining_rounds, remaining_hours)
          VALUES (?, ?, ?, ?, ?)
        `).run(newCharId, newEffectId, ae.applied_at, ae.remaining_rounds, ae.remaining_hours);
      }
    }

    // Import character items
    for (const ci of (data.character_items || [])) {
      const newCharId = charIdMap[ci.character_id];
      const newItemId = itemIdMap[ci.item_definition_id];
      if (newCharId && newItemId) {
        db.prepare(`
          INSERT INTO character_items (character_id, item_definition_id, quantity) VALUES (?, ?, ?)
        `).run(newCharId, newItemId, ci.quantity || 1);
      }
    }

    // Import encounters
    for (const e of (data.encounters || [])) {
      db.prepare(`
        INSERT INTO encounter_definitions (campaign_id, name, description, notes, npcs, environment_overrides, loot_table)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(newCampaignId, e.name, e.description || '', e.notes || '', JSON.stringify(e.npcs || []), JSON.stringify(e.environment_overrides || {}), JSON.stringify(e.loot_table || []));
    }

    // Import environment
    if (data.environment) {
      db.prepare(`
        INSERT INTO environment_state (campaign_id, current_hour, current_minute, current_day, current_month, current_year, weather, environment_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newCampaignId, data.environment.current_hour || 12, data.environment.current_minute || 0, data.environment.current_day || 1, data.environment.current_month || 1, data.environment.current_year || 1, data.environment.weather || 'Clear', data.environment.environment_notes || '');
    } else {
      db.prepare('INSERT INTO environment_state (campaign_id) VALUES (?)').run(newCampaignId);
    }

    return newCampaignId;
  });

  try {
    const newCampaignId = importTransaction();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(newCampaignId);
    res.status(201).json({
      ...campaign,
      attribute_definitions: JSON.parse(campaign.attribute_definitions),
      time_of_day_thresholds: JSON.parse(campaign.time_of_day_thresholds),
      calendar_config: JSON.parse(campaign.calendar_config),
      weather_options: JSON.parse(campaign.weather_options),
    });
  } catch (err) {
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

module.exports = router;
