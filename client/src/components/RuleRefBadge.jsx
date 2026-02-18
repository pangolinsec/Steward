import React, { useState, useEffect } from 'react';
import * as api from '../api';

export default function RuleRefBadge({ campaignId, entityType, entityName, entityId }) {
  const [refs, setRefs] = useState(null);
  const [showPopover, setShowPopover] = useState(false);

  useEffect(() => {
    if (!campaignId) return;
    api.getRuleReferences(campaignId, entityType, entityName, entityId).then(setRefs);
  }, [campaignId, entityType, entityName, entityId]);

  if (!refs || refs.length === 0) return null;

  return (
    <span className="rule-ref-badge" onClick={(e) => { e.stopPropagation(); setShowPopover(!showPopover); }}>
      &#x2699; {refs.length}
      {showPopover && (
        <div className="rule-ref-popover" onClick={e => e.stopPropagation()}>
          {refs.map(r => (
            <div key={r.rule_id} style={{ marginBottom: 4, opacity: r.enabled === false ? 0.5 : 1 }}>
              <strong>{r.rule_name}</strong>{r.enabled === false && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>(disabled)</span>}: {r.references.map(ref => ref.detail).join(', ')}
            </div>
          ))}
        </div>
      )}
    </span>
  );
}
