"use client";

import React, { useState } from "react";
import { useGoogleAuth } from "@/providers/google-auth-provider";
import { useData } from "@/providers/data-provider";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/providers/theme-provider";
import { LogOut, Sun, Moon, RefreshCcw, Loader2 } from "lucide-react";

export function UserNav() {
  const { user, isAuthenticated, isConnecting, syncStatus, lastSyncedAt, logout, login, workspaceState } =
    useGoogleAuth();
  const { reload } = useData();

  const { theme, setTheme } = useTheme();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <Button onClick={() => void login()} size="sm" disabled={isConnecting} className="text-xs shadow-md shadow-amber-500/20">
        {isConnecting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : null}
        Connect Google Account
      </Button>
    );
  }

  const isSyncing = syncStatus === "syncing";

  return (
    <div className="relative">
      <div className="flex items-center space-x-3">
        {/* Drive Sync Status Pill */}
        <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs">
          <span className="relative flex h-2 w-2">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isSyncing ? "bg-amber-400" : "bg-emerald-400"
              }`}
            ></span>
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${isSyncing ? "bg-amber-500" : "bg-emerald-500"}`}
            ></span>
          </span>
          <span className="text-zinc-600 dark:text-zinc-400 text-[11px]">
            {isSyncing ? "Syncing Drive..." : lastSyncedAt ? `Synced ${lastSyncedAt}` : "Google Sheets"}
          </span>
        </div>

        <button
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center space-x-2 p-1 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors focus:outline-none"
        >
          <img src={user.picture} alt={user.name} className="h-7 w-7 rounded-full border border-amber-500/40" />
          <div className="hidden sm:flex flex-col text-left">
            <span className="text-xs font-semibold leading-none text-zinc-900 dark:text-zinc-100">{user.name}</span>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 uppercase tracking-wider font-bold leading-tight mt-0.5">
              Contractor Owner
            </span>
          </div>
        </button>
      </div>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#18181b] shadow-2xl p-3 text-xs space-y-3 z-50 animate-in fade-in-50">
          <div className="flex items-center space-x-3 pb-2 border-b border-zinc-100 dark:border-zinc-800">
            <img src={user.picture} alt={user.name} className="h-9 w-9 rounded-full" />
            <div className="flex flex-col truncate">
              <span className="font-bold text-zinc-900 dark:text-zinc-100">{user.name}</span>
              <span className="text-[11px] text-zinc-500 truncate">{user.email}</span>
            </div>
          </div>

          <button
            onClick={() => {
              void reload();
              setDropdownOpen(false);
            }}
            disabled={isSyncing || workspaceState !== "ready"}
            className="w-full text-left p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center space-x-2 text-zinc-700 dark:text-zinc-300 disabled:opacity-50"
          >
            <RefreshCcw className={`h-3.5 w-3.5 text-amber-500 ${isSyncing ? "animate-spin" : ""}`} />
            <span>Sync now (reload from Google Sheet)</span>
          </button>

          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="text-xs h-7"
            >
              {theme === "dark" ? <Sun className="h-3.5 w-3.5 mr-1" /> : <Moon className="h-3.5 w-3.5 mr-1" />}
              {theme === "dark" ? "Light" : "Dark"}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                logout();
                setDropdownOpen(false);
              }}
              className="text-xs h-7 text-red-500 hover:text-red-600"
            >
              <LogOut className="h-3.5 w-3.5 mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
