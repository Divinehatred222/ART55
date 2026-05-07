// app/gerar/tela-revisao.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Group, Rect, Circle } from 'react-konva';
import useImage from 'use-image';
import Konva from 'konva';
import type { Cliente, Molde, Slot } from '@/lib/types';
import type { ArteNaFila } from './gerar-ui';
import {
  ChevronLeft, Download, Loader2, Trash2, Settings2, Sparkles, X, Check, RotateCcw, Plus,
} from 'lucide-react';
import { partirPreco } from '@/lib/preco';
import {
  type AjustesPolimento, AJUSTES_PADRAO, type Preset,
  PRESETS_PRONTOS, lerPresetsCustom, salvarPresetCustom, excluirPresetCustom,
  hexParaRgb, rgbParaHsl, hslParaRgb, corDeSombra,
} from '@/lib/image-effects';

type Props = {
  molde: Molde;
  slots: Slot[];
  cliente: Cliente | null;
  fila: ArteNaFila[];
  corDominanteFundo?: string | null;
  onRemoverArte: (uid: string) => void;
  onAtualizarArte: (uid: string, patch: Partial<ArteNaFila>) => void;
  onVoltar: () => void;
  onLimparFila: () => void;
};

export default function TelaRevisao({
  molde, slots, cliente, fila, corDominanteFundo,
  onRemoverArte, onAtualizarArte, onVoltar, onLimparFila,
}: Props) {
  const [refinandoUid, setRefinandoUid] = useState<string | null>(null);
  const [baixandoTodas, setBaixandoTodas] = useState(false);
  const [progressoBaixa, setProgressoBaixa] = useState({ atual: 0, total: 0 });

  const arteRefinando = refinandoUid ? fila.find((a) => a.uid === refinandoUid) : null;
  const stagesRefs = useRef<Record<string, any>>({});

  async function baixarTodas() {
    setBaixandoTodas(true);
    setProgressoBaixa({ atual: 0, total: fila.length });

    for (let i = 0; i < fila.length; i++) {
      const arte = fila[i];
      const stage = stagesRefs.current[arte.uid];
      if (!stage) continue;

      try {
        const escalaAtual = stage.scaleX();
        const dataUrl = stage.toDataURL({
          pixelRatio: 1 / escalaAtual,
          mimeType: 'image/jpeg',
          quality: 0.95,
        });
        const link = document.createElement('a');
        const sanitizado = arte.rotulo.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
        link.download = `${sanitizado || 'arte'}-${i + 1}.jpg`;
        link.href = dataUrl;
        link.click();
        await new Promise((r) => setTimeout(r, 300));
        setProgressoBaixa({ atual: i + 1, total: fila.length });
      } catch (e) {
        console.error('Erro ao baixar', arte.uid, e);
      }
    }

    try {
      await fetch('/api/geracoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          molde_id: molde.id,
          cliente_id: cliente?.id || null,
          config: { artes: fila.length },
        }),
      });
    } catch {}

    setBaixandoTodas(false);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <button onClick={onVoltar} className="btn-secondary">
          <ChevronLeft className="w-4 h-4" /> Voltar e adicionar mais
        </button>

        <div className="text-center">
          <span className="text-xs uppercase tracking-[0.2em] text-muted">Revisão final</span>
          <h1 className="h-display text-4xl mt-1">{fila.length} {fila.length === 1 ? 'arte' : 'artes'} prontas</h1>
        </div>

        <button onClick={baixarTodas} disabled={baixandoTodas} className="btn-accent">
          {baixandoTodas ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {baixandoTodas
            ? `Baixando ${progressoBaixa.atual}/${progressoBaixa.total}`
            : `Baixar ${fila.length} JPGs`}
        </button>
      </div>

      <div className="mb-6 flex items-center justify-between text-xs">
        <p className="text-muted">
          Clique em <strong>Refinar</strong> em qualquer arte pra aplicar polimento (sombra, cor, brilho).
          O download usa os ajustes que você salvar.
        </p>
        <button onClick={() => {
          if (confirm('Limpar toda a fila? Você perderá todas as artes não baixadas.')) onLimparFila();
        }} className="text-red-700 hover:underline">
          Limpar fila
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {fila.map((arte, idx) => (
          <ArteMiniatura
            key={arte.uid}
            arte={arte}
            indice={idx + 1}
            molde={molde}
            slots={slots}
            cliente={cliente}
            stageRef={(s) => { stagesRefs.current[arte.uid] = s; }}
            onRemover={() => onRemoverArte(arte.uid)}
            onRefinar={() => setRefinandoUid(arte.uid)}
          />
        ))}
      </div>

      {arteRefinando && (
        <ModalRefinar
          arte={arteRefinando}
          molde={molde}
          slots={slots}
          cliente={cliente}
          corDominanteFundo={corDominanteFundo}
          onClose={() => setRefinandoUid(null)}
          onSalvar={(ajustes) => {
            onAtualizarArte(arteRefinando.uid, { ajustes });
            setRefinandoUid(null);
          }}
        />
      )}
    </div>
  );
}

function ArteMiniatura({
  arte, indice, molde, slots, cliente, stageRef, onRemover, onRefinar,
}: {
  arte: ArteNaFila;
  indice: number;
  molde: Molde;
  slots: Slot[];
  cliente: Cliente | null;
  stageRef: (s: any) => void;
  onRemover: () => void;
  onRefinar: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.25);
  const [imagemMolde] = useImage(molde.imagem_path, 'anonymous');

  useEffect(() => {
    function recalcular() {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      setEscala(w / molde.largura);
    }
    recalcular();
    const obs = new ResizeObserver(recalcular);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, [molde.largura]);

  const polidoBadge = arte.ajustes && (
    arte.ajustes.sombra.ativo ||
    arte.ajustes.colorGrading.ativo ||
    arte.ajustes.brilho.ativo ||
    arte.ajustes.contraste.ativo
  );

  return (
    <div className="card p-2 group">
      <div ref={containerRef} className="bg-line/20 rounded-lg overflow-hidden mb-2 relative">
        <Stage
          ref={stageRef}
          width={molde.largura * escala}
          height={molde.altura * escala}
          scaleX={escala}
          scaleY={escala}
        >
          <Layer>
            {imagemMolde && <KonvaImage image={imagemMolde} width={molde.largura} height={molde.altura} />}
            {slots.map((slot) => (
              <RenderSlotComPolimento
                key={slot.id}
                slot={slot}
                cliente={cliente}
                arte={arte}
              />
            ))}
          </Layer>
        </Stage>

        <span className="absolute top-2 left-2 bg-ink/80 text-paper text-[10px] px-2 py-0.5 rounded-full font-mono">
          #{indice}
        </span>

        {polidoBadge && (
          <span className="absolute top-2 right-2 bg-accent text-white text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5" /> polido
          </span>
        )}

        <div className="absolute inset-0 bg-ink/60 opacity-0 group-hover:opacity-100 transition-opacity grid place-items-center gap-2">
          <button onClick={onRefinar} className="btn-primary text-xs">
            <Settings2 className="w-3 h-3" /> Refinar
          </button>
          <button onClick={onRemover} className="btn-secondary text-xs bg-white/90">
            <Trash2 className="w-3 h-3" /> Remover
          </button>
        </div>
      </div>
      <p className="text-xs font-medium truncate" title={arte.rotulo}>{arte.rotulo}</p>
      <p className="text-[10px] text-muted">
        {arte.produtos.length} {arte.produtos.length === 1 ? 'produto' : 'produtos'}
        {arte.produtos[0]?.preco && ` · ${arte.produtos[0].preco}`}
      </p>
    </div>
  );
}

// Modal de refinamento — agora foco em POLIMENTO (cor/sombra), não em posição
function ModalRefinar({
  arte, molde, slots, cliente, corDominanteFundo, onClose, onSalvar,
}: {
  arte: ArteNaFila;
  molde: Molde;
  slots: Slot[];
  cliente: Cliente | null;
  corDominanteFundo?: string | null;
  onClose: () => void;
  onSalvar: (ajustes: AjustesPolimento) => void;
}) {
  const [ajustes, setAjustes] = useState<AjustesPolimento>(() => {
    if (arte.ajustes) return arte.ajustes;
    const base = { ...AJUSTES_PADRAO };
    if (corDominanteFundo) {
      base.sombra = { ...base.sombra, cor: corDeSombra(corDominanteFundo, 0.75) };
      base.colorGrading = { ...base.colorGrading, corAlvo: corDominanteFundo };
    }
    return base;
  });

  const [presetsCustom, setPresetsCustom] = useState<Preset[]>([]);
  const [presetSelecionado, setPresetSelecionado] = useState<string | null>(null);
  const [salvandoPreset, setSalvandoPreset] = useState(false);
  const [nomeNovoPreset, setNomeNovoPreset] = useState('');

  // Carrega presets customizados
  useEffect(() => {
    setPresetsCustom(lerPresetsCustom());
  }, []);

  function aplicarPreset(preset: Preset) {
    let novo = { ...preset.ajustes };
    // Se tem cor dominante e o preset usa harmonização sem corAlvo, herda
    if (corDominanteFundo && novo.colorGrading.ativo && !novo.colorGrading.corAlvo) {
      novo.colorGrading = { ...novo.colorGrading, corAlvo: corDominanteFundo };
    }
    if (corDominanteFundo && novo.sombra.ativo && novo.sombra.cor === '#000000') {
      // Mantém preto como padrão, mas pode trocar pela cor do fundo se quiser
    }
    setAjustes(novo);
    setPresetSelecionado(preset.id);
  }

  function salvarComoNovoPreset() {
    if (!nomeNovoPreset.trim()) return;
    const id = `custom-${Date.now()}`;
    const novo: Preset = {
      id,
      nome: nomeNovoPreset.trim(),
      emoji: '⭐',
      descricao: 'Salvo por você',
      ajustes,
      custom: true,
    };
    salvarPresetCustom(novo);
    setPresetsCustom(lerPresetsCustom());
    setSalvandoPreset(false);
    setNomeNovoPreset('');
    setPresetSelecionado(id);
  }

  function removerPresetCustom(id: string) {
    if (!confirm('Excluir este preset?')) return;
    excluirPresetCustom(id);
    setPresetsCustom(lerPresetsCustom());
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm overflow-auto" onClick={onClose}>
      <div className="min-h-screen p-4 grid place-items-center">
        <div className="bg-paper rounded-2xl shadow-2xl max-w-5xl w-full" onClick={(e) => e.stopPropagation()}>
          <div className="p-5 border-b border-line flex items-center justify-between">
            <div>
              <h2 className="h-display text-2xl">Refinar: {arte.rotulo}</h2>
              <p className="text-xs text-muted mt-1">
                Use um preset pra começar rápido, ou ajuste no detalhe abaixo.
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-line/50">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Barra de presets */}
          <div className="px-5 pt-4 pb-3 border-b border-line bg-line/10">
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted mb-2">Presets</p>
            <div className="flex flex-wrap gap-2">
              {PRESETS_PRONTOS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => aplicarPreset(p)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors inline-flex items-center gap-1.5 ${
                    presetSelecionado === p.id
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-paper border-line hover:border-ink'
                  }`}
                  title={p.descricao}
                >
                  <span>{p.emoji}</span> {p.nome}
                </button>
              ))}
              {presetsCustom.map((p) => (
                <div
                  key={p.id}
                  className={`text-xs px-2 py-1.5 rounded-full border inline-flex items-center gap-1 ${
                    presetSelecionado === p.id
                      ? 'bg-ink text-paper border-ink'
                      : 'bg-amber-50 border-amber-200 hover:border-ink'
                  }`}
                >
                  <button onClick={() => aplicarPreset(p)} className="inline-flex items-center gap-1.5">
                    <span>{p.emoji}</span> {p.nome}
                  </button>
                  <button
                    onClick={() => removerPresetCustom(p.id)}
                    className="ml-1 hover:text-red-700 opacity-50 hover:opacity-100"
                    title="Excluir preset"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}

              {/* Salvar como preset */}
              {!salvandoPreset ? (
                <button
                  onClick={() => setSalvandoPreset(true)}
                  className="text-xs px-3 py-1.5 rounded-full border border-dashed border-line hover:border-ink inline-flex items-center gap-1.5 text-muted hover:text-ink"
                >
                  <Plus className="w-3 h-3" /> Salvar como preset
                </button>
              ) : (
                <div className="inline-flex items-center gap-1 bg-paper border border-ink rounded-full px-2 py-1">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Nome do preset"
                    value={nomeNovoPreset}
                    onChange={(e) => setNomeNovoPreset(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && salvarComoNovoPreset()}
                    className="text-xs bg-transparent outline-none w-32"
                  />
                  <button
                    onClick={salvarComoNovoPreset}
                    disabled={!nomeNovoPreset.trim()}
                    className="text-xs text-accent disabled:opacity-30"
                    title="Salvar"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => { setSalvandoPreset(false); setNomeNovoPreset(''); }}
                    className="text-xs text-muted"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-[340px_1fr] gap-0">
            <div className="p-5 border-r border-line space-y-4 max-h-[55vh] overflow-y-auto">
              <PainelPolimento
                ajustes={ajustes}
                onChange={(a) => { setAjustes(a); setPresetSelecionado(null); }}
              />
            </div>
            <div className="p-5 grid place-items-center bg-line/10">
              <PreviewRefinamento
                molde={molde}
                slots={slots}
                cliente={cliente}
                arte={{ ...arte, ajustes }}
              />
            </div>
          </div>

          <div className="p-5 border-t border-line flex items-center justify-between gap-3">
            <button
              onClick={() => {
                const base = { ...AJUSTES_PADRAO };
                if (corDominanteFundo) {
                  base.sombra = { ...base.sombra, cor: corDeSombra(corDominanteFundo, 0.75) };
                  base.colorGrading = { ...base.colorGrading, corAlvo: corDominanteFundo };
                }
                setAjustes(base);
                setPresetSelecionado(null);
              }}
              className="btn-secondary text-xs"
            >
              <RotateCcw className="w-3 h-3" /> Resetar
            </button>
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-secondary">Cancelar</button>
              <button onClick={() => onSalvar(ajustes)} className="btn-primary">
                <Check className="w-4 h-4" /> Aplicar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PainelPolimento({
  ajustes, onChange,
}: { ajustes: AjustesPolimento; onChange: (a: AjustesPolimento) => void }) {
  function patch<K extends keyof AjustesPolimento>(key: K, val: Partial<AjustesPolimento[K]>) {
    onChange({ ...ajustes, [key]: { ...ajustes[key], ...val } });
  }

  return (
    <div className="space-y-4 text-sm">
      {/* Sombra */}
      <div>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={ajustes.sombra.ativo}
            onChange={(e) => patch('sombra', { ativo: e.target.checked })} />
          <span className="font-medium">Sombra projetada</span>
        </label>
        {ajustes.sombra.ativo && (
          <div className="space-y-2 pl-6">
            <SliderField label="Intensidade" value={ajustes.sombra.intensidade} min={0} max={100}
              onChange={(v) => patch('sombra', { intensidade: v })} />
            <SliderField label="Desfoque" value={ajustes.sombra.desfoque} min={0} max={50}
              onChange={(v) => patch('sombra', { desfoque: v })} />
            <SliderField label="Distância vertical" value={ajustes.sombra.deslocamentoY} min={0} max={80}
              onChange={(v) => patch('sombra', { deslocamentoY: v })} />
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted block mb-1">Cor da sombra</label>
              <div className="flex gap-1.5">
                <input type="color" value={ajustes.sombra.cor}
                  onChange={(e) => patch('sombra', { cor: e.target.value })}
                  className="w-8 h-8 rounded border border-line cursor-pointer" />
                <input type="text" value={ajustes.sombra.cor}
                  onChange={(e) => patch('sombra', { cor: e.target.value })}
                  className="input py-1 text-xs font-mono flex-1" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Color grading com modo */}
      <div className="border-t border-line pt-4">
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={ajustes.colorGrading.ativo}
            onChange={(e) => patch('colorGrading', { ativo: e.target.checked })} />
          <span className="font-medium">Harmonização de cor</span>
        </label>
        {ajustes.colorGrading.ativo && (
          <div className="space-y-2 pl-6">
            {/* Modo */}
            <div className="flex gap-1 p-0.5 bg-line/40 rounded">
              <button
                type="button"
                onClick={() => patch('colorGrading', { modo: 'tint' })}
                className={`flex-1 py-1 rounded text-[10px] uppercase tracking-wider transition-colors ${
                  ajustes.colorGrading.modo === 'tint'
                    ? 'bg-paper text-ink shadow-sm font-medium'
                    : 'text-muted hover:text-ink'
                }`}
                title="Adiciona um leve tom da cor (sutil)"
              >
                Tom sutil
              </button>
              <button
                type="button"
                onClick={() => patch('colorGrading', { modo: 'substituir' })}
                className={`flex-1 py-1 rounded text-[10px] uppercase tracking-wider transition-colors ${
                  ajustes.colorGrading.modo === 'substituir'
                    ? 'bg-paper text-ink shadow-sm font-medium'
                    : 'text-muted hover:text-ink'
                }`}
                title="Troca a tonalidade do produto pela cor escolhida (mantém detalhes)"
              >
                Substituir cor
              </button>
            </div>
            <p className="text-[10px] text-muted">
              {ajustes.colorGrading.modo === 'tint'
                ? 'Aplica um leve tom da cor (efeito sutil)'
                : 'Substitui a tonalidade do produto pela cor escolhida'}
            </p>
            <SliderField
              label="Intensidade"
              value={ajustes.colorGrading.intensidade}
              min={0}
              max={ajustes.colorGrading.modo === 'substituir' ? 100 : 50}
              onChange={(v) => patch('colorGrading', { intensidade: v })}
            />
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted block mb-1">Cor de referência</label>
              <div className="flex gap-1.5">
                <input type="color"
                  value={ajustes.colorGrading.corAlvo || '#888888'}
                  onChange={(e) => patch('colorGrading', { corAlvo: e.target.value })}
                  className="w-8 h-8 rounded border border-line cursor-pointer" />
                <input type="text"
                  value={ajustes.colorGrading.corAlvo || ''}
                  onChange={(e) => patch('colorGrading', { corAlvo: e.target.value })}
                  className="input py-1 text-xs font-mono flex-1" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Brilho/contraste */}
      <div className="border-t border-line pt-4 grid grid-cols-2 gap-3">
        <div>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={ajustes.brilho.ativo}
              onChange={(e) => patch('brilho', { ativo: e.target.checked })} />
            <span className="font-medium text-xs">Brilho</span>
          </label>
          {ajustes.brilho.ativo && (
            <SliderField label="" value={ajustes.brilho.intensidade} min={-50} max={50}
              onChange={(v) => patch('brilho', { intensidade: v })} />
          )}
        </div>
        <div>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={ajustes.contraste.ativo}
              onChange={(e) => patch('contraste', { ativo: e.target.checked })} />
            <span className="font-medium text-xs">Contraste</span>
          </label>
          {ajustes.contraste.ativo && (
            <SliderField label="" value={ajustes.contraste.intensidade} min={-50} max={50}
              onChange={(v) => patch('contraste', { intensidade: v })} />
          )}
        </div>
      </div>

      {/* Saturação */}
      <div className="border-t border-line pt-4">
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={ajustes.saturacao.ativo}
            onChange={(e) => patch('saturacao', { ativo: e.target.checked })} />
          <span className="font-medium text-xs">Saturação</span>
          <span className="text-[10px] text-muted">(cores mais vivas ↑ ou mais discretas ↓)</span>
        </label>
        {ajustes.saturacao.ativo && (
          <div className="pl-6">
            <SliderField label="" value={ajustes.saturacao.intensidade} min={-100} max={100}
              onChange={(v) => patch('saturacao', { intensidade: v })} />
          </div>
        )}
      </div>

      {/* Nitidez */}
      <div>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={ajustes.nitidez.ativo}
            onChange={(e) => patch('nitidez', { ativo: e.target.checked })} />
          <span className="font-medium text-xs">Nitidez</span>
          <span className="text-[10px] text-muted">(realça bordas e detalhes)</span>
        </label>
        {ajustes.nitidez.ativo && (
          <div className="pl-6">
            <SliderField label="" value={ajustes.nitidez.intensidade} min={0} max={100}
              onChange={(v) => patch('nitidez', { intensidade: v })} />
          </div>
        )}
      </div>

      {/* Vinheta */}
      <div>
        <label className="flex items-center gap-2 mb-2">
          <input type="checkbox" checked={ajustes.vinheta.ativo}
            onChange={(e) => patch('vinheta', { ativo: e.target.checked })} />
          <span className="font-medium text-xs">Vinheta</span>
          <span className="text-[10px] text-muted">(escurece bordas, foco no produto)</span>
        </label>
        {ajustes.vinheta.ativo && (
          <div className="pl-6">
            <SliderField label="" value={ajustes.vinheta.intensidade} min={0} max={100}
              onChange={(v) => patch('vinheta', { intensidade: v })} />
          </div>
        )}
      </div>
    </div>
  );
}

function SliderField({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void
}) {
  return (
    <div>
      {label && (
        <label className="text-[10px] uppercase tracking-wider text-muted block mb-0.5">
          {label}: {value}
        </label>
      )}
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full"
      />
    </div>
  );
}

function PreviewRefinamento({
  molde, slots, cliente, arte,
}: {
  molde: Molde; slots: Slot[]; cliente: Cliente | null; arte: ArteNaFila;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.5);
  const [imagemMolde] = useImage(molde.imagem_path, 'anonymous');

  useEffect(() => {
    function recalcular() {
      if (!ref.current) return;
      const max = Math.min(ref.current.offsetWidth, 500);
      setEscala(max / molde.largura);
    }
    recalcular();
    const obs = new ResizeObserver(recalcular);
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [molde.largura]);

  return (
    <div ref={ref} className="w-full max-w-md">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-line">
        <Stage
          width={molde.largura * escala}
          height={molde.altura * escala}
          scaleX={escala}
          scaleY={escala}
        >
          <Layer>
            {imagemMolde && <KonvaImage image={imagemMolde} width={molde.largura} height={molde.altura} />}
            {slots.map((slot) => (
              <RenderSlotComPolimento
                key={slot.id}
                slot={slot}
                cliente={cliente}
                arte={arte}
              />
            ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}

// Render que aplica ajustes de polimento por arte
function RenderSlotComPolimento({
  slot, cliente, arte,
}: {
  slot: Slot;
  cliente: Cliente | null;
  arte: ArteNaFila;
}) {
  const ajustes = arte.ajustes;

  if (slot.tipo === 'logo') {
    return cliente?.logo_path ? (
      <ImagemSlot
        slot={slot}
        src={cliente.logo_path}
        zoom={cliente.logo_zoom}
        offsetX={cliente.logo_offset_x}
        offsetY={cliente.logo_offset_y}
        rotacao={cliente.logo_rotacao}
        ajustes={ajustes}
      />
    ) : null;
  }
  if (slot.tipo === 'cliente_whatsapp') {
    return cliente?.whatsapp ? <TextoSlot slot={slot} texto={cliente.whatsapp} /> : null;
  }
  if (slot.tipo === 'cliente_endereco') {
    return cliente?.endereco ? <TextoSlot slot={slot} texto={cliente.endereco} /> : null;
  }
  if (slot.tipo === 'produto_imagem') {
    const produto = arte.produtos[(slot.indice || 1) - 1];
    return produto?.imagemUrl ? (
      <ImagemSlot slot={slot} src={produto.imagemUrl}
        zoom={produto.zoom} offsetX={produto.offsetX} offsetY={produto.offsetY}
        rotacao={produto.rotacao}
        ajustes={ajustes} />
    ) : null;
  }
  if (slot.tipo === 'produto_nome') {
    const produto = arte.produtos[(slot.indice || 1) - 1];
    return produto?.nome ? <TextoSlot slot={slot} texto={produto.nome} /> : null;
  }
  if (slot.tipo === 'produto_unidade') {
    const produto = arte.produtos[(slot.indice || 1) - 1];
    return produto?.unidade ? <TextoSlot slot={slot} texto={produto.unidade} /> : null;
  }
  if (slot.tipo === 'produto_preco') {
    const produto = arte.produtos[(slot.indice || 1) - 1];
    return produto?.preco ? <PrecoSlot slot={slot} texto={produto.preco} precoDe={produto.precoDe} /> : null;
  }
  if (slot.tipo === 'texto_livre') {
    const txt = arte.textosLivres[slot.id] ?? slot.textoPadrao ?? '';
    return txt ? <TextoSlot slot={slot} texto={txt} /> : null;
  }
  return null;
}

function ImagemSlot({
  slot, src, zoom = 1, offsetX = 0, offsetY = 0, rotacao = 0, ajustes,
}: {
  slot: Slot; src: string;
  zoom?: number; offsetX?: number; offsetY?: number; rotacao?: number;
  ajustes?: AjustesPolimento;
}) {
  const imageRef = useRef<any>(null);
  const [img] = useImage(src, 'anonymous');

  // Aplica filtros Konva quando há ajustes
  useEffect(() => {
    if (!imageRef.current || !img) return;
    const node = imageRef.current;
    const filtros: any[] = [];
    const aplicaAjustes = ajustes && (slot.tipo === 'produto_imagem' || slot.tipo === 'logo');

    if (aplicaAjustes) {
      if (ajustes.colorGrading.ativo && ajustes.colorGrading.corAlvo) {
        // Tint sutil usa RGB; substituir cor usa HSL (manipula matiz/saturação)
        if (ajustes.colorGrading.modo === 'substituir') {
          filtros.push(Konva.Filters.HSL);
        } else {
          filtros.push(Konva.Filters.RGB);
        }
      }
      if (ajustes.brilho.ativo && ajustes.brilho.intensidade !== 0) {
        filtros.push(Konva.Filters.Brighten);
      }
      if (ajustes.contraste.ativo && ajustes.contraste.intensidade !== 0) {
        filtros.push(Konva.Filters.Contrast);
      }
      if (ajustes.saturacao.ativo && ajustes.saturacao.intensidade !== 0) {
        // Se já tem HSL (substituir), reaproveita; senão adiciona
        if (!filtros.includes(Konva.Filters.HSL)) {
          filtros.push(Konva.Filters.HSL);
        }
      }
    }
    node.filters(filtros);

    if (aplicaAjustes) {
      // RGB (tint sutil)
      if (
        ajustes.colorGrading.ativo &&
        ajustes.colorGrading.corAlvo &&
        ajustes.colorGrading.modo === 'tint'
      ) {
        const { r, g, b } = hexParaRgb(ajustes.colorGrading.corAlvo);
        const intensidade = ajustes.colorGrading.intensidade / 100;
        node.red(255 - (255 - r) * intensidade);
        node.green(255 - (255 - g) * intensidade);
        node.blue(255 - (255 - b) * intensidade);
      } else {
        node.red(255); node.green(255); node.blue(255);
      }

      // HSL — combina substituição de cor + saturação
      if (filtros.includes(Konva.Filters.HSL)) {
        let hueShift = 0; // -180 a 180
        let satMult = 0;  // -1 a 1 (0 = neutro)
        let lumMult = 0;  // -1 a 1

        // Substituição de cor: shift em hue e saturação para alcançar a cor alvo
        if (
          ajustes.colorGrading.ativo &&
          ajustes.colorGrading.corAlvo &&
          ajustes.colorGrading.modo === 'substituir'
        ) {
          const { r, g, b } = hexParaRgb(ajustes.colorGrading.corAlvo);
          const hsl = rgbParaHsl(r, g, b);
          const intensidade = ajustes.colorGrading.intensidade / 100;
          // hueShift: vai de 0 (sem mudança) até hsl.h - 180 mais perto possível
          // O Konva.Filters.HSL tem o parâmetro 'hue' em -180 a 180
          // Vamos shiftar pra cor alvo proporcional à intensidade
          // Mapeia o hue alvo (0-360) pra direção
          // A ideia: simular um "hue rotation" pra acompanhar a cor alvo
          hueShift = ((hsl.h + 180) % 360 - 180) * intensidade;
          // Saturação alvo: mistura saturação atual com a do alvo
          satMult = (hsl.s / 100 - 0.5) * intensidade * 2;
        }

        // Saturação independente
        if (ajustes.saturacao.ativo) {
          // -100 a 100 → -1 a 1
          satMult += ajustes.saturacao.intensidade / 100;
        }

        // Konva: hue (-180 a 180), saturation (-1 a 1+), luminance (-1 a 1+)
        node.hue(hueShift);
        node.saturation(satMult);
        node.luminance(lumMult);
      }

      node.brightness(ajustes.brilho.ativo ? ajustes.brilho.intensidade / 100 : 0);
      node.contrast(ajustes.contraste.ativo ? ajustes.contraste.intensidade : 0);
    }

    if (filtros.length > 0) node.cache();
    else node.clearCache();
    node.getLayer()?.batchDraw();
  }, [ajustes, img, slot.tipo]);

  if (!img) return null;

  const slotAspecto = slot.largura / slot.altura;
  const imgAspecto = img.width / img.height;
  const modo = slot.modoImagem || 'contain';

  let baseW: number, baseH: number;
  if (modo === 'contain') {
    if (imgAspecto > slotAspecto) {
      baseW = slot.largura; baseH = slot.largura / imgAspecto;
    } else {
      baseH = slot.altura; baseW = slot.altura * imgAspecto;
    }
  } else {
    if (imgAspecto > slotAspecto) {
      baseH = slot.altura; baseW = slot.altura * imgAspecto;
    } else {
      baseW = slot.largura; baseH = slot.largura / imgAspecto;
    }
  }

  const drawW = baseW * zoom;
  const drawH = baseH * zoom;
  const centroX = slot.x + slot.largura / 2 + offsetX;
  const centroY = slot.y + slot.altura / 2 + offsetY;

  // Sombra
  const sombraProps: any = {};
  if (ajustes?.sombra.ativo && (slot.tipo === 'produto_imagem' || slot.tipo === 'logo')) {
    sombraProps.shadowColor = ajustes.sombra.cor;
    sombraProps.shadowBlur = ajustes.sombra.desfoque;
    sombraProps.shadowOffsetX = 0;
    sombraProps.shadowOffsetY = ajustes.sombra.deslocamentoY;
    sombraProps.shadowOpacity = ajustes.sombra.intensidade / 100;
  }

  // Vinheta: rect com gradiente radial preto, posicionado sobre o slot
  const aplicaVinheta =
    ajustes?.vinheta.ativo &&
    ajustes.vinheta.intensidade > 0 &&
    (slot.tipo === 'produto_imagem' || slot.tipo === 'logo');

  function VinhetaOverlay() {
    if (!aplicaVinheta || !ajustes) return null;
    const opac = ajustes.vinheta.intensidade / 100;
    const raio = Math.max(slot.largura, slot.altura) * 0.7;
    return (
      <Group
        x={slot.x}
        y={slot.y}
        listening={false}
        clipFunc={(ctx) => { ctx.rect(0, 0, slot.largura, slot.altura); }}
      >
        <KonvaImage
          image={undefined}
          width={slot.largura}
          height={slot.altura}
        />
        {/* Rect com gradiente radial */}
        <Rect
          x={0}
          y={0}
          width={slot.largura}
          height={slot.altura}
          fillRadialGradientStartPoint={{ x: slot.largura / 2, y: slot.altura / 2 }}
          fillRadialGradientStartRadius={raio * 0.3}
          fillRadialGradientEndPoint={{ x: slot.largura / 2, y: slot.altura / 2 }}
          fillRadialGradientEndRadius={raio}
          fillRadialGradientColorStops={[
            0, 'rgba(0,0,0,0)',
            1, `rgba(0,0,0,${opac * 0.7})`,
          ]}
          listening={false}
        />
      </Group>
    );
  }

  // Renderiza imagem + vinheta
  function renderImagemEVinheta(content: React.ReactNode) {
    if (!aplicaVinheta) return content;
    return (
      <>
        {content}
        <VinhetaOverlay />
      </>
    );
  }

  // Com rotação: usa Group com pivô no centro
  if (rotacao !== 0) {
    return renderImagemEVinheta(
      <Group
        x={centroX}
        y={centroY}
        rotation={rotacao}
        offsetX={drawW / 2}
        offsetY={drawH / 2}
      >
        <KonvaImage ref={imageRef} image={img} width={drawW} height={drawH} {...sombraProps} />
      </Group>
    );
  }

  // Sem rotação
  const drawX = centroX - drawW / 2;
  const drawY = centroY - drawH / 2;

  if (modo === 'cover' || zoom > 1) {
    return renderImagemEVinheta(
      <Group clipFunc={(ctx) => { ctx.rect(slot.x, slot.y, slot.largura, slot.altura); }}>
        <KonvaImage ref={imageRef} image={img} x={drawX} y={drawY} width={drawW} height={drawH} {...sombraProps} />
      </Group>
    );
  }
  return renderImagemEVinheta(
    <KonvaImage ref={imageRef} image={img} x={drawX} y={drawY} width={drawW} height={drawH} {...sombraProps} />
  );
}

function TextoSlot({ slot, texto }: { slot: Slot; texto: string }) {
  const tamanhoBase = slot.tamanhoFonte || 48;
  const fonte = slot.fonte || 'Inter Tight';
  const corBase = slot.cor || '#000000';
  const align = slot.alinhamento || 'center';
  const fontStyleBase =
    slot.negrito && slot.italico ? 'bold italic' :
    slot.negrito ? 'bold' :
    slot.italico ? 'italic' : 'normal';

  if (!slot.exibirRotulo || !slot.rotuloTexto) {
    return (
      <Text
        x={slot.x} y={slot.y}
        width={slot.largura} height={slot.altura}
        text={texto}
        fontSize={tamanhoBase} fontFamily={fonte}
        fontStyle={fontStyleBase}
        fill={corBase} align={align}
        verticalAlign="middle" wrap="word"
        lineHeight={slot.espacamentoLinha || 1.2}
      />
    );
  }

  const rotuloTamanho = tamanhoBase * (slot.rotuloTamanhoRelativo || 1);
  const rotuloCor = slot.rotuloCor || '#fcd34d';
  const rotuloFontStyle = slot.rotuloNegrito ? 'bold' : 'normal';
  const posicao = slot.rotuloPosicao || 'antes';

  if (posicao === 'acima') {
    return (
      <Group>
        <Text
          x={slot.x} y={slot.y}
          width={slot.largura}
          text={slot.rotuloTexto}
          fontSize={rotuloTamanho} fontFamily={fonte}
          fontStyle={rotuloFontStyle}
          fill={rotuloCor} align={align}
        />
        <Text
          x={slot.x} y={slot.y + rotuloTamanho * 1.2}
          width={slot.largura}
          height={slot.altura - rotuloTamanho * 1.2}
          text={texto}
          fontSize={tamanhoBase} fontFamily={fonte}
          fontStyle={fontStyleBase}
          fill={corBase} align={align}
          wrap="word"
          lineHeight={slot.espacamentoLinha || 1.2}
        />
      </Group>
    );
  }

  const larguraRotuloEstimada = (slot.rotuloTexto.length + 1) * rotuloTamanho * 0.5;
  return (
    <Group>
      <Text
        x={slot.x} y={slot.y}
        width={slot.largura} height={slot.altura}
        text={slot.rotuloTexto + ' '}
        fontSize={rotuloTamanho} fontFamily={fonte}
        fontStyle={rotuloFontStyle}
        fill={rotuloCor} align={align}
        verticalAlign="middle"
      />
      <Text
        x={slot.x + larguraRotuloEstimada}
        y={slot.y}
        width={slot.largura - larguraRotuloEstimada}
        height={slot.altura}
        text={texto}
        fontSize={tamanhoBase} fontFamily={fonte}
        fontStyle={fontStyleBase}
        fill={corBase}
        align="left"
        verticalAlign="middle"
        wrap="word"
        lineHeight={slot.espacamentoLinha || 1.2}
      />
    </Group>
  );
}

function PrecoSlot({ slot, texto, precoDe }: { slot: Slot; texto: string; precoDe?: string }) {
  if (slot.estiloPreco !== 'composto' || !slot.precoComposto) {
    return <TextoSlot slot={slot} texto={texto} />;
  }
  const config = slot.precoComposto;
  const { inteiro, centavos, semCentavos } = partirPreco(texto);
  const tamanhoBase = slot.tamanhoFonte || 48;
  const fonte = slot.fonte || 'Inter Tight';
  const corBase = slot.cor || '#000000';
  const fontStyleBase = slot.negrito ? 'bold' : 'normal';
  const align = slot.alinhamento || 'center';

  const tamanhoPrefixo = tamanhoBase * config.prefixoTamanhoRelativo;
  const tamanhoCentavos = tamanhoBase * config.centavosTamanhoRelativo;
  const tamanhoPrecoDe = tamanhoBase * (config.precoDeTamanhoRelativo || 0.22);
  const tamanhoBolinha = tamanhoBase * (config.bolinhaTamanhoRelativo || 0.55);
  const raioBolinha = tamanhoBolinha * 0.7;

  let yAtual = slot.y;
  let yPrecoDe = 0, yPrefixo = 0, yInteiro = 0;
  if (config.exibirPrecoDe) {
    yPrecoDe = yAtual;
    yAtual += tamanhoPrecoDe * 1.2;
  }
  if (config.prefixo) {
    yPrefixo = yAtual;
    yAtual += tamanhoPrefixo * 1.1;
  }
  yInteiro = yAtual;

  const textoPrecoDe = `${config.precoDePrefixo || ''} ${precoDe || ''}`.trim();

  return (
    <Group>
      {config.exibirPrecoDe && (
        <Text x={slot.x} y={yPrecoDe} width={slot.largura}
          text={textoPrecoDe}
          fontSize={tamanhoPrecoDe} fontFamily={fonte}
          fill={config.precoDeCor || '#9ca3af'}
          textDecoration="line-through"
          align={align}
        />
      )}
      {config.prefixo && (
        <Text x={slot.x} y={yPrefixo} width={slot.largura}
          text={config.prefixo}
          fontSize={tamanhoPrefixo} fontFamily={fonte}
          fontStyle={config.prefixoNegrito ? 'bold' : 'normal'}
          fill={config.prefixoCor}
          align={align} />
      )}
      {config.exibirBolinhaRS && (
        <Group
          x={slot.x + (
            align === 'left' ? raioBolinha + 4 :
            align === 'right' ? slot.largura - inteiro.length * tamanhoBase * 0.55 - raioBolinha * 2.5 :
            (slot.largura / 2) - (inteiro.length * tamanhoBase * 0.28) - raioBolinha * 1.6
          )}
          y={yInteiro + tamanhoBase * 0.55}
        >
          <Circle
            radius={raioBolinha}
            fill={config.bolinhaCorFundo || '#fcd34d'}
          />
          <Text
            x={-raioBolinha} y={-tamanhoBolinha * 0.32}
            width={raioBolinha * 2}
            text={config.bolinhaTexto || 'R$'}
            fontSize={tamanhoBolinha * 0.6}
            fontFamily={fonte}
            fontStyle="bold"
            fill={config.bolinhaCorTexto || '#dc2626'}
            align="center"
          />
        </Group>
      )}
      <Text x={slot.x} y={yInteiro} width={slot.largura}
        text={inteiro}
        fontSize={tamanhoBase} fontFamily={fonte}
        fontStyle={fontStyleBase}
        fill={corBase}
        align={align} />
      {!semCentavos && (
        <Text
          x={slot.x + slot.largura * 0.5 + (inteiro.length * tamanhoBase * 0.28)}
          y={config.centavosSobrescrito ? yInteiro + tamanhoBase * 0.05 : yInteiro + (tamanhoBase - tamanhoCentavos) * 0.7}
          text={config.divisor + centavos}
          fontSize={tamanhoCentavos} fontFamily={fonte}
          fontStyle={config.centavosNegrito ? 'bold' : 'normal'}
          fill={config.centavosCor} />
      )}
    </Group>
  );
}
