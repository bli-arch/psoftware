<script lang="ts">
    import type { Snippet } from "svelte";
    import { Badge } from "$lib/components/Badge";
    import * as Icon from "lucide-svelte";

    let {
        title,
        detail,
        children,
    }: {
        title: string;
        detail?: string;
        children?: Snippet;
    } = $props();
</script>

<div class="flex min-h-full w-full flex-1 flex-col items-center justify-center px-4 py-10 text-center">
    <div class="flex size-14 items-center justify-center text-(--user-color)">
        <Icon.CircleCheckBig size="42" strokeWidth="1.5" />
    </div>

    <h1 class="mt-5 font-(family-name:--font) text-2xl font-bold tracking-tight text-(--dark-bg1)">{title}</h1>

    {#if detail}
        <Badge text={`#${detail}`} type="neutral" class="mt-3 rounded-full px-2.5 py-1 font-mono" />
    {/if}

    {#if children}
        <div class="mt-8 flex min-h-0 w-full max-w-3xl flex-col">
            {@render children()}
        </div>
    {/if}
</div>
