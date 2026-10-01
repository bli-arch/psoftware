import { describe, expect, test } from "bun:test";
import { colorToHsva, cssColor, hsvaToHex } from "./color";

describe("color utilities", () => {
    test("round-trips opaque and transparent hex colors", () => {
        expect(hsvaToHex(colorToHsva("#6366F1")!)).toBe("#6366F1");
        expect(hsvaToHex(colorToHsva("#6366F180")!)).toBe("#6366F180");
    });

    test("accepts tokens and rejects injectable values", () => {
        expect(cssColor("--page-icon-blue")).toBe("var(--page-icon-blue)");
        expect(cssColor("blue")).toBe("var(--blue)");
        expect(cssColor("red;display:none")).toBeNull();
    });
});
