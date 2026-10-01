<script lang="ts">
    import { Checkbox } from "$lib/components/istyler";
    import SettingsRow from "./SettingsRow.svelte";
    import type { SettingsValues } from "./settingsState.svelte";

    type SettingsBooleanApi = Pick<SettingsValues<Record<string, unknown>>, "get" | "set">;

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
        badges?: Array<string | { text: string; class?: string }>;
        disabled?: boolean;
        onChange?: (value: boolean) => void;
        inline?: boolean;
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
        onChange,
        inline = false,
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

<SettingsRow {title} {description} {icon} {variant} {toneClass} {badge} {badges} {inline} class="settings-toggle-row {className}">
    {#snippet action()}
        <Checkbox {disabled} name={name ?? setting} switchMode={true} value={checked} on:change={(event) => updateValue(event.detail)} />
    {/snippet}
</SettingsRow>
