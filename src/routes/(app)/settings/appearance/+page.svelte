<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { get } from "svelte/store";
    import { Button, ColorPicker, Radio, RangeInput } from "$lib/components/istyler";
    import { SettingsGroup, SettingsPage, SettingsRow, SettingsSection, SettingsToggleRow } from "$lib/components/settings";
    import { uiPreferences, updateUiPreferences, type UiPreferences } from "$lib/uiPreferences";

    const initialPreferences = get(uiPreferences);

    const accents = [
        
        { label: "Orange", value: "#F26313" },
        { label: "Gold", value: "#CA8A04" },

        { label: "Blue", value: "#2B7FFF" },
        { label: "Cyan", value: "#0891B2" },

        { label: "Indigo", value: "#4F46E5" },
        { label: "Violet", value: "#7C3AED" },

        { label: "Magenta", value: "#DB2777" },

        { label: "Steel", value: "#3B82A0" }
        
    ] as const;

    const densityOptions: Array<{ label: string; value: UiPreferences["density"] }> = [
        { label: "Compacte", value: "compact" },
        { label: "Standard", value: "standard" },
        { label: "Aérée", value: "comfortable" },
    ];

    const textSizeOptions: Array<{ label: string; value: UiPreferences["textSize"] }> = [
        { label: "Petite", value: "small" },
        { label: "Moyenne", value: "medium" },
        { label: "Grande", value: "large" },
    ];

    let theme = $state(initialPreferences.theme);
    let accent = $state(initialPreferences.accent);
    let densityLevel = $state(Math.max(0, densityOptions.findIndex((option) => option.value === initialPreferences.density)));
    let textSizeLevel = $state(Math.max(0, textSizeOptions.findIndex((option) => option.value === initialPreferences.textSize)));
    let appearance = $state({
        highContrast: initialPreferences.highContrast,
        stripedRows: initialPreferences.stripedRows,
        rememberWindowSize: initialPreferences.rememberWindowSize,
        animations: initialPreferences.animations,
        strongKeyboardFocus: initialPreferences.strongKeyboardFocus,
    });

    const activeAccent = $derived(accents.find((item) => item.value === accent));

    function clampLevel(value: number | string | null, max: number) {
        const nextValue = Number(value);
        if (!Number.isFinite(nextValue)) return 0;
        return Math.min(max, Math.max(0, Math.round(nextValue)));
    }

    $effect(() => {
        const densityIndex = clampLevel(densityLevel, densityOptions.length - 1);
        const textSizeIndex = clampLevel(textSizeLevel, textSizeOptions.length - 1);

        if (densityIndex !== densityLevel) densityLevel = densityIndex;
        if (textSizeIndex !== textSizeLevel) textSizeLevel = textSizeIndex;

        updateUiPreferences({
            theme,
            accent,
            density: densityOptions[densityIndex].value,
            textSize: textSizeOptions[textSizeIndex].value,
            highContrast: appearance.highContrast,
            stripedRows: appearance.stripedRows,
            rememberWindowSize: appearance.rememberWindowSize,
            animations: appearance.animations,
            strongKeyboardFocus: appearance.strongKeyboardFocus,
        });
    });
</script>

<SettingsPage
    title="Apparence"
    description="Ajustez le thème, la densité et les repères visuels."
>
    <SettingsSection label="Thème">
        <SettingsRow
            icon="Palette"
            title="Thème"
            description="Choisit l’apparence claire, sombre ou système."
            toneClass="bg-violet-50 text-violet-700"
        >
            <div class="w-full">
                <Radio
                    name="theme"
                    box
                    direction="horizontal"
                    bind:value={theme}
                    options={[
                        { label: "Clair", value: "light", icon: "Sun", hideCheckbox: true },
                        { label: "Sombre", value: "dark", icon: "Moon", hideCheckbox: true },
                        { label: "Système", value: "system", icon: "MonitorCog", hideCheckbox: true },
                    ]}
                />
            </div>
        </SettingsRow>

        <SettingsRow
            icon="Pipette"
            title="Couleur d’accent"
            description="Définit la couleur principale de l’interface."
            toneClass="bg-orange-50 text-orange-700"
        >
            <div class="flex w-full flex-col gap-3">
                <div class="flex flex-wrap items-center gap-2">
                    {#each accents as color}
                        {@const selected = accent === color.value}
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Choisir ${color.label}`}
                            aria-pressed={selected}
                            class="size-13! rounded-xl bg-(--light-bg1) p-0! {selected ? 'border-(--user-color) bg-(--user-color-transparent)' : 'hover:bg-(--light-bg2)'}"
                            onclick={() => (accent = color.value)}
                        >
                            <span
                                class="flex size-8 items-center justify-center rounded-full"
                                style={`background: ${color.value} ${selected ? "background: none" : ""}`}
                            >
                                {#if selected}
                                    <Icon.Check size={15} class="text-(--user-color) drop-shadow" />
                                {/if}
                            </span>
                        </Button>
                    {/each}
                    <ColorPicker
                        value={accent}
                        selected={!activeAccent}
                        class="size-13"
                        ariaLabel="Choisir une couleur d’accent personnalisée"
                        onInput={(color) => (accent = color)}
                    />
                </div>

                <div class="flex items-center gap-2 text-xs font-medium text-(--grey)">
                    <span class="size-3 rounded-full" style={`background: ${activeAccent?.value ?? accent}`}></span>
                    <span>{activeAccent?.label ?? "Couleur personnalisée"}</span>
                </div>
            </div>
        </SettingsRow>

        <SettingsToggleRow
            icon="Contrast"
            title="Contraste élevé"
            description="Renforce les séparateurs et les textes secondaires."
            name="high-contrast"
            toneClass="bg-slate-100 text-slate-700"
            bind:value={appearance.highContrast}
        />
    </SettingsSection>

    <SettingsSection label="Affichage">
            <SettingsRow
                icon="BetweenHorizontalStart"
                title="Densité d’affichage"
                description="Ajuste l’espacement général de l’interface."
                toneClass="bg-blue-50 text-blue-700"
            >
                <div class="w-full">
                    <RangeInput
                        name="density"
                        bind:value={densityLevel}
                        min={0}
                        max={2}
                        step={1}
                        showValue={false}
                        showBounds={false}
                    />
                    <div class="mt-2 grid grid-cols-3 text-sm font-medium text-(--grey)">
                        {#each densityOptions as option, index}
                            <span class:text-(--dark-bg1)={index === densityLevel} class:text-center={index === 1} class:text-right={index === 2}>
                                {option.label}
                            </span>
                        {/each}
                    </div>
                </div>
            </SettingsRow>

            <SettingsRow
                icon="CaseSensitive"
                title="Taille du texte"
                description="Modifie la taille du texte de l’interface."
                toneClass="bg-cyan-50 text-cyan-700"
            >
                <div class="w-full">
                    <RangeInput
                        name="text-size"
                        bind:value={textSizeLevel}
                        min={0}
                        max={2}
                        step={1}
                        showValue={false}
                        showBounds={false}
                    />
                    <div class="mt-2 grid grid-cols-3 text-sm font-medium text-(--grey)">
                        {#each textSizeOptions as option, index}
                            <span class:text-(--dark-bg1)={index === textSizeLevel} class:text-center={index === 1} class:text-right={index === 2}>
                                {option.label}
                            </span>
                        {/each}
                    </div>
                </div>
            </SettingsRow>

        <SettingsToggleRow
            icon="Rows3"
            title="Lignes alternées"
            description="Ajoute une zébrure légère aux tableaux et longues listes."
            name="striped-rows"
            toneClass="bg-indigo-50 text-indigo-700"
            bind:value={appearance.stripedRows}
        />

        <SettingsToggleRow
            icon="Maximize2"
            title="Mémoriser la taille de fenêtre"
            description="Restaure la dernière taille de fenêtre."
            name="remember-window-size"
            toneClass="bg-amber-50 text-amber-700"
            bind:value={appearance.rememberWindowSize}
        />
    </SettingsSection>

    <SettingsSection label="Effets visuels">
        <SettingsToggleRow
            icon="Sparkles"
            title="Animations"
            description="Active ou désactive les animations générales."
            name="animations"
            toneClass="bg-blue-50 text-blue-700"
            bind:value={appearance.animations}
        />
    </SettingsSection>

    <SettingsSection label="Accessibilité">
        <SettingsToggleRow
            icon="Focus"
            title="Focus clavier renforcé"
            description="Rend la navigation au clavier plus visible."
            name="strong-keyboard-focus"
            toneClass="bg-violet-50 text-violet-700"
            bind:value={appearance.strongKeyboardFocus}
        />
    </SettingsSection>
</SettingsPage>
