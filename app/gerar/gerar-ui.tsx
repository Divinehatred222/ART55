// app/gerar/gerar-ui.tsx
'use client';

import { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type { Cliente, Molde, Slot, Fonte, Produto } from '@/lib/types';
import { carregarTodasFontes } from '@/lib/font-loader';
import { detectarCorDominante } from '@/lib/image-effects';
import {
  Sparkles, Upload, FileSpreadsheet, Hand, Search, X, Plus, ImageOff,
  Layers, ListPlus, ChevronRight, ChevronLeft,
} from 'lucide-react';
import ImportarPlanilha from './importar-planilha';

const RenderCanvas = dynamic(() => import('./render-canvas'), { ssr: false });
const TelaRevisao = dynamic(() => import('./tela-revisao'), { ssr: false });

export type ProdutoNaArte = {
  uid: string;
  catalogo_id?: number;
  nome: string;
  unidade?: string;     // ex: "60 cápsulas"
  preco: string;        // preço atual (em promoção ou normal)
  precoDe?: string;     // preço antigo riscado (opcional)
  imagemUrl: string | null;
  imagemFile?: File | null;
  zoom?: number;
  offsetX?: number;
  offsetY?: number;
  rotacao?: number;  // graus, 0-360
};

// Uma arte na fila (snapshot completo do que vai ser renderizado)
export type ArteNaFila = {
  uid: string;
  produtos: ProdutoNaArte[];
  textosLivres: Record<string, string>;
  rotulo: string;
  // Ajustes de polimento (cor/sombra) — definidos no modal "Refinar"
  ajustes?: import('@/lib/image-effects').AjustesPolimento;
};

type ModoEntrada = 'planilha' | 'manual';

export default function GerarUI({
  clientes, moldes, produtos, fontes,
}: { clientes: Cliente[]; moldes: Molde[]; produtos: Produto[]; fontes: Fonte[] }) {
  const [moldeId, setMoldeId] = useState<number | null>(null);
  const [clienteId, setClienteId] = useState<number | null>(null);
  const [produtosSelecionados, setProdutosSelecionados] = useState<ProdutoNaArte[]>([]);
  const [textosLivres, setTextosLivres] = useState<Record<string, string>>({});
  const [modoEntrada, setModoEntrada] = useState<ModoEntrada>('planilha');
  const [corDominanteFundo, setCorDominanteFundo] = useState<string | null>(null);
  // Edição direta no canvas: índice (1-based) do produto sendo editado, null = nenhum
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<number | null>(null);

  // Fila de artes
  const [fila, setFila] = useState<ArteNaFila[]>([]);
  const [modoRevisao, setModoRevisao] = useState(false);

  const molde = useMemo(() => moldes.find((m) => m.id === moldeId) || null, [moldeId, moldes]);
  const cliente = useMemo(() => clientes.find((c) => c.id === clienteId) || null, [clienteId, clientes]);
  const slots = useMemo<Slot[]>(() => (molde ? JSON.parse(molde.slots_json) : []), [molde]);

  useEffect(() => {
    carregarTodasFontes(
      fontes.map((f) => ({
        nome: f.nome, fonte: f.fonte,
        arquivo_path: f.arquivo_path, google_url: f.google_url,
      })),
    );
  }, [fontes]);

  useEffect(() => {
    if (!molde?.imagem_path) {
      setCorDominanteFundo(null);
      return;
    }
    detectarCorDominante(molde.imagem_path)
      .then((cor) => setCorDominanteFundo(cor))
      .catch(() => setCorDominanteFundo(null));
  }, [molde?.imagem_path]);

  const totalSlotsProduto = useMemo(() => {
    const indices = slots.filter((s) => s.tipo === 'produto_imagem').map((s) => s.indice || 0);
    return indices.length > 0 ? Math.max(...indices) : 0;
  }, [slots]);

  function atualizarProduto(idx: number, patch: Partial<ProdutoNaArte>) {
    setProdutosSelecionados((curr) => curr.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function removerProduto(idx: number) {
    setProdutosSelecionados((curr) => curr.filter((_, i) => i !== idx));
  }

  function adicionarDoCatalogo(p: Produto, preco: string = '') {
    setProdutosSelecionados((curr) => {
      const novo: ProdutoNaArte = {
        uid: `${p.id}-${Date.now()}`,
        catalogo_id: p.id,
        nome: p.nome,
        unidade: p.unidade,
        preco,
        imagemUrl: p.imagem_path,
        zoom: 1, offsetX: 0, offsetY: 0, rotacao: 0,
      };
      if (totalSlotsProduto > 0 && curr.length >= totalSlotsProduto) {
        return [...curr.slice(1), novo];
      }
      return [...curr, novo];
    });
  }

  function adicionarManual() {
    const novo: ProdutoNaArte = {
      uid: `manual-${Date.now()}`,
      nome: '', preco: '', imagemUrl: null, imagemFile: null,
      zoom: 1, offsetX: 0, offsetY: 0, rotacao: 0,
    };
    setProdutosSelecionados((curr) => [...curr, novo]);
  }

  // Adiciona o estado atual à fila e LIMPA pra próxima arte
  function adicionarAFilaELimpar() {
    if (produtosSelecionados.length === 0) return;
    const arte: ArteNaFila = {
      uid: `arte-${Date.now()}`,
      produtos: produtosSelecionados,
      textosLivres: { ...textosLivres },
      rotulo: produtosSelecionados[0]?.nome || `Arte ${fila.length + 1}`,
    };
    setFila((curr) => [...curr, arte]);
    setProdutosSelecionados([]);
    setTextosLivres({});
    setProdutoEmEdicao(null);
  }

  // Cria múltiplas artes a partir de produtos selecionados (uma arte por produto)
  // Útil quando o molde tem 1 slot de produto e você quer N artes diferentes
  function adicionarTodosComoArtesIndividuais() {
    if (produtosSelecionados.length === 0 || totalSlotsProduto !== 1) return;
    const novasArtes: ArteNaFila[] = produtosSelecionados.map((p, i) => ({
      uid: `arte-${Date.now()}-${i}`,
      produtos: [p],
      textosLivres: { ...textosLivres },
      rotulo: p.nome || `Arte ${fila.length + i + 1}`,
    }));
    setFila((curr) => [...curr, ...novasArtes]);
    setProdutosSelecionados([]);
  }

  function removerDaFila(uid: string) {
    setFila((curr) => curr.filter((a) => a.uid !== uid));
  }

  const slotsTextoLivre = slots.filter((s) => s.tipo === 'texto_livre');

  // Modo revisão tela cheia
  if (modoRevisao && molde && fila.length > 0) {
    return (
      <TelaRevisao
        molde={molde}
        slots={slots}
        cliente={cliente}
        fila={fila}
        corDominanteFundo={corDominanteFundo}
        onRemoverArte={removerDaFila}
        onAtualizarArte={(uid, patch) => {
          setFila((curr) => curr.map((a) => (a.uid === uid ? { ...a, ...patch } : a)));
        }}
        onVoltar={() => setModoRevisao(false)}
        onLimparFila={() => { setFila([]); setModoRevisao(false); }}
      />
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">/gerar</span>
          <h1 className="h-display text-5xl mt-2">Gerar arte</h1>
        </div>
        {/* Indicador da fila */}
        {fila.length > 0 && (
          <button
            onClick={() => setModoRevisao(true)}
            className="btn-primary flex items-center gap-2"
          >
            <Layers className="w-4 h-4" />
            Revisar {fila.length} {fila.length === 1 ? 'arte' : 'artes'} na fila
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="grid lg:grid-cols-[440px_1fr] gap-8">
        <div className="space-y-6 max-h-[calc(100vh-12rem)] overflow-y-auto pr-2 pb-4">
          <Section numero="01" titulo="Molde" preenchido={!!molde}>
            {moldes.length === 0 ? (
              <p className="text-sm text-muted">Nenhum molde cadastrado.</p>
            ) : (
              <select className="input" value={moldeId || ''}
                onChange={(e) => setMoldeId(e.target.value ? Number(e.target.value) : null)}>
                <option value="">Selecione um molde...</option>
                {moldes.map((m) => (
                  <option key={m.id} value={m.id}>{m.nome} ({m.largura}×{m.altura})</option>
                ))}
              </select>
            )}
            {molde && (
              <p className="text-xs text-muted mt-2">
                {slots.length} slots · {totalSlotsProduto > 0 && `${totalSlotsProduto} produto${totalSlotsProduto > 1 ? 's' : ''}`}
              </p>
            )}
          </Section>

          <Section numero="02" titulo="Cliente" preenchido={!!cliente}>
            <select className="input" value={clienteId || ''}
              onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">Sem cliente</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
            {cliente && (
              <div className="mt-3 p-3 bg-line/30 rounded-lg space-y-1.5 text-xs">
                {cliente.logo_path && (
                  <div className="flex items-center gap-2 text-muted">
                    <img src={cliente.logo_path} className="w-6 h-6 object-contain" alt="" />
                    Logo carregada
                  </div>
                )}
                {cliente.whatsapp && (
                  <div className="text-muted"><span className="font-medium text-ink">WhatsApp:</span> {cliente.whatsapp}</div>
                )}
                {cliente.endereco && (
                  <div className="text-muted"><span className="font-medium text-ink">Endereço:</span> {cliente.endereco}</div>
                )}
              </div>
            )}
          </Section>

          {totalSlotsProduto > 0 && (
            <Section
              numero="03"
              titulo={`Produtos (${produtosSelecionados.length}/${totalSlotsProduto})`}
              preenchido={produtosSelecionados.length === totalSlotsProduto && produtosSelecionados.every((p) => p.nome && p.preco && p.imagemUrl)}
            >
              <div className="flex gap-1 p-1 bg-line/40 rounded-lg mb-4">
                <button
                  type="button"
                  onClick={() => setModoEntrada('planilha')}
                  className={`flex-1 py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 ${
                    modoEntrada === 'planilha' ? 'bg-paper text-ink shadow-sm font-medium' : 'text-muted hover:text-ink'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Planilha
                </button>
                <button
                  type="button"
                  onClick={() => setModoEntrada('manual')}
                  className={`flex-1 py-2 rounded-md text-xs transition-colors flex items-center justify-center gap-1.5 ${
                    modoEntrada === 'manual' ? 'bg-paper text-ink shadow-sm font-medium' : 'text-muted hover:text-ink'
                  }`}
                >
                  <Hand className="w-3.5 h-3.5" /> Manual
                </button>
              </div>

              {modoEntrada === 'planilha' ? (
                <ImportarPlanilha
                  cliente={cliente}
                  catalogo={produtos}
                  produtosSelecionados={produtosSelecionados}
                  onAdicionarProduto={adicionarDoCatalogo}
                  onLimpar={() => setProdutosSelecionados([])}
                />
              ) : (
                <ManualSection
                  catalogo={produtos}
                  onAdicionarDoCatalogo={adicionarDoCatalogo}
                  onAdicionarManual={adicionarManual}
                />
              )}

              {produtosSelecionados.length > 0 && (
                <div className="mt-4 space-y-2">
                  <p className="label">Produtos da arte atual</p>
                  {produtosSelecionados.map((p, i) => (
                    <ProdutoSelecionadoItem
                      key={p.uid}
                      indice={i + 1}
                      produto={p}
                      onChange={(patch) => atualizarProduto(i, patch)}
                      onRemover={() => removerProduto(i)}
                      emEdicao={produtoEmEdicao === i + 1}
                      onToggleEdicao={() => setProdutoEmEdicao(
                        produtoEmEdicao === i + 1 ? null : i + 1
                      )}
                    />
                  ))}
                </div>
              )}
            </Section>
          )}

          {slotsTextoLivre.length > 0 && (
            <Section numero={totalSlotsProduto > 0 ? '04' : '03'} titulo="Textos personalizados">
              {slotsTextoLivre.map((s, i) => (
                <div key={s.id} className={i > 0 ? 'mt-3' : ''}>
                  <label className="label">Texto #{i + 1}</label>
                  <input className="input"
                    value={textosLivres[s.id] ?? s.textoPadrao ?? ''}
                    onChange={(e) => setTextosLivres({ ...textosLivres, [s.id]: e.target.value })}
                    placeholder={s.textoPadrao} />
                </div>
              ))}
            </Section>
          )}

          {/* Botões de adicionar à fila */}
          {molde && produtosSelecionados.length > 0 && (
            <div className="card border-accent/30 bg-accent/5">
              <p className="text-xs uppercase tracking-wider text-muted mb-3">Adicionar à fila</p>
              <div className="space-y-2">
                <button
                  onClick={adicionarAFilaELimpar}
                  className="btn-primary w-full text-sm"
                >
                  <ListPlus className="w-4 h-4" />
                  Salvar arte e começar próxima
                </button>
                {totalSlotsProduto === 1 && produtosSelecionados.length > 1 && (
                  <button
                    onClick={adicionarTodosComoArtesIndividuais}
                    className="btn-secondary w-full text-sm"
                  >
                    <Layers className="w-4 h-4" />
                    Criar {produtosSelecionados.length} artes (uma por produto)
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted mt-2 leading-relaxed">
                💡 Cada arte salva fica na fila. Quando terminar todas, clica em <strong>"Revisar"</strong> no topo
                pra ver tudo junto, ajustar finos e baixar em massa.
              </p>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {molde ? (
            <RenderCanvas
              molde={molde}
              slots={slots}
              cliente={cliente}
              produtos={produtosSelecionados}
              textosLivres={textosLivres}
              produtoEmEdicao={produtoEmEdicao}
              onProdutoEditado={(indice, patch) => atualizarProduto(indice - 1, patch)}
            />
          ) : (
            <div className="aspect-square bg-line/30 rounded-2xl grid place-items-center text-muted">
              <div className="text-center">
                <Sparkles className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p>Selecione um molde para começar</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ManualSection({
  catalogo, onAdicionarDoCatalogo, onAdicionarManual,
}: {
  catalogo: Produto[];
  onAdicionarDoCatalogo: (p: Produto, preco?: string) => void;
  onAdicionarManual: () => void;
}) {
  const [busca, setBusca] = useState('');
  const filtrados = useMemo(() => {
    if (!busca.trim()) return catalogo.slice(0, 20);
    const q = busca.toLowerCase();
    return catalogo
      .filter((p) =>
        p.nome.toLowerCase().includes(q) ||
        p.apelidos.some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 20);
  }, [catalogo, busca]);

  return (
    <div className="space-y-3">
      <div>
        <label className="label">Buscar no catálogo</label>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            className="input pl-9"
            placeholder="Nome do produto..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
      </div>

      {filtrados.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto">
          {filtrados.map((p) => (
            <button
              key={p.id}
              onClick={() => onAdicionarDoCatalogo(p)}
              className="aspect-square rounded-lg border border-line hover:border-ink overflow-hidden p-1 group"
              title={p.nome}
            >
              {p.imagem_path ? (
                <img src={p.imagem_path} className="w-full h-full object-contain" alt="" />
              ) : (
                <ImageOff className="w-4 h-4 text-muted m-auto" />
              )}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onAdicionarManual}
        className="w-full text-xs py-2 px-3 border border-dashed border-line rounded-lg hover:border-ink text-muted hover:text-ink transition-colors flex items-center justify-center gap-1.5"
      >
        <Plus className="w-3 h-3" />
        Adicionar produto sem cadastro (subir imagem na hora)
      </button>
    </div>
  );
}

function ProdutoSelecionadoItem({
  indice, produto, onChange, onRemover, emEdicao, onToggleEdicao,
}: {
  indice: number;
  produto: ProdutoNaArte;
  onChange: (patch: Partial<ProdutoNaArte>) => void;
  onRemover: () => void;
  emEdicao: boolean;
  onToggleEdicao: () => void;
}) {
  function handleImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) {
      const url = URL.createObjectURL(f);
      onChange({ imagemFile: f, imagemUrl: url });
    }
  }

  const temAjuste = (produto.zoom !== undefined && produto.zoom !== 1) ||
                    (produto.offsetX !== undefined && produto.offsetX !== 0) ||
                    (produto.offsetY !== undefined && produto.offsetY !== 0) ||
                    (produto.rotacao !== undefined && produto.rotacao !== 0);

  return (
    <div className={`border rounded-lg p-3 bg-white transition-colors ${
      emEdicao ? 'border-accent ring-2 ring-accent/30' : 'border-line'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-muted">#{indice}</span>
        <button onClick={onRemover} className="text-xs px-1.5 py-0.5 hover:bg-red-50 hover:text-red-700 rounded">
          <X className="w-3 h-3" />
        </button>
      </div>
      <div className="flex gap-3">
        <label className="w-16 h-16 shrink-0 border border-line rounded cursor-pointer hover:border-ink transition-colors grid place-items-center bg-line/20 overflow-hidden relative group">
          <input type="file" accept="image/*" className="hidden" onChange={handleImagem} />
          {produto.imagemUrl ? (
            <>
              <img src={produto.imagemUrl} alt="" className="w-full h-full object-contain p-1" />
              <span className="absolute inset-0 bg-ink/60 grid place-items-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Upload className="w-3 h-3 text-paper" />
              </span>
            </>
          ) : (
            <Upload className="w-4 h-4 text-muted" />
          )}
        </label>
        <div className="flex-1 space-y-1.5 min-w-0">
          <input className="input text-xs py-1" value={produto.nome}
            onChange={(e) => onChange({ nome: e.target.value })} placeholder="Nome do produto" />
          <input className="input text-xs py-1" value={produto.unidade || ''}
            onChange={(e) => onChange({ unidade: e.target.value })} placeholder="Unidade (ex: 60 cápsulas)" />
          <div className="flex gap-1.5">
            <input className="input text-xs py-1 flex-1" value={produto.precoDe || ''}
              onChange={(e) => onChange({ precoDe: e.target.value })} placeholder="Preço antigo" />
            <input className="input text-xs py-1 flex-1" value={produto.preco}
              onChange={(e) => onChange({ preco: e.target.value })} placeholder="Preço atual" />
          </div>
        </div>
      </div>

      {/* Botões de edição */}
      {produto.imagemUrl && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-line">
          <button
            onClick={onToggleEdicao}
            className={`text-xs px-2 py-1 rounded inline-flex items-center gap-1 transition-colors flex-1 justify-center ${
              emEdicao
                ? 'bg-accent text-white'
                : 'bg-line/40 text-ink hover:bg-line/60'
            }`}
            title={emEdicao
              ? 'Concluir edição'
              : 'Arrastar pra mover, alças do canto pra redimensionar'}
          >
            {emEdicao ? (
              <>✓ Concluir edição</>
            ) : (
              <>📐 Alterar tamanho</>
            )}
          </button>
          {temAjuste && (
            <button
              onClick={() => onChange({ zoom: 1, offsetX: 0, offsetY: 0, rotacao: 0 })}
              className="text-[10px] px-2 py-1 rounded bg-line/40 hover:bg-line/60 text-muted hover:text-ink"
              title="Resetar posição/tamanho"
            >
              ↺
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  numero, titulo, children, preenchido,
}: { numero: string; titulo: string; children: React.ReactNode; preenchido?: boolean }) {
  return (
    <div className="card animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-accent">{numero}</span>
          <h3 className="font-medium">{titulo}</h3>
        </div>
        {preenchido && <span className="text-xs text-green-600">✓</span>}
      </div>
      {children}
    </div>
  );
}
