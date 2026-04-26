/**
 * Branding context — laedt einmal beim App-Boot /api/branding und stellt
 * Title/Logo/LoginSubtitle in einem React-Context bereit. Touchpoints:
 * Sidebar-Header, LoginPage, Browser-Tab-Title.
 */

import { createContext, useContext, useEffect, useState } from 'react';
import { apiGet } from '../utils/apiFetch';

const DEFAULT_BRANDING = {
  title: 'Workplace',
  logoUrl: null,
  loginSubtitle: null,
};

const BrandingContext = createContext(DEFAULT_BRANDING);

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(DEFAULT_BRANDING);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet('/branding');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const next = {
          title: data.title || DEFAULT_BRANDING.title,
          logoUrl: data.logoUrl || DEFAULT_BRANDING.logoUrl,
          loginSubtitle: data.loginSubtitle || DEFAULT_BRANDING.loginSubtitle,
        };
        setBranding(next);
        // Synchronously update browser-tab title.
        try { document.title = next.title; } catch { /* SSR-safe */ }
      } catch {
        /* keep defaults */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>;
}

export function useBranding() {
  return useContext(BrandingContext);
}
