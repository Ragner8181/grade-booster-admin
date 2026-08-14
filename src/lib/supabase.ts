import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Missing Supabase env vars. Check your .env file has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
}

// Bypasses the Web Locks API session-coordination lock, which got stuck
// during dev-server hot-reloading and caused every request to hang forever.
// This is a simple in-memory queue instead of a bare no-op — it still lets
// only one lock-holder run at a time (avoiding overlapping refresh calls
// that can retrigger each other rapidly) but never blocks indefinitely the
// way the stuck browser lock did.
let lockQueue: Promise<any> = Promise.resolve();
function simpleLock(_name: string, _acquireTimeout: number, fn: () => Promise<any>) {
  const run = lockQueue.then(() => fn());
  lockQueue = run.catch(() => {});
  return run;
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: simpleLock,
  },
});