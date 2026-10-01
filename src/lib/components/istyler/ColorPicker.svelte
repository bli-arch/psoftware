<script lang="ts" module>
    export type ColorPickerSwatch = {
        value: string;
        label: string;
        swatchClass?: string;
    };
</script>

<script lang="ts">
    import { onMount, tick } from "svelte";
    import { Popover } from "bits-ui";
    import { Check } from "lucide-svelte";
    import { twMerge } from "tailwind-merge";
    import MyPopover from "$lib/components/MyPopover.svelte";
    import { colorToHsva, colorToneStyle, cssColor, hsvaToHex, type Hsva } from "$lib/color";
    import Button from "./Button.svelte";
    import TextInput from "./TextInput.svelte";

    export let value = "#6366F1";
    export let fallback = "#6366F1";
    export let label: string | undefined = undefined;
    export let ariaLabel = "Choisir une couleur";
    export let helpText: string | undefined = undefined;
    export let disabled = false;
    export let inline = false;
    export let selected: boolean | undefined = undefined;
    export let allowTransparency = false;
    export let swatches: ColorPickerSwatch[] = [];
    export let onInput: (color: string) => void = () => {};
    export let onSelect: (color: string) => void = () => {};

    let className = "";
    export { className as class };

    let open = false;
    let triggerElement: HTMLButtonElement | null = null;
    let sample: HTMLSpanElement;
    let mounted = false;
    let lastValue = "";
    let hexInput = "#6366F1";
    let hue = 239;
    let saturation = 0.75;
    let brightness = 0.95;
    let alpha = 1;
    let eyedropperAvailable = false;

    $: previewColor = cssColor(value, cssColor(fallback, "#6366F1")) ?? "#6366F1";
    $: portalTarget = triggerElement?.closest<HTMLElement>("[data-vaul-drawer], [role='dialog']") ?? undefined;
    $: if (mounted && value !== lastValue) {
        lastValue = value;
        void tick().then(syncFromValue);
    }

    onMount(() => {
        mounted = true;
        eyedropperAvailable = "EyeDropper" in window;
        syncFromValue();
    });

    function syncFromValue() {
        const next = colorToHsva(getComputedStyle(sample).color);
        if (!next) return;
        hue = next.h;
        saturation = next.s;
        brightness = next.v;
        alpha = allowTransparency ? next.a : 1;
        hexInput = hsvaToHex({ ...next, a: 1 }, false);
    }

    function emit(final = false, syncInput = true) {
        const hsva = { h: hue, s: saturation, v: brightness, a: alpha };
        const next = hsvaToHex(hsva, allowTransparency && alpha < 1);
        lastValue = next;
        value = next;
        if (syncInput) hexInput = hsvaToHex({ ...hsva, a: 1 }, false);
        onInput(next);
        if (final) onSelect(next);
    }

    function selectSwatch(next: string) {
        if (disabled) return;
        value = next;
        onInput(next);
        onSelect(next);
        lastValue = next;
        void tick().then(syncFromValue);
    }

    function updateSurface(event: PointerEvent) {
        if (disabled || (event.type === "pointermove" && event.buttons === 0)) return;
        const surface = event.currentTarget as HTMLButtonElement;
        if (event.type === "pointerdown") surface.setPointerCapture(event.pointerId);
        const bounds = surface.getBoundingClientRect();
        saturation = Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width));
        brightness = 1 - Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height));
        emit();
    }

    function commitSurface(event: PointerEvent) {
        const surface = event.currentTarget as HTMLButtonElement;
        if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
        emit(true);
    }

    function moveSurface(event: KeyboardEvent) {
        const step = event.shiftKey ? 0.1 : 0.01;
        if (event.key === "ArrowLeft") saturation -= step;
        else if (event.key === "ArrowRight") saturation += step;
        else if (event.key === "ArrowUp") brightness += step;
        else if (event.key === "ArrowDown") brightness -= step;
        else return;
        event.preventDefault();
        saturation = Math.min(1, Math.max(0, saturation));
        brightness = Math.min(1, Math.max(0, brightness));
        emit(true);
    }

    function updateHex(nextInput: string) {
        hexInput = nextInput;
        const raw = nextInput.trim();
        const hex = raw.startsWith("#") ? raw : `#${raw}`;
        const valid = allowTransparency
            ? /^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(hex)
            : /^#[\da-f]{6}$/i.test(hex);
        if (!valid) return;
        const next = colorToHsva(hex);
        if (!next) return;
        hue = next.h;
        saturation = next.s;
        brightness = next.v;
        alpha = allowTransparency ? next.a : 1;
        emit(true, false);
    }

    async function pickColor() {
        if (!eyedropperAvailable || disabled) return;
        const EyeDropper = (window as Window & {
            EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
        }).EyeDropper;

        try {
            const next = colorToHsva((await new EyeDropper().open()).sRGBHex);
            if (!next) return;
            hue = next.h;
            saturation = next.s;
            brightness = next.v;
            emit(true);
        } catch {
            // Closing the system eyedropper is not an error.
        }
    }
</script>

<span bind:this={sample} class="pointer-events-none absolute size-0 opacity-0" style={`color:${previewColor}`}></span>

{#snippet picker()}
    <div class="flex w-full flex-col gap-3">
        {#if swatches.length}
            <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-semibold text-(--grey)">Couleurs rapides</span>
                <div class="flex items-center gap-1">
                    {#each swatches as swatch (swatch.value)}
                        {@const selected = swatch.value === value}
                        <button
                            type="button"
                            class={twMerge(
                                "flex size-8 cursor-pointer items-center justify-center rounded-lg outline-none transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2) focus-visible:ring-2 focus-visible:ring-(--user-color)/25 disabled:cursor-not-allowed disabled:opacity-50",
                                selected && "hover:brightness-95"
                            )}
                            style={selected ? colorToneStyle(swatch.value || "grey") : undefined}
                            {disabled}
                            title={swatch.label}
                            aria-label={swatch.label}
                            aria-pressed={selected}
                            onclick={() => selectSwatch(swatch.value)}
                        >
                            {#if selected}
                                <Check size={14} />
                            {:else}
                                <span class={twMerge("size-4 rounded-full", swatch.swatchClass)}></span>
                            {/if}
                        </button>
                    {/each}
                </div>
            </div>
        {/if}

        <button
            type="button"
            class="color-surface relative h-40 w-full cursor-crosshair overflow-hidden rounded-lg border border-(--light-bg3) outline-none focus-visible:ring-2 focus-visible:ring-(--user-color)/25 disabled:cursor-not-allowed disabled:opacity-60"
            style={`background-color:hsl(${hue} 100% 50%)`}
            {disabled}
            aria-label={`Saturation ${Math.round(saturation * 100)} %, luminosité ${Math.round(brightness * 100)} %`}
            onpointerdown={updateSurface}
            onpointermove={updateSurface}
            onpointerup={commitSurface}
            onpointercancel={commitSurface}
            onkeydown={moveSurface}
        >
            <span
                class="absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgb(0_0_0/35%)]"
                style={`left:${saturation * 100}%;top:${(1 - brightness) * 100}%`}
            ></span>
        </button>

        <input
            type="range"
            class="color-range color-hue"
            min="0"
            max="360"
            step="1"
            value={hue}
            {disabled}
            aria-label="Teinte"
            oninput={(event) => {
                hue = Number(event.currentTarget.value);
                emit();
            }}
            onchange={() => emit(true)}
        />

        {#if allowTransparency}
            <div class="checkerboard rounded-full">
                <input
                    type="range"
                    class="color-range color-alpha"
                    style={`--alpha-color:hsl(${hue} ${saturation * 100}% ${Math.max(12, brightness * 50)}%)`}
                    min="0"
                    max="100"
                    step="1"
                    value={alpha * 100}
                    {disabled}
                    aria-label="Opacité"
                    oninput={(event) => {
                        alpha = Number(event.currentTarget.value) / 100;
                        emit();
                    }}
                    onchange={() => emit(true)}
                />
            </div>
        {/if}

        <div class={twMerge(
            "grid items-end gap-2",
            allowTransparency ? "grid-cols-[2rem_minmax(0,1fr)_5rem]" : "grid-cols-[2rem_minmax(0,1fr)]"
        )}>
            <Button
                variant="ghost"
                size="sm"
                icon="Pipette"
                class="size-8 w-8 px-0"
                disabled={disabled || !eyedropperAvailable}
                tooltip={eyedropperAvailable ? "Prélever une couleur à l’écran" : "Pipette indisponible"}
                aria-label="Prélever une couleur à l’écran"
                onclick={pickColor}
            />
            <TextInput
                label="HEX"
                autocomplete="off"
                class="font-mono"
                bind:value={hexInput}
                {disabled}
                oninput={(event) => updateHex(event.currentTarget.value)}
            />
            {#if allowTransparency}
                <TextInput
                    label="Opacité"
                    type="number"
                    min="0"
                    max="100"
                    suffix="%"
                    value={Math.round(alpha * 100)}
                    {disabled}
                    oninput={(event) => {
                        alpha = Math.min(1, Math.max(0, Number(event.currentTarget.value) / 100));
                        emit();
                    }}
                    onchange={() => emit(true)}
                />
            {/if}
        </div>
    </div>
{/snippet}

{#if inline}
    <div class={twMerge("w-full", className)}>
        {@render picker()}
    </div>
{:else}
    <div class="flex w-fit flex-col gap-1">
        {#if label}
            <span class="input-label">{label}</span>
        {/if}

        <Popover.Root bind:open>
            <Popover.Trigger>
                <button
                    bind:this={triggerElement}
                    type="button"
                    class={twMerge(
                        "flex size-8 shrink-0 cursor-pointer items-center justify-center outline-none transition-all duration-(--animation-duration-150) focus-visible:ring-2 focus-visible:ring-(--user-color)/25 disabled:cursor-not-allowed disabled:opacity-60",
                        selected === undefined
                            ? "rounded-full hover:scale-105"
                            : selected
                                ? "rounded-xl hover:brightness-95"
                                : "rounded-xl hover:bg-(--light-bg2)",
                        className
                    )}
                    style={selected === undefined ? `background:${previewColor}` : selected ? colorToneStyle(value, previewColor) : undefined}
                    {disabled}
                    aria-label={label ?? ariaLabel}
                    title={label ?? ariaLabel}
                    aria-pressed={selected}
                >
                    {#if selected !== undefined}
                        {#if selected}
                            <Check size={15} />
                        {:else}
                            <span class="color-trigger size-8 rounded-full"></span>
                        {/if}
                    {/if}
                </button>
            </Popover.Trigger>
            <MyPopover
                {portalTarget}
                class="max-h-[var(--bits-floating-available-height)] w-80 max-w-[var(--bits-floating-available-width)] items-stretch overflow-y-auto overscroll-contain rounded-xl p-3"
                align="end"
                sideOffset={12}
                collisionPadding={16}
                sticky="always"
                strategy="fixed"
            >
                {@render picker()}
            </MyPopover>
        </Popover.Root>

        {#if helpText}
            <span class="input-help-text">{helpText}</span>
        {/if}
    </div>
{/if}

<style>
    .color-trigger {
        background: conic-gradient(#f43f5e, #f59e0b, #84cc16, #06b6d4, #6366f1, #d946ef, #f43f5e);
    }

    .color-surface {
        background-image:
            linear-gradient(to top, #000, transparent),
            linear-gradient(to right, #fff, transparent);
    }

    .color-range {
        width: 100%;
        height: 14px;
        appearance: none;
        border-radius: 999px;
        cursor: pointer;
        outline: none;
    }

    .color-range:focus-visible {
        box-shadow: 0 0 0 3px var(--user-color-transparent);
    }

    .color-range:disabled {
        cursor: not-allowed;
        opacity: 0.6;
    }

    .color-hue {
        background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
    }

    .checkerboard {
        background-color: var(--light-bg1);
        background-image:
            linear-gradient(45deg, var(--light-bg3) 25%, transparent 25%),
            linear-gradient(-45deg, var(--light-bg3) 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, var(--light-bg3) 75%),
            linear-gradient(-45deg, transparent 75%, var(--light-bg3) 75%);
        background-position: 0 0, 0 4px, 4px -4px, -4px 0;
        background-size: 8px 8px;
    }

    .color-alpha {
        display: block;
        background: linear-gradient(to right, transparent, var(--alpha-color));
    }

    .color-range::-webkit-slider-thumb {
        width: 18px;
        height: 18px;
        appearance: none;
        border: 2px solid var(--light-bg1);
        border-radius: 999px;
        background: transparent;
        box-shadow: 0 0 0 1px rgb(0 0 0 / 24%);
    }

    .color-range::-moz-range-thumb {
        width: 14px;
        height: 14px;
        border: 2px solid var(--light-bg1);
        border-radius: 999px;
        background: transparent;
        box-shadow: 0 0 0 1px rgb(0 0 0 / 24%);
    }
</style>
