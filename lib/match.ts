// lib/match.ts
// Matching difuso e parser de planilhas para casar produtos da planilha com catálogo.

import type { Produto } from './types';

// Normaliza: minúsculo, sem acento, sem pontuação extra, espaços simples
export function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Jaccard nos tokens
function jaccard(a: string, b: string): number {
  const tokensA = new Set(normalizar(a).split(' ').filter(Boolean));
  const tokensB = new Set(normalizar(b).split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersecao = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersecao++;
  const uniao = tokensA.size + tokensB.size - intersecao;
  return intersecao / uniao;
}

// Quanto dos tokens de "needle" estão em "haystack"
function contemTokens(needle: string, haystack: string): number {
  const tokensN = normalizar(needle).split(' ').filter(Boolean);
  const tokensH = new Set(normalizar(haystack).split(' ').filter(Boolean));
  if (tokensN.length === 0) return 0;
  let achados = 0;
  for (const t of tokensN) if (tokensH.has(t)) achados++;
  return achados / tokensN.length;
}

// Substring matching: o "needle" inteiro normalizado aparece dentro de "haystack" normalizado?
// Excelente pra "nestogeno 2" estar em "leite infantil nestogeno 2 400g"
function contemSubstring(needle: string, haystack: string): boolean {
  const n = normalizar(needle);
  const h = normalizar(haystack);
  if (!n || !h) return false;
  return h.includes(n);
}

export type MatchResultado = {
  produto: Produto;
  score: number;
  metodo: 'exato' | 'apelido' | 'substring' | 'tokens' | 'parcial';
};

export function encontrarMatch(consulta: string, catalogo: Produto[]): MatchResultado | null {
  if (!consulta.trim() || catalogo.length === 0) return null;

  const consultaN = normalizar(consulta);

  // 1) Exato
  for (const produto of catalogo) {
    if (normalizar(produto.nome) === consultaN) {
      return { produto, score: 1, metodo: 'exato' };
    }
  }

  // 2) Apelidos exatos
  for (const produto of catalogo) {
    for (const apelido of produto.apelidos || []) {
      if (normalizar(apelido) === consultaN) {
        return { produto, score: 0.99, metodo: 'apelido' };
      }
    }
  }

  // 3) Substring exato (consulta inteira aparece dentro do nome/apelido)
  // Ex: "nestogeno 2" ⊂ "leite infantil nestogeno 2 400g"
  let melhorSubstring: MatchResultado | null = null;
  for (const produto of catalogo) {
    const candidatos = [produto.nome, ...(produto.apelidos || [])];
    for (const cand of candidatos) {
      if (contemSubstring(consulta, cand)) {
        // Score: quão grande a consulta é em relação ao candidato (mais cobertura = score maior)
        const consultaLen = normalizar(consulta).length;
        const candLen = normalizar(cand).length;
        const cobertura = consultaLen / candLen;
        // Score base: 0.85 + bônus por cobertura
        const score = 0.85 + cobertura * 0.1;
        if (!melhorSubstring || score > melhorSubstring.score) {
          melhorSubstring = { produto, score, metodo: 'substring' };
        }
      }
    }
  }
  if (melhorSubstring) return melhorSubstring;

  // 4) Token containment + Jaccard combinado
  let melhor: MatchResultado | null = null;
  for (const produto of catalogo) {
    const candidatos = [produto.nome, ...(produto.apelidos || [])];
    for (const cand of candidatos) {
      const cont = contemTokens(consulta, cand);
      const jac = jaccard(consulta, cand);
      const score = cont * 0.7 + jac * 0.3;
      // Threshold reduzido: 0.4 (era 0.5) — captura matches mais difíceis
      if (score > 0.4 && (!melhor || score > melhor.score)) {
        melhor = {
          produto,
          score,
          metodo: cont >= 0.99 ? 'tokens' : 'parcial',
        };
      }
    }
  }

  return melhor;
}

// =============================================================
// Parser de planilha
// =============================================================

// Detecta se a primeira linha parece um CABEÇALHO (palavras descritivas)
// ou já é DADO (contém número que parece preço)
export function pareceCabecalho(linha: string[]): boolean {
  // Se algum campo for puramente numérico ou tiver R$, é dado, não cabeçalho
  const temPreco = linha.some((c) => /^[\s]*(R\$\s*)?[\d.,]+[\s]*$/.test(c));
  if (temPreco) return false;
  // Se todos os campos são curtos e textuais (palavras), é cabeçalho
  const todosTexto = linha.every((c) => /^[a-zA-ZÀ-ÿ\s]+$/.test(c.trim()) && c.trim().length > 0);
  return todosTexto;
}

// Parser de uma linha — separa nome do preço de forma inteligente
// Aceita formatos como:
//   "Dipirona 500mg, 14.99"        (separador padrão)
//   "Dipirona 500mg\t14,99"         (TAB)
//   "Dipirona 500mg;14,99"          (PT-BR)
//   "Dipirona 500mg 14.99"          (espaço)
//   "Dipirona 500mg 14,99"          (espaço + preço com vírgula brasileira)
//   "nestogeno 2 4,99"              (caso específico do usuário)
function parsearLinhaInteligente(linha: string): string[] {
  const trimmed = linha.trim();
  if (!trimmed) return [];

  // Tenta detectar separadores explícitos primeiro
  if (trimmed.includes('\t')) {
    return trimmed.split('\t').map((s) => s.trim());
  }
  if (trimmed.includes(';')) {
    return trimmed.split(';').map((s) => s.trim());
  }

  // Estratégia: encontrar o ÚLTIMO número que pareça preço — TUDO antes é nome
  // Regex: pega "R$ 14,99", "14.99", "14,99", "14" no fim da linha
  const matchPreco = trimmed.match(/^(.+?)[\s,]+(R\$\s*)?(\d+[.,]?\d{0,2})\s*$/);
  if (matchPreco) {
    const nome = matchPreco[1].trim().replace(/[,\s]+$/, '');
    const preco = (matchPreco[2] || '') + matchPreco[3];
    return [nome, preco.trim()];
  }

  // Se tem vírgula mas a parte depois da última vírgula NÃO parece preço,
  // faz split por vírgula normal (várias colunas)
  if (trimmed.includes(',')) {
    return trimmed.split(',').map((s) => s.trim());
  }

  // Sem separador: trata tudo como nome (sem preço)
  return [trimmed];
}

export function parsearTabela(texto: string): string[][] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (linhas.length === 0) return [];

  return linhas.map((linha) => parsearLinhaInteligente(linha));
}

// Detecta colunas — quando vier cabeçalho identificado
export function detectarColunas(cabecalho: string[]): { nome: number; preco: number } {
  const nomeAliases = ['nome', 'produto', 'descrição', 'descricao', 'item'];
  const precoAliases = ['preço', 'preco', 'valor', 'price', 'r$'];

  let idxNome = -1;
  let idxPreco = -1;

  cabecalho.forEach((col, i) => {
    const colN = normalizar(col);
    if (idxNome < 0 && nomeAliases.some((a) => colN.includes(a))) idxNome = i;
    if (idxPreco < 0 && precoAliases.some((a) => colN.includes(a))) idxPreco = i;
  });

  if (idxNome < 0) idxNome = 0;
  if (idxPreco < 0) idxPreco = cabecalho.length > 1 ? 1 : 0;

  return { nome: idxNome, preco: idxPreco };
}

// Helper: dado um array de linhas, decide se a primeira é cabeçalho ou já dado
export function detectarTemCabecalho(linhas: string[][]): boolean {
  if (linhas.length === 0) return false;
  return pareceCabecalho(linhas[0]);
}

// =============================================================
// Matching com lista — retorna TODOS os matches ordenados por score
// Útil pra mostrar opções na UI quando há ambiguidade
// =============================================================

export function encontrarMatches(
  consulta: string,
  catalogo: Produto[],
  limite = 5,
  scoreMinimo = 0.3,
): MatchResultado[] {
  if (!consulta.trim() || catalogo.length === 0) return [];

  const consultaN = normalizar(consulta);
  const tokensN = consultaN.split(' ').filter(Boolean);
  const resultados: MatchResultado[] = [];

  for (const produto of catalogo) {
    const candidatos = [produto.nome, ...(produto.apelidos || [])];
    let melhorScore = 0;
    let melhorMetodo: MatchResultado['metodo'] = 'parcial';

    for (const cand of candidatos) {
      const candN = normalizar(cand);
      const tokensH = new Set(candN.split(' ').filter(Boolean));

      // Match exato
      if (candN === consultaN) {
        melhorScore = Math.max(melhorScore, 1);
        melhorMetodo = candidatos[0] === cand ? 'exato' : 'apelido';
        continue;
      }

      // Substring exato
      if (candN.includes(consultaN)) {
        // Score baseado em cobertura
        const cobertura = consultaN.length / candN.length;
        const score = 0.85 + cobertura * 0.1;
        if (score > melhorScore) {
          melhorScore = score;
          melhorMetodo = 'substring';
        }
        continue;
      }

      // Token containment: TODOS os tokens da consulta estão no candidato
      let achados = 0;
      for (const t of tokensN) if (tokensH.has(t)) achados++;
      const contencao = tokensN.length > 0 ? achados / tokensN.length : 0;

      // Jaccard pra desempate
      const uniao = tokensN.length + tokensH.size - achados;
      const jac = uniao > 0 ? achados / uniao : 0;

      // Se TODOS os tokens da consulta estão no candidato, é match forte
      if (contencao >= 0.99) {
        // Score: 0.7 base + bônus por compactness (quanto mais "denso" o match no candidato)
        const score = 0.7 + jac * 0.2;
        if (score > melhorScore) {
          melhorScore = score;
          melhorMetodo = 'tokens';
        }
      } else if (contencao >= 0.5) {
        // Match parcial — alguns tokens batem mas não todos
        const score = contencao * 0.5 + jac * 0.3;
        if (score > melhorScore) {
          melhorScore = score;
          melhorMetodo = 'parcial';
        }
      }
    }

    if (melhorScore >= scoreMinimo) {
      resultados.push({ produto, score: melhorScore, metodo: melhorMetodo });
    }
  }

  // Ordena por score desc e limita
  return resultados.sort((a, b) => b.score - a.score).slice(0, limite);
}
