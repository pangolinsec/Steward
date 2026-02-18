const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

function getCampaignConfig(campaignId) {
  const campaign = db.prepare('SELECT time_of_day_thresholds, calendar_config FROM campaigns WHERE id = ?')
    .get(campaignId);
  const defaults = db.CAMPAIGN_DEFAULTS;
  const thresholds = campaign.time_of_day_thresholds
    ? JSON.parse(campaign.time_of_day_thresholds)
    : defaults.time_of_day_thresholds;
  const calendarConfig = campaign.calendar_config
    ? JSON.parse(campaign.calendar_config)
    : defaults.calendar_config;
  return { thresholds, calendarConfig };
}

function resolveTimeOfDay(thresholds, hour, minute) {
  const totalMinutes = hour * 60 + minute;
  let label = thresholds[0]?.label || 'Unknown';
  for (const t of thresholds) {
    if (totalMinutes >= t.start * 60) label = t.label;
  }
  return label;
}

function resolveMonthName(calendarConfig, monthNum) {
  return calendarConfig.months[monthNum - 1]?.name || `Month ${monthNum}`;
}

// GET environment state
router.get('/', (req, res) => {
  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env) return res.status(404).json({ error: 'Environment not found' });

  const { thresholds, calendarConfig } = getCampaignConfig(req.params.id);

  res.json({
    ...env,
    time_of_day: resolveTimeOfDay(thresholds, env.current_hour, env.current_minute),
    month_name: resolveMonthName(calendarConfig, env.current_month),
    calendar_config: calendarConfig,
  });
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
  const { thresholds, calendarConfig } = getCampaignConfig(req.params.id);

  res.json({
    ...updated,
    time_of_day: resolveTimeOfDay(thresholds, updated.current_hour, updated.current_minute),
    month_name: resolveMonthName(calendarConfig, updated.current_month),
    calendar_config: calendarConfig,
  });
});

// POST advance time
router.post('/advance', (req, res) => {
  const { hours = 0, minutes = 0 } = req.body;
  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env) return res.status(404).json({ error: 'Environment not found' });

  const { thresholds, calendarConfig } = getCampaignConfig(req.params.id);

  let totalMinutes = env.current_hour * 60 + env.current_minute + hours * 60 + minutes;
  let day = env.current_day;
  let month = env.current_month;
  let year = env.current_year;

  while (totalMinutes >= 1440) {
    totalMinutes -= 1440;
    day++;

    const daysInMonth = calendarConfig.months[month - 1]?.days || 30;
    if (day > daysInMonth) {
      day = 1;
      month++;
      if (month > calendarConfig.months.length) {
        month = 1;
        year++;
      }
    }
  }

  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;

  db.prepare(`
    UPDATE environment_state SET
      current_hour = ?, current_minute = ?, current_day = ?, current_month = ?, current_year = ?
    WHERE campaign_id = ?
  `).run(newHour, newMinute, day, month, year, req.params.id);

  const advanceDesc = [];
  if (hours > 0) advanceDesc.push(`${hours}h`);
  if (minutes > 0) advanceDesc.push(`${minutes}m`);
  db.prepare(`INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'time_advance', ?)`)
    .run(req.params.id, `Time advanced by ${advanceDesc.join(' ')}`);

  const updated = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(req.params.id);

  res.json({
    ...updated,
    time_of_day: resolveTimeOfDay(thresholds, updated.current_hour, updated.current_minute),
    month_name: resolveMonthName(calendarConfig, updated.current_month),
    calendar_config: calendarConfig,
  });
});

module.exports = router;
