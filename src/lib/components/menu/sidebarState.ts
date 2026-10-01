// src/lib/sidebarState.ts
import { writable, derived, type Readable } from "svelte/store";

const STORAGE_KEY = "sidebarStates";

type SidebarStates = Record<string, boolean>;

// base store holding all sidebar states in one dict
const base = writable<SidebarStates>({});

// initialize from localStorage (browser only)
if (typeof localStorage !== "undefined") {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      base.set(JSON.parse(raw));
    }
  } catch (e) {
    console.error("Failed to read sidebarStates from localStorage", e);
  }
}

// persist any change back to localStorage
base.subscribe((value) => {
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch (e) {
      console.error("Failed to write sidebarStates to localStorage", e);
    }
  }
});

// hook used by both MenuContainer and MenuClose
export function getSidebarState(id: string): {
  collapsed: Readable<boolean>;
  toggle: () => void;
} {
  const collapsed = derived(base, ($base) => $base[id] ?? false);

  const toggle = () => {
    base.update((current) => {
      const next = { ...current };
      const prev = current[id] ?? false;
      next[id] = !prev;
      return next;
    });
  };

  return { collapsed, toggle };
}
