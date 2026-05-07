// app/clientes/[id]/page.tsx
import { dbClientes } from '@/lib/db';
import { notFound } from 'next/navigation';
import ClienteForm from '../_form';

export const dynamic = 'force-dynamic';

export default async function EditarCliente({ params }: { params: { id: string } }) {
  const cliente = await dbClientes.buscar(Number(params.id));
  if (!cliente) notFound();
  return <ClienteForm cliente={cliente} />;
}
