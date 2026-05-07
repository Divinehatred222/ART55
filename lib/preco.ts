// lib/preco.ts
// Helpers para trabalhar com preços compostos

export type PrecoPartido = {
  inteiro: string;     // "39"
  centavos: string;    // "99"
  semCentavos: boolean; // true se entrada não tem centavos
};

// Recebe "R$ 39,90" ou "39.90" ou "39" e devolve as partes
export function partirPreco(precoTexto: string): PrecoPartido {
  // Remove tudo que não é número, vírgula ou ponto
  const limpo = precoTexto.replace(/[^\d,\.]/g, '').trim();

  if (!limpo) return { inteiro: '0', centavos: '00', semCentavos: true };

  // Detecta separador decimal: usa o último caractere , ou . como separador
  const ultimaVirgula = limpo.lastIndexOf(',');
  const ultimoPonto = limpo.lastIndexOf('.');
  const sepIdx = Math.max(ultimaVirgula, ultimoPonto);

  if (sepIdx < 0) {
    // sem separador decimal
    return {
      inteiro: limpo.replace(/[,\.]/g, ''),
      centavos: '00',
      semCentavos: true,
    };
  }

  const parteInteira = limpo.slice(0, sepIdx).replace(/[,\.]/g, '');
  let parteCentavos = limpo.slice(sepIdx + 1);

  // Trata casos onde o separador final tem mais de 2 dígitos (provavelmente milhar)
  // Ex: "39.999" → trata como inteiro 39999 sem centavos
  if (parteCentavos.length > 2) {
    return {
      inteiro: (parteInteira + parteCentavos).replace(/[,\.]/g, ''),
      centavos: '00',
      semCentavos: true,
    };
  }

  // Pad com zeros se necessário
  if (parteCentavos.length === 1) parteCentavos += '0';
  if (parteCentavos.length === 0) {
    return { inteiro: parteInteira || '0', centavos: '00', semCentavos: true };
  }

  return {
    inteiro: parteInteira || '0',
    centavos: parteCentavos,
    semCentavos: false,
  };
}
