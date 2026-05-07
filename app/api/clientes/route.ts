// app/api/clientes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbClientes } from '@/lib/db';
import { saveUploadedFile } from '@/lib/upload';

export async function GET() {
  return NextResponse.json(await dbClientes.listar());
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const nome = formData.get('nome') as string;
  const whatsapp = (formData.get('whatsapp') as string) || '';
  const endereco = (formData.get('endereco') as string) || '';
  const corPrimaria = (formData.get('cor_primaria') as string) || '#000000';
  const logo = formData.get('logo') as File | null;

  if (!nome?.trim()) {
    return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
  }

  let logoPath: string | null = null;
  if (logo && logo.size > 0) {
    logoPath = await saveUploadedFile(logo, 'logo');
  }

  const id = dbClientes.criar({
    nome: nome.trim(),
    logo_path: logoPath,
    whatsapp: whatsapp.trim(),
    endereco: endereco.trim(),
    cor_primaria: corPrimaria,
  });

  return NextResponse.json({ id });
}
