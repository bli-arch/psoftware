<script lang="ts">
    import { slugify } from "$lib/utils";
    import { Accordion } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import { TextInput, Checkbox, Button, IconPicker } from "../istyler";

    type OptionConfig = {
        label: string;
        value: string | number;
        icon?: string;
        helpText?: string;
        disabled?: boolean;
        readonly?: boolean;
        hideCheckbox?: boolean;
        switchMode?: boolean;
    };

    export let label: string;
    export let value: OptionConfig[] = [];
    export let showReadonly: boolean = true;
    export let showHideCheckbox: boolean = true;
    export let showSwitchMode: boolean = false;
    export let minOptions: number = 0;
    export let onchange: ((options: OptionConfig[]) => void) | undefined = undefined;

    let newLabel = "";
    let openOptions: string[] = [];
    let nextOptionKey = 0;
    let optionKeys = (Array.isArray(value) ? value : []).map(() => `option-${nextOptionKey++}`);
    let normalizedOptions: OptionConfig[] = [];

    const optionAccordionValue = (index: number) => optionKeys[index];

    $: normalizedOptions = Array.isArray(value) ? value.map(normalizeOption) : [];

    $: if (optionKeys.length !== normalizedOptions.length) {
        optionKeys = optionKeys.length < normalizedOptions.length
            ? [
                ...optionKeys,
                ...Array.from(
                    { length: normalizedOptions.length - optionKeys.length },
                    () => `option-${nextOptionKey++}`,
                ),
            ]
            : optionKeys.slice(0, normalizedOptions.length);
    }

    $: if (minOptions > 0 && normalizedOptions.length < minOptions) {
        const nextOptions = [...normalizedOptions];

        while (nextOptions.length < minOptions) {
            const nextLabel = `Option ${nextOptions.length + 1}`;
            nextOptions.push({ label: nextLabel, value: createOptionValue(nextLabel, nextOptions) });
        }

        optionKeys = [
            ...optionKeys,
            ...Array.from(
                { length: nextOptions.length - optionKeys.length },
                () => `option-${nextOptionKey++}`,
            ),
        ];
        commit(nextOptions);
        openOptions = [optionAccordionValue(nextOptions.length - 1)];
    }

    function normalizeOption(option: Partial<OptionConfig>): OptionConfig {
        return {
            label: String(option.label ?? ""),
            value: option.value ?? option.label ?? "",
            icon: option.icon || undefined,
            helpText: option.helpText || undefined,
            disabled: Boolean(option.disabled),
            readonly: Boolean(option.readonly),
            hideCheckbox: Boolean(option.hideCheckbox),
            switchMode: Boolean(option.switchMode),
        };
    }

    function createOptionValue(optionLabel: string, sourceOptions = normalizedOptions) {
        const base = slugify(optionLabel) || crypto.randomUUID().split("-").pop()!;
        const usedValues = new Set(sourceOptions.map((option) => String(option.value)));
        if (!usedValues.has(base)) return base;

        let index = 2;
        while (usedValues.has(`${base}-${index}`)) index += 1;
        return `${base}-${index}`;
    }

    function commit(nextOptions: OptionConfig[]) {
        value = nextOptions.map(normalizeOption);
        onchange?.(value);
    }

    function add() {
        const optionLabel = newLabel.trim();
        if (!optionLabel) return;

        const nextValue = createOptionValue(optionLabel);
        const nextIndex = normalizedOptions.length;
        optionKeys = [...optionKeys, `option-${nextOptionKey++}`];
        commit([...normalizedOptions, { label: optionLabel, value: nextValue }]);
        openOptions = [optionAccordionValue(nextIndex)];
        newLabel = "";
    }

    function remove(index: number) {
        if (normalizedOptions.length <= minOptions) return;
        const removedKey = optionAccordionValue(index);
        optionKeys = optionKeys.filter((_, optionIndex) => optionIndex !== index);
        openOptions = openOptions.filter((key) => key !== removedKey);
        commit(normalizedOptions.filter((_, optionIndex) => optionIndex !== index));
    }

    function updateOption(index: number, patch: Partial<OptionConfig>) {
        commit(normalizedOptions.map((option, optionIndex) => (
            optionIndex === index ? { ...option, ...patch } : option
        )));
    }

</script>

<div class="flex flex-col gap-2">
    <span class="input-label">{label}</span>

    <div class="flex flex-col overflow-hidden rounded-lg border border-(--light-bg3) bg-(--light-bg1)">
        <Accordion.Root type="multiple" bind:value={openOptions} class="flex flex-col">
            {#each normalizedOptions as option, index (optionAccordionValue(index))}
                <Accordion.Item value={optionAccordionValue(index)} class="border-b border-(--light-bg3) last:border-b-0">
                    <Accordion.Header>
                        <Accordion.Trigger class="group flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-(--light-bg2) cursor-pointer">
                            <span class="flex min-w-0 items-center gap-2">
                                {#if option.icon && Icon[option.icon as keyof typeof Icon]}
                                    <svelte:component this={Icon[option.icon as keyof typeof Icon] as any} size={16} class="shrink-0 text-(--grey)" />
                                {/if}
                                <span class="min-w-0 truncate text-sm font-semibold text-(--dark-bg1)">
                                    {option.label || `Option ${index + 1}`}
                                </span>
                            </span>
                            <Icon.ChevronDown size={16} class="shrink-0 text-(--grey) group-data-[state=open]:rotate-180 
                                transition-all  duration-(--animation-duration-100)"/>
                        </Accordion.Trigger>
                    </Accordion.Header>

                    <MyAccordion>
                        <div class="flex flex-col gap-3 p-3">
                            <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
                                <TextInput
                                    label="Libellé"
                                    class="w-full"
                                    value={option.label}
                                    oninput={(event: Event) => updateOption(index, { label: (event.target as HTMLInputElement).value })}
                                />
                                <IconPicker
                                    label="Icône"
                                    class="w-full"
                                    value={option.icon ?? ""}
                                    onSelect={(icon) => updateOption(index, { icon: icon || undefined })}
                                />
                                <TextInput
                                    label="Texte d'aide"
                                    class="w-full"
                                    value={option.helpText ?? ""}
                                    oninput={(event: Event) => updateOption(index, { helpText: (event.target as HTMLInputElement).value.trim() || undefined })}
                                />
                            </div>

                            <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="flex flex-wrap items-center gap-4">
                                    <Checkbox
                                        label="Désactivée"
                                        value={option.disabled}
                                        on:change={(event) => updateOption(index, { disabled: event.detail })}
                                    />
                                    {#if showReadonly}
                                        <Checkbox
                                            label="Lecture seule"
                                            value={option.readonly}
                                            on:change={(event) => updateOption(index, { readonly: event.detail })}
                                        />
                                    {/if}
                                    {#if showHideCheckbox}
                                        <Checkbox
                                            label="Masquer l'indicateur de sélection"
                                            value={option.hideCheckbox}
                                            on:change={(event) => updateOption(index, { hideCheckbox: event.detail })}
                                        />
                                    {/if}
                                    {#if showSwitchMode}
                                        <Checkbox
                                            label="Interrupteur"
                                            value={option.switchMode}
                                            on:change={(event) => updateOption(index, { switchMode: event.detail })}
                                        />
                                    {/if}
                                </div>
                                {#if normalizedOptions.length > minOptions}
                                    <Button
                                        variant="ghost"
                                        icon="Trash2"
                                        tooltip="Supprimer l’option"
                                        aria-label="Supprimer l’option"
                                        class="size-8 w-8 shrink-0 border border-(--light-bg3) px-0 text-(--red) hover:bg-(--transparent-red)"
                                        onclick={() => remove(index)}
                                    />
                                {/if}
                            </div>
                        </div>
                    </MyAccordion>
                </Accordion.Item>
            {/each}
        </Accordion.Root>

        <div class="flex items-end gap-2 p-3 border-t border-(--light-bg3)">
            <TextInput
                label="Nouvelle option"
                class="grow w-full"
                placeholder="Libellé"
                bind:value={newLabel}
                onkeydown={(event: KeyboardEvent) => event.key === "Enter" && (event.preventDefault(), add())}
            />
            <Button label="Ajouter" icon="Plus" class="w-fit" onclick={add} />
        </div>
    </div>
</div>
