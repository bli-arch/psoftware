import { browser } from "$app/environment";

const DEVICE_SETTINGS_KEY = "thisDeviceSettings";
const LAST_ROUTE_KEY = "psoftware:last-startup-route:v1";
const DEFAULT_ROUTE = "/home";

export type StartupMode = "home" | "operations" | "restore";

const STARTUP_ROUTES: Record<Exclude<StartupMode, "restore">, string> = {
    home: "/home",
    operations: "/operations",
};

const APP_ROUTE_PREFIXES = [
    "/home",
    "/operations",
    "/clients",
    "/team",
    "/settings",
    "/account",
];

function isAppRoute(path: string) {
    return path.startsWith("/") && !path.startsWith("//") && APP_ROUTE_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

function readStartupMode(): StartupMode {
    if (!browser) return "home";

    try {
        const settings = JSON.parse(localStorage.getItem(DEVICE_SETTINGS_KEY) || "null");
        return settings?.startupMode === "operations" || settings?.startupMode === "restore"
            ? settings.startupMode
            : "home";
    } catch {
        return "home";
    }
}

export function getStartupRoute() {
    if (!browser) return DEFAULT_ROUTE;

    const mode = readStartupMode();
    if (mode === "restore") {
        const lastRoute = localStorage.getItem(LAST_ROUTE_KEY) || "";
        return isAppRoute(lastRoute) ? lastRoute : DEFAULT_ROUTE;
    }

    return STARTUP_ROUTES[mode];
}

export function rememberStartupRoute(path: string) {
    if (browser && isAppRoute(path)) {
        localStorage.setItem(LAST_ROUTE_KEY, path);
    }
}

export function safeInternalRoute(route: string | null, fallback = DEFAULT_ROUTE) {
    return route?.startsWith("/")
        && !route.startsWith("//")
        && !route.includes("\\")
        && !route.startsWith("/device-setup")
        ? route
        : fallback;
}
