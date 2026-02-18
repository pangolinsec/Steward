import React, { useState, useEffect } from 'react';
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
          {filtered.length === 0 ? (
            <div className="empty-state" style={{ padding: 20 }}><p>No notifications</p></div>
          ) : (
            filtered.map(n => (
              <div key={n.id} className={`notification-item notification-${n.severity}`}
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
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleUndo(n.id); }}>Undo</button>
                  )}
                  {n.notification_type === 'suggestion' && (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); handleApply(n.id); }}>Apply</button>
                      <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }}>Dismiss</button>
                    </>
                  )}
                  {n.notification_type !== 'suggestion' && n.notification_type !== 'auto_applied' && (
                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); handleDismiss(n.id); }}>&#x2715;</button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
