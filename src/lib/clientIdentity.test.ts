import { describe, expect, test } from "bun:test";

import { buildClientIdentityFields, resolveClientIdentity } from "./clientIdentity";

describe("client identity", () => {
    const pages = [{
        formFields: [
            { config: { name: "last_name", clientIdentityRole: "lastName" } },
            { config: { name: "first_name", clientIdentityRole: "firstName" } },
            { config: { name: "company", clientIdentityRole: "companyName" } },
        ],
    }];

    test("extracts configured identity fields", () => {
        expect(buildClientIdentityFields(pages)).toEqual({
            lastName: "last_name",
            firstName: "first_name",
            companyName: "company",
        });
    });

    test("uses the company as primary identity and the person as contact", () => {
        const identity = resolveClientIdentity({
            uid: "CLI-0042",
            data: { company: "Studio Benali", first_name: "Nadia", last_name: "Benali" },
        }, buildClientIdentityFields(pages));

        expect(identity.primary).toBe("Studio Benali");
        expect(identity.secondary).toBe("Nadia Benali");
    });

    test("falls back to the client reference when no configured value exists", () => {
        expect(resolveClientIdentity({ uid: "CLI-0042", data: {} }, buildClientIdentityFields(pages)).primary)
            .toBe("Client #CLI-0042");
    });

    test("uses a combined name field when configured", () => {
        const fields = buildClientIdentityFields([{
            items: [{ props: { name: "display_name", clientIdentityRole: "fullName" } }],
        }]);

        expect(resolveClientIdentity({ data: { display_name: "Nadia Benali" } }, fields).primary)
            .toBe("Nadia Benali");
    });
});
