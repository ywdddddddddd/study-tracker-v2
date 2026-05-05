import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://cshkzxmwtilpkudypsyg.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_loM86LTtGzgtCZKt29QCVA_AEXXYEy6';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
