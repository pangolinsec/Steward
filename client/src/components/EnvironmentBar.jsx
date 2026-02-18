import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import { useToast } from './ToastContext';
import NotificationDrawer from './NotificationDrawer';

export default function EnvironmentBar({ environment, campaignId, onUpdate, campaign }) {
  const navigate = useNavigate();
  const [showAdvance, setShowAdvance] = useState(false);
  const [advHours, setAdvHours] = useState(0);
  const [advMinutes, setAdvMinutes] = useState(0);
  const [encounterEvent, setEncounterEvent] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifPinned, setNotifPinned] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { addToast } = useToast();

  const refreshNotifCount = async () => {
    if (!campaignId) return;
    try {
      const data = await api.getNotificationCount(campaignId);
      setUnreadCount(data.count);
    } catch { /* ignore */ }
  };

  useEffect(() => { refreshNotifCount(); }, [campaignId]);

  const pad = (n) => String(n).padStart(2, '0');

  const processEvents = (events) => {
    if (!events) return;
    for (const event of events) {
      if (event.type === 'weather_change') {
        addToast(`Weather: ${event.from} \u2192 ${event.to}`, 'info');
      } else if (event.type === 'encounter_triggered') {
        setEncounterEvent(event);
      } else if (event.type === 'travel') {
        addToast(`Traveled: ${event.from} \u2192 ${event.to} (${event.hours}h)`, 'success');
      } else if (event.type === 'rest') {
        addToast(`${event.rest_type === 'short' ? 'Short' : 'Long'} rest (${event.hours}h)`, 'success');
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
    onUpdate();
    refreshNotifCount();
    setShowAdvance(false);
    setAdvHours(0);
    setAdvMinutes(0);
  };

  const handleStartEncounter = async (enc, startCombat = false) => {
    const overrides = enc.environment_overrides || {};
    const patch = {};
    if (overrides.weather) patch.weather = overrides.weather;
    if (Object.keys(patch).length > 0) {
      await api.updateEnvironment(campaignId, patch);
    }
    setEncounterEvent(null);

    try {
      const result = await api.startEncounter(campaignId, enc.id);
      if (result.combat_started) {
        addToast('Combat started!', 'success');
        onUpdate();
        navigate('/characters');
        return;
      }
    } catch { /* fallback */ }

    addToast(`Encounter "${enc.name}" started!`, 'warning');
    onUpdate();
    if (startCombat && enc.npcs?.length > 0) {
      const npcIds = enc.npcs.map(n => n.character_id).filter(Boolean);
      navigate('/characters', { state: { startCombat: true, encounterNpcs: npcIds, encounterName: enc.name } });
    }
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
    <>
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
        {environment.current_location_name && (
          <div className="env-bar-item">
            <span className="env-bar-label">Location</span>
            <span className="env-bar-value">{environment.current_location_name}</span>
          </div>
        )}
        {environment.environment_notes && (
          <div className="env-bar-item" style={{ flex: 1, minWidth: 0 }}>
            <span className="env-bar-label">Notes</span>
            <span className="env-bar-value" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{environment.environment_notes}</span>
          </div>
        )}
        {environment.combat_state?.active && (
          <div className="env-bar-item">
            <span className="tag" style={{ background: 'var(--red-dim)', color: 'var(--red)', borderColor: '#991b1b', fontWeight: 600, cursor: 'pointer' }}
              onClick={() => navigate('/characters')}>
              COMBAT Round {environment.combat_state.round}
            </span>
          </div>
        )}
        <div className="env-bar-item" style={{ marginLeft: 'auto' }}>
          {(campaign?.time_advance_presets || [
            { label: '+10m', hours: 0, minutes: 10 },
            { label: '+1h', hours: 1, minutes: 0 },
            { label: '+8h', hours: 8, minutes: 0 },
          ]).map((p, i) => (
            <button key={i} className="btn btn-sm btn-secondary" onClick={() => handleAdvance(p.hours, p.minutes)}>{p.label}</button>
          ))}
          <button className="btn btn-sm btn-ghost" onClick={() => setShowAdvance(!showAdvance)}>Custom</button>
          <span style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 2px' }} />
          <button className="btn btn-sm btn-secondary" onClick={async () => {
            const result = await api.rest(campaignId, 'short');
            processEvents(result.events); onUpdate(); refreshNotifCount();
          }}>Short Rest</button>
          <button className="btn btn-sm btn-secondary" onClick={async () => {
            const result = await api.rest(campaignId, 'long');
            processEvents(result.events); onUpdate(); refreshNotifCount();
          }}>Long Rest</button>
          <button className="btn btn-sm btn-ghost notification-bell" onClick={() => setShowNotifications(!showNotifications)}
            title="Notifications">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unreadCount > 0 && <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </button>
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

      {encounterEvent && (
        <EncounterTriggerModal
          event={encounterEvent}
          onStart={() => handleStartEncounter(encounterEvent.encounter)}
          onStartCombat={() => handleStartEncounter(encounterEvent.encounter, true)}
          onDismiss={() => { setEncounterEvent(null); addToast('Encounter dismissed', 'info'); }}
        />
      )}
      {showNotifications && (
        <NotificationDrawer
          campaignId={campaignId}
          onClose={() => { if (!notifPinned) setShowNotifications(false); }}
          pinned={notifPinned}
          onTogglePin={() => setNotifPinned(!notifPinned)}
        />
      )}
    </>
  );
}

function EncounterTriggerModal({ event, onStart, onStartCombat, onDismiss }) {
  const enc = event.encounter;
  return (
    <div className="modal-overlay" onClick={onDismiss}>
      <div className="modal" style={{ maxWidth: 520 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={{ color: 'var(--yellow)' }}>Random Encounter!</h3>
          <button className="btn btn-ghost btn-sm" onClick={onDismiss}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>{enc.name}</div>
          {enc.description && <p style={{ color: 'var(--text-secondary)', marginBottom: 8 }}>{enc.description}</p>}
          {enc.notes && <div style={{ marginBottom: 8, padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>{enc.notes}</div>}
          {enc.npcs?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>NPCs:</strong>
              <ul style={{ marginLeft: 16, marginTop: 2, fontSize: 13 }}>
                {enc.npcs.map((n, i) => <li key={i}>Character #{n.character_id} ({n.role || 'member'})</li>)}
              </ul>
            </div>
          )}
          {enc.loot_table?.length > 0 && (
            <div style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 12 }}>Loot:</strong>
              <ul style={{ marginLeft: 16, marginTop: 2, fontSize: 13 }}>
                {enc.loot_table.map((l, i) => (
                  <li key={i}>{l.item_name || `Item #${l.item_id}`} x{l.quantity} ({Math.round((l.drop_chance || 1) * 100)}%)</li>
                ))}
              </ul>
            </div>
          )}
          {enc.environment_overrides && Object.keys(enc.environment_overrides).length > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Environment overrides: {Object.entries(enc.environment_overrides).map(([k, v]) => `${k}: ${v}`).join(', ')}
            </div>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>
            Roll probability: {Math.round((event.probability || 0) * 100)}%
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onDismiss}>Dismiss</button>
          <button className="btn btn-primary" onClick={onStart}>Start Encounter{enc.starts_combat ? ' + Combat' : ''}</button>
          {!enc.starts_combat && enc.npcs?.length > 0 && (
            <button className="btn btn-danger" onClick={onStartCombat}>Start Combat</button>
          )}
        </div>
      </div>
    </div>
  );
}
