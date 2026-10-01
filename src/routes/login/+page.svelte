<script lang="ts">
    import { Dialog } from "bits-ui";
    import CompanyLogo from "$lib/components/CompanyLogo.svelte";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { TextInput, PasswordInput, Button, PinCodeInput } from "$lib/components/istyler";
    import { goto } from "$app/navigation";
    import { apiPost } from "$lib/api";
    import { setAuthState } from "$lib/auth";
    import { toast } from "svelte-sonner";
    import { fly } from "svelte/transition";
    import { onMount, tick } from "svelte";
    import { appSettings } from "$lib/settings";
    import { bootstrapClient, clearBootstrapCache, getCachedBootstrap } from "$lib/system";
    import { animationTime } from "$lib/uiPreferences";
    import { getStartupRoute } from "$lib/startupRoute";
    import { isDefaultDeviceName, loadCurrentDevice } from "$lib/device";
    import { canUseLocalServerService, getCachedLocalServerServiceStatus, getLocalServerServiceStatus } from "$lib/localServerService";

    type AuthResponse = {
        status: number;
        data : {
            authenticated?: boolean;
            message?: string;
            isNew?: boolean;
        };
        // keep it open in case backend returns more fields
        [key: string]: unknown;
    };

    const cachedBootstrap = getCachedBootstrap();

    let username: string = $state("");
    let password: string = $state("");

    let code: string = $state("");
    let pin: string = $state("");

    // Shared UI state
    let errorMessage: string = $state("");
    let isLoginLoading: boolean = $state(false);
    let isFastLoginLoading: boolean = $state(false);
    let isPasswordChangeLoading: boolean = $state(false);
    let badgeLoginEnabled: boolean = $state($appSettings.value.team.badgeLoginEnabled);
    let passwordChangeRequired: boolean = $state(cachedBootstrap?.authenticated === true && cachedBootstrap.user?.isNew === true);
    let localServerInstalled = $state(getCachedLocalServerServiceStatus()?.available === true);
    let currentPasswordForChange: string = $state("");
    let newPassword: string = $state("");
    let newPasswordConfirmation: string = $state("");

    /* ---------------- Shared helpers ---------------- */

    function clearError() {
        errorMessage = "";
    }

    async function handleSuccess(message: string, redirectTo = getStartupRoute()) {
        clearError();
        toast.success(message);

        try {
            if (isDefaultDeviceName((await loadCurrentDevice()).name)) {
                await goto(`/device-setup?next=${encodeURIComponent(redirectTo)}`, {
                    state: { transitionDirection: "forward" },
                });
                return;
            }
        } catch (error) {
            console.error("Failed to check current device after login", error);
        }

        await goto(redirectTo, { state: { transitionDirection: "forward" } });
    }

    function extractStatus(err: unknown): number | undefined {
        if (typeof err !== "object" || err === null) return undefined;

        const anyErr = err as { status?: number; response?: { status?: number } };

        if (typeof anyErr.status === "number") return anyErr.status;
        if (anyErr.response && typeof anyErr.response.status === "number") {
            return anyErr.response.status;
        }
        return undefined;
    }

    type SafePostOptions = {
        message400?: string; // optional custom message for 400
    };

    async function safePost( url: string, payload: Record<string, unknown>, options: SafePostOptions = {} ): Promise<AuthResponse | null> {
        try {
            const response = await apiPost(url, payload, true);
            return response as AuthResponse;
        } catch (err) {
            console.error(`Request to ${url} failed:`, err);

            const status = extractStatus(err);

            let msg: string;
            
            if (status === 400 && options.message400) {
                // client-side / invalid credentials, etc.
                msg = options.message400;
            } else if (status && status >= 500) {
                // server-side problem
                msg = "Une erreur serveur est survenue. Veuillez réessayer plus tard.";
            } else {
                // fallback for network / unknown errors
                msg = "Impossible de contacter le serveur PSoft. Ouvrez le diagnostic serveur.";
            }

            errorMessage = msg;
            toast.error(msg);
            return null;
        }
    }

    /* ---------------- Normal login ---------------- */

    export async function login() {
        if (!username || !password) {
            const msg = "Veuillez saisir un nom d'utilisateur et un mot de passe.";
            errorMessage = msg;
            toast.error(msg);
            return false;
        }

        isLoginLoading = true;

        const response = await safePost(
            "/auth/login/",
            { username, password },
            {
                message400: "Nom d'utilisateur ou mot de passe incorrect.",
            },
        );
        isLoginLoading = false;

        if (!response) return false;
            
        if (response.data.authenticated) {
            clearBootstrapCache();
            setAuthState(true);
            if (response.data.isNew) {
                await bootstrapClient({ force: true });
                currentPasswordForChange = password;
                password = "";
                newPassword = "";
                newPasswordConfirmation = "";
                passwordChangeRequired = true;
                return true;
            }

            await handleSuccess("Connexion réussie !");
            return true;
        }

        return false;
    }

    /* ---------------- Fast login (code + pin) ---------------- */

    export async function fastLogin() {
        if (!code || !pin) {
            toast.error("Veuillez saisir le code et le PIN.");
            return false;
        }

        isFastLoginLoading = true;

        const response = await safePost(
            "/auth/fast-login/",
            { code, pin },
            {
                message400: "Code ou PIN incorrect.",
            },
        );

        isFastLoginLoading = false;
        pin = "";
        
        if (!response) return false;

        if (response.status === 200) {
            clearBootstrapCache();
            setAuthState(true);
            if (response.data.isNew) {
                await bootstrapClient({ force: true });
                currentPasswordForChange = "";
                passwordChangeRequired = true;
                toast.info("Choisissez un nouveau mot de passe pour activer ce compte.");
                return true;
            }

            await handleSuccess("Connexion rapide réussie !");
            return true;
        }

        return false;
    }


    async function completePasswordChange() {
        const minLength = $appSettings.value.team.minPasswordLength;
        const currentPassword = currentPasswordForChange || password;

        if (!currentPassword || !newPassword || !newPasswordConfirmation) {
            toast.error("Tous les champs du mot de passe sont obligatoires.");
            return false;
        }
        if (newPassword.length < minLength) {
            toast.error(`Le mot de passe doit contenir au moins ${minLength} caractères.`);
            return false;
        }
        if (newPassword !== newPasswordConfirmation) {
            toast.error("La confirmation ne correspond pas.");
            return false;
        }
        if (newPassword === currentPassword) {
            toast.error("Le nouveau mot de passe doit être différent du mot de passe initial.");
            return false;
        }

        isPasswordChangeLoading = true;
        const response = await safePost(
            "/auth/me/password/",
            {
                current_password: currentPassword,
                new_password: newPassword,
                new_password_confirmation: newPasswordConfirmation,
            },
            { message400: "Impossible de modifier ce mot de passe." },
        );
        isPasswordChangeLoading = false;

        if (!response) return false;

        password = "";
        currentPasswordForChange = "";
        newPassword = "";
        newPasswordConfirmation = "";
        clearBootstrapCache();
        await bootstrapClient({ force: true });
        await handleSuccess("Mot de passe modifié.");
        return true;
    }



    // focus on pin when code is read
    let pinInputContainer = $state<HTMLElement | null>(null);
    $effect(() => {
        if (code) tick().then(() =>
            pinInputContainer?.querySelector("input")?.focus()
        );
    });

    onMount(() => {
        if (canUseLocalServerService()) {
            void getLocalServerServiceStatus()
                .then((service) => localServerInstalled = service.available)
                .catch((error) => console.error("Failed to check local PServer", error));
        }

        void bootstrapClient()
            .then((bootstrap) => {
                badgeLoginEnabled = $appSettings.value.team.badgeLoginEnabled;
                const required = bootstrap.authenticated && bootstrap.user?.isNew === true;
                passwordChangeRequired = required;
            })
            .catch(() => {
                badgeLoginEnabled = false;
            });

        const handleEnter = (event: KeyboardEvent) => {
            if (event.key === "Enter") void (passwordChangeRequired ? completePasswordChange() : login());
        };

        document.addEventListener("keypress", handleEnter);
        return () => document.removeEventListener("keypress", handleEnter);
    });

</script>

<section class="relative flex h-full w-full items-center justify-center overflow-auto bg-(--light-bg2) px-5 py-8 text-(--dark-bg1)">
    <div class="flex h-fit w-full max-w-sm flex-col items-center justify-between gap-4">
        <CompanyLogo class="h-[75px] w-52" />

        {#if passwordChangeRequired}
            <div class="flex flex-col items-center w-sm">
                <div class="flex justify-center font-black text-4xl font-(family-name:--font)">
                    Encore un pas !
                </div>
            </div>
            <form
                class="flex w-full flex-col items-center gap-4 rounded-lg"
                onsubmit={(event) => {
                    event.preventDefault();
                    void completePasswordChange();
                }}
            >
                <div class="text-center text-sm leading-5 text-(--grey)">
                    Modifiez votre mot de passe pour activer ce compte.
                </div>

                {#if !currentPasswordForChange}
                    <PasswordInput
                        label="Mot de passe actuel"
                        name="first-login-current-password"
                        placeholder="Mot de passe actuel"
                        required
                        showPassword
                        icon="KeyRound"
                        iconSide="both"
                        bind:value={password}
                        disabled={isPasswordChangeLoading}
                    />
                {/if}

                <PasswordInput
                    label="Nouveau mot de passe"
                    name="first-login-new-password"
                    placeholder="Nouveau mot de passe"
                    required
                    showPassword
                    icon="LockKeyhole"
                    iconSide="both"
                    helpText={`Minimum ${$appSettings.value.team.minPasswordLength} caractères.`}
                    helpTextIcon
                    bind:value={newPassword}
                    disabled={isPasswordChangeLoading}
                />

                <PasswordInput
                    label="Vérification"
                    name="first-login-new-password-confirmation"
                    placeholder="Répétez le nouveau mot de passe"
                    required
                    showPassword
                    icon="LockKeyhole"
                    iconSide="both"
                    bind:value={newPasswordConfirmation}
                    disabled={isPasswordChangeLoading}
                />

                <Button
                    variant="primary"
                    type="submit"
                    label="Activer le compte"
                    iconSide="right"
                    icon={isPasswordChangeLoading ? "Loader" : "KeyRound"}
                    iconAnimation={isPasswordChangeLoading ? "spin" : undefined}
                    disabled={isPasswordChangeLoading}
                />
            </form>
        {:else}
            <div class="flex flex-col items-center w-sm ">
                <div class="flex justify-center font-black text-4xl font-(family-name:--font)">
                    Ravi de vous revoir !
                </div>
            </div>
            {#if badgeLoginEnabled}
            <div class="flex gap-2.5 w-full m-auto" style="flex-direction: column;">
                <Dialog.Root onOpenChange={() => code = ""}>
                    <Dialog.Trigger>
                        {#snippet child({ props })}
                            <Button {...props} variant="primary" label="Connexion rapide" icon="ScanBarcode"/>
                        {/snippet}
                    </Dialog.Trigger>
                    <Dialog.Portal>
                        <MyDialog trapFocus={false}>
                            <div class="flex gap-1 w-80 justify-center flex-col items-center;">
                                <div class="flex justify-center font-bold text-2xl">
                                    Connexion rapide
                                </div>
                                <div class="flex justify-center font-normal text-xs">
                                    {!code ? 'Scannez le code barre de votre carte employé' : 'Entrez votre code PIN'}
                                </div>
                            </div>

                            {#key code}
                            <div class="self-center w-80 flex relative box-border items-center justify-center pt-5"
                                in:fly={{ y: -20, duration: animationTime() }}>

                                {#if !code }
                                <div class="flex-center">
                                    <TextInput
                                        hidden
                                        type="text"
                                        scanSensitive

                                        bind:value={code}
                                    />

                                    <div class="w-17 aspect-square border-(--user-color-transparent) border-r-(--user-color) animate-spin rounded-full border-4"></div>
                                    <!-- <div class="h-10 w-10 bg-(--user-color) absolute rounded-full animate-ping"></div> -->
                                    <div class="flex absolute">
                                        <svg
                                            viewBox="10 0 90 100"
                                            fill="none"
                                            xmlns="http://www.w3.org/2000/svg"
                                            style="height: 50px;"
                                        >
                                            <path
                                                d="M83.5609 23.1057L75.7735 44.8362C75.1662 46.5308 74.6567 48.255 74.2457 50C74.6567 51.745 75.1662 53.4692 75.7735 55.1638L83.5609 76.8943C84.2373 78.7816 81.9409 80.2839 80.5819 78.8431L74.1851 72.0608L78.8896 97.7832C79.277 99.9014 76.4568 100.895 75.513 98.9733L66.3321 80.2757C63.6624 74.8386 59.6228 70.2479 54.64 66.9882C49.6571 63.7284 43.9157 61.9207 38.0219 61.7556L17.7538 61.1882C15.6703 61.1298 15.3301 58.0684 17.3466 57.5227L44.0946 50.2847C44.4308 50.1938 44.7657 50.0988 45.0993 50C44.7657 49.9012 44.4308 49.8062 44.0946 49.7153L17.3466 42.4773C15.3301 41.9316 15.6703 38.8702 17.7538 38.8118L38.0219 38.2444C43.9157 38.0794 49.6571 36.2716 54.64 33.0118C59.6228 29.7521 63.6624 25.1614 66.3321 19.7243L75.513 1.02666C76.4568 -0.895413 79.277 0.0985982 78.8896 2.21678L74.1851 27.9392L80.5819 21.1569C81.9409 19.7161 84.2373 21.2184 83.5609 23.1057Z"
                                                fill="var(--user-color)"
                                            ></path>
                                        </svg>
                                    </div>
                                </div>

                                {:else}
                                    <div class="flex w-full flex-col gap-5" bind:this={pinInputContainer}>
                                        <PinCodeInput bind:value={pin} digits={6} onComplete={fastLogin} />
                                    </div>
                                {/if}
                            </div>
                            {/key}

                        </MyDialog>
                    </Dialog.Portal>
                </Dialog.Root>
            </div>

            <div class="text-(--light-grey) flex w-full items-center gap-2.5 font-bold text-xs font-(family-name:--font)">
                <hr class="h-px w-full rounded-full border-0 bg-(--light-grey)" />
                OU
                <hr class="h-px w-full rounded-full border-0 bg-(--light-grey)" />
            </div>

        {/if}
        <div class="flex w-full flex-col items-center gap-4 rounded-lg">

            <TextInput
                label="Identifiant"
                type="text"
                name="pp-username"
                placeholder="Identifiant"
                required
                icon="CircleUser"
                iconSide="left"
                bind:value={username}
            />

            <PasswordInput
                label="Mot de passe"
                name="pp-password"
                placeholder="Mot de passe"
                required
                showPassword
                showPasswordIcons="Eye, EyeOff"
                icon="KeyRound"
                iconSide="both"
                bind:value={password}
            />

            <div class="flex gap-2.5 w-full m-auto">
                <Button variant="primary" label="Se connecter" onclick={login} iconSide="right"
                    icon={isLoginLoading ? 'Loader' : 'LogIn'} iconAnimation={isLoginLoading ? 'spin' : undefined}
                />
            </div>

            <div class="flex justify-center text-(--grey) font-normal text-xs font-(family-name:--font)">
                Pas encore de compte ? Contactez votre administrateur.
            </div>

            <span
                id="message"
                style="font: 500 10px var(--principal-font); color: var(--red); background: #f2133b1f; padding: 5px 10px; box-sizing: border-box; border-radius: 5px;display: none;"
            ></span>
        </div>
        {/if}
    </div>

    {#if localServerInstalled}
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
    <div class="fixed left-5 bottom-5">
        <Button
            variant="ghost"
            size="sm"
            label="Reconfigurer"
            icon="MonitorCog"
            onclick={() => goto("/onboarding")}
            class="w-fit text-(--grey) hover:bg-(--light-bg3) hover:text-(--dark-bg1)"
        />
    </div>
</section>
