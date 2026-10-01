<script lang="ts">
    import { browser } from "$app/environment";
    import { invoke } from "@tauri-apps/api/core";
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import * as Icon from "lucide-svelte";
    import { SettingsExpandableRow, SettingsGroup, SettingsPage, SettingsRow, SettingsSection } from "$lib/components/settings";
    import { Button, Checkbox, NumberInput, Radio, Select, TextInput } from "$lib/components/istyler";
    import { isDefaultDeviceName, loadCurrentDevice, saveCurrentDevice, type CurrentDevice, type DeviceType } from "$lib/device";
    import { refreshAppTitle } from "$lib/appTitle";
    import { currentUser } from "$lib/auth";
    import { appSettings, bootstrapSettings } from "$lib/settings";
    import { operationPlural, operationSingularLower } from "$lib/operationDisplay";
    import type { StartupMode } from "$lib/startupRoute";
    import { animationTime, resetUiPreferences } from "$lib/uiPreferences";
    import {
        loadTrackingLabelAutomaticPrint,
        loadTrackingLabelPrinter,
        resetTrackingLabelDeviceSettings,
        saveTrackingLabelAutomaticPrint,
        saveTrackingLabelPrinter,
    } from "$lib/trackingLabel";
    import {
        DEFAULT_PRINT_PREFERENCES,
        listInstalledPrinters,
        printPreferences,
        resetPrintPreferences,
        SYSTEM_PRINTER_VALUE,
        updatePrintPreferences,
        type PrintPreferences,
        type PrinterInfo,
    } from "$lib/printing";

    const STORAGE_KEY = "thisDeviceSettings";
    const LEGACY_DEFAULT_DEVICE_NAME = "Poste atelier";
    type DeviceSettings = {
        deviceName?: string;
        deviceType?: DeviceType;
        startupMode: StartupMode;
    };

    const DEFAULT_DEVICE_SETTINGS: DeviceSettings = {
        deviceName: LEGACY_DEFAULT_DEVICE_NAME,
        deviceType: "shared",
        startupMode: "home",
    };

    let currentDevice = $state<CurrentDevice | null>(null);
    let deviceName = $state("Nouvel appareil");
    let deviceType = $state<DeviceType>("shared");
    let startupMode = $state<DeviceSettings["startupMode"]>(DEFAULT_DEVICE_SETTINGS.startupMode);
    let settingsReady = $state(false);
    let deviceLoading = $state(true);
    let savingDeviceName = $state(false);
    let checkingConnection = $state(false);
    let clearingCache = $state(false);
    let connectionState = $state<"checking" | "online" | "offline">("checking");
    let installedPrinters = $state<PrinterInfo[]>([]);
    let printersLoading = $state(true);
    let printSettingsReady = $state(false);
    let trackingLabelPrinter = $state(loadTrackingLabelPrinter());
    let trackingLabelAutomaticPrint = $state(loadTrackingLabelAutomaticPrint());
    let localPrintPreferences = $state<PrintPreferences>({
        ...DEFAULT_PRINT_PREFERENCES,
        defaults: { ...DEFAULT_PRINT_PREFERENCES.defaults },
    });
    const deviceNameDirty = $derived(currentDevice
        ? deviceName.trim() !== currentDevice.name
        : false);
    const deviceBusy = $derived(deviceLoading || savingDeviceName);
    const canModifyDevice = $derived(Boolean($currentUser?.administrator || $currentUser?.permissions?.includes("users.modify")));
    const systemPrinter = $derived(installedPrinters.find((printer) => printer.isDefault));
    const printerOptions = $derived([
        {
            value: SYSTEM_PRINTER_VALUE,
            label: systemPrinter
                ? `Par défaut · ${systemPrinter.name}`
                : "Aucune imprimante système par défaut",
            disabled: !systemPrinter,
        },
        ...(localPrintPreferences.printerName
            && !installedPrinters.some((printer) => printer.name === localPrintPreferences.printerName)
            ? [{
                value: localPrintPreferences.printerName,
                label: localPrintPreferences.printerName,
                helpText: "Imprimante indisponible",
                disabled: true,
            }]
            : []),
        ...installedPrinters.map((printer) => ({
            value: printer.name,
            label: printer.name,
            helpText: printer.isDefault ? "Imprimante système par défaut" : undefined,
        })),
    ]);
    const trackingLabelPrinterOptions = $derived([
        {
            value: SYSTEM_PRINTER_VALUE,
            label: systemPrinter
                ? `Par défaut · ${systemPrinter.name}`
                : "Aucune imprimante système par défaut",
            disabled: !systemPrinter,
        },
        ...(trackingLabelPrinter !== SYSTEM_PRINTER_VALUE
            && !installedPrinters.some((printer) => printer.name === trackingLabelPrinter)
            ? [{
                value: trackingLabelPrinter,
                label: trackingLabelPrinter,
                helpText: "Imprimante indisponible",
                disabled: true,
            }]
            : []),
        ...installedPrinters.map((printer) => ({
            value: printer.name,
            label: printer.name,
            helpText: printer.isDefault ? "Imprimante système par défaut" : undefined,
        })),
    ]);

    const connectionBadge = $derived(
        connectionState === "online"
            ? { text: "Connecté", class: "bg-(--transparent-green) text-(--green)" }
            : connectionState === "offline"
                ? { text: "Hors ligne", class: "bg-(--transparent-red) text-(--red)" }
                : { text: "Vérification", class: "bg-orange-100 text-(--orange)" },
    );

    function isChoice<T extends string>(value: unknown, choices: readonly T[]): value is T {
        return typeof value === "string" && choices.includes(value as T);
    }

    function normalizeDeviceSettings(value: unknown): DeviceSettings {
        const source = value && typeof value === "object" ? value as Partial<DeviceSettings> : {};
        return {
            deviceName: typeof source.deviceName === "string" && source.deviceName.trim()
                ? source.deviceName.trim().slice(0, 80)
                : DEFAULT_DEVICE_SETTINGS.deviceName,
            deviceType: isChoice(source.deviceType, ["personal", "shared"] as const)
                ? source.deviceType
                : DEFAULT_DEVICE_SETTINGS.deviceType,
            startupMode: isChoice(source.startupMode, ["restore", "home", "operations"] as const)
                ? source.startupMode
                : DEFAULT_DEVICE_SETTINGS.startupMode,
        };
    }

    function readDeviceSettings() {
        if (!browser) return { settings: DEFAULT_DEVICE_SETTINGS, hasStoredSettings: false };

        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            return {
                settings: normalizeDeviceSettings(stored ? JSON.parse(stored) : null),
                hasStoredSettings: Boolean(stored),
            };
        } catch {
            return { settings: DEFAULT_DEVICE_SETTINGS, hasStoredSettings: false };
        }
    }

    function currentDeviceSettings() {
        return {
            startupMode,
        };
    }

    function applyLocalDeviceSettings(settings: DeviceSettings) {
        startupMode = settings.startupMode;
    }

    function applyCurrentDevice(device: CurrentDevice) {
        currentDevice = device;
        deviceName = device.name;
        deviceType = device.type;
    }

    function saveDeviceSettings() {
        if (!browser) return;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentDeviceSettings()));
    }

    function shouldMigrateStoredDevice(settings: DeviceSettings, hasStoredSettings: boolean, device: CurrentDevice) {
        if (!hasStoredSettings || !isDefaultDeviceName(device.name)) return false;

        const storedName = settings.deviceName?.trim();
        const hasCustomName = Boolean(storedName && storedName !== LEGACY_DEFAULT_DEVICE_NAME);
        const hasCustomType = settings.deviceType && settings.deviceType !== DEFAULT_DEVICE_SETTINGS.deviceType;
        return hasCustomName || hasCustomType;
    }

    async function loadDeviceIdentification(settings: DeviceSettings, hasStoredSettings: boolean) {
        deviceLoading = true;

        try {
            let device = await loadCurrentDevice();
            if (canModifyDevice && shouldMigrateStoredDevice(settings, hasStoredSettings, device)) {
                device = await saveCurrentDevice({
                    name: settings.deviceName?.trim() || device.name,
                    type: settings.deviceType ?? device.type,
                });
            }
            applyCurrentDevice(device);
        } catch (error) {
            console.error("Failed to load current device", error);
            toast.error("Impossible de charger l'identification de cet appareil.");
        } finally {
            deviceLoading = false;
        }
    }

    async function saveDeviceName() {
        if (!canModifyDevice) return;
        const name = deviceName.trim();
        if (!name) {
            toast.error("Le nom de l'appareil est obligatoire.");
            return;
        }

        savingDeviceName = true;
        try {
            const device = await saveCurrentDevice({ name, type: deviceType });
            applyCurrentDevice(device);
            await refreshAppTitle({ deviceName: device.name });
            toast.success("Nom de l'appareil enregistré.");
        } catch (error) {
            console.error("Failed to save current device", error);
            toast.error("Impossible d'enregistrer le nom de cet appareil.");
        } finally {
            savingDeviceName = false;
        }
    }

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function retryConnection() {
        checkingConnection = true;
        connectionState = "checking";

        try {
            await Promise.all([
                bootstrapSettings(true),
                wait(1000)
            ]);

            connectionState = "online";
        } catch (error) {
            console.error("Failed to check server connection", error);
            connectionState = "offline";
            toast.error("Connexion serveur indisponible.");
        } finally {
            checkingConnection = false;
        }
    }

    async function clearCache() {
        if (clearingCache) return;
        clearingCache = true;

        try {
            await invoke("clear_webview_cache");
            toast.success("Cache vidé. Vos préférences sont conservées.");
        } catch (error) {
            console.error("Failed to clear WebView2 cache", error);
            toast.error("Impossible de vider le cache.");
        } finally {
            clearingCache = false;
        }
    }

    async function loadPrinters() {
        printersLoading = true;
        try {
            installedPrinters = await listInstalledPrinters();
        } catch (error) {
            console.error("Failed to list printers", error);
            installedPrinters = [];
        } finally {
            printersLoading = false;
        }
    }

    function resetLocalSettings() {
        applyLocalDeviceSettings(DEFAULT_DEVICE_SETTINGS);
        resetUiPreferences();
        resetPrintPreferences();
        resetTrackingLabelDeviceSettings();
        trackingLabelPrinter = SYSTEM_PRINTER_VALUE;
        trackingLabelAutomaticPrint = false;
        localPrintPreferences = {
            ...DEFAULT_PRINT_PREFERENCES,
            defaults: { ...DEFAULT_PRINT_PREFERENCES.defaults },
        };
        saveDeviceSettings();
        toast.success("Réglages locaux réinitialisés.");
    }

    onMount(() => {
        const { settings, hasStoredSettings } = readDeviceSettings();
        applyLocalDeviceSettings(settings);
        localPrintPreferences = {
            ...$printPreferences,
            defaults: { ...$printPreferences.defaults },
        };
        printSettingsReady = true;
        settingsReady = true;
        void loadDeviceIdentification(settings, hasStoredSettings);
        void retryConnection();
        void loadPrinters();
    });

    $effect(() => {
        if (!settingsReady) return;
        saveDeviceSettings();
    });

    $effect(() => {
        if (!printSettingsReady) return;
        updatePrintPreferences(localPrintPreferences);
    });
</script>

<SettingsPage
    title="Cet appareil"
    description="Réglages locaux de ce poste, sans modifier les autres appareils."
>
    <SettingsSection label="Identification du poste">
        <SettingsRow
            icon="LaptopMinimalCheck"
            title="Nom de l'appareil"
            description="Nom utilisé pour reconnaître ce poste."
            toneClass="bg-blue-50 text-blue-700"
        >
            <TextInput
                name="device-name"
                label="Nom"
                maxlength="80"
                bind:value={deviceName}
                disabled={deviceBusy || !canModifyDevice}
            >
                {#snippet suffix()}
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={savingDeviceName ? "Loader" : "Save"}
                        iconAnimation={savingDeviceName ? "spin" : undefined}
                        label={deviceNameDirty ? "Enregistrer" : "Enregistré"}
                        disabled={deviceBusy || !canModifyDevice || !deviceNameDirty}
                        onclick={saveDeviceName}
                        class="w-fit rounded-none bg-(--dark-bg1) text-(--light-bg1) hover:bg-(--user-color)
                            disabled:cursor-not-allowed disabled:bg-(--light-bg1) disabled:text-(--light-grey)"
                    />
                {/snippet}
            </TextInput>
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Démarrage">
        <SettingsRow
            icon="PanelTopOpen"
            title="Comportement au démarrage"
            description="Définit ce que l'application ouvre au lancement."
            toneClass="bg-violet-50 text-violet-700"
        >
            <Radio
                name="startup-mode"
                box={true}
                direction="horizontal"
                bind:value={startupMode}
                options={[
                    { icon: "House",  label: "Accueil", value: "home", hideCheckbox: true},
                    { icon: "History", label: "Restaurer la dernière page", value: "restore", hideCheckbox: true},
                    { icon: $appSettings.value.operation.operationIcon, label: operationPlural($appSettings.value.operation), value: "operations", hideCheckbox: true},
                ]}
            />
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Impression">
        <SettingsGroup>
            <SettingsRow
                icon="Printer"
                title="Imprimante par défaut"
                description="Imprimante proposée pour les nouveaux tirages."
                toneClass="bg-blue-50 text-blue-700"
            >
                {#snippet action()}
                    <Select
                        name="default-printer"
                        ariaLabel="Imprimante par défaut"
                        options={printerOptions}
                        value={localPrintPreferences.printerName || SYSTEM_PRINTER_VALUE}
                        onchange={(value) => {
                            localPrintPreferences.printerName = typeof value === "string" && value !== SYSTEM_PRINTER_VALUE
                                ? value
                                : "";
                        }}
                        allowDeselect={false}
                        disabled={printersLoading || installedPrinters.length === 0}
                    />
                {/snippet}
            </SettingsRow>

            <SettingsExpandableRow
                icon="Zap"
                title="Impression directe"
                description="Imprime sans ouvrir le panneau avec les options définies ci-dessous."
                name="direct-printing"
                toneClass="bg-orange-50 text-orange-700"
                bind:value={localPrintPreferences.direct}
            >
                <div class="flex w-full flex-col gap-3">
                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div class="w-full min-w-0 flex-1">
                            <NumberInput
                                name="default-print-copies"
                                label="Copies"
                                min={1}
                                max={99}
                                display="lateral"
                                bind:value={localPrintPreferences.defaults.copies}
                            />
                        </div>
                        <div class="w-full min-w-0 flex-1">
                            <Select
                                name="default-print-format"
                                label="Format"
                                bind:value={localPrintPreferences.defaults.paperSize}
                                allowDeselect={false}
                                options={[
                                    { label: "Format du document", value: "document" },
                                    { label: "A4", value: "a4" },
                                    { label: "A5", value: "a5" },
                                    { label: "Lettre", value: "letter" },
                                ]}
                            />
                        </div>
                    </div>

                    <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <div class="w-full min-w-0 flex-1">
                            <Radio
                                name="default-print-color"
                                label="Rendu"
                                box
                                bind:value={localPrintPreferences.defaults.color}
                                options={[
                                    { icon: "Palette", label: "Couleur", value: "color", hideCheckbox: true },
                                    { icon: "CircleOff", label: "Noir et blanc", value: "grayscale", hideCheckbox: true },
                                ]}
                                parentClass="min-h-10! min-w-0 flex-1 px-2.5! py-2!"
                                groupClass="flex gap-2"
                            />
                        </div>
                        <div class="w-full min-w-0 flex-1">
                            <Radio
                                name="default-print-orientation"
                                label="Orientation"
                                box
                                bind:value={localPrintPreferences.defaults.orientation}
                                options={[
                                    { icon: "RectangleVertical", label: "Portrait", value: "portrait", hideCheckbox: true },
                                    { icon: "RectangleHorizontal", label: "Paysage", value: "landscape", hideCheckbox: true },
                                ]}
                                groupClass="flex gap-2"
                                parentClass="min-h-10! min-w-0 flex-1 px-2.5! py-2!"
                            />
                        </div>
                    </div>

                    <div class="flex flex-col gap-1">
                        <span class="input-label">Faces</span>
                        <Checkbox
                            name="default-print-duplex"
                            switchMode
                            side="left"
                            bind:value={localPrintPreferences.defaults.duplex}
                            class="h-10 w-full justify-between rounded-lg border border-(--light-bg3) px-3"
                        >
                            {#snippet content()}
                                <span class="flex items-center gap-2 font-medium">
                                    <Icon.Copy size={16} class="text-(--grey)" />
                                    Recto verso
                                </span>
                            {/snippet}
                        </Checkbox>
                    </div>
                </div>
            </SettingsExpandableRow>
        </SettingsGroup>

        {#if settingsReady && $appSettings.value.documents.trackingLabelEnabled}
            <div transition:slide={{ duration: animationTime() }}>
                <SettingsGroup>
                    <SettingsRow
                        icon="Tags"
                        title="Imprimante des étiquettes"
                        description="Imprimante utilisée uniquement pour les étiquettes de suivi."
                        toneClass="bg-violet-50 text-violet-700"
                    >
                        {#snippet action()}
                            <Select
                                name="tracking-label-default-printer"
                                ariaLabel="Imprimante par défaut des étiquettes"
                                options={trackingLabelPrinterOptions}
                                value={trackingLabelPrinter}
                                onchange={(value) => trackingLabelPrinter = saveTrackingLabelPrinter(value)}
                                allowDeselect={false}
                                disabled={printersLoading || installedPrinters.length === 0}
                            />
                        {/snippet}
                    </SettingsRow>

                    <SettingsRow
                        icon="Zap"
                        title="Impression automatique des étiquettes"
                        description={`Créez et imprimez automatiquement une étiquette après chaque nouvelle ${operationSingularLower($appSettings.value.operation)}.`}
                        toneClass="bg-orange-50 text-orange-700"
                    >
                        {#snippet action()}
                            <Checkbox
                                name="tracking-label-automatic"
                                switchMode
                                value={trackingLabelAutomaticPrint}
                                on:change={(event) => trackingLabelAutomaticPrint = saveTrackingLabelAutomaticPrint(event.detail)}
                            />
                        {/snippet}
                    </SettingsRow>
                </SettingsGroup>
            </div>
        {/if}
    </SettingsSection>

    <SettingsSection label="Synchronisation">
        <SettingsRow
            icon="Wifi"
            title="État de connexion"
            description="Affiche l'état actuel du serveur et de la synchronisation."
            badges={[connectionBadge]}
            toneClass="bg-emerald-50 text-emerald-700"
        >
            {#snippet action()}
                <Button
                    variant="secondary"
                    size="sm"
                    icon={checkingConnection ? "LoaderCircle" : "RefreshCw"}
                    iconAnimation={checkingConnection ? "spin" : undefined}
                    label="Tester"
                    disabled={checkingConnection}
                    onclick={retryConnection}
                />
            {/snippet}
        
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Stockage">
        <SettingsRow
            icon="HardDrive"
            title="Cache"
            description="Supprime les fichiers temporaires de l'application."
            toneClass="bg-blue-50 text-blue-700"
        >
            {#snippet action()}
                <Button
                    variant="secondary"
                    size="sm"
                    icon={clearingCache ? "LoaderCircle" : "Trash2"}
                    iconAnimation={clearingCache ? "spin" : undefined}
                    label={clearingCache ? "Nettoyage..." : "Vider le cache"}
                    disabled={clearingCache}
                    onclick={clearCache}
                />
            {/snippet}
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Réinitialisation">
        <SettingsRow
            icon="RotateCcw"
            title="Réinitialiser les réglages locaux"
            description="Remet les paramètres locaux par défaut."
            variant="destructive"
        >
            {#snippet action()}
                <Button
                    variant="error"
                    size="sm"
                    icon="RotateCcw"
                    label="Réinitialiser"
                    confirm={true}
                    confirmTitle="Réinitialiser les réglages locaux ?"
                    confirmDescription="L'intégralité des réglages propres à ce poste seront remis par défaut."
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Réinitialiser"
                    confirmConfirmVariant="error"
                    onclick={resetLocalSettings}
                />
            {/snippet}
        </SettingsRow>
    </SettingsSection>
</SettingsPage>
