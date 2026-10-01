<script lang="ts">
    import { onDestroy, type Snippet } from "svelte";
    import * as Icon from "lucide-svelte";
    import "./iStyler.css";
    import { Tooltip } from 'bits-ui';
    import MyTooltip from "../MyTooltip.svelte";
    
    export let label: string | undefined = undefined;
    export let placeholder: string | undefined = undefined;
    export let name: string;
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let value: number | null = null;
    export let min: number | undefined = undefined;
    export let max: number | undefined = undefined;
    export let step: number = 1;
    export let showControls: boolean = true;
    export let display: 'lateral' | 'stacked' = 'stacked';
    export let iconSide: 'left' | 'right' = 'left';
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    let parentClass: string = "";
    export { parentClass as class }
    export let prefix: string | Snippet | undefined = undefined;
    export let suffix: string | Snippet | undefined = undefined;

    export let tabindex: number | null | undefined = -1;
    
    let inputClasses: string = "";

    $: prefixSnippet = typeof prefix === "function" ? prefix : undefined;
    $: suffixSnippet = typeof suffix === "function" ? suffix : undefined;
    $: prefixText = typeof prefix === "string" ? prefix : undefined;
    $: suffixText = typeof suffix === "string" ? suffix : undefined;
    $: hasPrefix = Boolean(prefixText || prefixSnippet);
    $: hasSuffix = Boolean(suffixText || suffixSnippet);
    $: inputClasses = `${parentClass} ${showControls ? (display === 'lateral' ? '--both' : `--${iconSide}`) : ''} ${hasPrefix && hasSuffix ? '--both' : hasPrefix ? '--prefix' : hasSuffix ? '--suffix' : ''}`;

    const bump = (d: 1 | -1) => {
        if (value == null) {
            value = d > 0 ? (min ?? 0) : (max ?? 0);
            return;
        }

        const s = step.toString();
        const dec = s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
        const f = 10 ** dec; // scale factor (e.g. step 0.01 -> 100)

        const toUnits = (n: number) => Math.round(n * f);
        const fromUnits = (n: number) => n / f;

        const stepU = toUnits(step);
        let vU = toUnits(value) + d * stepU;

        if (max !== undefined) vU = Math.min(vU, Math.floor(max * f));
        if (min !== undefined) vU = Math.max(vU, Math.ceil(min * f));

        value = fromUnits(vU);
    };


    let id: ReturnType<typeof setInterval>, boost: ReturnType<typeof setTimeout>;
    const start = (d: 1 | -1) => {
        if (disabled || readonly) return;
        bump(d);
        id = setInterval(() => bump(d), 150); // slow
        boost = setTimeout(() => {
            clearInterval(id);
            id = setInterval(() => bump(d), 50); // fast
        }, 1500); // fast mode after 1.5s
    };
    const stop = () => { clearInterval(id); clearTimeout(boost); };

    const handleIncrement = (e: MouseEvent) => e.buttons === 1 && start(+1);
    const handleDecrement = (e: MouseEvent) => e.buttons === 1 && start(-1);

    onDestroy(stop);
</script>

<div class="flex w-full gap-1 flex-col">
    <span class="input-label">
        {#if label}
            {label}
        {/if}
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
    <div class="input-container {inputClasses}" data-display={display}>
        {#if display === 'lateral'}
            {#if showControls}
                <button type="button" class="input-icon --clickable-icon" disabled={disabled || (min !== undefined && value !== null && value <= min)}
                        aria-label="Diminuer"
                        on:mousedown={handleDecrement} on:mouseup={stop} on:mouseleave={stop}>
                    <Icon.Minus size=16 />
                </button>
            {/if}
            {#if prefixSnippet}
                <span class="input-affix --prefix --snippet">{@render prefixSnippet()}</span>
            {:else if prefixText}
                <span class="input-affix --prefix">{prefixText}</span>
            {/if}
            <input
                type="number"
                {placeholder}
                {name}
                {required}
                {disabled}
                {readonly}
                {min}
                {max}
                {step}
                class={parentClass}
                bind:value
            />
            {#if suffixSnippet}
                <span class="input-affix --suffix --snippet">{@render suffixSnippet()}</span>
            {:else if suffixText}
                <span class="input-affix --suffix">{suffixText}</span>
            {/if}
            {#if showControls}
                <button type="button" class="input-icon --clickable-icon" disabled={disabled || (max !== undefined && value !== null && value >= max)}
                        aria-label="Augmenter"
                        on:mousedown={handleIncrement} on:mouseup={stop} on:mouseleave={stop}>
                    <Icon.Plus size=16 />
                </button>
            {/if}
        {:else}
            {#if showControls && iconSide === "left"}
                <button type="button" class="input-icon --clickable-icon" disabled={disabled || (min !== undefined && value !== null && value <= min)}
                        aria-label="Diminuer"
                        on:mousedown={handleDecrement} on:mouseup={stop} on:mouseleave={stop}>
                    <Icon.Minus size=16 />
                </button>
                <button type="button" class="input-icon --clickable-icon" disabled={disabled || (max !== undefined && value !== null && value >= max)}
                        aria-label="Augmenter"
                        on:mousedown={handleIncrement} on:mouseup={stop} on:mouseleave={stop}>
                    <Icon.Plus size=16 />
                </button>
            {/if}
            {#if prefixSnippet}
                <span class="input-affix --prefix --snippet">{@render prefixSnippet()}</span>
            {:else if prefixText}
                <span class="input-affix --prefix">{prefixText}</span>
            {/if}
            <input
                type="number"
                {placeholder}
                {name}
                {required}
                {disabled}
                {readonly}
                {min}
                {max}
                {step}
                class={parentClass}
                bind:value
            />
            {#if suffixSnippet}
                <span class="input-affix --suffix --snippet">{@render suffixSnippet()}</span>
            {:else if suffixText}
                <span class="input-affix --suffix">{suffixText}</span>
            {/if}
            {#if showControls && iconSide === "right"}
                <button type="button" class="input-icon --clickable-icon" disabled={disabled || (min !== undefined && value !== null && value <= min)}
                        aria-label="Diminuer"
                        on:mousedown={handleDecrement} on:mouseup={stop} on:mouseleave={stop}>
                    <Icon.Minus size=16 />
                </button>
                <button type="button" class="input-icon --clickable-icon" disabled={disabled || (max !== undefined && value !== null && value >= max)}
                        aria-label="Augmenter"
                        on:mousedown={handleIncrement} on:mouseup={stop} on:mouseleave={stop}>
                    <Icon.Plus size=16 />
                </button>
            {/if}
        {/if}
    </div>
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

