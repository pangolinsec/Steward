const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

// GET session log (paginated)
router.get('/', (req, res) => {
  const { limit = 50, offset = 0, entry_type } = req.query;
  let query = 'SELECT * FROM session_log WHERE campaign_id = ?';
  const params = [req.params.id];

  if (entry_type) {
    query += ' AND entry_type = ?';
    params.push(entry_type);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const entries = db.prepare(query).all(...params);
  res.json({ entries, total, limit: Number(limit), offset: Number(offset) });
});

// POST manual entry
router.post('/', (req, res) => {
  const { entry_type, message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const result = db.prepare(`
    INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)
  `).run(req.params.id, entry_type || 'manual', message);

  const entry = db.prepare('SELECT * FROM session_log WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(entry);
});

// DELETE clear log
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM session_log WHERE campaign_id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
