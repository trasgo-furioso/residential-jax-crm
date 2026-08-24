'use client';

import { useEffect } from 'react';

/**
 * Prevents the browser from navigating away from the CRM domain.
 * Catches any external navigation attempts (e.g., from DuckDB WASM httpfs
 * redirects, misconfigured API URLs, or IPFS gateway redirects) and blocks them.
 */
export default function NavigationGuard() {
  useEffect(() => {
    // Block any attempt to navigate the main frame to an external domain
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Check if we're navigating to an external URL by inspecting the
      // document's pending navigation. This fires before the browser leaves.
      // We can't reliably detect the target URL here, but we can log it.
      console.warn('[NavigationGuard] beforeunload event fired — potential external redirect');
    };

    // Intercept clicks on anchor tags that point to external URLs
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin && !href.startsWith('/') && !href.startsWith('#')) {
          console.warn('[NavigationGuard] Blocked external navigation to:', href);
          e.preventDefault();
          e.stopPropagation();
        }
      } catch {
        // relative URL, safe to navigate
      }
    };

    // Override window.location setter to prevent programmatic external redirects
    const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
    let locationOverrideActive = false;

    try {
      const currentOrigin = window.location.origin;

      // Patch window.location.assign and window.location.replace
      const originalAssign = window.location.assign.bind(window.location);
      const originalReplace = window.location.replace.bind(window.location);

      window.location.assign = function guardedAssign(url: string) {
        try {
          const parsed = new URL(url, currentOrigin);
          if (parsed.origin !== currentOrigin) {
            console.error('[NavigationGuard] Blocked location.assign to external URL:', url);
            return;
          }
        } catch {
          // relative URL, safe
        }
        return originalAssign(url);
      };

      window.location.replace = function guardedReplace(url: string) {
        try {
          const parsed = new URL(url, currentOrigin);
          if (parsed.origin !== currentOrigin) {
            console.error('[NavigationGuard] Blocked location.replace to external URL:', url);
            return;
          }
        } catch {
          // relative URL, safe
        }
        return originalReplace(url);
      };

      locationOverrideActive = true;
    } catch {
      // location override not supported in this environment
    }

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
      // Note: we don't restore location.assign/replace on cleanup because
      // the guard should persist for the lifetime of the app
    };
  }, []);

  return null;
}
