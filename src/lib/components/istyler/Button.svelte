<script lang="ts">
    import * as Icon from "lucide-svelte";
    import { Button as BitsButton, Dialog, Tooltip } from "bits-ui";
    import MyDialog from "../MyDialog.svelte";
    import MyTooltip from "../MyTooltip.svelte";
    import clsx from "clsx";
    import { twMerge } from "tailwind-merge";

    export let variant: VariantKey = "primary";
    export let size: SizeKey = "md";
    export let label: string | undefined = undefined;
    export let icon: string | undefined = undefined; // icon name
    export let tooltip: string | undefined = undefined;
    export let iconSide: "left" | "right" | undefined = icon ? "left" : undefined;
    export let type: "button" | "submit" | "reset" = "button";
    export let disabled: boolean = false;
    export let iconAnimation: 'spin' | 'ping' | 'pulse' | 'bounce' | undefined = undefined;
    export let confirm: boolean = false;
    export let confirmTitle: string = "Do you confirm the changes";
    export let confirmDescription: string = "This action will apply the requested changes.";
    export let confirmCancelLabel: string = "Cancel";
    export let confirmConfirmLabel: string = "Confirm";
    export let confirmCancelVariant: VariantKey = "secondary";
    export let confirmConfirmVariant: VariantKey = "primary";
    export let onConfirmCancel: ((event: MouseEvent) => unknown) | undefined = undefined;
    export let builder: Record<string, any> | undefined = undefined;
    let parentClass: string = ""
    export {parentClass as class}
    // export let helpText: string | undefined = undefined;
    // export let helpTextIcon: boolean = false;
    
    type VariantKey = keyof typeof variantMap;
    type SizeKey = keyof typeof sizeMap;
    type VariantClass = {
        base?:  string
        color?: string
        hover?: string
        focus?: string
    }
    
    const variantMap: Record<"primary" | "secondary" | "info" |  "success" | "warning" | "error" | "ghost", VariantClass> = {
        primary:  {
            base: "bg-(--dark-bg2) w-full px-4 py-0",
            color: "text-(--light-bg1)",
            hover: "hover:bg-(--user-color)",
            focus: "focus:bg-(--user-color) focus:ring focus:ring-(--dark-bg2)",
        },
        secondary: {
            base: "bg-(--light-bg1) border border-(--light-bg3) w-full px-4 py-0",
            color: "text-(--dark-bg1)",
            hover: "hover:bg-(--dark-bg2)/5",
            focus: "focus:bg-(--dark-bg2)/10 focus:ring focus:ring-(--dark-bg2)",
        },
        info: {
            base: "bg-(--blue) w-full px-4 py-0",
            color: "text-(--light-bg1)",
            hover: "hover:bg-blue-200 hover:text-blue-500",
            focus: "focus:bg-blue-200 focus:text-blue-500 focus:ring",
        },
        success: {
            base: "bg-(--green) w-full px-4 py-0",
            color: "text-(--light-bg1)",
            hover: "hover:bg-(--transparent-green) hover:text-(--green)",
            focus: "focus:bg-(--transparent-green) focus:text-(--green) focus:ring",
        },
        warning: {
            base: "bg-amber-500 w-full px-4 py-0",
            color: "text-(--dark-bg1)",
            hover: "hover:bg-amber-200 hover:text-amber-600",
            focus: "focus:bg-amber-200 focus:text-amber-600 focus:ring",
        },
        error: {
            base: "bg-(--red) w-full px-4 py-0",
            color: "text-(--light-bg1)",
            hover: "hover:bg-(--transparent-red) hover:text-(--red)",
            focus: "focus:bg-(--transparent-red) focus:text-(--red) focus:ring",
        },
        ghost: {}
    } as const satisfies Record<string, VariantClass>;

    const sizeMap = {
        xs: {class: "h-5.5 gap-1.5 rounded-md px-2 text-xs", iconSize: 12},
        sm: {class: "h-8 gap-1.5 rounded-lg px-3 text-xs", iconSize: 16},
        md: {class: "h-8 gap-2 rounded-lg px-4 text-sm", iconSize: 16},
    } as const;

    $: variantClass = variantMap[variant];
    $: btnSize = sizeMap[size];
    $: iconClass = clsx(
        "shrink-0",
        icon === "LoaderCircle" || icon === "Loader2" ? "ui-loader-spin" : iconAnimation && `animate-${iconAnimation}`,
    );

    let IconComponent: any = null;
    $: if (icon && Icon[icon as keyof typeof Icon]) {
        IconComponent = Icon[icon as keyof typeof Icon];
    }

    let confirmOpen = false;
    let pendingForm: HTMLFormElement | null = null;
    let pendingClick: ((event: MouseEvent) => unknown) | undefined;

    $: restProps = $$restProps as Record<string, any>;
    $: builderProps = builder
        ? Object.fromEntries(Object.entries(builder).filter(([key]) => key !== "action"))
        : {};

    const applyBuilder = (node: HTMLButtonElement) => {
        if (typeof builder?.action === "function") return builder.action(node);
    };

    const buttonClass = (buttonVariant: VariantKey, buttonSize: SizeKey, className = "") => {
        const selectedVariant = variantMap[buttonVariant];
        const selectedSize = sizeMap[buttonSize];

        return twMerge(clsx(
            'flex justify-center items-center font-medium',
            'cursor-pointer transition-(--transition) select-none overflow-hidden',
            'whitespace-nowrap border-0 relative outline-0',
            selectedSize.class,
            selectedVariant.base,
            selectedVariant.color,
            selectedVariant.hover,
            selectedVariant.focus
        ), className);
    };

    const handleClick = (event: MouseEvent) => {
        if (!confirm) {
            restProps.onclick?.(event);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        pendingForm = event.currentTarget instanceof HTMLButtonElement ? event.currentTarget.form : null;
        pendingClick = restProps.onclick;
        confirmOpen = true;
    };

    const confirmAction = (event: MouseEvent) => {
        confirmOpen = false;

        if (type === "submit") {
            pendingForm?.requestSubmit();
            pendingForm = null;
            pendingClick = undefined;
            return;
        }

        if (type === "reset") {
            pendingForm?.reset();
            pendingForm = null;
            pendingClick = undefined;
            return;
        }

        pendingClick?.(event);
        pendingForm = null;
        pendingClick = undefined;
    };

    const cancelAction = (event: MouseEvent) => {
        onConfirmCancel?.(event);
        pendingForm = null;
        pendingClick = undefined;
    };
</script>

{#if builder}
    <button
        use:applyBuilder
        class={buttonClass(variant, size, parentClass)}
        {type}
        {disabled}
        {...builderProps}
        {...$$restProps}
        onclick={handleClick}
    >
        {#if IconComponent && iconSide === "left"}
            <svelte:component this={IconComponent} class={iconClass} size={btnSize.iconSize}/>
        {/if}
        {#if label}
            <span>{label}</span>
        {/if}
        <slot />
        {#if IconComponent && iconSide === "right"}
            <svelte:component this={IconComponent} class={iconClass} size={btnSize.iconSize}/>
        {/if}
    </button>
{:else if tooltip}
    <Tooltip.Provider>
        <Tooltip.Root delayDuration={150}>
            <Tooltip.Trigger>
                {#snippet child({ props })}
                    <BitsButton.Root
                        class={buttonClass(variant, size, parentClass)}
                        {type}
                        {disabled}
                        {...props}
                        {...$$restProps}
                        onclick={handleClick}
                    >
                        {#if IconComponent && iconSide === "left"}
                            <svelte:component this={IconComponent} class={iconClass} size={btnSize.iconSize}/>
                        {/if}
                        {#if label}
                            <span>{label}</span>
                        {/if}
                        <slot />
                        {#if IconComponent && iconSide === "right"}
                            <svelte:component this={IconComponent} class={iconClass} size={btnSize.iconSize}/>
                        {/if}
                    </BitsButton.Root>
                {/snippet}
            </Tooltip.Trigger>
            <MyTooltip>{tooltip}</MyTooltip>
        </Tooltip.Root>
    </Tooltip.Provider>
{:else}
    <BitsButton.Root
        class={buttonClass(variant, size, parentClass)}
        {type}
        {disabled}
        {...$$restProps}
        onclick={handleClick}
    >
        {#if IconComponent && iconSide === "left"}
            <svelte:component this={IconComponent} class={iconClass} size={btnSize.iconSize}/>
        {/if}
        {#if label}
            <span>{label}</span>
        {/if}
        <slot />
        {#if IconComponent && iconSide === "right"}
            <svelte:component this={IconComponent} class={iconClass} size={btnSize.iconSize}/>
        {/if}
    </BitsButton.Root>
{/if}

{#if confirm}
    <Dialog.Root bind:open={confirmOpen}>
        <Dialog.Portal>
            <MyDialog
                class="min-w-[min(25rem,calc(100vw-2rem))] rounded-xl"
                layout="sectioned"
                title={confirmTitle}
            >
                {#snippet footer()}
                    <Dialog.Close
                        class={buttonClass(confirmCancelVariant, "sm", "w-fit px-2.5 font-semibold")}
                        onclick={cancelAction}
                    >
                        {confirmCancelLabel}
                    </Dialog.Close>
                    <BitsButton.Root
                        type="button"
                        class={buttonClass(confirmConfirmVariant, "sm", "w-fit px-2.5 font-semibold")}
                        onclick={confirmAction}
                    >
                        {confirmConfirmLabel}
                    </BitsButton.Root>
                {/snippet}

                <Dialog.Description class="text-sm leading-6 font-medium text-(--dark-bg1)">
                    <slot name="confirmDescription">{confirmDescription}</slot>
                </Dialog.Description>
            </MyDialog>
        </Dialog.Portal>
    </Dialog.Root>
{/if}
