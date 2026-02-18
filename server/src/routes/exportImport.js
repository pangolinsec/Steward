const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { ENTITY_CONFIG, IMPORT_ORDER } = require('../entityConfig');
const {
  fetchEntities,
  fetchRelations,
  insertEntity,
  remapEncounterNpcs,
  remapEncounterConditionLocations,
  remapLocationEdges,
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
      encounter_settings: campaign.encounter_settings ? JSON.parse(campaign.encounter_settings) : null,
      weather_volatility: campaign.weather_volatility,
      weather_transition_table: campaign.weather_transition_table ? JSON.parse(campaign.weather_transition_table) : null,
      rules_settings: campaign.rules_settings ? JSON.parse(campaign.rules_settings) : null,
      property_key_registry: campaign.property_key_registry ? JSON.parse(campaign.property_key_registry) : [],
      season_options: campaign.season_options ? JSON.parse(campaign.season_options) : [],
      custom_tag_presets: JSON.parse(campaign.custom_tag_presets || '[]'),
      dice_settings: campaign.dice_settings ? JSON.parse(campaign.dice_settings) : null,
      time_advance_presets: campaign.time_advance_presets ? JSON.parse(campaign.time_advance_presets) : null,
      dashboard_time_presets: campaign.dashboard_time_presets ? JSON.parse(campaign.dashboard_time_presets) : null,
    },
  };

  for (const entityKey of IMPORT_ORDER) {
    const config = ENTITY_CONFIG[entityKey];
    exportData[config.exportKey] = fetchEntities(db, campaignId, entityKey);
  }

  // Fetch relations (applied_effects, character_items, edges)
  for (const entityKey of IMPORT_ORDER) {
    const config = ENTITY_CONFIG[entityKey];
    if (!config.relations || config.relations.length === 0) continue;
    const entityIds = exportData[config.exportKey].map(e => e.id);
    for (const relation of config.relations) {
      exportData[relation.exportKey] = fetchRelations(db, entityIds, relation);
    }
  }

  // Location edges (not relation-driven — has campaign_id column)
  exportData.edges = db.prepare('SELECT * FROM location_edges WHERE campaign_id = ?').all(campaignId);

  // Environment & session log (not entity-config driven)
  exportData.environment = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(campaignId);
  exportData.session_log = db.prepare('SELECT * FROM session_log WHERE campaign_id = ?').all(campaignId);

  res.setHeader('Content-Disposition', `attachment; filename="steward-${campaign.name.replace(/\s+/g, '-')}.json"`);
  res.json(exportData);
});

// POST import campaign (full — creates new campaign)
router.post('/import', (req, res) => {
  const data = req.body;
  if (!data || !data.campaign) return res.status(400).json({ error: 'Invalid import data' });

  const importTransaction = db.transaction(() => {
    // Create campaign
    const campaignResult = db.prepare(`
      INSERT INTO campaigns (
        name, attribute_definitions, time_of_day_thresholds, calendar_config,
        weather_options, encounter_settings, weather_volatility, weather_transition_table,
        rules_settings, property_key_registry, season_options, custom_tag_presets,
        dice_settings, time_advance_presets, dashboard_time_presets
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.campaign.name + ' (Imported)',
      JSON.stringify(data.campaign.attribute_definitions || []),
      JSON.stringify(data.campaign.time_of_day_thresholds || []),
      JSON.stringify(data.campaign.calendar_config || {}),
      JSON.stringify(data.campaign.weather_options || []),
      JSON.stringify(data.campaign.encounter_settings || db.CAMPAIGN_DEFAULTS.encounter_settings),
      data.campaign.weather_volatility ?? db.CAMPAIGN_DEFAULTS.weather_volatility,
      data.campaign.weather_transition_table ? JSON.stringify(data.campaign.weather_transition_table) : null,
      JSON.stringify(data.campaign.rules_settings || { cascade_depth_limit: 3, engine_enabled: true }),
      JSON.stringify(data.campaign.property_key_registry || []),
      JSON.stringify(data.campaign.season_options || ['Spring', 'Summer', 'Autumn', 'Winter']),
      JSON.stringify(data.campaign.custom_tag_presets || []),
      JSON.stringify(data.campaign.dice_settings || { log_rolls: false }),
      JSON.stringify(data.campaign.time_advance_presets || [
        { label: '+10m', hours: 0, minutes: 10 },
        { label: '+1h', hours: 1, minutes: 0 },
        { label: '+8h', hours: 8, minutes: 0 },
      ]),
      JSON.stringify(data.campaign.dashboard_time_presets || [
        { label: '+15m', hours: 0, minutes: 15 },
        { label: '+1h', hours: 1, minutes: 0 },
        { label: '+4h', hours: 4, minutes: 0 },
      ]),
    );
    const newCampaignId = campaignResult.lastInsertRowid;

    // ID maps for cross-entity references
    const idMaps = {};

    // Import entities in order using shared config
    for (const entityKey of IMPORT_ORDER) {
      const config = ENTITY_CONFIG[entityKey];
      const entities = data[config.exportKey] || [];
      idMaps[config.idMapKey] = {};
      const insertionOrder = [];  // track DB IDs in array order for positional edge mapping

      for (const entity of entities) {
        const oldId = entity.id;
        const newId = insertEntity(db, newCampaignId, entityKey, entity);
        idMaps[config.idMapKey][oldId] = newId;
        insertionOrder.push(newId);
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

      // Post-process hooks
      if (config.postProcess === 'remapEncounterNpcs') {
        const charIdMap = idMaps.charIdMap || {};
        const locationIdMap = idMaps.locationIdMap || {};
        const edgeIdMap = idMaps.edgeIdMap || {};
        for (const entity of entities) {
          const newId = idMaps[config.idMapKey]?.[entity.id];
          if (newId && entity.npcs) {
            remapEncounterNpcs(db, newCampaignId, newId, entity.npcs, charIdMap);
          }
          if (newId && entity.conditions) {
            const conds = typeof entity.conditions === 'string' ? JSON.parse(entity.conditions) : entity.conditions;
            remapEncounterConditionLocations(db, newCampaignId, newId, conds, locationIdMap, edgeIdMap);
          }
        }
      }
      if (config.postProcess === 'remapLocationEdges') {
        const locationIdMap = idMaps.locationIdMap || {};
        idMaps.edgeIdMap = remapLocationEdges(db, newCampaignId, data.edges, locationIdMap, insertionOrder);
      }
    }

    // Import environment
    if (data.environment) {
      const locationIdMap = idMaps.locationIdMap || {};
      const edgeIdMap = idMaps.edgeIdMap || {};
      const newLocId = data.environment.current_location_id
        ? (locationIdMap[data.environment.current_location_id] || null)
        : null;
      const newEdgeId = data.environment.current_edge_id
        ? (edgeIdMap[data.environment.current_edge_id] || null)
        : null;
      db.prepare(`
        INSERT INTO environment_state (
          campaign_id, current_hour, current_minute, current_day, current_month,
          current_year, weather, environment_notes, current_location_id,
          current_edge_id, edge_progress, last_encounter_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        newCampaignId,
        data.environment.current_hour || 12,
        data.environment.current_minute || 0,
        data.environment.current_day || 1,
        data.environment.current_month || 1,
        data.environment.current_year || 1,
        data.environment.weather || 'Clear',
        data.environment.environment_notes || '',
        newLocId,
        newEdgeId,
        data.environment.edge_progress ?? 0,
        data.environment.last_encounter_at || null,
      );
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
