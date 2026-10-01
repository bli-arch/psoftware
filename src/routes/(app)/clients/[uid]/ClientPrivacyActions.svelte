<script lang="ts">
    import { goto } from "$app/navigation";
    import { Accordion, Dialog } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { toast } from "svelte-sonner";

    import { apiDownloadClientData, apiPost } from "$lib/api";
    import { saveFile } from "$lib/backupFiles";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, PasswordInput, TextInput } from "$lib/components/istyler";

    let {
        uid,
        canExport = false,
        canDelete = false,
    } = $props<{
        uid: string;
        canExport?: boolean;
        canDelete?: boolean;
    }>();

    let exportPending = $state(false);
    let openSections = $state<string[]>([]);
    let deleteOpen = $state(false);
    let deletePending = $state(false);
    let confirmedUID = $state("");
    let currentPassword = $state("");
    let deleteError = $state("");

    const archiveFilename = () => {
        const safeUID = uid.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^[.-]+|[.-]+$/g, "").slice(0, 80);
        return `donnees-client-${safeUID || "client"}-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}.zip`;
    };

    const requestError = (error: unknown, fallback: string) => {
        if (!error || typeof error !== "object" || !("data" in error)) return fallback;
        const data = (error as { data?: unknown }).data;
        if (!data || typeof data !== "object") return fallback;
        const payload = data as Record<string, unknown>;
        if (typeof payload.detail === "string") return payload.detail;
        for (const key of ["confirm_uid", "current_password"]) {
            const messages = payload[key];
            if (Array.isArray(messages) && typeof messages[0] === "string") return messages[0];
        }
        return fallback;
    };

    const exportData = async () => {
        if (exportPending) return;
        exportPending = true;
        try {
            const archive = await apiDownloadClientData(uid);
            const saved = await saveFile(
                archive,
                archiveFilename(),
                "Archive des données personnelles du client",
                ".zip",
            );
            if (saved) toast.success("Archive des données client enregistrée.");
        } catch (error) {
            console.error("Client data export failed", error);
            toast.error("Impossible de récupérer les données du client.");
        } finally {
            exportPending = false;
        }
    };

    const eraseData = async () => {
        if (deletePending || confirmedUID !== uid || !currentPassword) return;
        deletePending = true;
        deleteError = "";
        try {
            await apiPost("/core/clients/data-erasure/", {
                uid,
                confirm_uid: confirmedUID,
                current_password: currentPassword,
            });
            deleteOpen = false;
            toast.success("Données actives du client supprimées.");
            void goto("/clients", { replaceState: true }).catch((error) => {
                console.error("Navigation after client data erasure failed", error);
            });
        } catch (error) {
            console.error("Client data erasure failed", error);
            deleteError = requestError(error, "Impossible de supprimer les données du client.");
        } finally {
            deletePending = false;
        }
    };
</script>

{#if canExport || canDelete}
    <Accordion.Root type="multiple" bind:value={openSections}>
        <Accordion.Item value="privacy">
            <Accordion.Header>
                <Accordion.Trigger class="group flex w-full cursor-pointer items-center justify-between gap-3 py-1 text-left text-xs font-semibold uppercase tracking-widest text-(--grey) outline-none focus-visible:ring-2 focus-visible:ring-(--user-color)">
                    Confidentialité
                    <Icon.ChevronDown
                        size={15}
                        class="shrink-0 transition-transform duration-(--animation-duration) group-data-[state=open]:rotate-180"
                    />
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
                            label={exportPending ? "Récupération des données en cours" : "Demander les données"}
                            disabled={exportPending || deletePending}
                            confirm
                            confirmTitle="Confirmer la demande de données"
                            confirmDescription="Une archive contenant les données personnelles de ce client sera générée et pourra être enregistrée sur votre appareil. Confirmez cette demande pour poursuivre."
                            confirmCancelLabel="Annuler"
                            confirmConfirmLabel="Confirmer la demande"
                            onclick={() => void exportData()}
                        />
                    {/if}
                    {#if canDelete}
                        <Button
                            variant="error"
                            size="sm"
                            icon="UserRoundX"
                            label="Supprimer les données"
                            disabled={exportPending || deletePending}
                            onclick={() => {
                                confirmedUID = "";
                                currentPassword = "";
                                deleteError = "";
                                deleteOpen = true;
                            }}
                        />
                    {/if}
                </div>
            </MyAccordion>
        </Accordion.Item>
    </Accordion.Root>
{/if}

<Dialog.Root bind:open={deleteOpen}>
    <Dialog.Portal>
        <MyDialog
            class="w-[min(38rem,calc(100vw-2rem))]! rounded-xl"
            layout="sectioned"
            title="Supprimer les données du client"
            description="Cette opération est irréversible."
            onInteractOutside={(event) => {
                if (deletePending) event.preventDefault();
            }}
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={deletePending}
                    onclick={() => (deleteOpen = false)}
                />
                <Button
                    variant="error"
                    size="sm"
                    type="submit"
                    form="client-data-erasure-form"
                    icon={deletePending ? "LoaderCircle" : "Trash2"}
                    iconAnimation={deletePending ? "spin" : undefined}
                    label={deletePending ? "Suppression en cours" : "Supprimer définitivement"}
                    class="w-fit px-2.5 font-semibold"
                    disabled={deletePending || confirmedUID !== uid || !currentPassword}
                />
            {/snippet}

            <form
                id="client-data-erasure-form"
                class="flex flex-col gap-4"
                onsubmit={(event) => {
                    event.preventDefault();
                    void eraseData();
                }}
            >
                <div class="rounded-lg border border-(--red)/30 bg-(--transparent-red) p-3 text-xs leading-5 text-(--dark-bg1)">
                    Les champs, notes et historiques actifs seront effacés. Les documents resteront intacts jusqu’à leur échéance légale, fixée à 10 ans, puis seront supprimés automatiquement.
                </div>
                <TextInput
                    name="client-uid-confirmation"
                    label={`Recopiez l’identifiant ${uid}`}
                    required
                    autocomplete="off"
                    spellcheck="false"
                    maxlength={uid.length}
                    tabindex={0}
                    bind:value={confirmedUID}
                    disabled={deletePending}
                />
                <PasswordInput
                    name="current-password"
                    label="Votre mot de passe actuel"
                    required
                    autocomplete="new-password"
                    tabindex={0}
                    bind:value={currentPassword}
                    disabled={deletePending}
                />
                {#if deleteError}
                    <p class="text-xs font-medium text-(--red)" role="alert">{deleteError}</p>
                {/if}
            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
