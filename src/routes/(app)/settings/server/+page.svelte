<script lang="ts">
    import { goto } from "$app/navigation";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { currentUser } from "$lib/auth";
    import {
        SettingsAccordionRow,
        SettingsExpandableRow,
        SettingsDrilldownList,
        SettingsMetadata,
        SettingsPage,
        SettingsRow,
        SettingsSection,
        SettingsTable,
        SettingsToggleRow,
        type SettingsDrilldownItem,
    } from "$lib/components/settings";
    import { Button, Checkbox, FileInput, NumberInput, Select, TextInput } from "$lib/components/istyler";
    import LogViewer from "$lib/components/LogViewer.svelte";
    import PasswordConfirmDialog from "$lib/components/PasswordConfirmDialog.svelte";
    import { backupRecoveryKeyFile, saveFile } from "$lib/backupFiles";
    import { refreshAppTitle } from "$lib/appTitle";
    import { refreshLocalPServerCaCertificate } from "$lib/desktopInstaller";
    import { isConnectedToLocalPServer, requireConnectedLocalPServer } from "$lib/localServerControl";
    import { createLocalServerController } from "$lib/localServerController.svelte.js";
    import { getConfiguredServerId, resetOnboarding } from "$lib/onboarding";
    import { bootstrapSettings, updateAppSettings, type AppSettingsValue } from "$lib/settings";
    import { strftime } from "$lib/utils";
    import {
        MAX_SERVER_BACKUP_RECOVERY_KEY_BYTES,
        MAX_SERVER_BACKUP_UPLOAD_BYTES,
        getAdminServerMetrics,
        getAdminServerStatus,
        getAdminServerConfiguration,
        updateAdminServerConfiguration,
        createAdminServerPairingCode,
        createServerBackup,
        createServerBackupRestoreUpload,
        confirmServerBackupKeyExport,
        deleteServerBackup,
        deleteServerLogFragment,
        downloadServerDatabase,
        exportServerBackupKey,
        getServerBackups,
        getServerBackupStatus,
        getServerLogFragments,
        setServerLogFragmentQuarantine,
        restoreServerBackup,
        uploadServerBackup,
        type AdminServerMetric,
        type AdminServerConfiguration,
        type ServerBackupStatus,
        type ServerBackupFile,
        type ServerBackupRestoreResult,
        type ServerLogFragment,
    } from "$lib/adminServer";
    import {
        canUseLocalServerService,
        getLocalServerServiceStatus,
        removeLocalPServer,
        runLocalServerUpdateCheck,
        runLocalServerUpdateInstall,
        type LocalServerServiceAction,
        type LocalServerUpdateCheck,
    } from "$lib/localServerService";

    const RATE_LIMIT_MIN = 30;
    const RATE_LIMIT_MAX = 2000;
    const serverControl = createLocalServerController({ connectedServerId: getConfiguredServerId });

    let checkingConnection = $state(false);
    let connectionState = $state<"checking" | "online" | "offline">("checking");
    let rateLimitEnabled = $state(true);
    let rateLimit = $state<number | null>(300);
    let savedRateLimit = $state(300);
    let savingRateLimit = $state(false);
    let metricsLoading = $state(false);
    let metricsError = $state("");
    let metrics = $state<AdminServerMetric[]>([]);
    let backendVersion: string | null = $state(null);
    let databaseEngine: "sqlite" | "postgres" = $state("sqlite");
    let serverUpdate: LocalServerUpdateCheck | null = $state(null);
    let updateChecking = $state(false);
    let updateInstalling = $state(false);
    let updateError = $state("");
    let removingServer = $state(false);
    let pairingCode = $state("");
    let pairingExpiresAt = $state(0);
    let pairingLoading = $state(false);
    let logFragmentationMode = $state<"duration" | "size">("duration");
    let logFragmentDuration = $state<"daily" | "weekly" | "monthly">("monthly");
    let logFragmentSizeMB = $state<number | null>(50);
    let savedLogFragmentationMode = $state<"duration" | "size">("duration");
    let savedLogFragmentDuration = $state<"daily" | "weekly" | "monthly">("monthly");
    let savedLogFragmentSizeMB = $state<number | null>(50);
    let logFragments = $state<ServerLogFragment[]>([]);
    let logManifestIntegrity = $state(true);
    let logArchiveError = $state("");
    let activeLogCreatedAt = $state<string | null>(null);
    let activeLogSize = $state<number | null>(null);
    let logsLoading = $state(false);
    let logsSaving = $state(false);
    let selectedLogFragment = $state<string | number | null>(null);
    let backupStatus: ServerBackupStatus | null = $state(null);
    let backupKeyExportLoading = $state(false);
    let manualBackupLoading = $state(false);
    let backupFiles = $state<ServerBackupFile[]>([]);
    let backupFilesLoading = $state(false);
    let backupDeleting = $state<string | null>(null);
    let selectedBackup = $state<string | number | null>(null);
    let restoreBackupFile: File | null = $state(null);
    let restoreRecoveryKey = $state("");
    let restoreRecoveryKeyFile: File | null = $state(null);
    let restoreLoading = $state(false);
    let databaseExportLoading = $state(false);
    let databaseExportDialogOpen = $state(false);
    let configuration = $state<AdminServerConfiguration | null>(null);
    let serverName = $state("");
    let port = $state<number | null>(null);
    let discovery = $state(false);
    let networkHosts = $state<string[]>([]);
    let networkMainAddress = $state("");
    let networkDiscovery = $state(false);
    let vpnNetworks = $state("");
    let vpnNetworksEnabled = $state(false);
    let configurationLoading = $state(true);
    let savingName = $state(false);
    let savingPort = $state(false);
    let savingNetwork = $state(false);
    let savingDiscovery = $state(false);
    let savingVPNNetworks = $state(false);

    const rateLimitDirty = $derived(rateLimit !== null && rateLimit !== savedRateLimit);
    const logFragmentationDirty = $derived(
        logFragmentationMode !== savedLogFragmentationMode
        || logFragmentDuration !== savedLogFragmentDuration
        || logFragmentSizeMB !== savedLogFragmentSizeMB,
    );
    const nameDirty = $derived(Boolean(configuration && serverName.trim() !== configuration.serverName));
    const portDirty = $derived(Boolean(configuration && port !== null && port !== configuration.port));
    const mainAddress = $derived(configuration ? new URL(configuration.publicUrl).hostname : "");
    const discoveryAddress = $derived(configuration ? new URL(configuration.discoveryUrl).hostname : "");
    const desiredBindAddress = $derived(bindAddressForPrimary(networkMainAddress, discoveryAddress));
    const networkDirty = $derived(Boolean(configuration && (
        networkMainAddress !== mainAddress
        || desiredBindAddress !== configuration.bindAddress
        || networkDiscovery !== configuration.discovery
        || hostsKey(networkHosts) !== hostsKey(configuration.allowedHosts)
    )));
    const vpnNetworksDirty = $derived(Boolean(
        configuration && vpnNetworks.trim() !== configuration.vpnNetworks.join(", "),
    ));
    const addresses = $derived(configuration
        ? [...new Set([...configuration.addresses, ...configuration.allowedHosts])]
        : []);
    const addressRows = $derived(addresses.map((address) => ({
        address,
        active: address === discoveryAddress
            ? networkDiscovery
            : networkHosts.some((host) => host.toLowerCase() === address.toLowerCase()),
        main: address === networkMainAddress,
    })));
    const activeAddressCount = $derived(addressRows.filter((address) => address.active).length);
    const displayedMetrics = $derived(buildDisplayedMetrics(metrics, backendVersion));
    const connectedToLocalServer = $derived(isConnectedToLocalPServer(serverControl.service, getConfiguredServerId()));
    const localServerName = $derived(serverControl.service?.serverName?.trim() || "PServer");
    const serverUpdateUnavailable = $derived(
        serverControl.serviceResolved && !connectedToLocalServer,
    );
    const serverUpdateAvailable = $derived(
        serverUpdate?.available === true && !updateError && !serverUpdateUnavailable,
    );
    const serverUpdateTitle = $derived(
        serverUpdateUnavailable
            ? "Version de PServer"
            : serverUpdateAvailable
                ? "Mise à jour disponible"
                : serverUpdate && !updateError
                    ? "PServer est à jour"
                    : "Version de PServer",
    );
    const serverUpdateDescription = $derived(
        serverUpdateUnavailable
            ? "Impossible de vérifier les mises à jour."
            : updateError || serverUpdate?.detail || "Mettre à jour PServer.",
    );
    const serverUpdateToneClass = $derived(
        serverUpdateAvailable
            ? "bg-emerald-50 text-emerald-700"
            : serverUpdateUnavailable || updateError
                ? "bg-red-50 text-red-700"
                : "bg-blue-50 text-blue-700",
    );
    const logFragmentItems = $derived(logFragments.map((fragment): SettingsDrilldownItem => ({
        id: fragment.name,
        title: fragment.name,
        description: fragment.deletedAt
            ? `Supprimé le ${formatDate(fragment.deletedAt)}`
            : fragment.quarantinedAt
                ? "En quarantaine, conservation suspendue"
                : `Suppression dans ${fragment.daysUntilDeletion} jour${fragment.daysUntilDeletion === 1 ? "" : "s"}`,
        icon: fragment.integrity ? (fragment.quarantinedAt ? "ShieldAlert" : "FileClock") : "FileWarning",
        color: fragment.integrity ? (fragment.quarantinedAt ? "--page-icon-orange" : "--page-icon-blue") : "--page-icon-red",
    })));
    const backupFileItems = $derived(backupFiles.map((backup): SettingsDrilldownItem => ({
        id: backup.filename,
        title: backup.filename,
        description: `${formatSize(backup.size)} · ${formatDate(backup.modifiedAt)}`,
        icon: backup.integrity === false ? "FileWarning" : "DatabaseBackup",
        color: backup.integrity === false ? "--page-icon-red" : "--page-icon-blue",
    })));

    function applyConfiguration(next: AdminServerConfiguration) {
        const configuredVPNNetworks = Array.isArray(next.vpnNetworks) ? next.vpnNetworks : [];
        configuration = { ...next, vpnNetworks: configuredVPNNetworks };
        serverName = next.serverName;
        port = next.port;
        discovery = next.discovery;
        networkHosts = [...next.allowedHosts];
        networkMainAddress = new URL(next.publicUrl).hostname;
        networkDiscovery = next.discovery;
        vpnNetworks = configuredVPNNetworks.join(", ");
        vpnNetworksEnabled = configuredVPNNetworks.length > 0;
    }

    function hostsKey(hosts: string[]) {
        return hosts.map((host) => host.toLowerCase()).sort().join("\n");
    }

    function publicUrl(address: string, serverPort: number) {
        const host = address.includes(":") ? `[${address}]` : address;
        return `https://${host}${serverPort === 443 ? "" : `:${serverPort}`}`;
    }

    function bindAddressForPrimary(address: string, mdnsAddress: string) {
        if (address.toLowerCase() === "localhost") return "127.0.0.1";
        if (address.toLowerCase() === mdnsAddress.toLowerCase()) return "0.0.0.0";
        return address;
    }

    function parseVPNNetworks() {
        const networks = [...new Set(vpnNetworks.split(/[,\n]+/).map((value) => value.trim()).filter(Boolean))];
        for (const network of networks) {
            const match = network.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d|[12]\d|3[0-2])$/);
            if (!match) throw new Error(`Le réseau VPN « ${network} » doit être un CIDR IPv4, par exemple 10.8.0.0/24.`);
            const octets = match.slice(1, 5).map(Number);
            const prefix = Number(match[5]);
            if (octets.some((octet) => octet > 255) || prefix === 0) {
                throw new Error(`Le réseau VPN « ${network} » est invalide.`);
            }
            const address = octets.reduce((value, octet) => ((value << 8) | octet) >>> 0, 0);
            const hostMask = prefix === 32 ? 0 : (2 ** (32 - prefix)) - 1;
            if ((address & hostMask) !== 0) {
                throw new Error(`Utilisez l'adresse du réseau VPN, pas une adresse d'appareil : ${network}.`);
            }
        }
        return networks;
    }

    async function refreshLocalCertificate() {
        if (!canUseLocalServerService()) return;
        const service = await getLocalServerServiceStatus().catch(() => null);
        if (!isConnectedToLocalPServer(service, getConfiguredServerId())) return;
        try {
            await refreshLocalPServerCaCertificate(requireConnectedLocalPServer(service, getConfiguredServerId()));
        } catch (error) {
            console.error("Failed to refresh the local PServer CA", error);
            toast.error("Le certificat Windows du PServer local n'a pas pu être actualisé.");
        }
    }

    async function loadConfiguration() {
        configurationLoading = true;
        try {
            applyConfiguration(await getAdminServerConfiguration());
            await refreshLocalCertificate();
        } catch (error) {
            console.error("Failed to load PServer configuration", error);
            toast.error("Impossible de charger la configuration réseau de PServer.");
        } finally {
            configurationLoading = false;
        }
    }

    async function saveConfiguration(
        next: Omit<AdminServerConfiguration, "addresses" | "discoveryUrl" | "restartRequired">,
        message: string,
        requireVPNNetworks = false,
    ) {
        const saved = await updateAdminServerConfiguration(next);
        if (requireVPNNetworks && !Array.isArray(saved.vpnNetworks)) {
            throw new Error("Cette version de PServer ne prend pas encore en charge les réseaux VPN. Mettez PServer à jour.");
        }
        applyConfiguration(saved);
        await refreshLocalCertificate();
        toast.success(`${message} Redémarrez PServer pour l'appliquer.`);
    }

    async function saveServerName() {
        const current = configuration;
        if (!current || !nameDirty) return;
        const name = serverName.trim();
        if (!name) {
            toast.error("Le nom du serveur est obligatoire.");
            return;
        }
        savingName = true;
        try {
            await saveConfiguration({ ...current, serverName: name }, "Nom du serveur enregistré.");
            await refreshAppTitle({ serverName: name });
        } catch (error) {
            console.error("Failed to update PServer name", error);
            serverName = current.serverName;
            toast.error("Impossible d'enregistrer le nom du serveur.");
        } finally {
            savingName = false;
        }
    }

    async function savePort() {
        const current = configuration;
        if (!current || !portDirty || port === null) return;
        savingPort = true;
        try {
            await saveConfiguration({
                ...current,
                port,
                publicUrl: publicUrl(mainAddress, port),
            }, "Port HTTPS enregistré.");
        } catch (error) {
            console.error("Failed to update PServer port", error);
            port = current.port;
            toast.error("Le port HTTPS doit être compris entre 1024 et 49151.");
        } finally {
            savingPort = false;
        }
    }

    function setAddressActive(address: string, active: boolean) {
        if (!configuration || savingNetwork || address === networkMainAddress) return;
        if (address === discoveryAddress) {
            networkDiscovery = active;
            return;
        }
        networkHosts = active
            ? [...networkHosts, address]
            : networkHosts.filter((host) => host.toLowerCase() !== address.toLowerCase());
    }

    function setMainAddress(address: string) {
        if (!configuration || savingNetwork || address === networkMainAddress) return;
        networkMainAddress = address;
        if (address === discoveryAddress) {
            networkDiscovery = true;
        } else if (!networkHosts.some((host) => host.toLowerCase() === address.toLowerCase())) {
            networkHosts = [...networkHosts, address];
        }
    }

    async function saveNetwork(event: MouseEvent) {
        event.stopPropagation();
        const current = configuration;
        if (!current || !networkDirty) return;
        savingNetwork = true;
        try {
            await saveConfiguration({
                ...current,
                allowedHosts: networkHosts,
                publicUrl: publicUrl(networkMainAddress, current.port),
                discovery: networkDiscovery,
            }, "Adresses réseau enregistrées.");
        } catch (error) {
            console.error("Failed to update PServer addresses", error);
            applyConfiguration(current);
            toast.error("Impossible d'enregistrer les adresses réseau.");
        } finally {
            savingNetwork = false;
        }
    }

    async function saveDiscovery(next: boolean) {
        const current = configuration;
        if (!current || savingDiscovery) return;
        discovery = next;
        savingDiscovery = true;
        try {
            await saveConfiguration({ ...current, discovery: next }, "Découverte réseau enregistrée.");
        } catch (error) {
            console.error("Failed to update PServer discovery", error);
            discovery = current.discovery;
            toast.error("Impossible de modifier la découverte réseau.");
        } finally {
            savingDiscovery = false;
        }
    }

    async function saveVPNNetworks(networks?: string[]) {
        const current = configuration;
        if (!current) return;
        let next: string[] | undefined;
        savingVPNNetworks = true;
        try {
            next = networks ?? parseVPNNetworks();
            await saveConfiguration({ ...current, vpnNetworks: next }, "Réseaux VPN enregistrés.", true);
        } catch (error) {
            console.error("Failed to update VPN networks", error);
            if (next?.length) {
                vpnNetworks = next.join(", ");
                vpnNetworksEnabled = true;
            } else if (next) {
                vpnNetworks = current.vpnNetworks.join(", ");
                vpnNetworksEnabled = current.vpnNetworks.length > 0;
            }
            toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer les réseaux VPN.");
        } finally {
            savingVPNNetworks = false;
        }
    }

    async function toggleVPNNetworks(enabled: boolean) {
        vpnNetworksEnabled = enabled;
        if (!enabled && configuration?.vpnNetworks.length) {
            await saveVPNNetworks([]);
        }
    }

    function applyServerSettings(settings: Awaited<ReturnType<typeof bootstrapSettings>>) {
        rateLimitEnabled = settings.value.server.rateLimitEnabled;
        rateLimit = settings.value.server.rateLimitRequestsPerMinute;
        savedRateLimit = settings.value.server.rateLimitRequestsPerMinute;
        logFragmentationMode = settings.value.server.logFragmentationMode;
        logFragmentDuration = settings.value.server.logFragmentDuration;
        logFragmentSizeMB = settings.value.server.logFragmentSizeMB;
        savedLogFragmentationMode = settings.value.server.logFragmentationMode;
        savedLogFragmentDuration = settings.value.server.logFragmentDuration;
        savedLogFragmentSizeMB = settings.value.server.logFragmentSizeMB;
    }

    function formatDate(value: string | null) {
        if (!value) return "Non disponible";
        const date = new Date(value);
        return Number.isNaN(date.getTime())
            ? "Non disponible"
            : strftime(date, "%d %_b %Y à %H:%M", "fr-FR");
    }

    function formatSize(value: number) {
        if (value < 1024) return `${value} o`;
        if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} Ko`;
        if (value < 1024 ** 3) return `${(value / 1024 ** 2).toFixed(1)} Mo`;
        return `${(value / 1024 ** 3).toFixed(1)} Go`;
    }

    function nextLogFragmentDate() {
        const created = new Date(activeLogCreatedAt ?? Date.now());
        const year = created.getFullYear();
        const month = created.getMonth();
        const day = created.getDate();
        if (logFragmentDuration === "daily") return new Date(year, month, day + 1);
        if (logFragmentDuration === "weekly") {
            const days = (8 - created.getDay()) % 7 || 7;
            return new Date(year, month, day + days);
        }
        return new Date(year, month + 1, 1);
    }

    function activeLogSizeLabel() {
        if (activeLogSize !== null) return formatSize(activeLogSize);
        const metric = metrics.find((item) => item.label === "Taille logs serveur")?.value;
        return typeof metric === "string" || typeof metric === "number" ? String(metric) : "Non disponible";
    }

    function selectedFragment(item: SettingsDrilldownItem) {
        return logFragments.find((fragment) => fragment.name === item.id);
    }

    function selectedBackupFile(item: SettingsDrilldownItem) {
        return backupFiles.find((backup) => backup.filename === item.id);
    }

    async function saveServerOptions(patch: Partial<AppSettingsValue["server"]>, message: string) {
        try {
            applyServerSettings(await updateAppSettings({ server: patch }));
            toast.success(message);
            return true;
        } catch (error) {
            console.error("Failed to update server options", error);
            toast.error("Impossible d'enregistrer les paramètres serveur.");
            await loadServerSettings();
            return false;
        }
    }

    async function saveLogOptions() {
        logsSaving = true;
        const size = Math.min(500, Math.max(1, Math.round(logFragmentSizeMB ?? 50)));
        logFragmentSizeMB = size;
        const saved = await saveServerOptions(
            { logFragmentationMode, logFragmentDuration, logFragmentSizeMB: size },
            "Fragmentation enregistrée.",
        );
        if (saved && $currentUser?.administrator) {
            await refreshLogFragments();
        }
        logsSaving = false;
    }

    async function refreshLogFragments() {
        logsLoading = true;
        try {
            const response = await getServerLogFragments();
            logFragments = response.results;
            logManifestIntegrity = response.manifestIntegrity;
            logArchiveError = response.archiveError ?? "";
            activeLogCreatedAt = typeof response.activeCreatedAt === "string" ? response.activeCreatedAt : null;
            activeLogSize = Number.isFinite(response.activeSize) ? response.activeSize : null;
        } catch (error) {
            console.error("Failed to load log fragments", error);
            toast.error("Impossible de charger les archives de journaux.");
        } finally {
            logsLoading = false;
        }
    }

    async function toggleLogQuarantine(fragment: ServerLogFragment) {
        try {
            await setServerLogFragmentQuarantine(fragment.name, !fragment.quarantinedAt);
            await refreshLogFragments();
            toast.success(fragment.quarantinedAt ? "Fragment retiré de la quarantaine." : "Fragment placé en quarantaine.");
        } catch (error) {
            console.error("Failed to update log quarantine", error);
            toast.error("Impossible de modifier la quarantaine.");
        }
    }

    async function removeLogFragment(fragment: ServerLogFragment) {
        try {
            await deleteServerLogFragment(fragment.name);
            selectedLogFragment = null;
            await refreshLogFragments();
            toast.success("Fragment supprimé. La trace de suppression est conservée.");
        } catch (error) {
            console.error("Failed to delete log fragment", error);
            toast.error("Impossible de supprimer le fragment.");
        }
    }

    async function refreshBackupStatus() {
        try {
            backupStatus = await getServerBackupStatus();
            if (backupStatus.engine === "sqlite" || backupStatus.engine === "postgres") {
                databaseEngine = backupStatus.engine;
            }
        } catch (error) {
            console.error("Failed to load backup status", error);
            backupStatus = null;
        }
    }

    async function downloadBackupKey() {
        backupKeyExportLoading = true;
        try {
            const exported = await exportServerBackupKey();
            const saved = await saveFile(
                backupRecoveryKeyFile(exported.key),
                exported.filename,
                "Clé de récupération PSoft",
                ".txt",
            );
            if (!saved) return;
            await confirmServerBackupKeyExport();
            await refreshBackupStatus();
            toast.success("Clé de récupération exportée.");
        } catch (error) {
            console.error("Failed to export backup key", error);
            toast.error("Impossible d'exporter la clé de récupération.");
        } finally {
            backupKeyExportLoading = false;
        }
    }

    async function runManualBackup() {
        manualBackupLoading = true;
        try {
            const result = await createServerBackup();
            await Promise.all([refreshBackupStatus(), refreshBackupFiles()]);
            toast.success(`Sauvegarde créée et vérifiée : ${result.filename}`);
        } catch (error) {
            console.error("Manual backup failed", error);
            await refreshBackupStatus();
            const detail = typeof error === "object" && error !== null && "data" in error
                ? (error as { data?: { detail?: unknown } }).data?.detail
                : null;
            toast.error(typeof detail === "string" ? detail : String(error || "La sauvegarde a échoué."));
        } finally {
            manualBackupLoading = false;
        }
    }

    async function refreshBackupFiles() {
        backupFilesLoading = true;
        try {
            backupFiles = (await getServerBackups()).results;
        } catch (error) {
            console.error("Failed to load server backups", error);
            toast.error("Impossible de charger les sauvegardes locales.");
        } finally {
            backupFilesLoading = false;
        }
    }

    async function removeBackup(backup: ServerBackupFile) {
        backupDeleting = backup.filename;
        try {
            await deleteServerBackup(backup.filename);
            selectedBackup = null;
            await Promise.all([refreshBackupFiles(), refreshBackupStatus()]);
            toast.success("Sauvegarde supprimée.");
        } catch (error) {
            console.error("Failed to delete server backup", error);
            toast.error("Impossible de supprimer la sauvegarde.");
        } finally {
            backupDeleting = null;
        }
    }

    async function completeRestore(result: ServerBackupRestoreResult) {
        restoreBackupFile = null;
        restoreRecoveryKey = "";
        restoreRecoveryKeyFile = null;
        await refreshBackupFiles();
        toast.success(`${result.filename} est vérifiée et prête à être restaurée.`);
        if (result.restartRequired && connectedToLocalServer) {
            const restarted = await serverControl.controlServer("restart");
            if (restarted) {
                toast.success("Restauration lancée. PServer redémarre.");
            } else {
                toast.warning("Sauvegarde prête. Redémarrez PServer manuellement pour terminer la restauration.");
            }
        } else if (result.restartRequired) {
            toast.info("Redémarrez PServer sur la machine serveur pour appliquer la restauration.");
        }
    }

    function restoreErrorMessage(error: unknown) {
        const detail = typeof error === "object" && error !== null && "data" in error
            ? (error as { data?: { detail?: unknown } }).data?.detail
            : null;
        return typeof detail === "string"
            ? detail
            : "La sauvegarde n'a pas été restaurée. La base actuelle reste inchangée.";
    }

    async function restoreBackup(input: { filename: string }) {
        restoreLoading = true;
        try {
            const recoveryKey = restoreRecoveryKey.trim();
            await completeRestore(await restoreServerBackup({ ...input, ...(recoveryKey ? { recoveryKey } : {}) }));
        } catch (error) {
            console.error("Backup restore failed", error);
            toast.error(restoreErrorMessage(error));
        } finally {
            restoreLoading = false;
        }
    }

    async function restoreUploadedBackup() {
        if (!restoreBackupFile) return;
        restoreLoading = true;
        try {
            const upload = await createServerBackupRestoreUpload();
            if (restoreBackupFile.size > upload.maxSize) {
                toast.error(`La sauvegarde dépasse la taille maximale de ${formatSize(upload.maxSize)}.`);
                return;
            }
            await completeRestore(await uploadServerBackup(restoreBackupFile, restoreRecoveryKey.trim(), upload.token));
        } catch (error) {
            console.error("Backup upload restore failed", error);
            toast.error(restoreErrorMessage(error));
        } finally {
            restoreLoading = false;
        }
    }

    async function selectRestoreRecoveryKey(file: File | null) {
        restoreRecoveryKeyFile = file;
        restoreRecoveryKey = "";
        if (!file) return;
        const key = (await file.text()).split(/\r?\n/).map((line) => line.trim()).find((line) => /^[A-Za-z0-9+/]{43}=$/.test(line));
        if (!key) {
            restoreRecoveryKeyFile = null;
            toast.error("Le fichier ne contient pas une clé de récupération PSoft valide.");
            return;
        }
        restoreRecoveryKey = key;
    }

    function selectRestoreBackup(file: File | null) {
        restoreBackupFile = file;
        if (file && !file.name.toLowerCase().endsWith(".psoft-backup")) {
            restoreBackupFile = null;
            toast.error("Sélectionnez une sauvegarde PSoft valide.");
        }
    }

    function openRestoreFilePicker(event: MouseEvent | KeyboardEvent) {
        if (event.target instanceof HTMLInputElement) return;
        if (event instanceof KeyboardEvent && event.key !== "Enter" && event.key !== " ") return;

        const currentTarget = event.currentTarget;
        if (!(currentTarget instanceof HTMLElement)) return;

        const input = currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
        if (!input || input.disabled) return;

        event.preventDefault();
        event.stopPropagation();
        input.click();
    }

    async function exportDatabase(currentPassword: string) {
        databaseExportLoading = true;
        try {
            const data = await downloadServerDatabase(currentPassword);
            const extension = databaseEngine === "postgres" ? ".dump" : ".sqlite3";
            const filename = `psoft-data-${new Date().toISOString().replaceAll(":", "-")}${extension}`;
            const saved = await saveFile(data, filename, "Base de données PSoft", extension);
            databaseExportDialogOpen = false;
            if (!saved) return;
            toast.success(`Base de données exportée : ${filename}`);
        } catch (error) {
            console.error("Database export failed", error);
            const response = JSON.stringify(
                error && typeof error === "object" && "data" in error ? error.data : "",
            );
            toast.error(
                response.includes("current_password")
                    ? "Mot de passe incorrect."
                    : "L'export de la base de données a échoué.",
            );
        } finally {
            databaseExportLoading = false;
        }
    }

    function normalizedRateLimit() {
        return Math.min(RATE_LIMIT_MAX, Math.max(RATE_LIMIT_MIN, Math.round(rateLimit ?? savedRateLimit)));
    }

    async function saveRateLimitEnabled(enabled: boolean) {
        const previousValue = rateLimitEnabled;
        rateLimitEnabled = enabled;
        savingRateLimit = true;

        try {
            const settings = await updateAppSettings({ server: { rateLimitEnabled: enabled } });
            applyServerSettings(settings);
            toast.success(enabled ? "Rate limit activé." : "Rate limit désactivé.");
        } catch (error) {
            console.error("Failed to update rate limit status", error);
            rateLimitEnabled = previousValue;
            toast.error("Impossible d'enregistrer le rate limit.");
        } finally {
            savingRateLimit = false;
        }
    }

    async function saveRateLimitValue() {
        const nextValue = normalizedRateLimit();
        rateLimit = nextValue;
        savingRateLimit = true;

        try {
            const settings = await updateAppSettings({ server: { rateLimitRequestsPerMinute: nextValue } });
            applyServerSettings(settings);
            toast.success("Limite enregistrée.");
        } catch (error) {
            console.error("Failed to update rate limit value", error);
            rateLimit = savedRateLimit;
            toast.error("Impossible d'enregistrer la limite.");
        } finally {
            savingRateLimit = false;
        }
    }

    async function refreshMetrics() {
        metricsLoading = true;
        metricsError = "";

        try {
            metrics = (await getAdminServerMetrics()).metrics;
        } catch (error) {
            console.error("Failed to load server metrics", error);
            metricsError = "Métriques indisponibles.";
        } finally {
            metricsLoading = false;
        }
    }

    async function refreshAdminServerStatus() {
        try {
            const status = await getAdminServerStatus();
            backendVersion = status.version.backendVersion;
            databaseEngine = status.database;
        } catch (error) {
            console.error("Failed to load admin server status", error);
            backendVersion = null;
        }
    }

    async function refreshMonitoring() {
        await Promise.all([refreshMetrics(), refreshAdminServerStatus()]);
    }

    async function loadServerSettings() {
        try {
            applyServerSettings(await bootstrapSettings(true));
        } catch (error) {
            console.error("Failed to load server settings", error);
            toast.error("Impossible de charger les paramètres serveur.");
        }
    }

    function buildDisplayedMetrics(metrics: AdminServerMetric[], version: string | null) {
        if (!version) return metrics;
        return [
            { label: "Version PServer", value: version },
            ...metrics.filter((metric) => metric.label !== "Version PServer"),
        ];
    }

    async function createPairingCode() {
        pairingLoading = true;
        try {
            const result = await createAdminServerPairingCode();
            pairingCode = result.code;
            pairingExpiresAt = result.expiresAt;
        } catch (error) {
            console.error("Failed to create server pairing code", error);
            toast.error("Impossible de générer le code d'association.");
        } finally {
            pairingLoading = false;
        }
    }

    async function copyPairingCode() {
        try {
            await navigator.clipboard.writeText(pairingCode);
            toast.success("Code copié.");
        } catch {
            toast.error("Impossible de copier le code.");
        }
    }

    async function handleServerAction(action: Extract<LocalServerServiceAction, "restart" | "stop">) {
        const service = await serverControl.controlServer(action);
        if (!service) {
            if (serverControl.serviceError) toast.error(serverControl.serviceError);
            return;
        }

        toast.success(action === "restart" ? "PServer a redémarré." : "PServer est arrêté.");
        if (action === "restart") return;

        await goto("/server-debug", {
            replaceState: true,
            state: { transitionDirection: "forward" },
        });
    }

    async function checkServerUpdate() {
        updateChecking = true;
        updateError = "";
        try {
            serverUpdate = await runLocalServerUpdateCheck(getConfiguredServerId());
            if (serverUpdate.available) toast.info(serverUpdate.detail);
            else toast.success(serverUpdate.detail);
        } catch (error) {
            console.error("Failed to check local PServer update", error);
            serverUpdate = null;
            updateError = error instanceof Error ? error.message : String(error);
            toast.error(updateError);
        } finally {
            updateChecking = false;
        }
    }

    async function installServerUpdate() {
        if (!serverUpdate?.available) return;

        updateInstalling = true;
        updateError = "";
        try {
            const result = await runLocalServerUpdateInstall({
                freshInstall: false,
                connectedServerId: getConfiguredServerId(),
            });
            toast.success(result.detail);
            serverUpdate = null;
            await Promise.all([serverControl.refreshService(), refreshMonitoring()]);
        } catch (error) {
            console.error("Failed to install local PServer update", error);
            updateError = error instanceof Error ? error.message : String(error);
            toast.error(updateError);
        } finally {
            updateInstalling = false;
        }
    }

    async function uninstallPServer() {
        removingServer = true;
        try {
            const message = await removeLocalPServer();
            resetOnboarding();
            toast.success(message);
            await goto("/onboarding", {
                replaceState: true,
                state: { transitionDirection: "forward" },
            });
        } catch (error) {
            console.error("Failed to uninstall local PServer", error);
            toast.error(error instanceof Error ? error.message : "Impossible de désinstaller PServer.");
        } finally {
            removingServer = false;
        }
    }

    onMount(() => {
        void loadServerSettings();
        void loadConfiguration();
        void serverControl.refreshService();
        void refreshMonitoring();
        void refreshBackupStatus();
        if ($currentUser?.administrator) {
            void refreshLogFragments();
            void refreshBackupFiles();
        }
    });
</script>

<SettingsPage
    title="Serveur"
    description="Surveillez la connexion, les journaux, les sauvegardes et la sécurité du serveur."
>
    {#snippet children()}

    <SettingsSection label="Monitoring et contrôle local">
        {#if connectedToLocalServer}
            <SettingsRow
                icon="ServerCog"
                title={localServerName}
                description="Permet de contrôler l'état du serveur."
                toneClass="bg-orange-50 text-orange-700"
            >
                {#snippet action()}
                    <div class="flex flex-col gap-2 md:flex-row">
                        <Button
                            variant="warning"
                            size="sm"
                            icon={serverControl.serviceAction === "restart" ? "LoaderCircle" : "RotateCw"}
                            iconAnimation={serverControl.serviceAction === "restart" ? "spin" : undefined}
                            label="Redémarrer"
                            disabled={serverControl.serviceChecking || serverControl.busy}
                            confirm
                            confirmTitle="Redémarrer le serveur ?"
                            confirmDescription="Le serveur peut être indisponible pendant quelques secondes. Windows demandera une autorisation administrateur si nécessaire."
                            confirmCancelLabel="Annuler"
                            confirmConfirmLabel="Redémarrer"
                            confirmConfirmVariant="warning"
                            onclick={() => handleServerAction("restart")}
                            class="w-fit"
                        />
                        <Button
                            variant="error"
                            size="sm"
                            icon={serverControl.serviceAction === "stop" ? "LoaderCircle" : "PowerOff"}
                            iconAnimation={serverControl.serviceAction === "stop" ? "spin" : undefined}
                            label="Arrêter"
                            disabled={serverControl.serviceChecking || serverControl.busy}
                            confirm
                            confirmTitle="Arrêter le serveur ?"
                            confirmDescription="L'application deviendra indisponible jusqu'au prochain démarrage manuel du service."
                            confirmCancelLabel="Annuler"
                            confirmConfirmLabel="Arrêter"
                            confirmConfirmVariant="error"
                            onclick={() => handleServerAction("stop")}
                            class="w-fit"
                        />
                    </div>
                {/snippet}
            </SettingsRow>
        {/if}

        <SettingsAccordionRow
            icon="ChartNoAxesCombined"
            title="Métriques serveur"
            description="Affiche les indicateurs essentiels du serveur."
            toneClass="bg-violet-50 text-violet-700"
            open
        >
            {#snippet action()}
                <Button
                    variant="secondary"
                    size="sm"
                    icon={metricsLoading ? "LoaderCircle" : "RefreshCw"}
                    iconAnimation={metricsLoading ? "spin" : undefined}
                    label="Actualiser"
                    disabled={metricsLoading}
                            onclick={(event: MouseEvent) => {
                                event.stopPropagation();
                                void refreshMonitoring();
                            }}
                />
            {/snippet}

            {#snippet table()}
                <SettingsTable
                    showHeader={false}
                    columns={[
                        { key: "label", label: "Indicateur" },
                        { key: "value", label: "Valeur", align: "right" },
                    ]}
                    rows={displayedMetrics}
                    emptyText={metricsError || "Aucune métrique disponible"}
                />
            {/snippet}
        </SettingsAccordionRow>

        {#if connectedToLocalServer}
            <SettingsRow
                icon={serverUpdateUnavailable ? "ServerOff" : "Info"}
                title={serverUpdateTitle}
                description={serverUpdateDescription}
                toneClass={serverUpdateToneClass}
            >
                {#snippet action()}
                    {#if serverUpdateAvailable}
                        <Button
                            variant="primary"
                            size="sm"
                            icon={updateInstalling ? "Loader" : "Download"}
                            iconAnimation={updateInstalling ? "spin" : undefined}
                            label="Installer"
                            disabled={updateChecking || updateInstalling}
                            confirm
                            confirmTitle="Installer la mise à jour PServer ?"
                            confirmDescription="Une sauvegarde chiffrée temporaire sera créée, puis supprimée après validation du redémarrage."
                            confirmCancelLabel="Annuler"
                            confirmConfirmLabel="Installer"
                            confirmConfirmVariant="primary"
                            onclick={installServerUpdate}
                            class="w-fit"
                        />
                    {:else}
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={updateChecking || updateInstalling ? "Loader" : "RefreshCw"}
                            iconAnimation={updateChecking || updateInstalling ? "spin" : undefined}
                            label={updateInstalling ? "Installation…" : updateChecking ? "Vérification…" : "Vérifier"}
                            disabled={serverUpdateUnavailable || updateChecking || updateInstalling}
                            onclick={() => void checkServerUpdate()}
                            class="w-fit"
                        />
                    {/if}
                {/snippet}
            </SettingsRow>
        {/if}
    </SettingsSection>

    <SettingsSection label="Configuration">
        <SettingsRow
            icon="Server"
            title="Nom du serveur"
            description="Nom utilisé pour reconnaître ce serveur."
            toneClass="bg-blue-50 text-blue-700"
        >
            <TextInput
                name="pserver-name"
                label="Nom"
                maxlength="100"
                bind:value={serverName}
                disabled={configurationLoading || savingName}
            >
                {#snippet suffix()}
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={savingName ? "Loader" : "Save"}
                        iconAnimation={savingName ? "spin" : undefined}
                        label={nameDirty ? "Enregistrer" : "Enregistré"}
                        disabled={configurationLoading || savingName || !nameDirty}
                        onclick={saveServerName}
                        class="w-fit rounded-none bg-(--dark-bg1) text-(--light-bg1) hover:bg-(--user-color)
                            disabled:cursor-not-allowed disabled:bg-(--light-bg1) disabled:text-(--light-grey)"
                    />
                {/snippet}
            </TextInput>
        </SettingsRow>

        <SettingsAccordionRow
            icon="Network"
            title="Adresses réseau"
            description="Choisir les adresses acceptées par PServer et l'adresse principale."
            toneClass="bg-violet-50 text-violet-700"
            defaultOpen={true}
            bodyPadding={false}
            badges={configuration ? [{ text: `${activeAddressCount} active${activeAddressCount > 1 ? "s" : ""}` }] : []}
        >
            {#snippet action()}
                {#if networkDirty}
                    <Button
                        size="sm"
                        icon={savingNetwork ? "LoaderCircle" : "Save"}
                        iconAnimation={savingNetwork ? "spin" : undefined}
                        label="Enregistrer"
                        disabled={configurationLoading || savingNetwork}
                        onclick={saveNetwork}
                        class="w-fit"
                    />
                {/if}
            {/snippet}

            <SettingsRow
                title="Port HTTPS"
                description="Port commun à toutes les adresses. Le changement nécessite un redémarrage."
                inline={true}
            >
                {#snippet action()}
                    <div class="w-64">
                        <NumberInput
                            name="pserver-port"
                            label="Port"
                            min={1024}
                            max={49151}
                            showControls={false}
                            bind:value={port}
                            disabled={configurationLoading || savingPort}
                        >
                            {#snippet suffix()}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    icon={savingPort ? "Loader" : "Save"}
                                    iconAnimation={savingPort ? "spin" : undefined}
                                    label={portDirty ? "Enregistrer" : "Enregistré"}
                                    disabled={configurationLoading || savingPort || !portDirty}
                                    onclick={savePort}
                                    class="w-fit rounded-none bg-(--dark-bg1) text-(--light-bg1) hover:bg-(--user-color)
                                        disabled:cursor-not-allowed disabled:bg-(--light-bg1) disabled:text-(--light-grey)"
                                />
                            {/snippet}
                        </NumberInput>
                    </div>
                {/snippet}
            </SettingsRow>

            {#snippet table()}
                <SettingsTable
                    columns={[
                        { key: "main", label: "Principale", align: "left", class: "w-20" },
                        { key: "address", label: "Adresse" },
                        { key: "active", label: "Active", align: "center", class: "w-24" },
                    ]}
                    rows={addressRows}
                    emptyText={configurationLoading ? "Chargement..." : "Aucune adresse détectée"}
                >
                    {#snippet cell(value, row, column)}
                        {#if column.key === "main"}
                            <Button
                                variant="ghost"
                                size="sm"
                                icon="Star"
                                tooltip={row.main ? "Adresse principale" : "Définir comme adresse principale"}
                                aria-label={row.main ? "Adresse principale" : `Définir ${row.address} comme adresse principale`}
                                disabled={configurationLoading || savingNetwork || row.main}
                                confirm={row.address === discoveryAddress}
                                confirmTitle="Utiliser l’adresse mDNS comme adresse principale ?"
                                confirmDescription="PServer écoutera sur toutes les interfaces réseau (0.0.0.0) après son redémarrage."
                                confirmCancelLabel="Annuler"
                                confirmConfirmLabel="Définir comme principale"
                                onclick={() => setMainAddress(row.address)}
                                class="size-8 p-0 {row.main ? 'text-(--user-color) [&_svg]:fill-current' : 'text-(--light-grey) hover:text-(--dark-bg1)'}"
                            />
                        {:else if column.key === "address"}
                            <span class="font-mono">{String(value ?? "")}</span>
                        {:else}
                            <div class="flex justify-center">
                                <Checkbox
                                    name={`pserver-address-${row.address}`}
                                    switchMode={true}
                                    value={row.active}
                                    disabled={configurationLoading || savingNetwork || savingDiscovery || row.main}
                                    on:change={(event) => setAddressActive(row.address, event.detail)}
                                />
                            </div>
                        {/if}
                    {/snippet}
                </SettingsTable>
            {/snippet}
        </SettingsAccordionRow>

        <SettingsExpandableRow
            icon="ShieldCheck"
            title="Réseaux VPN autorisés"
            description="Autorise les appareils provenant des réseaux VPN indiqués."
            name="pserver-vpn-networks"
            toneClass="bg-cyan-50 text-cyan-700"
            bind:value={vpnNetworksEnabled}
            onChange={toggleVPNNetworks}
        >
            <TextInput
                name="pserver-vpn-cidr"
                label="CIDR"
                placeholder="10.8.0.0/24"
                helpText="Séparez plusieurs réseaux par une virgule."
                helpTextIcon
                bind:value={vpnNetworks}
                disabled={configurationLoading || savingVPNNetworks}
            >
                {#snippet suffix()}
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={savingVPNNetworks ? "Loader" : "Save"}
                        iconAnimation={savingVPNNetworks ? "spin" : undefined}
                        label={vpnNetworksDirty ? "Enregistrer" : "Enregistré"}
                        disabled={configurationLoading || savingVPNNetworks || !vpnNetworksDirty || !vpnNetworks.trim()}
                        onclick={() => void saveVPNNetworks()}
                        class="w-fit rounded-none bg-(--dark-bg1) text-(--light-bg1) hover:bg-(--user-color)
                            disabled:cursor-not-allowed disabled:bg-(--light-bg1) disabled:text-(--light-grey)"
                    />
                {/snippet}
            </TextInput>
        </SettingsExpandableRow>

        <SettingsToggleRow
            icon="Radar"
            title="Découverte réseau"
            description="Annonce automatiquement PServer aux appareils présents sur le réseau local."
            name="pserver-discovery"
            toneClass="bg-emerald-50 text-emerald-700"
            bind:value={discovery}
            disabled={configurationLoading || savingDiscovery}
            onChange={saveDiscovery}
        />
    </SettingsSection>

    {@render serverSecurity()}

    <SettingsSection label="Journaux">
        <SettingsRow
            icon="Activity"
            title="Journal d'activité"
            description="Consultez l'historique détaillé des requêtes et réponses."
            toneClass="bg-blue-50 text-blue-700"
        >
            {#snippet action()}
                <LogViewer
                    title="Journal d'activité"
                    description="Requêtes, erreurs et événements récents du serveur."
                    triggerLabel="Ouvrir"
                />
            {/snippet}
        </SettingsRow>
        <SettingsAccordionRow
            icon="Split"
            title="Fragmentation"
            description="Choisissez quand le journal courant devient une archive."
            toneClass="bg-violet-50 text-violet-700"
        >
            {#snippet action()}
                {#if logFragmentationDirty}
                    <Button
                        size="sm"
                        icon={logsSaving ? "LoaderCircle" : "Save"}
                        iconAnimation={logsSaving ? "spin" : undefined}
                        label="Enregistrer"
                        disabled={logsSaving}
                        onclick={(event: MouseEvent) => {
                            event.stopPropagation();
                            void saveLogOptions();
                        }}
                        class="w-fit"
                    />
                {/if}
            {/snippet}

            <div class="grid gap-3 md:grid-cols-2">
                <Select
                    name="log-fragmentation-mode"
                    label="Fragmentation"
                    value={logFragmentationMode}
                    allowDeselect={false}
                    disabled={logsSaving}
                    options={[
                        { label: "Par durée", value: "duration" },
                        { label: "Par taille", value: "size" },
                    ]}
                    onchange={(value) => logFragmentationMode = value === "size" ? "size" : "duration"}
                />
                {#if logFragmentationMode === "duration"}
                    <Select
                        name="log-fragment-duration"
                        label="Durée d'un fragment"
                        value={logFragmentDuration}
                        allowDeselect={false}
                        disabled={logsSaving}
                        options={[
                            { label: "Quotidienne", value: "daily" },
                            { label: "Hebdomadaire", value: "weekly" },
                            { label: "Mensuelle", value: "monthly" },
                        ]}
                        onchange={(value) => logFragmentDuration = value === "daily" || value === "weekly" ? value : "monthly"}
                    />
                {:else}
                    <NumberInput
                        name="log-fragment-size"
                        label="Taille maximale"
                        min={1}
                        max={500}
                        disabled={logsSaving}
                        bind:value={logFragmentSizeMB}
                        suffix="Mo"
                    />
                {/if}
            </div>
            {#snippet metadata()}
                <SettingsMetadata
                    items={[logFragmentationMode === "duration"
                        ? { label: "Prochaine fragmentation", value: formatDate(nextLogFragmentDate()?.toISOString() ?? null) }
                        : { label: "Taille actuelle", value: activeLogSizeLabel() }]}
                />
            {/snippet}
        </SettingsAccordionRow>

        {#if $currentUser?.administrator}
            <SettingsAccordionRow
                icon="Archive"
                title="Archive des journaux"
                description="Fragments conservés un an, vérifiés et contrôlables par l'administrateur."
                toneClass="bg-cyan-50 text-cyan-700"
                attention={!logManifestIntegrity || Boolean(logArchiveError) || logFragments.some((fragment) => !fragment.integrity)}
                bodyPadding={false}
            >
            {#snippet action()}
                <Button
                    variant="secondary"
                    size="sm"
                    icon={logsLoading ? "LoaderCircle" : "RefreshCw"}
                    iconAnimation={logsLoading ? "spin" : undefined}
                    tooltip="Actualiser"
                    aria-label="Actualiser les archives"
                    disabled={logsLoading}
                    onclick={(event: MouseEvent) => {
                        event.stopPropagation();
                        void refreshLogFragments();
                    }}
                    class="w-fit"
                />
            {/snippet}

            <div class="overflow-hidden">
                <SettingsDrilldownList
                    items={logFragmentItems}
                    bind:selectedId={selectedLogFragment}
                    emptyTitle={logsLoading ? "Chargement..." : "Aucun fragment terminé"}
                    emptyDescription="Le fragment en cours apparaîtra ici après sa fermeture."
                    backLabel="Toutes les archives"
                >
                    {#snippet itemRight(item)}
                        {@const fragment = selectedFragment(item)}
                        {#if fragment}
                            <span class={`rounded-md px-2 py-1 text-[10px] font-semibold ${fragment.integrity ? fragment.quarantinedAt ? "bg-orange-100 text-orange-800" : fragment.deletedAt ? "bg-(--light-bg3) text-(--grey)" : "bg-(--transparent-green) text-(--green)" : "bg-(--transparent-red) text-(--red)"}`}>
                                {fragment.integrity ? fragment.quarantinedAt ? "Quarantaine" : fragment.deletedAt ? "Supprimé" : "Valide" : "Altéré"}
                            </span>
                        {/if}
                    {/snippet}
                    {#snippet detail(item)}
                        {@const fragment = selectedFragment(item)}
                        {#if fragment}
                            <div class="px-4 pb-4">
                                <dl class="grid gap-2 rounded-lg bg-(--light-bg2) p-3 text-xs md:grid-cols-2">
                                    <div><dt class="text-(--grey)">Création</dt><dd class="font-medium">{formatDate(fragment.createdAt)}</dd></div>
                                    <div><dt class="text-(--grey)">Fin d'enregistrement</dt><dd class="font-medium">{formatDate(fragment.closedAt)}</dd></div>
                                    <div><dt class="text-(--grey)">Suppression prévue</dt><dd class="font-medium">{formatDate(fragment.deleteAt)}</dd></div>
                                    <div><dt class="text-(--grey)">Taille</dt><dd class="font-medium">{formatSize(fragment.size)}</dd></div>
                                    {#if fragment.quarantinedAt}<div><dt class="text-(--grey)">Mise en quarantaine</dt><dd class="font-medium">{formatDate(fragment.quarantinedAt)}</dd></div>{/if}
                                    {#if fragment.deletedAt}<div><dt class="text-(--grey)">Suppression</dt><dd class="font-medium">{formatDate(fragment.deletedAt)}</dd></div>{/if}
                                    <div class="border-t border-(--light-bg3) pt-2 md:col-span-2">
                                        <dt class={`font-semibold ${fragment.integrity ? "text-(--green)" : "text-(--red)"}`}>{fragment.integrity ? "Empreinte valide" : "Empreinte invalide, fichier altéré"}</dt>
                                        <dd class="mt-1 break-all text-[10px] text-(--grey)"><code>SHA-256 : {fragment.sha256}</code></dd>
                                    </div>
                                </dl>
                                {#if !fragment.deletedAt}
                                    <div class="mt-3 flex flex-wrap justify-end gap-2">
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={fragment.quarantinedAt ? "ShieldCheck" : "ShieldAlert"}
                                            label={fragment.quarantinedAt ? "Retirer de la quarantaine" : "Mettre en quarantaine"}
                                            onclick={() => toggleLogQuarantine(fragment)}
                                            class="w-fit"
                                        />
                                        <Button
                                            variant="error"
                                            size="sm"
                                            icon="Trash2"
                                            label="Supprimer"
                                            confirm
                                            confirmTitle={`Supprimer ${fragment.name} ?`}
                                            confirmDescription="Le fichier sera supprimé définitivement. La date, l'empreinte et la trace de suppression seront conservées."
                                            confirmCancelLabel="Annuler"
                                            confirmConfirmLabel="Supprimer"
                                            confirmConfirmVariant="error"
                                            onclick={() => removeLogFragment(fragment)}
                                            class="w-fit"
                                        />
                                    </div>
                                {/if}
                            </div>
                        {/if}
                    {/snippet}
                </SettingsDrilldownList>
            </div>
            </SettingsAccordionRow>
        {/if}
    </SettingsSection>

    <SettingsSection label="Base de données">
        {#if $currentUser?.administrator}
            <SettingsRow
                icon="KeyRound"
                title="Clé de récupération"
                description="Cette clé permet de déchiffrer et de restaurer les sauvegardes."
                toneClass="bg-amber-50 text-amber-700"
                attention={!backupStatus?.keyExported}
            >
                {#snippet action()}
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={backupKeyExportLoading ? "LoaderCircle" : "Download"}
                        iconAnimation={backupKeyExportLoading ? "spin" : undefined}
                        label={backupStatus?.keyExported ? "Réexporter" : "Exporter"}
                        disabled={backupKeyExportLoading}
                        confirm
                        confirmTitle="Exporter la clé de récupération ?"
                        confirmDescription="Cette clé est indispensable pour restaurer vos sauvegardes. Enregistrez-la sur un support sûr, distinct du serveur et des sauvegardes."
                        confirmCancelLabel="Annuler"
                        confirmConfirmLabel="Exporter"
                        confirmConfirmVariant="primary"
                        onclick={downloadBackupKey}
                        class="w-fit"
                    />
                {/snippet}
            </SettingsRow>
        {/if}

        {#if databaseEngine === "postgres"}
            <SettingsRow
                icon="Database"
                title="PostgreSQL"
                description={backupStatus?.toolsAvailable === false
                    ? "Installez les outils client PostgreSQL pour sauvegarder, restaurer et exporter les données."
                    : "La connexion est active. Les sauvegardes utilisent pg_dump et pg_restore."}
                toneClass="bg-blue-50 text-blue-700"
                attention={backupStatus?.toolsAvailable === false}
            />
        {/if}

        {#if $currentUser?.administrator}
            <SettingsRow
                icon="HardDriveDownload"
                title="Sauvegarde manuelle"
                description="Crée une sauvegarde chiffrée dans le dossier de sauvegardes du serveur."
                toneClass="bg-blue-50 text-blue-700"
            >
                {#snippet action()}
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={manualBackupLoading ? "LoaderCircle" : "DatabaseBackup"}
                        iconAnimation={manualBackupLoading ? "spin" : undefined}
                        label="Sauvegarder maintenant"
                        disabled={manualBackupLoading || backupStatus?.toolsAvailable === false}
                        onclick={runManualBackup}
                        class="w-fit"
                    />
                {/snippet}
            </SettingsRow>

            <SettingsAccordionRow
                icon="DatabaseZap"
                title="Importer une sauvegarde"
                description="Vérifie et restaure une sauvegarde au prochain redémarrage."
                toneClass="bg-red-50 text-red-700"
            >
                <div class="grid gap-3 md:grid-cols-2">
                    <div
                        role="button"
                        tabindex="0"
                        aria-label="Sélectionner une sauvegarde"
                        onclick={openRestoreFilePicker}
                        onkeydown={openRestoreFilePicker}
                    >
                        <FileInput
                            name="restore-backup-file"
                            label="Sauvegarde"
                            accept=".psoft-backup,application/octet-stream"
                            placeholder="Sélectionner une sauvegarde"
                            dropzone
                            maxSize={MAX_SERVER_BACKUP_UPLOAD_BYTES}
                            disabled={restoreLoading}
                            bind:value={restoreBackupFile}
                            onchange={selectRestoreBackup}
                        />
                    </div>
                    <div
                        role="button"
                        tabindex="0"
                        aria-label="Sélectionner une clé de récupération"
                        onclick={openRestoreFilePicker}
                        onkeydown={openRestoreFilePicker}
                    >
                        <FileInput
                            name="restore-recovery-key"
                            label="Clé de récupération"
                            accept=".txt,text/plain"
                            placeholder="Sélectionner une clé si nécessaire"
                            dropzone
                            maxSize={MAX_SERVER_BACKUP_RECOVERY_KEY_BYTES}
                            disabled={restoreLoading}
                            bind:value={restoreRecoveryKeyFile}
                            onchange={selectRestoreRecoveryKey}
                            helpText="Facultatif si la sauvegarde utilise la clé actuelle."
                            helpTextIcon
                        />
                    </div>
                </div>
                <div class="mt-3 flex justify-end">
                    <Button
                        variant="error"
                        size="sm"
                        icon={restoreLoading ? "LoaderCircle" : "DatabaseZap"}
                        iconAnimation={restoreLoading ? "spin" : undefined}
                        label="Importer ce fichier"
                        disabled={restoreLoading || !restoreBackupFile || backupStatus?.toolsAvailable === false}
                        confirm
                        confirmTitle="Remplacer la base de données ?"
                        confirmDescription="Toutes les données créées après cette sauvegarde seront remplacées. La base actuelle sera sauvegardée et restaurée automatiquement si le contrôle au redémarrage échoue."
                        confirmCancelLabel="Annuler"
                        confirmConfirmLabel="Vérifier et restaurer"
                        confirmConfirmVariant="error"
                        onclick={restoreUploadedBackup}
                        class="w-fit"
                    />
                </div>
            </SettingsAccordionRow>

            <SettingsAccordionRow
                icon="Archive"
                title="Archive des sauvegardes"
                description="Sauvegardes locales chiffrées, vérifiées et contrôlables par l'administrateur."
                toneClass="bg-cyan-50 text-cyan-700"
                attention={backupFiles.some((backup) => backup.integrity === false)}
                bodyPadding={false}
            >
            {#snippet action()}
                <Button
                    variant="secondary"
                    size="sm"
                    icon={backupFilesLoading ? "LoaderCircle" : "RefreshCw"}
                    iconAnimation={backupFilesLoading ? "spin" : undefined}
                    tooltip="Actualiser"
                    aria-label="Actualiser les sauvegardes locales"
                    disabled={backupFilesLoading || restoreLoading || backupDeleting !== null}
                    onclick={(event: MouseEvent) => {
                        event.stopPropagation();
                        void refreshBackupFiles();
                    }}
                    class="w-fit"
                />
            {/snippet}

            <div class="overflow-hidden">
                <SettingsDrilldownList
                    items={backupFileItems}
                    bind:selectedId={selectedBackup}
                    emptyTitle={backupFilesLoading ? "Chargement..." : "Aucune sauvegarde locale"}
                    emptyDescription="Les sauvegardes créées sur ce serveur apparaîtront ici."
                    backLabel="Toutes les archives"
                >
                    {#snippet itemRight(item)}
                        {@const backup = selectedBackupFile(item)}
                        {#if backup}
                            <span class={`rounded-md px-2 py-1 text-[10px] font-semibold ${backup.integrity === false ? "bg-(--transparent-red) text-(--red)" : backup.integrity === true ? "bg-(--transparent-green) text-(--green)" : "bg-(--light-bg3) text-(--grey)"}`}>
                                {backup.integrity === false ? "Altérée" : backup.integrity === true ? "Valide" : "Non vérifiée"}
                            </span>
                        {/if}
                    {/snippet}
                    {#snippet detail(item)}
                        {@const backup = selectedBackupFile(item)}
                        {#if backup}
                            <div class="px-4 pb-4">
                                <dl class="grid gap-2 rounded-lg bg-(--light-bg2) p-3 text-xs md:grid-cols-2">
                                    <div><dt class="text-(--grey)">Création</dt><dd class="font-medium">{formatDate(backup.modifiedAt)}</dd></div>
                                    <div><dt class="text-(--grey)">Taille</dt><dd class="font-medium">{formatSize(backup.size)}</dd></div>
                                    <div class="border-t border-(--light-bg3) pt-2 md:col-span-2">
                                        <dt class={`font-semibold ${backup.integrity === false ? "text-(--red)" : backup.integrity === true ? "text-(--green)" : "text-(--grey)"}`}>{backup.integrity === false ? "Empreinte invalide, fichier altéré" : backup.integrity === true ? "Empreinte valide" : "Empreinte non disponible"}</dt>
                                        {#if backup.sha256}
                                            <dd class="mt-1 break-all text-[10px] text-(--grey)"><code>SHA-256 : {backup.sha256}</code></dd>
                                        {/if}
                                    </div>
                                </dl>
                                <div class="mt-3 flex flex-wrap justify-end gap-2">
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={restoreLoading ? "LoaderCircle" : "DatabaseZap"}
                                        iconAnimation={restoreLoading ? "spin" : undefined}
                                        label="Restaurer"
                                        disabled={restoreLoading || backupDeleting !== null || backup.integrity === false || backupStatus?.toolsAvailable === false}
                                        confirm
                                        confirmTitle={`Restaurer ${backup.filename} ?`}
                                        confirmDescription="Toutes les données plus récentes seront remplacées. La base actuelle sera sauvegardée et une restauration défectueuse sera annulée automatiquement."
                                        confirmCancelLabel="Annuler"
                                        confirmConfirmLabel="Restaurer"
                                        confirmConfirmVariant="error"
                                        onclick={() => restoreBackup({ filename: backup.filename })}
                                        class="w-fit"
                                    />
                                    <Button
                                        variant="error"
                                        size="sm"
                                        icon={backupDeleting === backup.filename ? "LoaderCircle" : "Trash2"}
                                        iconAnimation={backupDeleting === backup.filename ? "spin" : undefined}
                                        label="Supprimer"
                                        disabled={restoreLoading || backupDeleting !== null}
                                        confirm
                                        confirmTitle={`Supprimer ${backup.filename} ?`}
                                        confirmDescription="La sauvegarde et son empreinte seront supprimées définitivement du serveur."
                                        confirmCancelLabel="Annuler"
                                        confirmConfirmLabel="Supprimer"
                                        confirmConfirmVariant="error"
                                        onclick={() => removeBackup(backup)}
                                        class="w-fit"
                                    />
                                </div>
                            </div>
                        {/if}
                    {/snippet}
                </SettingsDrilldownList>
            </div>
            </SettingsAccordionRow>
        {/if}

    </SettingsSection>

    {#if $currentUser?.administrator}
        <SettingsSection label="Zone de danger">
            <SettingsRow
                icon="FileOutput"
                title="Exporter les données"
                description="Crée une copie non chiffrée de la base de données."
                variant="destructive"
            >
                {#snippet action()}
                    <Button
                        variant="error"
                        size="sm"
                        icon={databaseExportLoading ? "LoaderCircle" : "FileOutput"}
                        iconAnimation={databaseExportLoading ? "spin" : undefined}
                        label="Exporter"
                        disabled={databaseExportLoading || backupStatus?.toolsAvailable === false}
                        onclick={() => (databaseExportDialogOpen = true)}
                        class="w-fit"
                    />
                {/snippet}
            </SettingsRow>
            {#if connectedToLocalServer}
                <SettingsRow
                    icon="Trash2"
                    title="Désinstaller PServer"
                    description="Supprime le service et les fichiers du programme sans supprimer les données du serveur."
                    variant="destructive"
                >
                    {#snippet action()}
                        <Button
                            variant="error"
                            size="sm"
                            icon={removingServer ? "LoaderCircle" : "Trash2"}
                            iconAnimation={removingServer ? "spin" : undefined}
                            label="Désinstaller"
                            disabled={removingServer}
                            confirm
                            confirmTitle="Désinstaller PServer ?"
                            confirmDescription="Le service et les fichiers du programme seront supprimés. La base de données, les sauvegardes, les journaux et la configuration seront conservés."
                            confirmCancelLabel="Annuler"
                            confirmConfirmLabel="Désinstaller"
                            confirmConfirmVariant="error"
                            onclick={uninstallPServer}
                            class="w-fit"
                        />
                    {/snippet}
                </SettingsRow>
            {/if}
        </SettingsSection>
    {/if}

    <PasswordConfirmDialog
        bind:open={databaseExportDialogOpen}
        title="Autoriser l’export non chiffré"
        description="Saisissez le mot de passe de votre compte administrateur. Le fichier exporté contiendra toutes les données en clair."
        confirmLabel="Autoriser et exporter"
        loading={databaseExportLoading}
        onConfirm={exportDatabase}
    />

    {#snippet serverSecurity()}
    <SettingsSection label="Sécurité serveur">
        <SettingsRow
            icon="ShieldCheck"
            title="Associer un poste"
            description={pairingCode
                ? `Code valable jusqu'à ${strftime(new Date(pairingExpiresAt * 1000), "%H:%M", "fr-FR")}.`
                : "Générez un code temporaire pour sécuriser la première connexion d'un poste."}
            toneClass="bg-emerald-50 text-emerald-700"
        >
            {#snippet action()}
                <div class="flex items-center gap-2">
                    {#if pairingCode}
                        <code class="whitespace-nowrap rounded-lg bg-(--light-bg2) px-3 py-2 font-mono text-sm font-bold tracking-wider text-(--dark-bg1)">
                            {pairingCode.replace(/(\d{3})(?=\d)/g, "$1 ")}
                        </code>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="Copy"
                            tooltip="Copier le code"
                            aria-label="Copier le code d'association"
                            onclick={copyPairingCode}
                            class="w-fit"
                        />
                    {/if}
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={pairingLoading ? "LoaderCircle" : "KeyRound"}
                        iconAnimation={pairingLoading ? "spin" : undefined}
                        label={pairingCode ? "Renouveler" : "Générer"}
                        disabled={pairingLoading}
                        onclick={createPairingCode}
                        class="w-fit"
                    />
                </div>
            {/snippet}
        </SettingsRow>

        <SettingsExpandableRow
            icon="Gauge"
            title="Règle de rate limit"
            description="Limite le nombre de requêtes autorisées par minute. Les connexions sont toujours limitées à 5 tentatives/min."
            name="rate-limit-enabled"
            toneClass="bg-orange-50 text-orange-700"
            bind:value={rateLimitEnabled}
            onChange={saveRateLimitEnabled}
        >
                <NumberInput
                    name="rate-limit"
                    label="Limite"
                    min={RATE_LIMIT_MIN}
                    max={RATE_LIMIT_MAX}
                    bind:value={rateLimit}
                    disabled={savingRateLimit}
                >
                    {#snippet suffix()}
                        <span class=" input-affix border-r border-(--light-bg3)">requêtes/min</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={savingRateLimit ? "LoaderCircle" : "Save"}
                            iconAnimation={savingRateLimit ? "spin" : undefined}
                            label={rateLimitDirty ? "Enregistrer" : "Enregistré"}
                            disabled={savingRateLimit || !rateLimitDirty}
                            onclick={saveRateLimitValue}
                            class="w-fit rounded-none bg-(--dark-bg1) text-(--light-bg1) hover:bg-(--user-color)
                                disabled:cursor-not-allowed disabled:bg-(--light-bg1) disabled:text-(--light-grey)"
                        />
                    {/snippet}
                </NumberInput>
        </SettingsExpandableRow>
    </SettingsSection>
    {/snippet}
    {/snippet}
</SettingsPage>

<!--
Paramètres non implémentés :
    Diagnostic serveur : rapport technique détaillé, masqué pour le moment.
    Rétention des données : durée de conservation des données système, métiers et historiques.
-->
