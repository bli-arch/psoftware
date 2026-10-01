<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { strftime } from "$lib/utils";
    import { Button, Checkbox, DateFormatInput, validateDateFormat } from "$lib/components/istyler";
    import { SettingsGroup, SettingsRow } from "$lib/components/settings";
    import SettingsDrilldownList, { type SettingsDrilldownItem } from "$lib/components/settings/SettingsDrilldownList.svelte";
    import type { TrackingLabelField } from "$lib/trackingLabel";
    import TrackingLabelPreview from "./TrackingLabelPreview.svelte";

    const ADD_FIELD_ID = "tracking-label:add-field";
    const DEFAULT_DATE_FORMAT = "%d/%m/%Y";
    const PREVIEW_DATE = new Date();

    let {
        fields = $bindable(),
        fieldsLoading,
        fieldsError,
        width,
        height,
        enabled,
        preparingPrint,
        onPrint,
    }: {
        fields: TrackingLabelField[];
        fieldsLoading: boolean;
        fieldsError: string;
        width: number;
        height: number;
        enabled: boolean;
        preparingPrint: boolean;
        onPrint: () => void;
    } = $props();

    let selectedFieldId = $state<string | number | null>(null);

    const selectedFields = $derived(fields.filter((field) => field.enabled));
    const availableFieldGroups = $derived(
        (["Par défaut", "Opération", "Client"] as const)
            .map((source) => ({
                label: source,
                fields: fields.filter((field) => field.source === source && !field.enabled),
            }))
            .filter((group) => group.fields.length > 0),
    );
    const drilldownItems = $derived([
        ...selectedFields.map((field) => ({
            id: field.id,
            title: field.label,
            description: `${field.source}${field.page ? ` · ${field.page}` : ""}`,
        } satisfies SettingsDrilldownItem)),
        ...(selectedFieldId === ADD_FIELD_ID
            ? [{ id: ADD_FIELD_ID, title: "Ajouter un champ" } satisfies SettingsDrilldownItem]
            : []),
    ]);

    function addField(id: string) {
        const field = fields.find((candidate) => candidate.id === id && !candidate.enabled);
        if (!field) return;

        fields = [
            ...fields.filter((candidate) => candidate.enabled),
            { ...field, enabled: true },
            ...fields.filter((candidate) => !candidate.enabled && candidate.id !== id),
        ];
    }

    function removeField(id: string) {
        fields = fields.map((field) => field.id === id ? { ...field, enabled: false } : field);
        if (selectedFieldId === id) selectedFieldId = null;
    }

    function reorderFields(_oldIndex: number, _newIndex: number, orderedIds: string[]) {
        const positions = new Map(orderedIds.map((id, index) => [id, index]));
        const orderedFields = [...selectedFields].sort(
            (left, right) => (positions.get(left.id) ?? 0) - (positions.get(right.id) ?? 0),
        );
        fields = [...orderedFields, ...fields.filter((field) => !field.enabled)];
    }

    function setFieldWide(id: string, wide: boolean) {
        fields = fields.map((field) => field.id === id ? { ...field, wide } : field);
    }

    function setFieldLabelVisibility(id: string, showLabel: boolean) {
        fields = fields.map((field) => field.id === id ? { ...field, showLabel } : field);
    }

    function setFieldDateFormat(id: string, dateFormat: string) {
        const invalid = validateDateFormat(dateFormat, { required: true, allowLiteralPercent: true });
        let sample = "Format invalide";
        if (!invalid) {
            try {
                sample = strftime(PREVIEW_DATE, dateFormat, "fr-FR");
            } catch {
                // DateFormatInput displays the validation error next to the control.
            }
        }
        fields = fields.map((field) => field.id === id ? { ...field, dateFormat, sample } : field);
    }
</script>

<div class="grid gap-6 xl:grid-cols-[minmax(18rem,0.85fr)_minmax(26rem,1.15fr)]">
    <div class="h-fit min-w-0 overflow-hidden rounded-lg border border-(--light-bg3) bg-(--light-bg1)">
        {#if fieldsError}
            <div class="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-700">
                {fieldsError}
            </div>
        {/if}

        {#if fieldsLoading}
            <div class="flex min-h-24 items-center justify-center gap-2 text-xs font-medium text-(--grey)">
                <Icon.LoaderCircle size={15} class="ui-loader-spin" />
                Chargement des champs…
            </div>
        {:else}
            <SettingsDrilldownList
                items={drilldownItems}
                bind:selectedId={selectedFieldId}
                onReorder={reorderFields}
                showItemIcon={false}
                emptyTitle="Aucun élément"
                emptyDescription="Ajoutez un champ pour composer l’étiquette."
                backLabel="Tous les éléments"
            >
                {#snippet itemLeft()}
                    <span
                        class="grabber flex size-6 shrink-0 cursor-grab items-center justify-center rounded-md text-(--grey) hover:bg-(--light-bg2) active:cursor-grabbing"
                        aria-label="Déplacer l’élément"
                        role="presentation"
                    >
                        <Icon.GripVertical size={15} />
                    </span>
                {/snippet}

                {#snippet itemRight(item)}
                    {#if item.id !== ADD_FIELD_ID}
                        <Button
                            variant="ghost"
                            size="sm"
                            icon="Trash2"
                            tooltip="Retirer l’élément"
                            aria-label={`Retirer ${item.title}`}
                            onclick={() => removeField(String(item.id))}
                            class="size-8 w-8 shrink-0 border border-(--light-bg3) px-0 text-(--red) hover:bg-(--transparent-red)"
                        />
                    {/if}
                {/snippet}

                {#snippet listFooter()}
                    <Button
                        variant="ghost"
                        size="md"
                        disabled={availableFieldGroups.length === 0}
                        onclick={() => (selectedFieldId = ADD_FIELD_ID)}
                        class="group/create-card h-auto w-full flex-center gap-3 rounded-none border-t border-(--light-bg3) px-4 py-3 text-left text-(--dark-bg1) hover:bg-(--user-color)/5 hover:text-(--user-color)"
                    >
                        <Icon.Plus size="16" />
                        <span class="min-w-0">
                            <span class="block truncate text-xs font-semibold">Ajouter un champ</span>
                        </span>
                    </Button>
                {/snippet}

                {#snippet detail(item)}
                    {#if item.id === ADD_FIELD_ID}
                        {#if availableFieldGroups.length > 0}
                            <div class="overflow-hidden">
                                {#each availableFieldGroups as group}
                                    <div class="border-b border-(--light-bg3) first:border-t last:border-b-0">
                                        <div class="bg-(--light-bg2) px-3 py-2 text-xs font-semibold text-(--dark-bg1)">
                                            {group.label}
                                        </div>
                                        {#each group.fields as field}
                                            <Button
                                                variant="ghost"
                                                size="md"
                                                onclick={() => addField(field.id)}
                                                class="h-auto w-full justify-start gap-3 rounded-none border-t border-(--light-bg3) px-3 py-2.5 text-left whitespace-normal hover:bg-(--light-bg2)"
                                            >
                                                <span class="min-w-0 flex-1">
                                                    <span class="block truncate text-xs font-semibold text-(--dark-bg1)">{field.label}</span>
                                                    {#if field.page}
                                                        <span class="block truncate text-xs font-medium text-(--grey)">{field.page}</span>
                                                    {/if}
                                                </span>
                                                <Icon.Plus size={15} class="shrink-0 text-(--grey)" />
                                            </Button>
                                        {/each}
                                    </div>
                                {/each}
                            </div>
                        {:else}
                            <div class="border-t border-(--light-bg3) px-4 py-5 text-center text-xs font-medium text-(--grey)">
                                Tous les champs disponibles ont été ajoutés.
                            </div>
                        {/if}
                    {:else}
                        {@const field = fields.find((candidate) => candidate.id === String(item.id))}
                        {#if field}
                            {#if field.id === "system:date"}
                                <div class="border-b border-(--light-bg3) p-4">
                                    <DateFormatInput
                                        name="tracking-label-date-format"
                                        label="Format d’affichage"
                                        value={field.dateFormat ?? DEFAULT_DATE_FORMAT}
                                        required
                                        allowLiteralPercent
                                        previewDate={PREVIEW_DATE}
                                        helpText="Détermine la présentation de la date sur l’étiquette."
                                        helpTextIcon
                                        oninput={(value) => setFieldDateFormat(field.id, value)}
                                    />
                                </div>
                            {/if}

                            <SettingsGroup>
                                {#if field.id !== "system:barcode"}
                                    <SettingsRow
                                        title="Afficher le libellé"
                                        description="Affichez le nom du champ au-dessus de sa valeur."
                                        inline
                                    >
                                        {#snippet right()}
                                            <Checkbox
                                                name={`tracking-label-label-${field.id}`}
                                                switchMode
                                                value={field.showLabel !== false}
                                                on:change={(event) => setFieldLabelVisibility(field.id, event.detail)}
                                            />
                                        {/snippet}
                                    </SettingsRow>
                                {/if}

                                <SettingsRow
                                    title="Toute la largeur"
                                    description="Affichez cet élément seul sur sa ligne."
                                    inline
                                >
                                    {#snippet right()}
                                        <Checkbox
                                            name={`tracking-label-wide-${field.id}`}
                                            switchMode
                                            value={Boolean(field.wide)}
                                            disabled={field.id === "system:barcode"}
                                            on:change={(event) => setFieldWide(field.id, event.detail)}
                                        />
                                    {/snippet}
                                </SettingsRow>
                            </SettingsGroup>
                        {/if}
                    {/if}
                {/snippet}
            </SettingsDrilldownList>
        {/if}
    </div>

    <TrackingLabelPreview fields={selectedFields} {width} {height} />
</div>

<div class="mt-6 flex justify-end">
    <Button
        variant="secondary"
        size="sm"
        icon={preparingPrint ? "LoaderCircle" : "Printer"}
        iconAnimation={preparingPrint ? "spin" : undefined}
        label={preparingPrint ? "Préparation…" : "Imprimer un test"}
        disabled={!enabled || preparingPrint || selectedFields.length === 0}
        onclick={onPrint}
        class="w-fit"
    />
</div>
