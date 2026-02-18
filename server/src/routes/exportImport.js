const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { ENTITY_CONFIG, IMPORT_ORDER } = require('../entityConfig');
const {
  fetchEntities,
  fetchRelations,
  insertEntity,
  remapEncounterNpcs,
  buildImportPreview,
  executeMergeImport,
} = require('../importExportUtils');

// GET export full campaign
router.get('/export', (req, res) => {
  const campaignId = req.params.id;

  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Fetch all entity types via config
  const exportData = {
    version: 1,
    exported_at: new Date().toISOString(),
    campaign: {
      ...campaign,
      attribute_definitions: JSON.parse(campaign.attribute_definitions),
      time_of_day_thresholds: JSON.parse(campaign.time_of_day_thresholds),
      calendar_config: JSON.parse(campaign.calendar_config),
      weather_options: JSON.parse(campaign.weather_options),
    },
  };

  for (const entityKey of IMPORT_ORDER) {
    const config = ENTITY_CONFIG[entityKey];
    exportData[config.exportKey] = fetchEntities(db, campaignId, entityKey);
  }

  // Fetch relations (applied_effects, character_items)
  const charConfig = ENTITY_CONFIG.characters;
  const charIds = exportData[charConfig.exportKey].map(c => c.id);
  for (const relation of charConfig.relations) {
    exportData[relation.exportKey] = fetchRelations(db, charIds, relation);
  }

  // Environment & session log (not entity-config driven)
  exportData.environment = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  exportData.session_log = db.prepare('SELECT * FROM session_log WHERE campaign_id = ?').all(campaignId);

  res.setHeader('Content-Disposition', `attachment; filename="almanac-${campaign.name.replace(/\s+/g, '-')}.json"`);
  res.json(exportData);
});

// POST import campaign (full — creates new campaign)
router.post('/import', (req, res) => {
  const data = req.body;
  if (!data || !data.campaign) return res.status(400).json({ error: 'Invalid import data' });

  const importTransaction = db.transaction(() => {
    // Create campaign
    const campaignResult = db.prepare(`
      INSERT INTO campaigns (name, attribute_definitions, time_of_day_thresholds, calendar_config, weather_options)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      data.campaign.name + ' (Imported)',
      JSON.stringify(data.campaign.attribute_definitions || []),
      JSON.stringify(data.campaign.time_of_day_thresholds || []),
      JSON.stringify(data.campaign.calendar_config || {}),
      JSON.stringify(data.campaign.weather_options || []),
    );
    const newCampaignId = campaignResult.lastInsertRowid;

    // ID maps for cross-entity references
    const idMaps = {};

    // Import entities in order using shared config
    for (const entityKey of IMPORT_ORDER) {
      const config = ENTITY_CONFIG[entityKey];
      const entities = data[config.exportKey] || [];
      idMaps[config.idMapKey] = {};

      for (const entity of entities) {
        const oldId = entity.id;
        const newId = insertEntity(db, newCampaignId, entityKey, entity);
        idMaps[config.idMapKey][oldId] = newId;
      }

      // Import relations
      for (const relation of config.relations) {
        const relData = data[relation.exportKey] || [];
        for (const rel of relData) {
          const newOwnerId = idMaps[config.idMapKey]?.[rel[relation.foreignKey]];
          const otherMap = idMaps[relation.otherIdMapKey] || {};
          const newOtherId = otherMap[rel[relation.otherForeignKey]];
          if (newOwnerId && newOtherId) {
            const colNames = [relation.foreignKey, relation.otherForeignKey, ...relation.columns.map(c => c.name)];
            const placeholders = colNames.map(() => '?').join(', ');
            const values = [
              newOwnerId,
              newOtherId,
              ...relation.columns.map(c => rel[c.name] ?? c.default),
            ];
            db.prepare(`INSERT INTO ${relation.table} (${colNames.join(', ')}) VALUES (${placeholders})`).run(...values);
          }
        }
      }

      // Post-process hook (encounter NPC remapping)
      if (config.postProcess === 'remapEncounterNpcs') {
        const charIdMap = idMaps.charIdMap || {};
        for (const entity of entities) {
          const newId = idMaps[config.idMapKey]?.[entity.id];
          if (newId && entity.npcs) {
            remapEncounterNpcs(db, newCampaignId, newId, entity.npcs, charIdMap);
          }
        }
      }
    }

    // Import environment
    if (data.environment) {
      db.prepare(`
        INSERT INTO environment_state (campaign_id, current_hour, current_minute, current_day, current_month, current_year, weather, environment_notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(newCampaignId, data.environment.current_hour || 12, data.environment.current_minute || 0, data.environment.current_day || 1, data.environment.current_month || 1, data.environment.current_year || 1, data.environment.weather || 'Clear', data.environment.environment_notes || '');
    } else {
      db.prepare('INSERT INTO environment_state (campaign_id) VALUES (?)').run(newCampaignId);
    }

    return newCampaignId;
  });

  try {
    const newCampaignId = importTransaction();
    const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(newCampaignId);
    res.status(201).json({
      ...campaign,
      attribute_definitions: JSON.parse(campaign.attribute_definitions),
      time_of_day_thresholds: JSON.parse(campaign.time_of_day_thresholds),
      calendar_config: JSON.parse(campaign.calendar_config),
      weather_options: JSON.parse(campaign.weather_options),
    });
  } catch (err) {
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

// POST import preview — conflict detection + attribute warnings
router.post('/import/preview', (req, res) => {
  const campaignId = req.params.id;
  const { data, entityTypes } = req.body;
  if (!data || !entityTypes || !Array.isArray(entityTypes)) {
    return res.status(400).json({ error: 'Missing data or entityTypes' });
  }
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  // Validate entity types
  const validTypes = entityTypes.filter(t => ENTITY_CONFIG[t]);
  if (validTypes.length === 0) {
    return res.status(400).json({ error: 'No valid entity types specified' });
  }

  try {
    const result = buildImportPreview(db, campaignId, data, validTypes);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Preview failed: ' + err.message });
  }
});

// POST import merge — execute partial import with conflict resolution
router.post('/import/merge', (req, res) => {
  const campaignId = req.params.id;
  const { data, entityTypes, decisions } = req.body;
  if (!data || !entityTypes || !Array.isArray(entityTypes) || !decisions) {
    return res.status(400).json({ error: 'Missing data, entityTypes, or decisions' });
  }
  const campaign = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(campaignId);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const validTypes = entityTypes.filter(t => ENTITY_CONFIG[t]);
  if (validTypes.length === 0) {
    return res.status(400).json({ error: 'No valid entity types specified' });
  }

  const mergeTransaction = db.transaction(() => {
    return executeMergeImport(db, campaignId, data, decisions, validTypes);
  });

  try {
    const result = mergeTransaction();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Merge import failed: ' + err.message });
  }
});

module.exports = router;
