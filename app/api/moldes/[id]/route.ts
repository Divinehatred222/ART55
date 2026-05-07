// app/api/moldes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbMoldes } from '@/lib/db';
import { deleteUploadedFile } from '@/lib/upload';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const molde = await dbMoldes.buscar(Number(params.id));
  if (!molde) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  return NextResponse.json(molde);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const atual = await dbMoldes.buscar(id);
  if (!atual) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

  const body = await req.json();
  const updates: any = {};
  if (body.nome !== undefined) updates.nome = body.nome;
  if (body.descricao !== undefined) updates.descricao = body.descricao;
  if (body.slots !== undefined) updates.slots_json = JSON.stringify(body.slots);

  await dbMoldes.atualizar(id, updates);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const molde = await dbMoldes.buscar(id);
  if (molde) deleteUploadedFile(molde.imagem_path);
  await dbMoldes.excluir(id);
  return NextResponse.json({ ok: true });
}
