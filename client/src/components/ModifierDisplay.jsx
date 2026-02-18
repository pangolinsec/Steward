import React from 'react';

export function formatModifier(delta) {
  if (delta > 0) return `+${delta}`;
  return String(delta);
}

export function ModifierList({ modifiers }) {
  if (!modifiers || modifiers.length === 0) return <span className="mod-neutral">--</span>;
  return (
    <span className="inline-flex gap-sm flex-wrap">
      {modifiers.map((m, i) => (
        <span key={i} className={m.delta > 0 ? 'mod-positive' : m.delta < 0 ? 'mod-negative' : 'mod-neutral'}>
          {formatModifier(m.delta)} {m.attribute}
        </span>
      ))}
    </span>
  );
}

export function ModifierSummary({ modifiers }) {
  if (!modifiers || modifiers.length === 0) return null;
  return (
    <span className="inline-flex gap-sm flex-wrap" style={{ fontSize: 12 }}>
      {modifiers.map((m, i) => (
        <span key={i} className={m.delta > 0 ? 'mod-positive' : 'mod-negative'}>
          {formatModifier(m.delta)} {m.attribute}
        </span>
      ))}
    </span>
  );
}
