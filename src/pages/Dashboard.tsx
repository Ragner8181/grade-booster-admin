import React, { useState } from 'react';
import { useAdminAuth } from '../lib/AdminAuthContext';
import NotesPublishSection from '../sections/NotesPublishSection';
import QuestionsPublishSection from '../sections/QuestionsPublishSection';
import ExamsPublishSection from '../sections/ExamsPublishSection';
import PaymentApprovalsSection from '../sections/PaymentApprovalsSection';
import StatisticsSection from '../sections/StatisticsSection';

type Section = 'notes' | 'questions' | 'exams' | 'payments' | 'statistics';

export default function Dashboard() {
  const { signOut } = useAdminAuth();
  const [section, setSection] = useState<Section>('notes');

  return (
    <div className="dashboard">
      <div className="sidebar">
        <h2>Grade Booster</h2>
        <button className={`nav-item ${section === 'notes' ? 'active' : ''}`} onClick={() => setSection('notes')}>
          📄 Note Publish
        </button>
        <button className={`nav-item ${section === 'questions' ? 'active' : ''}`} onClick={() => setSection('questions')}>
          ❓ Questions Publish
        </button>
        <button className={`nav-item ${section === 'exams' ? 'active' : ''}`} onClick={() => setSection('exams')}>
          📝 Exam Publish
        </button>
        <button className={`nav-item ${section === 'payments' ? 'active' : ''}`} onClick={() => setSection('payments')}>
          💳 Payment Approvals
        </button>
        <button className={`nav-item ${section === 'statistics' ? 'active' : ''}`} onClick={() => setSection('statistics')}>
          📊 Statistics
        </button>
        <div className="sidebar-footer" onClick={signOut}>Log Out</div>
      </div>

      <div className="main-content">
        {section === 'notes' && <NotesPublishSection />}
        {section === 'questions' && <QuestionsPublishSection />}
        {section === 'exams' && <ExamsPublishSection />}
        {section === 'payments' && <PaymentApprovalsSection />}
        {section === 'statistics' && <StatisticsSection />}
      </div>
    </div>
  );
}