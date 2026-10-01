<script lang="ts">
    import { onMount, tick } from "svelte";
    import {
        clampDateValue,
        formatDateValue,
        normalizeDateValue,
        resolveTimePartSelection,
        type DateMode,
        type TimePart,
    } from "./dateValue";

    export let value: string | null = null;
    export let min: string | null = null;
    export let max: string | null = null;
    export let mode: Extract<DateMode, "time" | "time-ms"> = "time";
    export let showSeconds = false;
    export let close: () => void;
    export let onchange: (value: string) => void;

    const HOURS = Array.from({ length: 24 }, (_, index) => index);
    const SEXAGESIMAL = Array.from({ length: 60 }, (_, index) => index);
    const pad = (part: number) => String(part).padStart(2, "0");

    let picker: HTMLDivElement;

    $: fallback = mode === "time"
        ? normalizeDateValue(new Date(), mode, showSeconds)
        : "0:00";
    $: pickerValue = clampDateValue(value ?? fallback, min, max, mode, showSeconds) ?? fallback!;
    $: parts = pickerValue.split(":").map(Number);
    $: hours = mode === "time" ? parts[0] : 0;
    $: minutes = mode === "time" ? parts[1] : parts[0];
    $: seconds = mode === "time" ? (parts[2] ?? 0) : parts[1];
    $: hourSelections = HOURS.map((hour) =>
        resolveTimePartSelection(pickerValue, mode, "hours", hour, min, max, showSeconds)
    );
    $: minuteSelections = SEXAGESIMAL.map((minute) =>
        resolveTimePartSelection(pickerValue, mode, "minutes", minute, min, max, showSeconds)
    );
    $: secondSelections = SEXAGESIMAL.map((second) =>
        resolveTimePartSelection(pickerValue, mode, "seconds", second, min, max, showSeconds)
    );

    function selection(part: TimePart, nextPart: number) {
        if (part === "hours") return hourSelections[nextPart] ?? null;
        if (part === "minutes") return minuteSelections[nextPart] ?? null;
        return secondSelections[nextPart] ?? null;
    }

    function select(part: TimePart, nextPart: number) {
        const next = selection(part, nextPart);
        if (next === null) return;
        value = next;
        onchange(next);

        if (part === "seconds" || (part === "minutes" && mode === "time" && !showSeconds)) close();
        else void centerSelection();
    }

    async function centerSelection() {
        await tick();
        picker?.querySelectorAll<HTMLElement>("[aria-pressed='true']")
            .forEach((selected) => {
                const list = selected.parentElement;
                if (!list) return;
                list.scrollTop = selected.offsetTop
                    - (list.clientHeight - selected.offsetHeight) / 2;
            });
    }

    onMount(centerSelection);
</script>

<div class="time-picker" bind:this={picker}>
    <div class="time-picker-value">{formatDateValue(pickerValue, mode)}</div>

    <div class="time-picker-columns" class:--three={mode === "time" && showSeconds}>
        {#if mode === "time"}
            <div class="time-picker-column">
                <span>Heures</span>
                <div class="time-picker-list" role="group" aria-label="Heures">
                    {#each HOURS as hour}
                        <button
                            type="button"
                            aria-label={`${hour} heure${hour === 1 ? "" : "s"}`}
                            aria-pressed={hours === hour}
                            disabled={hourSelections[hour] === null}
                            onclick={() => select("hours", hour)}
                        >{pad(hour)}</button>
                    {/each}
                </div>
            </div>
        {/if}

        <div class="time-picker-column">
            <span>Minutes</span>
            <div class="time-picker-list" role="group" aria-label="Minutes">
                {#each SEXAGESIMAL as minute}
                    <button
                        type="button"
                        aria-label={`${minute} minute${minute === 1 ? "" : "s"}`}
                        aria-pressed={minutes === minute}
                        disabled={minuteSelections[minute] === null}
                        onclick={() => select("minutes", minute)}
                    >{pad(minute)}</button>
                {/each}
            </div>
        </div>

        {#if mode === "time-ms" || showSeconds}
            <div class="time-picker-column">
                <span>Secondes</span>
                <div class="time-picker-list" role="group" aria-label="Secondes">
                    {#each SEXAGESIMAL as second}
                        <button
                            type="button"
                            aria-label={`${second} seconde${second === 1 ? "" : "s"}`}
                            aria-pressed={seconds === second}
                            disabled={secondSelections[second] === null}
                            onclick={() => select("seconds", second)}
                        >{pad(second)}</button>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
</div>
