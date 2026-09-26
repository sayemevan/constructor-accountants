"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

export function Breadcrumbs() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length === 0) {
    return (
      <div className="flex items-center space-x-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        <Home className="h-3.5 w-3.5" />
        <span>Dashboard</span>
      </div>
    );
  }

  return (
    <nav className="flex items-center space-x-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
      <Link href="/" className="hover:text-amber-500 transition-colors flex items-center">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment, idx) => {
        const url = `/${segments.slice(0, idx + 1).join("/")}`;
        const isLast = idx === segments.length - 1;
        const formatted = segment.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

        return (
          <div key={url} className="flex items-center space-x-1.5">
            <ChevronRight className="h-3 w-3 text-zinc-400 dark:text-zinc-600" />
            {isLast ? (
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">{formatted}</span>
            ) : (
              <Link href={url} className="hover:text-amber-500 transition-colors">
                {formatted}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
