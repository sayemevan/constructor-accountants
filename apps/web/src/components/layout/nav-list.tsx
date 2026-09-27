'use client';

import { cn } from 'cn';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { isActivePath, MAIN_NAV, type NavItem } from './nav-items';

/** Full navigation list (desktop sidebar, mobile "More" sheet). Client-side so icons stay out of RSC props. */
export function NavList({ onNavigate }: { onNavigate?: () => void }): ReactNode {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {MAIN_NAV.map((item) => (
        <li key={item.href}>
          <NavLink item={item} active={isActivePath(pathname, item.href)} onNavigate={onNavigate} />
        </li>
      ))}
    </ul>
  );
}

interface NavLinkProps {
  item: NavItem;
  active: boolean;
  onNavigate: (() => void) | undefined;
}

/** Active state uses weight + an indicator bar, not color alone. */
function NavLink({ item, active, onNavigate }: NavLinkProps): ReactNode {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      onClick={() => onNavigate?.()}
      className={cn(
        'relative flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm text-sidebar-foreground outline-none',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-sidebar-ring/50',
        active &&
          'bg-sidebar-accent font-semibold text-sidebar-accent-foreground before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-sidebar-primary',
      )}
    >
      <Icon aria-hidden className="size-5 shrink-0" />
      {item.label}
    </Link>
  );
}
