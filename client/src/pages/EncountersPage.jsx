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

function EncounterForm({ campaignId, encounter, onClose, onSave }) {
  const [name, setName] = useState(encounter?.name || '');
  const [description, setDescription] = useState(encounter?.description || '');
  const [notes, setNotes] = useState(encounter?.notes || '');
  const [npcsStr, setNpcsStr] = useState(JSON.stringify(encounter?.npcs || [], null, 2));
  const [envStr, setEnvStr] = useState(JSON.stringify(encounter?.environment_overrides || {}, null, 2));
  const [lootStr, setLootStr] = useState(JSON.stringify(encounter?.loot_table || [], null, 2));

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
    const data = { name, description, notes, npcs, environment_overrides, loot_table };
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
