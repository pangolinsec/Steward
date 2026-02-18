import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api';
import { ModifierSummary, formatModifier } from '../components/ModifierDisplay';
import { renderMarkdown } from '../utils/markdown';
import { resolveWikilink } from '../utils/wikilinkNavigate';
import WikilinkAutocomplete from '../components/WikilinkAutocomplete';

export default function CharacterDetailPage({ campaignId, campaign }) {
  const { charId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [showEffectPicker, setShowEffectPicker] = useState(false);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [editing, setEditing] = useState(false);
  const [dmNotesOpen, setDmNotesOpen] = useState(true);

  const load = useCallback(async () => {
    if (!campaignId || !charId) return;
    const computed = await api.getComputedStats(campaignId, charId);
    setData(computed);
  }, [campaignId, charId]);

  useEffect(() => { load(); }, [load]);

  if (!data) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  const { character, base, max_attributes, effects_breakdown, items_breakdown, effective } = data;
  const attrs = campaign?.attribute_definitions || [];

  const handleWikilinkClick = async (e) => {
    const link = e.target.closest('.wikilink');
    if (!link) return;
    e.preventDefault();
    const name = decodeURIComponent(link.getAttribute('data-wikilink'));
    const path = await resolveWikilink(campaignId, name);
    if (path) navigate(path);
  };

  const handleRemoveEffect = async (effectId) => {
    await api.removeEffect(campaignId, charId, effectId);
    load();
  };

  const handleRemoveItem = async (itemId) => {
    await api.removeCharacterItem(campaignId, charId, itemId);
    load();
  };

  const handleUpdateQty = async (itemId, qty) => {
    if (qty <= 0) {
      await api.removeCharacterItem(campaignId, charId, itemId);
    } else {
      await api.updateCharacterItemQty(campaignId, charId, itemId, qty);
    }
    load();
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${character.name}"? This cannot be undone.`)) return;
    await api.deleteCharacter(campaignId, charId);
    navigate('/characters');
  };

  // Compute per-attribute breakdown
  const getAttrBreakdown = (key) => {
    const sources = [];
    for (const e of effects_breakdown) {
      for (const m of e.modifiers) {
        if (m.attribute === key) sources.push({ name: e.name, delta: m.delta, type: 'effect' });
      }
    }
    for (const i of items_breakdown) {
      for (const m of i.modifiers) {
        if (m.attribute === key) sources.push({ name: i.name, delta: m.delta, type: 'item' });
      }
    }
    return sources;
  };

  return (
    <div className="page">
      <div style={{ marginBottom: 16 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/characters')}>&larr; Back to Characters</button>
      </div>

      {/* Header */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {character.portrait_url ? (
            <img src={character.portrait_url} alt="" style={{ width: 72, height: 72, borderRadius: 8, objectFit: 'cover', border: '2px solid var(--border)' }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 8, background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: 'var(--text-muted)', border: '2px solid var(--border)' }}>
              {character.name[0]}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700 }}>{character.name}</h2>
              <span className={`tag ${character.type === 'PC' ? 'tag-buff' : ''}`}>{character.type}</span>
              {character.archived && <span className="tag" style={{ fontSize: 10 }}>Archived</span>}
            </div>
            {character.description && <p style={{ marginTop: 6, color: 'var(--text-secondary)', fontSize: 13 }}>{character.description}</p>}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {character.type === 'NPC' && (
              <button className="btn btn-ghost btn-sm" onClick={async () => {
                await api.updateCharacter(campaignId, charId, { archived: !character.archived });
                load();
              }}>
                {character.archived ? 'Unarchive' : 'Archive'}
              </button>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>Edit</button>
            <button className="btn btn-danger btn-sm" onClick={handleDelete}>Delete</button>
          </div>
        </div>
      </div>

      {/* DM Notes */}
      {(character.dm_notes || dmNotesOpen) && (
        <div className="card dm-notes-card" style={{ marginBottom: 16 }}>
          <div className="dm-notes-toggle" onClick={() => setDmNotesOpen(!dmNotesOpen)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>DM Notes</h3>
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{dmNotesOpen ? '\u25BC' : '\u25B6'}</span>
          </div>
          {dmNotesOpen && character.dm_notes && (
            <div className="markdown-content" style={{ marginTop: 8, fontSize: 13 }}
              onClick={handleWikilinkClick}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(character.dm_notes) }} />
          )}
          {dmNotesOpen && !character.dm_notes && (
            <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 8 }}>No DM notes. Click Edit to add private notes.</p>
          )}
        </div>
      )}

      {/* Attributes Table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)' }}>Attributes</h3>
        {attrs.filter(a => a.type !== 'tag').length > 0 && (
          <table className="attr-table">
            <thead>
              <tr>
                <th>Attribute</th>
                <th>Base</th>
                <th>Modifiers</th>
                <th>Effective</th>
              </tr>
            </thead>
            <tbody>
              {attrs.filter(a => a.type !== 'tag').map(a => {
                const b = base[a.key] ?? 0;
                const e = effective[a.key] ?? 0;
                const maxVal = a.has_max ? (max_attributes?.[a.key] ?? b) : null;
                const diff = e - b;
                const breakdown = getAttrBreakdown(a.key);
                return (
                  <tr key={a.key}>
                    <td className="attr-name">{a.label}</td>
                    <td>{b}{maxVal != null ? ` / ${maxVal}` : ''}</td>
                    <td>
                      {breakdown.length === 0 ? (
                        <span className="mod-neutral">--</span>
                      ) : (
                        <span className="inline-flex gap-sm flex-wrap">
                          {breakdown.map((s, i) => (
                            <span key={i} className={s.delta > 0 ? 'mod-positive' : 'mod-negative'} title={`${s.name} (${s.type})`} style={{ cursor: 'help' }}>
                              {formatModifier(s.delta)}
                            </span>
                          ))}
                        </span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600, color: diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text-primary)' }}>
                      {e}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {attrs.filter(a => a.type === 'tag').length > 0 && (
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
            {attrs.filter(a => a.type === 'tag').map(a => (
              <div key={a.key}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.label}: </span>
                <span style={{ fontSize: 13 }}>{base[a.key] || '—'}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Applied Effects */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Applied Effects ({effects_breakdown.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowEffectPicker(true)}>+ Add Effect</button>
          </div>
          {effects_breakdown.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No active effects.</p>
          ) : (
            <div className="effect-list">
              {effects_breakdown.map(e => (
                <div key={e.id} className="effect-item">
                  <div className="effect-item-info">
                    <div className="effect-item-name">{e.name}</div>
                    <div className="effect-item-mods">
                      <ModifierSummary modifiers={e.modifiers} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {e.tags?.map(t => <span key={t} className="tag" style={{ fontSize: 10 }}>{t}</span>)}
                      {e.duration_type !== 'indefinite' && (
                        <span className="tag" style={{ fontSize: 10 }}>
                          {e.duration_type === 'rounds' ? `${e.remaining_rounds ?? '?'} rounds` : `${e.remaining_hours ?? '?'}h`}
                        </span>
                      )}
                    </div>
                  </div>
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveEffect(e.id)}>&#x2715;</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Inventory */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>Inventory ({items_breakdown.length})</h3>
            <button className="btn btn-primary btn-sm" onClick={() => setShowItemPicker(true)}>+ Add Item</button>
          </div>
          {items_breakdown.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No items.</p>
          ) : (
            <div className="effect-list">
              {items_breakdown.map(i => (
                <div key={i.id} className="effect-item">
                  <div className="effect-item-info">
                    <div className="effect-item-name">
                      {i.name}
                      {i.quantity > 1 && <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>x{i.quantity}</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{i.item_type}</div>
                    {i.modifiers.length > 0 && (
                      <div className="effect-item-mods">
                        <ModifierSummary modifiers={i.modifiers} />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    {i.stackable && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleUpdateQty(i.id, i.quantity - 1)}>-</button>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, minWidth: 20, textAlign: 'center' }}>{i.quantity}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleUpdateQty(i.id, i.quantity + 1)}>+</button>
                      </>
                    )}
                    <button className="btn btn-danger btn-sm" onClick={() => handleRemoveItem(i.id)}>&#x2715;</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showEffectPicker && (
        <EffectPicker
          campaignId={campaignId}
          charId={charId}
          onClose={() => setShowEffectPicker(false)}
          onApplied={() => { setShowEffectPicker(false); load(); }}
        />
      )}
      {showItemPicker && (
        <ItemPicker
          campaignId={campaignId}
          charId={charId}
          onClose={() => setShowItemPicker(false)}
          onAssigned={() => { setShowItemPicker(false); load(); }}
        />
      )}
      {editing && (
        <EditCharacterModal
          campaignId={campaignId}
          character={character}
          attrs={campaign?.attribute_definitions || []}
          onClose={() => setEditing(false)}
          onSaved={() => { setEditing(false); load(); }}
        />
      )}
    </div>
  );
}

function EffectPicker({ campaignId, charId, onClose, onApplied }) {
  const [effects, setEffects] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getStatusEffects(campaignId, search ? `search=${encodeURIComponent(search)}` : '').then(setEffects);
  }, [campaignId, search]);

  const handleApply = async (effectId) => {
    await api.applyEffect(campaignId, charId, effectId);
    onApplied();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Apply Status Effect</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <input type="text" placeholder="Search effects..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 12 }} autoFocus />
          <div className="picker-list">
            {effects.map(e => (
              <div key={e.id} className="picker-item" onClick={() => handleApply(e.id)}>
                <div className="picker-item-info">
                  <div className="picker-item-name">{e.name}</div>
                  <div className="picker-item-detail">
                    <ModifierSummary modifiers={e.modifiers} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm">Apply</button>
              </div>
            ))}
            {effects.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No effects found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemPicker({ campaignId, charId, onClose, onAssigned }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getItems(campaignId, search ? `search=${encodeURIComponent(search)}` : '').then(setItems);
  }, [campaignId, search]);

  const handleAssign = async (itemId) => {
    await api.assignItem(campaignId, charId, itemId);
    onAssigned();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add Item</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 12 }} autoFocus />
          <div className="picker-list">
            {items.map(i => (
              <div key={i.id} className="picker-item" onClick={() => handleAssign(i.id)}>
                <div className="picker-item-info">
                  <div className="picker-item-name">{i.name}</div>
                  <div className="picker-item-detail">
                    <span style={{ marginRight: 8 }}>{i.item_type}</span>
                    <ModifierSummary modifiers={i.modifiers} />
                  </div>
                </div>
                <button className="btn btn-primary btn-sm">Add</button>
              </div>
            ))}
            {items.length === 0 && <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>No items found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function EditCharacterModal({ campaignId, character, attrs, onClose, onSaved }) {
  const base = character.base_attributes || {};
  const max = character.max_attributes || {};
  const [name, setName] = useState(character.name);
  const [type, setType] = useState(character.type);
  const [description, setDescription] = useState(character.description || '');
  const [portraitUrl, setPortraitUrl] = useState(character.portrait_url || '');
  const [dmNotes, setDmNotes] = useState(character.dm_notes || '');
  const [archived, setArchived] = useState(character.archived || false);
  const dmNotesRef = useRef(null);
  const [baseAttrs, setBaseAttrs] = useState(() => {
    const result = {};
    attrs.forEach(a => { result[a.key] = base[a.key] ?? (a.type === 'tag' ? '' : 10); });
    return result;
  });
  const [maxAttrs, setMaxAttrs] = useState(() => {
    const result = {};
    attrs.filter(a => a.has_max).forEach(a => { result[a.key] = max[a.key] ?? base[a.key] ?? 10; });
    return result;
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.updateCharacter(campaignId, character.id, {
      name, type, description, portrait_url: portraitUrl, base_attributes: baseAttrs, max_attributes: maxAttrs, dm_notes: dmNotes, archived,
    });
    onSaved();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Edit Character</h3>
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
              <input type="text" value={portraitUrl} onChange={e => setPortraitUrl(e.target.value)} />
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
                      <input type="number" value={baseAttrs[a.key] ?? 10} onChange={e => setBaseAttrs({ ...baseAttrs, [a.key]: Number(e.target.value) })} />
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="form-group" style={{ marginTop: 12, position: 'relative' }}>
              <label>DM Notes</label>
              <textarea ref={dmNotesRef} value={dmNotes} onChange={e => setDmNotes(e.target.value)} rows={4} placeholder="Private notes, [[wikilinks]] supported..." />
              <WikilinkAutocomplete campaignId={campaignId} textareaRef={dmNotesRef} value={dmNotes} onChange={setDmNotes} />
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
            <button type="submit" className="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}
