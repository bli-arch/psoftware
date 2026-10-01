<script lang="ts">
    import { Button } from "$lib/components/istyler";
    import { strftime } from "$lib/utils";
    import { Badge } from "../Badge";
    import { getFieldGridStyle, getFormFields } from "./layout";
    import type { ManagedForm } from "./formManagerTypes";
    import { getFormName, getFormPages } from "./formManagerTypes";

    let {
        form,
        onSelect,
        onActivate,
        onDelete
    }: {
        form: ManagedForm;
        onSelect: (form: ManagedForm) => void;
        onActivate: (form: ManagedForm, event: MouseEvent) => void;
        onDelete: (form: ManagedForm, event: MouseEvent) => void;
    } = $props();

    const formPages = $derived(getFormPages(form));
    const formName = $derived(getFormName(form));
    const firstPage = $derived(formPages[0]);
    const firstPageFields = $derived(getFormFields(firstPage));
    const pageCount = $derived(formPages.length);
    const fieldCount = $derived(formPages.reduce((total, page) => total + getFormFields(page).length, 0));
    const isActive = $derived(Boolean(form.is_active));

    function getPreviewLabel(field: any, index: number) {
        return field?.props?.label ?? field?.config?.label ?? field?.props?.name ?? field?.config?.name ?? `Champ ${index + 1}`;
    }

    function activateForm(event: MouseEvent) {
        onActivate(form, event);
    }

    function deleteForm(event: MouseEvent) {
        onDelete(form, event);
    }
</script>

<div
    data-active={isActive}
    class="group/card flex flex-col gap-4 rounded-2xl border border-(--light-bg3) bg-(--light-bg2) overflow-hidden
            transition-all duration-(--animation-duration-300) hover:-translate-y-1 hover:shadow-lg
            data-[active=true]:border-(--green)/10 data-[active=true]:bg-(--green)/10"
>
        <div
            class="relative h-32 overflow-hidden bg-(--light-bg1)"
            aria-label={`Aperçu de la première page du formulaire ${formName}`}
        >
            <div
                class="grid size-full gap-1 p-2 select-none"
                style="grid-template-columns: repeat(64, minmax(0, 1fr)); grid-auto-rows: 2px;
                    background-image: radial-gradient(var(--light-bg3) 1px, transparent 0);
                    background-position: calc(var(--spacing) * -7.5) calc(var(--spacing) * -7.5);
                    background-repeat: repeat;
                    background-size: 8px 8px;">
                {#each firstPageFields as field, index (field.id ?? field.config?.name ?? field.props?.name ?? index)}
                    <div class="min-h-0 min-w-0 p-px" style={getFieldGridStyle(field)}>
                        <div class="flex size-full min-h-2 items-center overflow-hidden rounded-sm border border-(--light-bg3) bg-(--light-bg1) px-1">
                            <span class="truncate text-[6px] font-medium leading-none text-(--dark-bg2)">
                                {getPreviewLabel(field, index)}
                            </span>
                        </div>
                    </div>
                {/each}
            </div>
            <div class="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-(--light-bg2)
                group-data-[active=true]/card:from-[color-mix(in_srgb,var(--green)_10%,white)] to-transparent"></div>
        </div>

    <div class="flex flex-col gap-2 px-4">
        <div class="flex items-center justify-between">
            <span class="block truncate text-xl font-bold leading-5 text-(--dark-bg1)">{formName}</span>
            {#if isActive}
                <Badge text="Actif" icon="Check" type="success" />
            {:else}
                <Badge text="Brouillon" type="neutral" />
            {/if}
        </div>
        <div class="flex flex-col text-sm font-normal text-(--grey)">
            {#if form.created_at}
                <span>Créé le {strftime(form.created_at, "%d %B %Y")}.</span>
            {/if}
            <span>Contient {pageCount} page{pageCount > 1 ? "s" : ""} et {fieldCount} champ{fieldCount > 1 ? "s" : ""}.</span>
        </div>
    </div>

    <div class="flex gap-2 px-4 pb-4">
        <Button
            variant="primary"
            size="sm"
            label="Modifier"
            icon="Pencil"
            class="w-fit px-4"
            onclick={() => onSelect(form)}
        />

        {#if !isActive}
            <Button
                variant="secondary"
                size="sm"
                label="Activer"
                icon="Check"
                class="ml-auto w-fit px-4"
                confirm
                confirmTitle="Définir ce formulaire comme actif ?"
                confirmDescription={`Le formulaire "${formName}" remplacera le formulaire actif actuel.`}
                confirmCancelLabel="Annuler"
                confirmConfirmLabel="Activer"
                onclick={activateForm}
            />

            <Button
                variant="secondary"
                size="sm"
                icon="Trash2"
                title="Supprimer"
                aria-label="Supprimer"
                confirm
                confirmTitle="Supprimer ce formulaire ?"
                confirmDescription={`Le formulaire "${formName}" sera supprimé définitivement.`}
                confirmCancelLabel="Annuler"
                confirmConfirmLabel="Supprimer"
                confirmCancelVariant="secondary"
                confirmConfirmVariant="error"
                onclick={deleteForm}
                class="size-8 px-0 hover:border-(--transparent-red) hover:bg-(--transparent-red) hover:text-(--red)"
            />
        {/if}
    </div>
</div>
