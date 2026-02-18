const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { executeAction, undoAction } = require('../rulesEngine/actionExecutor');
const { getCampaignConfig, resolveTimeOfDay } = require('../advanceTimeEngine');

// GET list notifications
router.get('/', (req, res) => {
  const { unread_only, limit, offset } = req.query;
  let query = 'SELECT * FROM notifications WHERE campaign_id = ? AND dismissed = 0';
  const params = [req.params.id];

  if (unread_only === 'true') {
    query += ' AND read = 0';
  }

  query += ' ORDER BY created_at DESC';

  if (limit) {
    query += ' LIMIT ?';
    params.push(Number(limit));
  }
  if (offset) {
    query += ' OFFSET ?';
    params.push(Number(offset));
  }

  const notifications = db.prepare(query).all(...params).map(n => ({
    ...n,
    actions_data: JSON.parse(n.actions_data || '[]'),
    read: !!n.read,
    dismissed: !!n.dismissed,
  }));
  res.json(notifications);
});

// GET unread count
router.get('/count', (req, res) => {
  const result = db.prepare(
    'SELECT COUNT(*) as count FROM notifications WHERE campaign_id = ? AND read = 0 AND dismissed = 0'
  ).get(req.params.id);
  res.json({ count: result.count });
});

// PATCH mark read
router.patch('/:nId/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND campaign_id = ?')
    .run(req.params.nId, req.params.id);
  res.json({ success: true });
});

// PATCH dismiss
router.patch('/:nId/dismiss', (req, res) => {
  db.prepare('UPDATE notifications SET dismissed = 1 WHERE id = ? AND campaign_id = ?')
    .run(req.params.nId, req.params.id);
  res.json({ success: true });
});

// POST apply suggestion
router.post('/:nId/apply', (req, res) => {
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ? AND campaign_id = ?')
    .get(req.params.nId, req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  const actions = JSON.parse(notif.actions_data || '[]');
  const campaignId = req.params.id;

  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  const config = getCampaignConfig(campaignId);
  const environment = env ? {
    ...env,
    time_of_day: resolveTimeOfDay(config.thresholds, env.current_hour, env.current_minute),
  } : null;

  let character = null;
  if (notif.target_character_id) {
    character = db.prepare('SELECT * FROM characters WHERE id = ?').get(notif.target_character_id);
  }

  const context = { campaignId, character, environment, trigger: {}, variables: {} };
  const results = [];

  for (const action of actions) {
    const result = executeAction(action, context);
    results.push(result);
  }

  // Mark as applied
  db.prepare('UPDATE notifications SET dismissed = 1 WHERE id = ?').run(req.params.nId);

  res.json({
    success: true,
    results: results.map(r => ({ success: r.success, description: r.description })),
  });
});

// POST undo auto-applied actions
router.post('/:nId/undo', (req, res) => {
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ? AND campaign_id = ?')
    .get(req.params.nId, req.params.id);
  if (!notif) return res.status(404).json({ error: 'Notification not found' });

  // Find action log entries for this batch
  const logEntries = db.prepare(
    'SELECT * FROM rule_action_log WHERE batch_id = ? AND campaign_id = ? AND undone = 0 ORDER BY action_index DESC'
  ).all(notif.batch_id, req.params.id);

  let undoneCount = 0;
  for (const entry of logEntries) {
    const undoData = JSON.parse(entry.undo_data || '{}');
    const success = undoAction(entry.action_type, undoData, req.params.id);
    if (success) {
      db.prepare('UPDATE rule_action_log SET undone = 1 WHERE id = ?').run(entry.id);
      undoneCount++;
    }
  }

  // Mark notification as dismissed
  db.prepare('UPDATE notifications SET dismissed = 1 WHERE id = ?').run(req.params.nId);

  // Create undo confirmation notification
  db.prepare(`
    INSERT INTO notifications (campaign_id, notification_type, message, severity, rule_name)
    VALUES (?, 'system', ?, 'info', '')
  `).run(req.params.id, `Undid ${undoneCount} action(s) from rule "${notif.rule_name}"`);

  res.json({ success: true, undone: undoneCount });
});

// DELETE clear all
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE campaign_id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
