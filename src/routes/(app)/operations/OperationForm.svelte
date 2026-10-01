<script lang="ts">
    import { apiGet, apiPost, apiPut } from "$lib/api";
    import { goto } from "$app/navigation";
    import { currentUser } from "$lib/auth";
    import { normalizeBuilderPages } from "$lib/components/FormBuilder";
    import { normalizeFormConfig, positiveInteger, recordList } from "$lib/formConfig";
    import { Button } from "$lib/components/istyler";
    import { onMount, tick, type Snippet } from "svelte";
    import { fly, slide } from "svelte/transition";
    import { Drawer, type DrawerDirection } from "vaul-svelte";
    import { toast } from "svelte-sonner";
    import { animationTime } from "$lib/uiPreferences";
    import { appSettings } from "$lib/settings";
    import { operationSingular, operationSingularLower } from "$lib/operationDisplay";
    import { createReceipt, createTrackingLabel, downloadDocumentPDF, listDocuments, type OperationDocument } from "$lib/documents";
    import {
        companyProfile,
        isPrivacyNoticeReady,
        isPrivacyNoticeRequiredError,
        loadCompanyProfile,
    } from "$lib/companyProfile";
    import { requestPrint, type PrintJob } from "$lib/printing";
    import { loadTrackingLabelAutomaticPrint } from "$lib/trackingLabel";
    import * as Icon from "lucide-svelte";
    import StepProgress from "$lib/components/StepProgress.svelte";
    import OperationFormClientPicker from "./OperationFormClientPicker.svelte";
    import OperationFormClientSaved from "./OperationFormClientSaved.svelte";
    import OperationFormGrid from "./OperationFormGrid.svelte";
    import OperationFormSaved from "./OperationFormSaved.svelte";
    import OperationFormSummary from "./OperationFormSummary.svelte";
    import {
        asList,
        buildClientIdentityFields,
        buildFieldLabelMap,
        cloneSnapshot,
        countFilledRows,
        deepEqual,
        findInvalidFormStep,
        getFieldConfig,
        getEditableData,
        getClientName,
        getSectionFields,
        getSectionPreview,
        getSummaryIcon,
        hasSummaryValue,
        humanizeLabel,
        seedFormData,
        type ClientIdentityFields,
        type FieldLabelMap,
        type SummaryCard,
        type SummaryRow,
        type SummarySection
    } from "./operationUtils";

    let {
        children,
        formResponse = $bindable({ formID: 0, client: null, data: {} }),
        presetClient = null,
        direction,
        onCreated,
        initialFormConfig,
        initialStates,
    }: {
        children: Snippet<[Record<string, any>]>;
        formResponse?: Record<string, any>;
        presetClient?: Record<string, any> | null;
        direction?: DrawerDirection;
        onCreated?: (operation: Record<string, any>) => void;
        initialFormConfig?: Record<string, any> | null;
        initialStates?: Record<string, any>[];
    } = $props();

    formResponse.data ??= {};
    if (formResponse.client === undefined) {
        formResponse.client = null;
    }

    const sectionTones: SummaryCard["tone"][] = ["blue", "amber", "green", "purple"];

    let formConfig = $state<Record<string, any>>();
    let formMessage = $state("Chargement du formulaire...");
    let clientFormConfig = $state<Record<string, any>>();
    let clientIdentityFields = $state<ClientIdentityFields>({});
    let clientSearchTerm = $state("");
    let clientMatches = $state<any[]>([]);
    let recentClients = $state<any[]>([]);
    let operationStates = $state<Record<string, any>[]>([]);
    // clientSubStep: -1 = select list, 0..n = client form page index
    let clientSubStep = $state(-1);
    let clientPanelInFly = $state<Record<string, any>>({ y: 12, opacity: 0 });
    let clientPanelOutFly = $state<Record<string, any>>({ y: 12, opacity: 0 });
    let clientPageDirection = $state(0);
    let clientFormData = $state<Record<string, any>>({});
    let clientFormSubmitting = $state(false);
    let clientSaved = $state(false);
    let savedClient = $state<Record<string, any> | null>(null);
    let operationSaving = $state(false);
    let operationSaved = $state(false);
    let savedOperation = $state<Record<string, any> | null>(null);
    let savedReceipt = $state<OperationDocument | null>(null);
    let receiptPdfData = $state<ArrayBuffer | null>(null);
    let receiptLoading = $state(false);
    let creatingReceipt = $state(false);
    let receiptError = $state("");
    let receiptRequest = 0;
    let savedTrackingLabel = $state<OperationDocument | null>(null);
    let trackingLabelPdfData = $state<ArrayBuffer | null>(null);
    let trackingLabelLoading = $state(false);
    let trackingLabelError = $state("");
    let stepIndex = $state(0);
    let stepDirection = $state(1);
    let drawerOpen = $state(false);
    let companyProfileReady = $state(false);

    let drawerContent: HTMLDivElement | null = $state(null);
    let initialSnapshot = $state<Record<string, any> | null>(null);
    let selectedClientPreview = $state<Record<string, any> | null>(null);
    let clientSelectionError = $state("");
    let openSections = $state<Record<string, boolean>>({ client: true });

    const queuePrint = (job: PrintJob) => {
        if (!requestPrint(job)) toast.error("Impossible de préparer cette impression.");
    };

    let fieldLabels = $state<FieldLabelMap>({
        client: {},
        data: {}
    });
    const formPages = $derived(formConfig?.form?.pages ?? []);
    const maxStep = $derived(formPages.length + 1);
    const activePage = $derived(stepIndex > 0 && stepIndex <= formPages.length ? formPages[stepIndex - 1] : null);
    const isClientStep = $derived(stepIndex === 0);
    const isSummaryStep = $derived(stepIndex === maxStep);
    const displayedClients = $derived(clientSearchTerm.trim() ? clientMatches : recentClients);
    const clientFormPages = $derived(clientFormConfig?.form?.pages ?? []);
    const clientFieldConfigs = $derived.by(() =>
        Object.fromEntries(
            clientFormPages.flatMap((page: any) =>
                getSectionFields(page).flatMap((field: any) => {
                    const config = getFieldConfig(field);
                    return config.name ? [[config.name, config]] : [];
                })
            )
        )
    );
    const clientFormMaxStep = $derived(clientFormPages.length - 1);
    const activeClientPage = $derived(clientSubStep >= 0 && clientSubStep < clientFormPages.length ? clientFormPages[clientSubStep] : null);
    const isInClientForm = $derived(clientSubStep >= 0);
    const savedOperationRef = $derived(savedOperation?.uid ?? savedOperation?.id ?? savedOperation?.pk ?? null);
    const selectedClientId = $derived.by(() => {
        const client = formResponse.client;
        const candidate = client && typeof client === "object" && !Array.isArray(client)
            ? client.id ?? client.pk
            : client;

        return positiveInteger(candidate);
    });
    const hasSelectedClient = $derived(selectedClientId !== null);
    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));
    const privacyNoticeReady = $derived(isPrivacyNoticeReady($companyProfile));
    const canCreateReceipt = $derived(
        $appSettings.value.documents.receiptsEnabled
        && can("documents.create")
        && can("documents.view"),
    );
    const canCreateTrackingLabel = $derived(
        $appSettings.value.documents.trackingLabelEnabled
        && can("documents.create")
        && can("documents.view"),
    );
    const displayedDocument = $derived(savedTrackingLabel ?? savedReceipt);
    const displayedPdfData = $derived(trackingLabelPdfData ?? receiptPdfData);
    const documentLoading = $derived(receiptLoading || creatingReceipt || trackingLabelLoading);

    const workflowSteps = $derived.by(() =>
        [
            { id: "client", label: "Client" },
            ...(formPages ?? []).map((page: any, pageIndex: number) => ({
                id: `page-${pageIndex}`,
                label: page?.title ?? `Étape ${pageIndex + 2}`
            })),
            { id: "summary", label: "Résumé" }
        ]
    );

    const clientSummaryRows = $derived.by((): SummaryRow[] => {
        const clientRef = (() => {
            if (
                selectedClientPreview &&
                (selectedClientPreview.id === formResponse.client || selectedClientPreview.uid === formResponse.client)
            ) {
                return selectedClientPreview;
            }
            return formResponse.client;
        })();

        if (!hasSummaryValue(clientRef)) return [];
        if (typeof clientRef === "number" || typeof clientRef === "string") {
            return [{ id: "client-ref", label: "Client", value: `#${clientRef}` }];
        }
        if (typeof clientRef !== "object") {
            return [{ id: "client-value", label: "Client", value: clientRef }];
        }

        const source = clientRef?.data && typeof clientRef.data === "object" ? clientRef.data : clientRef;
        const orderedKeys = [...Object.keys(fieldLabels.client ?? {}), ...Object.keys(source ?? {})];
        const uniqueKeys = [...new Set(orderedKeys)];

        const rows: SummaryRow[] = uniqueKeys
            .filter((key) => hasSummaryValue(source?.[key]))
            .map((key) => {
                const config = clientFieldConfigs[key];
                return {
                    id: `client-${key}`,
                    label: fieldLabels.client?.[key] ?? humanizeLabel(key),
                    value: source[key],
                    display: config?.displayValue ?? config?.operationDisplay,
                    setting: config
                };
            });

        if (hasSummaryValue(clientRef?.uid)) rows.unshift({ id: "client-uid", label: "UID", value: clientRef.uid });
        else if (hasSummaryValue(clientRef?.id)) rows.unshift({ id: "client-id", label: "ID", value: clientRef.id });

        return rows;
    });

    const summarySections = $derived.by((): SummarySection[] => {
        const sections = (formPages ?? [])
            .map((page: any, pageIndex: number) => {
                const rows = (page?.formFields ?? [])
                    .map((field: any): SummaryRow | null => {
                        const config = field.config ?? field.props ?? field;
                        if (!config?.name) return null;

                        return {
                            id: config.name,
                            label: config.label ?? fieldLabels.data?.[config.name] ?? humanizeLabel(config.name),
                            value: formResponse.data?.[config.name],
                            display: config.displayValue ?? config.operationDisplay,
                            setting: config
                        };
                    })
                    .filter((row: SummaryRow | null): row is SummaryRow => Boolean(row));

                if (!rows.length) return null;
                return {
                    id: `page-${pageIndex}`,
                    title: page?.title ?? `Section ${pageIndex + 1}`,
                    rows,
                    icon: getSummaryIcon(page),
                    iconColor: page?.iconColor
                };
            })
            .filter((section: SummarySection | null): section is SummarySection => Boolean(section));

        const known = new Set(sections.flatMap((section: SummarySection) => section.rows.map((row: SummaryRow) => row.id)));
        const extraRows = Object.entries(formResponse.data ?? {})
            .filter(([key]) => !known.has(key))
            .map(([key, value]) => ({
                id: key,
                label: fieldLabels.data?.[key] ?? humanizeLabel(key),
                value
            }));

        if (extraRows.length) {
            sections.push({
                id: "extra-data",
                title: "Autres données",
                rows: extraRows,
                icon: "Package"
            });
        }

        return sections;
    });

    const summaryCards = $derived.by((): SummaryCard[] => {
        const cards: SummaryCard[] = [];

        cards.push({
            id: "client",
            title: "Client",
            preview: getSectionPreview(clientSummaryRows, "Aucun client sélectionné"),
            badge: "Étape 1",
            stepIndex: 0,
            rows: clientSummaryRows,
            tone: "orange",
            icon: getSummaryIcon(clientFormPages[0], "User"),
            iconColor: clientFormPages[0]?.iconColor
        });

        summarySections.forEach((section: SummarySection, index: number) => {
            cards.push({
                id: section.id,
                title: section.title,
                preview: getSectionPreview(section.rows, "Aucune donnée renseignée"),
                badge: `Étape ${index + 2}`,
                stepIndex: index + 1,
                rows: section.rows,
                tone: sectionTones[index % sectionTones.length],
                icon: section.icon,
                iconColor: section.iconColor
            });
        });

        return cards;
    });

    const completedSummaryCards = $derived(summaryCards.filter((card) => countFilledRows(card.rows) === card.rows.length).length);
    const summaryFooterNote = $derived(
        summaryCards.length
            ? completedSummaryCards === summaryCards.length
                ? "Toutes les étapes sont complètes"
                : `${completedSummaryCards}/${summaryCards.length} sections complètes`
            : "Aucune donnée à vérifier"
    );

    $effect(() => {
        if (formResponse?.id && !initialSnapshot) {
            initialSnapshot = cloneSnapshot(formResponse);
        }
    });

    $effect(() => {
        if (formResponse.client && typeof formResponse.client === "object") {
            selectedClientPreview = formResponse.client;
        }
    });

    $effect(() => {
        if (hasSelectedClient) clientSelectionError = "";
    });

    $effect(() => {
        const next = { ...openSections };
        let changed = false;

        for (const card of summaryCards) {
            if (next[card.id] === undefined) {
                next[card.id] = card.id === "client";
                changed = true;
            }
        }

        if (changed) {
            openSections = next;
        }
    });

    onMount(() => {
        void loadCompanyProfile()
            .catch((error) => console.error("Failed to load company profile", error))
            .finally(() => (companyProfileReady = true));

        (async () => {
            try {
                const operationFormData = initialFormConfig === undefined
                    ? await apiGet("/settings/form/active/operation")
                    : cloneSnapshot(initialFormConfig);
                formConfig = normalizeFormConfig(operationFormData) ?? undefined;
            } catch (error: unknown) {
                formMessage = (error as { status?: number })?.status === 404 ? "Aucun formulaire détecté." : "Impossible de charger le formulaire.";
                return;
            }

            if (!formConfig) {
                formMessage = "Aucun formulaire détecté.";
                return;
            }

            const formId = positiveInteger(formConfig.id);
            if (formId === null) {
                formMessage = "La configuration du formulaire est invalide.";
                return;
            }
            formMessage = "";

            formResponse.formID = formId;
            formResponse.data ??= {};
            if (formResponse.client === undefined) {
                formResponse.client = null;
            }

            formConfig.form.pages = normalizeBuilderPages(formConfig.form.pages);
            fieldLabels = buildFieldLabelMap(formConfig.form.pages);
            seedFormData(formConfig.form.pages, formResponse.data);

            const [recent, clientConfig, stateData] = await Promise.all([
                can("clients.view_list") ? apiGet("/core/clients/?limit=4") : Promise.resolve([]),
                can("clients.create") || can("clients.view_list")
                    ? apiGet("/settings/form/active/client").catch((error: unknown) => {
                        if ((error as { status?: number })?.status === 404) return null;
                        throw error;
                    })
                    : Promise.resolve(null),
                initialStates === undefined
                    ? apiGet("/settings/state/")
                    : Promise.resolve(cloneSnapshot(initialStates)),
            ]);
            recentClients = can("clients.view_list") ? recordList(recent) : [];
            operationStates = recordList(stateData);
            formResponse.state ??= operationStates[0]?.id;

            const normalizedClientConfig = normalizeFormConfig(clientConfig);
            if (normalizedClientConfig) {
                normalizedClientConfig.form.pages = normalizeBuilderPages(normalizedClientConfig.form.pages);
                const clientLabels = buildFieldLabelMap(normalizedClientConfig.form.pages);
                fieldLabels = {
                    ...fieldLabels,
                    client: { ...clientLabels.data, ...clientLabels.client }
                };
                clientIdentityFields = buildClientIdentityFields(normalizedClientConfig.form.pages);
                seedFormData(normalizedClientConfig.form.pages, clientFormData);
            }
            clientFormConfig = normalizedClientConfig ?? undefined;
        })();
    });

    const ensureClientSelected = () => {
        if (hasSelectedClient) return true;

        clientSelectionError = "Sélectionnez ou créez un client pour continuer.";
        operationSaved = false;
        if (stepIndex !== 0) {
            stepDirection = -1;
            stepIndex = 0;
        }
        return false;
    };

    const goToStep = (nextIndex: number) => {
        const boundedIndex = Math.max(0, Math.min(nextIndex, maxStep));
        if (boundedIndex > 0 && !ensureClientSelected()) return;
        if (boundedIndex === stepIndex) return;

        if (boundedIndex !== maxStep) {
            operationSaved = false;
        }
        stepDirection = boundedIndex > stepIndex ? 1 : -1;
        stepIndex = boundedIndex;
    };

    const findInvalidStep = (targetIndex: number): number | null => {
        return findInvalidFormStep({
            pages: formPages,
            startIndex: stepIndex,
            targetIndex,
            maxStep,
            data: formResponse.data ?? {}
        });
    };

    const reportStepValidity = async (index: number): Promise<boolean> => {
        if (index !== stepIndex) {
            goToStep(index);
            await tick();
        }

        const invalidField = drawerContent?.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
            "input:invalid, select:invalid, textarea:invalid"
        );

        if (!invalidField) return false;

        invalidField.reportValidity();
        invalidField.focus();
        return true;
    };

    const navigateToStep = async (targetIndex: number) => {
        const boundedTarget = Math.max(0, Math.min(targetIndex, maxStep));
        if (boundedTarget > 0 && !ensureClientSelected()) return;

        if (boundedTarget <= stepIndex) {
            goToStep(boundedTarget);
            return;
        }

        const invalidStep = findInvalidStep(boundedTarget);
        if (invalidStep !== null) {
            await reportStepValidity(invalidStep);
            return;
        }

        goToStep(boundedTarget);
    };

    const prevStep = () => {
        if (stepIndex > 0) {
            goToStep(stepIndex - 1);
        }
    };

    const loadClientMatches = async (term: string) => {
        clientSearchTerm = term;
        if (!can("clients.view_list") || !term.trim()) {
            clientMatches = [];
            return;
        }

        const result = await apiGet(`/core/clients/?search=${encodeURIComponent(term)}`);
        clientMatches = asList(result);
    };

    const selectClient = (client: any) => {
        const clientId = positiveInteger(client?.id ?? client?.pk);
        if (clientId === null) {
            selectedClientPreview = null;
            formResponse.client = null;
            clientSelectionError = "Ce client est invalide ou indisponible.";
            return;
        }

        selectedClientPreview = client;
        formResponse.client = clientId;
        clientSelectionError = "";
    };

    const setClientVerticalTransition = (direction: "up" | "down") => {
        if (direction === "up") {
            clientPanelOutFly = { y: 12, opacity: 0 };
            clientPanelInFly = { y: 12, opacity: 0 };
            return;
        }

        clientPanelOutFly = { y: -12, opacity: 0 };
        clientPanelInFly = { y: -12, opacity: 0 };
    };

    const goToClientSubStep = (nextIndex: number) => {
        const boundedIndex = Math.max(0, Math.min(nextIndex, clientFormMaxStep));
        if (boundedIndex === clientSubStep) return;

        clientPageDirection = boundedIndex > clientSubStep ? 1 : -1;
        clientSubStep = boundedIndex;
    };

    const openClientForm = () => {
        if (!can("clients.create") || !clientFormPages.length || !companyProfileReady || !privacyNoticeReady) return;
        setClientVerticalTransition("up");
        clientPageDirection = 0;
        clientSaved = false;
        savedClient = null;
        clientSubStep = 0;
    };

    const closeClientForm = () => {
        setClientVerticalTransition("down");
        clientPageDirection = 0;
        clientSubStep = -1;
        clientSaved = false;
        savedClient = null;
    };

    const clientFormNextStep = () => {
        goToClientSubStep(clientSubStep + 1);
    };

    const clientFormPrevStep = () => {
        if (clientSubStep === 0) {
            closeClientForm();
        } else {
            goToClientSubStep(clientSubStep - 1);
        }
    };

    const submitNewClient = async () => {
        if (!can("clients.create") || !companyProfileReady || !privacyNoticeReady) return;
        clientFormSubmitting = true;
        clientSaved = false;
        try {
            const created = await apiPost("/core/clients/", {
                data: clientFormData,
                form: clientFormConfig?.id
            });
            savedClient = { ...created, data: created?.data ?? clientFormData };
            selectClient(savedClient);
            clientSaved = true;
            // reset for next time
            clientFormData = {};
            seedFormData(clientFormConfig?.form?.pages, clientFormData);
        } catch (error) {
            console.error("Failed to create client", error);
            toast.error(isPrivacyNoticeRequiredError(error)
                ? "La notice de confidentialité doit être vérifiée avant de créer un client."
                : "Impossible de créer le client.");
        } finally {
            clientFormSubmitting = false;
        }
    };

    const submitOperation = async () => {
        if (operationSaving || !ensureClientSelected()) return;

        operationSaving = true;
        operationSaved = false;
        receiptRequest += 1;
        savedReceipt = null;
        receiptPdfData = null;
        receiptError = "";
        savedTrackingLabel = null;
        trackingLabelPdfData = null;
        trackingLabelError = "";
        try {
            const isEditing = Boolean(formResponse?.id || formResponse?.uid);

            const clientRef = formResponse.client;
            let clientId = selectedClientId;

            const initialClientData = getEditableData(initialSnapshot?.client, "client", fieldLabels);
            const nextClientData = getEditableData(clientRef, "client", fieldLabels);

            if (clientRef && typeof clientRef === "object") {
                if (clientId) {
                    if (!deepEqual(initialClientData, nextClientData)) {
                        await apiPut(`/core/clients/${clientId}/`, {
                            uid: clientId,
                            data: nextClientData,
                            form: clientRef.form ?? formResponse.form ?? formResponse.formID,
                            creator: clientRef.creator ?? clientRef.created_by ?? clientRef.user
                        });
                    }
                } else if (can("clients.create") && companyProfileReady && privacyNoticeReady && Object.keys(nextClientData).length) {
                    const created = await apiPost("/core/clients/", { data: nextClientData });
                    clientId = created.id ?? created.uid ?? created.pk ?? clientId;
                }
            }

            const payload = {
                uid: isEditing
                    ? formResponse.uid ?? formResponse.id
                    : await apiGet("/core/generate-id/operation/").then((result) => result.result),
                state: formResponse.state,
                form: formResponse.form ?? formResponse.formID,
                client: clientId,
                data: formResponse.data ?? {}
            };

            const saved = isEditing
                ? await apiPut(`/core/operations/${payload.uid}/`, payload)
                : await apiPost("/core/operations/", payload);
            const savedPayload = {
                ...(saved ?? {}),
                uid: saved?.uid ?? payload.uid,
                data: saved?.data ?? payload.data,
                client: saved?.client ?? payload.client
            };

            savedOperation = savedPayload;
            const shouldLoadReceipt = $appSettings.value.documents.receiptsEnabled
                && $appSettings.value.documents.autoReceiptOnOperationCreate;
            const shouldCreateTrackingLabel = !isEditing
                && canCreateTrackingLabel
                && loadTrackingLabelAutomaticPrint();
            receiptLoading = shouldLoadReceipt;
            operationSaved = true;
            if (!isEditing) onCreated?.(savedPayload);
            if (shouldLoadReceipt) void loadAutomaticReceipt(savedPayload);
            if (shouldCreateTrackingLabel) void createSavedOperationTrackingLabel(savedPayload, true);
        } catch (error) {
            console.error(error);
        } finally {
            operationSaving = false;
        }
    };

    const createSavedOperationTrackingLabel = async (
        operation: Record<string, any> | null = savedOperation,
        printAfterCreation = false,
    ) => {
        const reference = operation?.uid ?? savedOperationRef;
        if (!reference || !operation || trackingLabelLoading) return;
        trackingLabelLoading = true;
        trackingLabelError = "";
        try {
            const documents = $appSettings.value.documents;
            const created = await createTrackingLabel(String(reference), operation);
            if (String(savedOperationRef) !== String(reference)) return;
            savedTrackingLabel = created.document;
            trackingLabelPdfData = created.pdfData;
            if (printAfterCreation) {
                queuePrint({
                    type: "tracking-label",
                    mode: "automatic",
                    kind: "pdf",
                    title: "Étiquette de suivi",
                    description: created.document.number ?? `${documents.trackingLabelWidthMm} × ${documents.trackingLabelHeightMm} mm`,
                    data: created.pdfData,
                    orientation: documents.trackingLabelWidthMm >= documents.trackingLabelHeightMm ? "landscape" : "portrait",
                    paperSize: "document",
                });
            }
        } catch (error) {
            console.error("Failed to create tracking label", error);
            trackingLabelError = "Impossible de créer l’étiquette de suivi.";
            if (printAfterCreation) toast.error("L’opération est enregistrée, mais l’étiquette ne peut pas être créée.");
        } finally {
            if (String(savedOperationRef) === String(reference)) trackingLabelLoading = false;
        }
    };

    const loadReceiptPDF = async (receipt: OperationDocument, request = ++receiptRequest) => {
        if (request !== receiptRequest) return;
        savedReceipt = receipt;
        receiptPdfData = null;
        receiptError = "";
        receiptLoading = true;
        try {
            const data = await downloadDocumentPDF(receipt.id);
            if (request === receiptRequest) receiptPdfData = data;
        } catch (error) {
            if (request !== receiptRequest) return;
            console.error("Failed to load receipt preview", error);
            receiptError = "Le reçu a été créé, mais son aperçu ne peut pas être chargé.";
        } finally {
            if (request === receiptRequest) receiptLoading = false;
        }
    };

    const loadAutomaticReceipt = async (operation: Record<string, any>) => {
        const request = ++receiptRequest;
        const operationId = Number(operation.id ?? operation.pk);
        receiptError = "";
        receiptLoading = true;
        try {
            if (!Number.isInteger(operationId) || operationId <= 0) throw new Error("Missing operation ID");
            const receipt = (await listDocuments(operationId)).find((document) =>
                document.document_type === "receipt" && document.status === "issued"
            );
            if (request !== receiptRequest) return;
            if (!receipt) throw new Error("Issued receipt not found");
            await loadReceiptPDF(receipt, request);
        } catch (error) {
            if (request !== receiptRequest) return;
            console.error("Failed to load automatic receipt", error);
            receiptError = "L’opération est enregistrée, mais le reçu automatique ne peut pas être chargé.";
        } finally {
            if (request === receiptRequest) receiptLoading = false;
        }
    };

    const createSavedOperationReceipt = async () => {
        if (!savedOperationRef || creatingReceipt) return;
        const request = ++receiptRequest;
        creatingReceipt = true;
        receiptError = "";
        try {
            const receipt = await createReceipt(String(savedOperationRef));
            if (request !== receiptRequest) return;
            await loadReceiptPDF(receipt, request);
        } catch (error) {
            if (request !== receiptRequest) return;
            console.error("Failed to create receipt", error);
            receiptError = "Impossible de créer le reçu de prise en charge.";
        } finally {
            if (request === receiptRequest) creatingReceipt = false;
        }
    };

    const retryReceipt = () => {
        if (savedReceipt) {
            void loadReceiptPDF(savedReceipt);
        } else if ($appSettings.value.documents.autoReceiptOnOperationCreate && savedOperation) {
            void loadAutomaticReceipt(savedOperation);
        } else {
            void createSavedOperationReceipt();
        }
    };

    const printDisplayedDocument = () => {
        if (!displayedPdfData || !displayedDocument) return;
        const isTrackingLabel = displayedDocument.document_type === "tracking_label";
        const labelWidth = displayedDocument.snapshot?.presentation?.width_mm ?? 0;
        const labelHeight = displayedDocument.snapshot?.presentation?.height_mm ?? 0;
        queuePrint({
            type: isTrackingLabel ? "tracking-label" : "document",
            mode: "manual",
            kind: "pdf",
            title: isTrackingLabel ? "Étiquette de suivi" : "Reçu de prise en charge",
            description: displayedDocument.number ?? savedOperationRef ?? undefined,
            data: displayedPdfData,
            orientation: isTrackingLabel ? (labelWidth >= labelHeight ? "landscape" : "portrait") : undefined,
            paperSize: isTrackingLabel ? "document" : undefined,
        });
    };

    const goToSavedOperation = () => {
        if (savedOperationRef) {
            goto(`/operations/${savedOperationRef}`);
        }
    };

    const resetSavedOperation = () => {
        receiptRequest += 1;
        operationSaved = false;
        savedOperation = null;
        savedReceipt = null;
        receiptPdfData = null;
        receiptLoading = false;
        creatingReceipt = false;
        receiptError = "";
        savedTrackingLabel = null;
        trackingLabelPdfData = null;
        trackingLabelLoading = false;
        trackingLabelError = "";
        stepIndex = 0;
        stepDirection = -1;
        formResponse.client = null;
        formResponse.data = {};
        seedFormData(formPages, formResponse.data);
        selectedClientPreview = null;
        initialSnapshot = null;
    };

    const continueAfterClientCreation = () => {
        closeClientForm();
        navigateToStep(1);
    };
</script>

<Drawer.Root
    bind:open={drawerOpen}
    {direction}
    shouldScaleBackground
    closeThreshold={0}
    onOutsideClick={(event) => {
        if (document.getElementById("psoft-print-drawer")) event.preventDefault();
    }}
    onOpenChange={(open: boolean) => {
        if (!open) return;
        if (operationSaved) resetSavedOperation();
        if (presetClient) {
            formResponse.client = presetClient;
            selectedClientPreview = presetClient;
        }
    }}
>
    <Drawer.Trigger asChild let:builder>
        {@render children(builder)}
    </Drawer.Trigger>

    <Drawer.Portal>
        <Drawer.Overlay class="fixed inset-0 z-(--z-overlay) bg-black/40" />
        <Drawer.Content
            class="fixed inset-y-0 right-0 z-(--z-overlay) ml-auto h-full! w-5/6 max-w-none border-none bg-(--light-bg2) outline-none! select-text!"
            tabindex={-1}
        >
            <div
                in:slide={{ duration: 0 }}
                bind:this={drawerContent}
                data-vaul-no-drag
                class="flex h-full min-h-0 overflow-hidden font-(family-name:--font) text-(--dark-bg1)"
            >
                <main class="flex min-w-0 flex-1 flex-col overflow-hidden">
                    <div
                        class="flex w-full flex-col items-start gap-4 border-b border-(--light-bg3) bg-(--light-bg1) px-5 py-4 sm:min-h-14 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-0"
                    >
                        <div class="flex flex-row gap-1 items-center">
                            <div class="text-lg font-bold font-(family-name:--font)">
                                {isInClientForm
                                    ? "Nouveau client"
                                    : operationSaved
                                        ? `${operationSingular($appSettings.value.operation)} enregistrée`
                                        : `Nouvelle ${operationSingularLower($appSettings.value.operation)}`}
                            </div>
                        </div>

                        <div class="flex flex-row gap-1 items-center">
                            {#if !formMessage && !operationSaved}
                            {#if isInClientForm}
                                <StepProgress
                                    steps={clientFormPages.map((page: any, index: number) => ({
                                        id: String(page.id ?? index),
                                        label: page.title ?? `Étape ${index + 1}`
                                    }))}
                                    activeIndex={clientSubStep}
                                    onSelect={(index) => {
                                        if (index < clientSubStep) goToClientSubStep(index);
                                    }}
                                />
                            {:else}
                                <StepProgress
                                    steps={workflowSteps}
                                    activeIndex={stepIndex}
                                    onSelect={navigateToStep}
                                />
                            {/if}
                            {/if}
                        </div>
                    </div>

                    <div class="relative min-h-0 flex-1 overflow-hidden">
                        {#if formMessage}
                            <div class="flex h-full items-center justify-center px-8 text-center text-sm text-(--grey)">{formMessage}</div>
                        {:else}
                        {#key stepIndex}
                            <div
                                class={`absolute inset-0 flex min-h-0 flex-col sm:px-10 ${isSummaryStep && operationSaved
                                    ? "overflow-hidden px-5 py-0"
                                    : "overflow-y-auto px-5 py-6"}`}
                                in:fly={{ x: stepDirection * 20, duration: animationTime(), delay: animationTime() }}
                                out:fly={{ x: stepDirection * -20, duration: animationTime() }}
                            >
                            {#if isClientStep}
                                <div class="relative min-h-0 flex-1">
                                    {#if isInClientForm && clientSaved}
                                        <div
                                            class="absolute inset-0 flex min-h-0 flex-col"
                                            in:fly={{ ...clientPanelInFly, duration: animationTime(220) }}
                                            out:fly={{ ...clientPanelOutFly, duration: animationTime(220) }}
                                        >
                                            <OperationFormClientSaved client={savedClient} />
                                        </div>
                                    {:else if isInClientForm}
                                        <div
                                            class="absolute inset-0 flex min-h-0 flex-col"
                                            in:fly={{ ...clientPanelInFly, duration: animationTime(220) }}
                                            out:fly={{ ...clientPanelOutFly, duration: animationTime(220) }}
                                        >
                                            <div class="relative min-h-0 flex-1 overflow-hidden">
                                                {#key clientSubStep}
                                                    <div
                                                        class="absolute inset-0 flex min-h-0 flex-col"
                                                        in:fly={{ x: clientPageDirection * 20, duration: animationTime(), delay: animationTime() }}
                                                        out:fly={{ x: clientPageDirection * -20, duration: animationTime() }}
                                                    >
                                                        {#if activeClientPage}
                                                            <OperationFormGrid
                                                                page={activeClientPage}
                                                                bind:data={clientFormData}
                                                                fill
                                                            />
                                                        {/if}
                                                    </div>
                                                {/key}
                                            </div>
                                        </div>
                                    {:else}
                                        <div
                                            class="absolute inset-0 flex min-h-0 flex-col"
                                            in:fly={{ ...clientPanelInFly, duration: animationTime(220) }}
                                            out:fly={{ ...clientPanelOutFly, duration: animationTime(220) }}
                                        >
                                            <OperationFormClientPicker
                                                bind:clientSearchTerm
                                                {displayedClients}
                                                selectedClient={formResponse.client}
                                                clientFieldLabels={fieldLabels.client}
                                                {clientIdentityFields}
                                                allowSearch={can("clients.view_list")}
                                                allowCreate={can("clients.create") && companyProfileReady && privacyNoticeReady}
                                                createBlockedReason={can("clients.create") && companyProfileReady && !privacyNoticeReady
                                                    ? "La notice de confidentialité doit être vérifiée avant de créer un client."
                                                    : undefined}
                                                onSearch={loadClientMatches}
                                                onSelect={selectClient}
                                                onCreate={openClientForm}
                                                onResolveCreateBlock={can("settings.general.modify")
                                                    ? () => {
                                                        drawerOpen = false;
                                                        void goto("/settings/general?open=privacy");
                                                    }
                                                    : undefined}
                                            />
                                        </div>
                                    {/if}
                                </div>
                            {:else if activePage}
                                <OperationFormGrid
                                    page={activePage}
                                    bind:data={formResponse.data}
                                />
                            {:else if isSummaryStep && operationSaved}
                                <OperationFormSaved
                                    operation={savedOperation}
                                    receipt={savedReceipt}
                                    pdfData={receiptPdfData}
                                    trackingLabel={savedTrackingLabel}
                                    {trackingLabelPdfData}
                                    {receiptLoading}
                                    {trackingLabelLoading}
                                    {receiptError}
                                    {trackingLabelError}
                                    {canCreateReceipt}
                                    {canCreateTrackingLabel}
                                    {creatingReceipt}
                                    onCreateReceipt={() => void createSavedOperationReceipt()}
                                    onCreateTrackingLabel={() => void createSavedOperationTrackingLabel()}
                                    onRetryReceipt={retryReceipt}
                                    onRetryTrackingLabel={() => void createSavedOperationTrackingLabel()}
                                />
                            {:else if isSummaryStep}
                                <OperationFormSummary
                                    {summaryCards}
                                    bind:openSections
                                    onEdit={goToStep}
                                />
                            {/if}
                            </div>
                        {/key}
                        {/if}
                    </div>

                    {#if !formMessage}
                    <div class="flex shrink-0 flex-col items-start justify-between gap-4 border-t border-(--light-bg3) bg-(--light-bg1) px-5 py-4 sm:h-15 sm:flex-row sm:items-center sm:px-10 sm:py-0">
                        {#if isClientStep}
                            {#if isInClientForm}
                                {#if clientSaved}
                                    <Button
                                        variant="ghost"
                                        class="border-0 text-(--grey) hover:text-(--dark-bg1) w-fit px-0 h-9 font-medium"
                                        onclick={closeClientForm}
                                    >
                                        <Icon.MoveLeft size="14" />
                                        Retour à la sélection
                                    </Button>
                                    <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                        <span class="truncate whitespace-nowrap text-xs text-(--grey)">Client prêt</span>
                                        <Button variant="primary" class="w-fit px-5 h-9 font-medium" onclick={continueAfterClientCreation}>
                                            Continuer {operationSingularLower($appSettings.value.operation)}
                                            <Icon.MoveRight size="14" />
                                        </Button>
                                    </div>
                                {:else}
                                <Button
                                    variant="ghost"
                                    class="border-0 text-(--grey) hover:text-(--dark-bg1) w-fit px-0 h-9 font-medium"
                                    onclick={clientFormPrevStep}
                                >
                                    <Icon.MoveLeft size="14" />
                                    {clientSubStep === 0 ? "Retour" : "Précédent"}
                                </Button>
                                <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                    <span class="truncate whitespace-nowrap text-xs text-(--grey)">
                                        {clientSubStep + 1}/{clientFormPages.length}
                                    </span>
                                    {#if clientSubStep < clientFormMaxStep}
                                        <Button variant="primary" class="w-fit px-5 h-9 font-medium" onclick={clientFormNextStep}>
                                            Suivant
                                            <Icon.MoveRight size="14" />
                                        </Button>
                                    {:else}
                                        <Button
                                            variant="primary"
                                            class="w-fit px-5 h-9 font-medium"
                                            disabled={clientFormSubmitting}
                                            onclick={submitNewClient}
                                        >
                                            {#if clientFormSubmitting}
                                                <Icon.Loader size="14" class="animate-spin" />
                                            {:else}
                                                <Icon.Plus size="14" />
                                            {/if}
                                            Créer le client
                                        </Button>
                                    {/if}
                                </div>
                                {/if}
                            {:else}
                                <Drawer.Close asChild let:builder>
                                    <Button {builder} variant="ghost" class="border-0 text-(--grey) hover:text-(--dark-bg1) w-fit px-0 h-9 font-medium">
                                        Annuler
                                    </Button>
                                </Drawer.Close>

                                <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                    <span class="truncate whitespace-nowrap text-xs text-(--grey)">
                                        {#if selectedClientPreview}
                                            Client: <span class="text-(--user-color) font-semibold">{getClientName(selectedClientPreview, fieldLabels.client, clientIdentityFields)}</span>
                                        {:else if hasSelectedClient}
                                            Client #{selectedClientId}
                                        {:else}
                                            <span class={clientSelectionError ? "text-(--red)" : ""}>
                                                {clientSelectionError || "Sélectionnez ou créez un client"}
                                            </span>
                                        {/if}
                                    </span>
                                    <Button
                                        variant="primary"
                                        class="w-fit px-5 h-9 font-medium"
                                        disabled={!hasSelectedClient}
                                        onclick={() => navigateToStep(stepIndex + 1)}
                                    >
                                        Suivant
                                        <Icon.MoveRight size="14" />
                                    </Button>
                                </div>
                            {/if}
                        {:else if isSummaryStep && operationSaved}
                            <Drawer.Close asChild let:builder>
                                <Button
                                    {builder}
                                    variant="secondary"
                                    icon="X"
                                    label="Fermer"
                                    class="w-fit px-5 h-9 font-medium"
                                />
                            </Drawer.Close>

                            <div class="flex min-w-0 w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                                {#if displayedPdfData && canCreateReceipt && !savedReceipt}
                                    <Button
                                        variant="secondary"
                                        class="w-fit px-5 h-9 font-medium"
                                        icon={creatingReceipt ? "LoaderCircle" : "ReceiptText"}
                                        iconAnimation={creatingReceipt ? "spin" : undefined}
                                        label="Créer un reçu"
                                        disabled={documentLoading}
                                        onclick={() => void createSavedOperationReceipt()}
                                    />
                                {/if}
                                {#if displayedPdfData && canCreateTrackingLabel && !savedTrackingLabel}
                                    <Button
                                        variant="secondary"
                                        class="w-fit px-5 h-9 font-medium"
                                        icon={trackingLabelLoading ? "LoaderCircle" : "Tag"}
                                        iconAnimation={trackingLabelLoading ? "spin" : undefined}
                                        label="Créer une étiquette"
                                        disabled={documentLoading}
                                        onclick={() => void createSavedOperationTrackingLabel()}
                                    />
                                {/if}
                                {#if displayedPdfData}
                                    <Button
                                        variant="secondary"
                                        class="w-fit px-5 h-9 font-medium"
                                        icon={documentLoading ? "LoaderCircle" : "Printer"}
                                        iconAnimation={documentLoading ? "spin" : undefined}
                                        label={documentLoading ? "Préparation…" : "Imprimer"}
                                        disabled={documentLoading}
                                        onclick={printDisplayedDocument}
                                    />
                                {/if}
                                <Button class="w-fit px-5 h-9 font-medium" disabled={!savedOperationRef} onclick={goToSavedOperation}>
                                    Voir {operationSingularLower($appSettings.value.operation)}
                                    <Icon.MoveRight size="14" />
                                </Button>
                            </div>
                        {:else if isSummaryStep}
                            <Button variant="secondary" class="w-fit px-5 h-9 font-medium" onclick={prevStep}>
                                <Icon.MoveLeft size="14" />
                                Précédent
                            </Button>
                            <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                <span class="truncate whitespace-nowrap text-xs text-(--grey)">{summaryFooterNote}</span>

                                <Button
                                    variant="primary"
                                    class="bg-(--user-color) hover:bg-(--user-color-darker) w-fit px-5 h-9 font-medium"
                                    disabled={operationSaving || !hasSelectedClient}
                                    onclick={submitOperation}
                                >
                                    {#if operationSaving}
                                        <Icon.Loader size="14" class="animate-spin" />
                                    {:else}
                                        <Icon.Check size="16" />
                                    {/if}
                                    {operationSaving ? "Enregistrement..." : "Enregistrer"}
                                </Button>
                            </div>
                        {:else}
                            <Button variant="secondary" class="w-fit px-5 h-9 font-medium" onclick={prevStep}>
                                <Icon.MoveLeft size="14" />
                                Précédent
                            </Button>

                            <div class="flex min-w-0 w-full flex-wrap items-center justify-between gap-3.5 sm:w-auto">
                                <span class="truncate whitespace-nowrap text-xs text-(--grey)">{activePage?.title ?? ""}</span>
                                <Button variant="primary" class="w-fit px-5 h-9 font-medium" onclick={() => navigateToStep(stepIndex + 1)}>
                                    Suivant
                                    <Icon.MoveRight size="14" />
                                </Button>
                            </div>
                        {/if}
                    </div>
                    {/if}
                </main>
            </div>
        </Drawer.Content>
    </Drawer.Portal>
</Drawer.Root>
