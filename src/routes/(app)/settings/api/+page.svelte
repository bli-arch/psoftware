<script lang="ts">
    import { SettingsAccordionRow, SettingsExpandableRow, SettingsPage, SettingsRow, SettingsSection, SettingsTable, SettingsToggleRow } from "$lib/components/settings";
    import { Button, NumberInput, Select, TextInput } from "$lib/components/istyler";
    import { appSettings } from "$lib/settings";
    import { operationPlural, operationPluralLower, operationSingularLower } from "$lib/operationDisplay";

    let retryCount = $state(3);
    let retryDelay = $state(30);
    let api = $state({
        operationCreate: true,
        statusChange: true,
        clientCreate: false,
        redactPrivateFields: true,
        retryFailures: true,
        notifyFailures: true,
        testMode: false,
    });
</script>

<SettingsPage
    title="API"
    description="Configurez les entrées API et les envois contrôlés."
>
    <SettingsSection label="Endpoints">
        <SettingsAccordionRow value="active-endpoints" icon="Waypoints" title="✘ Endpoints actifs" description="Liste les points d’entrée configurés." toneClass="bg-blue-50 text-blue-700">
            {#snippet table()}
                <SettingsTable columns={[{ key: "name", label: "Nom" }, { key: "method", label: "Méthode" }, { key: "url", label: "URL" }, { key: "status", label: "Statut" }]} rows={[{ name: `Création ${operationSingularLower($appSettings.value.operation)}`, method: "POST", url: "/api/operations", status: "Actif" }, { name: "Client minimal", method: "POST", url: "/api/clients", status: "Inactif" }]} />
            {/snippet}
        </SettingsAccordionRow>
        <SettingsAccordionRow value="new-endpoint" icon="Plus" title="✘ Nouvel endpoint" description="Ajoute un nouveau point d’entrée API." toneClass="bg-emerald-50 text-emerald-700">
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="Plus" label="Ajouter" />
            {/snippet}
            <div class="grid gap-3 md:grid-cols-[120px_1fr]">
                <Select name="endpoint-method" label="Méthode" value="POST" allowDeselect={false} options={[{ label: "POST", value: "POST" }, { label: "PUT", value: "PUT" }, { label: "PATCH", value: "PATCH" }]} />
                <TextInput name="endpoint-url" label="URL" placeholder="https://..." value="" />
            </div>
        </SettingsAccordionRow>
        <SettingsToggleRow icon="CirclePlus" title={`✘ Création de ${operationSingularLower($appSettings.value.operation)}`} description={`Autorise l’API à créer des ${operationPluralLower($appSettings.value.operation)}.`} name="api-operation-create" toneClass="bg-blue-50 text-blue-700" bind:value={api.operationCreate} />
        <SettingsToggleRow icon="Route" title="✘ Changement de statut" description="Autorise l’API à modifier les statuts." name="api-status-change" toneClass="bg-orange-50 text-orange-700" bind:value={api.statusChange} />
        <SettingsToggleRow icon="UserRoundPlus" title="✘ Création client" description="Autorise l’API à créer des clients." name="api-client-create" toneClass="bg-violet-50 text-violet-700" bind:value={api.clientCreate} />
    </SettingsSection>

    <SettingsSection label="Sécurité API">
        <SettingsRow icon="KeyRound" title="✘ Jetons API" description="Gère les jetons d’accès API." toneClass="bg-amber-50 text-amber-700">
            {#snippet table()}
                <SettingsTable columns={[{ key: "name", label: "Jeton" }, { key: "scope", label: "Portée" }, { key: "lastUse", label: "Dernier usage" }]} rows={[{ name: "Atelier", scope: operationPlural($appSettings.value.operation), lastUse: "Aujourd’hui" }]} />
            {/snippet}
        </SettingsRow>
        <SettingsRow icon="KeyRound" title="✘ Révoquer un jeton" description="Désactive un jeton API existant." variant="destructive">
            {#snippet action()}
                <Button variant="error" size="sm" icon="KeyRound" label="Révoquer" />
            {/snippet}
        </SettingsRow>
        <SettingsToggleRow icon="ShieldEllipsis" title="✘ Masquer les champs privés" description="Exclut les champs privés des réponses API." name="api-redact-private-fields" toneClass="bg-red-50 text-red-700" bind:value={api.redactPrivateFields} />
    </SettingsSection>

    <SettingsSection label="Fiabilité">
        <SettingsToggleRow icon="RefreshCw" title="✘ Réessayer les échecs" description="Relance automatiquement les appels échoués." name="api-retry-failures" toneClass="bg-emerald-50 text-emerald-700" bind:value={api.retryFailures} />
        <SettingsExpandableRow icon="ListRestart" title="✘ Politique de réessai" description="Définit le nombre et le délai des tentatives." name="api-retry-policy" toneClass="bg-stone-100 text-stone-700" value={api.retryFailures}>
            <div class="grid gap-3 md:grid-cols-2">
                <NumberInput name="retry-count" label="Tentatives" min={0} max={10} bind:value={retryCount} />
                <NumberInput name="retry-delay" label="Délai" suffix="s" min={1} max={600} bind:value={retryDelay} />
            </div>
        </SettingsExpandableRow>
        <SettingsToggleRow icon="BellRing" title="✘ Notifier les échecs" description="Alerte les administrateurs en cas d’échec." name="api-notify-failures" toneClass="bg-red-50 text-red-700" bind:value={api.notifyFailures} />
    </SettingsSection>

    <SettingsSection label="Test et routage">
        <SettingsToggleRow icon="FlaskConical" title="✘ Mode test" description="Permet de tester l’API sans impact réel." name="api-test-mode" toneClass="bg-cyan-50 text-cyan-700" bind:value={api.testMode} />
    </SettingsSection>
</SettingsPage>
