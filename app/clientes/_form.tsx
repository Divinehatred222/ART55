// app/clientes/_form.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { Cliente } from '@/lib/types';
import {
  ArrowLeft, Trash2, Save, Sparkles, Loader2, RotateCcw, Move,
  Pipette, Undo2,
} from 'lucide-react';
import { tentarAutoCrop } from '@/lib/auto-crop';
import {
  type Metodo, type ProgressoEvento, type ChromaConfig,
  CORES_PREDEFINIDAS, getRemovedor, removedorIALocal, pegarCorPixel,
} from '@/lib/bg-remover';

const EditorLogoCanvas = dynamic(() => import('./editor-logo-canvas'), { ssr: false });

export default function ClienteForm({ cliente }: { cliente?: Cliente }) {
  const router = useRouter();
  const isEdit = !!cliente;

  const [nome, setNome] = useState(cliente?.nome || '');
  const [whatsapp, setWhatsapp] = useState(cliente?.whatsapp || '');
  const [endereco, setEndereco] = useState(cliente?.endereco || '');
  const [corPrimaria, setCorPrimaria] = useState(cliente?.cor_primaria || '#0a0a0a');
  const [logo, setLogo] = useState<File | null>(null);
  const [logoOriginal, setLogoOriginal] = useState<File | null>(null); // pra desfazer remoção
  const [logoPreview, setLogoPreview] = useState(cliente?.logo_path || '');
  const [saving, setSaving] = useState(false);
  const [croppingLogo, setCroppingLogo] = useState(false);
  const [removendoFundo, setRemovendoFundo] = useState(false);
  const [progressoBg, setProgressoBg] = useState(0);
  const [mensagemBg, setMensagemBg] = useState('');
  const [eyedropperAtivo, setEyedropperAtivo] = useState(false);
  const [corCustomizada, setCorCustomizada] = useState('#FFFFFF');
  const [tolerancia, setTolerancia] = useState(30);

  // Ajustes da logo
  const [logoZoom, setLogoZoom] = useState(cliente?.logo_zoom ?? 1);
  const [logoOffsetX, setLogoOffsetX] = useState(cliente?.logo_offset_x ?? 0);
  const [logoOffsetY, setLogoOffsetY] = useState(cliente?.logo_offset_y ?? 0);
  const [logoRotacao, setLogoRotacao] = useState(cliente?.logo_rotacao ?? 0);
  const [editandoLogo, setEditandoLogo] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData();
    fd.append('nome', nome);
    fd.append('whatsapp', whatsapp);
    fd.append('endereco', endereco);
    fd.append('cor_primaria', corPrimaria);
    if (logo) fd.append('logo', logo);
    fd.append('logo_zoom', String(logoZoom));
    fd.append('logo_offset_x', String(logoOffsetX));
    fd.append('logo_offset_y', String(logoOffsetY));
    fd.append('logo_rotacao', String(logoRotacao));

    const url = isEdit ? `/api/clientes/${cliente!.id}` : '/api/clientes';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, { method, body: fd });
    if (res.ok) {
      router.push('/clientes');
      router.refresh();
    } else {
      alert('Erro ao salvar');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm(`Excluir cliente "${cliente!.nome}"?`)) return;
    const res = await fetch(`/api/clientes/${cliente!.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/clientes');
      router.refresh();
    }
  }

  async function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoOriginal(file);
    setLogo(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
    setLogoRotacao(0);
  }

  // Aplica auto-crop na logo atual
  async function aplicarAutoCrop() {
    if (!logo) return;
    setCroppingLogo(true);
    try {
      const arquivoFinal = await tentarAutoCrop(logo);
      const foiCropado = arquivoFinal !== logo;
      if (foiCropado) {
        setLogo(arquivoFinal);
        setLogoPreview(URL.createObjectURL(arquivoFinal));
      } else {
        alert('A logo já está bem centralizada — sem necessidade de crop.');
      }
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setCroppingLogo(false);
    }
  }

  // Remove fundo via método escolhido
  async function removerFundo(metodo: Metodo, corOverride?: string) {
    if (!logo) {
      alert('Suba uma imagem primeiro.');
      return;
    }
    setRemovendoFundo(true);
    setProgressoBg(0);
    setMensagemBg('Iniciando...');

    try {
      const removedor = getRemovedor(metodo);
      let config: ChromaConfig | undefined;
      if (metodo === 'chroma-customizada') {
        config = { cor: corOverride || corCustomizada, tolerancia };
      } else if (metodo.startsWith('chroma-')) {
        const def = CORES_PREDEFINIDAS.find((c) => c.id === metodo);
        config = { cor: def?.cor || '#FFFFFF', tolerancia: def?.tolerancia ?? 30 };
      }

      const blob = await removedor.remover(logo, (e: ProgressoEvento) => {
        setProgressoBg(e.porcentagem);
        if (e.mensagem) setMensagemBg(e.mensagem);
      }, config);

      const nomeBase = (logo.name || 'logo').replace(/\.[^.]+$/, '');
      let novoArquivo = new File([blob], nomeBase + '-sembg.png', { type: 'image/png' });

      // Auto-crop após remover fundo (geralmente fica bem encaixado)
      try {
        novoArquivo = await tentarAutoCrop(novoArquivo);
      } catch {}

      setLogo(novoArquivo);
      setLogoPreview(URL.createObjectURL(novoArquivo));
      setMensagemBg('Concluído!');
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setRemovendoFundo(false);
      setProgressoBg(0);
    }
  }

  // Eyedropper: clicar na imagem pra pegar cor do fundo
  async function handleClickPreview(e: React.MouseEvent<HTMLImageElement>) {
    if (!eyedropperAtivo || !logoPreview) return;
    const img = e.currentTarget;
    const rect = img.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const xReal = (x / img.clientWidth) * img.naturalWidth;
    const yReal = (y / img.clientHeight) * img.naturalHeight;
    try {
      const cor = await pegarCorPixel(logoPreview, xReal, yReal);
      setCorCustomizada(cor);
      setEyedropperAtivo(false);
      // Já aplica
      await removerFundo('chroma-customizada', cor);
    } catch (e: any) {
      alert('Erro ao pegar cor: ' + e.message);
    }
  }

  function desfazerRemocao() {
    if (!logoOriginal) return;
    setLogo(logoOriginal);
    setLogoPreview(URL.createObjectURL(logoOriginal));
  }

  function resetarAjustes() {
    setLogoZoom(1);
    setLogoOffsetX(0);
    setLogoOffsetY(0);
    setLogoRotacao(0);
  }

  const temAjuste = logoZoom !== 1 || logoOffsetX !== 0 || logoOffsetY !== 0 || logoRotacao !== 0;
  const fundoRemovido = logo?.name.includes('-sembg.png');

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/clientes" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Clientes
      </Link>

      <h1 className="h-display text-4xl mb-8">{isEdit ? 'Editar cliente' : 'Novo cliente'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="label">Nome do cliente</label>
          <input
            className="input"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Drogaria São Paulo"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">WhatsApp</label>
            <input
              className="input"
              type="text"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="(11) 99999-9999"
            />
          </div>
          <div>
            <label className="label">Cor da marca</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
                className="w-12 h-10 rounded-lg border border-line cursor-pointer shrink-0"
              />
              <input
                className="input flex-1 font-mono text-xs"
                type="text"
                value={corPrimaria}
                onChange={(e) => setCorPrimaria(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div>
          <label className="label">Endereço</label>
          <textarea
            className="input min-h-[80px]"
            value={endereco}
            onChange={(e) => setEndereco(e.target.value)}
            placeholder="Rua das Flores, 123 — Centro — São Paulo/SP"
          />
        </div>

        <div>
          <label className="label">Logo (PNG transparente recomendado)</label>
          <div className="flex items-start gap-4">
            <label className="flex-1 border-2 border-dashed border-line rounded-lg p-6 text-center cursor-pointer hover:border-ink transition-colors">
              <input type="file" accept="image/*" onChange={handleLogoChange} className="hidden" />
              <span className="text-sm text-muted">{logo?.name || (logoPreview ? 'Trocar logo' : 'Clique para selecionar')}</span>
            </label>
            {logoPreview && !editandoLogo && (
              <div
                className={`w-32 h-32 border rounded-lg p-2 grid place-items-center bg-white relative ${
                  eyedropperAtivo ? 'border-accent ring-2 ring-accent/30 cursor-crosshair' : 'border-line'
                }`}
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
                }}
              >
                {removendoFundo ? (
                  <div className="text-center">
                    <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin text-accent" />
                    <div className="text-[10px] text-muted">{progressoBg}%</div>
                  </div>
                ) : (
                  <PreviewMini
                    src={logoPreview}
                    zoom={logoZoom}
                    offsetX={logoOffsetX}
                    offsetY={logoOffsetY}
                    rotacao={logoRotacao}
                    onClick={handleClickPreview}
                    eyedropper={eyedropperAtivo}
                  />
                )}
                {temAjuste && !removendoFundo && (
                  <span className="absolute top-1 right-1 bg-accent text-white text-[8px] px-1.5 py-0.5 rounded-full">
                    ajustado
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Painel de remoção de fundo + auto-crop */}
          {logo && !removendoFundo && (
            <div className="mt-3 p-3 bg-line/20 rounded-lg space-y-2.5">
              <div>
                <p className="text-xs font-medium flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3 h-3 text-accent" /> Remover fundo da logo
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => removerFundo('ia-local')}
                    className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent hover:bg-accent/20 inline-flex items-center gap-1"
                    title="Melhor qualidade. Roda 100% no seu navegador (~5-10s)"
                  >
                    <Sparkles className="w-3 h-3" /> IA local
                  </button>
                  {CORES_PREDEFINIDAS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => removerFundo(c.id)}
                      className="text-xs px-2 py-1 rounded-full bg-line/40 hover:bg-line/60 inline-flex items-center gap-1"
                      title={`Remove fundo ${c.cor} (instantâneo)`}
                    >
                      <span className="w-3 h-3 rounded-full border border-line" style={{ background: c.cor }} />
                      {c.rotulo}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEyedropperAtivo(!eyedropperAtivo)}
                    className={`text-xs px-2 py-1 rounded-full inline-flex items-center gap-1 ${
                      eyedropperAtivo
                        ? 'bg-accent text-white'
                        : 'bg-line/40 hover:bg-line/60'
                    }`}
                    title="Clique no fundo da imagem pra pegar a cor exata"
                  >
                    <Pipette className="w-3 h-3" />
                    {eyedropperAtivo ? 'Clique no fundo da imagem...' : 'Cor customizada'}
                  </button>
                  {fundoRemovido && logoOriginal && (
                    <button
                      type="button"
                      onClick={desfazerRemocao}
                      className="text-xs px-2 py-1 rounded-full bg-amber-50 text-amber-700 hover:bg-amber-100 inline-flex items-center gap-1"
                    >
                      <Undo2 className="w-3 h-3" /> Desfazer
                    </button>
                  )}
                </div>
                {/* Tolerância só pra chroma */}
                <div className="flex items-center gap-2 mt-2">
                  <label className="text-[10px] uppercase tracking-wider text-muted shrink-0">
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
                </div>
                <p className="text-[10px] text-muted mt-1.5">
                  IA: melhor qualidade (5-10s). Cores predefinidas: instantâneo, só funciona com fundo uniforme.
                </p>
              </div>

              {/* Auto-crop manual */}
              <div className="pt-2 border-t border-line/50 flex items-center gap-2">
                <button
                  type="button"
                  onClick={aplicarAutoCrop}
                  disabled={croppingLogo}
                  className="btn-secondary text-xs"
                  title="Recorta as bordas vazias/transparentes pra logo ficar centralizada"
                >
                  {croppingLogo ? <Loader2 className="w-3 h-3 animate-spin" /> : '✂️'}
                  Auto-centralizar
                </button>
                <p className="text-[10px] text-muted">
                  Recorta bordas vazias/transparentes ao redor da logo
                </p>
              </div>
            </div>
          )}

          {/* Progresso de remoção */}
          {removendoFundo && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700 mb-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {mensagemBg}
              </div>
              <div className="h-1 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progressoBg}%` }} />
              </div>
            </div>
          )}

          {/* Editor manual + reset */}
          {logoPreview && !editandoLogo && !removendoFundo && (
            <div className="flex items-center gap-2 mt-3">
              <button
                type="button"
                onClick={() => setEditandoLogo(true)}
                className="btn-secondary text-xs"
              >
                <Move className="w-3 h-3" /> Alterar tamanho/posição
              </button>
              {temAjuste && (
                <button
                  type="button"
                  onClick={resetarAjustes}
                  className="text-[10px] px-2 py-1 rounded bg-line/40 hover:bg-line/60 text-muted hover:text-ink inline-flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Resetar ajustes
                </button>
              )}
            </div>
          )}

          {logoPreview && editandoLogo && (
            <div className="mt-3 p-4 bg-line/20 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium">Editor de logo</p>
                  <p className="text-[10px] text-muted">
                    Arraste pra mover, alças do canto pra redimensionar, alça de cima pra rotacionar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditandoLogo(false)}
                  className="btn-primary text-xs"
                >
                  ✓ Concluir
                </button>
              </div>
              <EditorLogoCanvas
                src={logoPreview}
                zoom={logoZoom}
                offsetX={logoOffsetX}
                offsetY={logoOffsetY}
                rotacao={logoRotacao}
                onChange={(patch) => {
                  if (patch.zoom !== undefined) setLogoZoom(patch.zoom);
                  if (patch.offsetX !== undefined) setLogoOffsetX(patch.offsetX);
                  if (patch.offsetY !== undefined) setLogoOffsetY(patch.offsetY);
                  if (patch.rotacao !== undefined) setLogoRotacao(patch.rotacao);
                }}
              />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-line">
          {isEdit ? (
            <button type="button" onClick={handleDelete} className="btn-danger">
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          ) : <span />}
          <button type="submit" disabled={saving} className="btn-primary">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}

function PreviewMini({
  src, zoom, offsetX, offsetY, rotacao, onClick, eyedropper,
}: {
  src: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotacao: number;
  onClick?: (e: React.MouseEvent<HTMLImageElement>) => void;
  eyedropper?: boolean;
}) {
  return (
    <div className="w-full h-full flex items-center justify-center overflow-hidden">
      <img
        src={src}
        alt=""
        className={`max-w-full max-h-full object-contain ${eyedropper ? 'cursor-crosshair' : ''}`}
        style={{
          transform: `translate(${offsetX / 4}px, ${offsetY / 4}px) scale(${zoom}) rotate(${rotacao}deg)`,
          transformOrigin: 'center center',
        }}
        onClick={onClick}
      />
    </div>
  );
}
