import React, { useState, useEffect, useRef } from 'react';
import * as api from '../api';
import { useToast } from './ToastContext';
import PresetBuilder from './PresetBuilder';

export default function TagPresetBrowser({ campaignId, campaign, onClose, onImported }) {
  const [presets, setPresets] = useState([]);
  const [categories, setCategories] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [importing, setImporting] = useState(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [addingToLibrary, setAddingToLibrary] = useState(false);
  const fileInputRef = useRef(null);
  const { addToast } = useToast();

  const loadPresets = () => {
    api.getTagPresets(campaignId).then(data => {
      setPresets(data.presets || []);
      setCategories(data.categories || {});
    }).catch(() => {});
  };

  useEffect(() => { loadPresets(); }, [campaignId]);

  const filtered = activeCategory === 'all'
    ? presets
    : presets.filter(p => p.category === activeCategory);

  const handleImport = async (presetKey) => {
    setImporting(presetKey);
    try {
      const result = await api.importTagPreset(campaignId, presetKey);
      const parts = [];
      if (result.attribute_added) parts.push('attribute created');
      if (result.options_merged) parts.push('options merged');
      if (result.rules_created > 0) parts.push(`${result.rules_created} rule${result.rules_created > 1 ? 's' : ''} created`);
      addToast(parts.length ? `Preset imported: ${parts.join(', ')}` : 'Preset imported (no changes)', 'success');
      onImported?.();
    } catch (e) {
      addToast(`Import failed: ${e.message}`, 'error');
    } finally {
      setImporting(null);
    }
  };

  const handleExport = async (presetKey) => {
    try {
      const data = await api.exportCustomPreset(campaignId, presetKey);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `preset-${presetKey}.json`;
      a.click();
      URL.revokeObjectURL(url);
      addToast('Preset exported', 'success');
    } catch (e) {
      addToast(`Export failed: ${e.message}`, 'error');
    }
  };

  const handleDelete = async (presetKey, presetName) => {
    if (!confirm(`Delete custom preset "${presetName}"? This only removes it from your library — already-imported rules are not affected.`)) return;
    try {
      await api.deleteCustomPreset(campaignId, presetKey);
      addToast('Preset deleted', 'success');
      loadPresets();
    } catch (e) {
      addToast(`Delete failed: ${e.message}`, 'error');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.dndapp_preset || !data.attribute || !data.name) {
          addToast('Invalid preset file — missing required fields (dndapp_preset, name, attribute)', 'error');
          return;
        }
        setFilePreview(data);
      } catch {
        addToast('Invalid JSON file', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleAddToLibrary = async () => {
    if (!filePreview) return;
    setAddingToLibrary(true);
    try {
      await api.createCustomPreset(campaignId, {
        name: filePreview.name,
        description: filePreview.description || '',
        attribute: filePreview.attribute,
        rules: filePreview.rules || [],
      });
      addToast('Preset added to library', 'success');
      setFilePreview(null);
      loadPresets();
    } catch (e) {
      addToast(`Failed to add preset: ${e.message}`, 'error');
    } finally {
      setAddingToLibrary(false);
    }
  };

  if (showBuilder) {
    return (
      <PresetBuilder
        campaignId={campaignId}
        campaign={campaign}
        onClose={() => setShowBuilder(false)}
        onSaved={() => { setShowBuilder(false); loadPresets(); }}
      />
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Tag Attribute Presets</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
            Import predefined tag attributes with bundled rules. Importing adds the attribute definition and creates companion rules.
          </p>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowBuilder(true)}>+ Create Preset</button>
            <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>Import from File</button>
            <input ref={fileInputRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileSelect} />
          </div>

          {/* File preview card */}
          {filePreview && (
            <div className="card" style={{ padding: 12, marginBottom: 12, border: '2px solid var(--primary)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{filePreview.name}</span>
                    <span className="tag" style={{ fontSize: 9 }}>From File</span>
                    {(filePreview.rules?.length || 0) > 0 && (
                      <span className="tag tag-buff" style={{ fontSize: 9 }}>
                        {filePreview.rules.length} rule{filePreview.rules.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {filePreview.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{filePreview.description}</div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{filePreview.attribute.key}</span>
                    {' \u2014 '}
                    {(filePreview.attribute.options || []).join(', ')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-primary btn-sm" onClick={handleAddToLibrary} disabled={addingToLibrary}>
                    {addingToLibrary ? '...' : 'Add to Library'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setFilePreview(null)}>&#x2715;</button>
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${activeCategory === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveCategory('all')}>All</button>
            {Object.entries(categories).map(([key, label]) => (
              <button key={key} className={`btn btn-sm ${activeCategory === key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveCategory(key)}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(preset => (
              <div key={preset.key} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{preset.name}</span>
                      <span className="tag" style={{ fontSize: 9 }}>{preset.category_label}</span>
                      {preset.source === 'custom' && (
                        <span className="tag" style={{ fontSize: 9, background: 'var(--primary)', color: 'white' }}>Custom</span>
                      )}
                      {preset.rules.length > 0 && (
                        <span className="tag tag-buff" style={{ fontSize: 9 }}>
                          {preset.rules.length} rule{preset.rules.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{preset.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{preset.attribute.key}</span>
                      {' \u2014 '}
                      {preset.attribute.options.join(', ')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {preset.source === 'custom' && (
                      <>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleExport(preset.key)}>Export</button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDelete(preset.key, preset.name)}>Delete</button>
                      </>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleImport(preset.key)}
                      disabled={importing === preset.key}
                    >
                      {importing === preset.key ? '...' : 'Import'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="empty-state"><p>No presets in this category.</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
