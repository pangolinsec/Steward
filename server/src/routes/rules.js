const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');

const { RULE_TEMPLATES, TEMPLATE_CATEGORIES } = require('../ruleTemplates');

function parseRule(rule) {
  return {
    ...rule,
    enabled: !!rule.enabled,
    trigger_config: JSON.parse(rule.trigger_config || '{}'),
    conditions: JSON.parse(rule.conditions || '{"all":[]}'),
    actions: JSON.parse(rule.actions || '[]'),
    tags: JSON.parse(rule.tags || '[]'),
    target_config: JSON.parse(rule.target_config || '{}'),
  };
}

// GET templates
router.get('/templates', (req, res) => {
  const templates = Object.entries(RULE_TEMPLATES).map(([key, template]) => ({
    key,
    ...template,
    category_label: TEMPLATE_CATEGORIES[template.category] || template.category,
  }));
  res.json({ templates, categories: TEMPLATE_CATEGORIES });
});

// POST import template
router.post('/templates/:name', (req, res) => {
  const template = RULE_TEMPLATES[req.params.name];
  if (!template) return res.status(404).json({ error: 'Template not found' });

  const { category, category_label, ...ruleData } = template;
  const result = db.prepare(`
    INSERT INTO rule_definitions (campaign_id, name, description, trigger_type, trigger_config,
      conditions, actions, action_mode, priority, tags, target_mode, target_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    ruleData.name,
    ruleData.description || '',
    ruleData.trigger_type,
    JSON.stringify(ruleData.trigger_config || {}),
    JSON.stringify(ruleData.conditions || { all: [] }),
    JSON.stringify(ruleData.actions || []),
    ruleData.action_mode || 'auto',
    ruleData.priority ?? 100,
    JSON.stringify(ruleData.tags || []),
    ruleData.target_mode || 'environment',
    JSON.stringify(ruleData.target_config || {}),
  );

  const rule = db.prepare('SELECT * FROM rule_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseRule(rule));
});

// GET all rules for campaign
router.get('/', (req, res) => {
  const { search, tag, trigger_type } = req.query;
  let query = 'SELECT * FROM rule_definitions WHERE campaign_id = ?';
  const params = [req.params.id];

  if (search) {
    query += ' AND name LIKE ?';
    params.push(`%${search}%`);
  }
  if (trigger_type) {
    query += ' AND trigger_type = ?';
    params.push(trigger_type);
  }

  query += ' ORDER BY priority ASC, name ASC';
  let rules = db.prepare(query).all(...params).map(parseRule);

  if (tag) {
    rules = rules.filter(r => r.tags.includes(tag));
  }

  res.json(rules);
});

// GET single rule
router.get('/:ruleId', (req, res) => {
  const rule = db.prepare('SELECT * FROM rule_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.ruleId, req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  res.json(parseRule(rule));
});

// POST create rule
router.post('/', (req, res) => {
  const { name, description, enabled, trigger_type, trigger_config, conditions, actions,
    action_mode, priority, tags, target_mode, target_config } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });
  if (!trigger_type) return res.status(400).json({ error: 'trigger_type is required' });

  const result = db.prepare(`
    INSERT INTO rule_definitions (campaign_id, name, description, enabled, trigger_type, trigger_config,
      conditions, actions, action_mode, priority, tags, target_mode, target_config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id,
    name,
    description || '',
    enabled !== undefined ? (enabled ? 1 : 0) : 1,
    trigger_type,
    JSON.stringify(trigger_config || {}),
    JSON.stringify(conditions || { all: [] }),
    JSON.stringify(actions || []),
    action_mode || 'auto',
    priority ?? 100,
    JSON.stringify(tags || []),
    target_mode || 'environment',
    JSON.stringify(target_config || {}),
  );

  const rule = db.prepare('SELECT * FROM rule_definitions WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseRule(rule));
});

// PUT update rule
router.put('/:ruleId', (req, res) => {
  const rule = db.prepare('SELECT * FROM rule_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.ruleId, req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const { name, description, enabled, trigger_type, trigger_config, conditions, actions,
    action_mode, priority, tags, target_mode, target_config } = req.body;

  db.prepare(`
    UPDATE rule_definitions SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      enabled = COALESCE(?, enabled),
      trigger_type = COALESCE(?, trigger_type),
      trigger_config = COALESCE(?, trigger_config),
      conditions = COALESCE(?, conditions),
      actions = COALESCE(?, actions),
      action_mode = COALESCE(?, action_mode),
      priority = COALESCE(?, priority),
      tags = COALESCE(?, tags),
      target_mode = COALESCE(?, target_mode),
      target_config = COALESCE(?, target_config)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null,
    description !== undefined ? description : null,
    enabled !== undefined ? (enabled ? 1 : 0) : null,
    trigger_type || null,
    trigger_config ? JSON.stringify(trigger_config) : null,
    conditions ? JSON.stringify(conditions) : null,
    actions ? JSON.stringify(actions) : null,
    action_mode || null,
    priority !== undefined ? priority : null,
    tags ? JSON.stringify(tags) : null,
    target_mode || null,
    target_config ? JSON.stringify(target_config) : null,
    req.params.ruleId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM rule_definitions WHERE id = ?').get(req.params.ruleId);
  res.json(parseRule(updated));
});

// DELETE rule
router.delete('/:ruleId', (req, res) => {
  const rule = db.prepare('SELECT * FROM rule_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.ruleId, req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  db.prepare('DELETE FROM rule_definitions WHERE id = ?').run(req.params.ruleId);
  res.json({ success: true });
});

// PATCH toggle enable/disable
router.patch('/:ruleId/toggle', (req, res) => {
  const rule = db.prepare('SELECT * FROM rule_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.ruleId, req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const newEnabled = rule.enabled ? 0 : 1;
  db.prepare('UPDATE rule_definitions SET enabled = ? WHERE id = ?').run(newEnabled, req.params.ruleId);

  const updated = db.prepare('SELECT * FROM rule_definitions WHERE id = ?').get(req.params.ruleId);
  res.json(parseRule(updated));
});

// POST test a rule
router.post('/:ruleId/test', (req, res) => {
  const rule = db.prepare('SELECT * FROM rule_definitions WHERE id = ? AND campaign_id = ?')
    .get(req.params.ruleId, req.params.id);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  const parsed = parseRule(rule);
  const { character_id } = req.body;
  const campaignId = req.params.id;

  const { getCampaignConfig, resolveTimeOfDay } = require('../advanceTimeEngine');
  const { evaluateConditionTree } = require('../rulesEngine/conditionEvaluator');

  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  const config = getCampaignConfig(campaignId);
  const environment = env ? {
    ...env,
    time_of_day: resolveTimeOfDay(config.thresholds, env.current_hour, env.current_minute),
  } : null;

  let character = null;
  if (character_id) {
    character = db.prepare('SELECT * FROM characters WHERE id = ? AND campaign_id = ?').get(character_id, campaignId);
  }

  // For character-targeted rules without a specific character, use first matching target
  if (!character && parsed.target_mode !== 'environment') {
    let query = 'SELECT * FROM characters WHERE campaign_id = ?';
    if (parsed.target_mode === 'all_pcs') query += " AND type = 'PC'";
    else if (parsed.target_mode === 'all_npcs') query += " AND type = 'NPC'";
    query += ' LIMIT 1';
    character = db.prepare(query).get(campaignId);
  }

  const context = { campaignId, character, environment, trigger: {}, variables: {} };
  const result = evaluateConditionTree(parsed.conditions, context);

  res.json({
    overall_pass: result.pass,
    details: result.details,
    character_used: character ? { id: character.id, name: character.name } : null,
    environment_snapshot: environment ? {
      weather: environment.weather,
      time_of_day: environment.time_of_day,
      current_hour: environment.current_hour,
      current_location_id: environment.current_location_id,
    } : null,
    actions_would_fire: result.pass ? parsed.actions : [],
  });
});

module.exports = router;
