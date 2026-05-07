// app/moldes/[id]/editor.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Molde, Slot, SlotTipo, Fonte } from '@/lib/types';
import { PRECO_COMPOSTO_PADRAO } from '@/lib/types';
import { carregarTodasFontes } from '@/lib/font-loader';
import {
  ArrowLeft, Save, Trash2, Plus, Image as ImageIcon, Type, Tag, DollarSign,
  Award, Copy, Eye, EyeOff, MessageCircle, MapPin,
} from 'lucide-react';

const SlotCanvas = dynamic(() => import('./slot-canvas'), { ssr: false });

const TIPOS_INFO: Record<SlotTipo, { label: string; cor: string; icone: React.ComponentType<any>; categoria: string }> = {
  logo: { label: 'Logo do cliente', cor: '#8b5cf6', icone: Award, categoria: 'cliente' },
  cliente_whatsapp: { label: 'WhatsApp do cliente', cor: '#22c55e', icone: MessageCircle, categoria: 'cliente' },
  cliente_endereco: { label: 'Endereço do cliente', cor: '#06b6d4', icone: MapPin, categoria: 'cliente' },
  produto_imagem: { label: 'Imagem de produto', cor: '#0ea5e9', icone: ImageIcon, categoria: 'produto' },
  produto_nome: { label: 'Nome de produto', cor: '#10b981', icone: Tag, categoria: 'produto' },
  produto_unidade: { label: 'Unidade do produto', cor: '#14b8a6', icone: Tag, categoria: 'produto' },
  produto_preco: { label: 'Preço de produto', cor: '#f59e0b', icone: DollarSign, categoria: 'produto' },
  texto_livre: { label: 'Texto livre', cor: '#ef4444', icone: Type, categoria: 'extra' },
};

function uuid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function defaultRotuloTexto(tipo: SlotTipo): string {
  if (tipo === 'cliente_endereco') return 'Endereço:';
  if (tipo === 'cliente_whatsapp') return 'Telefone:';
  if (tipo === 'produto_unidade') return 'Contém:';
  return '';
}

function novoSlot(tipo: SlotTipo, indice = 1): Slot {
  const ehTexto =
    tipo === 'produto_nome' ||
    tipo === 'produto_unidade' ||
    tipo === 'produto_preco' ||
    tipo === 'texto_livre' ||
    tipo === 'cliente_whatsapp' ||
    tipo === 'cliente_endereco';
  return {
    id: uuid(),
    tipo,
    indice: tipo.startsWith('produto_') ? indice : undefined,
    x: 100,
    y: 100,
    largura: ehTexto ? 400 : 300,
    altura: ehTexto ? 80 : 300,
    fonte: 'Inter Tight',
    tamanhoFonte: 48,
    cor: '#000000',
    alinhamento: 'center',
    negrito: tipo === 'produto_preco',
    italico: false,
    espacamentoLinha: 1.2,
    textoPadrao: tipo === 'texto_livre' ? 'Texto aqui' : '',
    modoImagem: 'contain',
  };
}

export default function EditorMolde({ molde, fontes }: { molde: Molde; fontes: Fonte[] }) {
  const router = useRouter();
  const [nome, setNome] = useState(molde.nome);
  const [slots, setSlots] = useState<Slot[]>(JSON.parse(molde.slots_json || '[]'));
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [modoPreview, setModoPreview] = useState(false);

  const slotSelecionado = slots.find((s) => s.id === selecionado);
  const marcarSujo = useCallback(() => setDirty(true), []);

  // Carrega todas as fontes na montagem
  useEffect(() => {
    carregarTodasFontes(
      fontes.map((f) => ({
        nome: f.nome,
        fonte: f.fonte,
        arquivo_path: f.arquivo_path,
        google_url: f.google_url,
      })),
    );
  }, [fontes]);

  function adicionarSlot(tipo: SlotTipo) {
    let indice = 1;
    if (tipo.startsWith('produto_')) {
      const existentes = slots.filter((s) => s.tipo === tipo).map((s) => s.indice || 0);
      indice = existentes.length > 0 ? Math.max(...existentes) + 1 : 1;
    }
    const novo = novoSlot(tipo, indice);
    novo.x = molde.largura / 2 - novo.largura / 2;
    novo.y = molde.altura / 2 - novo.altura / 2;
    setSlots([...slots, novo]);
    setSelecionado(novo.id);
    marcarSujo();
  }

  function atualizarSlot(id: string, patch: Partial<Slot>) {
    setSlots((curr) => curr.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    marcarSujo();
  }

  function removerSlot(id: string) {
    setSlots((curr) => curr.filter((s) => s.id !== id));
    if (selecionado === id) setSelecionado(null);
    marcarSujo();
  }

  function duplicarSlot(id: string) {
    const orig = slots.find((s) => s.id === id);
    if (!orig) return;
    const copia: Slot = { ...orig, id: uuid(), x: orig.x + 30, y: orig.y + 30 };
    setSlots([...slots, copia]);
    setSelecionado(copia.id);
    marcarSujo();
  }

  async function salvar() {
    setSaving(true);
    const res = await fetch(`/api/moldes/${molde.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, slots }),
    });
    if (res.ok) {
      setDirty(false);
      router.refresh();
    } else {
      alert('Erro ao salvar');
    }
    setSaving(false);
  }

  async function excluirMolde() {
    if (!confirm(`Excluir molde "${molde.nome}"? Essa ação não pode ser desfeita.`)) return;
    const res = await fetch(`/api/moldes/${molde.id}`, { method: 'DELETE' });
    if (res.ok) router.push('/moldes');
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selecionado) {
        e.preventDefault();
        removerSlot(selecionado);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        salvar();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'd' && selecionado) {
        e.preventDefault();
        duplicarSlot(selecionado);
      }
      if (e.key === 'l' && !e.metaKey && !e.ctrlKey) {
        setModoPreview((v) => !v);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado, slots, nome]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="border-b border-line bg-white px-6 py-3 flex items-center gap-4">
        <Link href="/moldes" className="text-muted hover:text-ink">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <input
          className="font-display text-xl bg-transparent border-none focus:outline-none focus:ring-0 px-1 -mx-1 rounded hover:bg-line/30 focus:bg-line/30 transition-colors flex-1 max-w-md"
          value={nome}
          onChange={(e) => { setNome(e.target.value); marcarSujo(); }}
        />
        <span className="text-xs text-muted font-mono">{molde.largura}×{molde.altura}</span>
        {dirty && <span className="text-xs text-accent">• não salvo</span>}

        <button
          onClick={() => setModoPreview((v) => !v)}
          className={`btn text-xs ${modoPreview ? 'bg-ink text-paper' : 'bg-transparent border border-line'}`}
          title="Atalho: L. No modo limpo, os retângulos coloridos somem e você vê só o conteúdo (textos/imagens). Smart guides continuam ativas."
        >
          {modoPreview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {modoPreview ? 'Modo edição' : 'Modo limpo'}
        </button>

        <button onClick={excluirMolde} className="btn-danger text-xs px-3 py-1.5">
          <Trash2 className="w-3 h-3" />
        </button>
        <button onClick={salvar} disabled={saving} className="btn-primary text-sm">
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-64 border-r border-line bg-white overflow-y-auto shrink-0">
          <div className="p-4 border-b border-line">
            <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Cliente</h3>
            <div className="space-y-1.5">
              {(Object.keys(TIPOS_INFO) as SlotTipo[])
                .filter((t) => TIPOS_INFO[t].categoria === 'cliente')
                .map((t) => <BotaoSlot key={t} tipo={t} onClick={() => adicionarSlot(t)} />)}
            </div>
            <h3 className="text-xs uppercase tracking-wider text-muted mb-3 mt-4">Produto</h3>
            <div className="space-y-1.5">
              {(Object.keys(TIPOS_INFO) as SlotTipo[])
                .filter((t) => TIPOS_INFO[t].categoria === 'produto')
                .map((t) => <BotaoSlot key={t} tipo={t} onClick={() => adicionarSlot(t)} />)}
            </div>
            <h3 className="text-xs uppercase tracking-wider text-muted mb-3 mt-4">Extra</h3>
            <div className="space-y-1.5">
              {(Object.keys(TIPOS_INFO) as SlotTipo[])
                .filter((t) => TIPOS_INFO[t].categoria === 'extra')
                .map((t) => <BotaoSlot key={t} tipo={t} onClick={() => adicionarSlot(t)} />)}
            </div>
          </div>

          <div className="p-4">
            <h3 className="text-xs uppercase tracking-wider text-muted mb-3">Slots ({slots.length})</h3>
            {slots.length === 0 ? (
              <p className="text-xs text-muted">Adicione slots usando os botões acima.</p>
            ) : (
              <div className="space-y-1">
                {slots.map((s) => (
                  <SlotListItem
                    key={s.id}
                    slot={s}
                    selecionado={selecionado === s.id}
                    onClick={() => setSelecionado(s.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 overflow-auto bg-line/30 p-8 grid place-items-center">
          <SlotCanvas
            molde={molde}
            slots={slots}
            selecionadoId={selecionado}
            onSelect={setSelecionado}
            onChangeSlot={atualizarSlot}
            modoLimpo={modoPreview}
          />
        </main>

        <aside className="w-72 border-l border-line bg-white overflow-y-auto shrink-0">
          {slotSelecionado ? (
            <PropriedadesSlot
              slot={slotSelecionado}
              fontes={fontes}
              onChange={(patch) => atualizarSlot(slotSelecionado.id, patch)}
              onRemover={() => removerSlot(slotSelecionado.id)}
              onDuplicar={() => duplicarSlot(slotSelecionado.id)}
            />
          ) : (
            <div className="p-6 text-sm text-muted">
              <p className="mb-2">Selecione um slot para editar suas propriedades.</p>
              <p className="text-xs leading-relaxed">
                <kbd className="font-mono bg-line/50 px-1.5 py-0.5 rounded">Delete</kbd> remove ·{' '}
                <kbd className="font-mono bg-line/50 px-1.5 py-0.5 rounded">⌘D</kbd> duplica ·{' '}
                <kbd className="font-mono bg-line/50 px-1.5 py-0.5 rounded">L</kbd> modo limpo ·{' '}
                <kbd className="font-mono bg-line/50 px-1.5 py-0.5 rounded">⌘S</kbd> salva
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function BotaoSlot({ tipo, onClick }: { tipo: SlotTipo; onClick: () => void }) {
  const info = TIPOS_INFO[tipo];
  const Icone = info.icone;
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm hover:bg-line/50 transition-colors text-left group"
    >
      <span className="w-7 h-7 rounded-md grid place-items-center shrink-0" style={{ background: info.cor + '20', color: info.cor }}>
        <Icone className="w-3.5 h-3.5" />
      </span>
      <span className="flex-1 truncate">{info.label}</span>
      <Plus className="w-3.5 h-3.5 text-muted opacity-0 group-hover:opacity-100" />
    </button>
  );
}

function SlotListItem({ slot, selecionado, onClick }: { slot: Slot; selecionado: boolean; onClick: () => void }) {
  const info = TIPOS_INFO[slot.tipo];
  const Icone = info.icone;
  const label = slot.indice ? `${info.label} #${slot.indice}` : info.label;
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors ${
        selecionado ? 'bg-ink text-paper' : 'hover:bg-line/50'
      }`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: info.cor }} />
      <Icone className="w-3.5 h-3.5 opacity-60" />
      <span className="flex-1 truncate text-xs">{label}</span>
    </button>
  );
}

function PropriedadesSlot({
  slot, fontes, onChange, onRemover, onDuplicar,
}: {
  slot: Slot; fontes: Fonte[];
  onChange: (patch: Partial<Slot>) => void;
  onRemover: () => void; onDuplicar: () => void;
}) {
  const info = TIPOS_INFO[slot.tipo];
  const ehTexto =
    slot.tipo === 'produto_nome' ||
    slot.tipo === 'produto_unidade' ||
    slot.tipo === 'produto_preco' ||
    slot.tipo === 'texto_livre' ||
    slot.tipo === 'cliente_whatsapp' ||
    slot.tipo === 'cliente_endereco';
  const ehImagem = slot.tipo === 'logo' || slot.tipo === 'produto_imagem';
  const aceitaRotulo =
    slot.tipo === 'cliente_endereco' ||
    slot.tipo === 'cliente_whatsapp' ||
    slot.tipo === 'produto_unidade' ||
    slot.tipo === 'texto_livre';

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-2 pb-3 border-b border-line">
        <span className="w-3 h-3 rounded-full" style={{ background: info.cor }} />
        <h3 className="font-medium text-sm flex-1">{info.label}</h3>
      </div>

      {slot.tipo.startsWith('produto_') && (
        <div>
          <label className="label">Índice do produto</label>
          <input
            type="number" min="1" className="input"
            value={slot.indice || 1}
            onChange={(e) => onChange({ indice: parseInt(e.target.value) || 1 })}
          />
          <p className="text-xs text-muted mt-1">O 1º produto preenche slots #1, o 2º preenche #2, etc.</p>
        </div>
      )}

      <div>
        <label className="label">Posição</label>
        <div className="grid grid-cols-2 gap-2">
          <input type="number" className="input" value={Math.round(slot.x)}
            onChange={(e) => onChange({ x: parseFloat(e.target.value) || 0 })} />
          <input type="number" className="input" value={Math.round(slot.y)}
            onChange={(e) => onChange({ y: parseFloat(e.target.value) || 0 })} />
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <input type="number" className="input" value={Math.round(slot.largura)}
            onChange={(e) => onChange({ largura: parseFloat(e.target.value) || 1 })} placeholder="largura" />
          <input type="number" className="input" value={Math.round(slot.altura)}
            onChange={(e) => onChange({ altura: parseFloat(e.target.value) || 1 })} placeholder="altura" />
        </div>
      </div>

      {slot.tipo === 'texto_livre' && (
        <div>
          <label className="label">Texto padrão</label>
          <input className="input" value={slot.textoPadrao || ''}
            onChange={(e) => onChange({ textoPadrao: e.target.value })} placeholder="Ex: Validade 30/06" />
        </div>
      )}

      {ehTexto && (
        <>
          <div>
            <label className="label">Fonte</label>
            <select
              className="input"
              value={slot.fonte || 'Inter Tight'}
              onChange={(e) => onChange({ fonte: e.target.value })}
              style={{ fontFamily: `"${slot.fonte}", system-ui, sans-serif` }}
            >
              {fontes.map((f) => (
                <option
                  key={f.id}
                  value={f.nome}
                  disabled={f.aguardando_arquivo}
                  style={{ fontFamily: `"${f.nome}", system-ui, sans-serif` }}
                >
                  {f.nome}
                  {f.aguardando_arquivo ? ' · ⚠ aguardando upload' :
                    f.fonte === 'google' ? ' · Google' :
                    f.fonte === 'upload' ? ' · Upload' : ''}
                </option>
              ))}
            </select>
            <Link href="/fontes" target="_blank" className="text-xs text-accent hover:underline mt-1.5 inline-block">
              + Adicionar fontes na biblioteca
            </Link>
          </div>

          <div>
            <label className="label">Tamanho</label>
            <input type="number" className="input"
              value={slot.tamanhoFonte || 48}
              onChange={(e) => onChange({ tamanhoFonte: parseInt(e.target.value) || 48 })} />
          </div>

          <div>
            <label className="label">Cor do texto</label>
            <div className="flex gap-2">
              <input type="color" className="w-12 h-10 rounded-lg border border-line cursor-pointer"
                value={slot.cor || '#000000'}
                onChange={(e) => onChange({ cor: e.target.value })} />
              <input className="input flex-1 font-mono"
                value={slot.cor || '#000000'}
                onChange={(e) => onChange({ cor: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Alinhamento</label>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map((a) => (
                <button key={a} onClick={() => onChange({ alinhamento: a })}
                  className={`flex-1 py-2 rounded-lg text-xs uppercase tracking-wider transition-colors ${
                    slot.alinhamento === a ? 'bg-ink text-paper' : 'border border-line hover:border-ink'
                  }`}
                >{a}</button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!slot.negrito}
                onChange={(e) => onChange({ negrito: e.target.checked })}
                className="rounded border-line" />
              Negrito
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={!!slot.italico}
                onChange={(e) => onChange({ italico: e.target.checked })}
                className="rounded border-line" />
              Itálico
            </label>
          </div>

          <div>
            <label className="label">Espaçamento entre linhas</label>
            <input
              type="number"
              step="0.1"
              min="0.8"
              max="3"
              className="input"
              value={slot.espacamentoLinha || 1.2}
              onChange={(e) => onChange({ espacamentoLinha: parseFloat(e.target.value) || 1.2 })}
            />
          </div>
        </>
      )}

      {/* Painel de rótulo (Endereço:, Telefone:, Contém:) */}
      {aceitaRotulo && (
        <div className="border-t border-line pt-4 space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={slot.exibirRotulo || false}
              onChange={(e) => onChange({
                exibirRotulo: e.target.checked,
                ...(e.target.checked && !slot.rotuloTexto ? { rotuloTexto: defaultRotuloTexto(slot.tipo) } : {}),
                ...(e.target.checked && !slot.rotuloCor ? { rotuloCor: '#fcd34d' } : {}),
                ...(e.target.checked && !slot.rotuloTamanhoRelativo ? { rotuloTamanhoRelativo: 1 } : {}),
                ...(e.target.checked && !slot.rotuloPosicao ? { rotuloPosicao: 'antes' } : {}),
              })}
            />
            <span className="text-sm font-medium">Mostrar rótulo</span>
          </label>
          <p className="text-[10px] text-muted -mt-2 ml-6">
            Adiciona um texto fixo antes do conteúdo (ex: "Endereço:" ou "Telefone:") com cor própria
          </p>

          {slot.exibirRotulo && (
            <div className="space-y-3 pl-6 border-l-2 border-line">
              <div>
                <label className="label">Texto do rótulo</label>
                <input
                  type="text"
                  className="input"
                  value={slot.rotuloTexto || ''}
                  onChange={(e) => onChange({ rotuloTexto: e.target.value })}
                  placeholder="Endereço:"
                />
              </div>

              <div>
                <label className="label">Cor do rótulo</label>
                <div className="flex gap-1.5">
                  <input
                    type="color"
                    value={slot.rotuloCor || '#fcd34d'}
                    onChange={(e) => onChange({ rotuloCor: e.target.value })}
                    className="w-10 h-10 rounded border border-line cursor-pointer"
                  />
                  <input
                    type="text"
                    className="input flex-1 font-mono text-xs"
                    value={slot.rotuloCor || '#fcd34d'}
                    onChange={(e) => onChange({ rotuloCor: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="label">Tamanho relativo</label>
                <input
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.05"
                  className="w-full"
                  value={slot.rotuloTamanhoRelativo || 1}
                  onChange={(e) => onChange({ rotuloTamanhoRelativo: parseFloat(e.target.value) })}
                />
                <p className="text-[10px] text-muted">
                  {((slot.rotuloTamanhoRelativo || 1) * 100).toFixed(0)}% do tamanho do conteúdo
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={slot.rotuloNegrito || false}
                    onChange={(e) => onChange({ rotuloNegrito: e.target.checked })}
                  />
                  Rótulo em negrito
                </label>
              </div>

              <div>
                <label className="label">Posição</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => onChange({ rotuloPosicao: 'antes' })}
                    className={`flex-1 py-2 rounded-lg text-xs uppercase tracking-wider transition-colors ${
                      (slot.rotuloPosicao || 'antes') === 'antes' ? 'bg-ink text-paper' : 'border border-line hover:border-ink'
                    }`}
                  >
                    Inline
                  </button>
                  <button
                    type="button"
                    onClick={() => onChange({ rotuloPosicao: 'acima' })}
                    className={`flex-1 py-2 rounded-lg text-xs uppercase tracking-wider transition-colors ${
                      slot.rotuloPosicao === 'acima' ? 'bg-ink text-paper' : 'border border-line hover:border-ink'
                    }`}
                  >
                    Acima
                  </button>
                </div>
                <p className="text-[10px] text-muted mt-1">
                  <strong>Inline</strong>: "Endereço: Av Paraná..." na mesma linha. <strong>Acima</strong>: rótulo em uma linha, conteúdo na linha seguinte.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Estilo do preço (só pra slots produto_preco) */}
      {slot.tipo === 'produto_preco' && (
        <PainelEstiloPreco slot={slot} onChange={onChange} />
      )}

      {ehImagem && (
        <div>
          <label className="label">Modo de ajuste</label>
          <div className="flex gap-1">
            {(['contain', 'cover'] as const).map((m) => (
              <button key={m} onClick={() => onChange({ modoImagem: m })}
                className={`flex-1 py-2 rounded-lg text-xs uppercase tracking-wider transition-colors ${
                  slot.modoImagem === m ? 'bg-ink text-paper' : 'border border-line hover:border-ink'
                }`}
              >{m}</button>
            ))}
          </div>
          <p className="text-xs text-muted mt-1">
            <strong>contain</strong>: imagem inteira aparece. <strong>cover</strong>: preenche o slot.
          </p>
        </div>
      )}

      <div className="flex gap-2 pt-3 border-t border-line">
        <button onClick={onDuplicar} className="btn-secondary flex-1 text-xs">
          <Copy className="w-3.5 h-3.5" /> Duplicar
        </button>
        <button onClick={onRemover} className="btn-danger flex-1 text-xs">
          <Trash2 className="w-3.5 h-3.5" /> Remover
        </button>
      </div>
    </div>
  );
}

// Painel de configuração do estilo do preço (slot produto_preco)
function PainelEstiloPreco({
  slot, onChange,
}: { slot: Slot; onChange: (patch: Partial<Slot>) => void }) {
  const estilo = slot.estiloPreco || 'normal';
  const config = slot.precoComposto || PRECO_COMPOSTO_PADRAO;

  function patchConfig(p: Partial<typeof PRECO_COMPOSTO_PADRAO>) {
    onChange({ precoComposto: { ...config, ...p } });
  }

  return (
    <div className="border-t border-line pt-4">
      <label className="label">Estilo do preço</label>
      <div className="flex gap-1 mb-3">
        {(['normal', 'composto'] as const).map((e) => (
          <button
            key={e}
            onClick={() => onChange({
              estiloPreco: e,
              precoComposto: e === 'composto' ? (slot.precoComposto || PRECO_COMPOSTO_PADRAO) : slot.precoComposto,
            })}
            className={`flex-1 py-2 rounded-lg text-xs uppercase tracking-wider transition-colors ${
              estilo === e ? 'bg-ink text-paper' : 'border border-line hover:border-ink'
            }`}
          >{e}</button>
        ))}
      </div>

      {estilo === 'composto' && (
        <div className="space-y-3 p-3 bg-line/20 rounded-lg">
          <p className="text-[10px] uppercase tracking-wider text-muted">Configuração do preço composto</p>

          {/* Prefixo */}
          <div>
            <label className="text-xs text-muted block mb-1">Prefixo</label>
            <input
              className="input py-1 text-sm"
              value={config.prefixo}
              onChange={(e) => patchConfig({ prefixo: e.target.value })}
              placeholder='Ex: "por R$", "de", "a partir de"'
            />
          </div>

          {config.prefixo && (
            <>
              <div>
                <label className="text-xs text-muted block mb-1">
                  Tamanho do prefixo: {Math.round(config.prefixoTamanhoRelativo * 100)}%
                </label>
                <input
                  type="range"
                  min="10"
                  max="60"
                  value={Math.round(config.prefixoTamanhoRelativo * 100)}
                  onChange={(e) => patchConfig({ prefixoTamanhoRelativo: parseInt(e.target.value) / 100 })}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Cor do prefixo</label>
                <div className="flex gap-1">
                  <input
                    type="color"
                    className="w-8 h-7 rounded border border-line cursor-pointer"
                    value={config.prefixoCor}
                    onChange={(e) => patchConfig({ prefixoCor: e.target.value })}
                  />
                  <input
                    className="input py-1 text-xs font-mono flex-1"
                    value={config.prefixoCor}
                    onChange={(e) => patchConfig({ prefixoCor: e.target.value })}
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={config.prefixoNegrito}
                  onChange={(e) => patchConfig({ prefixoNegrito: e.target.checked })}
                />
                Prefixo em negrito
              </label>
            </>
          )}

          {/* Centavos */}
          <div className="border-t border-line/50 pt-3">
            <label className="text-xs text-muted block mb-1">Divisor de centavos</label>
            <div className="flex gap-1">
              {([',', '.'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => patchConfig({ divisor: d })}
                  className={`px-3 py-1 rounded text-xs ${
                    config.divisor === d ? 'bg-ink text-paper' : 'border border-line hover:border-ink'
                  }`}
                >
                  {d === ',' ? 'vírgula (,)' : 'ponto (.)'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-muted block mb-1">
              Tamanho dos centavos: {Math.round(config.centavosTamanhoRelativo * 100)}%
            </label>
            <input
              type="range"
              min="20"
              max="100"
              value={Math.round(config.centavosTamanhoRelativo * 100)}
              onChange={(e) => patchConfig({ centavosTamanhoRelativo: parseInt(e.target.value) / 100 })}
              className="w-full"
            />
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.centavosSobrescrito}
              onChange={(e) => patchConfig({ centavosSobrescrito: e.target.checked })}
            />
            Centavos no topo (sobrescrito)
          </label>

          <div>
            <label className="text-xs text-muted block mb-1">Cor dos centavos</label>
            <div className="flex gap-1">
              <input
                type="color"
                className="w-8 h-7 rounded border border-line cursor-pointer"
                value={config.centavosCor}
                onChange={(e) => patchConfig({ centavosCor: e.target.value })}
              />
              <input
                className="input py-1 text-xs font-mono flex-1"
                value={config.centavosCor}
                onChange={(e) => patchConfig({ centavosCor: e.target.value })}
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={config.centavosNegrito}
              onChange={(e) => patchConfig({ centavosNegrito: e.target.checked })}
            />
            Centavos em negrito
          </label>

          {/* Preço "de" riscado */}
          <div className="border-t border-line/50 pt-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={config.exibirPrecoDe}
                onChange={(e) => patchConfig({ exibirPrecoDe: e.target.checked })}
              />
              Exibir preço "de" riscado
            </label>
            <p className="text-[10px] text-muted">
              Mostra o preço antigo riscado (ex: <span className="line-through">de R$ 68,00</span>) acima do preço atual
            </p>

            {config.exibirPrecoDe && (
              <div className="pl-5 space-y-2 border-l-2 border-line">
                <div>
                  <label className="text-xs text-muted block mb-1">Prefixo do preço de</label>
                  <input
                    className="input py-1 text-sm"
                    value={config.precoDePrefixo}
                    onChange={(e) => patchConfig({ precoDePrefixo: e.target.value })}
                    placeholder='Ex: "de R$", "de", ""'
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">
                    Tamanho: {Math.round(config.precoDeTamanhoRelativo * 100)}%
                  </label>
                  <input
                    type="range"
                    min="15"
                    max="40"
                    value={Math.round(config.precoDeTamanhoRelativo * 100)}
                    onChange={(e) => patchConfig({ precoDeTamanhoRelativo: parseInt(e.target.value) / 100 })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Cor</label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      className="w-8 h-7 rounded border border-line cursor-pointer"
                      value={config.precoDeCor}
                      onChange={(e) => patchConfig({ precoDeCor: e.target.value })}
                    />
                    <input
                      className="input py-1 text-xs font-mono flex-1"
                      value={config.precoDeCor}
                      onChange={(e) => patchConfig({ precoDeCor: e.target.value })}
                    />
                  </div>
                </div>
                <p className="text-[10px] text-muted">
                  💡 O valor do preço "de" você define manualmente em cada arte (campo "preço antigo").
                </p>
              </div>
            )}
          </div>

          {/* Bolinha R$ */}
          <div className="border-t border-line/50 pt-3 space-y-2">
            <label className="flex items-center gap-2 text-xs font-medium">
              <input
                type="checkbox"
                checked={config.exibirBolinhaRS}
                onChange={(e) => patchConfig({ exibirBolinhaRS: e.target.checked })}
              />
              Exibir bolinha "R$"
            </label>
            <p className="text-[10px] text-muted">
              Círculo colorido com "R$" à esquerda do número (ex: 🟡 R$)
            </p>

            {config.exibirBolinhaRS && (
              <div className="pl-5 space-y-2 border-l-2 border-line">
                <div>
                  <label className="text-xs text-muted block mb-1">Texto da bolinha</label>
                  <input
                    className="input py-1 text-sm"
                    value={config.bolinhaTexto}
                    onChange={(e) => patchConfig({ bolinhaTexto: e.target.value })}
                    placeholder="R$"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Cor de fundo</label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      className="w-8 h-7 rounded border border-line cursor-pointer"
                      value={config.bolinhaCorFundo}
                      onChange={(e) => patchConfig({ bolinhaCorFundo: e.target.value })}
                    />
                    <input
                      className="input py-1 text-xs font-mono flex-1"
                      value={config.bolinhaCorFundo}
                      onChange={(e) => patchConfig({ bolinhaCorFundo: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Cor do texto</label>
                  <div className="flex gap-1">
                    <input
                      type="color"
                      className="w-8 h-7 rounded border border-line cursor-pointer"
                      value={config.bolinhaCorTexto}
                      onChange={(e) => patchConfig({ bolinhaCorTexto: e.target.value })}
                    />
                    <input
                      className="input py-1 text-xs font-mono flex-1"
                      value={config.bolinhaCorTexto}
                      onChange={(e) => patchConfig({ bolinhaCorTexto: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">
                    Tamanho: {Math.round(config.bolinhaTamanhoRelativo * 100)}%
                  </label>
                  <input
                    type="range"
                    min="30"
                    max="80"
                    value={Math.round(config.bolinhaTamanhoRelativo * 100)}
                    onChange={(e) => patchConfig({ bolinhaTamanhoRelativo: parseInt(e.target.value) / 100 })}
                    className="w-full"
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-[10px] text-muted leading-relaxed pt-2 border-t border-line/50">
            💡 Dica: o tamanho geral do preço (parte inteira) é controlado pelo campo "Tamanho" acima.
            Os tamanhos de prefixo, centavos, preço "de" e bolinha são proporcionais.
          </p>
        </div>
      )}
    </div>
  );
}
