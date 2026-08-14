import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dbSelect, dbInsert, dbDelete } from '../lib/db';

type Subject = { id: string; name: string; order_index: number };
type QuestionSet = { id: string; subject_id: string; title: string; mode: 'pdf' | 'quiz'; pdf_url: string | null };
type QuizQuestion = {
  id: string;
  question_set_id: string;
  question_text: string;
  choices: string[];
  correct_answer: string;
  explanation: string | null;
  order_index: number;
};

export default function QuestionsPublishSection() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [sets, setSets] = useState<QuestionSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  // New set form
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [setTitle, setSetTitle] = useState('');
  const [setMode, setSetMode] = useState<'pdf' | 'quiz'>('quiz');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  // Expanded quiz set + its questions
  const [expandedSetId, setExpandedSetId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [qText, setQText] = useState('');
  const [choiceA, setChoiceA] = useState('');
  const [choiceB, setChoiceB] = useState('');
  const [choiceC, setChoiceC] = useState('');
  const [choiceD, setChoiceD] = useState('');
  const [correctChoice, setCorrectChoice] = useState('A');
  const [explanation, setExplanation] = useState('');
  const [addingQuestion, setAddingQuestion] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const subjectRows = await dbSelect<Subject>('subjects', 'select=id,name,order_index&order=order_index');
      const setRows = await dbSelect<QuestionSet>('question_sets', 'select=id,subject_id,title,mode,pdf_url');
      setSubjects(subjectRows);
      setSets(setRows);
      if (!selectedSubjectId && subjectRows.length > 0) setSelectedSubjectId(subjectRows[0].id);
    } catch (err: any) {
      setLoadError(err.message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSet(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    if (!selectedSubjectId || !setTitle.trim()) {
      setMessage('Subject and title are required.');
      return;
    }
    if (setMode === 'pdf' && !pdfFile) {
      setMessage('Please choose a PDF file for PDF mode.');
      return;
    }

    setCreating(true);
    try {
      let pdfUrl: string | null = null;
      if (setMode === 'pdf' && pdfFile) {
        const path = `${selectedSubjectId}/${Date.now()}-${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage.from('question-pdfs').upload(path, pdfFile);
        if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);
        pdfUrl = supabase.storage.from('question-pdfs').getPublicUrl(path).data.publicUrl;
      }

      await dbInsert('question_sets', {
        subject_id: selectedSubjectId,
        title: setTitle.trim(),
        mode: setMode,
        pdf_url: pdfUrl,
      });

      setMessage('Question set created.');
      setSetTitle('');
      setPdfFile(null);
      loadData();
    } catch (err: any) {
      setMessage(err.message ?? 'Something went wrong.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteSet(id: string) {
    if (!confirm('Delete this question set and all its questions?')) return;
    await dbDelete('question_sets', `id=eq.${id}`);
    if (expandedSetId === id) setExpandedSetId(null);
    loadData();
  }

  async function toggleExpand(set: QuestionSet) {
    if (expandedSetId === set.id) {
      setExpandedSetId(null);
      return;
    }
    setExpandedSetId(set.id);
    if (set.mode === 'quiz') {
      const rows = await dbSelect<QuizQuestion>(
        'quiz_questions',
        `select=id,question_set_id,question_text,choices,correct_answer,explanation,order_index&question_set_id=eq.${set.id}&order=order_index`
      );
      setQuestions(rows);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedSetId) return;
    if (!qText.trim() || !choiceA.trim() || !choiceB.trim() || !choiceC.trim() || !choiceD.trim()) {
      setMessage('Question text and all 4 choices are required.');
      return;
    }

    const choiceMap: Record<string, string> = { A: choiceA, B: choiceB, C: choiceC, D: choiceD };
    const correctAnswerText = choiceMap[correctChoice];

    setAddingQuestion(true);
    try {
      await dbInsert('quiz_questions', {
        question_set_id: expandedSetId,
        question_text: qText.trim(),
        choices: [choiceA.trim(), choiceB.trim(), choiceC.trim(), choiceD.trim()],
        correct_answer: correctAnswerText.trim(),
        explanation: explanation.trim() || null,
        order_index: questions.length + 1,
      });

      setQText('');
      setChoiceA('');
      setChoiceB('');
      setChoiceC('');
      setChoiceD('');
      setExplanation('');
      setCorrectChoice('A');

      const rows = await dbSelect<QuizQuestion>(
        'quiz_questions',
        `select=id,question_set_id,question_text,choices,correct_answer,explanation,order_index&question_set_id=eq.${expandedSetId}&order=order_index`
      );
      setQuestions(rows);
    } catch (err: any) {
      setMessage(err.message ?? 'Failed to add question.');
    } finally {
      setAddingQuestion(false);
    }
  }

  async function handleDeleteQuestion(id: string) {
    if (!confirm('Delete this question?')) return;
    await dbDelete('quiz_questions', `id=eq.${id}`);
    if (expandedSetId) {
      const rows = await dbSelect<QuizQuestion>(
        'quiz_questions',
        `select=id,question_set_id,question_text,choices,correct_answer,explanation,order_index&question_set_id=eq.${expandedSetId}&order=order_index`
      );
      setQuestions(rows);
    }
  }

  if (loading) return <div>Loading...</div>;

  if (loadError) {
    return (
      <div>
        <h1>Questions Publish</h1>
        <div className="error-text">Failed to load: {loadError}</div>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Questions Publish</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create a Question Set</h3>
        <form onSubmit={handleCreateSet}>
          <label className="field-label">Subject</label>
          <select className="input" value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <label className="field-label">Title</label>
          <input className="input" value={setTitle} onChange={(e) => setSetTitle(e.target.value)} placeholder="e.g. Chapter 3 Practice" />

          <label className="field-label">Mode</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '8px 16px', background: setMode === 'quiz' ? 'var(--primary)' : 'var(--surface)', color: setMode === 'quiz' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setSetMode('quiz')}
            >
              Quiz (manual entry)
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '8px 16px', background: setMode === 'pdf' ? 'var(--primary)' : 'var(--surface)', color: setMode === 'pdf' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setSetMode('pdf')}
            >
              PDF Upload
            </button>
          </div>

          {setMode === 'pdf' && (
            <>
              <label className="field-label">PDF File</label>
              <input className="input" type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            </>
          )}

          {message && <div className="error-text">{message}</div>}

          <button className="btn-primary" type="submit" disabled={creating}>
            {creating ? 'Creating...' : 'Create Question Set'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Question Sets</h3>
        {sets.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None created yet.</p>
        ) : (
          sets.map((set) => (
            <div key={set.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleExpand(set)}>
                <div>
                  <strong>{set.title}</strong>{' '}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    · {subjects.find((s) => s.id === set.subject_id)?.name ?? '—'} · {set.mode.toUpperCase()}
                  </span>
                </div>
                <span style={{ color: 'var(--error)', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); handleDeleteSet(set.id); }}>
                  Delete
                </span>
              </div>

              {expandedSetId === set.id && set.mode === 'quiz' && (
                <div style={{ marginTop: 12, paddingLeft: 12, borderLeft: '2px solid var(--border)' }}>
                  {questions.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No questions yet — add one below.</p>
                  ) : (
                    questions.map((q, i) => (
                      <div key={q.id} style={{ marginBottom: 12, fontSize: 13 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{i + 1}. {q.question_text}</strong>
                          <span style={{ color: 'var(--error)', cursor: 'pointer' }} onClick={() => handleDeleteQuestion(q.id)}>Delete</span>
                        </div>
                        <div style={{ color: 'var(--text-muted)' }}>
                          Choices: {q.choices.join(' | ')} — Correct: {q.correct_answer}
                        </div>
                      </div>
                    ))
                  )}

                  <form onSubmit={handleAddQuestion} style={{ marginTop: 16 }}>
                    <label className="field-label">Question</label>
                    <input className="input" value={qText} onChange={(e) => setQText(e.target.value)} />

                    <label className="field-label">Choice A</label>
                    <input className="input" value={choiceA} onChange={(e) => setChoiceA(e.target.value)} />
                    <label className="field-label">Choice B</label>
                    <input className="input" value={choiceB} onChange={(e) => setChoiceB(e.target.value)} />
                    <label className="field-label">Choice C</label>
                    <input className="input" value={choiceC} onChange={(e) => setChoiceC(e.target.value)} />
                    <label className="field-label">Choice D</label>
                    <input className="input" value={choiceD} onChange={(e) => setChoiceD(e.target.value)} />

                    <label className="field-label">Correct Choice</label>
                    <select className="input" value={correctChoice} onChange={(e) => setCorrectChoice(e.target.value)}>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                      <option value="D">D</option>
                    </select>

                    <label className="field-label">Explanation (optional)</label>
                    <input className="input" value={explanation} onChange={(e) => setExplanation(e.target.value)} />

                    <button className="btn-primary" type="submit" disabled={addingQuestion}>
                      {addingQuestion ? 'Adding...' : 'Add Question'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}