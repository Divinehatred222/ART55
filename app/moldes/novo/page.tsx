// app/moldes/novo/page.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload } from 'lucide-react';

export default function NovoMolde() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [imagem, setImagem] = useState<File | null>(null);
  const [imagemPreview, setImagemPreview] = useState('');
  const [saving, setSaving] = useState(false);

  function handleImagem(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImagem(file);
      setImagemPreview(URL.createObjectURL(file));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!imagem) return;
    setSaving(true);

    const fd = new FormData();
    fd.append('nome', nome);
    fd.append('descricao', descricao);
    fd.append('imagem', imagem);

    const res = await fetch('/api/moldes', { method: 'POST', body: fd });
    if (res.ok) {
      const { id } = await res.json();
      // Vai direto pro editor de slots
      router.push(`/moldes/${id}`);
    } else {
      alert('Erro ao salvar');
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <Link href="/moldes" className="inline-flex items-center gap-2 text-sm text-muted hover:text-ink mb-6">
        <ArrowLeft className="w-4 h-4" /> Moldes
      </Link>

      <h1 className="h-display text-4xl mb-2">Novo molde</h1>
      <p className="text-muted mb-8">
        Suba a imagem do molde. No próximo passo você marca onde fica cada slot.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="label">Nome</label>
          <input
            className="input"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex: Encarte feirão 1080x1080"
            required
          />
        </div>

        <div>
          <label className="label">Descrição (opcional)</label>
          <textarea
            className="input min-h-[80px]"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Para que serve este molde, em quais campanhas usa, etc."
          />
        </div>

        <div>
          <label className="label">Imagem do molde</label>
          <label className="block border-2 border-dashed border-line rounded-lg p-8 text-center cursor-pointer hover:border-ink transition-colors">
            <input
              type="file"
              accept="image/png,image/jpeg"
              onChange={handleImagem}
              className="hidden"
              required
            />
            {imagemPreview ? (
              <div>
                <img
                  src={imagemPreview}
                  alt=""
                  className="max-h-72 mx-auto mb-3 rounded-lg border border-line"
                />
                <span className="text-sm text-muted">{imagem?.name} · trocar</span>
              </div>
            ) : (
              <div className="text-muted">
                <Upload className="w-8 h-8 mx-auto mb-3 opacity-50" />
                <p>Clique para enviar PNG ou JPG</p>
                <p className="text-xs mt-1">Recomendado: 1080×1080 (Meta Ads quadrado)</p>
              </div>
            )}
          </label>
        </div>

        <div className="flex justify-end pt-4 border-t border-line">
          <button type="submit" disabled={saving || !imagem || !nome} className="btn-primary">
            {saving ? 'Enviando...' : 'Continuar para marcar slots'}
          </button>
        </div>
      </form>
    </div>
  );
}
