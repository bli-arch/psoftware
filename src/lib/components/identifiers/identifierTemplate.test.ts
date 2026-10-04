import { describe, expect, mock, test } from "bun:test";

mock.module("$app/environment", () => ({ browser: false }));
const { estimateIdentifierEntropyBits, parseIdentifierTemplate, previewIdentifierParts, MAX_IDENTIFIER_LENGTH, validateIdentifierTemplate, validateTrackingIdentifierTemplate } = await import("./identifierTemplate");

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

describe("tracking identifier privacy", () => {
    test("requires 128 truly random bits and rejects predictable parts", () => {
        expect(validateTrackingIdentifierTemplate("SV-%25^R%")).toBeNull();
        expect(validateTrackingIdentifierTemplate("SV-%24^R%")).toContain("128");
        expect(validateTrackingIdentifierTemplate("SV-%40Rn%")).toBeNull();
        expect(validateTrackingIdentifierTemplate("SV-%39Rn%")).toBeNull();
        expect(validateTrackingIdentifierTemplate("SV-%38Rn%")).toContain("128");
        expect(validateTrackingIdentifierTemplate("%25^R%-%N%")).toContain("texte fixe");
        expect(validateTrackingIdentifierTemplate("%25^R%-%D<Ymd>%")).toContain("texte fixe");
        expect(validateTrackingIdentifierTemplate("é-%25^R%")).toContain("texte fixe");
    });

    test("case-limited letters and alphanumeric alphabets remain distinct", () => {
        expect(estimateIdentifierEntropyBits(parseIdentifierTemplate("%25^R%"))).toBeCloseTo(25 * Math.log2(36));
        expect(estimateIdentifierEntropyBits(parseIdentifierTemplate("%25^Rl%"))).toBeCloseTo(25 * Math.log2(26));
        expect(validateTrackingIdentifierTemplate("%25^Rl%")).toContain("128");
        expect(validateTrackingIdentifierTemplate("%28^Rl%")).toBeNull();
        const preview = previewIdentifierParts(parseIdentifierTemplate("%50^R%"));
        expect(preview).toMatch(/^[A-Z0-9]{50}$/);
        expect(previewIdentifierParts(parseIdentifierTemplate("%50_Rl%"))).toMatch(/^[a-z]{50}$/);
    });
});
