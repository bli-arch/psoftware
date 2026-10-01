<script lang="ts">
    type Statistic = {
        label: string;
        current: number;
        days: number;
    };

    let { items }: { items: Statistic[] } = $props();
</script>

<dl class="flex flex-col divide-y divide-(--light-bg3) overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1) sm:flex-row sm:divide-x sm:divide-y-0">
    {#each items as item (item.label)}
        <div class="flex min-h-18 min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3">
            <div class="min-w-0">
                <dt class="truncate text-sm font-medium text-(--dark-bg1)">{item.label}</dt>
                <div class="mt-0.5 text-xs text-(--grey)">{item.days} derniers jours</div>
            </div>
            <dd class="shrink-0 text-xl font-bold leading-none tabular-nums text-(--dark-bg1)">
                {item.current}
            </dd>
        </div>
    {/each}
</dl>
