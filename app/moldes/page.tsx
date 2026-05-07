// app/moldes/page.tsx
import Link from 'next/link';
import { dbMoldes, type Molde } from '@/lib/db';
import { Plus } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function MoldesPage() {
  const moldes = await dbMoldes.listar();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-10">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">/moldes</span>
          <h1 className="h-display text-5xl mt-2">Moldes</h1>
        </div>
        <Link href="/moldes/novo" className="btn-primary">
          <Plus className="w-4 h-4" /> Novo molde
        </Link>
      </div>

      {moldes.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-muted mb-4">
            Nenhum molde cadastrado. Suba a imagem do seu primeiro molde e marque os slots em cima dela.
          </p>
          <Link href="/moldes/novo" className="btn-secondary">
            <Plus className="w-4 h-4" /> Cadastrar primeiro molde
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {moldes.map((m) => <MoldeCard key={m.id} molde={m} />)}
        </div>
      )}
    </div>
  );
}

function MoldeCard({ molde }: { molde: Molde }) {
  const slots = JSON.parse(molde.slots_json || '[]') as any[];
  const aspecto = molde.largura / molde.altura;

  return (
    <Link href={`/moldes/${molde.id}`} className="card hover:border-ink transition-colors group p-3">
      <div className="rounded-lg bg-line/40 mb-3 overflow-hidden grid place-items-center" style={{ aspectRatio: aspecto }}>
        {molde.imagem_path && <img src={molde.imagem_path} alt="" className="w-full h-full object-contain" />}
      </div>
      <h3 className="font-medium truncate">{molde.nome}</h3>
      <div className="flex items-center justify-between mt-1 text-xs text-muted">
        <span className="font-mono">{molde.largura}×{molde.altura}</span>
        <span>{slots.length} {slots.length === 1 ? 'slot' : 'slots'}</span>
      </div>
    </Link>
  );
}
