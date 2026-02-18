import React, { useState } from 'react';

// Normalize registry entries: supports both old string[] format and new {key, values}[] format
function normalizeRegistry(registry) {
  if (!Array.isArray(registry)) return [];
  return registry.map(entry =>
    typeof entry === 'string' ? { key: entry, values: [] } : entry
  );
}

export default function PropertyEditor({ properties, onChange, registry }) {
  const normalized = normalizeRegistry(registry);
  const entries = Object.entries(properties || {});

  // Track which rows are in "custom" mode for key or value
  const [customKeyRows, setCustomKeyRows] = useState(new Set());
  const [customValueRows, setCustomValueRows] = useState(new Set());

  // All known keys: registry keys + any keys already in use
  const allKeys = [...new Set([
    ...normalized.map(r => r.key),
    ...entries.map(([k]) => k),
  ])].filter(Boolean);

  // Get values for a given key from the registry
  const getValuesForKey = (key) => {
    const entry = normalized.find(r => r.key === key);
    return entry?.values || [];
  };

  const updateKey = (oldKey, newKey) => {
    const newProps = {};
    for (const [k, v] of entries) {
      newProps[k === oldKey ? newKey : k] = v;
    }
    onChange(newProps);
  };

  const updateValue = (key, value) => {
    onChange({ ...properties, [key]: value });
  };

  const removeEntry = (key) => {
    const newProps = { ...properties };
    delete newProps[key];
    onChange(newProps);
  };

  const addEntry = () => {
    // Find first registry key not already in use
    const usedKeys = new Set(entries.map(([k]) => k));
    const availableKey = normalized.find(r => !usedKeys.has(r.key))?.key || '';
    onChange({ ...properties, [availableKey]: '' });
  };

  const toggleCustomKey = (index) => {
    setCustomKeyRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  const toggleCustomValue = (index) => {
    setCustomValueRows(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, value], i) => {
        const knownValues = getValuesForKey(key);
        const isCustomKey = customKeyRows.has(i) || !allKeys.includes(key);
        const isCustomValue = customValueRows.has(i) || (knownValues.length > 0 && !knownValues.includes(value) && value !== '');

        return (
          <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Key selector */}
            {isCustomKey ? (
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', width: 130 }}>
                <input
                  type="text"
                  value={key}
                  onChange={e => updateKey(key, e.target.value)}
                  placeholder="custom key"
                  style={{ flex: 1, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                />
                {allKeys.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 4px', fontSize: 9 }}
                    onClick={() => toggleCustomKey(i)}
                    title="Switch to dropdown"
                  >&darr;</button>
                )}
              </div>
            ) : (
              <select
                value={key}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    toggleCustomKey(i);
                    return;
                  }
                  const newKey = e.target.value;
                  const newVals = getValuesForKey(newKey);
                  // Build new props with key renamed, reset value if needed
                  const newProps = {};
                  for (const [k, v] of entries) {
                    if (k === key) {
                      const resetValue = (newVals.length > 0 && !newVals.includes(v)) ? (newVals[0] || '') : v;
                      newProps[newKey] = resetValue;
                    } else {
                      newProps[k] = v;
                    }
                  }
                  onChange(newProps);
                }}
                style={{ width: 130, fontSize: 12, fontFamily: 'var(--font-mono)' }}
              >
                {!key && <option value="">-- select key --</option>}
                {allKeys.map(k => <option key={k} value={k}>{k}</option>)}
                <option value="__custom__">Custom key...</option>
              </select>
            )}

            {/* Value selector */}
            {knownValues.length > 0 && !isCustomValue ? (
              <select
                value={value}
                onChange={e => {
                  if (e.target.value === '__custom__') {
                    toggleCustomValue(i);
                    return;
                  }
                  updateValue(key, e.target.value);
                }}
                style={{ flex: 1, fontSize: 12 }}
              >
                {!value && <option value="">-- select value --</option>}
                {knownValues.map(v => <option key={v} value={v}>{v}</option>)}
                <option value="__custom__">Custom value...</option>
              </select>
            ) : (
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', flex: 1 }}>
                <input
                  type="text"
                  value={value}
                  onChange={e => updateValue(key, e.target.value)}
                  placeholder="value"
                  style={{ flex: 1, fontSize: 12 }}
                />
                {knownValues.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ padding: '2px 4px', fontSize: 9 }}
                    onClick={() => toggleCustomValue(i)}
                    title="Switch to dropdown"
                  >&darr;</button>
                )}
              </div>
            )}

            <button
              type="button"
              className="btn btn-danger btn-sm"
              style={{ padding: '2px 6px', fontSize: 10 }}
              onClick={() => removeEntry(key)}
            >&#x2715;</button>
          </div>
        );
      })}
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={addEntry}
        style={{ alignSelf: 'flex-start' }}
      >+ Add Property</button>
    </div>
  );
}

// Utility: collect new keys/values from properties that aren't in the registry yet
export function getNewRegistryEntries(properties, registry) {
  const normalized = normalizeRegistry(registry);
  const newEntries = [];

  for (const [key, value] of Object.entries(properties || {})) {
    if (!key.trim()) continue;
    const existing = normalized.find(r => r.key === key);
    if (!existing) {
      // Entirely new key
      newEntries.push({ key, values: value ? [value] : [] });
    } else if (value && !existing.values.includes(value)) {
      // Known key, new value
      newEntries.push({ key, values: [value] });
    }
  }

  return newEntries;
}

// Utility: merge new entries into existing registry
export function mergeRegistryEntries(registry, newEntries) {
  const normalized = normalizeRegistry(registry);
  const result = normalized.map(r => ({ ...r, values: [...r.values] }));

  for (const entry of newEntries) {
    const existing = result.find(r => r.key === entry.key);
    if (existing) {
      for (const v of entry.values) {
        if (!existing.values.includes(v)) existing.values.push(v);
      }
    } else {
      result.push({ key: entry.key, values: [...entry.values] });
    }
  }

  return result;
}
