<script lang="ts">
    import { goto } from "$app/navigation";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import { Button } from "$lib/components/istyler";
    import {
        getTeamMemberSessions,
        revokeTeamMemberSessions,
        teamRequestError,
        type TeamSession,
    } from "$lib/team";
    import { strftime } from "$lib/utils";
    import * as Icon from "lucide-svelte";
    import { Accordion } from "bits-ui";
    import { onMount } from "svelte";
    import { toast } from "svelte-sonner";

    let {
        memberId,
        self = false,
        canRevoke = false,
        onCountChange,
    } = $props<{
        memberId: number;
        self?: boolean;
        canRevoke?: boolean;
        onCountChange?: (count: number) => void;
    }>();

    let sessions = $state<TeamSession[]>([]);
    let loading = $state(true);
    let loadError = $state("");
    let expanded = $state<string | null>(null);
    let revoking = $state<string | null>(null);

    const displayDate = (value: string | null) => value
        ? strftime(value, "%d %B %Y à %Hh%M", "fr-FR")
        : "Non disponible";

    async function loadSessions() {
        if (self) {
            loading = false;
            return;
        }
        loading = true;
        loadError = "";
        try {
            const response = await getTeamMemberSessions(memberId);
            sessions = response.sessions ?? [];
            onCountChange?.(sessions.length);
        } catch (error) {
            console.error("Failed to load team member sessions", error);
            loadError = teamRequestError(error, "Impossible de charger les sessions.");
        } finally {
            loading = false;
        }
    }

    async function revoke(sessionId?: string) {
        if (revoking) return;
        revoking = sessionId ?? "all";
        try {
            await revokeTeamMemberSessions(memberId, sessionId);
            sessions = sessionId ? sessions.filter((session) => session.id !== sessionId) : [];
            if (expanded === sessionId) expanded = null;
            onCountChange?.(sessions.length);
            toast.success(sessionId ? "Session révoquée." : "Toutes les sessions ont été révoquées.");
        } catch (error) {
            console.error("Failed to revoke team member session", error);
            toast.error(teamRequestError(error, "Impossible de révoquer la session."));
        } finally {
            revoking = null;
        }
    }

    onMount(() => void loadSessions());
</script>

<div class="flex h-full flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
        {#if canRevoke && !self && sessions.length}
            <div class="p-4">
                <Button
                    variant="secondary"
                    size="sm"
                    icon={revoking === "all" ? "Loader2" : "LogOut"}
                    iconAnimation={revoking === "all" ? "spin" : undefined}
                    label="Tout déconnecter"
                    class="w-full"
                    disabled={Boolean(revoking)}
                    confirm
                    confirmTitle="Révoquer toutes les sessions ?"
                    confirmDescription="L’utilisateur devra s’authentifier à nouveau sur chaque appareil."
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Tout déconnecter"
                    confirmConfirmVariant="error"
                    onclick={() => revoke()}
                />
            </div>
        {/if}

        {#if self}
            <div class="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                <Icon.ShieldCheck size={22} class="text-(--grey)" />
                <div>
                    <p class="text-sm font-semibold text-(--dark-bg1)">Sessions de votre compte</p>
                    <p class="mt-1 text-xs leading-5 text-(--grey)">Gérez-les depuis les paramètres de votre compte.</p>
                </div>
                <Button variant="secondary" size="sm" icon="Settings" label="Ouvrir mes paramètres" class="w-fit" onclick={() => goto("/settings/myaccount")} />
            </div>
        {:else if loading}
            <div class="flex min-h-64 items-center justify-center gap-2 text-xs text-(--grey)" role="status">
                <Icon.Loader2 size={16} class="ui-loader-spin" />
                Chargement...
            </div>
        {:else if loadError}
            <div class="flex min-h-64 flex-col items-center justify-center gap-3 px-6 text-center">
                <Icon.AlertCircle size={20} class="text-(--red)" />
                <p class="text-sm font-semibold text-(--dark-bg1)">{loadError}</p>
                <Button variant="secondary" size="sm" icon="RefreshCw" label="Réessayer" class="w-fit" onclick={loadSessions} />
            </div>
        {:else if sessions.length}
            <Accordion.Root
                type="single"
                value={expanded ?? ""}
                onValueChange={(value) => (expanded = value || null)}
                class="divide-y divide-(--light-bg3) border-y border-(--light-bg3)"
            >
                {#each sessions as session (session.id)}
                    <Accordion.Item value={session.id} class="bg-(--light-bg1)">
                        <Accordion.Header>
                            <Accordion.Trigger class="grid h-auto w-full cursor-pointer grid-cols-[5.25rem_minmax(0,1fr)_2.5rem] items-stretch p-0 text-left whitespace-normal outline-none transition-colors hover:bg-(--light-bg2) focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-(--user-color)">
                                <span class="flex flex-col justify-center border-r border-(--light-bg3) px-2.5 py-2.5">
                                    <span class="text-xs font-bold text-(--dark-bg1)">{session.loginAt ? strftime(session.loginAt, "%d %B", "fr-FR") : "Connexion"}</span>
                                    <span class="mt-0.5 text-[10px] text-(--grey)">{session.loginAt ? strftime(session.loginAt, "%Y · %Hh%M", "fr-FR") : "inconnue"}</span>
                                </span>
                                <span class="flex min-w-0 flex-col justify-center px-3 py-2.5">
                                    <span class="truncate text-xs font-semibold text-(--dark-bg1)">{session.device}</span>
                                    <span class="mt-0.5 truncate font-mono text-[10px] text-(--grey)">{session.ipAddress}</span>
                                </span>
                                <span class="flex items-center justify-center text-(--grey)">
                                    <Icon.ChevronDown size={15} class={`transition-transform ${expanded === session.id ? "rotate-180" : ""}`} />
                                </span>
                            </Accordion.Trigger>
                        </Accordion.Header>

                        <MyAccordion>
                            <div class="bg-(--light-bg2)/50 px-3 py-3">
                                <dl class="space-y-2 text-xs">
                                    <div class="flex items-start justify-between gap-3"><dt class="text-(--grey)">Expiration</dt><dd class="text-right font-semibold">{displayDate(session.expiresAt)}</dd></div>
                                    <div class="flex items-start justify-between gap-3"><dt class="text-(--grey)">Appareil</dt><dd class="text-right font-semibold">{session.deviceType === "personal" ? "Personnel" : session.deviceType === "shared" ? "Partagé" : "Inconnu"}</dd></div>
                                    <div class="flex items-start justify-between gap-3"><dt class="text-(--grey)">État</dt><dd class="text-right font-semibold text-(--green)">{session.status}</dd></div>
                                </dl>
                                {#if canRevoke}
                                    <Button
                                        variant="error"
                                        size="sm"
                                        icon={revoking === session.id ? "Loader2" : "LogOut"}
                                        iconAnimation={revoking === session.id ? "spin" : undefined}
                                        label="Révoquer cette session"
                                        class="mt-3 w-full"
                                        disabled={Boolean(revoking)}
                                        confirm
                                        confirmTitle="Révoquer cette session ?"
                                        confirmDescription={`L’accès depuis ${session.device} sera immédiatement fermé.`}
                                        confirmCancelLabel="Annuler"
                                        confirmConfirmLabel="Révoquer"
                                        confirmConfirmVariant="error"
                                        onclick={() => revoke(session.id)}
                                    />
                                {/if}
                            </div>
                        </MyAccordion>
                    </Accordion.Item>
                {/each}
            </Accordion.Root>
        {:else}
            <div class="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
                <Icon.MonitorOff size={22} class="text-(--grey)" />
                <p class="text-sm font-semibold text-(--dark-bg1)">Aucune session active</p>
                <p class="text-xs leading-5 text-(--grey)">Ce compte n’est connecté sur aucun appareil.</p>
            </div>
        {/if}
    </div>
</div>
