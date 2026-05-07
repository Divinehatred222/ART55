/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  // @imgly/background-removal usa arquivos .mjs com import.meta que quebram
  // o minificador padrão do Next/Terser. Solução: configurar o Terser pra tratar
  // arquivos como ES modules durante minificação.
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // O Next.js já vem com terser-webpack-plugin instalado internamente.
      // Vamos sobrescrever as opções do minimizer existente.
      try {
        const TerserPlugin = require('terser-webpack-plugin');
        config.optimization.minimizer = [
          new TerserPlugin({
            terserOptions: {
              module: true,
              parse: { ecma: 2020 },
              compress: {},
              mangle: true,
            },
          }),
        ];
      } catch (e) {
        // Fallback: se terser-webpack-plugin não estiver disponível,
        // só desliga minificação dos arquivos problemáticos.
        console.warn('terser-webpack-plugin não disponível, ajustando minimizers existentes...');
        if (config.optimization.minimizer) {
          config.optimization.minimizer.forEach((minimizer) => {
            if (minimizer.constructor.name === 'TerserPlugin' && minimizer.options) {
              minimizer.options.terserOptions = {
                ...(minimizer.options.terserOptions || {}),
                module: true,
                parse: { ecma: 2020 },
              };
            }
          });
        }
      }
    }
    return config;
  },
};

module.exports = nextConfig;
