import React, { useState, useRef, useEffect, useCallback } from 'react';

const COL_WIDTH = 130;
const NODE_HEIGHT = 32;
const NODE_GAP = 6;

export default function WeatherTransitionGraph({ weatherOptions, transitionTable, onSetTransitionTable }) {
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredConn, setHoveredConn] = useState(null);
  const [containerWidth, setContainerWidth] = useState(400);
  const [collapsed, setCollapsed] = useState(false);
  const containerRef = useRef(null);

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

  // Port staggering: compute per-node port offsets
  const getPortOffsets = useCallback(() => {
    const leftPorts = {};  // connections leaving from left side (source)
    const rightPorts = {}; // connections arriving at right side (dest)
    for (const w of weatherOptions) {
      leftPorts[w] = [];
      rightPorts[w] = [];
    }
    for (const conn of connections) {
      leftPorts[conn.a].push(conn.b);
      rightPorts[conn.b].push(conn.a);
      // Also add reverse references for bidirectional display
      leftPorts[conn.b].push(conn.a);
      rightPorts[conn.a].push(conn.b);
    }
    // Sort by destination y-position to minimize crossings
    for (const w of weatherOptions) {
      const wi = weatherOptions.indexOf(w);
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

  // SVG coordinates
  const leftX = COL_WIDTH;
  const rightX = containerWidth - COL_WIDTH;

  // Bezier path
  const makePath = (fromWeather, toWeather) => {
    const y1 = getPortY(fromWeather, toWeather, 'left');
    const y2 = getPortY(toWeather, fromWeather, 'right');
    const midX = (leftX + rightX) / 2;
    return `M ${leftX} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${rightX} ${y2}`;
  };

  // Data manipulation helpers
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

  // Click handlers
  const handleNodeClick = (side, weather, e) => {
    e.stopPropagation();
    if (selectedNode && selectedNode.side !== side) {
      // Create connection between selected and clicked
      ensureConnection(selectedNode.weather, weather);
      setSelectedNode(null);
    } else if (selectedNode && selectedNode.weather === weather && selectedNode.side === side) {
      setSelectedNode(null);
    } else {
      setSelectedNode({ side, weather });
    }
  };

  const handleConnectionClick = (conn, e) => {
    e.stopPropagation();
    // Cycle: bidirectional → a-to-b only → b-to-a only → removed
    if (conn.ab && conn.ba) {
      removeDirection(conn.b, conn.a);
    } else if (conn.ab && !conn.ba) {
      removeDirection(conn.a, conn.b);
      addDirection(conn.b, conn.a);
    } else if (!conn.ab && conn.ba) {
      removeDirection(conn.b, conn.a);
    }
    setSelectedNode(null);
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null);
  };

  // Visual state helpers
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
    const anySelected = selectedNode !== null;

    let width = 1.5, opacity = 0.25, color = 'var(--text-muted)';
    if (hovered) { width = 3; opacity = 1.0; color = 'var(--text-primary)'; }
    else if (active) { width = 2.5; opacity = 1.0; color = 'var(--accent)'; }
    else if (anySelected) { opacity = 0.07; }

    const bidir = conn.ab && conn.ba;
    return { width, opacity, color, dashed: !bidir };
  };

  const getNodeStyle = (side, weather) => {
    const anySelected = selectedNode !== null;
    const isSelected = selectedNode && selectedNode.weather === weather && selectedNode.side === side;
    const isSelectedWeather = selectedNode && selectedNode.weather === weather;
    const connected = isConnected(weather);

    let bg = 'var(--bg-input)', border = 'var(--border)', textColor = 'var(--text-primary)', nodeOpacity = 1;
    if (isSelected || isSelectedWeather) {
      bg = 'var(--accent)'; border = 'var(--accent)'; textColor = '#fff';
    } else if (connected) {
      border = 'var(--accent)';
    } else if (anySelected) {
      nodeOpacity = 0.15;
    }
    return { bg, border, textColor, nodeOpacity };
  };

  // Direction of dashed animation
  const getAnimClass = (conn) => {
    if (conn.ab && conn.ba) return '';
    if (conn.ab) return 'wtg-flow-ltr';
    return 'wtg-flow-rtl';
  };

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

  return (
    <div style={{ marginBottom: 12 }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setCollapsed(true)}
        style={{ fontSize: 12, padding: '2px 6px', marginBottom: 8 }}>
        {'\u25BC'} Transition Graph
      </button>
      <div
        ref={containerRef}
        style={{ position: 'relative', display: 'flex', minHeight: totalHeight + 8, userSelect: 'none' }}
        onClick={handleBackgroundClick}
      >
        {/* Left column */}
        <div style={{ width: COL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: NODE_GAP, zIndex: 1 }}>
          {weatherOptions.map((w, i) => {
            const s = getNodeStyle('left', w);
            return (
              <div key={w} onClick={(e) => handleNodeClick('left', w, e)} style={{
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
            return (
              <g key={conn.a + '-' + conn.b}>
                {/* Hit area */}
                <path d={d} fill="none" stroke="transparent" strokeWidth={12}
                  style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
                  onClick={(e) => handleConnectionClick(conn, e)}
                  onMouseEnter={() => setHoveredConn({ a: conn.a, b: conn.b })}
                  onMouseLeave={() => setHoveredConn(null)} />
                {/* Visible line */}
                <path d={d} fill="none"
                  stroke={style.color} strokeWidth={style.width} opacity={style.opacity}
                  strokeDasharray={style.dashed ? '6 4' : 'none'}
                  className={style.dashed ? animClass : ''}
                  style={{ pointerEvents: 'none', transition: 'stroke 0.2s, stroke-width 0.2s, opacity 0.2s' }} />
              </g>
            );
          })}
        </svg>

        {/* Spacer for middle */}
        <div style={{ flex: 1 }} />

        {/* Right column */}
        <div style={{ width: COL_WIDTH, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: NODE_GAP, zIndex: 1 }}>
          {weatherOptions.map((w, i) => {
            const s = getNodeStyle('right', w);
            return (
              <div key={w} onClick={(e) => handleNodeClick('right', w, e)} style={{
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
        <span>Click node to highlight | Click line to cycle direction | Click two nodes to connect</span>
      </div>
    </div>
  );
}
