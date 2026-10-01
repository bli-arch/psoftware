import { describe, expect, test } from "bun:test";
import {
    clampDateValue,
    formatDateValue,
    normalizeDateBounds,
    normalizeDateMode,
    normalizeDateValue,
    replaceTimePart,
    resolveTimePartSelection,
} from "./dateValue";

describe("date value normalization", () => {
    test("rejects invalid and rolled-over calendar dates", () => {
        expect(normalizeDateValue(null, "date")).toBeNull();
        expect(normalizeDateValue("0000-01-01", "date")).toBeNull();
        expect(normalizeDateValue("2026-02-29", "date")).toBeNull();
        expect(normalizeDateValue("2024-02-29", "date")).toBe("2024-02-29");
        expect(normalizeDateValue("09:05:07invalid", "time", true)).toBeNull();
    });

    test("normalizes every supported mode", () => {
        expect(normalizeDateValue("2026-07-26", "month")).toBe("2026-07");
        expect(normalizeDateValue("2026-07-26", "year")).toBe("2026");
        expect(normalizeDateValue("1", "year")).toBe("0001");
        expect(normalizeDateValue("9:05:07", "time")).toBe("09:05");
        expect(normalizeDateValue("9:05:07", "time", true)).toBe("09:05:07");
        expect(normalizeDateValue("25:09", "time-ms")).toBe("25:09");
        expect(normalizeDateValue("125:09", "time-ms")).toBeNull();
    });

    test("falls back to date mode", () => {
        expect(normalizeDateMode("unknown")).toBe("date");
        expect(normalizeDateMode("time-ms")).toBe("time-ms");
    });

    test("orders bounds and clamps values", () => {
        expect(normalizeDateBounds("2027-01", "2026-01", "month")).toEqual(["2026-01", "2027-01"]);
        expect(clampDateValue("08:00", "09:00", "17:00", "time")).toBe("09:00");
        expect(clampDateValue("59:00", "10:00", "55:00", "time-ms")).toBe("55:00");
    });

    test("updates custom time picker segments", () => {
        expect(replaceTimePart("09:15", "time", "hours", 17)).toBe("17:15");
        expect(replaceTimePart("09:15:20", "time", "seconds", 45, true)).toBe("09:15:45");
        expect(replaceTimePart("12:30", "time-ms", "minutes", 25)).toBe("25:30");
        expect(replaceTimePart("12:30", "time-ms", "seconds", 70)).toBeNull();
    });

    test("keeps valid bounded time segments reachable", () => {
        expect(resolveTimePartSelection("10:15", "time", "hours", 9, "09:30", "10:15"))
            .toBe("09:30");
        expect(resolveTimePartSelection("09:30", "time", "hours", 10, "09:30", "10:15"))
            .toBe("10:15");
        expect(resolveTimePartSelection("09:30", "time", "minutes", 20, "09:30", "10:15"))
            .toBeNull();
        expect(resolveTimePartSelection("55:40", "time-ms", "minutes", 5, "05:20", "55:40"))
            .toBe("5:40");
    });

    test("formats values for people without changing storage", () => {
        expect(formatDateValue("2026-07", "month")).toBe("juillet 2026");
        expect(formatDateValue("25:09", "time-ms")).toBe("25 min 09 s");
    });
});
