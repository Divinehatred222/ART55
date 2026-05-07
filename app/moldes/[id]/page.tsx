// app/moldes/[id]/page.tsx
import { dbMoldes, todasFontes } from '@/lib/db';
import { notFound } from 'next/navigation';
import EditorMolde from './editor';

export const dynamic = 'force-dynamic';

export default async function EditarMolde({ params }: { params: { id: string } }) {
  const molde = await dbMoldes.buscar(Number(params.id));
  if (!molde) notFound();
  return <EditorMolde molde={molde} fontes={await todasFontes()} />;
}
