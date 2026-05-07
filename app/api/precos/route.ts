// app/api/precos/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { dbPrecos } from '@/lib/db';

// GET ?cliente_id=1  → retorna preços do cliente
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const clienteId = Number(searchParams.get('cliente_id'));
  if (!clienteId) return NextResponse.json({ error: 'cliente_id obrigatório' }, { status: 400 });
  return NextResponse.json(await dbPrecos.listarPorCliente(clienteId));
}

// POST: substituir todos preços do cliente OU upsert individual
// Body: { cliente_id, modo: 'substituir' | 'upsert', precos: [{ produto_id, preco }] }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const clienteId = Number(body.cliente_id);
  const modo = body.modo as 'substituir' | 'upsert';
  const precos = body.precos as { produto_id: number; preco: string }[];

  if (!clienteId || !Array.isArray(precos)) {
    return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 });
  }

  if (modo === 'substituir') {
    await dbPrecos.substituirTodos(clienteId, precos);
  } else {
    for (const p of precos) {
      await dbPrecos.upsert(clienteId, p.produto_id, p.preco);
    }
  }

  return NextResponse.json({ ok: true, total: precos.length });
}
