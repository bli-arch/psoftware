<script lang="ts">
    import { MenuContainer, Menu, NavButton, MenuClose } from "$lib/components/menu";
    import * as Icon from "lucide-svelte";
    import { page } from "$app/stores";
    import { afterNavigate, goto } from "$app/navigation";
    import { delayedClass } from "$lib/utils";
    import { onMount } from "svelte";
    import { appSettings, bootstrapSettings } from "$lib/settings";
    import { currentUser } from "$lib/auth";
    import { operationPlural } from "$lib/operationDisplay";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { animationTime } from "$lib/uiPreferences";
    import { rememberStartupRoute } from "$lib/startupRoute";
    import { workspaceSetup } from "$lib/system";
    import { refreshAppTitle } from "$lib/appTitle";
    import { toast } from "svelte-sonner";
    import { getServerLogFragments } from "$lib/adminServer";
    import { setupBarcodeScanner } from "$lib/components/istyler/barcodeScanner";
    import { verifyReceiptBarcode } from "$lib/documents";
    import { apiGet } from "$lib/api";
    import { Dialog } from "bits-ui";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button } from "$lib/components/istyler";
    import CompanyLogo from "$lib/components/CompanyLogo.svelte";
    import UserAvatar from "$lib/components/UserAvatar.svelte";
    import { companyBranding } from "$lib/companyBranding";
    import { TEAM_LIST_PERMISSIONS } from "$lib/team";
    import { setupRouteTransition } from "$lib/routeTransition";

    const isCurrentPage = (regex: RegExp, pathname: string) => regex.test(pathname);
    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));
    const canAny = (keys: readonly string[]) => keys.some(can);
    const routeOrder = ["home", "operations", "clients", "team", "settings", "account"];
    let routeContainer: HTMLElement | null = null;
    let resolvingScan = false;
    let scanChoiceOpen = false;
    let scannedUid = "";
    $: clientSetupRequired = can("settings.client.modify") && Boolean($workspaceSetup && (!$workspaceSetup.clientForm || !$workspaceSetup.clientColumns || !$workspaceSetup.clientIdentifier));
    $: operationSetupRequired = can("settings.operation.modify") && Boolean($workspaceSetup && (!$workspaceSetup.operationForm || !$workspaceSetup.operationColumns || !$workspaceSetup.operationStatuses || !$workspaceSetup.operationIdentifier));

    onMount(() => {
        void bootstrapSettings();
        void apiGet("/auth/me/")
            .then((account) => {
                currentUser.update((user) => user?.id === account.id
                    ? { ...user, name: account.name, lastname: account.lastname, color: account.color }
                    : user);
            })
            .catch((error) => console.error("Failed to load sidebar profile", error));
        void refreshAppTitle()
            .then(() => {
                if (can("settings.server.modify")) void notifyServerMaintenance();
            })
            .catch((error) => console.error("Failed to load workspace setup", error));
    });

    onMount(() => setupBarcodeScanner(
        (value) => void openScannedRecord(value),
        { minLength: 1, minLengthOnTimeout: 3, ignoreEditable: true },
    ).destroy);

    async function openScannedRecord(value: string) {
        if (resolvingScan || scanChoiceOpen) return;
        const isReceipt = /^91\d{40}$/.test(value);
        if (isReceipt && (!can("documents.view") || !can("operations.view_details"))) {
            toast.error("Vous n’avez pas l’autorisation de vérifier ce reçu.");
            return;
        }
        resolvingScan = true;
        try {
            if (isReceipt) {
                const receipt = await verifyReceiptBarcode(value);
                await goto(`/operations/${encodeURIComponent(receipt.operation_uid)}`);
                return;
            }
            const sections = ["operations", "clients"].filter((section) => can(`${section}.view_details`));
            if (sections.length === 0) {
                toast.error("Vous n’avez pas l’autorisation de consulter ces fiches.");
                return;
            }
            const matches = (await Promise.all(sections.map(async (section) => {
                try {
                    const record = await apiGet(`/core/${section}/${encodeURIComponent(value)}/`);
                    return record.uid === value ? section : null;
                } catch (error) {
                    if (error && typeof error === "object" && "status" in error && error.status === 404) return null;
                    throw error;
                }
            }))).filter((section) => section !== null);
            if (matches.length === 1) {
                await goto(`/${matches[0]}/${encodeURIComponent(value)}`);
            } else if (matches.length > 1) {
                scannedUid = value;
                scanChoiceOpen = true;
            } else {
                toast.error("Aucune fiche accessible ne correspond à cet identifiant.");
            }
        } catch (error) {
            const data = error && typeof error === "object" && "data" in error
                ? (error as { data?: { detail?: unknown } }).data
                : undefined;
            toast.error(typeof data?.detail === "string" ? data.detail : isReceipt ? "Impossible de vérifier ce reçu." : "Impossible de retrouver cette fiche.");
        } finally {
            resolvingScan = false;
        }
    }

    async function notifyServerMaintenance() {
        const logs = await getServerLogFragments().catch(() => null);
        if (!logs) return;

        const invalid = !logs.archiveError
            && (!logs.manifestIntegrity || logs.results.some((fragment) => !fragment.integrity));
        const expiring = logs.results.filter((fragment) => !fragment.deletedAt && !fragment.quarantinedAt && fragment.daysUntilDeletion <= 30).length;
        const recentlyDeleted = logs.results.filter((fragment) => fragment.deletedAt && Date.now() - new Date(fragment.deletedAt).getTime() < 7 * 86400000).length;
        if (invalid) toast.error("L'intégrité d'au moins une archive de journaux est invalide.");
        else if (expiring) toast.warning(`${expiring} archive${expiring > 1 ? "s" : ""} de journaux sera supprimée dans moins de 30 jours.`);
        if (recentlyDeleted) toast.info(`${recentlyDeleted} archive${recentlyDeleted > 1 ? "s ont" : " a"} été supprimée récemment selon la rétention d'un an.`);
    }

    const routeKey = (pathname: string) => pathname.startsWith("/settings") ? "settings" : pathname;

    setupRouteTransition(() => routeContainer, (from, to) => {
        if (routeKey(from.pathname) === routeKey(to.pathname)) return null;
        const fromSection = from.pathname.split("/")[1] || "home";
        const toSection = to.pathname.split("/")[1] || "home";
        const fromRoute = routeOrder.indexOf(fromSection);
        const toRoute = routeOrder.indexOf(toSection);
        if (fromRoute === -1 || toRoute === -1) return null;
        return {
            direction: toRoute === fromRoute
                ? (to.pathname.split("/").length >= from.pathname.split("/").length ? 1 : -1)
                : (toRoute > fromRoute ? 1 : -1),
            fade: true,
        };
    }, { useNativeViewTransition: false });

    afterNavigate(({ to }) => {
        if (to?.url) rememberStartupRoute(`${to.url.pathname}${to.url.search}`);
    });
</script>

<Dialog.Root bind:open={scanChoiceOpen}>
    <Dialog.Portal>
        <MyDialog layout="sectioned" title="Choisir une fiche" description={`L’identifiant ${scannedUid} correspond à une opération et à un client.`}>
            <div class="flex gap-3">
                {#each ["operations", "clients"] as section}
                    <Button label={section === "operations" ? "Ouvrir l’opération" : "Ouvrir le client"} onclick={() => {
                        scanChoiceOpen = false;
                        void goto(`/${section}/${encodeURIComponent(scannedUid)}`);
                    }} />
                {/each}
            </div>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>


<MenuContainer let:collapsed id="main-sb" class="z-50">

    <MenuClose
        id="main-sb"
        class="size-fit flex-center absolute -right-5 top-1/2 -translate-x-1/2 z-50 bg-(--light-bg2) border border-(--light-bg3) rounded-full text-(--dark-bg1) cursor-pointer p-1
               transition-all duration-(--animation-duration) delay-(--animation-delay-300) opacity-0 group-hover/sidebar-container:opacity-100 group-hover/sidebar-container:delay-0"
    >
        <Icon.ChevronRight size={12} class={`min-w-3 transition-transform duration-(--animation-duration) ${collapsed ? "rotate-0" : "rotate-180"}`} />
    </MenuClose>

    <div class="flex w-fit items-center gap-2.5 pb-2.5">
        <CompanyLogo class="size-10 shrink-0 overflow-hidden rounded-lg" />

        <div
            class="transition-all duration-(--animation-duration-150)"
            class:opacity-0={collapsed}
            use:delayedClass={{ className: "hidden", delay: animationTime(), condition: collapsed }}
        >
            <span class="block w-30 truncate font-(family-name:--font) text-lg font-bold" style="text-fit: shrink" title={$companyBranding.companyName}>
                {$companyBranding.companyName}
            </span>
        </div>

    </div>
    
    <Menu>
        <NavButton {collapsed} href="/home" active={isCurrentPage(/^\/$|\/home/, $page.url.pathname)} title="Accueil">
            <Icon.Home size=16 class="min-w-5" />
        </NavButton>

        <NavButton {collapsed} href="/operations" active={isCurrentPage(/\/operations/, $page.url.pathname)} title={operationPlural($appSettings.value.operation)}>
            <LucideIcon name={$appSettings.value.operation.operationIcon as any} size={16} class="min-w-5" />
        </NavButton>

        {#if canAny(["clients.view_list", "clients.view_details", "clients.create"])}
            <NavButton {collapsed} href="/clients" active={isCurrentPage(/\/clients/, $page.url.pathname)} title="Clients">
                <Icon.BookUser size=16 class="min-w-5" />
            </NavButton>
        {/if}

        {#if canAny(TEAM_LIST_PERMISSIONS)}
            <NavButton {collapsed} href="/team" active={isCurrentPage(/^\/team(?:\/|$)/, $page.url.pathname)} title="Équipe">
                <Icon.Users size=16 class="min-w-5" />
            </NavButton>
        {/if}

    </Menu>
    <Menu end>
        <NavButton {collapsed} href="/settings" active={isCurrentPage(/\/settings/, $page.url.pathname)} title="Paramètres" attention={clientSetupRequired || operationSetupRequired}>
            <Icon.Settings size=16 class="min-w-5" />
        </NavButton>

        <NavButton {collapsed} href="/account" active={isCurrentPage(/\/account/, $page.url.pathname)} title="Compte">
            <UserAvatar user={$currentUser} class="size-5 text-[8px]" />
        </NavButton>
    </Menu>
</MenuContainer>


<div class="relative min-w-0 flex-1 overflow-hidden bg-(--light-bg2)">
    <main bind:this={routeContainer} class="absolute inset-0 flex min-w-0 overflow-auto bg-(--light-bg2)">
        <slot />
    </main>
</div>
