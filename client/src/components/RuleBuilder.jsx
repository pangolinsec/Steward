import React, { useState, useRef } from 'react';

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
  { value: 'trait_equals', label: 'Trait Equals', fields: ['trait', 'value'] },
  { value: 'trait_in', label: 'Trait In', fields: ['trait', 'values'] },
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

function ensureIds(items) {
  return items.map(item => item._id ? item : { ...item, _id: crypto.randomUUID() });
}

export function stripIds(data) {
  if (Array.isArray(data)) {
    return data.map(item => {
      const { _id, ...rest } = item;
      return rest;
    });
  }
  if (data && typeof data === 'object') {
    const result = {};
    for (const [key, val] of Object.entries(data)) {
      if (key === '_id') continue;
      if (Array.isArray(val)) result[key] = stripIds(val);
      else result[key] = val;
    }
    return result;
  }
  return data;
}

// Reusable select with optional "Custom..." escape hatch
function FieldSelect({ value, onChange, options, allowCustom, placeholder }) {
  const [customMode, setCustomMode] = useState(false);
  const isCustomValue = allowCustom && value && !options.some(o =>
    (typeof o === 'object' ? o.value : o) === value
  );

  if (!allowCustom) {
    return (
      <select
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 28px 4px 6px' }}
      >
        <option value="">{placeholder || 'Select...'}</option>
        {options.map(o => {
          const val = typeof o === 'object' ? o.value : o;
          const label = typeof o === 'object' ? o.label : o;
          return <option key={val} value={val}>{label}</option>;
        })}
      </select>
    );
  }

  if (customMode || isCustomValue) {
    return (
      <span style={{ display: 'inline-flex', flex: 1, minWidth: 60, gap: 2, alignItems: 'center' }}>
        <input
          type="text"
          value={value ?? ''}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || 'Custom value'}
          style={{ flex: 1, minWidth: 40, fontSize: 11, padding: '4px 6px' }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 4px', fontSize: 9, whiteSpace: 'nowrap' }}
          onClick={() => { setCustomMode(false); }}
          title="Switch to dropdown"
        >&laquo;</button>
      </span>
    );
  }

  return (
    <select
      value={value ?? ''}
      onChange={e => {
        if (e.target.value === '__custom__') {
          setCustomMode(true);
        } else {
          onChange(e.target.value);
        }
      }}
      style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 28px 4px 6px' }}
    >
      <option value="">{placeholder || 'Select...'}</option>
      {options.map(o => {
        const val = typeof o === 'object' ? o.value : o;
        const label = typeof o === 'object' ? o.label : o;
        return <option key={val} value={val}>{label}</option>;
      })}
      <option value="__custom__">Custom...</option>
    </select>
  );
}

// Checkbox multi-select for weather_in with escape hatch
function MultiCheckboxSelect({ values, onChange, options, allowCustom }) {
  const [customMode, setCustomMode] = useState(false);
  const arr = values || [];

  if (customMode) {
    return (
      <span style={{ display: 'inline-flex', flex: 1, minWidth: 60, gap: 2, alignItems: 'center' }}>
        <input
          type="text"
          value={arr.join(', ')}
          onChange={e => onChange(e.target.value.split(',').map(s => s.trim()))}
          placeholder="value1, value2"
          style={{ flex: 1, minWidth: 40, fontSize: 11, padding: '4px 6px' }}
        />
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '2px 4px', fontSize: 9 }}
          onClick={() => setCustomMode(false)}
          title="Switch to checkboxes"
        >&laquo;</button>
      </span>
    );
  }

  return (
    <span style={{ display: 'inline-flex', flex: 1, minWidth: 60, gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
      {options.map(opt => (
        <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 10, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={arr.includes(opt)}
            onChange={e => {
              if (e.target.checked) onChange([...arr, opt]);
              else onChange(arr.filter(v => v !== opt));
            }}
            style={{ width: 12, height: 12 }}
          />
          {opt}
        </label>
      ))}
      {allowCustom && (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ padding: '1px 4px', fontSize: 9 }}
          onClick={() => setCustomMode(true)}
          title="Free text entry"
        >...</button>
      )}
    </span>
  );
}

export function ConditionBuilder({ value, onChange, entityLists, campaign }) {
  // value = { all: [...] } or { any: [...] }
  const operator = value?.any ? 'any' : 'all';
  const conditions = ensureIds(value?.[operator] || []);
  const containerRef = useRef(null);

  const setOperator = (op) => {
    onChange({ [op]: conditions });
  };

  const addCondition = () => {
    const newConds = [...conditions, { _id: crypto.randomUUID(), type: 'weather_is', value: '' }];
    onChange({ [operator]: newConds });
    requestAnimationFrame(() => {
      containerRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const updateCondition = (index, updated) => {
    const newConds = [...conditions];
    newConds[index] = { ...updated, _id: conditions[index]._id };
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
        <button type="button" className="btn btn-secondary btn-sm" onClick={addCondition} style={{ marginLeft: 'auto' }}>
          + Condition
        </button>
      </div>
      {conditions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>
          No conditions (rule always passes)
        </div>
      )}
      <div ref={containerRef}>
        {conditions.map((cond, i) => (
          <ConditionRow key={cond._id} condition={cond}
            onChange={updated => updateCondition(i, updated)}
            onRemove={() => removeCondition(i)}
            entityLists={entityLists}
            campaign={campaign} />
        ))}
      </div>
    </div>
  );
}

function ConditionRow({ condition, onChange, onRemove, entityLists, campaign }) {
  const typeDef = CONDITION_TYPES.find(t => t.value === condition.type);
  const registry = (campaign?.property_key_registry || []).map(r => typeof r === 'string' ? { key: r, values: [] } : r);
  const registryKeys = registry.map(r => r.key);

  const getWarning = (field) => {
    if (!entityLists) return null;
    const val = condition[field];
    if (!val) return null;
    if (field === 'effect_name' && !entityLists.effects.includes(val)) {
      return 'This effect does not exist in the campaign';
    }
    if (field === 'item_name' && !entityLists.items.includes(val)) {
      return 'This item does not exist in the campaign';
    }
    return null;
  };

  const renderField = (field) => {
    const warning = getWarning(field);
    const condType = condition.type;

    let fieldElement;

    // effect_name fields
    if (field === 'effect_name') {
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={entityLists?.effects || []}
          allowCustom
          placeholder="effect_name"
        />
      );
    }
    // item_name fields
    else if (field === 'item_name') {
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={entityLists?.items || []}
          allowCustom
          placeholder="item_name"
        />
      );
    }
    // attribute field
    else if (field === 'attribute') {
      const attrOptions = (campaign?.attribute_definitions || []).map(a => ({ value: a.key, label: a.label }));
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={attrOptions}
          allowCustom
          placeholder="attribute"
        />
      );
    }
    // trait field for trait_equals / trait_in
    else if (field === 'trait') {
      const tagAttrs = (campaign?.attribute_definitions || [])
        .filter(a => a.type === 'tag')
        .map(a => ({ value: a.key, label: a.label }));
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={tagAttrs}
          allowCustom
          placeholder="trait"
        />
      );
    }
    // trait_equals value — populate from trait's options
    else if (field === 'value' && condType === 'trait_equals') {
      const traitDef = (campaign?.attribute_definitions || []).find(a => a.key === condition.trait);
      const opts = traitDef?.options || [];
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={opts}
          allowCustom
          placeholder="value"
        />
      );
    }
    // trait_in values — multi-select from trait's options
    else if (field === 'values' && condType === 'trait_in') {
      const traitDef = (campaign?.attribute_definitions || []).find(a => a.key === condition.trait);
      const opts = traitDef?.options || [];
      fieldElement = (
        <MultiCheckboxSelect
          values={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={opts}
          allowCustom
        />
      );
    }
    // weather_is value
    else if (field === 'value' && condType === 'weather_is') {
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={campaign?.weather_options || []}
          allowCustom
          placeholder="weather"
        />
      );
    }
    // weather_in values
    else if (field === 'values' && condType === 'weather_in') {
      fieldElement = (
        <MultiCheckboxSelect
          values={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={campaign?.weather_options || []}
          allowCustom
        />
      );
    }
    // time_of_day_is value
    else if (field === 'value' && condType === 'time_of_day_is') {
      const labels = [...new Set((campaign?.time_of_day_thresholds || []).map(t => t.label))];
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={labels}
          allowCustom={false}
          placeholder="time of day"
        />
      );
    }
    // season_is value
    else if (field === 'value' && condType === 'season_is') {
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={campaign?.season_options || []}
          allowCustom
          placeholder="season"
        />
      );
    }
    // character_type value
    else if (field === 'value' && condType === 'character_type') {
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={['PC', 'NPC']}
          allowCustom={false}
          placeholder="type"
        />
      );
    }
    // operator for hours_since_last_rest
    else if (field === 'operator' && condType === 'hours_since_last_rest') {
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={[
            { value: 'gte', label: '>=' },
            { value: 'lte', label: '<=' },
            { value: 'eq', label: '==' },
          ]}
          allowCustom={false}
          placeholder="operator"
        />
      );
    }
    // location_id for location_is
    else if (field === 'location_id' && condType === 'location_is') {
      const locOptions = (entityLists?.locations || []).map(l => ({ value: l.id, label: l.name }));
      fieldElement = (
        <FieldSelect
          value={condition[field]?.toString()}
          onChange={v => onChange({ ...condition, [field]: Number(v) })}
          options={locOptions}
          allowCustom={false}
          placeholder="location"
        />
      );
    }
    // location_property: property key
    else if (field === 'property' && condType === 'location_property') {
      fieldElement = (
        <FieldSelect
          value={condition[field]}
          onChange={v => onChange({ ...condition, [field]: v })}
          options={registryKeys}
          allowCustom
          placeholder="property"
        />
      );
    }
    // location_property: value field
    else if (field === 'value' && condType === 'location_property') {
      const selectedKey = condition.property;
      const registryEntry = registry.find(r => r.key === selectedKey);
      const valOptions = registryEntry?.values || [];
      if (valOptions.length > 0) {
        fieldElement = (
          <FieldSelect
            value={condition[field]}
            onChange={v => onChange({ ...condition, [field]: v })}
            options={valOptions}
            allowCustom
            placeholder="value"
          />
        );
      } else {
        fieldElement = (
          <input
            type="text"
            value={condition[field] ?? ''}
            onChange={e => onChange({ ...condition, [field]: e.target.value })}
            placeholder="value"
            style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 6px' }}
          />
        );
      }
    }
    // Number fields
    else if (['value', 'probability', 'hours', 'from_hour', 'to_hour'].includes(field)) {
      fieldElement = (
        <input
          type="number"
          value={condition[field] ?? ''}
          onChange={e => onChange({ ...condition, [field]: Number(e.target.value) })}
          placeholder={field}
          style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 6px' }}
          step={field === 'probability' ? '0.1' : undefined}
        />
      );
    }
    // Default text input
    else {
      fieldElement = (
        <input
          type="text"
          value={condition[field] ?? ''}
          onChange={e => onChange({ ...condition, [field]: e.target.value })}
          placeholder={field}
          style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 6px' }}
        />
      );
    }

    return (
      <span key={field} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 60 }}>
        {fieldElement}
        {warning && (
          <span style={{ color: 'var(--yellow)', fontSize: 13, cursor: 'help', flexShrink: 0 }} title={warning}>&#x26A0;</span>
        )}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <select value={condition.type} onChange={e => onChange({ type: e.target.value })}
        style={{ width: 140, fontSize: 11, padding: '4px 28px 4px 6px' }}>
        {CONDITION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {(typeDef?.fields || []).map(renderField)}
      </div>
      <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={onRemove}>&#x2715;</button>
    </div>
  );
}

export function ActionBuilder({ value, onChange, entityLists, campaign }) {
  const actions = ensureIds(value || []);
  const containerRef = useRef(null);

  const addAction = () => {
    const newActions = [...actions, { _id: crypto.randomUUID(), type: 'notify', message: '' }];
    onChange(newActions);
    requestAnimationFrame(() => {
      containerRef.current?.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const updateAction = (index, updated) => {
    const newActions = [...actions];
    newActions[index] = { ...updated, _id: actions[index]._id };
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
        <button type="button" className="btn btn-secondary btn-sm" onClick={addAction}>+ Action</button>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>
        Variables: {'{character.name}'}, {'{character.<attr>}'}, {'{environment.weather}'}, {'{var.<name>}'}
      </div>
      {actions.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 8 }}>No actions</div>
      )}
      <div ref={containerRef}>
        {actions.map((action, i) => (
          <ActionRow key={action._id} action={action} index={i} total={actions.length}
            onChange={updated => updateAction(i, updated)}
            onRemove={() => removeAction(i)}
            onMove={dir => moveAction(i, dir)}
            entityLists={entityLists}
            campaign={campaign} />
        ))}
      </div>
    </div>
  );
}

function ActionRow({ action, index, total, onChange, onRemove, onMove, entityLists, campaign }) {
  const typeDef = ACTION_TYPES.find(t => t.value === action.type);

  const getWarning = (field) => {
    if (!entityLists) return null;
    const val = action[field];
    if (!val) return null;
    if (field === 'effect_name' && !entityLists.effects.includes(val)) {
      return 'This effect does not exist in the campaign';
    }
    if (field === 'item_name' && !entityLists.items.includes(val)) {
      return 'This item does not exist in the campaign';
    }
    if (field === 'weather' && campaign?.weather_options && !campaign.weather_options.includes(val)) {
      return 'This weather type does not exist in the campaign';
    }
    return null;
  };

  const renderField = (field) => {
    const warning = getWarning(field);
    let fieldElement;

    if (field === 'effect_name') {
      fieldElement = (
        <FieldSelect
          value={action[field]}
          onChange={v => onChange({ ...action, [field]: v })}
          options={entityLists?.effects || []}
          allowCustom
          placeholder="effect_name"
        />
      );
    } else if (field === 'item_name') {
      fieldElement = (
        <FieldSelect
          value={action[field]}
          onChange={v => onChange({ ...action, [field]: v })}
          options={entityLists?.items || []}
          allowCustom
          placeholder="item_name"
        />
      );
    } else if (field === 'weather') {
      fieldElement = (
        <FieldSelect
          value={action[field]}
          onChange={v => onChange({ ...action, [field]: v })}
          options={campaign?.weather_options || []}
          allowCustom
          placeholder="weather"
        />
      );
    } else if (field === 'attribute') {
      const attrOptions = (campaign?.attribute_definitions || []).map(a => ({ value: a.key, label: a.label }));
      fieldElement = (
        <FieldSelect
          value={action[field]}
          onChange={v => onChange({ ...action, [field]: v })}
          options={attrOptions}
          allowCustom
          placeholder="attribute"
        />
      );
    } else if (field === 'severity') {
      fieldElement = (
        <FieldSelect
          value={action[field]}
          onChange={v => onChange({ ...action, [field]: v })}
          options={['info', 'warning', 'error']}
          allowCustom={false}
          placeholder="severity"
        />
      );
    } else if (['delta', 'quantity', 'hours', 'minutes'].includes(field)) {
      fieldElement = (
        <input
          type="number"
          value={action[field] ?? ''}
          onChange={e => onChange({ ...action, [field]: Number(e.target.value) })}
          placeholder={field}
          style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 6px' }}
        />
      );
    } else {
      fieldElement = (
        <input
          type="text"
          value={action[field] ?? ''}
          onChange={e => onChange({ ...action, [field]: e.target.value })}
          placeholder={field}
          style={{ flex: 1, minWidth: 60, fontSize: 11, padding: '4px 6px' }}
        />
      );
    }

    return (
      <span key={field} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 60 }}>
        {fieldElement}
        {warning && (
          <span style={{ color: 'var(--yellow)', fontSize: 13, cursor: 'help', flexShrink: 0 }} title={warning}>&#x26A0;</span>
        )}
      </span>
    );
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <button type="button" className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 9, lineHeight: 1 }}
          onClick={() => onMove(-1)} disabled={index === 0}>&uarr;</button>
        <button type="button" className="btn btn-ghost" style={{ padding: '0 4px', fontSize: 9, lineHeight: 1 }}
          onClick={() => onMove(1)} disabled={index === total - 1}>&darr;</button>
      </div>
      <select value={action.type} onChange={e => onChange({ type: e.target.value })}
        style={{ width: 130, fontSize: 11, padding: '4px 28px 4px 6px' }}>
        {ACTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <div style={{ display: 'flex', gap: 4, flex: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {(typeDef?.fields || []).filter(f => f !== 'items').map(renderField)}
      </div>
      <button type="button" className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }} onClick={onRemove}>&#x2715;</button>
    </div>
  );
}
