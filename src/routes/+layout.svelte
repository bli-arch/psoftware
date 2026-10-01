<script lang="ts">
    import '../app.css'
    import { onMount } from 'svelte';
    import { Toaster } from 'svelte-sonner';
    import * as Icon from 'lucide-svelte';
    import { animationTime, initUiPreferences, initWindowSizeMemory } from '$lib/uiPreferences';
    import { runAutomaticFrontendUpdate } from '$lib/updater';
    import PrintDrawer from '$lib/components/printing/PrintDrawer.svelte';
    import { setupRouteTransition } from '$lib/routeTransition';

    const routeOrder = ['onboarding', 'login', 'device-setup', 'setup', 'app', 'server-debug'];
    const appRoutes = new Set(['home', 'operations', 'clients', 'team', 'settings', 'account']);
    const routeGroup = (pathname: string) => {
      const route = pathname.split('/')[1] || 'login';
      return appRoutes.has(route) ? 'app' : route;
    };
    let routeContainer: HTMLElement | null = null;

    setupRouteTransition(() => routeContainer, (from, to) => {
      const fromGroup = routeGroup(from.pathname);
      const toGroup = routeGroup(to.pathname);
      if (fromGroup === toGroup) return null;
      const preserveOpacity = fromGroup === 'login'
        || toGroup === 'login'
        || (fromGroup === 'onboarding' && toGroup === 'server-debug')
        || (fromGroup === 'server-debug' && toGroup === 'onboarding');
      return {
        direction: routeOrder.indexOf(toGroup) >= routeOrder.indexOf(fromGroup) ? 1 : -1,
        slide: !(fromGroup === 'onboarding' && ['login', 'setup', 'app'].includes(toGroup)),
        fade: !preserveOpacity,
      };
    });

    onMount(() => {
      const nonTextInputTypes = new Set([
        'button', 'checkbox', 'color', 'file', 'hidden', 'image',
        'radio', 'range', 'reset', 'submit',
      ]);
      const preventModifiedInternalLink = (event: MouseEvent) => {
        if (!(event.ctrlKey || event.metaKey || event.shiftKey || event.button === 1)) return;

        const target = event.target;
        if (!(target instanceof Element)) return;

        const anchor = target.closest('a');
        if (!(anchor instanceof HTMLAnchorElement) || !anchor.href) return;

        let url: URL;
        try {
          url = new URL(anchor.href, window.location.href);
        } catch {
          return;
        }

        if (url.origin !== window.location.origin) return;

        event.preventDefault();
        event.stopPropagation();
      };
      const disableBrowserAutofill = () => {
        document.querySelectorAll<HTMLFormElement>('form').forEach((form) => {
          form.setAttribute('autocomplete', 'off');
        });
        document.querySelectorAll<HTMLInputElement>('input').forEach((input) => {
          input.setAttribute('autocomplete', input.type === 'password' ? 'new-password' : 'off');
        });
        document.querySelectorAll<HTMLTextAreaElement | HTMLSelectElement>('textarea, select').forEach((field) => {
          field.setAttribute('autocomplete', 'off');
        });
      };
      const preventDesktopContextMenu = (event: MouseEvent) => {
        const target = event.target;
        if (!(target instanceof Element)) {
          event.preventDefault();
          return;
        }
        if (target.closest('[data-context-menu-trigger]')) return;

        const input = target.closest('input');
        const hasEditingMenu = target.closest('textarea, [contenteditable="true"]')
          || (input instanceof HTMLInputElement && !nonTextInputTypes.has(input.type));
        if (!hasEditingMenu) event.preventDefault();
      };
      window.addEventListener('click', preventModifiedInternalLink, { capture: true });
      window.addEventListener('auxclick', preventModifiedInternalLink, { capture: true });
      window.addEventListener('contextmenu', preventDesktopContextMenu, { capture: true });
      disableBrowserAutofill();
      const autofillObserver = new MutationObserver(disableBrowserAutofill);
      autofillObserver.observe(document.body, { childList: true, subtree: true });

      void runAutomaticFrontendUpdate();
      const unsubscribeUiPreferences = initUiPreferences();
      const unsubscribeWindowSizeMemory = initWindowSizeMemory();
      const startupScreen = document.getElementById('psoft-startup');
      window.setTimeout(() => {
        startupScreen?.classList.add('psoft-startup-leaving');
        window.setTimeout(() => startupScreen?.remove(), animationTime(300));
      }, Math.max(0, 750 - performance.now()));

      return () => {
        window.removeEventListener('click', preventModifiedInternalLink, { capture: true });
        window.removeEventListener('auxclick', preventModifiedInternalLink, { capture: true });
        window.removeEventListener('contextmenu', preventDesktopContextMenu, { capture: true });
        autofillObserver.disconnect();
        unsubscribeUiPreferences();
        unsubscribeWindowSizeMemory();
      };
    });

  </script>
  <Toaster richColors position="bottom-center" style="z-index: var(--z-toast)">
    {#snippet successIcon()}
      <Icon.CircleCheck size={18} strokeWidth={2.25} />
    {/snippet}
    {#snippet infoIcon()}
      <Icon.Info size={18} strokeWidth={2.25} />
    {/snippet}
    {#snippet warningIcon()}
      <Icon.TriangleAlert size={18} strokeWidth={2.25} />
    {/snippet}
    {#snippet errorIcon()}
      <Icon.CircleX size={18} strokeWidth={2.25} />
    {/snippet}
    {#snippet loadingIcon()}
      <Icon.LoaderCircle size={18} strokeWidth={2.25} class="ui-loader-spin" />
    {/snippet}
  </Toaster>
  <!-- {#if $authStore || $page.route.id === '/login' || $page.route.id === '/'} -->
    <main class="relative h-screen w-full overflow-hidden bg-(--light-bg2) text-(--dark-bg1)"> <!-- data-vaul-drawer-wrapper -->
      <div bind:this={routeContainer} class="absolute inset-0 flex min-w-0">
        <slot />
      </div>
    </main>
    <PrintDrawer />
  <!-- {/if} -->

<style>
  :global([data-sonner-toaster][data-x-position='center']) {
    width: min(500px, calc(100vw - 32px)) !important;
  }

  :global([data-sonner-toast][data-x-position='center']) {
    left: 50%;
    width: max-content !important;
    min-width: 0 !important;
    min-height: 3rem;
    max-width: min(500px, calc(100vw - 32px)) !important;
    padding-block: 0.75rem !important;
    padding-inline: 1rem !important;
    border: 0 !important;
    transform: translateX(-50%) var(--y);
  }

  :global([data-sonner-toast][data-type='success']) {
    background: color-mix(in srgb, var(--green) 8%, var(--light-bg1)) !important;
    color: var(--green) !important;
  }

  :global([data-sonner-toast][data-type='info']) {
    background: color-mix(in srgb, var(--blue) 8%, var(--light-bg1)) !important;
    color: var(--blue) !important;
  }

  :global([data-sonner-toast][data-type='warning']) {
    background: color-mix(in srgb, var(--orange) 8%, var(--light-bg1)) !important;
    color: var(--orange) !important;
  }

  :global([data-sonner-toast][data-type='error']) {
    background: color-mix(in srgb, var(--red) 8%, var(--light-bg1)) !important;
    color: var(--red) !important;
  }

  :global([data-sonner-toast][data-type='loading']) {
    background: var(--light-bg1) !important;
    color: var(--dark-bg1) !important;
  }

  :global([data-sonner-toast] [data-icon]) {
    width: 18px !important;
    height: 18px !important;
    flex-shrink: 0;
  }

  :global([data-sonner-toast][data-x-position='center'][data-swiping='true']) {
    transform: translateX(-50%) var(--y) translateY(var(--swipe-amount-y, 0px)) translateX(var(--swipe-amount-x, 0px));
  }
</style>
