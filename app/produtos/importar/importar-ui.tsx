// app/produtos/importar/importar-ui.tsx
'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft, Upload, Loader2, Check, X, AlertCircle,
  Sparkles, RotateCcw, Save, RefreshCw, Settings, Pipette,
} from 'lucide-react';
import {
  type Metodo, type ProgressoEvento, type ChromaConfig,
  CORES_PREDEFINIDAS, getRemovedor, removedorIALocal, arquivoSemExtensao, pegarCorPixel,
} from '@/lib/bg-remover';

type StatusItem = 'aguardando' | 'processando' | 'pronto' | 'rejeitado' | 'erro';

type ItemLote = {
  uid: string;
  arquivoOriginal: File;
  urlOriginal: string;
  arquivoProcessado: File | null;
  urlProcessado: string | null;
  nome: string;
  apelidos: string;
  status: StatusItem;
  progresso: number;
  mensagemProgresso?: string;
  metodoUsado?: Metodo;
  erro?: string;
};

const PARALELO = 2;

export default function ImportarLoteUI() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [metodoPadrao, setMetodoPadrao] = useState<Metodo>('ia-local');
  const [corCustomizada, setCorCustomizada] = useState('#FFFFFF');
  const [tolerancia, setTolerancia] = useState(30);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modeloPreCarregado, setModeloPreCarregado] = useState(false);
  const [carregandoModelo, setCarregandoModelo] = useState(false);
  const [eyedropperUid, setEyedropperUid] = useState<string | null>(null);

  function adicionarArquivos(arquivos: FileList | File[]) {
    const novos: ItemLote[] = [];
    for (const arq of Array.from(arquivos)) {
      if (!arq.type.startsWith('image/')) continue;
      novos.push({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        arquivoOriginal: arq,
        urlOriginal: URL.createObjectURL(arq),
        arquivoProcessado: null,
        urlProcessado: null,
        nome: arquivoSemExtensao(arq.name),
        apelidos: '',
        status: 'aguardando',
        progresso: 0,
      });
    }
    setItens((curr) => [...curr, ...novos]);
  }

  const atualizarItem = useCallback((uid: string, patch: Partial<ItemLote>) => {
    setItens((curr) => curr.map((it) => (it.uid === uid ? { ...it, ...patch } : it)));
  }, []);

  async function preCarregarModelo() {
    if (modeloPreCarregado || carregandoModelo) return;
    setCarregandoModelo(true);
    try {
      await removedorIALocal.preCarregar?.();
      setModeloPreCarregado(true);
    } catch (e: any) {
      alert('Falha ao pré-carregar modelo: ' + e.message);
    } finally {
      setCarregandoModelo(false);
    }
  }

  async function processarItem(uid: string, metodo: Metodo, configCustom?: ChromaConfig) {
    const item = itens.find((i) => i.uid === uid);
    if (!item) return;

    atualizarItem(uid, { status: 'processando', progresso: 0, erro: undefined });

    try {
      const removedor = getRemovedor(metodo);
      // Decide config baseada no método
      let config: ChromaConfig | undefined;
      if (metodo === 'chroma-customizada') {
        config = { cor: configCustom?.cor || corCustomizada, tolerancia: configCustom?.tolerancia ?? tolerancia };
      } else if (metodo.startsWith('chroma-')) {
        const def = CORES_PREDEFINIDAS.find((c) => c.id === metodo);
        config = { cor: def?.cor || '#FFFFFF', tolerancia: def?.tolerancia ?? 30 };
      }

      const blob = await removedor.remover(item.arquivoOriginal, (e: ProgressoEvento) => {
        atualizarItem(uid, { progresso: e.porcentagem, mensagemProgresso: e.mensagem });
      }, config);

      const arquivo = new File(
        [blob],
        item.nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png',
        { type: 'image/png' },
      );
      const url = URL.createObjectURL(blob);

      atualizarItem(uid, {
        status: 'pronto',
        arquivoProcessado: arquivo,
        urlProcessado: url,
        progresso: 100,
        metodoUsado: metodo,
        mensagemProgresso: undefined,
      });
    } catch (e: any) {
      atualizarItem(uid, {
        status: 'erro',
        erro: e.message || 'Erro desconhecido',
        progresso: 0,
      });
    }
  }

  async function processarTodos() {
    if (processando) return;
    setProcessando(true);
    const aguardando = itens.filter((i) => i.status === 'aguardando' || i.status === 'erro').map((i) => i.uid);
    let idx = 0;
    async function trabalhador() {
      while (idx < aguardando.length) {
        const meuIdx = idx++;
        await processarItem(aguardando[meuIdx], metodoPadrao);
      }
    }
    await Promise.all(Array.from({ length: PARALELO }, () => trabalhador()));
    setProcessando(false);
  }

  // Eyedropper: usuário clica num pixel da imagem original pra pegar cor
  async function ativarEyedropper(uid: string) {
    setEyedropperUid(uid);
  }

  async function pegarCorEAplicar(uid: string, x: number, y: number, imgWidth: number, imgHeight: number, naturalW: number, naturalH: number) {
    const item = itens.find((i) => i.uid === uid);
    if (!item) return;
    setEyedropperUid(null);
    // Converte coords da img exibida pra coords reais
    const xReal = (x / imgWidth) * naturalW;
    const yReal = (y / imgHeight) * naturalH;
    try {
      const cor = await pegarCorPixel(item.urlOriginal, xReal, yReal);
      setCorCustomizada(cor);
      // Reprocessa imediato com a cor pegada
      await processarItem(uid, 'chroma-customizada', { cor, tolerancia });
    } catch (e: any) {
      alert('Erro ao pegar cor: ' + e.message);
    }
  }

  async function reprocessarItem(uid: string, metodo: Metodo) {
    await processarItem(uid, metodo);
  }

  function rejeitarItem(uid: string) {
    atualizarItem(uid, { status: 'rejeitado' });
  }

  function reactivarItem(uid: string) {
    atualizarItem(uid, { status: 'pronto' });
  }

  function removerItem(uid: string) {
    setItens((curr) => curr.filter((i) => i.uid !== uid));
  }

  async function salvarTodos() {
    const prontos = itens.filter((i) => i.status === 'pronto' && i.nome.trim());
    if (prontos.length === 0) return;
    if (!confirm(`Cadastrar ${prontos.length} produtos no catálogo?`)) return;

    setSalvando(true);
    const fd = new FormData();
    fd.append('total', String(prontos.length));
    prontos.forEach((p, i) => {
      fd.append(`nome_${i}`, p.nome);
      fd.append(`apelidos_${i}`, p.apelidos);
      const arq = p.arquivoProcessado || p.arquivoOriginal;
      fd.append(`imagem_${i}`, arq);
    });

    try {
      const res = await fetch('/api/produtos/lote', { method: 'POST', body: fd });
      const data = await res.json();
      if (data.erros && data.erros.length > 0) {
        alert(`Cadastrados ${data.criados}. Erros:\n${data.erros.join('\n')}`);
      } else {
        alert(`✅ ${data.criados} produtos cadastrados!`);
      }
      router.push('/produtos');
      router.refresh();
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  const total = itens.length;
  const aguardando = itens.filter((i) => i.status === 'aguardando').length;
  const processando_qtd = itens.filter((i) => i.status === 'processando').length;
  const prontos = itens.filter((i) => i.status === 'pronto').length;
  const rejeitados = itens.filter((i) => i.status === 'rejeitado').length;
  const erros = itens.filter((i) => i.status === 'erro').length;

  useEffect(() => {
    return () => {
      itens.forEach((i) => {
        URL.revokeObjectURL(i.urlOriginal);
        if (i.urlProcessado) URL.revokeObjectURL(i.urlProcessado);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <Link href="/produtos" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Catálogo
      </Link>

      <div className="flex items-end justify-between mb-8">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">/produtos/importar</span>
          <h1 className="h-display text-5xl mt-2">Importar em massa</h1>
          <p className="text-muted mt-2 text-sm max-w-2xl">
            Suba várias imagens, deixe a IA remover o fundo automaticamente, revise os resultados e cadastre tudo de uma vez.
          </p>
        </div>
      </div>

      {/* Configuração de método */}
      <div className="card mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Settings className="w-4 h-4 text-muted" />
          <span className="text-sm font-medium">Método de remoção</span>
        </div>

        {/* Botões de método */}
        <div className="flex flex-wrap gap-2 mb-3">
          <BotaoMetodo
            ativo={metodoPadrao === 'ia-local'}
            onClick={() => setMetodoPadrao('ia-local')}
          >
            <Sparkles className="w-3 h-3" /> IA local
            <span className="text-[10px] opacity-70 ml-1">recomendado</span>
          </BotaoMetodo>
          {CORES_PREDEFINIDAS.map((c) => (
            <BotaoMetodo
              key={c.id}
              ativo={metodoPadrao === c.id}
              onClick={() => setMetodoPadrao(c.id)}
            >
              <span className="w-3 h-3 rounded-full border border-line" style={{ background: c.cor }} />
              {c.rotulo}
            </BotaoMetodo>
          ))}
          <BotaoMetodo
            ativo={metodoPadrao === 'chroma-customizada'}
            onClick={() => setMetodoPadrao('chroma-customizada')}
          >
            <Pipette className="w-3 h-3" /> Cor customizada
          </BotaoMetodo>
        </div>

        {/* Config customizada */}
        {metodoPadrao === 'chroma-customizada' && (
          <div className="flex items-center gap-3 p-3 bg-line/30 rounded-lg flex-wrap">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={corCustomizada}
                onChange={(e) => setCorCustomizada(e.target.value.toUpperCase())}
                className="w-10 h-8 rounded border border-line cursor-pointer"
              />
              <input
                type="text"
                value={corCustomizada}
                onChange={(e) => setCorCustomizada(e.target.value)}
                className="input py-1 text-xs font-mono w-24"
              />
            </div>
            <p className="text-xs text-muted">
              💡 Use o ícone <Pipette className="w-3 h-3 inline" /> em qualquer imagem pra pegar a cor exata do fundo
            </p>
          </div>
        )}

        {/* Tolerância (só pra chroma) */}
        {metodoPadrao !== 'ia-local' && (
          <div className="mt-3 flex items-center gap-3">
            <label className="text-xs uppercase tracking-wider text-muted">
              Tolerância: {tolerancia}
            </label>
            <input
              type="range"
              min="5"
              max="100"
              value={tolerancia}
              onChange={(e) => setTolerancia(parseInt(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="text-[10px] text-muted">
              {tolerancia < 20 ? 'estrito' : tolerancia < 50 ? 'normal' : 'permissivo'}
            </span>
          </div>
        )}

        {/* Pré-carregar modelo */}
        {metodoPadrao === 'ia-local' && (
          <div className="mt-3">
            <button
              onClick={preCarregarModelo}
              disabled={modeloPreCarregado || carregandoModelo}
              className="btn-secondary text-xs"
            >
              {carregandoModelo ? <Loader2 className="w-3 h-3 animate-spin" /> :
                modeloPreCarregado ? <Check className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
              {carregandoModelo ? 'Carregando modelo...' :
                modeloPreCarregado ? 'Modelo pronto' : 'Pré-carregar modelo'}
            </button>
          </div>
        )}
      </div>

      {/* Upload */}
      <div
        className="card mb-6 border-2 border-dashed border-line hover:border-ink transition-colors text-center py-12 cursor-pointer"
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) adicionarArquivos(e.dataTransfer.files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) adicionarArquivos(e.target.files);
            e.target.value = '';
          }}
        />
        <Upload className="w-10 h-10 mx-auto mb-3 text-muted" />
        <p className="font-medium mb-1">Clique ou arraste imagens aqui</p>
        <p className="text-xs text-muted">PNG, JPG, WEBP · Sem limite de quantidade</p>
      </div>

      {total > 0 && (
        <div className="card mb-6 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <Stat label="Total" valor={total} />
            {aguardando > 0 && <Stat label="Aguardando" valor={aguardando} cor="gray" />}
            {processando_qtd > 0 && <Stat label="Processando" valor={processando_qtd} cor="blue" />}
            {prontos > 0 && <Stat label="Prontos" valor={prontos} cor="green" />}
            {rejeitados > 0 && <Stat label="Rejeitados" valor={rejeitados} cor="amber" />}
            {erros > 0 && <Stat label="Erros" valor={erros} cor="red" />}
          </div>
          <div className="ml-auto flex items-center gap-2">
            {(aguardando > 0 || erros > 0) && (
              <button onClick={processarTodos} disabled={processando} className="btn-primary text-sm">
                {processando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {processando ? 'Processando...' : `Remover fundo (${aguardando + erros})`}
              </button>
            )}
            {prontos > 0 && (
              <button onClick={salvarTodos} disabled={salvando} className="btn-accent text-sm">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Cadastrar {prontos}
              </button>
            )}
          </div>
        </div>
      )}

      {itens.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {itens.map((item) => (
            <ItemCard
              key={item.uid}
              item={item}
              eyedropperAtivo={eyedropperUid === item.uid}
              corCustomizada={corCustomizada}
              tolerancia={tolerancia}
              onAtualizar={(patch) => atualizarItem(item.uid, patch)}
              onProcessar={(m, cfg) => processarItem(item.uid, m, cfg)}
              onAtivarEyedropper={() => ativarEyedropper(item.uid)}
              onCorPega={(x, y, w, h, nW, nH) => pegarCorEAplicar(item.uid, x, y, w, h, nW, nH)}
              onRejeitar={() => rejeitarItem(item.uid)}
              onReativar={() => reactivarItem(item.uid)}
              onRemover={() => removerItem(item.uid)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BotaoMetodo({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full inline-flex items-center gap-1.5 transition-colors ${
        ativo ? 'bg-ink text-paper' : 'bg-line/40 text-ink hover:bg-line/60'
      }`}
    >
      {children}
    </button>
  );
}

function Stat({ label, valor, cor }: { label: string; valor: number; cor?: 'green' | 'amber' | 'red' | 'blue' | 'gray' }) {
  const cores = {
    green: 'bg-green-50 text-green-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
    blue: 'bg-blue-50 text-blue-700',
    gray: 'bg-line/40 text-muted',
  };
  return (
    <span className={`px-2 py-1 rounded text-xs flex items-center gap-1.5 ${cores[cor || 'gray']}`}>
      <span className="font-display text-base leading-none">{valor}</span>
      {label}
    </span>
  );
}

function ItemCard({
  item, eyedropperAtivo, corCustomizada, tolerancia,
  onAtualizar, onProcessar, onAtivarEyedropper, onCorPega,
  onRejeitar, onReativar, onRemover,
}: {
  item: ItemLote;
  eyedropperAtivo: boolean;
  corCustomizada: string;
  tolerancia: number;
  onAtualizar: (patch: Partial<ItemLote>) => void;
  onProcessar: (m: Metodo, cfg?: ChromaConfig) => void;
  onAtivarEyedropper: () => void;
  onCorPega: (x: number, y: number, w: number, h: number, nW: number, nH: number) => void;
  onRejeitar: () => void;
  onReativar: () => void;
  onRemover: () => void;
}) {
  const [mostrarOriginal, setMostrarOriginal] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  function handleClickImagem(e: React.MouseEvent<HTMLImageElement>) {
    if (!eyedropperAtivo) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    onCorPega(x, y, img.clientWidth, img.clientHeight, img.naturalWidth, img.naturalHeight);
  }

  return (
    <div className={`card transition-all ${
      item.status === 'rejeitado' ? 'opacity-50' :
      item.status === 'erro' ? 'border-red-200 bg-red-50/30' :
      item.status === 'pronto' ? 'border-green-200' :
      eyedropperAtivo ? 'border-accent ring-2 ring-accent/30' : ''
    }`}>
      {eyedropperAtivo && (
        <div className="mb-2 px-2 py-1 bg-accent/10 text-accent text-xs rounded flex items-center gap-1.5">
          <Pipette className="w-3 h-3" /> Clique no fundo da imagem pra pegar a cor
        </div>
      )}

      <div
        className={`aspect-square rounded-lg mb-3 overflow-hidden grid place-items-center relative ${
          eyedropperAtivo ? 'cursor-crosshair' : 'cursor-pointer'
        }`}
        style={{
          backgroundImage:
            'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
          backgroundSize: '20px 20px',
          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0',
          backgroundColor: 'white',
        }}
        onMouseEnter={() => !eyedropperAtivo && setMostrarOriginal(true)}
        onMouseLeave={() => !eyedropperAtivo && setMostrarOriginal(false)}
      >
        {item.status === 'processando' ? (
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-accent" />
            <div className="text-xs text-muted">{item.mensagemProgresso}</div>
            <div className="text-sm font-mono mt-1">{item.progresso}%</div>
          </div>
        ) : (
          <img
            ref={imgRef}
            src={
              eyedropperAtivo ? item.urlOriginal :
              mostrarOriginal ? item.urlOriginal :
              (item.urlProcessado || item.urlOriginal)
            }
            alt=""
            className="max-w-full max-h-full object-contain p-3"
            onClick={handleClickImagem}
          />
        )}

        <div className="absolute top-2 left-2 flex items-center gap-1">
          {item.status === 'pronto' && (
            <span className="bg-green-600 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">
              ✓ {metodoLabel(item.metodoUsado)}
            </span>
          )}
          {item.status === 'aguardando' && (
            <span className="bg-line text-muted text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">aguardando</span>
          )}
          {item.status === 'erro' && (
            <span className="bg-red-600 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">erro</span>
          )}
          {item.status === 'rejeitado' && (
            <span className="bg-amber-600 text-white text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full">rejeitado</span>
          )}
        </div>

        {item.status === 'pronto' && !eyedropperAtivo && (
          <span className="absolute bottom-2 right-2 bg-ink/80 text-paper text-[10px] px-2 py-0.5 rounded-full">
            {mostrarOriginal ? 'original' : 'sem fundo'}
          </span>
        )}
      </div>

      {item.status === 'erro' && (
        <div className="mb-3 p-2 bg-red-50 text-red-700 text-xs rounded flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span className="flex-1 break-words">{item.erro}</span>
        </div>
      )}

      <input
        className="input py-1.5 text-sm mb-2"
        placeholder="Nome do produto"
        value={item.nome}
        onChange={(e) => onAtualizar({ nome: e.target.value })}
        disabled={item.status === 'rejeitado'}
      />
      <textarea
        className="input py-1.5 text-xs font-mono mb-3 min-h-[40px]"
        placeholder="Apelidos (um por linha, opcional)"
        value={item.apelidos}
        onChange={(e) => onAtualizar({ apelidos: e.target.value })}
        disabled={item.status === 'rejeitado'}
      />

      {/* Ações */}
      <div className="flex gap-1 flex-wrap">
        {item.status !== 'rejeitado' && item.status !== 'processando' && (
          <>
            {item.status === 'pronto' ? (
              <>
                <button onClick={onAtivarEyedropper} className="btn-secondary text-xs px-2 py-1" title="Pegar cor do fundo">
                  <Pipette className="w-3 h-3" />
                </button>
                <button onClick={() => onProcessar('ia-local')} className="btn-secondary text-xs px-2 py-1" title="IA">
                  <Sparkles className="w-3 h-3" />
                </button>
                <button onClick={() => onProcessar('chroma-branco')} className="btn-secondary text-xs px-2 py-1">Branco</button>
                <button onClick={() => onProcessar('chroma-preto')} className="btn-secondary text-xs px-2 py-1">Preto</button>
                <button onClick={() => onProcessar('chroma-customizada', { cor: corCustomizada, tolerancia })} className="btn-secondary text-xs px-2 py-1" title={`Cor: ${corCustomizada}`}>
                  <span className="w-3 h-3 rounded-full border border-line inline-block" style={{ background: corCustomizada }} />
                </button>
                <button onClick={onRejeitar} className="btn-secondary text-xs px-2 py-1 ml-auto">
                  <X className="w-3 h-3" />
                </button>
              </>
            ) : (
              <>
                <button onClick={() => onProcessar('ia-local')} className="btn-primary text-xs px-2 py-1">
                  <Sparkles className="w-3 h-3" /> Processar
                </button>
                <button onClick={onRemover} className="btn-secondary text-xs px-2 py-1 ml-auto">
                  <X className="w-3 h-3" />
                </button>
              </>
            )}
          </>
        )}
        {item.status === 'rejeitado' && (
          <>
            <button onClick={onReativar} className="btn-secondary text-xs px-2 py-1">
              <RotateCcw className="w-3 h-3" /> Reativar
            </button>
            <button onClick={onRemover} className="btn-secondary text-xs px-2 py-1 ml-auto">
              <X className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function metodoLabel(m?: Metodo): string {
  if (m === 'ia-local') return 'IA';
  if (m === 'chroma-branco') return 'Branco';
  if (m === 'chroma-preto') return 'Preto';
  if (m === 'chroma-verde') return 'Verde';
  if (m === 'chroma-azul') return 'Azul';
  if (m === 'chroma-cinza') return 'Cinza';
  if (m === 'chroma-customizada') return 'Custom';
  return '—';
}
