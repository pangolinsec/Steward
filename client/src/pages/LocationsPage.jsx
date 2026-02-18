import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import * as api from '../api';

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

  const load = useCallback(async () => {
    if (!campaignId) return;
    const { locations: locs, edges: edgs } = await api.getLocations(campaignId);
    setLocations(locs);
    setEdgesData(edgs);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

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
      },
    }));

    const rfEdges = edgesData.map(edge => ({
      id: `edge-${edge.id}`,
      source: String(edge.from_location_id),
      target: String(edge.to_location_id),
      label: edge.label ? `${edge.label} (${edge.travel_hours}h)` : `${edge.travel_hours}h`,
      type: 'default',
      animated: false,
      markerEnd: edge.bidirectional ? undefined : { type: MarkerType.ArrowClosed },
      data: { edgeId: edge.id },
      style: { stroke: 'var(--border-light)' },
      labelStyle: { fill: 'var(--text-secondary)', fontSize: 11 },
      labelBgStyle: { fill: 'var(--bg-card)', fillOpacity: 0.9 },
    }));

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [locations, edgesData, environment?.current_location_id]);

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
    // Only handle double-clicks on the pane background (not nodes/edges/controls)
    if (!event.target.classList.contains('react-flow__pane')) return;
    if (!reactFlowInstance) return;
    const position = reactFlowInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });
    const name = prompt('Location name:');
    if (!name) return;
    await api.createLocation(campaignId, { name, position_x: position.x, position_y: position.y });
    load();
  }, [campaignId, reactFlowInstance, load]);

  const onNodeClick = useCallback((event, node) => {
    const loc = locations.find(l => l.id === Number(node.id));
    if (loc) setSelected({ type: 'node', id: loc.id, data: loc });
  }, [locations]);

  const onEdgeClick = useCallback((event, edge) => {
    const edgeData = edgesData.find(e => `edge-${e.id}` === edge.id);
    if (edgeData) setSelected({ type: 'edge', id: edgeData.id, data: edgeData });
  }, [edgesData]);

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

      {selected && (
        <div className="location-detail-panel">
          {selected.type === 'node' ? (
            <LocationDetailPanel
              key={selected.id}
              campaignId={campaignId}
              location={selected.data}
              locations={locations}
              campaign={campaign}
              environment={environment}
              onSave={() => { load(); }}
              onDelete={() => handleDeleteLocation(selected.id)}
              onSetParty={() => handleSetPartyPosition(selected.id)}
              onClose={() => setSelected(null)}
            />
          ) : (
            <EdgeDetailPanel
              key={selected.id}
              campaignId={campaignId}
              edge={selected.data}
              locations={locations}
              onSave={() => { load(); }}
              onDelete={() => handleDeleteEdge(selected.id)}
              onClose={() => setSelected(null)}
            />
          )}
        </div>
      )}

      {!selected && (
        <div className="location-detail-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>Double-click the canvas to create a location.</p>
            <p style={{ fontSize: 13 }}>Drag between nodes to create paths.</p>
            <p style={{ fontSize: 13 }}>Click a node or edge to edit.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function LocationDetailPanel({ campaignId, location, locations, campaign, environment, onSave, onDelete, onSetParty, onClose }) {
  const [name, setName] = useState(location.name);
  const [description, setDescription] = useState(location.description || '');
  const [parentId, setParentId] = useState(location.parent_id || '');
  const [encounterMod, setEncounterMod] = useState(location.encounter_modifier);
  const [weatherOverride, setWeatherOverride] = useState(location.weather_override);
  const [propsStr, setPropsStr] = useState(
    Object.entries(location.properties || {}).map(([k, v]) => `${k}: ${v}`).join('\n')
  );
  const [saving, setSaving] = useState(false);

  const weatherOptions = campaign?.weather_options || [];
  const isPartyHere = environment?.current_location_id === location.id;

  const handleSave = async () => {
    setSaving(true);
    const properties = {};
    propsStr.split('\n').forEach(line => {
      const [k, ...rest] = line.split(':');
      if (k?.trim() && rest.length) properties[k.trim()] = rest.join(':').trim();
    });
    await api.updateLocation(campaignId, location.id, {
      name, description, parent_id: parentId || null,
      encounter_modifier: encounterMod,
      weather_override: weatherOverride,
      properties,
    });
    setSaving(false);
    onSave();
  };

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600 }}>Location</h3>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
      </div>
      <div className="form-group">
        <label>Name</label>
        <input type="text" value={name} onChange={e => setName(e.target.value)} />
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
        <label>Properties (one per line, key: value)</label>
        <textarea value={propsStr} onChange={e => setPropsStr(e.target.value)} rows={2} placeholder="terrain: forest&#10;danger: high" />
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

function EdgeDetailPanel({ campaignId, edge, locations, onSave, onDelete, onClose }) {
  const [label, setLabel] = useState(edge.label || '');
  const [travelHours, setTravelHours] = useState(edge.travel_hours);
  const [bidirectional, setBidirectional] = useState(!!edge.bidirectional);
  const [encounterMod, setEncounterMod] = useState(edge.encounter_modifier);
  const [saving, setSaving] = useState(false);

  const fromLoc = locations.find(l => l.id === edge.from_location_id);
  const toLoc = locations.find(l => l.id === edge.to_location_id);

  const handleSave = async () => {
    setSaving(true);
    await api.updateEdge(campaignId, edge.id, {
      label, travel_hours: travelHours,
      bidirectional, encounter_modifier: encounterMod,
    });
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
      <div className="inline-flex gap-sm">
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save'}
        </button>
        <button className="btn btn-danger btn-sm" onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
