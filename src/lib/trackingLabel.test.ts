import { describe, expect, mock, test } from "bun:test";

mock.module("$app/environment", () => ({ browser: false }));
mock.module("$lib/printing", () => ({ SYSTEM_PRINTER_VALUE: "psoft://system-printer" }));

const { resolveTrackingLabelFields } = await import("./trackingLabel");

describe("tracking label values", () => {
    test("uses the saved operation identifier and current form data", () => {
        const fields = resolveTrackingLabelFields([
            { id: "system:barcode", label: "Code-barres", source: "Par défaut" },
            { id: "system:status", label: "Statut", source: "Par défaut" },
            { id: "form:operation:device", label: "Appareil", source: "Opération" },
            { id: "form:client:name", label: "Client", source: "Client" },
        ], {
            uid: "OP-2026-0042",
            state: { name: "Diagnostic" },
            data: { device: "MacBook Pro" },
            client: { data: { name: "Camille Martin" } },
        });

        expect(fields.map((field) => field.sample)).toEqual([
            "OP-2026-0042",
            "Diagnostic",
            "MacBook Pro",
            "Camille Martin",
        ]);
    });
});
