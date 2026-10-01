<script lang="ts">
    import { Dialog } from "bits-ui";
    import { toast } from "svelte-sonner";

    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, PasswordInput, Select, TextInput } from "$lib/components/istyler";
    import { createTeamMember, teamRequestError, type TeamRole } from "$lib/team";
    import { generatePassphrase } from "$lib/utils";

    let {
        open = $bindable(false),
        roles = [],
        minPasswordLength = 8,
        onCreated,
    } = $props<{
        open?: boolean;
        roles?: TeamRole[];
        minPasswordLength?: number;
        onCreated?: (user: { id: number; username: string }) => void | Promise<void>;
    }>();

    let creating = $state(false);
    let wasOpen = $state(false);
    let form = $state({
        name: "",
        lastname: "",
        username: "",
        password: "",
        confirmation: "",
        role: undefined as number | undefined,
    });

    const roleOptions = $derived(roles.map((role: TeamRole) => ({
        label: role.name?.trim() || "Rôle sans nom",
        value: role.id,
        icon: role.icon || "Shield",
        iconColor: role.iconColor,
        helpText: `${role.permissionKeys.length} permission${role.permissionKeys.length !== 1 ? "s" : ""} active${role.permissionKeys.length !== 1 ? "s" : ""}`,
    })));

    $effect(() => {
        if (open && !wasOpen) {
            form = { name: "", lastname: "", username: "", password: "", confirmation: "", role: roles[0]?.id };
        }
        wasOpen = open;
    });

    async function create() {
        const name = form.name.trim();
        const lastname = form.lastname.trim();
        const username = form.username.trim();
        const role = Number(form.role);
        if (!name || !username || !form.password || !form.confirmation || !Number.isFinite(role)) {
            toast.error("Le prénom, l’identifiant, le mot de passe et le rôle sont obligatoires.");
            return;
        }
        if (new TextEncoder().encode(form.password).length > 72) {
            toast.error("Le mot de passe ne peut pas dépasser 72 octets.");
            return;
        }
        if ([...form.password].length < minPasswordLength) {
            toast.error(`Le mot de passe doit contenir au moins ${minPasswordLength} caractères.`);
            return;
        }
        if (form.password !== form.confirmation) {
            toast.error("La confirmation ne correspond pas.");
            return;
        }

        creating = true;
        try {
            const user = await createTeamMember({ name, lastname, username, password: form.password, role });
            open = false;
            toast.success("Utilisateur créé.");
            await onCreated?.(user);
        } catch (error) {
            console.error("Failed to create team member", error);
            toast.error(teamRequestError(error, "Impossible de créer l’utilisateur."));
        } finally {
            creating = false;
        }
    }
</script>

<Dialog.Root bind:open>
    <Dialog.Portal>
        <MyDialog
            class="w-[min(36rem,calc(100vw-2rem))]! rounded-xl"
            layout="sectioned"
            title="Créer un utilisateur"
            description="Le mot de passe temporaire devra être remplacé à la première connexion."
            onInteractOutside={(event) => {
                if (creating) event.preventDefault();
            }}
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={creating}
                    onclick={() => (open = false)}
                />
                <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    form="team-member-create-form"
                    icon={creating ? "Loader" : "UserPlus"}
                    iconAnimation={creating ? "spin" : undefined}
                    label="Créer"
                    class="w-fit px-2.5 font-semibold"
                    disabled={creating || roleOptions.length === 0}
                />
            {/snippet}

            <form
                id="team-member-create-form"
                class="flex flex-col gap-5"
                onsubmit={(event) => {
                    event.preventDefault();
                    void create();
                }}
            >
                <div class="grid gap-4 sm:grid-cols-2">
                    <TextInput
                        name="new-team-member-name"
                        label="Prénom"
                        required
                        maxlength="50"
                        autocomplete="given-name"
                        bind:value={form.name}
                        disabled={creating}
                    />
                    <TextInput
                        name="new-team-member-lastname"
                        label="Nom"
                        maxlength="50"
                        autocomplete="family-name"
                        bind:value={form.lastname}
                        disabled={creating}
                    />
                </div>

                <TextInput
                    name="new-team-member-username"
                    label="Identifiant"
                    placeholder="Identifiant de connexion"
                    required
                    maxlength="150"
                    autocapitalize="none"
                    spellcheck="false"
                    bind:value={form.username}
                    disabled={creating}
                    helpText="L’utilisateur se connectera avec cet identifiant."
                    helpTextIcon
                />

                <div class="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                    <PasswordInput
                        name="new-team-member-password"
                        label="Mot de passe temporaire"
                        required
                        showPassword
                        icon="KeyRound"
                        iconSide="both"
                        bind:value={form.password}
                        disabled={creating}
                        helpText={`Minimum ${minPasswordLength} caractères.`}
                        helpTextIcon
                    />
                    <div class="flex items-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            icon="Dices"
                            label="Générer"
                            class="w-fit"
                            disabled={creating}
                            onclick={() => {
                                const password = generatePassphrase(minPasswordLength);
                                form.password = password;
                                form.confirmation = password;
                            }}
                        />
                    </div>
                </div>

                <PasswordInput
                    name="new-team-member-password-confirmation"
                    label="Confirmer le mot de passe"
                    required
                    showPassword
                    icon="LockKeyhole"
                    iconSide="both"
                    bind:value={form.confirmation}
                    disabled={creating}
                />

                <Select
                    name="new-team-member-role"
                    label="Rôle"
                    required
                    allowDeselect={false}
                    placeholder="Choisir un rôle"
                    bind:value={form.role}
                    options={roleOptions}
                    disabled={creating || roleOptions.length === 0}
                    helpText={roleOptions.length
                        ? "Seuls les rôles dont vous pouvez déléguer toutes les permissions sont proposés."
                        : "Aucun rôle délégable n’est disponible."}
                    helpTextIcon
                />

            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
