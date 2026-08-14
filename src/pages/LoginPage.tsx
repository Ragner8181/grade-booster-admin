import { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setLoading(false);
      setError(signInError.message);
      return;
    }

    // Confirm this account is actually an admin — a regular student
    // account should not get into the dashboard even with correct credentials.
    // Uses a raw fetch instead of the query builder — the Supabase JS
    // client's PostgREST calls were hanging indefinitely in this environment
    // while raw fetch to the same endpoint works instantly.
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?select=is_admin&id=eq.${data.user.id}`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${data.session.access_token}`,
        },
      }
    );
    const rows = await profileResponse.json();
    const isAdminAccount = rows?.[0]?.is_admin ?? false;

    setLoading(false);

    if (!isAdminAccount) {
      setError('This account does not have admin access.');
      await supabase.auth.signOut();
    }
    // If admin, AdminAuthContext's listener picks up the session automatically.
  }

  return (
    <div className="login-screen">
      <div className="login-card">
        <h1>Grade Booster Admin</h1>
        <p>Sign in with your admin account.</p>

        <form onSubmit={handleLogin}>
          <label className="field-label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label className="field-label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <div className="error-text">{error}</div>}

          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}