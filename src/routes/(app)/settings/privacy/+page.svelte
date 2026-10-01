<script lang="ts">
    import {
        SettingsMetadata,
        SettingsPage,
        SettingsRow,
        SettingsSection,
        SettingsToggleRow,
    } from "$lib/components/settings";
    import { Button } from "$lib/components/istyler";

    let privacy = $state({
        hideSensitivePreview: true,
        hideAmounts: false,
        privateNotesByDefault: true,
        clearCacheOnLogout: false,
    });
</script>

<SettingsPage
    title="Confidentialité"
    description="Réglez ce qui reste visible dans l’interface et ce qui reste stocké sur ce poste."
>
    <SettingsSection label="Affichage sensible">
        <SettingsToggleRow
            icon="EyeOff"
            title="✘ Masquer les aperçus sensibles"
            description="Cacher les e-mails, téléphones et montants dans les listes compactes."
            name="hide-sensitive-preview"
            toneClass="bg-blue-50 text-blue-700"
            bind:value={privacy.hideSensitivePreview}
        />
        <SettingsToggleRow
            icon="BadgeEuro"
            title="✘ Masquer les montants"
            description="Cacher les prix, totaux et marges dans les vues non détaillées."
            name="hide-amounts"
            toneClass="bg-amber-50 text-amber-700"
            bind:value={privacy.hideAmounts}
        />
    </SettingsSection>

    <SettingsSection label="Notes et historique">
        <SettingsToggleRow
            icon="NotebookPen"
            title="✘ Notes privées par défaut"
            description="Rendre les nouvelles notes privées automatiquement."
            name="private-notes-by-default"
            toneClass="bg-emerald-50 text-emerald-700"
            bind:value={privacy.privateNotesByDefault}
        />
        <SettingsRow
            icon="Info"
            title="✘ Règles des notes"
            description="Explique la conservation, la modification et la suppression des notes."
            toneClass="bg-stone-100 text-stone-700"
        >
            {#snippet metadata()}
                <SettingsMetadata
                    items={[
                        { label: "Suppression", value: "masquée, jamais effacée directement" },
                        { label: "Modification", value: "nouvelle version" },
                        { label: "Traçabilité", value: "auteur et date conservés" },
                    ]}
                />
            {/snippet}
        </SettingsRow>
        <SettingsRow
            icon="SearchX"
            title="✘ Effacer les recherches récentes"
            description="Supprime les recherches récentes de ce poste."
            toneClass="bg-orange-50 text-orange-700"
        >
            {#snippet action()}
                <Button variant="secondary" size="sm" icon="Trash2" label="Effacer" />
            {/snippet}
        </SettingsRow>
        <SettingsRow
            icon="History"
            title="✘ Effacer l’historique local"
            description="Supprime l’activité locale enregistrée sur ce poste."
            variant="destructive"
        >
            {#snippet action()}
                <Button variant="error" size="sm" icon="Trash2" label="Effacer" />
            {/snippet}
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Données locales">
        <SettingsRow
            icon="HardDrive"
            title="✘ Vider le cache local"
            description="Supprime les données locales stockées sur ce poste."
            variant="destructive"
        >
            {#snippet action()}
                <Button variant="error" size="sm" icon="Trash2" label="Vider" />
            {/snippet}
        </SettingsRow>
        <SettingsToggleRow
            icon="LogOut"
            title="✘ Vider le cache à la déconnexion"
            description="Supprime le cache local après déconnexion."
            name="clear-cache-on-logout"
            toneClass="bg-red-50 text-red-700"
            bind:value={privacy.clearCacheOnLogout}
        />
    </SettingsSection>
</SettingsPage>
