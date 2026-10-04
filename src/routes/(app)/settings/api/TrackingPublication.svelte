<script lang="ts">
    import { Button, NumberInput, Select } from "$lib/components/istyler";
    import { SettingsAccordionRow, SettingsToggleRow } from "$lib/components/settings";
    import IdentifierTemplateCreator from "$lib/components/identifiers/IdentifierTemplateCreator.svelte";
    import { validateTrackingIdentifierTemplate } from "$lib/components/identifiers/identifierTemplate";
    import type { TrackingConfig, TrackingConfigPatch } from "$lib/tracking";

    let { config, busy, onSave }: {
        config: TrackingConfig;
        busy: boolean;
        onSave: (patch: TrackingConfigPatch) => Promise<boolean>;
    } = $props();
    let template = $state("SV-%25^R%");
    let accessMode = $state<string | number | Array<string | number> | undefined>("token");
    let expiryHours = $state<number | null>(12);
    let notesEnabled = $state(false);
    $effect(() => {
        template = config.identifier_template;
        accessMode = config.access_mode;
        expiryHours = config.expiry_hours;
        notesEnabled = config.notes_enabled;
    });
    const templateError = $derived(validateTrackingIdentifierTemplate(template));
    const valid = $derived(!templateError && (accessMode === "token" || accessMode === "password") && Number.isInteger(expiryHours) && Number(expiryHours) >= 1 && Number(expiryHours) <= 8760);
    const dirty = $derived(template !== config.identifier_template || accessMode !== config.access_mode || expiryHours !== config.expiry_hours || notesEnabled !== config.notes_enabled);

    async function save() {
        if (busy || !dirty || !valid || (accessMode !== "token" && accessMode !== "password") || expiryHours === null) return;
        await onSave({ identifier_template: template, access_mode: accessMode, expiry_hours: expiryHours, notes_enabled: notesEnabled });
    }
</script>

<SettingsAccordionRow value="tracking-publication" icon="ShieldCheck" title="Publication et accès" description="Les champs et les statuts restent privés tant que vous ne les autorisez pas dans leurs réglages." toneClass="bg-violet-50 text-violet-700">
    {#snippet action()}
        <Button size="sm" icon="Save" label="Enregistrer" disabled={busy || !dirty || !valid} onclick={(event: MouseEvent) => { event.stopPropagation(); void save(); }} />
    {/snippet}
    <div class="flex flex-col gap-4">
        <div>
            <h3 class="mb-2 text-sm font-semibold text-(--dark-bg1)">Format des identifiants de suivi</h3>
            <fieldset disabled={busy} class="min-w-0 disabled:pointer-events-none disabled:opacity-60">
                <IdentifierTemplateCreator bind:value={template} allowedTokenTypes={["randomChars"]} minimumEntropyBits={128} disabled={busy} />
            </fieldset>
            <p class="mt-2 text-xs text-(--grey)">Texte fixe et caractères aléatoires uniquement, avec au moins 128 bits aléatoires. Ce format s’applique aux nouveaux identifiants.</p>
            {#if templateError}<p role="alert" class="mt-2 text-xs text-(--red)">{templateError}</p>{/if}
        </div>
        <div class="grid gap-3 md:grid-cols-2">
            <Select name="tracking-access" label="Accès par défaut" options={[{ label: "Lien privé", value: "token" }, { label: "Lien et mot de passe", value: "password" }]} allowDeselect={false} bind:value={accessMode} disabled={busy} tabindex={0} />
            <NumberInput name="tracking-expiry" label="Expiration après un statut final" suffix="h" min={1} max={8760} bind:value={expiryHours} disabled={busy} tabindex={0} />
        </div>
        <p class="text-xs text-(--grey)">L’expiration commence uniquement au statut final, jamais pendant une attente. Le site doit appliquer cette échéance. Un lien privé donne accès à toute personne qui le possède. Les mots de passe sont définis sur le site ; sans mot de passe défini, un suivi protégé doit rester inaccessible.</p>
        <SettingsToggleRow icon="MessageSquare" title="Autoriser les notes publiques" description="Chaque note reste privée jusqu’à sa publication par une personne autorisée." name="tracking-notes" toneClass="bg-amber-50 text-amber-700" bind:value={notesEnabled} disabled={busy} />
        <p class="text-xs text-(--grey)">Les informations sélectionnées sont envoyées hors de votre entreprise. Un changement d’accès ou un retrait ne prend effet sur le site qu’après confirmation de livraison.</p>
    </div>
</SettingsAccordionRow>
