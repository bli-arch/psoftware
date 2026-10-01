import { browser } from "$app/environment";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { loadCurrentDevice } from "$lib/device";
import { canUseLocalServerService, getLocalServerServiceStatus } from "$lib/localServerService";
import { bootstrapClient } from "$lib/system";

export async function refreshAppTitle(overrides: { serverName?: string; deviceName?: string } = {}) {
    if (!browser) return;

    const [bootstrap, device, localServer] = await Promise.all([
        bootstrapClient(),
        loadCurrentDevice(),
        canUseLocalServerService() ? getLocalServerServiceStatus().catch(() => null) : null,
    ]);
    const isLocal = localServer?.serverId?.toLowerCase() === bootstrap.server.serverId.toLowerCase();
    const serverName = overrides.serverName?.trim() || bootstrap.server.serverName;
    const deviceName = overrides.deviceName?.trim() || device.name;
    const title = `PSoftware — ${serverName}${isLocal ? " (Cet appareil)" : ""} · ${deviceName}`;

    document.title = title;
    if (canUseLocalServerService()) {
        await getCurrentWindow().setTitle(title).catch((error) => console.error("Failed to update the application title", error));
    }
}
