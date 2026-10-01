<script lang="ts">
    import { goto } from "$app/navigation";
    import { apiGet, apiPost, isAuthRedirectError } from "$lib/api";
    import { setAuthState } from "$lib/auth";
    import { Button } from "$lib/components/istyler";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import { operationPlural } from "$lib/operationDisplay";
    import { appSettings } from "$lib/settings";
    import { clearBootstrapCache } from "$lib/system";
    import { memberRoleDisplay, type TeamRoleSummary } from "$lib/team";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import AccountStatistics from "./AccountStatistics.svelte";
    import UserAvatar from "$lib/components/UserAvatar.svelte";

    type Account = {
        username: string;
        name: string;
        lastname: string;
        mail: string;
        phone: string;
        color: string;
        roleDetails: TeamRoleSummary | null;
        isAdmin: boolean;
        isSuperuser: boolean;
    };

    type PeriodMetric = {
        current: number;
        days: number;
    };

    type PersonalStatistics = {
        operations: PeriodMetric | null;
        clients: PeriodMetric | null;
        documents: PeriodMetric | null;
    };

    type PersonalStatistic = PeriodMetric & { label: string };

    let account = $state<Account | null>(null);
    let statistics = $state<PersonalStatistics | null>(null);
    let statisticsUnavailable = $state(false);
    let loading = $state(true);
    let loadError = $state("");
    let loggingOut = $state(false);

    const displayName = $derived(
        account
            ? [account.name, account.lastname]
                  .filter(Boolean)
                  .join(" ")
                  .trim() || account.username
            : "",
    );
    const roleDisplay = $derived(
        account
            ? memberRoleDisplay({
                  role: account.roleDetails,
                  isAdmin: account.isAdmin,
                  isSuperuser: account.isSuperuser,
              })
            : null,
    );
    const personalStatistics = $derived.by((): PersonalStatistic[] => {
        if (!statistics) return [];

        const items: PersonalStatistic[] = [];
        if (statistics.operations) {
            items.push({
                label: operationPlural($appSettings.value.operation),
                current: Number(statistics.operations.current) || 0,
                days: Number(statistics.operations.days) || 7,
            });
        }
        if (statistics.clients) {
            items.push({
                label: "Clients ajoutés",
                current: Number(statistics.clients.current) || 0,
                days: Number(statistics.clients.days) || 30,
            });
        }
        if (statistics.documents) {
            items.push({
                label: "Reçus émis",
                current: Number(statistics.documents.current) || 0,
                days: Number(statistics.documents.days) || 30,
            });
        }
        return items;
    });

    async function loadOverview() {
        loading = true;
        loadError = "";
        statisticsUnavailable = false;

        const [accountResult, dashboardResult] = await Promise.allSettled([
            apiGet("/auth/me/"),
            apiGet("/core/dashboard/?scope=personal"),
        ]);

        if (accountResult.status === "rejected") {
            if (!isAuthRedirectError(accountResult.reason)) {
                console.error(
                    "Failed to load account overview",
                    accountResult.reason,
                );
                loadError = "Impossible de charger les informations du compte.";
            }
            loading = false;
            return;
        }

        account = accountResult.value;

        if (
            dashboardResult.status === "fulfilled" &&
            dashboardResult.value?.statistics?.scope === "personal"
        ) {
            statistics = dashboardResult.value.statistics;
        } else {
            if (dashboardResult.status === "rejected") {
                console.error(
                    "Failed to load personal statistics",
                    dashboardResult.reason,
                );
                statisticsUnavailable = true;
            }
            statistics = null;
        }

        loading = false;
    }

    async function logout() {
        loggingOut = true;
        try {
            await apiPost("/auth/logout/", {});
            clearBootstrapCache();
            setAuthState(false);
            await goto("/login");
        } catch (error) {
            console.error("Failed to log out", error);
            toast.error("Impossible de se déconnecter de cet appareil.");
        } finally {
            loggingOut = false;
        }
    }

    onMount(() => {
        void loadOverview();
    });
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <header
        class="flex h-14 min-h-14 shrink-0 items-center justify-between gap-4 border-b border-(--light-bg3) bg-(--light-bg1) px-6"
    >
        <div class="min-w-0">
            <h1 class="truncate text-lg font-bold text-(--dark-bg1)">Compte</h1>
            <p class="truncate text-xs text-(--grey)">
                Votre profil et votre activité.
            </p>
        </div>
    </header>

    <section class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        <div class="flex w-full max-w-full flex-col gap-5">
            {#if loading}
                <div
                    class="flex min-h-52 items-center justify-center gap-2 text-sm text-(--grey)"
                    role="status"
                >
                    <Icon.Loader2 size={16} class="ui-loader-spin" />
                    Chargement du compte...
                </div>
            {:else if loadError || !account}
                <section
                    class="flex min-h-52 items-center justify-center rounded-xl border border-(--light-bg3) bg-(--light-bg1) px-6"
                >
                    <div
                        class="flex max-w-sm flex-col items-center text-center"
                    >
                        <Icon.AlertCircle size={20} class="text-(--red)" />
                        <p class="mt-3 text-sm font-semibold">
                            {loadError || "Compte indisponible."}
                        </p>
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="RefreshCw"
                            label="Réessayer"
                            class="mt-4 w-fit"
                            onclick={loadOverview}
                        />
                    </div>
                </section>
            {:else}
                <section class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
                    <div class="flex flex-col gap-4 border-b border-(--light-bg3) px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                        <div class="flex min-w-0 items-center gap-3">
                            <UserAvatar user={account} class="size-10 text-sm" />
                            <div class="min-w-0">
                                <div class="flex min-w-0 flex-wrap items-center gap-2">
                                    <h2 class="min-w-0 truncate text-sm font-bold text-(--dark-bg1)">{displayName}</h2>
                                    {#if roleDisplay}
                                        <DisplayValue value={roleDisplay} display="role" />
                                    {/if}
                                </div>
                                <p class="mt-0.5 truncate text-xs text-(--grey)">@{account.username}</p>
                            </div>
                        </div>

                        <div class="flex shrink-0 items-center">
                            <Button
                                variant="secondary"
                                size="sm"
                                icon="Settings"
                                label="Paramètres du compte"
                                class="w-fit shrink-0"
                                onclick={() => void goto("/settings/myaccount")}
                            />
                        </div>
                    </div>

                    <dl class="flex flex-col divide-y divide-(--light-bg3) sm:flex-row sm:divide-x sm:divide-y-0">
                        <div class="min-w-0 flex-1 px-4 py-3">
                            <dt class="text-xs font-semibold text-(--grey)">E-mail</dt>
                            <dd class="mt-1 truncate text-sm text-(--dark-bg1)">{account.mail || "Non renseigné"}</dd>
                        </div>
                        <div class="min-w-0 flex-1 px-4 py-3">
                            <dt class="text-xs font-semibold text-(--grey)">Téléphone</dt>
                            <dd class="mt-1 truncate text-sm text-(--dark-bg1)">{account.phone || "Non renseigné"}</dd>
                        </div>
                    </dl>
                </section>

                {#if personalStatistics.length || statisticsUnavailable}
                    <section class="flex flex-col gap-2">
                        <h2 class="px-1 text-sm font-bold text-(--dark-bg1)">Votre activité</h2>
                        {#if personalStatistics.length}
                            <AccountStatistics items={personalStatistics} />
                        {:else}
                            <div
                                class="rounded-xl border border-(--light-bg3) bg-(--light-bg1) px-4 py-3 text-sm text-(--grey)"
                            >
                                Les statistiques personnelles sont momentanément
                                indisponibles.
                            </div>
                        {/if}
                    </section>
                {/if}

                <div class="flex justify-end">
                    <Button
                        variant="error"
                        size="sm"
                        icon={loggingOut ? "Loader" : "LogOut"}
                        iconAnimation={loggingOut ? "spin" : undefined}
                        label="Se déconnecter"
                        class="w-fit shrink-0 disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={loggingOut}
                        confirm={true}
                        confirmTitle="Se déconnecter de ce poste ?"
                        confirmDescription="La session de cet appareil sera fermée."
                        confirmCancelLabel="Annuler"
                        confirmConfirmLabel="Se déconnecter"
                        confirmConfirmVariant="error"
                        onclick={logout}
                    />
                </div>
            {/if}
        </div>
    </section>
</div>
