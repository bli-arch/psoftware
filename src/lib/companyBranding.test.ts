import { beforeAll, beforeEach, describe, expect, mock, test } from "bun:test";
import { get, type Writable } from "svelte/store";

let companyBranding: Writable<{ companyName: string; logoUrl: string | null }>;
let prepareCompanyBranding: typeof import("./companyBranding").prepareCompanyBranding;

const values = new Map<string, string>();

beforeAll(async () => {
    mock.module("$app/environment", () => ({ browser: true }));
    mock.module("$app/navigation", () => ({ goto: () => Promise.resolve() }));
    Object.defineProperty(globalThis, "localStorage", {
        configurable: true,
        value: {
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => values.set(key, value),
        },
    });
    ({ companyBranding, prepareCompanyBranding } = await import("./companyBranding"));
});

beforeEach(() => values.clear());

describe("company branding", () => {
    test("keeps cached server branding when an older bootstrap omits it", async () => {
        const serverId = "12345678-1234-1234-1234-123456789abc";
        await prepareCompanyBranding(serverId, { companyName: "Boutique Lyon", logoHash: "" });
        await prepareCompanyBranding(serverId, { companyName: null, logoHash: null });

        expect(get(companyBranding)).toEqual({ companyName: "Boutique Lyon", logoUrl: null });
    });
});
