import React, { useEffect, useState } from 'react';
import { dbSelect, dbUpdate } from '../lib/db';
import { supabase } from '../lib/supabase';

type Submission = {
  id: string;
  user_id: string;
  method: string;
  receipt_image_url: string | null; // storage PATH, not a direct URL (receipts bucket is private)
  receipt_text: string | null;
  status: 'pending' | 'approved' | 'rejected';
  submitted_at: string;
};

type ProfileLite = { id: string; name: string; email: string };

export default function PaymentApprovalsSection() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const subRows = await dbSelect<Submission>(
        'payment_submissions',
        'select=id,user_id,method,receipt_image_url,receipt_text,status,submitted_at&order=submitted_at.desc'
      );
      setSubmissions(subRows);

      const userIds = [...new Set(subRows.map((s) => s.user_id))];
      if (userIds.length > 0) {
        const profileRows = await dbSelect<ProfileLite>(
          'profiles',
          `select=id,name,email&id=in.(${userIds.join(',')})`
        );
        const map: Record<string, ProfileLite> = {};
        profileRows.forEach((p) => (map[p.id] = p));
        setProfiles(map);
      }

      // Generate a temporary signed URL for each receipt image, since
      // "receipts" is a private bucket — the stored value is a storage
      // path (e.g. "userId/167123.jpg"), not a directly-usable URL.
      const urlEntries = await Promise.all(
        subRows
          .filter((s) => s.receipt_image_url)
          .map(async (s) => {
            const { data, error } = await supabase.storage
              .from('receipts')
              .createSignedUrl(s.receipt_image_url as string, 3600); // valid 1 hour
            if (error || !data) return [s.id, null] as const;
            return [s.id, data.signedUrl] as const;
          })
      );
      const urlMap: Record<string, string> = {};
      urlEntries.forEach(([id, url]) => {
        if (url) urlMap[id] = url;
      });
      setSignedUrls(urlMap);
    } catch (err: any) {
      setLoadError(err.message ?? 'Failed to load submissions.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(sub: Submission) {
    setProcessingId(sub.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const adminId = userData.user?.id;

      await dbUpdate('payment_submissions', `id=eq.${sub.id}`, {
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      });

      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 6);

      await dbUpdate('profiles', `id=eq.${sub.user_id}`, {
        is_premium: true,
        premium_activated_at: new Date().toISOString(),
        premium_expires_at: expiresAt.toISOString(),
      });

      loadData();
    } catch (err: any) {
      alert(`Failed to approve: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  async function handleReject(sub: Submission) {
    if (!confirm('Reject this payment submission?')) return;
    setProcessingId(sub.id);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const adminId = userData.user?.id;

      await dbUpdate('payment_submissions', `id=eq.${sub.id}`, {
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: adminId,
      });
      loadData();
    } catch (err: any) {
      alert(`Failed to reject: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) return <div>Loading...</div>;

  if (loadError) {
    return (
      <div>
        <h1>Payment Approvals</h1>
        <div className="error-text">Failed to load: {loadError}</div>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={loadData}>Retry</button>
      </div>
    );
  }

  const visible = filter === 'pending' ? submissions.filter((s) => s.status === 'pending') : submissions;
  const pendingCount = submissions.filter((s) => s.status === 'pending').length;

  return (
    <div>
      <h1>Payment Approvals {pendingCount > 0 && <span style={{ color: 'var(--gold)', fontSize: 16 }}>({pendingCount} pending)</span>}</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '6px 14px', background: filter === 'pending' ? 'var(--primary)' : 'var(--surface)', color: filter === 'pending' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
          onClick={() => setFilter('pending')}
        >
          Pending Only
        </button>
        <button
          className="btn-primary"
          style={{ width: 'auto', padding: '6px 14px', background: filter === 'all' ? 'var(--primary)' : 'var(--surface)', color: filter === 'all' ? 'white' : 'var(--text)', border: '1px solid var(--border)' }}
          onClick={() => setFilter('all')}
        >
          All History
        </button>
      </div>

      {visible.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
            {filter === 'pending' ? 'No pending submissions — all caught up.' : 'No submissions yet.'}
          </p>
        </div>
      ) : (
        visible.map((sub) => {
          const profile = profiles[sub.user_id];
          return (
            <div key={sub.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <strong>{profile?.name ?? 'Unknown user'}</strong>{' '}
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{profile?.email}</span>
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    <strong>Method:</strong> {sub.method} &nbsp;·&nbsp;
                    <strong>Submitted:</strong> {new Date(sub.submitted_at).toLocaleString()}
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: sub.status === 'pending' ? '#FDF3D6' : sub.status === 'approved' ? 'var(--primary-light)' : '#FBE1E4',
                    color: sub.status === 'pending' ? '#8a6d00' : sub.status === 'approved' ? 'var(--primary-dark)' : 'var(--error)',
                  }}
                >
                  {sub.status.toUpperCase()}
                </span>
              </div>

              {sub.receipt_text && (
                <div style={{ marginTop: 10, fontSize: 13 }}>
                  <strong>Receipt details:</strong> {sub.receipt_text}
                </div>
              )}

              {sub.receipt_image_url && signedUrls[sub.id] && (
                <div style={{ marginTop: 10 }}>
                  <a href={signedUrls[sub.id]} target="_blank" rel="noreferrer">
                    <img src={signedUrls[sub.id]} alt="Receipt" style={{ maxWidth: 240, borderRadius: 8, border: '1px solid var(--border)' }} />
                  </a>
                </div>
              )}
              {sub.receipt_image_url && !signedUrls[sub.id] && (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                  Receipt image unavailable (may be from before the storage fix — ask the student to resubmit if needed).
                </div>
              )}

              {sub.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '8px 16px' }}
                    disabled={processingId === sub.id}
                    onClick={() => handleApprove(sub)}
                  >
                    {processingId === sub.id ? 'Working...' : 'Approve'}
                  </button>
                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '8px 16px', background: 'var(--surface)', color: 'var(--error)', border: '1px solid var(--error)' }}
                    disabled={processingId === sub.id}
                    onClick={() => handleReject(sub)}
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}