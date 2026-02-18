const db = require('./db');

function getCampaignConfig(campaignId) {
  const campaign = db.prepare(
    'SELECT time_of_day_thresholds, calendar_config, weather_options, weather_volatility, weather_transition_table, encounter_settings FROM campaigns WHERE id = ?'
  ).get(campaignId);
  const defaults = db.CAMPAIGN_DEFAULTS;
  return {
    thresholds: campaign.time_of_day_thresholds ? JSON.parse(campaign.time_of_day_thresholds) : defaults.time_of_day_thresholds,
    calendarConfig: campaign.calendar_config ? JSON.parse(campaign.calendar_config) : defaults.calendar_config,
    weatherOptions: campaign.weather_options ? JSON.parse(campaign.weather_options) : defaults.weather_options,
    weatherVolatility: campaign.weather_volatility ?? defaults.weather_volatility,
    weatherTransitionTable: campaign.weather_transition_table ? JSON.parse(campaign.weather_transition_table) : defaults.weather_transition_table,
    encounterSettings: campaign.encounter_settings ? JSON.parse(campaign.encounter_settings) : defaults.encounter_settings,
  };
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

const DEFAULT_ADJACENCY = {
  'Clear':      ['Overcast', 'Windy'],
  'Overcast':   ['Clear', 'Rain', 'Fog', 'Windy', 'Snow'],
  'Rain':       ['Overcast', 'Heavy Rain', 'Fog'],
  'Heavy Rain': ['Rain', 'Storm'],
  'Storm':      ['Heavy Rain', 'Hail', 'Windy'],
  'Windy':      ['Clear', 'Overcast', 'Storm'],
  'Fog':        ['Overcast', 'Rain'],
  'Snow':       ['Overcast', 'Hail'],
  'Hail':       ['Storm', 'Snow'],
};

function generateDefaultTransitionTable(weatherOptions) {
  const table = {};
  if (weatherOptions.length === 0) return table;

  for (const from of weatherOptions) {
    const row = {};
    const neighbors = DEFAULT_ADJACENCY[from];
    const selfWeight = 4;
    let total = 0;

    for (const to of weatherOptions) {
      if (from === to) {
        row[to] = selfWeight;
      } else if (neighbors && neighbors.includes(to)) {
        row[to] = 1;
      } else if (!neighbors) {
        // Unknown weather type: connect to everything with low weight
        row[to] = 0.3;
      } else {
        row[to] = 0;
      }
      total += row[to];
    }

    for (const to of weatherOptions) {
      row[to] = total > 0 ? Math.round((row[to] / total) * 1000) / 1000 : 0;
    }
    table[from] = row;
  }
  return table;
}

function rollWeatherTransition(currentWeather, config, location) {
  const { weatherOptions, weatherVolatility, weatherTransitionTable } = config;
  if (!weatherOptions || weatherOptions.length === 0) return { changed: false, from: currentWeather, to: currentWeather };

  // Fixed location override — no roll needed
  if (location?.weather_override) {
    const override = typeof location.weather_override === 'string'
      ? JSON.parse(location.weather_override) : location.weather_override;
    if (override?.mode === 'fixed' && override.value) {
      const to = override.value;
      return { changed: to !== currentWeather, from: currentWeather, to };
    }
  }

  const table = weatherTransitionTable || generateDefaultTransitionTable(weatherOptions);
  let row = table[currentWeather];
  if (!row) {
    // Current weather not in table — stay the same
    return { changed: false, from: currentWeather, to: currentWeather };
  }

  // Copy probabilities
  const probs = {};
  for (const w of weatherOptions) {
    probs[w] = row[w] || 0;
  }

  // Apply volatility: scale "stay same" down
  if (probs[currentWeather] !== undefined) {
    const staySame = probs[currentWeather] * (1 - weatherVolatility);
    const removed = probs[currentWeather] - staySame;
    probs[currentWeather] = staySame;
    // Redistribute removed probability proportionally to other options
    const otherTotal = Object.entries(probs)
      .filter(([w]) => w !== currentWeather)
      .reduce((sum, [, v]) => sum + v, 0);
    if (otherTotal > 0) {
      for (const w of weatherOptions) {
        if (w !== currentWeather) {
          probs[w] += removed * (probs[w] / otherTotal);
        }
      }
    }
  }

  // Apply weighted location override — blend in location weights
  if (location?.weather_override) {
    const override = typeof location.weather_override === 'string'
      ? JSON.parse(location.weather_override) : location.weather_override;
    if (override?.mode === 'weighted' && override.value) {
      const weights = override.value;
      const blendFactor = 0.5;
      for (const w of weatherOptions) {
        const locWeight = weights[w] || 0;
        probs[w] = probs[w] * (1 - blendFactor) + locWeight * blendFactor;
      }
      // Re-normalize
      const total = Object.values(probs).reduce((s, v) => s + v, 0);
      if (total > 0) {
        for (const w of weatherOptions) probs[w] /= total;
      }
    }
  }

  // Roll
  const roll = Math.random();
  let cumulative = 0;
  let newWeather = currentWeather;
  for (const w of weatherOptions) {
    cumulative += probs[w] || 0;
    if (roll <= cumulative) {
      newWeather = w;
      break;
    }
  }

  return { changed: newWeather !== currentWeather, from: currentWeather, to: newWeather };
}

function rollEncounter(campaignId, config, env, hoursAdvanced) {
  const { encounterSettings } = config;
  if (!encounterSettings?.enabled) return { triggered: false, encounter: null, probability: 0 };

  const baseRate = encounterSettings.base_rate || 0.1;
  const minInterval = encounterSettings.min_interval_hours ?? 1;

  // Check min interval using game time (stored as "day,hour,minute")
  if (env.last_encounter_at && minInterval > 0) {
    const parts = env.last_encounter_at.split(',');
    if (parts.length === 3) {
      const [lastDay, lastHour, lastMinute] = parts.map(Number);
      const lastTotal = lastDay * 1440 + lastHour * 60 + lastMinute;
      const nowTotal = env.current_day * 1440 + env.current_hour * 60 + env.current_minute;
      const minutesSince = nowTotal - lastTotal;
      if (minutesSince < minInterval * 60) return { triggered: false, encounter: null, probability: 0 };
    }
  }

  // Cumulative probability: P = 1 - (1 - base_rate)^hours
  let probability = 1 - Math.pow(1 - baseRate, hoursAdvanced);

  // Apply location/edge modifier
  let modifier = 1.0;
  if (env.current_edge_id) {
    const edge = db.prepare('SELECT encounter_modifier FROM location_edges WHERE id = ?').get(env.current_edge_id);
    if (edge) modifier = edge.encounter_modifier;
  } else if (env.current_location_id) {
    const loc = db.prepare('SELECT encounter_modifier FROM locations WHERE id = ?').get(env.current_location_id);
    if (loc) modifier = loc.encounter_modifier;
  }
  probability = Math.min(1, Math.max(0, probability * modifier));

  const roll = Math.random();
  if (roll >= probability) return { triggered: false, encounter: null, probability };

  // Find eligible encounters
  const timeOfDay = resolveTimeOfDay(config.thresholds, env.current_hour, env.current_minute);
  const allEncounters = db.prepare('SELECT * FROM encounter_definitions WHERE campaign_id = ?').all(campaignId);

  const eligible = allEncounters.filter(enc => {
    const conds = enc.conditions ? JSON.parse(enc.conditions) : {};
    if (conds.location_ids?.length > 0) {
      const locId = env.current_location_id;
      if (!locId || !conds.location_ids.includes(locId)) return false;
    }
    if (conds.time_of_day?.length > 0) {
      if (!conds.time_of_day.includes(timeOfDay)) return false;
    }
    if (conds.weather?.length > 0) {
      if (!conds.weather.includes(env.weather)) return false;
    }
    return true;
  });

  if (eligible.length === 0) return { triggered: false, encounter: null, probability };

  // Weighted random selection
  const weights = eligible.map(enc => {
    const conds = enc.conditions ? JSON.parse(enc.conditions) : {};
    return conds.weight || 1.0;
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0);
  let weightRoll = Math.random() * totalWeight;
  let selected = eligible[0];
  for (let i = 0; i < eligible.length; i++) {
    weightRoll -= weights[i];
    if (weightRoll <= 0) { selected = eligible[i]; break; }
  }

  // Parse JSON fields for the response
  const encounter = {
    ...selected,
    npcs: JSON.parse(selected.npcs || '[]'),
    environment_overrides: JSON.parse(selected.environment_overrides || '{}'),
    loot_table: JSON.parse(selected.loot_table || '[]'),
    conditions: JSON.parse(selected.conditions || '{}'),
  };

  // Update last_encounter_at using game time
  db.prepare('UPDATE environment_state SET last_encounter_at = ? WHERE campaign_id = ?')
    .run(`${env.current_day},${env.current_hour},${env.current_minute}`, campaignId);

  return { triggered: true, encounter, probability };
}

function advanceTime(campaignId, { hours = 0, minutes = 0 }) {
  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  if (!env) throw new Error('Environment not found');

  const config = getCampaignConfig(campaignId);
  const events = [];

  // Calculate new time
  let totalMinutes = env.current_hour * 60 + env.current_minute + hours * 60 + minutes;
  let day = env.current_day;
  let month = env.current_month;
  let year = env.current_year;

  while (totalMinutes >= 1440) {
    totalMinutes -= 1440;
    day++;
    const daysInMonth = config.calendarConfig.months[month - 1]?.days || 30;
    if (day > daysInMonth) {
      day = 1;
      month++;
      if (month > config.calendarConfig.months.length) {
        month = 1;
        year++;
      }
    }
  }

  const newHour = Math.floor(totalMinutes / 60);
  const newMinute = totalMinutes % 60;

  // Log time advance
  const advanceDesc = [];
  if (hours > 0) advanceDesc.push(`${hours}h`);
  if (minutes > 0) advanceDesc.push(`${minutes}m`);
  events.push({ type: 'time_advance', description: `Time advanced by ${advanceDesc.join(' ')}` });

  // Weather transitions — roll once per hour advanced
  let currentWeather = env.weather;
  const totalHours = hours + minutes / 60;
  const rollCount = Math.max(1, Math.floor(totalHours));
  // Use edge weather override during travel, otherwise location override
  let weatherSource = null;
  if (env.current_edge_id) {
    const edge = db.prepare('SELECT * FROM location_edges WHERE id = ?').get(env.current_edge_id);
    if (edge?.weather_override) {
      weatherSource = { weather_override: JSON.parse(edge.weather_override) };
    }
  } else if (env.current_location_id) {
    weatherSource = db.prepare('SELECT * FROM locations WHERE id = ?').get(env.current_location_id);
  }

  for (let i = 0; i < rollCount; i++) {
    const result = rollWeatherTransition(currentWeather, config, weatherSource);
    if (result.changed) {
      events.push({ type: 'weather_change', from: result.from, to: result.to });
      currentWeather = result.to;
    }
  }

  // Update DB with new time and weather
  db.prepare(`
    UPDATE environment_state SET
      current_hour = ?, current_minute = ?, current_day = ?, current_month = ?, current_year = ?, weather = ?
    WHERE campaign_id = ?
  `).run(newHour, newMinute, day, month, year, currentWeather, campaignId);

  // Effect duration expiry
  const timedEffects = db.prepare(`
    SELECT ae.id, ae.character_id, ae.remaining_hours, sed.name as effect_name, c.name as char_name
    FROM applied_effects ae
    JOIN status_effect_definitions sed ON ae.status_effect_definition_id = sed.id
    JOIN characters c ON ae.character_id = c.id
    WHERE c.campaign_id = ? AND ae.remaining_hours IS NOT NULL
  `).all(campaignId);

  for (const eff of timedEffects) {
    const newRemaining = eff.remaining_hours - totalHours;
    if (newRemaining <= 0) {
      db.prepare('DELETE FROM applied_effects WHERE id = ?').run(eff.id);
      events.push({ type: 'effect_expired', character_name: eff.char_name, effect_name: eff.effect_name });
      db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
        .run(campaignId, 'effect_expired', `"${eff.effect_name}" expired on "${eff.char_name}"`);
    } else {
      db.prepare('UPDATE applied_effects SET remaining_hours = ? WHERE id = ?').run(newRemaining, eff.id);
    }
  }

  // Rules engine: on_time_advance + on_schedule
  try {
    const { evaluateRules } = require('./rulesEngine/engine');
    const rulesResult = evaluateRules(campaignId, 'on_time_advance', {
      hoursAdvanced: totalHours,
      minutesAdvanced: minutes,
      oldTime: { hour: env.current_hour, minute: env.current_minute, day: env.current_day, month: env.current_month, year: env.current_year },
      newTime: { hour: newHour, minute: newMinute, day, month, year },
    });
    events.push(...rulesResult.events);

    // Check scheduled rules
    const schedResult = evaluateRules(campaignId, 'on_schedule', {
      oldTime: { hour: env.current_hour, minute: env.current_minute, day: env.current_day, month: env.current_month },
      newTime: { hour: newHour, minute: newMinute, day, month },
    });
    events.push(...schedResult.events);
  } catch (e) {
    // Rules engine failure shouldn't break time advance
    console.error('Rules engine error during time advance:', e.message);
  }

  // Encounter roll
  const updatedEnv = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  const encounterResult = rollEncounter(campaignId, config, updatedEnv, totalHours);
  if (encounterResult.triggered) {
    events.push({ type: 'encounter_triggered', encounter: encounterResult.encounter, probability: encounterResult.probability });
  }

  // Log events to session_log
  for (const event of events) {
    let entryType = event.type;
    let message = '';
    if (event.type === 'time_advance') {
      entryType = 'time_advance';
      message = event.description;
    } else if (event.type === 'weather_change') {
      entryType = 'weather_change';
      message = `Weather changed from ${event.from} to ${event.to}`;
    } else if (event.type === 'encounter_triggered') {
      entryType = 'encounter_roll';
      message = `Random encounter triggered: ${event.encounter.name}`;
    }
    if (message) {
      db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)').run(campaignId, entryType, message);
    }
  }

  // Build response
  const finalEnv = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  const locationName = finalEnv.current_location_id
    ? db.prepare('SELECT name FROM locations WHERE id = ?').get(finalEnv.current_location_id)?.name
    : null;

  return {
    ...finalEnv,
    time_of_day: resolveTimeOfDay(config.thresholds, finalEnv.current_hour, finalEnv.current_minute),
    month_name: resolveMonthName(config.calendarConfig, finalEnv.current_month),
    calendar_config: config.calendarConfig,
    current_location_name: locationName,
    events,
  };
}

module.exports = { advanceTime, getCampaignConfig, resolveTimeOfDay, resolveMonthName, generateDefaultTransitionTable, DEFAULT_ADJACENCY };
