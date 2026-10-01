<script lang="ts">
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import IdentifierTemplateCreator from "$lib/components/identifiers/IdentifierTemplateCreator.svelte";
    import {
        parseIdentifierTemplate,
        validateIdentifierTemplate,
        type IdentifierTokenType,
    } from "$lib/components/identifiers/identifierTemplate";
    import {
        SettingsAccordionRow,
        SettingsExpandableRow,
        SettingsGroup,
        SettingsPage,
        SettingsSection,
        SettingsToggleRow,
    } from "$lib/components/settings";
    import { Button, Radio, Textarea } from "$lib/components/istyler";
    import { appSettings, bootstrapSettings, updateAppSettings, type AppSettingsValue } from "$lib/settings";
    import { operationSingularLower } from "$lib/operationDisplay";
    import { animationTime } from "$lib/uiPreferences";
    import TrackingLabelSettings from "./TrackingLabelSettings.svelte";

    type DocumentSettings = AppSettingsValue["documents"];
    type DocumentSaveGroup =
        | "receiptsEnabled"
        | "autoReceiptOnOperationCreate"
        | "format"
        | "logo"
        | "numbering"
        | "receiptShowClient"
        | "receiptShowOperation"
        | "terms"
        | "footer";

    const formatOptions = [
        {
            label: "A4",
            value: "a4",
            icon: "FileText",
            helpText: "Document pleine page pour impression classique ou envoi numérique.",
            hideCheckbox: true
        },
        {
            label: "80 mm",
            value: "80mm",
            icon: "ReceiptText",
            helpText: "Format compact pour imprimante thermique.",
            hideCheckbox: true
        },
    ];
    const numberingTokenTypes: Array<Exclude<IdentifierTokenType, "text">> = [
        "sequence",
        "today",
        "date",
        "randomChars",
        "randomLetters",
        "randomNumbers",
    ];

    let documents = $state<DocumentSettings>(structuredClone($appSettings.value.documents));
    let savedDocuments = $state<DocumentSettings>(structuredClone($appSettings.value.documents));
    let settingsReady = $state(false);
    let savingGroups = $state<DocumentSaveGroup[]>([]);
    let saveQueue: Promise<void> = Promise.resolve();

    const formatChanged = $derived(documents.receiptFormat !== savedDocuments.receiptFormat);
    const numberingChanged = $derived(documents.receiptPrefix !== savedDocuments.receiptPrefix);
    const termsChanged = $derived(
        documents.receiptTerms !== savedDocuments.receiptTerms
        || documents.receiptShowTerms !== savedDocuments.receiptShowTerms,
    );
    const footerChanged = $derived(documents.receiptFooterNote !== savedDocuments.receiptFooterNote);
    const numberingError = $derived(validateReceiptTemplate(documents.receiptPrefix));

    function modernizeReceiptTemplate(template: string) {
        const withDate = template.includes("%D<")
            ? template
            : template.replaceAll("%Y", "%D<%Y>%");
        return withDate.replace(/%(\d*)N(?!tod%|%)/g, "%$1N%");
    }

    function validateReceiptTemplate(template: string) {
        const error = validateIdentifierTemplate(template);
        if (error) return error;

        const tokens = parseIdentifierTemplate(template);
        if (tokens.some((token) => (token.type === "sequence" || token.type === "today") && (token.length ?? 1) > 12)) {
            return "Les compteurs ne peuvent pas dépasser 12 chiffres.";
        }
        return null;
    }

    function applyDocuments(next: DocumentSettings) {
        const saved = structuredClone(next);
        documents = { ...saved, receiptPrefix: modernizeReceiptTemplate(saved.receiptPrefix) };
        savedDocuments = saved;
        settingsReady = true;
    }

    const isSaving = (group: DocumentSaveGroup) => savingGroups.includes(group);

    function saveDocumentPatch(group: DocumentSaveGroup, patch: Partial<DocumentSettings>, successMessage?: string) {
        const keys = Object.keys(patch) as Array<keyof DocumentSettings>;
        if (!settingsReady || isSaving(group)) {
            documents = {
                ...documents,
                ...Object.fromEntries(keys.map((key) => [key, savedDocuments[key]])),
            };
            return Promise.resolve();
        }

        savingGroups = [...savingGroups, group];
        const save = saveQueue.then(async () => {
            try {
                const snapshot = await updateAppSettings({ documents: patch });
                const savedPatch = Object.fromEntries(keys.map((key) => [key, snapshot.value.documents[key]]));
                documents = { ...documents, ...savedPatch };
                savedDocuments = { ...savedDocuments, ...savedPatch };
                if (successMessage) toast.success(successMessage);
            } catch (error) {
                console.error("Failed to save document settings", error);
                documents = {
                    ...documents,
                    ...Object.fromEntries(keys.map((key) => [key, savedDocuments[key]])),
                };
                toast.error("Impossible d’enregistrer ce paramètre.");
            } finally {
                savingGroups = savingGroups.filter((item) => item !== group);
            }
        });
        saveQueue = save;
        return save;
    }

    function stopAndSave(event: MouseEvent, group: DocumentSaveGroup, patch: Partial<DocumentSettings>, message: string) {
        event.stopPropagation();
        void saveDocumentPatch(group, patch, message);
    }

    function saveReceiptsEnabled(value: boolean) {
        if (!value) documents.autoReceiptOnOperationCreate = false;
        void saveDocumentPatch("receiptsEnabled", value
            ? { receiptsEnabled: true }
            : { receiptsEnabled: false, autoReceiptOnOperationCreate: false });
    }

    onMount(() => {
        void bootstrapSettings()
            .then((snapshot) => applyDocuments(snapshot.value.documents))
            .catch((error) => {
                console.error("Failed to load document settings", error);
                settingsReady = true;
                toast.error("Impossible de charger les paramètres des documents.");
            });
    });
</script>

<SettingsPage
    title="Documents"
    description="Configurez vos reçus et vos étiquettes de suivi."
>
    <SettingsSection label="Reçu">
        <SettingsGroup>
            <SettingsToggleRow
                icon="ReceiptText"
                title="Reçus de prise en charge"
                description={`Autoriser l’émission d’un reçu depuis chaque ${operationSingularLower($appSettings.value.operation)}.`}
                name="receipts-enabled"
                toneClass="bg-emerald-50 text-emerald-700"
                bind:value={documents.receiptsEnabled}
                disabled={!settingsReady || isSaving("receiptsEnabled")}
                onChange={saveReceiptsEnabled}
            />
        </SettingsGroup>

        {#if settingsReady && documents.receiptsEnabled}
            <div class="flex flex-col gap-2" transition:slide={{ duration: animationTime() }}>
                <SettingsGroup>
                    <SettingsToggleRow
                        icon="FilePlus2"
                        title="Création automatique"
                        description={`Émettre automatiquement le reçu à l’enregistrement de chaque ${operationSingularLower($appSettings.value.operation)}.`}
                        name="auto-receipt"
                        toneClass="bg-cyan-50 text-cyan-700"
                        bind:value={documents.autoReceiptOnOperationCreate}
                        disabled={!settingsReady || isSaving("receiptsEnabled") || isSaving("autoReceiptOnOperationCreate")}
                        onChange={(value) => void saveDocumentPatch("autoReceiptOnOperationCreate", { autoReceiptOnOperationCreate: value })}
                    />
                </SettingsGroup>

                <SettingsAccordionRow
                    value="receipt-format"
                    icon="Printer"
                    title="Format d’impression"
                    description="Choisissez la mise en page utilisée sur les reçus."
                    toneClass="bg-blue-50 text-blue-700"
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
                                onclick={(event: MouseEvent) => stopAndSave(event, "format", {
                                    receiptFormat: documents.receiptFormat,
                                }, "Présentation du reçu enregistrée.")}
                            />
                        {/if}
                    {/snippet}

                    <Radio
                        name="receipt-format"
                        options={formatOptions}
                        box
                        direction="horizontal"
                        bind:value={documents.receiptFormat}
                        disabled={!settingsReady || isSaving("format")}
                    />
                </SettingsAccordionRow>

                <SettingsGroup>
                    <SettingsToggleRow
                        icon="Image"
                        title="Logo de l'entreprise"
                        description="Afficher le logo enregistré dans l'en-tête des documents."
                        name="document-logo"
                        toneClass="bg-violet-50 text-violet-700"
                        bind:value={documents.documentLogo}
                        disabled={!settingsReady || isSaving("logo")}
                        onChange={(value) => void saveDocumentPatch("logo", { documentLogo: value })}
                    />
                </SettingsGroup>
                <SettingsAccordionRow
                    value="receipt-numbering"
                    icon="Hash"
                    title="Format des identifiants"
                    description="Définissez le format des identifiants des reçus."
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
                                disabled={!settingsReady || isSaving("numbering") || !!numberingError}
                                onclick={(event: MouseEvent) => stopAndSave(event, "numbering", { receiptPrefix: documents.receiptPrefix }, "Numérotation enregistrée.")}
                            />
                        {/if}
                    {/snippet}

                    <IdentifierTemplateCreator
                        bind:value={documents.receiptPrefix}
                        allowedTokenTypes={numberingTokenTypes}
                    />
                    {#if numberingError}
                        <div class="mt-3 rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
                            {numberingError}
                        </div>
                    {/if}
                </SettingsAccordionRow>
                <SettingsGroup>
                    <SettingsToggleRow
                        icon="UserRound"
                        title="Informations client"
                        description="Affichez les informations client sélectionnées dans le formulaire."
                        name="receipt-client"
                        toneClass="bg-emerald-50 text-emerald-700"
                        bind:value={documents.receiptShowClient}
                        disabled={!settingsReady || isSaving("receiptShowClient")}
                        onChange={(value) => void saveDocumentPatch("receiptShowClient", { receiptShowClient: value })}
                    />
                    <SettingsToggleRow
                        icon="Bolt"
                        title="Informations de l’opération"
                        description="Affichez les informations de l’opération sélectionnées dans le formulaire."
                        name="receipt-operation"
                        toneClass="bg-blue-50 text-blue-700"
                        bind:value={documents.receiptShowOperation}
                        disabled={!settingsReady || isSaving("receiptShowOperation")}
                        onChange={(value) => void saveDocumentPatch("receiptShowOperation", { receiptShowOperation: value })}
                    />
                </SettingsGroup>

                <SettingsExpandableRow
                    icon="ScrollText"
                    title="Conditions de prise en charge"
                    description="Texte précisant les conditions applicables au dépôt, au diagnostic et à la prise en charge."
                    badge="Sur le reçu"
                    name="receipt-terms"
                    toneClass="bg-stone-100 text-stone-700"
                    bind:value={documents.receiptShowTerms}
                    disabled={!settingsReady || isSaving("terms")}
                >
                    {#snippet action()}
                        {#if termsChanged}
                            <Button
                                size="sm"
                                icon={isSaving("terms") ? "LoaderCircle" : "Save"}
                                iconAnimation={isSaving("terms") ? "spin" : undefined}
                                label="Enregistrer"
                                class="w-fit shrink-0"
                                disabled={!settingsReady || isSaving("terms")}
                                onclick={(event: MouseEvent) => {
                                    const receiptTerms = documents.receiptTerms.trim();
                                    stopAndSave(event, "terms", {
                                        receiptShowTerms: Boolean(receiptTerms) && documents.receiptShowTerms,
                                        receiptTerms,
                                    }, "Conditions de prise en charge enregistrées.");
                                }}
                            />
                        {/if}
                    {/snippet}

                    <Textarea
                        name="receipt-terms-text"
                        label="Texte des conditions"
                        maxlength={600}
                        rows={5}
                        resize="none"
                        bind:value={documents.receiptTerms}
                        disabled={!settingsReady || isSaving("terms")}
                    />
                </SettingsExpandableRow>

                <SettingsAccordionRow
                    value="receipt-footer"
                    icon="PanelBottom"
                    title="Note de bas de page"
                    description="Texte court affiché au bas du reçu, après son contenu principal."
                    badge="Sur le reçu"
                    toneClass="bg-violet-50 text-violet-700"
                >
                    {#snippet action()}
                        {#if footerChanged}
                            <Button
                                size="sm"
                                icon={isSaving("footer") ? "LoaderCircle" : "Save"}
                                iconAnimation={isSaving("footer") ? "spin" : undefined}
                                label="Enregistrer"
                                class="w-fit"
                                disabled={!settingsReady || isSaving("footer")}
                                onclick={(event: MouseEvent) => stopAndSave(event, "footer", { receiptFooterNote: documents.receiptFooterNote }, "Note de bas de page enregistrée.")}
                            />
                        {/if}
                    {/snippet}

                    <Textarea
                        name="receipt-footer-note"
                        label="Texte de la note"
                        maxlength={600}
                        rows={3}
                        resize="none"
                        bind:value={documents.receiptFooterNote}
                        disabled={!settingsReady || isSaving("footer")}
                    />
                </SettingsAccordionRow>
            </div>
        {/if}
    </SettingsSection>

    <SettingsSection label="Étiquette de suivi">
        <TrackingLabelSettings />
    </SettingsSection>
</SettingsPage>
