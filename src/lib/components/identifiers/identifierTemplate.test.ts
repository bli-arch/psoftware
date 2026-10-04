import { describe, expect, mock, spyOn, test } from "bun:test";

mock.module("$app/environment", () => ({ browser: false }));
const { estimateIdentifierCollisionCount, estimateIdentifierEntropyBits, parseIdentifierTemplate, previewIdentifierParts, MAX_IDENTIFIER_LENGTH, validateIdentifierTemplate } = await import("./identifierTemplate");

describe("identifier template validation", () => {
    test("accepts the syntax rendered by the editor and server", () => {
        expect(validateIdentifierTemplate("CL-%4N%-%2Ntod%-%D<%Y%m%d>%-%4^Rl%-%4_R%-%4Rn%")).toBeNull();
        expect(validateIdentifierTemplate("REC-%D<%Y%m%d>%-%3Ntod%")).toBeNull();
        expect(validateIdentifierTemplate("%50Rn%")).toBeNull();
    });

    test("rejects oversized token widths before allocation", () => {
        expect(validateIdentifierTemplate("%999999999Rn%")).toContain("comprise entre 1 et 50");
        expect(validateIdentifierTemplate("%51R%")).toContain("comprise entre 1 et 50");
        expect(validateIdentifierTemplate("%0N%")).toContain("comprise entre 1 et 50");
    });

	test("rejects malformed, unknown, and oversized output", () => {
        expect(validateIdentifierTemplate("%4unknown%")).toContain("Balise inconnue");
        expect(validateIdentifierTemplate("%D<%Q>%")).toContain("directive inconnue");
        expect(validateIdentifierTemplate("prefix-%50Rn%")).toContain(`${MAX_IDENTIFIER_LENGTH} caractères`);
	});

    test("rejects templates that cannot change after a collision", () => {
        expect(validateIdentifierTemplate("STATIC")).toContain("séquence globale");
        expect(validateIdentifierTemplate("%D<Ymd>%")).toContain("séquence globale");
        expect(validateIdentifierTemplate("%3Ntod%")).toContain("séquence globale");
    });
});

describe("random identifier alphabets", () => {
    test("preserves digits for case-limited alphanumeric previews and excludes them from letter-only previews", () => {
        const random = spyOn(crypto, "getRandomValues").mockImplementation((array) => {
            if (array instanceof Uint32Array) array.fill(26);
            return array;
        });
        try {
            expect(previewIdentifierParts(parseIdentifierTemplate("%4^R%"))).toBe("0000");
            expect(previewIdentifierParts(parseIdentifierTemplate("%4_R%"))).toBe("0000");
            expect(previewIdentifierParts(parseIdentifierTemplate("%4^Rl%"))).toBe("AAAA");
            expect(previewIdentifierParts(parseIdentifierTemplate("%4_Rl%"))).toBe("aaaa");
        } finally {
            random.mockRestore();
        }
    });

    test("estimates strength and collisions using the complete alphabet", () => {
        for (const [template, alphabetSize] of [["%4^R%", 36], ["%4_R%", 36], ["%4^Rl%", 26], ["%4_Rl%", 26], ["%4R%", 62]] as const) {
            const parts = parseIdentifierTemplate(template);
            expect(estimateIdentifierEntropyBits(parts)).toBeCloseTo(4 * Math.log2(alphabetSize));
            expect(estimateIdentifierCollisionCount(parts)).toBe(Math.floor(Math.sqrt(2 * alphabetSize ** 4 * Math.log(2))));
        }
    });
});
