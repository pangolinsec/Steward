import React, { useState, useRef } from 'react';
import * as api from '../api';

const ENTITY_DISPLAY = {
  status_effects: 'Status Effects',
  items: 'Items',
  characters: 'Characters',
  encounters: 'Encounters',
  rules: 'Rules',
};

const ALL_ENTITY_TYPES = ['status_effects', 'items', 'characters', 'encounters', 'rules'];

export default function ImportPreviewModal({ campaignId, onClose, onComplete, initialEntityTypes, lockEntityTypes }) {
  const [step, setStep] = useState('select');  // select | resolve | result
  const [selectedTypes, setSelectedTypes] = useState(initialEntityTypes || ALL_ENTITY_TYPES);
  const [fileData, setFileData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [prerequisites, setPrerequisites] = useState([]);
  const [decisions, setDecisions] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef();

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      setFileData(data);
      setFileName(file.name);
    } catch {
      setError('Invalid JSON file');
      setFileData(null);
    }
  };

  const toggleType = (type) => {
    if (lockEntityTypes) return;
    setSelectedTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handlePreview = async () => {
    if (!fileData || selectedTypes.length === 0) return;
    setLoading(true);
    setError('');
    try {
      const res = await api.previewImport(campaignId, fileData, selectedTypes);
      setPreview(res.preview);
      setWarnings(res.warnings || []);
      setPrerequisites(res.prerequisites || []);
      // Initialize decisions with bulk defaults
      const initDecisions = {};
      for (const key of selectedTypes) {
        initDecisions[key] = { _bulk: 'skip' };
      }
      setDecisions(initDecisions);
      setStep('resolve');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const setBulkAction = (entityKey, action) => {
    setDecisions(prev => ({
      ...prev,
      [entityKey]: { ...prev[entityKey], _bulk: action },
    }));
  };

  const setEntityAction = (entityKey, name, action) => {
    setDecisions(prev => ({
      ...prev,
      [entityKey]: { ...prev[entityKey], [name]: action },
    }));
  };

  const handleImport = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.mergeImport(campaignId, fileData, selectedTypes, decisions);
      setResult(res);
      setStep('result');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (step === 'result') onComplete?.();
    onClose();
  };

  const stepIndex = step === 'select' ? 0 : step === 'resolve' ? 1 : 2;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Import Data</h3>
          <button className="btn btn-ghost btn-sm" onClick={handleClose}>&#x2715;</button>
        </div>
        <div className="modal-body">
          <div className="import-step-indicator">
            {['Select', 'Resolve', 'Result'].map((label, i) => (
              <div key={label} className={`import-step ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`}>
                {label}
              </div>
            ))}
          </div>

          {error && (
            <div className="import-warning-box" style={{ marginBottom: 12 }}>
              <div className="import-warning-title">Error</div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{error}</p>
            </div>
          )}

          {step === 'select' && (
            <SelectStep
              fileData={fileData}
              fileName={fileName}
              fileRef={fileRef}
              selectedTypes={selectedTypes}
              lockEntityTypes={lockEntityTypes}
              loading={loading}
              onFileSelect={handleFileSelect}
              onToggleType={toggleType}
              onPreview={handlePreview}
            />
          )}

          {step === 'resolve' && preview && (
            <ResolveStep
              preview={preview}
              warnings={warnings}
              prerequisites={prerequisites}
              decisions={decisions}
              selectedTypes={selectedTypes}
              loading={loading}
              onBulkAction={setBulkAction}
              onEntityAction={setEntityAction}
              onImport={handleImport}
              onBack={() => setStep('select')}
            />
          )}

          {step === 'result' && result && (
            <ResultStep result={result} onClose={handleClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function SelectStep({ fileData, fileName, fileRef, selectedTypes, lockEntityTypes, loading, onFileSelect, onToggleType, onPreview }) {
  return (
    <>
      <div className="form-group">
        <label>Import File</label>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          onChange={onFileSelect}
          style={{ width: '100%' }}
        />
        {fileName && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
            Selected: {fileName}
          </div>
        )}
      </div>

      {!lockEntityTypes && (
        <div className="form-group">
          <label>Entity Types to Import</label>
          <div className="import-entity-types">
            {ALL_ENTITY_TYPES.map(type => (
              <label
                key={type}
                className={`import-entity-type-checkbox ${selectedTypes.includes(type) ? 'checked' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(type)}
                  onChange={() => onToggleType(type)}
                  style={{ width: 'auto' }}
                />
                {ENTITY_DISPLAY[type]}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="modal-footer" style={{ padding: 0, border: 'none', marginTop: 12 }}>
        <button
          className="btn btn-primary"
          onClick={onPreview}
          disabled={!fileData || selectedTypes.length === 0 || loading}
        >
          {loading ? 'Loading...' : 'Preview'}
        </button>
      </div>
    </>
  );
}

function ResolveStep({ preview, warnings, prerequisites, decisions, selectedTypes, loading, onBulkAction, onEntityAction, onImport, onBack }) {
  const [expanded, setExpanded] = useState(() => {
    // Auto-expand first section with conflicts
    const first = selectedTypes.find(k => preview[k]?.conflicts?.length > 0);
    return first || selectedTypes[0];
  });

  // Group prerequisites by refType+refName
  const prereqGroups = React.useMemo(() => {
    if (!prerequisites || prerequisites.length === 0) return [];
    const grouped = {};
    for (const issue of prerequisites) {
      const key = `${issue.refType}:${issue.refName}`;
      if (!grouped[key]) grouped[key] = { refType: issue.refType, refName: issue.refName, entities: [] };
      if (!grouped[key].entities.includes(issue.entity)) grouped[key].entities.push(issue.entity);
    }
    return Object.values(grouped);
  }, [prerequisites]);

  return (
    <>
      {prereqGroups.length > 0 && (
        <div className="import-warning-box" style={{ marginBottom: 12 }}>
          <div className="import-warning-title">
            Missing Prerequisites ({prereqGroups.length})
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 8px' }}>
            These imported entities reference things that don't exist in your campaign.
            Rules using missing references may not work until you create them.
          </p>
          <ul className="import-warning-list">
            {prereqGroups.map((group, i) => (
              <li key={i}>
                {group.refType} <strong>"{group.refName}"</strong> — referenced by: {group.entities.join(', ')}
              </li>
            ))}
          </ul>
        </div>
      )}

      {selectedTypes.map(entityKey => {
        const section = preview[entityKey];
        if (!section) return null;
        const isExpanded = expanded === entityKey;
        const entityDecisions = decisions[entityKey] || {};
        const bulkAction = entityDecisions._bulk || 'skip';

        return (
          <div key={entityKey} className="import-section">
            <div
              className="import-section-header"
              onClick={() => setExpanded(isExpanded ? null : entityKey)}
            >
              <div className="import-section-title">
                <span>{isExpanded ? '\u25BC' : '\u25B6'}</span>
                {section.displayName || ENTITY_DISPLAY[entityKey]}
              </div>
              <div className="import-section-counts">
                <span className="import-count-new">{section.newItems.length} new</span>
                {section.conflicts.length > 0 && (
                  <span className="import-count-conflict">{section.conflicts.length} conflicts</span>
                )}
              </div>
            </div>
            {isExpanded && (
              <div className="import-section-body">
                {section.conflicts.length > 0 && (
                  <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Bulk action for conflicts:</label>
                    <select
                      value={bulkAction}
                      onChange={e => onBulkAction(entityKey, e.target.value)}
                      style={{ width: 'auto', fontSize: 12, padding: '4px 28px 4px 8px' }}
                    >
                      <option value="skip">Skip All</option>
                      <option value="overwrite">Overwrite All</option>
                      <option value="duplicate">Duplicate All</option>
                    </select>
                  </div>
                )}
                {section.newItems.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>New</div>
                    {section.newItems.map((entity, i) => (
                      <div key={i} className="import-entity-row">
                        <span className="import-entity-name">{entity.name}</span>
                        <span style={{ fontSize: 11, color: 'var(--green)' }}>Will import</span>
                      </div>
                    ))}
                  </>
                )}
                {section.conflicts.length > 0 && (
                  <>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, marginTop: section.newItems.length > 0 ? 10 : 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Conflicts</div>
                    {section.conflicts.map((conflict, i) => {
                      const perAction = entityDecisions[conflict.name] || '';
                      return (
                        <div key={i} className="import-entity-row">
                          <div>
                            <span className="import-entity-name">{conflict.name}</span>
                            <span className="import-conflict-badge">Exists</span>
                          </div>
                          <select
                            value={perAction}
                            onChange={e => onEntityAction(entityKey, conflict.name, e.target.value)}
                            style={{ width: 'auto', fontSize: 12, padding: '4px 28px 4px 8px' }}
                          >
                            <option value="">Use bulk ({bulkAction})</option>
                            <option value="skip">Skip</option>
                            <option value="overwrite">Overwrite</option>
                            <option value="duplicate">Duplicate</option>
                          </select>
                        </div>
                      );
                    })}
                  </>
                )}
                {section.total === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
                    No entities of this type in the import file.
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {warnings.length > 0 && (
        <div className="import-warning-box">
          <div className="import-warning-title">Attribute Warnings</div>
          <ul className="import-warning-list">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="modal-footer" style={{ padding: 0, border: 'none', marginTop: 12 }}>
        <button className="btn btn-secondary" onClick={onBack}>Back</button>
        <button className="btn btn-primary" onClick={onImport} disabled={loading}>
          {loading ? 'Importing...' : 'Import'}
        </button>
      </div>
    </>
  );
}

function ResultStep({ result, onClose }) {
  const { stats, warnings } = result;
  return (
    <>
      <div className="import-stats">
        <div className="import-stat">
          <div className="import-stat-value" style={{ color: 'var(--green)' }}>{stats.imported}</div>
          <div className="import-stat-label">Imported</div>
        </div>
        <div className="import-stat">
          <div className="import-stat-value">{stats.skipped}</div>
          <div className="import-stat-label">Skipped</div>
        </div>
        <div className="import-stat">
          <div className="import-stat-value" style={{ color: 'var(--accent)' }}>{stats.overwritten}</div>
          <div className="import-stat-label">Overwritten</div>
        </div>
        <div className="import-stat">
          <div className="import-stat-value" style={{ color: 'var(--yellow)' }}>{stats.duplicated}</div>
          <div className="import-stat-label">Duplicated</div>
        </div>
      </div>

      {warnings && warnings.length > 0 && (
        <div className="import-warning-box">
          <div className="import-warning-title">Warnings</div>
          <ul className="import-warning-list">
            {warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="modal-footer" style={{ padding: 0, border: 'none', marginTop: 12 }}>
        <button className="btn btn-primary" onClick={onClose}>Close</button>
      </div>
    </>
  );
}
