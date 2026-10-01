<script lang="ts">
    import type { Snippet } from "svelte";
    import { Checkbox } from "$lib/components/istyler";
    import SettingsRow from "./SettingsRow.svelte";
    import type { SettingsValues } from "./settingsState.svelte";

    type SettingsBooleanApi = Pick<SettingsValues<Record<string, unknown>>, "get" | "set">;
    type SettingsBadge = string | {
        text: string;
        class?: string;
    };

    type Props = {
        title: string;
        description: string;
        icon: string;
        name?: string;
        value?: boolean;
        setting?: string;
        settings?: SettingsBooleanApi;
        variant?: "default" | "info" | "success" | "warning" | "destructive";
        toneClass?: string;
        badge?: string;
        badges?: SettingsBadge[];
        disabled?: boolean;
        action?: Snippet;
        metadata?: Snippet;
        table?: Snippet;
        children?: Snippet;
        bodyPadding?: boolean;
        attention?: boolean;
        onChange?: (value: boolean) => void;
        class?: string;
    };

    let {
        title,
        description,
        icon,
        name,
        value = $bindable(false),
        setting,
        settings,
        variant = "default",
        toneClass,
        badge,
        badges = [],
        disabled = false,
        action,
        metadata,
        table,
        children,
        bodyPadding = true,
        attention = false,
        onChange,
        class: className = "",
    }: Props = $props();

    const checked = $derived(settings && setting ? Boolean(settings.get(setting)) : value);

    function updateValue(nextValue: boolean) {
        if (settings && setting) {
            settings.set(setting, nextValue);
        }

        value = nextValue;
        onChange?.(nextValue);
    }
</script>

{#if children}
    <SettingsRow
        {title}
        {description}
        {icon}
        {variant}
        {toneClass}
        {badge}
        {badges}
        {metadata}
        {table}
        {bodyPadding}
        {attention}
        expanded={checked}
        class="settings-expandable-row {className}"
    >
        {#snippet right()}
            <div class="flex items-center gap-2">
                {@render action?.()}
                <Checkbox {disabled} name={name ?? setting} switchMode={true} value={checked} on:change={(event) => updateValue(event.detail)} />
            </div>
        {/snippet}

        {@render children()}
    </SettingsRow>
{:else}
    <SettingsRow
        {title}
        {description}
        {icon}
        {variant}
        {toneClass}
        {badge}
        {badges}
        {metadata}
        {table}
        {bodyPadding}
        {attention}
        expanded={checked}
        class="settings-expandable-row {className}"
    >
        {#snippet right()}
            <div class="flex items-center gap-2">
                {@render action?.()}
                <Checkbox {disabled} name={name ?? setting} switchMode={true} value={checked} on:change={(event) => updateValue(event.detail)} />
            </div>
        {/snippet}
    </SettingsRow>
{/if}
