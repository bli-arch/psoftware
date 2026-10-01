import { describe, expect, mock, test } from "bun:test";
import {
    IDENTIFIER_DATE_FORMAT_TOKEN_CODES,
    dateFieldFormatPresets,
    dateFieldFormatTokenCodes,
    filterDateFormatTokens,
    parseDateFormat,
    validateDateFormat,
} from "./dateFormat";

mock.module("$app/environment", () => ({ browser: false }));
const { strftime } = await import("$lib/utils");

describe("date formats", () => {
    test("parses the longest directive before its shorter form", () => {
        expect(parseDateFormat("%^A %A")).toEqual([
            {
                type: "token",
                token: {
                    code: "%^A",
                    label: "Jour en majuscules",
                    description: "Nom complet en majuscules",
                    category: "text",
                },
            },
            { type: "text", value: " " },
            {
                type: "token",
                token: {
                    code: "%A",
                    label: "Jour de la semaine",
                    description: "Nom complet du jour",
                    category: "date",
                },
            },
        ]);
    });

    test("rejects incomplete, unknown, unavailable, and oversized directives", () => {
        expect(validateDateFormat("%")).toContain("doit être complété");
        expect(validateDateFormat("%", { allowLiteralPercent: true })).toBeNull();
        expect(validateDateFormat("100% confirmé", { allowLiteralPercent: true })).toBeNull();
        expect(validateDateFormat("%Q", { allowLiteralPercent: true })).toBeNull();
        expect(validateDateFormat("%Q")).toContain("n’est pas reconnue");
        expect(validateDateFormat("%f", {
            allowedTokenCodes: IDENTIFIER_DATE_FORMAT_TOKEN_CODES,
        })).toContain("n’est pas disponible");
        expect(validateDateFormat("1234", { maxLength: 3 })).toContain("3 caractères");
    });

    test("accepts escaped percent signs and the identifier subset", () => {
        expect(validateDateFormat("ID-%Y-%%", {
            required: true,
            allowedTokenCodes: IDENTIFIER_DATE_FORMAT_TOKEN_CODES,
        })).toBeNull();
        expect(parseDateFormat("%%")).toEqual([{ type: "text", value: "%%" }]);
        expect(filterDateFormatTokens("pourcentage")).toEqual([]);
    });

    test("limits field formats to values available in each date mode", () => {
        expect(dateFieldFormatTokenCodes("year")).toEqual(["%Y", "%y", "%%"]);
        expect(dateFieldFormatTokenCodes("month")).not.toContain("%d");
        expect(validateDateFormat("%d/%m/%Y", {
            allowedTokenCodes: dateFieldFormatTokenCodes("month"),
        })).toContain("n’est pas disponible");

        for (const mode of ["date", "month", "year"]) {
            for (const preset of dateFieldFormatPresets(mode)) {
                expect(validateDateFormat(preset.value, {
                    allowedTokenCodes: dateFieldFormatTokenCodes(mode),
                })).toBeNull();
            }
        }
    });

    test("formats short years, weekdays, and literal percent signs", () => {
        const date = new Date(2026, 6, 19, 15, 4, 5);
        expect(strftime(date, "%y-%w-%j-%%", "fr-FR")).toBe("26-0-200-%");
    });

    test("starts week numbering on the configured weekday", () => {
        expect(strftime(new Date(2023, 0, 1), "%U/%W")).toBe("01/00");
        expect(strftime(new Date(2023, 0, 2), "%U/%W")).toBe("01/01");
    });

    test("treats calendar-only values as local dates", () => {
        expect(strftime("2026", "%Y-%m-%d")).toBe("2026-01-01");
        expect(strftime("2026-07", "%Y-%m-%d")).toBe("2026-07-01");
        expect(strftime("2026-06-12", "%Y-%m-%d")).toBe("2026-06-12");
        expect(() => strftime("2026-02-30", "%Y-%m-%d")).toThrow();
    });

    test("formats fractional UTC offsets without shifting the hour", () => {
        const getTimezoneOffset = Date.prototype.getTimezoneOffset;
        Date.prototype.getTimezoneOffset = () => -330;

        try {
            expect(strftime(new Date(2026, 0, 1), "%z")).toBe("+0530");
        } finally {
            Date.prototype.getTimezoneOffset = getTimezoneOffset;
        }
    });
});
