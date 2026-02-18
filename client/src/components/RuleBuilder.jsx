import React, { useState } from 'react';

const CONDITION_TYPES = [
  { value: 'attribute_gte', label: 'Attribute >=', fields: ['attribute', 'value'] },
  { value: 'attribute_lte', label: 'Attribute <=', fields: ['attribute', 'value'] },
  { value: 'attribute_eq', label: 'Attribute ==', fields: ['attribute', 'value'] },
  { value: 'has_effect', label: 'Has Effect', fields: ['effect_name'] },
  { value: 'lacks_effect', label: 'Lacks Effect', fields: ['effect_name'] },
  { value: 'has_item', label: 'Has Item', fields: ['item_name'] },
  { value: 'lacks_item', label: 'Lacks Item', fields: ['item_name'] },
  { value: 'item_quantity_lte', label: 'Item Qty <=', fields: ['item_name', 'value'] },
  { value: 'character_type', label: 'Character Type', fields: ['value'] },
  { value: 'weather_is', label: 'Weather Is', fields: ['value'] },
  { value: 'weather_in', label: 'Weather In', fields: ['values'] },
  { value: 'time_of_day_is', label: 'Time of Day', fields: ['value'] },
  { value: 'time_between', label: 'Time Between', fields: ['from_hour', 'to_hour'] },
  { value: 'location_is', label: 'At Location', fields: ['location_id'] },
  { value: 'location_property', label: 'Location Property', fields: ['property', 'value'] },
  { value: 'random_chance', label: 'Random Chance', fields: ['probability'] },
  { value: 'hours_since_last_rest', label: 'Hours Since Rest', fields: ['operator', 'hours'] },
  { value: 'season_is', label: 'Season Is', fields: ['value'] },
];

const ACTION_TYPES = [
  { value: 'apply_effect', label: 'Apply Effect', fields: ['effect_name'] },
  { value: 'remove_effect', label: 'Remove Effect', fields: ['effect_name'] },
  { value: 'modify_attribute', label: 'Modify Attribute', fields: ['attribute', 'delta'] },
  { value: 'consume_item', label: 'Consume Item', fields: ['item_name', 'quantity'] },
  { value: 'grant_item', label: 'Grant Item', fields: ['item_name', 'quantity'] },
  { value: 'set_weather', label: 'Set Weather', fields: ['weather'] },
  { value: 'set_environment_note', label: 'Set Env Note', fields: ['note'] },
  { value: 'advance_time', label: 'Advance Time', fields: ['hours', 'minutes'] },
  { value: 'notify', label: 'Notify', fields: ['message', 'severity'] },
  { value: 'log', label: 'Log Message', fields: ['message'] },
  { value: 'roll_dice', label: 'Roll Dice', fields: ['formula', 'store_as'] },
  { value: 'random_from_list', label: 'Random from List', fields: ['items', 'store_as'] },
];

export function ConditionBuilder({ value, onChange }) {
  // value = { all: [...] } or { any: [...] }
  const operator = value?.any ? 'any' : 'all';
  const conditions = value?.[operator] || [];

  const setOperator = (op) => {
    onChange({ [op]: conditions });
  };

  const addCondition = () => {
    onChange({ [operator]: [...conditions, { type: 'weather_is', value: '' }] });
  };

  const updateCondition = (index, updated) => {
    const newConds = [...conditions];
    newConds[index] = updated;
    onChange({ [operator]: newConds });
  };

  const removeCondition = (index) => {
    onChange({ [operator]: conditions.filter((_, i) => i !== index) });
  };

  return (
    <div style={{ padding: 10, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Match:</span>
        <select value={operator} onChange={e => setOperator(e.target.value)}
          style={{ width: 'auto', fontSize: 12, padding: '4px 28px 4px 8px' }}>
          <option value="all">ALL conditions</option>
          <option value="any">ANY condition</option>
        </select>
        <button className="btn btn-secondary btn-sm" onClick={addCondition} style={{ marginLeft: 'auto' }}>
          + Condition
        </button>
      </div>
      {conditions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
          No conditions (rule always passes)
        </div>
      )}
      {conditions.map((cond, i) => (
        <ConditionRow key={i} condition={cond}
          onChange={updated => updateCondition(i, updated)}
          onRemove={() => removeCondition(i)} />
      ))}
    </div>
  );
}

function ConditionRow({ condition, onChange, onRemove }) {
  const typeDef = CONDITION_TYPES.find(t => t.value === condition.type);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <select value={condition.type} onChange={e => onChange({ type: e.target.value })}
        style={{ width: 140, fontSize: 11, padding: '4px 28px 4px 6px' }}>
        {CONDITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
        {(typeDef?.fields || []).map(field => (
          <input key={field} type={['value', 'probability', 'hours', 'from_hour', 'to_hour', 'location_id', 'delta'].includes(field) ? 'number' : 'text'}
            value={field === 'values' ? (condition[field] || []).join(', ') : (condition[field] ?? '')}
            onChange={e => {
              const val = field === 'values' ? e.target.value.split(',').map(s => s.trim()) :
                e.target.type === 'number' ? Number(e.target.value) : e.target.value;
              onChange({ ...condition, [field]: val });
            }}
            placeholder={field}
            style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 6px' }}
            step={field === 'probability' ? '0.1' : undefined} />
        ))}
      </div>
      <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={onRemove}>&#x2715;</button>
    </div>
  );
}

export function ActionBuilder({ value, onChange }) {
  const actions = value || [];

  const addAction = () => {
    onChange([...actions, { type: 'notify', message: '' }]);
  };

  const updateAction = (index, updated) => {
    const newActions = [...actions];
    newActions[index] = updated;
    onChange(newActions);
  };

  const removeAction = (index) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const moveAction = (index, direction) => {
    const newActions = [...actions];
    const target = index + direction;
    if (target < 0 || target >= newActions.length) return;
    [newActions[index], newActions[target]] = [newActions[target], newActions[index]];
    onChange(newActions);
  };

  return (
    <div style={{ padding: 10, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Actions (executed in order)</span>
        <button className="btn btn-secondary btn-sm" onClick={addAction}>+ Action</button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
        Variables: {'{character.name}'}, {'{character.<attr>}'}, {'{environment.weather}'}, {'{var.<name>}'}
      </div>
      {actions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>No actions</div>
      )}
      {actions.map((action, i) => (
        <ActionRow key={i} action={action} index={i} total={actions.length}
          onChange={updated => updateAction(i, updated)}
          onRemove={() => removeAction(i)}
          onMove={dir => moveAction(i, dir)} />
      ))}
    </div>
  );
}

function ActionRow({ action, index, total, onChange, onRemove, onMove }) {
  const typeDef = ACTION_TYPES.find(t => t.value === action.type);

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 9, lineHeight: 1 }}
          onClick={() => onMove(-1)} disabled={index === 0}>&uarr;</button>
        <button className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 9, lineHeight: 1 }}
          onClick={() => onMove(1)} disabled={index === total - 1}>&darr;</button>
      </div>
      <select value={action.type} onChange={e => onChange({ type: e.target.value })}
        style={{ width: 130, fontSize: 11, padding: '4px 28px 4px 6px' }}>
        {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap' }}>
        {(typeDef?.fields || []).filter(f => f !== 'items').map(field => (
          <input key={field}
            type={['delta', 'quantity', 'hours', 'minutes'].includes(field) ? 'number' : 'text'}
            value={action[field] ?? ''}
            onChange={e => {
              const val = e.target.type === 'number' ? Number(e.target.value) : e.target.value;
              onChange({ ...action, [field]: val });
            }}
            placeholder={field}
            style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 6px' }} />
        ))}
      </div>
      <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={onRemove}>&#x2715;</button>
    </div>
  );
}
