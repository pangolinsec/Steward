const express = require('express');
const router = express.Router();
const db = require('../db');

// GET all campaigns
router.get('/', (req, res) => {
  const campaigns = db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all();
  res.json(campaigns.map(c => ({
    ...c,
    attribute_definitions: JSON.parse(c.attribute_definitions),
    time_of_day_thresholds: JSON.parse(c.time_of_day_thresholds),
    calendar_config: JSON.parse(c.calendar_config),
    weather_options: JSON.parse(c.weather_options),
  })));
});

// GET single campaign
router.get('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  res.json({
    ...campaign,
    attribute_definitions: JSON.parse(campaign.attribute_definitions),
    time_of_day_thresholds: JSON.parse(campaign.time_of_day_thresholds),
    calendar_config: JSON.parse(campaign.calendar_config),
    weather_options: JSON.parse(campaign.weather_options),
  });
});

// POST create campaign
router.post('/', (req, res) => {
  const { name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO campaigns (name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    name,
    JSON.stringify(attribute_definitions || []),
    time_of_day_thresholds ? JSON.stringify(time_of_day_thresholds) : undefined,
    calendar_config ? JSON.stringify(calendar_config) : undefined,
    weather_options ? JSON.stringify(weather_options) : undefined,
  );

  // Create environment state for the campaign
  db.prepare('INSERT INTO environment_state (campaign_id) VALUES (?)').run(result.lastInsertRowid);

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...campaign,
    attribute_definitions: JSON.parse(campaign.attribute_definitions),
    time_of_day_thresholds: JSON.parse(campaign.time_of_day_thresholds),
    calendar_config: JSON.parse(campaign.calendar_config),
    weather_options: JSON.parse(campaign.weather_options),
  });
});

// PUT update campaign
router.put('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options } = req.body;

  db.prepare(`
    UPDATE campaigns SET
      name = COALESCE(?, name),
      attribute_definitions = COALESCE(?, attribute_definitions),
      time_of_day_thresholds = COALESCE(?, time_of_day_thresholds),
      calendar_config = COALESCE(?, calendar_config),
      weather_options = COALESCE(?, weather_options)
    WHERE id = ?
  `).run(
    name || null,
    attribute_definitions ? JSON.stringify(attribute_definitions) : null,
    time_of_day_thresholds ? JSON.stringify(time_of_day_thresholds) : null,
    calendar_config ? JSON.stringify(calendar_config) : null,
    weather_options ? JSON.stringify(weather_options) : null,
    req.params.id,
  );

  const updated = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  res.json({
    ...updated,
    attribute_definitions: JSON.parse(updated.attribute_definitions),
    time_of_day_thresholds: JSON.parse(updated.time_of_day_thresholds),
    calendar_config: JSON.parse(updated.calendar_config),
    weather_options: JSON.parse(updated.weather_options),
  });
});

// DELETE campaign
router.delete('/:id', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
