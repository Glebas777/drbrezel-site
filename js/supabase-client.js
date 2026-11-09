import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.8/+esm'

const SUPABASE_URL = 'https://cqfhxkvagtexkjfbgpit.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xN-zAPSdnUwq2b3LxT8cGg_fcjSrj8V';

// Кастомный lock, который ничего не блокирует (просто выполняет функцию)
const noLock = (name, acquireTimeout, fn) => fn();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { 
        autoRefreshToken: true, 
        persistSession: true,
        lock: noLock // <-- ВОТ ЭТО УБИРАЕТ ОШИБКУ
    }
});