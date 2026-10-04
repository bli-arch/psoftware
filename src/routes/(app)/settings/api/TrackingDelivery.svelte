<script lang="ts">
    import { Button } from "$lib/components/istyler";
    import { SettingsRow, SettingsSection } from "$lib/components/settings";
    import type { TrackingAction, TrackingConfig } from "$lib/tracking";

    let { config, busy, onAction }: { config: TrackingConfig; busy: boolean; onAction: (action: TrackingAction) => Promise<void> } = $props();
    const labels = { disabled: "Désactivé", active: "Actif", paused: "En pause", withdrawing: "Retrait en cours", reconcile: "Réinitialisation nécessaire" };
    const configured = $derived(!!config.endpoint && !!config.integration_id && !!config.key_id && config.has_secret);
    const canSend = $derived(config.sender_supported && configured);
    const previouslyActivated = $derived(Boolean(config.bound_generation && config.bound_generation !== "0"));
    const canResetGeneration = $derived.by(() => {
        if (!previouslyActivated || config.integration_id !== config.bound_integration_id) return true;
        try { return BigInt(config.generation) > BigInt(config.bound_generation); }
        catch { return false; }
    });
</script>

<SettingsSection label="Envois">
    <SettingsRow icon="Radio" title="Synchronisation" description="Les envois sont enregistrés et réessayés après une interruption." badge={labels[config.state]} toneClass="bg-emerald-50 text-emerald-700">
        {#snippet action()}
            <div class="flex flex-wrap items-center gap-2">
                {#if config.state === "active"}
                    <Button variant="secondary" size="sm" icon="Pause" label="Mettre en pause" disabled={busy} onclick={() => onAction("pause")} />
                {:else if config.state === "paused"}
                    <Button size="sm" icon="Play" label="Reprendre" disabled={busy || !canSend} onclick={() => onAction("resume")} />
                {:else if config.state === "disabled" && !previouslyActivated}
                    <Button size="sm" icon="Play" label="Activer" disabled={busy || !canSend} confirm confirmTitle="Activer le suivi public ?" confirmDescription="Les informations explicitement publiées seront envoyées au site configuré. Vérifiez sa configuration et vos choix de publication avant de continuer." confirmCancelLabel="Annuler" confirmConfirmLabel="Activer" onclick={() => onAction("activate")} />
                {/if}
                <Button variant="secondary" size="sm" icon="FlaskConical" label="Tester la connexion" disabled={busy || !canSend} onclick={() => onAction("test")} />
            </div>
        {/snippet}
        <div class="flex flex-col gap-2 text-xs text-(--grey)">
            <p>La pause arrête les envois, mais ne retire pas les données déjà présentes sur le site.</p>
            {#if !config.sender_supported}<p role="alert" class="text-(--red)">{config.sender_error || "L’envoi isolé n’est pas disponible sur ce serveur. L’activation est bloquée."}</p>{/if}
            {#if config.state === "reconcile"}<p class="text-(--orange)">Après une restauration ou un changement de connexion, provisionnez une génération supérieure et une nouvelle clé sur le site avant de réinitialiser le suivi.</p>{/if}
            {#if config.state === "disabled" && previouslyActivated}<p class="text-(--grey)">Les suivis ont été retirés. Pour publier à nouveau, configurez une génération supérieure et une nouvelle clé sur le site, puis réinitialisez la synchronisation.</p>{/if}
        </div>
    </SettingsRow>
    <SettingsRow icon="ListRestart" title="Livraisons" description={`${config.stats.pending} en attente · ${config.stats.failed} en échec · ${config.stats.withdrawals_pending} retraits en attente`} toneClass="bg-blue-50 text-blue-700">
        {#snippet action()}<Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" disabled={busy || !config.stats.failed || !canSend} onclick={() => onAction("retry")} />{/snippet}
        <div class="flex flex-col gap-2 text-xs text-(--grey)">
            {#if config.stats.last_success_at}<p>Dernière livraison : <time datetime={config.stats.last_success_at}>{new Date(config.stats.last_success_at).toLocaleString("fr-FR")}</time></p>{/if}
            <p>File d’attente : {(config.stats.pending_bytes / 1048576).toFixed(1)} Mo / 256 Mo.</p>
            {#if config.stats.pending_bytes >= 0.8 * 256 * 1048576}<p role="alert" class="text-(--orange)">La file d’attente approche de sa limite. Vérifiez les livraisons avant qu’elle ne soit pleine.</p>{/if}
            {#if config.stats.last_error}<p role="alert" class="text-(--red)">{config.stats.last_error}</p>{/if}
            {#if config.stats.withdrawals_pending}<p class="text-(--orange)">Les données restent potentiellement accessibles sur le site jusqu’à confirmation du retrait.</p>{/if}
        </div>
    </SettingsRow>
    <SettingsRow icon="ShieldOff" title="Retirer tous les suivis" description="Demande la suppression des données publiées sur le site. Les copies indépendantes ne peuvent pas être effacées." variant="destructive">
        {#snippet action()}<Button variant="error" size="sm" icon="ShieldOff" label="Retirer les données" disabled={busy || (config.state !== "active" && config.state !== "paused")} confirm confirmTitle="Retirer tous les suivis du site ?" confirmDescription="Chaque suivi sera retiré après confirmation de livraison. Pendant une interruption, les données peuvent rester accessibles. Les données internes ne sont pas supprimées." confirmCancelLabel="Annuler" confirmConfirmLabel="Retirer" confirmConfirmVariant="error" onclick={() => onAction("unpublish")} />{/snippet}
    </SettingsRow>
    {#if config.state === "paused" || config.state === "reconcile" || (config.state === "disabled" && previouslyActivated)}
        <SettingsRow icon="RotateCcw" title="Réinitialiser la synchronisation" description="À utiliser uniquement après avoir coordonné une nouvelle génération et une nouvelle clé avec le site." toneClass="bg-amber-50 text-amber-700">
            {#snippet action()}<Button variant="warning" size="sm" icon="RotateCcw" label="Réinitialiser" disabled={busy || !canSend || !canResetGeneration} confirm confirmTitle="Réinitialiser le suivi ?" confirmDescription="Le site doit avoir retiré l’ancienne génération et accepté la nouvelle. Les anciens envois seront annulés et les informations actuellement publiées seront renvoyées." confirmCancelLabel="Annuler" confirmConfirmLabel="Réinitialiser" confirmConfirmVariant="warning" onclick={() => onAction("reset")} />{/snippet}
            {#if !canResetGeneration}<p class="text-xs text-(--grey)">Enregistrez une génération supérieure dans les réglages de connexion avant de réinitialiser.</p>{/if}
        </SettingsRow>
    {/if}
</SettingsSection>
