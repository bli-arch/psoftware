<script lang="ts">
    import { Button } from "$lib/components/istyler";
    import { normalizeNoteColor, parseNoteMarkup } from "$lib/notes/noteMarkup";
    import { ExternalLink } from "lucide-svelte";
    import Self from "./NoteMarkup.svelte";
    
    let { text, color = null } = $props<{ text: string; color?: string | null }>();

    const openLink = (href: string) => {
        window.open(href, "_blank", "noopener,noreferrer");
    };

    const getCssColor = (color: string) => {
        const normalized = normalizeNoteColor(color);
        if (!normalized) return null;
        if (normalized.startsWith("#")) return normalized;
        return `var(--${normalized})`;
    };

    const getColorStyle = (color: string) => {
        const cssColor = getCssColor(color);
        if (!cssColor) return "";
        return `--note-markup-color: ${cssColor}; color: ${cssColor}`;
    };

    const boldClass = $derived(color ? "font-extrabold" : "font-extrabold text-(--dark-bg1)");
    const badgeClass = $derived(
        color
            ? "inline-flex max-w-full items-center rounded-md border border-(--note-markup-color)/20 bg-(--note-markup-color)/10 px-1.5 py-0.5 align-baseline font-mono text-xs font-medium leading-4 text-(--note-markup-color)"
            : "inline-flex max-w-full items-center rounded-md border border-(--light-bg3) bg-(--light-bg2) px-1.5 py-0.5 align-baseline font-mono text-xs font-medium leading-4 text-(--dark-bg1)"
    );
    const tokens = $derived(parseNoteMarkup(text));
</script>

<span class="contents">
    {#each tokens as token}
        {#if token.type === "text"}
            {token.value}
        {:else if token.type === "italic"}
            <em>{token.value}</em>
        {:else if token.type === "bold"}
            <strong class={boldClass}>{token.value}</strong>
        {:else if token.type === "boldItalic"}
            <strong class={boldClass}><em>{token.value}</em></strong>
        {:else if token.type === "badge"}
            <span class={badgeClass}>
                {token.value}
            </span>
        {:else if token.type === "strikethrough"}
            <s>{token.value}</s>
        {:else if token.type === "underline"}
            <u>{token.value}</u>
        {:else if token.type === "link"}
            <span>
                
                <Button
                    variant="ghost"
                    size="xs"
                    class="inline-flex h-auto w-auto max-w-full items-center justify-start gap-1 overflow-visible rounded-none 
                        p-0 align-baseline text-xs font-medium leading-5 text-(--blue) underline underline-offset-2 
                        hover:bg-transparent hover:text-(--blue)"
                    label={token.label}
                    confirm
                    confirmTitle="Ouvrir le lien ?"
                    confirmDescription={`Vous allez ouvrir ${token.href}.`}
                    confirmCancelLabel="Annuler"
                    confirmConfirmLabel="Ouvrir"
                    confirmCancelVariant="secondary"
                    confirmConfirmVariant="primary"
                    onclick={() => openLink(token.href)}
                >
                    <ExternalLink size="10" />
                </Button>
            </span>
        {:else if token.type === "color"}
            <span style={getColorStyle(token.color)}>
                <Self text={token.value} color={token.color} />
            </span>
        {/if}
    {/each}
</span>
