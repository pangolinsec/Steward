import React, { useState, useEffect } from 'react';
import * as api from '../api';

const DICE = [
  { sides: 4, label: 'd4' },
  { sides: 6, label: 'd6' },
  { sides: 8, label: 'd8' },
  { sides: 10, label: 'd10' },
  { sides: 12, label: 'd12' },
  { sides: 20, label: 'd20' },
  { sides: 100, label: 'd100' },
];

export default function DiceRoller({ campaignId, campaign }) {
  const [expanded, setExpanded] = useState(false);
  const [quantities, setQuantities] = useState({});
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [tables, setTables] = useState([]);
  const [tableResults, setTableResults] = useState({});

  useEffect(() => {
    if (expanded && campaignId) {
      api.getRandomTables(campaignId).then(setTables).catch(() => {});
    }
  }, [expanded, campaignId]);

  const getQty = (sides) => quantities[sides] || 0;

  const setQty = (sides, val) => {
    setQuantities({ ...quantities, [sides]: Math.max(0, val) });
  };

  const hasAny = DICE.some(d => getQty(d.sides) > 0);

  const roll = async () => {
    const rolls = [];
    let total = 0;
    for (const d of DICE) {
      const qty = getQty(d.sides);
      if (qty > 0) {
        const dieRolls = [];
        for (let i = 0; i < qty; i++) {
          const val = Math.floor(Math.random() * d.sides) + 1;
          dieRolls.push(val);
          total += val;
        }
        rolls.push({ label: d.label, sides: d.sides, values: dieRolls });
      }
    }

    const newResult = { total, rolls, timestamp: Date.now() };
    setResult(newResult);
    setHistory(prev => [newResult, ...prev].slice(0, 3));

    if (campaign?.dice_settings?.log_rolls && campaignId) {
      const desc = rolls.map(r => `${r.values.length}${r.label}(${r.values.join(',')})`).join(' + ');
      try {
        await api.addLogEntry(campaignId, {
          entry_type: 'dice_roll',
          message: `Rolled ${desc} = ${total}`,
        });
      } catch { /* ignore logging failures */ }
    }
  };

  return (
    <div className="dice-roller">
      <div className="dice-roller-header" onClick={() => setExpanded(!expanded)}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <circle cx="8" cy="8" r="1.5" fill="currentColor" />
          <circle cx="16" cy="8" r="1.5" fill="currentColor" />
          <circle cx="8" cy="16" r="1.5" fill="currentColor" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="currentColor" />
        </svg>
        <span>Dice Roller</span>
        <span style={{ marginLeft: 'auto', fontSize: 10 }}>{expanded ? '\u25BC' : '\u25B2'}</span>
      </div>
      {expanded && (
        <div className="dice-roller-body">
          {DICE.map(d => (
            <div key={d.sides} className="dice-row">
              <span className="dice-label">{d.label}</span>
              <button className="dice-qty-btn" onClick={() => setQty(d.sides, getQty(d.sides) - 1)}>-</button>
              <span className="dice-qty">{getQty(d.sides)}</span>
              <button className="dice-qty-btn" onClick={() => setQty(d.sides, getQty(d.sides) + 1)}>+</button>
            </div>
          ))}
          <button className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: 6 }} disabled={!hasAny} onClick={roll}>
            Roll
          </button>
          {result && (
            <div className="dice-result">
              <div className="dice-result-total">{result.total}</div>
              <div className="dice-result-breakdown">
                {result.rolls.map((r, i) => (
                  <span key={i}>{r.values.length}{r.label}: [{r.values.join(', ')}]</span>
                ))}
              </div>
            </div>
          )}
          {history.length > 1 && (
            <div className="dice-history">
              {history.slice(1).map((h, i) => (
                <div key={i} className="dice-history-item">
                  <span>{h.rolls.map(r => `${r.values.length}${r.label}`).join('+')}</span>
                  <span style={{ fontWeight: 600 }}>{h.total}</span>
                </div>
              ))}
            </div>
          )}
          {tables.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 8, paddingTop: 8 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>Tables</div>
              {tables.map(t => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 11 }}>
                  <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.name}</span>
                  {tableResults[t.id] && <span style={{ color: 'var(--accent)', fontSize: 10, marginRight: 4, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tableResults[t.id]}</span>}
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 9, padding: '1px 6px' }}
                    onClick={async () => {
                      const res = await api.rollRandomTable(campaignId, t.id);
                      setTableResults(prev => ({ ...prev, [t.id]: res.result }));
                    }}>Roll</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
