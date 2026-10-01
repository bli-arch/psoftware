<script lang="ts">
    import { IdentifierTemplateCreator } from "$lib/components/identifiers";
    import { Button, Select, TextInput } from "$lib/components/istyler";
    import SettingsAccordionRow from "./SettingsAccordionRow.svelte";
    import SettingsPage from "./SettingsPage.svelte";
    import SettingsSection from "./SettingsSection.svelte";
    import SettingsToggleRow from "./SettingsToggleRow.svelte";

    type Feature = {
        id: string;
        title: string;
        description: string;
        icon: string;
        toneClass: string;
    };

    type Dataset = {
        name: string;
        type: string;
        values: string;
        usage: string;
    };

    type Props = {
        title: string;
        description: string;
        formTitle: string;
        formDescription: string;
        columnDescription: string;
        identifierDescription: string;
        identifierPrefix: string;
        features: Feature[];
        datasets?: Dataset[];
    };

    let {
        title,
        description,
        formTitle,
        formDescription,
        columnDescription,
        identifierDescription,
        identifierPrefix,
        features,
        datasets = [],
    }: Props = $props();

    function initialIdentifierFormat() {
        return `${identifierPrefix}-%D<%Y%m%d>%-%4N%`;
    }

    function initialFeatureValues() {
        return Object.fromEntries(features.map((feature) => [feature.id, false]));
    }

    let identifierFormat = $state(initialIdentifierFormat());
    let displayMode = $state("text");
    let featureValues = $state<Record<string, boolean>>(initialFeatureValues());
    let entityOptions = $state({
        quickSearch: true,
        archiveHistory: true,
        mergeDuplicates: false,
    });
    let datasetOptions = $state({
        lockValues: true,
        allowSuggestions: false,
        auditChanges: true,
    });
</script>

<SettingsPage {title} {description}>
    <SettingsSection label="Formulaire">
        <SettingsAccordionRow
            value={`${identifierPrefix}-form`}
            icon="SquareScissors"
            title={formTitle}
            description={formDescription}
            toneClass="bg-indigo-50 text-indigo-700"
            defaultOpen={true}
        >
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="SquareScissors" label="Ouvrir le créateur" />
            {/snippet}

            <div class="grid gap-3 md:grid-cols-3">
                <TextInput name={`${identifierPrefix}-form-name`} label="Nom du formulaire" value="Formulaire principal" />
                <Select
                    name={`${identifierPrefix}-form-start`}
                    label="Page initiale"
                    value="identity"
                    allowDeselect={false}
                    options={[{ label: "Identité", value: "identity" }, { label: "Contact", value: "contact" }, { label: "Détails", value: "details" }]}
                />
                <Select
                    name={`${identifierPrefix}-form-display`}
                    label="Affichage par défaut"
                    bind:value={displayMode}
                    allowDeselect={false}
                    options={[{ label: "Texte", value: "text" }, { label: "Badge", value: "badge" }, { label: "Date", value: "date" }]}
                />
            </div>
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Tableau">
        <SettingsAccordionRow
            value={`${identifierPrefix}-columns`}
            icon="Columns3"
            title="Colonnes du tableau"
            description={columnDescription}
            toneClass="bg-stone-100 text-stone-700"
        >
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="Settings2" label="Modifier" />
            {/snippet}

            <div class="overflow-hidden rounded-lg border border-(--light-bg3)">
                <div class="grid grid-cols-[1.4fr_1fr_1fr_90px] bg-(--light-bg2) px-3 py-2 text-xs font-semibold uppercase tracking-wider text-(--grey)">
                    <span>Colonne</span>
                    <span>Donnée</span>
                    <span>Affichage</span>
                    <span class="text-right">Visible</span>
                </div>
                {#each [
                    ["Identifiant", "uid", "Texte"],
                    ["Nom", "form.name", "Texte"],
                    ["Création", "created_at", "Date"],
                ] as row}
                    <div class="grid grid-cols-[1.4fr_1fr_1fr_90px] border-t border-(--light-bg3) px-3 py-2 text-sm">
                        <span class="truncate font-medium text-(--dark-bg1)">{row[0]}</span>
                        <span class="truncate text-(--grey)">{row[1]}</span>
                        <span class="truncate text-(--dark-bg1)">{row[2]}</span>
                        <span class="text-right text-xs font-semibold text-(--green)">Oui</span>
                    </div>
                {/each}
            </div>
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Identifiants">
        <SettingsAccordionRow
            value={`${identifierPrefix}-identifier`}
            icon="Hash"
            title="Format des identifiants"
            description={identifierDescription}
            toneClass="bg-amber-50 text-amber-700"
        >
            <IdentifierTemplateCreator bind:value={identifierFormat} />
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Fonctionnalités">
        {#each features as feature (feature.id)}
            <SettingsToggleRow
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                name={`${identifierPrefix}-${feature.id}`}
                toneClass={feature.toneClass}
                bind:value={featureValues[feature.id]}
            />
        {/each}
    </SettingsSection>

    {#if datasets.length}
        <SettingsSection label="Listes de données">
            <SettingsAccordionRow
                value={`${identifierPrefix}-datasets`}
                icon="Database"
                title="Jeux de valeurs"
                description={`Gérez les listes utilisées uniquement par les ${title.toLowerCase()}.`}
                toneClass="bg-blue-50 text-blue-700"
            >
                {#snippet action()}
                    <Button variant="secondary" size="sm" icon="Plus" label="Ajouter" />
                {/snippet}

                <div class="overflow-hidden rounded-lg border border-(--light-bg3)">
                    <div class="grid grid-cols-[1.2fr_130px_100px_1fr] bg-(--light-bg2) px-3 py-2 text-xs font-semibold uppercase tracking-wider text-(--grey)">
                        <span>Liste</span>
                        <span>Type</span>
                        <span>Valeurs</span>
                        <span>Utilisation</span>
                    </div>
                    {#each datasets as dataset}
                        <div class="grid grid-cols-[1.2fr_130px_100px_1fr] border-t border-(--light-bg3) px-3 py-2 text-sm">
                            <span class="truncate font-medium text-(--dark-bg1)">{dataset.name}</span>
                            <span class="truncate text-(--dark-bg1)">{dataset.type}</span>
                            <span class="truncate text-(--grey)">{dataset.values}</span>
                            <span class="truncate text-xs font-semibold text-(--blue)">{dataset.usage}</span>
                        </div>
                    {/each}
                </div>
            </SettingsAccordionRow>

            <SettingsToggleRow
                icon="LockKeyhole"
                title="Verrouiller les valeurs utilisées"
                description="Conserver les anciennes fiches lisibles lorsqu'une valeur est renommée ou archivée."
                name={`${identifierPrefix}-dataset-lock-values`}
                toneClass="bg-red-50 text-red-700"
                bind:value={datasetOptions.lockValues}
            />
            <SettingsToggleRow
                icon="Lightbulb"
                title="Suggestions libres"
                description="Autoriser les utilisateurs à proposer une nouvelle valeur depuis un formulaire."
                name={`${identifierPrefix}-dataset-suggestions`}
                toneClass="bg-amber-50 text-amber-700"
                bind:value={datasetOptions.allowSuggestions}
            />
            <SettingsToggleRow
                icon="History"
                title="Historique des modifications"
                description="Garder une trace des ajouts, renommages et archivages de valeurs."
                name={`${identifierPrefix}-dataset-audit`}
                toneClass="bg-cyan-50 text-cyan-700"
                bind:value={datasetOptions.auditChanges}
            />
        </SettingsSection>
    {/if}

    <SettingsSection label="Données">
        <SettingsToggleRow
            icon="SearchCheck"
            title="Recherche rapide"
            description="Préparer l'index des champs les plus utiles dans les vues de sélection."
            name={`${identifierPrefix}-quick-search`}
            toneClass="bg-blue-50 text-blue-700"
            bind:value={entityOptions.quickSearch}
        />
        <SettingsToggleRow
            icon="History"
            title="Historique des modifications"
            description="Garder une lecture claire des changements importants sur chaque fiche."
            name={`${identifierPrefix}-archive-history`}
            toneClass="bg-stone-100 text-stone-700"
            bind:value={entityOptions.archiveHistory}
        />
        <SettingsToggleRow
            icon="Combine"
            title="Fusion des doublons"
            description="Préparer un flux de nettoyage quand deux fiches décrivent le même élément."
            name={`${identifierPrefix}-merge-duplicates`}
            toneClass="bg-violet-50 text-violet-700"
            bind:value={entityOptions.mergeDuplicates}
        />
    </SettingsSection>
</SettingsPage>
