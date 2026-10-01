<script lang="ts">
    import { goto } from "$app/navigation";
    import { apiPost } from "$lib/api";
    import { Button, Checkbox, FileInput, NumberInput, PasswordInput, PinCodeInput, Radio, Select, TextInput } from "$lib/components/istyler";
    import StepProgress from "$lib/components/StepProgress.svelte";
    import TextFileDialog from "$lib/components/TextFileDialog.svelte";
    import { canLaunchServerInstaller, launchServerInstaller, verifyPServerLicense } from "$lib/desktopInstaller";
    import { isLocalPServerInstalled } from "$lib/localServerControl";
    import {
        canUseLocalServerService,
        getCachedLocalServerServiceStatus,
        getLocalServerServiceStatus,
        readLocalPServerLicense,
    } from "$lib/localServerService";
    import {
        ONBOARDING_VERSION,
        completeAdminOnboarding,
        completeUserOnboarding,
        normalizeApiBaseUrl,
        MAX_POSTGRES_SSL_ROOT_CERTIFICATE_BYTES,
        type DatabaseConfig,
        type ServerConfig,
    } from "$lib/onboarding";
    import { discoverPServers, type DiscoveredPServer } from "$lib/serverDiscovery";
    import { getPServerIdentity, isPServerTrusted, pairPServer } from "$lib/serverPairing";
    import { bootstrapClient, clearBootstrapCache } from "$lib/system";
    import { animationTime } from "$lib/uiPreferences";
    import { flip } from "svelte/animate";
    import { cubicIn, cubicOut } from "svelte/easing";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import { fly } from "svelte/transition";

    type Flow = "install" | "connect";
    type BindMode = "network" | "local" | "custom";

    const installSteps = ["Choix", "Licence", "Serveur", "Données", "Compte"].map((label, index) => ({ id: index, label }));
    const connectSteps = ["Choix", "Serveur", "Sécurité"].map((label, index) => ({ id: index, label }));

    let flow: Flow = $state("install");
    let stepIndex = $state(0);
    let stepDirection = $state(1);
    let installLoading = $state(false);
    let licenseLoading = $state(false);
    let securityChecking = $state(false);
    let pairingLoading = $state(false);
    let discoveryLoading = $state(false);
    let discoveredServers = $state<DiscoveredPServer[]>([]);
    let localServerInstalled = $state(isLocalPServerInstalled(getCachedLocalServerServiceStatus()));
    let welcome = $state(false);
    let welcomeLeaving = $state(false);
    let contentHeight = $state<number>();

    let licenseText = $state("");
    let licenseAccepted = $state(false);
    let licenseKey = $state("");
    let serverName = $state("");
    let bindMode: BindMode = $state("network");
    let customBindAddress = $state("");
    let serverHost = $state("localhost");
    let serverPort = $state<number | null>(8000);
    let discoveryName = $state(`pserver-${crypto.randomUUID().slice(0, 6)}`);
    let discoveryEnabled = $state(true);
    let databaseType: "sqlite" | "postgres" = $state("sqlite");
    let sqlitePath = $state("C:\\ProgramData\\PServer\\data\\db.sqlite3");
    let postgresHost = $state("localhost");
    let postgresPort = $state<number | null>(5432);
    let postgresDatabase = $state("");
    let postgresUsername = $state("");
    let postgresPassword = $state("");
    let postgresSSLMode: "disable" | "require" | "verify-full" = $state("require");
    let postgresSSLRootCertificateFile: File | null = $state(null);
    let postgresSSLRootCertificate = $state("");
    let adminUsername = $state("admin");
    let adminPassword = $state("");
    let adminPasswordConfirm = $state("");
    let userServerAddress = $state("");
    let pairingCode = $state("");

    const maxStep = $derived(flow === "install" ? 4 : 2);
    const isLastStep = $derived(stepIndex === maxStep);
    const bindAddress = $derived({
        network: "0.0.0.0",
        local: "127.0.0.1",
        custom: customBindAddress.trim().replace(/^\[|\]$/g, ""),
    }[bindMode]);
    const primaryHost = $derived({
        network: serverHost.trim(),
        local: bindAddress,
        custom: bindAddress,
    }[bindMode]);
    const discoveryAvailable = $derived({
        network: true,
        local: false,
        custom: true,
    }[bindMode]);
    const activeDiscovery = $derived(discoveryAvailable && discoveryEnabled);
    const currentTitle = $derived.by(() => {
        if (stepIndex === 0) return "Premier démarrage";
        if (flow === "connect") return stepIndex === 1 ? "Connexion au serveur" : "Sécuriser la connexion";
        return [
            "",
            "Licence PServer",
            "Configurer le serveur",
            "Choisir la base de données",
            "Créer l'administrateur",
        ][stepIndex];
    });
    const currentDescription = $derived.by(() => {
        if (stepIndex === 0) return "Choisissez ce que ce poste doit faire.";
        if (flow === "connect") return stepIndex === 1
            ? "Indiquez l'adresse donnée par l'administrateur."
            : "Saisissez le code donné par l'administrateur.";
        return [
            "",
            "Acceptez la licence puis saisissez votre clé.",
            "Définissez comment PServer sera accessible.",
            "Sélectionnez le stockage utilisé par PServer.",
            "Ce compte administrera le nouveau serveur.",
        ][stepIndex];
    });

    function goToStep(nextStep: number) {
        const boundedStep = Math.max(0, Math.min(nextStep, maxStep));
        if (boundedStep === stepIndex) return;
        stepDirection = boundedStep > stepIndex ? 1 : -1;
        stepIndex = boundedStep;
    }

    function publicApiBase() {
        const host = primaryHost;
        const formattedHost = host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
        return normalizeApiBaseUrl(`https://${formattedHost}:${serverPort}`);
    }

    function userApiBase() {
        return normalizeApiBaseUrl(`https://${userServerAddress.trim()}`);
    }

    function databaseConfig(): DatabaseConfig {
        if (databaseType === "postgres") {
            return {
                type: "postgres",
                host: postgresHost.trim(),
                port: postgresPort ?? 5432,
                database: postgresDatabase.trim(),
                username: postgresUsername.trim(),
                sslMode: postgresSSLMode,
                sslRootCertificate: postgresSSLMode === "verify-full"
                    ? postgresSSLRootCertificate.trim()
                    : undefined,
            };
        }
        return { type: "sqlite", path: sqlitePath.trim() };
    }

    function serverConfig(database: DatabaseConfig): ServerConfig {
        return {
            version: ONBOARDING_VERSION,
            serverName: serverName.trim(),
            installTarget: "local",
            apiBaseUrl: publicApiBase(),
            bindAddress,
            discoveryEnabled: activeDiscovery,
            discoveryHostname: activeDiscovery ? `${discoveryName.trim().toLowerCase()}.local` : "pserver.local",
            database,
            backendStatus: "pending-install",
            savedAt: new Date().toISOString(),
        };
    }

    function validateLicenseStep() {
        if (!canLaunchServerInstaller()) return "Installez puis lancez PSoft depuis l'application Windows.";
        if (!licenseText) return "La licence PServer n'a pas pu être chargée.";
        if (!licenseAccepted) return "Acceptez la licence PServer pour continuer.";
        if (!/^[A-Za-z0-9_-]+$/.test(licenseKey.trim())) return "La clé de licence est invalide.";
        return "";
    }

    function validateServerStep() {
        if (!serverName.trim()) return "Indiquez le nom du serveur.";
        if (!bindAddress) return "Indiquez l'adresse d'écoute.";
        if (bindMode === "custom") {
            try {
                const parsed = new URL(`http://${bindAddress.includes(":") ? `[${bindAddress}]` : bindAddress}`);
                if (parsed.hostname.replace(/^\[|\]$/g, "") !== bindAddress) throw new Error();
            } catch {
                return "L'adresse d'écoute doit être une adresse IP.";
            }
        }
        if (bindMode === "network" && (!serverHost.trim() || serverHost.includes("://") || /[/?#@]/.test(serverHost))) {
            return "Indiquez uniquement le nom ou l'adresse IP principale.";
        }
        if (serverPort === null || serverPort < 1024 || serverPort > 49151) {
            return "Le port doit être compris entre 1024 et 49151.";
        }
        if (activeDiscovery && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(discoveryName.trim())) {
            return "Le nom sur le réseau doit contenir uniquement des lettres, chiffres ou tirets.";
        }
        try {
            publicApiBase();
        } catch {
            return "L'adresse principale du serveur n'est pas valide.";
        }
        return "";
    }

    function validateDatabaseStep() {
        if (databaseType === "sqlite") {
            return sqlitePath.trim() ? "" : "Indiquez le fichier SQLite.";
        }
        if (!postgresHost.trim() || !postgresDatabase.trim() || !postgresUsername.trim() || !postgresPassword) {
            return "Complétez la connexion PostgreSQL.";
        }
        if (postgresPort === null || postgresPort < 1 || postgresPort > 65535) {
            return "Le port PostgreSQL est invalide.";
        }
        if (postgresSSLMode === "disable" && !["localhost", "127.0.0.1", "::1"].includes(postgresHost.trim().toLowerCase())) {
            return "TLS PostgreSQL ne peut être désactivé que pour une base locale.";
        }
        if (postgresSSLMode === "verify-full" && !postgresSSLRootCertificate.trim()) {
            return "Indiquez le certificat racine PostgreSQL.";
        }
        return "";
    }

    async function selectPostgresRootCertificate(file: File | null) {
        postgresSSLRootCertificateFile = file;
        postgresSSLRootCertificate = "";
        if (!file) return;
        try {
            postgresSSLRootCertificate = await file.text();
        } catch {
            postgresSSLRootCertificateFile = null;
            toast.error("Impossible de lire le certificat PostgreSQL.");
        }
    }

    function validateAdminStep() {
        if (!adminUsername.trim()) return "Indiquez l'identifiant administrateur.";
        if (adminPassword.length < 8) return "Le mot de passe doit contenir au moins 8 caractères.";
        if (adminPassword !== adminPasswordConfirm) return "Les mots de passe ne correspondent pas.";
        return "";
    }

    async function next() {
        if (stepIndex === 0) {
            goToStep(1);
            return;
        }
        if (flow === "connect") {
            if (stepIndex === 1) {
                let apiBase: string;
                try {
                    apiBase = userApiBase();
                } catch {
                    toast.error("L'adresse du serveur n'est pas valide.");
                    return;
                }
                if (!userServerAddress.trim()) {
                    toast.error("Indiquez l'adresse du serveur.");
                    return;
                }
                securityChecking = true;
                goToStep(2);
                try {
                    const [trusted] = await Promise.all([
                        isPServerTrusted(apiBase),
                        new Promise<void>((resolve) => window.setTimeout(resolve, 1200)),
                    ]);
                    if (trusted) {
                        completeUserOnboarding(apiBase, await getPServerIdentity(apiBase));
                        await showWelcome("/login");
                    }
                } catch (error) {
                    toast.error(error instanceof Error ? error.message : String(error));
                } finally {
                    securityChecking = false;
                }
            } else {
                await finishUserOnboarding();
            }
            return;
        }

        const validation = stepIndex === 1 ? validateLicenseStep()
            : stepIndex === 2 ? validateServerStep()
                : stepIndex === 3 ? validateDatabaseStep()
                    : validateAdminStep();
        if (validation) {
            toast.error(validation);
            return;
        }
        if (stepIndex === 1) {
            licenseLoading = true;
            try {
                await verifyPServerLicense(licenseKey.trim());
            } catch (error) {
                toast.error(error instanceof Error ? error.message : String(error));
                return;
            } finally {
                licenseLoading = false;
            }
        }
        if (isLastStep) await installServer();
        else goToStep(stepIndex + 1);
    }

    function prev() {
        goToStep(stepIndex - 1);
    }

    async function showWelcome(destination: string) {
        welcomeLeaving = false;
        welcome = true;
        await new Promise((resolve) => window.setTimeout(resolve, 2200));
        welcomeLeaving = true;
        await new Promise((resolve) => window.setTimeout(resolve, 350));
        await goto(destination, {
            replaceState: true,
            state: { transitionDirection: "forward" },
        });
    }

    async function installServer() {
        const validation = validateLicenseStep() || validateServerStep() || validateDatabaseStep() || validateAdminStep();
        if (validation) {
            toast.error(validation);
            return;
        }

        installLoading = true;
        try {
            const database = databaseConfig();
            const config = serverConfig(database);
            await launchServerInstaller(config, {
                licenseKey: licenseKey.trim(),
                adminUsername: adminUsername.trim(),
                adminPassword,
                databasePassword: database.type === "postgres" ? postgresPassword : undefined,
            });
            const installed = await getLocalServerServiceStatus();
            if (!installed.serverId) throw new Error("PServer n’a pas fourni son identité locale.");
            completeAdminOnboarding({
                serverId: installed.serverId,
                serverName: config.serverName,
                installTarget: config.installTarget,
                apiBaseUrl: config.apiBaseUrl,
                bindAddress: config.bindAddress,
                discoveryEnabled: config.discoveryEnabled,
                discoveryHostname: config.discoveryHostname,
                database: database.type === "postgres"
                    ? { ...database, sslRootCertificate: undefined }
                    : database,
                backendStatus: "external",
            });

            let destination = "/login";
            try {
                const login = await apiPost(
                    "/auth/login/",
                    { username: adminUsername.trim(), password: adminPassword },
                    false,
                    { redirectOnFailure: false },
                );
                if (!login?.authenticated) throw new Error("Automatic login failed.");
                clearBootstrapCache();
                destination = (await bootstrapClient({ force: true })).authenticated ? "/setup" : "/login";
            } catch (error) {
                console.error("Automatic administrator login failed", error);
            }

            adminPassword = "";
            adminPasswordConfirm = "";
            postgresPassword = "";
            await showWelcome(destination);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error || "Installation PServer impossible."));
        } finally {
            installLoading = false;
        }
    }

    async function finishUserOnboarding() {
        if (!/^\d{6}$/.test(pairingCode)) {
            toast.error("Le code d'association doit contenir 6 chiffres.");
            return;
        }
        pairingLoading = true;
        try {
            const apiBase = userApiBase();
            const identity = await pairPServer(apiBase, pairingCode);
            pairingCode = "";
            completeUserOnboarding(apiBase, identity);
            await showWelcome("/login");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            pairingLoading = false;
        }
    }

    async function searchServers() {
        discoveryLoading = true;
        try {
            discoveredServers = await discoverPServers();
            if (!discoveredServers.length) toast.error("Aucun PServer trouvé. Vous pouvez saisir son adresse manuellement.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        } finally {
            discoveryLoading = false;
        }
    }

    onMount(() => {
        void readLocalPServerLicense()
            .then((content) => licenseText = content)
            .catch((error) => console.error("Failed to load PServer license", error));

        if (!canUseLocalServerService()) return;
        void getLocalServerServiceStatus()
            .then((service) => localServerInstalled = isLocalPServerInstalled(service))
            .catch((error) => console.error("Failed to check local PServer", error));
    });
</script>

<section class="flex h-full w-full overflow-x-hidden overflow-y-auto bg-(--light-bg2) px-5 py-8 text-(--dark-bg1)">
    {#if welcome === false ? false : false}
        <div
            class="welcome-message m-auto text-center"
            class:welcome-leaving={welcomeLeaving}
            aria-live="polite"
        >
            Bienvenue dans PSoftware
        </div>
    {:else}
    <div class="m-auto flex w-full max-w-2xl flex-col items-center gap-5">
        <div class="flex min-h-32 w-full flex-col items-center justify-center gap-3 text-center">
            <div class="flex size-14 shrink-0 items-center justify-center text-(--user-color)">
                <svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
                    <path
                        d="M83.5609 23.1057L75.7735 44.8362C75.1662 46.5308 74.6567 48.255 74.2457 50C74.6567 51.745 75.1662 53.4692 75.7735 55.1638L83.5609 76.8943C84.2373 78.7816 81.9409 80.2839 80.5819 78.8431L74.1851 72.0608L78.8896 97.7832C79.277 99.9014 76.4568 100.895 75.513 98.9733L66.3321 80.2757C63.6624 74.8386 59.6228 70.2479 54.64 66.9882C49.6571 63.7284 43.9157 61.9207 38.0219 61.7556L17.7538 61.1882C15.6703 61.1298 15.3301 58.0684 17.3466 57.5227L44.0946 50.2847C44.4308 50.1938 44.7657 50.0988 45.0993 50C44.7657 49.9012 44.4308 49.8062 44.0946 49.7153L17.3466 42.4773C15.3301 41.9316 15.6703 38.8702 17.7538 38.8118L38.0219 38.2444C43.9157 38.0794 49.6571 36.2716 54.64 33.0118C59.6228 29.7521 63.6624 25.1614 66.3321 19.7243L75.513 1.02666C76.4568 -0.895413 79.277 0.0985982 78.8896 2.21678L74.1851 27.9392L80.5819 21.1569C81.9409 19.7161 84.2373 21.2184 83.5609 23.1057Z"
                        fill="currentColor"
                    />
                </svg>
            </div>

            <div class="grid min-h-12 w-full">
                {#key stepIndex}
                    <div
                        class="col-start-1 row-start-1"
                        in:fly={{ x: stepDirection * 24, duration: animationTime(), delay: animationTime(), easing: cubicOut }}
                        out:fly={{ x: stepDirection * -16, duration: animationTime(), easing: cubicIn }}
                    >
                        <h1 class="text-3xl font-black">{currentTitle}</h1>
                        <p class="mt-1 text-sm text-(--grey)">{currentDescription}</p>
                    </div>
                {/key}
            </div>
        </div>

        <StepProgress
            steps={flow === "install" ? installSteps : connectSteps}
            activeIndex={stepIndex}
            onSelect={(index) => {
                if (index < stepIndex) goToStep(index);
            }}
        />

        <div
            class="grid w-full overflow-hidden transition-[height] duration-(--animation-duration-400) ease-in-out"
            style={contentHeight === undefined ? undefined : `height: ${contentHeight}px`}
        >
            {#key stepIndex}
                <div
                    bind:clientHeight={contentHeight}
                    class="col-start-1 row-start-1 flex h-fit flex-col justify-center px-1"
                    in:fly={{ x: stepDirection * 20, duration: animationTime(), delay: animationTime() }}
                    out:fly={{ x: stepDirection * -20, duration: animationTime() }}
                >
                    <div class={`mx-auto flex w-full flex-col justify-center gap-4 p-2 ${flow === "install" && (stepIndex === 2 || stepIndex === 3) ? "max-w-lg" : "max-w-sm"}`}>
                    {#if stepIndex === 0}
                        <Radio
                            name="onboarding-flow"
                            bind:value={flow}
                            options={[
                                { label: "Installer ce serveur", value: "install", icon: "ServerCog", helpText: "Créer PServer et le premier administrateur.", hideCheckbox: true},
                                { label: "Me connecter", value: "connect", icon: "LogIn", helpText: "Utiliser un serveur déjà prêt.", hideCheckbox: true}
                            ]}
                            box
                            direction="vertical"
                            side="right"
                            groupClass="grid w-full gap-3 px-1"
                            parentClass="min-h-17 justify-center! px-4! py-3! text-left [&_.option-container]:items-center [&_.input-help-text]:mt-1 [&_.input-help-text]:text-xs"
                        />
                    {:else if flow === "connect" && stepIndex === 1}
                        {#each discoveredServers.length ? ["controls", "results"] : ["controls"] as section (section)}
                            <div
                                class={`flex w-full flex-col ${section === "controls" ? "gap-4" : "gap-1"}`}
                                animate:flip={{ duration: animationTime(400) }}
                                in:fly={{ y: section === "results" ? 16 : 0, duration: section === "results" ? animationTime(400) : 0 }}
                            >
                            {#if section === "controls"}
                                <TextInput
                                    label="Adresse du serveur"
                                    name="onboarding-server-url"
                                    placeholder="serveur.local:8000"
                                    prefix="https://"
                                    required
                                    bind:value={userServerAddress}
                                />
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon={discoveryLoading ? "LoaderCircle" : "Radar"}
                                    iconAnimation={discoveryLoading ? "spin" : undefined}
                                    label={discoveryLoading ? "Recherche..." : "Rechercher sur le réseau"}
                                    disabled={discoveryLoading || !canLaunchServerInstaller()}
                                    onclick={searchServers}
                                    class="w-full"
                                />
                            {:else}
                                <span class="text-xs text-(--grey) font-normal">Serveurs trouvés :</span>
                                <Radio
                                    name="discovered-pserver"
                                    bind:value={userServerAddress}
                                    options={discoveredServers.map((server) => ({
                                        label: server.name,
                                        value: new URL(server.apiBase).host,
                                        icon: "Server",
                                        helpText: new URL(server.apiBase).host,
                                        hideCheckbox: true,
                                    }))}
                                    box
                                    direction="vertical"
                                    groupClass="grid w-full gap-2"
                                    parentClass="min-h-17 justify-center! px-4! py-3! text-left [&_.option-container]:items-center [&_.input-help-text]:mt-1 [&_.input-help-text]:text-xs"
                                />
                            {/if}
                            </div>
                        {/each}
                    {:else if flow === "connect"}
                        {#if securityChecking}
                            <div class="flex items-center justify-center gap-2 py-5 text-sm text-(--grey)" role="status" aria-live="polite">
                                <Icon.Loader2 size={16} class="ui-loader-spin" />
                                Sécurisation de la connexion...
                            </div>
                        {:else}
                            <PinCodeInput
                                label="Code d'association"
                                name="pserver-pairing-code"
                                digits={6}
                                masked={false}
                                required
                                disabled={pairingLoading}
                                cellsClass="gap-1"
                                cellClass="text-2xl"
                                bind:value={pairingCode}
                            />
                        {/if}
                    {:else if stepIndex === 1}
                        <TextInput
                            label="Clé de licence"
                            name="pserver-license-key"
                            placeholder="Clé de licence"
                            required
                            icon="KeyRound"
                            iconSide="left"
                            bind:value={licenseKey}
                        />
                        <div class="flex justify-center">
                            <TextFileDialog
                                title="Licence PServer"
                                description="Licence logicielle applicable à PServer."
                                load={readLocalPServerLicense}
                                triggerLabel="Licence PServer"
                                triggerIcon="Scale"
                            />
                        </div>
                        <Checkbox
                            name="pserver-license-acceptance"
                            label="J'accepte la licence PServer"
                            required
                            disabled={!licenseText}
                            value={licenseAccepted}
                            on:change={(event) => licenseAccepted = event.detail}
                        />
                    {:else if stepIndex === 2}
                        <TextInput
                            label="Nom du serveur"
                            name="pserver-name"
                            placeholder="Serveur PSoft"
                            required
                            icon="Server"
                            iconSide="left"
                            bind:value={serverName}
                        />
                        <Radio
                            label="Accès au serveur"
                            name="pserver-bind-mode"
                            bind:value={bindMode}
                            options={[
                                { label: "Sur le réseau", value: "network", helpText: "Tous les appareils autorisés." },
                                { label: "Sur ce poste", value: "local", helpText: "Uniquement cet ordinateur." },
                                { label: "Adresse précise", value: "custom", helpText: "Une seule interface réseau." },
                            ]}
                            box
                            direction="horizontal"
                            parentClass="px-3! py-2.5! text-left [&_.input-help-text]:mt-1 [&_.input-help-text]:text-xs"
                        />
                        <div
                            class={`grid h-14 w-full items-end gap-2 overflow-hidden transition-[grid-template-columns] duration-(--animation-duration-400) ${
                                discoveryAvailable
                                    ? "grid-cols-[minmax(0,3fr)_minmax(0,1fr)]"
                                    : "grid-cols-[minmax(0,0fr)_minmax(0,4fr)]"
                            }`}
                        >
                            <div class="flex h-14 min-w-0 items-end overflow-hidden">
                                {#key bindMode}
                                    {#if bindMode === "network"}
                                        <div class="w-full" in:fly={{ y: 8, duration: animationTime(), delay: animationTime() }}>
                                            <TextInput
                                                label="Adresse principale"
                                                name="pserver-host"
                                                placeholder="localhost"
                                                required
                                                prefix="https://"
                                                bind:value={serverHost}
                                            />
                                        </div>
                                    {:else if bindMode === "custom"}
                                        <div class="w-full" in:fly={{ y: 8, duration: animationTime(), delay: animationTime() }}>
                                            <TextInput
                                                label="Adresse d'écoute"
                                                name="pserver-bind-address"
                                                placeholder="192.168.1.10"
                                                required
                                                icon="EthernetPort"
                                                iconSide="left"
                                                bind:value={customBindAddress}
                                            />
                                        </div>
                                    {/if}
                                {/key}
                            </div>
                            <div class="flex h-14 min-w-0 items-end">
                                <NumberInput
                                    label="Port"
                                    name="pserver-port"
                                    min={1024}
                                    max={49151}
                                    showControls={false}
                                    required
                                    bind:value={serverPort}
                                >
                                    {#snippet suffix()}
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon="Dices"
                                            tooltip="Choisir un port aléatoire"
                                            aria-label="Choisir un port aléatoire"
                                            onclick={() => serverPort = Math.floor(Math.random() * (49151 - 1024 + 1)) + 1024}
                                            class="w-fit rounded-none border-l border-(--light-bg3)"
                                        />
                                    {/snippet}
                                </NumberInput>
                            </div>
                        </div>
                        <div class="h-16 w-full overflow-hidden">
                            {#if discoveryAvailable}
                                <div
                                    class="grid h-16 w-full grid-cols-[minmax(0,1fr)_12rem] items-end gap-2"
                                    in:fly={{ duration: animationTime(), delay: animationTime() }}
                                >
                                    <div class="h-16 overflow-hidden">
                                        {#if discoveryEnabled}
                                            <div in:fly={{ y: 8, duration: animationTime(), delay: animationTime() }}>
                                                <TextInput
                                                    label="Nom sur le réseau"
                                                    name="pserver-mdns-name"
                                                    placeholder="pserver"
                                                    required
                                                    prefix="https://"
                                                    suffix=".local"
                                                    bind:value={discoveryName}
                                                />
                                            </div>
                                        {/if}
                                    </div>
                                    <div class="flex items-end pb-1">
                                        <Checkbox
                                            name="pserver-network-discovery"
                                            label="Découverte automatique"
                                            switchMode
                                            side="left"
                                            value={discoveryEnabled}
                                            on:change={(event) => discoveryEnabled = event.detail}
                                        />
                                    </div>
                                </div>
                            {/if}
                        </div>
                    {:else if stepIndex === 3}
                        {#each [
                            { id: "database" },
                            ...(databaseType === "sqlite"
                                ? [{ id: "sqlite" }]
                                : [
                                    { id: "connection" },
                                    { id: "credentials" },
                                    { id: "security" },
                                    ...(postgresSSLMode === "verify-full" ? [{ id: "certificate" }] : []),
                                ]),
                        ] as section (section.id)}
                            <div
                                class="w-full"
                                animate:flip={{ duration: animationTime(400) }}
                                in:fly={{
                                    y: section.id === "database" ? 0 : 8,
                                    duration: section.id === "database" ? 0 : animationTime(),
                                    delay: section.id === "database" ? 0 : animationTime(),
                                }}
                            >
                            {#if section.id === "database"}
                                <Radio
                                    label="Stockage des données"
                                    name="pserver-database"
                                    bind:value={databaseType}
                                    options={[
                                        { label: "SQLite", value: "sqlite", icon: "Cylinder", hideCheckbox: true, helpText: "Un fichier local simple à gérer." },
                                        { label: "PostgreSQL", value: "postgres", icon: "Database", hideCheckbox: true, helpText: "Un serveur existant avec ses outils de sauvegarde." },
                                    ]}
                                    box
                                    direction="horizontal"
                                    groupClass="grid w-full grid-cols-2 gap-2"
                                    parentClass="min-h-20 px-3! py-2.5! text-left [&_.input-help-text]:mt-1 [&_.input-help-text]:text-xs"
                                />
                            {:else if section.id === "sqlite"}
                                <TextInput
                                    label="Emplacement du fichier"
                                    name="pserver-sqlite-path"
                                    placeholder="C:\ProgramData\PServer\data\db.sqlite3"
                                    required
                                    icon="Database"
                                    iconSide="left"
                                    bind:value={sqlitePath}
                                />
                            {:else if section.id === "connection"}
                                <div class="flex w-full gap-2">
                                    <div class="min-w-0 flex-1">
                                        <TextInput
                                            label="Adresse du serveur"
                                            name="pserver-postgres-host"
                                            placeholder="localhost"
                                            required
                                            bind:value={postgresHost}
                                        />
                                    </div>
                                    <div class="w-28 shrink-0">
                                        <NumberInput
                                            label="Port"
                                            name="pserver-postgres-port"
                                            min={1}
                                            max={65535}
                                            showControls={false}
                                            required
                                            bind:value={postgresPort}
                                        />
                                    </div>
                                </div>
                            {:else if section.id === "credentials"}
                                <div class="grid w-full grid-cols-2 gap-2">
                                    <TextInput
                                        label="Base de données"
                                        name="pserver-postgres-database"
                                        placeholder="Nom de la base de données"
                                        required
                                        bind:value={postgresDatabase}
                                    />
                                    <TextInput
                                        label="Utilisateur"
                                        name="pserver-postgres-username"
                                        placeholder="Utilisateur"
                                        required
                                        bind:value={postgresUsername}
                                    />
                                </div>
                            {:else if section.id === "security"}
                                <div class="grid w-full grid-cols-2 gap-2">
                                    <PasswordInput
                                        label="Mot de passe"
                                        name="pserver-postgres-password"
                                        placeholder="Mot de passe"
                                        required
                                        showPassword
                                        icon="KeyRound"
                                        iconSide="both"
                                        bind:value={postgresPassword}
                                    />
                                    <Select
                                        label="Connexion TLS"
                                        name="pserver-postgres-ssl-mode"
                                        allowDeselect={false}
                                        bind:value={postgresSSLMode}
                                        options={[
                                            { label: "Chiffrée", value: "require" },
                                            { label: "Certificat vérifié", value: "verify-full" },
                                            { label: "Sans TLS (local)", value: "disable" },
                                        ]}
                                    />
                                </div>
                            {:else}
                                <FileInput
                                    label="Certificat racine PostgreSQL"
                                    name="pserver-postgres-ssl-root-certificate"
                                    accept=".crt,.pem,application/x-pem-file"
                                    placeholder="Choisir le certificat"
                                    required
                                    maxSize={MAX_POSTGRES_SSL_ROOT_CERTIFICATE_BYTES}
                                    bind:value={postgresSSLRootCertificateFile}
                                    onchange={selectPostgresRootCertificate}
                                />
                            {/if}
                            </div>
                        {/each}
                    {:else}
                        <TextInput
                            label="Identifiant admin"
                            name="pserver-admin-username"
                            placeholder="admin"
                            required
                            icon="CircleUser"
                            iconSide="left"
                            bind:value={adminUsername}
                        />
                        <PasswordInput
                            label="Mot de passe admin"
                            name="pserver-admin-password"
                            placeholder="Mot de passe"
                            required
                            showPassword
                            icon="LockKeyhole"
                            iconSide="both"
                            bind:value={adminPassword}
                        />
                        <PasswordInput
                            label="Vérification"
                            name="pserver-admin-password-confirm"
                            placeholder="Répétez le mot de passe"
                            required
                            showPassword
                            icon="LockKeyhole"
                            iconSide="both"
                            bind:value={adminPasswordConfirm}
                        />
                    {/if}
                    </div>
                </div>
            {/key}
        </div>

        <div class="mt-5 flex w-full justify-between gap-2">
            <Button
                variant="secondary"
                label="Retour"
                icon="MoveLeft"
                disabled={stepIndex === 0 || installLoading || licenseLoading || securityChecking || pairingLoading}
                onclick={prev}
                class="w-1/3 disabled:cursor-context-menu disabled:opacity-0 [&_svg]:transition-transform [&_svg]:duration-(--animation-duration-150) hover:[&_svg]:-translate-x-0.5"
            />
            <Button
                variant="primary"
                label={installLoading ? "Installation..." : licenseLoading || securityChecking ? "Vérification..." : pairingLoading ? "Association..." : isLastStep && flow === "install" ? "Installer" : isLastStep ? "Associer" : "Suivant"}
                icon={installLoading || licenseLoading || securityChecking || pairingLoading ? "Loader" : isLastStep ? "Check" : "MoveRight"}
                iconSide="right"
                iconAnimation={installLoading || licenseLoading || securityChecking || pairingLoading ? "spin" : undefined}
                disabled={installLoading || licenseLoading || securityChecking || pairingLoading}
                onclick={next}
                class={`w-1/3 ${installLoading || licenseLoading || securityChecking || pairingLoading ? undefined : "[&_svg]:transition-transform [&_svg]:duration-(--animation-duration-150) hover:[&_svg]:translate-x-0.5"}`}
            />
        </div>
    </div>

    {#if flow === "connect" && localServerInstalled}
        <div class="fixed right-5 bottom-5">
            <Button
                variant="ghost"
                size="sm"
                label="État de PServer"
                icon="ServerCog"
                onclick={() => goto("/server-debug")}
                class="w-fit text-(--grey) hover:bg-(--light-bg3) hover:text-(--dark-bg1)"
            />
        </div>
    {/if}
    {/if}
</section>

<style>
    .welcome-message {
        overflow: hidden;
        font-family: "Segoe Script", "Brush Script MT", cursive;
        font-size: clamp(2rem, 5vw, 3.5rem);
        line-height: 1.4;
        color: var(--dark-bg1);
        white-space: nowrap;
        clip-path: inset(0 100% 0 0);
        animation: welcome-write 1.6s cubic-bezier(0.22, 1, 0.36, 1) 0.15s forwards;
        transition: opacity 350ms ease, filter 350ms ease, transform 350ms ease;
    }

    .welcome-message.welcome-leaving {
        opacity: 0;
        filter: blur(8px);
        transform: scale(1.02);
    }

    @keyframes welcome-write {
        to {
            clip-path: inset(0 0 0 0);
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .welcome-message {
            clip-path: none;
            animation: none;
        }
    }
</style>
