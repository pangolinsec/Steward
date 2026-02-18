const db = require('../db');
const { getEffectiveAttribute, getComputedStats } = require('../computedStats');

/**
 * Evaluates a condition tree against a context.
 * @param {object} conditionTree - { all: [...] } or { any: [...] } or { not: {...} } or leaf condition
 * @param {object} context - { character, environment, campaignId, variables }
 * @returns {{ pass: boolean, details: Array<{type, pass, reason}> }}
 */
function evaluateConditionTree(conditionTree, context) {
  if (!conditionTree || (typeof conditionTree === 'object' && Object.keys(conditionTree).length === 0)) {
    return { pass: true, details: [] };
  }

  // Logical operators
  if (conditionTree.all) {
    const items = conditionTree.all;
    if (items.length === 0) return { pass: true, details: [] };
    const results = items.map(item => evaluateConditionTree(item, context));
    const allPass = results.every(r => r.pass);
    const details = results.flatMap(r => r.details);
    return { pass: allPass, details };
  }

  if (conditionTree.any) {
    const items = conditionTree.any;
    if (items.length === 0) return { pass: false, details: [] };
    const results = items.map(item => evaluateConditionTree(item, context));
    const anyPass = results.some(r => r.pass);
    const details = results.flatMap(r => r.details);
    return { pass: anyPass, details };
  }

  if (conditionTree.not) {
    const result = evaluateConditionTree(conditionTree.not, context);
    return {
      pass: !result.pass,
      details: result.details.map(d => ({ ...d, pass: !d.pass, reason: `NOT: ${d.reason}` })),
    };
  }

  // Leaf condition
  return evaluateLeaf(conditionTree, context);
}

function evaluateLeaf(condition, context) {
  const { type } = condition;
  const { character, environment } = context;

  try {
    switch (type) {
      // Character conditions
      case 'attribute_gte': {
        const val = character ? getEffectiveAttribute(character.id, condition.attribute) : null;
        const pass = val !== null && val >= condition.value;
        return { pass, details: [{ type, pass, reason: `${condition.attribute}: ${val} >= ${condition.value}`, actual: val, expected: condition.value }] };
      }
      case 'attribute_lte': {
        const val = character ? getEffectiveAttribute(character.id, condition.attribute) : null;
        const pass = val !== null && val <= condition.value;
        return { pass, details: [{ type, pass, reason: `${condition.attribute}: ${val} <= ${condition.value}`, actual: val, expected: condition.value }] };
      }
      case 'attribute_eq': {
        const val = character ? getEffectiveAttribute(character.id, condition.attribute) : null;
        const pass = val !== null && val === condition.value;
        return { pass, details: [{ type, pass, reason: `${condition.attribute}: ${val} == ${condition.value}`, actual: val, expected: condition.value }] };
      }
      case 'trait_equals': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(character.id);
        const attrs = JSON.parse(char.base_attributes || '{}');
        const val = attrs[condition.trait] ?? char[condition.trait];
        const pass = val === condition.value;
        return { pass, details: [{ type, pass, reason: `${condition.trait}: "${val}" == "${condition.value}"`, actual: val, expected: condition.value }] };
      }
      case 'trait_in': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(character.id);
        const attrs = JSON.parse(char.base_attributes || '{}');
        const val = attrs[condition.trait] ?? char[condition.trait];
        const pass = (condition.values || []).includes(val);
        return { pass, details: [{ type, pass, reason: `${condition.trait}: "${val}" in [${condition.values}]`, actual: val }] };
      }
      case 'character_type': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const pass = character.type === condition.value;
        return { pass, details: [{ type, pass, reason: `type: "${character.type}" == "${condition.value}"` }] };
      }
      case 'has_effect': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const stats = getComputedStats(character.id);
        const has = stats?.effects_breakdown.some(e => e.name === condition.effect_name);
        return { pass: !!has, details: [{ type, pass: !!has, reason: `has effect "${condition.effect_name}": ${has}` }] };
      }
      case 'lacks_effect': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const stats = getComputedStats(character.id);
        const has = stats?.effects_breakdown.some(e => e.name === condition.effect_name);
        return { pass: !has, details: [{ type, pass: !has, reason: `lacks effect "${condition.effect_name}": ${!has}` }] };
      }
      case 'has_item': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const stats = getComputedStats(character.id);
        const has = stats?.items_breakdown.some(i => i.name === condition.item_name);
        return { pass: !!has, details: [{ type, pass: !!has, reason: `has item "${condition.item_name}": ${has}` }] };
      }
      case 'lacks_item': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const stats = getComputedStats(character.id);
        const has = stats?.items_breakdown.some(i => i.name === condition.item_name);
        return { pass: !has, details: [{ type, pass: !has, reason: `lacks item "${condition.item_name}": ${!has}` }] };
      }
      case 'item_quantity_lte': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const stats = getComputedStats(character.id);
        const item = stats?.items_breakdown.find(i => i.name === condition.item_name);
        const qty = item ? item.quantity : 0;
        const pass = qty <= condition.value;
        return { pass, details: [{ type, pass, reason: `"${condition.item_name}" qty: ${qty} <= ${condition.value}`, actual: qty, expected: condition.value }] };
      }

      // Environment conditions
      case 'weather_is': {
        const pass = environment?.weather === condition.value;
        return { pass, details: [{ type, pass, reason: `weather: "${environment?.weather}" == "${condition.value}"` }] };
      }
      case 'weather_in': {
        const pass = (condition.values || []).includes(environment?.weather);
        return { pass, details: [{ type, pass, reason: `weather: "${environment?.weather}" in [${condition.values}]` }] };
      }
      case 'time_of_day_is': {
        const pass = environment?.time_of_day === condition.value;
        return { pass, details: [{ type, pass, reason: `time_of_day: "${environment?.time_of_day}" == "${condition.value}"` }] };
      }
      case 'time_between': {
        if (!environment) return { pass: false, details: [{ type, pass: false, reason: 'No environment' }] };
        const totalMins = environment.current_hour * 60 + environment.current_minute;
        const fromMins = (condition.from_hour || 0) * 60 + (condition.from_minute || 0);
        const toMins = (condition.to_hour || 23) * 60 + (condition.to_minute || 59);
        let pass;
        if (fromMins <= toMins) {
          pass = totalMins >= fromMins && totalMins <= toMins;
        } else {
          pass = totalMins >= fromMins || totalMins <= toMins;
        }
        return { pass, details: [{ type, pass, reason: `time ${environment.current_hour}:${environment.current_minute} between ${condition.from_hour}:${condition.from_minute || 0}-${condition.to_hour}:${condition.to_minute || 0}` }] };
      }
      case 'calendar_day': {
        const pass = environment?.current_day === condition.day &&
          (condition.month === undefined || environment?.current_month === condition.month);
        return { pass, details: [{ type, pass, reason: `calendar day: ${environment?.current_month}/${environment?.current_day}` }] };
      }
      case 'season_is': {
        // Simple season based on month (quarter-based)
        const month = environment?.current_month || 1;
        const seasons = { spring: [3,4,5], summer: [6,7,8], autumn: [9,10,11], winter: [12,1,2] };
        const pass = (seasons[condition.value] || []).includes(month);
        return { pass, details: [{ type, pass, reason: `season: month ${month} in ${condition.value}` }] };
      }
      case 'location_is': {
        const pass = environment?.current_location_id === condition.location_id;
        return { pass, details: [{ type, pass, reason: `location: ${environment?.current_location_id} == ${condition.location_id}` }] };
      }
      case 'location_in': {
        const pass = (condition.location_ids || []).includes(environment?.current_location_id);
        return { pass, details: [{ type, pass, reason: `location: ${environment?.current_location_id} in [${condition.location_ids}]` }] };
      }
      case 'location_property': {
        if (!environment?.current_location_id) return { pass: false, details: [{ type, pass: false, reason: 'No current location' }] };
        const loc = db.prepare('SELECT properties FROM locations WHERE id = ?').get(environment.current_location_id);
        const props = loc ? JSON.parse(loc.properties || '{}') : {};
        const val = props[condition.property];
        const pass = condition.value !== undefined ? val === condition.value : !!val;
        return { pass, details: [{ type, pass, reason: `location property "${condition.property}": ${JSON.stringify(val)}` }] };
      }

      // Meta conditions
      case 'random_chance': {
        const pass = Math.random() < (condition.probability || 0.5);
        return { pass, details: [{ type, pass, reason: `random chance: ${condition.probability || 0.5}` }] };
      }
      case 'hours_since_effect': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const stats = getComputedStats(character.id);
        const effect = stats?.effects_breakdown.find(e => e.name === condition.effect_name);
        if (!effect) return { pass: false, details: [{ type, pass: false, reason: `Effect "${condition.effect_name}" not applied` }] };
        // Approximate: use duration_value - remaining_hours
        const elapsed = effect.duration_type === 'timed' && effect.remaining_hours !== null
          ? effect.duration_value - effect.remaining_hours : 0;
        const pass = condition.operator === 'gte' ? elapsed >= condition.hours : elapsed <= condition.hours;
        return { pass, details: [{ type, pass, reason: `hours since "${condition.effect_name}": ${elapsed} ${condition.operator} ${condition.hours}` }] };
      }
      case 'hours_since_last_rest': {
        if (!character) return { pass: false, details: [{ type, pass: false, reason: 'No character context' }] };
        const state = db.prepare(
          "SELECT state_value FROM rule_state WHERE character_id = ? AND state_key = 'last_rest_time'"
        ).get(character.id);
        if (!state) {
          // No rest recorded, treat as infinite hours
          const pass = true;
          return { pass, details: [{ type, pass, reason: 'No rest recorded (infinite hours)' }] };
        }
        // state_value is stored as "day,hour,minute"
        const parts = state.state_value.split(',').map(Number);
        if (parts.length === 3) {
          const lastTotal = parts[0] * 1440 + parts[1] * 60 + parts[2];
          const env = environment || {};
          const nowTotal = (env.current_day || 1) * 1440 + (env.current_hour || 0) * 60 + (env.current_minute || 0);
          const hoursSince = (nowTotal - lastTotal) / 60;
          const pass = condition.operator === 'gte' ? hoursSince >= condition.hours : hoursSince <= condition.hours;
          return { pass, details: [{ type, pass, reason: `hours since last rest: ${hoursSince.toFixed(1)} ${condition.operator} ${condition.hours}` }] };
        }
        return { pass: false, details: [{ type, pass: false, reason: 'Invalid rest state data' }] };
      }

      default:
        return { pass: false, details: [{ type, pass: false, reason: `Unknown condition type: ${type}` }] };
    }
  } catch (err) {
    return { pass: false, details: [{ type, pass: false, reason: `Error: ${err.message}` }] };
  }
}

module.exports = { evaluateConditionTree };
