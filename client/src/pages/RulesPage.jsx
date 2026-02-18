import React, { useState, useEffect } from 'react';
import * as api from '../api';
import ImportPreviewModal from '../components/ImportPreviewModal';
import RuleTemplateBrowser from '../components/RuleTemplateBrowser';
import { ConditionBuilder, ActionBuilder } from '../components/RuleBuilder';
import RuleTestPanel from '../components/RuleTestPanel';

const TRIGGER_TYPES = [
  { value: 'on_time_advance', label: 'Time Advance' },
  { value: 'on_effect_change', label: 'Effect Change' },
  { value: 'on_item_change', label: 'Item Change' },
  { value: 'on_threshold', label: 'Threshold Crossed' },
  { value: 'on_location_change', label: 'Location Change' },
  { value: 'on_rest', label: 'Rest' },
  { value: 'on_schedule', label: 'Scheduled' },
  { value: 'on_encounter', label: 'Encounter' },
];

const ACTION_MODES = [
  { value: 'auto', label: 'Auto-apply' },
  { value: 'suggest', label: 'Suggest' },
];

const TARGET_MODES = [
  { value: 'environment', label: 'Environment' },
  { value: 'all_pcs', label: 'All PCs' },
  { value: 'all_npcs', label: 'All NPCs' },
  { value: 'all_characters', label: 'All Characters' },
  { value: 'specific', label: 'Specific Characters' },
];

export default function RulesPage({ campaignId, campaign }) {
  const [rules, setRules] = useState([]);
  const [search, setSearch] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [testRule, setTestRule] = useState(null);

  const load = async () => {
    if (!campaignId) return;
    let params = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (filterTrigger) params.push(`trigger_type=${filterTrigger}`);
    const data = await api.getRules(campaignId, params.join('&'));
    setRules(data);
  };

  useEffect(() => { load(); }, [campaignId, search, filterTrigger]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete rule "${name}"?`)) return;
    await api.deleteRule(campaignId, id);
    load();
  };

  const handleToggle = async (id) => {
    await api.toggleRule(campaignId, id);
    load();
  };

  const triggerLabel = (type) => TRIGGER_TYPES.find(t => t.value === type)?.label || type;

  const summarizeConditions = (conditions) => {
    const tree = conditions || {};
    const items = tree.all || tree.any || [];
    if (items.length === 0) return 'No conditions (always passes)';
    const op = tree.all ? 'ALL' : 'ANY';
    return `${op} of ${items.length} condition${items.length !== 1 ? 's' : ''}`;
  };

  const summarizeActions = (actions) => {
    if (!actions || actions.length === 0) return 'No actions';
    return actions.map(a => a.type).join(', ');
  };

  const handleExport = async () => {
    const data = await api.getRules(campaignId);
    const blob = new Blob([JSON.stringify({ rules: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almanac-rules.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Rules Engine</h2>
        <div className="inline-flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={() => setShowTemplates(true)}>Templates</button>
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>Import</button>
          <button className="btn btn-primary" onClick={() => { setEditRule(null); setShowForm(true); }}>+ New Rule</button>
        </div>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search rules..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)} style={{ width: 180 }}>
          <option value="">All triggers</option>
          {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>
      {rules.length === 0 ? (
        <div className="empty-state"><p>No rules defined yet. Create rules to automate game-world changes.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rules.map(rule => (
            <div key={rule.id} className="card" style={{ opacity: rule.enabled ? 1 : 0.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 15 }}>{rule.name}</span>
                    <span className="tag" style={{ fontSize: 10 }}>{triggerLabel(rule.trigger_type)}</span>
                    <span className={`tag ${rule.action_mode === 'auto' ? 'tag-buff' : ''}`} style={{ fontSize: 10 }}>
                      {rule.action_mode === 'auto' ? 'Auto' : 'Suggest'}
                    </span>
                  </div>
                  {rule.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{rule.description}</div>
                  )}
                  <div className="inline-flex gap-sm mt-sm" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    <span>Priority: {rule.priority}</span>
                    <span>Target: {rule.target_mode}</span>
                    {rule.tags.length > 0 && rule.tags.map(t => (
                      <span key={t} className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>{t}</span>
                    ))}
                  </div>
                </div>
                <div className="inline-flex gap-sm">
                  <button
                    className={`btn btn-sm ${rule.enabled ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => handleToggle(rule.id)}
                    style={{ minWidth: 60 }}
                  >
                    {rule.enabled ? 'Disable' : 'Enable'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTestRule(rule)}>Test</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setEditRule(rule); setShowForm(true); }}>Edit</button>
                  <button className="btn btn-danger btn-sm" onClick={() => handleDelete(rule.id, rule.name)}>Delete</button>
                </div>
              </div>
              {expandedId === rule.id && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', fontSize: 13 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Conditions:</strong> {summarizeConditions(rule.conditions)}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Actions:</strong> {summarizeActions(rule.actions)}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Trigger Config:</strong>
                    <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(rule.trigger_config, null, 2)}
                    </pre>
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>Conditions (raw):</strong>
                    <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(rule.conditions, null, 2)}
                    </pre>
                  </div>
                  <div>
                    <strong>Actions (raw):</strong>
                    <pre style={{ fontSize: 11, fontFamily: 'var(--font-mono)', marginTop: 4, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(rule.actions, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {showForm && (
        <RuleForm
          campaignId={campaignId}
          campaign={campaign}
          rule={editRule}
          onClose={() => { setShowForm(false); setEditRule(null); }}
          onSave={() => { setShowForm(false); setEditRule(null); load(); }}
        />
      )}
      {showImport && (
        <ImportPreviewModal
          campaignId={campaignId}
          onClose={() => setShowImport(false)}
          onComplete={load}
          initialEntityTypes={['rules']}
          lockEntityTypes={true}
        />
      )}
      {testRule && (
        <RuleTestPanel
          campaignId={campaignId}
          ruleId={testRule.id}
          ruleName={testRule.name}
          onClose={() => setTestRule(null)}
        />
      )}
      {showTemplates && (
        <RuleTemplateBrowser
          campaignId={campaignId}
          onClose={() => setShowTemplates(false)}
          onImported={() => { load(); }}
        />
      )}
    </div>
  );
}

function RuleForm({ campaignId, campaign, rule, onClose, onSave }) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [triggerType, setTriggerType] = useState(rule?.trigger_type || 'on_time_advance');
  const [actionMode, setActionMode] = useState(rule?.action_mode || 'auto');
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [targetMode, setTargetMode] = useState(rule?.target_mode || 'environment');
  const [tagsStr, setTagsStr] = useState((rule?.tags || []).join(', '));
  const [triggerConfigStr, setTriggerConfigStr] = useState(JSON.stringify(rule?.trigger_config || {}, null, 2));
  const [targetConfigStr, setTargetConfigStr] = useState(JSON.stringify(rule?.target_config || {}, null, 2));
  const [conditions, setConditions] = useState(rule?.conditions || { all: [] });
  const [actions, setActions] = useState(rule?.actions || []);
  const [useRawJson, setUseRawJson] = useState(false);
  const [rawConditions, setRawConditions] = useState(JSON.stringify(rule?.conditions || { all: [] }, null, 2));
  const [rawActions, setRawActions] = useState(JSON.stringify(rule?.actions || [], null, 2));

  const handleSubmit = async (e) => {
    e.preventDefault();
    let trigger_config, target_config, finalConditions, finalActions;
    try {
      trigger_config = JSON.parse(triggerConfigStr);
      target_config = JSON.parse(targetConfigStr);
      if (useRawJson) {
        finalConditions = JSON.parse(rawConditions);
        finalActions = JSON.parse(rawActions);
      } else {
        finalConditions = conditions;
        finalActions = actions;
      }
    } catch {
      alert('Invalid JSON in one of the fields');
      return;
    }
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const data = {
      name, description, trigger_type: triggerType, trigger_config,
      conditions: finalConditions, actions: finalActions,
      action_mode: actionMode, priority, tags, target_mode: targetMode, target_config,
    };
    if (rule) {
      await api.updateRule(campaignId, rule.id, data);
    } else {
      await api.createRule(campaignId, data);
    }
    onSave();
  };

  const toggleRawJson = () => {
    if (useRawJson) {
      // Switching from raw to builder — parse raw
      try {
        setConditions(JSON.parse(rawConditions));
        setActions(JSON.parse(rawActions));
      } catch { /* keep current builder state */ }
    } else {
      // Switching from builder to raw — serialize
      setRawConditions(JSON.stringify(conditions, null, 2));
      setRawActions(JSON.stringify(actions, null, 2));
    }
    setUseRawJson(!useRawJson);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{rule ? 'Edit Rule' : 'New Rule'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label>Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Trigger Type</label>
                <select value={triggerType} onChange={e => setTriggerType(e.target.value)}>
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Action Mode</label>
                <select value={actionMode} onChange={e => setActionMode(e.target.value)}>
                  {ACTION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Priority (lower = first)</label>
                <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} />
              </div>
              <div className="form-group">
                <label>Target Mode</label>
                <select value={targetMode} onChange={e => setTargetMode(e.target.value)}>
                  {TARGET_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Tags (comma-separated)</label>
              <input type="text" value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="survival, combat, ..." />
            </div>
            <div className="form-group">
              <label>Trigger Config (JSON)</label>
              <textarea value={triggerConfigStr} onChange={e => setTriggerConfigStr(e.target.value)} rows={2}
                style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
            </div>
            {targetMode === 'specific' && (
              <div className="form-group">
                <label>Target Config (JSON)</label>
                <textarea value={targetConfigStr} onChange={e => setTargetConfigStr(e.target.value)} rows={2}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, marginTop: 8 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>Conditions & Actions</h4>
              <button type="button" className="btn btn-ghost btn-sm" onClick={toggleRawJson}>
                {useRawJson ? 'Builder View' : 'Raw JSON'}
              </button>
            </div>

            {useRawJson ? (
              <>
                <div className="form-group">
                  <label>Conditions (JSON)</label>
                  <textarea value={rawConditions} onChange={e => setRawConditions(e.target.value)} rows={6}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                </div>
                <div className="form-group">
                  <label>Actions (JSON)</label>
                  <textarea value={rawActions} onChange={e => setRawActions(e.target.value)} rows={6}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                </div>
              </>
            ) : (
              <>
                <div className="form-group">
                  <label>Conditions</label>
                  <ConditionBuilder value={conditions} onChange={setConditions} />
                </div>
                <div className="form-group">
                  <label>Actions</label>
                  <ActionBuilder value={actions} onChange={setActions} />
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{rule ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
