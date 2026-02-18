const db = require('../db');

/**
 * Resolve template variables in a string.
 * Supports: {character.name}, {character.<attr>}, {environment.weather}, {var.<name>}
 */
function resolveTemplate(str, context) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{([^}]+)\}/g, (match, key) => {
    const parts = key.split('.');
    if (parts[0] === 'character' && context.character) {
      if (parts[1] === 'name') return context.character.name || '';
      if (parts[1] === 'type') return context.character.type || '';
      const base = JSON.parse(context.character.base_attributes || '{}');
      return base[parts[1]] ?? match;
    }
    if (parts[0] === 'environment' && context.environment) {
      return context.environment[parts[1]] ?? match;
    }
    if (parts[0] === 'var' && context.variables) {
      return context.variables[parts[1]] ?? match;
    }
    return match;
  });
}

/**
 * Execute a single action.
 * @param {object} action - { type, ...params }
 * @param {object} context - { character, environment, campaignId, variables }
 * @returns {{ success: boolean, undoData: object, description: string }}
 */
function executeAction(action, context) {
  const { campaignId, character } = context;

  switch (action.type) {
    case 'apply_effect': {
      if (!character) return { success: false, undoData: {}, description: 'No character target for apply_effect' };
      const effectName = resolveTemplate(action.effect_name, context);
      const effectDef = db.prepare(
        'SELECT * FROM status_effect_definitions WHERE campaign_id = ? AND name = ?'
      ).get(campaignId, effectName);
      if (!effectDef) return { success: false, undoData: {}, description: `Effect "${effectName}" not found` };

      // Check if already applied (don't stack same effect)
      const existing = db.prepare(`
        SELECT ae.id FROM applied_effects ae
        JOIN status_effect_definitions sed ON ae.status_effect_definition_id = sed.id
        WHERE ae.character_id = ? AND sed.name = ?
      `).get(character.id, effectName);
      if (existing && !action.allow_stack) {
        return { success: false, undoData: {}, description: `"${effectName}" already applied to ${character.name}` };
      }

      let remainingRounds = null;
      let remainingHours = null;
      if (effectDef.duration_type === 'rounds') remainingRounds = effectDef.duration_value;
      if (effectDef.duration_type === 'timed') remainingHours = action.duration_hours ?? effectDef.duration_value;

      const result = db.prepare(`
        INSERT INTO applied_effects (character_id, status_effect_definition_id, remaining_rounds, remaining_hours)
        VALUES (?, ?, ?, ?)
      `).run(character.id, effectDef.id, remainingRounds, remainingHours);

      db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'effect_applied', ?)")
        .run(campaignId, `[Rule] Applied "${effectName}" to "${character.name}"`);

      return {
        success: true,
        undoData: { applied_effect_id: result.lastInsertRowid, character_id: character.id },
        description: `Applied "${effectName}" to ${character.name}`,
      };
    }

    case 'remove_effect': {
      if (!character) return { success: false, undoData: {}, description: 'No character target for remove_effect' };
      const effectName = resolveTemplate(action.effect_name, context);
      const applied = db.prepare(`
        SELECT ae.id, ae.status_effect_definition_id, ae.remaining_rounds, ae.remaining_hours
        FROM applied_effects ae
        JOIN status_effect_definitions sed ON ae.status_effect_definition_id = sed.id
        WHERE ae.character_id = ? AND sed.name = ?
      `).get(character.id, effectName);

      if (!applied) return { success: false, undoData: {}, description: `"${effectName}" not found on ${character.name}` };

      db.prepare('DELETE FROM applied_effects WHERE id = ?').run(applied.id);

      db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'effect_removed', ?)")
        .run(campaignId, `[Rule] Removed "${effectName}" from "${character.name}"`);

      return {
        success: true,
        undoData: {
          restore_effect: {
            character_id: character.id,
            status_effect_definition_id: applied.status_effect_definition_id,
            remaining_rounds: applied.remaining_rounds,
            remaining_hours: applied.remaining_hours,
          },
        },
        description: `Removed "${effectName}" from ${character.name}`,
      };
    }

    case 'modify_attribute': {
      if (!character) return { success: false, undoData: {}, description: 'No character target for modify_attribute' };
      const char = db.prepare('SELECT base_attributes FROM characters WHERE id = ?').get(character.id);
      const attrs = JSON.parse(char.base_attributes);
      const oldVal = attrs[action.attribute] ?? 0;
      const delta = action.delta || 0;
      attrs[action.attribute] = oldVal + delta;
      db.prepare('UPDATE characters SET base_attributes = ? WHERE id = ?')
        .run(JSON.stringify(attrs), character.id);

      db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'attribute_changed', ?)")
        .run(campaignId, `[Rule] ${character.name}'s ${action.attribute} changed by ${delta >= 0 ? '+' : ''}${delta}`);

      return {
        success: true,
        undoData: { character_id: character.id, attribute: action.attribute, reverse_delta: -delta },
        description: `${character.name}'s ${action.attribute} ${delta >= 0 ? '+' : ''}${delta}`,
      };
    }

    case 'consume_item': {
      if (!character) return { success: false, undoData: {}, description: 'No character target for consume_item' };
      const itemName = resolveTemplate(action.item_name, context);
      const charItem = db.prepare(`
        SELECT ci.id, ci.quantity, id.name FROM character_items ci
        JOIN item_definitions id ON ci.item_definition_id = id.id
        WHERE ci.character_id = ? AND id.name = ?
      `).get(character.id, itemName);

      if (!charItem) return { success: false, undoData: {}, description: `"${itemName}" not found on ${character.name}` };

      const consumeQty = action.quantity || 1;
      const newQty = charItem.quantity - consumeQty;
      if (newQty <= 0) {
        db.prepare('DELETE FROM character_items WHERE id = ?').run(charItem.id);
      } else {
        db.prepare('UPDATE character_items SET quantity = ? WHERE id = ?').run(newQty, charItem.id);
      }

      db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'item_consumed', ?)")
        .run(campaignId, `[Rule] ${character.name} consumed ${consumeQty}x "${itemName}"`);

      return {
        success: true,
        undoData: { character_item_id: charItem.id, character_id: character.id, quantity_consumed: consumeQty, was_deleted: newQty <= 0 },
        description: `${character.name} consumed ${consumeQty}x "${itemName}"`,
      };
    }

    case 'grant_item': {
      if (!character) return { success: false, undoData: {}, description: 'No character target for grant_item' };
      const itemName = resolveTemplate(action.item_name, context);
      const itemDef = db.prepare('SELECT * FROM item_definitions WHERE campaign_id = ? AND name = ?')
        .get(campaignId, itemName);
      if (!itemDef) return { success: false, undoData: {}, description: `Item "${itemName}" not found in campaign` };

      const qty = action.quantity || 1;
      if (itemDef.stackable) {
        const existing = db.prepare('SELECT * FROM character_items WHERE character_id = ? AND item_definition_id = ?')
          .get(character.id, itemDef.id);
        if (existing) {
          db.prepare('UPDATE character_items SET quantity = quantity + ? WHERE id = ?').run(qty, existing.id);
          return {
            success: true,
            undoData: { character_item_id: existing.id, quantity_granted: qty, was_new: false },
            description: `Granted ${qty}x "${itemName}" to ${character.name}`,
          };
        }
      }

      const result = db.prepare('INSERT INTO character_items (character_id, item_definition_id, quantity) VALUES (?, ?, ?)')
        .run(character.id, itemDef.id, qty);

      return {
        success: true,
        undoData: { character_item_id: result.lastInsertRowid, quantity_granted: qty, was_new: true },
        description: `Granted ${qty}x "${itemName}" to ${character.name}`,
      };
    }

    case 'set_weather': {
      const weather = resolveTemplate(action.weather, context);
      db.prepare('UPDATE environment_state SET weather = ? WHERE campaign_id = ?').run(weather, campaignId);
      const oldWeather = context.environment?.weather || 'Unknown';

      db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'weather_change', ?)")
        .run(campaignId, `[Rule] Weather changed to "${weather}"`);

      return {
        success: true,
        undoData: { old_weather: oldWeather },
        description: `Weather changed to "${weather}"`,
      };
    }

    case 'set_environment_note': {
      const note = resolveTemplate(action.note, context);
      const oldNote = context.environment?.environment_notes || '';
      db.prepare('UPDATE environment_state SET environment_notes = ? WHERE campaign_id = ?').run(note, campaignId);

      return {
        success: true,
        undoData: { old_note: oldNote },
        description: `Environment note set: "${note}"`,
      };
    }

    case 'advance_time': {
      // Store for batch accumulation — engine will aggregate these
      return {
        success: true,
        undoData: {},
        description: `Advance time by ${action.hours || 0}h ${action.minutes || 0}m`,
        pendingTimeAdvance: { hours: action.hours || 0, minutes: action.minutes || 0 },
      };
    }

    case 'notify': {
      const message = resolveTemplate(action.message, context);
      return {
        success: true,
        undoData: {},
        description: message,
        notification: {
          message,
          severity: action.severity || 'info',
        },
      };
    }

    case 'log': {
      const message = resolveTemplate(action.message, context);
      db.prepare("INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, 'rule_log', ?)")
        .run(campaignId, message);
      return { success: true, undoData: {}, description: message };
    }

    case 'random_from_list': {
      const items = action.items || [];
      if (items.length === 0) return { success: false, undoData: {}, description: 'Empty list for random_from_list' };
      const totalWeight = items.reduce((s, i) => s + (i.weight || 1), 0);
      let roll = Math.random() * totalWeight;
      let selected = items[0];
      for (const item of items) {
        roll -= (item.weight || 1);
        if (roll <= 0) { selected = item; break; }
      }
      if (action.store_as && context.variables) {
        context.variables[action.store_as] = selected.value;
      }
      return { success: true, undoData: {}, description: `Random selected: "${selected.value}"` };
    }

    case 'roll_dice': {
      const formula = action.formula || '1d6';
      const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/);
      if (!match) return { success: false, undoData: {}, description: `Invalid dice formula: ${formula}` };
      const [, count, sides, modifier] = match;
      let total = modifier ? parseInt(modifier) : 0;
      for (let i = 0; i < parseInt(count); i++) {
        total += Math.floor(Math.random() * parseInt(sides)) + 1;
      }
      if (action.store_as && context.variables) {
        context.variables[action.store_as] = total;
      }
      return { success: true, undoData: {}, description: `Rolled ${formula}: ${total}` };
    }

    default:
      return { success: false, undoData: {}, description: `Unknown action type: ${action.type}` };
  }
}

/**
 * Undo a previously executed action using its undo_data.
 */
function undoAction(actionType, undoData, campaignId) {
  switch (actionType) {
    case 'apply_effect':
      if (undoData.applied_effect_id) {
        db.prepare('DELETE FROM applied_effects WHERE id = ?').run(undoData.applied_effect_id);
        return true;
      }
      return false;

    case 'remove_effect':
      if (undoData.restore_effect) {
        const { character_id, status_effect_definition_id, remaining_rounds, remaining_hours } = undoData.restore_effect;
        db.prepare('INSERT INTO applied_effects (character_id, status_effect_definition_id, remaining_rounds, remaining_hours) VALUES (?, ?, ?, ?)')
          .run(character_id, status_effect_definition_id, remaining_rounds, remaining_hours);
        return true;
      }
      return false;

    case 'modify_attribute':
      if (undoData.character_id && undoData.attribute) {
        const char = db.prepare('SELECT base_attributes FROM characters WHERE id = ?').get(undoData.character_id);
        if (char) {
          const attrs = JSON.parse(char.base_attributes);
          attrs[undoData.attribute] = (attrs[undoData.attribute] || 0) + undoData.reverse_delta;
          db.prepare('UPDATE characters SET base_attributes = ? WHERE id = ?').run(JSON.stringify(attrs), undoData.character_id);
          return true;
        }
      }
      return false;

    case 'set_weather':
      if (undoData.old_weather) {
        db.prepare('UPDATE environment_state SET weather = ? WHERE campaign_id = ?').run(undoData.old_weather, campaignId);
        return true;
      }
      return false;

    case 'set_environment_note':
      if (undoData.old_note !== undefined) {
        db.prepare('UPDATE environment_state SET environment_notes = ? WHERE campaign_id = ?').run(undoData.old_note, campaignId);
        return true;
      }
      return false;

    default:
      return false;
  }
}

module.exports = { executeAction, undoAction, resolveTemplate };
