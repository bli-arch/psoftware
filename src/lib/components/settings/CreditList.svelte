<script lang="ts">
    import TextFileDialog from "$lib/components/TextFileDialog.svelte";
    import type { Credit } from "$lib/credits";
    import SettingsGroup from "./SettingsGroup.svelte";
    import SettingsRow from "./SettingsRow.svelte";

    type Props = {
        credits: Credit[];
        load: (credit: Credit) => Promise<string>;
    };

    const pageSize = 30;
    let { credits, load }: Props = $props();
    let visibleCount = $state(pageSize);
    const visibleCredits = $derived(credits.slice(0, visibleCount));

    function loadMore(node: HTMLElement) {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) visibleCount = Math.min(visibleCount + pageSize, credits.length);
        }, { rootMargin: "200px" });
        observer.observe(node);
        return { destroy: () => observer.disconnect() };
    }
</script>

<SettingsGroup>
    {#each visibleCredits as credit (credit.id)}
        <SettingsRow title={`${credit.name} ${credit.version}`} inline>
            {#snippet action()}
                <TextFileDialog
                    title={`${credit.name} ${credit.version}`}
                    description={`Licence ${credit.license}`}
                    load={() => load(credit)}
                    triggerLabel="Consulter"
                    triggerIcon={null}
                />
            {/snippet}
        </SettingsRow>
    {/each}
</SettingsGroup>

{#if visibleCount < credits.length}
    {#key visibleCount}
        <div use:loadMore class="h-px" aria-hidden="true"></div>
    {/key}
{/if}
