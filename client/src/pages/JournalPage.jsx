import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as api from '../api';
import { renderMarkdown } from '../utils/markdown';
import { resolveWikilink } from '../utils/wikilinkNavigate';
import WikilinkAutocomplete from '../components/WikilinkAutocomplete';

export default function JournalPage({ campaignId }) {
  const [notes, setNotes] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [selectedNote, setSelectedNote] = useState(null);
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  // Edit form state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editStarred, setEditStarred] = useState(false);
  const textareaRef = useRef(null);

  const load = async () => {
    if (!campaignId) return;
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    params.set('limit', '100');
    const data = await api.getJournalNotes(campaignId, params.toString());
    setNotes(data.notes);
    setTotal(data.total);
  };

  useEffect(() => { load(); }, [campaignId, search]);

  useEffect(() => {
    if (!selectedId || !campaignId) { setSelectedNote(null); return; }
    api.getJournalNote(campaignId, selectedId).then(setSelectedNote).catch(() => setSelectedNote(null));
  }, [selectedId, campaignId]);

  const startCreate = () => {
    setCreating(true);
    setEditing(true);
    setSelectedId(null);
    setSelectedNote(null);
    setEditTitle('');
    setEditContent('');
    setEditTags('');
    setEditStarred(false);
  };

  const startEdit = () => {
    if (!selectedNote) return;
    setEditing(true);
    setCreating(false);
    setEditTitle(selectedNote.title);
    setEditContent(selectedNote.content);
    setEditTags((selectedNote.tags || []).join(', '));
    setEditStarred(selectedNote.starred);
  };

  const cancelEdit = () => {
    setEditing(false);
    setCreating(false);
  };

  const saveNote = async () => {
    const tags = editTags.split(',').map(s => s.trim()).filter(Boolean);
    const data = { title: editTitle, content: editContent, tags, starred: editStarred };
    if (creating) {
      const note = await api.createJournalNote(campaignId, data);
      setSelectedId(note.id);
      setCreating(false);
    } else {
      await api.updateJournalNote(campaignId, selectedId, data);
    }
    setEditing(false);
    load();
    if (selectedId) {
      api.getJournalNote(campaignId, selectedId).then(setSelectedNote);
    }
  };

  const deleteNote = async () => {
    if (!selectedId || !confirm('Delete this note?')) return;
    await api.deleteJournalNote(campaignId, selectedId);
    setSelectedId(null);
    setSelectedNote(null);
    setEditing(false);
    load();
  };

  const toggleStar = async (noteId, currentStarred) => {
    await api.updateJournalNote(campaignId, noteId, { starred: !currentStarred });
    load();
    if (noteId === selectedId) {
      api.getJournalNote(campaignId, noteId).then(setSelectedNote);
    }
  };

  const handleWikilinkClick = async (e) => {
    const link = e.target.closest('.wikilink');
    if (!link) return;
    e.preventDefault();
    const name = decodeURIComponent(link.getAttribute('data-wikilink'));
    const path = await resolveWikilink(campaignId, name);
    if (path) navigate(path);
  };

  const formatDate = (d) => {
    if (!d) return '';
    return new Date(d + 'Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="page" style={{ padding: 0, display: 'flex', flex: 1, overflow: 'hidden' }}>
      {/* Note list */}
      <div className="journal-list">
        <div style={{ padding: '12px 12px 8px' }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <input type="text" placeholder="Search notes..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={startCreate}>+ New</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{total} notes</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 8px' }}>
          {notes.map(note => (
            <div
              key={note.id}
              className={`journal-note-card${selectedId === note.id ? ' selected' : ''}${note.starred ? ' starred' : ''}`}
              onClick={() => { setSelectedId(note.id); setEditing(false); setCreating(false); }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontWeight: 600, fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.title || 'Untitled'}
                </div>
                <button
                  className="btn btn-ghost"
                  style={{ padding: '0 2px', fontSize: 14, lineHeight: 1, flexShrink: 0 }}
                  onClick={(e) => { e.stopPropagation(); toggleStar(note.id, note.starred); }}
                >
                  {note.starred ? '\u2605' : '\u2606'}
                </button>
              </div>
              {note.content && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.content.split('\n')[0].substring(0, 80)}
                </div>
              )}
              <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                {(note.tags || []).map(t => (
                  <span key={t} className="tag" style={{ fontSize: 9, padding: '1px 5px' }}>{t}</span>
                ))}
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>{formatDate(note.updated_at)}</span>
              </div>
            </div>
          ))}
          {notes.length === 0 && (
            <div className="empty-state" style={{ padding: 20 }}>
              <p>No notes yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Note detail / editor */}
      <div className="journal-editor">
        {editing ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <input
              type="text"
              placeholder="Note title..."
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', borderRadius: 0, padding: '8px 0' }}
            />
            <div className="form-group" style={{ marginBottom: 8 }}>
              <label>Tags (comma-separated)</label>
              <input type="text" value={editTags} onChange={e => setEditTags(e.target.value)} placeholder="session, lore, quest..." />
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={editStarred} onChange={e => setEditStarred(e.target.checked)} />
              Starred
            </label>
            <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={e => setEditContent(e.target.value)}
                placeholder="Write your note... Use [[Name]] to link entities. Supports Markdown."
                style={{ flex: 1, resize: 'none', fontFamily: 'var(--font-mono)', fontSize: 13, minHeight: 200 }}
              />
              <WikilinkAutocomplete
                campaignId={campaignId}
                textareaRef={textareaRef}
                value={editContent}
                onChange={setEditContent}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={saveNote}>Save</button>
            </div>
          </div>
        ) : selectedNote ? (
          <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <h2 style={{ fontSize: 20, fontWeight: 600, flex: 1 }}>{selectedNote.title || 'Untitled'}</h2>
              <div className="inline-flex gap-sm">
                <button className="btn btn-ghost btn-sm" onClick={() => toggleStar(selectedNote.id, selectedNote.starred)}>
                  {selectedNote.starred ? '\u2605' : '\u2606'}
                </button>
                <button className="btn btn-secondary btn-sm" onClick={startEdit}>Edit</button>
                <button className="btn btn-danger btn-sm" onClick={deleteNote}>Delete</button>
              </div>
            </div>
            {selectedNote.tags?.length > 0 && (
              <div className="inline-flex gap-sm flex-wrap" style={{ marginBottom: 12 }}>
                {selectedNote.tags.map(t => <span key={t} className="tag">{t}</span>)}
              </div>
            )}
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
              Updated {formatDate(selectedNote.updated_at)}
            </div>
            <div
              className="markdown-content"
              onClick={handleWikilinkClick}
              dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedNote.content) }}
            />
          </div>
        ) : (
          <div className="empty-state" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p>Select a note or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
