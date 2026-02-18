const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { advanceTime } = require('../advanceTimeEngine');

router.post('/', (req, res) => {
  const { rest_type } = req.body;
  if (!rest_type || !['short', 'long'].includes(rest_type)) {
    return res.status(400).json({ error: 'rest_type must be "short" or "long"' });
  }

  const campaignId = req.params.id;
  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  if (!env) return res.status(404).json({ error: 'Environment not found' });

  // Fire on_rest rules first
  let rulesEvents = [];
  try {
    const { evaluateRules } = require('../rulesEngine/engine');
    const rulesResult = evaluateRules(campaignId, 'on_rest', { rest_type });
    rulesEvents = rulesResult.events;
  } catch (e) {
    console.error('Rules engine error (on_rest):', e.message);
  }

  // Default rest durations
  const defaultHours = rest_type === 'short' ? 1 : 8;
  const hours = defaultHours;

  // Advance time
  const result = advanceTime(campaignId, { hours, minutes: 0 });

  // Record last rest time for hours_since_last_rest condition
  const finalEnv = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  const restTimeStr = `${finalEnv.current_day},${finalEnv.current_hour},${finalEnv.current_minute}`;

  // Store for all characters in the campaign
  const characters = db.prepare('SELECT id FROM characters WHERE campaign_id = ?').all(campaignId);
  for (const char of characters) {
    const existing = db.prepare(
      "SELECT id FROM rule_state WHERE character_id = ? AND state_key = 'last_rest_time'"
    ).get(char.id);
    if (existing) {
      db.prepare("UPDATE rule_state SET state_value = ?, updated_at = datetime('now') WHERE id = ?")
        .run(restTimeStr, existing.id);
    } else {
      db.prepare(
        "INSERT INTO rule_state (rule_id, character_id, state_key, state_value) VALUES (NULL, ?, 'last_rest_time', ?)"
      ).run(char.id, restTimeStr);
    }
  }

  // Log rest
  db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'rest', ?)")
    .run(campaignId, `${rest_type === 'short' ? 'Short' : 'Long'} rest taken (${hours} hours)`);

  result.events.push({ type: 'rest', rest_type, hours });
  result.events.push(...rulesEvents);

  res.json(result);
});

module.exports = router;
