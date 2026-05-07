// lib/upload.ts
import { supabase, STORAGE_BUCKET, urlPublica } from './supabase';

// Sobe arquivo no Supabase Storage e retorna a URL PÚBLICA completa.
// Esse padrão simplifica o app: a "URL pública" é o path armazenado no banco.
// Pra deletar, extraímos o path da URL.
export async function saveUploadedFile(file: File, prefix = ''): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const hash = Math.random().toString(36).slice(2, 10);
  const fileName = `${prefix}${prefix ? '-' : ''}${Date.now()}-${hash}.${ext}`;
  const path = `imagens/${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: file.type || 'image/png',
      upsert: false,
    });

  if (error) throw error;
  return urlPublica(path);
}

export async function saveUploadedFont(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
    throw new Error('Formato de fonte não suportado. Use TTF, OTF, WOFF ou WOFF2.');
  }
  const hash = Math.random().toString(36).slice(2, 10);
  const fileName = `${Date.now()}-${hash}.${ext}`;
  const path = `fontes/${fileName}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, buffer, {
      contentType: `font/${ext}`,
      upsert: false,
    });

  if (error) throw error;
  return urlPublica(path);
}

// Tenta deletar do storage. Recebe URL pública e extrai o path.
export async function deleteUploadedFile(urlOuPath: string | null) {
  if (!urlOuPath) return;
  let path = urlOuPath;

  // Se for URL completa, extrai o path
  if (urlOuPath.startsWith('http')) {
    const match = urlOuPath.match(/\/object\/public\/[^/]+\/(.+)$/);
    if (match) {
      path = match[1];
    } else {
      return;
    }
  }

  // Path "/uploads/..." legado (filesystem antigo) — ignora
  if (path.startsWith('/uploads/') || path.startsWith('/fontes/')) {
    return;
  }

  try {
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (e) {
    console.warn('Não foi possível deletar arquivo do storage:', path, e);
  }
}

export async function getImageDimensions(file: File): Promise<{ largura: number; altura: number }> {
  const buffer = Buffer.from(await file.arrayBuffer());

  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { largura: buffer.readUInt32BE(16), altura: buffer.readUInt32BE(20) };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let i = 2;
    while (i < buffer.length) {
      if (buffer[i] !== 0xff) break;
      const marker = buffer[i + 1];
      const len = buffer.readUInt16BE(i + 2);
      if (
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf)
      ) {
        const altura = buffer.readUInt16BE(i + 5);
        const largura = buffer.readUInt16BE(i + 7);
        return { largura, altura };
      }
      i += 2 + len;
    }
  }

  return { largura: 1080, altura: 1080 };
}
