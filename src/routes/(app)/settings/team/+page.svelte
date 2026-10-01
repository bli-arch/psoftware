<script lang="ts">
    import { onMount } from "svelte";
    import { slide } from "svelte/transition";
    import { toast } from "svelte-sonner";
    import * as Icon from "lucide-svelte";
    import { apiDelete, apiGet, apiPost, apiPut } from "$lib/api";
    import { currentUser } from "$lib/auth";
    import {
        SettingsAccordionRow,
        SettingsDrilldownList,
        SettingsPage,
        SettingsRow,
        SettingsSection,
        SettingsTable,
        SettingsToggleRow,
        type SettingsDrilldownItem,
    } from "$lib/components/settings";
    import { Button, Checkbox, IconPicker, RangeInput, TextInput } from "$lib/components/istyler";
    import { bootstrapSettings, DEFAULT_SETTINGS, updateAppSettings, type AppSettingsValue } from "$lib/settings";
    import { animationTime } from "$lib/uiPreferences";

    const sessionDurationOptions = [
        { label: "12 h - sécurisé", value: 12 },
        { label: "24 h", value: 24 },
        { label: "3 jours", value: 24 * 3 },
        { label: "1 semaine - recommandé", value: 24 * 7 },
        { label: "2 semaines", value: 24 * 14 },
        { label: "30 jours - moins restrictif", value: 24 * 30 },
    ];

    const passwordLengthOptions = [8, 10, 12, 14, 15, 16].map((value) => ({
        label: `${value} caractères`,
        value,
    }));

    type Role = {
        id: number;
        name: string | null;
        icon: string;
        iconColor: string;
        permissionKeys: string[];
    };

    type TeamPermission = {
        key: string;
        label: string;
        category: string;
        description: string;
    };

    let roles = $state<Role[]>([]);
    let permissions = $state<TeamPermission[]>([]);
    let rolePermissionError = $state("");
    let creatingRole = $state(false);
    let selectedRoleId = $state<number | null>(null);
    let savingRoles = $state<Record<number, boolean>>({});
    let deletingRoleId = $state<number | null>(null);
    let collapsedPermissionCategories = $state<Record<string, boolean>>({});
    let team = $state({
        badgeLogin: true,
        maxSessionHours: DEFAULT_SETTINGS.team.maxSessionHours,
        minPasswordLength: DEFAULT_SETTINGS.team.minPasswordLength,
    });
    let sessionDurationLevel = $state(optionIndex(DEFAULT_SETTINGS.team.maxSessionHours, sessionDurationOptions, DEFAULT_SETTINGS.team.maxSessionHours));
    let passwordLengthLevel = $state(optionIndex(DEFAULT_SETTINGS.team.minPasswordLength, passwordLengthOptions, DEFAULT_SETTINGS.team.minPasswordLength));
    let settingsReady = $state(false);
    const sessionDurationLabel = $derived((sessionDurationOptions[Number(sessionDurationLevel)] ?? sessionDurationOptions[3]).label);
    const passwordLengthLabel = $derived((passwordLengthOptions[Number(passwordLengthLevel)] ?? passwordLengthOptions[0]).label);
    const roleItems = $derived(roles.map((role) => ({
        id: role.id,
        title: role.name?.trim() || "Rôle sans nom",
        description: `${role.permissionKeys.length}/${permissions.length} permissions actives`,
        icon: role.icon || "Shield",
        color: role.iconColor || "--page-icon-purple",
    }) satisfies SettingsDrilldownItem));
    const groupedPermissions = $derived(Object.entries(permissions.reduce<Record<string, TeamPermission[]>>((groups, permission) => {
        groups[permission.category] ??= [];
        groups[permission.category].push(permission);
        return groups;
    }, {})));
    const can = (key: string) => Boolean($currentUser?.administrator || $currentUser?.permissions?.includes(key));

    $effect(() => {
        if (selectedRoleId !== null && !roles.some((role) => role.id === selectedRoleId)) {
            selectedRoleId = null;
        }
    });

    function asList<T>(response: unknown): T[] {
        if (Array.isArray(response)) return response as T[];
        if (response && typeof response === "object" && Array.isArray((response as { results?: unknown }).results)) {
            return (response as { results: T[] }).results;
        }
        return [];
    }

    function normalizeRole(role: Partial<Role>): Role {
        return {
            id: Number(role.id),
            name: role.name ?? null,
            icon: role.icon || "Shield",
            iconColor: role.iconColor || "--page-icon-purple",
            permissionKeys: Array.isArray(role.permissionKeys) ? role.permissionKeys : [],
        };
    }

    function updateRoleLocal(roleId: number, patch: Partial<Role>) {
        roles = roles.map((role) => role.id === roleId ? { ...role, ...patch } : role);
    }

    function optionValue(value: unknown, options: Array<{ value: number }>, fallback: number) {
        const numberValue = Number(value);
        if (!Number.isFinite(numberValue)) return fallback;
        const nextValue = Math.round(numberValue);
        return options.some((option) => option.value === nextValue) ? nextValue : fallback;
    }

    function optionIndex(value: unknown, options: Array<{ value: number }>, fallback: number) {
        const cleanValue = optionValue(value, options, fallback);
        return Math.max(0, options.findIndex((option) => option.value === cleanValue));
    }

    async function saveTeamSetting<K extends keyof AppSettingsValue["team"]>(key: K, value: AppSettingsValue["team"][K]) {
        if (!settingsReady) return;

        try {
            await updateAppSettings({ team: { [key]: value } as Partial<AppSettingsValue["team"]> });
        } catch (error) {
            console.error("Failed to save team setting", error);
            toast.error("Impossible d'enregistrer ce paramètre.");
        }
    }

    function saveNumberSetting(key: "maxSessionHours" | "minPasswordLength", level: unknown) {
        const options = key === "maxSessionHours" ? sessionDurationOptions : passwordLengthOptions;
        const index = Math.min(options.length - 1, Math.max(0, Math.round(Number(level))));
        const nextValue = options[index]?.value ?? DEFAULT_SETTINGS.team[key];
        team[key] = nextValue;
        void saveTeamSetting(key, nextValue);
    }

    async function loadRolePermissions() {
        if (!can("roles.manage")) return;
        rolePermissionError = "";
        try {
            const [permissionResponse, roleResponse] = await Promise.all([
                apiGet("/auth/permissions/"),
                apiGet("/auth/role/"),
            ]);
            permissions = asList<TeamPermission>(permissionResponse);
            roles = asList<Role>(roleResponse).map(normalizeRole);
        } catch (error) {
            console.error("Failed to load role permissions", error);
            rolePermissionError = "Impossible de charger les rôles et permissions.";
        }
    }

    async function createRole() {
        if (creatingRole) return;

        creatingRole = true;
        try {
            const saved = normalizeRole(await apiPost("/auth/role/", {
                name: "Nouveau rôle",
                icon: "Shield",
                iconColor: "--page-icon-purple",
                permissionKeys: [],
            }));
            roles = [...roles, saved];
            selectedRoleId = saved.id;
            toast.success("Rôle créé.");
        } catch (error) {
            console.error("Failed to create role", error);
            toast.error("Impossible de créer le rôle.");
        } finally {
            creatingRole = false;
        }
    }

    async function saveRole(roleId: number, patch: Partial<Role>) {
        const current = roles.find((role) => role.id === roleId);
        if (!current) return;

        const next = normalizeRole({ ...current, ...patch });
        updateRoleLocal(roleId, next);
        savingRoles = { ...savingRoles, [roleId]: true };

        try {
            const saved = normalizeRole(await apiPut(`/auth/role/${roleId}/`, next));
            updateRoleLocal(roleId, saved);
        } catch (error) {
            console.error("Failed to save role", error);
            toast.error("Impossible d'enregistrer le rôle.");
            await loadRolePermissions();
        } finally {
            savingRoles = { ...savingRoles, [roleId]: false };
        }
    }

    function toggleRolePermission(role: Role, key: string, enabled: boolean) {
        const permissionKeys = enabled
            ? [...new Set([...role.permissionKeys, key])]
            : role.permissionKeys.filter((permissionKey) => permissionKey !== key);

        void saveRole(role.id, { permissionKeys });
    }

    async function deleteRole(role: Role) {
        deletingRoleId = role.id;
        try {
            await apiDelete(`/auth/role/${role.id}/`);
            roles = roles.filter((entry) => entry.id !== role.id);
            selectedRoleId = null;
            toast.success("Rôle supprimé.");
        } catch (error) {
            console.error("Failed to delete role", error);
            toast.error("Impossible de supprimer le rôle.");
        } finally {
            deletingRoleId = null;
        }
    }

    onMount(async () => {
        try {
            const settings = await bootstrapSettings();
            team.badgeLogin = settings.value.team.badgeLoginEnabled;
            team.maxSessionHours = optionValue(settings.value.team.maxSessionHours, sessionDurationOptions, DEFAULT_SETTINGS.team.maxSessionHours);
            team.minPasswordLength = optionValue(settings.value.team.minPasswordLength, passwordLengthOptions, DEFAULT_SETTINGS.team.minPasswordLength);
            sessionDurationLevel = optionIndex(team.maxSessionHours, sessionDurationOptions, DEFAULT_SETTINGS.team.maxSessionHours);
            passwordLengthLevel = optionIndex(team.minPasswordLength, passwordLengthOptions, DEFAULT_SETTINGS.team.minPasswordLength);
        } catch (error) {
            console.error("Failed to load team settings", error);
        } finally {
            settingsReady = true;
        }

        void loadRolePermissions();
    });
</script>

<SettingsPage
    title="Équipe"
    description="Configurez les rôles, accès et politiques de connexion."
>
    {#if can("roles.manage")}
        <SettingsSection label="Organisation">
            {#if rolePermissionError}
                <div class="rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)">
                    {rolePermissionError}
                </div>
            {/if}

            <SettingsAccordionRow
                value="roles"
                icon="Shield"
                title="Rôles et permissions"
                description="Créez un rôle, puis choisissez ses permissions."
                toneClass="bg-violet-50 text-violet-700"
                bodyPadding={false}
            >

                <SettingsDrilldownList
                    items={roleItems}
                    bind:selectedId={selectedRoleId}
                    emptyTitle="Aucun rôle"
                    emptyDescription="Ajoutez un rôle pour lui attribuer des permissions."
                    backLabel="Tous les rôles"
                >
                    {#snippet listFooter()}
                        <Button
                            variant="ghost"
                            size="md"
                            class="group/create-card h-auto w-full flex-center gap-3 rounded-none border-t border-(--light-bg3) px-4 py-3 text-left text-(--dark-bg1) hover:bg-(--user-color)/5 hover:text-(--user-color)"
                            disabled={creatingRole}
                            onclick={createRole}
                        >
                            {#if creatingRole}
                                <Icon.LoaderCircle size="16" class="ui-loader-spin" />
                            {:else}
                                <Icon.Plus size="16" />
                            {/if}
                            <span class="min-w-0">
                                <span class="block truncate text-xs font-semibold">
                                    {creatingRole ? "Création..." : "Ajouter un rôle"}
                                </span>
                            </span>
                        </Button>
                    {/snippet}

                    {#snippet detailRight(item)}
                        {@const role = roles.find((entry) => entry.id === item.id)}
                        {#if role}
                            <Button
                                variant="error"
                                size="sm"
                                icon={deletingRoleId === role.id ? "Loader" : "Trash2"}
                                iconAnimation={deletingRoleId === role.id ? "spin" : undefined}
                                label="Supprimer"
                                class="w-fit"
                                disabled={deletingRoleId === role.id}
                                confirm={true}
                                confirmTitle="Supprimer ce rôle ?"
                                confirmDescription="Les utilisateurs liés à ce rôle n'auront plus de rôle attribué."
                                confirmCancelLabel="Annuler"
                                confirmConfirmLabel="Supprimer"
                                confirmConfirmVariant="error"
                                onclick={() => deleteRole(role)}
                            />
                        {/if}
                    {/snippet}

                    {#snippet detail(item)}
                        {@const role = roles.find((entry) => entry.id === item.id)}
                        {#if role}
                            <div class="flex flex-col gap-4">
                                <div class="flex items-start gap-4 px-4">
                                    <IconPicker
                                        label="Icône"
                                        value={role.icon || "Shield"}
                                        color={role.iconColor || "--page-icon-purple"}
                                        showColors
                                        toneBackground
                                        allowDeselect={false}
                                        disabled={savingRoles[role.id] || deletingRoleId === role.id}
                                        onSelect={(icon) => void saveRole(role.id, { icon: icon || "Shield" })}
                                        onColorSelect={(iconColor) => void saveRole(role.id, { iconColor })}
                                    />
                                    <TextInput
                                        name={`role-${role.id}-name`}
                                        label="Nom du rôle"
                                        maxlength="100"
                                        value={role.name ?? ""}
                                        disabled={savingRoles[role.id] || deletingRoleId === role.id}
                                        oninput={(event: Event) => updateRoleLocal(role.id, { name: (event.currentTarget as HTMLInputElement).value })}
                                        onchange={(event: Event) => {
                                            const name = (event.currentTarget as HTMLInputElement).value.trim() || "Rôle sans nom";
                                            void saveRole(role.id, { name });
                                        }}
                                    />
                                </div>

                                <SettingsTable flush={false} class="rounded-none border-x-0 border-b-0 border-t" columns={[]}>
                                    <tbody>
                                        {#each groupedPermissions as [category, items]}
                                            {@const collapsed = collapsedPermissionCategories[category]}
                                            <tr class="border-b border-(--light-bg3) bg-(--light-bg2) last:border-b-0">
                                                <td class="p-0">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        class="h-auto w-full justify-between gap-3 rounded-none px-4 py-2 text-left text-xs font-semibold uppercase text-(--grey)"
                                                        aria-expanded={!collapsed}
                                                        onclick={() => collapsedPermissionCategories = {
                                                            ...collapsedPermissionCategories,
                                                            [category]: !collapsedPermissionCategories[category],
                                                        }}
                                                    >
                                                        <span>{category}</span>
                                                        <Icon.ChevronDown
                                                            size={15}
                                                            class="text-(--grey) transition-transform duration-(--animation-duration-100) {collapsed ? '-rotate-90' : ''}"
                                                        />
                                                    </Button>
                                                </td>
                                            </tr>
                                            {#if !collapsed}
                                                <tr class="border-b border-(--light-bg3) last:border-b-0">
                                                    <td class="p-0">
                                                        <div transition:slide={{ duration: animationTime() }}>
                                                            {#each items as permission (permission.key)}
                                                                {@const checked = role.permissionKeys.includes(permission.key)}
                                                                <div class="border-b border-(--light-bg3) last:border-b-0 hover:bg-(--light-bg2)">
                                                                    {#snippet permissionContent()}
                                                                        <span class="min-w-0 flex-1">
                                                                            <span class="block text-sm font-medium text-(--dark-bg1)">{permission.label}</span>
                                                                            <span class="block text-xs leading-4 text-(--grey)">{permission.description}</span>
                                                                        </span>
                                                                    {/snippet}
                                                                    <Checkbox
                                                                        name={`role-${role.id}-${permission.key}`}
                                                                        value={checked}
                                                                        switchMode={true}
                                                                        side="left"
                                                                        disabled={deletingRoleId === role.id || (!checked && !can(permission.key))}
                                                                        class="w-full justify-between rounded-none px-4 py-2.5 hover:bg-(--light-bg2)"
                                                                        content={permissionContent}
                                                                        on:change={(event) => toggleRolePermission(role, permission.key, event.detail)}
                                                                    />
                                                                </div>
                                                            {/each}
                                                        </div>
                                                    </td>
                                                </tr>
                                            {/if}
                                        {/each}
                                    </tbody>
                                </SettingsTable>
                            </div>
                        {/if}
                    {/snippet}
                </SettingsDrilldownList>
            </SettingsAccordionRow>
        </SettingsSection>
    {/if}

    {#if can("roles.manage")}
        <SettingsSection label="Sessions et mots de passe">
        <SettingsRow
            icon="TimerReset"
            title="Durée de session"
            description="Les utilisateurs restent connectés pendant cette durée, sauf déconnexion manuelle."
            toneClass="bg-orange-50 text-orange-700"
        >
            <div class="w-full">
                <RangeInput
                    name="max-session-hours"
                    label={sessionDurationLabel}
                    bind:value={sessionDurationLevel}
                    min={0}
                    max={sessionDurationOptions.length - 1}
                    step={1}
                    showValue={false}
                    showBounds={false}
                    disabled={!settingsReady}
                    on:change={(event) => saveNumberSetting("maxSessionHours", event.detail)}
                />
                <div class="mt-2 grid grid-cols-2 text-sm font-medium text-(--grey)">
                    <span>{sessionDurationOptions[0].label}</span>
                    <span class="text-right">{sessionDurationOptions[sessionDurationOptions.length - 1].label}</span>
                </div>
            </div>
        </SettingsRow>
        <SettingsRow
            icon="KeyRound"
            title="Longueur minimale du mot de passe"
            description="Rejetée côté serveur lors d'un changement ou d'une création de compte."
            toneClass="bg-amber-50 text-amber-700"
        >
            <div class="w-full">
                <RangeInput
                    name="min-password-length"
                    label={passwordLengthLabel}
                    bind:value={passwordLengthLevel}
                    min={0}
                    max={passwordLengthOptions.length - 1}
                    step={1}
                    showValue={false}
                    showBounds={false}
                    disabled={!settingsReady}
                    on:change={(event) => saveNumberSetting("minPasswordLength", event.detail)}
                />
                <div class="mt-2 grid grid-cols-2 text-sm font-medium text-(--grey)">
                    <span>{passwordLengthOptions[0].label}</span>
                    <span class="text-right">{passwordLengthOptions[passwordLengthOptions.length - 1].label}</span>
                </div>
            </div>
        </SettingsRow>
        </SettingsSection>
    {/if}

    {#if can("roles.manage")}
        <SettingsSection label="Connexion rapide">
            <SettingsToggleRow
                icon="BadgeCheck"
                title="Carte ou badge"
                description="Active la connexion rapide par badge."
                name="badge-login"
                toneClass="bg-blue-50 text-blue-700"
                bind:value={team.badgeLogin}
                onChange={(value) => saveTeamSetting("badgeLoginEnabled", value)}
            >
            </SettingsToggleRow>
        </SettingsSection>
    {/if}
</SettingsPage>
