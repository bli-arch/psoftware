import { isRecord, recordList, recordOrEmpty } from "$lib/formConfig";

export const CLIENT_IDENTITY_ROLES = ["lastName", "firstName", "fullName", "companyName"] as const;

export type ClientIdentityRole = typeof CLIENT_IDENTITY_ROLES[number];
export type ClientIdentityFields = Partial<Record<ClientIdentityRole, string>>;

export const CLIENT_IDENTITY_OPTIONS: Array<{
    label: string;
    value: ClientIdentityRole | "";
    icon: string;
}> = [
    { label: "Aucun", value: "", icon: "CircleOff" },
    { label: "Nom", value: "lastName", icon: "UserRound" },
    { label: "Prénom", value: "firstName", icon: "UserRound" },
    { label: "Nom & prénom", value: "fullName", icon: "ContactRound" },
    { label: "Nom d’entreprise", value: "companyName", icon: "Building2" },
];

function fieldConfig(field: unknown) {
    if (!isRecord(field)) return {};
    if (isRecord(field.config)) return field.config;
    if (isRecord(field.props)) return field.props;
    return field;
}

export function buildClientIdentityFields(pages: unknown): ClientIdentityFields {
    const fields: ClientIdentityFields = {};

    for (const page of recordList(pages)) {
        const pageFields = recordList(Array.isArray(page.formFields) ? page.formFields : page.items);
        for (const field of pageFields) {
            const config = fieldConfig(field);
            const role = config.clientIdentityRole;
            const name = typeof config.name === "string" ? config.name.trim() : "";
            if (name && CLIENT_IDENTITY_ROLES.includes(role as ClientIdentityRole) && !fields[role as ClientIdentityRole]) {
                fields[role as ClientIdentityRole] = name;
            }
        }
    }

    return fields;
}

export function resolveClientIdentity(client: unknown, fields: ClientIdentityFields = {}) {
    const record = recordOrEmpty(client);
    const source = isRecord(record.data) ? record.data : record;
    const value = (role: ClientIdentityRole) => {
        const key = fields[role];
        const raw = key ? source[key] : null;
        return typeof raw === "string" || typeof raw === "number" ? String(raw).trim() : "";
    };

    const companyName = value("companyName");
    const fullName = value("fullName");
    const personName = fullName || [value("firstName"), value("lastName")].filter(Boolean).join(" ");
    const reference = String(record.uid ?? record.id ?? "").trim();

    return {
        companyName,
        personName,
        primary: companyName || personName || (reference ? `Client #${reference}` : "Client"),
        secondary: companyName && personName && companyName !== personName ? personName : "",
    };
}
