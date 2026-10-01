<script lang="ts">
    import * as Icon from "lucide-svelte";
    import "./iStyler.css";
    import { Tooltip } from "bits-ui";
    import MyTooltip from "../MyTooltip.svelte";

    export let label: string;
    export let placeholder: string | undefined = undefined;
    export let name: string | undefined = undefined;
    export let required: boolean = false;
    export let disabled: boolean = false;
    export let readonly: boolean = false;
    export let value: string | null = null;
    export let icon: string | undefined = undefined;
    export let iconSide: string | undefined = undefined;
    export let showPassword: boolean = true;
    export let showPasswordIcons: string = "Eye, EyeOff";
    export let showPasswordIcon: string | undefined = undefined;
    export let hidePasswordIcon: string | undefined = undefined;
    export let helpText: string | undefined = undefined;
    export let helpTextIcon: boolean = false;
    export let parentClass: string = "";
    export let prefix: string | undefined = undefined;
    export let suffix: string | undefined = undefined;
	export let autocomplete: string = "new-password";

    export let tabindex: number | null | undefined = -1;

    let inputClasses: string = "";
    let showPasswordAction: boolean = false;
    let IconComponent: any = null;
    let showIcon: any = null;
    let hideIcon: any = null;

    $: inputClasses = `${parentClass} ${iconSide ? `--${iconSide}` : ""} ${prefix && suffix ? '--both' : prefix ? '--prefix' : suffix ? '--suffix' : ''}`;
    
    // Parse the icon names from the comma-separated string
    $: [fallbackShowIconName, fallbackHideIconName] = showPasswordIcons
        .split(",")
        .map((item) => item.trim());
    $: showIconName = showPasswordIcon ?? fallbackShowIconName;
    $: hideIconName = hidePasswordIcon ?? fallbackHideIconName;
    
    $: IconComponent = icon && Icon[icon as keyof typeof Icon]
        ? Icon[icon as keyof typeof Icon]
        : null;
    
    $: showIcon = showIconName && Icon[showIconName as keyof typeof Icon]
        ? Icon[showIconName as keyof typeof Icon]
        : null;
    
    $: hideIcon = hideIconName && Icon[hideIconName as keyof typeof Icon]
        ? Icon[hideIconName as keyof typeof Icon]
        : null;
</script>

<div class="flex w-full gap-1 flex-col">
    <span class="input-label">
        {label}
        {#if required}
            <Tooltip.Provider>
                <Tooltip.Root delayDuration={150}>
                    <Tooltip.Trigger>
                        {#snippet child({ props })}
                            <button type="button" class="required-star" {...props} tabindex={tabindex} >
                                <Icon.Asterisk size=16 fill="var(--red)"/>
                            </button>
                        {/snippet}
                    </Tooltip.Trigger>
                    <MyTooltip>Cette donnée est requise</MyTooltip>
                </Tooltip.Root>
            </Tooltip.Provider>
        {/if}
    </span>
    <div class="input-container {inputClasses}">
        {#if IconComponent && (iconSide === "left" || iconSide === "both")}
            <span class="input-icon --left">
                <svelte:component this={IconComponent} size="16" />
            </span>
        {/if}
        {#if prefix}
            <span class="input-affix --prefix">{prefix}</span>
        {/if}
        <input
            type={(showPassword ? (showPasswordAction ? "text" : "password") : "password" )}
            {placeholder}
            {name}
            {required}
            {disabled}
            {readonly}
			{autocomplete}
            bind:value={value}
            class={parentClass}
        />
        {#if suffix}
            <span class="input-affix --suffix">{suffix}</span>
        {/if}
        {#if showPassword}
            <button
                type="button"
                class="input-icon --clickable-icon"
                aria-label={showPasswordAction ? "Masquer le mot de passe" : "Afficher le mot de passe"}
                disabled={disabled || readonly}
                on:click={() => (showPasswordAction = !showPasswordAction)}
            >
                {#if showPasswordAction}
                    <span class="icon">
                        <svelte:component this={showIcon} size="16" />
                    </span>
                {:else}
                    <span class="icon">
                        <svelte:component this={hideIcon} size="16" />
                    </span>
                {/if}
            </button>
        {/if}
        {#if IconComponent && iconSide === "right"}
            <span class="input-icon --right">
                <svelte:component this={IconComponent} size="16" />
            </span>
        {/if}
    </div>
    {#if helpText}
        <span class="input-help-text">
            {#if helpTextIcon}
                <span class="help-icon">
                    <Icon.Info />
                </span>
            {/if}
            {helpText}
        </span>
    {/if}
</div>
