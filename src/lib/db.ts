import { supabase } from './supabase';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

// The Supabase JS client's .from() query builder hangs indefinitely in this
// dev environment (root cause not fully pinned down — possibly related to
// its internal session-lock/auth-refresh coordination). Raw fetch to the
// same REST endpoints works reliably every time, so all reads/writes go
// through here instead of supabase.from(...).
async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token ?? anonKey;
  return {
    apikey: anonKey,
    Authorization: `Bearer ${token}`,
  };
}

export async function dbSelect<T = any>(table: string, query: string = ''): Promise<T[]> {
  const headers = await authHeaders();
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch ${table}: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function dbInsert(table: string, row: Record<string, any>): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw new Error(`Failed to insert into ${table}: ${res.status} ${await res.text()}`);
}

export async function dbUpdate(table: string, match: string, patch: Record<string, any>): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${match}`, {
    method: 'PATCH',
    headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Failed to update ${table}: ${res.status} ${await res.text()}`);
}

export async function dbDelete(table: string, match: string): Promise<void> {
  const headers = await authHeaders();
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${match}`, {
    method: 'DELETE',
    headers,
  });
  if (!res.ok) throw new Error(`Failed to delete from ${table}: ${res.status} ${await res.text()}`);
}