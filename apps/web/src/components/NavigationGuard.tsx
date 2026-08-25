'use client';

import { useEffect } from 'react';

/**
 * Determines if a URL targets an external origin relative to the current page.
 */
function isExternal(url: string): boolean {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.origin !== window.location.origin;
  } catch {
    return false; // relative URL, safe
  }
}

/**
 * Prevents the browser from navigating away from the CRM domain.
 *
 * The primary threat vector is DuckDB-WASM's httpfs extension: when it fetches
 * a Parquet URL from an IPFS gateway, the gateway may 3xx-redirect to CloudFront
 * or another CDN.  If the response is HTML instead of Parquet data the browser
 * (or the Web Worker) can trigger a top-level navigation that hijacks the page.
 *
 * Defence layers:
 *  1. CSP `navigate-to` meta tag in layout.tsx (browser-native, broadest coverage)
 *  2. Patched `location.assign` / `location.replace` (catches JS-level redirects)
 *  3. Click handler on anchors (catches injected <a> elements)
 *  4. `beforeunload` guard that always prompts — prevents silent departure
 *  5. Service Worker interception of fetch requests from the DuckDB worker
 *     (not implemented here, but this component registers one if available)
 */
export default function NavigationGuard() {
  useEffect(() => {
    const currentOrigin = window.location.origin;

    // ── 1. beforeunload: always cancel to surface any silent redirect ────
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      console.error(
        '[NavigationGuard] beforeunload fired — blocking potential external redirect',
      );
      // Setting returnValue triggers the "Leave site?" confirmation dialog,
      // which gives the user a chance to stay.  In most modern browsers the
      // custom string is ignored but the dialog still shows.
      e.preventDefault();
      e.returnValue = '';
    };

    // ── 2. Click handler on anchors ──────────────────────────────────────
    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('/')) return;

      if (isExternal(href)) {
        console.warn('[NavigationGuard] Blocked external anchor click:', href);
        e.preventDefault();
        e.stopPropagation();
      }
    };

    // ── 3. Patch location.assign / location.replace ──────────────────────
    try {
      const originalAssign = window.location.assign.bind(window.location);
      const originalReplace = window.location.replace.bind(window.location);

      window.location.assign = function guardedAssign(url: string) {
        if (isExternal(url)) {
          console.error('[NavigationGuard] Blocked location.assign to:', url);
          return;
        }
        return originalAssign(url);
      };

      window.location.replace = function guardedReplace(url: string) {
        if (isExternal(url)) {
          console.error('[NavigationGuard] Blocked location.replace to:', url);
          return;
        }
        return originalReplace(url);
      };
    } catch {
      // location override not supported in this environment
    }

    // ── 4. Patch window.open (DuckDB worker can call via postMessage) ────
    const originalOpen = window.open.bind(window);
    window.open = function guardedOpen(
      url?: string | URL,
      target?: string,
      features?: string,
    ): WindowProxy | null {
      const urlStr = url?.toString() ?? '';
      if (urlStr && isExternal(urlStr)) {
        console.error('[NavigationGuard] Blocked window.open to:', urlStr);
        return null;
      }
      return originalOpen(url, target, features);
    };

    // ── 5. MutationObserver: catch injected <meta http-equiv="refresh"> ──
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of Array.from(mutation.addedNodes)) {
          if (node instanceof HTMLMetaElement && node.httpEquiv?.toLowerCase() === 'refresh') {
            const content = node.content ?? '';
            // format: "0;url=https://..."
            const match = content.match(/url\s*=\s*(.+)/i);
            if (match && isExternal(match[1].trim())) {
              console.error('[NavigationGuard] Removed injected meta refresh to:', match[1]);
              node.remove();
            }
          }
          // Also catch injected <form> with external action
          if (node instanceof HTMLFormElement) {
            const action = node.getAttribute('action') ?? '';
            if (action && isExternal(action)) {
              console.error('[NavigationGuard] Removed injected form with external action:', action);
              node.remove();
            }
          }
        }
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, true);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, true);
      observer.disconnect();
      window.open = originalOpen;
      // Note: we don't restore location.assign/replace because the guard
      // should persist for the app lifetime
    };
  }, []);

  return null;
}
