<script lang="ts">
    import {
        clampRangeNumber,
        finiteRangeNumber,
        normalizeRangeBounds,
        normalizeRangeStep,
        readIntervalRangeValue,
        readSingleRangeValue,
    } from "./rangeValue";
    import "./iStyler.css";

    export let label: string;
    export let value: number | [number, number] | null | undefined = null;
    export let range: boolean = false;
    export let min: number | string | null | undefined = 0;
    export let max: number | string | null | undefined = 100;
    export let step: number | string | null | undefined = 1;

    $: [inputMin, inputMax] = normalizeRangeBounds(min, max);
    $: inputStep = normalizeRangeStep(step);
    $: singleValue = value == null ? null : readSingleRangeValue(value, inputMin, inputMax);
    $: intervalValue = value == null ? null : readIntervalRangeValue(value, inputMin, inputMax);
    $: lowValue = intervalValue?.[0] ?? null;
    $: highValue = intervalValue?.[1] ?? null;

    function updateSingle(nextValue: string) {
        value = nextValue === ""
            ? null
            : clampRangeNumber(finiteRangeNumber(nextValue, inputMin), inputMin, inputMax);
    }

    function updateLow(nextValue: string) {
        if (nextValue === "") {
            value = null;
            return;
        }

        const low = clampRangeNumber(finiteRangeNumber(nextValue, inputMin), inputMin, inputMax);
        const high = highValue ?? inputMax;
        value = [Math.min(low, high), high];
    }

    function updateHigh(nextValue: string) {
        if (nextValue === "") {
            value = null;
            return;
        }

        const low = lowValue ?? inputMin;
        const high = clampRangeNumber(finiteRangeNumber(nextValue, inputMax), inputMin, inputMax);
        value = [low, Math.max(low, high)];
    }
</script>

<div class="flex flex-col gap-2">
    <span class="input-label">{label}</span>

    {#if range}
        <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
            <label class="flex flex-col gap-1">
                <span class="input-label">Minimum</span>
                <div class="input-container">
                    <input
                        type="number"
                        min={inputMin}
                        max={inputMax}
                        step={inputStep}
                        value={lowValue ?? ""}
                        oninput={(event) => updateLow((event.currentTarget as HTMLInputElement).value)}
                    />
                </div>
            </label>
            <label class="flex flex-col gap-1">
                <span class="input-label">Maximum</span>
                <div class="input-container">
                    <input
                        type="number"
                        min={inputMin}
                        max={inputMax}
                        step={inputStep}
                        value={highValue ?? ""}
                        oninput={(event) => updateHigh((event.currentTarget as HTMLInputElement).value)}
                    />
                </div>
            </label>
        </div>
    {:else}
        <label class="flex flex-col gap-1">
            <div class="input-container">
                <input
                    type="number"
                    aria-label={label}
                    min={inputMin}
                    max={inputMax}
                    step={inputStep}
                    value={singleValue ?? ""}
                    oninput={(event) => updateSingle((event.currentTarget as HTMLInputElement).value)}
                />
            </div>
        </label>
    {/if}
</div>
