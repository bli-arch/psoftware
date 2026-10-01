<script lang="ts">
    import type { Snippet } from "svelte";
    import { Button } from "$lib/components/istyler";

    type Props = {
        children: Snippet;
        footer: Snippet;
        onadd: () => void;
    };

    let { children, footer, onadd }: Props = $props();
    let contentHeight = $state(0);
</script>

<div class="flex w-full flex-col">
    <header class="flex shrink-0 items-center justify-between gap-3 border-b border-(--light-bg3) px-4 py-3">
        <div class="min-w-0">
            <h2 class="truncate text-lg font-bold font-(family-name:--font) text-(--dark-bg1)">Filtres</h2>
            <p class="truncate text-xs font-normal font-(family-name:--font) text-(--grey)">
                Combinez plusieurs conditions.
            </p>
        </div>
        <Button
            variant="ghost"
            size="sm"
            icon="Plus"
            label="Ajouter"
            class="w-fit hover:bg-(--light-bg2)"
            onclick={onadd}
        />
    </header>

    <div
        class="relative overflow-hidden transition-[height] duration-(--animation-duration-300) ease-out"
        style={contentHeight ? `height: ${contentHeight}px;` : undefined}
    >
        <div bind:clientHeight={contentHeight} class="max-h-80 overflow-y-auto px-4 py-3">
            {@render children()}
        </div>
    </div>

    <footer class="flex shrink-0 justify-end gap-2 px-4 pb-3">
        {@render footer()}
    </footer>
</div>
