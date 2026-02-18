const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { getComputedStats } = require('../computedStats');

function fireRules(campaignId, triggerType, triggerContext) {
  try {
    const { evaluateRules, checkThresholds } = require('../rulesEngine/engine');
    return evaluateRules(campaignId, triggerType, triggerContext);
  } catch (e) {
    console.error(`Rules engine error (${triggerType}):`, e.message);
    return { fired: [], notifications: [], events: [] };
  }
}

// GET all characters for a campaign
router.get('/', (req, res) => {
  const { id } = req.params;
  const { type, search, include_spawned, include_archived } = req.query;

  let query = 'SELECT * FROM characters WHERE campaign_id = ?';
  const params = [id];

  if (!include_spawned) {
    query += ' AND spawned_from_encounter_id IS NULL';
  }
  if (!include_archived) {
    query += ' AND (archived = 0 OR archived IS NULL)';
  }
  if (type && (type === 'PC' || type === 'NPC')) {
    query += ' AND type = ?';
    params.push(type);
  }
  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY type, name';
  const characters = db.prepare(query).all(...params);
  const charIds = characters.map(c => c.id);

  // Bulk-fetch applied effects for all characters in one query
  const effectsByChar = {};
  if (charIds.length > 0) {
    const placeholders = charIds.map(() => '?').join(',');
    const effects = db.prepare(`
      SELECT ae.id, ae.character_id, ae.remaining_rounds, ae.remaining_hours,
             sed.name, sed.tags, sed.duration_type
      FROM applied_effects ae
      JOIN status_effect_definitions sed ON ae.status_effect_definition_id = sed.id
      WHERE ae.character_id IN (${placeholders})
    `).all(...charIds);
    for (const e of effects) {
      if (!effectsByChar[e.character_id]) effectsByChar[e.character_id] = [];
      effectsByChar[e.character_id].push({
        id: e.id, name: e.name, tags: JSON.parse(e.tags || '[]'),
        duration_type: e.duration_type,
        remaining_rounds: e.remaining_rounds, remaining_hours: e.remaining_hours,
      });
    }
  }

  res.json(characters.map(c => ({
    ...c,
    base_attributes: JSON.parse(c.base_attributes),
    max_attributes: JSON.parse(c.max_attributes || '{}'),
    archived: !!c.archived,
    applied_effects: effectsByChar[c.id] || [],
  })));
});

// GET single character
router.get('/:charId', (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?')
    .get(req.params.charId, req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });
  res.json({ ...char, base_attributes: JSON.parse(char.base_attributes), max_attributes: JSON.parse(char.max_attributes || '{}'), archived: !!char.archived });
});

// GET computed stats for a character
router.get('/:charId/computed', (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?')
    .get(req.params.charId, req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });

  const stats = getComputedStats(req.params.charId);
  if (!stats) return res.status(404).json({ error: 'Character not found' });
  res.json(stats);
});

// POST create character
router.post('/', (req, res) => {
  const { name, type, description, portrait_url, base_attributes, max_attributes, dm_notes } = req.body;
  if (!name || !type) return res.status(400).json({ error: 'Name and type are required' });

  const result = db.prepare(`
    INSERT INTO characters (campaign_id, name, type, description, portrait_url, base_attributes, max_attributes, dm_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, name, type,
    description || '', portrait_url || '',
    JSON.stringify(base_attributes || {}),
    JSON.stringify(max_attributes || {}),
    dm_notes || '',
  );

  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...char, base_attributes: JSON.parse(char.base_attributes), max_attributes: JSON.parse(char.max_attributes || '{}'), archived: !!char.archived });
});

// PUT update character
router.put('/:charId', (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?')
    .get(req.params.charId, req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });

  const { name, type, description, portrait_url, base_attributes, max_attributes, dm_notes, archived } = req.body;

  db.prepare(`
    UPDATE characters SET
      name = COALESCE(?, name),
      type = COALESCE(?, type),
      description = COALESCE(?, description),
      portrait_url = COALESCE(?, portrait_url),
      base_attributes = COALESCE(?, base_attributes),
      max_attributes = COALESCE(?, max_attributes),
      dm_notes = COALESCE(?, dm_notes),
      archived = COALESCE(?, archived)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null, type || null,
    description !== undefined ? description : null,
    portrait_url !== undefined ? portrait_url : null,
    base_attributes ? JSON.stringify(base_attributes) : null,
    max_attributes ? JSON.stringify(max_attributes) : null,
    dm_notes !== undefined ? dm_notes : null,
    archived !== undefined ? (archived ? 1 : 0) : null,
    req.params.charId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM characters WHERE id = ?').get(req.params.charId);
  res.json({ ...updated, base_attributes: JSON.parse(updated.base_attributes), max_attributes: JSON.parse(updated.max_attributes || '{}'), archived: !!updated.archived });
});

// DELETE character
router.delete('/:charId', (req, res) => {
  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?')
    .get(req.params.charId, req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });
  db.prepare('DELETE FROM characters WHERE id = ?').run(req.params.charId);
  res.json({ success: true });
});

// === Applied Effects ===

// POST apply effect to character
router.post('/:charId/effects', (req, res) => {
  const { status_effect_definition_id } = req.body;
  if (!status_effect_definition_id) return res.status(400).json({ error: 'status_effect_definition_id required' });

  const effect = db.prepare('SELECT * FROM status_effect_definitions WHERE id = ? AND campaign_id = ?')
    .get(status_effect_definition_id, req.params.id);
  if (!effect) return res.status(404).json({ error: 'Status effect not found' });

  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?')
    .get(req.params.charId, req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });

  let remainingRounds = null;
  let remainingHours = null;
  if (effect.duration_type === 'rounds') remainingRounds = effect.duration_value;
  if (effect.duration_type === 'timed') remainingHours = effect.duration_value;

  const result = db.prepare(`
    INSERT INTO applied_effects (character_id, status_effect_definition_id, remaining_rounds, remaining_hours)
    VALUES (?, ?, ?, ?)
  `).run(req.params.charId, status_effect_definition_id, remainingRounds, remainingHours);

  // Log it
  db.prepare(`INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'effect_applied', ?)`)
    .run(req.params.id, `Applied "${effect.name}" to "${char.name}"`);

  // Fire on_effect_change rules
  const beforeStats = getComputedStats(req.params.charId);
  fireRules(req.params.id, 'on_effect_change', {
    change_type: 'applied', effect_name: effect.name, character_id: Number(req.params.charId),
  });
  const afterStats = getComputedStats(req.params.charId);
  if (beforeStats && afterStats) {
    try {
      const { checkThresholds } = require('../rulesEngine/engine');
      checkThresholds(req.params.id, Number(req.params.charId), beforeStats.effective, afterStats.effective);
    } catch {}
  }

  const applied = db.prepare('SELECT * FROM applied_effects WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(applied);
});

// DELETE remove effect from character
router.delete('/:charId/effects/:effectId', (req, res) => {
  const applied = db.prepare(`
    SELECT ae.*, sed.name as effect_name, c.name as char_name
    FROM applied_effects ae
    JOIN status_effect_definitions sed ON ae.status_effect_definition_id = sed.id
    JOIN characters c ON ae.character_id = c.id
    WHERE ae.id = ? AND ae.character_id = ?
  `).get(req.params.effectId, req.params.charId);
  if (!applied) return res.status(404).json({ error: 'Applied effect not found' });

  const beforeStats = getComputedStats(req.params.charId);
  db.prepare('DELETE FROM applied_effects WHERE id = ?').run(req.params.effectId);

  db.prepare(`INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'effect_removed', ?)`)
    .run(req.params.id, `Removed "${applied.effect_name}" from "${applied.char_name}"`);

  // Fire on_effect_change rules
  fireRules(req.params.id, 'on_effect_change', {
    change_type: 'removed', effect_name: applied.effect_name, character_id: Number(req.params.charId),
  });
  const afterStats = getComputedStats(req.params.charId);
  if (beforeStats && afterStats) {
    try {
      const { checkThresholds } = require('../rulesEngine/engine');
      checkThresholds(req.params.id, Number(req.params.charId), beforeStats.effective, afterStats.effective);
    } catch {}
  }

  res.json({ success: true });
});

// === Character Items ===

// POST assign item to character
router.post('/:charId/items', (req, res) => {
  const { item_definition_id, quantity } = req.body;
  if (!item_definition_id) return res.status(400).json({ error: 'item_definition_id required' });

  const item = db.prepare('SELECT * FROM item_definitions WHERE id = ? AND campaign_id = ?')
    .get(item_definition_id, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const char = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?')
    .get(req.params.charId, req.params.id);
  if (!char) return res.status(404).json({ error: 'Character not found' });

  // Check if stackable item already exists
  if (item.stackable) {
    const existing = db.prepare(
      'SELECT * FROM character_items WHERE character_id = ? AND item_definition_id = ?'
    ).get(req.params.charId, item_definition_id);
    if (existing) {
      db.prepare('UPDATE character_items SET quantity = quantity + ? WHERE id = ?')
        .run(quantity || 1, existing.id);
      const updated = db.prepare('SELECT * FROM character_items WHERE id = ?').get(existing.id);
      return res.json(updated);
    }
  }

  const result = db.prepare(`
    INSERT INTO character_items (character_id, item_definition_id, quantity) VALUES (?, ?, ?)
  `).run(req.params.charId, item_definition_id, quantity || 1);

  db.prepare(`INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'item_assigned', ?)`)
    .run(req.params.id, `Gave "${item.name}" to "${char.name}"`);

  fireRules(req.params.id, 'on_item_change', {
    change_type: 'assigned', item_name: item.name, character_id: Number(req.params.charId),
  });

  const charItem = db.prepare('SELECT * FROM character_items WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(charItem);
});

// PATCH update item quantity
router.patch('/:charId/items/:itemId', (req, res) => {
  const { quantity } = req.body;
  if (quantity === undefined) return res.status(400).json({ error: 'quantity required' });

  const charItem = db.prepare('SELECT * FROM character_items WHERE id = ? AND character_id = ?')
    .get(req.params.itemId, req.params.charId);
  if (!charItem) return res.status(404).json({ error: 'Character item not found' });

  if (quantity <= 0) {
    db.prepare('DELETE FROM character_items WHERE id = ?').run(req.params.itemId);
    return res.json({ success: true, deleted: true });
  }

  db.prepare('UPDATE character_items SET quantity = ? WHERE id = ?').run(quantity, req.params.itemId);
  const updated = db.prepare('SELECT * FROM character_items WHERE id = ?').get(req.params.itemId);
  res.json(updated);
});

// DELETE remove item from character
router.delete('/:charId/items/:itemId', (req, res) => {
  const charItem = db.prepare(`
    SELECT ci.*, id.name as item_name, c.name as char_name
    FROM character_items ci
    JOIN item_definitions id ON ci.item_definition_id = id.id
    JOIN characters c ON ci.character_id = c.id
    WHERE ci.id = ? AND ci.character_id = ?
  `).get(req.params.itemId, req.params.charId);
  if (!charItem) return res.status(404).json({ error: 'Character item not found' });

  db.prepare('DELETE FROM character_items WHERE id = ?').run(req.params.itemId);

  db.prepare(`INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'item_removed', ?)`)
    .run(req.params.id, `Removed "${charItem.item_name}" from "${charItem.char_name}"`);

  fireRules(req.params.id, 'on_item_change', {
    change_type: 'removed', item_name: charItem.item_name, character_id: Number(req.params.charId),
  });

  res.json({ success: true });
});

module.exports = router;
