// app/clientes/page.tsx
import Link from 'next/link';
import { dbClientes, type Cliente } from '@/lib/db';
import { Plus, Pencil, MessageCircle, MapPin } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function ClientesPage() {
  const clientes = await dbClientes.listar();

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-10">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">/clientes</span>
          <h1 className="h-display text-5xl mt-2">Clientes</h1>
        </div>
        <Link href="/clientes/novo" className="btn-primary">
          <Plus className="w-4 h-4" /> Novo cliente
        </Link>
      </div>

      {clientes.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-muted mb-4">Nenhum cliente cadastrado.</p>
          <Link href="/clientes/novo" className="btn-secondary">
            <Plus className="w-4 h-4" /> Cadastrar primeiro cliente
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientes.map((c) => <ClienteCard key={c.id} cliente={c} />)}
        </div>
      )}
    </div>
  );
}

function ClienteCard({ cliente }: { cliente: Cliente }) {
  return (
    <Link href={`/clientes/${cliente.id}`} className="card hover:border-ink transition-colors group">
      <div className="flex items-start gap-4">
        <div
          className="w-14 h-14 rounded-lg border border-line shrink-0 grid place-items-center overflow-hidden"
          style={{ background: cliente.cor_primaria + '15' }}
        >
          {cliente.logo_path ? (
            <img src={cliente.logo_path} alt="" className="w-full h-full object-contain p-2" />
          ) : (
            <span className="font-display text-2xl" style={{ color: cliente.cor_primaria }}>
              {cliente.nome.charAt(0)}
            </span>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium truncate">{cliente.nome}</h3>
          <div className="space-y-0.5 mt-1.5">
            {cliente.whatsapp && (
              <div className="flex items-center gap-1.5 text-xs text-muted">
                <MessageCircle className="w-3 h-3" />
                <span className="truncate">{cliente.whatsapp}</span>
              </div>
            )}
            {cliente.endereco && (
              <div className="flex items-start gap-1.5 text-xs text-muted">
                <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                <span className="line-clamp-2">{cliente.endereco}</span>
              </div>
            )}
          </div>
        </div>
        <Pencil className="w-4 h-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      </div>
    </Link>
  );
}
