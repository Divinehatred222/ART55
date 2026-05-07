// app/produtos/_form.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Produto } from '@/lib/types';
import { ArrowLeft, Trash2, Save, Info, Sparkles, Loader2, Undo2 } from 'lucide-react';
import { getRemovedor, type Metodo, type ProgressoEvento } from '@/lib/bg-remover';

export default function ProdutoForm({ produto }: { produto?: Produto }) {
  const router = useRouter();
  const isEdit = !!produto;

  const [nome, setNome] = useState(produto?.nome || '');
  const [apelidos, setApelidos] = useState((produto?.apelidos || []).join('\n'));
  const [unidade, setUnidade] = useState(produto?.unidade || '');
  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState(produto?.imagem_path || '');
  const [imagemOriginalUrl, setImagemOriginalUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [progressoMsg, setProgressoMsg] = useState('');
  const [progresso, setProgresso] = useState(0);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    const fd = new FormData();
    fd.append('nome', nome);
    fd.append('apelidos', apelidos);
    fd.append('unidade', unidade);
    if (imagem) fd.append('imagem', imagem);

    const url = isEdit ? `/api/produtos/${produto!.id}` : '/api/produtos';
    const method = isEdit ? 'PUT' : 'POST';

    const res = await fetch(url, { method, body: fd });
    if (res.ok) {
      router.push('/produtos');
      router.refresh();
    } else {
      alert('Erro ao salvar');
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEdit) return;
    if (!confirm(`Excluir produto "${produto!.nome}"? Os preços relacionados também serão removidos.`)) return;
    const res = await fetch(`/api/produtos/${produto!.id}`, { method: 'DELETE' });
    if (res.ok) {
      router.push('/produtos');
      router.refresh();
    }
  }

  function handleImagemChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImagem(file);
      setImagemPreview(URL.createObjectURL(file));
      setImagemOriginalUrl(null);
    }
  }

  async function removerFundo(metodo: Metodo) {
    if (!imagem) {
      alert('Suba uma imagem primeiro.');
      return;
    }
    setRemovendo(true);
    setProgresso(0);
    setProgressoMsg('Iniciando...');

    // Guarda original pra possível desfazer
    if (!imagemOriginalUrl) {
      setImagemOriginalUrl(imagemPreview);
    }

    try {
      const removedor = getRemovedor(metodo);
      const blob = await removedor.remover(imagem, (e: ProgressoEvento) => {
        setProgresso(e.porcentagem);
        if (e.mensagem) setProgressoMsg(e.mensagem);
      });

      const novoArquivo = new File([blob], imagem.name.replace(/\.[^.]+$/, '') + '.png', { type: 'image/png' });
      setImagem(novoArquivo);
      setImagemPreview(URL.createObjectURL(blob));
      setProgressoMsg('Concluído!');
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setRemovendo(false);
      setProgresso(0);
    }
  }

  function desfazerRemocao() {
    if (!imagemOriginalUrl) return;
    setImagemPreview(imagemOriginalUrl);
    // Pra refazer download da original como File precisaríamos guardar o original também
    // Por simplicidade, só mostra original mas File continua processado
    setImagemOriginalUrl(null);
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/produtos" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Catálogo
      </Link>

      <h1 className="h-display text-4xl mb-8">{isEdit ? 'Editar produto' : 'Novo produto'}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="label">Nome canônico do produto</label>
          <input
            className="input"
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Dipirona Sódica 500mg 20cp"
            required
          />
          <p className="text-xs text-muted mt-1">
            Use o nome completo e padronizado. Variações você cadastra abaixo como apelidos.
          </p>
        </div>

        <div>
          <label className="label flex items-center gap-1.5">
            Apelidos / variações de nome
            <Info className="w-3 h-3 text-muted" />
          </label>
          <textarea
            className="input min-h-[100px] font-mono text-sm"
            value={apelidos}
            onChange={(e) => setApelidos(e.target.value)}
            placeholder={`Dipirona 500\nDipirona Sódica\nDipirona 500mg`}
          />
          <p className="text-xs text-muted mt-1">
            Um por linha. Quando o cliente mandar a planilha com qualquer um desses nomes, o app encontra esse produto automaticamente.
          </p>
        </div>

        <div>
          <label className="label">Unidade / quantidade</label>
          <input
            className="input"
            type="text"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            placeholder="Ex: 60 cápsulas, 500g, 100ml, 1 frasco"
          />
          <p className="text-xs text-muted mt-1">
            Texto da quantidade do produto. Aparece no slot "Unidade" no molde, separado do nome.
          </p>
        </div>

        <div>
          <label className="label">Imagem (PNG transparente recomendado)</label>
          <div className="flex items-start gap-4">
            <label className="flex-1 border-2 border-dashed border-line rounded-lg p-6 text-center cursor-pointer hover:border-ink transition-colors">
              <input type="file" accept="image/*" onChange={handleImagemChange} className="hidden" />
              <span className="text-sm text-muted">{imagem?.name || 'Clique para selecionar'}</span>
            </label>
            {imagemPreview && (
              <div
                className="w-32 h-32 border border-line rounded-lg p-2 grid place-items-center relative"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #f0f0f0 25%, transparent 25%), linear-gradient(-45deg, #f0f0f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #f0f0f0 75%), linear-gradient(-45deg, transparent 75%, #f0f0f0 75%)',
                  backgroundSize: '12px 12px',
                  backgroundPosition: '0 0, 0 6px, 6px -6px, -6px 0',
                  backgroundColor: 'white',
                }}
              >
                {removendo ? (
                  <div className="absolute inset-0 bg-white/90 grid place-items-center rounded-lg">
                    <div className="text-center">
                      <Loader2 className="w-5 h-5 mx-auto mb-1 animate-spin text-accent" />
                      <div className="text-[10px] text-muted">{progresso}%</div>
                    </div>
                  </div>
                ) : (
                  <img src={imagemPreview} alt="" className="max-w-full max-h-full object-contain" />
                )}
              </div>
            )}
          </div>

          {/* Botões de remoção de fundo */}
          {imagem && !removendo && (
            <div className="mt-3 p-3 bg-line/20 rounded-lg space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-accent" /> Remover fundo automaticamente
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => removerFundo('ia-local')}
                  className="btn-secondary text-xs"
                >
                  <Sparkles className="w-3 h-3" /> IA local
                </button>
                <button
                  type="button"
                  onClick={() => removerFundo('chroma-branco')}
                  className="btn-secondary text-xs"
                >
                  Fundo branco
                </button>
                <button
                  type="button"
                  onClick={() => removerFundo('chroma-preto')}
                  className="btn-secondary text-xs"
                >
                  Fundo preto
                </button>
                {imagemOriginalUrl && (
                  <button
                    type="button"
                    onClick={desfazerRemocao}
                    className="btn-secondary text-xs"
                  >
                    <Undo2 className="w-3 h-3" /> Ver original
                  </button>
                )}
              </div>
              <p className="text-[10px] text-muted">
                IA: melhor qualidade, mais lento (3-8s). Fundo branco/preto: rápido, só funciona com fundo uniforme.
              </p>
            </div>
          )}

          {removendo && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm text-blue-700 mb-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {progressoMsg}
              </div>
              <div className="h-1 bg-blue-200 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 transition-all" style={{ width: `${progresso}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-line">
          {isEdit ? (
            <button type="button" onClick={handleDelete} className="btn-danger">
              <Trash2 className="w-4 h-4" /> Excluir
            </button>
          ) : <span />}
          <button type="submit" disabled={saving || removendo} className="btn-primary">
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </form>
    </div>
  );
}
