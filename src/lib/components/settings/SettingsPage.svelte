<script lang="ts">
    import type { Snippet } from "svelte";

    type Props = {
        title: string;
        description: string;
        actions?: Snippet;
        children?: Snippet;
    };

    let { title, description, actions, children }: Props = $props();
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <header class="flex h-14 shrink-0 items-center justify-between border-b border-(--light-bg3) bg-(--light-bg1) px-6">
        <div class="min-w-0">
            <h1 class="truncate text-lg font-bold font-(family-name:--font) text-(--dark-bg1)">
                {title}
            </h1>
            <div class="truncate text-xs font-normal font-(family-name:--font) text-(--grey)">
                {description}
            </div>
        </div>

        {#if actions}
            <div class="flex shrink-0 items-center gap-2">
                {@render actions()}
            </div>
        {/if}
    </header>

    <section class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div class="flex w-full max-w-full flex-col gap-5">
            {@render children?.()}
        </div>
    </section>
</div>
