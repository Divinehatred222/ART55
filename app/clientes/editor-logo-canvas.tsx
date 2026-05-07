// app/clientes/editor-logo-canvas.tsx
'use client';

import { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Image as KonvaImage, Group, Transformer, Rect } from 'react-konva';
import useImage from 'use-image';

// Slot virtual de referência (proporção quadrada, simula um slot de logo no molde)
const SLOT_W = 400;
const SLOT_H = 400;

type Props = {
  src: string;
  zoom: number;
  offsetX: number;
  offsetY: number;
  rotacao: number;
  onChange: (patch: Partial<{
    zoom: number; offsetX: number; offsetY: number; rotacao: number
  }>) => void;
};

export default function EditorLogoCanvas({
  src, zoom, offsetX, offsetY, rotacao, onChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const groupRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const [escala, setEscala] = useState(1);
  const [img] = useImage(src, 'anonymous');

  useEffect(() => {
    function recalcular() {
      if (!containerRef.current) return;
      const w = containerRef.current.offsetWidth;
      setEscala(Math.min(w / SLOT_W, 1));
    }
    recalcular();
    const obs = new ResizeObserver(recalcular);
    if (containerRef.current) obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (transformerRef.current && groupRef.current) {
      transformerRef.current.nodes([groupRef.current]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [img]);

  if (!img) {
    return (
      <div ref={containerRef} className="bg-white rounded-lg border border-line p-4 text-center text-xs text-muted">
        Carregando imagem...
      </div>
    );
  }

  // Calcula tamanho base "contain" no slot
  const slotAspecto = SLOT_W / SLOT_H;
  const imgAspecto = img.width / img.height;
  let baseW: number, baseH: number;
  if (imgAspecto > slotAspecto) {
    baseW = SLOT_W;
    baseH = SLOT_W / imgAspecto;
  } else {
    baseH = SLOT_H;
    baseW = SLOT_H * imgAspecto;
  }

  const drawW = baseW * zoom;
  const drawH = baseH * zoom;
  const centroX = SLOT_W / 2 + offsetX;
  const centroY = SLOT_H / 2 + offsetY;

  return (
    <div ref={containerRef} className="bg-white rounded-lg border border-line overflow-hidden">
      <Stage
        width={SLOT_W * escala}
        height={SLOT_H * escala}
        scaleX={escala}
        scaleY={escala}
      >
        <Layer>
          {/* Fundo xadrez pra mostrar transparência */}
          <Rect x={0} y={0} width={SLOT_W} height={SLOT_H} fill="#ffffff" />
          {/* Indicação visual do "slot" do molde */}
          <Rect
            x={2}
            y={2}
            width={SLOT_W - 4}
            height={SLOT_H - 4}
            stroke="#d1d5db"
            strokeWidth={1}
            dash={[8, 4]}
            listening={false}
          />

          <Group
            ref={groupRef}
            x={centroX}
            y={centroY}
            rotation={rotacao}
            offsetX={drawW / 2}
            offsetY={drawH / 2}
            draggable
            onDragEnd={(e) => {
              const novoX = e.target.x();
              const novoY = e.target.y();
              onChange({
                offsetX: novoX - SLOT_W / 2,
                offsetY: novoY - SLOT_H / 2,
              });
            }}
            onTransformEnd={() => {
              const node = groupRef.current;
              const scaleX = node.scaleX();
              const scaleY = node.scaleY();
              const novoZoom = zoom * Math.max(scaleX, scaleY);
              const novaRotacao = node.rotation();
              const novoX = node.x();
              const novoY = node.y();
              const novoOffsetX = novoX - SLOT_W / 2;
              const novoOffsetY = novoY - SLOT_H / 2;
              node.scaleX(1);
              node.scaleY(1);
              onChange({
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
        </Layer>
      </Stage>
    </div>
  );
}
