/**
 * Dijkstra shortest-path on the location graph, weighted by travel_hours.
 * Returns an ordered array of edge IDs forming the shortest path, or null if unreachable.
 */
export function dijkstra(locations, edges, fromId, toId) {
  if (fromId === toId) return [];

  // Build adjacency list: locationId -> [{ neighborId, edgeId, weight }]
  const adj = new Map();
  for (const loc of locations) adj.set(loc.id, []);

  for (const edge of edges) {
    // Forward direction always valid
    adj.get(edge.from_location_id)?.push({
      neighborId: edge.to_location_id,
      edgeId: edge.id,
      weight: edge.travel_hours,
    });
    // Reverse direction only if bidirectional
    if (edge.bidirectional) {
      adj.get(edge.to_location_id)?.push({
        neighborId: edge.from_location_id,
        edgeId: edge.id,
        weight: edge.travel_hours,
      });
    }
  }

  const dist = new Map();
  const prev = new Map(); // nodeId -> { edgeId, fromId }
  const visited = new Set();

  for (const loc of locations) dist.set(loc.id, Infinity);
  dist.set(fromId, 0);

  while (true) {
    // Pick unvisited node with smallest distance
    let u = null;
    let uDist = Infinity;
    for (const [id, d] of dist) {
      if (!visited.has(id) && d < uDist) {
        u = id;
        uDist = d;
      }
    }
    if (u === null || u === toId) break;
    visited.add(u);

    for (const { neighborId, edgeId, weight } of adj.get(u) || []) {
      if (visited.has(neighborId)) continue;
      const alt = uDist + weight;
      if (alt < dist.get(neighborId)) {
        dist.set(neighborId, alt);
        prev.set(neighborId, { edgeId, fromId: u });
      }
    }
  }

  if (!prev.has(toId) && fromId !== toId) return null;

  // Reconstruct path
  const path = [];
  let cur = toId;
  while (prev.has(cur)) {
    const { edgeId } = prev.get(cur);
    path.unshift(edgeId);
    cur = prev.get(cur).fromId;
  }
  return path;
}

/**
 * Build a full travel route from partyLocationId through clickedNodeIds.
 * For each consecutive pair, runs dijkstra to fill gaps.
 * Returns { legs, totalHours, valid }.
 */
export function buildRoute(locations, edges, partyLocationId, clickedNodeIds) {
  if (!clickedNodeIds.length || !partyLocationId) {
    return { legs: [], totalHours: 0, valid: false };
  }

  const waypoints = [partyLocationId, ...clickedNodeIds];
  const legs = [];
  let valid = true;

  const locMap = new Map(locations.map(l => [l.id, l]));
  const edgeMap = new Map(edges.map(e => [e.id, e]));

  for (let i = 0; i < waypoints.length - 1; i++) {
    const from = waypoints[i];
    const to = waypoints[i + 1];

    const path = dijkstra(locations, edges, from, to);
    if (path === null) {
      valid = false;
      break;
    }

    // Convert edge IDs to leg objects
    let cursor = from;
    for (const edgeId of path) {
      const edge = edgeMap.get(edgeId);
      // Determine direction of traversal
      const isForward = edge.from_location_id === cursor;
      const legFrom = isForward ? edge.from_location_id : edge.to_location_id;
      const legTo = isForward ? edge.to_location_id : edge.from_location_id;

      legs.push({
        edgeId: edge.id,
        fromId: legFrom,
        toId: legTo,
        fromName: locMap.get(legFrom)?.name || '?',
        toName: locMap.get(legTo)?.name || '?',
        hours: edge.travel_hours,
      });
      cursor = legTo;
    }
  }

  const totalHours = legs.reduce((sum, l) => sum + l.hours, 0);
  return { legs, totalHours, valid };
}
