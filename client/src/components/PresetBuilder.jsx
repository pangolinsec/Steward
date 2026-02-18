import React, { useState, useEffect, useMemo } from 'react';
import * as api from '../api';
import { useToast } from './ToastContext';
import RuleRefBadge from './RuleRefBadge';

export default function PresetBuilder({ campaignId, campaign, initialTagKey, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTagKey, setSelectedTagKey] = useState(initialTagKey || '');
  const [definingNew, setDefiningNew] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newOptions, setNewOptions] = useState('');
  const [referencingRules, setReferencingRules] = useState([]);
  const [checkedRuleIds, setCheckedRuleIds] = useState(new Set());
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [saving, setSaving] = useState(false);
  const { addToast } = useToast();

  const tagAttrs = useMemo(
    () => (campaign?.attribute_definitions || []).filter(a => a.type === 'tag'),
    [campaign]
  );

  const selectedAttr = tagAttrs.find(a => a.key === selectedTagKey);

  // Auto-fill name from attribute label
  useEffect(() => {
    if (initialTagKey && selectedAttr && !name) {
      setName(selectedAttr.label);
    }
  }, [initialTagKey, selectedAttr]);

  // Fetch referencing rules when attribute selection changes
  useEffect(() => {
    if (!selectedTagKey || definingNew) {
      setReferencingRules([]);
      setCheckedRuleIds(new Set());
      return;
    }
    setLoadingRefs(true);
    api.getRuleReferences(campaignId, 'attribute', selectedTagKey)
      .then(refs => {
        setReferencingRules(refs);
        setCheckedRuleIds(new Set(refs.map(r => r.rule_id)));
      })
      .catch(() => setReferencingRules([]))
      .finally(() => setLoadingRefs(false));
  }, [campaignId, selectedTagKey, definingNew]);

  const toggleRule = (ruleId) => {
    setCheckedRuleIds(prev => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim()) return addToast('Name is required', 'error');

    let attribute;
    if (definingNew) {
      if (!newKey.trim() || !newLabel.trim()) return addToast('Key and label are required for new attribute', 'error');
      const opts = newOptions.split(',').map(s => s.trim()).filter(Boolean);
      attribute = { key: newKey.trim(), label: newLabel.trim(), type: 'tag', options: opts };
    } else {
      if (!selectedAttr) return addToast('Select an attribute', 'error');
      attribute = { key: selectedAttr.key, label: selectedAttr.label, type: 'tag', options: selectedAttr.options || [] };
    }

    setSaving(true);
    try {
      // Fetch full rule objects for checked IDs, strip DB-specific fields
      let rules = [];
      if (checkedRuleIds.size > 0) {
        const allRules = await api.getRules(campaignId);
        rules = allRules
          .filter(r => checkedRuleIds.has(r.id))
          .map(({ id, campaign_id, enabled, created_at, ...rest }) => rest);
      }

      await api.createCustomPreset(campaignId, { name: name.trim(), description: description.trim(), attribute, rules });
      addToast('Preset saved', 'success');
      onSaved?.();
    } catch (e) {
      addToast(`Failed to save preset: ${e.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Create Tag Preset</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Faction Loyalty" />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Brief description of what this preset provides" />
          </div>

          <div className="form-group">
            <label>Tag Attribute</label>
            <select
              value={definingNew ? '__new__' : selectedTagKey}
              onChange={e => {
                if (e.target.value === '__new__') {
                  setDefiningNew(true);
                  setSelectedTagKey('');
                } else {
                  setDefiningNew(false);
                  setSelectedTagKey(e.target.value);
                }
              }}
            >
              <option value="">-- Select attribute --</option>
              {tagAttrs.map(a => (
                <option key={a.key} value={a.key}>{a.label} ({a.key})</option>
              ))}
              <option value="__new__">+ Define new...</option>
            </select>
          </div>

          {definingNew && (
            <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 12, marginBottom: 12 }}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Key</label>
                  <input type="text" value={newKey} onChange={e => setNewKey(e.target.value)}
                    placeholder="faction" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Label</label>
                  <input type="text" value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Faction" />
                </div>
              </div>
              <div className="form-group">
                <label>Options (comma-separated)</label>
                <input type="text" value={newOptions} onChange={e => setNewOptions(e.target.value)}
                  placeholder="Rebels, Empire, Guild" style={{ fontSize: 12 }} />
              </div>
            </div>
          )}

          {!definingNew && selectedAttr && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedAttr.key}</span>
              {' \u2014 '}
              {(selectedAttr.options || []).join(', ') || 'No options defined'}
            </div>
          )}

          {/* Rules section */}
          {(selectedTagKey && !definingNew) && (
            <div className="form-group">
              <label>Include Rules</label>
              {loadingRefs ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Loading rules...</p>
              ) : referencingRules.length === 0 ? (
                <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>No rules reference this attribute.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {referencingRules.map(ref => (
                    <label key={ref.rule_id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={checkedRuleIds.has(ref.rule_id)}
                        onChange={() => toggleRule(ref.rule_id)}
                      />
                      <span>{ref.rule_name}</span>
                      <RuleRefBadge campaignId={campaignId} entityType="attribute" entityName={selectedTagKey} />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preset'}
          </button>
        </div>
      </div>
    </div>
  );
}
