import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { ModifierSummary } from '../components/ModifierDisplay';
import ImportPreviewModal from '../components/ImportPreviewModal';
import RuleRefBadge from '../components/RuleRefBadge';

export default function ItemsPage({ campaignId, campaign }) {
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showImport, setShowImport] = useState(false);

  const load = async () => {
    if (!campaignId) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (typeFilter) params.set('item_type', typeFilter);
    const data = await api.getItems(campaignId, params.toString());
    setItems(data);
  };

  useEffect(() => { load(); }, [campaignId, search, typeFilter]);

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? It will be removed from all characters.`)) return;
    await api.deleteItem(campaignId, id);
    load();
  };

  // Get unique item types for filter
  const itemTypes = [...new Set(items.map(i => i.item_type).filter(Boolean))];
  const attrs = campaign?.attribute_definitions || [];

  const handleExport = async () => {
    const data = await api.getItems(campaignId);
    const blob = new Blob([JSON.stringify({ items: data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'almanac-items.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Items Library</h2>
        <div className="inline-flex gap-sm">
          <button className="btn btn-secondary btn-sm" onClick={handleExport}>Export</button>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowImport(true)}>Import</button>
          <button className="btn btn-primary" onClick={() => { setEditItem(null); setShowForm(true); }}>+ New Item</button>
        </div>
      </div>
      <div className="search-bar">
        <input type="text" placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">All Types</option>
          {itemTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {items.length === 0 ? (
        <div className="empty-state"><p>No items defined yet.</p></div>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Modifiers</th>
              <th>Properties</th>
              <th style={{ width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(i => (
              <tr key={i.id}>
                <td>
                  <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center' }}>
                    {i.name}
                    <RuleRefBadge campaignId={campaignId} entityType="item" entityName={i.name} />
                  </div>
                  {i.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{i.description}</div>}
                </td>
                <td><span className="tag">{i.item_type}</span></td>
                <td><ModifierSummary modifiers={i.modifiers} /></td>
                <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                  {Object.entries(i.properties || {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '--'}
                </td>
                <td>
                  <div className="inline-flex gap-sm">
                    <button className="btn btn-ghost btn-sm" onClick={() => { setEditItem(i); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(i.id, i.name)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showForm && (
        <ItemForm
          campaignId={campaignId}
          item={editItem}
          attrs={attrs}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSave={() => { setShowForm(false); setEditItem(null); load(); }}
        />
      )}
      {showImport && (
        <ImportPreviewModal
          campaignId={campaignId}
          onClose={() => setShowImport(false)}
          onComplete={load}
          initialEntityTypes={['items']}
          lockEntityTypes={true}
        />
      )}
    </div>
  );
}

function ItemForm({ campaignId, item, attrs, onClose, onSave }) {
  const [name, setName] = useState(item?.name || '');
  const [description, setDescription] = useState(item?.description || '');
  const [itemType, setItemType] = useState(item?.item_type || 'misc');
  const [stackable, setStackable] = useState(item?.stackable || false);
  const [propsStr, setPropsStr] = useState(() => {
    const p = item?.properties || {};
    return Object.entries(p).map(([k, v]) => `${k}: ${v}`).join('\n');
  });
  const [modifiers, setModifiers] = useState(item?.modifiers || []);

  const addModifier = () => setModifiers([...modifiers, { attribute: attrs[0]?.key || '', delta: 0 }]);
  const removeModifier = (i) => setModifiers(modifiers.filter((_, idx) => idx !== i));
  const updateModifier = (i, field, value) => {
    const updated = [...modifiers];
    updated[i] = { ...updated[i], [field]: field === 'delta' ? Number(value) : value };
    setModifiers(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const properties = {};
    propsStr.split('\n').forEach(line => {
      const [k, ...rest] = line.split(':');
      if (k?.trim() && rest.length) properties[k.trim()] = rest.join(':').trim();
    });
    const data = { name, description, item_type: itemType, stackable, properties, modifiers };
    if (item) {
      await api.updateItem(campaignId, item.id, data);
    } else {
      await api.createItem(campaignId, data);
    }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{item ? 'Edit Item' : 'New Item'}</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label>Name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Item Type</label>
                <input type="text" value={itemType} onChange={e => setItemType(e.target.value)} placeholder="weapon, armor, consumable..." />
              </div>
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} />
            </div>
            <div className="form-group">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={stackable} onChange={e => setStackable(e.target.checked)} />
                Stackable
              </label>
            </div>
            <div className="form-group">
              <label>Properties (one per line, key: value)</label>
              <textarea value={propsStr} onChange={e => setPropsStr(e.target.value)} rows={3} placeholder="weight: 5&#10;rarity: uncommon" />
            </div>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>Modifiers</label>
              <button type="button" className="btn btn-secondary btn-sm" onClick={addModifier}>+ Add Modifier</button>
            </div>
            {modifiers.map((m, i) => (
              <div key={i} className="form-row" style={{ marginBottom: 8, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Attribute</label>
                  <select value={m.attribute} onChange={e => updateModifier(i, 'attribute', e.target.value)}>
                    {attrs.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label>Delta</label>
                  <input type="number" value={m.delta} onChange={e => updateModifier(i, 'delta', e.target.value)} />
                </div>
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeModifier(i)}>&#x2715;</button>
              </div>
            ))}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{item ? 'Save' : 'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}
