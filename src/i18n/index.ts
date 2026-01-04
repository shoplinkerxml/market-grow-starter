import React, { useEffect } from "react";
import type { ReactNode } from "react";
import { useI18nStore } from "./store";
import type { Lang } from "./types";

export const useI18n = () => {
  const lang = useI18nStore((state) => state.lang);
  const t = useI18nStore((state) => state.t);
  const setLang = useI18nStore((state) => state.setLang);
  const loading = useI18nStore((state) => state.loading);

  return { lang, t, setLang, loading };
};

type I18nProviderProps = {
  children: ReactNode;
  initialLang?: Lang;
};

export const I18nProvider = ({ children, initialLang }: I18nProviderProps) => {
  const init = useI18nStore((state) => state.init);
  const loading = useI18nStore((state) => state.loading);

  useEffect(() => {
    init(initialLang).catch(() => {});
  }, [init, initialLang]);

  if (loading) {
    return React.createElement(
      "div",
      {
        className:
          "min-h-screen flex items-center justify-center text-muted-foreground",
      },
      "Завантаження інтерфейсу..."
    );
  }

  return children;
};

export { useI18nStore };
