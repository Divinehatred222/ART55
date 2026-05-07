// app/fontes/page.tsx
import { todasFontes } from '@/lib/db';
import FontesUI from './fontes-ui';

export const dynamic = 'force-dynamic';

export default async function FontesPage() {
  return <FontesUI fontes={await todasFontes()} />;
}
