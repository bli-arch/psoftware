<script lang="ts">
    import { Popover, Tooltip } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import { twMerge } from "tailwind-merge";
    import MyPopover from "$lib/components/MyPopover.svelte";
    import MyTabs from "$lib/components/MyTabs.svelte";
    import MyTooltip from "$lib/components/MyTooltip.svelte";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import { colorToneStyle, cssColor } from "$lib/color";
    import { iconPickerCategories, iconPickerIconKeywords, type IconPickerCategory } from "./iconPickerCategories";
    import ColorPicker from "./ColorPicker.svelte";
    import TextInput from "./TextInput.svelte";

    type IconPickerColor = {
        value: string;
        label: string;
        textClass: string;
        bgClass: string;
        swatchClass: string;
    };

    export let value = "ClipboardList";
    export let fallback = "ClipboardList";
    export let allowDeselect = true;
    export let showColors = false;
    export let toneBackground = false;
    export let color = "";
    export let fallbackColor = "--page-icon-user";
    export let label: string | undefined = undefined;
    export let ariaLabel = "Choisir une icône";
    export let required = false;
    export let disabled = false;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon = false;
    export let tabindex: number | null | undefined = -1;
    export let categories: boolean | IconPickerCategory[] = true;
    export let colors: IconPickerColor[] = [
        { value: "", label: "Aucune", textClass: "text-(--grey)", bgClass: "bg-(--light-bg2)", swatchClass: "border border-(--light-bg3) bg-transparent" },
        { value: "--page-icon-blue", label: "Bleu", textClass: "text-(--page-icon-blue)", bgClass: "bg-(--page-icon-blue-transparent)", swatchClass: "bg-(--page-icon-blue)" },
        { value: "--page-icon-green", label: "Vert", textClass: "text-(--page-icon-green)", bgClass: "bg-(--page-icon-green-transparent)", swatchClass: "bg-(--page-icon-green)" },
        { value: "--page-icon-orange", label: "Orange", textClass: "text-(--page-icon-orange)", bgClass: "bg-(--page-icon-orange-transparent)", swatchClass: "bg-(--page-icon-orange)" },
        { value: "--page-icon-red", label: "Rouge", textClass: "text-(--page-icon-red)", bgClass: "bg-(--page-icon-red-transparent)", swatchClass: "bg-(--page-icon-red)" },
        { value: "--page-icon-purple", label: "Violet", textClass: "text-(--page-icon-purple)", bgClass: "bg-(--page-icon-purple-transparent)", swatchClass: "bg-(--page-icon-purple)" },
        { value: "--page-icon-slate", label: "Ardoise", textClass: "text-(--page-icon-slate)", bgClass: "bg-(--page-icon-slate-transparent)", swatchClass: "bg-(--page-icon-slate)" },
    ];
    export let initialCount = 84;
    export let loadStep = 56;
    export let onSelect: (icon: string) => void = () => {};
    export let onColorSelect: (color: string) => void = () => {};

    let className = "";
    export { className as class };

    let open = false;
    let query = "";
    let previousQuery = "";
    let renderedCount = initialCount;
    let activeTab = "icons";
    let triggerElement: HTMLButtonElement;
    const pickerTabs = [
        { value: "icons", label: "Icônes", icon: "Shapes" },
        { value: "color", label: "Couleur", icon: "Palette" },
    ];

    const icons = Icon as Record<string, unknown>;
    const iconNames = Object.keys(icons)
        .filter((name) =>
            /^[A-Z]/.test(name) &&
            typeof icons[name] === "function" &&
            !(name.startsWith("Lucide") || (name.endsWith("Icon") && icons[name.slice(0, -4)]))
        )
        .sort();

    const normalizeSearch = (nextValue: string) =>
        nextValue
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .toLowerCase();
    const searchName = (name: string) => normalizeSearch(name.replace(/([a-z0-9])([A-Z])/g, "$1 $2"));
    const searchText = (name: string) => [searchName(name), ...(iconPickerIconKeywords[name] ?? []).map(normalizeSearch)].join(" ");

    $: selectedIcon = iconNames.includes(value) ? value : allowDeselect && !value ? "" : fallback;
    $: selectedColor = showColors ? color || fallbackColor : "";
    $: selectedTone = showColors ? colors.find((item) => item.value === selectedColor) ?? null : null;
    $: customToneStyle = selectedColor && !selectedTone
        ? toneBackground
            ? colorToneStyle(selectedColor)
            : `color:${cssColor(selectedColor, "var(--grey)")}`
        : undefined;
    $: activeCategories = Array.isArray(categories) ? categories : iconPickerCategories;
    $: categoriesEnabled = categories !== false;
    $: portalTarget = triggerElement?.closest("[data-vaul-drawer], [role='dialog']") ?? undefined;
    $: normalizedQuery = normalizeSearch(query.trim());
    $: if (normalizedQuery !== previousQuery) {
        previousQuery = normalizedQuery;
        renderedCount = initialCount;
    }
    $: if (!open) renderedCount = initialCount;
    $: matchedIcons = normalizedQuery
        ? iconNames.filter((name) => searchText(name).includes(normalizedQuery))
        : iconNames;
    $: orderedIcons = categoriesEnabled
        ? [...matchedIcons].sort((a, b) => categoryIndex(a) - categoryIndex(b) || a.localeCompare(b))
        : matchedIcons;
    $: renderedIcons = orderedIcons.slice(0, renderedCount);
    $: iconGroups = categoriesEnabled
        ? [
            ...activeCategories.map((category) => ({
                name: category.name,
                icons: renderedIcons.filter((icon) => iconCategory(icon) === category.name),
            })),
            { name: "Autre", icons: renderedIcons.filter((icon) => iconCategory(icon) === "Autre") },
        ].filter((group) => group.icons.length)
        : [{ name: "", icons: renderedIcons }];
    $: hasMore = renderedCount < orderedIcons.length;

    function iconCategory(icon: string) {
        const name = searchName(icon);
        return activeCategories.find((category) =>
            category.terms.some((term) => name.includes(term))
        )?.name ?? "Autre";
    }

    function categoryIndex(icon: string) {
        const name = iconCategory(icon);
        const index = activeCategories.findIndex((category) => category.name === name);
        return index === -1 ? activeCategories.length : index;
    }

    function loadMore() {
        renderedCount = Math.min(renderedCount + loadStep, orderedIcons.length);
    }

    function handleScroll(event: Event) {
        const element = event.currentTarget as HTMLElement;
        if (hasMore && element.scrollTop + element.clientHeight >= element.scrollHeight - 48) loadMore();
    }

    function selectIcon(icon: string) {
        if (disabled) return;
        value = icon;
        onSelect(icon);
        open = false;
        query = "";
    }

    function clearIcon() {
        if (disabled || !allowDeselect) return;
        value = "";
        onSelect("");
        open = false;
        query = "";
    }

    function selectColor(nextColor: string) {
        if (disabled) return;
        color = nextColor;
        onColorSelect(nextColor);
    }

    function previewColor(nextColor: string) {
        if (!disabled) color = nextColor;
    }
</script>

{#snippet iconPanel()}
    <div class="flex w-full flex-col gap-2">
        <TextInput
            bind:value={query}
            icon="Search"
            iconSide="left"
            placeholder="Rechercher une icône"
            autocomplete="off"
        />

        <div class="max-h-[min(18rem,calc(100vh-12rem))] overflow-y-auto pr-1" onscroll={handleScroll}>
            {#each iconGroups as group}
                <section class="mb-2 last:mb-0">
                    {#if categoriesEnabled}
                        <div class="sticky top-0 z-10 bg-(--light-bg1) py-1 text-[11px] font-semibold uppercase tracking-wide text-(--grey)">
                            {group.name}
                        </div>
                    {/if}

                    <div class="grid grid-cols-9 gap-1">
                        {#each group.icons as icon (icon)}
                            <button
                                type="button"
                                class={twMerge(
                                    "flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors duration-(--animation-duration-150)",
                                    icon === selectedIcon
                                        ? selectedTone
                                            ? `${selectedTone.bgClass} ${selectedTone.textClass}`
                                            : selectedColor
                                                ? "bg-(--light-bg2)"
                                                : "bg-(--light-bg2) text-(--dark-bg1)"
                                        : "text-(--grey) hover:bg-(--light-bg2) hover:text-(--dark-bg1)"
                                )}
                                style={icon === selectedIcon ? customToneStyle : undefined}
                                title={icon}
                                aria-label={icon}
                                onclick={() => selectIcon(icon)}
                            >
                                <LucideIcon name={icon as any} size={16} />
                            </button>
                        {/each}
                    </div>
                </section>
            {:else}
                <div class="py-6 text-center text-xs font-medium text-(--grey)">
                    Aucune icône trouvée
                </div>
            {/each}

            {#if hasMore}
                <button
                    type="button"
                    class="mt-1 h-7 w-full cursor-pointer rounded-md text-xs font-medium text-(--grey) hover:bg-(--light-bg2) hover:text-(--dark-bg1)"
                    onclick={loadMore}
                >
                    Afficher plus
                </button>
            {/if}
        </div>

        {#if allowDeselect}
            <div class="border-t border-(--light-bg3) pt-2">
                <button
                    type="button"
                    class={twMerge(
                        "flex h-8 w-full cursor-pointer items-center justify-center gap-2 rounded-md text-xs font-medium transition-colors duration-(--animation-duration-150)",
                        selectedIcon
                            ? "text-(--grey) hover:bg-(--light-bg2) hover:text-(--dark-bg1)"
                            : "bg-(--light-bg2) text-(--dark-bg1)"
                    )}
                    aria-pressed={!selectedIcon}
                    onclick={clearIcon}
                >
                    <Icon.X size={14} />
                    Aucune icône
                </button>
            </div>
        {/if}
    </div>
{/snippet}

<div class="flex w-fit flex-col gap-1">
    {#if label}
        <span class="input-label">
            {label}
            {#if required}
                <Tooltip.Provider>
                    <Tooltip.Root delayDuration={150}>
                        <Tooltip.Trigger>
                            {#snippet child({ props })}
                                <button type="button" class="required-star" {...props} tabindex={tabindex}>
                                    <Icon.Asterisk size={16} fill="var(--red)" />
                                </button>
                            {/snippet}
                        </Tooltip.Trigger>
                        <MyTooltip>Cette donnée est requise</MyTooltip>
                    </Tooltip.Root>
                </Tooltip.Provider>
            {/if}
        </span>
    {/if}

    <Popover.Root bind:open>
        <Popover.Trigger>
            <button
                bind:this={triggerElement}
                type="button"
                {disabled}
                class={twMerge(
                    "flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border transition-colors duration-(--animation-duration-150)",
                    toneBackground && selectedTone
                        ? `${selectedTone.bgClass} ${selectedTone.textClass} border-transparent hover:brightness-95`
                        : toneBackground && selectedColor
                            ? "border-transparent hover:brightness-95"
                        : "border-(--light-bg3) bg-white text-(--grey) hover:bg-(--light-bg2) hover:text-(--dark-bg1)",
                    "focus:outline-none focus:ring-2 focus:ring-(--user-color)/25 focus:border-(--user-color)",
                    "disabled:cursor-not-allowed disabled:opacity-60",
                    !toneBackground && selectedTone?.textClass,
                    className
                )}
                style={customToneStyle}
                aria-label={label ?? ariaLabel}
                title={label ?? ariaLabel}
            >
                {#if selectedIcon}
                    <LucideIcon name={selectedIcon as any} size={16} />
                {/if}
            </button>
        </Popover.Trigger>
        <MyPopover
            {portalTarget}
            class="max-h-[var(--bits-floating-available-height)] w-80 max-w-[var(--bits-floating-available-width)] items-stretch overflow-y-auto overscroll-contain rounded-xl p-2"
            align="end"
            sideOffset={12}
            collisionPadding={16}
            sticky="always"
            strategy="fixed"
        >
                {#if showColors}
                    <MyTabs tabs={pickerTabs} bind:value={activeTab} panelClass="pt-2">
                        {#snippet children(tab)}
                            {#if tab === "icons"}
                                {@render iconPanel()}
                            {:else}
                                <ColorPicker
                                    inline
                                    value={selectedColor}
                                    fallback={fallbackColor || "#6366F1"}
                                    swatches={colors}
                                    {disabled}
                                    onInput={previewColor}
                                    onSelect={selectColor}
                                />
                            {/if}
                        {/snippet}
                    </MyTabs>
                {:else}
                    {@render iconPanel()}
                {/if}
        </MyPopover>
    </Popover.Root>

    {#if helpText}
        <span class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon">
                    <Icon.Info />
                </span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
