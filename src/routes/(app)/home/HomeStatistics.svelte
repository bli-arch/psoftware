<script lang="ts">
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";

    type StatisticItem = {
        label: string;
        icon: string;
        current: number;
        previous: number;
        days: number;
        href?: string;
    };

    let {
        scope,
        items,
    }: {
        scope: "personal" | "global";
        items: StatisticItem[];
    } = $props();
</script>

{#if items.length}
    <section class="@container overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
        <div class="flex min-h-11 items-center justify-between gap-4 border-b border-(--light-bg3) px-4 py-2.5">
            <div>
                <h2 class="text-sm font-bold">Activité récente</h2>
                <p class="mt-0.5 text-xs text-(--grey)">
                    {scope === "global" ? "Vue de l’organisation" : "Tendances des derniers jours"}
                </p>
            </div>
            <span class="hidden text-xs font-medium text-(--grey) sm:block">Comparaison avec la période précédente</span>
        </div>

        <div class="flex flex-col divide-y divide-(--light-bg3) @min-[28rem]:flex-row @min-[28rem]:divide-x @min-[28rem]:divide-y-0">
            {#each items as item (item.label)}
                {@const change = item.current - item.previous}
                <svelte:element
                    this={item.href ? "a" : "div"}
                    href={item.href}
                    class={`w-full min-w-0 bg-(--light-bg1) px-4 py-3 text-inherit no-underline ${
                        item.href
                            ? "transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color)"
                            : ""
                    }`}
                >
                    <div class="flex items-start justify-between gap-4">
                        <span class="min-w-0">
                            <strong class="block text-2xl leading-none tabular-nums">{item.current}</strong>
                            <span class="mt-1.5 block truncate text-sm font-semibold">{item.label}</span>
                        </span>
                        <LucideIcon name={item.icon as any} size={17} class="mt-0.5 shrink-0 text-(--grey)" />
                    </div>

                    <div class="mt-3 flex items-center justify-between gap-3 text-xs text-(--grey)">
                        <span>{item.days} derniers jours</span>
                        <span class="flex items-center gap-1 font-semibold tabular-nums">
                            {#if change > 0}
                                <LucideIcon name="ArrowUp" size={12} />
                                +{change}
                            {:else if change < 0}
                                <LucideIcon name="ArrowDown" size={12} />
                                {change}
                            {:else}
                                <LucideIcon name="Minus" size={12} />
                                Stable
                            {/if}
                        </span>
                    </div>
                </svelte:element>
            {/each}
        </div>
    </section>
{/if}
