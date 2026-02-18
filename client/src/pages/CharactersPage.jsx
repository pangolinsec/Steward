import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import ImportPreviewModal from '../components/ImportPreviewModal';

export default function CharactersPage({ campaignId, campaign }) {
  const [characters, setCharacters] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editChar, setEditChar] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const navigate = useNavigate();

  const load = async () => {
    if (!campaignId) return;
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (search) params.set('search', search);
    const data = await api.getCharacters(campaignId, params.toString());
    setCharacters(data);
  };

  useEffect(() => { load(); }, [campaignId, typeFilter, search]);

  const attrs = campaign?.attribute_definitions || [];

  return (
    <div className="page">
      <div className="page-header">
        <h2>Characters</h2>
        <div className="inline-flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>Import</button>
          <button className="btn btn-primary" onClick={() => { setEditChar(null); setShowForm(true); }}>+ New Character</button>
        </div>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search characters..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          <option value="PC">PCs</option>
          <option value="NPC">NPCs</option>
        </select>
      </div>
      {characters.length === 0 ? (
        <div className="empty-state">
          <p>No characters yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="card-grid">
          {characters.map(c => (
            <div key={c.id} className="card" style={{ cursor: 'pointer' }} onClick={() => navigate(`/characters/${c.id}`)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {c.portrait_url ? (
                  <img src={c.portrait_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text-muted)', border: '2px solid var(--border)' }}>
                    {c.name[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15 }}>{c.name}</div>
                  <span className={`tag ${c.type === 'PC' ? 'tag-buff' : ''}`}>{c.type}</span>
                </div>
              </div>
              {c.description && (
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {c.description}
                </p>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {attrs.slice(0, 4).map(a => (
                  <span key={a.key} style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {a.label.substring(0, 3).toUpperCase()} {c.base_attributes[a.key] ?? '—'}
                  </span>
                ))}
                {attrs.length > 4 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>...</span>}
              </div>
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <CharacterForm
          campaignId={campaignId}
          attrs={attrs}
          character={editChar}
          onClose={() => setShowForm(false)}
          onSave={() => { setShowForm(false); load(); }}
        />
      )}
      {showImport && (
        <ImportPreviewModal
          campaignId={campaignId}
          onClose={() => setShowImport(false)}
          onComplete={load}
          initialEntityTypes={['characters']}
          lockEntityTypes={true}
        />
      )}
    </div>
  );
}

function CharacterForm({ campaignId, attrs, character, onClose, onSave }) {
  const [name, setName] = useState(character?.name || '');
  const [type, setType] = useState(character?.type || 'PC');
  const [description, setDescription] = useState(character?.description || '');
  const [portraitUrl, setPortraitUrl] = useState(character?.portrait_url || '');
  const [baseAttrs, setBaseAttrs] = useState(() => {
    const base = character?.base_attributes || {};
    const result = {};
    attrs.forEach(a => { result[a.key] = base[a.key] ?? 10; });
    return result;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name, type, description, portrait_url: portraitUrl, base_attributes: baseAttrs };
    if (character) {
      await api.updateCharacter(campaignId, character.id, data);
    } else {
      await api.createCharacter(campaignId, data);
    }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{character ? 'Edit Character' : 'New Character'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Type</label>
                <select value={type} onChange={e => setType(e.target.value)}>
                  <option value="PC">PC</option>
                  <option value="NPC">NPC</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label>Portrait URL</label>
              <input type="text" value={portraitUrl} onChange={e => setPortraitUrl(e.target.value)} placeholder="https://..." />
            </div>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>Base Attributes</label>
            {attrs.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                No attributes defined for this campaign. <a href="/environment">Go to Settings</a> to add attribute definitions.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
                {attrs.map(a => (
                  <div key={a.key} className="form-group" style={{ marginBottom: 0 }}>
                    <label>{a.label}</label>
                    <input
                      type="number"
                      value={baseAttrs[a.key] ?? 10}
                      onChange={e => setBaseAttrs({ ...baseAttrs, [a.key]: Number(e.target.value) })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{character ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
