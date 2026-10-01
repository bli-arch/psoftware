import { describe, expect, test } from "bun:test";
import {
    finiteRangeNumber,
    normalizeRangeBounds,
    normalizeRangeStep,
    readIntervalRangeValue,
    readSingleRangeValue,
} from "./rangeValue";

describe("range values", () => {
    test("does not coerce empty values to zero", () => {
        expect(finiteRangeNumber(null, 12)).toBe(12);
        expect(finiteRangeNumber("", 12)).toBe(12);
        expect(finiteRangeNumber("  ", 12)).toBe(12);
    });

    test("normalizes invalid and reversed settings", () => {
        expect(normalizeRangeBounds(null, null)).toEqual([0, 100]);
        expect(normalizeRangeBounds(50, 10)).toEqual([10, 50]);
        expect(normalizeRangeStep(null)).toBe(1);
        expect(normalizeRangeStep(0)).toBe(1);
        expect(normalizeRangeStep(-2)).toBe(1);
    });

    test("uses bounds for missing values and clamps configured values", () => {
        expect(readSingleRangeValue(null, 10, 90)).toBe(10);
        expect(readSingleRangeValue(120, 10, 90)).toBe(90);
        expect(readIntervalRangeValue(null, 10, 90)).toEqual([10, 90]);
        expect(readIntervalRangeValue([80, null], 10, 90)).toEqual([80, 90]);
        expect(readIntervalRangeValue([100, -10], 10, 90)).toEqual([10, 90]);
    });
});
