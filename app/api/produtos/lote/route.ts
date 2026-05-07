// app/api/produtos/lote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbProdutos } from '@/lib/db';
import { saveUploadedFile } from '@/lib/upload';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const total = Number(formData.get('total') || 0);
  const criados: number[] = [];
  const erros: string[] = [];

  for (let i = 0; i < total; i++) {
    const nome = (formData.get(`nome_${i}`) as string)?.trim();
    const apelidosStr = (formData.get(`apelidos_${i}`) as string) || '';
    const imagem = formData.get(`imagem_${i}`) as File | null;

    if (!nome) {
      erros.push(`Linha ${i + 1}: nome é obrigatório`);
      continue;
    }

    let imagemPath: string | null = null;
    try {
      if (imagem && imagem.size > 0) {
        imagemPath = await saveUploadedFile(imagem, 'produto');
      }
      const apelidos = apelidosStr
        .split(/\n|,/)
        .map((a) => a.trim())
        .filter(Boolean);

      const id = await dbProdutos.criar({ nome, apelidos, imagem_path: imagemPath });
      criados.push(id);
    } catch (e: any) {
      erros.push(`Linha ${i + 1} (${nome}): ${e.message}`);
    }
  }

  return NextResponse.json({ criados: criados.length, erros });
}
