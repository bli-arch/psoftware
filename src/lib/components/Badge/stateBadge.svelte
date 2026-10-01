<script lang="ts">
    import { twMerge } from "tailwind-merge";
    import { cssColor } from "$lib/color";
    import LucideIcon from "./LucideIcon.svelte";

    let className: string | undefined | null = undefined;
    export { className as class };
    export let state: string | number;
    export let states: Array<Record<string, any>> = [];

    $: selectedState = states.find((e) => String(e.id) === String(state));
    $: color = cssColor(selectedState?.settings?.color);
</script>

<span
    class={twMerge(
        "inline-flex max-h-5.5 min-w-0 items-center gap-1 rounded-sm border-transparent px-2 py-1 text-xs font-semibold select-none",
        className
    )}
    style={color ? `color:${color};background-color:color-mix(in oklab, ${color} 10%, transparent);` : undefined}
    {...$$restProps}
>
    {#if selectedState?.settings?.icon}
        <LucideIcon size={12} name={selectedState.settings.icon} class="shrink-0" />
    {/if}
    <span class="min-w-0 truncate">{selectedState?.name || state}</span>
    <slot />
</span>
