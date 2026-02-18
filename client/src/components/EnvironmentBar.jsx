import React, { useState } from 'react';
import * as api from '../api';

export default function EnvironmentBar({ environment, campaignId, onUpdate, campaign }) {
  const [showAdvance, setShowAdvance] = useState(false);
  const [advHours, setAdvHours] = useState(0);
  const [advMinutes, setAdvMinutes] = useState(0);

  const pad = (n) => String(n).padStart(2, '0');

  const handleAdvance = async (hours, minutes) => {
    await api.advanceTime(campaignId, { hours, minutes });
    onUpdate();
    setShowAdvance(false);
    setAdvHours(0);
    setAdvMinutes(0);
  };

  const weatherIcons = {
    'Clear': '\u2600',
    'Overcast': '\u2601',
    'Rain': '\uD83C\uDF27',
    'Heavy Rain': '\u26C8',
    'Snow': '\u2744',
    'Fog': '\uD83C\uDF2B',
    'Storm': '\u26A1',
    'Windy': '\uD83C\uDF2C',
    'Hail': '\uD83E\uDDCA',
  };

  return (
    <div className="env-bar">
      <div className="env-bar-item">
        <span className="env-bar-label">Time</span>
        <span className="env-bar-value">{pad(environment.current_hour)}:{pad(environment.current_minute)}</span>
        <span className="tag">{environment.time_of_day}</span>
      </div>
      <div className="env-bar-item">
        <span className="env-bar-label">Date</span>
        <span className="env-bar-value">{environment.month_name} {environment.current_day}, {environment.current_year}</span>
      </div>
      <div className="env-bar-item">
        <span className="env-bar-label">Weather</span>
        <span className="env-bar-value">{weatherIcons[environment.weather] || ''} {environment.weather}</span>
      </div>
      {environment.environment_notes && (
        <div className="env-bar-item" style={{ flex: 1, minWidth: 0 }}>
          <span className="env-bar-label">Notes</span>
          <span className="env-bar-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{environment.environment_notes}</span>
        </div>
      )}
      <div className="env-bar-item" style={{ marginLeft: 'auto' }}>
        <button className="btn btn-sm btn-secondary" onClick={() => handleAdvance(0, 10)}>+10m</button>
        <button className="btn btn-sm btn-secondary" onClick={() => handleAdvance(1, 0)}>+1h</button>
        <button className="btn btn-sm btn-secondary" onClick={() => handleAdvance(8, 0)}>+8h</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setShowAdvance(!showAdvance)}>Custom</button>
      </div>
      {showAdvance && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', width: '100%', paddingTop: 4 }}>
          <input type="number" min="0" value={advHours} onChange={e => setAdvHours(Number(e.target.value))} style={{ width: 60 }} placeholder="hrs" />
          <span style={{ color: 'var(--text-muted)' }}>h</span>
          <input type="number" min="0" max="59" value={advMinutes} onChange={e => setAdvMinutes(Number(e.target.value))} style={{ width: 60 }} placeholder="min" />
          <span style={{ color: 'var(--text-muted)' }}>m</span>
          <button className="btn btn-sm btn-primary" onClick={() => handleAdvance(advHours, advMinutes)}>Advance</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setShowAdvance(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
