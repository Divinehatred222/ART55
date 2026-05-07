// app/api/precos/importar/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbProdutos } from '@/lib/db';
import { encontrarMatches } from '@/lib/match';

// Recebe tabela já preparada + colunas mapeadas + linhas a ignorar
// (o frontend faz o preview/mapeamento; aqui só roda o matching)

export async function POST(req: NextRequest) {
  const body = await req.json();
  const tabela = body.tabela as string[][] | undefined;
  const colNome = body.col_nome as number | undefined;
  const colPreco = body.col_preco as number | undefined;
  const linhasIgnoradas = (body.linhas_ignoradas as number[]) || [];

  if (!tabela || colNome === undefined || colPreco === undefined) {
    return NextResponse.json(
      { error: 'tabela, col_nome e col_preco são obrigatórios' },
      { status: 400 },
    );
  }

  const ignoradas = new Set(linhasIgnoradas);
  const corpo = tabela.filter((_, i) => !ignoradas.has(i));
  const catalogo = await dbProdutos.listar();

  const resultados = corpo.map((linha, i) => {
    const nomePlanilha = String(linha[colNome] || '').trim();
    const precoPlanilha = String(linha[colPreco] || '').trim();
    const matches = encontrarMatches(nomePlanilha, catalogo, 5, 0.3);
    const principal = matches[0] || null;
    const alternativos = matches.slice(1);

    return {
      indice: i,
      nome_planilha: nomePlanilha,
      preco_planilha: precoPlanilha,
      match: principal
        ? {
            produto_id: principal.produto.id,
            produto_nome: principal.produto.nome,
            produto_imagem: principal.produto.imagem_path,
            score: Math.round(principal.score * 100),
            metodo: principal.metodo,
          }
        : null,
      alternativos: alternativos.map((m) => ({
        produto_id: m.produto.id,
        produto_nome: m.produto.nome,
        produto_imagem: m.produto.imagem_path,
        score: Math.round(m.score * 100),
        metodo: m.metodo,
      })),
    };
  });

  return NextResponse.json({
    cabecalho: tabela[0] || [],
    coluna_nome: colNome,
    coluna_preco: colPreco,
    resultados,
  });
}
