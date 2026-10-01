<script lang="ts">
    import { createEventDispatcher, onDestroy, onMount, tick } from "svelte";
    import "./iStyler.css";
    import type { TokenDefinition, TokenParam } from "./PatternInput.types";
    import { DEFAULT_TOKENS } from "./PatternInput.types";

    export let value: string = "";
    export let type: string = "text";
    export let placeholder: string | undefined = undefined;
    export let disabled: boolean = false;
    export let readOnly: boolean = false;
    export let triggerChar: string = "@";
    export let onValidate: ((value: string) => boolean) | undefined = undefined;
    export let tokens: TokenDefinition[] | undefined = undefined;
    export let showPreview: boolean = false;
    export let previewTitle: string | undefined = undefined ;

    let parentClass = "";
    export { parentClass as class };

    const dispatch = createEventDispatcher<{
        change: string;
        selectToken: { token: TokenDefinition; insertText: string; range: { start: number; end: number } };
    }>();

    let inputEl: HTMLInputElement | null = null;
    let containerEl: HTMLDivElement | null = null;
    let menuEl: HTMLDivElement | null = null;
    let mirrorEl: HTMLDivElement | null = null;
    let mirrorBefore: HTMLSpanElement | null = null;
    let mirrorMarker: HTMLSpanElement | null = null;
    let mirrorAfter: HTMLSpanElement | null = null;

    let menuOpen = false;
    let activeIndex = 0;
    let searchQuery = "";
    let triggerStart = 0;
    let triggerEnd = 0;
    let hasTriggerChar = true;
    let activeToken: TokenDefinition | null = null;
    let paramValues: Record<string, string> = {};
    let paramInputs: HTMLInputElement[] = [];
    let menuLeft = 0;
    let menuTop = 0;
    let menuId = "pattern-menu";

    let outsideListenerAttached = false;
    let rafId: number | null = null;
    let isValid = true;
    let availableTokens: TokenDefinition[] = DEFAULT_TOKENS;

    $: {
        if (onValidate) {
            try {
                isValid = onValidate(value);
            } catch {
                isValid = false;
            }
        } else {
            isValid = true;
        }
    }
    $: availableTokens = tokens?.length ? tokens : DEFAULT_TOKENS;

    let filteredTokens: TokenDefinition[] = [];
    $: {
        const query = searchQuery.trim().toLowerCase();
        filteredTokens = query
            ? availableTokens.filter((token) => tokenMatchesQuery(token, query))
            : availableTokens;
        if (menuOpen && activeIndex >= filteredTokens.length) {
            activeIndex = 0;
        }
    }

    $: paramsValid = activeToken ? areParamsValid(activeToken) : true;
    $: if (!activeToken) paramInputs = [];

    const tokenMatchesQuery = (token: TokenDefinition, query: string) => {
        const haystack = [
            token.label,
            token.description ?? "",
            token.id,
            ...(token.keywords ?? [])
        ]
            .join(" ")
            .toLowerCase();
        return haystack.includes(query);
    };

    const getCaretIndex = () => inputEl?.selectionStart ?? value.length;

    const attachOutsideListener = () => {
        if (outsideListenerAttached) return;
        document.addEventListener("pointerdown", handleDocumentPointerDown);
        outsideListenerAttached = true;
    };

    const detachOutsideListener = () => {
        if (!outsideListenerAttached) return;
        document.removeEventListener("pointerdown", handleDocumentPointerDown);
        outsideListenerAttached = false;
    };

    const handleDocumentPointerDown = (event: PointerEvent) => {
        if (!menuOpen || !containerEl) return;
        const target = event.target as Node;
        if (!containerEl.contains(target)) {
            closeMenu();
        }
    };

    const scheduleMenuPositionUpdate = () => {
        if (!menuOpen) return;
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
            rafId = null;
            updateMenuPosition();
        });
    };

    // Best-effort caret measurement using a hidden mirror element.
    const syncMirrorStyles = () => {
        if (!inputEl || !mirrorEl) return;
        const computed = getComputedStyle(inputEl);
        const props = [
            "font",
            "letterSpacing",
            "textTransform",
            "textIndent",
            "padding",
            "border",
            "boxSizing",
            "lineHeight"
        ];
        props.forEach((prop) => {
            mirrorEl?.style.setProperty(prop, computed.getPropertyValue(prop));
        });
        mirrorEl.style.width = `${inputEl.clientWidth}px`;
    };

    const updateMenuPosition = (caretIndex: number = getCaretIndex()) => {
        if (!menuOpen || !inputEl || !containerEl || !mirrorEl || !mirrorBefore || !mirrorMarker || !mirrorAfter) {
            return;
        }
        syncMirrorStyles();
        mirrorBefore.textContent = value.slice(0, caretIndex);
        mirrorAfter.textContent = value.slice(caretIndex);
        const markerRect = mirrorMarker.getBoundingClientRect();
        const containerRect = containerEl.getBoundingClientRect();
        const containerPaddingLeft = Number.parseFloat(
            getComputedStyle(containerEl).paddingLeft || "0"
        );
        let left = markerRect.left - containerRect.left - inputEl.scrollLeft + containerPaddingLeft;
        if (!Number.isFinite(left)) left = 0;
        if (menuEl) {
            const maxLeft = Math.max(0, containerRect.width - menuEl.offsetWidth);
            left = Math.min(Math.max(0, left), maxLeft);
        } else {
            left = Math.max(0, left);
        }
        menuLeft = left;
        menuTop = containerRect.height + 6;
    };

    const openMenuAtCaret = async (startIndex: number, endIndex: number, hasTrigger: boolean) => {
        if (disabled || readOnly) return;
        menuOpen = true;
        hasTriggerChar = hasTrigger;
        triggerStart = Math.max(0, startIndex);
        triggerEnd = Math.max(triggerStart, endIndex);
        const triggerLength = triggerChar.length;
        const queryStart = triggerStart + (hasTrigger ? triggerLength : 0);
        searchQuery = value.slice(queryStart, triggerEnd);
        activeIndex = 0;
        activeToken = null;
        paramValues = {};
        attachOutsideListener();
        await tick();
        scheduleMenuPositionUpdate();
    };

    const closeMenu = () => {
        menuOpen = false;
        activeToken = null;
        searchQuery = "";
        paramValues = {};
        detachOutsideListener();
    };

    const updateQueryFromCaret = (caretIndex: number) => {
        if (!menuOpen) return;
        const triggerLength = triggerChar.length;
        if (hasTriggerChar) {
            const hasTrigger = value.slice(triggerStart, triggerStart + triggerLength) === triggerChar;
            if (!hasTrigger || caretIndex < triggerStart + triggerLength) {
                closeMenu();
                return;
            }
            triggerEnd = caretIndex;
            const nextQuery = value.slice(triggerStart + triggerLength, caretIndex);
            const changed = nextQuery !== searchQuery;
            searchQuery = nextQuery;
            if (changed) activeIndex = 0;
        } else {
            if (caretIndex < triggerStart) {
                closeMenu();
                return;
            }
            triggerEnd = caretIndex;
            const nextQuery = value.slice(triggerStart, caretIndex);
            const changed = nextQuery !== searchQuery;
            searchQuery = nextQuery;
            if (changed) activeIndex = 0;
        }
    };

    const emitChange = (nextValue: string) => {
        dispatch("change", nextValue);
    };

    const handleInput = (event: Event) => {
        const target = event.currentTarget as HTMLInputElement;
        value = target.value;
        emitChange(value);

        if (disabled || readOnly) return;

        const caret = target.selectionStart ?? value.length;

        if (menuOpen) {
            updateQueryFromCaret(caret);
            scheduleMenuPositionUpdate();
        } else if (triggerChar.length > 0) {
            const triggerLength = triggerChar.length;
            const typedTrigger =
                caret >= triggerLength && value.slice(caret - triggerLength, caret) === triggerChar;
            const inputType = event instanceof InputEvent ? event.inputType : "";
            const isInsert =
                inputType === "insertText" || inputType === "insertCompositionText";
            if (typedTrigger && isInsert) {
                openMenuAtCaret(caret - triggerLength, caret, true);
            }
        }
    };

    const handleKeydown = (event: KeyboardEvent) => {
        if (disabled || readOnly) return;

        if (event.ctrlKey && event.code === "Space") {
            event.preventDefault();
            const caret = getCaretIndex();
            openMenuAtCaret(caret, caret, false);
            return;
        }

        if (!menuOpen) return;

        if (event.key === "Escape") {
            event.preventDefault();
            if (activeToken) {
                activeToken = null;
                paramValues = {};
                return;
            }
            closeMenu();
            return;
        }

        if (activeToken) {
            if (event.key === "Enter") {
                event.preventDefault();
                confirmParams();
            }
            return;
        }

        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            moveActiveIndex(event.key === "ArrowDown" ? 1 : -1);
            return;
        }

        if (event.key === "Enter") {
            event.preventDefault();
            const token = filteredTokens[activeIndex];
            if (token) handleTokenSelect(token);
            return;
        }

        if (event.key === "Tab") {
            closeMenu();
        }
    };

    const handleKeyup = () => {
        if (!menuOpen) return;
        updateQueryFromCaret(getCaretIndex());
        scheduleMenuPositionUpdate();
    };

    const handleCaretClick = () => {
        if (!menuOpen) return;
        updateQueryFromCaret(getCaretIndex());
        scheduleMenuPositionUpdate();
    };

    const moveActiveIndex = (delta: number) => {
        if (!filteredTokens.length) return;
        const total = filteredTokens.length;
        activeIndex = (activeIndex + delta + total) % total;
    };

    const handleTokenSelect = (token: TokenDefinition) => {
        if (token.params?.length) {
            openParamEditor(token);
            return;
        }
        insertToken(token, {});
    };

    const openParamEditor = async (token: TokenDefinition) => {
        activeToken = token;
        paramValues = {};
        paramInputs = [];
        token.params?.forEach((param) => {
            paramValues[param.id] = param.defaultValue ?? "";
        });
        await tick();
        paramInputs[0]?.focus();
    };

    const updateParamValue = (paramId: string, nextValue: string) => {
        paramValues = { ...paramValues, [paramId]: nextValue };
    };

    const isParamValid = (param: TokenParam, rawValue: string) => {
        const required = param.required !== false;
        if (!required && !rawValue) return true;
        if (param.type === "number") {
            if (!rawValue) return false;
            const parsed = Number(rawValue);
            if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return false;
            if (param.min !== undefined && parsed < param.min) return false;
            if (param.max !== undefined && parsed > param.max) return false;
            return true;
        }
        if (param.type === "text") {
            if (required && !rawValue.trim()) return false;
            return true;
        }
        return true;
    };

    const areParamsValid = (token: TokenDefinition) => {
        if (!token.params?.length) return true;
        return token.params.every((param) => isParamValid(param, paramValues[param.id] ?? ""));
    };

    const confirmParams = () => {
        if (!activeToken) return;
        if (!areParamsValid(activeToken)) return;
        insertToken(activeToken, paramValues);
    };

    const insertToken = async (token: TokenDefinition, params: Record<string, string>) => {
        const insertText =
            typeof token.insertText === "function" ? token.insertText(params) : token.insertText;
        const start = triggerStart;
        const end = triggerEnd;
        const nextValue = value.slice(0, start) + insertText + value.slice(end);
        value = nextValue;
        emitChange(nextValue);
        dispatch("selectToken", { token, insertText, range: { start, end } });
        closeMenu();
        await tick();
        if (inputEl) {
            const caret = start + insertText.length;
            inputEl.focus();
            inputEl.setSelectionRange(caret, caret);
        }
    };

    const handleParamKeydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
            event.preventDefault();
            activeToken = null;
            paramValues = {};
            inputEl?.focus();
            return;
        }
        if (event.key === "Enter") {
            event.preventDefault();
            confirmParams();
        }
    };

    onMount(() => {
        menuId = `pattern-menu-${Math.random().toString(36).slice(2)}`;
    });

    onDestroy(() => {
        detachOutsideListener();
        if (rafId !== null) cancelAnimationFrame(rafId);
    });
</script>

<div class="pattern-input">
    <div
        class="input-container pattern-input-container {parentClass}"
        data-invalid={!isValid}
        bind:this={containerEl}
    >
        <input
            bind:this={inputEl}
            {type}
            {placeholder}
            {disabled}
            readonly={readOnly}
            class={parentClass}
            aria-haspopup="listbox"
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-activedescendant={menuOpen && filteredTokens.length ? `${menuId}-option-${activeIndex}` : undefined}
            on:input={handleInput}
            on:keydown={handleKeydown}
            on:keyup={handleKeyup}
            on:click={handleCaretClick}
            on:scroll={handleCaretClick}
            {...$$restProps}
            bind:value
        />

    </div>

    <div class="caret-mirror" aria-hidden="true" bind:this={mirrorEl}>
            <span bind:this={mirrorBefore}></span>
            <span class="caret-marker" bind:this={mirrorMarker}></span>
            <span bind:this={mirrorAfter}></span>
        </div>

        {#if menuOpen}
            <div
                class="absolute z-50 w-full min-w-56 max-w-sm rounded-lg border border-(--light-bg3) bg-(--light-bg1) p-2 shadow-(--shadow-popover)"
                role="listbox"
                aria-label="Pattern tokens"
                id={menuId}
                style="top: {menuTop}px;"
                bind:this={menuEl}
            >
                <div class="pattern-menu-hint">
                    Filter: {searchQuery || "type to search"}
                </div>
                <ul class="pattern-menu-list">
                    {#if filteredTokens.length === 0}
                        <li class="pattern-menu-empty" role="presentation">No matches</li>
                    {:else}
                        {#each filteredTokens as token, index (token.id)}
                            <li
                                id={`${menuId}-option-${index}`}
                                role="option"
                                aria-selected={index === activeIndex}
                                class:active={index === activeIndex}
                                class="pattern-menu-item"
                                on:mouseenter={() => (activeIndex = index)}
                                on:mousedown={(event) => {
                                    event.preventDefault();
                                    handleTokenSelect(token);
                                }}
                            >
                                <span class="pattern-menu-label">{token.label}</span>
                                {#if token.description}
                                    <span class="pattern-menu-desc">{token.description}</span>
                                {/if}
                            </li>
                        {/each}
                    {/if}
                </ul>

                {#if activeToken}
                    <div class="pattern-params" role="group" aria-label="Token parameters">
                        {#each activeToken.params ?? [] as param, index (param.id)}
                            <label class="pattern-param-row">
                                <span class="pattern-param-label">{param.label}</span>
                                <input
                                    class="pattern-param-input"
                                    type={param.type === "number" ? "number" : "text"}
                                    value={paramValues[param.id] ?? ""}
                                    placeholder={param.placeholder}
                                    min={param.min}
                                    max={param.max}
                                    step={param.step ?? (param.type === "number" ? 1 : undefined)}
                                    on:input={(event) =>
                                        updateParamValue(param.id, (event.currentTarget as HTMLInputElement).value)}
                                    on:keydown={handleParamKeydown}
                                    bind:this={paramInputs[index]}
                                />
                            </label>
                        {/each}
                        <div class="pattern-param-actions">
                            <button
                                type="button"
                                class="pattern-param-button"
                                on:click={confirmParams}
                                disabled={!paramsValid}
                            >
                                Insert
                            </button>
                            <button
                                type="button"
                                class="pattern-param-button ghost"
                                on:click={() => {
                                    activeToken = null;
                                    paramValues = {};
                                    inputEl?.focus();
                                }}
                            >
                                Back
                            </button>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

    <div class="pattern-helper">Type {triggerChar} to insert a pattern block</div>

    {#if showPreview}
        <div class="pattern-preview">
            <div class="pattern-preview-label">{previewTitle || "Preview"}</div>
            <code class="pattern-preview-value">{value}</code>
        </div>
    {/if}
</div>

<style>
    .pattern-input {
        display: flex;
        flex-direction: column;
        gap: 6px;
        width: 100%;
        position: relative;
    }

    .pattern-input-container[data-invalid="true"] {
        border-color: var(--red);
        box-shadow: 0 0 0px 3px var(--transparent-red);
    }

    .pattern-menu {
        position: absolute;
        z-index: 50;
        min-width: 220px;
        max-width: 360px;
        background: var(--light-bg1);
        border: 1px solid var(--light-bg3);
        border-radius: 8px;
        box-shadow: 0 8px 24px rgb(0 0 0 / 12%);
        padding: 8px;
        color: var(--dark-bg1);
    }

    .pattern-menu-hint {
        font-size: 0.75rem;
        color: var(--grey);
        margin-bottom: 6px;
    }

    .pattern-menu-list {
        display: flex;
        flex-direction: column;
        gap: 2px;
        max-height: 220px;
        overflow-y: auto;
    }

    .pattern-menu-item {
        padding: 6px 8px;
        border-radius: 6px;
        cursor: pointer;
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .pattern-menu-item.active,
    .pattern-menu-item:hover {
        background: var(--light-bg3);
    }

    .pattern-menu-label {
        font-size: 0.8125rem;
        font-weight: 600;
    }

    .pattern-menu-desc {
        font-size: 0.75rem;
        color: var(--grey);
    }

    .pattern-menu-empty {
        font-size: 0.75rem;
        color: var(--grey);
        padding: 6px 8px;
    }

    .pattern-params {
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--light-bg3);
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .pattern-param-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        font-size: 0.75rem;
    }

    .pattern-param-label {
        color: var(--grey);
        min-width: 64px;
    }

    .pattern-param-input {
        flex: 1;
        border: 1px solid var(--light-bg3);
        border-radius: 6px;
        padding: 4px 6px;
        font: 500 0.75rem var(--font);
        background: var(--light-bg1);
        color: var(--dark-bg1);
    }

    .pattern-param-actions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        margin-top: 4px;
    }

    .pattern-param-button {
        border: 1px solid var(--light-bg3);
        background: var(--light-bg2);
        color: var(--dark-bg1);
        border-radius: 6px;
        padding: 4px 8px;
        font-size: 0.75rem;
        cursor: pointer;
    }

    .pattern-param-button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }

    .pattern-param-button.ghost {
        background: transparent;
    }

    .pattern-helper {
        font-size: 0.75rem;
        color: var(--grey);
    }

    .pattern-preview {
        border: 1px solid var(--light-bg3);
        border-radius: 8px;
        padding: 8px;
        background: var(--light-bg2);
        display: flex;
        flex-direction: column;
        gap: 4px;
    }

    .pattern-preview-label {
        font-size: 0.75rem;
        color: var(--grey);
    }

    .pattern-preview-value {
        font-size: 0.8125rem;
        color: var(--dark-bg1);
        word-break: break-all;
    }

    .caret-mirror {
        position: absolute;
        top: 0;
        left: 0;
        visibility: hidden;
        white-space: pre;
        pointer-events: none;
        height: 100%;
    }

    .caret-marker {
        display: inline-block;
        width: 1px;
        height: 1em;
    }
</style>
