import React from "react";
import { mobileTranslations } from "./translations";
import type { MobileLocale, MobileTranslations } from "./types";

const LOCALE_STORAGE_KEY = "gyshell-mobile-locale";

interface MobileI18nContextValue {
  locale: MobileLocale;
  setLocale: (next: MobileLocale) => void;
  t: MobileTranslations;
}

const MobileI18nContext = React.createContext<MobileI18nContextValue | null>(
  null,
);

function detectBrowserLocale(): MobileLocale {
  const language = (window.navigator.language || "").toLowerCase();
  return language.startsWith("zh") ? "zh-CN" : "en";
}

function loadLocale(): MobileLocale {
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  return stored === "zh-CN" || stored === "en" ? stored : detectBrowserLocale();
}

export const MobileI18nProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const [locale, setLocaleState] = React.useState<MobileLocale>(() =>
    loadLocale(),
  );

  const setLocale = React.useCallback((next: MobileLocale) => {
    setLocaleState(next);
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
  }, []);

  const value = React.useMemo<MobileI18nContextValue>(() => {
    return {
      locale,
      setLocale,
      t: mobileTranslations[locale],
    };
  }, [locale, setLocale]);

  return (
    <MobileI18nContext.Provider value={value}>
      {children}
    </MobileI18nContext.Provider>
  );
};

export function useMobileI18n(): MobileI18nContextValue {
  const context = React.useContext(MobileI18nContext);
  if (!context) {
    throw new Error("useMobileI18n must be used within MobileI18nProvider");
  }
  return context;
}
