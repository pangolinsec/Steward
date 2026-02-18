import React, { useState } from 'react';
import * as api from '../api';
import ImportPreviewModal from './ImportPreviewModal';

export default function CampaignModal({ campaigns, activeCampaignId, onClose, onSelect, onRefresh }) {
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showMergeImport, setShowMergeImport] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const campaign = await api.createCampaign({
        name: newName.trim(),
        attribute_definitions: [
          { key: 'strength', label: 'Strength' },
          { key: 'dexterity', label: 'Dexterity' },
          { key: 'constitution', label: 'Constitution' },
          { key: 'intelligence', label: 'Intelligence' },
          { key: 'wisdom', label: 'Wisdom' },
          { key: 'charisma', label: 'Charisma' },
        ],
      });
      setNewName('');
      await onRefresh();
      onSelect(campaign.id);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete campaign "${name}"? This cannot be undone.`)) return;
    await api.deleteCampaign(id);
    await onRefresh();
    if (id === activeCampaignId) {
      const remaining = campaigns.filter(c => c.id !== id);
      if (remaining.length > 0) onSelect(remaining[0].id);
    }
  };

  const handleExport = async (id) => {
    const data = await api.exportCampaign(id);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `almanac-campaign-${id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const text = await file.text();
      const data = JSON.parse(text);
      const campaign = await api.importCampaign(activeCampaignId || 0, data);
      await onRefresh();
      onSelect(campaign.id);
    };
    input.click();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Campaigns</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div className="campaign-list">
            {campaigns.map(c => (
              <div key={c.id} className={`campaign-card ${c.id === activeCampaignId ? 'active' : ''}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ cursor: 'pointer', flex: 1 }} onClick={() => onSelect(c.id)}>
                    <div style={{ fontWeight: 500 }}>{c.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Created {new Date(c.created_at).toLocaleDateString()}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleExport(c.id)} title="Export">&#x2913;</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(c.id, c.name)} title="Delete" style={{ color: 'var(--red)' }}>&#x2715;</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="New campaign name..."
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreate()}
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newName.trim()}>Create</button>
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary btn-sm" onClick={handleImport}>Import Campaign from JSON</button>
            {activeCampaignId && (
              <button className="btn btn-secondary btn-sm" onClick={() => setShowMergeImport(true)}>Merge into Current Campaign</button>
            )}
          </div>
        </div>
      </div>
      {showMergeImport && (
        <ImportPreviewModal
          campaignId={activeCampaignId}
          onClose={() => setShowMergeImport(false)}
          onComplete={onRefresh}
          initialEntityTypes={['status_effects', 'items', 'characters', 'encounters']}
          lockEntityTypes={false}
        />
      )}
    </div>
  );
}
