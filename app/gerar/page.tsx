// app/gerar/page.tsx
import { dbClientes, dbMoldes, dbProdutos, todasFontes } from '@/lib/db';
import GerarUI from './gerar-ui';

export const dynamic = 'force-dynamic';

export default async function GerarPage() {
  const [clientes, moldes, produtos, fontes] = await Promise.all([
    dbClientes.listar(),
    dbMoldes.listar(),
    dbProdutos.listar(),
    todasFontes(),
  ]);
  return (
    <GerarUI
      clientes={clientes}
      moldes={moldes}
      produtos={produtos}
      fontes={fontes}
    />
  );
}
