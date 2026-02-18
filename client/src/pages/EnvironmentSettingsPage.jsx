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

  // Weather automation
  const [weatherVolatility, setWeatherVolatility] = useState(0.3);
  const [showAdvancedWeather, setShowAdvancedWeather] = useState(false);
  const [transitionTable, setTransitionTable] = useState(null);

  // Encounter settings
  const [encounterSettings, setEncounterSettings] = useState({ enabled: false, base_rate: 0.1, min_interval_hours: 1 });

  // Rules engine settings
  const [rulesSettings, setRulesSettings] = useState({ engine_enabled: true, cascade_depth_limit: 3 });

  useEffect(() => {
    if (!campaignId || !campaign) return;
    setAttrs(campaign.attribute_definitions || []);
    setThresholds(campaign.time_of_day_thresholds || []);
    setCalendarConfig(campaign.calendar_config || { months: [], weekdays: [] });
    setWeatherOptions(campaign.weather_options || []);
    setWeatherVolatility(campaign.weather_volatility ?? 0.3);
    setTransitionTable(campaign.weather_transition_table || null);
    setEncounterSettings(campaign.encounter_settings || { enabled: false, base_rate: 0.1, min_interval_hours: 1 });
    setRulesSettings(campaign.rules_settings || { engine_enabled: true, cascade_depth_limit: 3 });
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
        weather_volatility: weatherVolatility,
        weather_transition_table: transitionTable,
        encounter_settings: encounterSettings,
        rules_settings: rulesSettings,
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

  const generateDefaultTable = () => {
    const table = {};
    const opts = weatherOptions;
    for (const from of opts) {
      const row = {};
      let total = 0;
      const fromLower = from.toLowerCase();
      for (const to of opts) {
        const toLower = to.toLowerCase();
        let weight;
        if (from === to) weight = 5;
        else if ((fromLower.includes('rain') && toLower.includes('rain')) ||
                 (fromLower.includes('storm') && toLower.includes('rain')) ||
                 (fromLower.includes('rain') && toLower.includes('storm'))) weight = 2;
        else if (fromLower === 'clear' && toLower === 'overcast') weight = 2;
        else if (fromLower === 'overcast' && (toLower === 'clear' || toLower === 'rain')) weight = 2;
        else weight = 0.5;
        row[to] = weight;
        total += weight;
      }
      for (const to of opts) row[to] = Math.round((row[to] / total) * 1000) / 1000;
      table[from] = row;
    }
    setTransitionTable(table);
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

        {/* Weather Automation */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Weather Automation</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Weather transitions are rolled automatically when time advances. Higher volatility means weather changes more often.
          </p>
          <div className="form-group">
            <label>Volatility: {Math.round(weatherVolatility * 100)}%</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stable</span>
              <input type="range" min="0" max="1" step="0.05" value={weatherVolatility}
                onChange={e => setWeatherVolatility(Number(e.target.value))}
                style={{ flex: 1 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Volatile</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}
            onClick={() => setShowAdvancedWeather(!showAdvancedWeather)}>
            {showAdvancedWeather ? 'Hide' : 'Show'} Advanced Transition Table
          </button>
          {showAdvancedWeather && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={generateDefaultTable}>Auto-generate</button>
                <button className="btn btn-ghost btn-sm" onClick={() => setTransitionTable(null)}>Clear (use default)</button>
              </div>
              {transitionTable ? (
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        <th style={{ position: 'sticky', left: 0, background: 'var(--bg-secondary)', zIndex: 1 }}>From \ To</th>
                        {weatherOptions.map(w => <th key={w} style={{ minWidth: 60, textAlign: 'center' }}>{w}</th>)}
                        <th>Sum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weatherOptions.map(from => {
                        const row = transitionTable[from] || {};
                        const sum = weatherOptions.reduce((s, to) => s + (row[to] || 0), 0);
                        const valid = Math.abs(sum - 1) < 0.01;
                        return (
                          <tr key={from}>
                            <td style={{ position: 'sticky', left: 0, background: 'var(--bg-card)', fontWeight: 500, zIndex: 1 }}>{from}</td>
                            {weatherOptions.map(to => (
                              <td key={to} style={{ padding: 2 }}>
                                <input type="number" step="0.01" min="0" max="1" style={{ width: 55, fontSize: 11, textAlign: 'center' }}
                                  value={row[to] || 0}
                                  onChange={e => {
                                    const val = Number(e.target.value);
                                    setTransitionTable({
                                      ...transitionTable,
                                      [from]: { ...row, [to]: val },
                                    });
                                  }} />
                              </td>
                            ))}
                            <td style={{ color: valid ? 'var(--green)' : 'var(--red)', fontWeight: 500, textAlign: 'center' }}>
                              {sum.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Each row should sum to 1.00
                  </p>
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  Using auto-generated defaults. Click "Auto-generate" to customize.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Random Encounters */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Random Encounters</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            When enabled, encounters can trigger randomly during time advances based on configured probability.
          </p>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={encounterSettings.enabled}
                onChange={e => setEncounterSettings({ ...encounterSettings, enabled: e.target.checked })} />
              Enable random encounters
            </label>
          </div>
          {encounterSettings.enabled && (
            <>
              <div className="form-group">
                <label>Base encounter rate per hour: {Math.round(encounterSettings.base_rate * 100)}%</label>
                <input type="range" min="0" max="1" step="0.01" value={encounterSettings.base_rate}
                  onChange={e => setEncounterSettings({ ...encounterSettings, base_rate: Number(e.target.value) })} />
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  8-hour probability: {Math.round((1 - Math.pow(1 - encounterSettings.base_rate, 8)) * 100)}%
                </span>
              </div>
              <div className="form-group">
                <label>Minimum hours between encounters</label>
                <input type="number" min="0" step="0.5" value={encounterSettings.min_interval_hours}
                  onChange={e => setEncounterSettings({ ...encounterSettings, min_interval_hours: Number(e.target.value) })} />
              </div>
            </>
          )}
        </div>

        {/* Rules Engine */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Rules Engine</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            The rules engine evaluates conditions and auto-applies or suggests game-world changes.
          </p>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={rulesSettings.engine_enabled}
                onChange={e => setRulesSettings({ ...rulesSettings, engine_enabled: e.target.checked })} />
              Enable rules engine
            </label>
          </div>
          {rulesSettings.engine_enabled && (
            <div className="form-group">
              <label>Cascade depth limit: {rulesSettings.cascade_depth_limit}</label>
              <input type="range" min="1" max="10" step="1" value={rulesSettings.cascade_depth_limit}
                onChange={e => setRulesSettings({ ...rulesSettings, cascade_depth_limit: Number(e.target.value) })} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                After {rulesSettings.cascade_depth_limit} cascading rule fires, auto actions become suggestions.
              </span>
            </div>
          )}
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
