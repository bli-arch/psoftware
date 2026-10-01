import { describe, expect, mock, test } from "bun:test";

mock.module("$app/environment", () => ({ browser: false }));
mock.module("$app/navigation", () => ({ goto: () => Promise.resolve() }));
let patchedSettings: Record<string, unknown> | null = null;
mock.module("$lib/api", () => ({
    apiGet: () => Promise.resolve({}),
    apiPatch: (_path: string, patch: Record<string, unknown>) => {
        patchedSettings = patch;
        return Promise.resolve({});
    },
}));

const {
    DEFAULT_SETTINGS,
    normalizeTrackingLabelFieldSettings,
    setSettingsSnapshot,
    updateAppSettings,
} = await import("./settings");

describe("automatic backup feature gate", () => {
    test("keeps automatic backups disabled when a legacy server reports them enabled", () => {
        const value = structuredClone(DEFAULT_SETTINGS);
        value.server.backupEnabled = true;

        const snapshot = setSettingsSnapshot({ version: 1, value });

        expect(snapshot.value.server.backupEnabled).toBe(false);
    });

    test("never sends an automatic backup activation", async () => {
        await updateAppSettings({ server: { backupEnabled: true } });

        expect(patchedSettings).toEqual({ server: { backupEnabled: false } });
    });
});

describe("tracking label settings", () => {
    test("normalizes field sources and barcode constraints", () => {
        expect(normalizeTrackingLabelFieldSettings([
            { id: "system:barcode", label: " Code-barres ", source: "Client", wide: false, showLabel: true },
            { id: "form:client:name", label: " Nom ", source: "Par défaut", showLabel: false },
            { id: "form:client:name", label: "Doublon" },
            { id: "invalid", label: "Champ invalide" },
        ])).toEqual([
            {
                id: "system:barcode",
                label: "Code-barres",
                source: "Par défaut",
                wide: true,
                showLabel: false,
            },
            {
                id: "form:client:name",
                label: "Nom",
                source: "Client",
                wide: false,
                showLabel: false,
            },
        ]);
    });
});
