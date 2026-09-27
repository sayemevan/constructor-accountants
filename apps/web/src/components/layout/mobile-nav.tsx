'use client';

import { cn } from 'cn';
import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

import { FIELD_NAV, isActivePath, type NavItem } from './nav-items';
import { NavList } from './nav-list';

const itemClass =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs text-muted-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

/** Bottom bar below md: field actions within thumb reach, everything else in the "More" sheet. */
export function MobileNav(): ReactNode {
  const [open, setOpen] = useState(false);
  return (
    <nav
      aria-label="Quick actions"
      className="fixed inset-x-0 bottom-0 z-30 border-t bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className="flex">
        {FIELD_NAV.map((item) => (
          <li key={item.href} className="flex flex-1">
            <BottomLink item={item} />
          </li>
        ))}
        <li className="flex flex-1">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className={itemClass}>
              <Menu aria-hidden className="size-6" />
              More
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SheetHeader className="border-b">
                <SheetTitle>Menu</SheetTitle>
                <SheetDescription className="sr-only">All sections of the app</SheetDescription>
              </SheetHeader>
              <nav aria-label="Main" className="overflow-y-auto px-2 py-2">
                <NavList
                  onNavigate={() => {
                    setOpen(false);
                  }}
                />
              </nav>
            </SheetContent>
          </Sheet>
        </li>
      </ul>
    </nav>
  );
}

function BottomLink({ item }: { item: NavItem }): ReactNode {
  const active = isActivePath(usePathname(), item.href);
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(itemClass, active && 'font-semibold text-foreground')}
    >
      <Icon aria-hidden className="size-6" strokeWidth={active ? 2.5 : 2} />
      {item.label}
    </Link>
  );
}
