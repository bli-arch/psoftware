<script lang="ts">
    import { onMount } from "svelte";
    import { FormManager } from "$lib/components/FormBuilder";
    import { IdentifierTemplateSettingsRow } from "$lib/components/identifiers";
    import { SettingsAccordionRow, SettingsExpandableRow, SettingsPage, SettingsRow, SettingsSection, SettingsTable, SettingsToggleRow } from "$lib/components/settings";
    import { Select } from "$lib/components/istyler";
    import { apiGet } from "$lib/api";
    import { bootstrapSettings, updateAppSettings } from "$lib/settings";
    import { bootstrapClient, clearBootstrapCache, type WorkspaceSetup } from "$lib/system";
    import { CLIENT_COLUMNS } from "$lib/workspaceSetup";
    import ColumnsSettingsDrilldown from "../operation/ColumnsSettingsDrilldown.svelte";

    let clientColumnsOpen = $state(false);
    let activeClientFormData: any = $state(null);
    let clients = $state({
        activity: true,
    });
    let settingsReady = $state(false);
    let settingsSaveError: string | null = $state(null);
    let workspaceSetup: WorkspaceSetup | null = $state(null);
    let clientIdentifierOpen = $state(false);

    async function refreshSetup() {
        clearBootstrapCache();
        workspaceSetup = (await bootstrapClient({ force: true })).setup ?? null;
    }

    const syncClientSettings = async () => {
        const snapshot = await bootstrapSettings();
        clients.activity = snapshot.value.clients.activity;
        settingsReady = true;
    };

    const saveClientActivity = async (value: boolean) => {
        if (!settingsReady) return;
        settingsSaveError = null;
        try {
            await updateAppSettings({ clients: { activity: value } });
        } catch (error) {
            console.error("Failed to save client settings", error);
            settingsSaveError = "Impossible d'enregistrer ce paramètre.";
            await syncClientSettings().catch(() => {});
        }
    };

    onMount(async () => {
        const openSection = new URLSearchParams(window.location.search).get("open");
        clientColumnsOpen = openSection === "columns";
        clientIdentifierOpen = openSection === "identifier";

        await refreshSetup().catch((error) => console.error("Failed to load workspace setup", error));
        await syncClientSettings().catch((error) => {
            console.error("Failed to load client settings", error);
            settingsSaveError = "Impossible de charger certains paramètres.";
        });

        try {
            activeClientFormData = await apiGet("/settings/form/active/client");
        } catch (error) {
            console.error("Failed to load client form", error);
        }
    });
</script>

<SettingsPage
    title="Clients"
    description="Configurez les formulaires, les colonnes, les identifiants et les fonctionnalités des clients."
>
    <SettingsSection label="Formulaire">
        <SettingsRow
            icon="SquareScissors"
            title="Personnalisation du formulaire"
            description="Configurez les champs et leur organisation pour vos clients."
            toneClass="bg-indigo-50 text-indigo-700"
            attention={workspaceSetup?.clientForm === false}
        >
            {#snippet action()}
                <FormManager
                    formType="client"
                    triggerLabel="Ouvrir le créateur de formulaire"
                    description="Gérez les formulaires utilisés pour vos clients."
                    defaultPageTitles={["Identité", "Coordonnées"]}
                    fallbackPageTitle="Informations générales"
                    fallbackPageDescription="Informations principales pour les clients."
                    newFormNamePlaceholder="ex. Fiche client"
                    newFormSettings={{ tableSettings: CLIENT_COLUMNS, pageSize: 15 }}
                    onSaved={(form) => {
                        if (form.is_active) activeClientFormData = form;
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
            description="Configurez les colonnes affichées dans la liste de vos clients."
            toneClass="bg-stone-100 text-stone-700"
            bind:open={clientColumnsOpen}
            bodyPadding={false}
            keepMounted
            attention={workspaceSetup?.clientColumns === false}
        >
            <ColumnsSettingsDrilldown
                formType="client"
                fieldPrefix="client"
                maxColumns={20}
                initialFormData={activeClientFormData}
                onSaved={refreshSetup}
            />
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Identifiants">
        <IdentifierTemplateSettingsRow
            formType="client"
            rowValue="client-identifier"
            title="Format des identifiants"
            description="Définissez le format des identifiants des clients."
            defaultValue="CLI-%D<%Y%m%d>%-%4N%"
            attention={workspaceSetup?.clientIdentifier === false}
            bind:open={clientIdentifierOpen}
            onSaved={refreshSetup}
        />
    </SettingsSection>

    <!-- <SettingsSection label="Recherche et doublons">
        <SettingsToggleRow
            icon="SearchCheck"
            title="✘ Recherche rapide"
            description="Active une recherche client optimisée."
            name="client-quick-search"
            toneClass="bg-blue-50 text-blue-700"
            bind:value={clients.quickSearch}
        />
    </SettingsSection> -->

    <!-- <SettingsSection label="Import / Export">
        <SettingsRow icon="Upload" title="✘ Import clients" description="Importe des clients depuis un fichier." toneClass="bg-emerald-50 text-emerald-700">
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="Upload" label="Importer" />
            {/snippet}
        </SettingsRow>
        <SettingsRow icon="Download" title="✘ Export clients" description="Exporte la liste des clients." toneClass="bg-cyan-50 text-cyan-700">
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="Download" label="Exporter" />
            {/snippet}
        </SettingsRow>
    </SettingsSection> -->

    <!-- 
    
    <SettingsSection label="Jeux de données">
        <SettingsAccordionRow
            value="client-datasets"
            icon="Database"
            title="✘ Jeux de données"
            description="Gère les données utilisées dans les champs."
            toneClass="bg-blue-50 text-blue-700"
        >
            {#snippet table()}
                <SettingsTable
                    columns={[
                        { key: "name", label: "Liste" },
                        { key: "type", label: "Type" },
                        { key: "usage", label: "Utilisation" },
                    ]}
                    rows={[
                        { name: "Origines client", type: "Sélecteur", usage: "Création client" },
                        { name: "Types de client", type: "Badges", usage: "Segmentation" },
                        { name: "Préférences de contact", type: "Sélecteur", usage: "Contact" },
                    ]}
                />
            {/snippet}
        </SettingsAccordionRow>
    </SettingsSection>

     -->

    <SettingsSection label="Fonctionnalités">
        {#if settingsSaveError}
            <div class="rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
                {settingsSaveError}
            </div>
        {/if}
        <SettingsToggleRow 
            icon="Activity" 
            title="Activité" 
            description="Conservez l’historique des modifications de chaque client."
            name="client-history" 
            toneClass="bg-blue-50 text-blue-700" 
            bind:value={clients.activity} 
            onChange={saveClientActivity}
        />

    </SettingsSection>
</SettingsPage>
