import React, { useState } from 'react';
import * as api from '../api';
import { useToast } from './ToastContext';

export default function EnvironmentBar({ environment, campaignId, onUpdate, campaign }) {
  const [showAdvance, setShowAdvance] = useState(false);
  const [advHours, setAdvHours] = useState(0);
  const [advMinutes, setAdvMinutes] = useState(0);
  const [encounterEvent, setEncounterEvent] = useState(null);
  const { addToast } = useToast();

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
      }
    }
  };

  const handleAdvance = async (hours, minutes) => {
    const result = await api.advanceTime(campaignId, { hours, minutes });
    processEvents(result.events);
    onUpdate();
    setShowAdvance(false);
    setAdvHours(0);
    setAdvMinutes(0);
  };

  const handleStartEncounter = async (enc) => {
    const overrides = enc.environment_overrides || {};
    const patch = {};
    if (overrides.weather) patch.weather = overrides.weather;
    if (Object.keys(patch).length > 0) {
      await api.updateEnvironment(campaignId, patch);
    }
    addToast(`Encounter "${enc.name}" started!`, 'warning');
    setEncounterEvent(null);
    onUpdate();
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

      {encounterEvent && (
        <EncounterTriggerModal
          event={encounterEvent}
          onStart={() => handleStartEncounter(encounterEvent.encounter)}
          onDismiss={() => { setEncounterEvent(null); addToast('Encounter dismissed', 'info'); }}
        />
      )}
    </>
  );
}

function EncounterTriggerModal({ event, onStart, onDismiss }) {
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
          <button className="btn btn-primary" onClick={onStart}>Start Encounter</button>
        </div>
      </div>
    </div>
  );
}
