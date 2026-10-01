import { apiGet, apiPatch } from "$lib/api";

export type DeviceType = "personal" | "shared";

export type CurrentDevice = {
    id: string;
    name: string;
    type: DeviceType;
    createdAt?: string | null;
    updatedAt?: string | null;
    lastSeenAt?: string | null;
};

const DEFAULT_DEVICE_NAME = "Nouvel appareil";
const DEFAULT_DEVICE_TYPE: DeviceType = "shared";
let currentDevice: CurrentDevice | null = null;

function isDeviceType(value: unknown): value is DeviceType {
    return value === "personal" || value === "shared";
}

export function normalizeCurrentDevice(value: unknown): CurrentDevice {
    const source = value && typeof value === "object" ? value as Partial<CurrentDevice> : {};

    return {
        id: typeof source.id === "string" ? source.id : "",
        name: typeof source.name === "string" && source.name.trim()
            ? source.name.trim()
            : DEFAULT_DEVICE_NAME,
        type: isDeviceType(source.type) ? source.type : DEFAULT_DEVICE_TYPE,
        createdAt: typeof source.createdAt === "string" ? source.createdAt : null,
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
        lastSeenAt: typeof source.lastSeenAt === "string" ? source.lastSeenAt : null,
    };
}

export async function loadCurrentDevice() {
    if (!currentDevice) {
        currentDevice = normalizeCurrentDevice(await apiGet("/auth/me/device/"));
    }
    return currentDevice;
}

export async function saveCurrentDevice(patch: { name?: string; type?: DeviceType }) {
    currentDevice = normalizeCurrentDevice(await apiPatch("/auth/me/device/", patch));
    return currentDevice;
}

export function isDefaultDeviceName(name: string) {
    return name.trim() === DEFAULT_DEVICE_NAME;
}
