// app/api/moldes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbMoldes } from '@/lib/db';
import { saveUploadedFile, getImageDimensions } from '@/lib/upload';

export async function GET() {
  return NextResponse.json(await dbMoldes.listar());
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const nome = formData.get('nome') as string;
  const descricao = (formData.get('descricao') as string) || null;
  const imagem = formData.get('imagem') as File | null;

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }
  if (!imagem || imagem.size === 0) {
    return NextResponse.json({ error: 'Imagem do molde é obrigatória' }, { status: 400 });
  }

  const { largura, altura } = await getImageDimensions(imagem);
  const imagemPath = await saveUploadedFile(imagem, 'molde');

  const id = dbMoldes.criar({
    nome: nome.trim(),
    descricao,
    imagem_path: imagemPath,
    largura,
    altura,
    slots_json: '[]',
  });

  return NextResponse.json({ id });
}
