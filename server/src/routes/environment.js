const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { advanceTime, getCampaignConfig, resolveTimeOfDay, resolveMonthName } = require('../advanceTimeEngine');

function buildEnvResponse(env, campaignId) {
  const config = getCampaignConfig(campaignId);
  const locationName = env.current_location_id
    ? db.prepare('SELECT name FROM locations WHERE id = ?').get(env.current_location_id)?.name
    : null;
  return {
    ...env,
    time_of_day: resolveTimeOfDay(config.thresholds, env.current_hour, env.current_minute),
    month_name: resolveMonthName(config.calendarConfig, env.current_month),
    calendar_config: config.calendarConfig,
    current_location_name: locationName,
  };
}

// GET environment state
router.get('/', (req, res) => {
  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env) return res.status(404).json({ error: 'Environment not found' });
  res.json(buildEnvResponse(env, req.params.id));
});

// PATCH update environment
router.patch('/', (req, res) => {
  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env) return res.status(404).json({ error: 'Environment not found' });

  const { current_hour, current_minute, current_day, current_month, current_year, weather, environment_notes } = req.body;

  const updates = [];
  const params = [];

  if (current_hour !== undefined) { updates.push('current_hour = ?'); params.push(current_hour); }
  if (current_minute !== undefined) { updates.push('current_minute = ?'); params.push(current_minute); }
  if (current_day !== undefined) { updates.push('current_day = ?'); params.push(current_day); }
  if (current_month !== undefined) { updates.push('current_month = ?'); params.push(current_month); }
  if (current_year !== undefined) { updates.push('current_year = ?'); params.push(current_year); }
  if (weather !== undefined) { updates.push('weather = ?'); params.push(weather); }
  if (environment_notes !== undefined) { updates.push('environment_notes = ?'); params.push(environment_notes); }

  if (updates.length > 0) {
    params.push(req.params.id);
    db.prepare(`UPDATE environment_state SET ${updates.join(', ')} WHERE campaign_id = ?`).run(...params);

    const changes = [];
    if (weather !== undefined) changes.push(`Weather changed to "${weather}"`);
    if (current_hour !== undefined || current_minute !== undefined) changes.push(`Time set manually`);
    if (changes.length > 0) {
      db.prepare(`INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'environment', ?)`)
        .run(req.params.id, changes.join('; '));
    }
  }

  const updated = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  res.json(buildEnvResponse(updated, req.params.id));
});

// POST advance time
router.post('/advance', (req, res) => {
  try {
    const { hours = 0, minutes = 0 } = req.body;
    const result = advanceTime(req.params.id, { hours, minutes });
    res.json(result);
  } catch (e) {
    if (e.message === 'Environment not found') {
      return res.status(404).json({ error: e.message });
    }
    throw e;
  }
});

module.exports = router;
