// lib/font-name.ts
// Extrai um nome legível ("Nunito Black") de um filename de fonte ("Nunito-Black.ttf")

const SEPARADORES = /[-_]|(?<=[a-z])(?=[A-Z])/g; // separa em hífen, underline ou camelCase

// Lista de palavras que indicam peso/estilo (mantém capitalização)
const PESOS_VALIDOS = new Set([
  'thin', 'extralight', 'ultralight', 'light',
  'regular', 'normal', 'book',
  'medium', 'semibold', 'demibold', 'bold',
  'extrabold', 'ultrabold', 'black', 'heavy',
  'italic', 'oblique',
  'condensed', 'expanded', 'narrow',
  'rounded', 'mono',
]);

function capitalizar(palavra: string): string {
  if (!palavra) return palavra;
  return palavra.charAt(0).toUpperCase() + palavra.slice(1).toLowerCase();
}

export function nomeAPartirDoArquivo(nomeArquivo: string): string {
  // Remove extensão
  let base = nomeArquivo.replace(/\.[^.]+$/, '');

  // Remove sufixos comuns como "Variable", "VF" e weights numéricos
  base = base.replace(/[-_]?VariableFont.*$/i, '');
  base = base.replace(/[-_]?Variable$/i, '');
  base = base.replace(/[-_]?VF$/i, '');
  base = base.replace(/\[wght.*\]/gi, '');

  // Quebra por separadores (hífen, underline, ou transições de case)
  let partes = base.split(SEPARADORES).filter(Boolean);

  // Re-capitaliza pesos conhecidos pra ficar bonito
  partes = partes.map((p) => {
    const lower = p.toLowerCase();
    if (PESOS_VALIDOS.has(lower)) {
      return capitalizar(lower);
    }
    // Mantém numéricos como estão (100, 400, 700...)
    if (/^\d+$/.test(p)) return p;
    return capitalizar(p);
  });

  // Junta com espaço
  return partes.join(' ').replace(/\s+/g, ' ').trim();
}

// Tenta detectar a "família" comum entre vários nomes (pra agrupar visualmente)
export function detectarFamilia(nomes: string[]): string | null {
  if (nomes.length === 0) return null;
  const tokens = nomes.map((n) => n.split(' '));
  const primeiro = tokens[0];

  // Acha o prefixo comum
  let prefixoComum: string[] = [];
  for (let i = 0; i < primeiro.length; i++) {
    const palavra = primeiro[i];
    if (tokens.every((t) => t[i] === palavra)) {
      prefixoComum.push(palavra);
    } else {
      break;
    }
  }
  return prefixoComum.length > 0 ? prefixoComum.join(' ') : null;
}
