<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import { currentUser } from "$lib/auth";
    import { colorToneStyle, cssColor } from "$lib/color";
    import { Badge } from "$lib/components/Badge";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { Button } from "$lib/components/istyler";
    import { CollapsibleSidebar } from "$lib/components/menu";
    import MyPopover from "$lib/components/MyPopover.svelte";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import UserAvatar from "$lib/components/UserAvatar.svelte";
    import { operationPlural } from "$lib/operationDisplay";
    import { appSettings, bootstrapSettings } from "$lib/settings";
    import {
        getAssignableRoles,
        getTeamMember,
        memberDisplayName,
        memberRoleDisplay,
        teamRequestError,
        updateTeamMember,
        type TeamMember,
        type TeamRole,
    } from "$lib/team";
    import { strftime } from "$lib/utils";
    import { Popover, Tabs } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";
    import TeamMemberPrivacyActions from "./TeamMemberPrivacyActions.svelte";
    import TeamMemberProfile from "./TeamMemberProfile.svelte";
    import TeamMemberResources from "./TeamMemberResources.svelte";
    import TeamMemberSessions from "./TeamMemberSessions.svelte";

    let member = $state<TeamMember | null>(null);
    let roles = $state<TeamRole[]>([]);
    let loading = $state(true);
    let loadError = $state("");
    let activePanel = $state("operations");
    let openedPanels = $state<string[]>([]);
    let minPasswordLength = $state(8);
    let sessionsVersion = $state(0);
    let rolePopoverOpen = $state(false);
    let rolePending = $state(false);
    let operationCount = $state(0);
    let clientCount = $state(0);

    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));
    const canModify = $derived(can("users.modify"));
    const canDisable = $derived(can("users.disable"));
    const canExport = $derived(can("users.export"));
    const canDelete = $derived(can("users.delete"));
    const canViewClients = $derived(can("clients.view_list"));
    const canOpenClients = $derived(can("clients.view_details"));
    const canViewOperations = $derived(can("operations.view_details"));
    const canViewSessions = $derived(canModify || canDisable);
    const availablePanels = $derived([
        ...(canViewOperations ? ["operations"] : []),
        ...(canViewClients ? ["clients"] : []),
        ...(canViewSessions ? ["sessions"] : []),
        "data",
    ]);
    const panelTitle = $derived(
        activePanel === "operations"
            ? `${operationPlural($appSettings.value.operation)} (${operationCount})`
            : activePanel === "clients"
                ? `Clients (${clientCount})`
                : activePanel === "sessions"
                    ? "Sessions"
                    : "Données",
    );
    const panelSubtitle = $derived(
        activePanel === "operations"
            ? `${operationPlural($appSettings.value.operation)} créées par cet utilisateur`
            : activePanel === "clients"
                ? "Clients créés par cet utilisateur"
                : activePanel === "sessions"
                    ? `${member?.activeSessions ?? 0} session${member?.activeSessions === 1 ? "" : "s"} active${member?.activeSessions === 1 ? "" : "s"}`
                    : "Accès, portabilité et effacement des données du compte",
    );

    $effect(() => {
        if (!availablePanels.includes(activePanel)) activePanel = availablePanels[0] ?? "data";
        if (!openedPanels.includes(activePanel)) openedPanels = [...openedPanels, activePanel];
    });

    const revealRightSidebar = (collapsed: boolean, onToggle: () => void) => {
        if (collapsed) onToggle();
    };

    async function loadMember() {
        loading = true;
        loadError = "";
        try {
            const id = Number(page.params.uid);
            if (!Number.isSafeInteger(id) || id <= 0) throw new Error("Invalid user id");
            const [loadedMember, loadedRoles, settings] = await Promise.all([
                getTeamMember(id),
                canModify ? getAssignableRoles().catch(() => []) : Promise.resolve([]),
                bootstrapSettings().catch(() => null),
            ]);
            member = loadedMember;
            roles = loadedRoles;
            minPasswordLength = Number(settings?.value.team.minPasswordLength) || 8;
        } catch (error) {
            console.error("Failed to load team member", error);
            loadError = "Impossible de charger cet utilisateur.";
        } finally {
            loading = false;
        }
    }

    function applyMemberUpdate(updated: TeamMember) {
        if (member && updated.activeSessions !== member.activeSessions) sessionsVersion += 1;
        member = updated;
    }

    async function changeRole(role: TeamRole) {
        if (!member || member.self || member.isSuperuser || rolePending || member.role?.id === role.id) return;
        rolePending = true;
        rolePopoverOpen = false;
        try {
            applyMemberUpdate(await updateTeamMember(member.id, { role: role.id }));
            toast.success("Rôle mis à jour.");
        } catch (error) {
            console.error("Failed to update team member role", error);
            toast.error(teamRequestError(error, "Impossible de modifier le rôle."));
        } finally {
            rolePending = false;
        }
    }

    onMount(() => void loadMember());
</script>

<div class="flex h-full w-full flex-col overflow-hidden">
    <div class="flex h-12 shrink-0 items-center border-b border-(--light-bg3) bg-(--light-bg1) px-5">
        <Button variant="ghost" class="group flex gap-1.5 p-0 pl-0.5 text-(--grey) hover:text-(--dark-bg1)" onclick={() => goto("/team")}>
            <Icon.MoveLeft size={15} class="transition-transform duration-(--animation-duration-150) group-hover:-translate-x-0.5" />
            Toute l’équipe
        </Button>
    </div>

    {#if loading}
        <div class="flex flex-1 items-center justify-center gap-2 text-sm text-(--grey)" role="status">
            <Icon.Loader2 size={16} class="ui-loader-spin" />
            Chargement de l’utilisateur...
        </div>
    {:else if loadError || !member}
        <div class="flex flex-1 items-center justify-center px-6 text-center">
            <div class="max-w-sm">
                <Icon.AlertCircle size={24} class="mx-auto mb-3 text-(--red)" />
                <p class="text-sm font-semibold text-(--dark-bg1)">{loadError || "Utilisateur indisponible."}</p>
                <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="mx-auto mt-4 w-fit" onclick={loadMember} />
            </div>
        </div>
    {:else}
        {@const selectedMember = member as TeamMember}
        {@const statusText = selectedMember.isActive ? (selectedMember.isNew ? "Invitation" : "Actif") : "Désactivé"}
        {@const statusType = selectedMember.isActive ? (selectedMember.isNew ? "warning" : "success") : "error"}
        {@const statusColor = selectedMember.isActive ? (selectedMember.isNew ? "var(--orange)" : "var(--green)") : "var(--red)"}

        <div class="flex min-h-0 flex-1 overflow-hidden">
            <div class="flex min-w-0 flex-1 flex-col overflow-hidden">
                <section
                    class="relative shrink-0 border-b border-(--light-bg3) bg-(--light-bg1) bg-linear-135/srgb from-(--status-color)/25 to-(--light-bg1) to-16% px-7 py-5"
                    style:--status-color={statusColor}
                >
                    <div class="flex items-start justify-between gap-5">
                        <div class="flex min-w-0 items-center gap-3">
                            <UserAvatar user={selectedMember} class="size-11 text-sm" />
                            <div class="min-w-0">
                                <h1 class="truncate text-2xl font-bold leading-tight tracking-tight text-(--dark-bg1)">{memberDisplayName(selectedMember)}</h1>
                                <p class="mt-0.5 truncate text-sm font-medium text-(--dark-bg1)/70">@{selectedMember.username}</p>
                            </div>
                        </div>

                        <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            {#if canModify && !selectedMember.self && !selectedMember.isSuperuser && roles.length}
                                {@const currentRoleDisplay = memberRoleDisplay(selectedMember)}
                                <Popover.Root bind:open={rolePopoverOpen}>
                                    <Popover.Trigger class="group/role flex shrink-0 cursor-pointer items-center focus:outline-none">
                                        <Badge
                                            text={currentRoleDisplay.name?.trim() || "Rôle sans nom"}
                                            icon={(currentRoleDisplay.icon || "Shield") as any}
                                            type="ghost"
                                            class="pr-1"
                                            style={colorToneStyle(currentRoleDisplay.iconColor)}
                                        >
                                            <LucideIcon
                                                size={12}
                                                name="ChevronDown"
                                                className="ml-1 transition-transform duration-(--animation-duration) group-data-[state=open]/role:rotate-180"
                                            />
                                        </Badge>
                                    </Popover.Trigger>

                                    <MyPopover class="min-w-52 max-w-[calc(100vw-3rem)] items-stretch rounded-lg p-1" align="end">
                                        <div class="flex max-h-80 w-full flex-col gap-0.5 overflow-y-auto">
                                            {#each roles as role (role.id)}
                                                {@const roleColor = cssColor(role.iconColor, "var(--grey)")}
                                                {@const currentRole = selectedMember.role?.id === role.id}
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    class="w-full cursor-pointer justify-start gap-2 rounded-md px-2 text-left hover:bg-(--role-color)/10 disabled:cursor-default disabled:bg-(--light-bg2)"
                                                    style={`--role-color:${roleColor}`}
                                                    disabled={currentRole || rolePending}
                                                    confirm={!currentRole}
                                                    confirmTitle="Changer le rôle ?"
                                                    confirmCancelLabel="Annuler"
                                                    confirmConfirmLabel="Changer"
                                                    onclick={() => changeRole(role)}
                                                >
                                                    <LucideIcon
                                                        size={14}
                                                        name={(role.icon || "Shield") as any}
                                                        class="shrink-0"
                                                        style={`color:${roleColor}`}
                                                    />
                                                    <span class="min-w-0 flex-1 truncate text-xs font-medium text-(--dark-bg1)">
                                                        {role.name?.trim() || "Rôle sans nom"}
                                                    </span>
                                                    {#if currentRole}
                                                        <Icon.Check size={13} class="shrink-0 text-(--green)" />
                                                    {/if}
                                                    <span slot="confirmDescription" class="inline-flex flex-wrap items-center gap-1.5">
                                                        Le rôle de {memberDisplayName(selectedMember)} passera de
                                                        <DisplayValue value={memberRoleDisplay(selectedMember)} display="role" />
                                                        à
                                                        <DisplayValue value={role} display="role" />.
                                                    </span>
                                                </Button>
                                            {/each}
                                        </div>
                                    </MyPopover>
                                </Popover.Root>
                            {:else}
                                <DisplayValue value={memberRoleDisplay(selectedMember)} display="role" />
                            {/if}
                            <Badge text={statusText} type={statusType} />
                        </div>
                    </div>

                    <div class="mt-4 flex flex-wrap items-center gap-2.5 text-xs font-medium text-(--grey)">
                        <span class="flex items-center gap-1.5">
                            <Icon.Calendar size={12} />
                            {selectedMember.createdAt
                                ? strftime(selectedMember.createdAt, "%A %d %B %Y à %Hh%M", "fr-FR")
                                : "Date de création inconnue"}
                        </span>
                        <span class="font-extralight text-(--light-grey)">|</span>
                        <span class="flex items-center gap-1.5">
                            <Icon.MonitorSmartphone size={12} />
                            <strong class="font-semibold text-(--dark-bg1)">{selectedMember.activeSessions}</strong>
                            session{selectedMember.activeSessions === 1 ? "" : "s"} active{selectedMember.activeSessions === 1 ? "" : "s"}
                        </span>
                    </div>
                </section>

                <section class="min-h-0 flex-1 overflow-y-auto px-7 py-5">
                    <TeamMemberProfile
                        member={selectedMember}
                        {canModify}
                        {canDisable}
                        {minPasswordLength}
                        onUpdated={applyMemberUpdate}
                    />
                </section>
            </div>

            <CollapsibleSidebar id="team-right-panel" side="right" width="420px" collapsedWidth="64px">
                {#snippet children({ collapsed, onToggle })}
                    <Tabs.Root value={activePanel} onValueChange={(value) => (activePanel = value)} class="flex h-full min-w-0">
                        <Tabs.List class="flex w-16 shrink-0 flex-col gap-1 px-2 py-3 {collapsed ? '' : 'border-r border-(--light-bg3)'}">
                            {#if canViewOperations}
                                <Tabs.Trigger
                                    value="operations"
                                    title={operationPlural($appSettings.value.operation)}
                                    onclick={() => revealRightSidebar(collapsed, onToggle)}
                                    class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'operations' ? '--active text-(--dark-bg1)!' : ''}"
                                >
                                    <LucideIcon name={$appSettings.value.operation.operationIcon as any} size={17} />
                                </Tabs.Trigger>
                            {/if}
                            {#if canViewClients}
                                <Tabs.Trigger
                                    value="clients"
                                    title="Clients"
                                    onclick={() => revealRightSidebar(collapsed, onToggle)}
                                    class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'clients' ? '--active text-(--dark-bg1)!' : ''}"
                                >
                                    <Icon.BookUser size={17} />
                                </Tabs.Trigger>
                            {/if}
                            {#if canViewSessions}
                                <Tabs.Trigger
                                    value="sessions"
                                    title="Sessions"
                                    onclick={() => revealRightSidebar(collapsed, onToggle)}
                                    class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'sessions' ? '--active text-(--dark-bg1)!' : ''}"
                                >
                                    <Icon.MonitorSmartphone size={17} />
                                </Tabs.Trigger>
                            {/if}
                            <Tabs.Trigger
                                value="data"
                                title="Données"
                                onclick={() => revealRightSidebar(collapsed, onToggle)}
                                class="nav-button flex size-10 cursor-pointer items-center justify-center rounded-lg text-(--grey) transition-colors hover:text-(--dark-bg1) {activePanel === 'data' ? '--active text-(--dark-bg1)!' : ''}"
                            >
                                <Icon.Database size={17} />
                            </Tabs.Trigger>
                        </Tabs.List>

                        {#if !collapsed}
                            <div class="flex min-w-0 flex-1 flex-col">
                                <div class="shrink-0 border-b border-(--light-bg3) px-4 py-3">
                                    <div class="text-sm font-semibold text-(--dark-bg1)">{panelTitle}</div>
                                    <div class="mt-0.5 text-xs font-normal leading-4 text-(--grey)">{panelSubtitle}</div>
                                </div>

                                <div class="min-h-0 flex-1">
                                    {#if canViewOperations && openedPanels.includes("operations")}
                                        <Tabs.Content value="operations" class="h-full">
                                            <TeamMemberResources
                                                memberId={selectedMember.id}
                                                {canViewOperations}
                                                onCountChange={(count) => (operationCount = count)}
                                            />
                                        </Tabs.Content>
                                    {/if}

                                    {#if canViewClients && openedPanels.includes("clients")}
                                        <Tabs.Content value="clients" class="h-full">
                                            <TeamMemberResources
                                                memberId={selectedMember.id}
                                                {canViewClients}
                                                {canOpenClients}
                                                onCountChange={(count) => (clientCount = count)}
                                            />
                                        </Tabs.Content>
                                    {/if}

                                    {#if canViewSessions && openedPanels.includes("sessions")}
                                        <Tabs.Content value="sessions" class="h-full">
                                            {#key sessionsVersion}
                                                <TeamMemberSessions
                                                    memberId={selectedMember.id}
                                                    self={selectedMember.self}
                                                    canRevoke={canDisable}
                                                    onCountChange={(activeSessions) => (member = member ? { ...member, activeSessions } : member)}
                                                />
                                            {/key}
                                        </Tabs.Content>
                                    {/if}

                                    {#if openedPanels.includes("data")}
                                        <Tabs.Content value="data" class="h-full">
                                            <TeamMemberPrivacyActions member={selectedMember} {canExport} {canDelete} />
                                        </Tabs.Content>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                    </Tabs.Root>
                {/snippet}
            </CollapsibleSidebar>
        </div>
    {/if}
</div>
