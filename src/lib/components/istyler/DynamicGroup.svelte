<script lang="ts">
    import "./iStyler.css";
    import TextInput from "./TextInput.svelte";
    import NumberInput from "./NumberInput.svelte";
    import PasswordInput from "./PasswordInput.svelte";
    import SelectInput from "./Select.svelte";
    import CheckboxInput from "./Checkbox.svelte";
    import RadioInput from "./Radio.svelte";
    import RangeInput from "./Range.svelte";
    import DateInput from "./Date.svelte";
    import TextareaInput from "./Textarea.svelte";
    import { Checkbox, Button } from "$lib/components/istyler";
    import { Tooltip } from "bits-ui";
    import MyTooltip from "../MyTooltip.svelte";

    export type DynamicGroupType =
        | "text"
        | "number"
        | "password"
        | "select"
        | "checkbox"
        | "radio"
        | "range"
        | "date"
        | "textarea";

    export type DynamicGroupConfig = {
        name: string;
        label: string;
        type: DynamicGroupType;
        placeholder?: string;
        required?: boolean;
        description?: string;
        prefix?: string;
        suffix?: string;
        checkable?: boolean;
        options?: { label: string; value: string | number; done?: boolean }[];
        value?: any;
        [key: string]: any;
    }

    let {
        label = "Dynamic group",
        itemLabel = "Item",
        addLabel = "Add item",
        description,
        minItems = 1,
        maxItems = null,
        showCount = true,
        allowDuplicate = false,
        allowRemove = true,
        checkable = false,
        value = $bindable<Record<string, any>[]>(),
        fields = [],
    } = $props<{
        label?: string;
        itemLabel?: string;
        addLabel?: string;
        description?: string;
        minItems?: number;
        maxItems?: number | null;
        showCount?: boolean;
        allowDuplicate?: boolean;
        allowRemove?: boolean;
        checkable?: boolean;
        value?: Record<string, any>[];
        fields?: DynamicGroupConfig[];
    }>();

    const componentMap: Record<DynamicGroupType, any> = {
        text: TextInput,
        number: NumberInput,
        password: PasswordInput,
        select: SelectInput,
        checkbox: CheckboxInput,
        radio: RadioInput,
        range: RangeInput,
        date: DateInput,
        textarea: TextareaInput,
    };

    const minAllowed = () => Math.max(0, minItems ?? 0);
    const entries = $derived(Array.isArray(value) ? value : []);

    function deepCopy<T>(obj: T): T {
        return JSON.parse(JSON.stringify(obj));
    }

    function makeEmptyEntry() {
        const entry: Record<string, any> = {};
        fields.forEach((f: DynamicGroupConfig) => {
            if (f.value !== undefined) entry[f.name] = f.value;
            else if (f.type === "checkbox") entry[f.name] = false;
            else entry[f.name] = "";
        });
        if (checkable) {
            entry.done = false;
        }
        return entry;
    }

    // ensure value is always an array
    $effect(() => {
        if (!Array.isArray(value)) {
            value = [];
        }
    });

    // enforce minItems
    $effect(() => {
        const targetLength = minAllowed();
        let next = entries;
        while (next.length < targetLength) {
            next = [...next, makeEmptyEntry()];
        }
        if (next !== value) {
            value = next;
        }
    });

    // whether a new item can be added
    const canAddMore = $derived(
        maxItems == null || entries.length < maxItems
    );

    // ensure entries always have all fields (+ done when checkable)
    $effect(() => {
        if (!(fields?.length || checkable)) return;

        const hasMissingField = entries.some((entry: any) =>
            fields.some((f: DynamicGroupConfig) => entry[f.name] === undefined) ||
            (checkable && !("done" in entry))
        );

        if (hasMissingField) {
            value = entries.map((entry: any) => {
                const base = makeEmptyEntry();
                return { ...base, ...entry };
            });
        }
    });

    function commitEntry(idx: number, entry: Record<string, any>) {
        value = entries.map((item: any, i: number) => (i === idx ? { ...entry } : item));
    }

    function addItem(copyIndex?: number) {
        if (!canAddMore) return;
        const base =
            copyIndex !== undefined && entries[copyIndex]
                ? deepCopy(entries[copyIndex])
                : makeEmptyEntry();
        value = [...entries, base];
    }

    function duplicateItem(idx: number) {
        addItem(idx);
    }

    function removeItem(idx: number) {
        if (!allowRemove) return;
        const minCount = minAllowed();
        if (entries.length <= minCount) return;
        value = entries.filter((_: any, i: number) => i !== idx);
    }

    function wasChecked(idx: number, checked: boolean) {
        if (!checkable) return;
        value = entries.map((item: any, i: number) => (i === idx ? { ...item, done: checked } : item));
    }

    const total = $derived(entries.length);

    const doneCount = $derived(
        checkable ? entries.filter((x: any) => x.done === true).length : 0
    );

</script>

<div class="flex flex-col gap-2">
    <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex flex-col">
            <span class="input-label">{label}</span>
            {#if description}
                <span class="input-help-text">{description}</span>
            {/if}
        </div>
        <div class="flex items-center gap-2">
            {#if showCount}
                {#if checkable}
                    <span class="size-8 flex-center bg-(--light-bg3) font-bold text-(--grey) rounded-lg text-xs">
                        {doneCount} / {total}
                    </span>
                {:else}
                    <span class="size-8 flex-center bg-(--light-bg3) font-bold text-(--grey) rounded-lg text-xs">
                        {total}
                    </span>
                {/if}
            {/if}
            <Button
                label={addLabel || `Add ${itemLabel}`}
                icon="Plus"
                class="w-auto px-3"
                disabled={!canAddMore}
                onclick={() => addItem()}
            />
        </div>
    </div>

    {#if !fields?.length}
        <div class="rounded-lg border border-(--light-bg3) bg-(--light-bg2) px-3 py-2 text-sm text-(--grey)">
            Aucun champ dans ce groupe.
        </div>
    {:else}
        <div class="flex flex-col gap-3">
            {#each entries as entry, idx}
                <div class={`transition-all duration-(--animation-duration) rounded-lg border border-(--light-bg3) p-3 flex flex-col gap-3 ${entries[idx].done ? "bg-(--light-bg2)" : "bg-(--light-bg1)"}`}>
                    <div class="flex items-center justify-between gap-2">
                        <div class="flex items-center gap-2 w-full">
                            {#if checkable}
                                <div class="w-fit">
                                    <Checkbox
                                        value={entries[idx].done}
                                        on:change={(e) => wasChecked(idx, e.detail ?? false)}
                                    />
                                </div>
                            {/if}
                            <div class="font-semibold flex-1">
                                {itemLabel} {idx + 1}
                            </div>
                        </div>
                        <div class="flex items-center gap-1">
                            <!-- {#if !!allowDuplicate}
                                <Tooltip.Provider delayDuration={150}>
                                    <Tooltip.Root>
                                        <Tooltip.Trigger>
                                            <Button
                                                variant="ghost"
                                                icon="Copy"
                                                class="w-8 px-2 hover:text-(--blue)"
                                                disabled={!canAddMore}
                                                onclick={() => duplicateItem(idx)}
                                            />
                                        </Tooltip.Trigger>
                                        <MyTooltip>
                                            Dupliquer cet {itemLabel.toLowerCase()}
                                        </MyTooltip>
                                    </Tooltip.Root>
                                </Tooltip.Provider>
                            {/if} -->
                            {#if allowRemove}
                            <Tooltip.Provider delayDuration={150}>
                                <Tooltip.Root>
                                    <Tooltip.Trigger disabled={entries[idx].done}>
                                        {#snippet child({ props })}
                                            <Button
                                                {...props}
                                                variant="ghost"
                                                icon="Trash2"
                                                class={`w-8 px-2 ${entries[idx].done ? "text-(--grey)" : "hover:text-(--red)"}`}
                                                disabled={entries.length <= minAllowed() || entries[idx].done}
                                                onclick={() => removeItem(idx)}
                                            />
                                        {/snippet}
                                    </Tooltip.Trigger>
                                    <MyTooltip>
                                        Supprimer cet {itemLabel.toLowerCase()}
                                    </MyTooltip>
                                </Tooltip.Root>
                            </Tooltip.Provider>
                            {/if}
                        </div>
                    </div>

                    <div class="grid gap-2 grid-cols-1 md:grid-cols-2">
                        {#each fields as field}
                            {@const Comp = componentMap[field.type as DynamicGroupType]}
                            <div>
                                {#if Comp}
                                    <Comp
                                        disabled={entries[idx].done}
                                        {...field}
                                        name={`${field.name}-${idx}`}
                                        bind:value={entry[field.name]}
                                        on:input={() => commitEntry(idx, entry)}
                                        on:change={() => commitEntry(idx, entry)}
                                    />
                                {:else}
                                    <div class="text-sm text-(--red)">
                                        Unsupported field type: {field.type}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
