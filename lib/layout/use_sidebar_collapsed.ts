/**
 * useSidebarCollapsed (Phase 48A.1 — Enterprise Sidebar Redesign).
 *
 * Persisted expanded/collapsed sidebar preference, using the exact same
 * useSyncExternalStore + localStorage pattern as LanguageProvider and
 * ThemeProvider: server + first client render return the default (expanded,
 * so nothing changes for a first-time visitor), and the client then adopts
 * the stored preference with no full-page refresh or hydration flash.
 *
 * Deliberately a plain hook (not a Context provider) — the collapsed state
 * is read/written only by AppShell's sidebar; nothing else in the app needs
 * it, so a full provider would be unwarranted ceremony for a single consumer.
 */
"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/layout/sidebar_layout";

const listeners = new Set<() => void>();

function readStoredCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === SIDEBAR_COLLAPSED_STORAGE_KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function writeStoredCollapsed(next: boolean) {
  try {
    window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
  } catch {
    // Ignore persistence failures — the in-memory choice still applies via listeners.
  }
  listeners.forEach((fn) => fn());
}

export function useSidebarCollapsed(): [boolean, (next: boolean) => void] {
  // Server + first client render → false (expanded), so hydration matches.
  const collapsed = useSyncExternalStore(subscribe, readStoredCollapsed, () => false);
  const setCollapsed = useCallback((next: boolean) => writeStoredCollapsed(next), []);
  return [collapsed, setCollapsed];
}
