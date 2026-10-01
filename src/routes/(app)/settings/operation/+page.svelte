<script lang="ts">
    import { denormalizeFormPages, FormManager } from "$lib/components/FormBuilder";
    import { pages, currentPage } from "$lib/components/FormBuilder/stores";
    import { IdentifierTemplateSettingsRow } from "$lib/components/identifiers";
    import {
        SettingsAccordionRow,
        SettingsExpandableRow,
        SettingsGroup,
        SettingsPage,
        SettingsRow,
        SettingsSection,
        SettingsToggleRow,
    } from "$lib/components/settings";
    import { apiGet } from "$lib/api";
    import { appSettings, bootstrapSettings, updateAppSettings } from "$lib/settings";
    import { bootstrapClient, clearBootstrapCache, type WorkspaceSetup } from "$lib/system";
    import { OPERATION_COLUMNS } from "$lib/workspaceSetup";
    import { operationPluralLower, operationSingular, operationSingularLower } from "$lib/operationDisplay";
    import { onMount } from "svelte";

    import ColumnsSettingsDrilldown from "./ColumnsSettingsDrilldown.svelte";
    import StatesSettings from "./statesSettings.svelte";

    let tableSettingsExist: boolean = $state(true);
    let activeOperationFormData: any = $state(null);
    let activeOperationStatesData: any[] | null = $state(null);
    let settingsReady = $state(false);
    let settingsSaveError: string | null = $state(null);
    let switchValues = $state<Record<string, boolean>>({
        notes: false,
        activity: false,
        notesMarkdown: false,
    });
    let operationColumnsOpen = $state(false);
    let operationStatesOpen = $state(false);
    let operationIdentifierOpen = $state(false);
    let workspaceSetup: WorkspaceSetup | null = $state(null);

    async function refreshSetup() {
        clearBootstrapCache();
        workspaceSetup = (await bootstrapClient({ force: true })).setup ?? null;
    }

    const syncOperationSettings = async () => {
        const snapshot = await bootstrapSettings();
        switchValues.notes = snapshot.value.operation.notesEnabled;
        switchValues.notesMarkdown = snapshot.value.operation.notesMarkdownEnabled;
        switchValues.activity = snapshot.value.operation.operationActivityEnabled;
        settingsReady = true;
    };

    const saveOperationSetting = async (
        key: "notesEnabled" | "notesMarkdownEnabled" | "operationActivityEnabled",
        value: boolean,
    ) => {
        if (!settingsReady) return;

        settingsSaveError = null;
        try {
            await updateAppSettings({ operation: { [key]: value } });
        } catch (error) {
            console.error("Failed to save operation settings", error);
            settingsSaveError = "Impossible d'enregistrer ce paramètre.";
            await syncOperationSettings().catch(() => {});
        }
    };

    onMount(async () => {
        const openSection = new URLSearchParams(window.location.search).get("open");
        operationColumnsOpen = openSection === "columns";
        operationStatesOpen = openSection === "statuses";
        operationIdentifierOpen = openSection === "identifier";

        await refreshSetup().catch((error) => console.error("Failed to load workspace setup", error));

        await syncOperationSettings().catch((error) => {
            console.error("Failed to load app settings", error);
            settingsSaveError = "Impossible de charger certains paramètres.";
        });

        try {
            const activeFormData = await apiGet("/settings/form/active/operation");
            activeOperationFormData = activeFormData;
            if (activeFormData?.form?.pages) {
                pages.set(denormalizeFormPages(activeFormData.form.pages));
                currentPage.set(0);
            }
            tableSettingsExist = Boolean(activeFormData?.settings?.tableSettings);
        } catch (error) {
            console.error("Failed to load form", error);
        }

        try {
            const statesData = await apiGet("/settings/state/");
            activeOperationStatesData = statesData?.results ?? statesData ?? [];
        } catch (error) {
            console.error("Failed to load states", error);
        }
    });
</script>

<SettingsPage
    title={operationSingular($appSettings.value.operation)}
    description={`Configurez les formulaires, les colonnes, les statuts, les identifiants et les fonctionnalités de vos ${operationPluralLower($appSettings.value.operation)}.`}
>
    <SettingsSection label="Formulaire">
        <SettingsRow
            icon="SquareScissors"
            title="Personnalisation du formulaire"
            description={`Configurez les champs et leur organisation pour vos ${operationPluralLower($appSettings.value.operation)}.`}
            toneClass="bg-indigo-50 text-indigo-700"
            attention={workspaceSetup?.operationForm === false}
        >
            {#snippet action()}
                <FormManager
                    formType="operation"
                    triggerLabel="Ouvrir le créateur de formulaire"
                    description={`Gérez les formulaires utilisés pour vos ${operationPluralLower($appSettings.value.operation)}.`}
                    defaultPageTitles={["Appareil", "Devis"]}
                    fallbackPageTitle="Informations générales"
                    fallbackPageDescription={`Informations principales pour vos ${operationPluralLower($appSettings.value.operation)}.`}
                    newFormSettings={{ tableSettings: OPERATION_COLUMNS, pageSize: 15 }}
                    onSaved={(form) => {
                        if (form.is_active) activeOperationFormData = form;
                        void refreshSetup();
                    }}
                />
            {/snippet}
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Tableau">

        <SettingsAccordionRow
            value="client-columns"
            icon="Columns3"
            title="Colonnes du tableau"
            description={`Configurez les colonnes affichées dans la liste de vos ${operationPluralLower($appSettings.value.operation)}.`}
            toneClass="bg-stone-100 text-stone-700"
            bind:open={operationColumnsOpen}
            bodyPadding={false}
            keepMounted
            attention={workspaceSetup?.operationColumns === false}
        >
            <ColumnsSettingsDrilldown
                formType="operation"
                fieldPrefix="operation"
                maxColumns={20}
                initialFormData={activeOperationFormData}
                initialStates={activeOperationStatesData}
                onSaved={refreshSetup}
            />
        </SettingsAccordionRow>



        <SettingsAccordionRow
            value="operation-statuses"
            icon="Route"
            title="Statuts"
            description="Définissez les statuts disponibles et leur ordre dans le workflow."
            toneClass="bg-orange-50 text-orange-700"
            bind:open={operationStatesOpen}
            bodyPadding={false}
            keepMounted
            attention={workspaceSetup?.operationStatuses === false}
        >
            <StatesSettings
                initialStates={activeOperationStatesData}
                onSaved={refreshSetup}
            />
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Identifiants">
        <IdentifierTemplateSettingsRow
            formType="operation"
            rowValue="identifier"
            title="Format des identifiants"
            description={`Définissez le format des identifiants des ${operationPluralLower($appSettings.value.operation)}.`}
            defaultValue="OP-%D<%Y%m%d>%-%4N%"
            attention={workspaceSetup?.operationIdentifier === false}
            bind:open={operationIdentifierOpen}
            onSaved={refreshSetup}
        />
    </SettingsSection>

    <SettingsSection label="Fonctionnalités">
        {#if settingsSaveError}
            <div class="rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
                {settingsSaveError}
            </div>
        {/if}

            <SettingsExpandableRow
                icon="MessageSquare"
                title="Notes"
                description={`Autoriser l'ajout de notes d'équipe dans chaque ${operationSingularLower($appSettings.value.operation)}.`}
                name="operation-notes"
                toneClass="bg-emerald-50 text-emerald-700"
                bind:value={switchValues.notes}
                onChange={(value) => saveOperationSetting("notesEnabled", value)}
                bodyPadding={false}
            >
                <SettingsGroup>
                    <SettingsToggleRow
                        icon="Pilcrow"
                        title="Activer Markdown"
                        description={`Autoriser la mise en forme Markdown dans les notes de ${operationSingularLower($appSettings.value.operation)}.`}
                        name="operation-notes-markdown"
                        toneClass="bg-slate-100 text-slate-700"
                        bind:value={switchValues.notesMarkdown}
                        onChange={(value) => saveOperationSetting("notesMarkdownEnabled", value)}
                        inline={true}
                    />
                </SettingsGroup>
            </SettingsExpandableRow>

        <SettingsGroup>
            <SettingsToggleRow
                icon="Activity"
                title="Activité"
                description={`Conservez l’historique des modifications de chaque ${operationSingularLower($appSettings.value.operation)}.`}
                name="operation-activity"
                toneClass="bg-blue-50 text-blue-700"
                bind:value={switchValues.activity}
                onChange={(value) => saveOperationSetting("operationActivityEnabled", value)}
            />
        </SettingsGroup>
    </SettingsSection>
</SettingsPage>

<!--
Paramètres non implémentés :
    Priorités : Niveau d'urgence visible dans la fiche opération.
    Dates limites : Échéances et rappels associés aux opérations.
    Assignation : Affecter une opération à un ou plusieurs membres.
    Checklist : Liste d'étapes à valider avant de clôturer.
    Documents : Pièces jointes et fichiers de suivi.
    Édition rapide : Modifier certains champs depuis la liste.
    Partage client : Lien de suivi consultable par le client.
    Automatisations : Préparer les règles futures liées aux opérations.
-->
