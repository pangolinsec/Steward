const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

function parsePrep(row) {
  let scenes = [];
  let secrets = [];
  try { scenes = JSON.parse(row.scenes || '[]'); } catch { /* */ }
  try { secrets = JSON.parse(row.secrets || '[]'); } catch { /* */ }
  return { ...row, scenes, secrets };
}

// GET list preps (newest first)
router.get('/', (req, res) => {
  const { status, limit = 50, offset = 0 } = req.query;
  let query = 'SELECT * FROM session_preps WHERE campaign_id = ?';
  const params = [req.params.id];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }

  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const total = db.prepare(countQuery).get(...params).total;

  query += ' ORDER BY updated_at DESC LIMIT ? OFFSET ?';
  params.push(Number(limit), Number(offset));

  const preps = db.prepare(query).all(...params);
  res.json({ preps: preps.map(parsePrep), total });
});

// GET active prep
router.get('/active', (req, res) => {
  const prep = db.prepare('SELECT * FROM session_preps WHERE campaign_id = ? AND status = ? LIMIT 1')
    .get(req.params.id, 'active');
  if (!prep) return res.status(404).json({ error: 'No active session prep' });
  res.json(parsePrep(prep));
});

// GET single prep
router.get('/:prepId', (req, res) => {
  const prep = db.prepare('SELECT * FROM session_preps WHERE id = ? AND campaign_id = ?')
    .get(req.params.prepId, req.params.id);
  if (!prep) return res.status(404).json({ error: 'Session prep not found' });
  res.json(parsePrep(prep));
});

// POST create prep
router.post('/', (req, res) => {
  let { title = '', strong_start = '', scenes = [], secrets = [], notes = '', carry_forward = false } = req.body;
  const campaignId = req.params.id;

  if (carry_forward) {
    const lastCompleted = db.prepare(
      'SELECT * FROM session_preps WHERE campaign_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 1'
    ).get(campaignId, 'completed');
    if (lastCompleted) {
      const oldSecrets = JSON.parse(lastCompleted.secrets || '[]');
      const carried = oldSecrets.filter(s => !s.revealed).map(s => ({ text: s.text, revealed: false }));
      secrets = [...carried, ...secrets];
    }
  }

  const result = db.prepare(`
    INSERT INTO session_preps (campaign_id, title, strong_start, scenes, secrets, notes) VALUES (?, ?, ?, ?, ?, ?)
  `).run(campaignId, title, strong_start, JSON.stringify(scenes), JSON.stringify(secrets), notes);
  const prep = db.prepare('SELECT * FROM session_preps WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parsePrep(prep));
});

// PUT update prep
router.put('/:prepId', (req, res) => {
  const existing = db.prepare('SELECT * FROM session_preps WHERE id = ? AND campaign_id = ?')
    .get(req.params.prepId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Session prep not found' });

  const { title, strong_start, scenes, secrets, notes } = req.body;
  db.prepare(`
    UPDATE session_preps SET
      title = COALESCE(?, title),
      strong_start = COALESCE(?, strong_start),
      scenes = COALESCE(?, scenes),
      secrets = COALESCE(?, secrets),
      notes = COALESCE(?, notes),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title !== undefined ? title : null,
    strong_start !== undefined ? strong_start : null,
    scenes !== undefined ? JSON.stringify(scenes) : null,
    secrets !== undefined ? JSON.stringify(secrets) : null,
    notes !== undefined ? notes : null,
    req.params.prepId,
  );

  const prep = db.prepare('SELECT * FROM session_preps WHERE id = ?').get(req.params.prepId);
  res.json(parsePrep(prep));
});

// PUT activate prep
router.put('/:prepId/activate', (req, res) => {
  const existing = db.prepare('SELECT * FROM session_preps WHERE id = ? AND campaign_id = ?')
    .get(req.params.prepId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Session prep not found' });

  // Complete any currently active prep
  db.prepare("UPDATE session_preps SET status = 'completed', updated_at = datetime('now') WHERE campaign_id = ? AND status = 'active'")
    .run(req.params.id);

  db.prepare("UPDATE session_preps SET status = 'active', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.prepId);

  const prep = db.prepare('SELECT * FROM session_preps WHERE id = ?').get(req.params.prepId);
  res.json(parsePrep(prep));
});

// PUT complete prep
router.put('/:prepId/complete', (req, res) => {
  const existing = db.prepare('SELECT * FROM session_preps WHERE id = ? AND campaign_id = ?')
    .get(req.params.prepId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Session prep not found' });

  db.prepare("UPDATE session_preps SET status = 'completed', updated_at = datetime('now') WHERE id = ?")
    .run(req.params.prepId);

  const prep = db.prepare('SELECT * FROM session_preps WHERE id = ?').get(req.params.prepId);
  res.json(parsePrep(prep));
});

// DELETE prep
router.delete('/:prepId', (req, res) => {
  const existing = db.prepare('SELECT * FROM session_preps WHERE id = ? AND campaign_id = ?')
    .get(req.params.prepId, req.params.id);
  if (!existing) return res.status(404).json({ error: 'Session prep not found' });
  db.prepare('DELETE FROM session_preps WHERE id = ?').run(req.params.prepId);
  res.json({ success: true });
});

module.exports = router;
