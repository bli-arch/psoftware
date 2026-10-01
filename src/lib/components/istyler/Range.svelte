<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { Tooltip } from "bits-ui";
    import { createEventDispatcher } from "svelte";
    import MyTooltip from "../MyTooltip.svelte";
    import {
        clampRangeNumber,
        normalizeRangeBounds,
        normalizeRangeStep,
        readIntervalRangeValue,
        readSingleRangeValue,
        type RangeValue,
    } from "./rangeValue";
    import "./iStyler.css";

    export let label: string | undefined = undefined;
    export let name: string | undefined = undefined;
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let value: RangeValue = null;
    export let min: number | string | null | undefined = 0;
    export let max: number | string | null | undefined = 100;
    export let step: number | string | null | undefined = 1;
    export let range: boolean = false;
    export let showValue: boolean = true;
    export let showBounds: boolean = true;
    export let prefix: string | null | undefined = "";
    export let suffix: string | null | undefined = "";
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    export let parentClass: string = "";
    export { parentClass as class };
    export let tabindex: number | null | undefined = -1;

    const dispatch = createEventDispatcher<{ input: number | [number, number]; change: number | [number, number] }>();

    const format = (candidate: number, valuePrefix: string | null | undefined, valueSuffix: string | null | undefined) =>
        `${valuePrefix ?? ""}${candidate}${valueSuffix ?? ""}`;

    $: [inputMin, inputMax] = normalizeRangeBounds(min, max);
    $: inputStep = normalizeRangeStep(step);
    $: inputRange = inputMax - inputMin;

    const progress = (candidate: number, lower: number, rangeSize: number) => rangeSize === 0 ? 0 : ((candidate - lower) / rangeSize) * 100;

    $: singleValue = readSingleRangeValue(value, inputMin, inputMax);
    $: rangeValue = readIntervalRangeValue(value, inputMin, inputMax);
    $: lowValue = rangeValue[0];
    $: highValue = rangeValue[1];
    $: singleProgress = progress(singleValue, inputMin, inputRange);
    $: lowProgress = progress(lowValue, inputMin, inputRange);
    $: highProgress = progress(highValue, inputMin, inputRange);
    $: formattedValue = range
        ? `${format(lowValue, prefix, suffix)} - ${format(highValue, prefix, suffix)}`
        : format(singleValue, prefix, suffix);
    $: isLocked = disabled || readonly;

    function commitSingle(nextValue: number) {
        if (isLocked) return;
        value = clampRangeNumber(nextValue, inputMin, inputMax);
        dispatch("input", value);
    }

    function commitRange(nextLow: number, nextHigh: number) {
        if (isLocked) return;
        const low = clampRangeNumber(nextLow, inputMin, inputMax);
        const high = clampRangeNumber(nextHigh, inputMin, inputMax);
        value = [low, high];
        dispatch("input", value);
    }

    function handleSingleInput(event: Event & { currentTarget: HTMLInputElement }) {
        commitSingle(Number(event.currentTarget.value));
    }

    function handleLowInput(event: Event & { currentTarget: HTMLInputElement }) {
        commitRange(Math.min(Number(event.currentTarget.value), highValue), highValue);
    }

    function handleHighInput(event: Event & { currentTarget: HTMLInputElement }) {
        commitRange(lowValue, Math.max(Number(event.currentTarget.value), lowValue));
    }

    function handleSingleChange() {
        if (!isLocked) dispatch("change", singleValue);
    }

    function handleRangeChange() {
        if (!isLocked) dispatch("change", [lowValue, highValue]);
    }
</script>

<div class="flex w-full gap-1 flex-col">
    <div class="flex items-center justify-between gap-3">
        <span class="input-label">
            {#if label}{label}{/if}
            {#if required}
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={150}>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <button type="button" class="required-star" {...props} tabindex={tabindex}>
                                    <Icon.Asterisk size={16} fill="var(--red)" />
                                </button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <MyTooltip>Cette donnée est requise</MyTooltip>
                    </Tooltip.Root>
                </Tooltip.Provider>
            {/if}
        </span>

        {#if showValue}
            <span class="range-value">{formattedValue}</span>
        {/if}
    </div>

    {#if range}
        <div class="range-container range-container-double {parentClass} {disabled ? '--disabled' : ''} {readonly ? '--readonly' : ''}">
            <div class="range-track" aria-hidden="true">
                <span class="range-progress-fill" style={`left: ${lowProgress}%; right: ${100 - highProgress}%;`}></span>
            </div>
            <input
                type="range"
                name={name ? `${name}-min` : undefined}
                {required}
                disabled={isLocked}
                min={inputMin}
                max={inputMax}
                step={inputStep}
                value={lowValue}
                aria-label={`${label ?? name ?? "Valeur"} minimum`}
                aria-readonly={readonly}
                oninput={handleLowInput}
                onchange={handleRangeChange}
            />
            <input
                type="range"
                name={name ? `${name}-max` : undefined}
                {required}
                disabled={isLocked}
                min={inputMin}
                max={inputMax}
                step={inputStep}
                value={highValue}
                aria-label={`${label ?? name ?? "Valeur"} maximum`}
                aria-readonly={readonly}
                oninput={handleHighInput}
                onchange={handleRangeChange}
            />
        </div>
    {:else}
        <div class="range-container {parentClass} {disabled ? '--disabled' : ''} {readonly ? '--readonly' : ''}">
            <div class="range-track" aria-hidden="true">
                <span class="range-progress-fill" style={`width: ${singleProgress}%;`}></span>
            </div>
            <input
                type="range"
                {name}
                {required}
                disabled={isLocked}
                min={inputMin}
                max={inputMax}
                step={inputStep}
                value={singleValue}
                aria-readonly={readonly}
                oninput={handleSingleInput}
                onchange={handleSingleChange}
            />
        </div>
    {/if}

    {#if showBounds}
        <div class="range-bounds">
            <span>{format(inputMin, prefix, suffix)}</span>
            <span>{format(inputMax, prefix, suffix)}</span>
        </div>
    {/if}

    {#if helpText}
        <span class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon"><Icon.Info /></span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
