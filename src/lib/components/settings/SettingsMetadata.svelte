<script lang="ts">
    import type { Snippet } from "svelte";
    import { twMerge } from "tailwind-merge";

    type MetadataItem = {
        label: string;
        value: string | number | boolean | null | undefined;
    };

    type Props = {
        items?: MetadataItem[];
        children?: Snippet;
        class?: string;
    };

    let { items = [], children, class: className = "" }: Props = $props();
</script>

<div class={twMerge("settings-metadata flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--grey)", className)}>
    {#each items as item}
        <span class="inline-flex min-w-0 items-center gap-1">
            <span class="font-semibold text-(--dark-bg1)">{item.label}</span>
            <span class="truncate">{item.value ?? "-"}</span>
        </span>
    {/each}

    {@render children?.()}
</div>
