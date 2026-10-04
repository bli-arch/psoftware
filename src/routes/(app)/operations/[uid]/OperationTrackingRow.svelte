<script lang="ts">
    import { onMount } from "svelte";
    import { Accordion } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { toast } from "svelte-sonner";
    import { Button, Checkbox, Radio } from "$lib/components/istyler";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import { getRowTone } from "$lib/components/settings/rowTone";
    import { strftime } from "$lib/utils";
    import { getOperationTracking, patchOperationTracking, rotateOperationTracking, trackingErrorMessage, type OperationTracking } from "$lib/tracking";

    let { uid, onChanged }: {
        uid: string;
        onChanged?: (tracking: OperationTracking | null) => void;
    } = $props();

    let tracking = $state<OperationTracking | null>(null);
    let loading = $state(true);
    let saving = $state(false);
    let error = $state("");
    let expanded = $state("");
    let draftPublished = $state(false);
    let draftAccessMode = $state<"token" | "password">("token");
    let generation = 0;
    let loadedUID = "";
    let refreshing = false;
    const tone = getRowTone("bg-indigo-50 text-indigo-600");

    const expired = $derived(Boolean(tracking?.expires_at && Date.parse(tracking.expires_at) <= Date.now()));
    const status = $derived(
        !tracking ? "" : !tracking.enabled ? "Désactivé" : expired ? "Expiré" : tracking.pending ? "Synchronisation en attente" : tracking.published ? "Publié" : "Privé",
    );

    function apply(value: OperationTracking) {
        tracking = value;
        draftPublished = value.published;
        draftAccessMode = value.access_mode;
        onChanged?.(value);
    }

    export async function refresh() {
        if (saving || refreshing) return;
        refreshing = true;
        const requestGeneration = ++generation;
        const requestedUID = uid;
        try {
            const value = await getOperationTracking(requestedUID);
            if (requestGeneration !== generation || uid !== requestedUID) return;
            apply(value);
            error = "";
        } catch {
            if (requestGeneration !== generation) return;
            error = "Impossible de charger le suivi client.";
        } finally {
            if (requestGeneration === generation) { loading = false; refreshing = false; }
        }
    }

    async function update(patch: { published?: boolean; access_mode?: "token" | "password" }) {
        if (saving || !tracking?.can_publish) return;
        const requestedUID = uid;
        const requestGeneration = ++generation;
        refreshing = false;
        saving = true;
        error = "";
        try {
            const value = await patchOperationTracking(requestedUID, patch);
            if (uid === requestedUID && requestGeneration === generation) apply(value);
        } catch (cause) {
            if (uid !== requestedUID || requestGeneration !== generation) return;
            draftPublished = tracking.published;
            draftAccessMode = tracking.access_mode;
            error = trackingErrorMessage(cause, "Impossible de modifier le suivi client.");
        } finally {
            if (requestGeneration === generation) saving = false;
        }
    }

    async function rotate() {
        if (saving || !tracking?.can_publish) return;
        const requestedUID = uid;
        const requestGeneration = ++generation;
        refreshing = false;
        saving = true;
        error = "";
        try {
            const value = await rotateOperationTracking(requestedUID);
            if (uid === requestedUID && requestGeneration === generation) apply(value);
        } catch (cause) {
            if (uid !== requestedUID || requestGeneration !== generation) return;
            error = trackingErrorMessage(cause, "Impossible de renouveler l'identifiant de suivi.");
        } finally {
            if (requestGeneration === generation) saving = false;
        }
    }

    async function copy() {
        const value = tracking?.tracking_url || tracking?.public_uid;
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            toast.success(tracking?.tracking_url ? "Lien de suivi copié." : "Identifiant de suivi copié.");
        } catch {
            toast.error("Impossible de copier le suivi client.");
        }
    }

    $effect(() => {
        if (uid === loadedUID) return;
        loadedUID = uid;
        loading = true;
        saving = false;
        refreshing = false;
        tracking = null;
        onChanged?.(null);
        void refresh();
    });

    onMount(() => {
        const timer = window.setInterval(() => {
            if (!saving && document.visibilityState === "visible") void refresh();
        }, 15_000);
        return () => { generation += 1; window.clearInterval(timer); };
    });
</script>

<Accordion.Root type="single" bind:value={expanded} class="mb-2">
    <Accordion.Item value="tracking" class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
        <Accordion.Header style={tone.background}>
            <Accordion.Trigger class="group flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-(--animation-duration-150) hover:bg-(--light-bg3)/20">
                <Icon.Globe size={20} strokeWidth={1.6} class="shrink-0 {tone.iconClass}" />
                <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold text-(--dark-bg1)">Suivi client</span>
                    <span class="block truncate text-xs text-(--grey)">{loading ? "Chargement..." : tracking?.public_uid || "Suivi non activé"}</span>
                </span>
                {#if status}<span class="text-xs text-(--grey)">{status}</span>{/if}
                <Icon.ChevronDown size={14} class="shrink-0 text-(--grey) transition-transform duration-(--animation-duration-150) group-data-[state=open]:rotate-180" />
            </Accordion.Trigger>
        </Accordion.Header>
        <MyAccordion class="grid gap-3 p-4">
            {#if error}
                <div class="flex items-center justify-between gap-3" role="alert">
                    <p class="text-xs text-(--red)">{error}</p>
                    <Button variant="secondary" size="xs" icon="RefreshCw" label="Réessayer" disabled={saving} onclick={refresh} />
                </div>
            {/if}
            {#if tracking}
                {#if tracking.public_uid}
                    <div class="flex items-start justify-between gap-3">
                        <p class="min-w-0 break-all text-xs leading-5 text-(--grey)">{tracking.tracking_url || tracking.public_uid}</p>
                        <Button variant="secondary" size="xs" icon="Copy" label={tracking.tracking_url ? "Copier le lien" : "Copier l'identifiant"} onclick={copy} />
                    </div>
                {:else}
                    <p class="text-xs leading-5 text-(--grey)">Activez et configurez le suivi dans les réglages de l'API.</p>
                {/if}
                {#if tracking.can_publish && tracking.public_uid}
                    <Checkbox label="Publier le suivi de cette opération" bind:value={draftPublished} switchMode side="left" disabled={saving || expired || !tracking.enabled} on:change={(event) => update({ published: event.detail === true })} />
                    <Radio
                        name={`tracking-access-${uid}`}
                        label="Accès client"
                        bind:value={draftAccessMode}
                        options={[{ value: "token", label: "Lien privé" }, { value: "password", label: "Mot de passe" }]}
                        disabled={saving || expired || !tracking.enabled}
                        box
                        on:change={(event) => update({ access_mode: event.detail })}
                    />
                    {#if tracking.access_mode === "password"}
                        <p class="text-xs leading-5 text-(--grey)">Le mot de passe doit être configuré sur le site externe. Aucun mot de passe n'est transmis par PSoftware.</p>
                    {/if}
                {/if}
                {#if tracking.expires_at}
                    <p class="text-xs text-(--grey)">Expiration : {strftime(tracking.expires_at, "%d/%m/%Y à %Hh%M", "fr-FR")}</p>
                {/if}
                {#if tracking.pending}
                    <p class="text-xs leading-5 text-(--orange)">La publication, la protection et les retraits prennent effet sur le site après confirmation de réception.</p>
                {/if}
                {#if tracking.can_publish && tracking.public_uid}
                    <div class="flex items-center justify-between gap-3 border-t border-(--light-bg3) pt-3">
                        <p class="text-xs leading-5 text-(--grey)">Seuls les champs, statuts et notes choisis sont transmis au site externe.</p>
                        <Button
                            variant="secondary" size="xs" icon="RefreshCw" label="Renouveler le lien" disabled={saving || expired}
                            confirm confirmTitle="Renouveler le lien de suivi ?"
                            confirmDescription="L'ancien lien sera retiré du site après réception de la mise à jour. Donnez le nouveau lien au client."
                            confirmCancelLabel="Annuler" confirmConfirmLabel="Renouveler" onclick={rotate}
                        />
                    </div>
                {/if}
            {/if}
        </MyAccordion>
    </Accordion.Item>
</Accordion.Root>
