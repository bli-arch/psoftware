<script lang="ts" context="module">
    let dateFormatInputId = 0;
</script>

<script lang="ts">
    import { onDestroy, onMount, tick } from "svelte";
    import { Popover } from "bits-ui";
    import * as Icon from "lucide-svelte";
    import MyPopover from "$lib/components/MyPopover.svelte";
    import { strftime } from "$lib/utils";
    import DateFormatMenu from "./DateFormatMenu.svelte";
    import {
        DATE_FORMAT_PRESETS,
        DATE_FORMAT_TOKENS,
        DEFAULT_DATE_FORMAT_MAX_LENGTH,
        filterDateFormatTokens,
        parseDateFormat,
        validateDateFormat,
        type DateFormatPreset,
        type DateFormatToken,
    } from "./dateFormat";
    import "./iStyler.css";

    export let label: string | undefined = undefined;
    export let placeholder = "Saisissez le format";
    export let name: string | undefined = undefined;
    export let required = false;
    export let disabled = false;
    export let readonly = false;
    export let hidden = false;
    export let value: string | undefined = "";
    export let oninput: ((value: string) => void) | undefined = undefined;
    export let onvalidate: ((error: string | null) => void) | undefined = undefined;
    export let error: string | undefined = undefined;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon = false;
    export let locale = "fr-FR";
    export let previewDate: Date | string = new Date();
    export let sampleDate: Date | string = new Date(2038, 0, 19, 15, 4, 7, 123);
    export let maxLength = DEFAULT_DATE_FORMAT_MAX_LENGTH;
    export let allowLiteralPercent = false;
    export let allowedTokenCodes: readonly string[] | undefined = undefined;
    export let presets: readonly DateFormatPreset[] = DATE_FORMAT_PRESETS;
    export let formatter:
        | ((date: Date | string, format: string, locale: string) => string)
        | undefined = undefined;

    let parentClass = "";
    export { parentClass as class };

    const allTokenCodes = DATE_FORMAT_TOKENS
        .map((token) => token.code)
        .sort((left, right) => right.length - left.length);
    const normalizeText = (text: string) =>
        text.replace(/[\r\n]/g, "").replaceAll(String.fromCharCode(160), " ");
    let menuId: string | undefined;
    let descriptionId: string | undefined;

    let control: HTMLDivElement | null = null;
    let editor: HTMLDivElement | null = null;
    let menuElement: HTMLDivElement | null = null;
    let validationInput: HTMLInputElement | null = null;
    let internalValue = value ?? "";
    let renderingEditor = false;
    let composing = false;
    let popoverOpen = false;
    let tokenFilter = "";
    let lastSelectionStart = internalValue.length;
    let lastSelectionEnd = internalValue.length;
    let renderedTokenPolicy = "";
    let touched = false;
    let reportedError: string | null | undefined;
    let blurTimer: ReturnType<typeof setTimeout> | undefined;

    $: if ((value ?? "") !== internalValue) {
        const restoreSelection = typeof document !== "undefined" && document.activeElement === editor;
        const selection = restoreSelection
            ? selectionRange()
            : { start: (value ?? "").length, end: (value ?? "").length };
        internalValue = value ?? "";
        lastSelectionStart = Math.min(selection.start, internalValue.length);
        lastSelectionEnd = Math.min(selection.end, internalValue.length);
        void renderEditorSoon(lastSelectionEnd, restoreSelection);
    }
    $: parts = parseDateFormat(internalValue);
    $: validationError = error ?? validateDateFormat(internalValue, {
        required,
        maxLength,
        allowedTokenCodes,
        allowLiteralPercent,
    });
    $: validationVisible = Boolean(validationError && (touched || internalValue || error));
    $: preview = formatDate(previewDate, internalValue, locale, formatter, maxLength, allowedTokenCodes);
    $: sample = (format: string) =>
        formatDate(sampleDate, format, locale, formatter, maxLength, allowedTokenCodes);
    $: matchingTokens = filterDateFormatTokens(tokenFilter, allowedTokenCodes);
    $: availablePresets = presets.filter((preset) =>
        validateDateFormat(preset.value, {
            required: true,
            maxLength,
            allowedTokenCodes,
            allowLiteralPercent,
        }) === null
    );
    $: if (validationInput) validationInput.setCustomValidity(validationError ?? "");
    $: if (validationError !== reportedError) {
        reportedError = validationError;
        onvalidate?.(validationError);
    }
    $: if ((disabled || readonly || hidden) && popoverOpen) popoverOpen = false;
    $: tokenPolicy = allowedTokenCodes?.join("|") ?? "*";
    $: if (editor && tokenPolicy !== renderedTokenPolicy) {
        const selection = selectionRange();
        void renderEditorSoon(selection.end, typeof document !== "undefined" && document.activeElement === editor);
    }

    function isTokenAllowed(code: string) {
        return !allowedTokenCodes || allowedTokenCodes.includes(code);
    }

    function formatDate(
        date: Date | string,
        format: string,
        currentLocale: string,
        currentFormatter: typeof formatter,
        currentMaxLength: number,
        currentAllowedTokenCodes: readonly string[] | undefined,
    ) {
        if (!format) return "—";
        if (validateDateFormat(format, {
            maxLength: currentMaxLength,
            allowedTokenCodes: currentAllowedTokenCodes,
            allowLiteralPercent,
        })) return "Format invalide";

        try {
            return currentFormatter?.(date, format, currentLocale)
                ?? strftime(date, format, currentLocale);
        } catch {
            return "Format invalide";
        }
    }

    function syncValue(nextValue: string) {
        const normalized = normalizeText(nextValue);
        if (Array.from(normalized).length > maxLength) return false;

        internalValue = normalized;
        value = internalValue;
        oninput?.(internalValue);
        return true;
    }

    function renderEditor(offset = lastSelectionEnd, restoreSelection = false) {
        if (!editor) return;

        renderingEditor = true;
        editor.replaceChildren(...parseDateFormat(internalValue).map((part) => {
            if (part.type === "text") return document.createTextNode(part.value);

            const token = document.createElement("span");
            token.contentEditable = "false";
            token.dataset.dateFormatSyntax = part.token.code;
            token.className = `date-format-token${isTokenAllowed(part.token.code) ? "" : " --invalid"}`;
            token.textContent = part.token.label;
            token.title = `${part.token.description} (${part.token.code})`;
            return token;
        }));
        renderedTokenPolicy = tokenPolicy;
        renderingEditor = false;

        if (restoreSelection) setSelectionOffset(offset);
    }

    async function renderEditorSoon(offset = lastSelectionEnd, restoreSelection = false) {
        await tick();
        renderEditor(offset, restoreSelection);
    }

    function nodeSyntax(node: Node): string {
        if (node.nodeType === Node.TEXT_NODE) {
            return normalizeText(node.textContent ?? "");
        }
        if (!(node instanceof HTMLElement)) return "";
        if (node.dataset.dateFormatSyntax) return node.dataset.dateFormatSyntax;
        return Array.from(node.childNodes).map(nodeSyntax).join("");
    }

    function editorSyntax() {
        return editor ? Array.from(editor.childNodes).map(nodeSyntax).join("") : internalValue;
    }

    function nodeLength(node: Node) {
        return nodeSyntax(node).length;
    }

    function editorOffset(target: Node, targetOffset: number) {
        if (!editor || !editor.contains(target)) return null;
        let offset = 0;
        let found = false;

        const walk = (node: Node) => {
            if (found) return;

            if (node === target) {
                if (node.nodeType === Node.TEXT_NODE) {
                    offset += Math.min(targetOffset, node.textContent?.length ?? 0);
                } else {
                    offset += Array.from(node.childNodes)
                        .slice(0, targetOffset)
                        .reduce((sum, child) => sum + nodeLength(child), 0);
                }
                found = true;
                return;
            }

            if (node.nodeType === Node.TEXT_NODE || (node instanceof HTMLElement && node.dataset.dateFormatSyntax)) {
                offset += nodeLength(node);
                return;
            }

            node.childNodes.forEach(walk);
        };

        walk(editor);
        return found ? offset : null;
    }

    function selectionRange() {
        const selection = getSelection();
        if (!selection?.anchorNode || !selection.focusNode) {
            return { start: lastSelectionStart, end: lastSelectionEnd };
        }

        const anchor = editorOffset(selection.anchorNode, selection.anchorOffset);
        const focus = editorOffset(selection.focusNode, selection.focusOffset);
        if (anchor === null || focus === null) {
            return { start: lastSelectionStart, end: lastSelectionEnd };
        }

        return {
            start: Math.min(anchor, focus),
            end: Math.max(anchor, focus),
        };
    }

    function setSelectionOffset(offset: number) {
        if (!editor) return;

        const range = document.createRange();
        let remaining = Math.max(0, offset);
        let placed = false;

        const place = (node: Node) => {
            if (placed) return;

            if (node.nodeType === Node.TEXT_NODE) {
                const length = node.textContent?.length ?? 0;
                if (remaining <= length) {
                    range.setStart(node, remaining);
                    placed = true;
                } else {
                    remaining -= length;
                }
                return;
            }

            if (node instanceof HTMLElement && node.dataset.dateFormatSyntax) {
                const length = node.dataset.dateFormatSyntax.length;
                if (remaining === 0) {
                    range.setStartBefore(node);
                    placed = true;
                } else if (remaining <= length) {
                    range.setStartAfter(node);
                    placed = true;
                } else {
                    remaining -= length;
                }
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
        lastSelectionStart = offset;
        lastSelectionEnd = offset;
    }

    function tokenTriggerAtCaret() {
        const selection = selectionRange();
        if (selection.start !== selection.end) return null;

        const caret = selection.end;
        const beforeCaret = internalValue.slice(0, caret);
        if (allTokenCodes.some((code) => beforeCaret.endsWith(code))) return null;

        const match = beforeCaret.match(/%[A-Za-z_^]*$/);
        if (!match) return null;

        const syntax = match[0];
        if (allTokenCodes.some((code) => syntax.startsWith(code))) return null;

        return {
            start: caret - syntax.length,
            end: caret,
            query: syntax.slice(1),
        };
    }

    function updateTokenMenu() {
        const trigger = tokenTriggerAtCaret();
        tokenFilter = trigger?.query ?? "";
        popoverOpen = Boolean(trigger && !disabled && !readonly && !hidden);
    }

    function editorNeedsTokenRender(nextValue: string) {
        if (!editor) return false;

        const renderedCodes = Array.from(
            editor.querySelectorAll<HTMLElement>("[data-date-format-syntax]"),
            (token) => token.dataset.dateFormatSyntax,
        );
        const expectedCodes = parseDateFormat(nextValue)
            .filter((part) => part.type === "token")
            .map((part) => part.token.code);

        return renderedCodes.length !== expectedCodes.length
            || renderedCodes.some((code, index) => code !== expectedCodes[index]);
    }

    function handleInput() {
        if (renderingEditor || composing) return;

        const selection = selectionRange();
        const nextValue = editorSyntax();
        if (!syncValue(nextValue)) {
            renderEditor(lastSelectionEnd, true);
            return;
        }

        lastSelectionStart = Math.min(selection.start, internalValue.length);
        lastSelectionEnd = Math.min(selection.end, internalValue.length);
        if (editorNeedsTokenRender(nextValue)) renderEditor(lastSelectionEnd, true);

        updateTokenMenu();
    }

    function handleKeydown(event: KeyboardEvent) {
        if (event.key === "Backspace" && removeTokenAtCaret(-1)) event.preventDefault();
        if (event.key === "Delete" && removeTokenAtCaret(1)) event.preventDefault();
        if (event.key === "Enter") event.preventDefault();
        if (event.key === "Escape") popoverOpen = false;
        if (event.key === "ArrowDown" && popoverOpen) {
            event.preventDefault();
            menuElement
                ?.querySelector<HTMLButtonElement>(".date-format-preset, .date-format-token-option")
                ?.focus();
        }
    }

    function handleSelectionChange() {
        const selection = selectionRange();
        lastSelectionStart = selection.start;
        lastSelectionEnd = selection.end;
        updateTokenMenu();
    }

    function handleBlur() {
        touched = true;
        clearTimeout(blurTimer);
        blurTimer = setTimeout(() => {
            if (!menuElement?.contains(document.activeElement)) popoverOpen = false;
        });
    }

    function removeTokenAtCaret(direction: -1 | 1) {
        if (disabled || readonly || hidden) return false;

        const selection = selectionRange();
        if (selection.start !== selection.end) return false;

        const caret = selection.end;
        let cursor = 0;

        for (const part of parts) {
            const syntax = part.type === "text" ? part.value : part.token.code;
            const start = cursor;
            const end = cursor + syntax.length;
            cursor = end;

            if (part.type === "text") continue;
            if ((direction < 0 && caret === end) || (direction > 0 && caret === start)) {
                if (!syncValue(`${internalValue.slice(0, start)}${internalValue.slice(end)}`)) return false;
                renderEditor(start, true);
                return true;
            }
        }

        return false;
    }

    function insertToken(token: DateFormatToken) {
        if (disabled || readonly || hidden) return;

        const trigger = tokenTriggerAtCaret();
        const selection = selectionRange();
        const start = trigger?.start ?? selection.start;
        const end = trigger?.end ?? selection.end;
        const nextCaret = start + token.code.length;

        if (!syncValue(`${internalValue.slice(0, start)}${token.code}${internalValue.slice(end)}`)) return;
        popoverOpen = false;
        editor?.focus();
        renderEditor(nextCaret, true);
    }

    function selectPreset(preset: DateFormatPreset) {
        if (disabled || readonly || hidden || !syncValue(preset.value)) return;

        popoverOpen = false;
        editor?.focus();
        renderEditor(internalValue.length, true);
    }

    function preserveEditorSelection(event: MouseEvent) {
        event.preventDefault();
    }

    function openTokenMenu() {
        if (disabled || readonly || hidden) return;

        const selection = selectionRange();
        lastSelectionStart = selection.start;
        lastSelectionEnd = selection.end;
        tokenFilter = "";
        popoverOpen = !popoverOpen;
    }

    function closeTokenMenu() {
        popoverOpen = false;
        if (disabled || hidden) return;

        editor?.focus();
        setSelectionOffset(lastSelectionEnd);
    }

    function insertPlainText(text: string) {
        if (disabled || readonly || hidden) return;

        const selection = selectionRange();
        const normalized = normalizeText(text);
        const nextCaret = selection.start + normalized.length;
        if (!syncValue(
            `${internalValue.slice(0, selection.start)}${normalized}${internalValue.slice(selection.end)}`,
        )) return;

        renderEditor(nextCaret, true);
        updateTokenMenu();
    }

    function pastePlainText(event: ClipboardEvent) {
        const text = event.clipboardData?.getData("text/plain");
        if (text == null) return;

        event.preventDefault();
        insertPlainText(text);
    }

    function copySyntax(event: ClipboardEvent) {
        const selection = selectionRange();
        if (selection.start === selection.end || !event.clipboardData) return;

        event.preventDefault();
        event.clipboardData.setData("text/plain", internalValue.slice(selection.start, selection.end));
    }

    function cutSyntax(event: ClipboardEvent) {
        const selection = selectionRange();
        if (selection.start === selection.end || !event.clipboardData) return;

        event.preventDefault();
        event.clipboardData.setData("text/plain", internalValue.slice(selection.start, selection.end));
        if (disabled || readonly || hidden) return;
        if (!syncValue(`${internalValue.slice(0, selection.start)}${internalValue.slice(selection.end)}`)) return;

        renderEditor(selection.start, true);
    }

    function handleCompositionStart() {
        composing = true;
    }

    function handleCompositionEnd() {
        composing = false;
        handleInput();
    }

    function handleInvalid(event: Event) {
        event.preventDefault();
        touched = true;
        editor?.focus();
    }

    onMount(() => {
        const instanceId = ++dateFormatInputId;
        menuId = `date-format-menu-${instanceId}`;
        descriptionId = `date-format-description-${instanceId}`;
        renderEditor(internalValue.length);
    });
    onDestroy(() => clearTimeout(blurTimer));
</script>

<div class="date-format-field {parentClass}" class:hidden={hidden}>
    {#if label}
        <span class="input-label">
            {label}
            {#if required}
                <span class="required-star" aria-hidden="true">
                    <Icon.Asterisk size={16} fill="var(--red)" />
                </span>
            {/if}
        </span>
    {/if}

    <Popover.Root bind:open={popoverOpen}>
        <div
            bind:this={control}
            class="date-format-control"
            class:--disabled={disabled}
            class:--readonly={readonly}
            class:--invalid={validationVisible}
        >
            <div class="date-format-editor-row">
                <div
                    bind:this={editor}
                    role="combobox"
                    aria-label={label ?? "Format de date"}
                    aria-disabled={disabled}
                    aria-readonly={readonly}
                    aria-required={required}
                    aria-invalid={Boolean(validationError)}
                    aria-haspopup="dialog"
                    aria-expanded={popoverOpen}
                    aria-controls={menuId}
                    aria-describedby={validationVisible || helpText ? descriptionId : undefined}
                    tabindex={disabled ? -1 : 0}
                    contenteditable={!disabled && !readonly ? "true" : "false"}
                    spellcheck={false}
                    autocapitalize="off"
                    
                    class="date-format-editor"
                    data-placeholder={placeholder}
                    oninput={handleInput}
                    onkeydown={handleKeydown}
                    onkeyup={handleSelectionChange}
                    onclick={handleSelectionChange}
                    onfocus={handleSelectionChange}
                    onblur={handleBlur}
                    onpaste={pastePlainText}
                    oncopy={copySyntax}
                    oncut={cutSyntax}
                    oncompositionstart={handleCompositionStart}
                    oncompositionend={handleCompositionEnd}
                ></div>

                <button
                    type="button"
                    class="date-format-insert"
                    aria-label="Insérer un élément"
                    aria-haspopup="dialog"
                    aria-expanded={popoverOpen}
                    aria-controls={menuId}
                    disabled={disabled || readonly || hidden}
                    onmousedown={preserveEditorSelection}
                    onclick={openTokenMenu}
                >
                    <Icon.Plus size={14} />
                    <span>Insérer</span>
                </button>
            </div>

            <div class="date-format-preview">
                <span>
                    <Icon.Eye size={13} />
                    Aperçu
                </span>
                <output title={preview}>{preview}</output>
            </div>
        </div>

        <MyPopover
            class="w-96 max-w-[calc(100vw-24px)] items-stretch overflow-hidden rounded-lg p-1"
            customAnchor={control}
            align="start"
            sideOffset={6}
            collisionPadding={12}
            trapFocus={false}
            onOpenAutoFocus={(event) => event.preventDefault()}
            onCloseAutoFocus={(event) => event.preventDefault()}
        >
            <DateFormatMenu
                id={menuId}
                tokens={matchingTokens}
                presets={availablePresets}
                filter={tokenFilter}
                {sample}
                onSelectToken={insertToken}
                onSelectPreset={selectPreset}
                onClose={closeTokenMenu}
                bind:element={menuElement}
            />
        </MyPopover>
    </Popover.Root>

    {#if name || required}
        <input
            bind:this={validationInput}
            class="date-format-native-input"
            type="text"
            {name}
            value={internalValue}
            {required}
            disabled={disabled || hidden}
            {readonly}
            maxlength={maxLength}
            tabindex="-1"
            aria-hidden="true"
            oninvalid={handleInvalid}
        />
    {/if}

    {#if validationVisible}
        <span id={descriptionId} class="date-format-error">
            <Icon.CircleAlert size={13} />
            {validationError}
        </span>
    {:else if helpText}
        <span id={descriptionId} class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon">
                    <Icon.Info />
                </span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
