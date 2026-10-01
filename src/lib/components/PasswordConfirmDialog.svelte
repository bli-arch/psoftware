<script lang="ts">
    import { Dialog } from "bits-ui";

    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, PasswordInput } from "$lib/components/istyler";

    export let open = false;
    export let title = "Confirmer avec le mot de passe";
    export let description = "Saisissez votre mot de passe pour confirmer cette action.";
    export let passwordLabel = "Mot de passe";
    export let cancelLabel = "Annuler";
    export let confirmLabel = "Confirmer";
    export let loading = false;
    export let onConfirm: (password: string) => void | Promise<void>;

    let password = "";

    $: if (!open) {
        password = "";
    }

    async function confirm() {
        if (loading || !password) return;
        await onConfirm(password);
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Portal>
        <MyDialog class="w-100 rounded-xl">
            <Dialog.Title class="text-lg font-bold text-(--dark-bg1)">
                {title}
            </Dialog.Title>
            <Dialog.Description class="mt-1 text-sm text-(--grey)">
                {description}
            </Dialog.Description>

            <form
                class="mt-5 flex flex-col gap-4"
                onsubmit={(event) => {
                    event.preventDefault();
                    void confirm();
                }}
            >
                <PasswordInput
                    name="confirm-current-password"
                    label={passwordLabel}
                    bind:value={password}
                    disabled={loading}
                />

                <div class="flex justify-end gap-2">
                    <Button
                        variant="secondary"
                        size="sm"
                        label={cancelLabel}
                        class="w-fit"
                        disabled={loading}
                        onclick={() => (open = false)}
                    />
                    <Button
                        variant="primary"
                        size="sm"
                        icon={loading ? "Loader" : "ShieldCheck"}
                        iconAnimation={loading ? "spin" : undefined}
                        label={confirmLabel}
                        class="w-fit"
                        disabled={loading || !password}
                        onclick={confirm}
                    />
                </div>
            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
