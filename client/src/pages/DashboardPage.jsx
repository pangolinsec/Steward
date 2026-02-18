import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import DiceRoller from '../components/DiceRoller';
import { useToast } from '../components/ToastContext';
import { renderMarkdown, processWikilinks } from '../utils/markdown';
import { resolveWikilink } from '../utils/wikilinkNavigate';

export default function DashboardPage({ campaignId, campaign }) {
  const navigate = useNavigate();
  const [characters, setCharacters] = useState([]);
  const [environment, setEnvironment] = useState(null);
  const [combatState, setCombatState] = useState(null);
  const [logEntries, setLogEntries] = useState([]);
  const [journalNotes, setJournalNotes] = useState([]);
  const [randomTables, setRandomTables] = useState([]);
  const [tableResults, setTableResults] = useState({});
  const [activePrep, setActivePrep] = useState(null);

  const load = useCallback(async () => {
    if (!campaignId) return;
    const [chars, env, combat, log, journal, tables, prep] = await Promise.all([
      api.getCharacters(campaignId).catch(() => []),
      api.getEnvironment(campaignId).catch(() => null),
      api.getCombatState(campaignId).catch(() => ({ active: false })),
      api.getSessionLog(campaignId, 'limit=8').catch(() => ({ entries: [] })),
      api.getJournalNotes(campaignId, 'starred=1&limit=3').then(r => r.notes || []).catch(() => []),
      api.getRandomTables(campaignId).catch(() => []),
      api.getActiveSessionPrep(campaignId).catch(() => null),
    ]);
    setCharacters(chars);
    setEnvironment(env);
    setCombatState(combat?.active ? combat : null);
    setLogEntries(log.entries || []);
    setJournalNotes(Array.isArray(journal) ? journal : []);
    setRandomTables(tables);
    setActivePrep(prep);
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const numericAttrs = campaign?.attribute_definitions?.filter(a => a.type !== 'tag') || [];
  const pinnedOrAll = numericAttrs.some(a => a.pinned) ? numericAttrs.filter(a => a.pinned) : numericAttrs;
  const catOrder = { resource: 0, defense: 1, stat: 2 };
  const compactAttrs = [...pinnedOrAll].sort((a, b) => (catOrder[a.category] ?? 2) - (catOrder[b.category] ?? 2));

  const getResourceStyle = (cur, maxVal) => {
    if (maxVal == null || maxVal <= 0) return {};
    const pct = (cur / maxVal) * 100;
    if (pct >= 100) return { color: 'var(--green)', fontWeight: 700 };
    if (pct >= 66) return { color: 'var(--green)' };
    if (pct >= 34) return { color: 'var(--yellow)' };
    if (pct >= 10) return { color: 'var(--red)' };
    return { color: 'var(--red)', fontWeight: 700 };
  };
  const pcs = characters.filter(c => c.type === 'PC');

  const weatherIcons = {
    'Clear': '\u2600', 'Overcast': '\u2601', 'Rain': '\uD83C\uDF27',
    'Heavy Rain': '\u26C8', 'Snow': '\u2744', 'Fog': '\uD83C\uDF2B',
    'Storm': '\u26A1', 'Windy': '\uD83C\uDF2C', 'Hail': '\uD83E\uDDCA',
  };

  const typeColors = {
    weather_change: 'var(--accent)', encounter_roll: 'var(--yellow)',
    encounter_start: 'var(--yellow)', encounter_end: 'var(--yellow)',
    travel: 'var(--green)', combat: 'var(--red)',
    table_roll: 'var(--accent)', dice_roll: 'var(--text-muted)',
  };

  const { addToast } = useToast();

  const processEvents = (events) => {
    if (!events) return;
    for (const event of events) {
      if (event.type === 'weather_change') {
        addToast(`Weather: ${event.from} \u2192 ${event.to}`, 'info');
      } else if (event.type === 'effect_expired') {
        addToast(`Effect expired: ${event.effect_name} on ${event.character_name}`, 'info');
      } else if (event.type === 'rule_notification') {
        addToast(event.message || `Rule fired: ${event.rule_name}`, event.severity || 'info');
      }
    }
  };

  const handleAdvance = async (hours, minutes) => {
    const result = await api.advanceTime(campaignId, { hours, minutes });
    processEvents(result.events);
    load();
  };

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="page">
      <div className="page-header">
        <h2>Dashboard</h2>
        <button className="btn btn-secondary btn-sm" onClick={load}>Refresh</button>
      </div>

      <div className="dashboard-grid">
        {/* Party Overview */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span>Party Overview</span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'none' }}>{pcs.length} PCs</span>
          </div>
          {pcs.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No PCs in campaign.</p>
          ) : (
            pcs.map(c => (
              <div key={c.id} className="party-row" onClick={() => navigate(`/characters/${c.id}`)}>
                {c.portrait_url ? (
                  <img src={c.portrait_url} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--bg-input)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: 'var(--text-muted)' }}>
                    {c.name[0]}
                  </div>
                )}
                <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{c.name}</span>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {compactAttrs.map(a => {
                    const val = c.base_attributes?.[a.key];
                    const cat = a.category || 'stat';
                    const maxVal = a.has_max ? (c.max_attributes?.[a.key] ?? val) : null;
                    const resStyle = cat === 'resource' && maxVal != null ? getResourceStyle(val ?? 0, maxVal) : {};
                    return (
                      <span key={a.key} className={`attr-chip attr-chip-${cat} attr-chip-sm`} style={resStyle}>
                        <span className="attr-chip-label">{a.label.substring(0, 3).toUpperCase()}</span>
                        {' '}{val ?? '\u2014'}{a.has_max && maxVal != null ? `/${maxVal}` : ''}
                      </span>
                    );
                  })}
                  {(c.applied_effects || []).slice(0, 3).map(eff => {
                    const isBuff = eff.tags?.includes('buff');
                    const isDebuff = eff.tags?.includes('debuff') || eff.tags?.includes('poison');
                    const cls = isDebuff ? 'tag-debuff' : isBuff ? 'tag-buff' : '';
                    return (
                      <span key={eff.id} className={`tag ${cls}`} style={{ fontSize: 9, padding: '1px 5px' }}>
                        {eff.name}
                        {eff.remaining_rounds != null && <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>({eff.remaining_rounds}r)</span>}
                        {eff.remaining_hours != null && <span style={{ color: 'var(--text-muted)', marginLeft: 2 }}>({Math.ceil(eff.remaining_hours)}h)</span>}
                      </span>
                    );
                  })}
                  {(c.applied_effects || []).length > 3 && (
                    <span className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>+{c.applied_effects.length - 3}</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Environment Snapshot */}
        {environment && (
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <span>Environment</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Time</span>
                <div style={{ fontWeight: 600 }}>{pad(environment.current_hour)}:{pad(environment.current_minute)} <span className="tag" style={{ fontSize: 9 }}>{environment.time_of_day}</span></div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Date</span>
                <div style={{ fontWeight: 500 }}>{environment.month_name} {environment.current_day}, {environment.current_year}</div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Weather</span>
                <div>{weatherIcons[environment.weather] || ''} {environment.weather}</div>
              </div>
              {environment.current_location_name && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Location</span>
                  <div>{environment.current_location_name}</div>
                </div>
              )}
            </div>
            {environment.environment_notes && (
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-secondary)', padding: '6px 8px', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)' }}>
                {environment.environment_notes}
              </div>
            )}
          </div>
        )}

        {/* Quick Advance */}
        <QuickAdvanceCard campaignId={campaignId} campaign={campaign} onAdvance={handleAdvance} processEvents={processEvents} onUpdate={load} />

        {/* Session Prep */}
        <SessionPrepCard activePrep={activePrep} campaignId={campaignId} onUpdate={load} navigate={navigate} />

        {/* Combat Status */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span>Combat</span>
          </div>
          {combatState ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span className="tag" style={{ background: 'var(--red-dim)', color: 'var(--red)', borderColor: '#991b1b', fontWeight: 600 }}>
                  Round {combatState.round}
                </span>
                <span style={{ fontSize: 13 }}>
                  Turn: <strong>{combatState.combatants[combatState.turn_index]?.name || '?'}</strong>
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {combatState.combatants.length} combatants
              </div>
              <button className="btn btn-sm btn-secondary" style={{ marginTop: 8 }} onClick={() => navigate('/characters')}>
                Go to Combat
              </button>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>No active combat.</p>
              <button className="btn btn-sm btn-secondary" onClick={() => navigate('/characters', { state: { startCombat: true } })}>Start Combat</button>
            </div>
          )}
        </div>

        {/* Dice Roller */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span>Dice Roller</span>
          </div>
          <DiceRoller campaignId={campaignId} campaign={campaign} inline />
        </div>

        {/* Recent Session Log */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span>Recent Log</span>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, textTransform: 'none' }} onClick={() => navigate('/session-log')}>View All</button>
          </div>
          {logEntries.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No log entries yet.</p>
          ) : (
            logEntries.map(entry => (
              <div key={entry.id} className="log-entry-compact">
                <span className="tag" style={{ fontSize: 9, borderColor: typeColors[entry.entry_type] || undefined, color: typeColors[entry.entry_type] || undefined }}>{entry.entry_type}</span>
                <span style={{ flex: 1, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.message}</span>
              </div>
            ))
          )}
        </div>

        {/* Pinned Journal Notes */}
        <div className="dashboard-card">
          <div className="dashboard-card-header">
            <span>Pinned Notes</span>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, textTransform: 'none' }} onClick={() => navigate('/journal')}>View All</button>
          </div>
          {journalNotes.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No starred journal notes. Star notes to pin them here.</p>
          ) : (
            journalNotes.slice(0, 3).map(note => (
              <div key={note.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)', cursor: 'pointer' }} onClick={() => navigate('/journal')}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{note.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.content?.substring(0, 80) || 'Empty note'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Random Table Quick Roll */}
        {randomTables.length > 0 && (
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <span>Random Tables</span>
              <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, textTransform: 'none' }} onClick={() => navigate('/random-tables')}>View All</button>
            </div>
            {randomTables.slice(0, 5).map(t => (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 12, flex: 1 }}>{t.name}</span>
                {tableResults[t.id] && (
                  <span style={{ fontSize: 11, color: 'var(--accent)', marginRight: 8, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {tableResults[t.id]}
                  </span>
                )}
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                  onClick={async () => {
                    const res = await api.rollRandomTable(campaignId, t.id);
                    setTableResults(prev => ({ ...prev, [t.id]: res.result }));
                  }}>Roll</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_DASHBOARD_PRESETS = [
  { label: '+15m', hours: 0, minutes: 15 },
  { label: '+1h', hours: 1, minutes: 0 },
  { label: '+4h', hours: 4, minutes: 0 },
];

function formatPresetTime(hours, minutes) {
  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  return parts.join(' ') || '0m';
}

function QuickAdvanceCard({ campaignId, campaign, onAdvance, processEvents, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [presets, setPresets] = useState(campaign?.dashboard_time_presets || DEFAULT_DASHBOARD_PRESETS);
  const dragIdxRef = useRef(null);
  const dragOverIdxRef = useRef(null);

  useEffect(() => {
    if (campaign?.dashboard_time_presets) setPresets(campaign.dashboard_time_presets);
  }, [campaign?.dashboard_time_presets]);

  const savePresets = async (newPresets) => {
    setPresets(newPresets);
    await api.updateCampaign(campaignId, { dashboard_time_presets: newPresets });
  };

  const handleDone = () => {
    savePresets(presets);
    setEditing(false);
  };

  const handleDragEnd = () => {
    if (dragIdxRef.current === null || dragOverIdxRef.current === null || dragIdxRef.current === dragOverIdxRef.current) {
      dragIdxRef.current = null;
      dragOverIdxRef.current = null;
      return;
    }
    const reordered = [...presets];
    const [moved] = reordered.splice(dragIdxRef.current, 1);
    reordered.splice(dragOverIdxRef.current, 0, moved);
    setPresets(reordered);
    dragIdxRef.current = null;
    dragOverIdxRef.current = null;
  };

  return (
    <div className="dashboard-card">
      <div className="dashboard-card-header">
        <span>Quick Advance</span>
        {!editing ? (
          <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, textTransform: 'none' }} onClick={() => setEditing(true)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ verticalAlign: 'middle' }}>
              <path d="M12 15.5A3.5 3.5 0 1 0 8.5 12 3.5 3.5 0 0 0 12 15.5Z"/><path d="M19.43 12.98a7.79 7.79 0 0 0 0-1.96l2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.3 7.3 0 0 0-1.69-.98l-.38-2.65A.49.49 0 0 0 14 2h-4a.49.49 0 0 0-.49.42l-.38 2.65a7.3 7.3 0 0 0-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65a7.79 7.79 0 0 0 0 1.96l-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46a.5.5 0 0 0 .61.22l2.49-1a7.3 7.3 0 0 0 1.69.98l.38 2.65A.49.49 0 0 0 10 22h4a.49.49 0 0 0 .49-.42l.38-2.65a7.3 7.3 0 0 0 1.69-.98l2.49 1a.5.5 0 0 0 .61-.22l2-3.46a.5.5 0 0 0-.12-.64Z"/>
            </svg>
          </button>
        ) : (
          <button className="btn btn-primary btn-sm" style={{ fontSize: 10 }} onClick={handleDone}>Done</button>
        )}
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {presets.map((p, i) => (
            <div key={i}
              draggable
              onDragStart={() => { dragIdxRef.current = i; }}
              onDragOver={e => { e.preventDefault(); dragOverIdxRef.current = i; }}
              onDragEnd={handleDragEnd}
              style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '3px 0', borderRadius: 'var(--radius-sm)', cursor: 'grab' }}
            >
              <span style={{ color: 'var(--text-muted)', fontSize: 11, cursor: 'grab', padding: '0 2px', userSelect: 'none' }} title="Drag to reorder">&#x2630;</span>
              <input type="text" value={p.label} onChange={e => {
                const updated = [...presets]; updated[i] = { ...p, label: e.target.value }; setPresets(updated);
              }} style={{ flex: 1, fontSize: 12 }} placeholder="Label" />
              <input type="number" min="0" value={p.hours} onChange={e => {
                const updated = [...presets]; updated[i] = { ...p, hours: Number(e.target.value) }; setPresets(updated);
              }} style={{ width: 48, fontSize: 12 }} title="Hours" />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>h</span>
              <input type="number" min="0" max="59" value={p.minutes} onChange={e => {
                const updated = [...presets]; updated[i] = { ...p, minutes: Number(e.target.value) }; setPresets(updated);
              }} style={{ width: 48, fontSize: 12 }} title="Minutes" />
              <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>m</span>
              <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}
                onClick={() => setPresets(presets.filter((_, idx) => idx !== i))}>&#x2715;</button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }}
            onClick={() => setPresets([...presets, { label: '', hours: 0, minutes: 30 }])}>+ Add Preset</button>
        </div>
      ) : (
        <>
          {presets.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>No presets configured. Click the gear to add some.</p>
          ) : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {presets.map((p, i) => (
                <button key={i} className="btn btn-sm btn-secondary" onClick={() => onAdvance(p.hours, p.minutes)}
                  title={formatPresetTime(p.hours, p.minutes)}>
                  {p.label}
                  <span style={{ marginLeft: 4, fontSize: 10, color: 'var(--text-muted)' }}>{formatPresetTime(p.hours, p.minutes)}</span>
                </button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 8, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
            <button className="btn btn-sm btn-secondary" onClick={async () => {
              const result = await api.rest(campaignId, 'short');
              processEvents(result.events); onUpdate();
            }}>Short Rest</button>
            <button className="btn btn-sm btn-secondary" onClick={async () => {
              const result = await api.rest(campaignId, 'long');
              processEvents(result.events); onUpdate();
            }}>Long Rest</button>
          </div>
        </>
      )}
    </div>
  );
}

function SessionPrepCard({ activePrep, campaignId, onUpdate, navigate }) {
  const toggleScene = async (idx) => {
    if (!activePrep) return;
    const scenes = activePrep.scenes.map((s, i) => i === idx ? { ...s, done: !s.done } : s);
    await api.updateSessionPrep(campaignId, activePrep.id, { scenes });
    onUpdate();
  };

  const handleWikilinkClick = async (e) => {
    const wikilink = e.target.closest('[data-wikilink]');
    if (!wikilink) return;
    e.preventDefault();
    const name = decodeURIComponent(wikilink.dataset.wikilink);
    const path = await resolveWikilink(campaignId, name);
    if (path) navigate(path);
  };

  return (
    <div className="dashboard-card" onClick={handleWikilinkClick}>
      <div className="dashboard-card-header">
        <span>Session Prep</span>
        <button className="btn btn-ghost btn-sm" style={{ fontSize: 10, textTransform: 'none' }} onClick={() => navigate('/session-prep')}>
          {activePrep ? 'Open Prep' : 'View All'}
        </button>
      </div>
      {activePrep ? (
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 6, cursor: 'pointer' }} onClick={() => navigate('/session-prep')}>
            {activePrep.title || 'Untitled'}
          </div>
          {activePrep.strong_start && (
            <div
              className="markdown-content"
              style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(activePrep.strong_start) }}
            />
          )}
          {activePrep.scenes?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              {activePrep.scenes.map((scene, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '2px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={scene.done} onChange={() => toggleScene(idx)} />
                  <span
                    style={{ textDecoration: scene.done ? 'line-through' : 'none', opacity: scene.done ? 0.5 : 1 }}
                    dangerouslySetInnerHTML={{ __html: processWikilinks(scene.text || '(empty)') }}
                  />
                </label>
              ))}
            </div>
          )}
          {activePrep.secrets?.length > 0 && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {activePrep.secrets.filter(s => s.revealed).length}/{activePrep.secrets.length} secrets revealed
            </div>
          )}
        </div>
      ) : (
        <div>
          <p style={{ color: 'var(--text-muted)', fontSize: 12, marginBottom: 8 }}>No active session prep.</p>
          <button className="btn btn-sm btn-secondary" onClick={() => navigate('/session-prep')}>Create One</button>
        </div>
      )}
    </div>
  );
}
