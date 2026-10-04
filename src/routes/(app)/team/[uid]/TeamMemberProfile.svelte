<script lang="ts">
    import { Accordion, Dialog } from "bits-ui";
    import { toast } from "svelte-sonner";

    import { FormPageAccordionTrigger } from "$lib/components/FormBuilder";
    import MyAccordion from "$lib/components/MyAccordion.svelte";
    import MyDialog from "$lib/components/MyDialog.svelte";
    import { Button, PasswordInput, TextInput } from "$lib/components/istyler";
    import { SettingsGroup, SettingsRow, SettingsSection } from "$lib/components/settings";
    import { getRowTone } from "$lib/components/settings/rowTone";
    import DisplayValue from "$lib/components/table/DisplayValue.svelte";
    import {
        memberDisplayName,
        memberRoleDisplay,
        resetTeamMemberPassword,
        revokeTeamMemberQuickLogin,
        teamRequestError,
        updateTeamMember,
        type TeamMember,
        type TeamMemberPatch,
    } from "$lib/team";
    import { generatePassphrase } from "$lib/utils";

    let {
        member,
        canModify = false,
        canDisable = false,
        minPasswordLength = 8,
        onUpdated,
    } = $props<{
        member: TeamMember;
        canModify?: boolean;
        canDisable?: boolean;
        minPasswordLength?: number;
        onUpdated?: (member: TeamMember) => void;
    }>();

    let editing = $state(false);
    let saving = $state(false);
    let saveError = $state("");
    let statusPending = $state(false);
    let quickLoginPending = $state(false);
    let passwordOpen = $state(false);
    let passwordPending = $state(false);
    let passwordError = $state("");
    let password = $state({ current: "", temporary: "", confirmation: "" });
    let draft = $state({ username: "", name: "", lastname: "", mail: "", phone: "" });
    let openSections = $state(["personal-information"]);

    const hasQuickLogin = $derived(Boolean(member.quickLogin?.hasPin || member.quickLogin?.hasBadge));
    const quickLoginLabel = $derived(
        hasQuickLogin
            ? [member.quickLogin?.hasBadge ? "Badge" : "", member.quickLogin?.hasPin ? "PIN" : ""].filter(Boolean).join(" + ")
            : "Non configuré",
    );
    const profileFields = $derived([
        { label: "Prénom", value: member.name || "-", display: "text" },
        { label: "Nom", value: member.lastname || "-", display: "text" },
        { label: "Identifiant", value: `@${member.username}`, display: "text" },
        { label: "Adresse e-mail", value: member.mail || "", display: "email" },
        { label: "Téléphone", value: member.phone || "", display: "phone" },
        { label: "Rôle", value: memberRoleDisplay(member), display: "role" },
    ]);

    function startEditing() {
        draft = {
            username: member.username,
            name: member.name,
            lastname: member.lastname,
            mail: member.mail,
            phone: member.phone,
        };
        saveError = "";
        editing = true;
        if (!openSections.includes("personal-information")) openSections = [...openSections, "personal-information"];
    }

    async function save() {
        if (saving) return;
        saving = true;
        saveError = "";
        try {
            const patch: TeamMemberPatch = {
                username: draft.username.trim(),
                name: draft.name.trim(),
                lastname: draft.lastname.trim(),
                mail: draft.mail.trim(),
                phone: draft.phone.trim(),
            };
            const updated = await updateTeamMember(member.id, patch);
            onUpdated?.(updated);
            editing = false;
            toast.success("Utilisateur mis à jour.");
        } catch (error) {
            console.error("Failed to update team member", error);
            saveError = teamRequestError(error, "Impossible d’enregistrer les modifications.");
        } finally {
            saving = false;
        }
    }

    async function toggleStatus() {
        if (statusPending || member.self) return;
        statusPending = true;
        try {
            const updated = await updateTeamMember(member.id, { isActive: !member.isActive });
            onUpdated?.(updated);
            toast.success(updated.isActive ? "Compte réactivé." : "Compte désactivé et sessions révoquées.");
        } catch (error) {
            console.error("Failed to update team member status", error);
            toast.error(teamRequestError(error, "Impossible de modifier l’état du compte."));
        } finally {
            statusPending = false;
        }
    }

    async function revokeQuickLogin() {
        if (quickLoginPending || member.self) return;
        quickLoginPending = true;
        try {
            await revokeTeamMemberQuickLogin(member.id);
            onUpdated?.({ ...member, quickLogin: { hasPin: false, hasBadge: false, badgeEnabled: false } });
            toast.success("Les accès rapides ont été révoqués.");
        } catch (error) {
            console.error("Failed to revoke team member quick login", error);
            toast.error(teamRequestError(error, "Impossible de révoquer les accès rapides."));
        } finally {
            quickLoginPending = false;
        }
    }

    function openPasswordReset() {
        password = { current: "", temporary: "", confirmation: "" };
        passwordError = "";
        passwordOpen = true;
    }

    async function resetPassword() {
        if (passwordPending || !password.current || !password.temporary) return;
        if (password.temporary !== password.confirmation) {
            passwordError = "La confirmation ne correspond pas.";
            return;
        }
        if ([...password.temporary].length < minPasswordLength) {
            passwordError = `Le mot de passe doit contenir au moins ${minPasswordLength} caractères.`;
            return;
        }
        if (new TextEncoder().encode(password.temporary).length > 72) {
            passwordError = "Le mot de passe ne peut pas dépasser 72 octets.";
            return;
        }

        passwordPending = true;
        passwordError = "";
        try {
            await resetTeamMemberPassword(member.id, password.current, password.temporary, password.confirmation);
            passwordOpen = false;
            toast.success("Mot de passe réinitialisé. Les sessions et accès rapides ont été révoqués.");
            onUpdated?.({
                ...member,
                isNew: true,
                activeSessions: 0,
                quickLogin: { hasPin: false, hasBadge: false, badgeEnabled: false },
            });
        } catch (error) {
            console.error("Failed to reset team member password", error);
            passwordError = teamRequestError(error, "Impossible de réinitialiser le mot de passe.");
        } finally {
            passwordPending = false;
        }
    }
</script>

<div class="flex w-full flex-col gap-5">
    <Accordion.Root type="multiple" bind:value={openSections} class="flex flex-col gap-2">
        <Accordion.Item value="personal-information" class="overflow-hidden rounded-xl border border-(--light-bg3) bg-(--light-bg1)">
            <Accordion.Header style={getRowTone("bg-blue-50 text-blue-700").background}>
                <FormPageAccordionTrigger
                    title="Informations personnelles"
                    preview={`${memberDisplayName(member)} · @${member.username}`}
                    icon="UserRound"
                    iconClass="bg-blue-50 text-blue-700"
                    open={openSections.includes("personal-information")}
                />
            </Accordion.Header>

            <MyAccordion>
                <div class="space-y-2 p-4">
                    {#if editing}
                        <form
                            class="flex flex-col gap-4"
                            onsubmit={(event) => {
                                event.preventDefault();
                                void save();
                            }}
                        >
                            <div class="grid grid-cols-1 gap-x-4 gap-y-4 sm:grid-cols-2">
                                <TextInput name="team-member-name" label="Prénom" required maxlength="50" autocomplete="given-name" bind:value={draft.name} disabled={saving} />
                                <TextInput name="team-member-lastname" label="Nom" maxlength="50" autocomplete="family-name" bind:value={draft.lastname} disabled={saving} />
                                <TextInput name="team-member-username" label="Identifiant" required maxlength="150" autocapitalize="none" spellcheck="false" bind:value={draft.username} disabled={saving} />
                                <TextInput name="team-member-mail" label="Adresse e-mail" type="email" maxlength="254" autocomplete="email" bind:value={draft.mail} disabled={saving} />
                                <TextInput name="team-member-phone" label="Téléphone" type="tel" maxlength="20" autocomplete="tel" bind:value={draft.phone} disabled={saving} />
                            </div>

                            {#if saveError}
                                <div class="rounded-lg border border-(--red)/20 bg-(--red)/10 px-3 py-2 text-xs font-medium text-(--red)" role="alert">
                                    {saveError}
                                </div>
                            {/if}

                            <div class="flex justify-end gap-2 border-t border-(--light-bg3) pt-4">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    label="Annuler"
                                    class="w-fit"
                                    disabled={saving}
                                    confirm
                                    confirmTitle="Confirmer l’annulation"
                                    confirmDescription="Les modifications non enregistrées seront perdues."
                                    confirmCancelLabel="Retour"
                                    confirmConfirmLabel="Annuler"
                                    confirmConfirmVariant="error"
                                    onclick={() => (editing = false)}
                                />
                                <Button
                                    type="submit"
                                    size="sm"
                                    icon={saving ? "Loader2" : "Check"}
                                    iconAnimation={saving ? "spin" : undefined}
                                    label={saving ? "Enregistrement..." : "Valider"}
                                    class="w-fit"
                                    disabled={saving}
                                />
                            </div>
                        </form>
                    {:else}
                        <div class="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
                            {#each profileFields as field}
                                <div>
                                    <div class="mb-1 text-xs font-semibold uppercase tracking-widest text-(--grey)">{field.label}</div>
                                    <div class="break-words text-sm leading-relaxed text-(--dark-bg1)">
                                        <DisplayValue value={field.value} display={field.display} />
                                    </div>
                                </div>
                            {/each}
                        </div>
                        {#if canModify}
                            <Button
                                variant="ghost"
                                size="xs"
                                class="w-fit bg-(--light-bg3) text-(--dark-bg1)/50 hover:bg-(--user-color)/10 hover:text-(--user-color)"
                                icon="Pencil"
                                label="Modifier"
                                onclick={startEditing}
                            />
                        {/if}
                    {/if}
                </div>
            </MyAccordion>
        </Accordion.Item>
    </Accordion.Root>

    <SettingsSection label="Sécurité">
        <SettingsGroup>
            <SettingsRow
                icon="KeyRound"
                title="Mot de passe"
                description={member.isNew
                    ? "Le mot de passe temporaire devra être remplacé à la prochaine connexion."
                    : "Réinitialiser le mot de passe et révoquer toutes les sessions actives."}
                toneClass="bg-amber-50 text-amber-700"
                badge={member.isNew ? "Temporaire" : "Défini"}
            >
                {#snippet right()}
                    {#if canModify && !member.self}
                        <Button variant="secondary" size="sm" icon="RotateCcwKey" label="Réinitialiser" class="w-fit" onclick={openPasswordReset} />
                    {:else}
                        <span class="text-xs font-medium text-(--grey)">{member.self ? "Compte actuel" : "Lecture seule"}</span>
                    {/if}
                {/snippet}
            </SettingsRow>

            <SettingsRow
                icon="BadgeCheck"
                title="Connexion rapide"
                description={hasQuickLogin
                    ? "Révoquer le badge et le PIN associés à ce compte."
                    : "Aucun badge ni PIN n’est associé à ce compte."}
                toneClass={hasQuickLogin ? "bg-blue-50 text-blue-700" : "bg-(--light-bg2) text-(--grey)"}
                badge={quickLoginLabel}
            >
                {#snippet right()}
                    {#if hasQuickLogin && canDisable && !member.self}
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={quickLoginPending ? "Loader2" : "ShieldOff"}
                            iconAnimation={quickLoginPending ? "spin" : undefined}
                            label="Révoquer"
                            class="w-fit"
                            disabled={quickLoginPending}
                            confirm
                            confirmTitle="Révoquer les accès rapides ?"
                            confirmDescription="Le badge et le PIN de cet utilisateur seront immédiatement invalidés."
                            confirmCancelLabel="Annuler"
                            confirmConfirmLabel="Révoquer"
                            confirmConfirmVariant="error"
                            onclick={revokeQuickLogin}
                        />
                    {:else}
                        <span class="text-xs font-medium text-(--grey)">{member.self ? "Compte actuel" : hasQuickLogin ? "Lecture seule" : "Aucune action"}</span>
                    {/if}
                {/snippet}
            </SettingsRow>

            <SettingsRow
                icon={member.isActive ? "UserRoundCheck" : "UserRoundX"}
                title={member.isActive ? "Compte actif" : "Compte désactivé"}
                description={member.isActive
                    ? "L’utilisateur peut se connecter et utiliser ses permissions."
                    : "Toute nouvelle authentification est refusée."}
                variant={member.isActive ? "default" : "destructive"}
                badge={member.isActive ? "Actif" : "Désactivé"}
            >
                {#snippet right()}
                    {#if canDisable && !member.self}
                        <Button
                            variant={member.isActive ? "error" : "secondary"}
                            size="sm"
                            icon={statusPending ? "Loader2" : member.isActive ? "UserRoundX" : "UserRoundCheck"}
                            iconAnimation={statusPending ? "spin" : undefined}
                            label={member.isActive ? "Désactiver" : "Réactiver"}
                            class="w-fit"
                            disabled={statusPending}
                            confirm={member.isActive}
                            confirmTitle="Désactiver ce compte ?"
                            confirmDescription="Toutes ses sessions seront immédiatement révoquées. La désactivation reste réversible."
                            confirmCancelLabel="Annuler"
                            confirmConfirmLabel="Désactiver"
                            confirmConfirmVariant="error"
                            onclick={toggleStatus}
                        />
                    {:else}
                        <span class="text-xs font-medium text-(--grey)">{member.self ? "Compte actuel" : "Lecture seule"}</span>
                    {/if}
                {/snippet}
            </SettingsRow>
        </SettingsGroup>
    </SettingsSection>
</div>

<Dialog.Root bind:open={passwordOpen}>
    <Dialog.Portal>
        <MyDialog
            class="w-[min(38rem,calc(100vw-2rem))]! rounded-xl"
            layout="sectioned"
            title="Réinitialiser le mot de passe"
            description={`Les sessions, le badge et le PIN de ${memberDisplayName(member)} seront révoqués.`}
            onInteractOutside={(event) => {
                if (passwordPending) event.preventDefault();
            }}
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={passwordPending}
                    onclick={() => (passwordOpen = false)}
                />
                <Button
                    type="submit"
                    form="team-password-reset-form"
                    size="sm"
                    icon={passwordPending ? "Loader2" : "RotateCcwKey"}
                    iconAnimation={passwordPending ? "spin" : undefined}
                    label={passwordPending ? "Réinitialisation..." : "Réinitialiser"}
                    class="w-fit px-2.5 font-semibold"
                    disabled={passwordPending || !password.current || !password.temporary || !password.confirmation}
                />
            {/snippet}

            <form
                id="team-password-reset-form"
                class="flex flex-col gap-4"
                onsubmit={(event) => {
                    event.preventDefault();
                    void resetPassword();
                }}
            >
                <PasswordInput name="team-reset-current-password" label="Votre mot de passe actuel" required bind:value={password.current} disabled={passwordPending} />
                <div class="grid items-center gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                    <PasswordInput
                        name="team-reset-temporary-password"
                        label="Nouveau mot de passe temporaire"
                        required
                        showPassword
                        icon="KeyRound"
                        iconSide="both"
                        bind:value={password.temporary}
                        disabled={passwordPending}
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
                            disabled={passwordPending}
                            onclick={() => {
                                const value = generatePassphrase(minPasswordLength);
                                password.temporary = value;
                                password.confirmation = value;
                            }}
                        />
                    </div>
                </div>
                <PasswordInput name="team-reset-password-confirmation" label="Confirmer le mot de passe" required showPassword bind:value={password.confirmation} disabled={passwordPending} />
                {#if passwordError}
                    <p class="text-xs font-medium text-(--red)" role="alert">{passwordError}</p>
                {/if}
            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
