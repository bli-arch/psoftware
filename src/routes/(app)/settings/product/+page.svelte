<script lang="ts">
    import { IdentifierTemplateSettingsRow } from "$lib/components/identifiers";
    import { SettingsAccordionRow, SettingsExpandableRow, SettingsGroup, SettingsPage, SettingsRow, SettingsSection, SettingsTable, SettingsToggleRow } from "$lib/components/settings";
    import { Button, Checkbox, NumberInput } from "$lib/components/istyler";

    let lowStockThreshold = $state(3);
    let products = $state({
        showPurchasePrice: false,
        showMargin: false,
        stockTracking: true,
        allowNegativeStock: false,
        stockMovements: true,
        quickSearch: true,
        changeHistory: true,
    });
</script>

<SettingsPage
    title="Produits"
    description="Configurez les formulaires, les colonnes, le catalogue, les tarifs et le stock des produits."
>
    <SettingsSection label="Formulaire">
        <SettingsRow icon="SquareScissors" title="✘ Personnalisation du formulaire" description="Configurez les champs et leur organisation pour vos produits." toneClass="bg-indigo-50 text-indigo-700">
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="SquareScissors" label="Ouvrir" />
            {/snippet}
        </SettingsRow>
        <SettingsAccordionRow value="product-columns" icon="Columns3" title="✘ Colonnes du tableau" description="Configurez les colonnes affichées dans la liste de vos produits." toneClass="bg-stone-100 text-stone-700">
            {#snippet table()}
                <SettingsTable
                    columns={[
                        { key: "column", label: "Colonne" },
                        { key: "source", label: "Donnée" },
                        { key: "display", label: "Affichage" },
                        { key: "visible", label: "Visible", align: "right" },
                    ]}
                    rows={[
                        { column: "Référence", source: "uid", display: "Texte", visible: "Oui" },
                        { column: "Nom", source: "data.name", display: "Texte", visible: "Oui" },
                        { column: "Stock", source: "stock", display: "Nombre", visible: "Oui" },
                    ]}
                />
            {/snippet}
        </SettingsAccordionRow>
        <IdentifierTemplateSettingsRow
            formType="product"
            rowValue="product-identifier"
            title="Format des identifiants"
            description="Définissez le format des identifiants des produits."
            defaultValue="PRD-%D<%Y%m%d>%-%4N%"
        />
        <SettingsAccordionRow value="product-search" icon="Search" title="✘ Recherche" description="Choisir les champs dans lesquels rechercher." toneClass="bg-blue-50 text-blue-700">
            {#snippet table()}
                <SettingsTable
                    columns={[
                        { key: "field", label: "Champ" },
                        { key: "enabled", label: "Recherche", align: "right" },
                    ]}
                    rows={[
                        { field: "Référence", enabled: "Oui" },
                        { field: "Nom", enabled: "Oui" },
                        { field: "Code-barres", enabled: "Oui" },
                        { field: "Marque", enabled: "Oui" },
                    ]}
                />
            {/snippet}
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Catalogue">
        <SettingsAccordionRow value="product-categories" icon="Tags" title="✘ Catégories" description="Gère les catégories de produits." toneClass="bg-violet-50 text-violet-700">
            {#snippet table()}
                <SettingsTable columns={[{ key: "name", label: "Catégorie" }, { key: "count", label: "Produits", align: "right" }]} rows={[{ name: "Pièces", count: 0 }, { name: "Services", count: 0 }]} />
            {/snippet}
        </SettingsAccordionRow>
        <SettingsAccordionRow value="product-brands" icon="Badge" title="✘ Marques" description="Gère les marques de produits." toneClass="bg-cyan-50 text-cyan-700">
            {#snippet table()}
                <SettingsTable columns={[{ key: "name", label: "Marque" }, { key: "count", label: "Produits", align: "right" }]} rows={[{ name: "Générique", count: 0 }]} />
            {/snippet}
        </SettingsAccordionRow>
        <SettingsAccordionRow value="product-barcodes" icon="ScanBarcode" title="✘ Codes-barres" description="Gère les codes-barres produits." toneClass="bg-emerald-50 text-emerald-700">
            {#snippet table()}
                <SettingsTable columns={[{ key: "type", label: "Type" }, { key: "usage", label: "Usage" }]} rows={[{ type: "EAN", usage: "Recherche et étiquettes" }, { type: "Interne", usage: "Stock" }]} />
            {/snippet}
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Tarifs">
        <SettingsAccordionRow value="product-prices" icon="BadgeEuro" title="✘ Tarifs" description="Configure les prix principaux." toneClass="bg-amber-50 text-amber-700">
            {#snippet table()}
                <SettingsTable columns={[{ key: "price", label: "Tarif" }, { key: "enabled", label: "Actif", align: "right" }]} rows={[{ price: "Prix de vente", enabled: "Oui" }, { price: "Prix d’achat", enabled: "Selon permission" }]} />
            {/snippet}
        </SettingsAccordionRow>
        <SettingsToggleRow icon="ShoppingCart" title="✘ Afficher le prix d’achat" description="Affiche le coût d’achat aux utilisateurs autorisés." name="show-purchase-price" toneClass="bg-red-50 text-red-700" bind:value={products.showPurchasePrice} />
        <SettingsToggleRow icon="TrendingUp" title="✘ Afficher la marge" description="Affiche la marge aux utilisateurs autorisés." name="show-margin" toneClass="bg-emerald-50 text-emerald-700" bind:value={products.showMargin} />
    </SettingsSection>

    <SettingsSection label="Stock">
        <SettingsExpandableRow icon="Boxes" title="✘ Suivi de stock" description="Active la gestion du stock produit." name="stock-tracking" toneClass="bg-blue-50 text-blue-700" bind:value={products.stockTracking} bodyPadding={false}>
            <SettingsGroup>
                <SettingsRow title="✘ Seuil de stock bas" description="Niveau déclenchant une alerte de stock." inline={true}>
                    {#snippet action()}
                        <div class="w-36">
                            <NumberInput name="low-stock-threshold" label="Seuil" min={0} max={999} bind:value={lowStockThreshold} />
                        </div>
                    {/snippet}
                </SettingsRow>
                <SettingsRow title="✘ Stock négatif autorisé" description="Autorise un stock inférieur à zéro." inline={true}>
                    {#snippet action()}
                        <Checkbox name="allow-negative-stock" switchMode={true} bind:value={products.allowNegativeStock} />
                    {/snippet}
                </SettingsRow>
                <SettingsRow title="✘ Mouvements de stock" description="Enregistre les entrées et sorties de stock." inline={true}>
                    {#snippet action()}
                        <Checkbox name="stock-movements" switchMode={true} bind:value={products.stockMovements} />
                    {/snippet}
                </SettingsRow>
            </SettingsGroup>
        </SettingsExpandableRow>
    </SettingsSection>

    <SettingsSection label="Recherche et doublons">
        <SettingsToggleRow icon="SearchCheck" title="✘ Recherche rapide" description="Active une recherche produit optimisée." name="product-quick-search" toneClass="bg-blue-50 text-blue-700" bind:value={products.quickSearch} />
    </SettingsSection>

    <SettingsSection label="Import / Export">
        <SettingsRow icon="Upload" title="✘ Import produits" description="Importe des produits depuis un fichier." toneClass="bg-emerald-50 text-emerald-700">
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="Upload" label="Importer" />
            {/snippet}
        </SettingsRow>
        <SettingsRow icon="Download" title="✘ Export produits" description="Exporte la liste des produits." toneClass="bg-cyan-50 text-cyan-700">
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="Download" label="Exporter" />
            {/snippet}
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Jeux de données">
        <SettingsAccordionRow value="product-datasets" icon="Database" title="✘ Jeux de données" description="Gère les données utilisées dans les champs." toneClass="bg-blue-50 text-blue-700">
            {#snippet table()}
                <SettingsTable columns={[{ key: "name", label: "Liste" }, { key: "type", label: "Type" }, { key: "usage", label: "Utilisation" }]} rows={[{ name: "Familles produit", type: "Arborescence", usage: "Catalogue" }, { name: "Unités de vente", type: "Sélecteur", usage: "Stock et tarifs" }, { name: "Fournisseurs", type: "Sélecteur", usage: "Achat" }]} />
            {/snippet}
        </SettingsAccordionRow>
    </SettingsSection>

    <SettingsSection label="Historique">
        <SettingsToggleRow icon="ClipboardClock" title="✘ Activité" description="Conservez l’historique des modifications de chaque produit." name="product-change-history" toneClass="bg-stone-100 text-stone-700" bind:value={products.changeHistory} />
    </SettingsSection>
</SettingsPage>
