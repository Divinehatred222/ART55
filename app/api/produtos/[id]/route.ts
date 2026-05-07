// app/api/produtos/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbProdutos } from '@/lib/db';
import { saveUploadedFile, deleteUploadedFile } from '@/lib/upload';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const produto = await dbProdutos.buscar(Number(params.id));
  if (!produto) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  return NextResponse.json(produto);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const atual = await dbProdutos.buscar(id);
  if (!atual) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

  const formData = await req.formData();
  const nome = (formData.get('nome') as string)?.trim();
  const apelidosStr = (formData.get('apelidos') as string) || '';
  const unidade = ((formData.get('unidade') as string) || '').trim();
  const imagem = formData.get('imagem') as File | null;

  let imagemPath = atual.imagem_path;
  if (imagem && imagem.size > 0) {
    deleteUploadedFile(atual.imagem_path);
    imagemPath = await saveUploadedFile(imagem, 'produto');
  }

  const apelidos = apelidosStr
    .split(/\n|,/)
    .map((a) => a.trim())
    .filter(Boolean);

  await dbProdutos.atualizar(id, {
    nome, apelidos, imagem_path: imagemPath,
    unidade: unidade || undefined,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const produto = await dbProdutos.buscar(id);
  if (produto) deleteUploadedFile(produto.imagem_path);
  await dbProdutos.excluir(id);
  return NextResponse.json({ ok: true });
}
