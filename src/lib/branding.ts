"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/store/app-store";

// Application + login-screen branding, configured by the Admin in
// Settings → Clinic Identity → App Branding / Login Screen Design and stored
// in Supabase app_settings (no new tables needed).
//
// Keys: appName, appTagline, appLogo, loginTitle, loginSubtitle,
//       loginTheme, loginFooter.

export interface Branding {
  appName: string;
  appTagline: string;
  appLogo: string;
  loginTitle: string;
  loginSubtitle: string;
  loginTheme: string;
  loginFooter: string;
}

export const DEFAULT_BRANDING: Branding = {
  appName: "MediCore CRM",
  appTagline: "Enterprise Hospital Management",
  appLogo: "",
  loginTitle: "Healthcare, reimagined.",
  loginSubtitle: "The complete hospital management platform — patient care, billing, pharmacy, lab, radiology, insurance, and analytics in one unified system.",
  loginTheme: "teal",
  loginFooter: "© 2026 MediCore Systems. All rights reserved.",
};

export interface LoginTheme {
  label: string;
  hero: string;
  button: string;
  softButton: string;
}

export const LOGIN_THEMES: Record<string, LoginTheme> = {
  teal: {
    label: "Teal (default)",
    hero: "from-teal-600 via-teal-700 to-emerald-800",
    button: "bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700",
    softButton: "bg-teal-600 hover:bg-teal-700",
  },
  indigo: {
    label: "Indigo",
    hero: "from-indigo-600 via-indigo-700 to-violet-800",
    button: "bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700",
    softButton: "bg-indigo-600 hover:bg-indigo-700",
  },
  slate: {
    label: "Midnight",
    hero: "from-slate-700 via-slate-800 to-slate-950",
    button: "bg-gradient-to-r from-slate-700 to-slate-900 hover:from-slate-800 hover:to-slate-950",
    softButton: "bg-slate-700 hover:bg-slate-800",
  },
  rose: {
    label: "Rose",
    hero: "from-rose-600 via-rose-700 to-orange-700",
    button: "bg-gradient-to-r from-rose-600 to-orange-600 hover:from-rose-700 hover:to-orange-700",
    softButton: "bg-rose-600 hover:bg-rose-700",
  },
};

export function brandingFromSettings(settings: Record<string, string> = {}): Branding {
  return {
    appName: settings.appName?.trim() || DEFAULT_BRANDING.appName,
    appTagline: settings.appTagline?.trim() || DEFAULT_BRANDING.appTagline,
    appLogo: settings.appLogo?.trim() || "",
    loginTitle: settings.loginTitle?.trim() || DEFAULT_BRANDING.loginTitle,
    loginSubtitle: settings.loginSubtitle?.trim() || DEFAULT_BRANDING.loginSubtitle,
    loginTheme: LOGIN_THEMES[settings.loginTheme] ? settings.loginTheme : "teal",
    loginFooter: settings.loginFooter?.trim() || DEFAULT_BRANDING.loginFooter,
  };
}

export function loginThemeOf(branding: Branding): LoginTheme {
  return LOGIN_THEMES[branding.loginTheme] ?? LOGIN_THEMES.teal;
}

// Works before login too: merges the store cache with a direct settings
// fetch, so the login/portal screens always show the saved design.
export function useBranding(): Branding {
  const storeSettings = useAppStore((s) => s.settings);
  const [remote, setRemote] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok && !cancelled) setRemote(await res.json());
      } catch { /* offline: store cache only */ }
    })();
    return () => { cancelled = true; };
  }, []);
  // Remote (fresh from Supabase) wins over the possibly stale persisted cache.
  return brandingFromSettings({ ...storeSettings, ...remote });
}
