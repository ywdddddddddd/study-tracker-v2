import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cshkzxmwtilpkudypsyg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_loM86LTtGzgtCZKt29QCVA_AEXXYEy6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Wrap a promise with a timeout to fail fast on mobile networks */
export function withTimeout<T>(promise: Promise<T>, ms = 10000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('请求超时，请检查网络连接')), ms)
    ),
  ]);
}
