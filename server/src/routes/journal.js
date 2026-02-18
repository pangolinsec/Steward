const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

function parseNote(n) {
  let tags = [];
  try {
    const parsed = JSON.parse(n.tags || '[]');
    tags = Array.isArray(parsed) ? parsed : String(parsed).split(',').map(t => t.trim()).filter(Boolean);
  } catch { /* leave as empty array */ }
  return { ...n, tags, starred: !!n.starred };
}

// GET list notes
router.get('/', (req, res) => {
  const { search, tag, starred, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM journal_notes WHERE campaign_id = ?';
  const params = [req.params.id];

  if (search) {
    query += ' AND (title LIKE ? OR content LIKE ?)';
    const like = `%${search}%`;
    params.push(like, like);
  }
  if (tag) {
    query += ' AND tags LIKE ?';
    params.push(`%"${tag}"%`);
  }
  if (starred === '1') {
    query += ' AND starred = 1';
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  query += ' ORDER BY starred DESC, updated_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const notes = db.prepare(query).all(...params);
  res.json({ notes: notes.map(parseNote), total });
});

// GET search entities for wikilink autocomplete
router.get('/search-entities', (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  const like = `%${q}%`;
  const campaignId = req.params.id;

  const results = db.prepare(`
    SELECT 'character' as entity_type, id, name FROM characters WHERE campaign_id = ? AND name LIKE ?
    UNION ALL
    SELECT 'location' as entity_type, id, name FROM locations WHERE campaign_id = ? AND name LIKE ?
    UNION ALL
    SELECT 'item' as entity_type, id, name FROM item_definitions WHERE campaign_id = ? AND name LIKE ?
    UNION ALL
    SELECT 'effect' as entity_type, id, name FROM status_effect_definitions WHERE campaign_id = ? AND name LIKE ?
    LIMIT 10
  `).all(campaignId, like, campaignId, like, campaignId, like, campaignId, like);

  res.json(results);
});

// GET single note
router.get('/:noteId', (req, res) => {
  const note = db.prepare('SELECT * FROM journal_notes WHERE id = ? AND campaign_id = ?')
    .get(req.params.noteId, req.params.id);
  if (!note) return res.status(404).json({ error: 'Note not found' });
  res.json(parseNote(note));
});

// POST create note
router.post('/', (req, res) => {
  let { title = '', content = '', tags = [], starred = false } = req.body;
  if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim()).filter(Boolean);
  const result = db.prepare(`
    INSERT INTO journal_notes (campaign_id, title, content, tags, starred) VALUES (?, ?, ?, ?, ?)
  `).run(req.params.id, title, content, JSON.stringify(tags), starred ? 1 : 0);
  const note = db.prepare('SELECT * FROM journal_notes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseNote(note));
});

// PUT update note
router.put('/:noteId', (req, res) => {
  const existing = db.prepare('SELECT * FROM journal_notes WHERE id = ? AND campaign_id = ?')
    .get(req.params.noteId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Note not found' });

  let { title, content, tags, starred } = req.body;
  if (typeof tags === 'string') tags = tags.split(',').map(t => t.trim()).filter(Boolean);
  db.prepare(`
    UPDATE journal_notes SET
      title = COALESCE(?, title),
      content = COALESCE(?, content),
      tags = COALESCE(?, tags),
      starred = COALESCE(?, starred),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title !== undefined ? title : null,
    content !== undefined ? content : null,
    tags !== undefined ? JSON.stringify(tags) : null,
    starred !== undefined ? (starred ? 1 : 0) : null,
    req.params.noteId,
  );

  const note = db.prepare('SELECT * FROM journal_notes WHERE id = ?').get(req.params.noteId);
  res.json(parseNote(note));
});

// DELETE note
router.delete('/:noteId', (req, res) => {
  const existing = db.prepare('SELECT * FROM journal_notes WHERE id = ? AND campaign_id = ?')
    .get(req.params.noteId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Note not found' });
  db.prepare('DELETE FROM journal_notes WHERE id = ?').run(req.params.noteId);
  res.json({ success: true });
});

module.exports = router;
