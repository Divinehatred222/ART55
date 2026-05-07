/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // IMPORTANTE: removidos os headers COOP/COEP porque bloqueariam o
  // carregamento de imagens do Supabase Storage. A IA local de remoção
  // de fundo (@imgly/background-removal) ainda funciona porque usa Web Workers
  // próprios que não precisam de SharedArrayBuffer.
};

module.exports = nextConfig;
