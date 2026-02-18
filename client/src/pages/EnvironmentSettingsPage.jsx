import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext as NavigationContext } from 'react-router-dom';
import * as api from '../api';
import RuleRefBadge from '../components/RuleRefBadge';
import TagPresetBrowser from '../components/TagPresetBrowser';
import PresetBuilder from '../components/PresetBuilder';

export default function EnvironmentSettingsPage({ campaignId, campaign, onUpdate }) {
  const [env, setEnv] = useState(null);
  const [attrs, setAttrs] = useState([]);
  const [newAttrKey, setNewAttrKey] = useState('');
  const [newAttrLabel, setNewAttrLabel] = useState('');
  const [newAttrType, setNewAttrType] = useState('numeric');
  const [newAttrOptions, setNewAttrOptions] = useState('');
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
  const [rulesSettings, setRulesSettings] = useState({ engine_enabled: false, cascade_depth_limit: 3 });

  // Season options
  const [seasonOptions, setSeasonOptions] = useState([]);
  const [newSeason, setNewSeason] = useState('');

  // Dice settings
  const [diceSettings, setDiceSettings] = useState({ log_rolls: false });

  // Tag preset browser
  const [showTagPresets, setShowTagPresets] = useState(false);
  const [presetBuilderTagKey, setPresetBuilderTagKey] = useState(null);

  // Property key registry — normalized to {key, values}[] format
  const [propertyKeyRegistry, setPropertyKeyRegistry] = useState([]);
  const [newPropKey, setNewPropKey] = useState('');

  // Normalize old string[] format to {key, values}[]
  const normalizedRegistry = (propertyKeyRegistry || []).map(entry =>
    typeof entry === 'string' ? { key: entry, values: [] } : entry
  );

  // Dirty tracking — snapshot of saved state
  const savedSnapshot = useRef(null);
  const [pendingNavigation, setPendingNavigation] = useState(null);

  const getCurrentSettings = useCallback(() => JSON.stringify({
    attrs, thresholds, calendarConfig, weatherOptions,
    weatherVolatility, transitionTable, encounterSettings,
    rulesSettings, propertyKeyRegistry, seasonOptions, diceSettings,
  }), [attrs, thresholds, calendarConfig, weatherOptions,
    weatherVolatility, transitionTable, encounterSettings,
    rulesSettings, propertyKeyRegistry, seasonOptions, diceSettings]);

  const isDirty = savedSnapshot.current !== null && savedSnapshot.current !== getCurrentSettings();

  // Navigation guard — beforeunload for browser navigation
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // Navigation guard — intercept in-app navigation
  const { navigator } = useContext(NavigationContext);
  useEffect(() => {
    if (!isDirty) return;
    const originalPush = navigator.push;
    const originalReplace = navigator.replace;
    navigator.push = (...args) => setPendingNavigation({ fn: () => originalPush.apply(navigator, args) });
    navigator.replace = (...args) => setPendingNavigation({ fn: () => originalReplace.apply(navigator, args) });
    return () => { navigator.push = originalPush; navigator.replace = originalReplace; };
  }, [isDirty, navigator]);

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
    setPropertyKeyRegistry(campaign.property_key_registry || []);
    setSeasonOptions(campaign.season_options || ["Spring", "Summer", "Autumn", "Winter"]);
    setDiceSettings(campaign.dice_settings || { log_rolls: false });
    api.getEnvironment(campaignId).then(setEnv).catch(() => {});
    // Set saved snapshot after state settles
    requestAnimationFrame(() => {
      savedSnapshot.current = JSON.stringify({
        attrs: campaign.attribute_definitions || [],
        thresholds: campaign.time_of_day_thresholds || [],
        calendarConfig: campaign.calendar_config || { months: [], weekdays: [] },
        weatherOptions: campaign.weather_options || [],
        weatherVolatility: campaign.weather_volatility ?? 0.3,
        transitionTable: campaign.weather_transition_table || null,
        encounterSettings: campaign.encounter_settings || { enabled: false, base_rate: 0.1, min_interval_hours: 1 },
        rulesSettings: campaign.rules_settings || { engine_enabled: true, cascade_depth_limit: 3 },
        propertyKeyRegistry: campaign.property_key_registry || [],
        seasonOptions: campaign.season_options || ["Spring", "Summer", "Autumn", "Winter"],
        diceSettings: campaign.dice_settings || { log_rolls: false },
      });
    });
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
        property_key_registry: propertyKeyRegistry,
        season_options: seasonOptions,
        dice_settings: diceSettings,
      });
      savedSnapshot.current = getCurrentSettings();
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

  const DEFAULT_ADJACENCY = {
    'Clear':      ['Overcast', 'Windy'],
    'Overcast':   ['Clear', 'Rain', 'Fog', 'Windy', 'Snow'],
    'Rain':       ['Overcast', 'Heavy Rain', 'Fog'],
    'Heavy Rain': ['Rain', 'Storm'],
    'Storm':      ['Heavy Rain', 'Hail', 'Windy'],
    'Windy':      ['Clear', 'Overcast', 'Storm'],
    'Fog':        ['Overcast', 'Rain'],
    'Snow':       ['Overcast', 'Hail'],
    'Hail':       ['Storm', 'Snow'],
  };

  const generateDefaultTable = () => {
    const table = {};
    for (const from of weatherOptions) {
      const row = {};
      const neighbors = DEFAULT_ADJACENCY[from];
      const selfWeight = 4;
      let total = 0;
      for (const to of weatherOptions) {
        if (from === to) {
          row[to] = selfWeight;
        } else if (neighbors && neighbors.includes(to)) {
          row[to] = 1;
        } else if (!neighbors) {
          row[to] = 0.3;
        } else {
          row[to] = 0;
        }
        total += row[to];
      }
      for (const to of weatherOptions) {
        row[to] = total > 0 ? Math.round((row[to] / total) * 1000) / 1000 : 0;
      }
      table[from] = row;
    }
    setTransitionTable(table);
  };

  const toggleAdjacency = (from, to) => {
    const table = { ...(transitionTable || {}) };
    // Initialize row if missing
    if (!table[from]) {
      const row = {};
      for (const w of weatherOptions) row[w] = from === w ? 4 : 0;
      table[from] = row;
    }
    const row = { ...table[from] };
    // Toggle: if >0 set to 0, if 0 set to 1 (raw weight)
    row[to] = row[to] > 0 ? 0 : 1;
    // Re-normalize
    const total = weatherOptions.reduce((s, w) => s + (row[w] || 0), 0);
    if (total > 0) {
      for (const w of weatherOptions) row[w] = Math.round(((row[w] || 0) / total) * 1000) / 1000;
    }
    table[from] = row;
    setTransitionTable(table);
  };

  if (!campaign || !env) return <div className="page"><p style={{ color: 'var(--text-muted)' }}>Loading...</p></div>;

  return (
    <div className="page">
      <div className="page-header">
        <h2>Campaign Settings</h2>
        <div className="inline-flex gap-sm" style={{ alignItems: 'center' }}>
          {isDirty && <span style={{ fontSize: 12, color: 'var(--yellow)' }}>Unsaved changes</span>}
          <button className="btn btn-primary" onClick={saveCampaignSettings} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Attribute Definitions */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Attribute Definitions</h3>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowTagPresets(true)}>Presets</button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>These are the attributes all characters in this campaign use.</p>

          {/* Numeric Attributes */}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>Numeric Attributes</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {attrs.filter(a => a.type !== 'tag').map((a, i) => {
              const realIdx = attrs.indexOf(a);
              return (
                <div key={realIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" value={a.key} onChange={e => {
                    const updated = [...attrs]; updated[realIdx] = { ...a, key: e.target.value }; setAttrs(updated);
                  }} style={{ width: 120, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  <input type="text" value={a.label} onChange={e => {
                    const updated = [...attrs]; updated[realIdx] = { ...a, label: e.target.value }; setAttrs(updated);
                  }} style={{ flex: 1 }} />
                  <RuleRefBadge campaignId={campaignId} entityType="attribute" entityName={a.key} />
                  <button className="btn btn-danger btn-sm" onClick={() => setAttrs(attrs.filter((_, idx) => idx !== realIdx))}>&#x2715;</button>
                </div>
              );
            })}
          </div>

          {/* Tag Attributes */}
          <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6, display: 'block' }}>Tag Attributes</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {attrs.filter(a => a.type === 'tag').map((a) => {
              const realIdx = attrs.indexOf(a);
              return (
                <div key={realIdx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" value={a.key} onChange={e => {
                    const updated = [...attrs]; updated[realIdx] = { ...a, key: e.target.value }; setAttrs(updated);
                  }} style={{ width: 120, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                  <input type="text" value={a.label} onChange={e => {
                    const updated = [...attrs]; updated[realIdx] = { ...a, label: e.target.value }; setAttrs(updated);
                  }} style={{ width: 120 }} />
                  <input type="text" value={(a.options || []).join(', ')} onChange={e => {
                    const opts = e.target.value.split(',').map(s => s.trim()).filter(Boolean);
                    const updated = [...attrs]; updated[realIdx] = { ...a, options: opts }; setAttrs(updated);
                  }} placeholder="Option1, Option2, ..." style={{ flex: 1, fontSize: 12 }} />
                  <RuleRefBadge campaignId={campaignId} entityType="attribute" entityName={a.key} />
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => setPresetBuilderTagKey(a.key)}>Preset</button>
                  <button className="btn btn-danger btn-sm" onClick={() => setAttrs(attrs.filter((_, idx) => idx !== realIdx))}>&#x2715;</button>
                </div>
              );
            })}
          </div>

          {/* Add new attribute */}
          <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
            <select value={newAttrType} onChange={e => setNewAttrType(e.target.value)} style={{ width: 100, fontSize: 12 }}>
              <option value="numeric">Numeric</option>
              <option value="tag">Tag</option>
            </select>
            <input type="text" placeholder="key" value={newAttrKey} onChange={e => setNewAttrKey(e.target.value)} style={{ width: 100, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            <input type="text" placeholder="Label" value={newAttrLabel} onChange={e => setNewAttrLabel(e.target.value)} style={{ width: 100 }} />
            {newAttrType === 'tag' && (
              <input type="text" placeholder="Option1, Option2, ..." value={newAttrOptions} onChange={e => setNewAttrOptions(e.target.value)} style={{ flex: 1, fontSize: 12 }} />
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (newAttrKey && newAttrLabel) {
                const newAttr = { key: newAttrKey, label: newAttrLabel };
                if (newAttrType === 'tag') {
                  newAttr.type = 'tag';
                  newAttr.options = newAttrOptions.split(',').map(s => s.trim()).filter(Boolean);
                }
                setAttrs([...attrs, newAttr]);
                setNewAttrKey(''); setNewAttrLabel(''); setNewAttrOptions(''); setNewAttrType('numeric');
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
                <RuleRefBadge campaignId={campaignId} entityType="weather" entityName={w} />
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

        {/* Season Options */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Season Options</h3>
          <div className="inline-flex gap-sm flex-wrap" style={{ marginBottom: 8 }}>
            {seasonOptions.map((s, i) => (
              <span key={i} className="tag" style={{ gap: 6 }}>
                {s}
                <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 11 }}
                  onClick={() => setSeasonOptions(seasonOptions.filter((_, idx) => idx !== i))}>&#x2715;</button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={newSeason} onChange={e => setNewSeason(e.target.value)} placeholder="New season" style={{ flex: 1 }}
              onKeyDown={e => { if (e.key === 'Enter' && newSeason.trim()) { setSeasonOptions([...seasonOptions, newSeason.trim()]); setNewSeason(''); } }} />
            <button className="btn btn-secondary btn-sm" onClick={() => { if (newSeason.trim()) { setSeasonOptions([...seasonOptions, newSeason.trim()]); setNewSeason(''); } }}>Add</button>
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

          {/* Adjacency Editor */}
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)', margin: 0 }}>Weather Adjacency</label>
              <button className="btn btn-secondary btn-sm" onClick={generateDefaultTable}>Auto-generate</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setTransitionTable(null)}>Clear (use default)</button>
            </div>
            {transitionTable ? (
              <>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
                  Toggle which weather types can transition to each other. Non-adjacent transitions are blocked.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {weatherOptions.map(from => {
                    const row = transitionTable[from] || {};
                    return (
                      <div key={from} style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 500, minWidth: 90, color: 'var(--text-primary)' }}>{from}</span>
                        {weatherOptions.filter(w => w !== from).map(to => {
                          const isOn = (row[to] || 0) > 0;
                          return (
                            <button key={to} className="btn btn-sm"
                              style={{
                                fontSize: 11, padding: '2px 8px',
                                background: isOn ? 'var(--accent)' : 'var(--bg-input)',
                                color: isOn ? '#fff' : 'var(--text-muted)',
                                border: `1px solid ${isOn ? 'var(--accent)' : 'var(--border)'}`,
                              }}
                              onClick={() => toggleAdjacency(from, to)}
                            >
                              {to}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                Using auto-generated defaults. Click "Auto-generate" to customize.
              </p>
            )}
          </div>

          {/* Raw probability table */}
          {transitionTable && (
            <>
              <button className="btn btn-ghost btn-sm" style={{ marginBottom: 8 }}
                onClick={() => setShowAdvancedWeather(!showAdvancedWeather)}>
                {showAdvancedWeather ? 'Hide' : 'Show'} Probability Table
              </button>
              {showAdvancedWeather && (
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
                    Each row should sum to 1.00. Editing values here will not auto-normalize.
                  </p>
                </div>
              )}
            </>
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

        {/* Dice Roller */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Dice Roller</h3>
          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="checkbox" checked={diceSettings.log_rolls}
                onChange={e => setDiceSettings({ ...diceSettings, log_rolls: e.target.checked })} />
              Log dice rolls to session log
            </label>
          </div>
        </div>

        {/* Property Key Registry */}
        <div className="card">
          <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>Property Key Registry</h3>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Define property keys and their allowed values for locations and edges. These populate dropdowns in the map editor and validate rules that use location_property conditions.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {normalizedRegistry.map((entry, i) => (
              <PropertyKeyEntry
                key={i}
                entry={entry}
                onChange={updated => {
                  const next = [...normalizedRegistry];
                  next[i] = updated;
                  setPropertyKeyRegistry(next);
                }}
                onRemove={() => setPropertyKeyRegistry(normalizedRegistry.filter((_, idx) => idx !== i))}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input type="text" placeholder="New property key" value={newPropKey}
              onChange={e => setNewPropKey(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && newPropKey.trim()) {
                  setPropertyKeyRegistry([...normalizedRegistry, { key: newPropKey.trim(), values: [] }]);
                  setNewPropKey('');
                }
              }}
              style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            <button className="btn btn-secondary btn-sm" onClick={() => {
              if (newPropKey.trim()) {
                setPropertyKeyRegistry([...normalizedRegistry, { key: newPropKey.trim(), values: [] }]);
                setNewPropKey('');
              }
            }}>Add Key</button>
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
      {showTagPresets && (
        <TagPresetBrowser
          campaignId={campaignId}
          campaign={campaign}
          onClose={() => setShowTagPresets(false)}
          onImported={() => { setShowTagPresets(false); onUpdate(); }}
        />
      )}
      {presetBuilderTagKey && (
        <PresetBuilder
          campaignId={campaignId}
          campaign={campaign}
          initialTagKey={presetBuilderTagKey}
          onClose={() => setPresetBuilderTagKey(null)}
          onSaved={() => { setPresetBuilderTagKey(null); onUpdate(); }}
        />
      )}
      {pendingNavigation && (
        <div className="modal-overlay" onClick={() => setPendingNavigation(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Unsaved Changes</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setPendingNavigation(null)}>&#x2715;</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)' }}>You have unsaved changes to campaign settings. What would you like to do?</p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => setPendingNavigation(null)}>Stay on Page</button>
              <button className="btn btn-danger" onClick={() => {
                savedSnapshot.current = null;
                const nav = pendingNavigation.fn;
                setPendingNavigation(null);
                nav();
              }}>Discard Changes</button>
              <button className="btn btn-primary" onClick={async () => {
                await saveCampaignSettings();
                const nav = pendingNavigation.fn;
                setPendingNavigation(null);
                nav();
              }}>Save & Leave</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PropertyKeyEntry({ entry, onChange, onRemove }) {
  const [newValue, setNewValue] = useState('');
  const [expanded, setExpanded] = useState(false);

  const addValue = () => {
    if (!newValue.trim()) return;
    if (entry.values.includes(newValue.trim())) return;
    onChange({ ...entry, values: [...entry.values, newValue.trim()] });
    setNewValue('');
  };

  const removeValue = (val) => {
    onChange({ ...entry, values: entry.values.filter(v => v !== val) });
  };

  return (
    <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', padding: 8 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '0 4px', fontSize: 10, lineHeight: 1 }}
          onClick={() => setExpanded(!expanded)}
        >{expanded ? '\u25BC' : '\u25B6'}</button>
        <input type="text" value={entry.key} onChange={e => onChange({ ...entry, key: e.target.value })}
          style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: 12 }} />
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {entry.values.length} value{entry.values.length !== 1 ? 's' : ''}
        </span>
        <button className="btn btn-danger btn-sm" onClick={onRemove}>&#x2715;</button>
      </div>
      {expanded && (
        <div style={{ marginTop: 8, paddingLeft: 24 }}>
          {entry.values.length > 0 && (
            <div className="inline-flex gap-sm flex-wrap" style={{ marginBottom: 8 }}>
              {entry.values.map(v => (
                <span key={v} className="tag" style={{ gap: 6 }}>
                  {v}
                  <button style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, fontSize: 11 }}
                    onClick={() => removeValue(v)}>&#x2715;</button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input type="text" placeholder="New value" value={newValue}
              onChange={e => setNewValue(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addValue(); }}
              style={{ flex: 1, fontSize: 12 }} />
            <button className="btn btn-secondary btn-sm" onClick={addValue}>Add</button>
          </div>
        </div>
      )}
    </div>
  );
}
