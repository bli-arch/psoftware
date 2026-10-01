<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        label: string;
        children?: Snippet;
    };

    let { label, children }: Props = $props();
</script>

<section class="flex flex-col">
    <div class="px-1 text-xs font-semibold uppercase tracking-widest text-(--grey)">
        {label}
    </div>

    <div class="settings-section-content mt-2 flex flex-col gap-2">
        {@render children?.()}
    </div>
</section>

<style>
    .settings-section-content > :global(.settings-toggle-row + .settings-toggle-row) {
        margin-top: calc(-0.5rem - 1px);
        border-top-left-radius: 0;
        border-top-right-radius: 0;
    }

    .settings-section-content > :global(.settings-toggle-row:has(+ .settings-toggle-row)) {
        border-bottom-right-radius: 0;
        border-bottom-left-radius: 0;
    }
</style>
