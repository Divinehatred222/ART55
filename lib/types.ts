// lib/types.ts
// Tipos e constantes que podem ser usados tanto no cliente quanto no servidor.
// NUNCA importar nada que dependa de Node (fs, path) aqui.

export type Cliente = {
  id: number;
  nome: string;
  logo_path: string | null;
  whatsapp: string;
  endereco: string;
  cor_primaria: string;
  // Ajustes da logo (aplicados em todos os moldes)
  logo_zoom?: number;
  logo_offset_x?: number;
  logo_offset_y?: number;
  logo_rotacao?: number;
  criado_em: string;
};

export type SlotTipo =
  | 'logo'
  | 'cliente_whatsapp'
  | 'cliente_endereco'
  | 'produto_imagem'
  | 'produto_nome'
  | 'produto_unidade'
  | 'produto_preco'
  | 'texto_livre';

export type EstiloPreco = 'normal' | 'composto';

export type ConfigPrecoComposto = {
  prefixo: string;
  prefixoTamanhoRelativo: number;
  prefixoCor: string;
  prefixoNegrito: boolean;
  divisor: ',' | '.';
  centavosTamanhoRelativo: number;
  centavosSobrescrito: boolean;
  centavosCor: string;
  centavosNegrito: boolean;
  exibirSimboloMoeda: boolean;
  simboloMoeda: string;
  // NOVO: Preço "de" riscado (ex: "de R$ 68,00")
  exibirPrecoDe: boolean;
  precoDeTamanhoRelativo: number;  // 0.15 - 0.4
  precoDeCor: string;
  precoDePrefixo: string;          // "de R$" ou "de" ou ""
  // NOVO: Bolinha amarela com R$ (ícone à esquerda do número)
  exibirBolinhaRS: boolean;
  bolinhaTexto: string;            // "R$"
  bolinhaCorFundo: string;         // amarelo
  bolinhaCorTexto: string;         // vermelho
  bolinhaTamanhoRelativo: number;  // 0.4 - 0.8
};

export const PRECO_COMPOSTO_PADRAO: ConfigPrecoComposto = {
  prefixo: 'por R$',
  prefixoTamanhoRelativo: 0.28,
  prefixoCor: '#dc2626',
  prefixoNegrito: true,
  divisor: ',',
  centavosTamanhoRelativo: 0.5,
  centavosSobrescrito: true,
  centavosCor: '#dc2626',
  centavosNegrito: true,
  exibirSimboloMoeda: false,
  simboloMoeda: 'R$',
  // novos campos com defaults desligados
  exibirPrecoDe: false,
  precoDeTamanhoRelativo: 0.22,
  precoDeCor: '#9ca3af',
  precoDePrefixo: 'de R$',
  exibirBolinhaRS: false,
  bolinhaTexto: 'R$',
  bolinhaCorFundo: '#fcd34d',
  bolinhaCorTexto: '#dc2626',
  bolinhaTamanhoRelativo: 0.55,
};

export type Slot = {
  id: string;
  tipo: SlotTipo;
  indice?: number;
  x: number;
  y: number;
  largura: number;
  altura: number;
  fonte?: string;
  tamanhoFonte?: number;
  cor?: string;
  alinhamento?: 'left' | 'center' | 'right';
  negrito?: boolean;
  italico?: boolean;
  espacamentoLinha?: number;
  textoPadrao?: string;
  modoImagem?: 'contain' | 'cover';
  estiloPreco?: EstiloPreco;
  precoComposto?: ConfigPrecoComposto;
  // Rótulo colorido (ex: "Endereço:" amarelo + endereço branco)
  // Aplicável a slots de texto (cliente_endereco, cliente_whatsapp, produto_unidade, texto_livre)
  exibirRotulo?: boolean;
  rotuloTexto?: string;          // "Endereço:" / "Telefone:" / "Contém:"
  rotuloCor?: string;            // cor diferente do conteúdo
  rotuloTamanhoRelativo?: number; // 0.5-1.5, relativo ao tamanho do conteúdo
  rotuloNegrito?: boolean;
  rotuloPosicao?: 'antes' | 'acima'; // antes = inline; acima = quebra linha
};

export type Molde = {
  id: number;
  nome: string;
  descricao: string | null;
  imagem_path: string;
  largura: number;
  altura: number;
  slots_json: string;
  criado_em: string;
};

export type Fonte = {
  id: number;
  nome: string;
  fonte: 'sistema' | 'google' | 'upload';
  arquivo_path: string | null;
  google_url: string | null;
  pesos: string[];
  criado_em: string;
  aguardando_arquivo?: boolean;
  observacao?: string;
};

export type Produto = {
  id: number;
  nome: string;
  apelidos: string[];
  imagem_path: string | null;
  unidade?: string;  // Ex: "60 cápsulas", "500g", "100ml" — texto livre, opcional
  criado_em: string;
};

export type PrecoCliente = {
  id: number;
  cliente_id: number;
  produto_id: number;
  preco: string;
  atualizado_em: string;
};

// Fontes do sistema (constantes - usadas tanto no client quanto server)
export const FONTES_SISTEMA: Fonte[] = [
  { id: -1, nome: 'Inter Tight', fonte: 'sistema', arquivo_path: null, google_url: null, pesos: ['300', '400', '500', '600', '700'], criado_em: '' },
  { id: -2, nome: 'Instrument Serif', fonte: 'sistema', arquivo_path: null, google_url: null, pesos: ['400'], criado_em: '' },
  { id: -3, nome: 'JetBrains Mono', fonte: 'sistema', arquivo_path: null, google_url: null, pesos: ['400', '500'], criado_em: '' },
  { id: -4, nome: 'Arial', fonte: 'sistema', arquivo_path: null, google_url: null, pesos: ['400', '700'], criado_em: '' },
  { id: -5, nome: 'Helvetica', fonte: 'sistema', arquivo_path: null, google_url: null, pesos: ['400', '700'], criado_em: '' },
  { id: -6, nome: 'Georgia', fonte: 'sistema', arquivo_path: null, google_url: null, pesos: ['400', '700'], criado_em: '' },
  { id: -7, nome: 'Impact', fonte: 'sistema', arquivo_path: null, google_url: null, pesos: ['400'], criado_em: '' },
  {
    id: -10, nome: 'Montserrat', fonte: 'google', arquivo_path: null,
    google_url: 'https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap',
    pesos: ['400', '500', '600', '700', '800'], criado_em: '',
  },
  {
    id: -11, nome: 'Poppins', fonte: 'google', arquivo_path: null,
    google_url: 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap',
    pesos: ['400', '500', '600', '700', '800'], criado_em: '',
  },
  {
    id: -20, nome: 'Gotham Rounded', fonte: 'upload', arquivo_path: null, google_url: null,
    pesos: ['400', '500', '700'], criado_em: '',
    aguardando_arquivo: true,
    observacao: 'Fonte comercial. Faça upload do .ttf/.otf licenciado em /fontes para ativar.',
  },
  {
    id: -21, nome: 'Avenir Next Rounded', fonte: 'upload', arquivo_path: null, google_url: null,
    pesos: ['400', '500', '600', '700'], criado_em: '',
    aguardando_arquivo: true,
    observacao: 'Fonte comercial. Faça upload do .ttf/.otf licenciado em /fontes para ativar.',
  },
];
