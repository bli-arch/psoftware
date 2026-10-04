<script lang="ts">
    import { Button, TextInput } from "$lib/components/istyler";
    import { SettingsAccordionRow } from "$lib/components/settings";
    import type { TrackingConfig, TrackingConfigPatch } from "$lib/tracking";

    let { config, busy, onSave }: {
        config: TrackingConfig;
        busy: boolean;
        onSave: (patch: TrackingConfigPatch) => Promise<boolean>;
    } = $props();

    let endpoint = $state("");
    let publicBaseUrl = $state("");
    let integrationId = $state("");
    let generation = $state("1");
    let keyId = $state("");
    let secret = $state("");
    let secretCopied = $state(false);
    let copyError = $state("");

    $effect(() => {
        endpoint = config.endpoint;
        publicBaseUrl = config.public_base_url;
        integrationId = config.integration_id;
        generation = config.generation;
        keyId = config.key_id;
    });

    const bindingLocked = $derived(config.state === "active" || config.state === "withdrawing");
    const bindingChanged = $derived(endpoint !== config.endpoint || integrationId !== config.integration_id || generation !== config.generation);
    const dirty = $derived(bindingChanged || publicBaseUrl !== config.public_base_url || keyId !== config.key_id || !!secret);
    const validationError = $derived.by(() => {
        for (const [value, label] of [[endpoint, "L’adresse de réception"], [publicBaseUrl, "L’adresse de suivi"]]) {
            if (!value && label === "L’adresse de suivi") continue;
            try {
                const url = new URL(value);
                if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || (url.port && url.port !== "443")) return `${label} doit utiliser HTTPS, sans identifiants, paramètres ni fragment.`;
            } catch { return `${label} est invalide.`; }
        }
        if (!/^[A-Za-z0-9_-]{43}$/.test(integrationId)) return "L’identifiant d’intégration doit contenir 43 caractères base64url.";
        if (!/^[1-9][0-9]*$/.test(generation)) return "La génération doit être un entier positif.";
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(keyId)) return "Le nom de clé accepte de 1 à 64 lettres, chiffres, tirets ou underscores.";
        if (secret && !/^[A-Za-z0-9_-]{43}$/.test(secret)) return "La clé de signature doit contenir 32 octets aléatoires encodés en base64url (43 caractères).";
        if (!secret && !config.has_secret) return "Une clé de signature est nécessaire.";
        return null;
    });

    function randomCredential() {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    }

    async function copySecret() {
        copyError = "";
        try {
            await navigator.clipboard.writeText(secret);
            secretCopied = true;
        } catch {
            copyError = "Impossible de copier la clé. Sélectionnez-la dans le champ pour la copier manuellement.";
        }
    }

    async function save() {
        if (busy || validationError || !dirty) return;
        const patch: TrackingConfigPatch = {
            endpoint, public_base_url: publicBaseUrl, integration_id: integrationId,
            generation, key_id: keyId,
            ...(secret ? { signing_secret: secret } : {}),
        };
        try { await onSave(patch); }
        finally { secret = ""; secretCopied = false; copyError = ""; }
    }
</script>

<SettingsAccordionRow value="tracking-connection" icon="Waypoints" title="Connexion" description="Le serveur envoie uniquement les informations publiées à cette adresse." toneClass="bg-blue-50 text-blue-700">
    {#snippet action()}
        <Button size="sm" icon="Save" label="Enregistrer" disabled={busy || !dirty || !!validationError}
            confirm={bindingChanged && !!config.endpoint} confirmTitle="Changer la connexion de suivi ?"
            confirmDescription="Les anciens envois ne seront pas transférés à la nouvelle destination. Retirez les données sur l’ancien site avant de changer de connexion, puis coordonnez la réinitialisation avec son administrateur."
            confirmCancelLabel="Annuler" confirmConfirmLabel="Enregistrer" onclick={(event: MouseEvent) => { event.stopPropagation(); void save(); }} />
    {/snippet}
    <div class="grid gap-3 md:grid-cols-2">
        <TextInput name="tracking-endpoint" label="Adresse de réception" placeholder="https://exemple.fr/api/suivi" bind:value={endpoint} disabled={busy || bindingLocked} tabindex={0} />
        <TextInput name="tracking-public-url" label="Adresse des pages de suivi (facultatif)" placeholder="https://exemple.fr/suivi" bind:value={publicBaseUrl} disabled={busy} tabindex={0} />
        <div class="flex items-end gap-2">
            <TextInput name="tracking-integration" label="Identifiant d’intégration" bind:value={integrationId} disabled={busy || bindingLocked} tabindex={0} />
            <Button variant="secondary" size="sm" icon="Dices" tooltip="Créer un identifiant aléatoire" disabled={busy || bindingLocked} onclick={() => { integrationId = randomCredential(); }} class="w-fit shrink-0" />
        </div>
        <TextInput name="tracking-generation" label="Génération" bind:value={generation} disabled={busy || bindingLocked} tabindex={0} />
        <TextInput name="tracking-key-id" label="Nom de la clé" placeholder="tracking-1" bind:value={keyId} disabled={busy} tabindex={0} />
        <div class="flex items-end gap-2">
            <TextInput name="tracking-secret" type="password" label="Clé de signature" placeholder={config.has_secret ? "Clé enregistrée. Laisser vide pour la conserver." : "Clé partagée avec le site"} autocomplete="new-password" bind:value={secret} disabled={busy} tabindex={0} />
            <Button variant="secondary" size="sm" icon="Dices" tooltip="Créer une clé aléatoire" disabled={busy} onclick={() => { secret = randomCredential(); secretCopied = false; }} class="w-fit shrink-0" />
        </div>
    </div>
    {#if secret}
        <div class="mt-3 flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" icon={secretCopied ? "Check" : "Copy"} label={secretCopied ? "Clé copiée" : "Copier la clé"} disabled={busy} onclick={() => { void copySecret(); }} class="w-fit" />
            <p class="text-xs text-(--grey)">Configurez cette clé sur le site avant d’enregistrer. Elle ne sera plus affichée ensuite.</p>
        </div>
    {/if}
    {#if copyError}<p role="alert" class="mt-2 text-xs text-(--red)">{copyError}</p>{/if}
    {#if bindingLocked}
        <p class="mt-3 text-xs text-(--grey)">Mettez les envois en pause avant de modifier la destination ou la génération.</p>
    {/if}
    {#if dirty && validationError}<p role="alert" class="mt-3 text-xs text-(--red)">{validationError}</p>{/if}
</SettingsAccordionRow>
