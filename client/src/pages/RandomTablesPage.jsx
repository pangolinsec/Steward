import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function RandomTablesPage({ campaignId }) {
  const [tables, setTables] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [rollResults, setRollResults] = useState({});

  const load = async () => {
    if (!campaignId) return;
    const data = await api.getRandomTables(campaignId, search ? `search=${encodeURIComponent(search)}` : '');
    setTables(data);
  };

  useEffect(() => { load(); }, [campaignId, search]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete table "${name}"?`)) return;
    await api.deleteRandomTable(campaignId, id);
    load();
  };

  const handleRoll = async (tableId) => {
    const result = await api.rollRandomTable(campaignId, tableId);
    setRollResults(prev => ({ ...prev, [tableId]: result }));
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Random Tables</h2>
        <button className="btn btn-primary" onClick={() => { setEditTable(null); setShowForm(true); }}>+ New Table</button>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search tables..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      {tables.length === 0 ? (
        <div className="empty-state"><p>No random tables yet. Create one for loot drops, encounters, events, and more.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tables.map(t => {
            const rollResult = rollResults[t.id];
            const totalWeight = t.entries.reduce((sum, e) => sum + (e.weight || 1), 0);
            return (
              <div key={t.id} className="card random-table-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {t.name}
                      <span className="tag" style={{ fontSize: 10 }}>{t.table_type}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{t.entries.length} entries</span>
                    </div>
                    {t.description && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t.description}</div>}
                  </div>
                  <div className="inline-flex gap-sm">
                    <button className="btn btn-primary btn-sm" onClick={() => handleRoll(t.id)}>Roll</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditTable(t); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.id, t.name)}>Delete</button>
                  </div>
                </div>
                {/* Entries preview */}
                <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {t.entries.slice(0, 8).map((e, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                      <div className="table-weight-bar" style={{ width: `${((e.weight || 1) / totalWeight) * 100}%`, minWidth: 4, maxWidth: 60 }} />
                      <span style={{ color: 'var(--text-secondary)', flex: 1 }}>{e.text}</span>
                      {t.table_type === 'weighted' && (
                        <span style={{ color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-mono)' }}>
                          {Math.round(((e.weight || 1) / totalWeight) * 100)}%
                        </span>
                      )}
                    </div>
                  ))}
                  {t.entries.length > 8 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>...and {t.entries.length - 8} more</span>}
                </div>
                {/* Roll result */}
                {rollResult && (
                  <div className="table-roll-result table-roll-animation">
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Result: </span>
                    <span>{rollResult.result}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showForm && (
        <RandomTableForm
          campaignId={campaignId}
          table={editTable}
          onClose={() => { setShowForm(false); setEditTable(null); }}
          onSave={() => { setShowForm(false); setEditTable(null); load(); }}
        />
      )}
    </div>
  );
}

function RandomTableForm({ campaignId, table, onClose, onSave }) {
  const [name, setName] = useState(table?.name || '');
  const [description, setDescription] = useState(table?.description || '');
  const [tableType, setTableType] = useState(table?.table_type || 'weighted');
  const [entries, setEntries] = useState(table?.entries?.length > 0 ? table.entries : [{ text: '', weight: 1 }]);

  const addEntry = () => setEntries([...entries, { text: '', weight: 1 }]);
  const removeEntry = (i) => setEntries(entries.filter((_, idx) => idx !== i));
  const updateEntry = (i, field, val) => {
    const updated = [...entries];
    updated[i] = { ...updated[i], [field]: val };
    setEntries(updated);
  };
  const moveEntry = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= entries.length) return;
    const updated = [...entries];
    [updated[i], updated[j]] = [updated[j], updated[i]];
    setEntries(updated);
  };

  const totalWeight = entries.reduce((sum, e) => sum + (e.weight || 1), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEntries = entries.filter(en => en.text.trim()).map(en => ({
      text: en.text.trim(),
      weight: en.weight || 1,
    }));
    const data = { name, description, table_type: tableType, entries: cleanEntries };
    if (table) {
      await api.updateRandomTable(campaignId, table.id, data);
    } else {
      await api.createRandomTable(campaignId, data);
    }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{table ? 'Edit Table' : 'New Random Table'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Wild Magic Surge" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="What is this table for?" />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select value={tableType} onChange={e => setTableType(e.target.value)}>
                <option value="weighted">Weighted (entries have different probabilities)</option>
                <option value="sequential">Sequential (equal probability, d{'{N}'})</option>
              </select>
            </div>
            <div className="form-group">
              <label>Entries</label>
              <div style={{ padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div className="table-entries-builder">
                  {entries.map((entry, i) => (
                    <div key={i} className="table-entry-row">
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 20, textAlign: 'center' }}>{i + 1}</span>
                      <input type="text" value={entry.text} onChange={e => updateEntry(i, 'text', e.target.value)}
                        placeholder="Entry text..." style={{ flex: 1, fontSize: 12 }} />
                      {tableType === 'weighted' && (
                        <>
                          <input type="number" min="1" value={entry.weight || 1} onChange={e => updateEntry(i, 'weight', Number(e.target.value))}
                            style={{ width: 55, fontSize: 12 }} title="Weight" />
                          <span style={{ fontSize: 10, color: 'var(--text-muted)', width: 35, textAlign: 'right' }}>
                            {totalWeight > 0 ? Math.round(((entry.weight || 1) / totalWeight) * 100) : 0}%
                          </span>
                        </>
                      )}
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', fontSize: 10 }}
                        onClick={() => moveEntry(i, -1)} disabled={i === 0}>&uarr;</button>
                      <button type="button" className="btn btn-ghost btn-sm" style={{ padding: '2px 4px', fontSize: 10 }}
                        onClick={() => moveEntry(i, 1)} disabled={i === entries.length - 1}>&darr;</button>
                      <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}
                        onClick={() => removeEntry(i)}>&#x2715;</button>
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-secondary btn-sm" style={{ marginTop: 6 }} onClick={addEntry}>+ Add Entry</button>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{table ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
