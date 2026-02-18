import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../api';
import { useToast } from './ToastContext';

export default function NotificationDrawer({ campaignId, onClose, pinned, onTogglePin }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all, info, warning, error
  const { addToast } = useToast();

  const load = async () => {
    if (!campaignId) return;
    const data = await api.getNotifications(campaignId);
    setNotifications(data);
  };

  useEffect(() => { load(); }, [campaignId]);

  const filtered = filter === 'all' ? notifications : notifications.filter(n => n.severity === filter);

  const grouped = useMemo(() => {
    const groups = [];
    const batchMap = new Map();
    for (const n of filtered) {
      const key = n.batch_id || n.id;
      if (n.batch_id && batchMap.has(key)) {
        batchMap.get(key).items.push(n);
      } else {
        const group = { key, batch_id: n.batch_id, items: [n] };
        groups.push(group);
        if (n.batch_id) batchMap.set(key, group);
      }
    }
    return groups;
  }, [filtered]);

  const handleDismiss = async (id) => {
    await api.dismissNotification(campaignId, id);
    load();
  };

  const handleApply = async (id) => {
    try {
      const result = await api.applyNotification(campaignId, id);
      addToast(`Applied: ${result.results?.map(r => r.description).join('; ') || 'OK'}`, 'success');
      load();
    } catch (e) {
      addToast(`Failed to apply: ${e.message}`, 'error');
    }
  };

  const handleUndo = async (id) => {
    try {
      const result = await api.undoNotification(campaignId, id);
      addToast(`Undid ${result.undone} action(s)`, 'info');
      load();
    } catch (e) {
      addToast(`Failed to undo: ${e.message}`, 'error');
    }
  };

  const handleClearAll = async () => {
    await api.clearNotifications(campaignId);
    setNotifications([]);
  };

  const severityIcon = (severity) => {
    switch (severity) {
      case 'warning': return '\u26A0';
      case 'error': return '\u2716';
      case 'success': return '\u2714';
      default: return '\u2139';
    }
  };

  return (
    <div className="notification-drawer-overlay" onClick={!pinned ? onClose : undefined}>
      <div className="notification-drawer" onClick={e => e.stopPropagation()}>
        <div className="notification-drawer-header">
          <h3>Notifications</h3>
          <div className="inline-flex gap-sm">
            <button className={`btn btn-ghost btn-sm ${pinned ? 'btn-active' : ''}`} onClick={onTogglePin}
              title={pinned ? 'Unpin' : 'Pin open'}>
              {pinned ? '\uD83D\uDCCC' : '\uD83D\uDCCC'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={handleClearAll} title="Clear all">Clear</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
          </div>
        </div>
        <div className="notification-drawer-filters">
          {['all', 'info', 'warning', 'error'].map(f => (
            <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        <div className="notification-drawer-list">
          {grouped.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}><p>No notifications</p></div>
          ) : (
            grouped.map(group => (
              group.items.length === 1
                ? <NotificationItem key={group.key} n={group.items[0]} campaignId={campaignId}
                    severityIcon={severityIcon} onUndo={handleUndo} onApply={handleApply} onDismiss={handleDismiss} />
                : <NotificationGroup key={group.key} group={group} campaignId={campaignId}
                    severityIcon={severityIcon} onUndo={handleUndo} onApply={handleApply} onDismiss={handleDismiss} />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function NotificationItem({ n, campaignId, severityIcon, onUndo, onApply, onDismiss }) {
  return (
    <div className={`notification-item notification-${n.severity}`}
      onClick={() => !n.read && api.markNotificationRead(campaignId, n.id)}>
      <div className="notification-item-icon">{severityIcon(n.severity)}</div>
      <div className="notification-item-body">
        {n.rule_name && <div className="notification-item-rule">{n.rule_name}</div>}
        <div className="notification-item-message">{n.message}</div>
        {n.target_character_name && (
          <div className="notification-item-target">Target: {n.target_character_name}</div>
        )}
        <div className="notification-item-time">{new Date(n.created_at).toLocaleString()}</div>
      </div>
      <div className="notification-item-actions">
        {n.notification_type === 'auto_applied' && n.batch_id && (
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onUndo(n.id); }}>Undo</button>
        )}
        {n.notification_type === 'suggestion' && (
          <>
            <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); onApply(n.id); }}>Apply</button>
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}>Dismiss</button>
          </>
        )}
        {n.notification_type !== 'suggestion' && n.notification_type !== 'auto_applied' && (
          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onDismiss(n.id); }}>&#x2715;</button>
        )}
      </div>
    </div>
  );
}

function NotificationGroup({ group, campaignId, severityIcon, onUndo, onApply, onDismiss }) {
  const [expanded, setExpanded] = useState(false);
  const first = group.items[0];
  const hasAutoApplied = group.items.some(n => n.notification_type === 'auto_applied');
  const targetNames = [...new Set(group.items.map(n => n.target_character_name).filter(Boolean))];

  return (
    <div style={{ marginBottom: 4 }}>
      <div className={`notification-item notification-${first.severity}`}
        style={{ cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}>
        <div className="notification-item-icon">{severityIcon(first.severity)}</div>
        <div className="notification-item-body">
          {first.rule_name && <div className="notification-item-rule">{first.rule_name}</div>}
          <div className="notification-item-message">
            {first.rule_name || 'Batch'} affected {group.items.length} character{group.items.length !== 1 ? 's' : ''}
          </div>
          {targetNames.length > 0 && (
            <div className="notification-item-target">{targetNames.join(', ')}</div>
          )}
          <div className="notification-item-time">
            {new Date(first.created_at).toLocaleString()}
            <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--text-muted)' }}>
              {expanded ? '\u25B2' : '\u25BC'} {group.items.length} items
            </span>
          </div>
        </div>
        <div className="notification-item-actions">
          {hasAutoApplied && group.batch_id && (
            <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); onUndo(first.id); }}>
              Undo All
            </button>
          )}
        </div>
      </div>
      {expanded && (
        <div style={{ paddingLeft: 16, borderLeft: '2px solid var(--border)', marginLeft: 12, marginBottom: 4 }}>
          {group.items.map(n => (
            <NotificationItem key={n.id} n={n} campaignId={campaignId}
              severityIcon={severityIcon} onUndo={onUndo} onApply={onApply} onDismiss={onDismiss} />
          ))}
        </div>
      )}
    </div>
  );
}
