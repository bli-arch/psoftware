<script lang="ts">
    import { goto } from "$app/navigation";
    import { page } from "$app/state";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { Button, TextInput } from "$lib/components/istyler";
    import { isDefaultDeviceName, saveCurrentDevice } from "$lib/device";
    import { getStartupRoute, safeInternalRoute } from "$lib/startupRoute";

    let name = $state("");
    let saving = $state(false);
    let errorMessage = $state("");

    async function save(event: SubmitEvent) {
        event.preventDefault();
        const deviceName = name.trim();
        if (!deviceName || isDefaultDeviceName(deviceName) || saving) return;

        saving = true;
        errorMessage = "";
        try {
            const device = await saveCurrentDevice({ name: deviceName });
            if (isDefaultDeviceName(device.name)) throw new Error("Device name was not saved.");

            await goto(safeInternalRoute(page.url.searchParams.get("next"), getStartupRoute()), {
                replaceState: true,
                state: { transitionDirection: "forward" },
            });
        } catch (error) {
            console.error("Failed to save current device name", error);
            errorMessage = "Impossible d'enregistrer le nom de cet appareil.";
        } finally {
            saving = false;
        }
    }
</script>

<section class="flex h-full w-full items-center justify-center overflow-auto bg-(--light-bg2) px-5 py-8 text-(--dark-bg1)">
    <div class="flex w-full max-w-sm flex-col items-center text-center">
        <div class="flex size-14 items-center justify-center text-(--user-color)">
            <LucideIcon name="LaptopMinimalCheck" size={42} strokeWidth={1.5} />
        </div>
        <h1 class="mt-3 text-3xl font-black">Nommez cet appareil</h1>
        <p class="mt-1 text-sm leading-6 text-(--grey)">Ce nom permet d'identifier cet appareil dans votre compte et dans l'historique de sécurité.</p>

        <form class="mt-8 w-full text-left" onsubmit={save}>
            <TextInput
                label="Nom de l'appareil"
                name="current-device-name"
                placeholder="Ex. Accueil, Bureau de Léa"
                required
                maxlength="80"
                autofocus
                disabled={saving}
                bind:value={name}
            />

            {#if errorMessage}
                <p class="mt-3 text-center text-xs font-medium text-(--red)">{errorMessage}</p>
            {/if}

            <Button
                type="submit"
                label={saving ? "Enregistrement..." : "Continuer"}
                icon={saving ? "LoaderCircle" : "MoveRight"}
                iconSide="right"
                iconAnimation={saving ? "spin" : undefined}
                disabled={saving || !name.trim() || isDefaultDeviceName(name)}
                class="mt-6 w-full [&_svg]:transition-transform [&_svg]:duration-(--animation-duration-150) hover:[&_svg]:translate-x-0.5"
            />
        </form>
    </div>
</section>
