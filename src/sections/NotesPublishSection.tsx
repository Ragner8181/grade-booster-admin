import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dbSelect, dbInsert, dbDelete } from '../lib/db';

type Subject = { id: string; name: string; order_index: number };
type Note = { id: string; subject_id: string; chapter_number: number; title: string; cover_image_url: string | null; pdf_url: string };

export default function NotesPublishSection() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [newSubjectName, setNewSubjectName] = useState('');

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [chapterNumber, setChapterNumber] = useState('');
  const [title, setTitle] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const subjectRows = await dbSelect<Subject>('subjects', 'select=id,name,order_index&order=order_index');
      const noteRows = await dbSelect<Note>('notes', 'select=id,subject_id,chapter_number,title,cover_image_url,pdf_url&order=chapter_number');
      setSubjects(subjectRows);
      setNotes(noteRows);
      if (!selectedSubjectId && subjectRows.length > 0) {
        setSelectedSubjectId(subjectRows[0].id);
      }
    } catch (err: any) {
      setLoadError(err.message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAddSubject(e: React.FormEvent) {
    e.preventDefault();
    if (!newSubjectName.trim()) return;
    const nextOrder = subjects.length > 0 ? Math.max(...subjects.map((s) => s.order_index)) + 1 : 1;
    try {
      await dbInsert('subjects', { name: newSubjectName.trim(), order_index: nextOrder });
      setNewSubjectName('');
      loadData();
    } catch (err: any) {
      setMessage(`Failed to add subject: ${err.message}`);
    }
  }

  async function handleDeleteSubject(id: string) {
    if (!confirm('Delete this subject and ALL its notes? This cannot be undone.')) return;
    await dbDelete('subjects', `id=eq.${id}`);
    loadData();
  }

  async function handlePublishNote(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!selectedSubjectId || !chapterNumber || !title.trim() || !pdfFile) {
      setMessage('Subject, chapter number, title, and a PDF file are all required.');
      return;
    }

    setUploading(true);

    try {
      const pdfPath = `${selectedSubjectId}/${Date.now()}-${pdfFile.name}`;
      const { error: pdfError } = await supabase.storage.from('note-pdfs').upload(pdfPath, pdfFile);
      if (pdfError) throw new Error(`PDF upload failed: ${pdfError.message}`);
      const pdfUrl = supabase.storage.from('note-pdfs').getPublicUrl(pdfPath).data.publicUrl;

      let coverUrl: string | null = null;
      if (coverFile) {
        const coverPath = `${selectedSubjectId}/${Date.now()}-${coverFile.name}`;
        const { error: coverError } = await supabase.storage.from('covers').upload(coverPath, coverFile);
        if (coverError) throw new Error(`Cover upload failed: ${coverError.message}`);
        coverUrl = supabase.storage.from('covers').getPublicUrl(coverPath).data.publicUrl;
      }

      await dbInsert('notes', {
        subject_id: selectedSubjectId,
        chapter_number: parseInt(chapterNumber, 10),
        title: title.trim(),
        cover_image_url: coverUrl,
        pdf_url: pdfUrl,
      });

      setMessage('Note published successfully.');
      setChapterNumber('');
      setTitle('');
      setCoverFile(null);
      setPdfFile(null);
      loadData();
    } catch (err: any) {
      setMessage(err.message ?? 'Something went wrong.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteNote(id: string) {
    if (!confirm('Delete this note?')) return;
    await dbDelete('notes', `id=eq.${id}`);
    loadData();
  }

  if (loading) return <div>Loading...</div>;

  if (loadError) {
    return (
      <div>
        <h1>Note Publish</h1>
        <div className="error-text">Failed to load: {loadError}</div>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Note Publish</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Subjects</h3>
        <form onSubmit={handleAddSubject} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            className="input"
            style={{ marginBottom: 0, flex: 1 }}
            placeholder="New subject name (e.g. Mathematics)"
            value={newSubjectName}
            onChange={(e) => setNewSubjectName(e.target.value)}
          />
          <button className="btn-primary" style={{ width: 'auto', padding: '0 16px' }} type="submit">Add</button>
        </form>
        {subjects.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No subjects yet — add one above.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {subjects.map((s) => (
              <li key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                <span>{s.name}</span>
                <span style={{ color: 'var(--error)', cursor: 'pointer', fontSize: 13 }} onClick={() => handleDeleteSubject(s.id)}>
                  Delete
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Publish a Chapter</h3>
        <form onSubmit={handlePublishNote}>
          <label className="field-label">Subject</label>
          <select className="input" value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <label className="field-label">Chapter Number</label>
          <input
            className="input"
            type="number"
            min="1"
            value={chapterNumber}
            onChange={(e) => setChapterNumber(e.target.value)}
          />

          <label className="field-label">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Introduction to Limits" />

          <label className="field-label">Cover Image (optional)</label>
          <input
            className="input"
            type="file"
            accept="image/*"
            onChange={(e) => setCoverFile(e.target.files?.[0] ?? null)}
          />

          <label className="field-label">PDF File</label>
          <input
            className="input"
            type="file"
            accept="application/pdf"
            onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
          />

          {message && <div className="error-text">{message}</div>}

          <button className="btn-primary" type="submit" disabled={uploading}>
            {uploading ? 'Publishing...' : 'Publish Chapter'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Published Chapters</h3>
        {notes.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nothing published yet.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 4px' }}>Subject</th>
                <th style={{ padding: '8px 4px' }}>Ch.</th>
                <th style={{ padding: '8px 4px' }}>Title</th>
                <th style={{ padding: '8px 4px' }}></th>
              </tr>
            </thead>
            <tbody>
              {notes.map((n) => (
                <tr key={n.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '8px 4px' }}>{subjects.find((s) => s.id === n.subject_id)?.name ?? '—'}</td>
                  <td style={{ padding: '8px 4px' }}>{n.chapter_number}</td>
                  <td style={{ padding: '8px 4px' }}>{n.title}</td>
                  <td style={{ padding: '8px 4px', textAlign: 'right' }}>
                    <span style={{ color: 'var(--error)', cursor: 'pointer' }} onClick={() => handleDeleteNote(n.id)}>Delete</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}