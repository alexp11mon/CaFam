"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  localeFromAcceptLanguage,
  type Locale,
} from "@/lib/i18n/locale";
import { makeT, spanishT, type Messages, type T } from "@/lib/i18n/translate";

type LocaleValue = { locale: Locale; t: T };

const LocaleContext = createContext<LocaleValue>({
  locale: DEFAULT_LOCALE,
  t: spanishT,
});

/**
 * The language of a subtree. The dashboard frame passes the English catalog
 * from the server, so it paints in English already (spec 053 plan D9).
 */
export function LocaleProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: Messages | null;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, t: locale === "en" ? makeT(messages) : spanishT }),
    [locale, messages],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return (
    <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>
  );
}

function browserLocale(): Locale {
  const cookie = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE}=(es|en)(?:;|$)`),
  );
  return cookie
    ? (cookie[1] as Locale)
    : localeFromAcceptLanguage(navigator.languages?.join(",") ?? null);
}

/**
 * Pages without a session: the cookie or the browser picks the language and
 * the English catalog loads only then (RF-2, plan D9). Spanish loads nothing.
 */
export function BrowserLocale({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Messages | null>(null);
  useEffect(() => {
    if (browserLocale() !== "en") return;
    let live = true;
    void import("@/i18n/en").then(({ EN }) => {
      if (live) setMessages(EN);
    });
    return () => {
      live = false;
    };
  }, []);
  return (
    <LocaleProvider locale={messages ? "en" : "es"} messages={messages}>
      {children}
    </LocaleProvider>
  );
}

export function useT(): T {
  return useContext(LocaleContext).t;
}

export function useLocale(): Locale {
  return useContext(LocaleContext).locale;
}

/** A translated text inside a server component (plan D8). */
export function T({
  children,
  vars,
}: {
  children: string;
  vars?: Readonly<Record<string, string | number>>;
}) {
  return useT()(children, vars);
}
