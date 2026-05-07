// app/api/fontes/lote/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbFontes } from '@/lib/db';
import { saveUploadedFont } from '@/lib/upload';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const total = Number(formData.get('total') || 0);
  const criadas: number[] = [];
  const erros: string[] = [];
  const conflitos: string[] = [];

  for (let i = 0; i < total; i++) {
    const nome = (formData.get(`nome_${i}`) as string)?.trim();
    const arquivo = formData.get(`arquivo_${i}`) as File | null;

    if (!nome || !arquivo || arquivo.size === 0) {
      erros.push(`Item ${i + 1}: nome e arquivo são obrigatórios`);
      continue;
    }

    // Verifica se já existe (em sistema ou custom)
    const existente = await dbFontes.buscarPorNome(nome);
    if (existente) {
      conflitos.push(nome);
      continue;
    }

    try {
      const arquivoPath = await saveUploadedFont(arquivo);
      const id = await dbFontes.criar({
        nome,
        fonte: 'upload',
        arquivo_path: arquivoPath,
        google_url: null,
        pesos: ['400'],
      });
      criadas.push(id);
    } catch (e: any) {
      erros.push(`${nome}: ${e.message}`);
    }
  }

  return NextResponse.json({
    criadas: criadas.length,
    erros,
    conflitos,
  });
}
