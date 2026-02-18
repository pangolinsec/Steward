import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function RuleTestPanel({ campaignId, ruleId, ruleName, onClose }) {
  const [characters, setCharacters] = useState([]);
  const [selectedCharId, setSelectedCharId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getCharacters(campaignId).then(setCharacters).catch(() => {});
  }, [campaignId]);

  const handleTest = async () => {
    setLoading(true);
    try {
      const data = await api.testRule(campaignId, ruleId, selectedCharId || null);
      setResult(data);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Test Rule: {ruleName}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Test Character (optional)</label>
            <select value={selectedCharId} onChange={e => setSelectedCharId(e.target.value)}>
              <option value="">Auto-select</option>
              {characters.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.type})</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" onClick={handleTest} disabled={loading} style={{ marginBottom: 16 }}>
            {loading ? 'Testing...' : 'Run Test'}
          </button>

          {result && !result.error && (
            <div>
              <div style={{
                padding: 12, borderRadius: 'var(--radius-sm)', marginBottom: 12,
                background: result.overall_pass ? 'rgba(74, 222, 128, 0.1)' : 'rgba(248, 113, 113, 0.1)',
                border: `1px solid ${result.overall_pass ? 'var(--green)' : 'var(--red)'}`,
              }}>
                <div style={{ fontWeight: 600, color: result.overall_pass ? 'var(--green)' : 'var(--red)' }}>
                  {result.overall_pass ? 'PASS — Rule would fire' : 'FAIL — Rule would not fire'}
                </div>
                {result.character_used && (
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Tested with: {result.character_used.name}
                  </div>
                )}
              </div>

              {result.environment_snapshot && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                  Environment: {result.environment_snapshot.weather}, {result.environment_snapshot.time_of_day}, Hour {result.environment_snapshot.current_hour}
                </div>
              )}

              {result.details && result.details.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Condition Breakdown</h4>
                  {result.details.map((d, i) => (
                    <div key={i} style={{
                      display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 8px',
                      borderRadius: 'var(--radius-sm)', marginBottom: 4,
                      background: d.pass ? 'rgba(74, 222, 128, 0.05)' : 'rgba(248, 113, 113, 0.05)',
                    }}>
                      <span style={{ color: d.pass ? 'var(--green)' : 'var(--red)', fontWeight: 700, fontSize: 14 }}>
                        {d.pass ? '\u2714' : '\u2716'}
                      </span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{d.type}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.reason}</div>
                        {d.actual !== undefined && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Actual: {JSON.stringify(d.actual)}{d.expected !== undefined ? ` | Expected: ${JSON.stringify(d.expected)}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.actions_would_fire && result.actions_would_fire.length > 0 && (
                <div>
                  <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>Actions That Would Fire</h4>
                  {result.actions_would_fire.map((a, i) => (
                    <div key={i} style={{ fontSize: 12, padding: '4px 8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>{a.type}</span>
                      {' '}
                      <span style={{ color: 'var(--text-muted)' }}>
                        {Object.entries(a).filter(([k]) => k !== 'type').map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result?.error && (
            <div style={{ padding: 12, background: 'rgba(248, 113, 113, 0.1)', border: '1px solid var(--red)', borderRadius: 'var(--radius-sm)', color: 'var(--red)' }}>
              Error: {result.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
