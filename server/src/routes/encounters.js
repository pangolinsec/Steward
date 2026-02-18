const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

function fireRules(campaignId, triggerType, triggerContext) {
  try {
    const { evaluateRules } = require('../rulesEngine/engine');
    return evaluateRules(campaignId, triggerType, triggerContext);
  } catch (e) {
    console.error(`Rules engine error (${triggerType}):`, e.message);
    return { fired: [], notifications: [], events: [] };
  }
}

// GET all encounters for campaign
router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM encounter_definitions WHERE campaign_id = ?';
  const params = [req.params.id];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name';
  const encounters = db.prepare(query).all(...params);
  res.json(encounters.map(e => ({
    ...e,
    npcs: JSON.parse(e.npcs),
    environment_overrides: JSON.parse(e.environment_overrides),
    loot_table: JSON.parse(e.loot_table),
    conditions: JSON.parse(e.conditions || '{}'),
  })));
});

// GET single
router.get('/:encId', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });
  res.json({
    ...enc,
    npcs: JSON.parse(enc.npcs),
    environment_overrides: JSON.parse(enc.environment_overrides),
    loot_table: JSON.parse(enc.loot_table),
    conditions: JSON.parse(enc.conditions || '{}'),
  });
});

// POST create
router.post('/', (req, res) => {
  const { name, description, notes, npcs, environment_overrides, loot_table, conditions } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO encounter_definitions (campaign_id, name, description, notes, npcs, environment_overrides, loot_table, conditions)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, name, description || '', notes || '',
    JSON.stringify(npcs || []),
    JSON.stringify(environment_overrides || {}),
    JSON.stringify(loot_table || []),
    JSON.stringify(conditions || {}),
  );

  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...enc,
    npcs: JSON.parse(enc.npcs),
    environment_overrides: JSON.parse(enc.environment_overrides),
    loot_table: JSON.parse(enc.loot_table),
    conditions: JSON.parse(enc.conditions || '{}'),
  });
});

// PUT update
router.put('/:encId', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });

  const { name, description, notes, npcs, environment_overrides, loot_table, conditions } = req.body;

  db.prepare(`
    UPDATE encounter_definitions SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      notes = COALESCE(?, notes),
      npcs = COALESCE(?, npcs),
      environment_overrides = COALESCE(?, environment_overrides),
      loot_table = COALESCE(?, loot_table),
      conditions = COALESCE(?, conditions)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null, description !== undefined ? description : null,
    notes !== undefined ? notes : null,
    npcs ? JSON.stringify(npcs) : null,
    environment_overrides ? JSON.stringify(environment_overrides) : null,
    loot_table ? JSON.stringify(loot_table) : null,
    conditions ? JSON.stringify(conditions) : null,
    req.params.encId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM encounter_definitions WHERE id = ?').get(req.params.encId);
  res.json({
    ...updated,
    npcs: JSON.parse(updated.npcs),
    environment_overrides: JSON.parse(updated.environment_overrides),
    loot_table: JSON.parse(updated.loot_table),
    conditions: JSON.parse(updated.conditions || '{}'),
  });
});

// DELETE
router.delete('/:encId', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });
  db.prepare('DELETE FROM encounter_definitions WHERE id = ?').run(req.params.encId);
  res.json({ success: true });
});

// POST start encounter
router.post('/:encId/start', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });

  db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'encounter_start', ?)")
    .run(req.params.id, `Encounter started: ${enc.name}`);

  const rulesResult = fireRules(req.params.id, 'on_encounter', {
    phase: 'start', encounter_id: enc.id, encounter_name: enc.name,
  });

  res.json({ success: true, encounter_name: enc.name, events: rulesResult.events });
});

// POST end encounter
router.post('/:encId/end', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });

  db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'encounter_end', ?)")
    .run(req.params.id, `Encounter ended: ${enc.name}`);

  const rulesResult = fireRules(req.params.id, 'on_encounter', {
    phase: 'end', encounter_id: enc.id, encounter_name: enc.name,
  });

  res.json({ success: true, encounter_name: enc.name, events: rulesResult.events });
});

module.exports = router;
