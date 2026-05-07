// app/produtos/[id]/page.tsx
import { dbProdutos } from '@/lib/db';
import { notFound } from 'next/navigation';
import ProdutoForm from '../_form';

export const dynamic = 'force-dynamic';

export default async function EditarProduto({ params }: { params: { id: string } }) {
  const produto = await dbProdutos.buscar(Number(params.id));
  if (!produto) notFound();
  return <ProdutoForm produto={produto} />;
}
