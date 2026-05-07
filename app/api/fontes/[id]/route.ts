// app/api/fontes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbFontes } from '@/lib/db';
import { deleteUploadedFile } from '@/lib/upload';

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (id < 0) {
    return NextResponse.json({ error: 'Fontes do sistema não podem ser excluídas' }, { status: 400 });
  }
  const fonte = await dbFontes.buscar(id);
  if (fonte?.arquivo_path) deleteUploadedFile(fonte.arquivo_path);
  await dbFontes.excluir(id);
  return NextResponse.json({ ok: true });
}
