const crypto = require('crypto');
const db = require('../db');
const { evaluateConditionTree } = require('./conditionEvaluator');
const { executeAction } = require('./actionExecutor');
const { getCampaignConfig, resolveTimeOfDay } = require('../advanceTimeEngine');

/**
 * Get campaign rules settings.
 */
function getRulesSettings(campaignId) {
  const campaign = db.prepare('SELECT rules_settings FROM campaigns WHERE id = ?').get(campaignId);
  const defaults = { cascade_depth_limit: 3, engine_enabled: true };
  if (!campaign?.rules_settings) return defaults;
  try { return { ...defaults, ...JSON.parse(campaign.rules_settings) }; }
  catch { return defaults; }
}

/**
 * Determine target characters for a rule.
 */
function resolveTargets(rule, campaignId) {
  switch (rule.target_mode) {
    case 'all_pcs':
      return db.prepare("SELECT * FROM characters WHERE campaign_id = ? AND type = 'PC'").all(campaignId);
    case 'all_npcs':
      return db.prepare("SELECT * FROM characters WHERE campaign_id = ? AND type = 'NPC'").all(campaignId);
    case 'all_characters':
      return db.prepare('SELECT * FROM characters WHERE campaign_id = ?').all(campaignId);
    case 'specific': {
      const ids = rule.target_config?.character_ids || [];
      if (ids.length === 0) return [];
      const placeholders = ids.map(() => '?').join(',');
      return db.prepare(`SELECT * FROM characters WHERE id IN (${placeholders}) AND campaign_id = ?`)
        .all(...ids, campaignId);
    }
    case 'environment':
    default:
      return [null]; // null = no character target (environment-only)
  }
}

/**
 * Build the evaluation context for a rule check.
 */
function buildContext(campaignId, triggerContext, character) {
  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  const config = getCampaignConfig(campaignId);
  const environment = env ? {
    ...env,
    time_of_day: resolveTimeOfDay(config.thresholds, env.current_hour, env.current_minute),
  } : null;

  return {
    campaignId,
    character: character ? { ...character, base_attributes: character.base_attributes } : null,
    environment,
    trigger: triggerContext,
    variables: {},
  };
}

/**
 * Main entry point: evaluate all enabled rules matching a trigger type.
 * @param {number} campaignId
 * @param {string} triggerType
 * @param {object} triggerContext - Extra context from the triggering event
 * @param {number} cascadeDepth - Current cascade depth
 * @returns {{ fired: Array, notifications: Array, events: Array }}
 */
function evaluateRules(campaignId, triggerType, triggerContext = {}, cascadeDepth = 0) {
  const settings = getRulesSettings(campaignId);
  if (!settings.engine_enabled) return { fired: [], notifications: [], events: [] };

  const rules = db.prepare(
    'SELECT * FROM rule_definitions WHERE campaign_id = ? AND trigger_type = ? AND enabled = 1 ORDER BY priority ASC'
  ).all(campaignId, triggerType);

  const batchId = crypto.randomUUID();
  const fired = [];
  const notifications = [];
  const events = [];
  const pendingTimeAdvances = [];

  for (const rawRule of rules) {
    const rule = {
      ...rawRule,
      trigger_config: JSON.parse(rawRule.trigger_config || '{}'),
      conditions: JSON.parse(rawRule.conditions || '{"all":[]}'),
      actions: JSON.parse(rawRule.actions || '[]'),
      tags: JSON.parse(rawRule.tags || '[]'),
      target_config: JSON.parse(rawRule.target_config || '{}'),
    };

    // Schedule trigger: check if trigger config matches
    if (triggerType === 'on_schedule' && rule.trigger_config.datetime) {
      const { oldTime, newTime } = triggerContext;
      const schedTime = rule.trigger_config.datetime;
      if (schedTime && oldTime && newTime) {
        // Compare "month,day,hour,minute" format
        // Skip if not in the time window
        const sched = parseScheduleTime(schedTime);
        if (sched && !isInTimeWindow(sched, oldTime, newTime)) continue;
      }
    }

    const targets = resolveTargets(rule, campaignId);

    for (const target of targets) {
      const context = buildContext(campaignId, triggerContext, target);

      const evalResult = evaluateConditionTree(rule.conditions, context);
      if (!evalResult.pass) continue;

      // Determine action mode (at cascade limit, force suggest)
      let actionMode = rule.action_mode;
      if (cascadeDepth >= settings.cascade_depth_limit && actionMode === 'auto') {
        actionMode = 'suggest';
      }

      if (actionMode === 'auto') {
        // Execute actions immediately
        const actionResults = [];
        for (let i = 0; i < rule.actions.length; i++) {
          const action = rule.actions[i];
          const result = executeAction(action, context);
          actionResults.push(result);

          if (result.success) {
            // Log to rule_action_log
            db.prepare(`
              INSERT INTO rule_action_log (campaign_id, rule_id, rule_name, batch_id, action_index,
                action_type, action_params, target_character_id, target_character_name, undo_data)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              campaignId, rule.id, rule.name, batchId, i,
              action.type, JSON.stringify(action),
              target?.id || null, target?.name || '',
              JSON.stringify(result.undoData),
            );

            if (result.pendingTimeAdvance) {
              pendingTimeAdvances.push(result.pendingTimeAdvance);
            }

            if (result.notification) {
              const notif = {
                campaign_id: campaignId,
                batch_id: batchId,
                rule_id: rule.id,
                rule_name: rule.name,
                notification_type: 'auto_applied',
                message: result.notification.message,
                severity: result.notification.severity || 'info',
                target_character_id: target?.id || null,
                target_character_name: target?.name || '',
              };
              saveNotification(notif);
              notifications.push(notif);
            }
          }

          events.push({
            type: 'rule_notification',
            rule_name: rule.name,
            message: result.description,
            severity: result.success ? 'info' : 'warning',
          });
        }

        // Create auto-applied notification
        const autoNotif = {
          campaign_id: campaignId,
          batch_id: batchId,
          rule_id: rule.id,
          rule_name: rule.name,
          notification_type: 'auto_applied',
          message: `Rule "${rule.name}" auto-applied: ${actionResults.filter(r => r.success).map(r => r.description).join('; ')}`,
          severity: 'info',
          target_character_id: target?.id || null,
          target_character_name: target?.name || '',
          actions_data: JSON.stringify(rule.actions),
        };
        saveNotification(autoNotif);
        notifications.push(autoNotif);

        fired.push({ rule_id: rule.id, rule_name: rule.name, mode: 'auto', target: target?.name || 'environment' });
      } else {
        // Suggest mode — store actions as notification for user to apply
        const suggestNotif = {
          campaign_id: campaignId,
          batch_id: batchId,
          rule_id: rule.id,
          rule_name: rule.name,
          notification_type: 'suggestion',
          message: `Rule "${rule.name}" suggests: ${rule.actions.map(a => a.type).join(', ')}`,
          severity: 'warning',
          target_character_id: target?.id || null,
          target_character_name: target?.name || '',
          actions_data: JSON.stringify(rule.actions),
        };
        saveNotification(suggestNotif);
        notifications.push(suggestNotif);

        events.push({
          type: 'rule_notification',
          rule_name: rule.name,
          message: suggestNotif.message,
          severity: 'warning',
        });

        fired.push({ rule_id: rule.id, rule_name: rule.name, mode: 'suggest', target: target?.name || 'environment' });
      }
    }
  }

  // Update last_triggered_at for all fired rules
  if (fired.length > 0) {
    const firedIds = [...new Set(fired.map(f => f.rule_id))];
    const placeholders = firedIds.map(() => '?').join(',');
    db.prepare(`UPDATE rule_definitions SET last_triggered_at = datetime('now') WHERE id IN (${placeholders})`).run(...firedIds);
  }

  // Handle cascading time advances (aggregate and apply once)
  if (pendingTimeAdvances.length > 0) {
    const totalHours = pendingTimeAdvances.reduce((s, t) => s + t.hours, 0);
    const totalMinutes = pendingTimeAdvances.reduce((s, t) => s + t.minutes, 0);
    if (totalHours > 0 || totalMinutes > 0) {
      const { advanceTime } = require('../advanceTimeEngine');
      const advResult = advanceTime(campaignId, { hours: totalHours, minutes: totalMinutes });
      events.push(...(advResult.events || []));
    }
  }

  return { fired, notifications, events };
}

/**
 * Check threshold crossing between before/after stats.
 */
function checkThresholds(campaignId, characterId, beforeStats, afterStats) {
  if (!beforeStats || !afterStats) return;

  const rules = db.prepare(
    "SELECT * FROM rule_definitions WHERE campaign_id = ? AND trigger_type = 'on_threshold' AND enabled = 1 ORDER BY priority ASC"
  ).all(campaignId);

  if (rules.length === 0) return { fired: [], notifications: [], events: [] };

  const fired = [];
  const notifications = [];
  const events = [];

  for (const rawRule of rules) {
    const rule = {
      ...rawRule,
      trigger_config: JSON.parse(rawRule.trigger_config || '{}'),
      conditions: JSON.parse(rawRule.conditions || '{"all":[]}'),
      actions: JSON.parse(rawRule.actions || '[]'),
      tags: JSON.parse(rawRule.tags || '[]'),
      target_config: JSON.parse(rawRule.target_config || '{}'),
    };

    const attr = rule.trigger_config.attribute;
    const threshold = rule.trigger_config.threshold;
    const direction = rule.trigger_config.direction || 'falling'; // 'falling' or 'rising'
    if (!attr || threshold === undefined) continue;

    const before = beforeStats[attr];
    const after = afterStats[attr];
    if (before === undefined || after === undefined) continue;

    let crossed = false;
    if (direction === 'falling') {
      crossed = before > threshold && after <= threshold;
    } else if (direction === 'rising') {
      crossed = before < threshold && after >= threshold;
    }

    if (!crossed) continue;

    // Threshold crossed — fire the rule
    const character = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
    const result = evaluateRules(campaignId, 'on_threshold', {
      character_id: characterId,
      attribute: attr,
      threshold,
      direction,
      before_value: before,
      after_value: after,
    }, 1);

    fired.push(...result.fired);
    notifications.push(...result.notifications);
    events.push(...result.events);
  }

  return { fired, notifications, events };
}

function saveNotification(notif) {
  db.prepare(`
    INSERT INTO notifications (campaign_id, batch_id, rule_id, rule_name, notification_type,
      message, severity, target_character_id, target_character_name, actions_data)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    notif.campaign_id, notif.batch_id || null, notif.rule_id || null, notif.rule_name || '',
    notif.notification_type, notif.message, notif.severity || 'info',
    notif.target_character_id || null, notif.target_character_name || '',
    notif.actions_data || '[]',
  );
}

function parseScheduleTime(datetime) {
  // Format: { month, day, hour, minute } or "month,day,hour,minute"
  if (typeof datetime === 'string') {
    const parts = datetime.split(',').map(Number);
    if (parts.length >= 4) return { month: parts[0], day: parts[1], hour: parts[2], minute: parts[3] };
  }
  if (typeof datetime === 'object') return datetime;
  return null;
}

function isInTimeWindow(schedTime, oldTime, newTime) {
  // Convert to comparable numbers
  const schedVal = (schedTime.month || 1) * 100000 + (schedTime.day || 1) * 1440 + (schedTime.hour || 0) * 60 + (schedTime.minute || 0);
  const oldVal = (oldTime.month || 1) * 100000 + (oldTime.day || 1) * 1440 + (oldTime.hour || 0) * 60 + (oldTime.minute || 0);
  const newVal = (newTime.month || 1) * 100000 + (newTime.day || 1) * 1440 + (newTime.hour || 0) * 60 + (newTime.minute || 0);
  return schedVal > oldVal && schedVal <= newVal;
}

/**
 * Manually run a single rule against the current game state.
 * Bypasses trigger matching, enabled flag, and action_mode — always executes directly.
 */
function runSingleRule(campaignId, ruleId) {
  const rawRule = db.prepare('SELECT * FROM rule_definitions WHERE id = ? AND campaign_id = ?')
    .get(ruleId, campaignId);
  if (!rawRule) return { fired: false, error: 'Rule not found', results: [] };

  const rule = {
    ...rawRule,
    trigger_config: JSON.parse(rawRule.trigger_config || '{}'),
    conditions: JSON.parse(rawRule.conditions || '{"all":[]}'),
    actions: JSON.parse(rawRule.actions || '[]'),
    tags: JSON.parse(rawRule.tags || '[]'),
    target_config: JSON.parse(rawRule.target_config || '{}'),
  };

  const targets = resolveTargets(rule, campaignId);
  const batchId = crypto.randomUUID();
  const results = [];
  let anyFired = false;

  for (const target of targets) {
    const context = buildContext(campaignId, {}, target);
    const evalResult = evaluateConditionTree(rule.conditions, context);

    if (!evalResult.pass) {
      results.push({
        target: target?.name || 'environment',
        target_id: target?.id || null,
        status: 'skipped',
        reason: 'Conditions not met',
        details: evalResult.details,
      });
      continue;
    }

    // Execute actions directly (always auto mode)
    const actionResults = [];
    for (let i = 0; i < rule.actions.length; i++) {
      const action = rule.actions[i];
      const result = executeAction(action, context);
      actionResults.push(result);

      if (result.success) {
        db.prepare(`
          INSERT INTO rule_action_log (campaign_id, rule_id, rule_name, batch_id, action_index,
            action_type, action_params, target_character_id, target_character_name, undo_data)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          campaignId, rule.id, rule.name, batchId, i,
          action.type, JSON.stringify(action),
          target?.id || null, target?.name || '',
          JSON.stringify(result.undoData),
        );
      }
    }

    // Create auto-applied notification
    const successActions = actionResults.filter(r => r.success);
    if (successActions.length > 0) {
      const autoNotif = {
        campaign_id: campaignId,
        batch_id: batchId,
        rule_id: rule.id,
        rule_name: rule.name,
        notification_type: 'auto_applied',
        message: `Rule "${rule.name}" manually run: ${successActions.map(r => r.description).join('; ')}`,
        severity: 'info',
        target_character_id: target?.id || null,
        target_character_name: target?.name || '',
        actions_data: JSON.stringify(rule.actions),
      };
      saveNotification(autoNotif);
    }

    anyFired = true;
    results.push({
      target: target?.name || 'environment',
      target_id: target?.id || null,
      status: 'applied',
      actions: actionResults.map(r => ({ success: r.success, description: r.description })),
    });
  }

  // Update last_triggered_at
  if (anyFired) {
    db.prepare("UPDATE rule_definitions SET last_triggered_at = datetime('now') WHERE id = ?").run(rule.id);
  }

  return { fired: anyFired, results };
}

module.exports = { evaluateRules, checkThresholds, getRulesSettings, runSingleRule };
