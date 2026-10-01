<script lang="ts">
    import { onDestroy, onMount } from "svelte";
    import { Dialog } from "bits-ui";
    import { toast } from "svelte-sonner";

    import MyDialog from "$lib/components/MyDialog.svelte";
    import TextFileDialog from "$lib/components/TextFileDialog.svelte";
    import { MAX_COMPANY_LOGO_SOURCE_BYTES, loadCompanyLogoPreview, removeCompanyLogo, uploadCompanyLogo } from "$lib/companyLogo";
    import {
        SettingsAccordionRow,
        SettingsGroup,
        SettingsPage,
        SettingsRow,
        SettingsSection,
    } from "$lib/components/settings";
    import { Button, ColorPicker, FileInput, IconPicker, TextInput } from "$lib/components/istyler";
    import { appSettings, bootstrapSettings, updateAppSettings } from "$lib/settings";
    import {
        DEFAULT_COMPANY_PROFILE,
        isPrivacyNoticeReady,
        loadCompanyProfile,
        updateCompanyProfile,
        type CompanyProfile,
    } from "$lib/companyProfile";

    type CompanyProfileKey = keyof CompanyProfile;

    const profileGroups = {
        companyInformation: [
            "display_name",
            "legal_name",
            "main_color",
            "legal_form",
            "share_capital_amount",
            "country_code",
            "siren",
            "siret",
            "vat_number",
            "registration_mention",
        ],
        publicContact: [
            "registered_address_line1",
            "registered_address_line2",
            "registered_postal_code",
            "registered_city",
            "registered_region",
            "registered_country_code",
            "contact_email",
            "contact_phone",
        ],
    } as const satisfies Record<string, readonly CompanyProfileKey[]>;

    type ProfileGroup = keyof typeof profileGroups;

    const editableTextFields = {
        privacyNotice: "privacy_notice",
    } as const;

    type EditableTextGroup = keyof typeof editableTextFields;

    const dialogCopy = {
        companyInformation: {
            title: "Modifier les informations de l'entreprise",
            description: "Renseignez l'identité légale utilisée sur les documents officiels.",
        },
        publicContact: {
            title: "Modifier les coordonnées publiques",
            description: "Renseignez les adresses et contacts affichés aux clients.",
        },
    } as const satisfies Record<ProfileGroup, { title: string; description: string }>;

    const countryCodeHelpText = "Code pays ISO 3166-1 alpha-2.";

    let profile = $state<CompanyProfile>({ ...DEFAULT_COMPANY_PROFILE });
    let savedProfile = $state<CompanyProfile>({ ...DEFAULT_COMPANY_PROFILE });
    let draftProfile = $state<CompanyProfile>({ ...DEFAULT_COMPANY_PROFILE });
    let profileReady = $state(false);
    let savingGroup = $state<ProfileGroup | EditableTextGroup | null>(null);
    let dialogOpen = $state(false);
    let privacyDialogOpen = $state(false);
    let dialogGroup = $state<ProfileGroup>("companyInformation");
    let settingsReady = $state(false);
    let companyLogoFile = $state<File | null>(null);
    let savingCompanyLogo = $state(false);
    let companyLogoPreviewUrl = $state<string | null>(null);
    let companyLogoPreviewName = $state<string | null>(null);
    let operationName = $state("Opération");
    let savedOperationName = $state("Opération");
    let operationIcon = $state("Bolt");
    let savedOperationIcon = $state("Bolt");
    let savingOperationName = $state(false);

    const companySummary = $derived(
        [profile.legal_name, profile.siret || profile.siren].filter(Boolean).join(" · ")
            || "Renseigner l'identité de l'entreprise.",
    );
    const contactSummary = $derived(
        [profile.contact_email, profile.contact_phone, profile.registered_city].filter(Boolean).join(" · ")
            || "Renseigner les coordonnées publiques.",
    );
    const companyLogoSummary = $derived(
        profile.logo_png_file
            ? "Logo de l’entreprise enregistré."
            : "Aucun logo enregistré.",
    );
    const operationNameChanged = $derived(
        operationName.trim() !== savedOperationName || operationIcon.trim() !== savedOperationIcon,
    );
    const operationNameSummary = $derived(`Les opérations sont nommées « ${savedOperationName} » dans l'application.`);
    const privacyNoticeDescription = "Notice présentant aux clients les traitements de leurs données personnelles et leurs droits.";
    const privacyNoticeNeedsReview = $derived(profileReady && !isPrivacyNoticeReady(profile));
    const dialogTitle = $derived(dialogCopy[dialogGroup].title);
    const dialogDescription = $derived(dialogCopy[dialogGroup].description);

    function applyProfile(value: CompanyProfile) {
        profile = { ...value };
        savedProfile = { ...value };
        draftProfile = { ...value };
    }

    function clearCompanyLogoPreview() {
        const previousUrl = companyLogoPreviewUrl;
        companyLogoPreviewUrl = null;
        companyLogoPreviewName = null;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
    }

    async function refreshCompanyLogoPreview(nextProfile: CompanyProfile) {
        if (!nextProfile.logo_png_file) {
            clearCompanyLogoPreview();
            return;
        }

        const nextUrl = URL.createObjectURL(await loadCompanyLogoPreview());
        const previousUrl = companyLogoPreviewUrl;
        companyLogoPreviewUrl = nextUrl;
        companyLogoPreviewName = nextProfile.logo_png_file.split("/").pop() || "logo.png";
        if (previousUrl) URL.revokeObjectURL(previousUrl);
    }

    function applyOperationSettings(value: { operationName: string; operationIcon: string }) {
        const nextName = value.operationName.trim() || "Opération";
        const nextIcon = value.operationIcon.trim() || "Bolt";
        operationName = nextName;
        savedOperationName = nextName;
        operationIcon = nextIcon;
        savedOperationIcon = nextIcon;
    }

    async function syncOperationSettings() {
        const snapshot = await bootstrapSettings();
        applyOperationSettings(snapshot.value.operation);
        settingsReady = true;
    }

    function groupChanged(fields: readonly CompanyProfileKey[], source: CompanyProfile = profile) {
        return fields.some((field) => source[field] !== savedProfile[field]);
    }

    function openDialog(group: ProfileGroup) {
        draftProfile = { ...profile };
        dialogGroup = group;
        dialogOpen = true;
    }

    async function saveProfileGroup(group: ProfileGroup, source: CompanyProfile = profile) {
        if (!profileReady || savingGroup) return false;

        const fields = profileGroups[group];
        if (!groupChanged(fields, source)) return true;

        const patch: Partial<CompanyProfile> = {};
        for (const field of fields) {
            patch[field] = source[field] as never;
        }

        savingGroup = group;
        try {
            const nextProfile = await updateCompanyProfile(patch);
            applyProfile(nextProfile);
            toast.success("Profil entreprise enregistré.");
            return true;
        } catch (error) {
            console.error("Failed to save company profile", error);
            toast.error("Impossible d'enregistrer le profil entreprise.");
            return false;
        } finally {
            savingGroup = null;
        }
    }

    async function saveDialog() {
        const saved = await saveProfileGroup(dialogGroup, draftProfile);
        if (saved) dialogOpen = false;
    }

    async function saveProfileText(group: EditableTextGroup, value: string) {
        if (!profileReady || savingGroup) throw new Error("Le profil entreprise n'est pas prêt.");

        const field = editableTextFields[group];
        if (profile[field] === value) return;

        savingGroup = group;
        try {
            const nextProfile = await updateCompanyProfile({ [field]: value } as Partial<CompanyProfile>);
            applyProfile(nextProfile);
            toast.success("Profil entreprise enregistré.");
        } catch (error) {
            console.error("Failed to save company profile text", error);
            toast.error("Impossible d'enregistrer le profil entreprise.");
            throw error;
        } finally {
            savingGroup = null;
        }
    }

    async function saveCompanyLogo() {
        const selectedFile = companyLogoFile;
        if (!profileReady || savingCompanyLogo || !selectedFile) return;

        savingCompanyLogo = true;
        try {
            const nextProfile = await uploadCompanyLogo(selectedFile);
            applyProfile(nextProfile);
            companyLogoFile = null;
            await refreshCompanyLogoPreview(nextProfile);
            toast.success("Logo de l'entreprise enregistré.");
        } catch (error) {
            console.error("Failed to save company logo", error);
            toast.error(error instanceof Error ? error.message : "Impossible d'enregistrer le logo.");
        } finally {
            savingCompanyLogo = false;
        }
    }

    async function clearCompanyLogo() {
        if (!profileReady || savingCompanyLogo || !profile.logo_png_file) return;

        savingCompanyLogo = true;
        try {
            const nextProfile = await removeCompanyLogo();
            applyProfile(nextProfile);
            companyLogoFile = null;
            clearCompanyLogoPreview();
            toast.success("Logo de l'entreprise supprimé.");
        } catch (error) {
            console.error("Failed to remove company logo", error);
            toast.error("Impossible de supprimer le logo.");
        } finally {
            savingCompanyLogo = false;
        }
    }

    async function confirmPrivacyNotice() {
        if (!profileReady || savingGroup || !profile.privacy_notice.trim()) return;

        savingGroup = "privacyNotice";
        try {
            const nextProfile = await updateCompanyProfile({ privacy_notice_confirmed: true });
            applyProfile(nextProfile);
            toast.success("Notice de confidentialité confirmée.");
        } catch (error) {
            console.error("Failed to confirm privacy notice", error);
            throw error;
        } finally {
            savingGroup = null;
        }
    }

    async function saveOperationSettings() {
        const nextName = operationName.trim();
        const nextIcon = operationIcon.trim() || "Bolt";
        if (!settingsReady || savingOperationName || (nextName === savedOperationName && nextIcon === savedOperationIcon)) return;
        if (!nextName) {
            toast.error("Le nom des opérations est obligatoire.");
            return;
        }

        savingOperationName = true;
        try {
            const snapshot = await updateAppSettings({ operation: { operationName: nextName, operationIcon: nextIcon } });
            applyOperationSettings(snapshot.value.operation);
            toast.success("Paramètres des opérations enregistrés.");
        } catch (error) {
            console.error("Failed to save operation settings", error);
            toast.error("Impossible d'enregistrer les paramètres des opérations.");
            await syncOperationSettings().catch(() => {});
        } finally {
            savingOperationName = false;
        }
    }

    onMount(async () => {
        privacyDialogOpen = new URLSearchParams(window.location.search).get("open") === "privacy";

        void (async () => {
            try {
                const nextProfile = await loadCompanyProfile();
                applyProfile(nextProfile);
                if (nextProfile.logo_png_file) {
                    try {
                        await refreshCompanyLogoPreview(nextProfile);
                    } catch (error) {
                        console.error("Failed to load company logo preview", error);
                        toast.error("Impossible de charger l'aperçu du logo.");
                    }
                }
            } catch (error) {
                console.error("Failed to load company profile", error);
                toast.error("Impossible de charger le profil entreprise.");
            } finally {
                profileReady = true;
            }
        })();

        void syncOperationSettings().catch((error) => {
            console.error("Failed to load operation settings", error);
            toast.error("Impossible de charger les paramètres des opérations.");
            settingsReady = true;
        });
    });

    onDestroy(clearCompanyLogoPreview);
</script>

<SettingsPage
    title="Général"
    description="Configurez l'identité de l'entreprise et les préférences globales."
>
    <SettingsSection label="Entreprise">
        <SettingsGroup>
            <SettingsRow
                icon="Building2"
                title="Informations de l'entreprise"
                description={companySummary}
                toneClass="bg-blue-50 text-blue-700"
            >
                {#snippet right()}
                    <Button variant="secondary" size="sm" icon="Pencil" label="Modifier" class="w-fit" disabled={!profileReady || savingGroup !== null} onclick={() => openDialog("companyInformation")} />
                {/snippet}
            </SettingsRow>

            <SettingsRow
                icon="MapPin"
                title="Coordonnées publiques"
                description={contactSummary}
                toneClass="bg-emerald-50 text-emerald-700"
            >
                {#snippet right()}
                    <Button variant="secondary" size="sm" icon="Pencil" label="Modifier" class="w-fit" disabled={!profileReady || savingGroup !== null} onclick={() => openDialog("publicContact")} />
                {/snippet}
            </SettingsRow>

            <SettingsAccordionRow
                value="company-logo"
                icon="Image"
                title="Logo de l'entreprise"
                description={companyLogoSummary}
                toneClass="bg-violet-50 text-violet-700"
            >
                <FileInput
                    label="Logo de l'entreprise"
                    name="company-logo"
                    accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg,.png,.jpg,.jpeg,.webp"
                    placeholder="Choisir une image"
                    disabled={!profileReady || savingCompanyLogo}
                    dropzone
                    preview
                    maxSize={MAX_COMPANY_LOGO_SOURCE_BYTES}
                    previewUrl={companyLogoPreviewUrl}
                    previewName={companyLogoPreviewName}
                    bind:value={companyLogoFile}
                    helpTextIcon
                    helpText="Formats SVG, PNG, JPEG ou WebP."
                />
                {#if companyLogoFile || profile.logo_png_file}
                    <div class="mt-3 flex justify-end gap-2">
                        {#if profile.logo_png_file}
                            <Button
                                variant="error"
                                size="sm"
                                icon="Trash2"
                               label="Supprimer"
                               class="w-fit"
                               disabled={!profileReady || savingCompanyLogo}
                                confirm
                                confirmTitle="Supprimer le logo de l'entreprise ?"
                                confirmDescription="Le logo enregistré sera supprimé des paramètres et ne sera plus utilisé pour les prochains documents."
                                confirmCancelLabel="Annuler"
                                confirmConfirmLabel="Supprimer"
                                confirmConfirmVariant="error"
                               onclick={() => void clearCompanyLogo()}
                            />
                        {/if}
                       {#if companyLogoFile}
                           <Button
                                variant="primary"
                               size="sm"
                               icon={savingCompanyLogo ? "LoaderCircle" : "Save"}
                               iconAnimation={savingCompanyLogo ? "spin" : undefined}
                               label="Enregistrer"
                                class="w-fit"
                                disabled={!profileReady || savingCompanyLogo}
                                onclick={() => void saveCompanyLogo()}
                            />
                        {/if}
                    </div>
                {/if}
            </SettingsAccordionRow>
        </SettingsGroup>
    </SettingsSection>

    <SettingsSection label="Préférences globales">
        <SettingsAccordionRow
            value="vocabulary"
            icon="Languages"
            title="Vocabulaire"
            description={operationNameSummary}
            badge="Global"
            toneClass="bg-violet-50 text-violet-700"
            open
        >

        <div class="flex items-start gap-4">
            <IconPicker
                label="Icône"
                bind:value={operationIcon}
                fallback="Bolt"
                allowDeselect={false}
                disabled={!settingsReady || savingOperationName}
            />
            <TextInput
                name="operation-name"
                label="Nom des opérations"
                icon={$appSettings.value.operation.operationIcon}
                iconSide="left"
                maxlength="80"
                required
                bind:value={operationName}
                disabled={!settingsReady || savingOperationName}
                helpText="Nom affiché pour ce type de dossier, par exemple Réparation, Commande ou Intervention."
            >
                {#snippet suffix()}
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={savingOperationName ? "LoaderCircle" : "Save"}
                        iconAnimation={savingOperationName ? "spin" : undefined}
                        label={operationNameChanged ? "Enregistrer" : "Enregistré"}
                        disabled={!settingsReady || savingOperationName || !operationNameChanged}
                        onclick={() => void saveOperationSettings()}
                        class="w-fit rounded-none bg-(--dark-bg1) text-(--light-bg1) hover:bg-(--user-color)
                            disabled:cursor-not-allowed disabled:bg-(--light-bg1) disabled:text-(--light-grey)"
                    />
                {/snippet}
            </TextInput>
        </div>
        </SettingsAccordionRow>

        <SettingsGroup>
            <SettingsRow
                icon="ShieldCheck"
                title="Notice de confidentialité"
                description={privacyNoticeDescription}
                toneClass="bg-emerald-50 text-emerald-700"
                attention={privacyNoticeNeedsReview}
                badge={privacyNoticeNeedsReview ? "À vérifier" : undefined}
            >
                {#snippet right()}
                    <TextFileDialog
                        title="Notice de confidentialité"
                        description={privacyNoticeDescription}
                        value={profile.privacy_notice}
                        modifiable
                        disabled={!profileReady || savingGroup !== null}
                        onSave={(value) => saveProfileText("privacyNotice", value)}
                        bind:open={privacyDialogOpen}
                        confirmed={profile.privacy_notice_confirmed}
                        onConfirm={confirmPrivacyNotice}
                        triggerLabel={privacyNoticeNeedsReview ? "Vérifier" : "Consulter"}
                        triggerIcon="ShieldCheck"
                    />
                {/snippet}
            </SettingsRow>
        </SettingsGroup>

    </SettingsSection>
</SettingsPage>

<Dialog.Root bind:open={dialogOpen}>
    <Dialog.Portal>
        <MyDialog
            class="max-h-[min(44rem,calc(100vh-4rem))]! overflow-hidden rounded-xl
                {dialogGroup === "companyInformation"
                    ? "w-[min(52rem,calc(100vw-2rem))]!"
                    : "w-[min(48rem,calc(100vw-2rem))]!"}"
            layout="sectioned"
            title={dialogTitle}
            description={dialogDescription}
        >
            {#snippet footer()}
                <Button
                    variant="secondary"
                    size="sm"
                    label="Annuler"
                    class="w-fit px-2.5 font-semibold"
                    disabled={savingGroup !== null}
                    onclick={() => (dialogOpen = false)}
                />
                <Button
                    variant="primary"
                    size="sm"
                    type="submit"
                    form="company-profile-dialog-form"
                    icon={savingGroup === dialogGroup ? "LoaderCircle" : "Save"}
                    iconAnimation={savingGroup === dialogGroup ? "spin" : undefined}
                    label={savingGroup === dialogGroup ? "Enregistrement" : "Enregistrer"}
                    class="w-fit px-2.5 font-semibold"
                    disabled={!profileReady || savingGroup !== null || !groupChanged(profileGroups[dialogGroup], draftProfile)}
                />
            {/snippet}

            <form
                id="company-profile-dialog-form"
                onsubmit={(event) => {
                    event.preventDefault();
                    void saveDialog();
                }}
            >
                {#if dialogGroup === "companyInformation"}
                    <div class="grid gap-4 md:grid-cols-2">
                        <TextInput name="display-name" label="Nom d'affichage" maxlength="120" bind:value={draftProfile.display_name} disabled={!profileReady || savingGroup !== null} helpText="Nom affiché dans l'application." helpTextIcon />
                        <TextInput name="legal-name" label="Raison sociale" required maxlength="120" bind:value={draftProfile.legal_name} disabled={!profileReady || savingGroup !== null} helpText="Dénomination figurant sur les documents officiels." helpTextIcon />
                        <TextInput name="legal-form" label="Forme juridique" maxlength="40" placeholder="SAS, SARL, EI..." bind:value={draftProfile.legal_form} disabled={!profileReady || savingGroup !== null} />
                        <ColorPicker
                            label="Couleur principale"
                            fallback="#111827"
                            bind:value={draftProfile.main_color}
                            disabled={!profileReady || savingGroup !== null}
                            helpText="Utilisée comme couleur d’accent."
                        />
                        <TextInput name="share-capital" label="Capital social" type="number" min="0" step="0.01" bind:value={draftProfile.share_capital_amount} disabled={!profileReady || savingGroup !== null} helpText="Capital social déclaré, si applicable." helpTextIcon />
                        <TextInput name="country-code" label="Pays d'immatriculation" required maxlength="2" bind:value={draftProfile.country_code} disabled={!profileReady || savingGroup !== null} helpText={countryCodeHelpText} helpTextIcon />
                        <TextInput name="siren" label="SIREN" maxlength="9" inputmode="numeric" bind:value={draftProfile.siren} disabled={!profileReady || savingGroup !== null} />
                        <TextInput name="siret" label="SIRET" maxlength="14" inputmode="numeric" bind:value={draftProfile.siret} disabled={!profileReady || savingGroup !== null} helpText="Identifiant à 14 chiffres de l'établissement." helpTextIcon />
                        <TextInput name="vat-number" label="Numéro de TVA" maxlength="32" bind:value={draftProfile.vat_number} disabled={!profileReady || savingGroup !== null} />
                        <TextInput name="registration-mention" label="Mention d'immatriculation" maxlength="160" placeholder="RCS Paris 123 456 789" bind:value={draftProfile.registration_mention} disabled={!profileReady || savingGroup !== null} helpText="Mention légale affichée sur les documents officiels." helpTextIcon />
                    </div>
                {:else if dialogGroup === "publicContact"}
                    <div class="flex flex-col gap-4">
                        <div class="text-xs font-semibold uppercase text-(--grey)">Siège social</div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <TextInput name="registered-address-line1" label="Adresse" required maxlength="160" bind:value={draftProfile.registered_address_line1} disabled={!profileReady || savingGroup !== null} />
                            <TextInput name="registered-address-line2" label="Complément" maxlength="160" bind:value={draftProfile.registered_address_line2} disabled={!profileReady || savingGroup !== null} />
                            <TextInput name="registered-postal-code" label="Code postal" required maxlength="20" bind:value={draftProfile.registered_postal_code} disabled={!profileReady || savingGroup !== null} />
                            <TextInput name="registered-city" label="Ville" required maxlength="80" bind:value={draftProfile.registered_city} disabled={!profileReady || savingGroup !== null} />
                            <TextInput name="registered-region" label="Région" maxlength="80" bind:value={draftProfile.registered_region} disabled={!profileReady || savingGroup !== null} />
                            <TextInput name="registered-country-code" label="Pays" required maxlength="2" bind:value={draftProfile.registered_country_code} disabled={!profileReady || savingGroup !== null} helpText={countryCodeHelpText} helpTextIcon />
                        </div>

                        <div class="text-xs font-semibold uppercase text-(--grey)">Contact</div>
                        <div class="grid gap-4 md:grid-cols-2">
                            <TextInput name="contact-email" label="E-mail public" type="email" maxlength="160" bind:value={draftProfile.contact_email} disabled={!profileReady || savingGroup !== null} />
                            <TextInput name="contact-phone" label="Téléphone public" type="tel" maxlength="40" bind:value={draftProfile.contact_phone} disabled={!profileReady || savingGroup !== null} />
                        </div>
                    </div>
                {/if}
            </form>
        </MyDialog>
    </Dialog.Portal>
</Dialog.Root>
