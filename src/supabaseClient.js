import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://simwnoszvudgcuynvvli.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_eXGU-9Yx3-k041V8ATjOGg_Q6KhdKew';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
