import { normalizeFormConfig, recordList, recordOrEmpty } from "$lib/formConfig";
import type { TrackingLabelField } from "$lib/trackingLabel";

function formFieldConfig(item: unknown) {
    const field = recordOrEmpty(item);
    if (field.config && typeof field.config === "object" && !Array.isArray(field.config)) {
        return recordOrEmpty(field.config);
    }
    if (field.props && typeof field.props === "object" && !Array.isArray(field.props)) {
        return recordOrEmpty(field.props);
    }
    return field;
}

function sampleFieldValue(config: Record<string, unknown>, label: string) {
    const value = config.value;
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
    if (typeof value === "boolean") return value ? "Oui" : "Non";

    const type = typeof config.type === "string" ? config.type : "";
    const firstOption = recordList(config.options).flatMap((option) => {
        if (Array.isArray(option.options)) return recordList(option.options);
        return [option];
    })[0];
    if (firstOption) {
        const optionLabel = firstOption.label ?? firstOption.value;
        if (typeof optionLabel === "string" || typeof optionLabel === "number") return String(optionLabel);
    }

    if (type === "date") return "14/08/2026";
    if (type === "number" || type === "range") return "42";
    if (type === "checkbox") return "Oui";
    if (type === "dynamicgroup") return "2 éléments";
    if (type === "textarea") return "Informations complémentaires";
    return `Exemple ${label.toLocaleLowerCase("fr-FR")}`;
}

export function extractTrackingLabelFormFields(formData: unknown, source: "Opération" | "Client") {
    const form = normalizeFormConfig(formData);
    if (!form) return [];

    const seenNames = new Set<string>();
    return form.form.pages.flatMap((page, pageIndex) => {
        if (source === "Opération" && page.type === "client") return [];

        const pageLabel = typeof page.title === "string" && page.title.trim()
            ? page.title.trim()
            : `Page ${pageIndex + 1}`;
        const items = recordList(Array.isArray(page.items) ? page.items : page.formFields);

        return items.flatMap((item) => {
            const config = formFieldConfig(item);
            const name = typeof config.name === "string" ? config.name.trim() : "";
            const type = typeof (item.type ?? config.type) === "string" ? String(item.type ?? config.type) : "";
            if (!name || type === "password" || seenNames.has(name)) return [];
            seenNames.add(name);

            const label = typeof config.label === "string" && config.label.trim() ? config.label.trim() : name;
            return [{
                id: `form:${source === "Opération" ? "operation" : "client"}:${name}`,
                label,
                source,
                page: pageLabel,
                sample: sampleFieldValue({ ...config, type }, label),
                enabled: false,
                wide: type === "textarea" || type === "dynamicgroup" || Boolean(config.clientIdentityRole),
                showLabel: true,
            } satisfies TrackingLabelField];
        });
    });
}
