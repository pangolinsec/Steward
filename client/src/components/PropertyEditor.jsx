import React from 'react';

export default function PropertyEditor({ properties, onChange, registry }) {
  const entries = Object.entries(properties || {});
  // Include any existing keys not in the registry
  const allKeys = [...new Set([...(registry || []), ...entries.map(([k]) => k)])];

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
    const key = '';
    onChange({ ...properties, [key]: '' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {entries.map(([key, value], i) => (
        <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="text"
            list="prop-registry-list"
            value={key}
            onChange={e => updateKey(key, e.target.value)}
            placeholder="key"
            style={{ width: 120, fontSize: 12, fontFamily: 'var(--font-mono)' }}
          />
          <input
            type="text"
            value={value}
            onChange={e => updateValue(key, e.target.value)}
            placeholder="value"
            style={{ flex: 1, fontSize: 12 }}
          />
          <button className="btn btn-danger btn-sm" style={{ padding: '2px 6px', fontSize: 10 }}
            onClick={() => removeEntry(key)}>&#x2715;</button>
        </div>
      ))}
      <datalist id="prop-registry-list">
        {(registry || []).map(k => <option key={k} value={k} />)}
      </datalist>
      <button className="btn btn-secondary btn-sm" onClick={addEntry} style={{ alignSelf: 'flex-start' }}>
        + Add Property
      </button>
    </div>
  );
}
