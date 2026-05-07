// lib/db.ts
// Persistência via Supabase. Todas as funções são ASYNC.
// Pode rodar tanto no servidor (API routes) quanto no cliente, já que não tem auth.

import { supabase } from './supabase';
import type {
  Cliente, Produto, Molde, Fonte, PrecoCliente,
} from './types';

export type {
  Cliente, Produto, Molde, Fonte, PrecoCliente,
  Slot, SlotTipo, EstiloPreco, ConfigPrecoComposto,
} from './types';
export { PRECO_COMPOSTO_PADRAO, FONTES_SISTEMA } from './types';

import { FONTES_SISTEMA } from './types';

// ===================================================================
// HELPERS — converter linhas do Supabase pros tipos do app
// ===================================================================

function rowToCliente(r: any): Cliente {
  return {
    id: r.id,
    nome: r.nome,
    logo_path: r.logo_path || null,
    whatsapp: r.whatsapp || '',
    endereco: r.endereco || '',
    cor_primaria: r.cor_primaria || '#000000',
    logo_zoom: r.logo_zoom ?? 1,
    logo_offset_x: r.logo_offset_x ?? 0,
    logo_offset_y: r.logo_offset_y ?? 0,
    logo_rotacao: r.logo_rotacao ?? 0,
    criado_em: r.criado_em,
  };
}

function rowToProduto(r: any): Produto {
  return {
    id: r.id,
    nome: r.nome,
    apelidos: Array.isArray(r.apelidos) ? r.apelidos : [],
    imagem_path: r.imagem_path || null,
    unidade: r.unidade || undefined,
    criado_em: r.criado_em,
  };
}

function rowToMolde(r: any): Molde {
  return {
    id: r.id,
    nome: r.nome,
    descricao: r.descricao,
    imagem_path: r.imagem_path || '',
    largura: r.largura,
    altura: r.altura,
    slots_json: typeof r.slots_json === 'string' ? r.slots_json : JSON.stringify(r.slots_json),
    criado_em: r.criado_em,
  };
}

function rowToFonte(r: any): Fonte {
  return {
    id: r.id,
    nome: r.nome,
    fonte: r.fonte,
    arquivo_path: r.arquivo_path || null,
    google_url: r.google_url,
    pesos: Array.isArray(r.pesos) ? r.pesos : ['400'],
    criado_em: r.criado_em,
  };
}

function rowToPrecoCliente(r: any): PrecoCliente {
  return {
    id: r.id,
    cliente_id: r.cliente_id,
    produto_id: r.produto_id,
    preco: r.preco,
    atualizado_em: r.atualizado_em,
  };
}

// ===================================================================
// CLIENTES
// ===================================================================

export const dbClientes = {
  async listar(): Promise<Cliente[]> {
    const { data, error } = await supabase
      .from('clientes').select('*').order('nome');
    if (error) throw error;
    return (data || []).map(rowToCliente);
  },

  async buscar(id: number): Promise<Cliente | null> {
    const { data, error } = await supabase
      .from('clientes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToCliente(data) : null;
  },

  async criar(dados: Omit<Cliente, 'id' | 'criado_em'>): Promise<number> {
    const { data, error } = await supabase
      .from('clientes')
      .insert({
        nome: dados.nome,
        logo_path: dados.logo_path,
        whatsapp: dados.whatsapp,
        endereco: dados.endereco,
        cor_primaria: dados.cor_primaria,
        logo_zoom: dados.logo_zoom ?? 1,
        logo_offset_x: dados.logo_offset_x ?? 0,
        logo_offset_y: dados.logo_offset_y ?? 0,
        logo_rotacao: dados.logo_rotacao ?? 0,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  },

  async atualizar(id: number, dados: Partial<Omit<Cliente, 'id' | 'criado_em'>>): Promise<boolean> {
    const patch: any = {};
    if (dados.nome !== undefined) patch.nome = dados.nome;
    if (dados.logo_path !== undefined) patch.logo_path = dados.logo_path;
    if (dados.whatsapp !== undefined) patch.whatsapp = dados.whatsapp;
    if (dados.endereco !== undefined) patch.endereco = dados.endereco;
    if (dados.cor_primaria !== undefined) patch.cor_primaria = dados.cor_primaria;
    if (dados.logo_zoom !== undefined) patch.logo_zoom = dados.logo_zoom;
    if (dados.logo_offset_x !== undefined) patch.logo_offset_x = dados.logo_offset_x;
    if (dados.logo_offset_y !== undefined) patch.logo_offset_y = dados.logo_offset_y;
    if (dados.logo_rotacao !== undefined) patch.logo_rotacao = dados.logo_rotacao;

    const { error } = await supabase.from('clientes').update(patch).eq('id', id);
    if (error) throw error;
    return true;
  },

  async excluir(id: number): Promise<boolean> {
    // Precos serão deletados em cascata (FK)
    const { error } = await supabase.from('clientes').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async contar(): Promise<number> {
    const { count, error } = await supabase
      .from('clientes').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },
};

// ===================================================================
// PRODUTOS
// ===================================================================

export const dbProdutos = {
  async listar(): Promise<Produto[]> {
    const { data, error } = await supabase
      .from('produtos').select('*').order('nome');
    if (error) throw error;
    return (data || []).map(rowToProduto);
  },

  async buscar(id: number): Promise<Produto | null> {
    const { data, error } = await supabase
      .from('produtos').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToProduto(data) : null;
  },

  async criar(dados: Omit<Produto, 'id' | 'criado_em'>): Promise<number> {
    const { data, error } = await supabase
      .from('produtos')
      .insert({
        nome: dados.nome,
        apelidos: dados.apelidos,
        imagem_path: dados.imagem_path,
        unidade: dados.unidade,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  },

  async atualizar(id: number, dados: Partial<Omit<Produto, 'id' | 'criado_em'>>): Promise<boolean> {
    const patch: any = {};
    if (dados.nome !== undefined) patch.nome = dados.nome;
    if (dados.apelidos !== undefined) patch.apelidos = dados.apelidos;
    if (dados.imagem_path !== undefined) patch.imagem_path = dados.imagem_path;
    if (dados.unidade !== undefined) patch.unidade = dados.unidade;

    const { error } = await supabase.from('produtos').update(patch).eq('id', id);
    if (error) throw error;
    return true;
  },

  async excluir(id: number): Promise<boolean> {
    const { error } = await supabase.from('produtos').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async contar(): Promise<number> {
    const { count, error } = await supabase
      .from('produtos').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },
};

// ===================================================================
// PRECOS POR CLIENTE
// ===================================================================

export const dbPrecos = {
  async listarPorCliente(clienteId: number): Promise<PrecoCliente[]> {
    const { data, error } = await supabase
      .from('precos_clientes').select('*').eq('cliente_id', clienteId);
    if (error) throw error;
    return (data || []).map(rowToPrecoCliente);
  },

  async buscarPreco(clienteId: number, produtoId: number): Promise<PrecoCliente | null> {
    const { data, error } = await supabase
      .from('precos_clientes').select('*')
      .eq('cliente_id', clienteId)
      .eq('produto_id', produtoId)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToPrecoCliente(data) : null;
  },

  async upsert(clienteId: number, produtoId: number, preco: string): Promise<void> {
    const { error } = await supabase
      .from('precos_clientes')
      .upsert(
        { cliente_id: clienteId, produto_id: produtoId, preco, atualizado_em: new Date().toISOString() },
        { onConflict: 'cliente_id,produto_id' },
      );
    if (error) throw error;
  },

  async substituirTodos(clienteId: number, novos: { produto_id: number; preco: string }[]): Promise<void> {
    // Deleta tudo desse cliente e insere o novo conjunto
    const { error: errDel } = await supabase
      .from('precos_clientes').delete().eq('cliente_id', clienteId);
    if (errDel) throw errDel;

    if (novos.length === 0) return;

    const linhas = novos.map((n) => ({
      cliente_id: clienteId,
      produto_id: n.produto_id,
      preco: n.preco,
      atualizado_em: new Date().toISOString(),
    }));
    const { error: errIns } = await supabase.from('precos_clientes').insert(linhas);
    if (errIns) throw errIns;
  },

  async excluir(id: number): Promise<boolean> {
    const { error } = await supabase.from('precos_clientes').delete().eq('id', id);
    if (error) throw error;
    return true;
  },
};

// ===================================================================
// MOLDES
// ===================================================================

export const dbMoldes = {
  async listar(): Promise<Molde[]> {
    const { data, error } = await supabase
      .from('moldes').select('*').order('criado_em', { ascending: false });
    if (error) throw error;
    return (data || []).map(rowToMolde);
  },

  async buscar(id: number): Promise<Molde | null> {
    const { data, error } = await supabase
      .from('moldes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToMolde(data) : null;
  },

  async criar(dados: Omit<Molde, 'id' | 'criado_em'>): Promise<number> {
    const slotsJson = typeof dados.slots_json === 'string'
      ? JSON.parse(dados.slots_json)
      : dados.slots_json;

    const { data, error } = await supabase
      .from('moldes')
      .insert({
        nome: dados.nome,
        descricao: dados.descricao,
        imagem_path: dados.imagem_path,
        largura: dados.largura,
        altura: dados.altura,
        slots_json: slotsJson,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  },

  async atualizar(id: number, dados: Partial<Omit<Molde, 'id' | 'criado_em'>>): Promise<boolean> {
    const patch: any = {};
    if (dados.nome !== undefined) patch.nome = dados.nome;
    if (dados.descricao !== undefined) patch.descricao = dados.descricao;
    if (dados.imagem_path !== undefined) patch.imagem_path = dados.imagem_path;
    if (dados.largura !== undefined) patch.largura = dados.largura;
    if (dados.altura !== undefined) patch.altura = dados.altura;
    if (dados.slots_json !== undefined) {
      patch.slots_json = typeof dados.slots_json === 'string'
        ? JSON.parse(dados.slots_json)
        : dados.slots_json;
    }

    const { error } = await supabase.from('moldes').update(patch).eq('id', id);
    if (error) throw error;
    return true;
  },

  async excluir(id: number): Promise<boolean> {
    const { error } = await supabase.from('moldes').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async contar(): Promise<number> {
    const { count, error } = await supabase
      .from('moldes').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },
};

// ===================================================================
// FONTES
// ===================================================================

export const dbFontes = {
  async listar(): Promise<Fonte[]> {
    const { data, error } = await supabase
      .from('fontes').select('*').order('nome');
    if (error) throw error;
    return (data || []).map(rowToFonte);
  },

  async buscar(id: number): Promise<Fonte | null> {
    const { data, error } = await supabase
      .from('fontes').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? rowToFonte(data) : null;
  },

  async buscarPorNome(nome: string): Promise<Fonte | null> {
    const { data, error } = await supabase
      .from('fontes').select('*')
      .ilike('nome', nome)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToFonte(data) : null;
  },

  async criar(dados: Omit<Fonte, 'id' | 'criado_em'>): Promise<number> {
    const { data, error } = await supabase
      .from('fontes')
      .insert({
        nome: dados.nome,
        fonte: dados.fonte,
        arquivo_path: dados.arquivo_path,
        google_url: dados.google_url,
        pesos: dados.pesos,
      })
      .select('id')
      .single();
    if (error) throw error;
    return data.id;
  },

  async excluir(id: number): Promise<boolean> {
    const { error } = await supabase.from('fontes').delete().eq('id', id);
    if (error) throw error;
    return true;
  },

  async contar(): Promise<number> {
    const { count, error } = await supabase
      .from('fontes').select('*', { count: 'exact', head: true });
    if (error) throw error;
    return count || 0;
  },
};

export async function todasFontes(): Promise<Fonte[]> {
  const customizadas = await dbFontes.listar();
  const nomesCustomizados = new Set(customizadas.map((f) => f.nome.toLowerCase()));
  const sistemaFiltrado = FONTES_SISTEMA.filter(
    (f) => !nomesCustomizados.has(f.nome.toLowerCase()),
  );
  return [...sistemaFiltrado, ...customizadas].sort((a, b) => a.nome.localeCompare(b.nome));
}
