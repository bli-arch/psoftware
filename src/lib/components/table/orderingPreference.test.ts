import { describe, expect, test } from "bun:test";
import {
    normalizeTableOrdering,
    persistTableOrdering,
    readTableOrdering,
} from "./orderingPreference";

const memoryStorage = (initial: Record<string, string> = {}) => {
    const values = new Map(Object.entries(initial));
    return {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
        values,
    };
};

describe("table ordering preference", () => {
    test("accepts only a current sortable column and a valid direction", () => {
        expect(normalizeTableOrdering({ id: 2, order: "desc" }, [1, 2])).toEqual({ id: "2", order: "desc" });
        expect(normalizeTableOrdering({ id: "3", order: "asc" }, [1, 2])).toBeNull();
        expect(normalizeTableOrdering({ id: "2", order: "sideways" }, [1, 2])).toBeNull();
    });

    test("loads a valid table-specific ordering", () => {
        const storage = memoryStorage({
            "psoftware.table.clients.ordering.v1": JSON.stringify({ id: "4", order: "asc" }),
        });

        expect(readTableOrdering("clients", [1, 4], storage)).toEqual({ id: "4", order: "asc" });
        expect(readTableOrdering("operations", [1, 4], storage)).toBeNull();
    });

    test("ignores malformed, stale or unavailable storage", () => {
        expect(readTableOrdering("team", [1], memoryStorage({
            "psoftware.table.team.ordering.v1": "not-json",
        }))).toBeNull();
        expect(readTableOrdering("team", [1], memoryStorage({
            "psoftware.table.team.ordering.v1": JSON.stringify({ id: "2", order: "desc" }),
        }))).toBeNull();
        expect(readTableOrdering("team", [1], {
            getItem: () => { throw new Error("unavailable"); },
            setItem: () => undefined,
            removeItem: () => undefined,
        })).toBeNull();
    });

    test("persists valid ordering and removes it when sorting is cleared", () => {
        const storage = memoryStorage();
        expect(persistTableOrdering("operations", { id: "3", order: "desc" }, [1, 3], storage)).toBe(true);
        expect(storage.values.get("psoftware.table.operations.ordering.v1")).toBe('{"id":"3","order":"desc"}');

        expect(persistTableOrdering("operations", null, [1, 3], storage)).toBe(true);
        expect(storage.values.has("psoftware.table.operations.ordering.v1")).toBe(false);
    });

    test("does not overwrite a valid value with an invalid ordering", () => {
        const storage = memoryStorage({
            "psoftware.table.clients.ordering.v1": JSON.stringify({ id: "1", order: "asc" }),
        });

        expect(persistTableOrdering("clients", { id: "9", order: "desc" }, [1, 2], storage)).toBe(false);
        expect(readTableOrdering("clients", [1, 2], storage)).toEqual({ id: "1", order: "asc" });
    });
});
