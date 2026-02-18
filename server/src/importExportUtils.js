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

  return { preview, warnings };
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

    // Post-process hook (encounter NPC remapping)
    if (config.postProcess === 'remapEncounterNpcs') {
      const charIdMap = idMaps.charIdMap || {};
      for (const entity of entities) {
        const newId = idMaps[config.idMapKey]?.[entity.id];
        if (newId && entity.npcs) {
          remapEncounterNpcs(db, campaignId, newId, entity.npcs, charIdMap);
        }
      }
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
  buildImportPreview,
  executeMergeImport,
  normalizeImportData,
};
