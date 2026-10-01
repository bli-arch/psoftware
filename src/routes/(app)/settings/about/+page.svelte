<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import {
        SettingsMetadata,
        SettingsPage,
        SettingsRow,
        SettingsSection,
        SettingsToggleRow,
    } from "$lib/components/settings";
    import { Button } from "$lib/components/istyler";
    import { toast } from "svelte-sonner";
    import TextFileDialog from "$lib/components/TextFileDialog.svelte";
    import { getPSoftwareVersion } from "$lib/appInfo";
    import { canUseLocalServerService, getLocalServerServiceStatus, readLocalPServerLicense } from "$lib/localServerService";
    import { readPSoftwareDocument } from "$lib/localDocuments";
    import {
        applyPreparedFrontendUpdate,
        checkFrontendUpdate,
        frontendUpdateActivity,
        frontendUpdateStatus,
        getAutoCheckUpdatesEnabled,
        installFrontendUpdate,
        runAutomaticFrontendUpdate,
        setAutoCheckUpdatesEnabled,
        type FrontendUpdateStatus,
    } from "$lib/updater";

    let about = $state({
        autoCheckUpdates: true,
        warnBeforeExpiry: true,
        includeLogs: true,
        redactClients: true,
    });

    let relaunchingUpdate = $state(false);
    let appVersion = $state("...");
    let localServerInstalled = $state(false);

    const checkingUpdate = $derived($frontendUpdateActivity === "checking");
    const installingUpdate = $derived($frontendUpdateActivity === "installing");
    const availableUpdate = $derived(getAvailableUpdate($frontendUpdateStatus));
    const installedUpdate = $derived(getInstalledUpdate($frontendUpdateStatus));
    const versionRowTitle = $derived(getVersionRowTitle($frontendUpdateStatus));
    const versionRowDescription = $derived(getVersionRowDescription($frontendUpdateStatus));
    const versionRowToneClass = $derived(getVersionRowToneClass($frontendUpdateStatus));

    function getAvailableUpdate(status: FrontendUpdateStatus | null) {
        return status?.state === "available" ? status : null;
    }

    function getInstalledUpdate(status: FrontendUpdateStatus | null) {
        return status?.state === "installed" ? status : null;
    }

    function getVersionRowTitle(status: FrontendUpdateStatus | null) {
        if (status?.state === "available") return "Mise à jour disponible";
        if (status?.state === "installed") return "Redémarrage requis";
        if (status?.state === "idle") return "PSoft est à jour";
        return "Version de l'application";
    }

    function getVersionRowDescription(status: FrontendUpdateStatus | null) {
        if (
            status?.state === "available"
            || status?.state === "installed"
            || status?.state === "error"
            || status?.state === "unavailable"
        ) {
            return status.message;
        }

        return "Mettre à jour l'application.";
    }

    function getVersionRowToneClass(status: FrontendUpdateStatus | null) {
        if (status?.state === "available") return "bg-emerald-50 text-emerald-700";
        if (status?.state === "installed") return "bg-emerald-50 text-emerald-700";
        if (status?.state === "error") return "bg-red-50 text-red-700";
        return "bg-blue-50 text-blue-700";
    }

    function notifyUpdateStatus(status: FrontendUpdateStatus, automatic = false) {
        if (automatic && status.state !== "available" && status.state !== "error") return;

        if (status.state === "error") toast.error(status.message);
        else if (status.state === "installed") toast.success(status.message);
        else toast.info(status.message);
    }

    async function checkForUpdate(automatic = false) {
        if (checkingUpdate || installingUpdate) return;

        const status = await checkFrontendUpdate();
        notifyUpdateStatus(status, automatic);
    }

    function saveAutoCheckUpdates(enabled: boolean) {
        setAutoCheckUpdatesEnabled(enabled);
        if (enabled) void runAutomaticFrontendUpdate();
    }

    async function installUpdate() {
        const status = await installFrontendUpdate();
        notifyUpdateStatus(status);
    }

    async function relaunchAfterUpdate() {
        relaunchingUpdate = true;
        const status = await applyPreparedFrontendUpdate();
        relaunchingUpdate = false;
        notifyUpdateStatus(status);
    }

    onMount(async () => {
        about.autoCheckUpdates = getAutoCheckUpdatesEnabled();

        try {
            appVersion = await getPSoftwareVersion();
        } catch (error) {
            console.error("Failed to load PSoft version", error);
            appVersion = "Indisponible";
        }

        if (canUseLocalServerService()) {
            void getLocalServerServiceStatus()
                .then((service) => localServerInstalled = service.available)
                .catch((error) => console.error("Failed to check local PServer", error));
        }

        void runAutomaticFrontendUpdate();
    });
</script>

<SettingsPage
    title="À propos"
    description="Version et informations légales."
>
    <SettingsSection label="Application">
        <SettingsRow
            icon="Info"
            title={versionRowTitle}
            description={versionRowDescription}
            toneClass={versionRowToneClass}
        >
            {#snippet action()}
                {#if installedUpdate}
                    <Button
                        variant="warning"
                        size="sm"
                        icon={relaunchingUpdate ? "Loader" : "RotateCw"}
                        iconAnimation={relaunchingUpdate ? "spin" : undefined}
                        label="Redémarrer"
                        disabled={relaunchingUpdate}
                        confirm
                        confirmTitle="Redémarrer PSoft ?"
                        confirmDescription="PSoft va redémarrer et appliquer la mise à jour préparée."
                        confirmCancelLabel="Plus tard"
                        confirmConfirmLabel="Redémarrer"
                        confirmConfirmVariant="warning"
                        onclick={relaunchAfterUpdate}
                    />
                {:else if availableUpdate}
                    <Button
                        variant="primary"
                        size="sm"
                        icon={installingUpdate ? "Loader" : "Download"}
                        iconAnimation={installingUpdate ? "spin" : undefined}
                        label="Installer"
                        disabled={checkingUpdate || installingUpdate || relaunchingUpdate}
                        onclick={installUpdate}
                    />
                {:else}
                    <Button
                        variant="secondary"
                        size="sm"
                        icon={checkingUpdate || installingUpdate ? "Loader" : "RefreshCw"}
                        iconAnimation={checkingUpdate || installingUpdate ? "spin" : undefined}
                        label={installingUpdate ? "Installation…" : checkingUpdate ? "Vérification…" : "Vérifier"}
                        disabled={checkingUpdate || installingUpdate || relaunchingUpdate}
                        onclick={() => void checkForUpdate()}
                    />
                {/if}
            {/snippet}
            {#snippet metadata()}
                <SettingsMetadata
                    items={[
                        { label: "PSoft", value: appVersion },
                        ...(availableUpdate ? [{ label: "Nouvelle version", value: availableUpdate.version }] : []),
                        ...(availableUpdate?.notes ? [{ label: "Notes", value: availableUpdate.notes }] : []),
                        ...(installedUpdate ? [{ label: "Version préparée", value: installedUpdate.version }] : []),
                    ]}
                />
            {/snippet}
        </SettingsRow>
        <SettingsToggleRow
            icon="Radar"
            title="Mises à jour automatiques"
            description="Télécharge et prépare les mises à jour sans interrompre votre travail. Elles sont appliquées au prochain démarrage."
            name="auto-check-updates"
            toneClass="bg-emerald-50 text-emerald-700"
            bind:value={about.autoCheckUpdates}
            onChange={saveAutoCheckUpdates}
        />
        <!-- <SettingsRow
            icon="ShieldCheck"
            title="Licence"
            description="Affiche les informations de licence ou d'abonnement."
            badges={[
                {
                    text: "Actif",
                    class: "bg-(--transparent-green) text-(--green)",
                },
            ]}
            toneClass="bg-emerald-50 text-emerald-700"
        >
            {#snippet metadata()}
                <SettingsMetadata
                    items={[
                        { label: "Type", value: "Atelier local" },
                        { label: "Titulaire", value: "PSoft" },
                    ]}
                />
            {/snippet}
        </SettingsRow> -->
    </SettingsSection>

    <SettingsSection label="Informations">
        <SettingsRow
            icon="ScrollText"
            title="Informations légales"
            description="Affiche les mentions légales et conditions."
            toneClass="bg-blue-50 text-blue-700"
        >
            {#snippet action()}
                <div class="flex gap-2">
                    <TextFileDialog
                        title="Conditions d'utilisation"
                        description="Conditions applicables à l'utilisation de PSoft."
                        load={() => readPSoftwareDocument("conditions")}
                        triggerLabel="Conditions d'utilisation"
                    />
                    <TextFileDialog
                        title="Licence logicielle"
                        description="Licence open source applicable à PSoft."
                        load={() => readPSoftwareDocument("license")}
                        triggerLabel="Licence logicielle"
                        triggerIcon="Scale"
                    />
                    {#if localServerInstalled}
                        <TextFileDialog
                            title="Licence PServer"
                            description="Licence logicielle applicable au PServer installé sur cet appareil."
                            load={readLocalPServerLicense}
                            triggerLabel="Licence PServer"
                            triggerIcon="Server"
                        />
                    {/if}
                </div>
            {/snippet}
        </SettingsRow>
        <SettingsRow
            icon="Library"
            title="Crédits"
            description="Informations complémentaires sur l'application."
            toneClass="bg-stone-100 text-stone-700"
        >
            {#snippet action()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Ouvrir"
                    onclick={() => void goto("/settings/about/credits")}
                />
            {/snippet}
        </SettingsRow>
    </SettingsSection>
</SettingsPage>
