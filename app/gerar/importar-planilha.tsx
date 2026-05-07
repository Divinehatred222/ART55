// app/gerar/importar-planilha.tsx
'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import type { Cliente, Produto } from '@/lib/types';
import type { ProdutoNaArte } from './gerar-ui';
import {
  ClipboardPaste, Upload, Check, AlertCircle, Loader2, FileText, Save,
  Plus, ChevronDown, ChevronUp, Search, ArrowLeft, ArrowRight,
} from 'lucide-react';

type Fase = 'entrada' | 'mapear' | 'resultado';

type PreviewData = {
  tabela: string[][];
  num_colunas: number;
  sugestao_tem_cabecalho: boolean;
  sugestao_col_nome: number;
  sugestao_col_preco: number;
};

type MatchInfo = {
  produto_id: number;
  produto_nome: string;
  produto_imagem: string | null;
  score: number;
  metodo: 'exato' | 'apelido' | 'substring' | 'tokens' | 'parcial';
};

type ResultadoLinha = {
  indice: number;
  nome_planilha: string;
  preco_planilha: string;
  match: MatchInfo | null;
  alternativos: MatchInfo[];
};

type RespostaImport = {
  cabecalho: string[];
  coluna_nome: number;
  coluna_preco: number;
  resultados: ResultadoLinha[];
};

type TipoColuna = 'ignorar' | 'nome' | 'preco';

export default function ImportarPlanilha({
  cliente, catalogo, produtosSelecionados, onAdicionarProduto, onLimpar,
}: {
  cliente: Cliente | null;
  catalogo: Produto[];
  produtosSelecionados: ProdutoNaArte[];
  onAdicionarProduto: (p: Produto, preco?: string) => void;
  onLimpar: () => void;
}) {
  const [fase, setFase] = useState<Fase>('entrada');
  const [textoColado, setTextoColado] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [resultado, setResultado] = useState<RespostaImport | null>(null);

  const [salvandoPrecos, setSalvandoPrecos] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ETAPA 1: gera preview da tabela
  async function gerarPreview(payload: { texto?: string; linhas?: string[][] }) {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/precos/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const data = await res.json();
        setErro(data.error || 'Erro ao processar');
      } else {
        const data = await res.json();
        setPreview(data);
        setFase('mapear');
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  async function processarTexto(texto: string) {
    if (!texto.trim()) return;
    await gerarPreview({ texto });
  }

  async function processarArquivo(file: File) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'csv' || ext === 'tsv' || ext === 'txt') {
      const texto = await file.text();
      setTextoColado(texto);
      await gerarPreview({ texto });
    } else if (ext === 'xlsx' || ext === 'xls') {
      setCarregando(true);
      try {
        // @ts-ignore
        if (!window.XLSX) {
          await new Promise<void>((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Não foi possível carregar parser de Excel'));
            document.head.appendChild(script);
          });
        }
        // @ts-ignore
        const XLSX = window.XLSX;
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const linhas: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        setCarregando(false);
        await gerarPreview({ linhas: linhas.map((l) => l.map(String)) });
      } catch (e: any) {
        setErro(e.message);
        setCarregando(false);
      }
    } else {
      setErro('Formato não suportado. Use .csv, .xlsx ou cole o conteúdo.');
    }
  }

  // ETAPA 2 → 3: confirma mapeamento e processa matching
  async function confirmarMapeamento(
    tabela: string[][],
    colNome: number,
    colPreco: number,
    linhasIgnoradas: number[],
  ) {
    setCarregando(true);
    setErro(null);
    try {
      const res = await fetch('/api/precos/importar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabela,
          col_nome: colNome,
          col_preco: colPreco,
          linhas_ignoradas: linhasIgnoradas,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErro(data.error || 'Erro ao processar');
      } else {
        const data = await res.json();
        setResultado(data);
        setFase('resultado');
      }
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  function voltarParaEntrada() {
    setFase('entrada');
    setPreview(null);
    setResultado(null);
    setErro(null);
  }

  function voltarParaMapeamento() {
    setFase('mapear');
    setResultado(null);
  }

  function adicionarTodos() {
    if (!resultado) return;
    onLimpar();
    for (const linha of resultado.resultados) {
      if (linha.match) {
        const produto = catalogo.find((p) => p.id === linha.match!.produto_id);
        if (produto) onAdicionarProduto(produto, linha.preco_planilha);
      }
    }
  }

  function adicionarLinha(linha: ResultadoLinha) {
    if (!linha.match) return;
    const produto = catalogo.find((p) => p.id === linha.match!.produto_id);
    if (produto) onAdicionarProduto(produto, linha.preco_planilha);
  }

  function adicionarComMatchAlternativo(linha: ResultadoLinha, alt: MatchInfo) {
    const produto = catalogo.find((p) => p.id === alt.produto_id);
    if (produto) onAdicionarProduto(produto, linha.preco_planilha);
  }

  async function cadastrarProdutoNovo(linha: ResultadoLinha, nomeProduto: string) {
    const fd = new FormData();
    fd.append('nome', nomeProduto);
    fd.append('apelidos', linha.nome_planilha);

    try {
      const res = await fetch('/api/produtos', { method: 'POST', body: fd });
      if (!res.ok) {
        alert('Erro ao cadastrar produto');
        return;
      }
      const data = await res.json();
      const novoProduto: Produto = {
        id: data.id,
        nome: nomeProduto,
        apelidos: [linha.nome_planilha],
        imagem_path: null,
        criado_em: new Date().toISOString(),
      };
      onAdicionarProduto(novoProduto, linha.preco_planilha);
      if (resultado) {
        setResultado({
          ...resultado,
          resultados: resultado.resultados.map((r) =>
            r.indice === linha.indice
              ? {
                  ...r,
                  match: {
                    produto_id: data.id,
                    produto_nome: nomeProduto,
                    produto_imagem: null,
                    score: 100,
                    metodo: 'exato',
                  },
                  alternativos: [],
                }
              : r,
          ),
        });
      }
    } catch (e: any) {
      alert('Erro: ' + e.message);
    }
  }

  async function salvarPrecosNoCliente() {
    if (!cliente || !resultado) return;
    setSalvandoPrecos(true);
    const precos = resultado.resultados
      .filter((l) => l.match && l.preco_planilha)
      .map((l) => ({
        produto_id: l.match!.produto_id,
        preco: l.preco_planilha,
      }));
    try {
      await fetch('/api/precos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cliente_id: cliente.id,
          modo: 'substituir',
          precos,
        }),
      });
      alert(`${precos.length} preços salvos no cliente "${cliente.nome}"`);
    } catch {
      alert('Erro ao salvar preços');
    } finally {
      setSalvandoPrecos(false);
    }
  }

  const totalLinhas = resultado?.resultados.length || 0;
  const totalCasados = resultado?.resultados.filter((r) => r.match).length || 0;
  const totalNaoCasados = totalLinhas - totalCasados;

  return (
    <div className="space-y-3">
      {/* FASE 1: ENTRADA */}
      {fase === 'entrada' && (
        <div className="space-y-2">
          <p className="text-xs text-muted">
            Cole a tabela do Excel/Sheets ou suba um arquivo. Você vai poder ajustar quais colunas usar antes de processar.
          </p>

          <textarea
            className="input min-h-[100px] font-mono text-xs"
            value={textoColado}
            onChange={(e) => setTextoColado(e.target.value)}
            placeholder="Nome do produto&#9;Preço&#10;Dipirona 500&#9;R$ 9,90"
          />

          <div className="flex gap-2">
            <button
              onClick={() => processarTexto(textoColado)}
              disabled={!textoColado.trim() || carregando}
              className="btn-secondary text-xs flex-1"
            >
              <ClipboardPaste className="w-3.5 h-3.5" />
              {carregando ? 'Processando...' : 'Processar texto'}
            </button>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={carregando}
              className="btn-secondary text-xs flex-1"
            >
              <Upload className="w-3.5 h-3.5" /> Subir CSV/XLSX
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.tsv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) processarArquivo(f);
                e.target.value = '';
              }}
            />
          </div>

          {erro && <p className="text-xs text-red-700 bg-red-50 px-2 py-1.5 rounded">{erro}</p>}
        </div>
      )}

      {/* FASE 2: MAPEAR */}
      {fase === 'mapear' && preview && (
        <MapearColunas
          preview={preview}
          onVoltar={voltarParaEntrada}
          onConfirmar={confirmarMapeamento}
          carregando={carregando}
        />
      )}

      {/* FASE 3: RESULTADO */}
      {fase === 'resultado' && resultado && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={voltarParaMapeamento} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
              <ArrowLeft className="w-3 h-3" /> Reajustar mapeamento
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <StatBox label="Linhas" valor={totalLinhas} />
            <StatBox label="Casados" valor={totalCasados} cor="green" />
            <StatBox label="Faltam" valor={totalNaoCasados} cor={totalNaoCasados > 0 ? 'amber' : 'gray'} />
          </div>

          <div className="flex gap-2">
            <button onClick={adicionarTodos} className="btn-primary text-xs flex-1">
              <Check className="w-3.5 h-3.5" /> Adicionar todos casados ({totalCasados})
            </button>
            <button
              onClick={voltarParaEntrada}
              className="btn-secondary text-xs"
            >
              Nova planilha
            </button>
          </div>

          {cliente && totalCasados > 0 && (
            <button
              onClick={salvarPrecosNoCliente}
              disabled={salvandoPrecos}
              className="w-full text-xs py-2 px-3 border border-line rounded-lg hover:border-ink transition-colors flex items-center justify-center gap-2"
            >
              {salvandoPrecos ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salvar tabela de preços em "{cliente.nome}"
            </button>
          )}

          <div className="space-y-1 max-h-[60vh] overflow-y-auto border border-line rounded-lg p-2">
            {resultado.resultados.map((linha) => (
              <LinhaResultado
                key={linha.indice}
                linha={linha}
                catalogo={catalogo}
                jaSelecionado={produtosSelecionados.some(
                  (p) => p.catalogo_id === linha.match?.produto_id,
                )}
                onAdicionar={() => adicionarLinha(linha)}
                onAdicionarManual={(produto) => onAdicionarProduto(produto, linha.preco_planilha)}
                onAdicionarAlternativo={(alt) => adicionarComMatchAlternativo(linha, alt)}
                onCadastrarNovo={(nome) => cadastrarProdutoNovo(linha, nome)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================
// FASE 2: Mapear colunas
// =============================================================

function MapearColunas({
  preview, onVoltar, onConfirmar, carregando,
}: {
  preview: PreviewData;
  onVoltar: () => void;
  onConfirmar: (tabela: string[][], colNome: number, colPreco: number, linhasIgnoradas: number[]) => void;
  carregando: boolean;
}) {
  const [temCabecalho, setTemCabecalho] = useState(preview.sugestao_tem_cabecalho);
  const [tiposColunas, setTiposColunas] = useState<TipoColuna[]>(() => {
    const tipos: TipoColuna[] = Array(preview.num_colunas).fill('ignorar');
    tipos[preview.sugestao_col_nome] = 'nome';
    if (preview.sugestao_col_preco !== preview.sugestao_col_nome) {
      tipos[preview.sugestao_col_preco] = 'preco';
    }
    return tipos;
  });

  // Linhas ignoradas (Set de índices na tabela completa, incluindo cabeçalho se houver)
  const [linhasIgnoradas, setLinhasIgnoradas] = useState<Set<number>>(new Set());

  // Preview: primeiras 12 linhas (incluindo cabeçalho)
  const linhasPreview = useMemo(() => {
    const ate = Math.min(preview.tabela.length, 15);
    return preview.tabela.slice(0, ate).map((linha, idx) => ({
      idx,
      cells: linha,
      ehCabecalho: temCabecalho && idx === 0,
    }));
  }, [preview.tabela, temCabecalho]);

  const colNome = tiposColunas.findIndex((t) => t === 'nome');
  const colPreco = tiposColunas.findIndex((t) => t === 'preco');
  const podeProsseguir = colNome >= 0 && colPreco >= 0;

  function setTipoColuna(c: number, tipo: TipoColuna) {
    setTiposColunas((curr) => {
      const novo = [...curr];
      // Se já tem essa coluna em outro lugar, remove
      if (tipo !== 'ignorar') {
        for (let i = 0; i < novo.length; i++) {
          if (novo[i] === tipo && i !== c) novo[i] = 'ignorar';
        }
      }
      novo[c] = tipo;
      return novo;
    });
  }

  function toggleLinha(idx: number) {
    setLinhasIgnoradas((curr) => {
      const novo = new Set(curr);
      if (novo.has(idx)) novo.delete(idx);
      else novo.add(idx);
      return novo;
    });
  }

  function confirmar() {
    // Tabela final: ignora a primeira linha se for cabeçalho
    let tabelaParaProcessar = preview.tabela;
    let ignoradasFinal: number[] = [];

    if (temCabecalho) {
      // Cabeçalho não vai pro corpo, e os índices de ignoradas precisam ser deslocados
      tabelaParaProcessar = preview.tabela.slice(1);
      ignoradasFinal = Array.from(linhasIgnoradas)
        .filter((i) => i > 0) // ignora a 0 (cabeçalho)
        .map((i) => i - 1); // desloca
    } else {
      ignoradasFinal = Array.from(linhasIgnoradas);
    }

    onConfirmar(tabelaParaProcessar, colNome, colPreco, ignoradasFinal);
  }

  const totalLinhas = temCabecalho ? preview.tabela.length - 1 : preview.tabela.length;
  const totalIgnoradas = Array.from(linhasIgnoradas).filter((i) => !temCabecalho || i > 0).length;
  const totalProcessar = totalLinhas - totalIgnoradas;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={onVoltar} className="text-xs text-muted hover:text-ink inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" /> Voltar
        </button>
        <p className="text-xs font-medium">Mapear colunas e linhas</p>
      </div>

      <p className="text-xs text-muted">
        Marque a coluna do <strong>nome</strong> e do <strong>preço</strong>. Ignore colunas extras.
        Desmarque linhas que não devem ser processadas (subtotais, separadores, etc.).
      </p>

      {/* Toggle cabeçalho */}
      <label className="flex items-center gap-2 text-xs p-2 bg-line/30 rounded">
        <input
          type="checkbox"
          checked={temCabecalho}
          onChange={(e) => setTemCabecalho(e.target.checked)}
        />
        <span>A primeira linha é cabeçalho (nome das colunas, ignora no processamento)</span>
      </label>

      {/* Tabela com dropdowns */}
      <div className="border border-line rounded-lg overflow-x-auto bg-white">
        <table className="text-xs w-full">
          <thead className="bg-line/30">
            {/* Linha de tipo da coluna (dropdowns) */}
            <tr>
              <th className="p-1 w-8 text-center font-normal text-muted">✓</th>
              {tiposColunas.map((tipo, c) => (
                <th key={c} className="p-1 min-w-[120px]">
                  <select
                    value={tipo}
                    onChange={(e) => setTipoColuna(c, e.target.value as TipoColuna)}
                    className={`w-full text-[10px] px-1.5 py-1 rounded border font-medium ${
                      tipo === 'nome' ? 'bg-blue-50 border-blue-300 text-blue-700' :
                      tipo === 'preco' ? 'bg-green-50 border-green-300 text-green-700' :
                      'bg-line/30 border-line text-muted'
                    }`}
                  >
                    <option value="ignorar">— ignorar —</option>
                    <option value="nome">📦 NOME</option>
                    <option value="preco">💰 PREÇO</option>
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhasPreview.map(({ idx, cells, ehCabecalho }) => {
              const ignorada = linhasIgnoradas.has(idx) || ehCabecalho;
              return (
                <tr
                  key={idx}
                  className={`border-t border-line ${
                    ehCabecalho ? 'bg-line/40 italic text-muted' :
                    ignorada ? 'bg-red-50/30 line-through opacity-50' :
                    'hover:bg-line/10'
                  }`}
                >
                  <td className="p-1 text-center">
                    {ehCabecalho ? (
                      <span className="text-[9px] text-muted">cab.</span>
                    ) : (
                      <input
                        type="checkbox"
                        checked={!ignorada}
                        onChange={() => toggleLinha(idx)}
                        className="cursor-pointer"
                      />
                    )}
                  </td>
                  {cells.map((cell, c) => (
                    <td
                      key={c}
                      className={`p-1.5 truncate max-w-[200px] ${
                        tiposColunas[c] === 'nome' ? 'bg-blue-50/30' :
                        tiposColunas[c] === 'preco' ? 'bg-green-50/30 font-mono' :
                        ''
                      }`}
                      title={cell}
                    >
                      {cell || <span className="text-muted">—</span>}
                    </td>
                  ))}
                </tr>
              );
            })}
            {preview.tabela.length > 15 && (
              <tr>
                <td colSpan={tiposColunas.length + 1} className="p-2 text-center text-[10px] text-muted bg-line/10">
                  + {preview.tabela.length - 15} linhas adicionais (não mostradas no preview, mas serão processadas)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Resumo + botão confirmar */}
      <div className="flex items-center justify-between p-2 bg-line/20 rounded text-xs">
        <span className="text-muted">
          {totalProcessar} de {totalLinhas} linhas serão processadas
          {totalIgnoradas > 0 && ` (${totalIgnoradas} ignoradas)`}
        </span>
        <button
          onClick={confirmar}
          disabled={!podeProsseguir || carregando}
          className="btn-primary text-xs"
        >
          {carregando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowRight className="w-3.5 h-3.5" />}
          {carregando ? 'Processando...' : 'Processar matching'}
        </button>
      </div>

      {!podeProsseguir && (
        <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1.5 rounded">
          Você precisa marcar pelo menos UMA coluna como NOME e UMA como PREÇO.
        </p>
      )}
    </div>
  );
}

// =============================================================
// Componentes auxiliares (LinhaResultado, StatBox)
// =============================================================

function StatBox({ label, valor, cor }: { label: string; valor: number; cor?: 'green' | 'amber' | 'gray' }) {
  const cores = {
    green: 'bg-green-50 text-green-700 border-green-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    gray: 'bg-line/30 text-muted border-line',
  };
  return (
    <div className={`px-2 py-1.5 rounded-lg border text-center ${cores[cor || 'gray']}`}>
      <div className="text-lg font-display leading-none">{valor}</div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function LinhaResultado({
  linha, catalogo, jaSelecionado,
  onAdicionar, onAdicionarManual, onAdicionarAlternativo, onCadastrarNovo,
}: {
  linha: ResultadoLinha;
  catalogo: Produto[];
  jaSelecionado: boolean;
  onAdicionar: () => void;
  onAdicionarManual: (p: Produto) => void;
  onAdicionarAlternativo: (alt: MatchInfo) => void;
  onCadastrarNovo: (nome: string) => void;
}) {
  const matchOk = !!linha.match;
  const [mostrarAlternativos, setMostrarAlternativos] = useState(false);
  const [buscandoManual, setBuscandoManual] = useState(false);
  const [busca, setBusca] = useState(linha.nome_planilha);
  const [cadastrandoNovo, setCadastrandoNovo] = useState(false);
  const [nomeNovo, setNomeNovo] = useState('');

  const sugestoes = useMemo(() => {
    if (!buscandoManual || !busca.trim()) return [];
    const q = busca.toLowerCase();
    return catalogo
      .filter((p) =>
        p.nome.toLowerCase().includes(q) ||
        p.apelidos.some((a) => a.toLowerCase().includes(q)),
      )
      .slice(0, 8);
  }, [buscandoManual, busca, catalogo]);

  const temAlternativos = linha.alternativos.length > 0;
  const corMatch = linha.match
    ? linha.match.score >= 80 ? 'green'
    : linha.match.score >= 60 ? 'blue'
    : 'amber'
    : 'amber';

  return (
    <div className={`rounded text-xs ${
      jaSelecionado ? 'bg-green-50/50' :
      matchOk && (linha.match!.score >= 80) ? 'hover:bg-line/30' :
      matchOk ? 'bg-blue-50/30' :
      'bg-amber-50/30'
    }`}>
      <div className="flex items-center gap-2 p-1.5">
        <span className="w-8 h-8 rounded shrink-0 bg-white border border-line grid place-items-center overflow-hidden">
          {linha.match?.produto_imagem ? (
            <img src={linha.match.produto_imagem} className="w-full h-full object-contain p-0.5" alt="" />
          ) : (
            <AlertCircle className="w-3 h-3 text-amber-600" />
          )}
        </span>
        <div className="flex-1 min-w-0">
          <div className="truncate font-medium" title={linha.nome_planilha}>{linha.nome_planilha}</div>
          {matchOk ? (
            <div className="text-[10px] text-muted truncate flex items-center gap-1.5">
              <span className={`px-1 rounded text-[9px] ${
                corMatch === 'green' ? 'bg-green-100 text-green-700' :
                corMatch === 'blue' ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {linha.match!.score}%
              </span>
              → {linha.match!.produto_nome}
              {temAlternativos && (
                <button
                  onClick={() => setMostrarAlternativos(!mostrarAlternativos)}
                  className="text-[9px] text-accent hover:underline ml-1 flex items-center gap-0.5"
                >
                  {mostrarAlternativos ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                  outras opções ({linha.alternativos.length})
                </button>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-amber-700">não encontrado no catálogo</div>
          )}
        </div>
        <span className="text-xs font-mono text-accent shrink-0">{linha.preco_planilha}</span>
        {matchOk ? (
          <button
            onClick={onAdicionar}
            disabled={jaSelecionado}
            className={`text-xs px-2 py-1 rounded shrink-0 ${
              jaSelecionado ? 'bg-green-100 text-green-700' : 'bg-ink text-paper hover:bg-ink-soft'
            }`}
          >
            {jaSelecionado ? '✓' : '+'}
          </button>
        ) : (
          <div className="flex gap-1">
            <button
              onClick={() => { setBuscandoManual(!buscandoManual); setCadastrandoNovo(false); }}
              className="text-xs px-1.5 py-1 rounded shrink-0 bg-amber-100 text-amber-700 hover:bg-amber-200"
              title="Buscar manualmente no catálogo"
            >
              <Search className="w-3 h-3" />
            </button>
            <button
              onClick={() => {
                setCadastrandoNovo(!cadastrandoNovo);
                setBuscandoManual(false);
                if (!cadastrandoNovo) setNomeNovo(linha.nome_planilha);
              }}
              className="text-xs px-1.5 py-1 rounded shrink-0 bg-accent/10 text-accent hover:bg-accent/20"
              title="Cadastrar novo produto no catálogo"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {mostrarAlternativos && linha.alternativos.length > 0 && (
        <div className="px-1.5 pb-2 space-y-1">
          <p className="text-[10px] text-muted px-1">Outras opções encontradas:</p>
          {linha.alternativos.map((alt) => (
            <button
              key={alt.produto_id}
              onClick={() => onAdicionarAlternativo(alt)}
              className="w-full flex items-center gap-2 p-1.5 hover:bg-white/80 rounded text-left border border-line bg-white/50"
            >
              <span className="w-6 h-6 rounded shrink-0 bg-white border border-line grid place-items-center overflow-hidden">
                {alt.produto_imagem ? (
                  <img src={alt.produto_imagem} className="w-full h-full object-contain p-0.5" alt="" />
                ) : (
                  <AlertCircle className="w-2 h-2 text-muted" />
                )}
              </span>
              <span className="flex-1 truncate text-[11px]">{alt.produto_nome}</span>
              <span className={`text-[9px] px-1 rounded ${
                alt.score >= 80 ? 'bg-green-100 text-green-700' :
                alt.score >= 60 ? 'bg-blue-100 text-blue-700' :
                'bg-amber-100 text-amber-700'
              }`}>
                {alt.score}%
              </span>
              <Plus className="w-3 h-3 text-accent shrink-0" />
            </button>
          ))}
        </div>
      )}

      {cadastrandoNovo && (
        <div className="px-1.5 pb-2 space-y-1.5 bg-accent/5 -mx-0.5 mt-1 pt-2 px-2 rounded">
          <p className="text-[10px] text-muted">
            Cadastrar como produto novo. A imagem você adiciona depois em <strong>/produtos</strong>.
          </p>
          <input
            type="text"
            className="input py-1 text-xs"
            placeholder="Nome canônico do produto"
            value={nomeNovo}
            onChange={(e) => setNomeNovo(e.target.value)}
            autoFocus
          />
          <div className="flex gap-1.5">
            <button
              onClick={() => {
                if (nomeNovo.trim()) {
                  onCadastrarNovo(nomeNovo.trim());
                  setCadastrandoNovo(false);
                }
              }}
              className="btn-primary text-xs flex-1"
              disabled={!nomeNovo.trim()}
            >
              <Plus className="w-3 h-3" /> Cadastrar e adicionar
            </button>
            <button
              onClick={() => setCadastrandoNovo(false)}
              className="btn-secondary text-xs"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {buscandoManual && (
        <div className="px-1.5 pb-2 space-y-1.5">
          <input
            type="text"
            className="input py-1 text-xs"
            placeholder="Buscar no catálogo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            autoFocus
          />
          {sugestoes.length === 0 && (
            <p className="text-[10px] text-muted px-1">
              Nenhum produto encontrado no catálogo.
            </p>
          )}
          {sugestoes.length > 0 && (
            <div className="space-y-0.5 max-h-40 overflow-y-auto">
              {sugestoes.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    onAdicionarManual(p);
                    setBuscandoManual(false);
                  }}
                  className="w-full flex items-center gap-2 p-1 hover:bg-line/40 rounded text-left"
                >
                  <span className="w-7 h-7 rounded shrink-0 bg-white border border-line grid place-items-center overflow-hidden">
                    {p.imagem_path ? (
                      <img src={p.imagem_path} className="w-full h-full object-contain p-0.5" alt="" />
                    ) : (
                      <AlertCircle className="w-2.5 h-2.5 text-muted" />
                    )}
                  </span>
                  <span className="flex-1 truncate text-xs">{p.nome}</span>
                  <span className="text-[10px] text-accent">+</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
