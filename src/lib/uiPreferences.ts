import { browser } from "$app/environment";
import { invoke } from "@tauri-apps/api/core";
import { get, writable } from "svelte/store";

const STORAGE_KEY = "uiPreferences";
const ANIMATION_TIME_VARS: Record<number, string> = {
    100: "--animation-duration-100",
    150: "--animation-duration-150",
    160: "--animation-duration-160",
    200: "--animation-duration",
    220: "--animation-duration-220",
    250: "--animation-duration-250",
    300: "--animation-duration-300",
    400: "--animation-duration-400",
    750: "--animation-duration-750",
    1000: "--animation-duration-1000",
    1500: "--animation-duration-1500",
    2000: "--animation-duration-2000",
};

export type UiPreferences = {
    theme: "light" | "dark" | "system";
    accent: string;
    density: "compact" | "standard" | "comfortable";
    textSize: "small" | "medium" | "large";
    highContrast: boolean;
    stripedRows: boolean;
    animations: boolean;
    strongKeyboardFocus: boolean;
    rememberWindowSize: boolean;
};

const DEFAULT_UI_PREFERENCES: UiPreferences = {
    theme: "system",
    accent: "#F26313",
    density: "standard",
    textSize: "medium",
    highContrast: false,
    stripedRows: false,
    animations: true,
    strongKeyboardFocus: false,
    rememberWindowSize: true,
};

let syncedRememberWindowBounds: boolean | null = null;

function normalizePreferences(value: unknown): UiPreferences {
    const source = value && typeof value === "object" ? value as Partial<UiPreferences> : {};

    return {
        theme: source.theme === "light" || source.theme === "dark" || source.theme === "system"
            ? source.theme
            : DEFAULT_UI_PREFERENCES.theme,
        accent: typeof source.accent === "string" && /^#[0-9A-Fa-f]{6}$/.test(source.accent)
            ? source.accent
            : DEFAULT_UI_PREFERENCES.accent,
        density: source.density === "compact" || source.density === "standard" || source.density === "comfortable"
            ? source.density
            : DEFAULT_UI_PREFERENCES.density,
        textSize: source.textSize === "small" || source.textSize === "medium" || source.textSize === "large"
            ? source.textSize
            : DEFAULT_UI_PREFERENCES.textSize,
        highContrast: typeof source.highContrast === "boolean" ? source.highContrast : DEFAULT_UI_PREFERENCES.highContrast,
        stripedRows: typeof source.stripedRows === "boolean" ? source.stripedRows : DEFAULT_UI_PREFERENCES.stripedRows,
        animations: typeof source.animations === "boolean" ? source.animations : DEFAULT_UI_PREFERENCES.animations,
        strongKeyboardFocus: typeof source.strongKeyboardFocus === "boolean" ? source.strongKeyboardFocus : DEFAULT_UI_PREFERENCES.strongKeyboardFocus,
        rememberWindowSize: typeof source.rememberWindowSize === "boolean" ? source.rememberWindowSize : DEFAULT_UI_PREFERENCES.rememberWindowSize,
    };
}

function readPreferences() {
    if (!browser) return DEFAULT_UI_PREFERENCES;

    try {
        return normalizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
    } catch {
        return DEFAULT_UI_PREFERENCES;
    }
}

function applyPreferences(preferences: UiPreferences) {
    if (!browser) return;

    const root = document.documentElement;
    const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    const activeTheme = preferences.theme === "system" ? systemTheme : preferences.theme;

    root.style.setProperty("--user-color", preferences.accent);
    root.dataset.theme = activeTheme;
    root.dataset.density = preferences.density;
    root.dataset.textSize = preferences.textSize;
    root.classList.toggle("ui-high-contrast", preferences.highContrast);
    root.classList.toggle("ui-striped-rows", preferences.stripedRows);
    root.classList.toggle("ui-no-animations", !preferences.animations);
    root.classList.toggle("ui-strong-focus", preferences.strongKeyboardFocus);
}

export const uiPreferences = writable<UiPreferences>(readPreferences());

export function updateUiPreferences(patch: Partial<UiPreferences>) {
    uiPreferences.update((current) => normalizePreferences({ ...current, ...patch }));
}

export function resetUiPreferences() {
    uiPreferences.set({ ...DEFAULT_UI_PREFERENCES });
}

export function animationTime(ms = 200): number {
    const fallback = get(uiPreferences).animations ? ms : 0;
    if (!browser) return fallback;

    const variable = ANIMATION_TIME_VARS[ms];
    if (!variable) return fallback;

    const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
    if (value.endsWith("ms")) return Number.parseFloat(value) || 0;
    if (value.endsWith("s")) return (Number.parseFloat(value) || 0) * 1000;

    return fallback;
}

export function initUiPreferences() {
    if (!browser) return () => {};

    return uiPreferences.subscribe((preferences) => {
        applyPreferences(preferences);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
        syncRememberWindowBounds(preferences.rememberWindowSize);
    });
}

function syncRememberWindowBounds(remember: boolean) {
    if (!browser || !("__TAURI_INTERNALS__" in window) || syncedRememberWindowBounds === remember) return;

    syncedRememberWindowBounds = remember;
    void invoke("set_remember_window_bounds", { remember }).catch((error) => {
        syncedRememberWindowBounds = null;
        console.warn("Unable to sync window memory preference.", error);
    });
}

export function initWindowSizeMemory() {
    return () => {};
}
