import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function SessionLogPage({ campaignId }) {
  const [logData, setLogData] = useState({ entries: [], total: 0 });
  const [offset, setOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [newType, setNewType] = useState('manual');
  const limit = 50;

  const load = async () => {
    if (!campaignId) return;
    const params = new URLSearchParams();
    params.set('limit', limit);
    params.set('offset', offset);
    if (typeFilter) params.set('entry_type', typeFilter);
    const data = await api.getSessionLog(campaignId, params.toString());
    setLogData(data);
  };

  useEffect(() => { load(); }, [campaignId, offset, typeFilter]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    await api.addLogEntry(campaignId, { entry_type: newType, message: newMessage.trim() });
    setNewMessage('');
    load();
  };

  const handleClear = async () => {
    if (!confirm('Clear entire session log? This cannot be undone.')) return;
    await api.clearSessionLog(campaignId);
    setOffset(0);
    load();
  };

  const handleExport = () => {
    const text = logData.entries.map(e => `[${e.timestamp}] [${e.entry_type}] ${e.message}`).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session-log-${campaignId}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const entryTypes = ['general', 'manual', 'effect_applied', 'effect_removed', 'item_assigned', 'item_removed', 'time_advance', 'environment', 'weather_change', 'encounter_roll', 'travel'];

  const typeColors = {
    weather_change: 'var(--accent)',
    encounter_roll: 'var(--yellow)',
    travel: 'var(--green)',
    time_advance: 'var(--text-secondary)',
    environment: 'var(--text-secondary)',
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Session Log</h2>
        <div className="inline-flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
          <button className="btn btn-danger btn-sm" onClick={handleClear}>Clear Log</button>
        </div>
      </div>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <select value={newType} onChange={e => setNewType(e.target.value)} style={{ width: 140 }}>
          {entryTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <input type="text" placeholder="Add a log entry..." value={newMessage} onChange={e => setNewMessage(e.target.value)} style={{ flex: 1 }} />
        <button type="submit" className="btn btn-primary">Add</button>
      </form>

      <div className="search-bar">
        <select value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setOffset(0); }}>
          <option value="">All Types</option>
          {entryTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, alignSelf: 'center' }}>{logData.total} entries</span>
      </div>

      {logData.entries.length === 0 ? (
        <div className="empty-state"><p>No log entries yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {logData.entries.map(entry => (
            <div key={entry.id} style={{ display: 'flex', gap: 12, padding: '8px 12px', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {new Date(entry.timestamp + 'Z').toLocaleString()}
              </span>
              <span className="tag" style={{ fontSize: 10, borderColor: typeColors[entry.entry_type] || undefined, color: typeColors[entry.entry_type] || undefined }}>{entry.entry_type}</span>
              <span style={{ flex: 1 }}>{entry.message}</span>
            </div>
          ))}
        </div>
      )}

      {logData.total > limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
          <button className="btn btn-secondary btn-sm" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - limit))}>Previous</button>
          <span style={{ color: 'var(--text-muted)', fontSize: 12, alignSelf: 'center' }}>
            {offset + 1}–{Math.min(offset + limit, logData.total)} of {logData.total}
          </span>
          <button className="btn btn-secondary btn-sm" disabled={offset + limit >= logData.total} onClick={() => setOffset(offset + limit)}>Next</button>
        </div>
      )}
    </div>
  );
}
