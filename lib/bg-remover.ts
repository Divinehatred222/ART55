// lib/bg-remover.ts
'use client';

// Camada de abstração para remoção de fundo.
// Métodos: IA local + chroma key (com cores predefinidas ou customizada).

export type Metodo =
  | 'ia-local'
  | 'chroma-branco'
  | 'chroma-preto'
  | 'chroma-verde'
  | 'chroma-azul'
  | 'chroma-cinza'
  | 'chroma-customizada';

export type ChromaConfig = {
  cor: string;        // hex
  tolerancia: number; // 5-100 (px de distância de cor)
};

export type ProgressoEvento = {
  fase: 'carregando-modelo' | 'processando' | 'finalizando' | 'concluido';
  porcentagem: number;
  mensagem?: string;
};

export type RemovedorBG = {
  preCarregar?: () => Promise<void>;
  remover: (
    arquivo: File | Blob,
    onProgresso?: (e: ProgressoEvento) => void,
    config?: ChromaConfig,
  ) => Promise<Blob>;
  rotulo: string;
};

// Predefinidas pra UI
export const CORES_PREDEFINIDAS: { id: Metodo; rotulo: string; cor: string; tolerancia: number }[] = [
  { id: 'chroma-branco', rotulo: 'Branco', cor: '#FFFFFF', tolerancia: 30 },
  { id: 'chroma-preto', rotulo: 'Preto', cor: '#000000', tolerancia: 30 },
  { id: 'chroma-verde', rotulo: 'Verde chroma', cor: '#00FF00', tolerancia: 50 },
  { id: 'chroma-azul', rotulo: 'Azul chroma', cor: '#0000FF', tolerancia: 50 },
  { id: 'chroma-cinza', rotulo: 'Cinza claro', cor: '#E5E5E5', tolerancia: 25 },
];

// =========================================================
// IA local
// =========================================================
let _modeloCarregado = false;
let _modulo: any = null;

async function carregarModulo() {
  if (_modulo) return _modulo;
  _modulo = await import('@imgly/background-removal');
  return _modulo;
}

export const removedorIALocal: RemovedorBG = {
  rotulo: 'IA local',
  async preCarregar() {
    const mod = await carregarModulo();
    if (_modeloCarregado) return;
    const blob = await fetch(
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=',
    ).then((r) => r.blob());
    try {
      await mod.removeBackground(blob);
      _modeloCarregado = true;
    } catch (e) {
      console.warn('Pré-carga falhou:', e);
    }
  },
  async remover(arquivo, onProgresso) {
    const mod = await carregarModulo();
    onProgresso?.({
      fase: 'carregando-modelo',
      porcentagem: 5,
      mensagem: _modeloCarregado ? 'Modelo já em memória' : 'Baixando modelo (~80MB)',
    });

    const config: any = {
      progress: (key: string, current: number, total: number) => {
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;
        if (key.startsWith('fetch')) {
          onProgresso?.({ fase: 'carregando-modelo', porcentagem: Math.min(50, pct / 2), mensagem: 'Baixando modelo' });
        } else if (key.startsWith('compute')) {
          onProgresso?.({ fase: 'processando', porcentagem: 50 + Math.round(pct / 2), mensagem: 'Removendo fundo' });
        }
      },
      model: 'medium',
      output: { format: 'image/png', quality: 1 },
    };

    onProgresso?.({ fase: 'processando', porcentagem: 50, mensagem: 'Processando' });
    const blob: Blob = await mod.removeBackground(arquivo, config);
    _modeloCarregado = true;
    onProgresso?.({ fase: 'concluido', porcentagem: 100 });
    return blob;
  },
};

// =========================================================
// Chroma key (genérico - aceita cor + tolerância)
// =========================================================

function hexParaRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

async function removerPorCor(
  arquivo: File | Blob,
  hex: string,
  tolerancia: number,
  onProgresso?: (e: ProgressoEvento) => void,
): Promise<Blob> {
  const corAlvo = hexParaRgb(hex);
  onProgresso?.({ fase: 'processando', porcentagem: 20 });

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

  onProgresso?.({ fase: 'processando', porcentagem: 50 });

  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Sem contexto canvas');
  ctx.drawImage(img, 0, 0);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const dist = Math.sqrt(
      (r - corAlvo.r) ** 2 + (g - corAlvo.g) ** 2 + (b - corAlvo.b) ** 2,
    );
    if (dist < tolerancia) {
      data[i + 3] = 0;
    } else if (dist < tolerancia * 2) {
      // borda suave
      const alpha = (dist - tolerancia) / tolerancia;
      data[i + 3] = Math.round(data[i + 3] * alpha);
    }
  }

  ctx.putImageData(imgData, 0, 0);
  onProgresso?.({ fase: 'finalizando', porcentagem: 90 });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Falha ao gerar PNG'))), 'image/png');
  });

  onProgresso?.({ fase: 'concluido', porcentagem: 100 });
  return blob;
}

function criarRemovedorChroma(rotulo: string, corPadrao: string, tolPadrao: number): RemovedorBG {
  return {
    rotulo,
    async remover(arquivo, onProgresso, config) {
      const cor = config?.cor || corPadrao;
      const tol = config?.tolerancia ?? tolPadrao;
      return removerPorCor(arquivo, cor, tol, onProgresso);
    },
  };
}

export const removedorBranco = criarRemovedorChroma('Fundo branco', '#FFFFFF', 30);
export const removedorPreto = criarRemovedorChroma('Fundo preto', '#000000', 30);
export const removedorVerde = criarRemovedorChroma('Verde chroma', '#00FF00', 50);
export const removedorAzul = criarRemovedorChroma('Azul chroma', '#0000FF', 50);
export const removedorCinza = criarRemovedorChroma('Cinza claro', '#E5E5E5', 25);
export const removedorCustomizado = criarRemovedorChroma('Cor customizada', '#FFFFFF', 30);

export function getRemovedor(metodo: Metodo): RemovedorBG {
  switch (metodo) {
    case 'ia-local': return removedorIALocal;
    case 'chroma-branco': return removedorBranco;
    case 'chroma-preto': return removedorPreto;
    case 'chroma-verde': return removedorVerde;
    case 'chroma-azul': return removedorAzul;
    case 'chroma-cinza': return removedorCinza;
    case 'chroma-customizada': return removedorCustomizado;
  }
}

// Helpers
export function blobParaFile(blob: Blob, nome: string): File {
  return new File([blob], nome, { type: blob.type || 'image/png' });
}

export function arquivoSemExtensao(nome: string): string {
  return nome.replace(/\.[^.]+$/, '');
}

// Pega a cor do pixel em (x, y) de uma imagem (usado no eyedropper)
export async function pegarCorPixel(src: string, x: number, y: number): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Sem contexto canvas');
  ctx.drawImage(img, 0, 0);
  const px = ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data;
  const toHex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${toHex(px[0])}${toHex(px[1])}${toHex(px[2])}`.toUpperCase();
}
