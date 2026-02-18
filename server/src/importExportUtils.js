const { ENTITY_CONFIG, IMPORT_ORDER } = require('./entityConfig');

// --- Value helpers ---

function parseColumnValue(value, col) {
  if (value == null) return col.default ?? null;
  if (col.type === 'json') {
    return typeof value === 'string' ? JSON.parse(value) : value;
  }
  if (col.type === 'bool_int') {
    return typeof value === 'boolean' ? value : !!value;
  }
  return value;
}

function prepareValue(value, col) {
  if (col.type === 'json') return JSON.stringify(value ?? col.default);
  if (col.type === 'bool_int') return value ? 1 : 0;
  return value ?? col.default;
}

function parseRow(row, config) {
  const parsed = {};
  for (const col of config.columns) {
    parsed[col.name] = parseColumnValue(row[col.name], col);
  }
  parsed.id = row.id;
  parsed.campaign_id = row.campaign_id;
  return parsed;
}

// --- DB operations ---

function fetchEntities(db, campaignId, entityKey) {
  const config = ENTITY_CONFIG[entityKey];
  const rows = db.prepare(`SELECT * FROM ${config.table} WHERE campaign_id = ?`).all(campaignId);
  return rows.map(r => parseRow(r, config));
}

function fetchRelations(db, entityIds, relation) {
  if (entityIds.length === 0) return [];
  const placeholders = entityIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT * FROM ${relation.table} WHERE ${relation.foreignKey} IN (${placeholders})`
  ).all(...entityIds);
  return rows;
}

function findExistingByName(db, campaignId, entityKey) {
  const config = ENTITY_CONFIG[entityKey];
  const rows = db.prepare(`SELECT * FROM ${config.table} WHERE campaign_id = ?`).all(campaignId);
  const map = new Map();
  for (const row of rows) {
    const parsed = parseRow(row, config);
    map.set(parsed[config.nameField], parsed);
  }
  return map;
}

function insertEntity(db, campaignId, entityKey, data) {
  const config = ENTITY_CONFIG[entityKey];
  const colNames = config.columns.map(c => c.name);
  const placeholders = ['?', ...colNames.map(() => '?')].join(', ');
  const cols = ['campaign_id', ...colNames].join(', ');
  const values = [campaignId, ...config.columns.map(c => prepareValue(data[c.name], c))];
  const result = db.prepare(`INSERT INTO ${config.table} (${cols}) VALUES (${placeholders})`).run(...values);
  return result.lastInsertRowid;
}

function updateEntity(db, entityKey, existingId, data) {
  const config = ENTITY_CONFIG[entityKey];
  const setClauses = config.columns.map(c => `${c.name} = ?`).join(', ');
  const values = config.columns.map(c => prepareValue(data[c.name], c));
  db.prepare(`UPDATE ${config.table} SET ${setClauses} WHERE id = ?`).run(...values, existingId);
}

function insertRelation(db, relation, ownerId, otherId, relData) {
  const colNames = [relation.foreignKey, relation.otherForeignKey, ...relation.columns.map(c => c.name)];
  const placeholders = colNames.map(() => '?').join(', ');
  const values = [
    ownerId,
    otherId,
    ...relation.columns.map(c => {
      const v = relData[c.name];
      return v ?? c.default;
    }),
  ];
  db.prepare(`INSERT INTO ${relation.table} (${colNames.join(', ')}) VALUES (${placeholders})`).run(...values);
}

function deleteRelationsForEntity(db, relation, entityId) {
  db.prepare(`DELETE FROM ${relation.table} WHERE ${relation.foreignKey} = ?`).run(entityId);
}

// --- NPC remapping ---

function remapEncounterNpcs(db, campaignId, encounterId, npcs, charIdMap) {
  if (!npcs || !Array.isArray(npcs) || npcs.length === 0) return;
  const remapped = npcs.map(npc => {
    if (npc.character_id != null && charIdMap[npc.character_id] != null) {
      return { ...npc, character_id: Number(charIdMap[npc.character_id]) };
    }
    return npc;
  });
  db.prepare(`UPDATE ${ENTITY_CONFIG.encounters.table} SET npcs = ? WHERE id = ?`)
    .run(JSON.stringify(remapped), encounterId);
}

// --- Encounter condition location remapping ---

function remapEncounterConditionLocations(db, campaignId, encounterId, conditions, locationIdMap) {
  if (!conditions || !conditions.location_ids || conditions.location_ids.length === 0) return;
  const remapped = {
    ...conditions,
    location_ids: conditions.location_ids
      .map(id => locationIdMap[id] != null ? Number(locationIdMap[id]) : id)
      .filter(id => id != null),
  };
  db.prepare(`UPDATE ${ENTITY_CONFIG.encounters.table} SET conditions = ? WHERE id = ?`)
    .run(JSON.stringify(remapped), encounterId);
}

// --- Location edge import ---

function remapLocationEdges(db, campaignId, edges, locationIdMap) {
  // Insert edges with remapped from/to location IDs and campaign_id.
  // Called once for all edges (not per-location).
  if (!edges || !Array.isArray(edges)) return;
  for (const edge of edges) {
    const newFromId = locationIdMap[edge.from_location_id];
    const newToId = locationIdMap[edge.to_location_id];
    if (!newFromId || !newToId) continue;
    db.prepare(`
      INSERT INTO location_edges (campaign_id, from_location_id, to_location_id, label, description, travel_hours, bidirectional, encounter_modifier, properties, weather_override)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      campaignId, Number(newFromId), Number(newToId),
      edge.label || '', edge.description || '', edge.travel_hours || 1.0,
      edge.bidirectional ?? 1, edge.encounter_modifier || 1.0,
      typeof edge.properties === 'string' ? edge.properties : JSON.stringify(edge.properties || '{}'),
      edge.weather_override ? (typeof edge.weather_override === 'string' ? edge.weather_override : JSON.stringify(edge.weather_override)) : null,
    );
  }
}

// --- Modifier attribute validation ---

function validateModifierAttributes(entityKey, entities, attrKeys) {
  const config = ENTITY_CONFIG[entityKey];
  if (!config.modifierColumns || config.modifierColumns.length === 0) return [];
  const warnings = [];
  const attrSet = new Set(attrKeys);
  for (const entity of entities) {
    for (const modCol of config.modifierColumns) {
      const mods = entity[modCol];
      if (!Array.isArray(mods)) continue;
      for (const mod of mods) {
        if (mod.attribute && !attrSet.has(mod.attribute)) {
          warnings.push(
            `${config.displayName} "${entity[config.nameField]}": modifier references unknown attribute "${mod.attribute}"`
          );
        }
      }
    }
  }
  return warnings;
}

// --- Prerequisite scanning ---

function extractAllConditions(node) {
  if (!node) return [];
  if (node.all) return node.all.flatMap(extractAllConditions);
  if (node.any) return node.any.flatMap(extractAllConditions);
  if (node.not) return extractAllConditions(node.not);
  return [node];
}

function getExistingNames(db, campaignId, entityKey) {
  const config = ENTITY_CONFIG[entityKey];
  const rows = db.prepare(`SELECT ${config.nameField} FROM ${config.table} WHERE campaign_id = ?`).all(campaignId);
  return rows.map(r => r[config.nameField]);
}

function getExistingIds(db, campaignId, entityKey) {
  const config = ENTITY_CONFIG[entityKey];
  const rows = db.prepare(`SELECT id FROM ${config.table} WHERE campaign_id = ?`).all(campaignId);
  return rows.map(r => r.id);
}

function getAttributeKeys(db, campaignId) {
  const row = db.prepare('SELECT attribute_definitions FROM campaigns WHERE id = ?').get(campaignId);
  if (!row || !row.attribute_definitions) return [];
  try { return JSON.parse(row.attribute_definitions).map(a => a.key); }
  catch { return []; }
}

function getWeatherOptions(db, campaignId) {
  const row = db.prepare('SELECT weather_options FROM campaigns WHERE id = ?').get(campaignId);
  if (!row || !row.weather_options) return [];
  try { return JSON.parse(row.weather_options); }
  catch { return []; }
}

function scanPrerequisites(db, campaignId, importData, entityTypes) {
  const data = normalizeImportData(importData, entityTypes);

  // Build "available" sets: what exists in campaign + what's being imported
  const availableEffects = new Set([
    ...getExistingNames(db, campaignId, 'status_effects'),
    ...(data.status_effects || []).map(e => e.name),
  ]);
  const availableItems = new Set([
    ...getExistingNames(db, campaignId, 'items'),
    ...(data.items || []).map(e => e.name),
  ]);
  const availableAttributes = new Set(getAttributeKeys(db, campaignId));
  const availableWeather = new Set(getWeatherOptions(db, campaignId));
  const availableLocationIds = new Set([
    ...getExistingIds(db, campaignId, 'locations'),
    ...(data.locations || []).map(e => e.id),
  ]);
  const availableCharacterIds = new Set([
    ...getExistingIds(db, campaignId, 'characters'),
    ...(data.characters || []).map(e => e.id),
  ]);

  const issues = [];

  // Scan rules
  for (const rule of (data.rules || [])) {
    const conditions = extractAllConditions(
      typeof rule.conditions === 'string' ? JSON.parse(rule.conditions) : rule.conditions
    );
    const actions = typeof rule.actions === 'string' ? JSON.parse(rule.actions) : (rule.actions || []);
    const targetConfig = typeof rule.target_config === 'string' ? JSON.parse(rule.target_config) : (rule.target_config || {});

    for (const c of conditions) {
      if (['has_effect', 'lacks_effect'].includes(c.type) && c.effect_name && !availableEffects.has(c.effect_name))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'effect', refName: c.effect_name });
      if (['has_item', 'lacks_item', 'item_quantity_lte'].includes(c.type) && c.item_name && !availableItems.has(c.item_name))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'item', refName: c.item_name });
      if (['attribute_gte', 'attribute_lte', 'attribute_eq'].includes(c.type) && c.attribute && !availableAttributes.has(c.attribute))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'attribute', refName: c.attribute });
      if (c.type === 'weather_is' && c.value && !availableWeather.has(c.value))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'weather', refName: c.value });
      if (c.type === 'weather_in' && Array.isArray(c.values))
        for (const v of c.values) if (!availableWeather.has(v))
          issues.push({ entity: rule.name, entityType: 'rules', refType: 'weather', refName: v });
      if (c.type === 'location_is' && c.location_id && !availableLocationIds.has(c.location_id))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'location', refName: `#${c.location_id}` });
    }

    for (const a of actions) {
      if (['apply_effect', 'remove_effect'].includes(a.type) && a.effect_name && !availableEffects.has(a.effect_name))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'effect', refName: a.effect_name });
      if (['consume_item', 'grant_item'].includes(a.type) && a.item_name && !availableItems.has(a.item_name))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'item', refName: a.item_name });
      if (a.type === 'modify_attribute' && a.attribute && !availableAttributes.has(a.attribute))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'attribute', refName: a.attribute });
      if (a.type === 'set_weather' && a.weather && !availableWeather.has(a.weather))
        issues.push({ entity: rule.name, entityType: 'rules', refType: 'weather', refName: a.weather });
    }

    if (Array.isArray(targetConfig.character_ids)) {
      for (const cid of targetConfig.character_ids)
        if (!availableCharacterIds.has(cid))
          issues.push({ entity: rule.name, entityType: 'rules', refType: 'character', refName: `#${cid}` });
    }
  }

  // Scan encounters
  for (const enc of (data.encounters || [])) {
    const npcs = typeof enc.npcs === 'string' ? JSON.parse(enc.npcs) : (enc.npcs || []);
    const loot = typeof enc.loot_table === 'string' ? JSON.parse(enc.loot_table) : (enc.loot_table || []);
    const envOverrides = typeof enc.environment_overrides === 'string' ? JSON.parse(enc.environment_overrides) : (enc.environment_overrides || {});

    for (const npc of npcs)
      if (npc.character_id && !availableCharacterIds.has(npc.character_id))
        issues.push({ entity: enc.name, entityType: 'encounters', refType: 'character', refName: `#${npc.character_id}` });
    for (const item of loot)
      if (item.item_name && !availableItems.has(item.item_name))
        issues.push({ entity: enc.name, entityType: 'encounters', refType: 'item', refName: item.item_name });
    if (envOverrides.weather && !availableWeather.has(envOverrides.weather))
      issues.push({ entity: enc.name, entityType: 'encounters', refType: 'weather', refName: envOverrides.weather });
  }

  return issues;
}

// --- Preview ---

function normalizeImportData(importData, entityTypes) {
  // Full campaign export (has .campaign key) — extract requested entity arrays
  if (importData.campaign) {
    const result = {};
    for (const key of entityTypes) {
      const config = ENTITY_CONFIG[key];
      result[key] = importData[config.exportKey] || [];
    }
    // Include relation data if present
    result.applied_effects = importData.applied_effects || [];
    result.character_items = importData.character_items || [];
    result.edges = importData.edges || [];
    return result;
  }
  // Bare array — interpret as the single entity type
  if (Array.isArray(importData)) {
    if (entityTypes.length === 1) {
      return { [entityTypes[0]]: importData };
    }
    return {};
  }
  // Partial object with entity keys
  const result = {};
  for (const key of entityTypes) {
    const config = ENTITY_CONFIG[key];
    result[key] = importData[config.exportKey] || importData[key] || [];
  }
  result.applied_effects = importData.applied_effects || [];
  result.character_items = importData.character_items || [];
  result.edges = importData.edges || [];
  return result;
}

function buildImportPreview(db, campaignId, importData, entityTypes) {
  const data = normalizeImportData(importData, entityTypes);

  // Get campaign attribute keys for validation
  const campaign = db.prepare('SELECT attribute_definitions FROM campaigns WHERE id = ?').get(campaignId);
  const attrKeys = campaign
    ? JSON.parse(campaign.attribute_definitions).map(a => a.key)
    : [];

  const preview = {};
  const warnings = [];

  for (const entityKey of IMPORT_ORDER) {
    if (!entityTypes.includes(entityKey)) continue;
    const entities = data[entityKey] || [];
    if (entities.length === 0) {
      preview[entityKey] = { total: 0, newItems: [], conflicts: [] };
      continue;
    }

    const existingMap = findExistingByName(db, campaignId, entityKey);
    const config = ENTITY_CONFIG[entityKey];
    const newItems = [];
    const conflicts = [];

    for (const entity of entities) {
      const name = entity[config.nameField];
      const existing = existingMap.get(name);
      if (existing) {
        conflicts.push({ importEntity: entity, existingEntity: existing, name });
      } else {
        newItems.push(entity);
      }
    }

    preview[entityKey] = {
      total: entities.length,
      newItems,
      conflicts,
      displayName: config.displayName,
    };

    // Modifier attribute warnings
    const modWarnings = validateModifierAttributes(entityKey, entities, attrKeys);
    warnings.push(...modWarnings);
  }

  const prerequisites = scanPrerequisites(db, campaignId, importData, entityTypes);
  return { preview, warnings, prerequisites };
}

// --- Merge import engine ---

function executeMergeImport(db, campaignId, importData, decisions, entityTypes) {
  const data = normalizeImportData(importData, entityTypes);
  const idMaps = {};
  const stats = { imported: 0, skipped: 0, overwritten: 0, duplicated: 0 };
  const warnings = [];

  // Get campaign attribute keys for validation
  const campaign = db.prepare('SELECT attribute_definitions FROM campaigns WHERE id = ?').get(campaignId);
  const attrKeys = campaign
    ? JSON.parse(campaign.attribute_definitions).map(a => a.key)
    : [];

  for (const entityKey of IMPORT_ORDER) {
    if (!entityTypes.includes(entityKey)) continue;
    const config = ENTITY_CONFIG[entityKey];
    const entities = data[entityKey] || [];
    const entityDecisions = decisions[entityKey] || {};
    const bulkAction = entityDecisions._bulk || 'skip';
    idMaps[config.idMapKey] = {};

    const existingMap = findExistingByName(db, campaignId, entityKey);

    // Modifier attribute warnings
    const modWarnings = validateModifierAttributes(entityKey, entities, attrKeys);
    warnings.push(...modWarnings);

    for (const entity of entities) {
      const name = entity[config.nameField];
      const existing = existingMap.get(name);
      const oldId = entity.id;
      // Per-element decision overrides bulk
      const action = entityDecisions[name] || (existing ? bulkAction : 'import');

      if (!existing) {
        // New entity — always import
        const newId = insertEntity(db, campaignId, entityKey, entity);
        idMaps[config.idMapKey][oldId] = newId;
        stats.imported++;
      } else if (action === 'skip') {
        // Map old ID to existing ID so downstream relations still resolve
        idMaps[config.idMapKey][oldId] = existing.id;
        stats.skipped++;
      } else if (action === 'overwrite') {
        updateEntity(db, entityKey, existing.id, entity);
        idMaps[config.idMapKey][oldId] = existing.id;
        // If this entity has relations, delete old ones so they get re-imported
        for (const rel of config.relations) {
          deleteRelationsForEntity(db, rel, existing.id);
        }
        stats.overwritten++;
      } else if (action === 'duplicate') {
        const dupData = { ...entity, [config.nameField]: name + ' (Imported)' };
        const newId = insertEntity(db, campaignId, entityKey, dupData);
        idMaps[config.idMapKey][oldId] = newId;
        stats.duplicated++;
      }
    }

    // Import relations for this entity type
    for (const relation of config.relations) {
      const relData = data[relation.exportKey] || [];
      for (const rel of relData) {
        const newOwnerId = idMaps[config.idMapKey]?.[rel[relation.foreignKey]];
        const otherMap = idMaps[relation.otherIdMapKey] || {};
        const newOtherId = otherMap[rel[relation.otherForeignKey]];
        if (newOwnerId && newOtherId) {
          insertRelation(db, relation, newOwnerId, newOtherId, rel);
        }
      }
    }

    // Post-process hooks
    if (config.postProcess === 'remapEncounterNpcs') {
      const charIdMap = idMaps.charIdMap || {};
      const locationIdMap = idMaps.locationIdMap || {};
      for (const entity of entities) {
        const newId = idMaps[config.idMapKey]?.[entity.id];
        if (newId && entity.npcs) {
          remapEncounterNpcs(db, campaignId, newId, entity.npcs, charIdMap);
        }
        if (newId && entity.conditions) {
          const conds = typeof entity.conditions === 'string' ? JSON.parse(entity.conditions) : entity.conditions;
          remapEncounterConditionLocations(db, campaignId, newId, conds, locationIdMap);
        }
      }
    }
    if (config.postProcess === 'remapLocationEdges') {
      const locationIdMap = idMaps.locationIdMap || {};
      remapLocationEdges(db, campaignId, data.edges, locationIdMap);
    }
  }

  return { stats, warnings };
}

module.exports = {
  parseRow,
  prepareValue,
  insertEntity,
  updateEntity,
  fetchEntities,
  fetchRelations,
  findExistingByName,
  validateModifierAttributes,
  remapEncounterNpcs,
  remapEncounterConditionLocations,
  remapLocationEdges,
  buildImportPreview,
  executeMergeImport,
  normalizeImportData,
  extractAllConditions,
  scanPrerequisites,
};
