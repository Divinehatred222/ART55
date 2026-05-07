// app/gerar/render-canvas.tsx
'use client';

import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Text, Group, Transformer, Circle } from 'react-konva';
import useImage from 'use-image';
import type { Cliente, Molde, Slot } from '@/lib/types';
import type { ProdutoNaArte } from './gerar-ui';
import { partirPreco } from '@/lib/preco';
import { Download, Loader2 } from 'lucide-react';

type Props = {
  molde: Molde;
  slots: Slot[];
  cliente: Cliente | null;
  produtos: ProdutoNaArte[];
  textosLivres: Record<string, string>;
  /** Índice do produto em modo edição (1-based). null = nenhum em edição */
  produtoEmEdicao?: number | null;
  /** Callback chamado quando a posição/tamanho muda (durante edição) */
  onProdutoEditado?: (indice: number, patch: Partial<ProdutoNaArte>) => void;
};

export default function RenderCanvas({
  molde, slots, cliente, produtos, textosLivres, produtoEmEdicao, onProdutoEditado,
}: Props) {
  const stageRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(1);
  const [exportando, setExportando] = useState(false);
  const [imagemMolde] = useImage(molde.imagem_path, 'anonymous');

  useEffect(() => {
    function recalcular() {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      setEscala(Math.min(w / molde.largura, 1));
    }
    recalcular();
    window.addEventListener('resize', recalcular);
    return () => window.removeEventListener('resize', recalcular);
  }, [molde.largura]);

  async function exportar() {
    if (!stageRef.current) return;
    setExportando(true);
    try {
      const dataUrl = stageRef.current.toDataURL({
        pixelRatio: 1 / escala,
        mimeType: 'image/jpeg',
        quality: 0.95,
      });
      const link = document.createElement('a');
      const filename = `${molde.nome.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${Date.now()}.jpg`;
      link.download = filename;
      link.href = dataUrl;
      link.click();

      try {
        await fetch('/api/geracoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            molde_id: molde.id,
            cliente_id: cliente?.id || null,
            config: { produtos: produtos.map((p) => ({ nome: p.nome, preco: p.preco })) },
          }),
        });
      } catch {}
    } finally {
      setExportando(false);
    }
  }

  return (
    <div ref={containerRef}>
      <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-4 border border-line relative">
        {produtoEmEdicao && (
          <div className="absolute top-3 right-3 z-10 bg-accent text-white text-xs px-3 py-1.5 rounded-full font-medium shadow-md flex items-center gap-1.5">
            ✏️ Editando produto #{produtoEmEdicao}
          </div>
        )}
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
              <RenderSlot
                key={slot.id + (produtoEmEdicao === slot.indice ? '-edit' : '')}
                slot={slot}
                cliente={cliente}
                produtos={produtos}
                textosLivres={textosLivres}
                emEdicao={
                  slot.tipo === 'produto_imagem' && slot.indice === produtoEmEdicao
                }
                onProdutoEditado={onProdutoEditado}
              />
            ))}
          </Layer>
        </Stage>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="text-xs text-muted">
          {molde.largura} × {molde.altura} px · alta resolução
          {produtoEmEdicao && (
            <span className="ml-2 text-accent">
              · Arraste o produto pra mover, alças pra redimensionar
            </span>
          )}
        </div>
        <button onClick={exportar} disabled={exportando || !imagemMolde} className="btn-accent text-base px-6 py-3">
          {exportando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exportando ? 'Exportando...' : 'Baixar JPG'}
        </button>
      </div>
    </div>
  );
}

function RenderSlot({
  slot, cliente, produtos, textosLivres, emEdicao, onProdutoEditado,
}: {
  slot: Slot;
  cliente: Cliente | null;
  produtos: ProdutoNaArte[];
  textosLivres: Record<string, string>;
  emEdicao?: boolean;
  onProdutoEditado?: (indice: number, patch: Partial<ProdutoNaArte>) => void;
}) {
  if (slot.tipo === 'logo') {
    return cliente?.logo_path ? (
      <RenderImagem
        slot={slot}
        src={cliente.logo_path}
        zoom={cliente.logo_zoom}
        offsetX={cliente.logo_offset_x}
        offsetY={cliente.logo_offset_y}
        rotacao={cliente.logo_rotacao}
      />
    ) : null;
  }
  if (slot.tipo === 'cliente_whatsapp') {
    return cliente?.whatsapp ? <RenderTexto slot={slot} texto={cliente.whatsapp} /> : null;
  }
  if (slot.tipo === 'cliente_endereco') {
    return cliente?.endereco ? <RenderTexto slot={slot} texto={cliente.endereco} /> : null;
  }
  if (slot.tipo === 'produto_imagem') {
    const indice = slot.indice || 1;
    const produto = produtos[indice - 1];
    if (!produto?.imagemUrl) return null;
    return (
      <RenderImagem
        slot={slot}
        src={produto.imagemUrl}
        zoom={produto.zoom}
        offsetX={produto.offsetX}
        offsetY={produto.offsetY}
        rotacao={produto.rotacao}
        emEdicao={emEdicao}
        onMudar={(patch) => onProdutoEditado?.(indice, patch)}
      />
    );
  }
  if (slot.tipo === 'produto_nome') {
    const produto = produtos[(slot.indice || 1) - 1];
    return produto?.nome ? <RenderTexto slot={slot} texto={produto.nome} /> : null;
  }
  if (slot.tipo === 'produto_unidade') {
    const produto = produtos[(slot.indice || 1) - 1];
    return produto?.unidade ? <RenderTexto slot={slot} texto={produto.unidade} /> : null;
  }
  if (slot.tipo === 'produto_preco') {
    const produto = produtos[(slot.indice || 1) - 1];
    return produto?.preco ? <RenderPreco slot={slot} texto={produto.preco} precoDe={produto.precoDe} /> : null;
  }
  if (slot.tipo === 'texto_livre') {
    const txt = textosLivres[slot.id] ?? slot.textoPadrao ?? '';
    return txt ? <RenderTexto slot={slot} texto={txt} /> : null;
  }
  return null;
}

function RenderImagem({
  slot, src, zoom = 1, offsetX = 0, offsetY = 0, rotacao = 0, emEdicao, onMudar,
}: {
  slot: Slot; src: string;
  zoom?: number; offsetX?: number; offsetY?: number; rotacao?: number;
  emEdicao?: boolean;
  onMudar?: (patch: { zoom?: number; offsetX?: number; offsetY?: number; rotacao?: number }) => void;
}) {
  const [img] = useImage(src, 'anonymous');
  const groupRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);

  useEffect(() => {
    if (emEdicao && transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [emEdicao, img]);

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
  // Centro do slot — vamos posicionar a imagem pelo centro pra rotação ficar correta
  const centroX = slot.x + slot.largura / 2 + offsetX;
  const centroY = slot.y + slot.altura / 2 + offsetY;

  // Modo edição
  if (emEdicao) {
    return (
      <>
        <Group
          ref={groupRef}
          x={centroX}
          y={centroY}
          rotation={rotacao}
          // offsetX/Y do Konva define o ponto de pivô — usamos centro da imagem
          offsetX={drawW / 2}
          offsetY={drawH / 2}
          draggable
          onDragEnd={(e) => {
            const novoX = e.target.x();
            const novoY = e.target.y();
            const novoOffsetX = novoX - slot.x - slot.largura / 2;
            const novoOffsetY = novoY - slot.y - slot.altura / 2;
            onMudar?.({ offsetX: novoOffsetX, offsetY: novoOffsetY });
          }}
          onTransformEnd={() => {
            const node = groupRef.current;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            const novoZoom = zoom * Math.max(scaleX, scaleY);
            const novaRotacao = node.rotation();
            const novoX = node.x();
            const novoY = node.y();
            const novoOffsetX = novoX - slot.x - slot.largura / 2;
            const novoOffsetY = novoY - slot.y - slot.altura / 2;
            // Reset scale (rotation persiste no estado)
            node.scaleX(1);
            node.scaleY(1);
            onMudar?.({
              zoom: novoZoom,
              offsetX: novoOffsetX,
              offsetY: novoOffsetY,
              rotacao: novaRotacao,
            });
          }}
        >
          <KonvaImage image={img} width={drawW} height={drawH} />
        </Group>
        <Transformer
          ref={transformerRef}
          rotateEnabled={true}
          rotationSnaps={[0, 45, 90, 135, 180, 225, 270, 315]}
          rotationSnapTolerance={5}
          keepRatio={true}
          anchorSize={12}
          anchorStroke="#ff5f1f"
          anchorFill="white"
          anchorStrokeWidth={2}
          borderStroke="#ff5f1f"
          borderStrokeWidth={2}
          borderDash={[4, 4]}
          enabledAnchors={['top-left', 'top-right', 'bottom-left', 'bottom-right']}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 30 || newBox.height < 30) return oldBox;
            return newBox;
          }}
        />
      </>
    );
  }

  // Modo normal (sem edição) — mas pode ter rotação aplicada
  if (rotacao !== 0) {
    // Com rotação, sempre usa Group com pivô no centro
    return (
      <Group
        x={centroX}
        y={centroY}
        rotation={rotacao}
        offsetX={drawW / 2}
        offsetY={drawH / 2}
      >
        <KonvaImage image={img} width={drawW} height={drawH} />
      </Group>
    );
  }

  // Sem rotação - posicionamento direto
  const drawX = centroX - drawW / 2;
  const drawY = centroY - drawH / 2;

  if (modo === 'cover' || zoom > 1) {
    return (
      <Group clipFunc={(ctx) => { ctx.rect(slot.x, slot.y, slot.largura, slot.altura); }}>
        <KonvaImage image={img} x={drawX} y={drawY} width={drawW} height={drawH} />
      </Group>
    );
  }
  return <KonvaImage image={img} x={drawX} y={drawY} width={drawW} height={drawH} />;
}

function RenderTexto({ slot, texto }: { slot: Slot; texto: string }) {
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

  // Posição "acima"
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

  // Posição "antes" (inline)
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

function RenderPreco({ slot, texto, precoDe }: { slot: Slot; texto: string; precoDe?: string }) {
  if (slot.estiloPreco !== 'composto' || !slot.precoComposto) {
    return <RenderTexto slot={slot} texto={texto} />;
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

  // Y offsets
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
      {/* Preço "de" riscado */}
      {config.exibirPrecoDe && (
        <Text x={slot.x} y={yPrecoDe} width={slot.largura}
          text={textoPrecoDe}
          fontSize={tamanhoPrecoDe} fontFamily={fonte}
          fill={config.precoDeCor || '#9ca3af'}
          textDecoration="line-through"
          align={align}
        />
      )}

      {/* Prefixo */}
      {config.prefixo && (
        <Text x={slot.x} y={yPrefixo} width={slot.largura}
          text={config.prefixo}
          fontSize={tamanhoPrefixo} fontFamily={fonte}
          fontStyle={config.prefixoNegrito ? 'bold' : 'normal'}
          fill={config.prefixoCor}
          align={align} />
      )}

      {/* Bolinha R$ */}
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

      {/* Inteiro */}
      <Text x={slot.x} y={yInteiro} width={slot.largura}
        text={inteiro}
        fontSize={tamanhoBase} fontFamily={fonte}
        fontStyle={fontStyleBase}
        fill={corBase}
        align={align} />

      {/* Centavos */}
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
