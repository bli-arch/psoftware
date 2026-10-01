<script lang="ts">
    import { onDestroy, onMount, type Snippet } from "svelte";
    import * as Icon from "lucide-svelte";
    import "./iStyler.css";
    import { Tooltip } from 'bits-ui';
    import MyTooltip from "../MyTooltip.svelte";
    import { setupBarcodeScanner } from "$lib/components/istyler/barcodeScanner";

    export let label: string | undefined = undefined;
    export let type: string = "text";
    export let placeholder: string | undefined = undefined;
    export let name: string | undefined = undefined;
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let hidden: boolean = false;
    export let value: string | number | null = null;
    export let icon: string | undefined = undefined;
    export let iconSide: 'left' | 'right' | undefined = undefined;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    export let prefix: string | Snippet | undefined = undefined;
    export let suffix: string | Snippet | undefined = undefined;
    export let autocomplete: string = "off";
    let parentClass: string = "";
    export {parentClass as class}

    export let tabindex: number | null | undefined = -1;

    export let scanSensitive: boolean = false; // use barcode scanner
    export let scanRegex: string | undefined = undefined; // Expression to detect, needs to be UX-friendly // Is type string and not RegExp as it comes from a JSON
    
    let inputClasses: string = "";
    let IconComponent: any = null;
    let scannerCleanup = () => {};

    $: prefixSnippet = typeof prefix === "function" ? prefix : undefined;
    $: suffixSnippet = typeof suffix === "function" ? suffix : undefined;
    $: prefixText = typeof prefix === "string" ? prefix : undefined;
    $: suffixText = typeof suffix === "string" ? suffix : undefined;
    $: hasPrefix = Boolean(prefixText || prefixSnippet);
    $: hasSuffix = Boolean(suffixText || suffixSnippet);
    $: inputClasses = `${parentClass} ${iconSide ? `--${iconSide}` : ""} ${hasPrefix && hasSuffix ? '--both' : hasPrefix ? '--prefix' : hasSuffix ? '--suffix' : ''}`;

    $: IconComponent = icon && Icon[icon as keyof typeof Icon]
        ? Icon[icon as keyof typeof Icon]
        : null;

    function onScan(scannedValue: string) {
        value = scannedValue;
    }

    onMount(() => {
        if (scanSensitive) {
            const { destroy } = setupBarcodeScanner(
                onScan,
                scanRegex ? { regex: scanRegex } : {}
            );
            scannerCleanup = destroy;
        }
    });

    onDestroy(() => {
        scannerCleanup();
    });

</script>

<div class="flex w-full gap-1 flex-col" class:hidden={hidden}>
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
    <div class="input-container {inputClasses}">
        {#if IconComponent && iconSide === "left"}
            <span class="input-icon --left">
                <svelte:component this={IconComponent} size=16/>
            </span>
        {/if}
        {#if prefixSnippet}
            <span class="input-affix --prefix --snippet">{@render prefixSnippet()}</span>
        {:else if prefixText}
            <span class="input-affix --prefix">{prefixText}</span>
        {/if}
        <input
            {type}
            {placeholder}
            {name}
            {required}
            {disabled}
            {readonly}
            {autocomplete}
            class={parentClass}
            {...$$restProps}
            bind:value={value}
        />
        {#if suffixSnippet}
            <span class="input-affix --suffix --snippet">{@render suffixSnippet()}</span>
        {:else if suffixText}
            <span class="input-affix --suffix">{suffixText}</span>
        {/if}
        {#if IconComponent && iconSide === "right"}
            <span class="input-icon --right">
                <svelte:component this={IconComponent} size=16/>
            </span>
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
