<script lang="ts">
    import { PinInput, Tooltip } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { twMerge } from "tailwind-merge";
    import MyTooltip from "../MyTooltip.svelte";
    import "./iStyler.css";

    export let label: string | undefined = undefined;
    export let value = "";
    export let digits = 6;
    export let required = false;
    export let disabled = false;
    export let name: string | undefined = undefined;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon = false;
    export let masked = true;
    export let onComplete: (() => unknown | Promise<unknown>) | undefined = undefined;
    export let tabindex: number | null | undefined = -1;
    export let cellsClass = "";
    export let cellClass = "";
    let parentClass = "";
    export { parentClass as class };

    const sanitize = (input: string, count: number) => String(input ?? "").replace(/\D/g, "").slice(0, count);

    $: digitCount = Math.max(1, Math.min(12, Math.trunc(Number(digits) || 6)));
    $: {
        const nextValue = sanitize(value, digitCount);
        if (value !== nextValue) value = nextValue;
    }

    function handleComplete() {
        if (value.length === digitCount) {
            void onComplete?.();
        }
    }
</script>

<div class={twMerge("flex w-full flex-col gap-1", parentClass)}>
    {#if label}
        <span class="input-label">
            {label}
            {#if required}
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={150}>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <button type="button" class="required-star" {...props} tabindex={tabindex} >
                                    <Icon.Asterisk size=16 fill="var(--red)"/>
                                </button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <MyTooltip>Cette donnée est requise</MyTooltip>
                    </Tooltip.Root>
                </Tooltip.Provider>
            {/if}
        </span>
    {/if}

    <PinInput.Root
        bind:value
        pattern="^\d+$"
        maxlength={digitCount}
        {name}
        {disabled}
        onComplete={handleComplete}
        class="h-14 w-full"
    >
        {#snippet children({ cells })}
            <div class={twMerge("flex h-full w-full gap-2 text-sm text-(--dark-bg1)", cellsClass)}>
                {#each cells as cell}
                    <PinInput.Cell
                        {cell}
                        class={twMerge(
                            "relative flex h-full w-full items-center justify-center rounded-lg border border-(--light-bg3) bg-(--light-bg1) text-4xl font-medium font-(family-name:--font) transition-all duration-(--animation-duration)",
                            cell.hasFakeCaret ? "border-(--user-color)" : "",
                            disabled ? "cursor-not-allowed opacity-60" : "",
                            cellClass,
                        )}
                    >
                        {#if cell.char !== null}
                            <div class="flex-center">
                                {#if masked}
                                    <Icon.Asterisk />
                                {:else}
                                    {cell.char}
                                {/if}
                            </div>
                        {/if}
                        {#if cell.hasFakeCaret}
                            <div class="pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-(--animation-duration-100)">
                                <div class="caret-bar h-8 w-px bg-(--dark-bg1)"></div>
                            </div>
                        {/if}
                    </PinInput.Cell>
                {/each}
            </div>
        {/snippet}
    </PinInput.Root>

    {#if helpText}
        <span class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon">
                    <Icon.Info />
                </span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
