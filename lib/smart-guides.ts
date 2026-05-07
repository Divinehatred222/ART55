// lib/smart-guides.ts
// Detecta linhas-guia de alinhamento entre slots

import type { Slot } from './db';

export type Guide = {
  // Linha vertical em x, ou horizontal em y
  orientacao: 'vertical' | 'horizontal';
  posicao: number;
  // Pra desenho: começa/termina em algum ponto pra mostrar contexto
  inicio: number;
  fim: number;
  // Tipo: borda esquerda/direita, top/bottom, centro vertical/horizontal
  tipo: string;
};

const SNAP_DIST = 8; // pixels de tolerância para "encaixar"

export type ResultadoGuides = {
  // Slot ajustado pra encaixar nas guias detectadas
  ajusteX: number;
  ajusteY: number;
  guides: Guide[];
};

// Calcula bounds (esquerda, direita, top, bottom, centroX, centroY) de um slot
function bounds(slot: { x: number; y: number; largura: number; altura: number }) {
  return {
    esquerda: slot.x,
    direita: slot.x + slot.largura,
    top: slot.y,
    bottom: slot.y + slot.altura,
    centroX: slot.x + slot.largura / 2,
    centroY: slot.y + slot.altura / 2,
  };
}

export function calcularGuides(
  arrastando: { x: number; y: number; largura: number; altura: number },
  outros: Slot[],
  // bounds do molde para guias do canvas (centro do molde)
  moldeLargura: number,
  moldeAltura: number,
): ResultadoGuides {
  const arr = bounds(arrastando);
  const guides: Guide[] = [];
  let ajusteX = 0;
  let ajusteY = 0;
  let melhorDistX = SNAP_DIST + 1;
  let melhorDistY = SNAP_DIST + 1;

  // Posições verticais (eixo X) candidatas: cada borda + centroX dos outros + centro do molde
  const candidatosX: { pos: number; tipoOutro: string; outro?: any }[] = [
    { pos: 0, tipoOutro: 'borda-canvas-esq' },
    { pos: moldeLargura, tipoOutro: 'borda-canvas-dir' },
    { pos: moldeLargura / 2, tipoOutro: 'centro-canvas' },
  ];
  outros.forEach((o) => {
    const b = bounds(o);
    candidatosX.push(
      { pos: b.esquerda, tipoOutro: 'esquerda-outro', outro: o },
      { pos: b.direita, tipoOutro: 'direita-outro', outro: o },
      { pos: b.centroX, tipoOutro: 'centro-outro', outro: o },
    );
  });

  // Pra cada borda do arrastando, vê se está próximo de algum candidato
  const pontosArrX = [
    { val: arr.esquerda, tipo: 'esquerda' },
    { val: arr.direita, tipo: 'direita' },
    { val: arr.centroX, tipo: 'centro' },
  ];

  pontosArrX.forEach((p) => {
    candidatosX.forEach((c) => {
      const dist = Math.abs(p.val - c.pos);
      if (dist < SNAP_DIST && dist < melhorDistX) {
        melhorDistX = dist;
        ajusteX = c.pos - p.val;
      }
      // Adiciona guide se for próximo (mas não obrigatoriamente o "melhor")
      if (dist < SNAP_DIST) {
        // Calcula extensão da guide (do menor top ao maior bottom)
        const arrTop = arr.top;
        const arrBot = arr.bottom;
        let inicio = arrTop;
        let fim = arrBot;
        if (c.outro) {
          inicio = Math.min(inicio, c.outro.y);
          fim = Math.max(fim, c.outro.y + c.outro.altura);
        } else {
          inicio = 0;
          fim = moldeAltura;
        }
        guides.push({
          orientacao: 'vertical',
          posicao: c.pos,
          inicio,
          fim,
          tipo: `${p.tipo}->${c.tipoOutro}`,
        });
      }
    });
  });

  // Mesmo para Y
  const candidatosY: { pos: number; tipoOutro: string; outro?: any }[] = [
    { pos: 0, tipoOutro: 'borda-canvas-top' },
    { pos: moldeAltura, tipoOutro: 'borda-canvas-bot' },
    { pos: moldeAltura / 2, tipoOutro: 'centro-canvas' },
  ];
  outros.forEach((o) => {
    const b = bounds(o);
    candidatosY.push(
      { pos: b.top, tipoOutro: 'top-outro', outro: o },
      { pos: b.bottom, tipoOutro: 'bottom-outro', outro: o },
      { pos: b.centroY, tipoOutro: 'centro-outro', outro: o },
    );
  });

  const pontosArrY = [
    { val: arr.top, tipo: 'top' },
    { val: arr.bottom, tipo: 'bottom' },
    { val: arr.centroY, tipo: 'centro' },
  ];

  pontosArrY.forEach((p) => {
    candidatosY.forEach((c) => {
      const dist = Math.abs(p.val - c.pos);
      if (dist < SNAP_DIST && dist < melhorDistY) {
        melhorDistY = dist;
        ajusteY = c.pos - p.val;
      }
      if (dist < SNAP_DIST) {
        const arrEsq = arr.esquerda;
        const arrDir = arr.direita;
        let inicio = arrEsq;
        let fim = arrDir;
        if (c.outro) {
          inicio = Math.min(inicio, c.outro.x);
          fim = Math.max(fim, c.outro.x + c.outro.largura);
        } else {
          inicio = 0;
          fim = moldeLargura;
        }
        guides.push({
          orientacao: 'horizontal',
          posicao: c.pos,
          inicio,
          fim,
          tipo: `${p.tipo}->${c.tipoOutro}`,
        });
      }
    });
  });

  // Filtra guides duplicadas (mesma orientação + posição)
  const seen = new Set<string>();
  const guidesUnicas = guides.filter((g) => {
    const k = `${g.orientacao}-${Math.round(g.posicao)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return { ajusteX, ajusteY, guides: guidesUnicas };
}
