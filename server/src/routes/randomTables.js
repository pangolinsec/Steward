const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// GET all tables for campaign
router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM random_tables WHERE campaign_id = ?';
  const params = [req.params.id];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name';
  const tables = db.prepare(query).all(...params);
  res.json(tables.map(t => ({
    ...t,
    entries: JSON.parse(t.entries),
  })));
});

// GET single table
router.get('/:tableId', (req, res) => {
  const table = db.prepare('SELECT * FROM random_tables WHERE id = ? AND campaign_id = ?')
    .get(req.params.tableId, req.params.id);
  if (!table) return res.status(404).json({ error: 'Random table not found' });
  res.json({ ...table, entries: JSON.parse(table.entries) });
});

// POST create table
router.post('/', (req, res) => {
  const { name, description, table_type, entries } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO random_tables (campaign_id, name, description, table_type, entries)
    VALUES (?, ?, ?, ?, ?)
  `).run(
    req.params.id, name, description || '',
    table_type || 'weighted',
    JSON.stringify(entries || []),
  );

  const table = db.prepare('SELECT * FROM random_tables WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ ...table, entries: JSON.parse(table.entries) });
});

// PUT update table
router.put('/:tableId', (req, res) => {
  const table = db.prepare('SELECT * FROM random_tables WHERE id = ? AND campaign_id = ?')
    .get(req.params.tableId, req.params.id);
  if (!table) return res.status(404).json({ error: 'Random table not found' });

  const { name, description, table_type, entries } = req.body;

  db.prepare(`
    UPDATE random_tables SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      table_type = COALESCE(?, table_type),
      entries = COALESCE(?, entries)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null,
    description !== undefined ? description : null,
    table_type || null,
    entries ? JSON.stringify(entries) : null,
    req.params.tableId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM random_tables WHERE id = ?').get(req.params.tableId);
  res.json({ ...updated, entries: JSON.parse(updated.entries) });
});

// DELETE table
router.delete('/:tableId', (req, res) => {
  const table = db.prepare('SELECT * FROM random_tables WHERE id = ? AND campaign_id = ?')
    .get(req.params.tableId, req.params.id);
  if (!table) return res.status(404).json({ error: 'Random table not found' });
  db.prepare('DELETE FROM random_tables WHERE id = ?').run(req.params.tableId);
  res.json({ success: true });
});

// POST roll on table
router.post('/:tableId/roll', (req, res) => {
  const table = db.prepare('SELECT * FROM random_tables WHERE id = ? AND campaign_id = ?')
    .get(req.params.tableId, req.params.id);
  if (!table) return res.status(404).json({ error: 'Random table not found' });

  const entries = JSON.parse(table.entries);
  if (entries.length === 0) return res.status(400).json({ error: 'Table has no entries' });

  let result;
  let roll;
  const tableType = table.table_type || 'weighted';

  if (tableType === 'sequential') {
    roll = Math.floor(Math.random() * entries.length) + 1;
    result = entries[roll - 1];
  } else {
    // Weighted
    const totalWeight = entries.reduce((sum, e) => sum + (e.weight || 1), 0);
    roll = Math.random() * totalWeight;
    let cumulative = 0;
    for (const entry of entries) {
      cumulative += (entry.weight || 1);
      if (roll < cumulative) {
        result = entry;
        break;
      }
    }
    if (!result) result = entries[entries.length - 1];
    roll = Math.round(roll * 100) / 100;
  }

  db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'table_roll', ?)")
    .run(req.params.id, `Rolled on "${table.name}": ${result.text}`);

  res.json({
    result: result.text,
    roll,
    total_weight: tableType === 'weighted' ? entries.reduce((sum, e) => sum + (e.weight || 1), 0) : entries.length,
    table_name: table.name,
  });
});

module.exports = router;
