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
  { value: 'on_round_advance', label: 'Round Advance' },
];

const NO_CONFIG_TRIGGERS = ['on_time_advance', 'on_rest', 'on_effect_change', 'on_item_change', 'on_location_change', 'on_round_advance'];

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

function relativeTime(dateStr) {
  if (!dateStr) return null;
  const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'just now';
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

function flattenConditions(node) {
  if (!node) return [];
  if (node.all) return node.all.flatMap(flattenConditions);
  if (node.any) return node.any.flatMap(flattenConditions);
  if (node.not) return flattenConditions(node.not);
  return [node];
}

function extractRuleReferenceText(rule) {
  const parts = [];
  for (const cond of flattenConditions(rule.conditions)) {
    if (cond.effect_name) parts.push(cond.effect_name);
    if (cond.item_name) parts.push(cond.item_name);
    if (cond.attribute) parts.push(cond.attribute);
    if (cond.trait) parts.push(cond.trait);
    if (cond.value != null) parts.push(String(cond.value));
    if (cond.values) parts.push(...cond.values.map(String));
    if (cond.location_id != null) parts.push(String(cond.location_id));
    if (cond.property) parts.push(cond.property);
  }
  for (const action of (rule.actions || [])) {
    if (action.effect_name) parts.push(action.effect_name);
    if (action.item_name) parts.push(action.item_name);
    if (action.weather) parts.push(action.weather);
    if (action.attribute) parts.push(action.attribute);
    if (action.message) parts.push(action.message);
    if (action.note) parts.push(action.note);
  }
  return parts.join(' ').toLowerCase();
}

function conditionParts(cond) {
  switch (cond.type) {
    case 'attribute_gte': return { label: `${cond.attribute} >=`, detail: String(cond.value) };
    case 'attribute_lte': return { label: `${cond.attribute} <=`, detail: String(cond.value) };
    case 'attribute_eq': return { label: `${cond.attribute} ==`, detail: String(cond.value) };
    case 'has_effect': return { label: 'Has Effect', detail: cond.effect_name };
    case 'lacks_effect': return { label: 'Lacks Effect', detail: cond.effect_name };
    case 'has_item': return { label: 'Has Item', detail: cond.item_name };
    case 'lacks_item': return { label: 'Lacks Item', detail: cond.item_name };
    case 'item_quantity_lte': return { label: `${cond.item_name} qty <=`, detail: String(cond.value) };
    case 'character_type': return { label: 'Character', detail: cond.value };
    case 'weather_is': return { label: 'Weather', detail: cond.value };
    case 'weather_in': return { label: 'Weather In', detail: (cond.values || []).join(', ') };
    case 'time_of_day_is': return { label: 'Time of Day', detail: cond.value };
    case 'time_between': return { label: 'Time Between', detail: `${cond.from_hour}:00–${cond.to_hour}:00` };
    case 'location_is': return { label: 'At Location', detail: `#${cond.location_id}` };
    case 'location_property': return { label: `Location ${cond.property}`, detail: String(cond.value) };
    case 'random_chance': return { label: 'Chance', detail: `${Math.round((cond.probability || 0) * 100)}%` };
    case 'hours_since_last_rest': return { label: 'Hours Since Rest', detail: `${cond.operator || '??'} ${cond.hours}` };
    case 'season_is': return { label: 'Season', detail: cond.value };
    case 'trait_equals': return { label: cond.trait, detail: `"${cond.value}"` };
    case 'trait_in': return { label: cond.trait, detail: `[${(cond.values || []).join(', ')}]` };
    default: return { label: cond.type, detail: '' };
  }
}

function actionParts(action) {
  switch (action.type) {
    case 'apply_effect': return { label: 'Apply Effect', detail: action.effect_name };
    case 'remove_effect': return { label: 'Remove Effect', detail: action.effect_name };
    case 'modify_attribute': return { label: 'Modify', detail: `${action.attribute} by ${action.delta > 0 ? '+' : ''}${action.delta}` };
    case 'consume_item': return { label: 'Consume', detail: `${action.quantity || 1}× ${action.item_name}` };
    case 'grant_item': return { label: 'Grant', detail: `${action.quantity || 1}× ${action.item_name}` };
    case 'set_weather': return { label: 'Set Weather', detail: action.weather };
    case 'set_environment_note': return { label: 'Set Note', detail: action.note };
    case 'advance_time': return { label: 'Advance Time', detail: `${action.hours || 0}h ${action.minutes || 0}m` };
    case 'notify': return { label: 'Notify', detail: `(${action.severity || 'info'}): ${action.message}` };
    case 'log': return { label: 'Log', detail: action.message };
    case 'roll_dice': return { label: 'Roll Dice', detail: `${action.formula} → ${action.store_as}` };
    case 'random_from_list': return { label: 'Random List', detail: `→ ${action.store_as}` };
    default: return { label: action.type, detail: '' };
  }
}

function renderConditionTree(node, depth = 0) {
  if (!node) return null;
  if (node.all || node.any) {
    const op = node.all ? 'ALL' : 'ANY';
    const children = node.all || node.any;
    return (
      <div style={depth > 0 ? { borderLeft: '2px solid var(--border)', paddingLeft: 10, marginLeft: 4, marginTop: 4 } : {}}>
        <span className="tag" style={{ fontSize: 9 }}>{op}</span>
        {children.map((child, i) => (
          <div key={i}>{renderConditionTree(child, depth + 1)}</div>
        ))}
      </div>
    );
  }
  if (node.not) {
    return (
      <div style={{ borderLeft: '2px solid var(--border)', paddingLeft: 10, marginLeft: 4, marginTop: 4 }}>
        <span className="tag" style={{ fontSize: 9 }}>NOT</span>
        {renderConditionTree(node.not, depth + 1)}
      </div>
    );
  }
  const { label, detail } = conditionParts(node);
  return (
    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2, marginTop: 2 }}>
      <span className="tag" style={{ fontSize: 9 }}>{label}</span> {detail}
    </div>
  );
}

export default function RulesPage({ campaignId, campaign }) {
  const [rules, setRules] = useState([]);
  const [search, setSearch] = useState('');
  const [filterTrigger, setFilterTrigger] = useState('');
  const [filterEnabled, setFilterEnabled] = useState('');
  const [filterMode, setFilterMode] = useState('');
  const [filterTarget, setFilterTarget] = useState('');
  const [filterTags, setFilterTags] = useState([]);
  const [filterRef, setFilterRef] = useState('');
  const [sortBy, setSortBy] = useState('priority');
  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [testRule, setTestRule] = useState(null);
  const [entityLists, setEntityLists] = useState(null);
  const [overflowMenuId, setOverflowMenuId] = useState(null);

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

  useEffect(() => {
    if (overflowMenuId === null) return;
    const handler = (e) => {
      if (!e.target.closest('[data-overflow-menu]')) {
        setOverflowMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [overflowMenuId]);

  const allTags = [...new Set(rules.flatMap(r => r.tags || []))].sort();

  const activeFilterCount = [
    filterMode, filterTarget, filterEnabled, filterRef
  ].filter(Boolean).length + (filterTags.length > 0 ? 1 : 0);

  const clearAllFilters = () => {
    setFilterEnabled('');
    setFilterMode('');
    setFilterTarget('');
    setFilterTags([]);
    setFilterRef('');
  };

  const displayRules = rules
    .filter(r => filterEnabled === '' ? true : filterEnabled === 'enabled' ? r.enabled : !r.enabled)
    .filter(r => !filterMode || r.action_mode === filterMode)
    .filter(r => !filterTarget || r.target_mode === filterTarget)
    .filter(r => filterTags.length === 0 || filterTags.some(t => (r.tags || []).includes(t)))
    .filter(r => !filterRef || extractRuleReferenceText(r).includes(filterRef.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'name': return a.name.localeCompare(b.name);
        case 'last_triggered': return (b.last_triggered_at || '').localeCompare(a.last_triggered_at || '');
        case 'newest': return b.id - a.id;
        default: return a.priority - b.priority;
      }
    });

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete rule "${name}"?`)) return;
    await api.deleteRule(campaignId, id);
    load();
  };

  const handleToggle = async (id) => {
    await api.toggleRule(campaignId, id);
    load();
  };

  const handleDuplicate = async (rule) => {
    const { id, created_at, updated_at, ...data } = rule;
    await api.createRule(campaignId, { ...data, name: `${data.name} (copy)` });
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
    a.download = 'steward-rules.json';
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
      <div className="search-bar" style={{ flexWrap: 'wrap' }}>
        <input type="text" placeholder="Search rules..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1, minWidth: 140 }} />
        <select value={filterTrigger} onChange={e => setFilterTrigger(e.target.value)} style={{ width: 160 }}>
          <option value="">All triggers</option>
          {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <select value={filterMode} onChange={e => setFilterMode(e.target.value)} style={{ width: 120 }}>
          <option value="">All modes</option>
          {ACTION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={filterTarget} onChange={e => setFilterTarget(e.target.value)} style={{ width: 140 }}>
          <option value="">All targets</option>
          {TARGET_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select value={filterEnabled} onChange={e => setFilterEnabled(e.target.value)} style={{ width: 130 }}>
          <option value="">All rules</option>
          <option value="enabled">Enabled only</option>
          <option value="disabled">Disabled only</option>
        </select>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} style={{ width: 150 }}>
          <option value="priority">Sort: Priority</option>
          <option value="name">Sort: Name</option>
          <option value="last_triggered">Sort: Last Fired</option>
          <option value="newest">Sort: Newest</option>
        </select>
      </div>
      {(allTags.length > 0 || activeFilterCount > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6, marginBottom: 12 }}>
          <input
            type="text"
            placeholder="Search references (effects, items, attributes...)"
            value={filterRef}
            onChange={e => setFilterRef(e.target.value)}
            style={{ width: 260, fontSize: 12, padding: '3px 8px' }}
          />
          {allTags.length > 0 && (
            <>
              <span style={{ width: 1, height: 16, background: 'var(--border)', flexShrink: 0 }} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Tags:</span>
              {allTags.map(tag => (
                <span
                  key={tag}
                  className={`tag ${filterTags.includes(tag) ? 'tag-buff' : ''}`}
                  style={{ cursor: 'pointer', fontSize: 11 }}
                  onClick={() => setFilterTags(prev =>
                    prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
                  )}
                >{tag}</span>
              ))}
            </>
          )}
          {activeFilterCount > 0 && (
            <button className="btn btn-ghost btn-sm" onClick={clearAllFilters}>
              Clear filters ({activeFilterCount})
            </button>
          )}
        </div>
      )}
      {displayRules.length === 0 ? (
        <div className="empty-state"><p>{rules.length === 0 ? 'No rules defined yet. Create rules to automate game-world changes.' : `No rules match the current filters.${activeFilterCount > 0 ? ' Try clearing some filters.' : ''}`}</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {displayRules.map(rule => {
            const warnings = getMissingPrereqs(rule, entityLists);
            return (
              <div key={rule.id} className="card" style={{ opacity: rule.enabled ? 1 : 0.5, borderLeft: rule.action_mode === 'auto' ? '3px solid var(--green)' : '3px solid transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === rule.id ? null : rule.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', transition: 'transform 0.15s', transform: expandedId === rule.id ? 'rotate(90deg)' : 'none' }}>&#x25B6;</span>
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
                    <div className="inline-flex gap-sm mt-sm" style={{ fontSize: 11, color: 'var(--text-muted)', width: '100%' }}>
                      <span>Priority: {rule.priority}</span>
                      <span>Target: {rule.target_mode}</span>
                      {rule.tags.length > 0 && rule.tags.map(t => (
                        <span key={t} className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>{t}</span>
                      ))}
                      {rule.last_triggered_at && (() => {
                        const firedDate = new Date(rule.last_triggered_at.endsWith('Z') ? rule.last_triggered_at : rule.last_triggered_at + 'Z');
                        const isRecent = (Date.now() - firedDate.getTime()) < 60 * 60 * 1000;
                        return (
                          <span title={rule.last_triggered_at} style={{ marginLeft: 'auto', color: isRecent ? 'var(--accent)' : 'var(--text-muted)' }}>
                            Fired: {relativeTime(rule.last_triggered_at)}
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="inline-flex gap-sm">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditRule(rule); setShowForm(true); }}>Edit</button>
                    <div style={{ position: 'relative' }} data-overflow-menu>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 16, lineHeight: 1, padding: '2px 6px' }}
                        onClick={(e) => { e.stopPropagation(); setOverflowMenuId(overflowMenuId === rule.id ? null : rule.id); }}>
                        &#x22EF;
                      </button>
                      {overflowMenuId === rule.id && (
                        <div style={{
                          position: 'absolute', top: '100%', right: 0, zIndex: 10,
                          background: 'var(--bg-card)', border: '1px solid var(--border)',
                          borderRadius: 'var(--radius-sm)', boxShadow: 'var(--shadow)',
                          minWidth: 140, padding: '4px 0'
                        }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-ghost btn-sm" style={{ width: '100%', textAlign: 'left', borderRadius: 0, padding: '6px 12px', justifyContent: 'flex-start' }}
                            onClick={() => { handleToggle(rule.id); setOverflowMenuId(null); }}>
                            {rule.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ width: '100%', textAlign: 'left', borderRadius: 0, padding: '6px 12px', justifyContent: 'flex-start' }}
                            onClick={() => { setTestRule(rule); setOverflowMenuId(null); }}>
                            Test
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ width: '100%', textAlign: 'left', borderRadius: 0, padding: '6px 12px', justifyContent: 'flex-start' }}
                            onClick={() => { handleDuplicate(rule); setOverflowMenuId(null); }}>
                            Duplicate
                          </button>
                          <button className="btn btn-ghost btn-sm" style={{ width: '100%', textAlign: 'left', borderRadius: 0, padding: '6px 12px', justifyContent: 'flex-start', borderTop: '1px solid var(--border)', color: 'var(--red)' }}
                            onClick={() => { handleDelete(rule.id, rule.name); setOverflowMenuId(null); }}>
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
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
                        const hasContent = tree.all || tree.any || tree.not || tree.type;
                        if (!hasContent) return <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>None (always passes)</span>;
                        return <div style={{ marginTop: 4 }}>{renderConditionTree(tree)}</div>;
                      })()}
                    </div>
                    <div>
                      <strong>Actions:</strong>
                      {(!rule.actions || rule.actions.length === 0) ? (
                        <span style={{ color: 'var(--text-muted)', marginLeft: 4 }}>None</span>
                      ) : (
                        <div style={{ marginTop: 4 }}>
                          {rule.actions.map((a, i) => {
                            const { label, detail } = actionParts(a);
                            return (
                              <div key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>
                                <span className="tag" style={{ fontSize: 9 }}>{label}</span> {detail}
                              </div>
                            );
                          })}
                        </div>
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
          onSaveAndTest={async (savedRule) => { setShowForm(false); setEditRule(null); await load(); setTestRule(savedRule); }}
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

function RuleForm({ campaignId, campaign, rule, entityLists, onClose, onSave, onSaveAndTest }) {
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
  const hasAdvancedValues = rule && (rule.priority !== 100 || rule.target_mode !== 'environment' || (rule.tags || []).length > 0);
  const [showAdvanced, setShowAdvanced] = useState(!!hasAdvancedValues);

  const characters = entityLists?.characters || [];

  const buildData = () => {
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
      return null;
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
          return null;
        }
      }
    }
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean);
    return {
      name, description, trigger_type: triggerType, trigger_config: finalTriggerConfig,
      conditions: finalConditions, actions: finalActions,
      action_mode: actionMode, priority, tags, target_mode: targetMode, target_config,
    };
  };

  const saveRule = async () => {
    const data = buildData();
    if (!data) return null;
    if (rule) {
      await api.updateRule(campaignId, rule.id, data);
      return { id: rule.id, name: data.name };
    } else {
      const created = await api.createRule(campaignId, data);
      return { id: created.id, name: data.name };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const saved = await saveRule();
    if (saved) onSave();
  };

  const handleSaveAndTest = async () => {
    const saved = await saveRule();
    if (saved) onSaveAndTest(saved);
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
          <h3>{rule ? <>Edit Rule <span style={{ fontWeight: 400 }}>&mdash; {rule.name}</span></> : 'New Rule'}</h3>
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
                <label>Trigger Type <span style={{ cursor: 'help', color: 'var(--text-muted)' }} title="When this rule is evaluated (e.g. every time advance, on rest, when items change)">(?)</span></label>
                <select value={triggerType} onChange={e => { setTriggerType(e.target.value); setTriggerConfig({}); }}>
                  {TRIGGER_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Action Mode <span style={{ cursor: 'help', color: 'var(--text-muted)' }} title="Auto-apply: actions run silently. Suggest: creates a notification for DM approval before executing.">(?)</span></label>
                <select value={actionMode} onChange={e => setActionMode(e.target.value)}>
                  {ACTION_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
            </div>

            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdvanced(!showAdvanced)}
              style={{ fontSize: 11, color: 'var(--text-muted)', padding: '4px 0', marginBottom: showAdvanced ? 0 : 4 }}>
              <span style={{ display: 'inline-block', transition: 'transform 0.15s', transform: showAdvanced ? 'rotate(90deg)' : 'none', marginRight: 4 }}>&#x25B6;</span>
              Advanced{!showAdvanced && targetMode !== 'environment' ? ` (target: ${targetMode})` : ''}
            </button>
            {showAdvanced && (
              <>
                <div className="form-row">
                  <div className="form-group">
                    <label>Priority <span style={{ cursor: 'help', color: 'var(--text-muted)' }} title="Lower numbers run first when multiple rules trigger simultaneously. Default: 100.">(?)</span></label>
                    <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label>Target Mode <span style={{ cursor: 'help', color: 'var(--text-muted)' }} title="Environment: rule runs once globally. Character targets: rule runs once per matching character, enabling per-character conditions and actions.">(?)</span></label>
                    <select value={targetMode} onChange={e => setTargetMode(e.target.value)}>
                      {TARGET_MODES.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label>Tags <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>(comma-separated)</span></label>
                  <input type="text" value={tagsStr} onChange={e => setTagsStr(e.target.value)} placeholder="survival, combat, ..." />
                </div>
              </>
            )}

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
            <button type="button" className="btn btn-ghost btn-sm" onClick={handleSaveAndTest}
              title="Saves the rule and opens the test panel">Save & Test</button>
            <button type="submit" className="btn btn-primary">{rule ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
