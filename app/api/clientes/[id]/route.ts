// app/api/clientes/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbClientes } from '@/lib/db';
import { saveUploadedFile, deleteUploadedFile } from '@/lib/upload';

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const cliente = await dbClientes.buscar(Number(params.id));
  if (!cliente) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });
  return NextResponse.json(cliente);
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const atual = await dbClientes.buscar(id);
  if (!atual) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 });

  const formData = await req.formData();
  const nome = formData.get('nome') as string;
  const whatsapp = (formData.get('whatsapp') as string) || '';
  const endereco = (formData.get('endereco') as string) || '';
  const corPrimaria = (formData.get('cor_primaria') as string) || '#000000';
  const logo = formData.get('logo') as File | null;

  // Ajustes da logo (vêm como string, parsear)
  const logoZoom = formData.get('logo_zoom');
  const logoOffsetX = formData.get('logo_offset_x');
  const logoOffsetY = formData.get('logo_offset_y');
  const logoRotacao = formData.get('logo_rotacao');

  let logoPath = atual.logo_path;
  if (logo && logo.size > 0) {
    deleteUploadedFile(atual.logo_path);
    logoPath = await saveUploadedFile(logo, 'logo');
  }

  const dadosAtualizar: any = {
    nome: nome.trim(),
    logo_path: logoPath,
    whatsapp: whatsapp.trim(),
    endereco: endereco.trim(),
    cor_primaria: corPrimaria,
  };

  if (logoZoom !== null) dadosAtualizar.logo_zoom = parseFloat(String(logoZoom));
  if (logoOffsetX !== null) dadosAtualizar.logo_offset_x = parseFloat(String(logoOffsetX));
  if (logoOffsetY !== null) dadosAtualizar.logo_offset_y = parseFloat(String(logoOffsetY));
  if (logoRotacao !== null) dadosAtualizar.logo_rotacao = parseFloat(String(logoRotacao));

  await dbClientes.atualizar(id, dadosAtualizar);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  const cliente = await dbClientes.buscar(id);
  if (cliente) deleteUploadedFile(cliente.logo_path);
  await dbClientes.excluir(id);
  return NextResponse.json({ ok: true });
}
