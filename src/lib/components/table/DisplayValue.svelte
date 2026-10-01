<script lang="ts" context="module">
    export type DynamicGroupSummary = {
        total: number;
        done: number;
        text: string;
    };

    export const DISPLAY_VALUE_KINDS = [
        "text",
        "longText",
        "identifier",
        "password",
        "date",
        "dueState",
        "timeSince",
        "number",
        "currency",
        "trend",
        "progress",
        "state",
        "badge",
        "boolean",
        "tags",
        "user",
        "role",
        "group",
        "email",
        "phone",
        "priority",
        "relation",
        "fileCount",
        "commentCount",
        "changeIndicator",
        "quality"
    ] as const;

    export type DisplayValueKind = typeof DISPLAY_VALUE_KINDS[number];
</script>

<script lang="ts">
    import { onDestroy } from "svelte";
    import { Badge, StateBadge } from "$lib/components/Badge";
    import LucideIcon from "$lib/components/Badge/LucideIcon.svelte";
    import Text from "$lib/components/Text.svelte";
    import Button from "$lib/components/istyler/Button.svelte";
    import UserAvatar from "$lib/components/UserAvatar.svelte";
    import { validateDateFormat } from "$lib/components/istyler/dateFormat";
    import { strftime } from "$lib/utils";
    import { colorToneStyle, cssColor } from "$lib/color";
    import { twMerge } from "tailwind-merge";

    type BadgeType = "error" | "success" | "warning" | "info" | "neutral" | "processing" | "new" | "premium" | "ghost";
    type Tone = "default" | "muted" | "blue" | "green" | "red" | "orange" | "user";

    const EMPTY_TEXT = "-";
    const PASSWORD_MASK = "********";
    const MAX_TEXT_LENGTH = 300;
    const MAX_LIST_ITEMS = 3;
    const VALID_CURRENCY = /^[A-Z]{3}$/;
    const supportedDisplays = new Set<DisplayValueKind>(DISPLAY_VALUE_KINDS);

    let className: string | undefined = undefined;
    export { className as class };

    export let value: unknown = undefined;
    export let display: DisplayValueKind | string | undefined = "text";
    export let setting: Record<string, any> = {};
    export let states: Array<Record<string, any>> = [];
    export let dynamicGroup: DynamicGroupSummary | null = null;

    let passwordVisible = false;
    let passwordRevealTimer: ReturnType<typeof setTimeout> | null = null;

    const toneClasses: Record<Tone, string> = {
        default: "text-(--dark-bg1)",
        muted: "text-(--grey)",
        blue: "text-(--blue)",
        green: "text-(--green)",
        red: "text-(--red)",
        orange: "text-(--orange)",
        user: "text-(--user-color)"
    };

    const chipClasses = [
        "bg-(--blue)/10 text-(--blue)",
        "bg-(--green)/10 text-(--green)",
        "bg-(--user-color)/10 text-(--user-color)",
        "bg-(--orange)/10 text-(--orange)"
    ];

    const isEmpty = (input: unknown) =>
        input === null || input === undefined || input === "" || (Array.isArray(input) && input.length === 0);

    const cleanText = (input: string) => {
        const normalized = input.normalize("NFC").replace(/\s+/g, " ").trim();
        return normalized.length > MAX_TEXT_LENGTH ? `${normalized.slice(0, MAX_TEXT_LENGTH)}...` : normalized;
    };

    const textValue = (input: unknown, seen = new WeakSet<object>()): string => {
        if (isEmpty(input)) return EMPTY_TEXT;
        if (typeof input === "string") return cleanText(input) || EMPTY_TEXT;
        if (typeof input === "number" || typeof input === "boolean" || typeof input === "bigint") return String(input);
        if (input instanceof Date) return Number.isNaN(input.getTime()) ? EMPTY_TEXT : strftime(input, "%x", "fr-FR");
        if (typeof input === "symbol" || typeof input === "function") return EMPTY_TEXT;

        if (Array.isArray(input)) {
            if (seen.has(input)) return EMPTY_TEXT;
            seen.add(input);

            return input
                .slice(0, MAX_LIST_ITEMS)
                .map((item) => textValue(item, seen))
                .filter((item) => item !== EMPTY_TEXT)
                .join(", ") || EMPTY_TEXT;
        }

        if (input && typeof input === "object") {
            if (seen.has(input)) return EMPTY_TEXT;
            seen.add(input);

            const record = input as Record<string, unknown>;
            const readable = record.name ?? record.title ?? record.label ?? record.username ?? record.email ?? record.id ?? record.uid;
            return readable === undefined ? EMPTY_TEXT : textValue(readable, seen);
        }

        return cleanText(String(input)) || EMPTY_TEXT;
    };

    const numberValue = (input: unknown) => {
        if (typeof input === "number") return Number.isFinite(input) ? input : null;
        if (typeof input === "bigint") return Number.isSafeInteger(Number(input)) ? Number(input) : null;
        if (typeof input !== "string") return null;

        const normalized = input.trim().replace(/\s/g, "").replace(",", ".");
        if (!normalized) return null;

        const number = Number(normalized);
        return Number.isFinite(number) ? number : null;
    };

    const dateValue = (input: unknown) => {
        if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : new Date(input);
        if (typeof input !== "string" && typeof input !== "number") return null;

        const date = new Date(input);
        return Number.isNaN(date.getTime()) ? null : date;
    };

    const currencyCode = (config: Record<string, any>) => {
        const code = typeof config?.currency === "string" ? config.currency.trim().toUpperCase() : "EUR";
        return VALID_CURRENCY.test(code) ? code : "EUR";
    };

    const formatCurrencyAmount = (amount: number) =>
        new Intl.NumberFormat("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(amount);

    const formatDate = (input: unknown, config: Record<string, any>) => {
        if (!input) return { badgeText: "Valeur manquante", badgeType: "error" as BadgeType, icon: "AlertCircle", tooltip: "Cette ligne ne contient pas de date" };
        if (!config?.format || typeof config.format !== "string") return { badgeText: "Format manquant", badgeType: "warning" as BadgeType, icon: "FileText", tooltip: "Vérifiez la configuration de la colonne" };
        const formatError = validateDateFormat(config.format, {
            required: true,
            allowLiteralPercent: true,
        });
        if (formatError) return { badgeText: "Format invalide", badgeType: "warning" as BadgeType, icon: "FileText", tooltip: formatError };

        const date = dateValue(input);
        if (!date) return { badgeText: "Valeur invalide", badgeType: "error" as BadgeType, icon: "CalendarX" };

        try {
            return { text: strftime(date, config.format, "fr-FR") };
        } catch {
            return { badgeText: "Format invalide", badgeType: "warning" as BadgeType, icon: "FileText", tooltip: "Le format de date ne peut pas être appliqué" };
        }
    };

    const badgeTypeFromText = (input: unknown): BadgeType => {
        const text = textValue(input).toLowerCase();
        if (["urgent", "high", "haute", "élevée", "critique", "critical"].includes(text)) return "error";
        if (["medium", "moyenne", "warning", "attention"].includes(text)) return "warning";
        if (["low", "basse", "faible", "ok", "validé", "active", "actif"].includes(text)) return "success";
        if (["info", "nouveau", "new"].includes(text)) return "info";
        return "neutral";
    };

    const dueStateValue = (input: unknown) => {
        const date = dateValue(input);
        if (!date) return { text: EMPTY_TEXT, type: "neutral" as BadgeType, icon: "CalendarX" };

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        date.setHours(0, 0, 0, 0);

        const days = Math.round((date.getTime() - today.getTime()) / 86400000);
        if (days < 0) return { text: "En retard", type: "error" as BadgeType, icon: "CircleAlert" };
        if (days === 0) return { text: "Aujourd'hui", type: "warning" as BadgeType, icon: "Clock" };
        if (days === 1) return { text: "Demain", type: "info" as BadgeType, icon: "CalendarClock" };
        return { text: `Dans ${days} j`, type: "neutral" as BadgeType, icon: "Calendar" };
    };

    const timeSinceValue = (input: unknown) => {
        const date = dateValue(input);
        if (!date) return EMPTY_TEXT;

        const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
        const absSeconds = Math.abs(diffSeconds);
        const units: Array<[Intl.RelativeTimeFormatUnit, number]> = [
            ["year", 31536000],
            ["month", 2592000],
            ["week", 604800],
            ["day", 86400],
            ["hour", 3600],
            ["minute", 60],
            ["second", 1]
        ];
        const [unit, seconds] = units.find(([, unitSeconds]) => absSeconds >= unitSeconds) ?? ["second", 1];
        return new Intl.RelativeTimeFormat("fr-FR", { numeric: "auto" }).format(Math.round(diffSeconds / seconds), unit);
    };

    const listSource = (input: unknown) => {
        if (Array.isArray(input)) return input;
        if (input && typeof input === "object" && Array.isArray((input as Record<string, unknown>).results)) {
            return (input as Record<string, unknown>).results as unknown[];
        }
        if (typeof input === "string" && input.includes(",")) return input.split(",");
        return isEmpty(input) ? [] : [input];
    };

    const listDisplay = (
        input: unknown,
        currentDisplay: DisplayValueKind,
        config: Record<string, any>,
        visibleCount = 2,
    ) => {
        const source = listSource(input);
        const fields = Array.isArray(config?.fields) ? config.fields : [];
        const labels = source
            .slice(0, visibleCount)
            .map((item) => currentDisplay === "group" ? groupItemText(item, fields) : textValue(item))
            .filter((item) => item !== EMPTY_TEXT);

        return {
            items: labels,
            extraCount: Math.max(0, source.length - labels.length)
        };
    };

    const groupItemText = (item: unknown, fields: Array<Record<string, unknown>>) => {
        if (!item || typeof item !== "object" || Array.isArray(item) || !fields.length) {
            return textValue(item);
        }

        const record = item as Record<string, unknown>;
        const parts = fields
            .map((field: Record<string, unknown>) => {
                const name = typeof field?.name === "string" ? field.name : "";
                return name ? textValue(record[name]) : EMPTY_TEXT;
            })
            .filter((part) => part !== EMPTY_TEXT)
            .slice(0, 2);

        return parts.length ? parts.join(" · ") : textValue(item);
    };

    const userDisplay = (input: unknown) => ({ label: textValue(input) });

    const roleDisplay = (input: unknown) => {
        const record = input && typeof input === "object" && !Array.isArray(input)
            ? input as Record<string, unknown>
            : {};
        return {
            label: textValue(record.name ?? input),
            icon: typeof record.icon === "string" ? record.icon : "Shield",
            iconColor: typeof record.iconColor === "string" ? record.iconColor : "--grey",
            isSuperuser: record.isSuperuser === true,
        };
    };

    const trendDisplay = (input: unknown) => {
        const raw = input && typeof input === "object" && !Array.isArray(input)
            ? (input as Record<string, unknown>).delta ?? (input as Record<string, unknown>).change ?? (input as Record<string, unknown>).value
            : input;
        const number = numberValue(raw);

        if (number === null) return { text: textValue(input), tone: "muted" as Tone, icon: "Minus" };

        const sign = number > 0 ? "+" : "";
        const tone: Tone = number > 0 ? "green" : number < 0 ? "red" : "muted";
        const icon = number > 0 ? "TrendingUp" : number < 0 ? "TrendingDown" : "Minus";
        const formatted = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1, signDisplay: "never" }).format(Math.abs(number));

        return { text: `${sign}${formatted}%`, tone, icon };
    };

    const progressDisplay = (input: unknown, groupSummary: DynamicGroupSummary | null) => {
        const percent = groupSummary
            ? groupSummary.total ? Math.round((groupSummary.done / groupSummary.total) * 100) : 0
            : numberValue(input);

        if (percent === null) return { text: textValue(input), percent: null };
        const safePercent = Math.max(0, Math.min(100, percent));
        return { text: `${safePercent} %`, percent: safePercent };
    };

    const validEmail = (input: string) =>
        input.length <= 254 && /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(input);

    const stateValue = (input: unknown): string | number => {
        if (input && typeof input === "object" && !Array.isArray(input)) {
            const record = input as Record<string, unknown>;
            const candidate = record.id ?? record.uid ?? record.value ?? record.name;
            return typeof candidate === "string" || typeof candidate === "number" ? candidate : textValue(input);
        }

        return textValue(input);
    };

    const tagText = (input: string, currentDisplay: DisplayValueKind) =>
        currentDisplay === "tags" && !input.startsWith("#") ? `#${input}` : input;
    const stopLinkClick = (event: MouseEvent) => event.stopPropagation();
    const clearPasswordRevealTimer = () => {
        if (!passwordRevealTimer) return;
        clearTimeout(passwordRevealTimer);
        passwordRevealTimer = null;
    };
    const resetPasswordReveal = () => {
        clearPasswordRevealTimer();
        passwordVisible = false;
    };
    const startPasswordReveal = (event: PointerEvent | KeyboardEvent) => {
        event.preventDefault();
        event.stopPropagation();
        if (isEmpty(value)) return;

        clearPasswordRevealTimer();
        passwordRevealTimer = setTimeout(() => {
            passwordVisible = true;
            passwordRevealTimer = null;
        }, 200);
    };
    const startPasswordPointerReveal = (event: PointerEvent) => {
        if (event.currentTarget instanceof HTMLElement) {
            event.currentTarget.setPointerCapture(event.pointerId);
        }
        startPasswordReveal(event);
    };
    const startPasswordKeyboardReveal = (event: KeyboardEvent) => {
        if (event.repeat || (event.key !== " " && event.key !== "Enter")) return;
        startPasswordReveal(event);
    };
    const stopPasswordReveal = (event?: Event) => {
        event?.stopPropagation();
        resetPasswordReveal();
    };

    onDestroy(resetPasswordReveal);

    $: displayKey = supportedDisplays.has(display as DisplayValueKind) ? display as DisplayValueKind : "text";
    $: text = textValue(value);
    $: badgeText = dynamicGroup ? dynamicGroup.text : text;
    $: badgeType = dynamicGroup ? dynamicGroup.done === dynamicGroup.total ? "success" : "warning" : badgeTypeFromText(value);
    $: relationClass = displayKey === "relation" ? "font-medium" : "";
    $: textBold = Boolean(setting?.bold ?? setting?.setting?.bold);
    $: textItalic = Boolean(setting?.italic ?? setting?.setting?.italic);
    $: badgeIcon = typeof (setting?.badgeIcon ?? setting?.setting?.badgeIcon) === "string"
        ? setting?.badgeIcon ?? setting?.setting?.badgeIcon
        : undefined;
    $: badgeColor = typeof (setting?.badgeColor ?? setting?.setting?.badgeColor) === "string"
        ? setting?.badgeColor ?? setting?.setting?.badgeColor
        : undefined;
    $: badgeStyle = cssColor(badgeColor) ? colorToneStyle(badgeColor) : undefined;
    $: textDecorations = [
        Boolean(setting?.underline ?? setting?.setting?.underline) ? "underline" : "",
        Boolean(setting?.strikethrough ?? setting?.setting?.strikethrough) ? "line-through" : "",
    ].filter(Boolean).join(" ");
    $: textClass = [
        textBold ? "" : "font-medium",
        "decoration-1 underline-offset-2",
        relationClass
    ].filter(Boolean).join(" ");
    $: dateDisplay = displayKey === "date" ? formatDate(value, setting) : null;
    $: due = displayKey === "dueState" ? dueStateValue(value) : null;
    $: number = numberValue(value);
    $: currency = displayKey === "currency" ? currencyCode(setting) : "EUR";
    $: trend = displayKey === "trend" ? trendDisplay(value) : null;
    $: progress = displayKey === "progress" ? progressDisplay(value, dynamicGroup) : null;
    $: list = displayKey === "tags" || displayKey === "group"
        ? listDisplay(value, displayKey, setting)
        : { items: [], extraCount: 0 };
    $: user = displayKey === "user" ? userDisplay(value) : { label: text };
    $: role = displayKey === "role" ? roleDisplay(value) : { label: text, icon: "Shield", iconColor: "--grey", isSuperuser: false };
    $: state = displayKey === "state" ? stateValue(value) : text;
    $: timeSince = displayKey === "timeSince" ? timeSinceValue(value) : text;
    $: email = displayKey === "email" ? text : "";
    $: phone = displayKey === "phone" ? text : "";
    $: qualityScore = displayKey === "quality" ? numberValue(value) : null;
    $: qualityType = (qualityScore === null ? "neutral" : qualityScore >= 80 ? "success" : qualityScore >= 50 ? "warning" : "error") as BadgeType;
    $: safePercent = progress?.percent === null ? null : Math.max(0, Math.min(100, progress?.percent ?? 0));
    $: safeItems = Array.isArray(list.items) ? list.items.filter(Boolean).slice(0, 3) : [];
</script>

{#if displayKey === "text" || displayKey === "relation"}
    <Text
        text={text}
        color={isEmpty(value) ? "muted" : setting?.color ?? "default"}
        truncate
        bold={textBold}
        italic={textItalic}
        class={twMerge("inline-block max-w-full", textItalic ? "pe-0.5" : "", textClass, className)}
        style={`text-decoration-line: ${textDecorations || "none"};`}
    />
{:else if displayKey === "badge" || displayKey === "priority" || displayKey === "changeIndicator"}
    <Badge
        text={displayKey === "changeIndicator" && isEmpty(value) ? EMPTY_TEXT : badgeText}
        type={displayKey === "changeIndicator" ? isEmpty(value) ? "neutral" : "info" : badgeType}
        icon={displayKey === "badge" ? badgeIcon as any : undefined}
        class={twMerge("w-fit max-w-full rounded-full", className)}
        style={displayKey === "badge" ? badgeStyle : undefined}
    />
{:else if displayKey === "role"}
    {#if role.isSuperuser}
        <Badge
            text={role.label}
            type="ghost"
            class={twMerge("w-fit max-w-full", className)}
            style={colorToneStyle("--user-color")}
        />
    {:else}
        <Badge
            text={role.label}
            icon={role.icon as any}
            type="ghost"
            class={twMerge("w-fit max-w-full", className)}
            style={colorToneStyle(role.iconColor)}
        />
    {/if}
{:else if displayKey === "boolean"}
    {#if value === true}
        <Badge text="Oui" type="success" icon="Check" class={twMerge("w-fit max-w-full rounded-full", className)} />
    {:else if value === false}
        <Badge text="Non" type="error" icon="X" class={twMerge("w-fit max-w-full rounded-full", className)} />
    {:else}
        <Badge text={EMPTY_TEXT} type="warning" icon="CircleHelp" class={twMerge("w-fit max-w-full rounded-full", className)} />
    {/if}
{:else if displayKey === "date" && dateDisplay?.badgeText}
    <Badge
        text={dateDisplay.badgeText}
        type={dateDisplay.badgeType}
        icon={dateDisplay.icon}
        tooltip={dateDisplay.tooltip ?? dateDisplay.badgeText}
        animation="pulse"
        class={twMerge("w-fit max-w-full rounded-full", className)}
    />
{:else if displayKey === "dueState" && due}
    <Badge text={due.text} type={due.type} icon={due.icon} class={twMerge("w-fit max-w-full rounded-full", className)} />
{:else if displayKey === "fileCount"}
    <Badge text={String(number ?? text)} type="neutral" icon="Paperclip" class={twMerge("w-fit max-w-full rounded-full", className)} />
{:else if displayKey === "commentCount"}
    <Badge text={String(number ?? text)} type="neutral" icon="MessageSquare" class={twMerge("w-fit max-w-full rounded-full", className)} />
{:else if displayKey === "quality"}
    <Badge text={qualityScore === null ? text : `${qualityScore}%`} type={qualityType} class={twMerge("w-fit max-w-full rounded-full", className)} />
{:else if displayKey === "state"}
    <StateBadge
        {state}
        {states}
        class={twMerge("max-w-full", className)}
    />
{:else if displayKey === "progress" && progress}
    <span class={twMerge("inline-flex min-w-0 items-center gap-2", className)} title={text}>
        <span class="h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-(--light-bg3)">
            <span
                class="block h-full rounded-full bg-(--user-color)"
                style={`width: ${safePercent ?? 0}%`}
            ></span>
        </span>
        <span class="shrink-0 font-mono text-[12.5px] font-semibold tabular-nums text-(--user-color)">
            {safePercent === null ? progress.text : `${safePercent} %`}
        </span>
    </span>
{:else if displayKey === "tags" || displayKey === "group"}
    {#if displayKey === "group" && dynamicGroup && !safeItems.length}
        <Badge
            text={dynamicGroup.text}
            type={dynamicGroup.done === dynamicGroup.total ? "success" : "warning"}
            class={twMerge("w-fit max-w-full rounded-full", className)}
        />
    {:else}
        <span class={twMerge("inline-flex min-w-0 items-center gap-1", className)} title={text}>
            {#if safeItems.length}
                {#each safeItems as item, index}
                    <span
                        class={twMerge(
                            "max-w-28 truncate rounded px-1.5 py-0.5 text-[11.5px] font-semibold leading-4",
                            displayKey === "group"
                                ? "rounded-full border border-(--light-bg3) bg-(--light-bg2) font-medium text-(--dark-bg1)"
                                : chipClasses[index % chipClasses.length]
                        )}
                    >
                        {tagText(item, displayKey)}
                    </span>
                {/each}
                {#if list.extraCount > 0}
                    <span class="rounded-full border border-dashed border-(--light-bg3) bg-(--light-bg2) px-1.5 py-0.5 text-[11px] font-semibold leading-4 text-(--grey)">
                        +{list.extraCount}
                    </span>
                {/if}
            {:else}
                <span class="text-[13px] text-(--grey)">{text}</span>
            {/if}
        </span>
    {/if}
{:else if displayKey === "user"}
    <span class={twMerge("inline-flex min-w-0 items-center gap-2", className)} title={user.label}>
        <UserAvatar user={value} class="size-[26px] text-[10px]" />
        <span class="min-w-0 truncate text-[13.5px] font-semibold text-(--dark-bg1)">{user.label}</span>
    </span>
{:else if displayKey === "identifier"}
    <span
        class={twMerge(
            "inline-flex max-w-full items-center gap-1 rounded border border-(--light-bg3) bg-(--light-bg2) px-2 py-0.5 font-mono text-xs font-medium text-(--grey)",
            className
        )}
        title={text}
    >
        <LucideIcon name={"Hash" as any} size={12} class="shrink-0" />
        <span class="min-w-0 truncate">{text}</span>
    </span>
{:else if displayKey === "password"}
    {#if isEmpty(value)}
        <span class={twMerge("inline-flex font-mono text-[13.5px] font-semibold tabular-nums text-(--grey)", className)}>
            {EMPTY_TEXT}
        </span>
    {:else}
        <Button
            type="button"
            variant="ghost"
            size="xs"
            class={twMerge("h-auto max-w-full border-0 bg-transparent p-0 font-mono text-[13.5px] font-semibold tabular-nums text-(--dark-bg1) focus:outline-none focus:ring-2 focus:ring-(--user-color)", className)}
            aria-label="Maintenir pour afficher le mot de passe"
            title="Maintenir pour afficher"
            onpointerdown={startPasswordPointerReveal}
            onpointerup={stopPasswordReveal}
            onpointercancel={stopPasswordReveal}
            onpointerleave={stopPasswordReveal}
            onkeydown={startPasswordKeyboardReveal}
            onkeyup={stopPasswordReveal}
            onblur={stopPasswordReveal}
            onclick={stopPasswordReveal}
        >
            <span class="min-w-0 truncate">{passwordVisible ? text : PASSWORD_MASK}</span>
        </Button>
    {/if}
{:else if displayKey === "currency"}
    <span class={twMerge("inline-flex w-full min-w-0 items-baseline gap-1", className)} title={text}>
        <span class="min-w-0 truncate font-mono text-sm font-bold tabular-nums text-(--dark-bg1)">
            {number === null ? text : formatCurrencyAmount(number)}
        </span>
        {#if number !== null}
            <span class="rounded border border-(--light-bg3) bg-(--light-bg2) px-1 py-0.5 text-[11px] font-semibold leading-3 text-(--grey)">
                {currency}
            </span>
        {/if}
    </span>
{:else if displayKey === "number"}
    <span class={twMerge("inline-flex w-full font-mono text-[13.5px] font-semibold tabular-nums text-(--dark-bg1)", className)} title={text}>
        {number === null ? text : number.toLocaleString("fr-FR")}
    </span>
{:else if displayKey === "trend" && trend}
    <span
        class={twMerge("inline-flex min-w-0 items-center gap-1.5 text-[13px] font-bold", toneClasses[trend.tone], className)}
        title={text}
    >
        <LucideIcon name={trend.icon as any} size={13} class="shrink-0" />
        <span class="min-w-0 truncate">{trend.text}</span>
    </span>
{:else if displayKey === "date"}
    <span class={twMerge("inline-flex min-w-0 items-center gap-1.5 text-[13.5px] font-medium", toneClasses.default, className)} title={text}>
        <LucideIcon name={"CalendarDays" as any} size={13} class="shrink-0" />
        <span class="min-w-0 truncate">{dateDisplay?.text ?? text}</span>
    </span>
{:else if displayKey === "timeSince"}
    <span class={twMerge("inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium", toneClasses.muted, className)} title={text}>
        <LucideIcon name={"Clock3" as any} size={13} class="shrink-0" />
        <span class="min-w-0 truncate">{timeSince}</span>
    </span>
{:else if displayKey === "email"}
    {#if email === EMPTY_TEXT}
        <span class={twMerge("inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium", toneClasses.muted, className)}>
            <LucideIcon name={"Mail" as any} size={13} class="shrink-0" />
            <span class="min-w-0 truncate">{EMPTY_TEXT}</span>
        </span>
    {:else if !validEmail(email)}
        <Badge text="Email invalide" type="warning" icon="CircleAlert" tooltip={email} class={twMerge("w-fit max-w-full rounded-full", className)} />
    {:else}
        <a
            href={`mailto:${email}`}
            class={twMerge("inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium hover:underline focus:outline-none focus:ring-2 focus:ring-(--user-color)", toneClasses.blue, className)}
            onclick={stopLinkClick}
            title={email}
        >
            <LucideIcon name={"Mail" as any} size={13} class="shrink-0" />
            <span class="min-w-0 truncate">{email}</span>
        </a>
    {/if}
{:else if displayKey === "phone"}
    {#if phone === EMPTY_TEXT}
        <span class={twMerge("inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium", toneClasses.muted, className)}>
            <LucideIcon name={"Phone" as any} size={13} class="shrink-0" />
            <span class="min-w-0 truncate">{EMPTY_TEXT}</span>
        </span>
    {:else}
        <span
            class={twMerge("inline-flex min-w-0 items-center gap-1.5 text-[13px] font-medium", toneClasses.default, className)}
            title={phone}
        >
            <LucideIcon name={"Phone" as any} size={13} class="shrink-0" />
            <span class="min-w-0 truncate">{phone}</span>
        </span>
    {/if}
{:else if displayKey === "longText"}
    <span class={twMerge("block max-w-56 truncate text-[13px] font-normal text-(--grey)", className)} title={text}>
        {text}
    </span>
{:else}
    <span class={twMerge("min-w-0 truncate text-[13.5px] font-medium text-(--dark-bg1)", className)} title={text}>
        {text}
    </span>
{/if}
