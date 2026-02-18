const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// GET all item definitions for campaign
router.get('/', (req, res) => {
  const { search, item_type } = req.query;
  let query = 'SELECT * FROM item_definitions WHERE campaign_id = ?';
  const params = [req.params.id];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  if (item_type) {
    query += ' AND item_type = ?';
    params.push(item_type);
  }

  query += ' ORDER BY name';
  const items = db.prepare(query).all(...params);
  res.json(items.map(i => ({
    ...i,
    properties: JSON.parse(i.properties),
    modifiers: JSON.parse(i.modifiers),
    stackable: !!i.stackable,
  })));
});

// GET single
router.get('/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM item_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });
  res.json({
    ...item,
    properties: JSON.parse(item.properties),
    modifiers: JSON.parse(item.modifiers),
    stackable: !!item.stackable,
  });
});

// POST create
router.post('/', (req, res) => {
  const { name, description, item_type, properties, stackable, modifiers } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO item_definitions (campaign_id, name, description, item_type, properties, stackable, modifiers)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, name, description || '',
    item_type || 'misc', JSON.stringify(properties || {}),
    stackable ? 1 : 0, JSON.stringify(modifiers || []),
  );

  const item = db.prepare('SELECT * FROM item_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...item,
    properties: JSON.parse(item.properties),
    modifiers: JSON.parse(item.modifiers),
    stackable: !!item.stackable,
  });
});

// PUT update
router.put('/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM item_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  const { name, description, item_type, properties, stackable, modifiers } = req.body;

  db.prepare(`
    UPDATE item_definitions SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      item_type = COALESCE(?, item_type),
      properties = COALESCE(?, properties),
      stackable = COALESCE(?, stackable),
      modifiers = COALESCE(?, modifiers)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null, description !== undefined ? description : null,
    item_type || null, properties ? JSON.stringify(properties) : null,
    stackable !== undefined ? (stackable ? 1 : 0) : null,
    modifiers ? JSON.stringify(modifiers) : null,
    req.params.itemId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM item_definitions WHERE id = ?').get(req.params.itemId);
  res.json({
    ...updated,
    properties: JSON.parse(updated.properties),
    modifiers: JSON.parse(updated.modifiers),
    stackable: !!updated.stackable,
  });
});

// DELETE
router.delete('/:itemId', (req, res) => {
  const item = db.prepare('SELECT * FROM item_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.itemId, req.params.id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  // Remove from all characters
  db.prepare('DELETE FROM character_items WHERE item_definition_id = ?').run(req.params.itemId);

  db.prepare('DELETE FROM item_definitions WHERE id = ?').run(req.params.itemId);
  res.json({ success: true });
});

module.exports = router;
