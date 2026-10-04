<script lang="ts">
    import { goto } from "$app/navigation";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button } from "$lib/components/istyler";
    import { apiGet } from "$lib/api";
    import { currentUser } from "$lib/auth";
    import { isPrivacyNoticeReady, loadCompanyProfile, type CompanyProfile } from "$lib/companyProfile";
    import { bootstrapClient, workspaceSetup } from "$lib/system";
    import { Dialog } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";

    type AccountSummary = {
        name: string;
        quickLogin: {
            badgeEnabled: boolean;
            hasBadge: boolean;
            hasPin: boolean;
        };
    };

    type SetupTask = {
        id: string;
        icon: typeof Icon.SquareScissors;
        title: string;
        progress: string;
        href?: string;
        completed: boolean;
    };

    let account = $state<AccountSummary | null>(null);
    let company = $state<CompanyProfile | null>(null);
    let ready = $state(false);
    let dismissed = $state(false);
    let privacyRead = $state(false);
    let privacyOpen = $state(false);

    const administrator = $derived($currentUser?.administrator === true);
    const storageId = $derived($currentUser?.username ?? "current-user");
    const privacyStorageKey = $derived(`psoft:privacy-notice:${storageId}`);
    const dismissStorageKey = $derived(`psoft:home-setup-dismissed:${storageId}`);

    const adminTasks = $derived<SetupTask[]>([
        {
            id: "forms",
            icon: Icon.SquareScissors,
            title: "Formulaires",
            progress: $workspaceSetup?.clientForm === true && $workspaceSetup?.operationForm === true
                ? "Terminé"
                : `Étape ${Number($workspaceSetup?.clientForm === true) + Number($workspaceSetup?.operationForm === true) + 1} sur 2 · ${$workspaceSetup?.clientForm === true ? "Opérations" : "Clients"}`,
            href: $workspaceSetup?.clientForm === true ? "/settings/operation" : "/settings/client",
            completed: $workspaceSetup?.clientForm === true && $workspaceSetup?.operationForm === true,
        },
        {
            id: "identifiers",
            icon: Icon.Hash,
            title: "Identifiants",
            progress: $workspaceSetup?.clientIdentifier === true && $workspaceSetup?.operationIdentifier === true
                ? "Terminé"
                : `Étape ${Number($workspaceSetup?.clientIdentifier === true) + Number($workspaceSetup?.operationIdentifier === true) + 1} sur 2 · ${$workspaceSetup?.clientIdentifier === true ? "Opérations" : "Clients"}`,
            href: $workspaceSetup?.clientIdentifier === true ? "/settings/operation?open=identifier" : "/settings/client?open=identifier",
            completed: $workspaceSetup?.clientIdentifier === true && $workspaceSetup?.operationIdentifier === true,
        },
        {
            id: "statuses",
            icon: Icon.Route,
            title: "Statuts",
            progress: $workspaceSetup?.operationStatuses ? "Terminé" : "À configurer",
            href: "/settings/operation?open=statuses",
            completed: $workspaceSetup?.operationStatuses === true,
        },
    ]);

    const employeeTasks = $derived<SetupTask[]>(account ? [
        {
            id: "profile",
            icon: Icon.UserCog,
            title: "Votre profil",
            progress: account.name?.trim() ? "Terminé" : "À vérifier",
            href: "/settings/myaccount",
            completed: Boolean(account.name?.trim()),
        },
        ...(account.quickLogin.badgeEnabled ? [{
            id: "quick-login",
            icon: Icon.LockKeyhole,
            title: "Connexion rapide",
            progress: account.quickLogin.hasBadge && account.quickLogin.hasPin
                ? "Terminé"
                : `Étape ${Number(account.quickLogin.hasBadge) + Number(account.quickLogin.hasPin) + 1} sur 2`,
            href: "/settings/myaccount",
            completed: account.quickLogin.hasBadge && account.quickLogin.hasPin,
        }] : []),
        ...(isPrivacyNoticeReady(company) ? [{
            id: "privacy",
            icon: Icon.ShieldCheck,
            title: "Confidentialité",
            progress: privacyRead ? "Terminé" : "À consulter",
            completed: privacyRead,
        }] : []),
    ] : []);

    const tasks = $derived(administrator ? adminTasks : employeeTasks);
    const completedCount = $derived(tasks.filter((task) => task.completed).length);
    const completion = $derived(tasks.length ? Math.round((completedCount / tasks.length) * 100) : 0);
    const visible = $derived(ready && completedCount < tasks.length && (administrator || !dismissed));

    function openTask(task: SetupTask) {
        if (task.id === "privacy") {
            privacyOpen = true;
            return;
        }
        if (task.href) void goto(task.href);
    }

    function dismiss() {
        localStorage.setItem(dismissStorageKey, "true");
        dismissed = true;
    }

    function handlePrivacyOpen(open: boolean) {
        if (privacyOpen && !open && company) {
            localStorage.setItem(privacyStorageKey, String(company.version));
            privacyRead = true;
        }
        privacyOpen = open;
    }

    onMount(async () => {
        try {
            await bootstrapClient();
            if (!$currentUser?.administrator) {
                [account, company] = await Promise.all([
                    apiGet("/auth/me/"),
                    loadCompanyProfile().catch(() => null),
                ]);
                dismissed = localStorage.getItem(dismissStorageKey) === "true";
                privacyRead = Boolean(company && localStorage.getItem(privacyStorageKey) === String(company.version));
            }
        } catch (error) {
            console.error("Failed to load Home setup banner", error);
        } finally {
            ready = true;
        }
    });
</script>

{#if visible}
    <section class="mx-6 mt-5 min-w-0 overflow-hidden rounded-xl border border-(--user-color) bg-(--light-bg1) text-(--dark-bg1)">
        <div class="flex items-center justify-between gap-4 bg-linear-45/srgb from-(--user-color-transparent) to-(--light-bg1) to-24% px-4 py-2.5">
            <div class="flex min-w-0 items-center gap-3">
                <span class="flex shrink-0 items-center justify-center text-(--user-color)">
                    <Icon.ListChecks size={20} strokeWidth={1.6} />
                </span>
                <h2 class="truncate text-sm font-bold">{administrator ? "Finalisez votre espace" : "Préparez votre accès"}</h2>
            </div>

            <div class="flex shrink-0 items-center gap-2">
                <span class="text-xs text-(--grey)"><strong class="text-(--dark-bg1)">{completion}%</strong> terminé</span>
                {#if !administrator}
                    <Button
                        variant="ghost"
                        size="xs"
                        icon="X"
                        aria-label="Masquer cette préparation"
                        onclick={dismiss}
                        class="size-6 bg-transparent px-0 text-(--grey) hover:bg-(--light-bg3)"
                    />
                {/if}
            </div>
        </div>

        <div class="h-px bg-(--light-bg3)">
            <div class="h-full bg-(--user-color) transition-[width] duration-(--animation-duration)" style={`width: ${completion}%`}></div>
        </div>

        <div class="grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-px bg-(--light-bg3)">
            {#each tasks as task (task.id)}
                {@const TaskIcon = task.icon}
                <Button
                    variant="ghost"
                    onclick={() => openTask(task)}
                    class="group h-13 w-full min-w-0 justify-start rounded-none bg-(--light-bg1) px-3.5 text-left hover:bg-(--light-bg2) active:bg-(--light-bg3)/40 focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-(--user-color)"
                >
                    <span class={`flex size-7 shrink-0 items-center justify-center transition-(--transition) text-(--user-color)`}>
                        <TaskIcon size={18} strokeWidth={2} />
                    </span>

                    <span class="min-w-0 flex-1">
                        <span class="block truncate text-xs font-bold text-(--dark-bg1)">{task.title}</span>
                        <span class={`mt-0.5 block truncate text-[11px] font-semibold text-(--grey)`}>{task.progress}</span>
                    </span>

                    <Icon.ChevronRight size={14} class="shrink-0 text-(--grey) transition-transform duration-(--animation-duration-150) group-hover:translate-x-0.5" />
                </Button>
            {/each}
        </div>
    </section>
{/if}

<Dialog.Root open={privacyOpen} onOpenChange={handlePrivacyOpen}>
    <Dialog.Portal>
        <MyDialog class="flex max-h-[80vh] w-full max-w-2xl flex-col p-0!">
            <div class="flex h-14 shrink-0 items-center justify-between border-b border-(--light-bg3) px-5">
                <div>
                    <Dialog.Title class="font-bold text-(--dark-bg1)">Notice de confidentialité</Dialog.Title>
                    <Dialog.Description class="text-xs text-(--grey)">Informations fournies par votre entreprise.</Dialog.Description>
                </div>
                <Dialog.Close>
                    {#snippet child({ props })}
                        <Button {...props} variant="ghost" icon="X" aria-label="Fermer" class="size-8 bg-transparent px-0 hover:bg-(--light-bg3)" />
                    {/snippet}
                </Dialog.Close>
            </div>
            <div class="min-h-0 flex-1 overflow-auto bg-(--light-bg2) p-5">
                <p class="whitespace-pre-wrap text-sm leading-6 text-(--dark-bg1)">{company?.privacy_notice}</p>
            </div>
            <div class="flex justify-end border-t border-(--light-bg3) px-5 py-3">
                <Dialog.Close>
                    {#snippet child({ props })}
                        <Button {...props} label="J’ai lu" icon="Check" />
                    {/snippet}
                </Dialog.Close>
            </div>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
