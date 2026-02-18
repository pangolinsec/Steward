import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function EnvironmentSettingsPage({ campaignId, campaign, onUpdate }) {
  const [env, setEnv] = useState(null);
  const [attrs, setAttrs] = useState([]);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [thresholds, setThresholds] = useState([]);
  const [calendarConfig, setCalendarConfig] = useState(null);
  const [weatherOptions, setWeatherOptions] = useState([]);
  const [newWeather, setNewWeather] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!campaignId || !campaign) return;
    setAttrs(campaign.attribute_definitions || []);
    setThresholds(campaign.time_of_day_thresholds || []);
    setCalendarConfig(campaign.calendar_config || { months: [], weekdays: [] });
    setWeatherOptions(campaign.weather_options || []);
    api.getEnvironment(campaignId).then(setEnv).catch(() => {});
  }, [campaignId, campaign]);

  const saveCampaignSettings = async () => {
    setSaving(true);
    try {
      await api.updateCampaign(campaignId, {
        attribute_definitions: attrs,
        time_of_day_thresholds: thresholds,
        calendar_config: calendarConfig,
        weather_options: weatherOptions,
      });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const saveEnvState = async (updates) => {
    await api.updateEnvironment(campaignId, updates);
    const updated = await api.getEnvironment(campaignId);
    setEnv(updated);
    onUpdate();
  };

  if (!campaign || !env) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Campaign Settings</h2>
        <button className="btn btn-primary" onClick={saveCampaignSettings} disabled={saving}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Attribute Definitions */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Attribute Definitions</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>These are the attributes all characters in this campaign use.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {attrs.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={a.key} onChange={e => {
                  const updated = [...attrs]; updated[i] = { ...a, key: e.target.value }; setAttrs(updated);
                }} style={{ width: 120, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                <input type="text" value={a.label} onChange={e => {
                  const updated = [...attrs]; updated[i] = { ...a, label: e.target.value }; setAttrs(updated);
                }} style={{ flex: 1 }} />
                <button className="btn btn-danger btn-sm" onClick={() => setAttrs(attrs.filter((_, idx) => idx !== i))}>&#x2715;</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="text" placeholder="key" value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)} style={{ width: 120, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            <input type="text" placeholder="Label" value={newAttrLabel} onChange={e => setNewAttrLabel(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (newAttrKey && newAttrLabel) {
                setAttrs([...attrs, { key: newAttrKey, label: newAttrLabel }]);
                setNewAttrKey(''); setNewAttrLabel('');
              }
            }}>Add</button>
          </div>
        </div>

        {/* Current Environment */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Current Environment</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Hour</label>
              <input type="number" min="0" max="23" value={env.current_hour} onChange={e => saveEnvState({ current_hour: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Minute</label>
              <input type="number" min="0" max="59" value={env.current_minute} onChange={e => saveEnvState({ current_minute: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Day</label>
              <input type="number" min="1" value={env.current_day} onChange={e => saveEnvState({ current_day: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Month</label>
              <input type="number" min="1" value={env.current_month} onChange={e => saveEnvState({ current_month: Number(e.target.value) })} />
            </div>
            <div className="form-group">
              <label>Year</label>
              <input type="number" value={env.current_year} onChange={e => saveEnvState({ current_year: Number(e.target.value) })} />
            </div>
          </div>
          <div className="form-group">
            <label>Weather</label>
            <select value={env.weather} onChange={e => saveEnvState({ weather: e.target.value })}>
              {weatherOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Environment Notes</label>
            <textarea value={env.environment_notes} onChange={e => saveEnvState({ environment_notes: e.target.value })} rows={2} />
          </div>
        </div>

        {/* Time-of-Day Thresholds */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Time-of-Day Thresholds</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>Define when each time period starts (hour, 0-23).</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {thresholds.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={t.label} onChange={e => {
                  const updated = [...thresholds]; updated[i] = { ...t, label: e.target.value }; setThresholds(updated);
                }} style={{ flex: 1 }} />
                <input type="number" min="0" max="23" value={t.start} onChange={e => {
                  const updated = [...thresholds]; updated[i] = { ...t, start: Number(e.target.value) }; setThresholds(updated);
                }} style={{ width: 70 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>h</span>
                <button className="btn btn-danger btn-sm" onClick={() => setThresholds(thresholds.filter((_, idx) => idx !== i))}>&#x2715;</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => setThresholds([...thresholds, { label: 'New Period', start: 0 }])}>
            + Add Threshold
          </button>
        </div>

        {/* Weather Options */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Weather Options</h3>
          <div className="inline-flex gap-sm flex-wrap" style={{ marginBottom: 8 }}>
            {weatherOptions.map((w, i) => (
              <span key={i} className="tag" style={{ gap: 6 }}>
                {w}
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 11 }}
                  onClick={() => setWeatherOptions(weatherOptions.filter((_, idx) => idx !== i))}>&#x2715;</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={newWeather} onChange={e => setNewWeather(e.target.value)} placeholder="New weather type" style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter' && newWeather.trim()) { setWeatherOptions([...weatherOptions, newWeather.trim()]); setNewWeather(''); } }} />
            <button className="btn btn-secondary btn-sm" onClick={() => { if (newWeather.trim()) { setWeatherOptions([...weatherOptions, newWeather.trim()]); setNewWeather(''); } }}>Add</button>
          </div>
        </div>

        {/* Calendar Config */}
        <div className="card" style={{ gridColumn: '1 / -1' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Calendar Configuration</h3>
          <div className="form-group">
            <label>Weekday Names (comma-separated)</label>
            <input type="text" value={(calendarConfig?.weekdays || []).join(', ')}
              onChange={e => setCalendarConfig({ ...calendarConfig, weekdays: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })} />
          </div>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>Months</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(calendarConfig?.months || []).map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)', width: 24 }}>{i + 1}.</span>
                <input type="text" value={m.name} onChange={e => {
                  const months = [...calendarConfig.months]; months[i] = { ...m, name: e.target.value };
                  setCalendarConfig({ ...calendarConfig, months });
                }} style={{ flex: 1 }} />
                <input type="number" min="1" value={m.days} onChange={e => {
                  const months = [...calendarConfig.months]; months[i] = { ...m, days: Number(e.target.value) };
                  setCalendarConfig({ ...calendarConfig, months });
                }} style={{ width: 70 }} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>days</span>
                <button className="btn btn-danger btn-sm" onClick={() => {
                  const months = calendarConfig.months.filter((_, idx) => idx !== i);
                  setCalendarConfig({ ...calendarConfig, months });
                }}>&#x2715;</button>
              </div>
            ))}
          </div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: 8 }} onClick={() => {
            setCalendarConfig({ ...calendarConfig, months: [...(calendarConfig?.months || []), { name: 'New Month', days: 30 }] });
          }}>+ Add Month</button>
        </div>
      </div>
    </div>
  );
}
