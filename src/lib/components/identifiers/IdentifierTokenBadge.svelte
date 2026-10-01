<script lang="ts">
    import { Popover } from "bits-ui";
    import type { Icon } from "lucide-svelte";
    import { Badge } from "$lib/components/Badge";
    import {
        DateFormatInput,
        IDENTIFIER_DATE_FORMAT_PRESETS,
        IDENTIFIER_DATE_FORMAT_TOKEN_CODES,
        NumberInput,
        Radio,
    } from "$lib/components/istyler";
    import MyPopover from "$lib/components/MyPopover.svelte";
    import {
        formatIdentifierDate,
        MAX_IDENTIFIER_PART_LENGTH,
        type IdentifierCaseMode,
        type IdentifierPart,
    } from "./identifierTemplate";

    export let label: string;
    export let help: string;
    export let icon: keyof Icon;
    export let className = "";
    export let part: IdentifierPart;
    export let onChange: (part: IdentifierPart) => void = () => {};

    const clampLength = (value: number | null | undefined) =>
        Math.min(MAX_IDENTIFIER_PART_LENGTH, Math.max(1, Math.trunc(Number(value) || 1)));
    const legacyDateDirectives = "aAbBdwymYHIMS";
    const canonicalizeLegacyDateFormat = (value: string) => {
        const characters = Array.from(value);
        let canonical = "";

        for (let index = 0; index < characters.length; index += 1) {
            const character = characters[index];
            if (character === "%" && index + 1 < characters.length) {
                canonical += character + characters[index + 1];
                index += 1;
            } else {
                canonical += legacyDateDirectives.includes(character) ? `%${character}` : character;
            }
        }

        return canonical;
    };

    let length = clampLength(part.length);
    let format = String(part.format || "Ymd");
    let formatError: string | undefined;
    let randomKind = part.type === "randomLetters" ? "letters" : part.type === "randomNumbers" ? "numbers" : "both";
    let caseMode: IdentifierCaseMode = part.caseMode ?? "mixed";

    function commit(patch: Partial<IdentifierPart>) {
        part = { ...part, ...patch };
        onChange(part);
    }

    function updateFormat() {
        const storedFormat = String(part.format || "Ymd");
        let nextFormat = String(format || "Ymd");

        if (!storedFormat.includes("%") && nextFormat.includes("%")) {
            const canonical = canonicalizeLegacyDateFormat(nextFormat);
            if (Array.from(canonical).length > MAX_IDENTIFIER_PART_LENGTH) {
                format = storedFormat;
                formatError = "Ce format historique est trop long pour être converti sans modifier l’identifiant. Choisissez un format courant.";
                return;
            }
            nextFormat = canonical;
        }

        formatError = undefined;
        format = Array.from(nextFormat).slice(0, MAX_IDENTIFIER_PART_LENGTH).join("");
        commit({ format });
    }

    function updateRandomKinds() {
        commit({ type: randomKind === "letters" ? "randomLetters" : randomKind === "numbers" ? "randomNumbers" : "randomChars" });
    }

    function updateCaseMode() {
        commit({ caseMode });
    }

    $: if (part.type === "sequence" || part.type === "today" || part.type.startsWith("random")) {
        const nextLength = clampLength(length);
        if (length !== nextLength) length = nextLength;
        if (nextLength !== (part.length ?? 1)) commit({ length: nextLength });
    }

</script>

<Popover.Root>
    <Popover.Trigger class="flex size focus:ring-0 cursor-pointer mx-0.5">
        <Badge text={label} {icon} type="ghost" class={`border ${className}`} />
    </Popover.Trigger>

    <MyPopover
        class={`focus:outline-0 max-w-[calc(100vw-24px)] items-stretch rounded-xl p-0 text-left font-sans ${part.type === "date" ? "w-88" : "w-72"}`}
        align="start"
    >
        <div
            class="flex w-full flex-col"
            role="presentation"
            on:input|stopPropagation
            on:change|stopPropagation
            on:keydown|stopPropagation
        >
            <div class="border-b border-(--light-bg3) px-3 py-1.5">
                <div class="text-sm font-bold text-(--dark-bg1)">{label}</div>
                <p class="text-xs font-normal leading-5 text-(--grey)">{help}</p>
            </div>

            <div class={`flex flex-col gap-3 py-1.5 ${part.type === "date" ? "px-2" : "px-3"}`}>
                {#if part.type === "sequence" || part.type === "today"}
                    <NumberInput
                        name={`identifier-${part.id}-length`}
                        label="Nombre de chiffres"
                        min={1}
                        max={MAX_IDENTIFIER_PART_LENGTH}
                        display="lateral"
                        bind:value={length}
                    />
                {:else if part.type === "date"}
                    <DateFormatInput
                        name={`identifier-${part.id}-format`}
                        label="Format de date"
                        required
                        error={formatError}
                        maxLength={MAX_IDENTIFIER_PART_LENGTH}
                        allowedTokenCodes={IDENTIFIER_DATE_FORMAT_TOKEN_CODES}
                        presets={IDENTIFIER_DATE_FORMAT_PRESETS}
                        formatter={(date, pattern) =>
                            formatIdentifierDate(pattern, date instanceof Date ? date : new Date(date))}
                        helpText="Définit la date intégrée à l’identifiant."
                        helpTextIcon
                        bind:value={format}
                        oninput={updateFormat}
                    />
                {:else}
                    <NumberInput
                        name={`identifier-${part.id}-length`}
                        label="Nombre de caractères"
                        min={1}
                        max={MAX_IDENTIFIER_PART_LENGTH}
                        display="lateral"
                        bind:value={length}
                    />
                    <Radio
                        name={`identifier-${part.id}-characters`}
                        label="Caractères"
                        bind:value={randomKind}
                        box
                        checkmark={false}
                        direction="horizontal"
                        parentClass="size-10! items-center! p-0! [&_.option-container]:justify-center [&_.radio-icon]:text-(--grey) [&.--checked_.radio-icon]:text-(--user-color)"
                        options={[
                            { label: "", ariaLabel: "Lettres et chiffres", tooltip: "Alphanumérique : lettres et chiffres", value: "both", icon: "Minus", hideCheckbox: true },
                            { label: "", ariaLabel: "Lettres", tooltip: "Lettres uniquement", value: "letters", icon: "LetterText", hideCheckbox: true },
                            { label: "", ariaLabel: "Chiffres", tooltip: "Chiffres uniquement", value: "numbers", icon: "Hash", hideCheckbox: true }
                        ]}
                        on:change={updateRandomKinds}
                    />
                    {#if part.type !== "randomNumbers"}
                        <Radio
                            name={`identifier-${part.id}-case`}
                            label="Casse"
                            bind:value={caseMode}
                            box
                            checkmark={false}
                            direction="horizontal"
                            parentClass="size-10!"
                            options={[
                                { label: "", ariaLabel: "Majuscules et minuscules", tooltip: "Majuscules et minuscules", value: "mixed", icon: "CaseSensitive", hideCheckbox: true },
                                { label: "", ariaLabel: "Majuscules", tooltip: "Majuscules uniquement", value: "upper", icon: "CaseUpper", hideCheckbox: true },
                                { label: "", ariaLabel: "Minuscules", tooltip: "Minuscules uniquement", value: "lower", icon: "CaseLower", hideCheckbox: true }
                            ]}
                            on:change={updateCaseMode}
                        />
                    {/if}
                {/if}
            </div>
        </div>
    </MyPopover>
</Popover.Root>
