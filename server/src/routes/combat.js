const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { getComputedStats } = require('../computedStats');
const { advanceTime } = require('../advanceTimeEngine');

function enrichCombatState(state, campaignId) {
  if (!state || !state.active) return { active: false };
  const combatants = state.combatants.map(c => {
    const stats = getComputedStats(c.character_id);
    const char = stats?.character || {};
    return {
      ...c,
      name: char.name || 'Unknown',
      type: char.type || 'NPC',
      portrait_url: char.portrait_url || '',
      dm_notes: char.dm_notes || '',
      base_attributes: stats?.base || {},
      max_attributes: stats?.max_attributes || {},
      effective_attributes: stats?.effective || {},
      applied_effects: stats?.effects_breakdown || [],
    };
  });
  return { ...state, combatants };
}

// GET combat state
router.get('/', (req, res) => {
  const env = db.prepare('SELECT combat_state FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env) return res.status(404).json({ error: 'Environment not found' });
  if (!env.combat_state) return res.json({ active: false });
  const state = JSON.parse(env.combat_state);
  res.json(enrichCombatState(state, req.params.id));
});

// POST start combat
router.post('/start', (req, res) => {
  const { combatants, advance_time = true, time_per_round_seconds = 6 } = req.body;
  if (!combatants || combatants.length === 0) {
    return res.status(400).json({ error: 'At least one combatant required' });
  }

  const sorted = [...combatants].sort((a, b) => b.initiative - a.initiative);
  const state = {
    active: true,
    round: 1,
    turn_index: 0,
    combatants: sorted.map(c => ({ character_id: c.character_id, initiative: c.initiative })),
    advance_time,
    time_per_round_seconds,
    accumulated_seconds: 0,
  };

  db.prepare('UPDATE environment_state SET combat_state = ? WHERE campaign_id = ?')
    .run(JSON.stringify(state), req.params.id);

  db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
    .run(req.params.id, 'combat', 'Combat started (Round 1)');

  res.json(enrichCombatState(state, req.params.id));
});

// POST end combat
router.post('/end', (req, res) => {
  const env = db.prepare('SELECT combat_state FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  let rounds = 0;
  if (env?.combat_state) {
    const state = JSON.parse(env.combat_state);
    rounds = state.round || 0;
  }

  db.prepare('UPDATE environment_state SET combat_state = NULL WHERE campaign_id = ?').run(req.params.id);

  db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
    .run(req.params.id, 'combat', `Combat ended after ${rounds} round${rounds !== 1 ? 's' : ''}`);

  res.json({ active: false });
});

// POST next turn
router.post('/next-turn', (req, res) => {
  const env = db.prepare('SELECT combat_state FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env?.combat_state) return res.status(400).json({ error: 'Not in combat' });

  const state = JSON.parse(env.combat_state);
  if (!state.active) return res.status(400).json({ error: 'Not in combat' });

  const events = [];
  state.turn_index++;

  if (state.turn_index >= state.combatants.length) {
    // New round
    state.turn_index = 0;
    state.round++;

    // Decrement remaining_rounds on all round-based effects
    const roundEffects = db.prepare(`
      SELECT ae.id, ae.character_id, ae.remaining_rounds, sed.name as effect_name, c.name as char_name
      FROM applied_effects ae
      JOIN status_effect_definitions sed ON ae.status_effect_definition_id = sed.id
      JOIN characters c ON ae.character_id = c.id
      WHERE c.campaign_id = ? AND ae.remaining_rounds IS NOT NULL
    `).all(req.params.id);

    for (const eff of roundEffects) {
      const newRemaining = eff.remaining_rounds - 1;
      if (newRemaining <= 0) {
        db.prepare('DELETE FROM applied_effects WHERE id = ?').run(eff.id);
        events.push({ type: 'effect_expired', character_name: eff.char_name, effect_name: eff.effect_name });
        db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
          .run(req.params.id, 'effect_expired', `"${eff.effect_name}" expired on "${eff.char_name}"`);

        try {
          const { evaluateRules } = require('../rulesEngine/engine');
          evaluateRules(req.params.id, 'on_effect_change', {
            character_id: eff.character_id,
            effect_name: eff.effect_name,
            action: 'removed',
          });
        } catch { /* rules engine failure shouldn't break combat */ }
      } else {
        db.prepare('UPDATE applied_effects SET remaining_rounds = ? WHERE id = ?').run(newRemaining, eff.id);
      }
    }

    // Fire on_round_advance rules
    try {
      const { evaluateRules } = require('../rulesEngine/engine');
      const rulesResult = evaluateRules(req.params.id, 'on_round_advance', { round: state.round });
      events.push(...rulesResult.events);
    } catch { /* rules engine failure shouldn't break combat */ }

    // Optionally advance game time
    if (state.advance_time) {
      state.accumulated_seconds = (state.accumulated_seconds || 0) + (state.time_per_round_seconds || 6);
      if (state.accumulated_seconds >= 60) {
        const minutes = Math.floor(state.accumulated_seconds / 60);
        state.accumulated_seconds = state.accumulated_seconds % 60;
        try {
          advanceTime(req.params.id, { minutes });
        } catch { /* ignore advance time failures */ }
      }
    }

    db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
      .run(req.params.id, 'combat', `Round ${state.round} begins`);
  }

  db.prepare('UPDATE environment_state SET combat_state = ? WHERE campaign_id = ?')
    .run(JSON.stringify(state), req.params.id);

  const enriched = enrichCombatState(state, req.params.id);
  enriched.events = events;
  res.json(enriched);
});

// PATCH update combat settings
router.patch('/', (req, res) => {
  const env = db.prepare('SELECT combat_state FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env?.combat_state) return res.status(400).json({ error: 'Not in combat' });

  const state = JSON.parse(env.combat_state);
  const { combatants, advance_time, time_per_round_seconds } = req.body;

  if (combatants !== undefined) {
    state.combatants = [...combatants].sort((a, b) => b.initiative - a.initiative);
    if (state.turn_index >= state.combatants.length) {
      state.turn_index = 0;
    }
  }
  if (advance_time !== undefined) state.advance_time = advance_time;
  if (time_per_round_seconds !== undefined) state.time_per_round_seconds = time_per_round_seconds;

  db.prepare('UPDATE environment_state SET combat_state = ? WHERE campaign_id = ?')
    .run(JSON.stringify(state), req.params.id);

  res.json(enrichCombatState(state, req.params.id));
});

module.exports = router;
