const db = require('./db');

function getComputedStats(characterId) {
  const char = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId);
  if (!char) return null;

  const base = JSON.parse(char.base_attributes);

  const appliedEffects = db.prepare(`
    SELECT ae.*, sed.name, sed.modifiers, sed.tags, sed.duration_type, sed.duration_value, sed.description
    FROM applied_effects ae
    JOIN status_effect_definitions sed ON ae.status_effect_definition_id = sed.id
    WHERE ae.character_id = ?
  `).all(characterId);

  const effectsBreakdown = appliedEffects.map(e => ({
    id: e.id,
    definition_id: e.status_effect_definition_id,
    name: e.name,
    description: e.description,
    tags: JSON.parse(e.tags),
    modifiers: JSON.parse(e.modifiers),
    applied_at: e.applied_at,
    remaining_rounds: e.remaining_rounds,
    remaining_hours: e.remaining_hours,
    duration_type: e.duration_type,
    duration_value: e.duration_value,
  }));

  const charItems = db.prepare(`
    SELECT ci.*, id.name, id.modifiers, id.item_type, id.description, id.properties, id.stackable
    FROM character_items ci
    JOIN item_definitions id ON ci.item_definition_id = id.id
    WHERE ci.character_id = ?
  `).all(characterId);

  const itemsBreakdown = charItems.map(i => ({
    id: i.id,
    definition_id: i.item_definition_id,
    name: i.name,
    description: i.description,
    item_type: i.item_type,
    properties: JSON.parse(i.properties),
    stackable: !!i.stackable,
    quantity: i.quantity,
    modifiers: JSON.parse(i.modifiers),
  }));

  const effective = { ...base };

  for (const effect of effectsBreakdown) {
    for (const mod of effect.modifiers) {
      if (effective[mod.attribute] !== undefined) {
        effective[mod.attribute] += mod.delta;
      }
    }
  }

  for (const item of itemsBreakdown) {
    for (const mod of item.modifiers) {
      if (effective[mod.attribute] !== undefined) {
        effective[mod.attribute] += mod.delta;
      }
    }
  }

  return {
    character: { ...char, base_attributes: base },
    base,
    effects_breakdown: effectsBreakdown,
    items_breakdown: itemsBreakdown,
    effective,
  };
}

function getEffectiveAttribute(characterId, attrKey) {
  const stats = getComputedStats(characterId);
  if (!stats) return null;
  return stats.effective[attrKey] ?? null;
}

module.exports = { getComputedStats, getEffectiveAttribute };
