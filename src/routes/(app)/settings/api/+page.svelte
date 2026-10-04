<script lang="ts">
    import { onMount } from "svelte";
    import { currentUser } from "$lib/auth";
    import { Button } from "$lib/components/istyler";
    import { SettingsPage, SettingsSection } from "$lib/components/settings";
    import { getTrackingConfig, patchTrackingConfig, performTrackingAction, trackingErrorMessage, type TrackingAction, type TrackingConfig, type TrackingConfigPatch } from "$lib/tracking";
    import TrackingConnection from "./TrackingConnection.svelte";
    import TrackingPublication from "./TrackingPublication.svelte";
    import TrackingDelivery from "./TrackingDelivery.svelte";

    let config = $state<TrackingConfig | null>(null);
    let busy = $state(false);
    let loading = $state(true);
    let error = $state("");
    let notice = $state("");
    const allowed = $derived(Boolean($currentUser?.administrator || $currentUser?.permissions?.includes("tracking.manage")));

    async function load() {
        if (!allowed || busy) return;
        loading = true;
        error = "";
        try { config = await getTrackingConfig(); }
        catch (exception) { error = trackingErrorMessage(exception, "Impossible de charger les réglages de suivi."); }
        finally { loading = false; }
    }

    async function save(patch: TrackingConfigPatch) {
        if (!allowed || busy || loading) return false;
        busy = true;
        error = "";
        notice = "";
        try {
            config = await patchTrackingConfig(patch);
            notice = "Réglages enregistrés. Les changements publiés prennent effet sur le site après livraison.";
            return true;
        } catch (exception) {
            error = trackingErrorMessage(exception, "Impossible d’enregistrer les réglages de suivi.");
            return false;
        } finally { busy = false; }
    }

    async function act(action: TrackingAction) {
        if (!allowed || busy || loading) return;
        busy = true;
        error = "";
        notice = "";
        try {
            config = await performTrackingAction(action);
            notice = action === "test" ? "Connexion testée : le site a confirmé la réception du message de test." : "Action enregistrée.";
        } catch (exception) {
            error = trackingErrorMessage(exception, "Impossible d’effectuer cette action de suivi.");
        } finally { busy = false; }
    }

    onMount(() => { void load(); });
</script>

<SettingsPage title="API de suivi" description="Publiez les informations autorisées vers votre site, sans ouvrir un accès à PServer.">
    {#snippet actions()}
        {#if allowed}<Button variant="secondary" size="sm" icon="RefreshCw" label="Actualiser" disabled={busy || loading} onclick={() => { void load(); }} />{/if}
    {/snippet}
    {#if !allowed}
        <p role="alert" class="text-sm text-(--grey)">Vous n’avez pas l’autorisation de gérer l’API de suivi.</p>
    {:else}
        {#if error}<p role="alert" class="rounded-xl border border-(--red)/20 bg-(--red)/5 px-4 py-3 text-sm text-(--red)">{error}</p>{/if}
        {#if notice}<p role="status" class="rounded-xl border border-(--green)/20 bg-(--green)/5 px-4 py-3 text-sm text-(--green)">{notice}</p>{/if}
        {#if loading && !config}
            <p role="status" class="text-sm text-(--grey)">Chargement des réglages de suivi…</p>
        {:else if config}
            <SettingsSection label="Configuration">
                <TrackingConnection {config} busy={busy || loading} onSave={save} />
                <TrackingPublication {config} busy={busy || loading} onSave={save} />
            </SettingsSection>
            <TrackingDelivery {config} busy={busy || loading} onAction={act} />
        {:else}
            <Button variant="secondary" size="sm" label="Réessayer" icon="RefreshCw" disabled={busy || loading} onclick={() => { void load(); }} class="w-fit" />
        {/if}
    {/if}
</SettingsPage>
