// app/api/produtos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbProdutos } from '@/lib/db';
import { saveUploadedFile } from '@/lib/upload';

export async function GET() {
  return NextResponse.json(await dbProdutos.listar());
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const nome = (formData.get('nome') as string)?.trim();
  const apelidosStr = (formData.get('apelidos') as string) || '';
  const unidade = ((formData.get('unidade') as string) || '').trim();
  const imagem = formData.get('imagem') as File | null;

  if (!nome) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }

  let imagemPath: string | null = null;
  if (imagem && imagem.size > 0) {
    imagemPath = await saveUploadedFile(imagem, 'produto');
  }

  const apelidos = apelidosStr
    .split(/\n|,/)
    .map((a) => a.trim())
    .filter(Boolean);

  const id = dbProdutos.criar({
    nome,
    apelidos,
    imagem_path: imagemPath,
    unidade: unidade || undefined,
  });

  return NextResponse.json({ id });
}
