import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import * as api from '../api';
import { dijkstra } from '../utils/pathfinding';
import { useToast } from '../components/ToastContext';
import PropertyEditor, { getNewRegistryEntries, mergeRegistryEntries } from '../components/PropertyEditor';
import RuleRefBadge from '../components/RuleRefBadge';

function LocationNode({ data, selected }) {
  const isParty = data.isPartyHere;
  return (
    <div className={`location-node${selected ? ' selected' : ''}${isParty ? ' party-here' : ''}`}>
      <Handle type="target" position={Position.Top} className="location-handle" />
      <div className="location-node-name">{data.label}</div>
      {data.description && <div className="location-node-desc">{data.description}</div>}
      <div className="location-node-meta">
        {data.encounter_modifier !== 1.0 && (
          <span className="tag" style={{ fontSize: 10 }}>Enc: {data.encounter_modifier}x</span>
        )}
        {data.weather_override && (
          <span className="tag" style={{ fontSize: 10 }}>
            {data.weather_override.mode === 'fixed' ? `Weather: ${data.weather_override.value}` : 'Weather: weighted'}
          </span>
        )}
      </div>
      {isParty && <div className="location-party-marker">Party</div>}
      {data.routeOrder != null && <div className="location-route-badge">{data.routeOrder}</div>}
      <Handle type="source" position={Position.Bottom} className="location-handle" />
    </div>
  );
}

const nodeTypes = { location: LocationNode };

export default function LocationsPage({ campaignId, campaign, environment, onUpdate }) {
  const [locations, setLocations] = useState([]);
  const [edgesData, setEdgesData] = useState([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selected, setSelected] = useState(null); // { type: 'node'|'edge', id, data }
  const reactFlowWrapper = useRef(null);
  const [reactFlowInstance, setReactFlowInstance] = useState(null);
  const { addToast } = useToast();

  // Travel route state — legs array is the source of truth
  const [routeLegs, setRouteLegs] = useState([]);
  const [traveling, setTraveling] = useState(false);
  const [travelProgress, setTravelProgress] = useState(0);
  const [encounterEvent, setEncounterEvent] = useState(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    const { locations: locs, edges: edgs } = await api.getLocations(campaignId);
    setLocations(locs);
    setEdgesData(edgs);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  // Derived route object
  const route = useMemo(() => {
    if (!routeLegs.length) return null;
    return {
      legs: routeLegs,
      totalHours: routeLegs.reduce((s, l) => s + l.hours, 0),
      valid: true,
    };
  }, [routeLegs]);

  // Where the next appended leg must connect from
  const routeEndpoint = useMemo(() => {
    if (routeLegs.length) return routeLegs[routeLegs.length - 1].toId;
    return environment?.current_location_id ?? null;
  }, [routeLegs, environment?.current_location_id]);

  const clearRoute = useCallback(() => {
    setRouteLegs([]);
    setTraveling(false);
    setTravelProgress(0);
  }, []);

  const handleRemoveLegFrom = useCallback((index) => {
    setRouteLegs(prev => prev.slice(0, index));
  }, []);

  // Helper: convert dijkstra edge IDs into leg objects
  const edgeIdsToLegs = useCallback((edgeIds, startId) => {
    const locMap = new Map(locations.map(l => [l.id, l]));
    const edgeMap = new Map(edgesData.map(e => [e.id, e]));
    const legs = [];
    let cursor = startId;
    for (const edgeId of edgeIds) {
      const edge = edgeMap.get(edgeId);
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
    return legs;
  }, [locations, edgesData]);

  // Build a set of route edge IDs and waypoint orders for highlighting
  const routeEdgeIds = useMemo(() => {
    if (!routeLegs.length) return new Set();
    return new Set(routeLegs.map(l => l.edgeId));
  }, [routeLegs]);

  const waypointOrders = useMemo(() => {
    if (!routeLegs.length) return new Map();
    const map = new Map();
    let order = 1;
    for (const leg of routeLegs) {
      if (!map.has(leg.toId)) map.set(leg.toId, order++);
    }
    return map;
  }, [routeLegs]);

  // Sync locations/edges data to React Flow nodes/edges
  useEffect(() => {
    const partyLocId = environment?.current_location_id;
    const rfNodes = locations.map(loc => ({
      id: String(loc.id),
      type: 'location',
      position: { x: loc.position_x, y: loc.position_y },
      data: {
        label: loc.name,
        description: loc.description,
        encounter_modifier: loc.encounter_modifier,
        weather_override: loc.weather_override,
        isPartyHere: loc.id === partyLocId,
        locationId: loc.id,
        routeOrder: waypointOrders.get(loc.id) ?? null,
      },
    }));

    const rfEdges = edgesData.map(edge => {
      const isRouteEdge = routeEdgeIds.has(edge.id);
      return {
        id: `edge-${edge.id}`,
        source: String(edge.from_location_id),
        target: String(edge.to_location_id),
        label: edge.label ? `${edge.label} (${edge.travel_hours}h)` : `${edge.travel_hours}h`,
        type: 'default',
        animated: isRouteEdge,
        markerEnd: edge.bidirectional ? undefined : { type: MarkerType.ArrowClosed },
        data: { edgeId: edge.id },
        style: {
          stroke: isRouteEdge ? 'var(--accent)' : 'var(--border-light)',
          strokeWidth: isRouteEdge ? 3 : undefined,
        },
        labelStyle: { fill: 'var(--text-secondary)', fontSize: 11 },
        labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.9 },
      };
    });

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [locations, edgesData, environment?.current_location_id, routeEdgeIds, waypointOrders]);

  const onNodeDragStop = useCallback(async (event, node) => {
    await api.updateLocation(campaignId, Number(node.id), {
      position_x: node.position.x,
      position_y: node.position.y,
    });
  }, [campaignId]);

  const onConnect = useCallback(async (params) => {
    const fromId = Number(params.source);
    const toId = Number(params.target);
    await api.createEdge(campaignId, { from_location_id: fromId, to_location_id: toId });
    load();
  }, [campaignId, load]);

  const onPaneClick = useCallback(() => {
    setSelected(null);
  }, []);

  const onWrapperDoubleClick = useCallback(async (event) => {
    if (!event.target.classList.contains('react-flow__pane')) return;
    if (!reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const newLoc = await api.createLocation(campaignId, {
      name: 'New Location',
      position_x: position.x,
      position_y: position.y,
    });
    const { locations: locs, edges: edgs } = await api.getLocations(campaignId);
    setLocations(locs);
    setEdgesData(edgs);
    const created = locs.find(l => l.id === newLoc.id);
    if (created) setSelected({ type: 'node', id: created.id, data: created, isNew: true });
  }, [campaignId, reactFlowInstance]);

  const onNodeClick = useCallback((event, node) => {
    const clickedId = Number(node.id);
    const isRouteClick = event.ctrlKey || event.metaKey;

    if (!isRouteClick) {
      // Normal click — show detail panel
      const loc = locations.find(l => l.id === clickedId);
      if (loc) setSelected({ type: 'node', id: loc.id, data: loc });
      return;
    }

    // Ctrl+click — route building
    if (traveling) return;
    if (!routeEndpoint) {
      addToast('Place the party on the map first', 'warning');
      return;
    }
    if (clickedId === routeEndpoint) return;

    const path = dijkstra(locations, edgesData, routeEndpoint, clickedId);
    if (path === null) {
      addToast('No path to that location', 'warning');
      return;
    }

    const newLegs = edgeIdsToLegs(path, routeEndpoint);
    setRouteLegs(prev => [...prev, ...newLegs]);
    setSelected(null);
  }, [locations, edgesData, routeEndpoint, traveling, edgeIdsToLegs, addToast]);

  const onEdgeClick = useCallback((event, edge) => {
    const edgeData = edgesData.find(e => `edge-${e.id}` === edge.id);
    if (!edgeData) return;
    const isRouteClick = event.ctrlKey || event.metaKey;

    if (!isRouteClick) {
      // Normal click — show edge detail panel
      setSelected({ type: 'edge', id: edgeData.id, data: edgeData });
      return;
    }

    // Ctrl+click — add this specific edge to the route
    if (traveling) return;
    if (!routeEndpoint) {
      addToast('Place the party on the map first', 'warning');
      return;
    }

    const locMap = new Map(locations.map(l => [l.id, l]));
    let legFrom, legTo;
    if (edgeData.from_location_id === routeEndpoint) {
      legFrom = edgeData.from_location_id;
      legTo = edgeData.to_location_id;
    } else if (edgeData.bidirectional && edgeData.to_location_id === routeEndpoint) {
      legFrom = edgeData.to_location_id;
      legTo = edgeData.from_location_id;
    } else {
      addToast('Edge does not connect to route endpoint', 'warning');
      return;
    }

    setRouteLegs(prev => [...prev, {
      edgeId: edgeData.id,
      fromId: legFrom,
      toId: legTo,
      fromName: locMap.get(legFrom)?.name || '?',
      toName: locMap.get(legTo)?.name || '?',
      hours: edgeData.travel_hours,
    }]);
    setSelected(null);
  }, [edgesData, locations, routeEndpoint, traveling, addToast]);

  const handleDeleteLocation = async (id) => {
    if (!confirm('Delete this location and all its edges?')) return;
    await api.deleteLocation(campaignId, id);
    setSelected(null);
    load();
  };

  const handleDeleteEdge = async (id) => {
    if (!confirm('Delete this path?')) return;
    await api.deleteEdge(campaignId, id);
    setSelected(null);
    load();
  };

  const handleSetPartyPosition = async (locationId) => {
    await api.updatePartyPosition(campaignId, locationId);
    onUpdate();
    load();
  };

  const processEvents = (events) => {
    if (!events) return;
    for (const event of events) {
      if (event.type === 'weather_change') {
        addToast(`Weather: ${event.from} \u2192 ${event.to}`, 'info');
      } else if (event.type === 'travel') {
        addToast(`Traveled: ${event.from} \u2192 ${event.to} (${event.hours}h)`, 'success');
      } else if (event.type === 'effect_expired') {
        addToast(`Effect expired: ${event.effect_name} on ${event.character_name}`, 'info');
      } else if (event.type === 'rule_notification') {
        addToast(event.message || `Rule fired: ${event.rule_name}`, event.severity || 'info');
      }
    }
  };

  const handleTravel = async () => {
    if (!routeLegs.length) return;
    setTraveling(true);
    for (let i = 0; i < routeLegs.length; i++) {
      setTravelProgress(i);
      try {
        const result = await api.travel(campaignId, routeLegs[i].edgeId);
        onUpdate();
        await load();

        // Check for encounter interruption
        const encEvent = result.events?.find(e => e.type === 'encounter_triggered');
        if (encEvent) {
          setEncounterEvent(encEvent);
          // Keep remaining legs in the route for resumption
          const remaining = routeLegs.slice(i + 1);
          if (remaining.length > 0) {
            setRouteLegs(remaining);
          } else {
            clearRoute();
          }
          setTraveling(false);
          processEvents(result.events?.filter(e => e.type !== 'encounter_triggered'));
          return;
        }

        processEvents(result.events);
      } catch (err) {
        addToast(`Travel failed: ${err.message}`, 'error');
        setTraveling(false);
        return;
      }
    }
    clearRoute();
  };

  const handleStartEncounter = async (enc) => {
    const overrides = enc.environment_overrides || {};
    const patch = {};
    if (overrides.weather) patch.weather = overrides.weather;
    if (Object.keys(patch).length > 0) {
      await api.updateEnvironment(campaignId, patch);
    }
    addToast(`Encounter "${enc.name}" started!`, 'warning');
    setEncounterEvent(null);
    onUpdate();
  };

  const showRoutePanel = routeLegs.length > 0 || traveling;

  return (
    <div className="page" style={{ display: 'flex', gap: 0, padding: 0, height: 'calc(100vh - 80px)' }}>
      <div ref={reactFlowWrapper} style={{ flex: 1, minWidth: 0 }} onDoubleClick={onWrapperDoubleClick}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onInit={setReactFlowInstance}
          nodeTypes={nodeTypes}
          zoomOnDoubleClick={false}
          fitView
          proOptions={{ hideAttribution: true }}
          style={{ background: 'var(--bg-primary)' }}
        >
          <Controls style={{ button: { backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)', border: `1px solid var(--border)` } }} />
          <MiniMap
            nodeColor={() => 'var(--accent)'}
            maskColor="rgba(0,0,0,0.5)"
            style={{ background: 'var(--bg-secondary)' }}
          />
          <Background color="var(--border)" gap={20} />
        </ReactFlow>
      </div>

      {showRoutePanel && (
        <div className="location-detail-panel">
          <TravelRoutePanel
            route={route}
            traveling={traveling}
            travelProgress={travelProgress}
            onTravel={handleTravel}
            onClear={clearRoute}
            onRemoveLegFrom={handleRemoveLegFrom}
          />
        </div>
      )}

      {!showRoutePanel && selected && (
        <div className="location-detail-panel">
          {selected.type === 'node' ? (
            <LocationDetailPanel
              key={selected.id}
              campaignId={campaignId}
              location={selected.data}
              locations={locations}
              campaign={campaign}
              environment={environment}
              autoFocus={selected.isNew}
              onSave={() => { load(); }}
              onDelete={() => handleDeleteLocation(selected.id)}
              onSetParty={() => handleSetPartyPosition(selected.id)}
              onClose={() => setSelected(null)}
              onUpdate={onUpdate}
            />
          ) : (
            <EdgeDetailPanel
              key={selected.id}
              campaignId={campaignId}
              edge={selected.data}
              locations={locations}
              campaign={campaign}
              onSave={() => { load(); }}
              onDelete={() => handleDeleteEdge(selected.id)}
              onClose={() => setSelected(null)}
              onUpdate={onUpdate}
            />
          )}
        </div>
      )}

      {!showRoutePanel && !selected && (
        <div className="location-detail-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>Double-click the canvas to create a location.</p>
            <p style={{ fontSize: 13 }}>Drag between nodes to create paths.</p>
            <p style={{ fontSize: 13 }}>Click a node or edge to edit.</p>
            <p style={{ fontSize: 12, marginTop: 16, color: 'var(--text-muted)', fontStyle: 'italic' }}>
              You can create keys and values for properties in the <a href="/environment" style={{ color: 'var(--accent)' }}>Settings</a> page.
            </p>
            {environment?.current_location_id && (
              <p style={{ fontSize: 13, marginTop: 12, color: 'var(--accent)' }}>Ctrl+click nodes or edges to plan a travel route.</p>
            )}
          </div>
        </div>
      )}

      {encounterEvent && (
        <EncounterTriggerModal
          event={encounterEvent}
          onStart={() => handleStartEncounter(encounterEvent.encounter)}
          onDismiss={() => { setEncounterEvent(null); addToast('Encounter dismissed', 'info'); }}
        />
      )}
    </div>
  );
}

function TravelRoutePanel({ route, traveling, travelProgress, onTravel, onClear, onRemoveLegFrom }) {
  const legs = route?.legs || [];
  const totalHours = route?.totalHours || 0;

  return (
    <div className="travel-route-panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Travel Route</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClear} disabled={traveling}>&#x2715;</button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
        Ctrl+click nodes (auto-path) or edges (manual) to build route.
      </div>

      {legs.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 12 }}>
          {legs.map((leg, i) => {
            let cls = 'travel-leg';
            if (traveling && i < travelProgress) cls += ' completed';
            if (traveling && i === travelProgress) cls += ' active';
            return (
              <div key={i} className={cls}>
                <span className="travel-leg-label">{leg.fromName} &rarr; {leg.toName}</span>
                <span className="travel-leg-hours">{leg.hours}h</span>
                {!traveling && (
                  <button
                    className="btn btn-ghost btn-sm travel-leg-remove"
                    onClick={() => onRemoveLegFrom(i)}
                    title="Remove this leg and all after it"
                  >&#x2715;</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {legs.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
          Total: <strong style={{ color: 'var(--text-primary)' }}>{totalHours}h</strong>
          {legs.length > 1 && <span> ({legs.length} legs)</span>}
        </div>
      )}

      <div className="inline-flex gap-sm">
        <button
          className="btn btn-primary btn-sm"
          onClick={onTravel}
          disabled={traveling || legs.length === 0}
        >
          {traveling ? `Traveling leg ${travelProgress + 1}/${legs.length}...` : 'Travel'}
        </button>
        <button className="btn btn-secondary btn-sm" onClick={onClear} disabled={traveling}>
          Clear Route
        </button>
      </div>
    </div>
  );
}

function EncounterTriggerModal({ event, onStart, onDismiss }) {
  const enc = event.encounter;
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ color: 'var(--yellow)' }}>Random Encounter!</h3>
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{enc.name}</div>
          {enc.description && <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>{enc.description}</p>}
          {enc.notes && <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>{enc.notes}</div>}
          {enc.npcs?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>NPCs:</strong>
              <ul style={{ marginLeft: 16, marginTop: 2, fontSize: 13 }}>
                {enc.npcs.map((n, i) => <li key={i}>Character #{n.character_id} ({n.role || 'member'})</li>)}
              </ul>
            </div>
          )}
          {enc.loot_table?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>Loot:</strong>
              <ul style={{ marginLeft: 16, marginTop: 2, fontSize: 13 }}>
                {enc.loot_table.map((l, i) => (
                  <li key={i}>{l.item_name || `Item #${l.item_id}`} x{l.quantity} ({Math.round((l.drop_chance || 1) * 100)}%)</li>
                ))}
              </ul>
            </div>
          )}
          {enc.environment_overrides && Object.keys(enc.environment_overrides).length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Environment overrides: {Object.entries(enc.environment_overrides).map(([k, v]) => `${k}: ${v}`).join(', ')}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Roll probability: {Math.round((event.probability || 0) * 100)}%
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onDismiss}>Dismiss</button>
          <button className="btn btn-primary" onClick={onStart}>Start Encounter</button>
        </div>
      </div>
    </div>
  );
}

function LocationDetailPanel({ campaignId, location, locations, campaign, environment, onSave, onDelete, onSetParty, onClose, autoFocus, onUpdate }) {
  const [name, setName] = useState(location.name);
  const [description, setDescription] = useState(location.description || '');
  const [parentId, setParentId] = useState(location.parent_id || '');
  const [encounterMod, setEncounterMod] = useState(location.encounter_modifier);
  const [weatherOverride, setWeatherOverride] = useState(location.weather_override);
  const [properties, setProperties] = useState(location.properties || {});
  const [saving, setSaving] = useState(false);
  const nameRef = useRef(null);

  // Encounters
  const [encounters, setEncounters] = useState([]);
  const [showEncounterPicker, setShowEncounterPicker] = useState(false);

  useEffect(() => {
    if (campaignId) {
      api.getEncounters(campaignId).then(setEncounters).catch(() => {});
    }
  }, [campaignId]);

  const assignedEncounters = encounters.filter(enc =>
    enc.conditions?.location_ids?.includes(location.id)
  );
  const unassignedEncounters = encounters.filter(enc =>
    !enc.conditions?.location_ids?.includes(location.id)
  );

  const assignEncounter = async (encId) => {
    const enc = encounters.find(e => e.id === encId);
    if (!enc) return;
    const locationIds = [...(enc.conditions?.location_ids || []), location.id];
    await api.updateEncounter(campaignId, encId, {
      ...enc,
      conditions: { ...enc.conditions, location_ids: locationIds },
    });
    const updated = await api.getEncounters(campaignId);
    setEncounters(updated);
  };

  const unassignEncounter = async (encId) => {
    const enc = encounters.find(e => e.id === encId);
    if (!enc) return;
    const locationIds = (enc.conditions?.location_ids || []).filter(id => id !== location.id);
    await api.updateEncounter(campaignId, encId, {
      ...enc,
      conditions: { ...enc.conditions, location_ids: locationIds },
    });
    const updated = await api.getEncounters(campaignId);
    setEncounters(updated);
  };

  useEffect(() => {
    if (autoFocus && nameRef.current) {
      nameRef.current.focus();
      nameRef.current.select();
    }
  }, [autoFocus]);

  const weatherOptions = campaign?.weather_options || [];
  const isPartyHere = environment?.current_location_id === location.id;

  const registry = campaign?.property_key_registry || [];

  const handleSave = async () => {
    setSaving(true);
    // Filter out empty keys
    const cleanProps = {};
    for (const [k, v] of Object.entries(properties)) {
      if (k.trim()) cleanProps[k.trim()] = v;
    }
    await api.updateLocation(campaignId, location.id, {
      name, description, parent_id: parentId || null,
      encounter_modifier: encounterMod,
      weather_override: weatherOverride,
      properties: cleanProps,
    });
    // Auto-register new keys/values to campaign registry
    const newEntries = getNewRegistryEntries(cleanProps, registry);
    if (newEntries.length > 0) {
      const merged = mergeRegistryEntries(registry, newEntries);
      await api.updateCampaign(campaignId, { property_key_registry: merged });
      if (onUpdate) onUpdate();
    }
    setSaving(false);
    onSave();
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center' }}>
          Location
          <RuleRefBadge campaignId={campaignId} entityType="location" entityId={location.id} />
        </h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
      </div>
      <div className="form-group">
        <label>Name</label>
        <input ref={nameRef} type="text" value={name} onChange={e => setName(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
      </div>
      <div className="form-group">
        <label>Parent Location</label>
        <select value={parentId} onChange={e => setParentId(e.target.value ? Number(e.target.value) : '')}>
          <option value="">None</option>
          {locations.filter(l => l.id !== location.id).map(l => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Encounter Modifier</label>
        <input type="number" step="0.1" min="0" value={encounterMod} onChange={e => setEncounterMod(Number(e.target.value))} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>1.0 = normal, 2.0 = double chance</span>
      </div>
      <div className="form-group">
        <label>Properties</label>
        <PropertyEditor properties={properties} onChange={setProperties} registry={registry} />
      </div>

      {/* Weather Override */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Weather Override</label>
        <select
          value={weatherOverride?.mode || ''}
          onChange={e => {
            const mode = e.target.value;
            if (!mode) setWeatherOverride(null);
            else if (mode === 'fixed') setWeatherOverride({ mode: 'fixed', value: weatherOptions[0] || 'Clear' });
            else setWeatherOverride({ mode: 'weighted', value: {} });
          }}
          style={{ marginBottom: 8 }}
        >
          <option value="">None</option>
          <option value="fixed">Fixed</option>
          <option value="weighted">Weighted</option>
        </select>
        {weatherOverride?.mode === 'fixed' && (
          <select value={weatherOverride.value} onChange={e => setWeatherOverride({ ...weatherOverride, value: e.target.value })}>
            {weatherOptions.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        )}
        {weatherOverride?.mode === 'weighted' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {weatherOptions.map(w => (
              <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, width: 80, color: 'var(--text-secondary)' }}>{w}</span>
                <input type="number" step="0.1" min="0" max="1" style={{ width: 70 }}
                  value={weatherOverride.value?.[w] || 0}
                  onChange={e => setWeatherOverride({
                    ...weatherOverride,
                    value: { ...weatherOverride.value, [w]: Number(e.target.value) },
                  })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Encounters Section */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Encounters</label>
        {assignedEncounters.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>No encounters assigned</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6 }}>
            {assignedEncounters.map(enc => (
              <div key={enc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{enc.name}</div>
                  {enc.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{enc.description.slice(0, 60)}{enc.description.length > 60 ? '...' : ''}</div>}
                </div>
                <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}
                  onClick={() => unassignEncounter(enc.id)}>&#x2715;</button>
              </div>
            ))}
          </div>
        )}
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowEncounterPicker(true)}>
          Assign Encounter
        </button>
        {showEncounterPicker && (
          <div style={{ marginTop: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', maxHeight: 180, overflowY: 'auto' }}>
            {unassignedEncounters.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>No unassigned encounters available</div>
            ) : (
              unassignedEncounters.map(enc => (
                <div key={enc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 12 }}>{enc.name}</div>
                    {enc.description && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{enc.description.slice(0, 50)}{enc.description.length > 50 ? '...' : ''}</div>}
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: 10 }}
                    onClick={() => assignEncounter(enc.id)}>Assign</button>
                </div>
              ))
            )}
            <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6, fontSize: 10 }}
              onClick={() => setShowEncounterPicker(false)}>Close</button>
          </div>
        )}
      </div>

      <div className="inline-flex gap-sm" style={{ marginBottom: 8 }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        {!isPartyHere && (
          <button className="btn btn-secondary btn-sm" onClick={onSetParty}>Set Party Here</button>
        )}
        <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
      </div>
      {isPartyHere && <div className="tag" style={{ marginTop: 4, display: 'inline-block' }}>Party is here</div>}
    </div>
  );
}

function EdgeDetailPanel({ campaignId, edge, locations, campaign, onSave, onDelete, onClose, onUpdate }) {
  const [label, setLabel] = useState(edge.label || '');
  const [description, setDescription] = useState(edge.description || '');
  const [travelHours, setTravelHours] = useState(edge.travel_hours);
  const [bidirectional, setBidirectional] = useState(!!edge.bidirectional);
  const [encounterMod, setEncounterMod] = useState(edge.encounter_modifier);
  const [weatherOverride, setWeatherOverride] = useState(edge.weather_override);
  const [properties, setProperties] = useState(edge.properties || {});
  const [saving, setSaving] = useState(false);

  const weatherOptions = campaign?.weather_options || [];
  const fromLoc = locations.find(l => l.id === edge.from_location_id);
  const toLoc = locations.find(l => l.id === edge.to_location_id);

  const registry = campaign?.property_key_registry || [];

  const handleSave = async () => {
    setSaving(true);
    const cleanProps = {};
    for (const [k, v] of Object.entries(properties)) {
      if (k.trim()) cleanProps[k.trim()] = v;
    }
    await api.updateEdge(campaignId, edge.id, {
      label, description, travel_hours: travelHours,
      bidirectional, encounter_modifier: encounterMod,
      weather_override: weatherOverride,
      properties: cleanProps,
    });
    // Auto-register new keys/values to campaign registry
    const newEntries = getNewRegistryEntries(cleanProps, registry);
    if (newEntries.length > 0) {
      const merged = mergeRegistryEntries(registry, newEntries);
      await api.updateCampaign(campaignId, { property_key_registry: merged });
      if (onUpdate) onUpdate();
    }
    setSaving(false);
    onSave();
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Path</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
        {fromLoc?.name || '?'} {bidirectional ? '\u2194' : '\u2192'} {toLoc?.name || '?'}
      </div>
      <div className="form-group">
        <label>Label</label>
        <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Forest Road" />
      </div>
      <div className="form-group">
        <label>Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="A well-worn dirt road..." />
      </div>
      <div className="form-group">
        <label>Travel Time (hours)</label>
        <input type="number" step="0.5" min="0.5" value={travelHours} onChange={e => setTravelHours(Number(e.target.value))} />
      </div>
      <div className="form-group">
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={bidirectional} onChange={e => setBidirectional(e.target.checked)} />
          Bidirectional
        </label>
      </div>
      <div className="form-group">
        <label>Encounter Modifier</label>
        <input type="number" step="0.1" min="0" value={encounterMod} onChange={e => setEncounterMod(Number(e.target.value))} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>1.0 = normal</span>
      </div>
      <div className="form-group">
        <label>Properties</label>
        <PropertyEditor properties={properties} onChange={setProperties} registry={registry} />
      </div>

      {/* Weather Override */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 4, display: 'block' }}>Weather Override</label>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Applies during travel along this path</span>
        <select
          value={weatherOverride?.mode || ''}
          onChange={e => {
            const mode = e.target.value;
            if (!mode) setWeatherOverride(null);
            else if (mode === 'fixed') setWeatherOverride({ mode: 'fixed', value: weatherOptions[0] || 'Clear' });
            else setWeatherOverride({ mode: 'weighted', value: {} });
          }}
          style={{ marginBottom: 8 }}
        >
          <option value="">None</option>
          <option value="fixed">Fixed</option>
          <option value="weighted">Weighted</option>
        </select>
        {weatherOverride?.mode === 'fixed' && (
          <select value={weatherOverride.value} onChange={e => setWeatherOverride({ ...weatherOverride, value: e.target.value })}>
            {weatherOptions.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        )}
        {weatherOverride?.mode === 'weighted' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {weatherOptions.map(w => (
              <div key={w} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, width: 80, color: 'var(--text-secondary)' }}>{w}</span>
                <input type="number" step="0.1" min="0" max="1" style={{ width: 70 }}
                  value={weatherOverride.value?.[w] || 0}
                  onChange={e => setWeatherOverride({
                    ...weatherOverride,
                    value: { ...weatherOverride.value, [w]: Number(e.target.value) },
                  })}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="inline-flex gap-sm">
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
