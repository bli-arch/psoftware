<script lang="ts" context="module">
    import type { TableCellDisplay } from "$lib/components/table/tableDisplays";

    export type DisplayOption =
        | TableCellDisplay
        | string
        | {
            label?: string;
            value: TableCellDisplay | string;
            icon?: string;
            helpText?: string;
            sampleValue?: unknown;
            disabled?: boolean;
            readonly?: boolean;
        };
</script>

<script lang="ts">
    import Radio from "$lib/components/istyler/Radio.svelte";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import {
        TABLE_CELL_DISPLAYS,
        tableCellDisplayOptions,
        type TableCellDisplay as TableCellDisplayType
    } from "$lib/components/table/tableDisplays";

    export let label: string | undefined = undefined;
    export let description: string | undefined = undefined;
    export let value: TableCellDisplayType | string = "text";
    export let name = "display-mode";
    export let options: DisplayOption[] = tableCellDisplayOptions.map(({ value }) => value);
    export let sampleValue: unknown = undefined;
    export let setting: Record<string, any> = {};
    export let dynamicGroup: { total: number; done: number; text: string } | null = null;
    export let disabled = false;
    export let showPreview = true;
    export let showOptions = true;
    export let groupClass = "grid grid-cols-2 gap-2";
    export let parentClass = "min-h-18";
    export let onchange: ((value: TableCellDisplayType | string) => void) | undefined = undefined;

    function isDisplayKey(display: string): display is TableCellDisplayType {
        return display in TABLE_CELL_DISPLAYS;
    }

    function normalizeOption(option: DisplayOption) {
        const optionValue = typeof option === "string" ? option : option.value;
        const config = isDisplayKey(String(optionValue)) ? TABLE_CELL_DISPLAYS[optionValue as TableCellDisplayType] : null;

        return {
            value: optionValue,
            label: typeof option === "string" ? config?.label ?? option : option.label ?? config?.label ?? String(optionValue),
            icon: typeof option === "string" ? config?.icon : option.icon ?? config?.icon,
            helpText: typeof option === "string" ? config?.helpText : option.helpText ?? config?.helpText,
            sampleValue: typeof option === "string" ? config?.sampleValue : option.sampleValue ?? config?.sampleValue ?? "",
            disabled: typeof option === "string" ? false : option.disabled,
            readonly: typeof option === "string" ? false : option.readonly,
            hideCheckbox: true
        };
    }

    $: normalizedOptions = options.map(normalizeOption);
    $: selectedOption = normalizedOptions.find((option) => String(option.value) === String(value)) ?? normalizedOptions[0];
    $: previewValue = sampleValue === null || sampleValue === undefined || sampleValue === ""
        ? selectedOption?.sampleValue ?? ""
        : sampleValue;

    function handleChange(event: CustomEvent<TableCellDisplayType | string>) {
        onchange?.(event.detail);
    }
</script>

{#snippet preview()}
    <div
        data-settings-snap="display-preview"
        class="sticky top-0 z-30 -mx-5 h-38 shrink-0 overflow-hidden bg-(--light-bg1)"
        style="scroll-snap-align: start; scroll-snap-stop: always;"
    >
        <div class="flex h-full flex-col justify-between px-5 py-4">
            <div class="flex flex-col gap-0.5">
                {#if label}
                    <h3 class="text-xs font-semibold uppercase tracking-wide text-(--dark-bg1)">{label}</h3>
                {/if}
                {#if description}
                    <p class="text-xs leading-4 text-(--grey)">{description}</p>
                {/if}
            </div>

            <div class="flex min-h-0 flex-1 items-center justify-center">
                <div class="max-w-full select-none">
                    <DisplayValue
                        value={previewValue}
                        display={selectedOption?.value ?? "text"}
                        {setting}
                        {dynamicGroup}
                    />
                </div>
            </div>
        </div>
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-(--light-bg2) to-transparent"></div>
    </div>
{/snippet}

{#if showPreview && !showOptions}
    {@render preview()}
{:else if showPreview || showOptions}
    <div class="flex w-full flex-col gap-3">
        {#if showPreview}
            {@render preview()}
        {/if}

        {#if showOptions}
            <Radio
                {name}
                {disabled}
                bind:value
                box
                checkmark={false}
                direction="horizontal"
                {groupClass}
                {parentClass}
                options={normalizedOptions}
                on:change={handleChange}
            />
        {/if}
    </div>
{/if}
