<script lang="ts">
    import * as Icon from "lucide-svelte";
    import {
        DATE_FORMAT_CATEGORIES,
        type DateFormatPreset,
        type DateFormatToken,
    } from "./dateFormat";

    export let id: string | undefined = undefined;
    export let tokens: readonly DateFormatToken[] = [];
    export let presets: readonly DateFormatPreset[] = [];
    export let filter = "";
    export let sample: (format: string) => string;
    export let onSelectToken: (token: DateFormatToken) => void;
    export let onSelectPreset: (preset: DateFormatPreset) => void;
    export let onClose: () => void;
    export let element: HTMLDivElement | null = null;

    $: groups = DATE_FORMAT_CATEGORIES.map((category) => ({
        ...category,
        tokens: tokens.filter((token) => token.category === category.id),
    })).filter((category) => category.tokens.length);

    function handleKeydown(event: KeyboardEvent) {
        if (event.key !== "Escape") return;
        event.preventDefault();
        onClose();
    }
</script>

<div
    {id}
    class="date-format-menu"
    bind:this={element}
    role="dialog"
    tabindex="-1"
    aria-label="Éléments du format de date"
    onkeydown={handleKeydown}
>
    <div class="date-format-menu-header">
        <span>
            <strong>Éléments du format</strong>
            <small>Insérez un élément à la position du curseur.</small>
        </span>
        <button type="button" aria-label="Fermer" onclick={onClose}>
            <Icon.X size={15} />
        </button>
    </div>

    <div class="date-format-menu-content">
        {#if presets.length && !filter}
            <section class="date-format-menu-section">
                <h4>Formats courants</h4>
                <p class="date-format-presets-help">Remplace le format actuel.</p>
                <div class="date-format-presets">
                    {#each presets as preset (preset.value)}
                        <button
                            type="button"
                            class="date-format-preset"
                            onmousedown={(event) => event.preventDefault()}
                            onclick={() => onSelectPreset(preset)}
                        >
                            <span>{preset.label}</span>
                            <code>{sample(preset.value)}</code>
                        </button>
                    {/each}
                </div>
            </section>
        {/if}

        {#each groups as group (group.id)}
            <section class="date-format-menu-section">
                <h4>{group.label}</h4>
                <div class="date-format-token-list">
                    {#each group.tokens as token (token.code)}
                        <button
                            type="button"
                            class="date-format-token-option"
                            onmousedown={(event) => event.preventDefault()}
                            onclick={() => onSelectToken(token)}
                        >
                            <code>{token.code}</code>
                            <span>
                                <strong>{token.label}</strong>
                                <small>{token.description}</small>
                            </span>
                            <samp>{sample(token.code)}</samp>
                        </button>
                    {/each}
                </div>
            </section>
        {:else}
            <div class="date-format-menu-empty">
                <Icon.SearchX size={18} />
                <span>Aucun élément correspondant</span>
            </div>
        {/each}
    </div>
</div>
