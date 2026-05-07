// app/layout.tsx
import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Gerador de Artes',
  description: 'Ferramenta interna para gerar artes promocionais a partir de moldes.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-40 bg-paper/80 backdrop-blur-md border-b border-line">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          {/* Logo da agência. Trocar entre versões editando o src:
              /logo.png — laranja com P branco (padrão)
              /logo-mono.png — preto e branco
              /logo-dark.png — fundo azul escuro
              /logo-orange-line.png — fundo claro com linha laranja */}
          <img src="/logo.png" alt="Logo" className="w-9 h-9 object-contain shrink-0" />
          <span className="text-[10px] uppercase tracking-[0.25em] text-muted hidden sm:block">
            Gerador de Artes
          </span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <NavLink href="/clientes">Clientes</NavLink>
          <NavLink href="/produtos">Produtos</NavLink>
          <NavLink href="/moldes">Moldes</NavLink>
          <NavLink href="/fontes">Fontes</NavLink>
          <span className="w-px h-5 bg-line mx-2" />
          <Link href="/gerar" className="btn-primary">Gerar arte</Link>
        </nav>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="px-3 py-2 rounded-full text-ink hover:bg-line/50 transition-colors">
      {children}
    </Link>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line py-6 text-center text-xs text-muted">
      Ferramenta interna · v0.11
    </footer>
  );
}
