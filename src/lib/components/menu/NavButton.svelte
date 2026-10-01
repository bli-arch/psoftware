<script lang="ts">
    import { Dialog } from "bits-ui";
    import MyDialog from "../MyDialog.svelte";
    import { Button } from "$lib/components/istyler";
    import { delayedClass } from "$lib/utils";
    import { animationTime } from "$lib/uiPreferences";

    type Variant = "default" | "danger";
    type ButtonVariant = "primary" | "secondary" | "info" | "success" | "warning" | "error" | "ghost";

    export let active: boolean = false;
    export let mini: boolean = false;
    export let href: string | undefined = undefined;
    export let disabled: boolean = false;
    export let attention: boolean = false;
    export let attentionVariant: "danger" | "success" = "danger";
    export let title: string
    export let variant: Variant = "default";
    export let confirm: boolean = false;
    export let confirmTitle: string = "Confirmer l'action";
    export let confirmDescription: string = "Cette action sera appliquée.";
    export let confirmCancelLabel: string = "Annuler";
    export let confirmConfirmLabel: string = "Confirmer";
    export let confirmConfirmVariant: ButtonVariant = "primary";
    
    let className: string | undefined = undefined
    export {className as class}

    export let collapsed: boolean = false

    let confirmOpen = false;
    let pendingClick: ((event: MouseEvent) => unknown) | undefined;

    $: restProps = $$restProps as Record<string, any>;

    function handleClick(event: MouseEvent) {
        if (disabled) {
            event.preventDefault();
            return;
        }

        if (!confirm) {
            restProps.onclick?.(event);
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        pendingClick = restProps.onclick;
        confirmOpen = true;
    }

    function confirmAction(event: MouseEvent) {
        confirmOpen = false;
        pendingClick?.(event);
        pendingClick = undefined;
    }
</script>


<div class="group">
    <svelte:element this={href && !disabled ? "a" : "div"} {href} 
        class="nav-button h-9 w-full flex items-center font-(family-name:--font) font-medium text-sm text-nowrap
        box-border gap-2.5 select-none px-3 py-2 rounded-lg {disabled ? 'cursor-not-allowed' : 'cursor-pointer'} {variant === 'danger' ? '--danger text-(--red)' : ''} {className}"
        class:h-8={mini}
        class:rounded-md={mini}
        class:--active={active}
        {...$$restProps} 
        onclick={handleClick}
        >
            <slot />
            {#if attention}
                <span class="absolute right-1 top-1 flex size-2" aria-label={attentionVariant === "success" ? "Mise à jour prête" : "Configuration requise"}>
                    <span
                        class="absolute inline-flex size-full animate-ping rounded-full opacity-60 motion-reduce:animate-none"
                        class:bg-emerald-500={attentionVariant === "success"}
                        class:bg-(--red)={attentionVariant === "danger"}
                    ></span>
                    <span
                        class="relative inline-flex size-2 rounded-full"
                        class:bg-emerald-500={attentionVariant === "success"}
                        class:bg-(--red)={attentionVariant === "danger"}
                    ></span>
                </span>
            {/if}
            <span
                class="transition-all duration-(--animation-duration)"
                class:opacity-0={collapsed}
                use:delayedClass={{ className: 'hidden', delay: animationTime(), condition: collapsed }}
            >
                {title}
            </span>

    </svelte:element>
</div>

{#if confirm}
    <Dialog.Root bind:open={confirmOpen}>
        <Dialog.Portal>
            <MyDialog class="w-100 rounded-xl p-0">
                <Dialog.Title class="mb-2 text-lg font-bold text-(--dark-bg1)">
                    {confirmTitle}
                </Dialog.Title>
                <Dialog.Description class="text-sm leading-6 font-normal text-(--dark-bg1)">
                    <slot name="confirmDescription">{confirmDescription}</slot>
                </Dialog.Description>

                <div class="mt-5 flex justify-end gap-2">
                    <Dialog.Close
                        class="flex h-8 w-fit cursor-pointer items-center justify-center rounded-lg border border-(--grey)/50 bg-transparent px-3 text-xs font-medium text-(--dark-bg1) transition-(--transition) hover:bg-(--dark-bg2)/5 focus:bg-(--dark-bg2)/10 focus:ring focus:ring-(--dark-bg2)"
                    >
                        {confirmCancelLabel}
                    </Dialog.Close>
                    <Button
                        variant={confirmConfirmVariant}
                        size="sm"
                        label={confirmConfirmLabel}
                        class="w-fit px-3"
                        onclick={confirmAction}
                    />
                </div>
            </MyDialog>
        </Dialog.Portal>
    </Dialog.Root>
{/if}
