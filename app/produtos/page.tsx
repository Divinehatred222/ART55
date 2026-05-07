// app/produtos/page.tsx
import Link from 'next/link';
import { dbProdutos, type Produto } from '@/lib/db';
import { Plus, ImageOff, Sparkles } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ProdutosPage() {
  const produtos = await dbProdutos.listar();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-10 gap-4 flex-wrap">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">/produtos</span>
          <h1 className="h-display text-5xl mt-2">Catálogo</h1>
          <p className="text-muted mt-2 text-sm max-w-xl">
            Banco de imagens dos produtos. Cadastre uma vez (nome + imagem PNG recortada) e reutilize em todas as artes.
            Os preços ficam por cliente, na hora da geração.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/produtos/importar" className="btn-secondary">
            <Sparkles className="w-4 h-4" /> Importar com IA
          </Link>
          <Link href="/produtos/novo" className="btn-primary">
            <Plus className="w-4 h-4" /> Novo produto
          </Link>
        </div>
      </div>

      {produtos.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-muted mb-4">
            Nenhum produto no catálogo.
          </p>
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <Link href="/produtos/importar" className="btn-primary">
              <Sparkles className="w-4 h-4" /> Importar várias com IA
            </Link>
            <span className="text-muted text-xs">ou</span>
            <Link href="/produtos/novo" className="btn-secondary">
              <Plus className="w-4 h-4" /> Cadastrar uma manualmente
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {produtos.map((p) => (
            <ProdutoCard key={p.id} produto={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProdutoCard({ produto }: { produto: Produto }) {
  return (
    <Link href={`/produtos/${produto.id}`} className="card hover:border-ink transition-colors group p-3">
      <div className="aspect-square rounded-lg bg-line/40 mb-3 overflow-hidden grid place-items-center">
        {produto.imagem_path ? (
          <img src={produto.imagem_path} alt="" className="max-w-full max-h-full object-contain p-3" />
        ) : (
          <ImageOff className="w-6 h-6 text-muted" />
        )}
      </div>
      <h3 className="font-medium text-sm line-clamp-2" title={produto.nome}>{produto.nome}</h3>
      {produto.apelidos.length > 0 && (
        <p className="text-xs text-muted mt-1 truncate" title={produto.apelidos.join(', ')}>
          + {produto.apelidos.length} {produto.apelidos.length === 1 ? 'apelido' : 'apelidos'}
        </p>
      )}
    </Link>
  );
}
