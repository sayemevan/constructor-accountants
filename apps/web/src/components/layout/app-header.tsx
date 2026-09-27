import { Bell } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';

import { Brand } from './brand';

/** Top bar. Tenant switcher and user menu are added with the auth/tenant modules. */
export function AppHeader(): ReactNode {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-backdrop-filter:bg-background/80">
      <div className="md:hidden">
        <Brand />
      </div>
      <div className="ml-auto hidden md:block">
        <Button asChild variant="ghost" size="icon-lg" className="size-11">
          <Link href="/notifications" aria-label="Notifications">
            <Bell aria-hidden className="size-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
