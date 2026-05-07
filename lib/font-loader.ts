// lib/font-loader.ts
'use client';

// Mantém registro das fontes já carregadas para evitar duplicatas
const fontesCarregadas = new Set<string>();

export type FonteInfo = {
  nome: string;
  fonte: 'sistema' | 'google' | 'upload';
  arquivo_path?: string | null;
  google_url?: string | null;
};

export async function carregarFonte(fonte: FonteInfo): Promise<void> {
  if (fontesCarregadas.has(fonte.nome)) return;

  if (fonte.fonte === 'sistema') {
    fontesCarregadas.add(fonte.nome);
    return;
  }

  if (fonte.fonte === 'google' && fonte.google_url) {
    // Adiciona <link> ao head se ainda não existe
    const id = `google-font-${fonte.nome.replace(/\s+/g, '-')}`;
    if (!document.getElementById(id)) {
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = fonte.google_url;
      document.head.appendChild(link);
    }
    fontesCarregadas.add(fonte.nome);
    // Aguarda a fonte ser carregada para o canvas conseguir usar
    try {
      await document.fonts.load(`16px "${fonte.nome}"`);
    } catch {}
    return;
  }

  if (fonte.fonte === 'upload' && fonte.arquivo_path) {
    try {
      const fontFace = new FontFace(fonte.nome, `url(${fonte.arquivo_path})`);
      await fontFace.load();
      document.fonts.add(fontFace);
      fontesCarregadas.add(fonte.nome);
    } catch (e) {
      console.warn('Erro carregando fonte uploadada:', fonte.nome, e);
    }
  }
}

export async function carregarTodasFontes(fontes: FonteInfo[]): Promise<void> {
  await Promise.all(fontes.map((f) => carregarFonte(f)));
}

// Cria URL do Google Fonts a partir do nome da família e dos pesos
export function googleFontUrl(nome: string, pesos: string[] = ['400', '700']): string {
  const familia = nome.replace(/\s+/g, '+');
  const pesosStr = pesos.join(';');
  return `https://fonts.googleapis.com/css2?family=${familia}:wght@${pesosStr}&display=swap`;
}
