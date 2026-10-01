<script lang="ts">
    import { onMount } from "svelte";
    import { apiGet, apiPatch } from "$lib/api";
    import type { ManagedFormType } from "$lib/components/FormBuilder/formManagerTypes";
    import { Button } from "$lib/components/istyler";
    import SettingsAccordionRow from "$lib/components/settings/SettingsAccordionRow.svelte";
    import IdentifierTemplateCreator from "./IdentifierTemplateCreator.svelte";
    import { validateIdentifierTemplate } from "./identifierTemplate";

    export let formType: ManagedFormType;
    export let title = "Format des identifiants";
    export let description: string;
    export let defaultValue = "";
    export let value = "";
    export let rowValue = `${formType}-identifier`;
    export let open = false;
    export let attention = false;
    export let onSaved: () => void | Promise<void> = () => {};

    let formId: number | null = null;
    let formSettings: Record<string, unknown> = {};
    let savedValue = defaultValue;
    let loaded = false;
    let saving = false;
    let error: string | null = null;
    let formMissing = false;

    $: dirty = loaded && value !== savedValue;
    $: templateError = validateIdentifierTemplate(value);

    async function loadTemplate() {
        formMissing = false;
        error = null;
        const form = await apiGet(`/settings/form/active/${formType}`);
        formId = Number(form?.id) || null;
        formSettings = form?.settings && typeof form.settings === "object" ? form.settings : {};
        value = typeof formSettings.IDFormat === "string" ? formSettings.IDFormat : defaultValue;
        savedValue = value;
        loaded = true;
    }

    async function saveTemplate(event: MouseEvent) {
        event.stopPropagation();
        if (!formId || saving || !dirty) return;
        if (templateError) {
            error = templateError;
            return;
        }

        saving = true;
        error = null;
        const nextSettings = { ...formSettings, IDFormat: value };

        try {
            const saved = await apiPatch(`/settings/form/${formId}/`, { settings: nextSettings });
            formSettings = saved?.settings && typeof saved.settings === "object" ? saved.settings : nextSettings;
            savedValue = value;
            void onSaved();
        } catch (exception) {
            console.error("Failed to save identifier template", exception);
            error = "Impossible d'enregistrer le format.";
        } finally {
            saving = false;
        }
    }

    onMount(() => {
        value = defaultValue;
        savedValue = defaultValue;
        void loadTemplate().catch((exception: unknown) => {
            if ((exception as { status?: number })?.status === 404) {
                formMissing = true;
            } else {
                console.error("Failed to load identifier template", exception);
                error = "Impossible de charger le format.";
            }
            loaded = true;
        });
    });
</script>

<SettingsAccordionRow
    value={rowValue}
    icon="Hash"
    {title}
    {description}
    toneClass="bg-amber-50 text-amber-700"
    {attention}
    bind:open
>
    {#snippet action()}
        {#if dirty || formMissing}
            <Button
                size="sm"
                icon={saving ? "LoaderCircle" : "Save"}
                iconAnimation={saving ? "spin" : undefined}
                label="Enregistrer"
                tooltip={formMissing ? "Aucun formulaire actif. Activez un formulaire pour enregistrer ce format." : undefined}
                disabled={saving || !!templateError || !dirty || !formId}
                onclick={saveTemplate}
                class="disabled:bg-(--light-bg3) disabled:text-(--grey)"
            />
        {/if}
    {/snippet}

    <IdentifierTemplateCreator bind:value />

    {#if templateError && loaded}
        <div class="mt-3 rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
            {templateError}
        </div>
    {/if}

    {#if error}
        <div class="mt-3 rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
            {error}
        </div>
    {/if}
</SettingsAccordionRow>
