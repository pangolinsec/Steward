import React, { useState, useEffect } from 'react';
import * as api from '../api';
import ImportPreviewModal from '../components/ImportPreviewModal';

export default function EncountersPage({ campaignId, campaign }) {
  const [encounters, setEncounters] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editEnc, setEditEnc] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showImport, setShowImport] = useState(false);

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
    alert(`Encounter "${enc.name}" started. Environment overrides applied.`);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Encounters Library</h2>
        <div className="inline-flex gap-sm">
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
                    {enc.conditions && (enc.conditions.location_ids?.length > 0 || enc.conditions.time_of_day?.length > 0 || enc.conditions.weather?.length > 0) && (
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
                  {enc.conditions && (enc.conditions.location_ids?.length > 0 || enc.conditions.time_of_day?.length > 0 || enc.conditions.weather?.length > 0) && (
                    <div style={{ marginBottom: 8 }}>
                      <strong>Conditions:</strong>{' '}
                      {enc.conditions.location_ids?.length > 0 && <span>Locations: {enc.conditions.location_ids.length} selected. </span>}
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
    </div>
  );
}

function EncounterForm({ campaignId, campaign, encounter, onClose, onSave }) {
  const [name, setName] = useState(encounter?.name || '');
  const [description, setDescription] = useState(encounter?.description || '');
  const [notes, setNotes] = useState(encounter?.notes || '');
  const [npcsStr, setNpcsStr] = useState(JSON.stringify(encounter?.npcs || [], null, 2));
  const [envStr, setEnvStr] = useState(JSON.stringify(encounter?.environment_overrides || {}, null, 2));
  const [lootStr, setLootStr] = useState(JSON.stringify(encounter?.loot_table || [], null, 2));

  // Conditions
  const [condLocationIds, setCondLocationIds] = useState(encounter?.conditions?.location_ids || []);
  const [condTimeOfDay, setCondTimeOfDay] = useState(encounter?.conditions?.time_of_day || []);
  const [condWeather, setCondWeather] = useState(encounter?.conditions?.weather || []);
  const [condWeight, setCondWeight] = useState(encounter?.conditions?.weight || 1.0);

  // Load locations for condition picker
  const [locations, setLocations] = useState([]);
  useEffect(() => {
    if (campaignId) {
      api.getLocations(campaignId).then(data => setLocations(data.locations || [])).catch(() => {});
    }
  }, [campaignId]);

  const weatherOptions = campaign?.weather_options || [];
  const timeLabels = [...new Set((campaign?.time_of_day_thresholds || []).map(t => t.label))];

  const toggleArrayItem = (arr, setter, item) => {
    if (arr.includes(item)) setter(arr.filter(i => i !== item));
    else setter([...arr, item]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    let npcs, environment_overrides, loot_table;
    try {
      npcs = JSON.parse(npcsStr);
      environment_overrides = JSON.parse(envStr);
      loot_table = JSON.parse(lootStr);
    } catch {
      alert('Invalid JSON in one of the fields');
      return;
    }
    const conditions = {
      location_ids: condLocationIds,
      time_of_day: condTimeOfDay,
      weather: condWeather,
      weight: condWeight,
    };
    const data = { name, description, notes, npcs, environment_overrides, loot_table, conditions };
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
            <div className="form-group">
              <label>NPCs (JSON array)</label>
              <textarea value={npcsStr} onChange={e => setNpcsStr(e.target.value)} rows={3} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            </div>
            <div className="form-group">
              <label>Environment Overrides (JSON object)</label>
              <textarea value={envStr} onChange={e => setEnvStr(e.target.value)} rows={3} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            </div>
            <div className="form-group">
              <label>Loot Table (JSON array)</label>
              <textarea value={lootStr} onChange={e => setLootStr(e.target.value)} rows={3} style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
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
                  <div className="inline-flex gap-sm flex-wrap">
                    {locations.map(loc => (
                      <label key={loc.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={condLocationIds.includes(loc.id)}
                          onChange={() => toggleArrayItem(condLocationIds, setCondLocationIds, loc.id)} />
                        {loc.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {timeLabels.length > 0 && (
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Time of Day</label>
                  <div className="inline-flex gap-sm flex-wrap">
                    {timeLabels.map(t => (
                      <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={condTimeOfDay.includes(t)}
                          onChange={() => toggleArrayItem(condTimeOfDay, setCondTimeOfDay, t)} />
                        {t}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {weatherOptions.length > 0 && (
                <div className="form-group">
                  <label style={{ fontSize: 12 }}>Weather</label>
                  <div className="inline-flex gap-sm flex-wrap">
                    {weatherOptions.map(w => (
                      <label key={w} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                        <input type="checkbox" checked={condWeather.includes(w)}
                          onChange={() => toggleArrayItem(condWeather, setCondWeather, w)} />
                        {w}
                      </label>
                    ))}
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
