<script lang="ts">
    import { onMount } from "svelte";
    import { SettingsPage, SettingsSection } from "$lib/components/settings";
    import CreditList from "$lib/components/settings/CreditList.svelte";
    import {
        readPServerCredit,
        readPServerCredits,
        readPSoftwareCredit,
        readPSoftwareCredits,
        type Credit,
    } from "$lib/credits";

    let psoftwareCredits = $state<Credit[]>([]);
    let pserverCredits = $state<Credit[]>([]);
    let error = $state("");

    onMount(async () => {
        try {
            [psoftwareCredits, pserverCredits] = await Promise.all([
                readPSoftwareCredits(),
                readPServerCredits().catch(() => []),
            ]);
        } catch (loadError) {
            console.error("Failed to load third-party credits", loadError);
            error = "Impossible de charger les crédits.";
        }
    });
</script>

<SettingsPage title="Crédits" description="Composants intégrés à PSoftware et PServer.">
    {#if error}
        <div class="text-sm text-(--red)">{error}</div>
    {:else if psoftwareCredits.length === 0}
        <div class="text-sm text-(--grey)">Chargement…</div>
    {:else}
        <SettingsSection label="PSoftware">
            <CreditList credits={psoftwareCredits} load={readPSoftwareCredit} />
        </SettingsSection>
        {#if pserverCredits.length > 0}
            <SettingsSection label="PServer">
                <CreditList credits={pserverCredits} load={readPServerCredit} />
            </SettingsSection>
        {/if}
    {/if}
</SettingsPage>
