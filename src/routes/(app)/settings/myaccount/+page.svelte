<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { Dialog } from "bits-ui";
    import { slide } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import * as Icon from "lucide-svelte";

    import MyDialog from "$lib/components/MyDialog.svelte";
    import {
        SettingsExpandableRow,
        SettingsGroup,
        SettingsPage,
        SettingsRow,
        SettingsSection,
        SettingsTable,
    } from "$lib/components/settings";
    import { Button, ColorPicker, PasswordInput, PinCodeInput, TextInput } from "$lib/components/istyler";
    import { apiDelete, apiGet, apiPatch, apiPost, isAuthRedirectError } from "$lib/api";
    import { currentUser, setAuthState } from "$lib/auth";
    import { bootstrapSettings } from "$lib/settings";
    import { clearBootstrapCache } from "$lib/system";
    import { animationTime } from "$lib/uiPreferences";
    import { loadCurrentDevice } from "$lib/device";
    import { strftime } from "$lib/utils";

    type Account = {
        username: string;
        name: string;
        lastname: string;
        mail: string;
        phone: string;
        color: string;
        role: string | null;
        isAdmin: boolean;
        quickLogin: {
            badgeEnabled: boolean;
            badgeUserEnabled: boolean;
            badgeActive: boolean;
            available: boolean;
            hasPin: boolean;
            hasBadge: boolean;
            badgeLabel: string | null;
        };
    };

    type AccountSession = {
        id?: string;
        current: boolean;
        device: string;
        status: string;
        expiresAt: string;
        loginAt?: string | null;
        ipAddress?: string | null;
    };

    type LoadStep<T> = {
        label: string;
        run: () => Promise<T>;
        apply?: (value: T) => void;
    };

    const PIN_DIGITS = 6;

    let account = $state<Account | null>(null);
    let sessions = $state<AccountSession[]>([]);
    let loading = $state(true);
    let quickLoginAllowed = $state(false);
    let quickLoginExpanded = $state(false);
    let profileDialogOpen = $state(false);
    let passwordDialogOpen = $state(false);
    let pinDialogOpen = $state(false);
    let expandedSessionId = $state<string | null>(null);

    let profile = $state({
        username: "",
        name: "",
        lastname: "",
        mail: "",
        phone: "",
        color: "#6366F1",
    });

    let password = $state({
        current: "",
        next: "",
        confirmation: "",
    });

    let pin = $state({
        next: "",
        confirmation: "",
        currentPassword: "",
    });

    let badgeDialogOpen = $state(false);
    let badgeCode = $state("");
    let savingProfile = $state(false);
    let savingPassword = $state(false);
    let savingPin = $state(false);
    let savingBadge = $state(false);
    let loggingOut = $state(false);
    let loggingOutAll = $state(false);
    let loggingOutSession = $state<string | null>(null);

    const badgeText = $derived(account?.quickLogin.hasBadge
        ? account.quickLogin.badgeUserEnabled
            ? account.quickLogin.badgeLabel ?? "Associé"
            : "Désactivé"
        : "Non associé");
    const pinText = $derived(account?.quickLogin.hasPin ? "Défini" : "Non défini");
    const quickLoginDetailsVisible = $derived(Boolean(
        account && (!account.quickLogin.hasBadge || account.quickLogin.badgeUserEnabled),
    ));
    const profileSummary = $derived(account
        ? [account.name, account.lastname].filter(Boolean).join(" ") || account.username
        : "Chargement");
    const visibleSessions = $derived(sessions.length
        ? sessions
        : [{
            id: "current-session",
            current: true,
            device: "Cet appareil",
            status: "Actif",
            expiresAt: "",
            loginAt: null,
            ipAddress: null,
        }]);

    function syncProfile(data: Account) {
        account = data;
        profile = {
            username: data.username ?? "",
            name: data.name ?? "",
            lastname: data.lastname ?? "",
            mail: data.mail ?? "",
            phone: data.phone ?? "",
            color: data.color ?? "#6366F1",
        };
        quickLoginExpanded = !data.quickLogin.hasBadge || data.quickLogin.badgeUserEnabled;
    }

    function firstError(value: unknown): string | null {
        if (typeof value === "string") return value;
        if (Array.isArray(value)) {
            for (const item of value) {
                const found = firstError(item);
                if (found) return found;
            }
        }
        if (value && typeof value === "object") {
            for (const item of Object.values(value)) {
                const found = firstError(item);
                if (found) return found;
            }
        }
        return null;
    }

    function requestError(error: unknown, fallback: string) {
        const data = error && typeof error === "object" && "data" in error
            ? (error as { data?: unknown }).data
            : null;
        return firstError(data) ?? fallback;
    }

    function displayDate(value?: string | null, fallback = "Non disponible") {
        if (!value) return fallback;

        try {
            return strftime(value, "%x %H:%M", "fr-FR");
        } catch {
            return fallback;
        }
    }

    function sessionKey(session: AccountSession, index: number) {
        return session.id ?? `session-${index}`;
    }

    function toggleSession(key: string) {
        expandedSessionId = expandedSessionId === key ? null : key;
    }

    function handleSessionKeydown(event: KeyboardEvent, key: string) {
        if (event.key !== "Enter" && event.key !== " ") return;
        event.preventDefault();
        toggleSession(key);
    }

    function openProfileDialog() {
        if (account) syncProfile(account);
        profileDialogOpen = true;
    }

    function openPasswordDialog() {
        password = { current: "", next: "", confirmation: "" };
        passwordDialogOpen = true;
    }

    function openPinDialog() {
        pin = { next: "", confirmation: "", currentPassword: "" };
        pinDialogOpen = true;
    }

    function handleQuickLoginToggle(nextValue: boolean) {
        if (!account) return;
        if (!account.quickLogin.hasBadge) {
            quickLoginExpanded = true;
            return;
        }

        if (nextValue === account.quickLogin.badgeUserEnabled) return;
        void setBadgeEnabled(nextValue);
    }

    async function loadAccount() {
        const data = await apiGet("/auth/me/");
        syncProfile(data);
    }

    async function loadSessions() {
        await loadCurrentDevice();
        const data = await apiGet("/auth/me/sessions/");
        sessions = Array.isArray(data?.sessions) ? data.sessions : [];
    }

    async function runLoadStep<T>(step: LoadStep<T>) {
        try {
            const value = await step.run();
            step.apply?.(value);
            return null;
        } catch (error) {
            if (isAuthRedirectError(error)) return null;
            console.error(`Failed to load ${step.label}`, error);
            return requestError(error, `Impossible de charger ${step.label}.`);
        }
    }

    async function saveProfile() {
        if (!profile.username.trim() || !profile.name.trim()) {
            toast.error("L’identifiant et le prénom sont obligatoires.");
            return;
        }

        savingProfile = true;
        try {
            const data = await apiPatch("/auth/me/", {
                username: profile.username,
                name: profile.name,
                lastname: profile.lastname,
                mail: profile.mail,
                phone: profile.phone,
                color: profile.color,
            });
            syncProfile(data);
            currentUser.update((user) => user ? { ...user, username: data.username, name: data.name, lastname: data.lastname, color: data.color } : user);
            profileDialogOpen = false;
            toast.success("Informations enregistrées.");
        } catch (error) {
            toast.error(requestError(error, "Impossible d'enregistrer les informations."));
        } finally {
            savingProfile = false;
        }
    }

    async function savePassword() {
        if (!password.current || !password.next || !password.confirmation) {
            toast.error("Tous les champs du mot de passe sont obligatoires.");
            return;
        }
        if (password.next !== password.confirmation) {
            toast.error("La confirmation ne correspond pas.");
            return;
        }

        savingPassword = true;
        try {
            await apiPost("/auth/me/password/", {
                current_password: password.current,
                new_password: password.next,
                new_password_confirmation: password.confirmation,
            });
            password = { current: "", next: "", confirmation: "" };
            passwordDialogOpen = false;
            toast.success("Mot de passe modifié.");
        } catch (error) {
            toast.error(requestError(error, "Impossible de modifier le mot de passe."));
        } finally {
            savingPassword = false;
        }
    }

    function requestPinChange() {
        if (!quickLoginAllowed) return;
        if (!pin.next || !pin.confirmation) {
            toast.error("Le code PIN et sa confirmation sont obligatoires.");
            return;
        }
        if (pin.next !== pin.confirmation) {
            toast.error("La confirmation du PIN ne correspond pas.");
            return;
        }
        if (pin.next.length !== PIN_DIGITS || !/^\d+$/.test(pin.next)) {
            toast.error(`Le code PIN doit contenir ${PIN_DIGITS} chiffres.`);
            return;
        }
        if (!pin.currentPassword) {
            toast.error("Le mot de passe est obligatoire.");
            return;
        }

        void savePin();
    }

    async function savePin() {
        if (!quickLoginAllowed) return;
        savingPin = true;
        try {
            await apiPost("/auth/fast-login/pin/", {
                pin: pin.next,
                pin_confirmation: pin.confirmation,
                current_password: pin.currentPassword,
            });
            pin = { next: "", confirmation: "", currentPassword: "" };
            pinDialogOpen = false;
            await loadAccount();
            toast.success("Code PIN enregistré.");
        } catch (error) {
            toast.error(requestError(error, "Impossible d'enregistrer le code PIN."));
        } finally {
            savingPin = false;
        }
    }

    async function saveBadge() {
        if (!quickLoginAllowed) return;
        if (!badgeCode.trim()) {
            toast.error("Scannez ou saisissez le code du badge.");
            return;
        }

        savingBadge = true;
        try {
            await apiPost("/auth/fast-login/badge/", { code: badgeCode });
            badgeCode = "";
            badgeDialogOpen = false;
            await loadAccount();
            toast.success("Badge associé.");
        } catch (error) {
            toast.error(requestError(error, "Impossible d'associer ce badge."));
        } finally {
            savingBadge = false;
        }
    }

    async function setBadgeEnabled(enabled: boolean) {
        savingBadge = true;
        try {
            await apiPatch("/auth/fast-login/badge/", { enabled });
            if (account) {
                account = {
                    ...account,
                    quickLogin: {
                        ...account.quickLogin,
                        badgeUserEnabled: enabled,
                        badgeActive: enabled && account.quickLogin.badgeEnabled && account.quickLogin.hasBadge,
                    },
                };
                quickLoginExpanded = !account.quickLogin.hasBadge || enabled;
            }
            await loadAccount();
        } catch (error) {
            await loadAccount();
            toast.error(requestError(error, enabled ? "Impossible d'activer ce badge." : "Impossible de désactiver ce badge."));
        } finally {
            savingBadge = false;
        }
    }

    async function removeBadge() {
        savingBadge = true;
        try {
            await apiDelete("/auth/fast-login/badge/");
            await loadAccount();
            toast.success("Badge retiré.");
        } catch (error) {
            toast.error(requestError(error, "Impossible de retirer ce badge."));
        } finally {
            savingBadge = false;
        }
    }

    async function logoutCurrentDevice() {
        loggingOut = true;
        try {
            await apiPost("/auth/logout/", {});
            clearBootstrapCache();
            setAuthState(false);
            await goto("/login");
        } catch (error) {
            toast.error(requestError(error, "Impossible de déconnecter cet appareil."));
        } finally {
            loggingOut = false;
        }
    }

    async function logoutAllDevices() {
        loggingOutAll = true;
        try {
            await apiDelete("/auth/me/sessions/?scope=others");
            await loadSessions();
            toast.success("Les autres sessions ont été fermées.");
        } catch (error) {
            toast.error(requestError(error, "Impossible de fermer les sessions."));
        } finally {
            loggingOutAll = false;
        }
    }

    async function logoutSession(session: AccountSession, index: number) {
        const key = sessionKey(session, index);

        if (session.current) {
            await logoutCurrentDevice();
            return;
        }

        if (!session.id) {
            toast.error("Cette session ne peut pas être fermée individuellement.");
            return;
        }

        loggingOutSession = key;
        try {
            await apiDelete(`/auth/me/sessions/?id=${encodeURIComponent(session.id)}`);
            await loadSessions();
            if (expandedSessionId === key) expandedSessionId = null;
            toast.success("Session fermée.");
        } catch (error) {
            toast.error(requestError(error, "Impossible de fermer cette session."));
        } finally {
            loggingOutSession = null;
        }
    }

    onMount(async () => {
        const errors = await Promise.all([
            runLoadStep({
                label: "les paramètres du compte",
                run: bootstrapSettings,
                apply: (settings) => quickLoginAllowed = settings.value.team.badgeLoginEnabled,
            }),
            runLoadStep({ label: "le compte", run: loadAccount }),
            runLoadStep({ label: "les sessions", run: loadSessions }),
        ]);
        const error = errors.find(Boolean);
        if (error) toast.error(error);
        loading = false;
    });
</script>

<SettingsPage
    title="Mon compte"
    description="Gérez votre identité, votre mot de passe et vos accès rapides."
>
    <SettingsSection label="Identité">
        <SettingsRow
            icon="UserRound"
            title="Informations personnelles"
            description={loading ? "Chargement des informations du compte." : profileSummary}
            toneClass="bg-blue-50 text-blue-700"
            badge={loading ? "Chargement" : undefined}
        >
            {#snippet right()}
                <Button
                    variant="secondary"
                    size="sm"
                    icon="Pencil"
                    label="Modifier"
                    class="w-fit"
                    disabled={loading || !account}
                    onclick={openProfileDialog}
                />
            {/snippet}
        </SettingsRow>
    </SettingsSection>

    <SettingsSection label="Sécurité du compte">
        <SettingsRow
            icon="KeyRound"
            title="Mot de passe"
            description="Modifier le mot de passe utilisé pour se connecter au compte."
            toneClass="bg-amber-50 text-amber-700"
        >
            {#snippet right()}
                <Button
                    variant="secondary"
                    size="sm"
                    icon="KeyRound"
                    label="Modifier"
                    class="w-fit"
                    onclick={openPasswordDialog}
                />
            {/snippet}
        </SettingsRow>

        {#if quickLoginAllowed && account?.quickLogin.available}
            <SettingsExpandableRow
                icon="BadgeCheck"
                title="Connexion rapide"
                description="Configurer le badge et le PIN utilisés pour la connexion rapide."
                name="account-badge"
                toneClass="bg-emerald-50 text-emerald-700"
                bind:value={quickLoginExpanded}
                onChange={handleQuickLoginToggle}
                bodyPadding={false}
                badges={[
                    {
                        text: badgeText,
                        class: account.quickLogin.badgeActive
                            ? "bg-(--transparent-green) text-(--green)"
                            : account.quickLogin.hasBadge
                                ? "bg-(--transparent-red) text-(--red)"
                                : undefined,
                    },
                    ...(quickLoginDetailsVisible
                        ? [{ text: pinText, class: account.quickLogin.hasPin ? "bg-(--transparent-green) text-(--green)" : undefined }]
                        : []),
                ]}
            >
                {#if quickLoginDetailsVisible}
                    <SettingsGroup>
                        <SettingsRow
                            title="Badge associé"
                            description={account.quickLogin.hasBadge
                                ? "Gérer le badge utilisé pour la connexion rapide."
                                : "Associer le badge utilisé pour la connexion rapide."}
                            inline={true}
                        >
                            {#snippet right()}
                                <div class="flex gap-2">
                                    {#if account?.quickLogin.hasBadge}
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            icon={savingBadge ? "Loader" : "Trash2"}
                                            iconAnimation={savingBadge ? "spin" : undefined}
                                            label="Retirer"
                                            disabled={savingBadge}
                                            confirm={true}
                                            confirmTitle="Retirer le badge ?"
                                            confirmDescription="La connexion rapide ne fonctionnera plus avec ce badge."
                                            confirmCancelLabel="Annuler"
                                            confirmConfirmLabel="Retirer"
                                            confirmConfirmVariant="error"
                                            onclick={removeBadge}
                                        />
                                    {/if}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon="BadgePlus"
                                        label={account?.quickLogin.hasBadge ? "Remplacer" : "Associer"}
                                        disabled={savingBadge}
                                        onclick={() => {
                                            badgeCode = "";
                                            badgeDialogOpen = true;
                                        }}
                                    />
                                </div>
                            {/snippet}
                        </SettingsRow>

                        <SettingsRow
                            title="Code PIN"
                            description={`Définir le code numérique à ${PIN_DIGITS} chiffres demandé après le scan du badge.`}
                            inline={true}
                        >
                            {#snippet right()}
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    icon="KeyRound"
                                    label="Modifier"
                                    disabled={savingPin}
                                    onclick={openPinDialog}
                                />
                            {/snippet}
                        </SettingsRow>
                    </SettingsGroup>
                {/if}
            </SettingsExpandableRow>
        {/if}
    </SettingsSection>

    <SettingsSection label="Sessions">
        <SettingsRow
            icon="MonitorCheck"
            title="Sessions actives"
            description="Voir les sessions actuellement utilisées."
            badge={`${visibleSessions.length} active${visibleSessions.length > 1 ? "s" : ""}`}
            toneClass="bg-emerald-50 text-emerald-700"
            bodyPadding={false}
        >
            {#snippet table()}
                <SettingsTable
                    class="border-t-0"
                    headerRowClass="border-y grid grid-cols-[minmax(0,1fr)_7rem_minmax(8rem,1fr)_2.5rem]"
                    columns={[
                        { key: "device", label: "Appareil" },
                        { key: "status", label: "État" },
                        { key: "expiresAt", label: "Expiration", align: "right" },
                        { key: "open", label: "", class: "w-10", align: "right" },
                    ]}
                    rows={visibleSessions}
                >
                    {#snippet row(session, index)}
                        {@const key = sessionKey(session, index)}
                        {@const expanded = expandedSessionId === key}
                        <tr class="border-b border-(--light-bg3) last:border-b-0">
                            <td colspan="4" class="p-0">
                                <div
                                    class="group grid cursor-pointer grid-cols-[minmax(0,1fr)_7rem_minmax(8rem,1fr)_2.5rem] items-center transition-colors hover:bg-(--light-bg2)"
                                    role="button"
                                    tabindex="0"
                                    aria-expanded={expanded}
                                    onclick={() => toggleSession(key)}
                                    onkeydown={(event) => handleSessionKeydown(event, key)}
                                >
                                    <div class="px-4 py-2 font-medium text-(--dark-bg1)">
                                        {session.device}
                                        {#if session.current}
                                            <span class="ml-2 rounded-sm bg-(--transparent-green) px-2 py-0.5 text-[11px] font-semibold text-(--green)">Cet appareil</span>
                                        {/if}
                                    </div>
                                    <div class="px-4 py-2 text-(--dark-bg1)">{session.current ? "Actif" : session.status}</div>
                                    <div class="px-4 py-2 text-right text-(--dark-bg1)">{displayDate(session.expiresAt, "Session en cours")}</div>
                                    <div class="px-4 py-2 text-right">
                                        <Icon.ChevronDown
                                            size={16}
                                            class="ml-auto shrink-0 text-(--grey) transition-all duration-(--animation-duration-100) {expanded ? 'rotate-180' : ''}"
                                        />
                                    </div>
                                </div>

                                {#if expanded}
                                    <div
                                        class="grid gap-3 border-t border-(--light-bg3) bg-(--light-bg2)/40 px-4 py-3 text-xs text-(--dark-bg1) md:grid-cols-[1fr_1fr_auto]"
                                        transition:slide={{ duration: animationTime() }}
                                    >
                                        <div>
                                            <div class="font-semibold">Adresse IP</div>
                                            <div class="mt-1 text-(--grey)">{session.ipAddress || "Non disponible"}</div>
                                        </div>
                                        <div>
                                            <div class="font-semibold">Connexion</div>
                                            <div class="mt-1 text-(--grey)">{displayDate(session.loginAt)}</div>
                                        </div>
                                        <div class="flex items-start justify-end">
                                            <Button
                                                variant="error"
                                                size="sm"
                                                icon={loggingOutSession === key || (session.current && loggingOut) ? "Loader" : "LogOut"}
                                                iconAnimation={loggingOutSession === key || (session.current && loggingOut) ? "spin" : undefined}
                                                label="Déconnecter"
                                                class="w-fit"
                                                disabled={loggingOutSession === key || loggingOut}
                                                confirm={true}
                                                confirmTitle={session.current ? "Déconnecter cet appareil ?" : "Fermer cette session ?"}
                                                confirmDescription={session.current ? "La session de cet appareil sera fermée." : "Cette session sera fermée sans toucher aux autres appareils."}
                                                confirmCancelLabel="Annuler"
                                                confirmConfirmLabel="Déconnecter"
                                                confirmConfirmVariant="error"
                                                onclick={() => logoutSession(session, index)}
                                            />
                                        </div>
                                    </div>
                                {/if}
                            </td>
                        </tr>
                    {/snippet}
                </SettingsTable>
            {/snippet}
        </SettingsRow>

        <SettingsGroup>
            <SettingsRow
                icon="MonitorX"
                title="Déconnexion des autres appareils"
                description="Fermer toutes les autres sessions en gardant celle-ci ouverte."
                variant="destructive"
            >
                {#snippet right()}
                    <Button
                        variant="error"
                        size="sm"
                        icon={loggingOutAll ? "Loader" : "MonitorX"}
                        iconAnimation={loggingOutAll ? "spin" : undefined}
                        label="Fermer les autres"
                        disabled={loggingOutAll}
                        confirm={true}
                        confirmTitle="Déconnecter les autres appareils ?"
                        confirmDescription="Toutes les autres sessions seront fermées. Votre session actuelle restera ouverte."
                        confirmCancelLabel="Annuler"
                        confirmConfirmLabel="Fermer les autres"
                        confirmConfirmVariant="error"
                        onclick={logoutAllDevices}
                    />
                {/snippet}
            </SettingsRow>

            <SettingsRow
                icon="LogOut"
                title="Déconnexion de ce poste"
                description="Déconnecter uniquement cet appareil."
                variant="destructive"
            >
                {#snippet right()}
                    <Button
                        variant="error"
                        size="sm"
                        icon={loggingOut ? "Loader" : "LogOut"}
                        iconAnimation={loggingOut ? "spin" : undefined}
                        label="Déconnecter"
                        disabled={loggingOut}
                        confirm={true}
                        confirmTitle="Déconnecter ce poste ?"
                        confirmDescription="La session de cet appareil sera fermée."
                        confirmCancelLabel="Annuler"
                        confirmConfirmLabel="Déconnecter"
                        confirmConfirmVariant="error"
                        onclick={logoutCurrentDevice}
                    />
                {/snippet}
            </SettingsRow>
        </SettingsGroup>
    </SettingsSection>
</SettingsPage>

<Dialog.Root bind:open={profileDialogOpen}>
    <Dialog.Portal>
        <MyDialog
            class="max-h-[min(44rem,calc(100vh-4rem))]! w-[min(52rem,calc(100vw-2rem))]! rounded-xl"
            layout="sectioned"
            title="Modifier les informations personnelles"
            description="Mettez à jour les informations visibles sur votre compte."
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingProfile}
                    onclick={() => (profileDialogOpen = false)}
                />
                <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    form="account-profile-form"
                    icon={savingProfile ? "Loader" : "Save"}
                    iconAnimation={savingProfile ? "spin" : undefined}
                    label="Enregistrer"
                    class="w-fit px-2.5 font-semibold"
                    disabled={loading || savingProfile}
                />
            {/snippet}

            <form
                id="account-profile-form"
                class="grid gap-4 md:grid-cols-2"
                onsubmit={(event) => {
                    event.preventDefault();
                    void saveProfile();
                }}
            >
                <TextInput
                    name="account-username"
                    label="Identifiant"
                    placeholder="camille.martin"
                    autocomplete="off"
                    autocapitalize="none"
                    spellcheck="false"
                    required
                    bind:value={profile.username}
                    disabled={loading || savingProfile}
                />
                <ColorPicker
                    label="Couleur"
                    ariaLabel="Choisir la couleur du profil"
                    fallback="#6366F1"
                    class="size-10"
                    bind:value={profile.color}
                    disabled={loading || savingProfile}
                />
                <TextInput
                    name="account-lastname"
                    label="Nom"
                    placeholder="Martin"
                    autocomplete="off"
                    bind:value={profile.lastname}
                    disabled={loading || savingProfile}
                />
                <TextInput
                    name="account-name"
                    label="Prénom"
                    placeholder="Camille"
                    required
                    autocomplete="off"
                    bind:value={profile.name}
                    disabled={loading || savingProfile}
                />
                <div class="md:col-span-2">
                    <TextInput
                        name="account-role"
                        label="Rôle"
                        value={account?.role ?? (account?.isAdmin ? "Administrateur" : "Utilisateur")}
                        readonly
                        disabled
                    />
                </div>
                <TextInput
                    name="account-phone"
                    label="Téléphone"
                    type="tel"
                    placeholder="06 12 34 56 78"
                    autocomplete="off"
                    inputmode="tel"
                    bind:value={profile.phone}
                    disabled={loading || savingProfile}
                />
                <TextInput
                    name="account-email"
                    label="E-mail de contact"
                    type="email"
                    placeholder="nom@exemple.com"
                    autocomplete="off"
                    inputmode="email"
                    bind:value={profile.mail}
                    disabled={loading || savingProfile}
                />
            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={passwordDialogOpen}>
    <Dialog.Portal>
        <MyDialog
            class="w-[min(36rem,calc(100vw-2rem))]! rounded-xl"
            layout="sectioned"
            title="Modifier le mot de passe"
            description="Saisissez votre mot de passe actuel puis choisissez un nouveau mot de passe."
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingPassword}
                    onclick={() => (passwordDialogOpen = false)}
                />
                <Button
                    variant="primary"
                    size="sm"
                    icon={savingPassword ? "Loader" : "Save"}
                    iconAnimation={savingPassword ? "spin" : undefined}
                    label="Modifier"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingPassword}
                    onclick={savePassword}
                />
            {/snippet}

            <div class="flex flex-col gap-4">
                <PasswordInput
                    name="current-password"
                    label="Mot de passe actuel"
                    required
                    showPassword
                    icon="KeyRound"
                    iconSide="both"
                    bind:value={password.current}
                    disabled={savingPassword}
                />
                <PasswordInput
                    name="new-password"
                    label="Nouveau mot de passe"
                    required
                    showPassword
                    icon="LockKeyhole"
                    iconSide="both"
                    bind:value={password.next}
                    disabled={savingPassword}
                />
                <PasswordInput
                    name="confirm-password"
                    label="Confirmation"
                    required
                    showPassword
                    icon="LockKeyhole"
                    iconSide="both"
                    bind:value={password.confirmation}
                    disabled={savingPassword}
                />
            </div>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={pinDialogOpen}>
    <Dialog.Portal>
        <MyDialog
            class="w-[min(34rem,calc(100vw-2rem))]! rounded-xl"
            layout="sectioned"
            title="Modifier le code PIN"
            description={`Choisissez un code numérique à ${PIN_DIGITS} chiffres pour la connexion rapide.`}
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingPin}
                    onclick={() => (pinDialogOpen = false)}
                />
                <Button
                    variant="primary"
                    size="sm"
                    icon={savingPin ? "Loader" : "KeyRound"}
                    iconAnimation={savingPin ? "spin" : undefined}
                    label="Enregistrer"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingPin}
                    onclick={requestPinChange}
                />
            {/snippet}

            <div class="flex flex-col gap-4">
                <PinCodeInput
                    name="fast-pin"
                    label="Nouveau PIN"
                    digits={PIN_DIGITS}
                    bind:value={pin.next}
                    required
                    disabled={savingPin}
                />
                <PinCodeInput
                    name="fast-pin-confirmation"
                    label="Confirmation"
                    digits={PIN_DIGITS}
                    bind:value={pin.confirmation}
                    required
                    disabled={savingPin}
                />
                <div class="flex flex-col gap-2">
                    <p class="text-xs leading-4 text-(--grey)">
                        Confirmez avec votre mot de passe pour appliquer ce changement sensible.
                    </p>
                    <PasswordInput
                        name="fast-pin-current-password"
                        label="Mot de passe"
                        required
                        showPassword
                        icon="KeyRound"
                        iconSide="both"
                        bind:value={pin.currentPassword}
                        disabled={savingPin}
                    />
                </div>
            </div>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>

<Dialog.Root bind:open={badgeDialogOpen}>
    <Dialog.Portal>
        <MyDialog
            class="w-100! rounded-xl"
            layout="sectioned"
            title="Associer un badge"
            description="Scannez une carte ou saisissez son code pour l'associer à ce compte."
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingBadge}
                    onclick={() => (badgeDialogOpen = false)}
                />
                <Button
                    variant="primary"
                    size="sm"
                    icon={savingBadge ? "Loader" : "BadgeCheck"}
                    iconAnimation={savingBadge ? "spin" : undefined}
                    label="Associer"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingBadge}
                    onclick={saveBadge}
                />
            {/snippet}

            <div>
                <TextInput
                    name="badge-code"
                    label="Code du badge"
                    placeholder="Scanner ou saisir le code"
                    scanSensitive={true}
                    bind:value={badgeCode}
                    disabled={savingBadge}
                />
            </div>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
