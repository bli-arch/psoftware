import { describe, expect, test } from "bun:test";
import {
    normalizeFormConfig,
    normalizeFormList,
    normalizePageSize,
    normalizeTableSettings,
    recordList,
} from "./formConfig";

describe("form configuration boundaries", () => {
    test("uses empty collections for malformed form shapes", () => {
        expect(normalizeFormConfig("invalid")).toBeNull();
        expect(normalizeFormConfig({ form: { pages: {} }, settings: { tableSettings: "invalid" } })).toMatchObject({
            form: { pages: [] },
            settings: { pageSize: 15, tableSettings: [] },
        });
        expect(recordList({ results: [null, "invalid", { id: 1 }] })).toEqual([{ id: 1 }]);
    });

    test("keeps only usable table columns and preserves their order", () => {
        expect(normalizeTableSettings([
            null,
            { id: 3, title: "Créé le", dataOrigin: "created_at" },
            { id: 1, title: "Identifiant", dataOrigin: "uid" },
            { id: 2, title: "Sans origine" },
        ])).toEqual([
            { id: 1, title: "Identifiant", dataOrigin: "uid" },
            { id: 2, title: "Créé le", dataOrigin: "created_at" },
        ]);
    });

    test("replaces duplicate or arbitrary IDs with unique numeric IDs", () => {
        expect(normalizeTableSettings([
            { id: 2, title: "Client", dataOrigin: "client.uid" },
            { id: 2, title: "Statut", dataOrigin: "state" },
            { id: 1, title: "Identifiant", dataOrigin: "uid" },
            { id: "duplicate", title: "Créateur", dataOrigin: "creator.username" },
            { id: "duplicate", title: "Date", dataOrigin: "created_at" },
        ])).toEqual([
            { id: 1, title: "Identifiant", dataOrigin: "uid" },
            { id: 2, title: "Client", dataOrigin: "client.uid" },
            { id: 3, title: "Statut", dataOrigin: "state" },
            { id: 4, title: "Créateur", dataOrigin: "creator.username" },
            { id: 5, title: "Date", dataOrigin: "created_at" },
        ]);
    });

    test("clamps page size to the supported 1 to 100 range", () => {
        expect(normalizePageSize(1)).toBe(1);
        expect(normalizePageSize(100)).toBe(100);
        expect(normalizePageSize(0)).toBe(15);
        expect(normalizePageSize(101)).toBe(15);
        expect(normalizePageSize("25")).toBe(15);
    });

    test("ignores invalid forms in list responses", () => {
        expect(normalizeFormList({ results: [{ id: 4, form: { pages: [] } }, { form: { pages: [] } }, null] }))
            .toHaveLength(1);
    });
});
