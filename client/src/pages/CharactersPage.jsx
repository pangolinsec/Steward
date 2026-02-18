import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as api from '../api';
import ImportPreviewModal from '../components/ImportPreviewModal';
import RuleRefBadge from '../components/RuleRefBadge';
import { CombatSetupModal, CombatTracker } from '../components/CombatView';

export default function CharactersPage({ campaignId, campaign }) {
  const [characters, setCharacters] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editChar, setEditChar] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [combatState, setCombatState] = useState(null);
  const [showCombatSetup, setShowCombatSetup] = useState(false);
  const [encounterCombat, setEncounterCombat] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  const loadCombat = async () => {
    if (!campaignId) return;
    try {
      const state = await api.getCombatState(campaignId);
      setCombatState(state.active ? state : null);
    } catch { setCombatState(null); }
  };

  const load = async () => {
    if (!campaignId) return;
    const params = new URLSearchParams();
    if (typeFilter) params.set('type', typeFilter);
    if (search) params.set('search', search);
    if (showArchived) params.set('include_archived', '1');
    const data = await api.getCharacters(campaignId, params.toString());
    setCharacters(data);
  };

  useEffect(() => { load(); loadCombat(); }, [campaignId, typeFilter, search, showArchived]);

  // Encounter→Combat bridge: auto-open combat setup from navigation state
  useEffect(() => {
    if (location.state?.startCombat) {
      setEncounterCombat({
        npcIds: location.state.encounterNpcs || [],
        name: location.state.encounterName || '',
      });
      setShowCombatSetup(true);
      // Clear the location state so it doesn't re-trigger
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state]);

  const allAttrs = campaign?.attribute_definitions || [];
  const numericAttrs = allAttrs.filter(a => a.type !== 'tag');
  const pinnedOrAll = numericAttrs.some(a => a.pinned) ? numericAttrs.filter(a => a.pinned) : numericAttrs;
  const catOrder = { resource: 0, defense: 1, stat: 2 };
  const compactAttrs = [...pinnedOrAll].sort((a, b) => (catOrder[a.category] ?? 2) - (catOrder[b.category] ?? 2));

  const getResourceStyle = (cur, maxVal) => {
    if (maxVal == null || maxVal <= 0) return {};
    const pct = (cur / maxVal) * 100;
    if (pct >= 100) return { color: 'var(--green)', fontWeight: 700 };
    if (pct >= 66) return { color: 'var(--green)' };
    if (pct >= 34) return { color: 'var(--yellow)' };
    if (pct >= 10) return { color: 'var(--red)' };
    return { color: 'var(--red)', fontWeight: 700 };
  };

  const handleExport = async () => {
    const data = await api.getCharacters(campaignId);
    const blob = new Blob([JSON.stringify({ characters: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'steward-characters.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Characters</h2>
        <div className="inline-flex gap-sm">
          {combatState ? (
            <button className="btn btn-danger btn-sm" onClick={async () => { await api.endCombat(campaignId); setCombatState(null); }}>End Combat</button>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCombatSetup(true)}>Start Combat</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
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
        {typeFilter !== 'PC' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} />
            Show Archived
          </label>
        )}
      </div>
      {combatState ? (
        <CombatTracker
          campaignId={campaignId}
          campaign={campaign}
          combatState={combatState}
          onUpdate={loadCombat}
          onEnd={() => setCombatState(null)}
        />
      ) : characters.length === 0 ? (
        <div className="empty-state">
          <p>No characters yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="card-grid">
          {characters.map(c => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', opacity: c.archived ? 0.6 : 1 }} onClick={() => navigate(`/characters/${c.id}`)}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {c.portrait_url ? (
                  <img src={c.portrait_url} alt="" style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text-muted)', border: '2px solid var(--border)' }}>
                    {c.name[0]}
                  </div>
                )}
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center' }}>
                    {c.name}
                    <RuleRefBadge campaignId={campaignId} entityType="character" entityId={c.id} />
                  </div>
                  <span className={`tag ${c.type === 'PC' ? 'tag-buff' : ''}`}>{c.type}</span>
                  {c.archived && <span className="tag" style={{ fontSize: 10 }}>Archived</span>}
                </div>
              </div>
              {c.description && (
                <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {c.description}
                </p>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {compactAttrs.map(a => {
                  const val = c.base_attributes?.[a.key];
                  const cat = a.category || 'stat';
                  const maxVal = a.has_max ? (c.max_attributes?.[a.key] ?? val) : null;
                  const resStyle = cat === 'resource' && maxVal != null ? getResourceStyle(val ?? 0, maxVal) : {};
                  return (
                    <span key={a.key} className={`attr-chip attr-chip-${cat}`} style={resStyle}>
                      <span className="attr-chip-label">{a.label.substring(0, 3).toUpperCase()}</span>
                      {' '}{val ?? '—'}{a.has_max && maxVal != null ? `/${maxVal}` : ''}
                    </span>
                  );
                })}
              </div>
              {(c.applied_effects || []).length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {c.applied_effects.slice(0, 4).map(eff => {
                    const isBuff = eff.tags?.includes('buff');
                    const isDebuff = eff.tags?.includes('debuff') || eff.tags?.includes('poison');
                    const cls = isDebuff ? 'tag-debuff' : isBuff ? 'tag-buff' : '';
                    return (
                      <span key={eff.id} className={`tag ${cls}`} style={{ fontSize: 10 }}>
                        {eff.name}
                        {eff.remaining_rounds != null && <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>({eff.remaining_rounds}r)</span>}
                        {eff.remaining_hours != null && <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>({Math.ceil(eff.remaining_hours)}h)</span>}
                      </span>
                    );
                  })}
                  {c.applied_effects.length > 4 && (
                    <span className="tag" style={{ fontSize: 10 }}>+{c.applied_effects.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <CharacterForm
          campaignId={campaignId}
          attrs={allAttrs}
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
      {showCombatSetup && (
        <CombatSetupModal
          campaignId={campaignId}
          characters={characters}
          preselectedCharacterIds={encounterCombat?.npcIds}
          encounterName={encounterCombat?.name}
          onStart={(state) => { setCombatState(state); setShowCombatSetup(false); setEncounterCombat(null); }}
          onClose={() => { setShowCombatSetup(false); setEncounterCombat(null); }}
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
  const [dmNotes, setDmNotes] = useState(character?.dm_notes || '');
  const [archived, setArchived] = useState(character?.archived || false);
  const [baseAttrs, setBaseAttrs] = useState(() => {
    const base = character?.base_attributes || {};
    const result = {};
    attrs.forEach(a => { result[a.key] = base[a.key] ?? (a.type === 'tag' ? '' : 10); });
    return result;
  });
  const [maxAttrs, setMaxAttrs] = useState(() => {
    const max = character?.max_attributes || {};
    const result = {};
    attrs.filter(a => a.has_max).forEach(a => { result[a.key] = max[a.key] ?? baseAttrs[a.key] ?? 10; });
    return result;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { name, type, description, portrait_url: portraitUrl, base_attributes: baseAttrs, max_attributes: maxAttrs, dm_notes: dmNotes, archived };
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
                    {a.type === 'tag' ? (
                      <select
                        value={baseAttrs[a.key] ?? ''}
                        onChange={e => setBaseAttrs({ ...baseAttrs, [a.key]: e.target.value })}
                      >
                        <option value="">—</option>
                        {(a.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : a.has_max ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <input type="number" value={baseAttrs[a.key] ?? 10}
                          onChange={e => setBaseAttrs({ ...baseAttrs, [a.key]: Number(e.target.value) })}
                          style={{ flex: 1 }} title="Current" />
                        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>/</span>
                        <input type="number" value={maxAttrs[a.key] ?? 10}
                          onChange={e => setMaxAttrs({ ...maxAttrs, [a.key]: Number(e.target.value) })}
                          style={{ flex: 1 }} title="Max" />
                      </div>
                    ) : (
                      <input
                        type="number"
                        value={baseAttrs[a.key] ?? 10}
                        onChange={e => setBaseAttrs({ ...baseAttrs, [a.key]: Number(e.target.value) })}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="form-group" style={{ marginTop: 12 }}>
              <label>DM Notes</label>
              <textarea value={dmNotes} onChange={e => setDmNotes(e.target.value)} rows={3} placeholder="Private DM notes..." />
            </div>
            {type === 'NPC' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginTop: 8 }}>
                <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} />
                Archived
              </label>
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
