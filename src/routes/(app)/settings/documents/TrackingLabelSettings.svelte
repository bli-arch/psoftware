<script lang="ts">
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import { apiGet } from "$lib/api";
    import {
        bootstrapSettings,
        DEFAULT_TRACKING_LABEL_FIELDS,
        updateAppSettings,
        type AppSettingsValue,
        type TrackingLabelFieldSetting,
    } from "$lib/settings";
    import { requestPrint } from "$lib/printing";
    import {
        SettingsAccordionRow,
        SettingsExpandableRow,
        SettingsGroup,
        SettingsRow,
    } from "$lib/components/settings";
    import { Button, NumberInput, validateDateFormat } from "$lib/components/istyler";
    import {
        DEFAULT_IDENTIFIER_PREVIEW_OPTIONS,
        IdentifierTemplateCreator,
        parseIdentifierTemplate,
        previewIdentifierParts,
        validateIdentifierTemplate,
        type IdentifierTokenType,
    } from "$lib/components/identifiers";
    import { recordOrEmpty } from "$lib/formConfig";
    import { strftime } from "$lib/utils";
    import { animationTime } from "$lib/uiPreferences";
    import { extractTrackingLabelFormFields } from "$lib/trackingLabelFormFields";
    import TrackingLabelComposer from "./TrackingLabelComposer.svelte";
    import {
        createTrackingLabelPdf,
        serializeTrackingLabelFields,
        type TrackingLabelField,
    } from "$lib/trackingLabel";

    const DEFAULT_IDENTIFIER_FORMAT = "OP-%D<%Y%m%d>%-%4N%";
    const DEFAULT_DATE_FORMAT = "%d/%m/%Y";
    const STICKER_PREVIEW_DATE = new Date();
    const DEFAULT_IDENTIFIER_PREVIEW = previewIdentifierParts(
        parseIdentifierTemplate(DEFAULT_IDENTIFIER_FORMAT),
        DEFAULT_IDENTIFIER_PREVIEW_OPTIONS,
    );

    const numberingTokenTypes: Array<Exclude<IdentifierTokenType, "text">> = [
        "sequence", "today", "date", "randomChars", "randomLetters", "randomNumbers",
    ];

    type SaveGroup = "enabled" | "format" | "numbering" | "composition";

    let enabled = $state(false);
    let prefix = $state("ETQ-%D<%Y>%-%5N%");
    let width = $state<number | null>(50);
    let height = $state<number | null>(30);
    let compositionOpen = $state(true);
    let fieldsLoading = $state(true);
    let fieldsError = $state("");
    let preparingPrint = $state(false);
    let settingsReady = $state(false);
    let savingGroups = $state<SaveGroup[]>([]);
    let savedWidth = $state(50);
    let savedHeight = $state(30);
    let savedEnabled = $state(false);
    let savedPrefix = $state("ETQ-%D<%Y>%-%5N%");
    let savedFields = $state<TrackingLabelFieldSetting[]>(structuredClone(DEFAULT_TRACKING_LABEL_FIELDS));
    let saveQueue: Promise<void> = Promise.resolve();
    let fields = $state<TrackingLabelField[]>([
        { id: "system:barcode", label: "Code-barres", source: "Par défaut", sample: DEFAULT_IDENTIFIER_PREVIEW, enabled: true, wide: true, showLabel: false },
        { id: "system:identifier", label: "Identifiant de l’opération", source: "Par défaut", sample: DEFAULT_IDENTIFIER_PREVIEW, enabled: false, showLabel: true },
        { id: "system:status", label: "Statut de l’opération", source: "Par défaut", sample: "Diagnostic", enabled: false, showLabel: true },
        { id: "system:date", label: "Date", source: "Par défaut", sample: strftime(STICKER_PREVIEW_DATE, DEFAULT_DATE_FORMAT, "fr-FR"), enabled: false, showLabel: true, dateFormat: DEFAULT_DATE_FORMAT },
    ]);

    const labelWidth = $derived(Math.min(200, Math.max(15, width ?? 50)));
    const labelHeight = $derived(Math.min(200, Math.max(15, height ?? 30)));
    const selectedFields = $derived(fields.filter((field) => field.enabled));
    const serializedFields = $derived(serializeTrackingLabelFields(fields));
    const sizeLabel = $derived(`${labelWidth} × ${labelHeight} mm`);
    const formatChanged = $derived(labelWidth !== savedWidth || labelHeight !== savedHeight);
    const numberingChanged = $derived(prefix !== savedPrefix);
    const numberingError = $derived(validateIdentifierTemplate(prefix));
    const compositionChanged = $derived(JSON.stringify(serializedFields) !== JSON.stringify(savedFields));
    const compositionInvalid = $derived(selectedFields.some((field) => (
        field.id === "system:date"
        && Boolean(validateDateFormat(field.dateFormat ?? DEFAULT_DATE_FORMAT, { required: true, allowLiteralPercent: true }))
    )));
    async function loadFormFields(configuredFields: TrackingLabelFieldSetting[]) {
        fieldsLoading = true;
        fieldsError = "";
        const [operationResult, clientResult] = await Promise.allSettled([
            apiGet("/settings/form/active/operation"),
            apiGet("/settings/form/active/client"),
        ]);
        const operationFields = operationResult.status === "fulfilled"
            ? extractTrackingLabelFormFields(operationResult.value, "Opération")
            : [];
        const clientFields = clientResult.status === "fulfilled"
            ? extractTrackingLabelFormFields(clientResult.value, "Client")
            : [];
        const operationSettings = operationResult.status === "fulfilled"
            ? recordOrEmpty(recordOrEmpty(operationResult.value).settings)
            : {};
        const identifierFormat = typeof operationSettings.IDFormat === "string" && operationSettings.IDFormat
            ? operationSettings.IDFormat
            : DEFAULT_IDENTIFIER_FORMAT;
        const identifierPreview = previewIdentifierParts(
            parseIdentifierTemplate(identifierFormat),
            DEFAULT_IDENTIFIER_PREVIEW_OPTIONS,
        );
        const candidates = [
            ...fields
                .filter((field) => field.source === "Par défaut")
                .map((field) => field.id === "system:barcode" || field.id === "system:identifier"
                    ? { ...field, sample: identifierPreview }
                    : field),
            ...operationFields,
            ...clientFields,
        ];
        const candidatesById = new Map(candidates.map((field) => [field.id, field]));
        const selected = configuredFields.flatMap((setting) => {
            const candidate = candidatesById.get(setting.id);
            if (!candidate) return [];
            return [{
                ...candidate,
                ...setting,
                sample: candidate.sample,
                enabled: true,
                wide: setting.id === "system:barcode" ? true : Boolean(setting.wide),
                showLabel: setting.id === "system:barcode" ? false : setting.showLabel !== false,
            } satisfies TrackingLabelField];
        });
        const selectedIds = new Set(selected.map((field) => field.id));
        fields = [
            ...selected,
            ...candidates.filter((field) => !selectedIds.has(field.id)).map((field) => ({ ...field, enabled: false })),
        ];

        const unavailable = [
            ...(operationResult.status === "rejected" ? ["Opération"] : []),
            ...(clientResult.status === "rejected" ? ["Client"] : []),
        ];
        if (unavailable.length) {
            fieldsError = `Formulaire${unavailable.length > 1 ? "s" : ""} ${unavailable.join(" et ").toLocaleLowerCase("fr-FR")} indisponible${unavailable.length > 1 ? "s" : ""}.`;
        } else if (selected.length !== configuredFields.length) {
            fieldsError = "Certains champs configurés ne sont plus disponibles dans les formulaires actifs.";
        }
        fieldsLoading = false;
    }

    const isSaving = (group: SaveGroup) => savingGroups.includes(group);

    function applyTrackingLabelSettings(documents: AppSettingsValue["documents"]) {
        enabled = documents.trackingLabelEnabled;
        prefix = documents.trackingLabelPrefix;
        width = documents.trackingLabelWidthMm;
        height = documents.trackingLabelHeightMm;
        savedEnabled = enabled;
        savedPrefix = prefix;
        savedWidth = documents.trackingLabelWidthMm;
        savedHeight = documents.trackingLabelHeightMm;
        savedFields = structuredClone(documents.trackingLabelFields);
        settingsReady = true;
    }

    function saveSettings(
        group: SaveGroup,
        patch: Partial<AppSettingsValue["documents"]>,
        successMessage?: string,
    ) {
        if (!settingsReady || isSaving(group)) return Promise.resolve();

        savingGroups = [...savingGroups, group];
        const save = saveQueue.then(async () => {
            try {
                const snapshot = await updateAppSettings({ documents: patch });
                const documents = snapshot.value.documents;
                if (group === "enabled") {
                    enabled = documents.trackingLabelEnabled;
                    savedEnabled = enabled;
                } else if (group === "format") {
                    width = documents.trackingLabelWidthMm;
                    height = documents.trackingLabelHeightMm;
                    savedWidth = documents.trackingLabelWidthMm;
                    savedHeight = documents.trackingLabelHeightMm;
                } else if (group === "numbering") {
                    prefix = documents.trackingLabelPrefix;
                    savedPrefix = prefix;
                } else {
                    savedFields = structuredClone(documents.trackingLabelFields);
                }
                if (successMessage) toast.success(successMessage);
            } catch (error) {
                console.error("Failed to save tracking label settings", error);
                if (group === "enabled") {
                    enabled = savedEnabled;
                } else if (group === "format") {
                    width = savedWidth;
                    height = savedHeight;
                }
                toast.error("Impossible d’enregistrer ce paramètre.");
            } finally {
                savingGroups = savingGroups.filter((item) => item !== group);
            }
        });
        saveQueue = save;
        return save;
    }

    function saveEnabled(value: boolean) {
        enabled = value;
        void saveSettings("enabled", { trackingLabelEnabled: value });
    }

    function stopAndSaveFormat(event: MouseEvent) {
        event.stopPropagation();
        width = labelWidth;
        height = labelHeight;
        void saveSettings("format", {
            trackingLabelWidthMm: labelWidth,
            trackingLabelHeightMm: labelHeight,
        }, "Format de l’étiquette enregistré.");
    }

    function stopAndSaveComposition(event: MouseEvent) {
        event.stopPropagation();
        void saveSettings("composition", {
            trackingLabelFields: serializedFields,
        }, "Personnalisation de l’étiquette enregistrée.");
    }

    function stopAndSaveNumbering(event: MouseEvent) {
        event.stopPropagation();
        void saveSettings("numbering", { trackingLabelPrefix: prefix }, "Numérotation enregistrée.");
    }

    async function printTestTrackingLabel() {
        if (preparingPrint || selectedFields.length === 0) return;
        preparingPrint = true;
        try {
            const data = await createTrackingLabelPdf(selectedFields, labelWidth, labelHeight);
            if (!requestPrint({
                type: "tracking-label",
                mode: "manual",
                kind: "pdf",
                title: "Étiquette de suivi",
                description: sizeLabel,
                data,
                orientation: labelWidth >= labelHeight ? "landscape" : "portrait",
                paperSize: "document",
            })) {
                toast.error("Impossible de préparer cette impression.");
            }
        } catch (error) {
            console.error("Failed to prepare tracking label print", error);
            toast.error("Impossible de préparer l’étiquette pour l’impression.");
        } finally {
            preparingPrint = false;
        }
    }

    onMount(() => {
        void bootstrapSettings()
            .then((snapshot) => {
                applyTrackingLabelSettings(snapshot.value.documents);
                return loadFormFields(snapshot.value.documents.trackingLabelFields);
            })
            .catch((error) => {
                console.error("Failed to load tracking label settings", error);
                settingsReady = true;
                toast.error("Impossible de charger les paramètres de l’étiquette.");
                return loadFormFields(savedFields);
            });
    });
</script>

<SettingsExpandableRow
    icon="Tag"
    title="Étiquette de suivi"
    description="Imprimez les informations utiles au suivi de chaque objet."
    name="tracking-label-enabled"
    toneClass="bg-violet-50 text-violet-700"
    bind:value={enabled}
    disabled={!settingsReady || isSaving("enabled")}
    onChange={saveEnabled}
    bodyPadding={false}
>
    {#snippet action()}
        {#if formatChanged}
            <Button
                size="sm"
                icon={isSaving("format") ? "LoaderCircle" : "Save"}
                iconAnimation={isSaving("format") ? "spin" : undefined}
                label="Enregistrer"
                class="w-fit"
                disabled={!settingsReady || isSaving("format")}
                onclick={stopAndSaveFormat}
            />
        {/if}
    {/snippet}

    <SettingsGroup>
        <SettingsRow
            title="Format de l’étiquette"
            description="Définissez les dimensions physiques de vos étiquettes en millimètres."
            badge={sizeLabel}
            inline
        >
            {#snippet right()}
                <div class="flex w-56 items-center gap-2">
                    <label class="min-w-0 flex-1">
                        <span class="sr-only">Largeur</span>
                        <NumberInput
                            name="tracking-label-width"
                            suffix="mm"
                            min={15}
                            max={200}
                            bind:value={width}
                            display="lateral"
                            showControls={false}
                            disabled={!settingsReady || isSaving("format")}
                        />
                    </label>
                    <span class="shrink-0 text-lg font-semibold text-(--dark-bg1)">×</span>
                    <label class="min-w-0 flex-1">
                        <span class="sr-only">Hauteur</span>
                        <NumberInput
                            name="tracking-label-height"
                            suffix="mm"
                            min={15}
                            max={200}
                            bind:value={height}
                            display="lateral"
                            showControls={false}
                            disabled={!settingsReady || isSaving("format")}
                        />
                    </label>
                </div>
            {/snippet}
        </SettingsRow>

    </SettingsGroup>
</SettingsExpandableRow>

{#if settingsReady && enabled}
    <div class="flex flex-col gap-2" transition:slide={{ duration: animationTime() }}>
        <SettingsAccordionRow
            value="tracking-label-numbering"
            icon="Hash"
            title="Format des identifiants"
            description="Définissez le format des identifiants des étiquettes."
            toneClass="bg-amber-50 text-amber-700"
        >
            {#snippet action()}
                {#if numberingChanged}
                    <Button
                        size="sm"
                        icon={isSaving("numbering") ? "LoaderCircle" : "Save"}
                        iconAnimation={isSaving("numbering") ? "spin" : undefined}
                        label="Enregistrer"
                        class="w-fit"
                        disabled={isSaving("numbering") || !!numberingError}
                        onclick={stopAndSaveNumbering}
                    />
                {/if}
            {/snippet}

            <IdentifierTemplateCreator bind:value={prefix} allowedTokenTypes={numberingTokenTypes} />
            {#if numberingError}
                <div class="mt-3 rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
                    {numberingError}
                </div>
            {/if}
        </SettingsAccordionRow>

        <SettingsAccordionRow
            value="tracking-label-composition"
            icon="LayoutTemplate"
            title="Personnalisation de l’étiquette"
            description="Choisissez les données affichées, leur ordre et prévisualisez le résultat."
            toneClass="bg-violet-50 text-violet-700"
            badge={`${selectedFields.length} élément${selectedFields.length > 1 ? "s" : ""}`}
            bind:open={compositionOpen}
            keepMounted
        >
            {#snippet action()}
                {#if compositionChanged}
                    <Button
                        size="sm"
                        icon={isSaving("composition") ? "LoaderCircle" : "Save"}
                        iconAnimation={isSaving("composition") ? "spin" : undefined}
                        label="Enregistrer"
                        class="w-fit"
                        disabled={!settingsReady || isSaving("composition") || compositionInvalid}
                        onclick={stopAndSaveComposition}
                    />
                {/if}
            {/snippet}

            <TrackingLabelComposer
                bind:fields
                fieldsLoading={fieldsLoading}
                fieldsError={fieldsError}
                width={labelWidth}
                height={labelHeight}
                {enabled}
                {preparingPrint}
                onPrint={printTestTrackingLabel}
            />
        </SettingsAccordionRow>
    </div>
{/if}
