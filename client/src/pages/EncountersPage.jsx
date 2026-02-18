import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import ImportPreviewModal from '../components/ImportPreviewModal';

export default function EncountersPage({ campaignId, campaign }) {
  const [encounters, setEncounters] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editEnc, setEditEnc] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [combatPrompt, setCombatPrompt] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    if (!campaignId) return;
    const data = await api.getEncounters(campaignId, search ? `search=${encodeURIComponent(search)}` : '');
    setEncounters(data);
  };

  useEffect(() => { load(); }, [campaignId, search]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete encounter "${name}"?`)) return;
    await api.deleteEncounter(campaignId, id);
    load();
  };

  const handleStartEncounter = async (enc) => {
    const overrides = enc.environment_overrides || {};
    const patch = {};
    if (overrides.weather) patch.weather = overrides.weather;
    if (Object.keys(patch).length > 0) {
      await api.updateEnvironment(campaignId, patch);
    }
    try {
      const result = await api.startEncounter(campaignId, enc.id);
      if (result.characters && result.characters.length > 0) {
        setCombatPrompt({ encounterName: enc.name, npcIds: result.characters.map(c => c.id) });
      }
    } catch { /* fallback — just log */ }
  };

  const handleStartCombatFromEncounter = () => {
    if (!combatPrompt) return;
    navigate('/characters', { state: { startCombat: true, encounterNpcs: combatPrompt.npcIds, encounterName: combatPrompt.encounterName } });
    setCombatPrompt(null);
  };

  const handleExport = async () => {
    const data = await api.getEncounters(campaignId);
    const blob = new Blob([JSON.stringify({ encounters: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almanac-encounters.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Encounters Library</h2>
        <div className="inline-flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>Import</button>
          <button className="btn btn-primary" onClick={() => { setEditEnc(null); setShowForm(true); }}>+ New Encounter</button>
        </div>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search encounters..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {encounters.length === 0 ? (
        <div className="empty-state"><p>No encounters defined yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {encounters.map(enc => (
            <div key={enc.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === enc.id ? null : enc.id)}>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{enc.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{enc.description}</div>
                  <div className="inline-flex gap-sm mt-sm" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>{enc.npcs?.length || 0} NPCs</span>
                    <span>{enc.loot_table?.length || 0} loot entries</span>
                    {enc.conditions && (enc.conditions.location_ids?.length > 0 || enc.conditions.edge_ids?.length > 0 || enc.conditions.time_of_day?.length > 0 || enc.conditions.weather?.length > 0) && (
                      <span className="tag" style={{ fontSize: 10 }}>Has conditions</span>
                    )}
                  </div>
                </div>
                <div className="inline-flex gap-sm">
                  <button className="btn btn-primary btn-sm" onClick={() => handleStartEncounter(enc)}>Start</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditEnc(enc); setShowForm(true); }}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(enc.id, enc.name)}>Delete</button>
                </div>
              </div>
              {expandedId === enc.id && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                  {enc.notes && <div style={{ marginBottom: 8 }}><strong>Notes:</strong> {enc.notes}</div>}
                  {enc.environment_overrides && Object.keys(enc.environment_overrides).length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>Environment:</strong>{' '}
                      {Object.entries(enc.environment_overrides).map(([k, v]) => `${k}: ${v}`).join(', ')}
                    </div>
                  )}
                  {enc.conditions && (enc.conditions.location_ids?.length > 0 || enc.conditions.edge_ids?.length > 0 || enc.conditions.time_of_day?.length > 0 || enc.conditions.weather?.length > 0) && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>Conditions:</strong>{' '}
                      {enc.conditions.location_ids?.length > 0 && <span>Locations: {enc.conditions.location_ids.length} selected. </span>}
                      {enc.conditions.edge_ids?.length > 0 && <span>Paths: {enc.conditions.edge_ids.length} selected. </span>}
                      {enc.conditions.time_of_day?.length > 0 && <span>Time: {enc.conditions.time_of_day.join(', ')}. </span>}
                      {enc.conditions.weather?.length > 0 && <span>Weather: {enc.conditions.weather.join(', ')}. </span>}
                      {enc.conditions.weight && enc.conditions.weight !== 1 && <span>Weight: {enc.conditions.weight}. </span>}
                    </div>
                  )}
                  {enc.loot_table?.length > 0 && (
                    <div>
                      <strong>Loot:</strong>
                      <ul style={{ marginLeft: 16, marginTop: 4 }}>
                        {enc.loot_table.map((l, i) => (
                          <li key={i}>{l.item_name || `Item #${l.item_id}`} x{l.quantity} ({Math.round((l.drop_chance || 1) * 100)}%)</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <EncounterForm
          campaignId={campaignId}
          campaign={campaign}
          encounter={editEnc}
          onClose={() => { setShowForm(false); setEditEnc(null); }}
          onSave={() => { setShowForm(false); setEditEnc(null); load(); }}
        />
      )}
      {showImport && (
        <ImportPreviewModal
          campaignId={campaignId}
          onClose={() => setShowImport(false)}
          onComplete={load}
          initialEntityTypes={['encounters']}
          lockEntityTypes={true}
        />
      )}
      {combatPrompt && (
        <div className="modal-overlay" onClick={() => setCombatPrompt(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Start Combat?</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setCombatPrompt(null)}>&#x2715;</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13 }}>
                Encounter "<strong>{combatPrompt.encounterName}</strong>" has {combatPrompt.npcIds.length} NPC(s).
                Start combat with these NPCs pre-selected?
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setCombatPrompt(null)}>Log Only</button>
              <button className="btn btn-primary" onClick={handleStartCombatFromEncounter}>Start Combat</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EncounterForm({ campaignId, campaign, encounter, onClose, onSave }) {
  const [name, setName] = useState(encounter?.name || '');
  const [description, setDescription] = useState(encounter?.description || '');
  const [notes, setNotes] = useState(encounter?.notes || '');

  // Structured data instead of JSON strings
  const [npcs, setNpcs] = useState(encounter?.npcs || []);
  const [loot, setLoot] = useState(encounter?.loot_table || []);
  const [envOverrides, setEnvOverrides] = useState(() => {
    const eo = encounter?.environment_overrides || {};
    return Object.entries(eo).map(([k, v]) => ({ key: k, value: v }));
  });

  // Conditions
  const [condLocationIds, setCondLocationIds] = useState(encounter?.conditions?.location_ids || []);
  const [condEdgeIds, setCondEdgeIds] = useState(encounter?.conditions?.edge_ids || []);
  const [condTimeOfDay, setCondTimeOfDay] = useState(encounter?.conditions?.time_of_day || []);
  const [condWeather, setCondWeather] = useState(encounter?.conditions?.weather || []);
  const [condWeight, setCondWeight] = useState(encounter?.conditions?.weight || 1.0);

  // Load locations, edges, characters, items for pickers
  const [locations, setLocations] = useState([]);
  const [edges, setEdges] = useState([]);
  const [characters, setCharacters] = useState([]);
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!campaignId) return;
    api.getLocations(campaignId).then(data => {
      setLocations(data.locations || []);
      setEdges(data.edges || []);
    }).catch(() => {});
    api.getCharacters(campaignId).then(setCharacters).catch(() => {});
    api.getItems(campaignId).then(setItems).catch(() => {});
  }, [campaignId]);

  const weatherOptions = campaign?.weather_options || [];
  const timeLabels = [...new Set((campaign?.time_of_day_thresholds || []).map(t => t.label))];

  const toggleArrayItem = (arr, setter, item) => {
    if (arr.includes(item)) setter(arr.filter(i => i !== item));
    else setter([...arr, item]);
  };

  const NPC_ROLES = ['leader', 'member', 'hostile', 'neutral'];

  // NPC helpers
  const addNpc = () => setNpcs([...npcs, { character_id: '', role: 'member' }]);
  const updateNpc = (i, field, val) => {
    const updated = [...npcs];
    updated[i] = { ...updated[i], [field]: val };
    setNpcs(updated);
  };
  const removeNpc = (i) => setNpcs(npcs.filter((_, idx) => idx !== i));

  // Loot helpers
  const addLoot = () => setLoot([...loot, { item_name: '', quantity: 1, drop_chance: 1 }]);
  const updateLoot = (i, field, val) => {
    const updated = [...loot];
    updated[i] = { ...updated[i], [field]: val };
    setLoot(updated);
  };
  const removeLoot = (i) => setLoot(loot.filter((_, idx) => idx !== i));

  // Env override helpers
  const addEnvOverride = () => setEnvOverrides([...envOverrides, { key: '', value: '' }]);
  const updateEnvOverride = (i, field, val) => {
    const updated = [...envOverrides];
    updated[i] = { ...updated[i], [field]: val };
    setEnvOverrides(updated);
  };
  const removeEnvOverride = (i) => setEnvOverrides(envOverrides.filter((_, idx) => idx !== i));

  // Custom mode state for loot item escape hatch
  const [customLootItems, setCustomLootItems] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanNpcs = npcs.filter(n => n.character_id).map(n => ({
      character_id: Number(n.character_id),
      role: n.role || 'member',
    }));
    const environment_overrides = {};
    for (const eo of envOverrides) {
      if (eo.key.trim()) environment_overrides[eo.key.trim()] = eo.value;
    }
    const conditions = {
      location_ids: condLocationIds,
      edge_ids: condEdgeIds,
      time_of_day: condTimeOfDay,
      weather: condWeather,
      weight: condWeight,
    };
    const data = { name, description, notes, npcs: cleanNpcs, environment_overrides, loot_table: loot, conditions };
    if (encounter) {
      await api.updateEncounter(campaignId, encounter.id, data);
    } else {
      await api.createEncounter(campaignId, data);
    }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{encounter ? 'Edit Encounter' : 'New Encounter'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} />
            </div>

            {/* NPCs Builder */}
            <div className="form-group">
              <label>NPCs</label>
              <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {npcs.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>No NPCs added</div>
                )}
                {npcs.map((npc, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <select
                      value={npc.character_id}
                      onChange={e => updateNpc(i, 'character_id', e.target.value)}
                      style={{ flex: 2, fontSize: 12 }}
                    >
                      <option value="">Select character...</option>
                      {characters.map(c => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                    </select>
                    <select
                      value={npc.role || 'member'}
                      onChange={e => updateNpc(i, 'role', e.target.value)}
                      style={{ flex: 1, fontSize: 12 }}
                    >
                      {NPC_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={() => removeNpc(i)}>&#x2715;</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={addNpc}>+ Add NPC</button>
              </div>
            </div>

            {/* Loot Table Builder */}
            <div className="form-group">
              <label>Loot Table</label>
              <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {loot.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>No loot entries</div>
                )}
                {loot.map((entry, i) => {
                  const isCustom = customLootItems[i] || (entry.item_name && !items.some(it => it.name === entry.item_name));
                  return (
                    <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                      {isCustom ? (
                        <span style={{ display: 'inline-flex', flex: 2, gap: 2, alignItems: 'center' }}>
                          <input
                            type="text"
                            value={entry.item_name}
                            onChange={e => updateLoot(i, 'item_name', e.target.value)}
                            placeholder="Item name"
                            style={{ flex: 1, fontSize: 12 }}
                          />
                          <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', fontSize: 9 }}
                            onClick={() => setCustomLootItems({ ...customLootItems, [i]: false })}
                            title="Switch to dropdown">&laquo;</button>
                        </span>
                      ) : (
                        <select
                          value={entry.item_name}
                          onChange={e => {
                            if (e.target.value === '__custom__') {
                              setCustomLootItems({ ...customLootItems, [i]: true });
                            } else {
                              updateLoot(i, 'item_name', e.target.value);
                            }
                          }}
                          style={{ flex: 2, fontSize: 12 }}
                        >
                          <option value="">Select item...</option>
                          {items.map(it => <option key={it.id} value={it.name}>{it.name}</option>)}
                          <option value="__custom__">Custom...</option>
                        </select>
                      )}
                      <input type="number" min="1" value={entry.quantity}
                        onChange={e => updateLoot(i, 'quantity', Number(e.target.value))}
                        style={{ width: 55, fontSize: 12 }} title="Quantity" placeholder="Qty" />
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 11, color: 'var(--text-secondary)' }}>
                        <input type="number" min="0" max="100" step="1"
                          value={Math.round((entry.drop_chance ?? 1) * 100)}
                          onChange={e => updateLoot(i, 'drop_chance', Number(e.target.value) / 100)}
                          style={{ width: 50, fontSize: 12 }} />%
                      </span>
                      <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => removeLoot(i)}>&#x2715;</button>
                    </div>
                  );
                })}
                <button type="button" className="btn btn-secondary btn-sm" onClick={addLoot}>+ Add Loot</button>
              </div>
            </div>

            {/* Environment Overrides Builder */}
            <div className="form-group">
              <label>Environment Overrides</label>
              <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {envOverrides.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>No overrides</div>
                )}
                {envOverrides.map((eo, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                    <input type="text" value={eo.key} onChange={e => updateEnvOverride(i, 'key', e.target.value)}
                      placeholder="Key" style={{ width: 100, fontSize: 12 }} />
                    {eo.key === 'weather' ? (
                      <EncWeatherSelect
                        value={eo.value}
                        onChange={v => updateEnvOverride(i, 'value', v)}
                        options={weatherOptions}
                      />
                    ) : (
                      <input type="text" value={eo.value} onChange={e => updateEnvOverride(i, 'value', e.target.value)}
                        placeholder="Value" style={{ flex: 1, fontSize: 12 }} />
                    )}
                    <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}
                      onClick={() => removeEnvOverride(i)}>&#x2715;</button>
                  </div>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={addEnvOverride}>+ Add Override</button>
              </div>
            </div>

            {/* Conditions Section */}
            <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Random Encounter Conditions</h4>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                Leave empty for "any". Only matching encounters can trigger randomly.
              </p>

              {locations.length > 0 && (
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Locations</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {locations.map(loc => {
                      const isOn = condLocationIds.includes(loc.id);
                      return (
                        <button key={loc.id} type="button" className="btn btn-sm"
                          style={{
                            fontSize: 11, padding: '2px 8px',
                            background: isOn ? 'var(--accent)' : 'var(--bg-input)',
                            color: isOn ? '#fff' : 'var(--text-muted)',
                            border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                          onClick={() => toggleArrayItem(condLocationIds, setCondLocationIds, loc.id)}
                        >{loc.name}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {edges.length > 0 && (
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Paths</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {edges.map(edge => {
                      const fromName = locations.find(l => l.id === edge.from_location_id)?.name || '?';
                      const toName = locations.find(l => l.id === edge.to_location_id)?.name || '?';
                      const display = edge.label ? `${edge.label} (${fromName} \u2194 ${toName})` : `${fromName} \u2194 ${toName}`;
                      const isOn = condEdgeIds.includes(edge.id);
                      return (
                        <button key={edge.id} type="button" className="btn btn-sm"
                          style={{
                            fontSize: 11, padding: '2px 8px',
                            background: isOn ? 'var(--accent)' : 'var(--bg-input)',
                            color: isOn ? '#fff' : 'var(--text-muted)',
                            border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                          onClick={() => toggleArrayItem(condEdgeIds, setCondEdgeIds, edge.id)}
                        >{display}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {timeLabels.length > 0 && (
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Time of Day</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {timeLabels.map(t => {
                      const isOn = condTimeOfDay.includes(t);
                      return (
                        <button key={t} type="button" className="btn btn-sm"
                          style={{
                            fontSize: 11, padding: '2px 8px',
                            background: isOn ? 'var(--accent)' : 'var(--bg-input)',
                            color: isOn ? '#fff' : 'var(--text-muted)',
                            border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                          onClick={() => toggleArrayItem(condTimeOfDay, setCondTimeOfDay, t)}
                        >{t}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              {weatherOptions.length > 0 && (
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Weather</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {weatherOptions.map(w => {
                      const isOn = condWeather.includes(w);
                      return (
                        <button key={w} type="button" className="btn btn-sm"
                          style={{
                            fontSize: 11, padding: '2px 8px',
                            background: isOn ? 'var(--accent)' : 'var(--bg-input)',
                            color: isOn ? '#fff' : 'var(--text-muted)',
                            border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                          }}
                          onClick={() => toggleArrayItem(condWeather, setCondWeather, w)}
                        >{w}</button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="form-group">
                <label style={{ fontSize: 12 }}>Weight (relative probability)</label>
                <input type="number" step="0.1" min="0.1" value={condWeight}
                  onChange={e => setCondWeight(Number(e.target.value))}
                  style={{ width: 80 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 4 }}>Higher = more likely vs other eligible encounters</span>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{encounter ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Weather select with escape hatch for env overrides
function EncWeatherSelect({ value, onChange, options }) {
  const [customMode, setCustomMode] = useState(false);
  const isCustom = value && !options.includes(value);

  if (customMode || isCustom) {
    return (
      <span style={{ display: 'inline-flex', flex: 1, gap: 2, alignItems: 'center' }}>
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder="Custom weather" style={{ flex: 1, fontSize: 12 }} />
        <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', fontSize: 9 }}
          onClick={() => setCustomMode(false)}>&laquo;</button>
      </span>
    );
  }

  return (
    <select value={value} onChange={e => {
      if (e.target.value === '__custom__') setCustomMode(true);
      else onChange(e.target.value);
    }} style={{ flex: 1, fontSize: 12 }}>
      <option value="">Select weather...</option>
      {options.map(w => <option key={w} value={w}>{w}</option>)}
      <option value="__custom__">Custom...</option>
    </select>
  );
}
