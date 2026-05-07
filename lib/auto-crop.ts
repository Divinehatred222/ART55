// lib/auto-crop.ts
'use client';

// Detecta os limites reais de uma logo (ignorando bordas transparentes/brancas)
// e devolve um Blob PNG novo, recortado, com padding mínimo de 5%

type Limites = { topo: number; baixo: number; esq: number; dir: number };

/**
 * Recorta uma imagem removendo bordas transparentes ou (quase) brancas.
 * Retorna Blob PNG novo, ou null se a imagem for toda transparente/branca.
 */
export async function autoCropLogo(arquivo: File | Blob): Promise<Blob | null> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(arquivo);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  const limites = detectarLimites(data, w, h);
  if (!limites) return null;

  // Adiciona padding (5% da menor dimensão, no mínimo 8px)
  const ladoMenor = Math.min(limites.dir - limites.esq, limites.baixo - limites.topo);
  const padding = Math.max(8, Math.round(ladoMenor * 0.05));

  let novoEsq = Math.max(0, limites.esq - padding);
  let novoDir = Math.min(w, limites.dir + padding);
  let novoTopo = Math.max(0, limites.topo - padding);
  let novoBaixo = Math.min(h, limites.baixo + padding);

  const novaW = novoDir - novoEsq;
  const novaH = novoBaixo - novoTopo;

  // Se já está apertadinho (>90% de uso), não cropa
  const usoX = novaW / w;
  const usoY = novaH / h;
  if (usoX > 0.9 && usoY > 0.9) {
    return null; // imagem já está bem encaixada, retorna null pra não substituir
  }

  // Cria canvas novo com tamanho recortado
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = novaW;
  cropCanvas.height = novaH;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) return null;

  cropCtx.drawImage(canvas, novoEsq, novoTopo, novaW, novaH, 0, 0, novaW, novaH);

  return new Promise<Blob>((resolve, reject) => {
    cropCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar PNG'))),
      'image/png',
    );
  });
}

// Detecta o "bounding box" do conteúdo real (não-transparente, não-branco)
function detectarLimites(data: Uint8ClampedArray, w: number, h: number): Limites | null {
  let topo = h, baixo = -1, esq = w, dir = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];

      // Considera "vazio" se for muito transparente OU se for muito branco/cinza claro
      const ehVazio = a < 30 || (r > 240 && g > 240 && b > 240);
      if (ehVazio) continue;

      if (y < topo) topo = y;
      if (y > baixo) baixo = y;
      if (x < esq) esq = x;
      if (x > dir) dir = x;
    }
  }

  if (baixo < 0) return null; // imagem completamente vazia
  return { topo, baixo: baixo + 1, esq, dir: dir + 1 };
}

/**
 * Helper: converte um File em Blob com auto-crop aplicado.
 * Se não der pra cropar (imagem vazia ou já encaixada), retorna o original.
 */
export async function tentarAutoCrop(arquivo: File): Promise<File> {
  try {
    const blob = await autoCropLogo(arquivo);
    if (!blob) return arquivo;
    // Mantém nome original mas força extensão PNG
    const nomeBase = arquivo.name.replace(/\.[^.]+$/, '');
    return new File([blob], nomeBase + '-cropped.png', { type: 'image/png' });
  } catch (e) {
    console.warn('Auto-crop falhou, usando arquivo original:', e);
    return arquivo;
  }
}
