// lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

if (!url || !key) {
  // Loga aviso mas não quebra build/import. Vai dar erro só quando alguém chamar uma operação.
  if (typeof window !== 'undefined') {
    console.error(
      'Supabase não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY no painel da Netlify (ou em .env.local).',
    );
  }
}

export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  key || 'placeholder',
  {
    auth: { persistSession: false }, // Sem auth no piloto
  },
);

export const STORAGE_BUCKET = 'uploads';

// URL pública do arquivo no storage
export function urlPublica(path: string): string {
  if (!path) return '';
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
