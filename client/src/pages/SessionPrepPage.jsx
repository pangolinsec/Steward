import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api';
import WikilinkAutocomplete from '../components/WikilinkAutocomplete';

const STATUS_COLORS = {
  prep: 'var(--accent)',
  active: 'var(--green)',
  completed: 'var(--text-muted)',
};

const STATUS_BG = {
  prep: 'var(--accent-dim, rgba(99,102,241,0.15))',
  active: 'var(--green-dim, rgba(34,197,94,0.15))',
  completed: 'var(--bg-input)',
};

function LocationPickerDropdown({ locations, selectedIds, onChange, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest('.location-picker-dropdown')) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const toggle = (locId) => {
    if (selectedIds.includes(locId)) {
      onChange(selectedIds.filter(id => id !== locId));
    } else {
      onChange([...selectedIds, locId]);
    }
  };

  return (
    <div ref={ref} className="location-picker-dropdown" style={{
      position: 'absolute', top: '100%', right: 0, zIndex: 50,
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-sm)', boxShadow: '0 4px 12px var(--shadow)',
      maxHeight: 200, overflowY: 'auto', minWidth: 200, padding: 4,
    }}>
      {locations.length === 0 ? (
        <div style={{ padding: 8, fontSize: 12, color: 'var(--text-muted)' }}>No locations</div>
      ) : locations.map(loc => (
        <label key={loc.id} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px',
          fontSize: 12, cursor: 'pointer', borderRadius: 'var(--radius-sm)',
        }}>
          <input type="checkbox" checked={selectedIds.includes(loc.id)} onChange={() => toggle(loc.id)} />
          {loc.name}
        </label>
      ))}
    </div>
  );
}

export default function SessionPrepPage({ campaignId }) {
  const [preps, setPreps] = useState([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPrep, setSelectedPrep] = useState(null);
  const [carryForward, setCarryForward] = useState(true);
  const [locations, setLocations] = useState([]);
  const [openLocationPicker, setOpenLocationPicker] = useState(null);
  const saveTimer = useRef(null);
  const latestPrep = useRef(null);
  const strongStartRef = useRef(null);
  const notesRef = useRef(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    params.set('limit', '100');
    const data = await api.getSessionPreps(campaignId, params.toString());
    setPreps(data.preps);
    setTotal(data.total);
  }, [campaignId, statusFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!campaignId) return;
    api.getLocations(campaignId).then(data => {
      setLocations(data.locations || []);
    }).catch(() => {});
  }, [campaignId]);

  useEffect(() => {
    if (!selectedId || !campaignId) { setSelectedPrep(null); return; }
    api.getSessionPrep(campaignId, selectedId).then(p => {
      setSelectedPrep(p);
      latestPrep.current = p;
    }).catch(() => setSelectedPrep(null));
  }, [selectedId, campaignId]);

  // Cleanup save timer on unmount
  useEffect(() => () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
  }, []);

  const scheduleSave = (updated) => {
    latestPrep.current = updated;
    setSelectedPrep(updated);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const p = latestPrep.current;
      if (!p) return;
      await api.updateSessionPrep(campaignId, p.id, {
        title: p.title,
        strong_start: p.strong_start,
        scenes: p.scenes,
        secrets: p.secrets,
        notes: p.notes,
      });
      load();
    }, 500);
  };

  const updateField = (field, value) => {
    const updated = { ...selectedPrep, [field]: value };
    scheduleSave(updated);
  };

  const createPrep = async () => {
    const prep = await api.createSessionPrep(campaignId, {
      title: 'New Session',
      carry_forward: carryForward,
    });
    await load();
    setSelectedId(prep.id);
  };

  const activatePrep = async () => {
    if (!selectedPrep) return;
    await api.activateSessionPrep(campaignId, selectedPrep.id);
    const updated = await api.getSessionPrep(campaignId, selectedPrep.id);
    setSelectedPrep(updated);
    latestPrep.current = updated;
    load();
  };

  const completePrep = async () => {
    if (!selectedPrep) return;
    await api.completeSessionPrep(campaignId, selectedPrep.id);
    const updated = await api.getSessionPrep(campaignId, selectedPrep.id);
    setSelectedPrep(updated);
    latestPrep.current = updated;
    load();
  };

  const deletePrep = async () => {
    if (!selectedPrep || !confirm('Delete this session prep?')) return;
    await api.deleteSessionPrep(campaignId, selectedPrep.id);
    setSelectedId(null);
    setSelectedPrep(null);
    latestPrep.current = null;
    load();
  };

  // Scene helpers
  const addScene = () => {
    const scenes = [...(selectedPrep.scenes || []), { text: '', done: false, location_ids: [] }];
    updateField('scenes', scenes);
  };

  const updateScene = (idx, field, value) => {
    const scenes = selectedPrep.scenes.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    updateField('scenes', scenes);
  };

  const removeScene = (idx) => {
    updateField('scenes', selectedPrep.scenes.filter((_, i) => i !== idx));
  };

  // Secret helpers
  const addSecret = () => {
    const secrets = [...(selectedPrep.secrets || []), { text: '', revealed: false, location_ids: [] }];
    updateField('secrets', secrets);
  };

  const updateSecret = (idx, field, value) => {
    const secrets = selectedPrep.secrets.map((s, i) => i === idx ? { ...s, [field]: value } : s);
    updateField('secrets', secrets);
  };

  const removeSecret = (idx) => {
    updateField('secrets', selectedPrep.secrets.filter((_, i) => i !== idx));
  };

  // Drag helpers
  const dragIdx = useRef(null);
  const dragOverIdx = useRef(null);

  const handleDragStart = (idx) => { dragIdx.current = idx; };
  const handleDragOver = (e, idx) => { e.preventDefault(); dragOverIdx.current = idx; };
  const handleDrop = (field) => {
    if (dragIdx.current === null || dragOverIdx.current === null || dragIdx.current === dragOverIdx.current) {
      dragIdx.current = null; dragOverIdx.current = null; return;
    }
    const items = [...selectedPrep[field]];
    const [moved] = items.splice(dragIdx.current, 1);
    items.splice(dragOverIdx.current, 0, moved);
    dragIdx.current = null; dragOverIdx.current = null;
    updateField(field, items);
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const sceneProgress = (prep) => {
    const scenes = prep.scenes || [];
    if (scenes.length === 0) return null;
    const done = scenes.filter(s => s.done).length;
    return `${done}/${scenes.length}`;
  };

  const secretProgress = (prep) => {
    const secrets = prep.secrets || [];
    if (secrets.length === 0) return null;
    const revealed = secrets.filter(s => s.revealed).length;
    return `${revealed}/${secrets.length} revealed`;
  };

  const getLocationName = (locId) => {
    const loc = locations.find(l => l.id === locId);
    return loc ? loc.name : `#${locId}`;
  };

  return (
    <div className="page" style={{ padding: 0, display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Left pane: Prep list */}
      <div className="journal-list">
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ flex: 1 }}>
              <option value="">All</option>
              <option value="prep">Prep</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
            <button className="btn btn-primary btn-sm" onClick={createPrep}>+ New</button>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', marginBottom: 4 }}>
            <input type="checkbox" checked={carryForward} onChange={e => setCarryForward(e.target.checked)} />
            Carry forward secrets
          </label>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} session preps</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {preps.map(prep => (
            <div
              key={prep.id}
              className={`journal-note-card${selectedId === prep.id ? ' selected' : ''}`}
              onClick={() => setSelectedId(prep.id)}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {prep.title || 'Untitled'}
                </div>
                <span className="tag" style={{
                  fontSize: 9, padding: '1px 5px', flexShrink: 0,
                  color: STATUS_COLORS[prep.status],
                  background: STATUS_BG[prep.status],
                  borderColor: STATUS_COLORS[prep.status],
                }}>
                  {prep.status}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {sceneProgress(prep) && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Scenes: {sceneProgress(prep)}</span>
                )}
                {secretProgress(prep) && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Secrets: {secretProgress(prep)}</span>
                )}
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDate(prep.updated_at)}</span>
              </div>
            </div>
          ))}
          {preps.length === 0 && (
            <div className="empty-state" style={{ padding: 20 }}>
              <p>No session preps yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right pane: Structured editor */}
      <div className="journal-editor">
        {selectedPrep ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, gap: 8 }}>
              <span className="tag" style={{
                fontSize: 10, padding: '2px 8px',
                color: STATUS_COLORS[selectedPrep.status],
                background: STATUS_BG[selectedPrep.status],
                borderColor: STATUS_COLORS[selectedPrep.status],
              }}>
                {selectedPrep.status}
              </span>
              <div style={{ display: 'flex', gap: 6 }}>
                {selectedPrep.status === 'prep' && (
                  <button className="btn btn-sm btn-primary" onClick={activatePrep}>Activate</button>
                )}
                {selectedPrep.status === 'active' && (
                  <button className="btn btn-sm btn-secondary" onClick={completePrep}>Complete Session</button>
                )}
                <button className="btn btn-sm btn-danger" onClick={deletePrep}>Delete</button>
              </div>
            </div>

            {/* Title */}
            <input
              type="text"
              placeholder="Session title..."
              value={selectedPrep.title}
              onChange={e => updateField('title', e.target.value)}
              style={{ fontSize: 18, fontWeight: 600, marginBottom: 20, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '8px 0' }}
            />

            {/* Strong Start */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>
                Strong Start
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={strongStartRef}
                  placeholder="How does the session kick off? Use [[Name]] to link entities."
                  value={selectedPrep.strong_start}
                  onChange={e => updateField('strong_start', e.target.value)}
                  style={{ minHeight: 120, resize: 'vertical', fontSize: 13, width: '100%' }}
                />
                <WikilinkAutocomplete
                  campaignId={campaignId}
                  textareaRef={strongStartRef}
                  value={selectedPrep.strong_start}
                  onChange={v => updateField('strong_start', v)}
                />
              </div>
            </div>

            {/* Scenes */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>
                Potential Scenes
                {selectedPrep.scenes?.length > 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 8, fontSize: 11 }}>
                    ({selectedPrep.scenes.filter(s => s.done).length}/{selectedPrep.scenes.length})
                  </span>
                )}
              </label>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                Linked locations trigger a reminder when the party arrives, until this item is resolved.
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(selectedPrep.scenes || []).map((scene, idx) => (
                  <div key={idx}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDragEnd={() => handleDrop('scenes')}
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, cursor: 'grab', userSelect: 'none' }} title="Drag to reorder">&#x2630;</span>
                      <input
                        type="checkbox"
                        checked={scene.done}
                        onChange={e => updateScene(idx, 'done', e.target.checked)}
                      />
                      <input
                        type="text"
                        value={scene.text}
                        onChange={e => updateScene(idx, 'text', e.target.value)}
                        placeholder="Scene description..."
                        style={{
                          flex: 1, minWidth: 0, fontSize: 13,
                          textDecoration: scene.done ? 'line-through' : 'none',
                          opacity: scene.done ? 0.5 : 1,
                        }}
                      />
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '2px 6px', fontSize: 12,
                            color: (scene.location_ids || []).length > 0 ? 'var(--accent)' : 'var(--text-muted)',
                          }}
                          onClick={() => setOpenLocationPicker(openLocationPicker === `scene-${idx}` ? null : `scene-${idx}`)}
                          title="Link locations"
                        >&#x1F4CD;</button>
                        {openLocationPicker === `scene-${idx}` && (
                          <LocationPickerDropdown
                            locations={locations}
                            selectedIds={scene.location_ids || []}
                            onChange={ids => updateScene(idx, 'location_ids', ids)}
                            onClose={() => setOpenLocationPicker(null)}
                          />
                        )}
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 10, color: 'var(--text-muted)' }}
                        onClick={() => removeScene(idx)}>&#x2715;</button>
                    </div>
                    {(scene.location_ids || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 38, marginTop: 2 }}>
                        {scene.location_ids.map(locId => (
                          <span key={locId} className="tag" style={{ fontSize: 9, padding: '1px 6px', gap: 4 }}>
                            {getLocationName(locId)}
                            <span style={{ cursor: 'pointer', marginLeft: 2, opacity: 0.6 }}
                              onClick={() => updateScene(idx, 'location_ids', scene.location_ids.filter(id => id !== locId))}
                            >&#x2715;</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={addScene}>+ Add Scene</button>
            </div>

            {/* Secrets & Clues */}
            <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>
                Secrets &amp; Clues
                {selectedPrep.secrets?.length > 0 && (
                  <span style={{ fontWeight: 400, textTransform: 'none', marginLeft: 8, fontSize: 11 }}>
                    ({selectedPrep.secrets.filter(s => s.revealed).length}/{selectedPrep.secrets.length} revealed)
                  </span>
                )}
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(selectedPrep.secrets || []).map((secret, idx) => (
                  <div key={idx}>
                    <div
                      draggable
                      onDragStart={() => handleDragStart(idx)}
                      onDragOver={e => handleDragOver(e, idx)}
                      onDragEnd={() => handleDrop('secrets')}
                      style={{ display: 'flex', gap: 6, alignItems: 'center' }}
                    >
                      <span style={{ color: 'var(--text-muted)', fontSize: 11, cursor: 'grab', userSelect: 'none' }} title="Drag to reorder">&#x2630;</span>
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{
                          padding: '2px 6px', fontSize: 10, flexShrink: 0,
                          color: secret.revealed ? 'var(--green)' : 'var(--text-muted)',
                          border: `1px solid ${secret.revealed ? 'var(--green)' : 'var(--border)'}`,
                        }}
                        onClick={() => updateSecret(idx, 'revealed', !secret.revealed)}
                        title={secret.revealed ? 'Mark as unrevealed' : 'Mark as revealed'}
                      >
                        {secret.revealed ? 'Revealed' : 'Hidden'}
                      </button>
                      <input
                        type="text"
                        value={secret.text}
                        onChange={e => updateSecret(idx, 'text', e.target.value)}
                        placeholder="Secret or clue..."
                        style={{
                          flex: 1, minWidth: 0, fontSize: 13,
                          textDecoration: secret.revealed ? 'line-through' : 'none',
                          opacity: secret.revealed ? 0.5 : 1,
                        }}
                      />
                      <div style={{ position: 'relative' }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{
                            padding: '2px 6px', fontSize: 12,
                            color: (secret.location_ids || []).length > 0 ? 'var(--accent)' : 'var(--text-muted)',
                          }}
                          onClick={() => setOpenLocationPicker(openLocationPicker === `secret-${idx}` ? null : `secret-${idx}`)}
                          title="Link locations"
                        >&#x1F4CD;</button>
                        {openLocationPicker === `secret-${idx}` && (
                          <LocationPickerDropdown
                            locations={locations}
                            selectedIds={secret.location_ids || []}
                            onChange={ids => updateSecret(idx, 'location_ids', ids)}
                            onClose={() => setOpenLocationPicker(null)}
                          />
                        )}
                      </div>
                      <button className="btn btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: 10, color: 'var(--text-muted)' }}
                        onClick={() => removeSecret(idx)}>&#x2715;</button>
                    </div>
                    {(secret.location_ids || []).length > 0 && (
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginLeft: 38, marginTop: 2 }}>
                        {secret.location_ids.map(locId => (
                          <span key={locId} className="tag" style={{ fontSize: 9, padding: '1px 6px', gap: 4 }}>
                            {getLocationName(locId)}
                            <span style={{ cursor: 'pointer', marginLeft: 2, opacity: 0.6 }}
                              onClick={() => updateSecret(idx, 'location_ids', secret.location_ids.filter(id => id !== locId))}
                            >&#x2715;</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={addSecret}>+ Add Secret</button>
            </div>

            {/* Notes */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6, display: 'block' }}>
                Notes
              </label>
              <div style={{ position: 'relative' }}>
                <textarea
                  ref={notesRef}
                  placeholder="General notes, ideas, reminders... Use [[Name]] to link entities."
                  value={selectedPrep.notes}
                  onChange={e => updateField('notes', e.target.value)}
                  style={{ minHeight: 160, resize: 'vertical', fontSize: 13, width: '100%' }}
                />
                <WikilinkAutocomplete
                  campaignId={campaignId}
                  textareaRef={notesRef}
                  value={selectedPrep.notes}
                  onChange={v => updateField('notes', v)}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="empty-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p>Select a session prep or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
