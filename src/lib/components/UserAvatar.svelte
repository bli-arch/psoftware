<script lang="ts">
    import { colorToneStyle } from "$lib/color";
    import { twMerge } from "tailwind-merge";

    let {
        user,
        class: className = "",
    } = $props<{
        user?: unknown;
        class?: string;
    }>();

    const identity = $derived(
        user && typeof user === "object" && !Array.isArray(user)
            ? user as Record<string, unknown>
            : {},
    );
    const displayName = $derived(
        [identity.name, identity.lastname]
            .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
            .join(" ")
            .trim()
        || (typeof identity.username === "string" ? identity.username : "Utilisateur"),
    );
    const initials = $derived(
        displayName
            .split(/[\s._-]+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("")
            .slice(0, 2)
        || "?",
    );
    const color = $derived(typeof identity.color === "string" ? identity.color : undefined);
</script>

<span
    class={twMerge(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-extrabold",
        className,
    )}
    aria-hidden="true"
>
    <span class="flex size-full items-center justify-center rounded-[inherit]" style={colorToneStyle(color)}>
        {initials}
    </span>
</span>
