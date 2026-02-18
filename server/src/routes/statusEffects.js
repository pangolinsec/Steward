const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// GET all status effect definitions for campaign
router.get('/', (req, res) => {
  const { search, tag } = req.query;
  let query = 'SELECT * FROM status_effect_definitions WHERE campaign_id = ?';
  const params = [req.params.id];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name';
  let effects = db.prepare(query).all(...params);

  effects = effects.map(e => ({
    ...e,
    tags: JSON.parse(e.tags),
    modifiers: JSON.parse(e.modifiers),
  }));

  if (tag) {
    effects = effects.filter(e => e.tags.includes(tag));
  }

  res.json(effects);
});

// GET single
router.get('/:effectId', (req, res) => {
  const effect = db.prepare('SELECT * FROM status_effect_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.effectId, req.params.id);
  if (!effect) return res.status(404).json({ error: 'Status effect not found' });
  res.json({ ...effect, tags: JSON.parse(effect.tags), modifiers: JSON.parse(effect.modifiers) });
});

// POST create
router.post('/', (req, res) => {
  const { name, description, tags, modifiers, duration_type, duration_value } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO status_effect_definitions (campaign_id, name, description, tags, modifiers, duration_type, duration_value)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, name, description || '',
    JSON.stringify(tags || []), JSON.stringify(modifiers || []),
    duration_type || 'indefinite', duration_value || 0,
  );

  const effect = db.prepare('SELECT * FROM status_effect_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...effect, tags: JSON.parse(effect.tags), modifiers: JSON.parse(effect.modifiers) });
});

// PUT update
router.put('/:effectId', (req, res) => {
  const effect = db.prepare('SELECT * FROM status_effect_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.effectId, req.params.id);
  if (!effect) return res.status(404).json({ error: 'Status effect not found' });

  const { name, description, tags, modifiers, duration_type, duration_value } = req.body;

  db.prepare(`
    UPDATE status_effect_definitions SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      tags = COALESCE(?, tags),
      modifiers = COALESCE(?, modifiers),
      duration_type = COALESCE(?, duration_type),
      duration_value = COALESCE(?, duration_value)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null, description !== undefined ? description : null,
    tags ? JSON.stringify(tags) : null, modifiers ? JSON.stringify(modifiers) : null,
    duration_type || null, duration_value !== undefined ? duration_value : null,
    req.params.effectId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM status_effect_definitions WHERE id = ?').get(req.params.effectId);
  res.json({ ...updated, tags: JSON.parse(updated.tags), modifiers: JSON.parse(updated.modifiers) });
});

// DELETE
router.delete('/:effectId', (req, res) => {
  const effect = db.prepare('SELECT * FROM status_effect_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.effectId, req.params.id);
  if (!effect) return res.status(404).json({ error: 'Status effect not found' });

  // Remove all applied instances
  db.prepare(`
    DELETE FROM applied_effects WHERE status_effect_definition_id = ?
  `).run(req.params.effectId);

  db.prepare('DELETE FROM status_effect_definitions WHERE id = ?').run(req.params.effectId);
  res.json({ success: true });
});

module.exports = router;
