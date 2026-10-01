<script lang="ts">
    import { page } from "$app/stores";
    import { MenuContainer, Menu, NavButton, MenuClose } from "$lib/components/menu";
    import { delayedClass } from "$lib/utils";
    import { animationTime } from "$lib/uiPreferences";
    import { appSettings } from "$lib/settings";
    import { currentUser } from "$lib/auth";
    import { operationPlural } from "$lib/operationDisplay";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { bootstrapClient, workspaceSetup } from "$lib/system";
    import { frontendUpdateStatus, runAutomaticFrontendUpdate } from "$lib/updater";
    import { companyProfile, isPrivacyNoticeReady, loadCompanyProfile } from "$lib/companyProfile";
    import { setupRouteTransition } from "$lib/routeTransition";

    const isCurrentPage = (regex: RegExp, pathname: string) => regex.test(pathname);
    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));
    const canAny = (keys: string[]) => keys.some(can);
    const routeOrder = ["myaccount", "this-device", "devices", "appearance", "shortcuts", "privacy", "general", "operation", "client", "team", "documents", "server", "about"];
    let routeContainer: HTMLElement | null = null;
    $: clientSetupRequired = Boolean($workspaceSetup && (!$workspaceSetup.clientForm || !$workspaceSetup.clientColumns || !$workspaceSetup.clientIdentifier));
    $: operationSetupRequired = Boolean($workspaceSetup && (!$workspaceSetup.operationForm || !$workspaceSetup.operationColumns || !$workspaceSetup.operationStatuses || !$workspaceSetup.operationIdentifier));
    $: privacyNoticeRequired = Boolean($companyProfile && !isPrivacyNoticeReady($companyProfile));

    onMount(() => {
        void runAutomaticFrontendUpdate();
        void bootstrapClient().catch((error) => console.error("Failed to load workspace setup", error));
        void loadCompanyProfile().catch((error) => console.error("Failed to load company profile", error));
    });

    setupRouteTransition(() => routeContainer, (from, to) => {
        if (!from.pathname.startsWith("/settings/") || !to.pathname.startsWith("/settings/") || from.pathname === to.pathname) return null;
        const fromRoute = routeOrder.indexOf(from.pathname.split("/")[2] ?? "myaccount");
        const toRoute = routeOrder.indexOf(to.pathname.split("/")[2] ?? "myaccount");
        return { direction: toRoute >= fromRoute ? 1 : -1, fade: true };
    }, { useNativeViewTransition: false });
</script>

<MenuContainer let:collapsed id="setting-sb" class="z-40">
    <MenuClose
        id="setting-sb"
        class="size-fit flex-center absolute -right-5 top-1/2 -translate-x-1/2 z-50 bg-(--light-bg2) border-1 border-(--light-bg3) rounded-full text-(--dark-bg1) cursor-pointer p-1
               transition-all duration-(--animation-duration) delay-(--animation-delay-300) opacity-0 group-hover/sidebar-container:opacity-100 group-hover/sidebar-container:delay-0"
    >
        <Icon.ChevronRight size={12} class={`min-w-3 transition-transform duration-(--animation-duration) ${collapsed ? "rotate-0" : "rotate-180"}`} />
    </MenuClose>
    

    <div class="text-lg font-extrabold font-(family-name:--font) h-12.5 flex items-center pb-2.5 px-3 gap-3 w-full">
        <Icon.Settings size={16} class="min-w-5" />
        <span
            class="transition-all duration-(--animation-duration-150)"
            class:opacity-0={collapsed}
            use:delayedClass={{ className: "hidden", delay: animationTime(), condition: collapsed }}
        >
            Paramètres
        </span>
    </div>

    <Menu>
        <NavButton {collapsed} href="/settings/myaccount" active={isCurrentPage(/\/myaccount/, $page.url.pathname)} title="Mon compte">
            <Icon.UserRoundCog size={16} class="min-w-5" name="icon" />
        </NavButton>
        <!-- <NavButton {collapsed} href="privacy" active={isCurrentPage(/\/privacy/)} title="Confidentialité">
            <Icon.EyeOff size={16} class="min-w-5" />
        </NavButton> -->
        <NavButton {collapsed} href="/settings/this-device" active={isCurrentPage(/\/this-device/, $page.url.pathname)} title="Cet appareil">
            <Icon.LaptopMinimalCheck size={16} class="min-w-5" />
        </NavButton>
        <NavButton {collapsed} href="/settings/appearance" active={isCurrentPage(/\/appearance/, $page.url.pathname)} title="Apparence">
            <Icon.Sparkles size={16} class="min-w-5" />
        </NavButton>
        <!-- <NavButton {collapsed} href="devices" active={isCurrentPage(/\/devices/)} title="Appareils">
            <Icon.MonitorSmartphone size={16} class="min-w-5" />
        </NavButton> -->
    </Menu>

    {#if canAny(["settings.general.modify", "settings.client.modify", "settings.operation.modify", "settings.products.modify", "settings.server.modify", "roles.manage"])}
        <div class="text-xs font-semibold font-(family-name:--font) text-(--grey) py-2 overflow-hidden text-nowrap h-9">
            <span class:flex-center={collapsed}>
                {collapsed ? "-" : "Paramètres avancés"}
            </span>
        </div>
    {/if}

    <Menu>
        {#if can("settings.general.modify")}
            <NavButton {collapsed} href="/settings/general" active={isCurrentPage(/\/general/, $page.url.pathname)} title="Général" attention={privacyNoticeRequired}>
                <Icon.Building2 size={16} class="min-w-5" />
            </NavButton>
        {/if}
        {#if can("settings.operation.modify")}
            <NavButton {collapsed} href="/settings/operation" active={isCurrentPage(/\/operation/, $page.url.pathname)} title={operationPlural($appSettings.value.operation)} attention={operationSetupRequired}>
                <LucideIcon name={$appSettings.value.operation.operationIcon as any} size={16} class="min-w-5" />
            </NavButton>
        {/if}
        {#if can("settings.client.modify")}
            <NavButton {collapsed} href="/settings/client" active={isCurrentPage(/\/client/, $page.url.pathname)} title="Clients" attention={clientSetupRequired}>
                <Icon.BookUser size={16} class="min-w-5" />
            </NavButton>
        {/if}
        {#if can("roles.manage")}
            <NavButton {collapsed} href="/settings/team" active={isCurrentPage(/\/team/, $page.url.pathname)} title="Équipe">
                <Icon.Users size={16} class="min-w-5" />
            </NavButton>
        {/if}
        {#if $currentUser?.administrator}
            <NavButton {collapsed} href="/settings/documents" active={isCurrentPage(/\/documents/, $page.url.pathname)} title="Documents">
                <Icon.Files size={16} class="min-w-5" />
            </NavButton>
        {/if}
        {#if can("settings.server.modify")}
            <NavButton {collapsed} href="/settings/server" active={isCurrentPage(/\/server/, $page.url.pathname)} title="Serveur">
                <Icon.Server size={16} class="min-w-5" />
            </NavButton>
        {/if}
    </Menu>

    <Menu end>
        <NavButton
            {collapsed}
            href="/settings/about"
            active={isCurrentPage(/\/about/, $page.url.pathname)}
            title="À propos"
            attention={$frontendUpdateStatus?.state === "installed"}
            attentionVariant="success"
        >
            <Icon.Info size={16} class="min-w-5" />
        </NavButton>
    </Menu>
</MenuContainer>
 
<div class="relative min-w-0 flex-1 overflow-hidden bg-(--light-bg2)">
    <main bind:this={routeContainer} class="absolute inset-0 flex min-w-0 overflow-hidden bg-(--light-bg2)">
        <slot />
    </main>
</div>
