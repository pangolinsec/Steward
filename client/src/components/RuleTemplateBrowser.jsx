import React, { useState, useEffect } from 'react';
import * as api from '../api';
import { useToast } from './ToastContext';

export default function RuleTemplateBrowser({ campaignId, onClose, onImported }) {
  const [templates, setTemplates] = useState([]);
  const [categories, setCategories] = useState({});
  const [activeCategory, setActiveCategory] = useState('all');
  const [importing, setImporting] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    api.getRuleTemplates(campaignId).then(data => {
      setTemplates(data.templates || []);
      setCategories(data.categories || {});
    }).catch(() => {});
  }, [campaignId]);

  const filtered = activeCategory === 'all'
    ? templates
    : templates.filter(t => t.category === activeCategory);

  const handleImport = async (templateKey) => {
    setImporting(templateKey);
    try {
      await api.importRuleTemplate(campaignId, templateKey);
      addToast('Template imported as new rule', 'success');
      onImported?.();
    } catch (e) {
      addToast(`Import failed: ${e.message}`, 'error');
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Rule Templates</h3>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div style={{ display: 'flex', gap: 4, marginBottom: 16, flexWrap: 'wrap' }}>
            <button className={`btn btn-sm ${activeCategory === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setActiveCategory('all')}>All</button>
            {Object.entries(categories).map(([key, label]) => (
              <button key={key} className={`btn btn-sm ${activeCategory === key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setActiveCategory(key)}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map(template => (
              <div key={template.key} className="card" style={{ padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 600, fontSize: 14 }}>{template.name}</span>
                      <span className="tag" style={{ fontSize: 9 }}>{template.category_label}</span>
                      <span className={`tag ${template.action_mode === 'auto' ? 'tag-buff' : ''}`} style={{ fontSize: 9 }}>
                        {template.action_mode === 'auto' ? 'Auto' : 'Suggest'}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{template.description}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                      Trigger: {template.trigger_type} | Target: {template.target_mode} | Actions: {template.actions.map(a => a.type).join(', ')}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleImport(template.key)}
                    disabled={importing === template.key}
                  >
                    {importing === template.key ? '...' : 'Import'}
                  </button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="empty-state"><p>No templates in this category.</p></div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
