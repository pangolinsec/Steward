import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { ModifierSummary } from '../components/ModifierDisplay';
import ImportPreviewModal from '../components/ImportPreviewModal';

export default function StatusEffectsPage({ campaignId, campaign }) {
  const [effects, setEffects] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editEffect, setEditEffect] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    if (!campaignId) return;
    const data = await api.getStatusEffects(campaignId, search ? `search=${encodeURIComponent(search)}` : '');
    setEffects(data);
  };

  useEffect(() => { load(); }, [campaignId, search]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? Applied instances will also be removed.`)) return;
    await api.deleteStatusEffect(campaignId, id);
    load();
  };

  const attrs = campaign?.attribute_definitions || [];

  const handleExport = async () => {
    const data = await api.getStatusEffects(campaignId);
    const blob = new Blob([JSON.stringify({ status_effects: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almanac-status-effects.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Status Effects Library</h2>
        <div className="inline-flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>Import</button>
          <button className="btn btn-primary" onClick={() => { setEditEffect(null); setShowForm(true); }}>+ New Effect</button>
        </div>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search effects..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {effects.length === 0 ? (
        <div className="empty-state"><p>No status effects defined yet.</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Tags</th>
              <th>Modifiers</th>
              <th>Duration</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {effects.map(e => (
              <tr key={e.id}>
                <td>
                  <div style={{ fontWeight: 500 }}>{e.name}</div>
                  {e.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{e.description}</div>}
                </td>
                <td>
                  <div className="inline-flex gap-sm flex-wrap">
                    {e.tags?.map(t => <span key={t} className="tag">{t}</span>)}
                  </div>
                </td>
                <td><ModifierSummary modifiers={e.modifiers} /></td>
                <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {e.duration_type === 'indefinite' ? 'Indefinite' :
                    e.duration_type === 'rounds' ? `${e.duration_value} rounds` :
                    `${e.duration_value}h`}
                </td>
                <td>
                  <div className="inline-flex gap-sm">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditEffect(e); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(e.id, e.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showForm && (
        <StatusEffectForm
          campaignId={campaignId}
          effect={editEffect}
          attrs={attrs}
          onClose={() => { setShowForm(false); setEditEffect(null); }}
          onSave={() => { setShowForm(false); setEditEffect(null); load(); }}
        />
      )}
      {showImport && (
        <ImportPreviewModal
          campaignId={campaignId}
          onClose={() => setShowImport(false)}
          onComplete={load}
          initialEntityTypes={['status_effects']}
          lockEntityTypes={true}
        />
      )}
    </div>
  );
}

function StatusEffectForm({ campaignId, effect, attrs, onClose, onSave }) {
  const [name, setName] = useState(effect?.name || '');
  const [description, setDescription] = useState(effect?.description || '');
  const [tagsStr, setTagsStr] = useState((effect?.tags || []).join(', '));
  const [durationType, setDurationType] = useState(effect?.duration_type || 'indefinite');
  const [durationValue, setDurationValue] = useState(effect?.duration_value || 0);
  const [modifiers, setModifiers] = useState(effect?.modifiers || []);

  const addModifier = () => setModifiers([...modifiers, { attribute: attrs[0]?.key || '', delta: 0 }]);
  const removeModifier = (i) => setModifiers(modifiers.filter((_, idx) => idx !== i));
  const updateModifier = (i, field, value) => {
    const updated = [...modifiers];
    updated[i] = { ...updated[i], [field]: field === 'delta' ? Number(value) : value };
    setModifiers(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = {
      name,
      description,
      tags: tagsStr.split(',').map(t => t.trim()).filter(Boolean),
      modifiers,
      duration_type: durationType,
      duration_value: Number(durationValue),
    };
    if (effect) {
      await api.updateStatusEffect(campaignId, effect.id, data);
    } else {
      await api.createStatusEffect(campaignId, data);
    }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{effect ? 'Edit Status Effect' : 'New Status Effect'}</h3>
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
              <label>Tags (comma-separated)</label>
              <input type="text" value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="buff, magical, divine" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Duration Type</label>
                <select value={durationType} onChange={e => setDurationType(e.target.value)}>
                  <option value="indefinite">Indefinite</option>
                  <option value="rounds">Rounds</option>
                  <option value="timed">Timed (hours)</option>
                </select>
              </div>
              {durationType !== 'indefinite' && (
                <div className="form-group">
                  <label>{durationType === 'rounds' ? 'Rounds' : 'Hours'}</label>
                  <input type="number" min="1" value={durationValue} onChange={e => setDurationValue(e.target.value)} />
                </div>
              )}
            </div>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Modifiers</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addModifier}>+ Add Modifier</button>
            </div>
            {modifiers.map((m, i) => (
              <div key={i} className="form-row" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Attribute</label>
                  <select value={m.attribute} onChange={e => updateModifier(i, 'attribute', e.target.value)}>
                    {attrs.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Delta</label>
                  <input type="number" value={m.delta} onChange={e => updateModifier(i, 'delta', e.target.value)} />
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeModifier(i)}>&#x2715;</button>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{effect ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
