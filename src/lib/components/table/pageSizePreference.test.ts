import { describe, expect, test } from "bun:test";
import {
    normalizeTablePageSize,
    persistTablePageSize,
    readTablePageSize,
} from "./pageSizePreference";

const memoryStorage = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        values,
    };
};

describe("table page-size preference", () => {
    test("accepts only sizes exposed by the UI", () => {
        expect(normalizeTablePageSize(25)).toBe(25);
        expect(normalizeTablePageSize("50")).toBe(50);
        expect(normalizeTablePageSize(20, 10)).toBe(10);
        expect(normalizeTablePageSize(20, 20)).toBe(15);
    });

    test("loads a valid table-specific value before falling back", () => {
        const storage = memoryStorage({ "psoftware.table.clients.page-size.v1": "50" });
        expect(readTablePageSize("clients", 10, storage)).toBe(50);
        expect(readTablePageSize("operations", 10, storage)).toBe(10);
    });

    test("ignores invalid or unavailable storage", () => {
        const invalid = memoryStorage({ "psoftware.table.team.page-size.v1": "500" });
        expect(readTablePageSize("team", 25, invalid)).toBe(25);
        expect(readTablePageSize("team", 25, {
            getItem: () => { throw new Error("unavailable"); },
            setItem: () => undefined,
        })).toBe(25);
    });

    test("persists only values supported by the select", () => {
        const storage = memoryStorage();
        expect(persistTablePageSize("operations", 25, storage)).toBe(true);
        expect(storage.values.get("psoftware.table.operations.page-size.v1")).toBe("25");
        expect(persistTablePageSize("operations", 20, storage)).toBe(false);
        expect(storage.values.get("psoftware.table.operations.page-size.v1")).toBe("25");
    });
});
