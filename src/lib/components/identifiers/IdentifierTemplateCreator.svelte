<script lang="ts">
    import { mount, onDestroy, onMount, tick, unmount } from "svelte";
    import type { Icon as IconType } from "lucide-svelte";
    import * as Icon from "lucide-svelte";
    import { Button } from "$lib/components/istyler";
    import IdentifierTokenBadge from "./IdentifierTokenBadge.svelte";
    import {
        createIdentifierPart,
        DEFAULT_IDENTIFIER_PREVIEW_OPTIONS,
        estimateIdentifierCollisionCount,
        estimateIdentifierEntropyBits,
        MAX_IDENTIFIER_LENGTH,
        parseIdentifierTemplate,
        previewIdentifierParts,
        serializeIdentifierParts,
        type IdentifierPart,
        type IdentifierTokenType
    } from "./identifierTemplate";
    import MyTooltip from "../MyTooltip.svelte";
    import { Tooltip } from "bits-ui";

    type TokenType = Exclude<IdentifierTokenType, "text">;

    type ModifierAction = {
        type: TokenType;
        label: string;
        help: string;
        icon: keyof IconType;
        class: string;
    };

    export let value = "";
    export let nextId = DEFAULT_IDENTIFIER_PREVIEW_OPTIONS.nextId;
    export let todayCount = DEFAULT_IDENTIFIER_PREVIEW_OPTIONS.todayCount;
    export let allowedTokenTypes: TokenType[] = ["sequence", "today", "date", "randomChars"];
    export let minimumEntropyBits = 40;
    export let disabled = false;

    const modifierActions: ModifierAction[] = [
        { type: "sequence", label: "Compteur global", help: "Identifiant unique incrémenté pour chaque enregistrement", icon: "ListOrdered", class: "border-orange-200 bg-orange-50 text-orange-800" },
        { type: "today", label: "Compteur quotidien", help: "Numéro incrémenté chaque jour, réinitialisé au début de la journée", icon: "CalendarClock", class: "border-violet-200 bg-violet-50 text-violet-800" },
        { type: "date", label: "Date", help: "Date de création de l'enregistrement", icon: "CalendarDays", class: "border-emerald-200 bg-emerald-50 text-emerald-800" },
        { type: "randomChars", label: "Caractères aléatoires", help: "Suite aléatoire de lettres et/ou de chiffres pour renforcer l’unicité", icon: "Dices", class: "border-blue-200 bg-blue-50 text-blue-800" },    
    ];

    $: availableActions = modifierActions.filter((action) => allowedTokenTypes.includes(action.type));

    let editor: HTMLDivElement | null = null;
    let internalValue = value;
    let renderingEditor = false;
    let tokenBadges: Array<Record<string, any>> = [];

    $: if (value !== internalValue) {
        internalValue = value ?? "";
        renderEditorSoon(internalValue.length);
    }

    $: parts = internalValue ? parseIdentifierTemplate(internalValue) : [] as IdentifierPart[];
    $: debugTemplate = internalValue;
    $: previewParts = (() => {
        let remaining = MAX_IDENTIFIER_LENGTH;
        return parts.map((part) => {
            const text = remaining > 0 ? previewIdentifierParts([part], { nextId, todayCount }).slice(0, remaining) : "";
            remaining -= text.length;
            return { part, text };
        }).filter(({ text }) => text);
    })();
    $: identifierLength = previewParts.reduce((sum, { text }) => sum + text.length, 0);
    $: identifierMaxed = identifierLength >= MAX_IDENTIFIER_LENGTH;
    $: entropyBits = estimateIdentifierEntropyBits(parts);
    $: entropyLabel = entropyBits >= minimumEntropyBits ? "Solide" : entropyBits >= minimumEntropyBits / 2 ? "Correct" : "Faible";
    $: entropyClass = entropyBits >= minimumEntropyBits ? "text-(--green)" : entropyBits >= minimumEntropyBits / 2 ? "text-(--orange)" : "text-(--red)";
    $: collisionLabel = formatCollisionCount(estimateIdentifierCollisionCount(parts));

    function formatCollisionCount(count: number) {
        if (!Number.isFinite(count)) return "aucune limite pratique";
        if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1)} Md`;
        if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)} M`;
        if (count >= 1_000) return `${(count / 1_000).toFixed(1)} k`;
        return String(count);
    }

    function syncValue(nextValue: string) {
        internalValue = nextValue.replace(/[\r\n]/g, "");
        value = internalValue;
    }

    function actionFor(type: IdentifierTokenType) {
        return modifierActions.find((action) => action.type === type)
            ?? modifierActions.find((action) => action.type === "randomChars")
            ?? modifierActions[0];
    }

    function tokenSyntax(part: IdentifierPart) {
        return serializeIdentifierParts([part]);
    }

    function updateTokenHost(tokenHost: HTMLElement, nextPart: IdentifierPart) {
        if (disabled) return;
        const previousSyntax = tokenHost.dataset.identifierSyntax ?? "";
        const nextSyntax = tokenSyntax(nextPart);
        const nodes = Array.from(editor?.childNodes ?? []);
        const tokenIndex = nodes.indexOf(tokenHost);
        if (tokenIndex < 0) return;
        const start = nodes.slice(0, tokenIndex).reduce((sum, node) => sum + nodeLength(node), 0);

        tokenHost.dataset.identifierSyntax = nextSyntax;
        syncValue(`${internalValue.slice(0, start)}${nextSyntax}${internalValue.slice(start + previousSyntax.length)}`);
    }

    function clearTokenBadges() {
        tokenBadges.forEach((component) => void unmount(component));
        tokenBadges = [];
    }

    function renderEditor(offset = internalValue.length) {
        if (!editor) return;

        const editorParts = internalValue ? parseIdentifierTemplate(internalValue) : [];

        renderingEditor = true;
        clearTokenBadges();
        editor.replaceChildren(...editorParts.map((part) => {
            if (part.type === "text") return document.createTextNode(part.value ?? "");

            const action = actionFor(part.type);
            const tokenHost = document.createElement("span");
            tokenHost.contentEditable = "false";
            tokenHost.dataset.identifierSyntax = tokenSyntax(part);
            tokenHost.className = "inline-flex align-middle";
            tokenBadges.push(mount(IdentifierTokenBadge, {
                target: tokenHost,
                props: {
                    label: action.label,
                    help: action.help,
                    icon: action.icon,
                    className: action.class,
                    part,
                    onChange: (nextPart: IdentifierPart) => updateTokenHost(tokenHost, nextPart)
                }
            }));
            return tokenHost;
        }));
        renderingEditor = false;
        setSelectionOffset(offset);
    }

    async function renderEditorSoon(offset = internalValue.length) {
        await tick();
        renderEditor(offset);
    }

    function nodeSyntax(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent?.replace(/[\r\n]/g, "") ?? "";
        if (!(node instanceof HTMLElement)) return "";
        if (node.dataset.identifierSyntax) return node.dataset.identifierSyntax;
        return Array.from(node.childNodes).map(nodeSyntax).join("");
    }

    function editorSyntax() {
        return editor ? Array.from(editor.childNodes).map(nodeSyntax).join("") : internalValue;
    }

    function nodeLength(node: Node): number {
        return nodeSyntax(node).length;
    }

    function selectionOffset() {
        const selection = getSelection();
        if (!editor || !selection?.anchorNode || !editor.contains(selection.anchorNode)) return internalValue.length;

        let offset = 0;
        let found = false;

        const walk = (node: Node) => {
            if (found) return;

            if (node === selection.anchorNode) {
                if (node.nodeType === Node.TEXT_NODE) {
                    offset += selection.anchorOffset;
                } else {
                    const children = Array.from(node.childNodes).slice(0, selection.anchorOffset);
                    offset += children.reduce((sum, child) => sum + nodeLength(child), 0);
                }
                found = true;
                return;
            }

            if (node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && node.dataset.identifierSyntax)) {
                offset += nodeLength(node);
                return;
            }

            node.childNodes.forEach(walk);
        };

        walk(editor);
        return offset;
    }

    function setSelectionOffset(offset: number) {
        if (!editor) return;

        const range = document.createRange();
        let remaining = Math.max(0, offset);
        let placed = false;

        const place = (node: Node) => {
            if (placed) return;

            if (node.nodeType === Node.TEXT_NODE) {
                const textLength = node.textContent?.length ?? 0;
                if (remaining <= textLength) {
                    range.setStart(node, remaining);
                    placed = true;
                    return;
                }
                remaining -= textLength;
                return;
            }

            if (node instanceof HTMLElement && node.dataset.identifierSyntax) {
                const length = node.dataset.identifierSyntax.length;
                if (remaining === 0) {
                    range.setStartBefore(node);
                    placed = true;
                    return;
                }

                if (remaining <= length) {
                    range.setStartAfter(node);
                    placed = true;
                    return;
                }
                remaining -= length;
                return;
            }

            node.childNodes.forEach(place);
        };

        editor.childNodes.forEach(place);
        if (!placed) range.setStart(editor, editor.childNodes.length);

        range.collapse(true);
        const selection = getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
    }

    function handleInput() {
        if (renderingEditor || disabled) return;

        const caret = selectionOffset();
        syncValue(editorSyntax());
        renderEditor(caret);
    }

    function handleBeforeInput(event: InputEvent) {
        if (disabled || (identifierMaxed && event.inputType.startsWith("insert"))) event.preventDefault();
    }

    function insertAction(action: ModifierAction) {
        if (identifierMaxed || disabled) return;

        const caret = selectionOffset();
        const syntax = serializeIdentifierParts([createIdentifierPart(action.type)]);
        const nextCaret = caret + syntax.length;

        syncValue(`${internalValue.slice(0, caret)}${syntax}${internalValue.slice(caret)}`);
        renderEditor(nextCaret);
        editor?.focus();
    }

    function removeTokenAtCaret(direction: -1 | 1) {
        const caret = selectionOffset();
        let cursor = 0;

        for (const part of parts) {
            const syntax = tokenSyntax(part);
            const start = cursor;
            const end = cursor + syntax.length;
            cursor = end;

            if (part.type === "text") continue;
            if ((direction < 0 && caret === end) || (direction > 0 && caret === start)) {
                syncValue(`${internalValue.slice(0, start)}${internalValue.slice(end)}`);
                renderEditor(start);
                return true;
            }
        }

        return false;
    }

    function handleKeydown(event: KeyboardEvent) {
        if (disabled) return;
        if (event.key === "Backspace" && removeTokenAtCaret(-1)) event.preventDefault();
        if (event.key === "Delete" && removeTokenAtCaret(1)) event.preventDefault();
        if (event.key === "Enter") event.preventDefault();
    }

    function insertPlainText(text: string) {
        const selection = getSelection();
        if (!selection?.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!editor?.contains(range.commonAncestorContainer)) return;

        range.deleteContents();
        range.insertNode(document.createTextNode(text));
        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
        handleInput();
    }

    function pastePlainText(event: ClipboardEvent) {
        const text = event.clipboardData?.getData("text/plain");
        if (text == null) return;

        event.preventDefault();
        if (identifierMaxed || disabled) return;
        insertPlainText(text.replace(/[\r\n]/g, ""));
    }

    onMount(() => renderEditor(internalValue.length));
    onDestroy(clearTokenBadges);
</script>

<div class="flex flex-col gap-4">
    <section class="rounded-lg border border-(--light-bg3) bg-(--light-bg2) p-4">
        <div class="mb-1 flex items-center justify-between gap-3">
            <div class="text-xs font-semibold uppercase tracking-widest text-(--grey)">Aperçu</div>
            <div class={`text-xs font-semibold ${identifierMaxed ? "text-(--red)" : "text-(--grey)"}`}>
                {identifierLength}/{MAX_IDENTIFIER_LENGTH}
            </div>
        </div>
        <div class="break-all font-mono text-2xl font-semibold tracking-wide text-(--dark-bg1)">
            {#if previewParts.length}
                {#each previewParts as { part, text } (part.id)}
                    {#if part.type === "text"}
                        <span>{text}</span>
                    {:else}
                        {@const action = actionFor(part.type)}
                        <span class={action.class.replace(/border-\S+|bg-\S+/g, "")}>{text}</span>
                    {/if}
                {/each}
            {:else}
                —
            {/if}
        </div>
        <div class="mt-2 flex flex-wrap items-center justify-end gap-x-1 gap-y-1 text-xs font-semibold">
            <!-- <span class={`font-semibold ${entropyClass}`}>{entropyLabel} · {entropyBits.toFixed(1)} bits</span> -->
             <Tooltip.Provider delayDuration={150}>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <span class={`flex items-center gap-1 ${entropyClass}`}>
                            <Icon.Fingerprint size={12}/> 
                            {entropyLabel}
                        </span>
                    </Tooltip.Trigger>
                    <MyTooltip>
                        Entropie de l'identifiant
                    </MyTooltip>
                </Tooltip.Root>
            </Tooltip.Provider>
            ·
            <Tooltip.Provider delayDuration={150}>
                <Tooltip.Root>
                    <Tooltip.Trigger>
                        <span class="flex items-center gap-1 text-(--dark-bg1)">
                            <Icon.CopyX size={12}/> 
                            {collisionLabel}
                        </span>
                    </Tooltip.Trigger>
                    <MyTooltip>
                        Risque de collision
                    </MyTooltip>
                </Tooltip.Root>
            </Tooltip.Provider>
        </div>
    </section>

    <div class="relative">
        <div
            bind:this={editor}
            role="textbox"
            aria-label="Format de l'identifiant"
            tabindex={disabled ? -1 : 0}
            aria-disabled={disabled}
            contenteditable={!disabled}
            class="min-h-10 h-fit w-full rounded-lg border border-(--light-bg3) bg-(--light-bg1) px-3 py-0.75 
                font-mono text-sm leading-8 text-(--dark-bg1) outline-none transition 
                empty:before:text-(--grey)/60 empty:before:content-['Composez_le_format_de_l’identifiant'] 
                focus:border-(--user-color) focus:ring-2 focus:ring-(--user-color-transparent)"
            on:input={handleInput}
            on:beforeinput={handleBeforeInput}
            on:keydown={handleKeydown}
            on:paste={pastePlainText}
        ></div>
    </div>

    <div class="flex flex-wrap gap-2">
        {#each availableActions as action (action.type)}
            <Button
                variant="ghost"
                size="xs"
                label={action.label}
                icon={String(action.icon)}
                class={`w-fit border ${action.class}`}
                disabled={identifierMaxed || disabled}
                onmousedown={(event: MouseEvent) => event.preventDefault()}
                onclick={() => insertAction(action)}
            />
        {/each}
    </div>

    <!-- <div class="rounded-md bg-(--light-bg2) px-3 py-2 text-xs text-(--grey)">
        Syntaxe: <code class="font-mono text-(--dark-bg1)">{debugTemplate || "—"}</code>
    </div> -->
</div>
