"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HardHat, Menu, X, Search } from "lucide-react";
import { Breadcrumbs } from "./breadcrumbs";
import { UserNav } from "./user-nav";
import { navItemsForMode } from "./sidebar";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { cn } from "@/utils/cn";

export function Header({
  onToggleSidebar,
}: {
  onToggleSidebar?: () => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const { workspaceMode } = useGoogleAuth();
  const navItems = navItemsForMode(workspaceMode);

  return (
    <header className="sticky top-0 z-20 h-16 border-b border-zinc-200 dark:border-zinc-800/80 bg-white/80 dark:bg-[#0d0d10]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between">
      <div className="flex items-center space-x-3">
        {/* Mobile menu trigger */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <Breadcrumbs />
      </div>

      <div className="flex items-center space-x-4">
        {/* Quick Search Input */}
        <div className="hidden md:flex items-center relative w-48 lg:w-64">
          <Search className="h-3.5 w-3.5 absolute left-3 text-zinc-400" />
          <input
            type="text"
            placeholder="Search projects, ledgers..."
            className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        <UserNav />
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-50 md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#0d0d10] p-4 shadow-2xl animate-in slide-in-from-top-2">
          <div className="flex items-center space-x-2 pb-3 mb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="h-8 w-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <HardHat className="h-4 w-4" />
            </div>
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">BuildLedger</span>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium",
                    isActive
                      ? "bg-amber-500/10 text-amber-500 font-semibold"
                      : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
}
