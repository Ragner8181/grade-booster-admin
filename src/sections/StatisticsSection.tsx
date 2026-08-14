import { useEffect, useState } from 'react';
import { dbSelect } from '../lib/db';

type Profile = {
  id: string;
  name: string;
  email: string;
  university: string | null;
  gender: string | null;
  stream: string | null;
  dream_gpa: number | null;
  dream_field: string | null;
  is_premium: boolean;
  total_points: number;
  created_at: string;
};

export default function StatisticsSection() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setLoadError(null);
    try {
      const rows = await dbSelect<Profile>(
        'profiles',
        'select=id,name,email,university,gender,stream,dream_gpa,dream_field,is_premium,total_points,created_at&order=created_at.desc'
      );
      setProfiles(rows);
    } catch (err: any) {
      setLoadError(err.message ?? 'Failed to load statistics.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  if (loadError) {
    return (
      <div>
        <h1>Statistics</h1>
        <div className="error-text">Failed to load: {loadError}</div>
        <button className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }} onClick={loadData}>Retry</button>
      </div>
    );
  }

  const totalStudents = profiles.length;
  const premiumCount = profiles.filter((p) => p.is_premium).length;
  const freeCount = totalStudents - premiumCount;

  const leaderboard = [...profiles].sort((a, b) => b.total_points - a.total_points).slice(0, 3);

  const filteredProfiles = profiles.filter((p) => {
    const q = search.toLowerCase();
    return p.name?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q);
  });

  return (
    <div>
      <h1>Statistics</h1>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--primary)' }}>{totalStudents}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Total Students</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--gold)' }}>{premiumCount}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Premium</div>
        </div>
        <div className="card" style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-muted)' }}>{freeCount}</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Free</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>🏆 Top 3 Leaderboard</h3>
        {leaderboard.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No students yet.</p>
        ) : (
          <ol style={{ margin: 0, paddingLeft: 20 }}>
            {leaderboard.map((p) => (
              <li key={p.id} style={{ padding: '6px 0', fontSize: 14 }}>
                <strong>{p.name}</strong> — {p.total_points} points
                {p.is_premium && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--gold)' }}>★ Premium</span>}
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>All Users ({filteredProfiles.length})</h3>
          <input
            className="input"
            style={{ marginBottom: 0, width: 220 }}
            placeholder="Search name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredProfiles.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No matching users.</p>
        ) : (
          filteredProfiles.map((p) => {
            const expanded = expandedId === p.id;
            return (
              <div key={p.id} style={{ borderBottom: '1px solid var(--border)', padding: '10px 0' }}>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                >
                  <div>
                    <strong>{p.name}</strong>{' '}
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.email}</span>
                    {p.is_premium && <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gold)' }}>★ Premium</span>}
                  </div>
                  <span style={{ fontSize: 13, color: 'var(--primary)' }}>{expanded ? 'Hide' : 'See Details'}</span>
                </div>

                {expanded && (
                  <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid var(--border)', fontSize: 13, lineHeight: 1.8 }}>
                    <div><strong>University:</strong> {p.university || 'Not set'}</div>
                    <div><strong>Gender:</strong> {p.gender || 'Not set'}</div>
                    <div><strong>Stream:</strong> {p.stream || 'Not set'}</div>
                    <div><strong>Dream GPA:</strong> {p.dream_gpa ?? 'Not set'}</div>
                    <div><strong>Dream Field:</strong> {p.dream_field || 'Not set'}</div>
                    <div><strong>Total Points:</strong> {p.total_points}</div>
                    <div><strong>Plan:</strong> {p.is_premium ? 'Premium' : 'Free'}</div>
                    <div><strong>Joined:</strong> {new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}