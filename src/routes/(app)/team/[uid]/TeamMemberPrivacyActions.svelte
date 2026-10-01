<script lang="ts">
    import { goto } from "$app/navigation";
    import { saveFile } from "$lib/backupFiles";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import PasswordConfirmDialog from "$lib/components/PasswordConfirmDialog.svelte";
    import { Button, PasswordInput, TextInput } from "$lib/components/istyler";
    import {
        eraseTeamMemberData,
        exportTeamMemberData,
        memberDisplayName,
        teamRequestError,
        type TeamMember,
    } from "$lib/team";
    import { Accordion, Dialog } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { toast } from "svelte-sonner";

    let {
        member,
        canExport = false,
        canDelete = false,
    } = $props<{
        member: TeamMember;
        canExport?: boolean;
        canDelete?: boolean;
    }>();

    let exportOpen = $state(false);
    let exportPending = $state(false);
    let deleteOpen = $state(false);
    let deletePending = $state(false);
    let confirmedUsername = $state("");
    let currentPassword = $state("");
    let deleteError = $state("");
    let openSection = $state("personal-data");

    const filename = () => {
        const safeUsername = member.username.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 80);
        return `donnees-utilisateur-${safeUsername || member.id}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.json`;
    };

    async function exportData(password: string) {
        if (exportPending) return;
        exportPending = true;
        try {
            const data = await exportTeamMemberData(member.id, password);
            const saved = await saveFile(
                new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json;charset=utf-8" }),
                filename(),
                "Données personnelles de l’utilisateur",
                ".json",
            );
            if (saved) {
                exportOpen = false;
                toast.success("Données utilisateur enregistrées.");
            }
        } catch (error) {
            console.error("Team member data export failed", error);
            toast.error(teamRequestError(error, "Impossible d’exporter les données de l’utilisateur."));
        } finally {
            exportPending = false;
        }
    }

    function openErasure() {
        confirmedUsername = "";
        currentPassword = "";
        deleteError = "";
        deleteOpen = true;
    }

    async function eraseData() {
        if (deletePending || confirmedUsername !== member.username || !currentPassword) return;
        deletePending = true;
        deleteError = "";
        try {
            await eraseTeamMemberData(member.id, confirmedUsername, currentPassword);
            deleteOpen = false;
            toast.success("Données actives du compte effacées.");
            await goto("/team", { replaceState: true });
        } catch (error) {
            console.error("Team member data erasure failed", error);
            deleteError = teamRequestError(error, "Impossible d’effacer les données de l’utilisateur.");
        } finally {
            deletePending = false;
        }
    }
</script>

<div class="flex h-full flex-col">
    <div class="min-h-0 flex-1 overflow-y-auto">
        {#if canExport || (canDelete && !member.self)}
            <div class="p-4">
                <Accordion.Root type="single" bind:value={openSection}>
                    <Accordion.Item value="personal-data">
                        <Accordion.Header>
                            <Accordion.Trigger class="group flex w-full cursor-pointer items-center justify-between gap-3 py-1 text-left text-xs font-semibold uppercase tracking-widest text-(--grey) outline-none focus-visible:ring-2 focus-visible:ring-(--user-color)">
                                Données personnelles
                                <Icon.ChevronDown size={15} class="shrink-0 transition-transform duration-(--animation-duration) group-data-[state=open]:rotate-180" />
                            </Accordion.Trigger>
                        </Accordion.Header>

                        <MyAccordion bordered={false} class="pt-3">
                            <div class="flex flex-col gap-2">
                                {#if canExport}
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        icon={exportPending ? "LoaderCircle" : "Archive"}
                                        iconAnimation={exportPending ? "spin" : undefined}
                                        label={exportPending ? "Export en cours" : "Exporter les données"}
                                        class="w-full"
                                        disabled={exportPending || deletePending}
                                        onclick={() => (exportOpen = true)}
                                    />
                                {/if}
                                {#if canDelete && !member.self}
                                    <Button
                                        variant="error"
                                        size="sm"
                                        icon="UserRoundX"
                                        label="Effacer les données"
                                        class="w-full"
                                        disabled={exportPending || deletePending}
                                        onclick={openErasure}
                                    />
                                {/if}
                            </div>
                        </MyAccordion>
                    </Accordion.Item>
                </Accordion.Root>
            </div>
        {:else}
            <div class="flex min-h-64 flex-col items-center justify-center gap-2 px-6 text-center">
                <Icon.Database size={22} class="text-(--grey)" />
                <p class="text-sm font-semibold text-(--dark-bg1)">Données protégées</p>
                <p class="text-xs leading-5 text-(--grey)">Aucune action n’est disponible avec vos permissions.</p>
            </div>
        {/if}

    </div>
</div>

<PasswordConfirmDialog
    bind:open={exportOpen}
    title="Exporter les données de l’utilisateur"
    description={`Confirmez votre mot de passe pour générer les données de ${memberDisplayName(member)}.`}
    passwordLabel="Votre mot de passe actuel"
    confirmLabel="Exporter"
    loading={exportPending}
    onConfirm={exportData}
/>

<Dialog.Root bind:open={deleteOpen}>
    <Dialog.Portal>
        <MyDialog
            class="w-[min(38rem,calc(100vw-2rem))]! rounded-xl"
            onInteractOutside={(event) => {
                if (deletePending) event.preventDefault();
            }}
        >
            <Dialog.Title class="text-lg font-bold text-(--dark-bg1)">Effacer les données du compte</Dialog.Title>
            <Dialog.Description class="mt-1 text-sm text-(--grey)">Cette opération est irréversible.</Dialog.Description>

            <form
                class="mt-5 flex flex-col gap-4"
                onsubmit={(event) => {
                    event.preventDefault();
                    void eraseData();
                }}
            >
                <div class="rounded-lg border border-(--red)/30 bg-(--transparent-red) p-3 text-xs leading-5 text-(--dark-bg1)">
                    Le compte sera désactivé, ses informations personnelles effacées, son rôle retiré et toutes ses sessions, badge et PIN révoqués. Les contributions historiques seront conservées sous une identité supprimée.
                </div>
                <TextInput
                    name="team-member-username-confirmation"
                    label={`Recopiez l’identifiant ${member.username}`}
                    required
                    maxlength={member.username.length}
                    autocomplete="off"
                    spellcheck="false"
                    bind:value={confirmedUsername}
                    disabled={deletePending}
                />
                <PasswordInput
                    name="team-member-erasure-password"
                    label="Votre mot de passe actuel"
                    required
                    bind:value={currentPassword}
                    disabled={deletePending}
                />
                {#if deleteError}<p class="text-xs font-medium text-(--red)" role="alert">{deleteError}</p>{/if}
                <div class="flex justify-end gap-2 pt-1">
                    <Button variant="secondary" size="sm" label="Annuler" class="w-fit" disabled={deletePending} onclick={() => (deleteOpen = false)} />
                    <Button
                        variant="error"
                        size="sm"
                        type="submit"
                        icon={deletePending ? "Loader2" : "Trash2"}
                        iconAnimation={deletePending ? "spin" : undefined}
                        label={deletePending ? "Effacement..." : "Effacer définitivement"}
                        class="w-fit"
                        disabled={deletePending || confirmedUsername !== member.username || !currentPassword}
                    />
                </div>
            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
