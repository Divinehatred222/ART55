// app/page.tsx
import Link from 'next/link';
import { dbClientes, dbMoldes, dbProdutos } from '@/lib/db';
import { ArrowUpRight, Sparkles, Box, Users, Layers } from 'lucide-react';

export const dynamic = 'force-dynamic';

async function getStats() {
  try {
    const [clientes, moldes, produtos] = await Promise.all([
      await dbClientes.contar(),
      await dbMoldes.contar(),
      await dbProdutos.contar(),
    ]);
    return { clientes, moldes, produtos };
  } catch {
    return { clientes: 0, moldes: 0, produtos: 0 };
  }
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="bg-grid">
      <section className="max-w-7xl mx-auto px-6 pt-20 pb-16 relative">
        <div className="max-w-3xl animate-fade-up">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted mb-6">
            <Sparkles className="w-3 h-3" /> ferramenta interna
          </span>
          <h1 className="h-display text-6xl md:text-7xl leading-[0.95] mb-6">
            Crie artes em <em className="text-accent">segundos</em>,<br />
            não em horas.
          </h1>
          <p className="text-lg text-muted max-w-xl mb-8 leading-relaxed">
            Cadastre seus moldes uma vez, marque onde fica cada elemento, e deixe
            o app montar as artes automaticamente. Pronto para Meta Ads,
            campanhas e clientes diversos.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/gerar" className="btn-primary text-base px-6 py-3">
              Gerar arte
              <ArrowUpRight className="w-4 h-4" />
            </Link>
            <Link href="/moldes/novo" className="btn-secondary text-base px-6 py-3">
              Cadastrar molde
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-16">
        <div className="grid grid-cols-3 gap-4">
          <StatCard icon={<Users className="w-4 h-4" />} label="Clientes" value={stats.clientes} href="/clientes" />
          <StatCard icon={<Box className="w-4 h-4" />} label="Produtos" value={stats.produtos} href="/produtos" />
          <StatCard icon={<Layers className="w-4 h-4" />} label="Moldes" value={stats.moldes} href="/moldes" />
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="border-t border-line pt-12">
          <h2 className="h-display text-3xl mb-10">Como funciona</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <Step num="01" title="Catálogo de produtos" description="Cadastre cada produto uma vez (nome + imagem PNG recortada). Adicione apelidos para o sistema casar variações de nome automaticamente." />
            <Step num="02" title="Importe a planilha do cliente" description="Cole a tabela do Excel ou suba um CSV com nome + preço. O app casa cada linha com o catálogo automaticamente." />
            <Step num="03" title="Gere a arte" description="Escolha cliente + molde, revise os produtos casados, ajuste o que precisar e exporte em alta resolução." />
          </div>
        </div>
      </section>
    </div>
  );
}

function StatCard({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: number; href: string }) {
  return (
    <Link href={href} className="card hover:border-ink transition-colors group flex flex-col">
      <div className="flex items-center justify-between text-muted mb-3">
        <span className="text-xs uppercase tracking-wider flex items-center gap-1.5">{icon}{label}</span>
        <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <span className="h-display text-4xl">{value}</span>
    </Link>
  );
}

function Step({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div>
      <span className="font-mono text-xs text-accent mb-3 block">{num}</span>
      <h3 className="h-display text-2xl mb-2">{title}</h3>
      <p className="text-muted leading-relaxed">{description}</p>
    </div>
  );
}
