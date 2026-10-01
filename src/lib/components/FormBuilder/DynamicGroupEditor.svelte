<script lang="ts">
    import { slugify } from "$lib/utils";
    import { onMount } from "svelte";
    import { Accordion } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import { Button, Checkbox, NumberInput, Select, Textarea, TextInput } from "../istyler";
    import type { DynamicGroupConfig, DynamicGroupType } from "../istyler/DynamicGroup.svelte";
    import OptionListInput from "./OptionListInput.svelte";

    type FieldOption = NonNullable<DynamicGroupConfig["options"]>[number] & {
        icon?: string;
        helpText?: string;
        disabled?: boolean;
        readonly?: boolean;
        hideCheckbox?: boolean;
        switchMode?: boolean;
    };

    export let label: string = "Champs du groupe";
    export let value: DynamicGroupConfig[] = [];

    let newFieldLabel = "";
    let openFields: string[] = [];

    const typeOptions: Array<{ label: string; value: DynamicGroupType; icon: keyof typeof Icon }> = [
        { label: "Texte", value: "text", icon: "TextCursorInput" },
        { label: "Nombre", value: "number", icon: "Hash" },
        { label: "Mot de passe", value: "password", icon: "RectangleEllipsis" },
        { label: "Liste", value: "select", icon: "ChevronsUpDown" },
        { label: "Case à cocher", value: "checkbox", icon: "CheckSquare" },
        { label: "Boutons radio", value: "radio", icon: "CircleDot" },
        { label: "Curseur", value: "range", icon: "SlidersHorizontal" },
        { label: "Date", value: "date", icon: "Calendar" },
        { label: "Zone de texte", value: "textarea", icon: "AlignLeft" },
    ];

    const optionTypes = new Set<DynamicGroupType>(["select", "radio", "checkbox"]);
    const fieldAccordionValue = (index: number) => `field-${index}`;

    onMount(() => {
        commit(fields());
    });

    function normalizeFields(source: DynamicGroupConfig[] = []) {
        if (!Array.isArray(source)) return [];

        const usedNames = new Set<string>();
        return source.map((field, index) => normalizeField(field, index, usedNames));
    }

    function normalizeField(field: Partial<DynamicGroupConfig>, index: number, usedNames: Set<string>): DynamicGroupConfig {
        const type = isDynamicGroupType(field.type) ? field.type : "text";
        const label = cleanString(field.label) || `Champ ${index + 1}`;
        const existingName = cleanString(field.name);
        const name = existingName && !usedNames.has(existingName)
            ? existingName
            : createUniqueName(existingName || label, usedNames);

        usedNames.add(name);

        const options = optionTypes.has(type)
            ? normalizeOptions(field.options)
            : field.options;

        return {
            ...field,
            name,
            label,
            type,
            placeholder: cleanString(field.placeholder),
            required: Boolean(field.required),
            helpText: cleanString(field.helpText),
            ...(options ? { options } : {}),
            value: field.value === undefined ? defaultValueForType(type, options) : field.value,
        } as DynamicGroupConfig;
    }

    function isDynamicGroupType(type: unknown): type is DynamicGroupType {
        return typeOptions.some((option) => option.value === type);
    }

    function cleanString(input: unknown) {
        return typeof input === "string" ? input.trim() : "";
    }

    function createUniqueName(source: string, usedNames = new Set<string>()) {
        const base = slugify(source) || "champ";
        if (!usedNames.has(base)) return base;

        let index = 2;
        while (usedNames.has(`${base}-${index}`)) index += 1;
        return `${base}-${index}`;
    }

    function normalizeOptions(options: DynamicGroupConfig["options"]): FieldOption[] {
        const source = Array.isArray(options) && options.length
            ? options
            : [
                { label: "Option 1", value: "option-1" },
                { label: "Option 2", value: "option-2" },
            ];

        return source.map((option, index) => ({
            ...option,
            label: cleanString(option.label) || `Option ${index + 1}`,
            value: option.value ?? `option-${index + 1}`,
        }));
    }

    function defaultValueForType(type: DynamicGroupType, options?: DynamicGroupConfig["options"]) {
        if (type === "checkbox") return Array.isArray(options) && options.length ? [] : false;
        if (type === "number" || type === "range") return null;
        return "";
    }

    function fieldTypeLabel(type: DynamicGroupType) {
        return typeOptions.find((option) => option.value === type)?.label ?? "Texte";
    }

    function fieldTypeIcon(type: DynamicGroupType) {
        const iconName = typeOptions.find((option) => option.value === type)?.icon;
        return iconName ? Icon[iconName] : Icon.TextCursorInput;
    }

    function fields() {
        return normalizeFields(value);
    }

    function commit(nextFields: DynamicGroupConfig[]) {
        value = normalizeFields(nextFields);
    }

    function addField() {
        const fieldLabel = newFieldLabel.trim() || `Champ ${fields().length + 1}`;
        const nextIndex = fields().length;

        commit([
            ...fields(),
            {
                name: createUniqueName(fieldLabel, new Set(fields().map((field) => field.name))),
                label: fieldLabel,
                type: "text",
                placeholder: "",
                required: false,
                value: "",
            },
        ]);

        openFields = [fieldAccordionValue(nextIndex)];
        newFieldLabel = "";
    }

    function removeField(index: number) {
        commit(fields().filter((_, fieldIndex) => fieldIndex !== index));
    }

    function updateField(index: number, patch: Partial<DynamicGroupConfig>) {
        commit(fields().map((field, fieldIndex) => (
            fieldIndex === index ? { ...field, ...patch } : field
        )));
    }

    function updateFieldType(index: number, type: DynamicGroupType) {
        const field = fields()[index];
        const options = optionTypes.has(type)
            ? normalizeOptions(field.options)
            : field.options;

        updateField(index, {
            type,
            ...(optionTypes.has(type) ? { options } : {}),
            value: defaultValueForType(type, options),
        });
    }

    function updateOptions(index: number, options: FieldOption[]) {
        const field = fields()[index];
        const validValues = new Set(options.map((option) => String(option.value)));
        const nextValue = field.type === "checkbox"
            ? Array.isArray(field.value)
                ? field.value.filter((selected) => validValues.has(String(selected)))
                : []
            : field.value === undefined || field.value === null || field.value === "" || validValues.has(String(field.value))
                ? field.value
                : undefined;

        updateField(index, { options, value: nextValue });
    }

    function updateNumberValue(index: number, key: keyof DynamicGroupConfig, input: unknown) {
        const number = Number(input);
        updateField(index, { [key]: Number.isFinite(number) ? number : null } as Partial<DynamicGroupConfig>);
    }
</script>

<div class="flex flex-col gap-2">
    <span class="input-label">{label}</span>

    <div class="flex flex-col overflow-hidden rounded-lg border border-(--light-bg3) bg-(--light-bg1)">
        <Accordion.Root type="multiple" bind:value={openFields} class="flex flex-col">
            {#each fields() as field, index (field.name)}
                {@const TypeIcon = fieldTypeIcon(field.type)}
                <Accordion.Item value={fieldAccordionValue(index)} class="border-b border-(--light-bg3) last:border-b-0">
                    <Accordion.Header>
                        <Accordion.Trigger class="group flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-2 text-left hover:bg-(--light-bg2)">
                            <span class="flex min-w-0 items-center gap-2">
                                <svelte:component this={TypeIcon as any} size={16} class="shrink-0 text-(--grey)" />
                                <span class="min-w-0 truncate text-sm font-semibold text-(--dark-bg1)">
                                    {field.label || `Champ ${index + 1}`}
                                </span>
                                <span class="shrink-0 rounded bg-(--light-bg2) px-1.5 py-0.5 text-[11px] font-medium text-(--grey)">
                                    {fieldTypeLabel(field.type)}
                                </span>
                                <span class="shrink-0 rounded bg-(--light-bg2) px-1.5 py-0.5 font-mono text-[11px] text-(--grey)">
                                    {field.name}
                                </span>
                            </span>
                            <Icon.ChevronDown
                                size={16}
                                class="shrink-0 text-(--grey) transition-all duration-(--animation-duration-100) group-data-[state=open]:rotate-180"
                            />
                        </Accordion.Trigger>
                    </Accordion.Header>

                    <MyAccordion>
                        <div class="flex flex-col gap-4 p-3">
                            <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <TextInput
                                    label="Libellé"
                                    placeholder="ex: Nom de l'article"
                                    class="w-full"
                                    value={field.label}
                                    oninput={(event: Event) => updateField(index, { label: (event.target as HTMLInputElement).value })}
                                />
                                <TextInput
                                    label="Identifiant"
                                    placeholder="ex: nom_article"
                                    class="w-full"
                                    value={field.name}
                                    helpText="Clé du champ dans les données."
                                    helpTextIcon
                                    oninput={(event: Event) => updateField(index, { name: slugify((event.target as HTMLInputElement).value) })}
                                />
                                <Select
                                    label="Type"
                                    name={`dynamic-field-type-${index}`}
                                    options={typeOptions}
                                    allowDeselect={false}
                                    value={field.type}
                                    onchange={(nextType) => updateFieldType(index, (nextType as DynamicGroupType) ?? field.type)}
                                />
                                <Checkbox
                                    label="Obligatoire"
                                    value={field.required ?? false}
                                    on:change={(event: CustomEvent<boolean>) => updateField(index, { required: event.detail ?? false })}
                                />
                                <TextInput
                                    label="Texte indicatif"
                                    placeholder="ex: Saisir une valeur"
                                    class="w-full"
                                    value={field.placeholder ?? ""}
                                    oninput={(event: Event) => updateField(index, { placeholder: (event.target as HTMLInputElement).value })}
                                />
                                <TextInput
                                    label="Texte d'aide"
                                    placeholder="ex: Visible sous le champ"
                                    class="w-full"
                                    value={field.helpText ?? ""}
                                    oninput={(event: Event) => updateField(index, { helpText: (event.target as HTMLInputElement).value })}
                                />
                            </div>

                            {#if field.type === "textarea"}
                                <div class="grid grid-cols-1 gap-2">
                                    <Textarea
                                        label="Valeur par défaut"
                                        value={field.value ?? ""}
                                        on:input={(event: Event) => updateField(index, { value: (event.target as HTMLTextAreaElement).value })}
                                    />
                                </div>
                            {:else if field.type === "number" || field.type === "range"}
                                <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
                                    <NumberInput
                                        label="Valeur par défaut"
                                        name={`dynamic-field-default-${index}`}
                                        value={field.value ?? null}
                                        display="lateral"
                                        on:input={(event: Event) => updateNumberValue(index, "value", (event.target as HTMLInputElement).value)}
                                    />
                                    <NumberInput
                                        label="Minimum"
                                        name={`dynamic-field-min-${index}`}
                                        value={field.min ?? null}
                                        display="lateral"
                                        on:input={(event: Event) => updateNumberValue(index, "min", (event.target as HTMLInputElement).value)}
                                    />
                                    <NumberInput
                                        label="Maximum"
                                        name={`dynamic-field-max-${index}`}
                                        value={field.max ?? null}
                                        display="lateral"
                                        on:input={(event: Event) => updateNumberValue(index, "max", (event.target as HTMLInputElement).value)}
                                    />
                                    <NumberInput
                                        label="Pas"
                                        name={`dynamic-field-step-${index}`}
                                        value={field.step ?? 1}
                                        min={0}
                                        step={0.1}
                                        display="lateral"
                                        on:input={(event: Event) => updateNumberValue(index, "step", (event.target as HTMLInputElement).value)}
                                    />
                                    <TextInput
                                        label="Préfixe"
                                        value={field.prefix ?? ""}
                                        oninput={(event: Event) => updateField(index, { prefix: (event.target as HTMLInputElement).value })}
                                    />
                                    <TextInput
                                        label="Suffixe"
                                        value={field.suffix ?? ""}
                                        oninput={(event: Event) => updateField(index, { suffix: (event.target as HTMLInputElement).value })}
                                    />
                                </div>
                            {:else if optionTypes.has(field.type)}
                                <div class="flex flex-col gap-3">
                                    <OptionListInput
                                        label="Options"
                                        value={field.options ?? []}
                                        minOptions={1}
                                        showReadonly
                                        showHideCheckbox={field.type !== "select"}
                                        showSwitchMode={field.type === "checkbox"}
                                        onchange={(options) => updateOptions(index, options)}
                                    />
                                    <Select
                                        label="Valeur par défaut"
                                        name={`dynamic-field-default-${index}`}
                                        options={field.options ?? []}
                                        multiple={field.type === "checkbox"}
                                        allowDeselect
                                        placeholder="Aucune valeur par défaut"
                                        value={field.value}
                                        onchange={(nextValue) => updateField(index, { value: nextValue })}
                                    />
                                </div>
                            {:else}
                                <TextInput
                                    label="Valeur par défaut"
                                    class="w-full"
                                    value={field.value ?? ""}
                                    oninput={(event: Event) => updateField(index, { value: (event.target as HTMLInputElement).value })}
                                />
                            {/if}

                            <div class="flex justify-end">
                                <Button
                                    variant="error"
                                    icon="Trash2"
                                    class="w-fit px-3"
                                    label="Supprimer"
                                    onclick={() => removeField(index)}
                                />
                            </div>
                        </div>
                    </MyAccordion>
                </Accordion.Item>
            {/each}
        </Accordion.Root>

        {#if !fields().length}
            <p class="border-t border-(--light-bg3) px-3 py-2 text-xs text-(--grey)">
                Ajoutez des champs à répéter dans ce groupe.
            </p>
        {/if}

        <div class="flex items-end gap-2 border-t border-(--light-bg3) p-3">
            <TextInput
                label="Nouveau champ"
                class="w-full grow"
                placeholder="Libellé"
                bind:value={newFieldLabel}
                onkeydown={(event: KeyboardEvent) => event.key === "Enter" && (event.preventDefault(), addField())}
            />
            <Button label="Ajouter" icon="Plus" class="w-fit" onclick={addField} />
        </div>
    </div>
</div>
