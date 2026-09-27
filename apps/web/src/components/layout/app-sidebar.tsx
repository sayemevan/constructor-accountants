import type { ReactNode } from 'react';

import { Brand } from './brand';
import { NavList } from './nav-list';

/** Desktop navigation (md and up). */
export function AppSidebar(): ReactNode {
  return (
    <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r bg-sidebar md:flex">
      <div className="flex h-14 items-center px-4">
        <Brand />
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-2 py-2">
        <NavList />
      </nav>
    </aside>
  );
}
