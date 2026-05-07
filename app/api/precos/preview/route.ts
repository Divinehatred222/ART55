// app/api/precos/preview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  parsearTabela, detectarColunas, detectarTemCabecalho,
} from '@/lib/match';

// Recebe texto/linhas e retorna a tabela bruta + sugestões de cabeçalho/colunas
// SEM rodar o matching ainda (vai pra frontend pra usuário confirmar)

export async function POST(req: NextRequest) {
  const body = await req.json();
  const texto = body.texto as string | undefined;
  const linhas = body.linhas as string[][] | undefined;

  let dados: string[][] = [];
  if (linhas) {
    dados = linhas.filter((l) => l.some((c) => c && String(c).trim()));
  } else if (texto) {
    dados = parsearTabela(texto);
  } else {
    return NextResponse.json({ error: 'Texto ou linhas é obrigatório' }, { status: 400 });
  }

  if (dados.length === 0) {
    return NextResponse.json({ error: 'Planilha vazia' }, { status: 400 });
  }

  // Normaliza: garante que todas as linhas tenham o mesmo número de colunas
  const numColunas = Math.max(...dados.map((l) => l.length));
  const tabela = dados.map((l) => {
    const cells = [...l];
    while (cells.length < numColunas) cells.push('');
    return cells.map((c) => String(c || '').trim());
  });

  // Sugere se primeira linha é cabeçalho
  const sugestaoTemCabecalho = detectarTemCabecalho(tabela);

  // Sugere quais colunas são nome e preço
  let sugestaoColNome = 0;
  let sugestaoColPreco = numColunas > 1 ? 1 : 0;
  if (sugestaoTemCabecalho) {
    const det = detectarColunas(tabela[0]);
    sugestaoColNome = det.nome;
    sugestaoColPreco = det.preco;
  } else {
    // Heurística sem cabeçalho:
    // - Coluna nome: mais texto longo, mais variado, menos numérica
    // - Coluna preço: mais valores que parecem preço (dígitos, vírgulas, R$)
    let melhorScoreNome = -1;
    let melhorScorePreco = -1;
    for (let c = 0; c < numColunas; c++) {
      const valores = tabela.map((l) => l[c] || '').filter(Boolean);
      if (valores.length === 0) continue;

      // Score de "preço": fração de valores que parecem preço E média de magnitude
      const ehPreco = valores.filter((v) =>
        /^[R$\s]*\d{1,4}([.,]\d{1,2})?$/.test(v.trim()),
      );
      const fracaoPreco = ehPreco.length / valores.length;
      // Magnitude (preferir colunas com valores mais altos = preço de venda > custo)
      const valoresNum = ehPreco.map((v) => {
        const n = parseFloat(v.replace(/[^\d.,]/g, '').replace(',', '.'));
        return isNaN(n) ? 0 : n;
      });
      const mediaMagnitude = valoresNum.length > 0
        ? valoresNum.reduce((s, n) => s + n, 0) / valoresNum.length
        : 0;
      const scorePreco = fracaoPreco * 100 + Math.min(50, mediaMagnitude / 10);

      // Score de "nome": tamanho médio + variabilidade
      const tamMedio = valores.reduce((s, v) => s + v.length, 0) / valores.length;
      const ehTexto = valores.filter((v) => /[a-zA-ZÀ-ÿ]/.test(v) && !/^[R$\s]*\d/.test(v));
      const fracaoTexto = ehTexto.length / valores.length;
      const scoreNome = tamMedio + fracaoTexto * 50 - fracaoPreco * 30;

      if (scorePreco > melhorScorePreco && fracaoPreco > 0.5) {
        melhorScorePreco = scorePreco;
        sugestaoColPreco = c;
      }
      if (scoreNome > melhorScoreNome) {
        melhorScoreNome = scoreNome;
        sugestaoColNome = c;
      }
    }

    // Se nome e preço foram pra mesma coluna, ajusta
    if (sugestaoColNome === sugestaoColPreco && numColunas > 1) {
      sugestaoColPreco = sugestaoColNome === 0 ? 1 : 0;
    }
  }

  return NextResponse.json({
    tabela,
    num_colunas: numColunas,
    sugestao_tem_cabecalho: sugestaoTemCabecalho,
    sugestao_col_nome: sugestaoColNome,
    sugestao_col_preco: sugestaoColPreco,
  });
}
