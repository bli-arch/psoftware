import { describe, expect, test } from "bun:test";
import { MAX_IDENTIFIER_LENGTH, validateIdentifierTemplate } from "./identifierTemplate";

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
