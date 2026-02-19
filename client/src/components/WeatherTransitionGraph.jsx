import React, { useState, useRef, useEffect, useCallback } from 'react';

const COL_WIDTH = 130;
const NODE_HEIGHT = 32;
const NODE_GAP = 6;

const WIRING_MODES = [
  { key: 'bidirectional', label: 'Both', symbol: '\u21C4', color: 'var(--accent)' },
  { key: 'oneway', label: 'One-way', symbol: '\u2192', color: 'var(--yellow, #e8a817)' },
  { key: 'remove', label: 'Remove', symbol: '\u2715', color: 'var(--red, #e84040)' },
];

export default function WeatherTransitionGraph({ weatherOptions, transitionTable, onSetTransitionTable }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [wiringMode, setWiringMode] = useState('bidirectional');
  const [hoveredTarget, setHoveredTarget] = useState(null);
  const [hoveredConn, setHoveredConn] = useState(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const [collapsed, setCollapsed] = useState(false);
  const containerRef = useRef(null);

  const isWiring = selectedNode !== null;

  // Clear selection if selected weather is removed
  useEffect(() => {
    if (selectedNode && !weatherOptions.includes(selectedNode.weather)) {
      setSelectedNode(null);
      setHoveredTarget(null);
    }
  }, [weatherOptions, selectedNode]);

  // Measure container width
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Derive connections from transition table
  const connections = [];
  const seen = new Set();
  for (let i = 0; i < weatherOptions.length; i++) {
    for (let j = i + 1; j < weatherOptions.length; j++) {
      const a = weatherOptions[i], b = weatherOptions[j];
      const ab = (transitionTable[a] && transitionTable[a][b] || 0) > 0;
      const ba = (transitionTable[b] && transitionTable[b][a] || 0) > 0;
      if (ab || ba) {
        const key = a + '|' + b;
        if (!seen.has(key)) {
          seen.add(key);
          connections.push({ a, b, ab, ba });
        }
      }
    }
  }

  // Node y positions
  const nodeY = (index) => index * (NODE_HEIGHT + NODE_GAP);
  const nodeCenterY = (index) => nodeY(index) + NODE_HEIGHT / 2;
  const totalHeight = weatherOptions.length * (NODE_HEIGHT + NODE_GAP) - NODE_GAP;

  // Port staggering
  const getPortOffsets = useCallback(() => {
    const leftPorts = {};
    const rightPorts = {};
    for (const w of weatherOptions) {
      leftPorts[w] = [];
      rightPorts[w] = [];
    }
    for (const conn of connections) {
      leftPorts[conn.a].push(conn.b);
      rightPorts[conn.b].push(conn.a);
      leftPorts[conn.b].push(conn.a);
      rightPorts[conn.a].push(conn.b);
    }
    for (const w of weatherOptions) {
      leftPorts[w].sort((a, b) => weatherOptions.indexOf(a) - weatherOptions.indexOf(b));
      rightPorts[w].sort((a, b) => weatherOptions.indexOf(a) - weatherOptions.indexOf(b));
    }
    return { leftPorts, rightPorts };
  }, [weatherOptions, connections]);

  const getPortY = (weather, peer, side) => {
    const { leftPorts, rightPorts } = getPortOffsets();
    const ports = side === 'left' ? leftPorts[weather] : rightPorts[weather];
    const idx = ports.indexOf(peer);
    const count = ports.length;
    if (count <= 1) return nodeCenterY(weatherOptions.indexOf(weather));
    const maxSpread = NODE_HEIGHT * 0.6;
    const spacing = Math.min(maxSpread / (count - 1), 8);
    const totalSpan = spacing * (count - 1);
    const startY = nodeCenterY(weatherOptions.indexOf(weather)) - totalSpan / 2;
    return startY + idx * spacing;
  };

  const leftX = COL_WIDTH;
  const rightX = containerWidth - COL_WIDTH;

  const makePath = (fromWeather, toWeather) => {
    const y1 = getPortY(fromWeather, toWeather, 'left');
    const y2 = getPortY(toWeather, fromWeather, 'right');
    const midX = (leftX + rightX) / 2;
    return `M ${leftX} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${rightX} ${y2}`;
  };

  // Preview path uses node centers (not port staggering)
  const makePreviewPath = (sourceWeather, targetWeather) => {
    const sy = nodeCenterY(weatherOptions.indexOf(sourceWeather));
    const ty = nodeCenterY(weatherOptions.indexOf(targetWeather));
    const sx = selectedNode?.side === 'left' ? leftX : rightX;
    const tx = selectedNode?.side === 'left' ? rightX : leftX;
    const midX = (leftX + rightX) / 2;
    return `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;
  };

  // --- Data manipulation ---

  const normalizeRow = (row) => {
    const total = weatherOptions.reduce((s, w) => s + (row[w] || 0), 0);
    if (total > 0) {
      const result = {};
      for (const w of weatherOptions) result[w] = Math.round(((row[w] || 0) / total) * 1000) / 1000;
      return result;
    }
    return row;
  };

  const ensureRow = (table, weather) => {
    if (table[weather]) return { ...table[weather] };
    const row = {};
    for (const w of weatherOptions) row[w] = weather === w ? 4 : 0;
    return row;
  };

  const addDirection = (from, to) => {
    const table = { ...transitionTable };
    const row = ensureRow(table, from);
    if ((row[to] || 0) <= 0) row[to] = 1;
    table[from] = normalizeRow(row);
    onSetTransitionTable(table);
  };

  const removeDirection = (from, to) => {
    const table = { ...transitionTable };
    const row = ensureRow(table, from);
    row[to] = 0;
    table[from] = normalizeRow(row);
    onSetTransitionTable(table);
  };

  const ensureConnection = (a, b) => {
    const table = { ...transitionTable };
    const rowA = ensureRow(table, a);
    const rowB = ensureRow(table, b);
    if ((rowA[b] || 0) <= 0) rowA[b] = 1;
    if ((rowB[a] || 0) <= 0) rowB[a] = 1;
    table[a] = normalizeRow(rowA);
    table[b] = normalizeRow(rowB);
    onSetTransitionTable(table);
  };

  const setOneWay = (from, to) => {
    const table = { ...transitionTable };
    const rowFrom = ensureRow(table, from);
    if ((rowFrom[to] || 0) <= 0) rowFrom[to] = 1;
    table[from] = normalizeRow(rowFrom);
    const rowTo = ensureRow(table, to);
    rowTo[from] = 0;
    table[to] = normalizeRow(rowTo);
    onSetTransitionTable(table);
  };

  const removeBothDirections = (a, b) => {
    const table = { ...transitionTable };
    const rowA = ensureRow(table, a);
    rowA[b] = 0;
    table[a] = normalizeRow(rowA);
    const rowB = ensureRow(table, b);
    rowB[a] = 0;
    table[b] = normalizeRow(rowB);
    onSetTransitionTable(table);
  };

  const applyWiringMode = (sourceWeather, targetWeather) => {
    switch (wiringMode) {
      case 'bidirectional': ensureConnection(sourceWeather, targetWeather); break;
      case 'oneway': setOneWay(sourceWeather, targetWeather); break;
      case 'remove': removeBothDirections(sourceWeather, targetWeather); break;
    }
  };

  // --- Click handlers ---

  const handleNodeClick = (side, weather, e) => {
    e.stopPropagation();
    if (selectedNode) {
      if (selectedNode.weather === weather && selectedNode.side === side) {
        setSelectedNode(null);
        setHoveredTarget(null);
      } else if (selectedNode.side !== side) {
        applyWiringMode(selectedNode.weather, weather);
      } else {
        setSelectedNode({ side, weather });
        setHoveredTarget(null);
      }
    } else {
      setSelectedNode({ side, weather });
    }
  };

  const handleConnectionClick = (conn, e) => {
    e.stopPropagation();
    if (conn.ab && conn.ba) {
      removeDirection(conn.b, conn.a);
    } else if (conn.ab && !conn.ba) {
      removeDirection(conn.a, conn.b);
      addDirection(conn.b, conn.a);
    } else if (!conn.ab && conn.ba) {
      removeDirection(conn.b, conn.a);
    }
    setSelectedNode(null);
    setHoveredTarget(null);
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null);
    setHoveredTarget(null);
  };

  const handleNodeMouseEnter = (side, weather) => {
    if (isWiring && selectedNode.side !== side) {
      setHoveredTarget({ side, weather });
    }
  };

  const handleNodeMouseLeave = () => {
    setHoveredTarget(null);
  };

  // --- Visual helpers ---

  const getConnectionTooltip = (conn) => {
    if (conn.ab && conn.ba) return `${conn.a} \u21C4 ${conn.b}\nClick: make ${conn.a} \u2192 ${conn.b} only`;
    if (conn.ab) return `${conn.a} \u2192 ${conn.b}\nClick: reverse to ${conn.b} \u2192 ${conn.a}`;
    return `${conn.b} \u2192 ${conn.a}\nClick: remove connection`;
  };

  const isConnected = (weather) => {
    if (!selectedNode) return false;
    const sw = selectedNode.weather;
    return connections.some(c =>
      (c.a === sw && c.b === weather) || (c.b === sw && c.a === weather)
    );
  };

  const isActive = (conn) => {
    if (!selectedNode) return false;
    return conn.a === selectedNode.weather || conn.b === selectedNode.weather;
  };

  const getLineStyle = (conn) => {
    const hovered = hoveredConn && hoveredConn.a === conn.a && hoveredConn.b === conn.b;
    const active = isActive(conn);
    const isRemovePreview = isWiring && wiringMode === 'remove' && hoveredTarget &&
      ((conn.a === selectedNode.weather && conn.b === hoveredTarget.weather) ||
       (conn.b === selectedNode.weather && conn.a === hoveredTarget.weather));

    let width = 1.5, opacity = 0.25, color = 'var(--text-muted)';
    if (isRemovePreview) {
      width = 2.5; opacity = 1.0; color = 'var(--red, #e84040)';
    } else if (hovered) {
      width = 3; opacity = 1.0; color = 'var(--text-primary)';
    } else if (active) {
      width = 2.5; opacity = 1.0; color = 'var(--accent)';
    } else if (isWiring) {
      opacity = 0.07;
    }

    const bidir = conn.ab && conn.ba;
    return { width, opacity, color, dashed: !bidir };
  };

  const getNodeStyle = (side, weather) => {
    const isSource = selectedNode?.weather === weather && selectedNode?.side === side;
    const isOpposite = isWiring && selectedNode?.side !== side;
    const isHovered = hoveredTarget?.weather === weather && hoveredTarget?.side === side;
    const connected = isWiring && isConnected(weather);
    const modeConfig = WIRING_MODES.find(m => m.key === wiringMode);
    const modeColor = modeConfig?.color || 'var(--accent)';

    if (isSource) {
      return { bg: modeColor, border: modeColor, textColor: '#fff', nodeOpacity: 1 };
    }
    if (isWiring && isOpposite) {
      if (isHovered) {
        return { bg: 'var(--bg-input)', border: modeColor, textColor: 'var(--text-primary)', nodeOpacity: 1 };
      }
      if (connected) {
        return { bg: 'var(--bg-input)', border: 'var(--accent)', textColor: 'var(--text-primary)', nodeOpacity: 1 };
      }
      return { bg: 'var(--bg-input)', border: 'var(--border)', textColor: 'var(--text-primary)', nodeOpacity: 1 };
    }
    if (isWiring) {
      return { bg: 'var(--bg-input)', border: 'var(--border)', textColor: 'var(--text-primary)', nodeOpacity: 0.35 };
    }
    return { bg: 'var(--bg-input)', border: 'var(--border)', textColor: 'var(--text-primary)', nodeOpacity: 1 };
  };

  const getAnimClass = (conn) => {
    if (conn.ab && conn.ba) return '';
    if (conn.ab) return 'wtg-flow-ltr';
    return 'wtg-flow-rtl';
  };

  const getPreviewLine = () => {
    if (!isWiring || !hoveredTarget || hoveredTarget.side === selectedNode.side) return null;
    if (wiringMode === 'remove') return null;
    const modeConfig = WIRING_MODES.find(m => m.key === wiringMode);
    const d = makePreviewPath(selectedNode.weather, hoveredTarget.weather);
    const dashed = wiringMode === 'oneway';
    const animClass = dashed ? (selectedNode.side === 'left' ? 'wtg-flow-ltr' : 'wtg-flow-rtl') : '';
    return { d, color: modeConfig.color, dashed, animClass };
  };

  // --- Render ---

  if (collapsed) {
    return (
      <div style={{ marginBottom: 8 }}>
        <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(false)}
          style={{ fontSize: 12, padding: '2px 6px' }}>
          {'\u25B6'} Transition Graph
        </button>
      </div>
    );
  }

  const preview = getPreviewLine();

  return (
    <div style={{ marginBottom: 12 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(true)}
        style={{ fontSize: 12, padding: '2px 6px', marginBottom: 8 }}>
        {'\u25BC'} Transition Graph
      </button>

      {isWiring ? (
        <div style={{
          display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center',
          padding: '4px 8px', borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            Wiring <strong style={{ color: 'var(--text-primary)' }}>{selectedNode.weather}</strong>:
          </span>
          {WIRING_MODES.map(mode => {
            const active = wiringMode === mode.key;
            return (
              <button key={mode.key} className="btn btn-sm"
                style={{
                  fontSize: 11, padding: '1px 8px', lineHeight: '18px',
                  background: active ? mode.color : 'transparent',
                  color: active ? '#fff' : 'var(--text-muted)',
                  border: `1px solid ${active ? mode.color : 'var(--border)'}`,
                }}
                onClick={(e) => { e.stopPropagation(); setWiringMode(mode.key); }}
              >
                {mode.symbol} {mode.label}
              </button>
            );
          })}
          <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
            Click targets on the other side
          </span>
        </div>
      ) : (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>
          Click a weather type to start wiring connections. Click a line to cycle its direction.
        </p>
      )}

      <div
        ref={containerRef}
        style={{ position: 'relative', display: 'flex', minHeight: totalHeight + 8, userSelect: 'none' }}
        onClick={handleBackgroundClick}
      >
        {/* Left column */}
        <div style={{ width: COL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: NODE_GAP, zIndex: 1 }}>
          {weatherOptions.map((w) => {
            const s = getNodeStyle('left', w);
            return (
              <div key={w}
                onClick={(e) => handleNodeClick('left', w, e)}
                onMouseEnter={() => handleNodeMouseEnter('left', w)}
                onMouseLeave={handleNodeMouseLeave}
                style={{
                  height: NODE_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                  paddingRight: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)', border: `1.5px solid ${s.border}`,
                  background: s.bg, color: s.textColor, opacity: s.nodeOpacity,
                  transition: 'all 0.2s',
                }}>{w}</div>
            );
          })}
        </div>

        {/* SVG layer */}
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }}
          width={containerWidth} height={totalHeight + 8}>
          <defs>
            <style>{`
              @keyframes wtgFlowLTR { to { stroke-dashoffset: -20; } }
              @keyframes wtgFlowRTL { to { stroke-dashoffset: 20; } }
              .wtg-flow-ltr { animation: wtgFlowLTR 1s linear infinite; }
              .wtg-flow-rtl { animation: wtgFlowRTL 1s linear infinite; }
            `}</style>
          </defs>

          {connections.map(conn => {
            const style = getLineStyle(conn);
            const d = makePath(conn.a, conn.b);
            const animClass = getAnimClass(conn);
            const tooltip = getConnectionTooltip(conn);
            return (
              <g key={conn.a + '-' + conn.b}>
                <path d={d} fill="none" stroke="transparent" strokeWidth={12}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={(e) => handleConnectionClick(conn, e)}
                  onMouseEnter={() => setHoveredConn({ a: conn.a, b: conn.b })}
                  onMouseLeave={() => setHoveredConn(null)}>
                  <title>{tooltip}</title>
                </path>
                <path d={d} fill="none"
                  stroke={style.color} strokeWidth={style.width} opacity={style.opacity}
                  strokeDasharray={style.dashed ? '6 4' : 'none'}
                  className={style.dashed ? animClass : ''}
                  style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s' }} />
              </g>
            );
          })}

          {preview && (
            <path d={preview.d} fill="none"
              stroke={preview.color} strokeWidth={2} opacity={0.4}
              strokeDasharray={preview.dashed ? '6 4' : 'none'}
              className={preview.animClass || ''}
              style={{ pointerEvents: 'none' }} />
          )}
        </svg>

        <div style={{ flex: 1 }} />

        {/* Right column */}
        <div style={{ width: COL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: NODE_GAP, zIndex: 1 }}>
          {weatherOptions.map((w) => {
            const s = getNodeStyle('right', w);
            return (
              <div key={w}
                onClick={(e) => handleNodeClick('right', w, e)}
                onMouseEnter={() => handleNodeMouseEnter('right', w)}
                onMouseLeave={handleNodeMouseLeave}
                style={{
                  height: NODE_HEIGHT, display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
                  paddingLeft: 10, fontSize: 12, fontWeight: 500, cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)', border: `1.5px solid ${s.border}`,
                  background: s.bg, color: s.textColor, opacity: s.nodeOpacity,
                  transition: 'all 0.2s',
                }}>{w}</div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="var(--text-muted)" strokeWidth="1.5" /></svg>
          Bidirectional
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="var(--text-muted)" strokeWidth="1.5" strokeDasharray="6 4" /></svg>
          One-way
        </span>
      </div>
    </div>
  );
}
