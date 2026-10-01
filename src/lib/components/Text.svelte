<script lang="ts">
    import { twMerge } from "tailwind-merge";

    export let text: string | number | null | undefined;
    export let italic: boolean = false;
    export let bold: boolean = false;
    export let color: "default" | "muted" | "red" | "orange" | "green" | "blue" | string = "default";
    export let truncate: boolean = false;
    export let className: string | undefined = undefined;
    export { className as class };

    const colorClasses: Record<string, string> = {
        default: "text-(--dark-bg1)",
        muted: "text-(--grey)",
        red: "text-(--red)",
        orange: "text-(--orange)",
        green: "text-(--green)",
        blue: "text-(--blue)"
    };

    $: resolvedColor =
        color in colorClasses
            ? colorClasses[color as keyof typeof colorClasses]
            : typeof color === "string"
                ? color
                : colorClasses.default;

    $: content = text ?? "";
</script>

<span
    class={twMerge(
        "text-sm",
        italic && "italic",
        bold && "font-bold",
        truncate && "truncate",
        resolvedColor,
        className
    )}
    {...$$restProps}
>
    {content}
</span>
