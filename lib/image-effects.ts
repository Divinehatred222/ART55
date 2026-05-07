// lib/image-effects.ts
'use client';

// Configurações de polimento expandidas:
// - sombra
// - colorGrading (com 2 modos: tint sutil ou substituição mais forte)
// - brilho
// - contraste
// - saturação
// - nitidez (sharpen)
// - vinheta

export type ModoHarmonizacao = 'tint' | 'substituir';

export type AjustesPolimento = {
  sombra: {
    ativo: boolean;
    intensidade: number;    // 0-100
    desfoque: number;       // 0-50
    deslocamentoY: number;  // 0-80
    cor: string;
  };
  colorGrading: {
    ativo: boolean;
    intensidade: number;    // 0-100
    corAlvo: string | null;
    modo: ModoHarmonizacao; // 'tint' = sutil; 'substituir' = troca de cor
  };
  brilho: {
    ativo: boolean;
    intensidade: number;    // -100 a 100
  };
  contraste: {
    ativo: boolean;
    intensidade: number;    // -100 a 100
  };
  saturacao: {
    ativo: boolean;
    intensidade: number;    // -100 a 100, 0 = neutro, -100 = preto e branco, 100 = vivido
  };
  nitidez: {
    ativo: boolean;
    intensidade: number;    // 0 a 100
  };
  vinheta: {
    ativo: boolean;
    intensidade: number;    // 0 a 100
  };
};

export const AJUSTES_PADRAO: AjustesPolimento = {
  sombra: {
    ativo: true,
    intensidade: 50,
    desfoque: 25,
    deslocamentoY: 30,
    cor: '#000000',
  },
  colorGrading: {
    ativo: true,
    intensidade: 15,
    corAlvo: null,
    modo: 'tint',
  },
  brilho: { ativo: false, intensidade: 0 },
  contraste: { ativo: false, intensidade: 5 },
  saturacao: { ativo: false, intensidade: 0 },
  nitidez: { ativo: false, intensidade: 30 },
  vinheta: { ativo: false, intensidade: 30 },
};

// =====================================================================
// PRESETS prontos
// =====================================================================

export type Preset = {
  id: string;
  nome: string;
  emoji: string;
  descricao: string;
  ajustes: AjustesPolimento;
  custom?: boolean;  // true se foi salvo pelo usuário
};

export const PRESETS_PRONTOS: Preset[] = [
  {
    id: 'sombra-suave',
    nome: 'Sombra suave',
    emoji: '🌑',
    descricao: 'Sombra natural sutil. Sem mexer nas cores.',
    ajustes: {
      ...AJUSTES_PADRAO,
      sombra: { ativo: true, intensidade: 35, desfoque: 30, deslocamentoY: 25, cor: '#000000' },
      colorGrading: { ativo: false, intensidade: 0, corAlvo: null, modo: 'tint' },
      brilho: { ativo: false, intensidade: 0 },
      contraste: { ativo: false, intensidade: 0 },
      saturacao: { ativo: false, intensidade: 0 },
      nitidez: { ativo: false, intensidade: 0 },
      vinheta: { ativo: false, intensidade: 0 },
    },
  },
  {
    id: 'destaque-produto',
    nome: 'Destaque produto',
    emoji: '🌟',
    descricao: 'Sombra forte + contraste. Faz o produto saltar do fundo.',
    ajustes: {
      ...AJUSTES_PADRAO,
      sombra: { ativo: true, intensidade: 70, desfoque: 35, deslocamentoY: 40, cor: '#000000' },
      colorGrading: { ativo: false, intensidade: 0, corAlvo: null, modo: 'tint' },
      brilho: { ativo: false, intensidade: 0 },
      contraste: { ativo: true, intensidade: 15 },
      saturacao: { ativo: true, intensidade: 10 },
      nitidez: { ativo: true, intensidade: 30 },
      vinheta: { ativo: false, intensidade: 0 },
    },
  },
  {
    id: 'integrar-fundo',
    nome: 'Integrar fundo',
    emoji: '🎨',
    descricao: 'Harmoniza cor com o fundo do molde. Pra produto não parecer "colado".',
    ajustes: {
      ...AJUSTES_PADRAO,
      sombra: { ativo: true, intensidade: 55, desfoque: 30, deslocamentoY: 30, cor: '#000000' },
      colorGrading: { ativo: true, intensidade: 25, corAlvo: null, modo: 'tint' },
      brilho: { ativo: false, intensidade: 0 },
      contraste: { ativo: true, intensidade: 5 },
      saturacao: { ativo: false, intensidade: 0 },
      nitidez: { ativo: false, intensidade: 0 },
      vinheta: { ativo: false, intensidade: 0 },
    },
  },
  {
    id: 'brilho-premium',
    nome: 'Brilho premium',
    emoji: '💎',
    descricao: 'Sombra suave + brilho/contraste sutis. Aspecto "embalagem nova".',
    ajustes: {
      ...AJUSTES_PADRAO,
      sombra: { ativo: true, intensidade: 40, desfoque: 25, deslocamentoY: 25, cor: '#000000' },
      colorGrading: { ativo: false, intensidade: 0, corAlvo: null, modo: 'tint' },
      brilho: { ativo: true, intensidade: 10 },
      contraste: { ativo: true, intensidade: 8 },
      saturacao: { ativo: true, intensidade: 8 },
      nitidez: { ativo: true, intensidade: 25 },
      vinheta: { ativo: false, intensidade: 0 },
    },
  },
  {
    id: 'sem-polimento',
    nome: 'Sem polimento',
    emoji: '⚡',
    descricao: 'Desliga tudo. Produto sai limpo, sem ajustes.',
    ajustes: {
      ...AJUSTES_PADRAO,
      sombra: { ativo: false, intensidade: 0, desfoque: 0, deslocamentoY: 0, cor: '#000000' },
      colorGrading: { ativo: false, intensidade: 0, corAlvo: null, modo: 'tint' },
      brilho: { ativo: false, intensidade: 0 },
      contraste: { ativo: false, intensidade: 0 },
      saturacao: { ativo: false, intensidade: 0 },
      nitidez: { ativo: false, intensidade: 0 },
      vinheta: { ativo: false, intensidade: 0 },
    },
  },
];

// =====================================================================
// Presets customizados (localStorage)
// =====================================================================

const KEY_PRESETS = 'molde-app:presets-custom';

export function lerPresetsCustom(): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY_PRESETS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Preset[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function salvarPresetCustom(preset: Preset): void {
  if (typeof window === 'undefined') return;
  const atuais = lerPresetsCustom();
  // Remove se já existe (por id)
  const filtrados = atuais.filter((p) => p.id !== preset.id);
  filtrados.push({ ...preset, custom: true });
  localStorage.setItem(KEY_PRESETS, JSON.stringify(filtrados));
}

export function excluirPresetCustom(id: string): void {
  if (typeof window === 'undefined') return;
  const atuais = lerPresetsCustom();
  localStorage.setItem(KEY_PRESETS, JSON.stringify(atuais.filter((p) => p.id !== id)));
}

export function todosPresets(): Preset[] {
  return [...PRESETS_PRONTOS, ...lerPresetsCustom()];
}

// =====================================================================
// Detecção de cor dominante (mantida)
// =====================================================================

export async function detectarCorDominante(srcImagem: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const TAMANHO = 50;
      const canvas = document.createElement('canvas');
      canvas.width = TAMANHO;
      canvas.height = TAMANHO;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) { resolve('#888888'); return; }
      ctx.drawImage(img, 0, 0, TAMANHO, TAMANHO);
      const data = ctx.getImageData(0, 0, TAMANHO, TAMANHO).data;

      const buckets: Record<number, { r: number; g: number; b: number; count: number }> = {};
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 100) continue;
        const lum = (r + g + b) / 3;
        if (lum < 15 || lum > 245) continue;
        const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
        if (!buckets[key]) buckets[key] = { r: 0, g: 0, b: 0, count: 0 };
        buckets[key].r += r;
        buckets[key].g += g;
        buckets[key].b += b;
        buckets[key].count++;
      }

      let maior: any = null;
      for (const k in buckets) {
        if (!maior || buckets[k].count > maior.count) maior = buckets[k];
      }
      if (!maior || maior.count === 0) { resolve('#888888'); return; }

      const r = Math.round(maior.r / maior.count);
      const g = Math.round(maior.g / maior.count);
      const b = Math.round(maior.b / maior.count);
      resolve(rgbParaHex(r, g, b));
    };
    img.onerror = () => reject(new Error('Erro carregando imagem para análise'));
    img.src = srcImagem;
  });
}

export function hexParaRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

export function rgbParaHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0'))
    .join('');
}

export function corDeSombra(corFundo: string, escurecimento = 0.7): string {
  const { r, g, b } = hexParaRgb(corFundo);
  return rgbParaHex(r * (1 - escurecimento), g * (1 - escurecimento), b * (1 - escurecimento));
}

// =====================================================================
// HSL <-> RGB (para harmonização avançada)
// =====================================================================

export function rgbParaHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: h * 360, s: s * 100, l: l * 100 };
}

export function hslParaRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
  h /= 360; s /= 100; l /= 100;
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return { r: r * 255, g: g * 255, b: b * 255 };
}
