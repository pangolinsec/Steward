const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { enrichCombatState } = require('./combat');

function fireRules(campaignId, triggerType, triggerContext) {
  try {
    const { evaluateRules } = require('../rulesEngine/engine');
    return evaluateRules(campaignId, triggerType, triggerContext);
  } catch (e) {
    console.error(`Rules engine error (${triggerType}):`, e.message);
    return { fired: [], notifications: [], events: [] };
  }
}

// GET all encounters for campaign
router.get('/', (req, res) => {
  const { search } = req.query;
  let query = 'SELECT * FROM encounter_definitions WHERE campaign_id = ?';
  const params = [req.params.id];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }

  query += ' ORDER BY name';
  const encounters = db.prepare(query).all(...params);
  res.json(encounters.map(e => ({
    ...e,
    npcs: JSON.parse(e.npcs),
    environment_overrides: JSON.parse(e.environment_overrides),
    loot_table: JSON.parse(e.loot_table),
    conditions: JSON.parse(e.conditions || '{}'),
    starts_combat: !!e.starts_combat,
  })));
});

// GET single
router.get('/:encId', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });
  res.json({
    ...enc,
    npcs: JSON.parse(enc.npcs),
    environment_overrides: JSON.parse(enc.environment_overrides),
    loot_table: JSON.parse(enc.loot_table),
    conditions: JSON.parse(enc.conditions || '{}'),
    starts_combat: !!enc.starts_combat,
  });
});

// POST create
router.post('/', (req, res) => {
  const { name, description, notes, npcs, environment_overrides, loot_table, conditions, starts_combat } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO encounter_definitions (campaign_id, name, description, notes, npcs, environment_overrides, loot_table, conditions, starts_combat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, name, description || '', notes || '',
    JSON.stringify(npcs || []),
    JSON.stringify(environment_overrides || {}),
    JSON.stringify(loot_table || []),
    JSON.stringify(conditions || {}),
    starts_combat ? 1 : 0,
  );

  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    ...enc,
    npcs: JSON.parse(enc.npcs),
    environment_overrides: JSON.parse(enc.environment_overrides),
    loot_table: JSON.parse(enc.loot_table),
    conditions: JSON.parse(enc.conditions || '{}'),
    starts_combat: !!enc.starts_combat,
  });
});

// PUT update
router.put('/:encId', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });

  const { name, description, notes, npcs, environment_overrides, loot_table, conditions, starts_combat } = req.body;

  db.prepare(`
    UPDATE encounter_definitions SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      notes = COALESCE(?, notes),
      npcs = COALESCE(?, npcs),
      environment_overrides = COALESCE(?, environment_overrides),
      loot_table = COALESCE(?, loot_table),
      conditions = COALESCE(?, conditions),
      starts_combat = COALESCE(?, starts_combat)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null, description !== undefined ? description : null,
    notes !== undefined ? notes : null,
    npcs ? JSON.stringify(npcs) : null,
    environment_overrides ? JSON.stringify(environment_overrides) : null,
    loot_table ? JSON.stringify(loot_table) : null,
    conditions ? JSON.stringify(conditions) : null,
    starts_combat !== undefined ? (starts_combat ? 1 : 0) : null,
    req.params.encId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM encounter_definitions WHERE id = ?').get(req.params.encId);
  res.json({
    ...updated,
    npcs: JSON.parse(updated.npcs),
    environment_overrides: JSON.parse(updated.environment_overrides),
    loot_table: JSON.parse(updated.loot_table),
    conditions: JSON.parse(updated.conditions || '{}'),
    starts_combat: !!updated.starts_combat,
  });
});

// DELETE
router.delete('/:encId', (req, res) => {
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, req.params.id);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });
  db.prepare('DELETE FROM encounter_definitions WHERE id = ?').run(req.params.encId);
  res.json({ success: true });
});

// POST start encounter
router.post('/:encId/start', (req, res) => {
  const campaignId = req.params.id;
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, campaignId);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });

  db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'encounter_start', ?)")
    .run(campaignId, `Encounter started: ${enc.name}`);

  const rulesResult = fireRules(campaignId, 'on_encounter', {
    phase: 'start', encounter_id: enc.id, encounter_name: enc.name,
  });

  const npcs = JSON.parse(enc.npcs);

  if (enc.starts_combat) {
    // --- Auto-combat: spawn NPCs, roll initiative, create combat state ---
    const npcCombatantIds = [];

    for (const npc of npcs) {
      const count = Math.max(1, npc.count || 1);

      if (npc.character_id) {
        // Referenced NPC
        const sourceChar = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?')
          .get(npc.character_id, campaignId);
        if (!sourceChar) continue;

        if (count === 1) {
          npcCombatantIds.push(sourceChar.id);
        } else {
          for (let n = 1; n <= count; n++) {
            const result = db.prepare(`
              INSERT INTO characters (campaign_id, name, type, description, portrait_url, base_attributes, max_attributes, dm_notes, spawned_from_encounter_id)
              VALUES (?, ?, 'NPC', ?, ?, ?, ?, ?, ?)
            `).run(
              campaignId, `${sourceChar.name} ${n}`, sourceChar.description || '',
              sourceChar.portrait_url || '', sourceChar.base_attributes || '{}',
              sourceChar.max_attributes || '{}', sourceChar.dm_notes || '', enc.id
            );
            npcCombatantIds.push(result.lastInsertRowid);
          }
        }
      } else if (npc.name?.trim()) {
        // Ad-hoc NPC
        const baseName = npc.name.trim();
        for (let n = 1; n <= count; n++) {
          const charName = count === 1 ? baseName : `${baseName} ${n}`;
          const result = db.prepare(`
            INSERT INTO characters (campaign_id, name, type, base_attributes, max_attributes, spawned_from_encounter_id)
            VALUES (?, ?, 'NPC', '{}', '{}', ?)
          `).run(campaignId, charName, enc.id);
          npcCombatantIds.push(result.lastInsertRowid);
        }
      }
    }

    // Collect all PCs
    const pcs = db.prepare('SELECT id FROM characters WHERE type = ? AND campaign_id = ? AND spawned_from_encounter_id IS NULL')
      .all('PC', campaignId);
    const allCombatantIds = [...pcs.map(p => p.id), ...npcCombatantIds];

    // Roll d20 initiative for each
    const combatants = allCombatantIds.map(id => ({
      character_id: id,
      initiative: Math.floor(Math.random() * 20) + 1,
    }));
    const sorted = combatants.sort((a, b) => b.initiative - a.initiative);

    const combatState = {
      active: true,
      round: 1,
      turn_index: 0,
      combatants: sorted,
      advance_time: true,
      time_per_round_seconds: 6,
      accumulated_seconds: 0,
    };

    db.prepare('UPDATE environment_state SET combat_state = ? WHERE campaign_id = ?')
      .run(JSON.stringify(combatState), campaignId);

    db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
      .run(campaignId, 'combat', 'Combat started (Round 1)');

    const encounter = {
      ...enc,
      npcs,
      environment_overrides: JSON.parse(enc.environment_overrides),
      loot_table: JSON.parse(enc.loot_table),
      conditions: JSON.parse(enc.conditions || '{}'),
      starts_combat: true,
    };

    return res.json({
      success: true,
      encounter_name: enc.name,
      encounter,
      combat_started: true,
      combat_state: enrichCombatState(combatState, campaignId),
      events: rulesResult.events,
    });
  }

  // --- Non-combat: existing behavior (enrich NPC data for manual bridge) ---
  const characters = npcs.map(npc => {
    if (!npc.character_id) return null;
    const char = db.prepare('SELECT id, name, type FROM characters WHERE id = ? AND campaign_id = ?')
      .get(npc.character_id, campaignId);
    return char ? { ...char, role: npc.role } : null;
  }).filter(Boolean);

  const encounter = {
    ...enc,
    npcs,
    environment_overrides: JSON.parse(enc.environment_overrides),
    loot_table: JSON.parse(enc.loot_table),
    conditions: JSON.parse(enc.conditions || '{}'),
    starts_combat: false,
  };

  res.json({ success: true, encounter_name: enc.name, encounter, characters, events: rulesResult.events });
});

// POST end encounter
router.post('/:encId/end', (req, res) => {
  const campaignId = req.params.id;
  const enc = db.prepare('SELECT * FROM encounter_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.encId, campaignId);
  if (!enc) return res.status(404).json({ error: 'Encounter not found' });

  db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'encounter_end', ?)")
    .run(campaignId, `Encounter ended: ${enc.name}`);

  const rulesResult = fireRules(campaignId, 'on_encounter', {
    phase: 'end', encounter_id: enc.id, encounter_name: enc.name,
  });

  // Cleanup spawned NPCs
  const spawnedCount = db.prepare('SELECT COUNT(*) as cnt FROM characters WHERE spawned_from_encounter_id = ?').get(enc.id);
  const npcsCleanedCount = spawnedCount?.cnt || 0;
  if (npcsCleanedCount > 0) {
    db.prepare('DELETE FROM characters WHERE spawned_from_encounter_id = ?').run(enc.id);
  }

  // End active combat if running
  let combatEnded = false;
  const env = db.prepare('SELECT combat_state FROM environment_state WHERE campaign_id = ?').get(campaignId);
  if (env?.combat_state) {
    const state = JSON.parse(env.combat_state);
    if (state.active) {
      db.prepare('UPDATE environment_state SET combat_state = NULL WHERE campaign_id = ?').run(campaignId);
      db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
        .run(campaignId, 'combat', `Combat ended after ${state.round || 0} round${state.round !== 1 ? 's' : ''}`);
      combatEnded = true;
    }
  }

  res.json({ success: true, encounter_name: enc.name, events: rulesResult.events, combat_ended: combatEnded, npcs_cleaned: npcsCleanedCount });
});

module.exports = router;
