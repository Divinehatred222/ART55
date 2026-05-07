// app/moldes/[id]/slot-canvas.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Transformer, Group, Line, Circle } from 'react-konva';
import useImage from 'use-image';
import type { Molde, Slot, SlotTipo } from '@/lib/types';
import { calcularGuides, type Guide } from '@/lib/smart-guides';
import { partirPreco } from '@/lib/preco';

const TIPO_CORES: Record<SlotTipo, string> = {
  logo: '#8b5cf6',
  cliente_whatsapp: '#22c55e',
  cliente_endereco: '#06b6d4',
  produto_imagem: '#0ea5e9',
  produto_nome: '#10b981',
  produto_unidade: '#14b8a6',
  produto_preco: '#f59e0b',
  texto_livre: '#ef4444',
};

const TIPO_LABELS: Record<SlotTipo, string> = {
  logo: 'LOGO',
  cliente_whatsapp: 'WHATSAPP',
  cliente_endereco: 'ENDEREÇO',
  produto_imagem: 'IMG',
  produto_nome: 'NOME',
  produto_unidade: 'UNIDADE',
  produto_preco: 'PREÇO',
  texto_livre: 'TXT',
};

const EXEMPLO = {
  cliente_whatsapp: '(11) 99999-9999',
  cliente_endereco: 'Rua das Flores, 123 — Centro — São Paulo/SP',
  produto_nome: ['Dipirona 500mg', 'Paracetamol 750mg', 'Ibuprofeno 600mg'],
  produto_unidade: ['60 cápsulas', '500g', '100ml'],
  produto_preco: ['R$ 39,99', 'R$ 14,90', 'R$ 19,90'],
};

export default function SlotCanvas({
  molde, slots, selecionadoId, onSelect, onChangeSlot, modoLimpo,
}: {
  molde: Molde;
  slots: Slot[];
  selecionadoId: string | null;
  onSelect: (id: string | null) => void;
  onChangeSlot: (id: string, patch: Partial<Slot>) => void;
  /** modoLimpo = sem retângulos coloridos, mostra como ficaria de verdade */
  modoLimpo: boolean;
}) {
  const [escala, setEscala] = useState(1);
  const [imagem] = useImage(molde.imagem_path, 'anonymous');
  const [guidesAtivas, setGuidesAtivas] = useState<Guide[]>([]);

  useEffect(() => {
    function recalcular() {
      const max = 760;
      setEscala(Math.min(max / molde.largura, max / molde.altura, 1));
    }
    recalcular();
    window.addEventListener('resize', recalcular);
    return () => window.removeEventListener('resize', recalcular);
  }, [molde.largura, molde.altura]);

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden relative">
      <Stage
        width={molde.largura * escala}
        height={molde.altura * escala}
        scaleX={escala}
        scaleY={escala}
        onClick={(e) => {
          if (e.target === e.target.getStage()) onSelect(null);
        }}
      >
        <Layer>
          {imagem && <KonvaImage image={imagem} width={molde.largura} height={molde.altura} listening={false} />}

          {slots.map((slot) => (
            <SlotShape
              key={slot.id}
              slot={slot}
              outrosSlots={slots.filter((s) => s.id !== slot.id)}
              moldeLargura={molde.largura}
              moldeAltura={molde.altura}
              selecionado={slot.id === selecionadoId}
              onSelect={() => onSelect(slot.id)}
              onChange={(patch) => onChangeSlot(slot.id, patch)}
              onMostrarGuides={setGuidesAtivas}
              modoLimpo={modoLimpo}
            />
          ))}

          {/* Smart guides */}
          {guidesAtivas.map((g, i) => (
            <Line
              key={`${g.orientacao}-${g.posicao}-${i}`}
              points={
                g.orientacao === 'vertical'
                  ? [g.posicao, g.inicio, g.posicao, g.fim]
                  : [g.inicio, g.posicao, g.fim, g.posicao]
              }
              stroke="#ff5f1f"
              strokeWidth={1.5}
              dash={[4, 4]}
              listening={false}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

function SlotShape({
  slot, outrosSlots, moldeLargura, moldeAltura,
  selecionado, onSelect, onChange, onMostrarGuides, modoLimpo,
}: {
  slot: Slot;
  outrosSlots: Slot[];
  moldeLargura: number;
  moldeAltura: number;
  selecionado: boolean;
  onSelect: () => void;
  onChange: (patch: Partial<Slot>) => void;
  onMostrarGuides: (g: Guide[]) => void;
  modoLimpo: boolean;
}) {
  const groupRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const cor = TIPO_CORES[slot.tipo];
  const label = slot.indice ? `${TIPO_LABELS[slot.tipo]} #${slot.indice}` : TIPO_LABELS[slot.tipo];

  useEffect(() => {
    if (selecionado && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selecionado]);

  const textoExemplo = (() => {
    if (slot.tipo === 'cliente_whatsapp') return EXEMPLO.cliente_whatsapp;
    if (slot.tipo === 'cliente_endereco') return EXEMPLO.cliente_endereco;
    if (slot.tipo === 'texto_livre') return slot.textoPadrao || 'Texto';
    if (slot.tipo === 'produto_nome') {
      const i = (slot.indice || 1) - 1;
      return EXEMPLO.produto_nome[i % EXEMPLO.produto_nome.length];
    }
    if (slot.tipo === 'produto_unidade') {
      const i = (slot.indice || 1) - 1;
      return EXEMPLO.produto_unidade[i % EXEMPLO.produto_unidade.length];
    }
    if (slot.tipo === 'produto_preco') {
      const i = (slot.indice || 1) - 1;
      return EXEMPLO.produto_preco[i % EXEMPLO.produto_preco.length];
    }
    return '';
  })();

  const ehTexto =
    slot.tipo === 'produto_nome' ||
    slot.tipo === 'produto_unidade' ||
    slot.tipo === 'produto_preco' ||
    slot.tipo === 'texto_livre' ||
    slot.tipo === 'cliente_whatsapp' ||
    slot.tipo === 'cliente_endereco';

  const ehImagem = slot.tipo === 'logo' || slot.tipo === 'produto_imagem';
  const ehPrecoComposto = slot.tipo === 'produto_preco' && slot.estiloPreco === 'composto';

  // Em modo limpo, slot só fica visualmente "selecionado" se está selecionado mesmo
  // Em modo edição, todos têm retângulo colorido
  const mostrarRetangulo = !modoLimpo;
  const mostrarLabel = !modoLimpo;
  const mostrarBordaSelecao = selecionado;

  return (
    <>
      <Group
        ref={groupRef}
        x={slot.x} y={slot.y}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(e) => {
          const novo = { x: e.target.x(), y: e.target.y(), largura: slot.largura, altura: slot.altura };
          const r = calcularGuides(novo, outrosSlots, moldeLargura, moldeAltura);
          if (r.ajusteX !== 0) e.target.x(e.target.x() + r.ajusteX);
          if (r.ajusteY !== 0) e.target.y(e.target.y() + r.ajusteY);
          onMostrarGuides(r.guides);
        }}
        onDragEnd={(e) => {
          onChange({ x: e.target.x(), y: e.target.y() });
          onMostrarGuides([]);
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: node.x(),
            y: node.y(),
            largura: Math.max(20, slot.largura * scaleX),
            altura: Math.max(20, slot.altura * scaleY),
          });
        }}
      >
        {/* Retângulo de fundo do slot - só no modo edição */}
        {mostrarRetangulo && (
          <>
            <Rect
              width={slot.largura} height={slot.altura}
              fill={cor + '25'} stroke={cor}
              strokeWidth={mostrarBordaSelecao ? 4 : 2}
              dash={mostrarBordaSelecao ? undefined : [10, 6]}
              cornerRadius={4}
            />
            {mostrarLabel && (
              <>
                <Rect x={0} y={0} width={Math.min(150, slot.largura)} height={28}
                  fill={cor} cornerRadius={[4, 0, 4, 0]} />
                <Text x={8} y={6} text={label} fontSize={14} fontStyle="bold" fill="white"
                  fontFamily="Inter Tight" listening={false} />
                {ehPrecoComposto && (
                  <Text x={8 + label.length * 8 + 6} y={6} text="• composto" fontSize={11} fill="white" opacity={0.8}
                    fontFamily="Inter Tight" listening={false} />
                )}
              </>
            )}
          </>
        )}

        {/* Borda fina ao redor quando selecionado em modo limpo */}
        {modoLimpo && selecionado && (
          <Rect
            width={slot.largura} height={slot.altura}
            stroke={cor} strokeWidth={2}
            dash={[6, 4]}
            cornerRadius={2}
            listening={false}
          />
        )}

        {/* Conteúdo de texto preview */}
        {ehTexto && !ehPrecoComposto && (
          <RenderTextoComRotulo
            slot={slot}
            texto={textoExemplo}
            opacity={modoLimpo ? 1 : 0.5}
          />
        )}

        {/* Preço composto */}
        {ehPrecoComposto && (
          <PrecoCompostoPreview
            slot={slot}
            texto={textoExemplo}
            opacity={modoLimpo ? 1 : 0.5}
          />
        )}

        {/* Placeholder de imagem */}
        {ehImagem && modoLimpo && (
          <>
            <Rect width={slot.largura} height={slot.altura}
              fill="#f3f4f6" stroke="#d1d5db" strokeWidth={1} dash={[6, 4]} cornerRadius={4} listening={false} />
            <Text x={0} y={slot.altura / 2 - 10} width={slot.largura}
              text={slot.tipo === 'logo' ? '🏷 LOGO' : `📷 PRODUTO ${slot.indice ? '#' + slot.indice : ''}`}
              fontSize={Math.max(14, slot.largura * 0.04)} fill="#9ca3af" align="center" listening={false} />
          </>
        )}
      </Group>

      {selecionado && (
        <Transformer
          ref={transformerRef} rotateEnabled={false}
          anchorSize={10} anchorStroke={cor} anchorFill="white"
          borderStroke={cor} borderStrokeWidth={2}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 20 || newBox.height < 20) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
}

function RenderTextoComRotulo({
  slot, texto, opacity,
}: { slot: Slot; texto: string; opacity: number }) {
  const tamanhoBase = slot.tamanhoFonte || 48;
  const fonte = slot.fonte || 'Inter Tight';
  const corBase = slot.cor || '#000000';
  const align = slot.alinhamento || 'center';
  const fontStyleBase =
    slot.negrito && slot.italico ? 'bold italic' :
    slot.negrito ? 'bold' :
    slot.italico ? 'italic' : 'normal';

  // Sem rótulo: render normal
  if (!slot.exibirRotulo || !slot.rotuloTexto) {
    return (
      <Text
        x={0} y={0}
        width={slot.largura} height={slot.altura}
        text={texto}
        fontSize={tamanhoBase}
        fontFamily={fonte}
        fontStyle={fontStyleBase}
        fill={corBase}
        align={align}
        verticalAlign="middle"
        wrap="word"
        lineHeight={slot.espacamentoLinha || 1.2}
        listening={false}
        opacity={opacity}
      />
    );
  }

  const rotuloTamanho = tamanhoBase * (slot.rotuloTamanhoRelativo || 1);
  const rotuloCor = slot.rotuloCor || '#fcd34d';
  const rotuloFontStyle = slot.rotuloNegrito ? 'bold' : 'normal';
  const posicao = slot.rotuloPosicao || 'antes';

  // Posição "acima": rótulo em uma linha, conteúdo em outra (separados por \n)
  if (posicao === 'acima') {
    return (
      <Group opacity={opacity}>
        <Text
          x={0} y={0}
          width={slot.largura}
          text={slot.rotuloTexto}
          fontSize={rotuloTamanho}
          fontFamily={fonte}
          fontStyle={rotuloFontStyle}
          fill={rotuloCor}
          align={align}
          listening={false}
        />
        <Text
          x={0} y={rotuloTamanho * 1.2}
          width={slot.largura}
          height={slot.altura - rotuloTamanho * 1.2}
          text={texto}
          fontSize={tamanhoBase}
          fontFamily={fonte}
          fontStyle={fontStyleBase}
          fill={corBase}
          align={align}
          wrap="word"
          lineHeight={slot.espacamentoLinha || 1.2}
          listening={false}
        />
      </Group>
    );
  }

  // Posição "antes": rótulo + espaço + conteúdo na mesma linha (ou múltiplas linhas)
  // Com cores diferentes — usamos 2 textos posicionados.
  // Estimativa de largura do rótulo (aproximação pela contagem de caracteres)
  const larguraRotuloEstimada = (slot.rotuloTexto.length + 1) * rotuloTamanho * 0.5;

  return (
    <Group opacity={opacity}>
      <Text
        x={0} y={0}
        width={slot.largura}
        height={slot.altura}
        text={slot.rotuloTexto + ' '}
        fontSize={rotuloTamanho}
        fontFamily={fonte}
        fontStyle={rotuloFontStyle}
        fill={rotuloCor}
        align={align}
        verticalAlign="middle"
        listening={false}
      />
      <Text
        x={larguraRotuloEstimada}
        y={0}
        width={slot.largura - larguraRotuloEstimada}
        height={slot.altura}
        text={texto}
        fontSize={tamanhoBase}
        fontFamily={fonte}
        fontStyle={fontStyleBase}
        fill={corBase}
        align="left"
        verticalAlign="middle"
        wrap="word"
        lineHeight={slot.espacamentoLinha || 1.2}
        listening={false}
      />
    </Group>
  );
}

function PrecoCompostoPreview({
  slot, texto, opacity,
}: { slot: Slot; texto: string; opacity: number }) {
  const config = slot.precoComposto;
  if (!config) return null;

  const { inteiro, centavos, semCentavos } = partirPreco(texto);
  const tamanhoBase = slot.tamanhoFonte || 48;
  const fonte = slot.fonte || 'Inter Tight';
  const corBase = slot.cor || '#000000';
  const fontStyleBase = slot.negrito ? 'bold' : 'normal';

  const tamanhoPrefixo = tamanhoBase * config.prefixoTamanhoRelativo;
  const tamanhoCentavos = tamanhoBase * config.centavosTamanhoRelativo;
  const tamanhoPrecoDe = tamanhoBase * (config.precoDeTamanhoRelativo || 0.22);

  // Y offsets — preço de fica no topo, depois prefixo, depois inteiro
  let yAtual = 0;
  let yPrecoDe = 0;
  let yPrefixo = 0;
  let yInteiro = 0;

  if (config.exibirPrecoDe) {
    yPrecoDe = yAtual;
    yAtual += tamanhoPrecoDe * 1.2;
  }
  if (config.prefixo) {
    yPrefixo = yAtual;
    yAtual += tamanhoPrefixo * 1.1;
  }
  yInteiro = yAtual;

  // Bolinha R$
  const tamanhoBolinha = tamanhoBase * (config.bolinhaTamanhoRelativo || 0.55);
  const raioBolinha = tamanhoBolinha * 0.7;
  const align = slot.alinhamento || 'center';

  // Texto exemplo do "preço de"
  const textoPrecoDe = `${config.precoDePrefixo || ''} 68,00`.trim();

  return (
    <Group opacity={opacity}>
      {/* Preço "de" riscado */}
      {config.exibirPrecoDe && (
        <Group x={0} y={yPrecoDe}>
          <Text
            width={slot.largura}
            text={textoPrecoDe}
            fontSize={tamanhoPrecoDe} fontFamily={fonte}
            fill={config.precoDeCor || '#9ca3af'}
            textDecoration="line-through"
            align={align}
            listening={false}
          />
        </Group>
      )}

      {/* Prefixo */}
      {config.prefixo && (
        <Text
          x={0} y={yPrefixo} width={slot.largura}
          text={config.prefixo}
          fontSize={tamanhoPrefixo} fontFamily={fonte}
          fontStyle={config.prefixoNegrito ? 'bold' : 'normal'}
          fill={config.prefixoCor}
          align={align}
          listening={false}
        />
      )}

      {/* Bolinha R$ + número inteiro + centavos */}
      <Group x={0} y={yInteiro}>
        {/* Bolinha à esquerda do inteiro (estima X com base em alinhamento) */}
        {config.exibirBolinhaRS && (
          <Group
            x={align === 'left' ? raioBolinha + 4 : align === 'right' ? slot.largura - inteiro.length * tamanhoBase * 0.55 - raioBolinha * 2.5 : (slot.largura / 2) - (inteiro.length * tamanhoBase * 0.28) - raioBolinha * 1.6}
            y={tamanhoBase * 0.55}
          >
            <Circle
              radius={raioBolinha}
              fill={config.bolinhaCorFundo || '#fcd34d'}
              listening={false}
            />
            <Text
              x={-raioBolinha}
              y={-tamanhoBolinha * 0.32}
              width={raioBolinha * 2}
              text={config.bolinhaTexto || 'R$'}
              fontSize={tamanhoBolinha * 0.6}
              fontFamily={fonte}
              fontStyle="bold"
              fill={config.bolinhaCorTexto || '#dc2626'}
              align="center"
              listening={false}
            />
          </Group>
        )}

        <Text
          width={slot.largura}
          text={inteiro}
          fontSize={tamanhoBase} fontFamily={fonte}
          fontStyle={fontStyleBase}
          fill={corBase}
          align={align}
          listening={false}
        />
        {!semCentavos && (
          <Text
            x={slot.largura * 0.5 + (inteiro.length * tamanhoBase * 0.28)}
            y={config.centavosSobrescrito ? 0 : (tamanhoBase - tamanhoCentavos) * 0.7}
            text={config.divisor + centavos}
            fontSize={tamanhoCentavos} fontFamily={fonte}
            fontStyle={config.centavosNegrito ? 'bold' : 'normal'}
            fill={config.centavosCor}
            listening={false}
          />
        )}
      </Group>
    </Group>
  );
}
