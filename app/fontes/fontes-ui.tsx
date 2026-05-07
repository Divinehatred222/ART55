// app/fontes/fontes-ui.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { Fonte } from '@/lib/types';
import { carregarTodasFontes, carregarFonte } from '@/lib/font-loader';
import { nomeAPartirDoArquivo, detectarFamilia } from '@/lib/font-name';
import {
  Plus, Trash2, Upload, Globe, Type as TypeIcon, X, Lock,
  AlertTriangle, Check, FolderUp, Loader2,
} from 'lucide-react';

export default function FontesUI({ fontes }: { fontes: Fonte[] }) {
  const router = useRouter();
  const [adicionando, setAdicionando] = useState(false);
  const [ativandoFonte, setAtivandoFonte] = useState<Fonte | null>(null);

  useEffect(() => {
    carregarTodasFontes(
      fontes
        .filter((f) => !f.aguardando_arquivo)
        .map((f) => ({
          nome: f.nome,
          fonte: f.fonte,
          arquivo_path: f.arquivo_path,
          google_url: f.google_url,
        })),
    );
  }, [fontes]);

  async function excluir(id: number) {
    if (id < 0) return;
    if (!confirm('Excluir esta fonte? Moldes que usam ela vão perder a formatação.')) return;
    const res = await fetch(`/api/fontes/${id}`, { method: 'DELETE' });
    if (res.ok) router.refresh();
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <div className="flex items-end justify-between mb-10">
        <div>
          <span className="text-xs uppercase tracking-[0.2em] text-muted">/fontes</span>
          <h1 className="h-display text-5xl mt-2">Fontes</h1>
          <p className="text-muted mt-2 text-sm">
            Gerencie a biblioteca de fontes usadas nos moldes. Inclui sistema, Google Fonts e uploads.
          </p>
        </div>
        <button onClick={() => setAdicionando(true)} className="btn-primary">
          <Plus className="w-4 h-4" /> Adicionar fonte
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {fontes.map((f) => (
          <FonteCard
            key={`${f.id}-${f.nome}`}
            fonte={f}
            onExcluir={() => excluir(f.id)}
            onAtivar={() => setAtivandoFonte(f)}
          />
        ))}
      </div>

      {adicionando && (
        <ModalAdicionarFonte
          onClose={() => setAdicionando(false)}
          onSucesso={() => { setAdicionando(false); router.refresh(); }}
        />
      )}

      {ativandoFonte && (
        <ModalAtivarFonteComercial
          fonte={ativandoFonte}
          onClose={() => setAtivandoFonte(null)}
          onSucesso={() => { setAtivandoFonte(null); router.refresh(); }}
        />
      )}
    </div>
  );
}

function FonteCard({
  fonte, onExcluir, onAtivar,
}: { fonte: Fonte; onExcluir: () => void; onAtivar: () => void }) {
  const isSistema = fonte.id < 0 && !fonte.aguardando_arquivo && fonte.fonte === 'sistema';
  const isGoogleSistema = fonte.id < 0 && fonte.fonte === 'google';
  const aguardando = fonte.aguardando_arquivo === true;

  let badgeBg = '#73737315', badgeFg = '#737373', icone = <Lock className="w-4 h-4" />;
  if (fonte.fonte === 'google') {
    badgeBg = '#4285F415'; badgeFg = '#4285F4'; icone = <Globe className="w-4 h-4" />;
  } else if (fonte.fonte === 'upload' && !aguardando) {
    badgeBg = '#10b98115'; badgeFg = '#10b981'; icone = <Upload className="w-4 h-4" />;
  } else if (aguardando) {
    badgeBg = '#f59e0b15'; badgeFg = '#f59e0b'; icone = <AlertTriangle className="w-4 h-4" />;
  }

  return (
    <div className={`card group flex items-center gap-4 ${aguardando ? 'border-amber-300/50 bg-amber-50/30' : ''}`}>
      <span
        className="w-10 h-10 rounded-lg grid place-items-center shrink-0"
        style={{ background: badgeBg, color: badgeFg }}
      >
        {icone}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-1 flex-wrap">
          <h3 className="font-medium truncate">{fonte.nome}</h3>
          <span className="text-[10px] uppercase tracking-wider text-muted">{fonte.fonte}</span>
          {aguardando && (
            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded">
              aguardando arquivo
            </span>
          )}
        </div>
        {aguardando ? (
          <p className="text-xs text-muted">{fonte.observacao}</p>
        ) : (
          <p className="text-2xl truncate" style={{ fontFamily: `"${fonte.nome}", system-ui, sans-serif` }}>
            The quick brown fox 1234
          </p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {aguardando && (
          <button onClick={onAtivar} className="btn-secondary text-xs px-3 py-1.5"
            title="Faça upload do arquivo licenciado para ativar">
            <Upload className="w-3 h-3" /> Ativar
          </button>
        )}
        {!isSistema && !isGoogleSistema && !aguardando && (
          <button onClick={onExcluir}
            className="text-muted hover:text-red-700 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Modal específico pra ativar fonte comercial pré-cadastrada
function ModalAtivarFonteComercial({
  fonte, onClose, onSucesso,
}: { fonte: Fonte; onClose: () => void; onSucesso: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!arquivo) {
      setErro('Selecione o arquivo de fonte.');
      return;
    }
    setSalvando(true);
    setErro(null);

    const fd = new FormData();
    fd.append('tipo', 'upload');
    fd.append('nome', fonte.nome);
    fd.append('arquivo', arquivo);

    const res = await fetch('/api/fontes', { method: 'POST', body: fd });
    if (res.ok) {
      onSucesso();
    } else {
      const data = await res.json();
      setErro(data.error || 'Erro ao salvar');
      setSalvando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl shadow-2xl max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex items-center justify-between">
          <h2 className="h-display text-2xl">Ativar {fonte.nome}</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-line/50"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="bg-amber-50/60 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
            <strong className="block mb-1">⚠️ Fonte comercial</strong>
            {fonte.observacao} Você precisa ter a licença adquirida para usar essa fonte legalmente.
          </div>
          <div>
            <label className="label">Arquivo da fonte (TTF, OTF, WOFF ou WOFF2)</label>
            <label className="block border-2 border-dashed border-line rounded-lg p-6 text-center cursor-pointer hover:border-ink transition-colors">
              <input type="file" accept=".ttf,.otf,.woff,.woff2"
                onChange={(e) => setArquivo(e.target.files?.[0] || null)} className="hidden" />
              <Upload className="w-6 h-6 mx-auto mb-2 text-muted" />
              <span className="text-sm text-muted">{arquivo?.name || 'Clique para selecionar'}</span>
            </label>
          </div>
          {erro && <p className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
          <div className="flex justify-end gap-3 pt-3 border-t border-line">
            <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
            <button type="submit" disabled={salvando || !arquivo} className="btn-primary">
              {salvando ? 'Ativando...' : <><Check className="w-4 h-4" /> Ativar fonte</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Modal principal: 3 abas (Google, Upload único, Upload em lote)
function ModalAdicionarFonte({ onClose, onSucesso }: { onClose: () => void; onSucesso: () => void }) {
  const [tipo, setTipo] = useState<'google' | 'upload' | 'lote'>('lote');

  return (
    <div className="fixed inset-0 z-50 bg-ink/50 backdrop-blur-sm grid place-items-center p-4" onClick={onClose}>
      <div className="bg-paper rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 border-b border-line flex items-center justify-between">
          <h2 className="h-display text-2xl">Adicionar fonte</h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-line/50"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6">
          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-line/50 rounded-lg mb-5">
            <TabButton ativo={tipo === 'lote'} onClick={() => setTipo('lote')}>
              <FolderUp className="w-3.5 h-3.5" /> Várias de uma vez
            </TabButton>
            <TabButton ativo={tipo === 'upload'} onClick={() => setTipo('upload')}>
              <Upload className="w-3.5 h-3.5" /> Uma fonte
            </TabButton>
            <TabButton ativo={tipo === 'google'} onClick={() => setTipo('google')}>
              <Globe className="w-3.5 h-3.5" /> Google Fonts
            </TabButton>
          </div>

          {tipo === 'lote' && <FormLote onClose={onClose} onSucesso={onSucesso} />}
          {tipo === 'upload' && <FormUpload onClose={onClose} onSucesso={onSucesso} />}
          {tipo === 'google' && <FormGoogle onClose={onClose} onSucesso={onSucesso} />}
        </div>
      </div>
    </div>
  );
}

function TabButton({ ativo, onClick, children }: { ativo: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 py-2 rounded-md text-sm transition-colors flex items-center justify-center gap-2 ${
        ativo ? 'bg-paper text-ink shadow-sm' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

// =====  Form: upload em lote =====
type ItemLote = {
  uid: string;
  arquivo: File;
  nome: string;            // editável pelo usuário
  status: 'pendente' | 'enviando' | 'ok' | 'conflito' | 'erro';
  erro?: string;
};

function FormLote({ onClose, onSucesso }: { onClose: () => void; onSucesso: () => void }) {
  const [itens, setItens] = useState<ItemLote[]>([]);
  const [salvando, setSalvando] = useState(false);

  function adicionar(arquivos: FileList | File[]) {
    const novos: ItemLote[] = Array.from(arquivos)
      .filter((arq) => /\.(ttf|otf|woff|woff2)$/i.test(arq.name))
      .map((arq) => ({
        uid: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        arquivo: arq,
        nome: nomeAPartirDoArquivo(arq.name),
        status: 'pendente',
      }));
    setItens((curr) => [...curr, ...novos]);

    // Tenta carregar prévias das fontes (cria @font-face temporária)
    novos.forEach(async (item) => {
      try {
        const url = URL.createObjectURL(item.arquivo);
        const fontFace = new FontFace(item.nome, `url(${url})`);
        await fontFace.load();
        document.fonts.add(fontFace);
      } catch {}
    });
  }

  function atualizar(uid: string, patch: Partial<ItemLote>) {
    setItens((curr) => curr.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  function remover(uid: string) {
    setItens((curr) => curr.filter((i) => i.uid !== uid));
  }

  async function enviar() {
    const validos = itens.filter((i) => i.nome.trim() && i.status !== 'ok');
    if (validos.length === 0) return;

    setSalvando(true);
    const fd = new FormData();
    fd.append('total', String(validos.length));
    validos.forEach((it, i) => {
      fd.append(`nome_${i}`, it.nome.trim());
      fd.append(`arquivo_${i}`, it.arquivo);
    });

    try {
      const res = await fetch('/api/fontes/lote', { method: 'POST', body: fd });
      const data = await res.json();

      // Atualiza status individual baseado em conflitos/erros
      const conflitos: string[] = data.conflitos || [];
      const erros: string[] = data.erros || [];
      setItens((curr) => curr.map((it) => {
        if (it.status === 'ok') return it;
        if (conflitos.includes(it.nome.trim())) {
          return { ...it, status: 'conflito', erro: 'Nome já existe' };
        }
        const erroDoItem = erros.find((e) => e.includes(it.nome.trim()));
        if (erroDoItem) {
          return { ...it, status: 'erro', erro: erroDoItem };
        }
        return { ...it, status: 'ok' };
      }));

      // Se tudo ok, fecha
      const algumProblema = conflitos.length > 0 || erros.length > 0;
      if (!algumProblema && data.criadas > 0) {
        setTimeout(() => onSucesso(), 600);
      }
    } catch (e: any) {
      alert('Erro: ' + e.message);
    } finally {
      setSalvando(false);
    }
  }

  // Detecta família comum (info útil pra usuário)
  const familia = useMemo(() => detectarFamilia(itens.map((i) => i.nome)), [itens]);

  const totalProntos = itens.filter((i) => i.status === 'ok').length;
  const totalProblemas = itens.filter((i) => i.status === 'conflito' || i.status === 'erro').length;

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-line hover:border-ink transition-colors rounded-lg p-8 text-center cursor-pointer"
        onClick={() => document.getElementById('input-lote-fontes')?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          if (e.dataTransfer.files) adicionar(e.dataTransfer.files);
        }}
      >
        <input
          id="input-lote-fontes"
          type="file"
          multiple
          accept=".ttf,.otf,.woff,.woff2"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) adicionar(e.target.files);
            e.target.value = '';
          }}
        />
        <FolderUp className="w-8 h-8 mx-auto mb-2 text-muted" />
        <p className="text-sm font-medium">Solte os arquivos aqui ou clique para selecionar</p>
        <p className="text-xs text-muted mt-1">
          Selecione vários arquivos de uma vez (Ctrl/Cmd + clique). TTF, OTF, WOFF, WOFF2.
        </p>
      </div>

      {familia && itens.length > 1 && (
        <div className="text-xs text-muted bg-blue-50 border border-blue-100 rounded-lg p-2">
          💡 Família detectada: <strong>{familia}</strong>. Cada peso vira uma fonte separada na biblioteca.
        </div>
      )}

      {itens.length > 0 && (
        <>
          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2">
            {itens.map((item) => (
              <ItemLoteRow
                key={item.uid}
                item={item}
                onChange={(patch) => atualizar(item.uid, patch)}
                onRemover={() => remover(item.uid)}
              />
            ))}
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-line">
            <div className="text-xs text-muted">
              {itens.length} {itens.length === 1 ? 'fonte' : 'fontes'}
              {totalProntos > 0 && <span className="text-green-700"> · {totalProntos} salvas</span>}
              {totalProblemas > 0 && <span className="text-amber-700"> · {totalProblemas} com problema</span>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary text-sm">
                {totalProntos > 0 ? 'Fechar' : 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={enviar}
                disabled={salvando || itens.length === 0 || itens.every((i) => i.status === 'ok')}
                className="btn-primary text-sm"
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {salvando ? 'Enviando...' : `Salvar ${itens.filter((i) => i.status !== 'ok').length} fontes`}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ItemLoteRow({
  item, onChange, onRemover,
}: { item: ItemLote; onChange: (patch: Partial<ItemLote>) => void; onRemover: () => void }) {
  const corStatus = {
    pendente: 'border-line',
    enviando: 'border-blue-300',
    ok: 'border-green-300 bg-green-50/50',
    conflito: 'border-amber-300 bg-amber-50/50',
    erro: 'border-red-300 bg-red-50/50',
  }[item.status];

  return (
    <div className={`flex items-center gap-3 p-2 rounded-lg border ${corStatus}`}>
      <input
        type="text"
        className="input py-1 text-sm flex-1"
        value={item.nome}
        onChange={(e) => onChange({ nome: e.target.value })}
        placeholder="Nome da fonte"
        disabled={item.status === 'ok'}
      />
      <span className="text-xl shrink-0 max-w-[140px] truncate" style={{ fontFamily: `"${item.nome}", system-ui` }}>
        Aa Bb 123
      </span>
      <span className="text-xs text-muted truncate max-w-[120px]" title={item.arquivo.name}>
        {item.arquivo.name}
      </span>
      {item.status === 'ok' && <Check className="w-4 h-4 text-green-600 shrink-0" />}
      {item.status === 'conflito' && (
        <span className="text-xs text-amber-700 shrink-0" title={item.erro}>já existe</span>
      )}
      {item.status === 'erro' && (
        <span className="text-xs text-red-700 shrink-0" title={item.erro}>erro</span>
      )}
      <button
        type="button"
        onClick={onRemover}
        className="text-muted hover:text-red-700 shrink-0"
        disabled={item.status === 'ok'}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// =====  Form: upload único =====
function FormUpload({ onClose, onSucesso }: { onClose: () => void; onSucesso: () => void }) {
  const [nome, setNome] = useState('');
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    setArquivo(f);
    if (f && !nome) {
      setNome(nomeAPartirDoArquivo(f.name));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const fd = new FormData();
    fd.append('tipo', 'upload');
    fd.append('nome', nome);
    if (!arquivo) {
      setErro('Selecione um arquivo'); setSalvando(false); return;
    }
    fd.append('arquivo', arquivo);
    const res = await fetch('/api/fontes', { method: 'POST', body: fd });
    if (res.ok) onSucesso();
    else {
      const d = await res.json();
      setErro(d.error || 'Erro');
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Arquivo (TTF, OTF, WOFF ou WOFF2)</label>
        <label className="block border-2 border-dashed border-line rounded-lg p-6 text-center cursor-pointer hover:border-ink transition-colors">
          <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={handleArquivo} className="hidden" />
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted" />
          <span className="text-sm text-muted">{arquivo?.name || 'Clique para selecionar'}</span>
        </label>
      </div>
      <div>
        <label className="label">Nome da fonte</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Nunito Black" required />
        {arquivo && (
          <p className="text-xs text-muted mt-1">
            Sugestão automática a partir do filename. Edite se necessário.
          </p>
        )}
      </div>
      {erro && <p className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
      <div className="flex justify-end gap-3 pt-3 border-t border-line">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={salvando || !nome || !arquivo} className="btn-primary">
          {salvando ? 'Salvando...' : 'Adicionar'}
        </button>
      </div>
    </form>
  );
}

// =====  Form: Google Fonts =====
function FormGoogle({ onClose, onSucesso }: { onClose: () => void; onSucesso: () => void }) {
  const [nome, setNome] = useState('');
  const [pesos, setPesos] = useState('400,700');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!nome.trim()) return;
    const timeout = setTimeout(() => {
      const id = `preview-google-${nome.replace(/\s+/g, '-')}`;
      let link = document.getElementById(id) as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.id = id;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
      }
      const familia = nome.replace(/\s+/g, '+');
      link.href = `https://fonts.googleapis.com/css2?family=${familia}:wght@${pesos.replace(/,/g, ';')}&display=swap`;
    }, 400);
    return () => clearTimeout(timeout);
  }, [nome, pesos]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const fd = new FormData();
    fd.append('tipo', 'google');
    fd.append('nome', nome);
    fd.append('pesos', pesos);
    const res = await fetch('/api/fontes', { method: 'POST', body: fd });
    if (res.ok) onSucesso();
    else {
      const d = await res.json();
      setErro(d.error || 'Erro');
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nome exato da família</label>
        <input className="input" value={nome} onChange={(e) => setNome(e.target.value)}
          placeholder="Ex: Roboto, Bebas Neue, Playfair Display" required />
        <p className="text-xs text-muted mt-1">
          Digite exatamente como em <a href="https://fonts.google.com" target="_blank" rel="noreferrer" className="underline">fonts.google.com</a>.
        </p>
      </div>
      <div>
        <label className="label">Pesos (separados por vírgula)</label>
        <input className="input" value={pesos} onChange={(e) => setPesos(e.target.value)} placeholder="400,700" />
      </div>
      {nome && (
        <div className="p-4 bg-white rounded-lg border border-line">
          <p className="text-xs uppercase tracking-wider text-muted mb-2">Preview</p>
          <p className="text-3xl" style={{ fontFamily: `"${nome}", system-ui` }}>The quick brown fox</p>
        </div>
      )}
      {erro && <p className="text-sm text-red-700 bg-red-50 px-3 py-2 rounded-lg">{erro}</p>}
      <div className="flex justify-end gap-3 pt-3 border-t border-line">
        <button type="button" onClick={onClose} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={salvando || !nome} className="btn-primary">
          {salvando ? 'Salvando...' : 'Adicionar'}
        </button>
      </div>
    </form>
  );
}
