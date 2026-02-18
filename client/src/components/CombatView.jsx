import React, { useState, useEffect } from 'react';
import * as api from '../api';

export function CombatSetupModal({ campaignId, characters, onStart, onClose }) {
  const [selected, setSelected] = useState(() => {
    const map = {};
    characters.forEach(c => { map[c.id] = c.type === 'PC'; });
    return map;
  });
  const [initiatives, setInitiatives] = useState(() => {
    const map = {};
    characters.forEach(c => { map[c.id] = ''; });
    return map;
  });
  const [advanceTime, setAdvanceTime] = useState(true);
  const [secondsPerRound, setSecondsPerRound] = useState(6);
  const [starting, setStarting] = useState(false);

  const toggleChar = (id) => setSelected({ ...selected, [id]: !selected[id] });

  const handleStart = async () => {
    const combatants = characters
      .filter(c => selected[c.id])
      .map(c => ({
        character_id: c.id,
        initiative: Number(initiatives[c.id]) || 0,
      }));
    if (combatants.length === 0) return;
    setStarting(true);
    try {
      const state = await api.startCombat(campaignId, {
        combatants,
        advance_time: advanceTime,
        time_per_round_seconds: secondsPerRound,
      });
      onStart(state);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Start Combat</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
              Select Combatants & Initiative
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 300, overflowY: 'auto' }}>
              {characters.map(c => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: selected[c.id] ? 'var(--bg-hover)' : 'transparent', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <input type="checkbox" checked={!!selected[c.id]} onChange={() => toggleChar(c.id)} />
                  <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{c.name}</span>
                  <span className={`tag ${c.type === 'PC' ? 'tag-buff' : ''}`} style={{ fontSize: 9 }}>{c.type}</span>
                  <input
                    type="number"
                    placeholder="Init"
                    value={initiatives[c.id]}
                    onChange={e => setInitiatives({ ...initiatives, [c.id]: e.target.value })}
                    style={{ width: 60, textAlign: 'center' }}
                    disabled={!selected[c.id]}
                  />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', cursor: 'pointer' }}>
              <input type="checkbox" checked={advanceTime} onChange={e => setAdvanceTime(e.target.checked)} />
              Advance game time
            </label>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Seconds/round</label>
              <input type="number" min="1" value={secondsPerRound} onChange={e => setSecondsPerRound(Number(e.target.value))} style={{ width: 70 }} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleStart} disabled={starting}>
            {starting ? 'Starting...' : 'Start Combat'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CombatTracker({ campaignId, campaign, combatState, onUpdate, onEnd }) {
  const [loading, setLoading] = useState(false);
  const [effectPickerFor, setEffectPickerFor] = useState(null);
  const [editingAttr, setEditingAttr] = useState(null);
  const [editAttrValue, setEditAttrValue] = useState('');

  const attrs = campaign?.attribute_definitions?.filter(a => a.type !== 'tag') || [];
  const currentCombatant = combatState.combatants[combatState.turn_index];

  const handleNextTurn = async () => {
    setLoading(true);
    try {
      await api.nextTurn(campaignId);
      onUpdate();
    } finally { setLoading(false); }
  };

  const handlePrevTurn = async () => {
    // Client-side only: adjust turn_index backwards
    const newIndex = combatState.turn_index > 0 ? combatState.turn_index - 1 : combatState.combatants.length - 1;
    const newCombatants = combatState.combatants.map(c => ({ character_id: c.character_id, initiative: c.initiative }));
    await api.updateCombat(campaignId, { combatants: newCombatants });
    // We can't easily go back a turn with server state, so just reload
    onUpdate();
  };

  const handleEnd = async () => {
    if (!confirm('End combat?')) return;
    await api.endCombat(campaignId);
    onEnd();
  };

  const handleRemoveEffect = async (charId, effectId) => {
    await api.removeEffect(campaignId, charId, effectId);
    onUpdate();
  };

  const handleApplyEffect = async (charId, effectDefId) => {
    await api.applyEffect(campaignId, charId, effectDefId);
    setEffectPickerFor(null);
    onUpdate();
  };

  const handleAttrSave = async (charId) => {
    if (!editingAttr) return;
    const char = combatState.combatants.find(c => c.character_id === charId);
    if (!char) return;
    const newAttrs = { ...char.base_attributes, [editingAttr.key]: Number(editAttrValue) };
    await api.updateCharacter(campaignId, charId, { base_attributes: newAttrs });
    setEditingAttr(null);
    onUpdate();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="combat-header">
        <div className="combat-round">COMBAT &mdash; Round {combatState.round}</div>
        <div className="inline-flex gap-sm">
          <button className="btn btn-sm btn-secondary" onClick={handleNextTurn} disabled={loading}>
            Next Turn &#x2192;
          </button>
          <button className="btn btn-sm btn-danger" onClick={handleEnd}>End Combat</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>Turn: <strong>{currentCombatant?.name || '?'}</strong></span>
        <span style={{ color: 'var(--text-muted)' }}>({combatState.turn_index + 1}/{combatState.combatants.length})</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {combatState.combatants.map((c, i) => {
          const isActive = i === combatState.turn_index;
          return (
            <div key={c.character_id} className={`combatant-row${isActive ? ' active-turn' : ''}`}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                {c.portrait_url ? (
                  <img src={c.portrait_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--border)' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'var(--text-muted)', border: '2px solid var(--border)' }}>
                    {(c.name || '?')[0]}
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{c.name}</div>
                  <div className="inline-flex gap-sm">
                    <span className="combatant-initiative">{c.initiative}</span>
                    <span className={`tag ${c.type === 'PC' ? 'tag-buff' : ''}`} style={{ fontSize: 9 }}>{c.type}</span>
                  </div>
                </div>
              </div>

              {/* Attributes */}
              <div className="combatant-attrs">
                {attrs.slice(0, 6).map(a => {
                  const val = c.effective_attributes?.[a.key];
                  const base = c.base_attributes?.[a.key];
                  const isEditing = editingAttr?.charId === c.character_id && editingAttr?.key === a.key;
                  return (
                    <div key={a.key} className="combatant-attr" onClick={() => {
                      if (!isEditing) {
                        setEditingAttr({ charId: c.character_id, key: a.key });
                        setEditAttrValue(String(base ?? 0));
                      }
                    }}>
                      <span className="combatant-attr-label">{a.label.substring(0, 3).toUpperCase()}</span>
                      {isEditing ? (
                        <input
                          type="number"
                          value={editAttrValue}
                          onChange={e => setEditAttrValue(e.target.value)}
                          onBlur={() => handleAttrSave(c.character_id)}
                          onKeyDown={e => { if (e.key === 'Enter') handleAttrSave(c.character_id); if (e.key === 'Escape') setEditingAttr(null); }}
                          autoFocus
                          style={{ width: 50, textAlign: 'center', padding: '2px 4px', fontSize: 13 }}
                        />
                      ) : (
                        <span className="combatant-attr-value">{val ?? '—'}</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Effects */}
              <div className="combatant-effects">
                {(c.applied_effects || []).map(eff => (
                  <span key={eff.id} className="tag" style={{ gap: 4, fontSize: 10 }}>
                    {eff.name}
                    {eff.remaining_rounds != null && <span style={{ color: 'var(--text-muted)' }}>({eff.remaining_rounds}r)</span>}
                    <button
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 10 }}
                      onClick={() => handleRemoveEffect(c.character_id, eff.id)}
                    >&#x2715;</button>
                  </span>
                ))}
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, padding: '1px 6px' }}
                  onClick={() => setEffectPickerFor(c.character_id)}>+ Effect</button>
              </div>
            </div>
          );
        })}
      </div>

      {effectPickerFor && (
        <EffectPicker
          campaignId={campaignId}
          onSelect={(effectDefId) => handleApplyEffect(effectPickerFor, effectDefId)}
          onClose={() => setEffectPickerFor(null)}
        />
      )}
    </div>
  );
}

function EffectPicker({ campaignId, onSelect, onClose }) {
  const [effects, setEffects] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.getStatusEffects(campaignId).then(setEffects).catch(() => {});
  }, [campaignId]);

  const filtered = effects.filter(e => e.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Apply Effect</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <input type="text" placeholder="Search effects..." value={search} onChange={e => setSearch(e.target.value)} style={{ marginBottom: 8, width: '100%' }} />
          <div className="picker-list" style={{ maxHeight: 300, overflowY: 'auto' }}>
            {filtered.map(e => (
              <div key={e.id} className="picker-item" onClick={() => onSelect(e.id)}>
                <div className="picker-item-info">
                  <div className="picker-item-name">{e.name}</div>
                  {e.description && <div className="picker-item-detail">{e.description}</div>}
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>No effects found</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
