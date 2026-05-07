// app/api/fontes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbFontes, todasFontes } from '@/lib/db';
import { saveUploadedFont } from '@/lib/upload';

export async function GET() {
  // Retorna todas as fontes (sistema + custom) já mescladas
  return NextResponse.json(todasFontes());
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const tipo = formData.get('tipo') as 'upload' | 'google';
  const nome = (formData.get('nome') as string)?.trim();

  if (!nome) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }

  // Verifica se já existe (em sistema ou custom)
  const existente = await dbFontes.buscarPorNome(nome);
  if (existente) {
    return NextResponse.json({ error: 'Já existe uma fonte com esse nome' }, { status: 400 });
  }

  if (tipo === 'upload') {
    const arquivo = formData.get('arquivo') as File | null;
    if (!arquivo || arquivo.size === 0) {
      return NextResponse.json({ error: 'Arquivo é obrigatório' }, { status: 400 });
    }
    try {
      const arquivoPath = await saveUploadedFont(arquivo);
      const id = dbFontes.criar({
        nome,
        fonte: 'upload',
        arquivo_path: arquivoPath,
        google_url: null,
        pesos: ['400'],
      });
      return NextResponse.json({ id });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
  }

  if (tipo === 'google') {
    const pesosStr = (formData.get('pesos') as string) || '400,700';
    const pesos = pesosStr.split(',').map((p) => p.trim()).filter(Boolean);
    const familia = nome.replace(/\s+/g, '+');
    const googleUrl = `https://fonts.googleapis.com/css2?family=${familia}:wght@${pesos.join(';')}&display=swap`;

    const id = dbFontes.criar({
      nome,
      fonte: 'google',
      arquivo_path: null,
      google_url: googleUrl,
      pesos,
    });
    return NextResponse.json({ id });
  }

  return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
}
