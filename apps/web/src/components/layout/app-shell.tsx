import type { ReactNode } from 'react';

import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { MobileNav } from './mobile-nav';

/** Authenticated layout frame: sidebar (desktop), header, content, bottom nav (mobile). */
export function AppShell({ children }: { children: ReactNode }): ReactNode {
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-background px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <AppSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader />
        {/* Bottom padding keeps content clear of the fixed mobile nav. */}
        <main
          id="main"
          className="flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-6"
        >
          {children}
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
