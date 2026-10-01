<script lang="ts">
    import { SettingsAccordionRow, SettingsPage, SettingsRow, SettingsSection, SettingsTable, SettingsToggleRow } from "$lib/components/settings";
    import { Button } from "$lib/components/istyler";
    import { appSettings } from "$lib/settings";
    import { operationSingular, operationSingularLower } from "$lib/operationDisplay";

    let shortcuts = $state({
        showHints: true,
    });
</script>

<SettingsPage
    title="Raccourcis"
    description="Préparez les actions rapides utilisables au clavier."
>
    <SettingsSection label="Configuration">
        <SettingsAccordionRow
            value="keyboard-shortcuts"
            icon="Keyboard"
            title="✘ Raccourcis clavier"
            description="Personnalise les raccourcis disponibles."
            toneClass="bg-blue-50 text-blue-700"
            defaultOpen={true}
        >
            {#snippet table()}
                <SettingsTable
                    columns={[
                        { key: "action", label: "Action" },
                        { key: "shortcut", label: "Touches" },
                        { key: "scope", label: "Contexte" },
                    ]}
                    rows={[
                        { action: `Nouvelle ${operationSingularLower($appSettings.value.operation)}`, shortcut: "Ctrl + N", scope: "Global" },
                        { action: "Recherche rapide", shortcut: "Ctrl + K", scope: "Global" },
                        { action: "Ajouter une note", shortcut: "Alt + N", scope: operationSingular($appSettings.value.operation) },
                    ]}
                />
            {/snippet}
        </SettingsAccordionRow>
        <SettingsRow
            icon="RotateCcw"
            title="✘ Réinitialiser les raccourcis"
            description="Restaure les raccourcis par défaut."
            variant="destructive"
        >
            {#snippet action()}
                <Button variant="error" size="sm" icon="RotateCcw" label="Réinitialiser" />
            {/snippet}
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Aide à la navigation">
        <SettingsToggleRow
            icon="MousePointerClick"
            title="✘ Afficher les indices"
            description="Affiche les touches disponibles dans l’interface."
            name="shortcut-hints"
            toneClass="bg-emerald-50 text-emerald-700"
            bind:value={shortcuts.showHints}
        />
        <SettingsRow
            icon="List"
            title="✘ Liste des raccourcis"
            description="Affiche tous les raccourcis disponibles."
            toneClass="bg-stone-100 text-stone-700"
        >
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="List" label="Ouvrir" />
            {/snippet}
        </SettingsRow>
    </SettingsSection>
</SettingsPage>
