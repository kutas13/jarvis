import { createClient } from '@supabase/supabase-js';

export function adminDb() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !/^https?:\/\//i.test(url)) throw new Error('SUPABASE_URL geçerli bir http/https adresi olmalı.');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY eksik.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function ownerId() {
  const id = process.env.JARVIS_OWNER_ID?.trim();
  if (!id) throw new Error('JARVIS_OWNER_ID eksik.');
  return id;
}
