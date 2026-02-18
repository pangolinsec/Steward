const express = require('express');
const router = express.Router();
const db = require('../db');

function parseCampaign(c) {
  return {
    ...c,
    attribute_definitions: JSON.parse(c.attribute_definitions),
    time_of_day_thresholds: JSON.parse(c.time_of_day_thresholds),
    calendar_config: JSON.parse(c.calendar_config),
    weather_options: JSON.parse(c.weather_options),
    encounter_settings: c.encounter_settings ? JSON.parse(c.encounter_settings) : db.CAMPAIGN_DEFAULTS.encounter_settings,
    weather_volatility: c.weather_volatility ?? db.CAMPAIGN_DEFAULTS.weather_volatility,
    weather_transition_table: c.weather_transition_table ? JSON.parse(c.weather_transition_table) : null,
    rules_settings: c.rules_settings ? JSON.parse(c.rules_settings) : { cascade_depth_limit: 3, engine_enabled: true },
    property_key_registry: c.property_key_registry ? JSON.parse(c.property_key_registry) : [],
    season_options: c.season_options ? JSON.parse(c.season_options) : ["Spring", "Summer", "Autumn", "Winter"],
    custom_tag_presets: JSON.parse(c.custom_tag_presets || '[]'),
    dice_settings: c.dice_settings ? JSON.parse(c.dice_settings) : { log_rolls: false },
  };
}

// GET all campaigns
router.get('/', (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(campaigns.map(parseCampaign));
});

// GET single campaign
router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json(parseCampaign(campaign));
});

// POST create campaign
router.post('/', (req, res) => {
  const { name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const defaults = db.CAMPAIGN_DEFAULTS;
  const result = db.prepare(`
    INSERT INTO campaigns (name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    JSON.stringify(attribute_definitions || []),
    JSON.stringify(time_of_day_thresholds || defaults.time_of_day_thresholds),
    JSON.stringify(calendar_config || defaults.calendar_config),
    JSON.stringify(weather_options || defaults.weather_options),
  );

  // Create environment state for the campaign
  db.prepare('INSERT INTO environment_state (campaign_id) VALUES (?)').run(result.lastInsertRowid);

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseCampaign(campaign));
});

// PUT update campaign
router.put('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options,
    encounter_settings, weather_volatility, weather_transition_table, rules_settings, property_key_registry,
    season_options, custom_tag_presets, dice_settings } = req.body;

  db.prepare(`
    UPDATE campaigns SET
      name = COALESCE(?, name),
      attribute_definitions = COALESCE(?, attribute_definitions),
      time_of_day_thresholds = COALESCE(?, time_of_day_thresholds),
      calendar_config = COALESCE(?, calendar_config),
      weather_options = COALESCE(?, weather_options),
      encounter_settings = COALESCE(?, encounter_settings),
      weather_volatility = COALESCE(?, weather_volatility),
      weather_transition_table = ?,
      rules_settings = COALESCE(?, rules_settings),
      property_key_registry = COALESCE(?, property_key_registry),
      season_options = COALESCE(?, season_options),
      custom_tag_presets = COALESCE(?, custom_tag_presets),
      dice_settings = COALESCE(?, dice_settings)
    WHERE id = ?
  `).run(
    name || null,
    attribute_definitions ? JSON.stringify(attribute_definitions) : null,
    time_of_day_thresholds ? JSON.stringify(time_of_day_thresholds) : null,
    calendar_config ? JSON.stringify(calendar_config) : null,
    weather_options ? JSON.stringify(weather_options) : null,
    encounter_settings ? JSON.stringify(encounter_settings) : null,
    weather_volatility !== undefined ? weather_volatility : null,
    weather_transition_table !== undefined ? (weather_transition_table ? JSON.stringify(weather_transition_table) : null) : campaign.weather_transition_table,
    rules_settings ? JSON.stringify(rules_settings) : null,
    property_key_registry ? JSON.stringify(property_key_registry) : null,
    season_options ? JSON.stringify(season_options) : null,
    custom_tag_presets ? JSON.stringify(custom_tag_presets) : null,
    dice_settings ? JSON.stringify(dice_settings) : null,
    req.params.id,
  );

  const updated = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  res.json(parseCampaign(updated));
});

// DELETE campaign
router.delete('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
