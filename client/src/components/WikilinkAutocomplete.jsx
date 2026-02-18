import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as api from '../api';

const ENTITY_TYPE_LABELS = {
  character: 'Character',
  location: 'Location',
  item: 'Item',
  effect: 'Effect',
};

export default function WikilinkAutocomplete({ campaignId, textareaRef, value, onChange }) {
  const [suggestions, setSuggestions] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [wikilinkStart, setWikilinkStart] = useState(null);
  const debounceRef = useRef(null);

  const detectWikilink = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return null;
    const pos = ta.selectionStart;
    const before = value.substring(0, pos);
    const openIdx = before.lastIndexOf('[[');
    if (openIdx === -1) return null;
    const afterOpen = before.substring(openIdx + 2);
    if (afterOpen.includes(']]')) return null;
    return { start: openIdx, query: afterOpen };
  }, [value, textareaRef]);

  useEffect(() => {
    const wl = detectWikilink();
    if (!wl || wl.query.length < 1) {
      setSuggestions([]);
      setWikilinkStart(null);
      return;
    }
    setWikilinkStart(wl.start);
    setActiveIdx(0);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await api.searchEntities(campaignId, wl.query);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [value, campaignId, detectWikilink]);

  const insertSuggestion = useCallback((suggestion) => {
    if (wikilinkStart === null) return;
    const ta = textareaRef.current;
    const pos = ta.selectionStart;
    const before = value.substring(0, wikilinkStart);
    const after = value.substring(pos);
    const inserted = `[[${suggestion.name}]]`;
    const newValue = before + inserted + after;
    onChange(newValue);
    setSuggestions([]);
    setWikilinkStart(null);
    requestAnimationFrame(() => {
      const newPos = before.length + inserted.length;
      ta.focus();
      ta.setSelectionRange(newPos, newPos);
    });
  }, [wikilinkStart, value, onChange, textareaRef]);

  const handleKeyDown = useCallback((e) => {
    if (suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault();
      insertSuggestion(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
    }
  }, [suggestions, activeIdx, insertSuggestion]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.addEventListener('keydown', handleKeyDown);
    return () => ta.removeEventListener('keydown', handleKeyDown);
  }, [textareaRef, handleKeyDown]);

  if (suggestions.length === 0) return null;

  return (
    <div className="wikilink-autocomplete">
      {suggestions.map((s, i) => (
        <div
          key={`${s.entity_type}-${s.id}`}
          className={`wikilink-autocomplete-item${i === activeIdx ? ' active' : ''}`}
          onMouseDown={(e) => { e.preventDefault(); insertSuggestion(s); }}
          onMouseEnter={() => setActiveIdx(i)}
        >
          <span>{s.name}</span>
          <span className="tag" style={{ fontSize: 9, marginLeft: 8 }}>{ENTITY_TYPE_LABELS[s.entity_type]}</span>
        </div>
      ))}
    </div>
  );
}
