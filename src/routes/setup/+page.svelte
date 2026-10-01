<script lang="ts">
    import { goto } from "$app/navigation";
    import { MAX_COMPANY_LOGO_SOURCE_BYTES, uploadCompanyLogo } from "$lib/companyLogo";
    import { loadCompanyProfile, updateCompanyProfile, type CompanyProfile } from "$lib/companyProfile";
    import { Button, FileInput, TextInput } from "$lib/components/istyler";
    import StepProgress from "$lib/components/StepProgress.svelte";
    import TextFileDialog from "$lib/components/TextFileDialog.svelte";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { bootstrapClient, clearBootstrapCache } from "$lib/system";
    import { animationTime } from "$lib/uiPreferences";
    import * as Icon from "lucide-svelte";
    import { onMount } from "svelte";
    import { fly } from "svelte/transition";
    import { cubicIn, cubicOut } from "svelte/easing";
    import { canUseLocalServerService, getLocalServerServiceStatus, readLocalPServerLicense } from "$lib/localServerService";
    import { readPSoftwareDocument } from "$lib/localDocuments";

    const steps = ["Entreprise", "Fonctionnement", "Données", "Serveur", "Conditions", "Terminé"].map((label, index) => ({ id: index, label }));
    const titles = [
        "Configurez votre entreprise",
        "Adaptez PSoftware à votre organisation",
        "Vous gardez la maîtrise de vos données",
        "Votre serveur, vos règles",
        "Conditions d'utilisation",
        "Votre espace est prêt",
    ];
    const descriptions = [
        "Ces informations seront utilisées dans l'interface et sur les documents générés.",
        "PSoftware utilise trois éléments principaux pour s'adapter à votre façon de travailler.",
        "Les données restent sous le contrôle de votre organisation.",
        "Le serveur centralise les données et la configuration de votre équipe.",
        "Prenez connaissance des conditions qui encadrent l'utilisation de PSoft.",
        "Les repères rouges vous guideront dans les derniers réglages.",
    ];
    const icons = ["Building2", "Workflow", "ShieldCheck", "ServerCog", "ScrollText", "CircleCheckBig"];

    let stepIndex = $state(0);
    let stepDirection = $state(1);
    let loading = $state(true);
    let saving = $state(false);
    let errorMessage = $state("");
    let profile = $state<CompanyProfile | null>(null);
    let companyName = $state("");
    let companyLogo = $state<File | null>(null);
    let localServerInstalled = $state(false);
    let contentHeight = $state<number>();

    onMount(async () => {
        try {
            profile = await loadCompanyProfile();
            companyName = profile.legal_name;
        } catch (error) {
            console.error("Failed to load workspace setup", error);
            errorMessage = "Impossible de charger la configuration.";
        } finally {
            loading = false;
        }

        if (canUseLocalServerService()) {
            void getLocalServerServiceStatus()
                .then((service) => localServerInstalled = service.available)
                .catch((error) => console.error("Failed to check local PServer", error));
        }
    });

    function previous() {
        if (!stepIndex) return;
        stepDirection = -1;
        stepIndex -= 1;
        errorMessage = "";
    }

    async function next(event: SubmitEvent) {
        event.preventDefault();
        errorMessage = "";

        if (!stepIndex) {
            if (!companyName.trim()) return;

            saving = true;
            try {
                profile = await updateCompanyProfile({ legal_name: companyName.trim() });
                if (companyLogo) profile = await uploadCompanyLogo(companyLogo);
            } catch (error) {
                console.error("Failed to save workspace setup", error);
                errorMessage = "Impossible d'enregistrer la configuration.";
                return;
            } finally {
                saving = false;
            }
        }

        stepDirection = 1;
        stepIndex += 1;
    }

    async function finish() {
        if (!profile || saving) return;

        saving = true;
        errorMessage = "";
        try {
            profile = await updateCompanyProfile({
                extra: { ...profile.extra, setupCompletedAt: new Date().toISOString() },
            });
            clearBootstrapCache();
            const bootstrap = await bootstrapClient({ force: true });
            if (!bootstrap.setup?.complete) throw new Error("Workspace setup marker was not saved.");
            await goto("/home", { replaceState: true, state: { transitionDirection: "forward" } });
        } catch (error) {
            console.error("Failed to finish workspace setup", error);
            errorMessage = "Impossible de terminer la configuration.";
        } finally {
            saving = false;
        }
    }
</script>

<section class="flex h-full w-full overflow-x-hidden overflow-y-auto bg-(--light-bg2) px-5 py-8 text-(--dark-bg1)">
    <div class="m-auto flex w-full max-w-2xl flex-col items-center gap-5">

        <div class="grid min-h-32 w-full">
            {#key stepIndex}
                <div
                    class="col-start-1 row-start-1 flex min-h-32 flex-col items-center justify-center gap-3 text-center"
                    in:fly={{ x: stepDirection * 24, duration: animationTime(), delay: animationTime(), easing: cubicOut }}
                    out:fly={{ x: stepDirection * -16, duration: animationTime(), easing: cubicIn }}
                >
                    <div class="flex size-14 items-center justify-center text-(--user-color)">
                        <LucideIcon name={icons[stepIndex] ?? "Sparkles"} size={42} strokeWidth={1.5} />
                    </div>
                    <div>
                        <h1 class="text-3xl font-black">{titles[stepIndex]}</h1>
                        <p class="mt-1 text-sm text-(--grey)">{descriptions[stepIndex]}</p>
                    </div>
                </div>
            {/key}
        </div>

        <StepProgress
            {steps}
            activeIndex={stepIndex}
            onSelect={(index) => {
                if (index >= stepIndex) return;
                stepDirection = -1;
                stepIndex = index;
                errorMessage = "";
            }}
        />

        {#if errorMessage}
            <div class="w-full rounded-lg bg-(--transparent-red) px-3 py-2 text-center text-xs font-medium text-(--red)">{errorMessage}</div>
        {/if}

        {#if loading}
            <div class="flex min-h-94 items-center gap-2 text-sm text-(--grey)">
                <Icon.LoaderCircle size={16} class="ui-loader-spin" />
                Chargement...
            </div>
        {:else}
            <form class="w-full" onsubmit={next}>
                <div
                    class="grid w-full overflow-hidden transition-[height] duration-(--animation-duration-400) ease-in-out"
                    style={contentHeight === undefined ? undefined : `height: ${contentHeight}px`}
                >
                    {#key stepIndex}
                        <div
                            bind:clientHeight={contentHeight}
                            class={`col-start-1 row-start-1 flex flex-col justify-center px-1 ${stepIndex >= 1 && stepIndex <= 3 ? "h-94" : "h-fit"}`}
                            in:fly={{ x: stepDirection * 20, duration: animationTime(), delay: animationTime() }}
                            out:fly={{ x: stepDirection * -20, duration: animationTime() }}
                        >
                            {#if stepIndex === 0}
                                <div class="mx-auto flex w-full max-w-lg flex-col gap-4">
                                    <TextInput label="Raison sociale" name="setup-company-name" required maxlength="120" bind:value={companyName} />
                                    <FileInput
                                        label="Logo de l'entreprise"
                                        name="setup-company-logo"
                                        accept="image/svg+xml,image/png,image/jpeg,image/webp,.svg,.png,.jpg,.jpeg,.webp"
                                        placeholder="Choisir une image"
                                        dropzone
                                        maxSize={MAX_COMPANY_LOGO_SOURCE_BYTES}
                                        bind:value={companyLogo}
                                        helpTextIcon
                                        helpText="Formats SVG, PNG, JPEG ou WebP."
                                    />
                                </div>
                            {:else if stepIndex === 1}
                                <div class="divide-y divide-(--light-bg3)">
                                    <div class="flex gap-4 py-4">
                                        <Icon.SquareScissors size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Créez votre propre formulaire
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                Le créateur de formulaires permet de choisir les informations demandées pour chaque client
                                                et chaque opération. Vous pouvez organiser les champs en plusieurs pages, modifier leur
                                                présentation et activer le formulaire utilisé par votre équipe.
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex gap-4 py-4">
                                        <Icon.Hash size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Personnalisez vos identifiants
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                Chaque client et chaque opération reçoit automatiquement un identifiant unique.
                                                Son format peut contenir un texte fixe ou aléatoire, une date et une numérotation automatique adaptée
                                                à votre organisation.
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex gap-4 py-4">
                                        <Icon.Route size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Définissez vos statuts
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                Les statuts représentent les étapes d'une opération durant son traitement
                                                et forment la chaîne logistique de votre service.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            {:else if stepIndex === 2}
                                <div class="divide-y divide-(--light-bg3)">
                                    <div class="flex gap-4 py-4">
                                        <Icon.UsersRound size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Accès aux données
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                Les comptes, rôles et permissions permettent de limiter l'accès aux informations
                                                selon les responsabilités de chaque utilisateur.
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex gap-4 py-4">
                                        <Icon.ShieldCheck size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Protection des données
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                Votre organisation reste responsable de la durée de conservation, des sauvegardes
                                                et du traitement des demandes d'accès, de rectification, d'export et de suppression.
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex gap-4 py-4">
                                        <Icon.ListChecks size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Bonnes pratiques
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                N'enregistrez que les informations nécessaires, attribuez les permissions avec
                                                précaution et vérifiez régulièrement les comptes autorisés.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <p class="pt-3 text-center text-xs leading-5 text-(--grey)">
                                    PSoftware fournit des outils techniques de gestion des données, mais ne remplace pas les obligations juridiques de votre organisation.
                                </p>
                            {:else if stepIndex === 3}
                                <div class="divide-y divide-(--light-bg3)">
                                    <div class="flex gap-4 py-4"><Icon.UserCog size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Environnement
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                L’équipement qui héberge PServer doit être considéré comme un équipement sensible et accessible uniquement
                                                à des administrateurs habilités. Son accès physique doit être strictement limité, et son exposition réduite
                                                aux services nécessaires. La maîtrise de cet équipement donne un accès direct à l’état du serveur.
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex gap-4 py-4"><Icon.ServerCog size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Administration
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                L’administration de Windows constitue un point d’accès sensible. Un mot de passe robuste, unique et confidentiel
                                                favorise une administration sécurisée et traçable.
                                            </p>
                                        </div>
                                    </div>
                                    <div class="flex gap-4 py-4"><Icon.LockKeyhole size={20} class="mt-0.5 shrink-0 text-(--user-color)" />
                                        <div>
                                            <h2 class="text-sm font-bold">
                                                Chiffrement du stockage
                                            </h2>
                                            <p class="mt-1 text-sm leading-6 text-(--dark-bg1)">
                                                Le chiffrement du disque, avec BitLocker ou une technologie équivalente, est fortement recommandé.
                                                La clé de récupération doit être conservée séparément, dans un emplacement sécurisé.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            {:else if stepIndex === 4}
                                <div class="mx-auto max-w-lg text-center">
                                    <p class="text-sm leading-6 text-(--grey)">Ces conditions précisent les règles d'utilisation du logiciel, les responsabilités de votre organisation et les modalités liées aux données et au service.</p>
                                    <div class="mt-5 flex flex-wrap justify-center gap-2">
                                        <TextFileDialog
                                            title="Conditions d'utilisation"
                                            description="Conditions applicables à l'utilisation de PSoft."
                                            load={() => readPSoftwareDocument("conditions")}
                                            triggerLabel="Conditions d'utilisation"
                                        />
                                        <TextFileDialog
                                            title="Licence logicielle"
                                            description="Licence open source applicable à PSoft."
                                            load={() => readPSoftwareDocument("license")}
                                            triggerLabel="Licence logicielle"
                                            triggerIcon="Scale"
                                        />
                                        {#if localServerInstalled}
                                            <TextFileDialog
                                                title="Licence PServer"
                                                description="Licence logicielle applicable au PServer installé sur cet appareil."
                                                load={readLocalPServerLicense}
                                                triggerLabel="Licence PServer"
                                                triggerIcon="Server"
                                            />
                                        {/if}
                                    </div>
                                    <p class="mt-5 text-xs leading-5 text-(--grey)">Ces documents restent accessibles à tout moment dans la section « À propos ».</p>
                                </div>
                            {/if}
                        </div>
                    {/key}
                </div>

                <div class="mt-5 flex justify-between gap-2">
                    <Button
                        variant="secondary"
                        icon="MoveLeft"
                        label="Retour"
                        disabled={stepIndex === 0 || saving}
                        class="disabled:opacity-0 disabled:cursor-context-menu w-1/3 [&_svg]:transition-transform [&_svg]:duration-(--animation-duration-150) hover:[&_svg]:-translate-x-0.5"
                        onclick={previous}
                    />

                    {#if stepIndex < steps.length - 1}
                        <Button
                            type="submit"
                            icon={saving ? "LoaderCircle" : "MoveRight"}
                            iconSide="right"
                            label={saving ? "Enregistrement..." : "Continuer"}
                            iconAnimation={saving ? "spin" : undefined}
                            disabled={saving}
                            class={`w-1/3 ${saving ? undefined : "[&_svg]:transition-transform [&_svg]:duration-(--animation-duration-150) hover:[&_svg]:translate-x-0.5"}`}
                        />
                    {:else}
                        <Button
                            icon={saving ? "LoaderCircle" : "MoveRight"}
                            iconSide="right"
                            label={saving ? "Finalisation..." : "Accéder à PSoft"}
                            iconAnimation={saving ? "spin" : undefined}
                            disabled={saving}
                            class={`w-1/3 ${saving ? undefined : "[&_svg]:transition-transform [&_svg]:duration-(--animation-duration-150) hover:[&_svg]:translate-x-0.5"}`}
                            onclick={finish}
                        />
                    {/if}
                </div>
            </form>
        {/if}
    </div>
</section>
