// Tauri doesn't have a Node.js server to do proper SSR
// so we will use adapter-static to prerender the app (SSG)
// See: https://v2.tauri.app/start/frontend/sveltekit/ for more info
export const prerender = true;
export const ssr = false;

import { browser } from '$app/environment';
import { redirect } from '@sveltejs/kit';
import { hasCompletedOnboarding } from '$lib/onboarding';
import { bootstrapClient, checkServerCompatibility, type ClientBootstrap } from '$lib/system';
import { getStartupRoute, safeInternalRoute } from '$lib/startupRoute';
import type { AuthUser } from '$lib/auth';
import { isDefaultDeviceName, loadCurrentDevice } from '$lib/device';
import { prepareCompanyBranding } from '$lib/companyBranding';
import { TEAM_DETAIL_PERMISSIONS, TEAM_LIST_PERMISSIONS } from '$lib/team';

const STARTUP_SERVER_TIMEOUT_MS = 10_000;

function can(user: AuthUser | undefined, key: string) {
  return Boolean(user?.administrator || user?.permissions?.includes(key));
}

function canAny(user: AuthUser | undefined, keys: readonly string[]) {
  return keys.some((key) => can(user, key));
}

function hasRoutePermission(path: string, user: AuthUser | undefined) {
  if (path.startsWith('/clients/')) return can(user, 'clients.view_details');
  if (path === '/clients') return can(user, 'clients.view_list');
  if (path.startsWith('/operations/')) return can(user, 'operations.view_details');
  if (path.startsWith('/team/')) return canAny(user, TEAM_DETAIL_PERMISSIONS);
  if (path === '/team') return canAny(user, TEAM_LIST_PERMISSIONS);

  if (path.startsWith('/settings/general')) return can(user, 'settings.general.modify');
  if (path.startsWith('/settings/client')) return can(user, 'settings.client.modify');
  if (path.startsWith('/settings/operation')) return can(user, 'settings.operation.modify');
  if (path.startsWith('/settings/server')) return can(user, 'settings.server.modify');
  if (path.startsWith('/settings/team')) return can(user, 'roles.manage');
  if (path.startsWith('/settings/api')) return can(user, 'tracking.manage');
  if (path.startsWith('/settings/documents')) return Boolean(user?.administrator);

  return true;
}

const deferredV1Routes = ['/settings/notifications', '/settings/product'];

function isDeferredV1Route(path: string) {
  return deferredV1Routes.some((route) => path === route || path.startsWith(`${route}/`));
}

export async function load({ url }) {
    if (!browser) {
      return {
        authenticated: false,
        onboardingComplete: false,
      };
    }

    const path = url.pathname;
    const onboardingComplete = hasCompletedOnboarding();

    if (!onboardingComplete) {
      if (path !== '/onboarding' && path !== '/server-debug') {
        redirect(307, '/onboarding');
      }

      if (path === '/server-debug') {
        return {
          authenticated: false,
          onboardingComplete,
        };
      }

      return {
        authenticated: false,
        onboardingComplete,
      };
    }

    if (path === '/onboarding') {
      return {
        authenticated: false,
        onboardingComplete,
      };
    }

    const publicRoutes = ['/', '/login', '/server-debug'];
    let isAuthenticated = false;
    let user: AuthUser | undefined;
    let bootstrap: ClientBootstrap | undefined;

    if (path !== '/server-debug') {
      const serverStatus = await checkServerCompatibility({ timeoutMs: STARTUP_SERVER_TIMEOUT_MS });
      if (!serverStatus.compatible) {
        redirect(307, '/server-debug');
      }

      bootstrap = await bootstrapClient();
      isAuthenticated = bootstrap.authenticated;
      user = bootstrap.user;
      await prepareCompanyBranding(bootstrap.server.serverId, bootstrap.branding);
    } else {
      isAuthenticated = false;
    }

    // Handle redirects based on auth state and current path
    const startupRoute = getStartupRoute();
    const mustChangePassword = isAuthenticated && user?.isNew === true;
    const setupRequired = isAuthenticated && user?.administrator === true && bootstrap?.setup?.complete === false;
    let deviceNameRequired = false;
    if (isAuthenticated && !mustChangePassword) {
      try {
        deviceNameRequired = isDefaultDeviceName((await loadCurrentDevice()).name);
      } catch (error) {
        console.error('Failed to check current device name', error);
      }
    }

    const configuredRoute = setupRequired ? '/setup' : startupRoute;
    const authenticatedRoute = deviceNameRequired
      ? `/device-setup?next=${encodeURIComponent(configuredRoute)}`
      : configuredRoute;

    if (path === '/') {
      if (isAuthenticated) {
        redirect(307, authenticatedRoute);
      } else {
        redirect(307, '/login');
      }
    } else if (path === '/login' && isAuthenticated && !mustChangePassword) {
      redirect(307, authenticatedRoute);
    } else if (!publicRoutes.includes(path) && mustChangePassword) {
      redirect(307, '/login');
    } else if (deviceNameRequired && path !== '/device-setup') {
      redirect(307, `/device-setup?next=${encodeURIComponent(path + url.search)}`);
    } else if (isAuthenticated && path === '/device-setup' && !deviceNameRequired) {
      redirect(307, safeInternalRoute(url.searchParams.get('next'), configuredRoute));
    } else if (setupRequired && path !== '/setup' && path !== '/device-setup') {
      redirect(307, '/setup');
    } else if (isAuthenticated && path === '/setup' && (!user?.administrator || bootstrap?.setup?.complete !== false)) {
      redirect(307, startupRoute);
    } else if (!publicRoutes.includes(path) && !isAuthenticated) {
      // Redirect unauthorized users trying to access protected routes
      redirect(307, '/login');
    } else if (isAuthenticated && isDeferredV1Route(path)) {
      redirect(307, '/home');
    } else if (!publicRoutes.includes(path) && isAuthenticated && !hasRoutePermission(path, user)) {
      redirect(307, '/home');
    }

    return {
      authenticated: isAuthenticated,
      onboardingComplete,
    };
  }
