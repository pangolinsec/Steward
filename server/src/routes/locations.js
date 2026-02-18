const express = require('express');
const router = express.Router({ mergeParams: true });
const db = require('../db');
const { advanceTime } = require('../advanceTimeEngine');

function fireRules(campaignId, triggerType, triggerContext) {
  try {
    const { evaluateRules } = require('../rulesEngine/engine');
    return evaluateRules(campaignId, triggerType, triggerContext);
  } catch (e) {
    console.error(`Rules engine error (${triggerType}):`, e.message);
    return { fired: [], notifications: [], events: [] };
  }
}

function parseLocation(loc) {
  return {
    ...loc,
    weather_override: loc.weather_override ? JSON.parse(loc.weather_override) : null,
    properties: JSON.parse(loc.properties || '{}'),
  };
}

function parseEdge(edge) {
  return {
    ...edge,
    properties: JSON.parse(edge.properties || '{}'),
    weather_override: edge.weather_override ? JSON.parse(edge.weather_override) : null,
  };
}

// GET all locations
router.get('/', (req, res) => {
  const locations = db.prepare('SELECT * FROM locations WHERE campaign_id = ? ORDER BY name').all(req.params.id);
  const edges = db.prepare('SELECT * FROM location_edges WHERE campaign_id = ?').all(req.params.id);
  res.json({
    locations: locations.map(parseLocation),
    edges: edges.map(parseEdge),
  });
});

// GET single location
router.get('/:locId', (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ? AND campaign_id = ?')
    .get(req.params.locId, req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });
  res.json(parseLocation(loc));
});

// POST create location
router.post('/', (req, res) => {
  const { name, description, parent_id, weather_override, encounter_modifier, properties, position_x, position_y } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  const result = db.prepare(`
    INSERT INTO locations (campaign_id, name, description, parent_id, weather_override, encounter_modifier, properties, position_x, position_y)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, name, description || '', parent_id || null,
    weather_override ? JSON.stringify(weather_override) : null,
    encounter_modifier ?? 1.0,
    JSON.stringify(properties || {}),
    position_x ?? 0, position_y ?? 0,
  );

  const loc = db.prepare('SELECT * FROM locations WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseLocation(loc));
});

// PUT update location
router.put('/:locId', (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ? AND campaign_id = ?')
    .get(req.params.locId, req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  const { name, description, parent_id, weather_override, encounter_modifier, properties, position_x, position_y } = req.body;

  db.prepare(`
    UPDATE locations SET
      name = COALESCE(?, name),
      description = COALESCE(?, description),
      parent_id = ?,
      weather_override = ?,
      encounter_modifier = COALESCE(?, encounter_modifier),
      properties = COALESCE(?, properties),
      position_x = COALESCE(?, position_x),
      position_y = COALESCE(?, position_y)
    WHERE id = ? AND campaign_id = ?
  `).run(
    name || null,
    description !== undefined ? description : null,
    parent_id !== undefined ? (parent_id || null) : loc.parent_id,
    weather_override !== undefined ? (weather_override ? JSON.stringify(weather_override) : null) : loc.weather_override,
    encounter_modifier !== undefined ? encounter_modifier : null,
    properties ? JSON.stringify(properties) : null,
    position_x !== undefined ? position_x : null,
    position_y !== undefined ? position_y : null,
    req.params.locId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM locations WHERE id = ?').get(req.params.locId);
  res.json(parseLocation(updated));
});

// DELETE location
router.delete('/:locId', (req, res) => {
  const loc = db.prepare('SELECT * FROM locations WHERE id = ? AND campaign_id = ?')
    .get(req.params.locId, req.params.id);
  if (!loc) return res.status(404).json({ error: 'Location not found' });

  // Clear party position if at this location
  db.prepare('UPDATE environment_state SET current_location_id = NULL WHERE campaign_id = ? AND current_location_id = ?')
    .run(req.params.id, req.params.locId);

  db.prepare('DELETE FROM locations WHERE id = ?').run(req.params.locId);
  res.json({ success: true });
});

// GET all edges
router.get('/edges/list', (req, res) => {
  const edges = db.prepare('SELECT * FROM location_edges WHERE campaign_id = ?').all(req.params.id);
  res.json(edges.map(parseEdge));
});

// POST create edge
router.post('/edges', (req, res) => {
  const { from_location_id, to_location_id, label, description, travel_hours, bidirectional, encounter_modifier, properties, weather_override } = req.body;
  if (!from_location_id || !to_location_id) return res.status(400).json({ error: 'from_location_id and to_location_id are required' });

  const result = db.prepare(`
    INSERT INTO location_edges (campaign_id, from_location_id, to_location_id, label, description, travel_hours, bidirectional, encounter_modifier, properties, weather_override)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    req.params.id, from_location_id, to_location_id,
    label || '', description || '', travel_hours ?? 1.0, bidirectional ?? 1,
    encounter_modifier ?? 1.0, JSON.stringify(properties || {}),
    weather_override ? JSON.stringify(weather_override) : null,
  );

  const edge = db.prepare('SELECT * FROM location_edges WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(parseEdge(edge));
});

// PUT update edge
router.put('/edges/:edgeId', (req, res) => {
  const edge = db.prepare('SELECT * FROM location_edges WHERE id = ? AND campaign_id = ?')
    .get(req.params.edgeId, req.params.id);
  if (!edge) return res.status(404).json({ error: 'Edge not found' });

  const { label, description, travel_hours, bidirectional, encounter_modifier, properties, weather_override } = req.body;

  db.prepare(`
    UPDATE location_edges SET
      label = COALESCE(?, label),
      description = COALESCE(?, description),
      travel_hours = COALESCE(?, travel_hours),
      bidirectional = COALESCE(?, bidirectional),
      encounter_modifier = COALESCE(?, encounter_modifier),
      properties = COALESCE(?, properties),
      weather_override = ?
    WHERE id = ? AND campaign_id = ?
  `).run(
    label !== undefined ? label : null,
    description !== undefined ? description : null,
    travel_hours !== undefined ? travel_hours : null,
    bidirectional !== undefined ? (bidirectional ? 1 : 0) : null,
    encounter_modifier !== undefined ? encounter_modifier : null,
    properties ? JSON.stringify(properties) : null,
    weather_override !== undefined ? (weather_override ? JSON.stringify(weather_override) : null) : edge.weather_override,
    req.params.edgeId, req.params.id,
  );

  const updated = db.prepare('SELECT * FROM location_edges WHERE id = ?').get(req.params.edgeId);
  res.json(parseEdge(updated));
});

// DELETE edge
router.delete('/edges/:edgeId', (req, res) => {
  const edge = db.prepare('SELECT * FROM location_edges WHERE id = ? AND campaign_id = ?')
    .get(req.params.edgeId, req.params.id);
  if (!edge) return res.status(404).json({ error: 'Edge not found' });
  db.prepare('DELETE FROM location_edges WHERE id = ?').run(req.params.edgeId);
  res.json({ success: true });
});

// POST travel along an edge
router.post('/travel', (req, res) => {
  const { edge_id } = req.body;
  if (!edge_id) return res.status(400).json({ error: 'edge_id is required' });

  const edge = db.prepare('SELECT * FROM location_edges WHERE id = ? AND campaign_id = ?')
    .get(edge_id, req.params.id);
  if (!edge) return res.status(404).json({ error: 'Edge not found' });

  const env = db.prepare('SELECT * FROM environment_state WHERE campaign_id = ?').get(req.params.id);
  if (!env) return res.status(404).json({ error: 'Environment not found' });

  // Determine destination
  const currentLocId = env.current_location_id;
  let destinationId;
  if (currentLocId === edge.from_location_id) {
    destinationId = edge.to_location_id;
  } else if (edge.bidirectional && currentLocId === edge.to_location_id) {
    destinationId = edge.from_location_id;
  } else {
    return res.status(400).json({ error: 'Cannot travel this edge from current location' });
  }

  const fromLoc = db.prepare('SELECT name FROM locations WHERE id = ?').get(currentLocId);
  const toLoc = db.prepare('SELECT name FROM locations WHERE id = ?').get(destinationId);

  // Set traveling state
  db.prepare('UPDATE environment_state SET current_edge_id = ?, current_location_id = NULL, edge_progress = 0 WHERE campaign_id = ?')
    .run(edge_id, req.params.id);

  // Advance time by travel hours
  const hours = edge.travel_hours || 1;
  const result = advanceTime(req.params.id, { hours: Math.floor(hours), minutes: Math.round((hours % 1) * 60) });

  // Arrive at destination
  db.prepare('UPDATE environment_state SET current_location_id = ?, current_edge_id = NULL, edge_progress = 0 WHERE campaign_id = ?')
    .run(destinationId, req.params.id);

  // Log travel
  db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
    .run(req.params.id, 'travel', `Party traveled from ${fromLoc?.name || 'Unknown'} to ${toLoc?.name || 'Unknown'} (${hours} hours)`);

  // Add travel event to result
  result.events.push({
    type: 'travel',
    from: fromLoc?.name || 'Unknown',
    to: toLoc?.name || 'Unknown',
    hours,
  });

  // Fire on_location_change rules
  const locResult = fireRules(req.params.id, 'on_location_change', {
    direction: 'arriving', location_id: destinationId, location_name: toLoc?.name,
    from_location_id: currentLocId, from_location_name: fromLoc?.name,
  });
  result.events.push(...locResult.events);

  // Update response with final location
  result.current_location_id = destinationId;
  result.current_location_name = toLoc?.name || null;
  result.current_edge_id = null;
  result.edge_progress = 0;

  res.json(result);
});

// PATCH update party position
router.patch('/position', (req, res) => {
  const { location_id } = req.body;
  db.prepare('UPDATE environment_state SET current_location_id = ?, current_edge_id = NULL, edge_progress = 0 WHERE campaign_id = ?')
    .run(location_id || null, req.params.id);

  const locationName = location_id
    ? db.prepare('SELECT name FROM locations WHERE id = ?').get(location_id)?.name
    : null;

  if (location_id && locationName) {
    db.prepare('INSERT INTO session_log (campaign_id, entry_type, message) VALUES (?, ?, ?)')
      .run(req.params.id, 'travel', `Party position set to ${locationName}`);

    fireRules(req.params.id, 'on_location_change', {
      direction: 'arriving', location_id, location_name: locationName,
    });
  }

  res.json({ success: true, current_location_id: location_id, current_location_name: locationName });
});

module.exports = router;
