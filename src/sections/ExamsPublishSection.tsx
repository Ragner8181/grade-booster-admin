import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { dbSelect, dbInsert, dbDelete } from '../lib/db';

type Subject = { id: string; name: string; order_index: number };
type Exam = { id: string; subject_id: string; year: number; title: string; mode: 'pdf' | 'quiz'; pdf_url: string | null };
type ExamQuestion = {
  id: string;
  exam_id: string;
  question_text: string;
  choices: string[];
  correct_answer: string;
  explanation: string | null;
  order_index: number;
};

const CURRENT_YEAR = new Date().getFullYear();

export default function ExamsPublishSection() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [examTitle, setExamTitle] = useState('');
  const [examYear, setExamYear] = useState(String(CURRENT_YEAR));
  const [examMode, setExamMode] = useState<'pdf' | 'quiz'>('pdf');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);

  const [expandedExamId, setExpandedExamId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
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
      const examRows = await dbSelect<Exam>('exams', 'select=id,subject_id,year,title,mode,pdf_url&order=year.desc');
      setSubjects(subjectRows);
      setExams(examRows);
      if (!selectedSubjectId && subjectRows.length > 0) setSelectedSubjectId(subjectRows[0].id);
    } catch (err: any) {
      setLoadError(err.message ?? 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExam(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);

    const yearNum = parseInt(examYear, 10);
    if (!selectedSubjectId || !examTitle.trim() || !yearNum) {
      setMessage('Subject, title, and year are all required.');
      return;
    }
    if (examMode === 'pdf' && !pdfFile) {
      setMessage('Please choose a PDF file for PDF mode.');
      return;
    }

    setCreating(true);
    try {
      let pdfUrl: string | null = null;
      if (examMode === 'pdf' && pdfFile) {
        const path = `${selectedSubjectId}/${Date.now()}-${pdfFile.name}`;
        const { error: uploadError } = await supabase.storage.from('exam-pdfs').upload(path, pdfFile);
        if (uploadError) throw new Error(`PDF upload failed: ${uploadError.message}`);
        pdfUrl = supabase.storage.from('exam-pdfs').getPublicUrl(path).data.publicUrl;
      }

      await dbInsert('exams', {
        subject_id: selectedSubjectId,
        year: yearNum,
        title: examTitle.trim(),
        mode: examMode,
        pdf_url: pdfUrl,
      });

      setMessage('Exam published.');
      setExamTitle('');
      setPdfFile(null);
      loadData();
    } catch (err: any) {
      setMessage(err.message ?? 'Something went wrong.');
    } finally {
      setCreating(false);
    }
  }

  async function handleDeleteExam(id: string) {
    if (!confirm('Delete this exam and all its questions?')) return;
    await dbDelete('exams', `id=eq.${id}`);
    if (expandedExamId === id) setExpandedExamId(null);
    loadData();
  }

  async function toggleExpand(exam: Exam) {
    if (expandedExamId === exam.id) {
      setExpandedExamId(null);
      return;
    }
    setExpandedExamId(exam.id);
    if (exam.mode === 'quiz') {
      const rows = await dbSelect<ExamQuestion>(
        'exam_questions',
        `select=id,exam_id,question_text,choices,correct_answer,explanation,order_index&exam_id=eq.${exam.id}&order=order_index`
      );
      setQuestions(rows);
    }
  }

  async function handleAddQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!expandedExamId) return;
    if (!qText.trim() || !choiceA.trim() || !choiceB.trim() || !choiceC.trim() || !choiceD.trim()) {
      setMessage('Question text and all 4 choices are required.');
      return;
    }

    const choiceMap: Record<string, string> = { A: choiceA, B: choiceB, C: choiceC, D: choiceD };
    const correctAnswerText = choiceMap[correctChoice];

    setAddingQuestion(true);
    try {
      await dbInsert('exam_questions', {
        exam_id: expandedExamId,
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

      const rows = await dbSelect<ExamQuestion>(
        'exam_questions',
        `select=id,exam_id,question_text,choices,correct_answer,explanation,order_index&exam_id=eq.${expandedExamId}&order=order_index`
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
    await dbDelete('exam_questions', `id=eq.${id}`);
    if (expandedExamId) {
      const rows = await dbSelect<ExamQuestion>(
        'exam_questions',
        `select=id,exam_id,question_text,choices,correct_answer,explanation,order_index&exam_id=eq.${expandedExamId}&order=order_index`
      );
      setQuestions(rows);
    }
  }

  if (loading) return <div>Loading...</div>;

  if (loadError) {
    return (
      <div>
        <h1>Exam Publish</h1>
        <div className="error-text">Failed to load: {loadError}</div>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={loadData}>Retry</button>
      </div>
    );
  }

  return (
    <div>
      <h1>Exam Publish</h1>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Publish an Exam</h3>
        <form onSubmit={handleCreateExam}>
          <label className="field-label">Subject</label>
          <select className="input" value={selectedSubjectId} onChange={(e) => setSelectedSubjectId(e.target.value)}>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <label className="field-label">Year</label>
          <input className="input" type="number" value={examYear} onChange={(e) => setExamYear(e.target.value)} />

          <label className="field-label">Title</label>
          <input className="input" value={examTitle} onChange={(e) => setExamTitle(e.target.value)} placeholder="e.g. Final Exam" />

          <label className="field-label">Mode</label>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '8px 16px', background: examMode === 'pdf' ? 'var(--primary)' : 'var(--surface)', color: examMode === 'pdf' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setExamMode('pdf')}
            >
              PDF Upload
            </button>
            <button
              type="button"
              className="btn-primary"
              style={{ width: 'auto', padding: '8px 16px', background: examMode === 'quiz' ? 'var(--primary)' : 'var(--surface)', color: examMode === 'quiz' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
              onClick={() => setExamMode('quiz')}
            >
              Quiz (manual entry)
            </button>
          </div>

          {examMode === 'pdf' && (
            <>
              <label className="field-label">PDF File</label>
              <input className="input" type="file" accept="application/pdf" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            </>
          )}

          {message && <div className="error-text">{message}</div>}

          <button className="btn-primary" type="submit" disabled={creating}>
            {creating ? 'Publishing...' : 'Publish Exam'}
          </button>
        </form>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Published Exams</h3>
        {exams.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>None published yet.</p>
        ) : (
          exams.map((exam) => (
            <div key={exam.id} style={{ borderBottom: '1px solid var(--border)', paddingBottom: 12, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }} onClick={() => toggleExpand(exam)}>
                <div>
                  <strong>{exam.year} — {exam.title}</strong>{' '}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    · {subjects.find((s) => s.id === exam.subject_id)?.name ?? '—'} · {exam.mode.toUpperCase()}
                  </span>
                </div>
                <span style={{ color: 'var(--error)', fontSize: 13 }} onClick={(e) => { e.stopPropagation(); handleDeleteExam(exam.id); }}>
                  Delete
                </span>
              </div>

              {expandedExamId === exam.id && exam.mode === 'quiz' && (
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