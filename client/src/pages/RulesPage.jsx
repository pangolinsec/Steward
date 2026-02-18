import React, { useState, useEffect } from 'react';
import * as api from '../api';
import ImportPreviewModal from '../components/ImportPreviewModal';
import RuleTemplateBrowser from '../components/RuleTemplateBrowser';
import { ConditionBuilder, ActionBuilder, stripIds } from '../components/RuleBuilder';
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

const NO_CONFIG_TRIGGERS = ['on_time_advance', 'on_rest', 'on_effect_change', 'on_item_change', 'on_location_change'];

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

const CHARACTER_ONLY_ACTIONS = new Set([
  'apply_effect', 'remove_effect', 'modify_attribute', 'consume_item', 'grant_item'
]);

const CHARACTER_ONLY_CONDITIONS = new Set([
  'attribute_gte', 'attribute_lte', 'attribute_eq', 'trait_equals', 'trait_in',
  'has_effect', 'lacks_effect', 'has_item', 'lacks_item', 'item_quantity_lte',
  'character_type', 'hours_since_last_rest'
]);

function getMissingPrereqs(rule, entityLists) {
  if (!entityLists) return [];
  const warnings = [];
  const conditions = rule.conditions;
  const items = conditions?.all || conditions?.any || [];
  for (const cond of items) {
    if (['has_effect', 'lacks_effect'].includes(cond.type) && cond.effect_name && !entityLists.effects.includes(cond.effect_name)) {
      warnings.push(`Effect "${cond.effect_name}" not found`);
    }
    if (['has_item', 'lacks_item', 'item_quantity_lte'].includes(cond.type) && cond.item_name && !entityLists.items.includes(cond.item_name)) {
      warnings.push(`Item "${cond.item_name}" not found`);
    }
  }
  for (const action of (rule.actions || [])) {
    if (['apply_effect', 'remove_effect'].includes(action.type) && action.effect_name && !entityLists.effects.includes(action.effect_name)) {
      warnings.push(`Effect "${action.effect_name}" not found`);
    }
    if (['consume_item', 'grant_item'].includes(action.type) && action.item_name && !entityLists.items.includes(action.item_name)) {
      warnings.push(`Item "${action.item_name}" not found`);
    }
  }
  return warnings;
}

function summarizeConditionReadable(cond) {
  switch (cond.type) {
    case 'attribute_gte': return `${cond.attribute} >= ${cond.value}`;
    case 'attribute_lte': return `${cond.attribute} <= ${cond.value}`;
    case 'attribute_eq': return `${cond.attribute} == ${cond.value}`;
    case 'has_effect': return `Has effect: ${cond.effect_name}`;
    case 'lacks_effect': return `Lacks effect: ${cond.effect_name}`;
    case 'has_item': return `Has item: ${cond.item_name}`;
    case 'lacks_item': return `Lacks item: ${cond.item_name}`;
    case 'item_quantity_lte': return `${cond.item_name} qty <= ${cond.value}`;
    case 'character_type': return `Character is ${cond.value}`;
    case 'weather_is': return `Weather is ${cond.value}`;
    case 'weather_in': return `Weather in: ${(cond.values || []).join(', ')}`;
    case 'time_of_day_is': return `Time of day is ${cond.value}`;
    case 'time_between': return `Time between ${cond.from_hour}:00 and ${cond.to_hour}:00`;
    case 'location_is': return `At location #${cond.location_id}`;
    case 'location_property': return `Location ${cond.property} == ${cond.value}`;
    case 'random_chance': return `${Math.round((cond.probability || 0) * 100)}% chance`;
    case 'hours_since_last_rest': return `Hours since rest ${cond.operator || '??'} ${cond.hours}`;
    case 'season_is': return `Season is ${cond.value}`;
    case 'trait_equals': return `${cond.trait} is "${cond.value}"`;
    case 'trait_in': return `${cond.trait} in [${(cond.values || []).join(', ')}]`;
    default: return cond.type;
  }
}

function summarizeActionReadable(action) {
  switch (action.type) {
    case 'apply_effect': return `Apply effect: ${action.effect_name}`;
    case 'remove_effect': return `Remove effect: ${action.effect_name}`;
    case 'modify_attribute': return `Modify ${action.attribute} by ${action.delta > 0 ? '+' : ''}${action.delta}`;
    case 'consume_item': return `Consume ${action.quantity || 1}x ${action.item_name}`;
    case 'grant_item': return `Grant ${action.quantity || 1}x ${action.item_name}`;
    case 'set_weather': return `Set weather to ${action.weather}`;
    case 'set_environment_note': return `Set note: ${action.note}`;
    case 'advance_time': return `Advance time ${action.hours || 0}h ${action.minutes || 0}m`;
    case 'notify': return `Notify (${action.severity || 'info'}): ${action.message}`;
    case 'log': return `Log: ${action.message}`;
    case 'roll_dice': return `Roll ${action.formula} -> ${action.store_as}`;
    case 'random_from_list': return `Random from list -> ${action.store_as}`;
    default: return action.type;
  }
}

function summarizeTriggerConfig(type, config) {
  if (!config || Object.keys(config).length === 0) return null;
  switch (type) {
    case 'on_threshold':
      return `When ${config.attribute || '?'} crosses ${config.threshold ?? '?'} (${config.direction || 'either'})`;
    case 'on_schedule': {
      const parts = [];
      if (config.month) parts.push(`month ${config.month}`);
      if (config.day) parts.push(`day ${config.day}`);
      const time = `${config.hour ?? 0}:${String(config.minute ?? 0).padStart(2, '0')}`;
      parts.push(time);
      return `At ${parts.join(', ')}`;
    }
    case 'on_encounter':
      return config.encounter_type ? `On encounter (type: ${config.encounter_type})` : 'On any encounter';
    default:
      return null;
  }
}

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
  const [entityLists, setEntityLists] = useState(null);

  const load = async () => {
    if (!campaignId) return;
    let params = [];
    if (search) params.push(`search=${encodeURIComponent(search)}`);
    if (filterTrigger) params.push(`trigger_type=${filterTrigger}`);
    const data = await api.getRules(campaignId, params.join('&'));
    setRules(data);
  };

  useEffect(() => { load(); }, [campaignId, search, filterTrigger]);

  useEffect(() => {
    if (!campaignId) return;
    Promise.all([
      api.getItems(campaignId),
      api.getStatusEffects(campaignId),
      api.getLocations(campaignId),
      api.getCharacters(campaignId),
    ]).then(([items, effects, locData, characters]) => {
      setEntityLists({
        items: items.map(i => i.name),
        effects: effects.map(e => e.name),
        locations: locData.locations || locData,
        characters,
      });
    });
  }, [campaignId]);

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
    const previews = items.slice(0, 3).map(summarizeConditionReadable);
    const more = items.length > 3 ? ` +${items.length - 3} more` : '';
    return `${op}: ${previews.join('; ')}${more}`;
  };

  const summarizeActions = (actions) => {
    if (!actions || actions.length === 0) return 'No actions';
    const previews = actions.slice(0, 3).map(summarizeActionReadable);
    const more = actions.length > 3 ? ` +${actions.length - 3} more` : '';
    return previews.join('; ') + more;
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
          {rules.map(rule => {
            const warnings = getMissingPrereqs(rule, entityLists);
            return (
              <div key={rule.id} className="card" style={{ opacity: rule.enabled ? 1 : 0.5 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{rule.name}</span>
                      <span className="tag" style={{ fontSize: 10 }}>{triggerLabel(rule.trigger_type)}</span>
                      <span className={`tag ${rule.action_mode === 'auto' ? 'tag-buff' : ''}`} style={{ fontSize: 10 }}>
                        {rule.action_mode === 'auto' ? 'Auto' : 'Suggest'}
                      </span>
                      {warnings.length > 0 && (
                        <span className="tag" style={{ background: 'var(--yellow)', color: '#000', fontSize: 10 }}
                          title={warnings.join('\n')}>
                          {warnings.length} warning{warnings.length > 1 ? 's' : ''}
                        </span>
                      )}
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
                    {(() => {
                      const triggerSummary = summarizeTriggerConfig(rule.trigger_type, rule.trigger_config);
                      return triggerSummary ? (
                        <div style={{ marginBottom: 8 }}>
                          <strong>Trigger:</strong>{' '}
                          <span style={{ color: 'var(--text-secondary)' }}>{triggerSummary}</span>
                        </div>
                      ) : null;
                    })()}
                    <div style={{ marginBottom: 8 }}>
                      <strong>Conditions:</strong>
                      {(() => {
                        const tree = rule.conditions || {};
                        const items = tree.all || tree.any || [];
                        if (items.length === 0) return <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>None (always passes)</span>;
                        const op = tree.all ? 'ALL' : 'ANY';
                        return (
                          <>
                            <span style={{ color: 'var(--text-muted)', marginLeft: 4, fontSize: 11 }}>({op} must match)</span>
                            <ul style={{ margin: '4px 0 0 16px', padding: 0, listStyle: 'disc' }}>
                              {items.map((c, i) => (
                                <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 2 }}>
                                  {summarizeConditionReadable(c)}
                                </li>
                              ))}
                            </ul>
                          </>
                        );
                      })()}
                    </div>
                    <div>
                      <strong>Actions:</strong>
                      {(!rule.actions || rule.actions.length === 0) ? (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>None</span>
                      ) : (
                        <ol style={{ margin: '4px 0 0 16px', padding: 0 }}>
                          {rule.actions.map((a, i) => (
                            <li key={i} style={{ color: 'var(--text-secondary)', fontSize: 12, marginBottom: 2 }}>
                              {summarizeActionReadable(a)}
                            </li>
                          ))}
                        </ol>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showForm && (
        <RuleForm
          campaignId={campaignId}
          campaign={campaign}
          rule={editRule}
          entityLists={entityLists}
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

function TriggerConfigBuilder({ triggerType, value, onChange, campaign }) {
  if (NO_CONFIG_TRIGGERS.includes(triggerType)) return null;

  if (triggerType === 'on_threshold') {
    const attrs = campaign?.attribute_definitions || [];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Attribute</label>
          <select value={value?.attribute || ''} onChange={e => onChange({ ...value, attribute: e.target.value })}>
            <option value="">Select attribute...</option>
            {attrs.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Threshold Value</label>
          <input type="number" value={value?.threshold ?? ''} onChange={e => onChange({ ...value, threshold: Number(e.target.value) })} />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Direction</label>
          <select value={value?.direction || 'either'} onChange={e => onChange({ ...value, direction: e.target.value })}>
            <option value="falling">Falling</option>
            <option value="rising">Rising</option>
            <option value="either">Either</option>
          </select>
        </div>
      </div>
    );
  }

  if (triggerType === 'on_schedule') {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 80 }}>
          <label>Month</label>
          <input type="number" min="1" value={value?.month ?? ''} onChange={e => onChange({ ...value, month: Number(e.target.value) })} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 80 }}>
          <label>Day</label>
          <input type="number" min="1" value={value?.day ?? ''} onChange={e => onChange({ ...value, day: Number(e.target.value) })} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 80 }}>
          <label>Hour</label>
          <input type="number" min="0" max="23" value={value?.hour ?? ''} onChange={e => onChange({ ...value, hour: Number(e.target.value) })} />
        </div>
        <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 80 }}>
          <label>Minute</label>
          <input type="number" min="0" max="59" value={value?.minute ?? ''} onChange={e => onChange({ ...value, minute: Number(e.target.value) })} />
        </div>
      </div>
    );
  }

  if (triggerType === 'on_encounter') {
    return (
      <div className="form-group" style={{ marginBottom: 0 }}>
        <label>Encounter Type (optional)</label>
        <input type="text" value={value?.encounter_type || ''} onChange={e => onChange({ ...value, encounter_type: e.target.value })}
          placeholder="Leave blank for any encounter" />
      </div>
    );
  }

  // Fallback: raw JSON for unknown trigger types
  return (
    <textarea
      value={JSON.stringify(value || {}, null, 2)}
      onChange={e => { try { onChange(JSON.parse(e.target.value)); } catch {} }}
      rows={2}
      style={{ fontFamily: 'var(--font-mono)', fontSize: 12, width: '100%' }}
    />
  );
}

function TargetConfigPicker({ value, onChange, characters }) {
  const selectedIds = value?.character_ids || [];
  const chars = characters || [];

  const toggleChar = (id) => {
    const newIds = selectedIds.includes(id)
      ? selectedIds.filter(i => i !== id)
      : [...selectedIds, id];
    onChange({ character_ids: newIds });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 150, overflowY: 'auto',
      padding: 8, background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
      {chars.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: 4 }}>No characters in campaign</div>
      ) : (
        chars.map(c => (
          <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', padding: '2px 0' }}>
            <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => toggleChar(c.id)} />
            <span>{c.name}</span>
            <span className="tag" style={{ fontSize: 9 }}>{c.type}</span>
          </label>
        ))
      )}
    </div>
  );
}

function RuleForm({ campaignId, campaign, rule, entityLists, onClose, onSave }) {
  const [name, setName] = useState(rule?.name || '');
  const [description, setDescription] = useState(rule?.description || '');
  const [triggerType, setTriggerType] = useState(rule?.trigger_type || 'on_time_advance');
  const [actionMode, setActionMode] = useState(rule?.action_mode || 'auto');
  const [priority, setPriority] = useState(rule?.priority ?? 100);
  const [targetMode, setTargetMode] = useState(rule?.target_mode || 'environment');
  const [tagsStr, setTagsStr] = useState((rule?.tags || []).join(', '));
  const [triggerConfig, setTriggerConfig] = useState(rule?.trigger_config || {});
  const [showRawTrigger, setShowRawTrigger] = useState(false);
  const [rawTriggerStr, setRawTriggerStr] = useState(JSON.stringify(rule?.trigger_config || {}, null, 2));
  const [targetConfig, setTargetConfig] = useState(rule?.target_config || {});
  const [conditions, setConditions] = useState(rule?.conditions || { all: [] });
  const [actions, setActions] = useState(rule?.actions || []);
  const [useRawJson, setUseRawJson] = useState(false);
  const [rawConditions, setRawConditions] = useState(JSON.stringify(rule?.conditions || { all: [] }, null, 2));
  const [rawActions, setRawActions] = useState(JSON.stringify(rule?.actions || [], null, 2));

  const characters = entityLists?.characters || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    let finalTriggerConfig, target_config, finalConditions, finalActions;
    try {
      finalTriggerConfig = showRawTrigger ? JSON.parse(rawTriggerStr) : triggerConfig;
      target_config = targetConfig;
      if (useRawJson) {
        finalConditions = JSON.parse(rawConditions);
        finalActions = JSON.parse(rawActions);
      } else {
        finalConditions = stripIds(conditions);
        finalActions = stripIds(actions);
      }
    } catch {
      alert('Invalid JSON in one of the fields');
      return;
    }
    if (targetMode === 'environment') {
      const charActions = finalActions.filter(a => CHARACTER_ONLY_ACTIONS.has(a.type));
      const condItems = finalConditions.all || finalConditions.any || [];
      const charConds = condItems.filter(c => CHARACTER_ONLY_CONDITIONS.has(c.type));
      if (charActions.length > 0 || charConds.length > 0) {
        const issues = [];
        if (charActions.length > 0) {
          issues.push('Actions that require a character target:');
          charActions.forEach(a => issues.push(`  - ${summarizeActionReadable(a)}`));
        }
        if (charConds.length > 0) {
          issues.push('Conditions that require a character target:');
          charConds.forEach(c => issues.push(`  - ${summarizeConditionReadable(c)}`));
        }
        if (!confirm(`This rule targets "Environment" but has:\n\n${issues.join('\n')}\n\nThese will have no effect without a character target. Save anyway?`)) {
          return;
        }
      }
    }
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    const data = {
      name, description, trigger_type: triggerType, trigger_config: finalTriggerConfig,
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
      setRawConditions(JSON.stringify(stripIds(conditions), null, 2));
      setRawActions(JSON.stringify(stripIds(actions), null, 2));
    }
    setUseRawJson(!useRawJson);
  };

  const needsTriggerConfig = !NO_CONFIG_TRIGGERS.includes(triggerType);

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
                <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}); }}>
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

            {needsTriggerConfig && (
              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label style={{ marginBottom: 0 }}>Trigger Config</label>
                  <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 10 }}
                    onClick={() => {
                      if (showRawTrigger) {
                        try { setTriggerConfig(JSON.parse(rawTriggerStr)); } catch {}
                      } else {
                        setRawTriggerStr(JSON.stringify(triggerConfig, null, 2));
                      }
                      setShowRawTrigger(!showRawTrigger);
                    }}>
                    {showRawTrigger ? 'Builder' : 'Raw JSON'}
                  </button>
                </div>
                {showRawTrigger ? (
                  <textarea value={rawTriggerStr} onChange={e => setRawTriggerStr(e.target.value)} rows={2}
                    style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }} />
                ) : (
                  <TriggerConfigBuilder triggerType={triggerType} value={triggerConfig} onChange={setTriggerConfig} campaign={campaign} />
                )}
              </div>
            )}

            {targetMode === 'specific' && (
              <div className="form-group">
                <label>Target Characters</label>
                <TargetConfigPicker value={targetConfig} onChange={setTargetConfig} characters={characters} />
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
                  <ConditionBuilder value={conditions} onChange={setConditions} entityLists={entityLists} campaign={campaign} />
                </div>
                <div className="form-group">
                  <label>Actions</label>
                  <ActionBuilder value={actions} onChange={setActions} entityLists={entityLists} campaign={campaign} />
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
