<script lang="ts">
    import { goto } from "$app/navigation";
    import { isAuthenticated } from "$lib/auth";
    import { Button } from "$lib/components/istyler";
    import { isConnectedToLocalPServer, isLocalPServerInstalled } from "$lib/localServerControl";
    import { createLocalServerController } from "$lib/localServerController.svelte.js";
    import { getServerConfig, resetOnboarding } from "$lib/onboarding";
    import {
        runLocalServerUpdateCheck,
        runLocalServerUpdateInstall,
        type LocalServerUpdateCheck,
    } from "$lib/localServerService";
    import { getStartupRoute } from "$lib/startupRoute";
    import { checkServerCompatibility, getCachedCompatibilityStatus, type CompatibilityStatus } from "$lib/system";
    import { strftime } from "$lib/utils";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";

    const serverControl = createLocalServerController();
    const configuredServer = getServerConfig();
    const locallyManagedServer = configuredServer?.installTarget === "local";
    const initialStatus = getCachedCompatibilityStatus();
    const now = () => strftime(new Date(), "%H:%M:%S");

    let status = $state<CompatibilityStatus | null>(initialStatus);
    let serverUpdate = $state<LocalServerUpdateCheck | null>(null);
    let connectionChecking = $state(false);
    let updateChecking = $state(false);
    let updateInstalling = $state(false);
    let updateError = $state("");
    let connectionCheckedAt = $state(initialStatus ? now() : "");
    let updateCheckedAt = $state("");

    const ready = $derived(serverControl.serviceResolved);
    const connectedServerId = $derived(status?.version?.serverId ?? configuredServer?.serverId ?? null);
    const connectedToLocalServer = $derived(isConnectedToLocalPServer(serverControl.service, connectedServerId));
    const localServerInstalled = $derived(isLocalPServerInstalled(serverControl.service));
    const localServerName = $derived(serverControl.service?.serverName?.trim() || "PServer");
    const serverAvailable = $derived(
        status?.compatible === true
        && (!connectedToLocalServer
            || (serverControl.service?.state !== "stopped" && serverControl.service?.state !== "stopping")),
    );
    const busy = $derived(serverControl.busy || updateInstalling);
    const title = $derived(
        connectedToLocalServer ? serverAvailable ? `${localServerName} est opérationnel` : `Contrôle de ${localServerName}`
        : serverAvailable ? "Serveur disponible"
        : status?.reason === "frontend-too-old" ? "PSoft doit être mis à jour"
        : status?.reason === "backend-too-old" ? "PServer doit être mis à jour"
        : status?.reason === "invalid-version" ? "Versions incompatibles"
        : "Serveur indisponible",
    );
    const description = $derived(
        connectedToLocalServer ? `Ce poste héberge ${localServerName}. Vérifiez son état et intervenez directement si nécessaire.`
        : serverAvailable ? "La connexion est rétablie. Vous pouvez retourner à l’application."
        : status?.reason === "unreachable" ? "PSoft ne peut pas joindre le serveur. Réessayez dans quelques instants ou contactez votre administrateur."
        : status?.message ?? "PSoft ne peut pas utiliser le serveur configuré.",
    );
    const serviceState = $derived(
        serverControl.service?.state === "running" ? "En fonctionnement"
        : serverControl.service?.state === "stopped" ? "Arrêté"
        : serverControl.service?.state === "starting" ? "Démarrage en cours"
        : serverControl.service?.state === "stopping" ? "Arrêt en cours"
        : "État inconnu",
    );
    const currentVersion = $derived(serverUpdate?.currentVersion ?? (connectedToLocalServer ? status?.version?.backendVersion : null) ?? null);
    const versionDescription = $derived(
        updateError || (serverUpdate?.available
            ? `La version ${serverUpdate.version ?? "la plus récente"} est disponible.`
            : updateChecking
                ? "Recherche d’une mise à jour…"
                : currentVersion
                    ? `PServer ${currentVersion} est à jour.`
                    : "Version installée inconnue."),
    );

    function checkedAt(value: string) {
        return value ? `Dernière vérification : ${value}` : "Aucune vérification effectuée";
    }

    async function refreshService() {
        const service = await serverControl.refreshService();
        const installationMissing = locallyManagedServer && service?.state === "not-installed";
        if (installationMissing) configureServer();
        return installationMissing;
    }

    async function refreshConnection() {
        connectionChecking = true;
        try {
            status = await checkServerCompatibility({ force: true });
            return status;
        } finally {
            connectionCheckedAt = now();
            connectionChecking = false;
        }
    }

    async function refreshVersion() {
        updateChecking = true;
        updateError = "";
        try {
            serverUpdate = await runLocalServerUpdateCheck();
        } catch (error) {
            console.error("Failed to check for a PServer update", error);
            serverUpdate = null;
            updateError = error instanceof Error ? error.message : String(error);
        } finally {
            updateCheckedAt = now();
            updateChecking = false;
        }
    }

    async function installUpdate() {
        if (!serverUpdate?.available) return;

        updateInstalling = true;
        updateError = "";
        try {
            const result = await runLocalServerUpdateInstall({
                freshInstall: false,
            });
            toast.success(result.detail);
            serverUpdate = null;
            await refreshService();
            await refreshConnection();
            await refreshVersion();
        } catch (error) {
            console.error("Failed to update PServer", error);
            updateError = error instanceof Error ? error.message : String(error);
            toast.error(updateError);
            await refreshService();
        } finally {
            updateInstalling = false;
        }
    }

    function goBack() {
        void goto(isAuthenticated() ? getStartupRoute() : "/login", {
            replaceState: true,
            state: { transitionDirection: "back" },
        });
    }

    function configureServer() {
        resetOnboarding();
        void goto("/onboarding");
    }

    onMount(() => {
        void Promise.all([refreshService(), refreshConnection()])
            .then(([redirecting]) => redirecting || !localServerInstalled ? undefined : refreshVersion());
    });
</script>

<section class="flex h-full w-full overflow-x-hidden overflow-y-auto bg-(--light-bg2) px-5 py-8 text-(--dark-bg1)">
    <div class:invisible={!ready} class="m-auto flex w-full max-w-2xl flex-col items-center gap-5">
        <div class="flex min-h-32 w-full flex-col items-center justify-center gap-3 text-center">
            <div class={`flex size-14 items-center justify-center ${serverAvailable ? "text-(--green)" : "text-(--user-color)"}`}>
                {#if connectedToLocalServer}
                    <Icon.ServerCog size={42} strokeWidth={1.5} />
                {:else if serverAvailable}
                    <Icon.CircleCheckBig size={42} strokeWidth={1.5} />
                {:else}
                    <Icon.ServerOff size={42} strokeWidth={1.5} />
                {/if}
            </div>
            <div>
                <h1 class="text-3xl font-black">{title}</h1>
                <p class="mx-auto mt-1 max-w-lg text-sm leading-5 text-(--grey)">{description}</p>
            </div>
        </div>

        {#if localServerInstalled}
            <div class="w-full max-w-lg divide-y divide-(--light-bg3)">
                <div class="flex items-center gap-4 py-3">
                    {#if serverControl.serviceError || serverControl.service?.state === "error" || serverControl.service?.state === "stopped"}
                        <Icon.Minus size={20} class="shrink-0 text-(--red)" />
                    {:else if serverControl.serviceChecking}
                        <Icon.Loader size={20} class="shrink-0 text-(--grey)" />
                    {:else}
                        <Icon.Activity
                            size={20}
                            class="shrink-0 text-(--green)"
                        />
                    {/if}
                    <div class="min-w-0 flex-1">
                        <h2 class="text-sm font-bold">{localServerName}</h2>
                        <p class="mt-1 text-sm text-(--grey)">{serverControl.serviceError || serviceState}</p>
                        <p class="mt-0.5 text-xs text-(--light-grey)">{checkedAt(serverControl.serviceCheckedAt)}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={serverControl.serviceChecking ? "LoaderCircle" : "RefreshCw"}
                        iconAnimation={serverControl.serviceChecking ? "spin" : undefined}
                        disabled={serverControl.serviceChecking || busy}
                        onclick={refreshService}
                        class="size-8 p-0 text-(--grey) hover:bg-(--light-bg3) hover:text-(--dark-bg1)"
                    />
                </div>

                <div class="flex items-center gap-4 py-3">
                    {#if connectionChecking}
                        <Icon.WifiCog size={20} class="shrink-0 text-(--grey)" />
                    {:else if serverAvailable}
                        <Icon.Wifi size={20} class="shrink-0 text-(--green)" />
                    {:else}
                        <Icon.WifiOff size={20} class="shrink-0 text-(--red)" />
                    {/if}
                    <div class="min-w-0 flex-1">
                        <h2 class="text-sm font-bold">Connexion à PSoft</h2>
                        <p class="mt-1 text-sm text-(--grey)">
                            {connectionChecking ? "Vérification de la réponse du serveur…" : serverAvailable ? "Le serveur répond normalement." : "Le serveur est injoignable."}
                        </p>
                        <p class="mt-0.5 text-xs text-(--light-grey)">{checkedAt(connectionCheckedAt)}</p>
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={connectionChecking ? "LoaderCircle" : "RefreshCw"}
                        iconAnimation={connectionChecking ? "spin" : undefined}
                        disabled={connectionChecking || busy}
                        onclick={refreshConnection}
                        class="size-8 p-0 text-(--grey) hover:bg-(--light-bg3) hover:text-(--dark-bg1)"
                    />
                </div>

                <div class="flex items-center gap-4 py-3">
                    {#if updateError}
                        <Icon.CloudAlert size={20} class="shrink-0 text-(--red)" />
                    {:else if updateChecking}
                        <Icon.CloudCog size={20} class="shrink-0 text-(--grey)" />
                    {:else}
                        <Icon.CloudDownload size={20} class={`shrink-0 ${serverUpdate?.available ? "text-(--red)" : serverUpdate ? "text-(--green)" : "text-(--grey)"}`} />
                    {/if}
                    <div class="min-w-0 flex-1">
                        <h2 class="text-sm font-bold">Version</h2>
                        <p class="mt-1 text-sm text-(--grey)">{versionDescription}</p>
                        <p class="mt-0.5 text-xs text-(--light-grey)">{checkedAt(updateCheckedAt)}</p>
                    </div>
                    <div class="flex shrink-0 items-center gap-1">
                        {#if serverUpdate?.available}
                            <Button
                                size="sm"
                                label="Installer"
                                icon={updateInstalling ? "LoaderCircle" : "Download"}
                                iconAnimation={updateInstalling ? "spin" : undefined}
                                disabled={updateChecking || busy}
                                confirm
                                confirmTitle="Installer la mise à jour PServer ?"
                                confirmDescription="PServer sera sauvegardé, mis à jour puis redémarré."
                                confirmCancelLabel="Annuler"
                                confirmConfirmLabel="Installer"
                                onclick={installUpdate}
                                class="w-fit"
                            />
                        {/if}
                        <Button
                            variant="ghost"
                            size="sm"
                            icon={updateChecking ? "LoaderCircle" : "RefreshCw"}
                            iconAnimation={updateChecking ? "spin" : undefined}
                            disabled={updateChecking || busy}
                            onclick={refreshVersion}
                            class="size-8 p-0 text-(--grey) hover:bg-(--light-bg3) hover:text-(--dark-bg1)"
                        />
                    </div>
                </div>
            </div>

            <div class="grid w-full max-w-lg grid-cols-3 gap-2">
                <Button
                    variant="secondary"
                    label="Démarrer"
                    icon={serverControl.serviceAction === "start" ? "LoaderCircle" : "Play"}
                    iconAnimation={serverControl.serviceAction === "start" ? "spin" : undefined}
                    disabled={busy || serverControl.service?.state === "running" || serverControl.service?.state === "starting"}
                    onclick={() => serverControl.controlServer("start", async () => { await refreshConnection(); })}
                />
                <Button
                    variant="error"
                    label="Arrêter"
                    icon={serverControl.serviceAction === "stop" ? "LoaderCircle" : "Square"}
                    iconAnimation={serverControl.serviceAction === "stop" ? "spin" : undefined}
                    disabled={busy || serverControl.service?.state === "stopped" || serverControl.service?.state === "stopping"}
                    confirm
                    confirmTitle="Arrêter PServer ?"
                    confirmDescription="PSoft restera indisponible jusqu’au prochain démarrage de PServer."
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Arrêter"
                    confirmConfirmVariant="error"
                    onclick={() => serverControl.controlServer("stop", async () => { await refreshConnection(); })}
                />
                <Button
                    variant="warning"
                    label="Redémarrer"
                    icon={serverControl.serviceAction === "restart" ? "LoaderCircle" : "RotateCw"}
                    iconAnimation={serverControl.serviceAction === "restart" ? "spin" : undefined}
                    disabled={busy}
                    confirm
                    confirmTitle="Redémarrer PServer ?"
                    confirmDescription="PSoft peut être indisponible pendant quelques secondes."
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Redémarrer"
                    confirmConfirmVariant="warning"
                    onclick={() => serverControl.controlServer("restart", async () => { await refreshConnection(); })}
                />
            </div>
        {/if}

        {#if serverAvailable}
            <div class="flex w-full max-w-lg justify-center">
                <Button
                    label="Retour à l’application"
                    icon="MoveLeft"
                    iconSide="left"
                    onclick={goBack}
                    class="w-fit [&_svg]:transition-transform [&_svg]:duration-(--animation-duration-150) hover:[&_svg]:-translate-x-0.5"
                />
            </div>
        {/if}
    </div>

    <div class="fixed left-5 bottom-5">
        <Button
            variant="ghost"
            size="sm"
            label="Reconfigurer"
            icon="MonitorCog"
            onclick={configureServer}
            class="w-fit text-(--grey) hover:bg-(--light-bg3) hover:text-(--dark-bg1)"
        />
    </div>
</section>
