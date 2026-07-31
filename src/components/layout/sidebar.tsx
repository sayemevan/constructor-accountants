"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Receipt,
  Users,
  Landmark,
  Package,
  BarChart3,
  Settings,
  HardHat,
  ChevronLeft,
  ChevronRight,
  DatabaseZap,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { Badge } from "@/components/ui/badge";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  /** Visible to invited collaborators/clients (who only get a limited view). */
  collaborator?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard, collaborator: true },
  { label: "Projects", href: "/projects", icon: Building2, collaborator: true },
  { label: "Site Workers", href: "/workers", icon: Users },
  { label: "Transactions", href: "/transactions", icon: Receipt },
  { label: "Accounts", href: "/accounts", icon: Landmark },
  { label: "Materials & Stock", href: "/materials", icon: Package },
  { label: "Financial Reports", href: "/reports", icon: BarChart3 },
  { label: "Settings & Google Sync", href: "/settings", icon: Settings },
];

/** Nav items appropriate for the given workspace mode. */
export function navItemsForMode(mode: "owner" | "collaborator"): NavItem[] {
  return mode === "collaborator" ? NAV_ITEMS.filter((i) => i.collaborator) : NAV_ITEMS;
}

export function Sidebar({
  collapsed,
  setCollapsed,
}: {
  collapsed: boolean;
  setCollapsed: (c: boolean) => void;
}) {
  const pathname = usePathname();
  const { syncStatus, workspaceMode } = useGoogleAuth();
  const navItems = navItemsForMode(workspaceMode);
  const isCollaborator = workspaceMode === "collaborator";

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-[#0d0d10] transition-all duration-300 relative z-30 h-screen sticky top-0",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Header / App Brand */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-zinc-200 dark:border-zinc-800/80">
        <Link href="/" className="flex items-center space-x-3 overflow-hidden">
          <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-500/20 shrink-0">
            <HardHat className="h-5 w-5" />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-sm tracking-tight text-zinc-900 dark:text-zinc-100 leading-tight">
                BuildLedger
              </span>
              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                Google Sync Edition
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group",
                isActive
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                  : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200"
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4 shrink-0 transition-transform group-hover:scale-110",
                  isActive
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-zinc-400 dark:text-zinc-500"
                )}
              />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer / Google Data Ownership Card */}
      {!collapsed && (
        <div className="p-3 m-3 rounded-lg border border-amber-500/20 bg-amber-500/5 dark:bg-amber-500/10 text-xs">
          <div className="flex items-center space-x-2 font-medium text-amber-700 dark:text-amber-300 mb-1">
            <DatabaseZap className="h-3.5 w-3.5" />
            <span>{isCollaborator ? "Shared Access" : "Zero SaaS DB"}</span>
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-normal">
            {isCollaborator
              ? "You're viewing projects shared with you (read-only)."
              : "Your financial data is stored inside your Google Account."}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <Badge variant="success" className="text-[10px] py-0">
              {syncStatus === "syncing"
                ? "Syncing..."
                : isCollaborator
                  ? "Collaborator"
                  : "Drive Connected"}
            </Badge>
          </div>
        </div>
      )}
    </aside>
  );
}
